/**
 * Offline Action Queue
 *
 * Stores user actions when offline and syncs them when connection is restored.
 * Critical for ADHD users who may be in areas without internet.
 *
 * Features:
 * - IndexedDB-based persistent storage (P0 fix: moved from localStorage)
 * - localStorage fallback if IndexedDB unavailable
 * - Automatic sync on reconnection
 * - Retry logic with exponential backoff
 * - Action deduplication
 * - Conflict protection for durable event-log writes
 * - Background Sync API support for sync after browser close
 */

// Type declarations for Background Sync API
declare global {
  interface SyncManager {
    register(tag: string): Promise<void>;
    getTags(): Promise<string[]>;
  }

  interface ServiceWorkerRegistration {
    sync: SyncManager;
  }

  interface Window {
    SyncManager: {
      prototype: SyncManager;
    };
  }
}

import { logger } from "./logger";
import { generateSecureRandom } from "./validation";
import { safeLocalStorageGet, safeLocalStorageSet, storageRemove } from "./safeJson";
import { SK } from "./storageKeys";
import { db, getLocalDataOwnerId, OfflineQueueItem } from "@/storage/db";
import { recordSyncHealthReceipt } from "@/observability/syncHealthRecorder";
import { getCurrentSessionUserId } from "./supabaseClient";
import { runWithOriginExclusiveLock } from "./originExclusiveLock";

// Action types that can be queued
export type OfflineActionType =
  | "CREATE_MOOD"
  | "UPDATE_MOOD"
  | "DELETE_MOOD"
  | "CREATE_HABIT"
  | "UPDATE_HABIT"
  | "DELETE_HABIT"
  | "TOGGLE_HABIT"
  | "CREATE_FOCUS_SESSION"
  | "CREATE_GRATITUDE"
  | "DELETE_GRATITUDE"
  | "UPDATE_SETTINGS"
  | "DELETE_SETTINGS"
  | "SYNC_JOURNAL_ENTRY"
  | "DELETE_JOURNAL_ENTRY"
  | "UPLOAD_JOURNAL_PHOTO_STORAGE"
  | "UPLOAD_JOURNAL_AUDIO_STORAGE"
  | "DELETE_JOURNAL_PHOTO_STORAGE"
  | "DELETE_JOURNAL_AUDIO_STORAGE"
  | "MIGRATE_JOURNAL_SECURITY"
  | "WRITE_SYNC_EVENT";

export type OfflineActionPriority = "critical" | "high" | "normal" | "low";

export interface OfflineQueueEnqueueOptions {
  /** Owner observed by the caller before it began preparing this payload. */
  expectedOwnerUserId: string;
  maxRetries?: number;
  deduplicate?: boolean;
  priority?: OfflineActionPriority;
}

function isCriticalAction(action: OfflineAction): boolean {
  // WRITE_SYNC_EVENT predates queue priorities and remains critical for
  // backwards-compatible persisted rows. New privacy/security migrations opt
  // in explicitly with priority=critical and must never be silently discarded.
  return action.type === "WRITE_SYNC_EVENT" || action.priority === "critical";
}

function isBlockedCriticalAction(action: OfflineAction): boolean {
  return isCriticalAction(action) && action.retries >= action.maxRetries;
}

export interface OfflineQueueHandlerContext {
  /** Owner persisted on the queue row and re-verified by the queue. */
  readonly ownerUserId: string;
  /**
   * Re-check the active session at the last possible point before a mutation.
   * The owner is queue-bound; handlers cannot substitute a caller-provided id.
   */
  runIfOwnerCurrent<T>(operation: () => Promise<T> | T): Promise<T>;
}

class OfflineQueueOwnerBoundaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfflineQueueOwnerBoundaryError";
  }
}

class OfflineQueueActionRequeuedError extends Error {
  constructor() {
    super("Offline queue action was requeued while its handler was running");
    this.name = "OfflineQueueActionRequeuedError";
  }
}

export interface OfflineAction {
  id: string;
  type: OfflineActionType;
  entityId: string; // ID of the entity being modified
  /** Account that created the action. Missing only on quarantined legacy rows. */
  ownerUserId?: string;
  payload: unknown;
  timestamp: number;
  retries: number;
  maxRetries: number;
  lastError?: string;
  priority?: OfflineActionPriority; // V2: priority queue support (default: "normal")
}

const PRIORITY_ORDER: Record<OfflineActionPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

/**
 * Compact redundant operations on the same entity.
 * - UPDATE + UPDATE same entity → keep latest UPDATE only
 * - CREATE + DELETE same entity → remove both (net zero)
 * - CREATE + UPDATE same entity → keep CREATE with latest payload
 */
