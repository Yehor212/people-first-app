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
 * - Conflict resolution (last-write-wins)
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
import { db, OfflineQueueItem } from "@/storage/db";

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
  | "SYNC_JOURNAL_ENTRY"
  | "DELETE_JOURNAL_ENTRY"
  | "WRITE_SYNC_EVENT";

export type OfflineActionPriority = "critical" | "high" | "normal" | "low";

export interface OfflineAction {
  id: string;
  type: OfflineActionType;
  entityId: string; // ID of the entity being modified
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
    const key = `${action.entityId}`;
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

class OfflineQueue {
  private state: QueueState = {
    actions: [],
    lastProcessedAt: null,
    isProcessing: false,
  };
  private listeners: Set<(state: QueueState) => void> = new Set();
  private syncHandlers: Map<OfflineActionType, (action: OfflineAction) => Promise<void>> =
    new Map();
  private processingPromise: Promise<void> | null = null;

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
    handler: (action: OfflineAction) => Promise<void>
  ): void {
    this.syncHandlers.set(type, handler);
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
    options: { maxRetries?: number; deduplicate?: boolean; priority?: OfflineActionPriority } = {}
  ): Promise<void> {
    // Wait for initialization to complete before modifying queue
    if (this.initPromise) {
      await this.initPromise;
    }

    // P0-2 Fix: Acquire mutex lock to serialize state modifications
    // This prevents race conditions where two concurrent enqueue() calls
    // both read the same state, both decide the action doesn't exist,
    // and both create duplicates (bypassing deduplication logic)
    if (this.enqueueLock) {
      await this.enqueueLock;
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
    options: { maxRetries?: number; deduplicate?: boolean; priority?: OfflineActionPriority } = {}
  ): Promise<void> {
    const { maxRetries = DEFAULT_MAX_RETRIES, deduplicate = true, priority = "normal" } = options;

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
        (a) => a.entityId === entityId && a.type === type
      );

      if (existingIndex !== -1) {
        // Update existing action in-place (preserve position in queue)
        const existing = this.state.actions[existingIndex];
        existing.payload = payload;
        existing.timestamp = Date.now();
        existing.retries = 0; // Reset retries for updated action
        existing.lastError = undefined;
        logger.log("[OfflineQueue] Action deduplicated in-place:", type, entityId);
        this.persistToStorage();
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
      payload,
      timestamp: Date.now(),
      retries: 0,
      maxRetries,
      priority,
    };

    this.state.actions.push(action);
    this.persistToStorage();
    this.notifyListeners();

    logger.log("[OfflineQueue] Action queued:", type, entityId);

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
  private removeAction(actionId: string): void {
    this.state.actions = this.state.actions.filter((a) => a.id !== actionId);
    this.persistToStorage();
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

    // Mutex: prevent concurrent processing
    if (this.processingPromise) {
      await this.processingPromise;
      // After waiting, check if there are still items to process (may have been added during wait)
      if (navigator.onLine && this.state.actions.length > 0 && this.processingPromise === null) {
        // Recursively process new items
        return this.processQueue();
      }
      return;
    }

    if (!navigator.onLine || this.state.actions.length === 0) {
      return;
    }

    // Compact before processing: collapse redundant operations (CREATE+DELETE=noop, UPDATE+UPDATE=latest)
    if (this.state.actions.length > 1) {
      const before = this.state.actions.length;
      this.state.actions = compactQueue(this.state.actions);
      if (this.state.actions.length < before) {
        logger.log(`[OfflineQueue] Compacted: ${before} → ${this.state.actions.length}`);
        void this.persistToStorage();
      }
    }

    this.processingPromise = this.doProcessQueue();
    try {
      await this.processingPromise;
    } finally {
      this.processingPromise = null;
    }

    // After processing, check if new items were added during processing
    if (navigator.onLine && this.state.actions.length > 0) {
      return this.processQueue();
    }
  }

  private async doProcessQueue(): Promise<void> {
    if (this.state.isProcessing) return;

    this.state.isProcessing = true;
    this.notifyListeners();

    logger.log("[OfflineQueue] Processing queue, actions:", this.state.actions.length);

    // Process actions in order (FIFO)
    const actionsToProcess = [...this.state.actions];

    for (const action of actionsToProcess) {
      if (!navigator.onLine) {
        logger.log("[OfflineQueue] Went offline during processing, pausing");
        break;
      }

      const handler = this.syncHandlers.get(action.type);
      if (!handler) {
        logger.warn("[OfflineQueue] No handler for action type:", action.type);
        this.removeAction(action.id);
        continue;
      }

      try {
        await handler(action);
        this.removeAction(action.id);
        logger.log("[OfflineQueue] Action processed:", action.type, action.entityId);
      } catch (error) {
        logger.error("[OfflineQueue] Action failed:", action.type, error);

        action.retries++;
        action.lastError = error instanceof Error ? error.message : String(error);

        if (action.retries >= action.maxRetries) {
          logger.error("[OfflineQueue] Max retries reached, discarding action:", action.id);
          this.removeAction(action.id);
        } else {
          // Exponential backoff before retry
          const delay = Math.min(RETRY_BASE_DELAY * Math.pow(2, action.retries), RETRY_MAX_DELAY);
          logger.log(`[OfflineQueue] Will retry in ${delay}ms`);
          await this.sleep(delay);
        }

        this.persistToStorage();
      }
    }

    this.state.isProcessing = false;
    this.state.lastProcessedAt = Date.now();
    this.persistToStorage();
    this.notifyListeners();

    logger.log("[OfflineQueue] Queue processing complete, remaining:", this.state.actions.length);
  }

  /**
   * Get current queue state
   */
  getState(): QueueState {
    return { ...this.state, actions: [...this.state.actions] };
  }

  /**
   * Get pending actions count
   */
  getPendingCount(): number {
    return this.state.actions.length;
  }

  /**
   * Check if there are pending actions
   */
  hasPendingActions(): boolean {
    return this.state.actions.length > 0;
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
    this.persistToStorage();
    this.notifyListeners();
    logger.log("[OfflineQueue] Queue cleared");
  }

  // Private methods

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
          payload: item.payload,
          timestamp: item.timestamp,
          retries: item.retries,
          maxRetries: item.maxRetries,
          lastError: item.lastError,
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
  private persistToStorage(): void {
    // Persist asynchronously to IndexedDB
    void this.persistToIndexedDB();
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
            payload: action.payload,
            timestamp: action.timestamp,
            retries: action.retries,
            maxRetries: action.maxRetries,
            lastError: action.lastError,
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
      this.persistToLocalStorage();
    }
  }

  private persistToLocalStorage(): void {
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
