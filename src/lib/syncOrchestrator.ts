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
import { isCloudSyncEnabled } from '@/lib/cloudSyncSettings';
import { generateSecureRandom } from '@/lib/validation';

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

  // Retry configuration
  private readonly RETRY_DELAY_BASE = 1000; // 1 second
  private readonly RETRY_DELAY_MAX = 30000; // 30 seconds

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
   */
  private async startProcessing(): Promise<void> {
    // If already processing, wait for it to complete
    if (this.processingPromise) {
      await this.processingPromise;
      // After waiting, recursively check if we need to process more
      if (this.queue.length > 0 && !this.isProcessing) {
        void this.startProcessing();
      }
      return;
    }

    // Acquire the lock by creating the promise
    this.processingPromise = this.processQueue();
    try {
      await this.processingPromise;
    } finally {
      // Release the lock
      this.processingPromise = null;
    }
  }

  /**
   * Process the sync queue sequentially
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

    while (this.queue.length > 0) {
      const operation = this.queue[0];

      try {
        logger.sync(`Starting ${operation.type} sync`);
        operation.startedAt = Date.now();

        this.updateState({
          currentOperation: operation.type,
          status: 'syncing',
        });

        // Execute the sync operation
        await operation.executor();

        operation.completedAt = Date.now();
        const duration = operation.completedAt - operation.startedAt!;

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
        logger.error(`Sync error for ${operation.type}:`, error);

        operation.error = error as Error;
        operation.retries++;

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
          errorMessage.includes('PGRST') || // PostgREST errors
          errorMessage.includes('relation') || // Table not found
          errorMessage.includes('column'); // Column not found

        // Check if we should retry (skip retry for client errors)
        if (!isClientError && operation.retries < operation.maxRetries) {
          const delay = this.calculateRetryDelay(operation.retries);
          logger.sync(`Retrying ${operation.type} in ${delay}ms (attempt ${operation.retries + 1}/${operation.maxRetries})`);

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

    this.isProcessing = false;

    if (this.queue.length === 0) {
      this.updateState({
        status: 'idle', // Queue empty - return to idle state
        currentOperation: undefined,
      });
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
  };
}
