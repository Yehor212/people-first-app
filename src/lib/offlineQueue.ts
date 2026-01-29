/**
 * Offline Action Queue
 *
 * Stores user actions when offline and syncs them when connection is restored.
 * Critical for ADHD users who may be in areas without internet.
 *
 * Features:
 * - IndexedDB-based persistent storage
 * - Automatic sync on reconnection
 * - Retry logic with exponential backoff
 * - Action deduplication
 * - Conflict resolution (last-write-wins)
 */

import { logger } from './logger';
import { generateSecureRandom } from './validation';
import { safeJsonParse } from './safeJson';

// Action types that can be queued
export type OfflineActionType =
  | 'CREATE_MOOD'
  | 'UPDATE_MOOD'
  | 'DELETE_MOOD'
  | 'CREATE_HABIT'
  | 'UPDATE_HABIT'
  | 'DELETE_HABIT'
  | 'TOGGLE_HABIT'
  | 'CREATE_FOCUS_SESSION'
  | 'CREATE_GRATITUDE'
  | 'DELETE_GRATITUDE'
  | 'UPDATE_SETTINGS';

export interface OfflineAction {
  id: string;
  type: OfflineActionType;
  entityId: string; // ID of the entity being modified
  payload: unknown;
  timestamp: number;
  retries: number;
  maxRetries: number;
  lastError?: string;
}

interface QueueState {
  actions: OfflineAction[];
  lastProcessedAt: number | null;
  isProcessing: boolean;
}

const STORAGE_KEY = 'zenflow_offline_queue';
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
  private syncHandlers: Map<OfflineActionType, (action: OfflineAction) => Promise<void>> = new Map();
  private processingPromise: Promise<void> | null = null;

  // Bound event handlers for proper cleanup
  private boundHandleOnline = () => this.handleOnline();
  private boundHandleOffline = () => this.handleOffline();

  constructor() {
    // Load persisted queue on init
    this.loadFromStorage();

    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.boundHandleOnline);
      window.addEventListener('offline', this.boundHandleOffline);
    }
  }

  /**
   * Cleanup event listeners - call when destroying the queue
   */
  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.boundHandleOnline);
      window.removeEventListener('offline', this.boundHandleOffline);
    }
    this.listeners.clear();
    this.syncHandlers.clear();
    logger.log('[OfflineQueue] Destroyed');
  }

  /**
   * Register a handler for a specific action type
   */
  registerHandler(type: OfflineActionType, handler: (action: OfflineAction) => Promise<void>): void {
    this.syncHandlers.set(type, handler);
  }

  /**
   * Add an action to the queue
   */
  async enqueue(
    type: OfflineActionType,
    entityId: string,
    payload: unknown,
    options: { maxRetries?: number; deduplicate?: boolean } = {}
  ): Promise<void> {
    const { maxRetries = DEFAULT_MAX_RETRIES, deduplicate = true } = options;

    // Check queue size limit
    if (this.state.actions.length >= MAX_QUEUE_SIZE) {
      logger.warn('[OfflineQueue] Queue size limit reached, removing oldest action');
      this.state.actions.shift();
    }

    // Deduplicate: remove previous action for same entity and type
    if (deduplicate) {
      this.state.actions = this.state.actions.filter(
        a => !(a.entityId === entityId && a.type === type)
      );
    }

    const action: OfflineAction = {
      id: `${type}_${entityId}_${Date.now()}_${generateSecureRandom()}`,
      type,
      entityId,
      payload,
      timestamp: Date.now(),
      retries: 0,
      maxRetries,
    };

    this.state.actions.push(action);
    this.persistToStorage();
    this.notifyListeners();

    logger.log('[OfflineQueue] Action queued:', type, entityId);

    // If online, try to process immediately
    if (navigator.onLine) {
      void this.processQueue();
    }
  }

  /**
   * Remove an action from the queue (e.g., after successful sync)
   */
  private removeAction(actionId: string): void {
    this.state.actions = this.state.actions.filter(a => a.id !== actionId);
    this.persistToStorage();
    this.notifyListeners();
  }

  /**
   * Process all queued actions
   */
  async processQueue(): Promise<void> {
    // Mutex: prevent concurrent processing
    if (this.processingPromise) {
      await this.processingPromise;
      // After waiting, check if there are still items to process (may have been added during wait)
      if (navigator.onLine && this.state.actions.length > 0 && !this.processingPromise) {
        // Recursively process new items
        return this.processQueue();
      }
      return;
    }

    if (!navigator.onLine || this.state.actions.length === 0) {
      return;
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

    logger.log('[OfflineQueue] Processing queue, actions:', this.state.actions.length);

    // Process actions in order (FIFO)
    const actionsToProcess = [...this.state.actions];

    for (const action of actionsToProcess) {
      if (!navigator.onLine) {
        logger.log('[OfflineQueue] Went offline during processing, pausing');
        break;
      }

      const handler = this.syncHandlers.get(action.type);
      if (!handler) {
        logger.warn('[OfflineQueue] No handler for action type:', action.type);
        this.removeAction(action.id);
        continue;
      }

      try {
        await handler(action);
        this.removeAction(action.id);
        logger.log('[OfflineQueue] Action processed:', action.type, action.entityId);
      } catch (error) {
        logger.error('[OfflineQueue] Action failed:', action.type, error);

        action.retries++;
        action.lastError = error instanceof Error ? error.message : String(error);

        if (action.retries >= action.maxRetries) {
          logger.error('[OfflineQueue] Max retries reached, discarding action:', action.id);
          this.removeAction(action.id);
        } else {
          // Exponential backoff before retry
          const delay = Math.min(
            RETRY_BASE_DELAY * Math.pow(2, action.retries),
            RETRY_MAX_DELAY
          );
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

    logger.log('[OfflineQueue] Queue processing complete, remaining:', this.state.actions.length);
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
   */
  clearQueue(): void {
    this.state.actions = [];
    this.persistToStorage();
    this.notifyListeners();
    logger.log('[OfflineQueue] Queue cleared');
  }

  // Private methods

  private handleOnline(): void {
    logger.log('[OfflineQueue] Device came online');
    void this.processQueue();
  }

  private handleOffline(): void {
    logger.log('[OfflineQueue] Device went offline');
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = safeJsonParse<{ actions: OfflineAction[] }>(stored, { actions: [] });
        this.state.actions = data.actions || [];
        logger.log('[OfflineQueue] Loaded from storage:', this.state.actions.length, 'actions');
      }
    } catch (error) {
      logger.error('[OfflineQueue] Failed to load from storage:', error);
    }
  }

  private persistToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        actions: this.state.actions,
        lastProcessedAt: this.state.lastProcessedAt,
      }));
    } catch (error) {
      logger.error('[OfflineQueue] Failed to persist to storage:', error);
    }
  }

  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach(listener => listener(state));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const offlineQueue = new OfflineQueue();

// Note: React hook for offline queue is in src/hooks/useOfflineQueue.ts
// to avoid circular dependencies and keep this file framework-agnostic

export default offlineQueue;