export function compactQueue(actions: OfflineAction[]): OfflineAction[] {
  const syncEventActions = actions.filter((action) => action.type === "WRITE_SYNC_EVENT");
  const compactableActions = actions.filter((action) => action.type !== "WRITE_SYNC_EVENT");
  const byEntity = new Map<string, OfflineAction[]>();

  for (const action of compactableActions) {
    const key = `${action.ownerUserId ?? "__legacy_unowned__"}:${action.entityId}`;
    const existing = byEntity.get(key) || [];
    existing.push(action);
    byEntity.set(key, existing);
  }

  const compacted: OfflineAction[] = [];

  for (const [, entityActions] of byEntity) {
    if (entityActions.length === 1) {
      compacted.push(entityActions[0]);
      continue;
    }

    const types = entityActions.map((a) => a.type);
    const hasCreate = types.some((t) => t.startsWith("CREATE") || t === "SYNC_JOURNAL_ENTRY");
    const hasDelete = types.some((t) => t.startsWith("DELETE"));

    if (hasCreate && hasDelete) {
      // CREATE + DELETE = net zero, skip all
      continue;
    }

    // Keep only the latest action for this entity
    const latest = entityActions[entityActions.length - 1];
    if (hasCreate) {
      // CREATE + UPDATE = keep CREATE with latest payload
      const createAction = entityActions.find(
        (a) => a.type.startsWith("CREATE") || a.type === "SYNC_JOURNAL_ENTRY"
      )!;
      compacted.push({ ...createAction, payload: latest.payload, timestamp: latest.timestamp });
    } else {
      compacted.push(latest);
    }
  }

  // Sort by priority then timestamp
  return [...compacted, ...syncEventActions].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority || "normal"];
    const pb = PRIORITY_ORDER[b.priority || "normal"];
    if (pa !== pb) return pa - pb;
    return a.timestamp - b.timestamp;
  });
}

interface QueueState {
  actions: OfflineAction[];
  lastProcessedAt: number | null;
  isProcessing: boolean;
}

const MAX_QUEUE_SIZE = 1000; // Prevent unbounded growth
const DEFAULT_MAX_RETRIES = 5;
const RETRY_BASE_DELAY = 1000; // 1 second
const RETRY_MAX_DELAY = 60000; // 1 minute
const DATA_WRITE_BARRIER_LOCK = "zenflow:data-write-barrier";

class OfflineQueue {
  private state: QueueState = {
    actions: [],
    lastProcessedAt: null,
    isProcessing: false,
  };
  private listeners: Set<(state: QueueState) => void> = new Set();
  private syncHandlers: Map<
    OfflineActionType,
    (action: OfflineAction, context: OfflineQueueHandlerContext) => Promise<void>
  > = new Map();
  private processingPromise: Promise<void> | null = null;
  private accountBoundarySuspended = false;
  private processingActionIds = new Set<string>();
  private requeuedDuringProcessing = new Set<string>();
  private observedAuthOwnerUserId: string | null | undefined;
  private authOwnerGeneration = 0;

  // Promise to track initialization - operations must await this before modifying queue
  private initPromise: Promise<void> | null = null;

  // P0-2 Fix: Mutex for serializing enqueue operations to prevent race conditions
  // Without this, rapid concurrent enqueue() calls could both read state.actions,
  // both decide to add (missing deduplication), and create duplicates
  private enqueueLock: Promise<void> | null = null;

  // Bound event handlers for proper cleanup (all handlers must be bound for removal)
  private boundHandleOnline = () => this.handleOnline();
  private boundHandleOffline = () => this.handleOffline();
  private boundHandleSWMessage = (event: MessageEvent) => this.handleSWMessage(event);

