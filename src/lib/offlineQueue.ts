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
import {
  safeLocalStorageSet,
  storageReadRaw,
  storageRemove,
} from "./safeJson";
import { SK } from "./storageKeys";
import { db, getLocalDataOwnerId, OfflineQueueItem } from "@/storage/db";
import {
  captureOriginAccountBoundaryGeneration,
  isOriginAccountBoundaryGenerationCurrent,
  readPendingLocalBackupAccountClaim,
  type OriginAccountBoundaryGeneration,
} from "@/storage/accountBoundaryRuntime";
import { recordSyncHealthReceipt } from "@/observability/syncHealthRecorder";
import { getCurrentSessionUserId } from "./supabaseClient";
import { runWithOriginExclusiveLock } from "./originExclusiveLock";
import Dexie from "dexie";

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

export interface OfflineQueueBoundaryDiscardOptions {
  /** Preserve every durable row and report BLOCKED unless the queue is empty. */
  onlyIfEmpty?: boolean;
}

export type OfflineQueueBoundaryDiscardResult =
  | { status: "discarded" }
  | { status: "blocked"; pendingOwnerUserIds: string[] };

export interface OfflineQueueProcessOptions {
  /**
   * A successful same-origin app-asset probe can be newer than
   * navigator.onLine in installed shells. Its AbortSignal is the ownership
   * boundary: a newer retry or a real offline event revokes this evidence.
   */
  verifiedConnectivity?: {
    source: "same-origin-app-asset";
    signal: AbortSignal;
  };
}

function isCriticalAction(action: OfflineAction): boolean {
  // WRITE_SYNC_EVENT predates queue priorities and remains critical for
  // backwards-compatible persisted rows. New privacy/security migrations opt
  // in explicitly with priority=critical and must never be silently discarded.
  return action.type === "WRITE_SYNC_EVENT" || action.priority === "critical";
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

function normalizeHandlerRejection(error: unknown): Error {
  if (error instanceof Error) return error;

  const message =
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : String(error);
  const normalized = new Error(message);
  if (isAbortError(error)) normalized.name = "AbortError";
  return normalized;
}

function isBlockedAction(action: OfflineAction): boolean {
  return action.retries >= action.maxRetries;
}

function generateOperationId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  if (typeof globalThis.crypto?.getRandomValues !== "function") {
    throw new Error("Secure operation identity generation is unavailable");
  }
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
    .slice(6, 8)
    .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

type OfflineQueueDeferredReason =
  | "password-removal-paused"
  | "connectivity"
  | "bounded-work";

export type OfflineQueueHandlerResult =
  | { status: "committed" }
  | { status: "obsolete"; reason: string }
  | {
      status: "deferred";
      reason: OfflineQueueDeferredReason;
    };

export interface OfflineQueueHandlerContext {
  /** Owner persisted on the queue row and re-verified by the queue. */
  readonly ownerUserId: string;
  readonly operationId: string;
  /** Aborted when the queue is suspended, destroyed, or crosses an account boundary. */
  readonly signal: AbortSignal;
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

class OfflineQueueAttemptTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Offline queue handler timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
  }
}

class OfflineQueueAttemptUnsettledError extends Error {
  constructor() {
    super(
      "Offline queue account boundary is blocked until an aborted network attempt settles"
    );
    this.name = "OfflineQueueAttemptUnsettledError";
  }
}

class OfflineQueueStorageAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfflineQueueStorageAccessError";
  }
}

