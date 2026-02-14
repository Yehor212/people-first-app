import { useState, useEffect, useCallback, useRef } from 'react';
import { Table } from 'dexie';
import { logger } from '@/lib/logger';

// Event emitter for cross-hook data refresh
type RefreshListener = () => void;
const refreshListeners = new Set<RefreshListener>();

export const triggerDataRefresh = () => {
  logger.log('[useIndexedDB] Triggering data refresh for all hooks');
  refreshListeners.forEach(listener => listener());
};

// Timeout for IndexedDB operations (30s — exportBackup reads 7 tables in one
// Dexie transaction which can take 10-20s on Android, blocking other hooks)
const INDEXEDDB_TIMEOUT_MS = 30000;

// Helper to add timeout to promises
// P2-3 Fix: Emit event when timeout occurs so UI can show stale data warning
const withTimeout = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(() => {
        logger.warn(`[useIndexedDB] Operation timed out after ${ms}ms, using fallback`);
        // P2-3 Fix: Emit event so UI can optionally show "data may be stale" indicator
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('zenflow:indexeddb-timeout', {
            detail: { timeoutMs: ms, message: 'IndexedDB operation timed out, using cached data' }
          }));
        }
        resolve(fallback);
      }, ms);
    })
  ]);
};

// Global initialization lock to prevent race conditions
let globalInitLock = false;
const initQueue: Array<() => void> = [];
let lockTimeout: ReturnType<typeof setTimeout> | null = null;

// Reduced timeout and added queue overflow protection
const LOCK_TIMEOUT_MS = 15000; // Reduced from 30s to 15s
const MAX_QUEUE_SIZE = 50; // Prevent unbounded queue growth

// Track if we're in the middle of a flush to prevent re-entry
let isFlushingQueue = false;

const acquireInitLock = async (): Promise<void> => {
  return new Promise((resolve) => {
    // Prevent queue overflow with atomic check
    // Emit event so UI can warn user about potential delays
    if (initQueue.length >= MAX_QUEUE_SIZE && !isFlushingQueue) {
      isFlushingQueue = true;
      logger.warn(`[useIndexedDB] Queue overflow (${initQueue.length}), force clearing`);

      // Emit warning event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('zenflow:indexeddb-queue-overflow', {
          detail: { queueSize: initQueue.length }
        }));
      }

      // Clear timeout to prevent double-release
      if (lockTimeout) {
        clearTimeout(lockTimeout);
        lockTimeout = null;
      }

      // Resolve all waiting callbacks sequentially with error handling
      // This prevents all callbacks from racing simultaneously
      const flushQueue = async () => {
        try {
          while (initQueue.length > 0) {
            const callback = initQueue.shift();
            callback?.();
            // Small delay to prevent overwhelming the system
            await new Promise(r => setTimeout(r, 10));
          }
        } catch (error) {
          logger.error('[useIndexedDB] Error during queue flush:', error);
          // Emit error event so UI can handle
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('zenflow:storage-error', {
              detail: { type: 'queue_flush_failed', message: 'Database queue flush failed' }
            }));
          }
        } finally {
          // Always release lock even on error to prevent permanent deadlock
          globalInitLock = false;
          isFlushingQueue = false;
        }
      };
      // Track flush promise with proper error handling (no fire-and-forget)
      flushQueue().catch(err => {
        logger.error('[useIndexedDB] Unhandled flush error:', err);
      });
    }

    if (!globalInitLock) {
      globalInitLock = true;
      // Auto-release lock after 15 seconds to prevent deadlock
      lockTimeout = setTimeout(() => {
        logger.warn(`[useIndexedDB] Lock timeout (${LOCK_TIMEOUT_MS}ms) - force releasing`);
        releaseInitLock();
      }, LOCK_TIMEOUT_MS);
      resolve();
    } else {
      initQueue.push(() => resolve());
    }
  });
};

const releaseInitLock = (): void => {
  if (lockTimeout) {
    clearTimeout(lockTimeout);
    lockTimeout = null;
  }
  const next = initQueue.shift();
  if (next) {
    // Set new timeout for next operation
    lockTimeout = setTimeout(() => {
      logger.warn(`[useIndexedDB] Lock timeout (${LOCK_TIMEOUT_MS}ms) - force releasing`);
      releaseInitLock();
    }, LOCK_TIMEOUT_MS);
    next();
  } else {
    globalInitLock = false;
  }
};

interface UseIndexedDBOptions<T> {
   
  table: Table<any, string>;
  localStorageKey: string;
  initialValue: T;
  idField?: string;
}

