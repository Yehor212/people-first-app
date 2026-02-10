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

import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';
import { addCategorizedBreadcrumb } from '@/lib/sentry';
import { isCloudSyncEnabled } from '@/lib/cloudSyncSettings';
import { generateSecureRandom } from '@/lib/validation';
import { is401Error, AUTH_SESSION_EXPIRED_EVENT } from '@/lib/apiClient';
import { supabase } from '@/lib/supabaseClient';

// Sync operation types
export type SyncOperationType =
  | 'backup'           // Full backup sync (cloudSync)
  | 'reminders'        // Reminder settings sync
  | 'challenges'       // Challenges sync
  | 'tasks'            // Tasks sync
  | 'innerWorld'       // Inner world sync
  | 'badges';          // Badges sync

export type SyncStatus =
  | 'idle'             // No sync in progress
  | 'syncing'          // Sync in progress
  | 'success'          // Last sync succeeded
  | 'error'            // Last sync failed
  | 'conflict';        // Conflict detected

export interface SyncOperation {
  id: string;
  type: SyncOperationType;
  priority: number;          // Higher = higher priority (0-10)
  executor: () => Promise<void>;
  retries: number;           // Number of retries attempted
  maxRetries: number;        // Maximum retries allowed
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: Error;
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
  private listeners: Set<SyncStateListener> = new Set();
  private state: SyncState = {
    status: 'idle',
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

  // Event handlers (stored for cleanup)
  private onlineHandler = () => this.handleOnlineStatusChange(true);
  private offlineHandler = () => this.handleOnlineStatusChange(false);

  constructor() {
    // Listen to online/offline events
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);
  }

  /**
   * Cleanup event listeners (call when destroying the orchestrator)
   */
  destroy(): void {
    window.removeEventListener('online', this.onlineHandler);
    window.removeEventListener('offline', this.offlineHandler);
    this.listeners.clear();
  }

  /**
   * Add a sync operation to the queue
   */
  async sync(
    type: SyncOperationType,
    executor: () => Promise<void>,
    options: {
      priority?: number;
      maxRetries?: number;
    } = {}
  ): Promise<void> {
    // Check if cloud sync is enabled by user
    if (!isCloudSyncEnabled()) {
      logger.sync(`[${type}] Cloud sync disabled by user - skipping`);
      return; // Skip sync silently
    }

    const operation: SyncOperation = {
      id: `${type}-${Date.now()}-${generateSecureRandom()}`,
      type,
      priority: options.priority ?? 5,
      executor,
      retries: 0,
      maxRetries: options.maxRetries ?? 3,
      createdAt: Date.now(),
    };

    // Add to queue sorted by priority (higher first)
    this.queue.push(operation);
    this.queue.sort((a, b) => b.priority - a.priority);

    this.updateState({ queueLength: this.queue.length });

    logger.sync(`Queued ${type} sync (priority: ${operation.priority})`);

    // Start processing using mutex pattern to avoid race conditions
    // If already processing, wait for current batch to complete then check queue again
    void this.startProcessing();
  }

  /**
   * Start processing with mutex protection
   * Lock release is now inside processQueue() to prevent race condition
   */
  private async startProcessing(): Promise<void> {
    // If already processing, wait for it to complete
    if (this.processingPromise) {
      await this.processingPromise;
      // After waiting, recursively check if we need to process more
      // Both isProcessing and processingPromise are now cleared atomically in processQueue()
      if (this.queue.length > 0 && !this.isProcessing) {
        void this.startProcessing();
      }
      return;
    }

    // Acquire the lock by creating the promise
    this.processingPromise = this.processQueue();
    await this.processingPromise;
    // Lock release moved inside processQueue() to ensure atomic release with isProcessing
  }

