/**
 * Sync Orchestrator - Centralized synchronization management
 *
 * Solves the problem of multiple parallel sync systems creating race conditions.
 * Provides:
 * - Queue-based sequential sync operations
 * - Conflict detection and resolution
 * - Retry logic with exponential backoff
 * - User-facing sync status
 */

import { useState, useEffect } from "react";
import { logger } from "@/lib/logger";
import type { SeverityLevel } from "@sentry/core";
import type { ErrorCategory } from "@/lib/sentry";

// Lazy-load sentry to keep @sentry/* (~250 KB) off the critical rendering path.
// Breadcrumbs are fire-and-forget telemetry — async import is safe.
const lazyCategorizedBreadcrumb = (
  category: ErrorCategory,
  message: string,
  data?: Record<string, unknown>,
  level?: SeverityLevel
) => {
  import("@/lib/sentry")
    .then((mod) => mod.addCategorizedBreadcrumb(category, message, data, level))
    .catch((e) => logger.warn("[Sentry] lazy load skipped:", e));
};
import { isCloudSyncEnabled } from "@/lib/cloudSyncSettings";
import { generateSecureRandom } from "@/lib/validation";
import { is401Error, AUTH_SESSION_EXPIRED_EVENT } from "@/lib/apiClient";
import { getCurrentSessionUserId, supabase } from "@/lib/supabaseClient";

// Sync operation types
export type SyncOperationType =
  | "backup" // Full backup sync (cloudSync)
  | "delta" // Delta sync via sync_events (Phase 2)
  | "reminders" // Reminder settings sync
  | "challenges" // Challenges sync
  | "tasks" // Tasks sync
  | "quests" // Quests sync
  | "innerWorld" // Inner world sync
  | "badges"; // Badges sync

export type SyncStatus =
  | "idle" // No sync in progress
  | "syncing" // Sync in progress
  | "success" // Last sync succeeded
  | "error" // Last sync failed
  | "conflict"; // Conflict detected

export interface SyncExecutionContext {
  ownerUserId: string;
  generation: number;
  signal: AbortSignal;
}

export interface SyncOptions {
  priority?: number;
  maxRetries?: number;
  expectedOwnerUserId?: string;
}

export class SyncOrchestratorAccountBoundaryError extends Error {
  constructor(message = "Sync operation stopped at an account boundary") {
    super(message);
    this.name = "SyncOrchestratorAccountBoundaryError";
  }
}

export class SyncQueueOverflowError extends Error {
  constructor(maxQueueSize: number) {
    super(`Sync queue is full (maximum ${maxQueueSize} operations)`);
    this.name = "SyncQueueOverflowError";
  }
}

class SyncOperationTimeoutError extends Error {
  constructor(operationType: SyncOperationType, timeoutMs: number) {
    super(`Sync operation '${operationType}' timed out after ${timeoutMs}ms`);
    this.name = "SyncOperationTimeoutError";
  }
}

export interface SyncOperation {
  id: string;
  type: SyncOperationType;
  priority: number; // Higher = higher priority (0-10)
  executor: (context: SyncExecutionContext) => Promise<void>;
  ownerUserId: string;
  generation: number;
  retries: number; // Number of retries attempted
  maxRetries: number; // Maximum retries allowed
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: Error;
  completionSettled: boolean;
  resolveCompletion: () => void;
  rejectCompletion: (error: Error) => void;
}

export interface SyncState {
  status: SyncStatus;
  currentOperation?: SyncOperationType;
  lastSyncTime?: number;
  lastSyncType?: SyncOperationType;
  lastError?: string;
  queueLength: number;
  isOnline: boolean;
}

type SyncStateListener = (state: SyncState) => void;

class SyncOrchestrator {
  private queue: SyncOperation[] = [];
  private isProcessing = false;
  private processingPromise: Promise<void> | null = null; // Mutex lock for process queue
  private activeOperation: SyncOperation | null = null;
  private activeController: AbortController | null = null;
  private accountGeneration = 0;
  private accountBoundarySuspended = false;
  private listeners: Set<SyncStateListener> = new Set();
  private state: SyncState = {
    status: "idle",
    queueLength: 0,
    isOnline: navigator.onLine,
  };