export function useIndexedDB<T>({
  table,
  localStorageKey,
  initialValue,
  idField = 'id'
}: UseIndexedDBOptions<T>): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const [data, setData] = useState<T>(initialValue);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const initializedRef = useRef(false);
  // Store initialValue in ref to avoid dependency issues (it's only used on first load)
  const initialValueRef = useRef(initialValue);
  // Track mounted state to prevent memory leaks
  const isMountedRef = useRef(true);

  // Load data function (used both on init and refresh)
  const loadData = useCallback(async (isInitialLoad = false) => {
    const defaults = initialValueRef.current;

    // Acquire lock for initial load to prevent race conditions
    if (isInitialLoad) {
      await acquireInitLock();
    }

    try {
      // For settings table with key field
      if (idField === 'key') {
        // Use timeout to prevent hanging on IndexedDB operations
        const record = await withTimeout(
          table.get(localStorageKey),
          INDEXEDDB_TIMEOUT_MS,
          undefined
        );
        if (record?.value !== undefined) {
          // Only merge objects, not primitives (strings, booleans, numbers) or arrays
          // Spreading primitives or arrays creates objects with numeric keys which breaks React rendering
          const isPrimitive = typeof record.value !== 'object' || record.value === null;
          const isArray = Array.isArray(record.value);
          if (isPrimitive || isArray) {
            // Don't merge primitives or arrays - just use the value directly
            setData(record.value as T);
          } else {
            // Merge with initialValue to ensure all required fields exist (handles schema migrations)
            setData({ ...defaults, ...record.value } as T);
          }
        } else if (isInitialLoad) {
          // Try localStorage fallback only on initial load
          try {
            const stored = localStorage.getItem(localStorageKey);
            if (stored) {
              try {
                const parsed = JSON.parse(stored);
                // Only merge objects, not primitives or arrays
                const isPrimitive = typeof parsed !== 'object' || parsed === null;
                const isArray = Array.isArray(parsed);
                if (isPrimitive || isArray) {
                  // Don't merge primitives or arrays - just use the value directly
                  setData(parsed as T);
                  table.put({ key: localStorageKey, value: parsed }).catch((err) => {
                    // Log migration errors
                    logger.warn('[useIndexedDB] Migration put failed:', err);
                  });
                } else {
                  // Merge with initialValue to ensure all required fields exist
                  const merged = { ...defaults, ...parsed };
                  setData(merged as T);
                  // Migrate to IndexedDB (don't wait, fire and forget)
                  table.put({ key: localStorageKey, value: merged }).catch((err) => {
                    // Log migration errors
                    logger.warn('[useIndexedDB] Migration merge put failed:', err);
                  });
                }
              } catch (parseError) {
                logger.warn('Failed to parse localStorage data for migration:', parseError);
              }
            }
          } catch (storageError) {
            // localStorage not available (Safari Private Mode, quota exceeded)
            logger.warn('localStorage not available:', storageError);
          }
        }
      } else {
        // For array tables - use timeout
        const records = await withTimeout(
          table.toArray(),
          INDEXEDDB_TIMEOUT_MS,
          [] as unknown[]
        );
        if (records.length > 0) {
          setData(records as T);
        } else if (isInitialLoad) {
          // Try localStorage fallback only on initial load
          try {
            const stored = localStorage.getItem(localStorageKey);
            if (stored) {
              try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  setData(parsed as T);
                  // Migrate to IndexedDB (don't wait, fire and forget)
                  table.bulkPut(parsed).catch((err) => {
                    // Log migration errors
                    logger.warn('[useIndexedDB] Migration bulkPut failed:', err);
                  });
                }
              } catch (parseError) {
                logger.warn('Failed to parse localStorage array data for migration:', parseError);
              }
            }
          } catch (storageError) {
            // localStorage not available (Safari Private Mode, quota exceeded)
            logger.warn('localStorage not available:', storageError);
          }
        }
      }
    } catch (error) {
      logger.error('Error loading from IndexedDB:', error);
      // Fallback to localStorage
      try {
        const stored = localStorage.getItem(localStorageKey);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            // Only merge objects, not primitives or arrays
            const isPrimitive = typeof parsed !== 'object' || parsed === null;
            const isArray = Array.isArray(parsed);
            if (isPrimitive || isArray) {
              // Don't merge primitives or arrays - just use the value directly
              setData(parsed as T);
            } else {
              // Merge with initialValue to ensure all required fields exist
              setData({ ...defaults, ...parsed } as T);
            }
          } catch (parseError) {
            logger.warn('Failed to parse localStorage fallback data:', parseError);
          }
        }
      } catch (storageError) {
        // localStorage not available (Safari Private Mode, quota exceeded)
        logger.warn('localStorage fallback not available:', storageError);
      }
    } finally {
      if (isInitialLoad) {
        setIsLoading(false);
        releaseInitLock();
      }
    }
  }, [table, localStorageKey, idField]);

  // Initial load
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    void loadData(true);
  }, [loadData]);

  // Track mounted state to prevent memory leaks and state updates after unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Subscribe to refresh events
  useEffect(() => {
    const handleRefresh = () => {
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setRefreshCounter(c => c + 1);
      }
    };
    refreshListeners.add(handleRefresh);
    return () => {
      refreshListeners.delete(handleRefresh);
    };
  }, []);

  // Reload data when refresh is triggered
  useEffect(() => {
    if (refreshCounter > 0) {
      void loadData(false);
    }
  }, [refreshCounter, loadData]);

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setData(prev => {
      const newValue = typeof value === 'function' 
        ? (value as (prev: T) => T)(prev) 
        : value;

      // Save to IndexedDB
      void (async () => {
        try {
          if (idField === 'key') {
            await table.put({ key: localStorageKey, value: newValue });
          } else if (Array.isArray(newValue)) {
            await table.clear();
            if (newValue.length > 0) {
              await table.bulkPut(newValue);
            }
          }
          // Also save to localStorage as backup
          try {
            localStorage.setItem(localStorageKey, JSON.stringify(newValue));
          } catch (storageError) {
            // localStorage not available (Safari Private Mode, quota exceeded)
            logger.warn('localStorage backup failed:', storageError);
          }
        } catch (error) {
          logger.error('Error saving to IndexedDB:', error);
          // Try localStorage fallback
          try {
            localStorage.setItem(localStorageKey, JSON.stringify(newValue));
          } catch (storageError) {
            // localStorage also not available - data only in React state
            logger.warn('localStorage fallback also failed:', storageError);
            // Emit storage error event for user notification
            window.dispatchEvent(new CustomEvent('zenflow:storage-error', {
              detail: {
                type: 'write_failed',
                message: 'Unable to save data. You may be in Private Mode or storage is full.',
                table,
              }
            }));
          }
        }
      })();

      return newValue;
    });
  }, [table, localStorageKey, idField]);

  return [data, setValue, isLoading];
}