  /**
   * Process the sync queue sequentially
   * Uses try/finally to ensure atomic release of both isProcessing and processingPromise
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    // Check if online
    if (!this.state.isOnline) {
      logger.sync('Offline - pausing sync queue');
      this.updateState({ status: 'error', lastError: 'Device is offline' });
      return;
    }

    this.isProcessing = true;
    this.updateState({ status: 'syncing' });

    try {
    while (this.queue.length > 0) {
      const operation = this.queue[0];

      try {
        addCategorizedBreadcrumb('sync', `Starting ${operation.type} sync`, { operationId: operation.id, priority: operation.priority });
        logger.sync(`Starting ${operation.type} sync`);
        operation.startedAt = Date.now();

        this.updateState({
          currentOperation: operation.type,
          status: 'syncing',
        });

        // P2-5 Fix: Execute the sync operation with timeout protection
        await this.executeWithTimeout(operation.executor, operation.type);

        operation.completedAt = Date.now();
        const duration = operation.completedAt - operation.startedAt;

        addCategorizedBreadcrumb('sync', `Completed ${operation.type} sync`, { duration, operationId: operation.id });
        logger.sync(`Completed ${operation.type} sync in ${duration}ms`);

        // Remove from queue
        this.queue.shift();

        this.updateState({
          status: 'success',
          lastSyncTime: Date.now(),
          lastSyncType: operation.type,
          queueLength: this.queue.length,
          currentOperation: undefined,
          lastError: undefined, // Clear previous errors on success
        });

      } catch (error) {
        addCategorizedBreadcrumb('sync', `Sync error for ${operation.type}`, {
          error: (error as Error).message,
          retries: operation.retries,
        }, 'error');
        logger.error(`Sync error for ${operation.type}:`, error);

        operation.error = error as Error;
        operation.retries++;

        // Check for 401 authentication errors - these need special handling
        if (is401Error(error)) {
          logger.warn(`[SyncOrchestrator] 401 error on ${operation.type} - checking if session truly expired`);

          // If we already emitted session expired, just clear and stop
          if (this.sessionExpiredEmitted) {
            logger.log(`[SyncOrchestrator] Session already expired, clearing remaining queue`);
            this.clearQueue();
            break;
          }

          // Verify session before notifying UI
          // 401 might be a transient error, check actual session state
          let sessionValid = false;
          try {
            const { data } = await supabase.auth.getSession();
            sessionValid = !!data.session;
          } catch (sessionError) {
            logger.error('[SyncOrchestrator] Error checking session:', sessionError);
          }

          if (sessionValid) {
            // Session is still valid - treat as transient error, retry later
            logger.log(`[SyncOrchestrator] Session valid despite 401, will retry ${operation.type}`);
            // Don't dispatch expired event, just retry with other errors
            // Note: retries was already incremented above (line 216), so check against maxRetries
            if (operation.retries < operation.maxRetries) {
              const delay = this.calculateRetryDelay(operation.retries);
              this.queue.shift();
              await this.sleep(delay);
              this.queue.push(operation);
              this.queue.sort((a, b) => b.priority - a.priority);
              continue;
            }
          }

          // Session truly expired
          addCategorizedBreadcrumb('sync', 'Session expired - clearing queue', { operation: operation.type }, 'warning');
          logger.warn(`[SyncOrchestrator] Session confirmed expired for ${operation.type}`);

          // Set flag BEFORE dispatching to prevent race condition
          this.sessionExpiredEmitted = true;

          // Clear entire queue - no point retrying with expired session
          this.clearQueue();

          // Notify UI that session has expired (only once due to flag)
          window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT));

          this.updateState({
            status: 'error',
            lastError: 'Session expired. Please sign in again.',
            queueLength: 0,
            currentOperation: undefined,
          });
          // Stop processing the queue
          break;
        }

        // Don't retry on client errors (400, 404, 422) - these won't succeed on retry
        // Also check for Supabase/Postgres-specific error messages
        const errorMessage = (error as Error).message || '';
        const isClientError = errorMessage.includes('400') ||
          errorMessage.includes('404') ||
          errorMessage.includes('422') ||
          errorMessage.includes('Bad Request') ||
          errorMessage.includes('Not Found') ||
          errorMessage.includes('duplicate key') ||
          errorMessage.includes('violates unique constraint') ||
          errorMessage.includes('already exists') ||
          errorMessage.includes('invalid input syntax') ||
          errorMessage.includes('PGRST') || // PostgREST errors (except auth)
          errorMessage.includes('relation') || // Table not found
          errorMessage.includes('column'); // Column not found

        // Check if we should retry (skip retry for client errors)
        if (!isClientError && operation.retries < operation.maxRetries) {
          const delay = this.calculateRetryDelay(operation.retries);
          logger.sync(`Retrying ${operation.type} in ${delay}ms (attempt ${operation.retries + 1}/${operation.maxRetries})`);

          // P1-7 Fix: Reduce priority on retry to prevent starvation
          // Without this, high-priority failing operations could block lower-priority ones indefinitely
          operation.priority = Math.max(0, operation.priority - 1);

          // Move to end of queue and retry after delay
          this.queue.shift();
          await this.sleep(delay);
          this.queue.push(operation);
          this.queue.sort((a, b) => b.priority - a.priority);
        } else {
          logger.error(`Max retries exceeded for ${operation.type}`);

          // Remove failed operation from queue
          this.queue.shift();

          this.updateState({
            status: 'error',
            lastError: (error as Error).message,
            queueLength: this.queue.length,
            currentOperation: undefined,
          });
        }
      }
    }

    if (this.queue.length === 0) {
      this.updateState({
        status: 'idle', // Queue empty - return to idle state
        currentOperation: undefined,
      });
    }
    } finally {
      // Release both flags atomically to prevent race condition
      // where another caller sees processingPromise = null but isProcessing = true
      this.isProcessing = false;
      this.processingPromise = null;
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateRetryDelay(retryCount: number): number {
    const delay = Math.min(
      this.RETRY_DELAY_BASE * Math.pow(2, retryCount),
      this.RETRY_DELAY_MAX
    );
    // Add jitter to avoid thundering herd
    return delay + Math.random() * 1000;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * P2-5 Fix: Execute operation with timeout protection
   * Prevents individual operations from blocking the queue indefinitely
   */
  private executeWithTimeout(
    executor: () => Promise<void>,
    operationType: SyncOperationType
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let settled = false;

      // Set up timeout
      timeoutId = setTimeout(() => {
        if (!settled) {
          settled = true;
          logger.warn(`[SyncOrchestrator] ${operationType} operation timed out after ${this.OPERATION_TIMEOUT}ms`);
          // Emit event for UI awareness
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('zenflow:sync-operation-timeout', {
              detail: { operationType, timeoutMs: this.OPERATION_TIMEOUT }
            }));
          }
          reject(new Error(`Sync operation '${operationType}' timed out after ${this.OPERATION_TIMEOUT}ms`));
        }
      }, this.OPERATION_TIMEOUT);

      // Execute the operation
      executor()
        .then(() => {
          if (!settled) {
            settled = true;
            if (timeoutId) clearTimeout(timeoutId);
            resolve();
          }
        })
        .catch((error: unknown) => {
          if (!settled) {
            settled = true;
            if (timeoutId) clearTimeout(timeoutId);
            reject(error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Sync error'));
          }
        });
    });
  }

  /**
   * Handle online/offline status changes
   */
  private handleOnlineStatusChange(isOnline: boolean): void {
    logger.sync(`Network status changed: ${isOnline ? 'online' : 'offline'}`);
    this.updateState({ isOnline });

    // Resume processing when back online using mutex-protected method
    if (isOnline && this.queue.length > 0 && !this.isProcessing) {
      void this.startProcessing();
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
    this.listeners.forEach(listener => listener(this.state));
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
  clearQueue(): void {
    logger.sync('Clearing sync queue');
    this.queue = [];
    this.updateState({
      queueLength: 0,
      status: 'idle',
      currentOperation: undefined,
    });
  }

  /**
   * Reset session expired flag (call after successful re-authentication)
   */
  resetSessionExpired(): void {
    this.sessionExpiredEmitted = false;
    logger.sync('Session expired flag reset');
  }

  /**
   * Get queue info for debugging
   */
  getQueueInfo(): Array<{ type: SyncOperationType; priority: number; retries: number }> {
    return this.queue.map(op => ({
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