  // Prevent multiple AUTH_SESSION_EXPIRED_EVENT dispatches
  private sessionExpiredEmitted = false;

  // Retry configuration
  private readonly RETRY_DELAY_BASE = 1000; // 1 second
  private readonly RETRY_DELAY_MAX = 30000; // 30 seconds

  // P2-5 Fix: Timeout for individual sync operations (45 seconds)
  // Prevents single operations from blocking the entire queue indefinitely
  private readonly OPERATION_TIMEOUT = 45000;

  // Queue size limit to prevent unbounded memory growth under pathological conditions
  private readonly MAX_QUEUE_SIZE = 50;

  // Event handlers (stored for cleanup)
  private onlineHandler = () => this.handleOnlineStatusChange(true);
  private offlineHandler = () => this.handleOnlineStatusChange(false);

  constructor() {
    // Listen to online/offline events
    window.addEventListener("online", this.onlineHandler);
    window.addEventListener("offline", this.offlineHandler);
  }

  /**
   * Cleanup event listeners (call when destroying the orchestrator)
   */
  destroy(): void {
    window.removeEventListener("online", this.onlineHandler);
    window.removeEventListener("offline", this.offlineHandler);
    this.listeners.clear();
  }

  /**
   * Add a sync operation to the queue
   */
  async sync(
    type: SyncOperationType,
    executor: (context: SyncExecutionContext) => Promise<void>,
    options: SyncOptions = {}
  ): Promise<void> {
    // Check if cloud sync is enabled by user
    if (!isCloudSyncEnabled()) {
      logger.sync(`[${type}] Cloud sync disabled by user - skipping`);
      return; // Skip sync silently
    }

    const enqueueGeneration = this.accountGeneration;
    if (this.accountBoundarySuspended) {
      throw new SyncOrchestratorAccountBoundaryError("Sync is suspended for account cleanup");
    }

    const activeOwnerUserId = await getCurrentSessionUserId();
    const ownerUserId = options.expectedOwnerUserId ?? activeOwnerUserId;
    if (
      this.accountBoundarySuspended ||
      enqueueGeneration !== this.accountGeneration ||
      !ownerUserId ||
      activeOwnerUserId !== ownerUserId
    ) {
      throw new SyncOrchestratorAccountBoundaryError();
    }

    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      const overflowError = new SyncQueueOverflowError(this.MAX_QUEUE_SIZE);
      logger.warn(`[SyncOrchestrator] ${overflowError.message}`);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("zenflow:offline-queue-full", {
            detail: {
              queueSize: this.queue.length,
              maxSize: this.MAX_QUEUE_SIZE,
              message: "Sync queue is full. This sync request was not queued.",
              actionType: type,
            },
          })
        );
      }
      throw overflowError;
    }

    let resolveCompletion!: () => void;
    let rejectCompletion!: (error: Error) => void;
    const completion = new Promise<void>((resolve, reject) => {
      resolveCompletion = resolve;
      rejectCompletion = reject;
    });

    const operation: SyncOperation = {
      id: `${type}-${Date.now()}-${generateSecureRandom()}`,
      type,
      priority: options.priority ?? 5,
      executor,
      ownerUserId,
      generation: enqueueGeneration,
      retries: 0,
      maxRetries: options.maxRetries ?? 3,
      createdAt: Date.now(),
      completionSettled: false,
      resolveCompletion,
      rejectCompletion,
    };

    // Add to queue sorted by priority (higher first)
    this.queue.push(operation);
    this.sortQueueByPriority();

    this.updateState({ queueLength: this.queue.length });

    logger.sync(`Queued ${type} sync (priority: ${operation.priority})`);

    // Start processing using mutex pattern to avoid race conditions
    // If already processing, wait for current batch to complete then check queue again
    void this.startProcessing().catch((error: unknown) => {
      const normalized = this.normalizeError(error);
      logger.error("Failed to start queue processing", normalized);
      if (this.removeOperation(operation)) {
        this.rejectOperation(operation, normalized);
        this.updateState({ queueLength: this.queue.length });
      }
    });

    return completion;
  }

  private sortQueueByPriority(): void {
    if (this.activeOperation && this.queue[0] === this.activeOperation) {
      const [active, ...pending] = this.queue;
      pending.sort((a, b) => b.priority - a.priority);
      this.queue = [active, ...pending];
      return;
    }
    this.queue.sort((a, b) => b.priority - a.priority);
  }

  private removeOperation(operation: SyncOperation): boolean {
    const index = this.queue.findIndex((item) => item.id === operation.id);
    if (index < 0) return false;
    this.queue.splice(index, 1);
    return true;
  }

  private resolveOperation(operation: SyncOperation): void {
    if (operation.completionSettled) return;
    operation.completionSettled = true;
    operation.resolveCompletion();
  }

  private rejectOperation(operation: SyncOperation, error: Error): void {
    if (operation.completionSettled) return;
    operation.completionSettled = true;
    operation.rejectCompletion(error);
  }

  private normalizeError(error: unknown): Error {
    return error instanceof Error
      ? error
      : new Error(typeof error === "string" ? error : "Sync error");
  }

  /**
   * Start processing with mutex protection
   * Lock release is now inside processQueue() to prevent race condition
   */
  private async startProcessing(): Promise<void> {
    if (this.processingPromise) {
      return this.processingPromise;
    }

    const processing = this.processQueue().finally(() => {
      if (this.processingPromise === processing) {
        this.processingPromise = null;
      }
      if (
        this.queue.length > 0 &&
        this.state.isOnline &&
        !this.accountBoundarySuspended
      ) {
        void this.startProcessing().catch((error: unknown) => {
          logger.error("[SyncOrchestrator] Failed to continue queue processing", error);
        });
      }
    });
    this.processingPromise = processing;
    return processing;
  }

  private async assertOperationCurrent(operation: SyncOperation): Promise<void> {
    if (
      this.accountBoundarySuspended ||
      operation.generation !== this.accountGeneration
    ) {
      throw new SyncOrchestratorAccountBoundaryError();
    }

    const activeOwnerUserId = await getCurrentSessionUserId();
    if (
      this.accountBoundarySuspended ||
      operation.generation !== this.accountGeneration ||
      activeOwnerUserId !== operation.ownerUserId
    ) {
      throw new SyncOrchestratorAccountBoundaryError();
    }
  }

  private async requeueAfterDelay(
    operation: SyncOperation,
    delay: number,
    controller: AbortController
  ): Promise<boolean> {
    this.removeOperation(operation);
    this.updateState({ queueLength: this.queue.length });

    try {
      await this.sleep(delay, controller.signal);
      await this.assertOperationCurrent(operation);
    } catch (error) {
      this.rejectOperation(operation, this.normalizeError(error));
      return false;
    }

    this.queue.push(operation);
    this.sortQueueByPriority();
    this.updateState({ queueLength: this.queue.length });
    return true;
  }

  /**
   * Process the sync queue sequentially
   * Uses try/finally to ensure atomic release of both isProcessing and processingPromise
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    if (this.accountBoundarySuspended) return;

    // Check if online
    if (!this.state.isOnline) {
      logger.sync("Offline - pausing sync queue");
      this.updateState({ status: "error", lastError: "Device is offline" });
      return;
    }

    this.isProcessing = true;
    this.updateState({ status: "syncing" });

    try {
      while (this.queue.length > 0 && !this.accountBoundarySuspended) {
        const operation = this.queue[0];
        const controller = new AbortController();
        this.activeOperation = operation;
        this.activeController = controller;

        try {
          await this.assertOperationCurrent(operation);
          lazyCategorizedBreadcrumb("sync", `Starting ${operation.type} sync`, {
            operationId: operation.id,
            priority: operation.priority,
          });
          logger.sync(`Starting ${operation.type} sync`);
          operation.startedAt = Date.now();

          this.updateState({
            currentOperation: operation.type,
            status: "syncing",
          });

          // P2-5 Fix: Execute the sync operation with timeout protection
          await this.executeWithTimeout(operation, controller);

          operation.completedAt = Date.now();
          const duration = operation.completedAt - operation.startedAt;

          lazyCategorizedBreadcrumb("sync", `Completed ${operation.type} sync`, {
            duration,
            operationId: operation.id,
          });
          logger.sync(`Completed ${operation.type} sync in ${duration}ms`);

          this.removeOperation(operation);
          this.resolveOperation(operation);

          this.updateState({
            status: "success",
            lastSyncTime: Date.now(),
            lastSyncType: operation.type,
            queueLength: this.queue.length,
            currentOperation: undefined,
            lastError: undefined, // Clear previous errors on success
          });
        } catch (error) {
          const normalizedError = this.normalizeError(error);

          if (normalizedError instanceof SyncOrchestratorAccountBoundaryError) {
            this.removeOperation(operation);
            this.rejectOperation(operation, normalizedError);
            this.updateState({
              status: "idle",
              queueLength: this.queue.length,
              currentOperation: undefined,
            });
            continue;
          }

          lazyCategorizedBreadcrumb(
            "sync",
            `Sync error for ${operation.type}`,
            {
              error: normalizedError.message,
              retries: operation.retries,
            },
            "error"
          );
          logger.error(`Sync error for ${operation.type}:`, normalizedError);

          operation.error = normalizedError;
          operation.retries++;

          // Check for 401 authentication errors - these need special handling
          if (is401Error(normalizedError)) {
            logger.warn(
              `[SyncOrchestrator] 401 error on ${operation.type} - checking if session truly expired`
            );

            // If we already emitted session expired, just clear and stop
            if (this.sessionExpiredEmitted) {
              logger.log(`[SyncOrchestrator] Session already expired, clearing remaining queue`);
              const sessionError = new Error("Session expired. Please sign in again.");
              this.removeOperation(operation);
              this.rejectOperation(operation, sessionError);
              this.clearQueue(sessionError);
              break;
            }

            // Verify session before notifying UI
            // 401 might be a transient error, check actual session state
            let sessionValid = false;
            try {
              if (supabase) {
                const { data } = await supabase.auth.getSession();
                sessionValid = !!data.session;
              }
            } catch (sessionError) {
              logger.error("[SyncOrchestrator] Error checking session:", sessionError);
            }

            if (sessionValid) {
              // Session is still valid - treat as transient error, retry later
              logger.log(
                `[SyncOrchestrator] Session valid despite 401, will retry ${operation.type}`
              );
              // Don't dispatch expired event, just retry with other errors
              // Note: retries was already incremented above (line 216), so check against maxRetries
              if (operation.retries < operation.maxRetries) {
                const delay = this.calculateRetryDelay(operation.retries);
                await this.requeueAfterDelay(operation, delay, controller);
                continue;
              }
            }

            // Session truly expired
            lazyCategorizedBreadcrumb(
              "sync",
              "Session expired - clearing queue",
              { operation: operation.type },
              "warning"
            );
            logger.warn(`[SyncOrchestrator] Session confirmed expired for ${operation.type}`);

            // Set flag BEFORE dispatching to prevent race condition
            this.sessionExpiredEmitted = true;

            const sessionError = new Error("Session expired. Please sign in again.");
            this.removeOperation(operation);
            this.rejectOperation(operation, sessionError);
            this.clearQueue(sessionError);

            // Notify UI that session has expired (only once due to flag)
            window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT));

            this.updateState({
              status: "error",
              lastError: "Session expired. Please sign in again.",
              queueLength: 0,
              currentOperation: undefined,
            });
            // Stop processing the queue
            break;
          }

          // Don't retry on client errors (400, 404, 422) - these won't succeed on retry
          // Also check for Supabase/Postgres-specific error messages
          const errorMessage = normalizedError.message || "";
          const isClientError =
            normalizedError instanceof SyncOperationTimeoutError ||
            errorMessage.includes("400") ||
            errorMessage.includes("404") ||
            errorMessage.includes("422") ||
            errorMessage.includes("Bad Request") ||
            errorMessage.includes("Not Found") ||
            errorMessage.includes("duplicate key") ||
            errorMessage.includes("violates unique constraint") ||
            errorMessage.includes("already exists") ||
            errorMessage.includes("invalid input syntax") ||
            errorMessage.includes("PGRST") || // PostgREST errors (except auth)
            errorMessage.includes("relation") || // Table not found
            errorMessage.includes("column"); // Column not found

          // Check if we should retry (skip retry for client errors)
          if (!isClientError && operation.retries < operation.maxRetries) {
            const delay = this.calculateRetryDelay(operation.retries);
            logger.sync(
              `Retrying ${operation.type} in ${delay}ms (attempt ${operation.retries + 1}/${operation.maxRetries})`
            );

            // P1-7 Fix: Reduce priority on retry to prevent starvation
            // Without this, high-priority failing operations could block lower-priority ones indefinitely
            operation.priority = Math.max(0, operation.priority - 1);

            // Move to end of queue and retry after delay
            await this.requeueAfterDelay(operation, delay, controller);
          } else {
            logger.error(`Max retries exceeded for ${operation.type}`);

            this.removeOperation(operation);
            this.rejectOperation(operation, normalizedError);

            this.updateState({
              status: "error",
              lastError: normalizedError.message,
              queueLength: this.queue.length,
              currentOperation: undefined,
            });
          }
        } finally {
          if (this.activeOperation === operation) this.activeOperation = null;
          if (this.activeController === controller) this.activeController = null;
        }
      }

      if (this.queue.length === 0) {
        this.updateState({
          status: "idle", // Queue empty - return to idle state
          currentOperation: undefined,
        });
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateRetryDelay(retryCount: number): number {
    const delay = Math.min(this.RETRY_DELAY_BASE * Math.pow(2, retryCount), this.RETRY_DELAY_MAX);
    // Add jitter to avoid thundering herd
    return delay + Math.random() * 1000;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(
          signal.reason instanceof Error
            ? signal.reason
            : new SyncOrchestratorAccountBoundaryError()
        );
        return;
      }

      const timeoutId = setTimeout(() => {
        signal?.removeEventListener("abort", handleAbort);
        resolve();
      }, ms);
      const handleAbort = () => {
        clearTimeout(timeoutId);
        reject(
          signal?.reason instanceof Error
            ? signal.reason
            : new SyncOrchestratorAccountBoundaryError()
        );
      };
      signal?.addEventListener("abort", handleAbort, { once: true });
    });
  }

  /**
   * P2-5 Fix: Execute operation with timeout protection
   * Prevents individual operations from blocking the queue indefinitely
   */
  private async executeWithTimeout(
    operation: SyncOperation,
    controller: AbortController
  ): Promise<void> {
    const timeoutError = new SyncOperationTimeoutError(
      operation.type,
      this.OPERATION_TIMEOUT
    );
    const executorPromise = Promise.resolve().then(() =>
      operation.executor({
        ownerUserId: operation.ownerUserId,
        generation: operation.generation,
        signal: controller.signal,
      })
    );

    let rejectOnAbort!: (error: Error) => void;
    const abortPromise = new Promise<never>((_resolve, reject) => {
      rejectOnAbort = reject;
    });
    const handleAbort = () => {
      rejectOnAbort(
        controller.signal.reason instanceof Error
          ? controller.signal.reason
          : new SyncOrchestratorAccountBoundaryError()
      );
    };
    controller.signal.addEventListener("abort", handleAbort, { once: true });

    const timeoutId = setTimeout(() => {
      logger.warn(
        `[SyncOrchestrator] ${operation.type} operation timed out after ${this.OPERATION_TIMEOUT}ms`
      );
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("zenflow:sync-operation-timeout", {
            detail: { operationType: operation.type, timeoutMs: this.OPERATION_TIMEOUT },
          })
        );
      }
      controller.abort(timeoutError);
    }, this.OPERATION_TIMEOUT);

    try {
      await Promise.race([executorPromise, abortPromise]);
    } catch (error) {
      const normalizedError = this.normalizeError(error);
      if (controller.signal.aborted) {
        // Abort is cooperative. Do not let the next account or queued operation
        // start until the old executor has actually stopped touching resources.
        await executorPromise.catch(() => undefined);
        throw controller.signal.reason instanceof Error
          ? controller.signal.reason
          : normalizedError;
      }
      throw normalizedError;
    } finally {
      clearTimeout(timeoutId);
      controller.signal.removeEventListener("abort", handleAbort);
    }
  }

  /**
   * Handle online/offline status changes
   */
  private handleOnlineStatusChange(isOnline: boolean): void {
    logger.sync(`Network status changed: ${isOnline ? "online" : "offline"}`);
    this.updateState({ isOnline });

    // Resume processing when back online using mutex-protected method
    if (
      isOnline &&
      this.queue.length > 0 &&
      !this.isProcessing &&
      !this.accountBoundarySuspended
    ) {
      this.startProcessing().catch((err) => {
        logger.sync("Failed to resume processing on network recovery", err);
      });
    }
  }

  /**
   * Update state and notify listeners
   */
  private updateState(updates: Partial<SyncState>): void {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }

  /**
   * Subscribe to sync state changes
   */
  subscribe(listener: SyncStateListener): () => void {
    this.listeners.add(listener);
    // Immediately notify with current state
    listener(this.state);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.state));
  }

  /**
   * Get current sync state
   */
  getState(): SyncState {
    return { ...this.state };
  }

  /**
   * Clear the queue (emergency stop)
   */
  clearQueue(reason: Error = new Error("Sync queue cleared")): void {
    logger.sync("Clearing sync queue");
    const activeOperation = this.activeOperation;
    const pendingOperations = this.queue.filter(
      (operation) => operation !== activeOperation
    );
    this.queue = activeOperation ? this.queue.filter((operation) => operation === activeOperation) : [];

    for (const operation of pendingOperations) {
      this.rejectOperation(operation, reason);
    }
    if (activeOperation && !this.activeController?.signal.aborted) {
      this.activeController?.abort(reason);
    }

    this.updateState({
      queueLength: this.queue.length,
      status: "idle",
      currentOperation: undefined,
    });
  }

  /**
   * Stop accepting account work, cancel queued operations, abort the active
   * executor, and wait until it has actually unwound before local data is purged.
   */
  async suspendForAccountBoundary(): Promise<void> {
    if (!this.accountBoundarySuspended) {
      this.accountBoundarySuspended = true;
      this.accountGeneration += 1;
    }

    const boundaryError = new SyncOrchestratorAccountBoundaryError();
    const activeOperation = this.activeOperation;
    const pendingOperations = this.queue.filter(
      (operation) => operation !== activeOperation
    );
    this.queue = activeOperation ? this.queue.filter((operation) => operation === activeOperation) : [];

    for (const operation of pendingOperations) {
      this.rejectOperation(operation, boundaryError);
    }
    if (this.activeController && !this.activeController.signal.aborted) {
      this.activeController.abort(boundaryError);
    }

    this.updateState({
      status: "idle",
      currentOperation: undefined,
      queueLength: this.queue.length,
    });

    const processing = this.processingPromise;
    if (processing) {
      await processing.catch((error: unknown) => {
        logger.warn("[SyncOrchestrator] Account-boundary unwind failed", error);
      });
    }
  }

  resumeAfterAccountBoundary(): void {
    this.accountBoundarySuspended = false;
    logger.sync("[SyncOrchestrator] Resumed after account-boundary cleanup");
    if (this.queue.length > 0 && this.state.isOnline) {
      void this.startProcessing().catch((error: unknown) => {
        logger.error("[SyncOrchestrator] Failed to resume queue", error);
      });
    }
  }

  /**
   * Reset session expired flag (call after successful re-authentication)
   */
  resetSessionExpired(): void {
    this.sessionExpiredEmitted = false;
    logger.sync("Session expired flag reset");
  }

  /**
   * Get queue info for debugging
   */
  getQueueInfo(): Array<{ type: SyncOperationType; priority: number; retries: number }> {
    return [...this.queue].sort((a, b) => b.priority - a.priority).map((op) => ({
      type: op.type,
      priority: op.priority,
      retries: op.retries,
    }));
  }
}

// Singleton instance
export const syncOrchestrator = new SyncOrchestrator();

/**
 * React hook for using sync orchestrator
 */
export function useSyncOrchestrator() {
  const [state, setState] = useState<SyncState>(syncOrchestrator.getState());

  useEffect(() => {
    const unsubscribe = syncOrchestrator.subscribe(setState);
    return unsubscribe;
  }, []);

  return {
    state,
    sync: syncOrchestrator.sync.bind(syncOrchestrator),
    clearQueue: syncOrchestrator.clearQueue.bind(syncOrchestrator),
    getQueueInfo: syncOrchestrator.getQueueInfo.bind(syncOrchestrator),
    resetSessionExpired: syncOrchestrator.resetSessionExpired.bind(syncOrchestrator),
  };
}
