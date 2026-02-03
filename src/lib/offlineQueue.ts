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
 * - P1 Fix: Background Sync API support for sync after browser close
 */

// P1 Fix: Type declarations for Background Sync API
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

import { logger } from './logger';
import { generateSecureRandom } from './validation';
import { safeJsonParse } from './safeJson';
import { db, OfflineQueueItem } from '@/storage/db';

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

  // P0 Fix: Promise to track initialization - operations must await this before modifying queue
  private initPromise: Promise<void> | null = null;

  // Bound event handlers for proper cleanup (P1 Fix: all handlers must be bound for removal)
  private boundHandleOnline = () => this.handleOnline();
  private boundHandleOffline = () => this.handleOffline();
  private boundHandleSWMessage = (event: MessageEvent) => this.handleSWMessage(event);

  constructor() {
    // Load persisted queue on init - now properly awaited via initPromise
    this.initPromise = this.initializeStorage();

    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.boundHandleOnline);
      window.addEventListener('offline', this.boundHandleOffline);

      // P1 Fix: Listen for Background Sync messages from Service Worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', this.boundHandleSWMessage);
      }
    }
  }

  /**
   * Handle messages from Service Worker (e.g., Background Sync trigger)
   */
  private handleSWMessage(event: MessageEvent): void {
    if (event.data?.type === 'SYNC_REQUESTED') {
      logger.log('[OfflineQueue] Background Sync triggered by SW');
      void this.processQueue();
    }
  }

  /**
   * Cleanup event listeners - call when destroying the queue
   * P1 Fix: Now properly removes ALL listeners including SW message handler
   */
  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.boundHandleOnline);
      window.removeEventListener('offline', this.boundHandleOffline);

      // P1 Fix: Remove SW message listener to prevent memory leak
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', this.boundHandleSWMessage);
      }
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
   * P0 Fix: Now awaits initialization before modifying queue
   */
  async enqueue(
    type: OfflineActionType,
    entityId: string,
    payload: unknown,
    options: { maxRetries?: number; deduplicate?: boolean } = {}
  ): Promise<void> {
    // P0 Fix: Wait for initialization to complete before modifying queue
    if (this.initPromise) {
      await this.initPromise;
    }

    const { maxRetries = DEFAULT_MAX_RETRIES, deduplicate = true } = options;

    // Check queue size limit
    // P1 Fix: Emit event when data is dropped so UI can warn user
    if (this.state.actions.length >= MAX_QUEUE_SIZE) {
      const droppedAction = this.state.actions.shift();
      logger.warn('[OfflineQueue] Queue size limit reached, removing oldest action:', droppedAction?.type);

      // Emit custom event for UI to show warning
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('zenflow:offline-data-dropped', {
          detail: {
            droppedAction,
            queueSize: MAX_QUEUE_SIZE,
            message: 'Too many offline changes. Some data may be lost. Please connect to sync.'
          }
        }));
      }
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
    } else {
      // P1 Fix: Register for Background Sync when offline
      this.requestBackgroundSync();
    }
  }

  /**
   * Request Background Sync via Service Worker
   * This allows sync to happen even if user closes the browser
   */
  private requestBackgroundSync(): void {
    if ('serviceWorker' in navigator && 'sync' in window.SyncManager.prototype) {
      navigator.serviceWorker.ready
        .then((registration) => {
          return registration.sync.register('zenflow-sync');
        })
        .then(() => {
          logger.log('[OfflineQueue] Background Sync registered');
        })
        .catch((err) => {
          logger.warn('[OfflineQueue] Background Sync registration failed:', err);
        });
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
   * P0 Fix: Now awaits initialization before processing
   */
  async processQueue(): Promise<void> {
    // P0 Fix: Wait for initialization to complete before processing
    if (this.initPromise) {
      await this.initPromise;
    }

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
   * P0 Fix: Now async to await initialization
   */
  async clearQueue(): Promise<void> {
    // P0 Fix: Wait for initialization before clearing
    if (this.initPromise) {
      await this.initPromise;
    }
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

  /**
   * Load queue from IndexedDB, with localStorage fallback
   * P0 Fix: Primary storage is now IndexedDB for better quota handling
   */
  private async loadFromStorageAsync(): Promise<void> {
    try {
      // Try IndexedDB first
      const items = await db.offlineQueue.toArray();
      if (items.length > 0) {
        this.state.actions = items.map(item => ({
          id: item.id,
          type: item.type as OfflineActionType,
          entityId: item.entityId,
          payload: item.payload,
          timestamp: item.timestamp,
          retries: item.retries,
          maxRetries: item.maxRetries,
          lastError: item.lastError,
        }));
        logger.log('[OfflineQueue] Loaded from IndexedDB:', this.state.actions.length, 'actions');

        // Migrate localStorage data if any (one-time migration)
        await this.migrateFromLocalStorage();
        return;
      }
    } catch (idbError) {
      logger.warn('[OfflineQueue] IndexedDB load failed, trying localStorage:', idbError);
    }

    // Fallback to localStorage
    this.loadFromLocalStorage();
  }

  private loadFromLocalStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = safeJsonParse<{ actions: OfflineAction[] }>(stored, { actions: [] });
        this.state.actions = data.actions || [];
        logger.log('[OfflineQueue] Loaded from localStorage:', this.state.actions.length, 'actions');
      }
    } catch (error) {
      logger.error('[OfflineQueue] Failed to load from localStorage:', error);
    }
  }

  /**
   * P0 Fix: Initialize storage with proper async/await
   * Loads from localStorage first (sync), then IndexedDB (async)
   * Operations that modify the queue must await initPromise
   */
  private async initializeStorage(): Promise<void> {
    // Synchronous load from localStorage for immediate fallback
    this.loadFromLocalStorage();
    // Then async load from IndexedDB (will override if has data)
    await this.loadFromStorageAsync();
    // Clear initPromise to indicate initialization complete
    this.initPromise = null;
    logger.log('[OfflineQueue] Initialization complete');
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
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = safeJsonParse<{ actions: OfflineAction[] }>(stored, { actions: [] });
        if (data.actions && data.actions.length > 0) {
          // Data already in IndexedDB, remove from localStorage
          localStorage.removeItem(STORAGE_KEY);
          logger.log('[OfflineQueue] Cleared localStorage after IndexedDB migration');
        }
      }
    } catch (error) {
      // Ignore migration errors
    }
  }

  /**
   * Persist queue to IndexedDB with localStorage fallback
   * P0 Fix: Uses IndexedDB for better quota handling
   */
  private persistToStorage(): void {
    // Persist asynchronously to IndexedDB
    void this.persistToIndexedDB();
  }

  private async persistToIndexedDB(): Promise<void> {
    try {
      // Clear and repopulate for simplicity
      await db.transaction('rw', db.offlineQueue, async () => {
        await db.offlineQueue.clear();
        if (this.state.actions.length > 0) {
          const items: OfflineQueueItem[] = this.state.actions.map(action => ({
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
      logger.warn('[OfflineQueue] IndexedDB persist failed, using localStorage fallback:', idbError);
      // Fallback to localStorage
      this.persistToLocalStorage();
    }
  }

  private persistToLocalStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        actions: this.state.actions,
        lastProcessedAt: this.state.lastProcessedAt,
      }));
    } catch (error) {
      logger.error('[OfflineQueue] Failed to persist to localStorage:', error);
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