  constructor() {
    // Load persisted queue on init - now properly awaited via initPromise
    this.initPromise = this.initializeStorage();

    // Listen for online/offline events
    if (typeof window !== "undefined") {
      window.addEventListener("online", this.boundHandleOnline);
      window.addEventListener("offline", this.boundHandleOffline);

      // Listen for Background Sync messages from Service Worker
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.addEventListener("message", this.boundHandleSWMessage);
      }
    }
  }

  /**
   * Handle messages from Service Worker (e.g., Background Sync trigger)
   */
  private handleSWMessage(event: MessageEvent): void {
    // S5: Origin validation — reject messages from different origins or empty origin
    if (!event.origin || event.origin !== location.origin) return;
    if (event.data?.type === "SYNC_REQUESTED") {
      logger.log("[OfflineQueue] Background Sync triggered by SW");
      void this.processQueue();
    }
  }

  /**
   * Cleanup event listeners - call when destroying the queue
   * Now properly removes ALL listeners including SW message handler
   */
  destroy(): void {
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.boundHandleOnline);
      window.removeEventListener("offline", this.boundHandleOffline);

      // Remove SW message listener to prevent memory leak
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", this.boundHandleSWMessage);
      }
    }
    this.listeners.clear();
    this.syncHandlers.clear();
    logger.log("[OfflineQueue] Destroyed");
  }

  /**
   * Register a handler for a specific action type
   */
  registerHandler(
    type: OfflineActionType,
    handler: (action: OfflineAction, context: OfflineQueueHandlerContext) => Promise<void>
  ): void {
    this.syncHandlers.set(type, handler);
  }

  /**
   * Records every auth identity transition, including A -> B -> A sequences.
   * Owner equality alone cannot detect that ABA boundary after async work.
   */
  observeAuthStateOwner(ownerUserId: string | null): number {
    if (
      this.observedAuthOwnerUserId === undefined ||
      this.observedAuthOwnerUserId !== ownerUserId
    ) {
      this.observedAuthOwnerUserId = ownerUserId;
      this.authOwnerGeneration += 1;
    }
    return this.authOwnerGeneration;
  }

  /**
   * Add an action to the queue
   * Now awaits initialization before modifying queue
   * P0-2 Fix: Uses mutex to prevent race conditions in concurrent calls
   */
  async enqueue(
    type: OfflineActionType,
    entityId: string,
    payload: unknown,
    options: OfflineQueueEnqueueOptions
  ): Promise<void> {
    // Wait for initialization to complete before modifying queue
    if (this.initPromise) {
      await this.initPromise;
    }

    if (this.accountBoundarySuspended) {
      throw new OfflineQueueOwnerBoundaryError(
        "Offline queue is suspended for an account boundary",
      );
    }

    // P0-2 Fix: Acquire mutex lock to serialize state modifications
    // This prevents race conditions where two concurrent enqueue() calls
    // both read the same state, both decide the action doesn't exist,
    // and both create duplicates (bypassing deduplication logic)
    if (this.enqueueLock) {
      await this.enqueueLock;
    }

    if (this.accountBoundarySuspended) {
      throw new OfflineQueueOwnerBoundaryError(
        "Offline queue is suspended for an account boundary",
      );
    }

    // Create a new lock promise for this operation
    // INTENTIONAL: noop initializer satisfies TS strict mode — Promise executor assigns synchronously
    let releaseLock: () => void = () => {
      /* replaced by Promise resolve */
    };
    this.enqueueLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    try {
      await this.doEnqueue(type, entityId, payload, options);
    } finally {
      // Release the lock so next caller can proceed
      releaseLock();
      this.enqueueLock = null;
    }
  }

  /**
   * Internal enqueue implementation (called within mutex lock)
   */
  private async doEnqueue(
    type: OfflineActionType,
    entityId: string,
    payload: unknown,
    options: OfflineQueueEnqueueOptions
  ): Promise<void> {
    if (!options?.expectedOwnerUserId) {
      throw new OfflineQueueOwnerBoundaryError(
        "Offline queue owner mismatch: an originating account is required"
      );
    }

    const {
      expectedOwnerUserId,
      maxRetries = DEFAULT_MAX_RETRIES,
      deduplicate = true,
      priority = "normal",
    } = options;

    const activeOwnerUserId = await getCurrentSessionUserId();
    this.observeAuthStateOwner(activeOwnerUserId);

    if (!activeOwnerUserId) {
      logger.warn("[OfflineQueue] Refusing to queue a cloud action without an active account");
      throw new Error("Sign in before queuing changes for sync");
    }

    if (activeOwnerUserId !== expectedOwnerUserId) {
      logger.warn("[OfflineQueue] Refusing to queue an action after the active account changed");
      throw new OfflineQueueOwnerBoundaryError(
        "Offline queue owner mismatch: the active account changed before enqueue"
      );
    }

    const ownerUserId = expectedOwnerUserId;

    // Check queue size limit - BLOCK instead of silently dropping
    // This prevents critical data loss without user awareness
    const QUEUE_WARNING_THRESHOLD = MAX_QUEUE_SIZE - 10; // Warn at 90%

    if (this.state.actions.length >= MAX_QUEUE_SIZE) {
      logger.error("[OfflineQueue] Queue FULL - blocking new action to prevent data loss");

      // Emit blocking event - UI MUST show prompt to user
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("zenflow:offline-queue-full", {
            detail: {
              queueSize: this.state.actions.length,
              maxSize: MAX_QUEUE_SIZE,
              message: "Offline queue full. Please connect to internet to sync your data.",
              actionType: type,
              entityId,
            },
          })
        );
      }

      // Don't drop data - throw error so caller knows enqueue failed
      throw new Error(`Offline queue full (${MAX_QUEUE_SIZE} items). Connect to sync.`);
    }

    // Emit warning when approaching limit (90%)
    if (this.state.actions.length >= QUEUE_WARNING_THRESHOLD) {
      logger.warn(
        `[OfflineQueue] Queue at ${this.state.actions.length}/${MAX_QUEUE_SIZE} - approaching limit`
      );
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("zenflow:offline-queue-warning", {
            detail: {
              queueSize: this.state.actions.length,
              maxSize: MAX_QUEUE_SIZE,
              remaining: MAX_QUEUE_SIZE - this.state.actions.length,
            },
          })
        );
      }
    }

    // Deduplicate: update existing action in-place to preserve queue order
    if (deduplicate) {
      const existingIndex = this.state.actions.findIndex(
        (a) => a.ownerUserId === ownerUserId && a.entityId === entityId && a.type === type
      );

      if (existingIndex !== -1) {
        // Update existing action in-place (preserve position in queue)
        const existing = this.state.actions[existingIndex];
        const requeuedWhileProcessing = this.processingActionIds.has(existing.id);
        existing.payload = payload;
        existing.timestamp = Date.now();
        if (requeuedWhileProcessing) {
          this.requeuedDuringProcessing.add(existing.id);
        } else {
          existing.retries = 0; // A new user edit gets a fresh retry budget.
          existing.lastError = undefined;
        }
        logger.log("[OfflineQueue] Action deduplicated in-place:", type, entityId);
        await this.persistToStorage();
        this.notifyListeners();

        // If online, try to process immediately
        if (navigator.onLine) {
          void this.processQueue();
        } else {
          this.requestBackgroundSync();
        }
        return; // Don't add new action, we updated existing
      }
    }

    const action: OfflineAction = {
      id: `${type}_${entityId}_${Date.now()}_${generateSecureRandom()}`,
      type,
      entityId,
      ownerUserId,
      payload,
      timestamp: Date.now(),
      retries: 0,
      maxRetries,
      priority,
    };

    this.state.actions.push(action);
    await this.persistToStorage();
    this.notifyListeners();

    logger.log("[OfflineQueue] Action queued:", type, entityId);
    recordSyncHealthReceipt({
      kind: "queued",
      source: "queue",
      actionType: type,
      priority: action.priority || "normal",
    });

    // If online, try to process immediately
    if (navigator.onLine) {
      void this.processQueue();
    } else {
      // Register for Background Sync when offline
      this.requestBackgroundSync();
    }
  }

  /**
   * Request Background Sync via Service Worker
   * This allows sync to happen even if user closes the browser
   * P2-6 Fix: Improved error handling with event emission for UI awareness
   */
  private requestBackgroundSync(): void {
    // Check if Background Sync API is available
    if (!("serviceWorker" in navigator)) {
      logger.log("[OfflineQueue] Service Worker not supported, skipping Background Sync");
      return;
    }

    // Check for SyncManager support
    if (!("SyncManager" in window)) {
      logger.log("[OfflineQueue] Background Sync API not supported");
      return;
    }

    navigator.serviceWorker.ready
      .then((registration) => {
        return registration.sync.register("zenflow-sync");
      })
      .then(() => {
        logger.log("[OfflineQueue] Background Sync registered");
      })
      .catch((err) => {
        // P2-6 Fix: Emit event so UI can inform user about sync status
        logger.warn("[OfflineQueue] Background Sync registration failed:", err);
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("zenflow:background-sync-failed", {
              detail: {
                error: err instanceof Error ? err.message : String(err),
                pendingActions: this.state.actions.length,
                message: "Background sync unavailable. Data will sync when you return to the app.",
              },
            })
          );
        }
      });
  }

  /**
   * Remove an action from the queue (e.g., after successful sync)
   */
  private async removeAction(actionId: string): Promise<void> {
    this.state.actions = this.state.actions.filter((a) => a.id !== actionId);
    await this.persistToStorage();
    this.notifyListeners();
  }

  /**
   * Process all queued actions
   * Now awaits initialization before processing
   */
  async processQueue(): Promise<void> {
    // Wait for initialization to complete before processing
    if (this.initPromise) {
      await this.initPromise;
    }

    if (this.accountBoundarySuspended) return;

    // Mutex: prevent concurrent processing
    if (this.processingPromise) {
      await this.processingPromise;
      // After waiting, check if there are still items to process (may have been added during wait)
      const currentOwnerUserId = await getCurrentSessionUserId();
      const hasCurrentOwnerActions = this.hasProcessableActionsForOwner(currentOwnerUserId);
      if (navigator.onLine && hasCurrentOwnerActions && this.processingPromise === null) {
        // Recursively process new items
        return this.processQueue();
      }
      return;
    }

    if (!navigator.onLine || this.state.actions.length === 0) {
      return;
    }

    const ownerUserId = await getCurrentSessionUserId();
    const ownerGeneration = this.observeAuthStateOwner(ownerUserId);
    if (!ownerUserId) {
      logger.warn("[OfflineQueue] Queue paused because no account is active");
      return;
    }

    // Compact before processing: collapse redundant operations (CREATE+DELETE=noop, UPDATE+UPDATE=latest)
    if (this.state.actions.length > 1) {
      const before = this.state.actions.length;
      this.state.actions = compactQueue(this.state.actions);
      if (this.state.actions.length < before) {
        logger.log(`[OfflineQueue] Compacted: ${before} → ${this.state.actions.length}`);
        await this.persistToStorage();
      }
    }

    this.processingPromise = this.doProcessQueue(ownerUserId, ownerGeneration);
    try {
      await this.processingPromise;
    } finally {
      this.processingPromise = null;
    }

    // After processing, check if new items were added during processing
    const currentOwnerUserId = await getCurrentSessionUserId();
    const currentOwnerGeneration = this.observeAuthStateOwner(currentOwnerUserId);
    if (currentOwnerGeneration !== ownerGeneration) return;
    const hasCurrentOwnerActions = this.hasProcessableActionsForOwner(currentOwnerUserId);
    if (!this.accountBoundarySuspended && navigator.onLine && hasCurrentOwnerActions) {
      return this.processQueue();
    }
  }

  private async doProcessQueue(ownerUserId: string, ownerGeneration: number): Promise<void> {
    if (this.state.isProcessing) return;

    this.state.isProcessing = true;
    this.notifyListeners();

    logger.log("[OfflineQueue] Processing queue, actions:", this.state.actions.length);

    // Process actions in order (FIFO)
    const actionsToProcess = [...this.state.actions];

    for (const action of actionsToProcess) {
      if (this.accountBoundarySuspended) {
        logger.log("[OfflineQueue] Account boundary requested, pausing queue");
        break;
      }
      if (!navigator.onLine) {
        logger.log("[OfflineQueue] Went offline during processing, pausing");
        break;
      }

      // Legacy rows have no trustworthy owner. Rows from a different account
      // stay quarantined until that account is active again.
      if (!action.ownerUserId || action.ownerUserId !== ownerUserId) {
        continue;
      }
      if (isBlockedCriticalAction(action)) {
        continue;
      }

      const handler = this.syncHandlers.get(action.type);
      if (!handler) {
        logger.warn("[OfflineQueue] No handler for action type:", action.type);
        // Startup hydration can finish before feature handlers register. A
        // restored critical intent must stay durable through that window;
        // handler initialization will trigger the next processing pass.
        if (isCriticalAction(action)) {
          continue;
        }
        await this.removeAction(action.id);
        continue;
      }

      this.processingActionIds.add(action.id);
      try {
        // Verify again immediately before handing control to the mutation handler.
        const actionOwnerGeneration = await this.assertActiveOwner(
          action.ownerUserId,
          ownerGeneration,
        );
        await handler(
          action,
          this.createHandlerContext(action.ownerUserId, actionOwnerGeneration),
        );
        if (this.requeuedDuringProcessing.delete(action.id)) {
          throw new OfflineQueueActionRequeuedError();
        }
        // A handler can finish its domain mutation after auth changes while a
        // secondary ordered-event write refuses the stale owner. Never
        // acknowledge the durable queue intent until the same owner is still
        // active after the complete handler returns.
        await this.assertActiveOwner(action.ownerUserId, actionOwnerGeneration);
        await this.removeAction(action.id);
        logger.log("[OfflineQueue] Action processed:", action.type, action.entityId);
        recordSyncHealthReceipt({
          kind: "processed",
          source: "queue",
          actionType: action.type,
          priority: action.priority || "normal",
        });
      } catch (error) {
        if (error instanceof OfflineQueueOwnerBoundaryError) {
          logger.warn("[OfflineQueue] Queue paused because the active account changed");
          break;
        }

        if (this.accountBoundarySuspended) {
          logger.warn("[OfflineQueue] Queue paused for account-boundary cleanup");
          break;
        }

        if (error instanceof OfflineQueueActionRequeuedError) {
          action.retries = 0;
          action.lastError = undefined;
          await this.persistToStorage();
          logger.log(
            "[OfflineQueue] Newer payload kept for the next processing pass:",
            action.type,
            action.entityId,
          );
          continue;
        }

        logger.error("[OfflineQueue] Action failed:", action.type, error);
        recordSyncHealthReceipt({
          kind: "failed",
          source: "queue",
          actionType: action.type,
          priority: action.priority || "normal",
          errorName: error instanceof Error ? error.name : "UnknownError",
        });

        action.retries++;
        action.lastError = error instanceof Error ? error.message : String(error);

        if (action.retries >= action.maxRetries) {
          if (isCriticalAction(action)) {
            logger.error(
              "[OfflineQueue] Critical action blocked after max retries:",
              action.id
            );
            recordSyncHealthReceipt({
              kind: "queue-blocked",
              source: "queue",
              actionType: action.type,
              priority: action.priority || "normal",
              errorName: error instanceof Error ? error.name : "UnknownError",
            });
            this.dispatchBlockedCriticalAction(action);
          } else {
            logger.error("[OfflineQueue] Max retries reached, discarding action:", action.id);
            await this.removeAction(action.id);
          }
        } else {
          // Exponential backoff before retry
          const delay = Math.min(RETRY_BASE_DELAY * Math.pow(2, action.retries), RETRY_MAX_DELAY);
          logger.log(`[OfflineQueue] Will retry in ${delay}ms`);
          await this.sleep(delay);
        }

        await this.persistToStorage();
      } finally {
        this.processingActionIds.delete(action.id);
        this.requeuedDuringProcessing.delete(action.id);
      }
    }

    this.state.isProcessing = false;
    this.state.lastProcessedAt = Date.now();
    await this.persistToStorage();
    this.notifyListeners();

    logger.log("[OfflineQueue] Queue processing complete, remaining:", this.state.actions.length);
  }

  private hasProcessableActionsForOwner(ownerUserId: string | null): boolean {
    if (!ownerUserId) return false;
    return this.state.actions.some(
      (action) =>
        action.ownerUserId === ownerUserId &&
        !isBlockedCriticalAction(action) &&
        this.syncHandlers.has(action.type)
    );
  }

  /**
   * Get current queue state
   */
  getState(): QueueState {
    return { ...this.state, actions: [...this.state.actions] };
  }

  /**
   * Get the device-wide pending count, including quarantined legacy/other-owner rows.
   * Account decisions should use getPendingCountForOwner instead.
   */
  getPendingCount(): number {
    return this.state.actions.length;
  }

  /** Pending work belonging to one verified account; quarantined rows are excluded. */
  getPendingCountForOwner(ownerUserId: string): number {
    if (!ownerUserId) return 0;
    return this.state.actions.filter((action) => action.ownerUserId === ownerUserId).length;
  }

  /**
   * Device-wide pending check. Account sign-out/timeout gates should use
   * hasPendingActionsForOwner with a separately verified session owner.
   */
  hasPendingActions(): boolean {
    return this.state.actions.length > 0;
  }

  /** Whether one verified account has work; legacy and other-owner rows do not block it. */
  hasPendingActionsForOwner(ownerUserId: string): boolean {
    return this.getPendingCountForOwner(ownerUserId) > 0;
  }

  /**
   * Destructive account flows must await persisted initialization and any
   * in-flight enqueue before deciding that an owner's queue is empty.
   */
  async hasPendingActionsForOwnerReady(ownerUserId: string): Promise<boolean> {
    if (!ownerUserId) return false;
    if (this.initPromise) await this.initPromise;
    if (this.enqueueLock) await this.enqueueLock;
    // A pre-owner-schema row cannot be assigned to an arbitrary session, but
    // it is still unsaved user work. Treat it as blocking for every destructive
    // account boundary until a trusted cold-start session claims it.
    return (
      this.hasPendingActionsForOwner(ownerUserId) ||
      this.state.actions.some((action) => !action.ownerUserId)
    );
  }

  /** Whether an upgrade left queue rows that have not yet been owner-bound. */
  async hasUnownedLegacyActionsReady(): Promise<boolean> {
    if (this.initPromise) await this.initPromise;
    if (this.enqueueLock) await this.enqueueLock;
    return this.state.actions.some((action) => !action.ownerUserId);
  }

  /**
   * Bind pre-owner-schema rows only after auth and the local database have
   * independently been bound to the same account. The shared DATA lock keeps
   * this migration mutually exclusive with account cleanup in every tab.
   */
  async claimLegacyActionsForOwner(ownerUserId: string): Promise<number> {
    if (!ownerUserId) {
      throw new OfflineQueueOwnerBoundaryError(
        "Offline queue owner mismatch: a legacy claim requires an account",
      );
    }
    if (this.initPromise) await this.initPromise;
    if (this.enqueueLock) await this.enqueueLock;

    let releaseLock: () => void = () => {
      /* replaced by Promise resolve */
    };
    this.enqueueLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    try {
      return await runWithOriginExclusiveLock(DATA_WRITE_BARRIER_LOCK, async () => {
        if (this.accountBoundarySuspended) {
          throw new OfflineQueueOwnerBoundaryError(
            "Offline queue is suspended for an account boundary",
          );
        }

        const activeOwnerUserId = await getCurrentSessionUserId();
        const localOwnerUserId = await getLocalDataOwnerId();
        const ownerGeneration = this.observeAuthStateOwner(activeOwnerUserId);
        if (activeOwnerUserId !== ownerUserId || localOwnerUserId !== ownerUserId) {
          throw new OfflineQueueOwnerBoundaryError(
            "Offline queue owner mismatch: legacy rows cannot be claimed by this account",
          );
        }

        const legacyActions = this.state.actions.filter((action) => !action.ownerUserId);
        if (legacyActions.length === 0) return 0;

        for (const action of legacyActions) action.ownerUserId = ownerUserId;
        try {
          await this.persistToStorage();
          await this.assertActiveOwner(ownerUserId, ownerGeneration);
          if ((await getLocalDataOwnerId()) !== ownerUserId) {
            throw new OfflineQueueOwnerBoundaryError(
              "Offline queue owner mismatch: local data changed during legacy migration",
            );
          }
        } catch (error) {
          for (const action of legacyActions) action.ownerUserId = undefined;
          await this.persistToStorage();
          throw error;
        }

        this.notifyListeners();
        logger.log(
          "[OfflineQueue] Claimed legacy actions for the verified local owner:",
          legacyActions.length,
        );
        return legacyActions.length;
      });
    } finally {
      releaseLock();
      this.enqueueLock = null;
    }
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: QueueState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  /**
   * Clear all pending actions (use with caution)
   * Now async to await initialization
   */
  async clearQueue(): Promise<void> {
    // Wait for initialization before clearing
    if (this.initPromise) {
      await this.initPromise;
    }
    this.state.actions = [];
    await this.persistToStorage();
    this.notifyListeners();
    logger.log("[OfflineQueue] Queue cleared");
  }

  /**
   * Stop new queue work and wait for all older initialization, enqueue, and
   * processing turns without deleting their durable actions.
   */
  async suspendForAccountBoundary(): Promise<void> {
    this.accountBoundarySuspended = true;
    if (this.initPromise) await this.initPromise;
    if (this.enqueueLock) await this.enqueueLock;
    if (this.processingPromise) await this.processingPromise;

    this.state.isProcessing = false;
    this.notifyListeners();
    logger.log("[OfflineQueue] Suspended for account boundary");
  }

  /** Remove actions only after the destructive remote operation is committed. */
  async discardSuspendedActionsForAccountBoundary(): Promise<void> {
    if (!this.accountBoundarySuspended) {
      throw new Error("Offline queue must be suspended before boundary discard");
    }

    this.state.actions = [];
    this.state.isProcessing = false;
    this.processingActionIds.clear();
    this.requeuedDuringProcessing.clear();
    await this.persistToStorage();
    storageRemove(SK.OFFLINE_QUEUE);
    this.notifyListeners();
    logger.log("[OfflineQueue] Suspended and cleared for account boundary");
  }

  /**
   * Stop queue work and remove both in-memory and durable rows before an
   * account/device boundary. The queue remains suspended until the caller has
   * either bound the next account or recovered the current session safely.
   */
  async suspendAndClearForAccountBoundary(): Promise<void> {
    await this.suspendForAccountBoundary();
    await this.discardSuspendedActionsForAccountBoundary();
  }

  resumeAfterAccountBoundary(): void {
    this.accountBoundarySuspended = false;
    this.notifyListeners();
    if (navigator.onLine && this.state.actions.length > 0) {
      void this.processQueue();
    }
  }

  private async retryBlockedCriticalAction(actionId: string): Promise<void> {
    if (this.initPromise) await this.initPromise;
    if (this.accountBoundarySuspended) {
      throw new OfflineQueueOwnerBoundaryError(
        "Offline queue is suspended for an account boundary",
      );
    }

    const action = this.state.actions.find((candidate) => candidate.id === actionId);
    if (!action || !isBlockedCriticalAction(action) || !action.ownerUserId) return;
    await this.assertActiveOwner(action.ownerUserId);
    action.retries = 0;
    action.lastError = undefined;
    await this.persistToStorage();
    this.notifyListeners();
    if (navigator.onLine) void this.processQueue();
  }

  private dispatchBlockedCriticalAction(action: OfflineAction): void {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("zenflow:offline-queue-critical-blocked", {
        detail: {
          actionType: action.type,
          entityId: action.entityId,
          retry: () => {
            void this.retryBlockedCriticalAction(action.id).catch((retryError) =>
              logger.error("[OfflineQueue] Critical sync event retry failed:", retryError)
            );
          },
        },
      })
    );
  }

  async replayBlockedCriticalActionsForActiveOwner(): Promise<number> {
    if (this.initPromise) await this.initPromise;
    const activeOwnerUserId = await getCurrentSessionUserId();
    this.observeAuthStateOwner(activeOwnerUserId);
    if (!activeOwnerUserId || this.accountBoundarySuspended) return 0;

    let replayed = 0;
    for (const action of this.state.actions) {
      if (
        action.ownerUserId === activeOwnerUserId &&
        isBlockedCriticalAction(action)
      ) {
        this.dispatchBlockedCriticalAction(action);
        replayed += 1;
      }
    }
    return replayed;
  }

  // Private methods

  private async assertActiveOwner(
    ownerUserId: string,
    expectedGeneration?: number,
  ): Promise<number> {
    const activeOwnerUserId = await getCurrentSessionUserId();
    const activeGeneration = this.observeAuthStateOwner(activeOwnerUserId);
    if (
      activeOwnerUserId !== ownerUserId ||
      (expectedGeneration !== undefined && activeGeneration !== expectedGeneration)
    ) {
      throw new OfflineQueueOwnerBoundaryError(
        "Offline queue owner mismatch: the active account changed during processing"
      );
    }
    return activeGeneration;
  }

  private createHandlerContext(
    ownerUserId: string,
    ownerGeneration: number,
  ): OfflineQueueHandlerContext {
    return Object.freeze({
      ownerUserId,
      runIfOwnerCurrent: async <T>(operation: () => Promise<T> | T): Promise<T> => {
        await this.assertActiveOwner(ownerUserId, ownerGeneration);
        const result = await operation();
        await this.assertActiveOwner(ownerUserId, ownerGeneration);
        return result;
      },
    });
  }

  private handleOnline(): void {
    logger.log("[OfflineQueue] Device came online");
    void this.processQueue();
  }

  private handleOffline(): void {
    logger.log("[OfflineQueue] Device went offline");
  }

  /**
   * Load queue from IndexedDB, with localStorage fallback
   * Primary storage is now IndexedDB for better quota handling
   */
  private async loadFromStorageAsync(): Promise<void> {
    try {
      // Try IndexedDB first
      const items = await db.offlineQueue.toArray();
      if (items.length > 0) {
        this.state.actions = items.map((item) => ({
          id: item.id,
          type: item.type as OfflineActionType,
          entityId: item.entityId,
          ownerUserId: item.ownerUserId,
          payload: item.payload,
          timestamp: item.timestamp,
          retries: item.retries,
          maxRetries: item.maxRetries,
          lastError: item.lastError,
          priority: item.priority as OfflineActionPriority | undefined,
        }));
        logger.log("[OfflineQueue] Loaded from IndexedDB:", this.state.actions.length, "actions");

        // Migrate localStorage data if any (one-time migration)
        await this.migrateFromLocalStorage();
        return;
      }
    } catch (idbError) {
      logger.warn("[OfflineQueue] IndexedDB load failed, trying localStorage:", idbError);
    }

    // Fallback to localStorage
    this.loadFromLocalStorage();
  }

  private loadFromLocalStorage(): void {
    const data = safeLocalStorageGet<{ actions: OfflineAction[] }>(SK.OFFLINE_QUEUE, {
      actions: [],
    });
    if (data.actions && data.actions.length > 0) {
      this.state.actions = data.actions;
      logger.log("[OfflineQueue] Loaded from localStorage:", this.state.actions.length, "actions");
    }
  }

  /**
   * Initialize storage with proper async/await
   * Loads from localStorage first (sync), then IndexedDB (async)
   * Operations that modify the queue must await initPromise
   *
   * Do NOT set initPromise = null after completion.
   * Keeping the resolved promise ensures future awaits immediately resolve,
   * preventing race conditions where one enqueue() is still modifying state
   * while another skips the await entirely.
   */
  private async initializeStorage(): Promise<void> {
    // Synchronous load from localStorage for immediate fallback
    this.loadFromLocalStorage();
    // Then async load from IndexedDB (will override if has data)
    await this.loadFromStorageAsync();
    // Keep initPromise as resolved promise instead of nulling it
    // This ensures all callers properly await, even if it resolves immediately
    logger.log("[OfflineQueue] Initialization complete");
  }

  /**
   * Wait for initialization to complete (for external callers)
   */
  async waitForInit(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * Migrate data from localStorage to IndexedDB (one-time)
   */
  private async migrateFromLocalStorage(): Promise<void> {
    try {
      const data = safeLocalStorageGet<{ actions: OfflineAction[] }>(SK.OFFLINE_QUEUE, {
        actions: [],
      });
      if (data.actions && data.actions.length > 0) {
        // Data already in IndexedDB, remove from localStorage
        storageRemove(SK.OFFLINE_QUEUE);
        logger.log("[OfflineQueue] Cleared localStorage after IndexedDB migration");
      }
    } catch (_error) {
      // Ignore migration errors
    }
  }

  /**
   * Persist queue to IndexedDB with localStorage fallback
   * Uses IndexedDB for better quota handling
   */
  private async persistToStorage(): Promise<void> {
    await this.persistToIndexedDB();
  }

  private async persistToIndexedDB(): Promise<void> {
    try {
      // Clear and repopulate for simplicity
      await db.transaction("rw", db.offlineQueue, async () => {
        await db.offlineQueue.clear();
        if (this.state.actions.length > 0) {
          const items: OfflineQueueItem[] = this.state.actions.map((action) => ({
            id: action.id,
            type: action.type,
            entityId: action.entityId,
            ownerUserId: action.ownerUserId,
            payload: action.payload,
            timestamp: action.timestamp,
            retries: action.retries,
            maxRetries: action.maxRetries,
            lastError: action.lastError,
            priority: action.priority,
          }));
          await db.offlineQueue.bulkAdd(items);
        }
      });
    } catch (idbError) {
      logger.warn(
        "[OfflineQueue] IndexedDB persist failed, using localStorage fallback:",
        idbError
      );
      // Fallback to localStorage
      if (!this.persistToLocalStorage()) {
        throw new Error("[OfflineQueue] Failed to persist queue to IndexedDB and localStorage");
      }
    }
  }

  private persistToLocalStorage(): boolean {
    const success = safeLocalStorageSet(SK.OFFLINE_QUEUE, {
      actions: this.state.actions,
      lastProcessedAt: this.state.lastProcessedAt,
    });

    if (!success) {
      logger.error("[OfflineQueue] Failed to persist to localStorage");

      // CRITICAL - Both IndexedDB AND localStorage failed!
      // Emit storage error event so UI can warn user about potential data loss
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("zenflow:storage-error", {
            detail: {
              type: "persist_failed",
              queueSize: this.state.actions.length,
              message: "Unable to save your changes. Data may be lost if you close the app.",
              recoverable: false,
            },
          })
        );
      }
    }

    return success;
  }

  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const offlineQueue = new OfflineQueue();

// Note: React hook for offline queue is in src/hooks/useOfflineQueue.ts
// to avoid circular dependencies and keep this file framework-agnostic

export default offlineQueue;