export interface OfflineAction {
  id: string;
  operationId?: string;
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

interface OfflineQueueRemovalTombstone {
  id: string;
  operationId: string;
  ownerUserId: string;
}

interface LocalOfflineQueueSnapshot {
  actions: OfflineAction[];
  lastProcessedAt?: number;
  storageVersion?: 2 | 3;
  mode?: "authoritative-snapshot" | "merge-with-tombstones";
  removedOperations?: OfflineQueueRemovalTombstone[];
}

function isCompleteRemovalTombstone(
  value: unknown
): value is OfflineQueueRemovalTombstone {
  if (!value || typeof value !== "object") return false;
  const tombstone = value as Partial<OfflineQueueRemovalTombstone>;
  return (
    typeof tombstone.id === "string" &&
    tombstone.id.length > 0 &&
    typeof tombstone.operationId === "string" &&
    tombstone.operationId.length > 0 &&
    typeof tombstone.ownerUserId === "string" &&
    tombstone.ownerUserId.length > 0
  );
}

/**
 * Persists a critical user action in the caller's Dexie transaction.
 * The surrounding domain mutation and its outbox row therefore commit or roll
 * back together. A unique row is intentional: an older action may already be
 * in flight, and replacing it could let that processor erase a newer payload.
 */
export async function persistCriticalOfflineActionInCurrentTransaction(
  type: OfflineActionType,
  entityId: string,
  payload: unknown,
  expectedOwnerUserId: string
): Promise<OfflineQueueItem> {
  const transaction = Dexie.currentTransaction;
  if (!transaction || transaction.mode !== "readwrite") {
    throw new Error("Critical offline action requires an active transaction with the outbox");
  }
  if (!expectedOwnerUserId) {
    throw new OfflineQueueOwnerBoundaryError(
      "Offline queue owner mismatch: an originating account is required"
    );
  }

  const timestamp = Date.now();
  const item: OfflineQueueItem = {
    id: `${type}_${entityId}_${timestamp}_${generateSecureRandom()}`,
    operationId: generateOperationId(),
    type,
    entityId,
    ownerUserId: expectedOwnerUserId,
    payload,
    timestamp,
    retries: 0,
    maxRetries: DEFAULT_MAX_RETRIES,
    priority: "critical",
  };
  await db.offlineQueue.add(item);
  return item;
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
    const hasCreate = types.some((t) => t.startsWith("CREATE"));
    const hasDelete = types.some((t) => t.startsWith("DELETE"));

    if (hasCreate && hasDelete) {
      // CREATE + DELETE = net zero, skip all
      continue;
    }

    if (hasDelete) {
      const deleteAction = [...entityActions]
        .reverse()
        .find((action) => action.type.startsWith("DELETE"));
      if (deleteAction) compacted.push(deleteAction);
      continue;
    }

    // Keep only the latest action for this entity
    const latest = entityActions[entityActions.length - 1];
    if (hasCreate) {
      // CREATE + UPDATE = keep CREATE with latest payload
      const createAction = entityActions.find((a) => a.type.startsWith("CREATE"))!;
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

type QueueProcessingOutcome =
  | "completed"
  | { status: "paused"; reason: OfflineQueueDeferredReason };
type OfflineQueueLifecycleTrigger =
  | "visibility"
  | "service-worker"
  | "handler-registration"
  | "enqueue"
  | "non-failure-retry"
  | "account-boundary-resume"
  | "manual-retry"
  | "online"
  | "durable-wake"
  | "bounded-retry";

const MAX_QUEUE_SIZE = 1000; // Prevent unbounded growth
const DEFAULT_MAX_RETRIES = 5;
const RETRY_BASE_DELAY = 1000; // 1 second
const RETRY_MAX_DELAY = 60000; // 1 minute
const CONNECTIVITY_NON_FAILURE_RETRY_DELAY = 1_000;
const PASSWORD_REMOVAL_RETRY_DELAYS_MS = [15_000, 60_000, 300_000, 900_000] as const;
const LIFECYCLE_PROCESS_RETRY_DELAYS_MS = [1_000, 5_000, 15_000] as const;
const HANDLER_ATTEMPT_TIMEOUT_MS = 30_000;
const DATA_WRITE_BARRIER_LOCK = "zenflow:data-write-barrier";
const OFFLINE_QUEUE_STORAGE_LOCK = "zenflow:offline-queue-storage";
const OFFLINE_QUEUE_PROCESSING_LOCK = "zenflow:offline-queue-processing";

class OfflineQueue {
  private state: QueueState = {
    actions: [],
    lastProcessedAt: null,
    isProcessing: false,
  };
  private listeners: Set<(state: QueueState) => void> = new Set();
  private syncHandlers: Map<
    OfflineActionType,
    (
      action: OfflineAction,
      context: OfflineQueueHandlerContext
    ) => Promise<OfflineQueueHandlerResult | void>
  > = new Map();
  private processingPromise: Promise<QueueProcessingOutcome> | null = null;
  private pendingProcessRequest: { options?: OfflineQueueProcessOptions } | null = null;
  private accountBoundarySuspended = false;
  private accountBoundaryEpoch = 0;
  private processingActionIds = new Set<string>();
  private requeuedDuringProcessing = new Set<string>();
  private observedAuthOwnerUserId: string | null | undefined;
  private authOwnerGeneration = 0;
  private nonFailureRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private nonFailureRetryReason: OfflineQueueDeferredReason | null = null;
  private passwordRemovalDeferredRetryCount = 0;
  private lifecycleProcessRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private lifecycleProcessFailureCount = 0;
  private destroyed = false;
  private activeAttemptController: AbortController | null = null;
  /**
   * Promises that ignored abort after their queue attempt was released. Their
   * durable rows remain unacknowledged, and account transitions fail closed
   * until the underlying mutation has reached a known terminal state.
   */
  private unsettledAttemptSettlements = new Set<Promise<void>>();

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
  private boundHandleVisibilityChange = () => {
    if (document.visibilityState === "visible" && navigator.onLine) {
      this.launchLifecycleProcessing("visibility");
    }
  };

  constructor() {
    // Load persisted queue on init - now properly awaited via initPromise
    this.initPromise = this.initializeStorage();

    // Listen for online/offline events
    if (typeof window !== "undefined") {
      window.addEventListener("online", this.boundHandleOnline);
      window.addEventListener("offline", this.boundHandleOffline);
      document.addEventListener("visibilitychange", this.boundHandleVisibilityChange);

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
      this.launchLifecycleProcessing("service-worker");
    }
  }

  /**
   * Cleanup event listeners - call when destroying the queue
   * Now properly removes ALL listeners including SW message handler
   */
  destroy(): void {
    this.destroyed = true;
    this.abortActiveAttempt("Offline queue was destroyed");
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.boundHandleOnline);
      window.removeEventListener("offline", this.boundHandleOffline);
      document.removeEventListener("visibilitychange", this.boundHandleVisibilityChange);

      // Remove SW message listener to prevent memory leak
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", this.boundHandleSWMessage);
      }
    }
    if (this.nonFailureRetryTimer !== null) {
      clearTimeout(this.nonFailureRetryTimer);
      this.nonFailureRetryTimer = null;
    }
    this.nonFailureRetryReason = null;
    this.passwordRemovalDeferredRetryCount = 0;
    if (this.lifecycleProcessRetryTimer !== null) {
      clearTimeout(this.lifecycleProcessRetryTimer);
      this.lifecycleProcessRetryTimer = null;
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
    handler: (
      action: OfflineAction,
      context: OfflineQueueHandlerContext
    ) => Promise<OfflineQueueHandlerResult | void>
  ): void {
    this.syncHandlers.set(type, handler);
    if (
      !this.accountBoundarySuspended &&
      navigator.onLine &&
      this.state.actions.some((action) => action.type === type && !isBlockedAction(action))
    ) {
      this.launchLifecycleProcessing("handler-registration");
    }
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
      if (this.observedAuthOwnerUserId !== undefined) {
        this.abortActiveAttempt("Offline queue account changed");
      }
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

    if (
      this.accountBoundarySuspended ||
      readPendingLocalBackupAccountClaim().status !== "none"
    ) {
      throw new OfflineQueueOwnerBoundaryError(
        "Offline queue is suspended for an account boundary"
      );
    }

    // P0-2 Fix: Acquire mutex lock to serialize state modifications
    // This prevents race conditions where two concurrent enqueue() calls
    // both read the same state, both decide the action doesn't exist,
    // and both create duplicates (bypassing deduplication logic)
    if (this.enqueueLock) {
      await this.enqueueLock;
    }

    if (
      this.accountBoundarySuspended ||
      readPendingLocalBackupAccountClaim().status !== "none"
    ) {
      throw new OfflineQueueOwnerBoundaryError(
        "Offline queue is suspended for an account boundary"
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
      // DATA is always outermost. An account switch holds the same origin-wide
      // barrier while it performs its final queue check and owner rebind, so an
      // enqueue either commits before that check or observes the new owner after
      // the switch. QUEUE remains the inner storage serialization boundary.
      await runWithOriginExclusiveLock(DATA_WRITE_BARRIER_LOCK, async () => {
        if (
          this.accountBoundarySuspended ||
          readPendingLocalBackupAccountClaim().status !== "none"
        ) {
          throw new OfflineQueueOwnerBoundaryError(
            "Offline queue is suspended for an account boundary"
          );
        }
        await runWithOriginExclusiveLock(OFFLINE_QUEUE_STORAGE_LOCK, async () => {
          await this.refreshActionsFromIndexedDB();
          await this.doEnqueue(type, entityId, payload, options);
        });
      });
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
    const localOwnerUserId = await getLocalDataOwnerId();
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

    if (localOwnerUserId !== expectedOwnerUserId) {
      logger.warn("[OfflineQueue] Refusing to queue an action after local ownership changed");
      throw new OfflineQueueOwnerBoundaryError(
        "Offline queue owner mismatch: the local data owner changed before enqueue"
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
        existing.timestamp = Math.max(Date.now(), existing.timestamp + 1);
        existing.operationId = generateOperationId();
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
          this.launchLifecycleProcessing("enqueue");
        } else {
          this.requestBackgroundSync();
        }
        return; // Don't add new action, we updated existing
      }
    }

    const action: OfflineAction = {
      id: `${type}_${entityId}_${Date.now()}_${generateSecureRandom()}`,
      operationId: generateOperationId(),
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
      this.launchLifecycleProcessing("enqueue");
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
  private async removeAction(actionId: string, operationId: string): Promise<boolean> {
    let removed = false;
    await runWithOriginExclusiveLock(OFFLINE_QUEUE_STORAGE_LOCK, async () => {
      try {
        const persisted = await db.offlineQueue.get(actionId);
        if (!persisted || persisted.operationId !== operationId) {
          await this.refreshActionsFromIndexedDB();
          return;
        }
        await db.offlineQueue.delete(actionId);
        await this.refreshActionsFromIndexedDB();
        removed = true;
      } catch (idbError) {
        logger.warn(
          "[OfflineQueue] IndexedDB delete failed, using localStorage fallback:",
          idbError
        );
        const current = this.state.actions.find((action) => action.id === actionId);
        if (!current || current.operationId !== operationId) return;
        if (!current.ownerUserId) {
          throw new OfflineQueueOwnerBoundaryError(
            "Offline queue removal requires an owner-bound operation"
          );
        }
        this.state.actions = this.state.actions.filter(
          (action) => action.id !== actionId || action.operationId !== operationId
        );
        if (
          !this.persistToLocalStorage([
            {
              id: current.id,
              operationId,
              ownerUserId: current.ownerUserId,
            },
          ])
        ) {
          throw new Error("[OfflineQueue] Failed to remove a processed queue action");
        }
        removed = true;
      }
    });
    this.notifyListeners();
    return removed;
  }

  private async ensureAttemptOperationId(action: OfflineAction): Promise<string> {
    let operationId = action.operationId;
    await runWithOriginExclusiveLock(OFFLINE_QUEUE_STORAGE_LOCK, async () => {
      const persisted = await db.offlineQueue.get(action.id);
      if (!persisted) {
        await this.refreshActionsFromIndexedDB();
        throw new OfflineQueueActionRequeuedError();
      }
      if (operationId && persisted.operationId && persisted.operationId !== operationId) {
        await this.refreshActionsFromIndexedDB();
        throw new OfflineQueueActionRequeuedError();
      }
      operationId = persisted.operationId || operationId || generateOperationId();
      if (persisted.operationId !== operationId) {
        await db.offlineQueue.update(action.id, { operationId });
      }
      await this.refreshActionsFromIndexedDB();
    });
    if (!operationId) throw new Error("Offline queue operation identity is unavailable");
    return operationId;
  }

  private async persistAttemptFailure(
    actionId: string,
    operationId: string,
    retries: number,
    lastError: string
  ): Promise<OfflineAction | null> {
    let updatedAction: OfflineAction | null = null;
    await runWithOriginExclusiveLock(OFFLINE_QUEUE_STORAGE_LOCK, async () => {
      const persisted = await db.offlineQueue.get(actionId);
      if (!persisted || persisted.operationId !== operationId) {
        await this.refreshActionsFromIndexedDB();
        return;
      }
      await db.offlineQueue.update(actionId, { retries, lastError });
      await this.refreshActionsFromIndexedDB();
      updatedAction = this.state.actions.find((candidate) => candidate.id === actionId) ?? null;
    });
    this.notifyListeners();
    return updatedAction;
  }

  /**
   * Process all queued actions
   * Now awaits initialization before processing
   */
  private canAttemptNetwork(options?: OfflineQueueProcessOptions): boolean {
    const evidence = options?.verifiedConnectivity;
    if (evidence?.source === "same-origin-app-asset") {
      return !evidence.signal.aborted;
    }
    return navigator.onLine;
  }

  async processQueue(options?: OfflineQueueProcessOptions): Promise<void> {
    if (this.initPromise) await this.initPromise;
    if (
      this.accountBoundarySuspended ||
      readPendingLocalBackupAccountClaim().status !== "none" ||
      !this.canAttemptNetwork(options)
    )
      return;
    if (this.unsettledAttemptSettlements.size > 0) {
      // Lifecycle wakes remain non-blocking, but a newer caller with fresh,
      // abortable same-origin connectivity evidence may wait for the released
      // handler to settle and then retry the still-durable row. It cannot run
      // concurrently with the ambiguous older mutation.
      if (!options?.verifiedConnectivity) return;
      await Promise.all([...this.unsettledAttemptSettlements]);
      if (
        this.accountBoundarySuspended ||
        readPendingLocalBackupAccountClaim().status !== "none" ||
        !this.canAttemptNetwork(options)
      ) {
        return;
      }
      return this.processQueue(options);
    }

    // A promise guards this realm; the named origin lock guards every tab and
    // worker. The winning realm refreshes from IndexedDB before choosing work,
    // so a stale in-memory copy can never deliver an already-committed row.
    if (this.processingPromise) {
      const request = { options };
      this.pendingProcessRequest = request;
      await this.processingPromise;
      if (this.pendingProcessRequest !== request) return;
      this.pendingProcessRequest = null;
      return this.processQueue(options);
    }

    this.processingPromise = runWithOriginExclusiveLock(
      OFFLINE_QUEUE_PROCESSING_LOCK,
      async (): Promise<QueueProcessingOutcome> => {
        if (
          this.accountBoundarySuspended ||
          readPendingLocalBackupAccountClaim().status !== "none" ||
          !this.canAttemptNetwork(options)
        )
          return "completed";
        await runWithOriginExclusiveLock(OFFLINE_QUEUE_STORAGE_LOCK, async () => {
          await this.refreshActionsFromIndexedDB();
        });
        if (this.state.actions.length === 0) return "completed";

        const ownerUserId = await getCurrentSessionUserId();
        const ownerGeneration = this.observeAuthStateOwner(ownerUserId);
        if (!ownerUserId) {
          logger.warn("[OfflineQueue] Queue paused because no account is active");
          return "completed";
        }
        return this.doProcessQueue(ownerUserId, ownerGeneration, options);
      }
    );

    let outcome: QueueProcessingOutcome = "completed";
    try {
      outcome = await this.processingPromise;
    } finally {
      this.processingPromise = null;
    }

    if (outcome !== "completed") {
      this.scheduleNonFailureRetry(outcome.reason);
      return;
    }

    this.clearNonFailureRetry();
    this.passwordRemovalDeferredRetryCount = 0;

    const currentOwnerUserId = await getCurrentSessionUserId();
    this.observeAuthStateOwner(currentOwnerUserId);
    if (
      !this.pendingProcessRequest &&
      !this.accountBoundarySuspended &&
      readPendingLocalBackupAccountClaim().status === "none" &&
      this.canAttemptNetwork(options) &&
      this.hasProcessableActionsForOwner(currentOwnerUserId)
    ) {
      return this.processQueue(options);
    }
  }

  private clearNonFailureRetry(): void {
    if (this.nonFailureRetryTimer !== null) {
      clearTimeout(this.nonFailureRetryTimer);
      this.nonFailureRetryTimer = null;
    }
    this.nonFailureRetryReason = null;
  }

  private scheduleNonFailureRetry(reason: OfflineQueueDeferredReason): void {
    if (this.accountBoundarySuspended) return;
    if (!navigator.onLine) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;

    if (this.nonFailureRetryTimer !== null) {
      if (this.nonFailureRetryReason === reason) return;
      clearTimeout(this.nonFailureRetryTimer);
      this.nonFailureRetryTimer = null;
    }

    const delay =
      reason === "password-removal-paused"
        ? PASSWORD_REMOVAL_RETRY_DELAYS_MS[
            Math.min(
              this.passwordRemovalDeferredRetryCount,
              PASSWORD_REMOVAL_RETRY_DELAYS_MS.length - 1,
            )
          ]
        : CONNECTIVITY_NON_FAILURE_RETRY_DELAY;
    if (reason === "password-removal-paused") {
      this.passwordRemovalDeferredRetryCount = Math.min(
        this.passwordRemovalDeferredRetryCount + 1,
        PASSWORD_REMOVAL_RETRY_DELAYS_MS.length - 1,
      );
    }
    this.nonFailureRetryReason = reason;
    this.nonFailureRetryTimer = setTimeout(() => {
      this.nonFailureRetryTimer = null;
      this.nonFailureRetryReason = null;
      if (!this.accountBoundarySuspended && navigator.onLine) {
        this.launchLifecycleProcessing("non-failure-retry");
      }
    }, delay);
  }

  private launchLifecycleProcessing(trigger: OfflineQueueLifecycleTrigger): void {
    if (this.destroyed) return;

    void this.processQueue().then(
      () => {
        this.lifecycleProcessFailureCount = 0;
      },
      () => {
        if (this.destroyed) return;

        const failureCount = this.lifecycleProcessFailureCount + 1;
        this.lifecycleProcessFailureCount = failureCount;
        const retryDelay = LIFECYCLE_PROCESS_RETRY_DELAYS_MS[failureCount - 1];
        const canRetry =
          retryDelay !== undefined &&
          !this.accountBoundarySuspended &&
          navigator.onLine &&
          (typeof document === "undefined" || document.visibilityState === "visible");
        const retryScheduled =
          this.lifecycleProcessRetryTimer !== null || canRetry;

        // Do not attach the rejection: storage or handler errors can contain
        // user-entered content. The receipt deliberately records only a stable
        // technical class and the bounded trigger.
        logger.error("[OfflineQueue] Lifecycle processing failed", {
          trigger,
          attempt: failureCount,
          retryScheduled,
        });
        recordSyncHealthReceipt({
          kind: "error",
          source: "queue",
          errorName: "OfflineQueueLifecycleError",
        });

        if (!canRetry || this.lifecycleProcessRetryTimer !== null) return;
        this.lifecycleProcessRetryTimer = setTimeout(() => {
          this.lifecycleProcessRetryTimer = null;
          if (
            this.destroyed ||
            this.accountBoundarySuspended ||
            !navigator.onLine ||
            (typeof document !== "undefined" &&
              document.visibilityState !== "visible")
          ) {
            return;
          }
          this.launchLifecycleProcessing("bounded-retry");
        }, retryDelay);
      },
    );
  }

  private async doProcessQueue(
    ownerUserId: string,
    ownerGeneration: number,
    options?: OfflineQueueProcessOptions
  ): Promise<QueueProcessingOutcome> {
    if (this.state.isProcessing) {
      return { status: "paused", reason: "connectivity" };
    }

    this.state.isProcessing = true;
    this.notifyListeners();

    logger.log("[OfflineQueue] Processing queue, actions:", this.state.actions.length);

    // Process actions in order (FIFO)
    const actionsToProcess = [...this.state.actions];
    let pausedReason: OfflineQueueDeferredReason | null = null;

    for (const action of actionsToProcess) {
      if (this.accountBoundarySuspended) {
        logger.log("[OfflineQueue] Account boundary requested, pausing queue");
        break;
      }
      if (!this.canAttemptNetwork(options)) {
        logger.log("[OfflineQueue] Went offline during processing, pausing");
        pausedReason = "connectivity";
        break;
      }

      // Legacy rows have no trustworthy owner. Rows from a different account
      // stay quarantined until that account is active again.
      if (!action.ownerUserId || action.ownerUserId !== ownerUserId) {
        continue;
      }
      if (isBlockedAction(action)) {
        continue;
      }

      const handler = this.syncHandlers.get(action.type);
      if (!handler) {
        logger.warn("[OfflineQueue] No handler for action type:", action.type);
        // Startup hydration can finish before feature handlers register. Every
        // unacknowledged intent stays durable until its handler is available.
        continue;
      }

      this.processingActionIds.add(action.id);
      let attemptController: AbortController | null = null;
      let removeConnectivityAbortListener: (() => void) | null = null;
      try {
        // Verify again immediately before handing control to the mutation handler.
        const actionOwnerGeneration = await this.assertActiveOwner(
          action.ownerUserId,
          ownerGeneration
        );
        const operationId = await this.ensureAttemptOperationId(action);
        action.operationId = operationId;
        const currentAction = this.state.actions.find(
          (candidate) => candidate.id === action.id && candidate.operationId === operationId
        );
        if (!currentAction) throw new OfflineQueueActionRequeuedError();
        const attemptAction = { ...currentAction, operationId };
        attemptController = new AbortController();
        this.activeAttemptController = attemptController;
        const verifiedSignal = options?.verifiedConnectivity?.signal;
        if (verifiedSignal) {
          const abortForRevokedConnectivity = () => {
            attemptController?.abort(
              new DOMException("Verified connectivity was revoked", "AbortError")
            );
          };
          verifiedSignal.addEventListener("abort", abortForRevokedConnectivity, { once: true });
          removeConnectivityAbortListener = () => {
            verifiedSignal.removeEventListener("abort", abortForRevokedConnectivity);
          };
          if (verifiedSignal.aborted) abortForRevokedConnectivity();
        }
        const handlerContext = this.createHandlerContext(
          action.ownerUserId,
          actionOwnerGeneration,
          operationId,
          attemptController.signal
        );
        const result = await this.runHandlerAttempt(
          Promise.resolve().then(() => handler(attemptAction, handlerContext)),
          attemptController
        );
        if (result?.status === "deferred") {
          // A known server or connectivity fence is neither a successful
          // acknowledgement nor a failed mutation. Keep the durable row and
          // retry it later without spending its finite failure budget.
          logger.log(
            "[OfflineQueue] Action deferred without consuming retry budget:",
            action.type,
            result.reason,
          );
          pausedReason = result.reason;
          break;
        }
        if (result?.status !== "committed" && result?.status !== "obsolete") {
          throw new Error("Offline queue handler returned without an explicit acknowledgement");
        }
        if (this.requeuedDuringProcessing.delete(action.id)) {
          throw new OfflineQueueActionRequeuedError();
        }
        // A handler can finish its domain mutation after auth changes while a
        // secondary ordered-event write refuses the stale owner. Never
        // acknowledge the durable queue intent until the same owner is still
        // active after the complete handler returns.
        await this.assertActiveOwner(action.ownerUserId, actionOwnerGeneration);
        const removed = await this.removeAction(action.id, operationId);
        if (!removed) {
          logger.log(
            "[OfflineQueue] Newer operation retained after an older delivery:",
            action.type,
            action.entityId
          );
          continue;
        }
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
          await runWithOriginExclusiveLock(OFFLINE_QUEUE_STORAGE_LOCK, async () => {
            await this.refreshActionsFromIndexedDB();
          });
          logger.log(
            "[OfflineQueue] Newer payload kept for the next processing pass:",
            action.type,
            action.entityId
          );
          continue;
        }

        if (isAbortError(error)) {
          logger.warn(
            "[OfflineQueue] Processing paused without consuming retry budget:",
            action.type,
            action.entityId
          );
          pausedReason = "connectivity";
          break;
        }

        const isJournalSecurityMigration = action.type === "MIGRATE_JOURNAL_SECURITY";
        if (isJournalSecurityMigration) {
          logger.error("[OfflineQueue] Diary security migration failed", {
            code: "storage-failed",
          });
        } else {
          logger.error("[OfflineQueue] Action failed:", action.type, error);
        }
        recordSyncHealthReceipt({
          kind: "failed",
          source: "queue",
          actionType: action.type,
          priority: action.priority || "normal",
          errorName: isJournalSecurityMigration
            ? "JournalSecurityMigrationError"
            : error instanceof Error
              ? error.name
              : "UnknownError",
        });

        const operationId = action.operationId;
        if (!operationId) {
          logger.warn("[OfflineQueue] Failed legacy attempt retained without mutation");
          continue;
        }
        const retries = action.retries + 1;
        const lastError = isJournalSecurityMigration
          ? "storage-failed"
          : error instanceof Error
            ? error.message
            : String(error);
        const persistedFailure = await this.persistAttemptFailure(
          action.id,
          operationId,
          retries,
          lastError
        );
        if (!persistedFailure) {
          logger.log(
            "[OfflineQueue] Failure belonged to an older operation; newer payload retained:",
            action.type,
            action.entityId
          );
          continue;
        }

        if (persistedFailure.retries >= persistedFailure.maxRetries) {
          if (isCriticalAction(persistedFailure)) {
            if (persistedFailure.type === "MIGRATE_JOURNAL_SECURITY") {
              logger.error("[OfflineQueue] Diary security migration requires retry", {
                code: "storage-failed",
              });
            } else {
              logger.error(
                "[OfflineQueue] Critical action blocked after max retries:",
                persistedFailure.id
              );
            }
            recordSyncHealthReceipt({
              kind: "queue-blocked",
              source: "queue",
              actionType: persistedFailure.type,
              priority: persistedFailure.priority || "normal",
              errorName:
                persistedFailure.type === "MIGRATE_JOURNAL_SECURITY"
                  ? "JournalSecurityMigrationError"
                  : error instanceof Error
                    ? error.name
                    : "UnknownError",
            });
            this.dispatchBlockedAction(persistedFailure);
          } else {
            logger.error("[OfflineQueue] Action blocked after max retries:", persistedFailure.id);
            this.dispatchBlockedAction(persistedFailure);
          }
        } else {
          // Exponential backoff before retry
          const delay = Math.min(
            RETRY_BASE_DELAY * Math.pow(2, persistedFailure.retries),
            RETRY_MAX_DELAY
          );
          logger.log(`[OfflineQueue] Will retry in ${delay}ms`);
          await this.sleep(delay);
        }
      } finally {
        removeConnectivityAbortListener?.();
        if (attemptController && this.activeAttemptController === attemptController) {
          this.activeAttemptController = null;
        }
        this.processingActionIds.delete(action.id);
        this.requeuedDuringProcessing.delete(action.id);
      }
    }

    this.state.isProcessing = false;
    if (pausedReason === null) this.state.lastProcessedAt = Date.now();
    this.notifyListeners();

    logger.log("[OfflineQueue] Queue processing complete, remaining:", this.state.actions.length);
    return pausedReason === null
      ? "completed"
      : { status: "paused", reason: pausedReason };
  }

  private hasProcessableActionsForOwner(ownerUserId: string | null): boolean {
    if (!ownerUserId) return false;
    return this.state.actions.some(
      (action) =>
        action.ownerUserId === ownerUserId &&
        !isBlockedAction(action) &&
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
        "Offline queue owner mismatch: a legacy claim requires an account"
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
        return runWithOriginExclusiveLock(OFFLINE_QUEUE_STORAGE_LOCK, async () => {
          if (this.accountBoundarySuspended) {
            throw new OfflineQueueOwnerBoundaryError(
              "Offline queue is suspended for an account boundary"
            );
          }

          await this.refreshActionsFromIndexedDB();
          const activeOwnerUserId = await getCurrentSessionUserId();
          const localOwnerUserId = await getLocalDataOwnerId();
          const ownerGeneration = this.observeAuthStateOwner(activeOwnerUserId);
          if (activeOwnerUserId !== ownerUserId || localOwnerUserId !== ownerUserId) {
            throw new OfflineQueueOwnerBoundaryError(
              "Offline queue owner mismatch: legacy rows cannot be claimed by this account"
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
                "Offline queue owner mismatch: local data changed during legacy migration"
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
            legacyActions.length
          );
          return legacyActions.length;
        });
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
    await runWithOriginExclusiveLock(OFFLINE_QUEUE_STORAGE_LOCK, async () => {
      await db.offlineQueue.clear();
      if (!storageRemove(SK.OFFLINE_QUEUE)) {
        throw new Error("Offline queue fallback could not be cleared");
      }
      this.state.actions = [];
    });
    this.notifyListeners();
    logger.log("[OfflineQueue] Queue cleared");
  }

  /**
   * Stop new queue work and wait for all older initialization, enqueue, and
   * processing turns without deleting their durable actions.
   */
  async suspendForAccountBoundary(): Promise<void> {
    this.accountBoundaryEpoch += 1;
    this.accountBoundarySuspended = true;
    this.abortActiveAttempt("Offline queue suspended for an account boundary");
    if (this.initPromise) await this.initPromise;
    if (this.enqueueLock) await this.enqueueLock;
    if (this.processingPromise) await this.processingPromise;
    if (this.unsettledAttemptSettlements.size > 0) {
      throw new OfflineQueueAttemptUnsettledError();
    }

    this.state.isProcessing = false;
    this.notifyListeners();
    logger.log("[OfflineQueue] Suspended for account boundary");
  }

  /** Read-only account-boundary state; callers must not infer ownership from it. */
  isSuspendedForAccountBoundary(): boolean {
    return this.accountBoundarySuspended;
  }

  /** Changes on every suspend/resume attempt so a caller can release only its own turn. */
  getAccountBoundaryEpoch(): number {
    return this.accountBoundaryEpoch;
  }

  /** Remove actions only after the destructive remote operation is committed. */
  async discardSuspendedActionsForAccountBoundary(
    options: OfflineQueueBoundaryDiscardOptions = {}
  ): Promise<OfflineQueueBoundaryDiscardResult> {
    if (!this.accountBoundarySuspended) {
      throw new Error("Offline queue must be suspended before boundary discard");
    }

    const result = await runWithOriginExclusiveLock(OFFLINE_QUEUE_STORAGE_LOCK, async () => {
      // Another tab may have enqueued after an earlier in-memory pending check.
      // Refresh while holding QUEUE before deciding whether destructive cleanup
      // is still allowed.
      await this.refreshActionsFromIndexedDB();
      if (options.onlyIfEmpty && this.state.actions.length > 0) {
        return {
          status: "blocked" as const,
          pendingOwnerUserIds: [
            ...new Set(
              this.state.actions.map((action) => action.ownerUserId ?? "__legacy_unowned__")
            ),
          ].sort(),
        };
      }

      await db.offlineQueue.clear();
      // Keep fallback removal inside QUEUE. Otherwise another realm could write
      // a fallback snapshot between the durable clear and this
      // cleanup and have it erased here.
      if (!storageRemove(SK.OFFLINE_QUEUE)) {
        throw new Error("Offline queue fallback could not be cleared at the account boundary");
      }
      this.state.actions = [];
      this.state.isProcessing = false;
      this.processingActionIds.clear();
      this.requeuedDuringProcessing.clear();
      return { status: "discarded" as const };
    });
    if (result.status === "blocked") return result;
    this.notifyListeners();
    logger.log("[OfflineQueue] Suspended and cleared for account boundary");
    return result;
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
    this.accountBoundaryEpoch += 1;
    this.accountBoundarySuspended = false;
    this.notifyListeners();
    if (navigator.onLine && this.state.actions.length > 0) {
      this.launchLifecycleProcessing("account-boundary-resume");
    }
  }

  private async retryBlockedAction(
    actionId: string,
    expectedOperationId: string | undefined,
    expectedBoundaryGeneration: OriginAccountBoundaryGeneration
  ): Promise<void> {
    if (this.initPromise) await this.initPromise;
    await runWithOriginExclusiveLock(DATA_WRITE_BARRIER_LOCK, async () => {
      await runWithOriginExclusiveLock(OFFLINE_QUEUE_STORAGE_LOCK, async () => {
        if (this.accountBoundarySuspended) {
          throw new OfflineQueueOwnerBoundaryError(
            "Offline queue is suspended for an account boundary"
          );
        }

        if (!isOriginAccountBoundaryGenerationCurrent(expectedBoundaryGeneration)) {
          throw new OfflineQueueOwnerBoundaryError(
            "Offline queue retry belongs to an earlier account boundary"
          );
        }
        await this.refreshActionsFromIndexedDB();
        if (!isOriginAccountBoundaryGenerationCurrent(expectedBoundaryGeneration)) {
          throw new OfflineQueueOwnerBoundaryError(
            "Offline queue retry crossed an account boundary"
          );
        }

        const action = this.state.actions.find((candidate) => candidate.id === actionId);
        if (
          !action ||
          action.operationId !== expectedOperationId ||
          !isBlockedAction(action) ||
          !action.ownerUserId
        ) {
          return;
        }
        const ownerGeneration = await this.assertActiveOwner(action.ownerUserId);
        const previousRetries = action.retries;
        const previousLastError = action.lastError;
        action.retries = 0;
        action.lastError = undefined;
        try {
          await this.persistToStorage();
          await this.assertActiveOwner(action.ownerUserId, ownerGeneration);
        } catch (error) {
          action.retries = previousRetries;
          action.lastError = previousLastError;
          await this.persistToStorage();
          throw error;
        }
        this.notifyListeners();
      });
    });
    if (navigator.onLine) this.launchLifecycleProcessing("manual-retry");
  }

  private dispatchBlockedAction(action: OfflineAction): void {
    if (typeof window === "undefined") return;
    const expectedOperationId = action.operationId;
    const expectedBoundaryGeneration = captureOriginAccountBoundaryGeneration();
    window.dispatchEvent(
      new CustomEvent(
        isCriticalAction(action)
          ? "zenflow:offline-queue-critical-blocked"
          : "zenflow:offline-queue-blocked",
        {
          detail: {
            actionType: action.type,
            entityId: action.entityId,
            retry: () =>
              this.retryBlockedAction(
                action.id,
                expectedOperationId,
                expectedBoundaryGeneration
              ).catch((retryError) => {
                logger.error("[OfflineQueue] Blocked sync retry failed:", retryError);
                throw retryError;
              }),
          },
        }
      )
    );
  }

  async replayBlockedCriticalActionsForActiveOwner(
    expectedOwnerUserId?: string
  ): Promise<number> {
    if (this.initPromise) await this.initPromise;
    if (this.accountBoundarySuspended) return 0;

    const ownerUserId = expectedOwnerUserId ?? (await getCurrentSessionUserId());
    if (!ownerUserId) return 0;

    let ownerGeneration: number;
    try {
      ownerGeneration = await this.assertActiveOwner(ownerUserId);
    } catch (error) {
      if (error instanceof OfflineQueueOwnerBoundaryError) return 0;
      throw error;
    }

    let replayed = 0;
    for (const action of this.state.actions) {
      if (action.ownerUserId === ownerUserId && isBlockedAction(action)) {
        try {
          await this.assertActiveOwner(ownerUserId, ownerGeneration);
        } catch (error) {
          if (error instanceof OfflineQueueOwnerBoundaryError) return replayed;
          throw error;
        }
        this.dispatchBlockedAction(action);
        replayed += 1;
      }
    }
    return replayed;
  }

  // Private methods

  private async assertActiveOwner(
    ownerUserId: string,
    expectedGeneration?: number
  ): Promise<number> {
    const activeOwnerBeforeLocalRead = await getCurrentSessionUserId();
    const localOwnerUserId = await getLocalDataOwnerId();
    const activeOwnerUserId = await getCurrentSessionUserId();
    const activeGeneration = this.observeAuthStateOwner(activeOwnerUserId);
    const importedBackupClaim = readPendingLocalBackupAccountClaim();
    if (
      activeOwnerBeforeLocalRead !== ownerUserId ||
      activeOwnerUserId !== ownerUserId ||
      localOwnerUserId !== ownerUserId ||
      importedBackupClaim.status !== "none" ||
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
    operationId: string,
    signal: AbortSignal
  ): OfflineQueueHandlerContext {
    return Object.freeze({
      ownerUserId,
      operationId,
      signal,
      runIfOwnerCurrent: async <T>(operation: () => Promise<T> | T): Promise<T> => {
        this.throwIfAborted(signal);
        await this.assertActiveOwner(ownerUserId, ownerGeneration);
        const result = await operation();
        this.throwIfAborted(signal);
        await this.assertActiveOwner(ownerUserId, ownerGeneration);
        return result;
      },
    });
  }

  private runHandlerAttempt<T>(
    handlerPromise: Promise<T>,
    controller: AbortController
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const { signal } = controller;
      let settled = false;
      let handlerSettled = false;
      let unsettledTracked = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let abortReason: Error | null = null;

      const cleanup = () => {
        if (timeoutId !== null) clearTimeout(timeoutId);
        signal.removeEventListener("abort", handleAbort);
      };
      const settle = (callback: () => void) => {
        if (settled) return;
        settled = true;
        cleanup();
        callback();
      };
      const handleAbort = () => {
        abortReason =
          signal.reason instanceof Error
            ? signal.reason
            : new DOMException("Offline queue attempt was aborted", "AbortError");
        if (!handlerSettled && !unsettledTracked) {
          unsettledTracked = true;
          this.trackUnsettledHandler(handlerPromise);
        }
        // A handler is required to observe the signal, but a third-party or
        // regressed handler may never settle. Release queue processing now;
        // the durable row cannot be acknowledged by this late result and an
        // account boundary remains blocked by trackUnsettledHandler().
        settle(() => reject(abortReason!));
      };

      signal.addEventListener("abort", handleAbort, { once: true });
      timeoutId = setTimeout(() => {
        controller.abort(new OfflineQueueAttemptTimeoutError(HANDLER_ATTEMPT_TIMEOUT_MS));
      }, HANDLER_ATTEMPT_TIMEOUT_MS);
      handlerPromise.then(
        (result) => {
          handlerSettled = true;
          settle(() => {
            if (abortReason) reject(abortReason);
            else resolve(result);
          });
        },
        (error) => {
          handlerSettled = true;
          settle(() => reject(abortReason ?? normalizeHandlerRejection(error)));
        }
      );
      if (signal.aborted) handleAbort();
    });
  }

  private trackUnsettledHandler(handlerPromise: Promise<unknown>): void {
    const settlement = handlerPromise
      .then(
        () => undefined,
        () => undefined
      )
      .finally(() => {
        this.unsettledAttemptSettlements.delete(settlement);
        // Defer one task turn: the released queue pass may still own
        // processingPromise while it handles the abort result. An immediate
        // launch can become a pending request that is discarded by the paused
        // pass, leaving the durable row asleep until another browser event.
        setTimeout(() => {
          if (
            !this.destroyed &&
            !this.accountBoundarySuspended &&
            navigator.onLine &&
            (typeof document === "undefined" || document.visibilityState === "visible")
          ) {
            this.launchLifecycleProcessing("bounded-retry");
          }
        }, 0);
      });
    this.unsettledAttemptSettlements.add(settlement);
  }

  private abortActiveAttempt(message: string): void {
    const controller = this.activeAttemptController;
    if (!controller || controller.signal.aborted) return;
    controller.abort(new DOMException(message, "AbortError"));
  }

  private throwIfAborted(signal: AbortSignal): void {
    if (!signal.aborted) return;
    if (signal.reason instanceof Error) throw signal.reason;
    throw new DOMException("Offline queue attempt was aborted", "AbortError");
  }

  private handleOnline(): void {
    logger.log("[OfflineQueue] Device came online");
    this.launchLifecycleProcessing("online");
  }

  private handleOffline(): void {
    logger.log("[OfflineQueue] Device went offline");
    this.abortActiveAttempt("Offline queue paused because the device went offline");
  }

  /**
   * Load queue from IndexedDB, with localStorage fallback
   * Primary storage is now IndexedDB for better quota handling
   */
  private async loadFromStorageAsync(): Promise<void> {
    try {
      await this.reconcileStoredActions();
    } catch (idbError) {
      if (idbError instanceof OfflineQueueStorageAccessError) throw idbError;
      logger.warn("[OfflineQueue] IndexedDB load failed, trying localStorage:", idbError);
      this.loadFromLocalStorage();
    }
  }

  private loadFromLocalStorage(): void {
    const { snapshot: data } = this.readLocalStorageSnapshot();
    if (data.actions && data.actions.length > 0) {
      this.state.actions = data.actions;
      logger.log("[OfflineQueue] Loaded from localStorage:", this.state.actions.length, "actions");
    }
    if (typeof data.lastProcessedAt === "number") {
      this.state.lastProcessedAt = data.lastProcessedAt;
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
    // Reconciliation is one cross-realm read/modify/cleanup turn. Without the
    // storage lock, another tab can commit a newer outbox row between the read
    // and fallback cleanup.
    await runWithOriginExclusiveLock(OFFLINE_QUEUE_STORAGE_LOCK, async () => {
      await this.loadFromStorageAsync();
    });
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

  /** Refreshes memory from durable storage and starts normal processing. */
  async wakeFromDurableStorage(): Promise<void> {
    await this.waitForInit();
    await runWithOriginExclusiveLock(OFFLINE_QUEUE_STORAGE_LOCK, async () => {
      await this.refreshActionsFromIndexedDB();
    });
    this.notifyListeners();
    if (navigator.onLine) {
      this.launchLifecycleProcessing("durable-wake");
    } else {
      this.requestBackgroundSync();
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
      if (this.state.actions.length > 0) {
        await db.offlineQueue.bulkPut(
          this.state.actions.map((action) => this.toPersistedItem(action))
        );
      }
      if (!storageRemove(SK.OFFLINE_QUEUE)) {
        logger.warn("[OfflineQueue] Durable write completed; fallback cleanup remains pending");
      }
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

  private fromPersistedItem(item: OfflineQueueItem): OfflineAction {
    return {
      id: item.id,
      operationId: item.operationId,
      type: item.type as OfflineActionType,
      entityId: item.entityId,
      ownerUserId: item.ownerUserId,
      payload: item.payload,
      timestamp: item.timestamp,
      retries: item.retries,
      maxRetries: item.maxRetries,
      lastError: item.lastError,
      priority: item.priority as OfflineActionPriority | undefined,
    };
  }

  private toPersistedItem(action: OfflineAction): OfflineQueueItem {
    return {
      id: action.id,
      operationId: action.operationId,
      type: action.type,
      entityId: action.entityId,
      ownerUserId: action.ownerUserId,
      payload: action.payload,
      timestamp: action.timestamp,
      retries: action.retries,
      maxRetries: action.maxRetries,
      lastError: action.lastError,
      priority: action.priority,
    };
  }

  private readLocalStorageSnapshot(): {
    exists: boolean;
    snapshot: LocalOfflineQueueSnapshot;
  } {
    const stored = storageReadRaw(SK.OFFLINE_QUEUE);
    if (!stored.ok) {
      throw new OfflineQueueStorageAccessError("Offline queue fallback is unavailable");
    }
    if (stored.value === null) {
      return { exists: false, snapshot: { actions: [] } };
    }
    try {
      const parsed = JSON.parse(stored.value) as Partial<LocalOfflineQueueSnapshot> | null;
      if (!parsed || !Array.isArray(parsed.actions)) {
        throw new Error("invalid snapshot shape");
      }
      if (
        parsed.storageVersion === 3 ||
        parsed.mode === "merge-with-tombstones"
      ) {
        if (
          parsed.storageVersion !== 3 ||
          parsed.mode !== "merge-with-tombstones" ||
          !Array.isArray(parsed.removedOperations) ||
          !parsed.removedOperations.every(isCompleteRemovalTombstone)
        ) {
          throw new Error("invalid v3 fallback journal");
        }
      }
      return {
        exists: true,
        snapshot: parsed as LocalOfflineQueueSnapshot,
      };
    } catch {
      throw new OfflineQueueStorageAccessError("Offline queue fallback is unreadable");
    }
  }

  private matchesRemovalTombstone(
    action: OfflineAction,
    tombstone: OfflineQueueRemovalTombstone
  ): boolean {
    return (
      action.id === tombstone.id &&
      action.operationId === tombstone.operationId &&
      action.ownerUserId === tombstone.ownerUserId
    );
  }

  private async applyFallbackJournal(
    localActions: OfflineAction[],
    removedOperations: OfflineQueueRemovalTombstone[],
    legacyAuthoritativeSnapshot: boolean
  ): Promise<OfflineAction[]> {
    return db.transaction("rw", db.offlineQueue, async () => {
      const deletes: OfflineQueueRemovalTombstone[] = [];
      const upserts: OfflineAction[] = [];

      for (const tombstone of removedOperations) {
        const persisted = await db.offlineQueue.get(tombstone.id);
        if (
          persisted &&
          this.matchesRemovalTombstone(this.fromPersistedItem(persisted), tombstone)
        ) {
          deletes.push(tombstone);
        }
      }

      for (const localAction of localActions) {
        if (
          removedOperations.some((tombstone) =>
            this.matchesRemovalTombstone(localAction, tombstone)
          )
        ) {
          throw new OfflineQueueStorageAccessError(
            "Offline queue fallback contains a removed operation"
          );
        }
        const persisted = await db.offlineQueue.get(localAction.id);
        if (!persisted) {
          upserts.push(localAction);
          continue;
        }
        const indexedAction = this.fromPersistedItem(persisted);
        if (indexedAction.operationId === localAction.operationId) {
          if (
            localAction.timestamp > indexedAction.timestamp ||
            localAction.retries > indexedAction.retries
          ) {
            upserts.push(localAction);
          }
          continue;
        }
        if (legacyAuthoritativeSnapshot) {
          throw new OfflineQueueStorageAccessError(
            "Offline queue legacy fallback conflicts with durable state"
          );
        }
        if (localAction.timestamp > indexedAction.timestamp) {
          upserts.push(localAction);
        } else if (localAction.timestamp === indexedAction.timestamp) {
          throw new OfflineQueueStorageAccessError(
            "Offline queue fallback operation order is ambiguous"
          );
        }
      }

      for (const tombstone of deletes) {
        await db.offlineQueue.delete(tombstone.id);
      }
      if (upserts.length > 0) {
        await db.offlineQueue.bulkPut(upserts.map((action) => this.toPersistedItem(action)));
      }
      const reconciledItems = await db.offlineQueue.toArray();
      return reconciledItems.map((item) => this.fromPersistedItem(item));
    });
  }

  private async reconcileStoredActions(): Promise<void> {
    const items = await db.offlineQueue.toArray();
    const indexedActions = items.map((item) => this.fromPersistedItem(item));
    const { exists, snapshot } = this.readLocalStorageSnapshot();
    if (!exists) {
      this.state.actions = indexedActions;
      return;
    }

    const localActions = Array.isArray(snapshot.actions) ? snapshot.actions : [];
    const removedOperations =
      snapshot.storageVersion === 3 &&
      snapshot.mode === "merge-with-tombstones" &&
      Array.isArray(snapshot.removedOperations)
        ? snapshot.removedOperations
        : [];
    const legacyAuthoritativeSnapshot =
      snapshot.storageVersion === 2 && snapshot.mode === "authoritative-snapshot";
    this.state.actions = indexedActions;
    if (typeof snapshot.lastProcessedAt === "number") {
      this.state.lastProcessedAt = snapshot.lastProcessedAt;
    }

    try {
      this.state.actions = await this.applyFallbackJournal(
        localActions,
        removedOperations,
        legacyAuthoritativeSnapshot
      );
      if (!storageRemove(SK.OFFLINE_QUEUE)) {
        logger.warn("[OfflineQueue] Fallback reconciliation cleanup remains pending");
        return;
      }
      logger.log("[OfflineQueue] Reconciled localStorage fallback with IndexedDB");
    } catch (error) {
      if (error instanceof OfflineQueueStorageAccessError) throw error;
      logger.warn("[OfflineQueue] Fallback reconciliation remains pending:", error);
      throw error;
    }
  }

  private async refreshActionsFromIndexedDB(): Promise<void> {
    await this.reconcileStoredActions();
  }

  private persistToLocalStorage(
    removedOperations: OfflineQueueRemovalTombstone[] = []
  ): boolean {
    let existingRemovedOperations: OfflineQueueRemovalTombstone[] = [];
    try {
      const { exists, snapshot } = this.readLocalStorageSnapshot();
      if (
        exists &&
        snapshot.storageVersion === 3 &&
        snapshot.mode === "merge-with-tombstones" &&
        Array.isArray(snapshot.removedOperations)
      ) {
        existingRemovedOperations = snapshot.removedOperations;
      }
    } catch {
      logger.error("[OfflineQueue] Failed to read the fallback journal before persistence");
      return false;
    }
    const tombstonesByIdentity = new Map<string, OfflineQueueRemovalTombstone>();
    for (const tombstone of [...existingRemovedOperations, ...removedOperations]) {
      tombstonesByIdentity.set(
        `${tombstone.ownerUserId}:${tombstone.id}:${tombstone.operationId}`,
        tombstone
      );
    }
    const success = safeLocalStorageSet(SK.OFFLINE_QUEUE, {
      actions: this.state.actions,
      lastProcessedAt: this.state.lastProcessedAt,
      storageVersion: 3,
      mode: "merge-with-tombstones",
      removedOperations: [...tombstonesByIdentity.values()],
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
