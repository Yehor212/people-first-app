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

// P0 Fix: Timeout for IndexedDB operations (10 seconds, increased from 5s for slow devices)
const INDEXEDDB_TIMEOUT_MS = 10000;

// Helper to add timeout to promises
const withTimeout = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(() => {
        logger.warn(`[useIndexedDB] Operation timed out after ${ms}ms, using fallback`);
        resolve(fallback);
      }, ms);
    })
  ]);
};

// Global initialization lock to prevent race conditions
let globalInitLock = false;
const initQueue: Array<() => void> = [];
let lockTimeout: ReturnType<typeof setTimeout> | null = null;

const acquireInitLock = async (): Promise<void> => {
  return new Promise((resolve) => {
    if (!globalInitLock) {
      globalInitLock = true;
      // P0 Fix: Auto-release lock after 30 seconds to prevent deadlock
      // Increased from 10s to handle slow IndexedDB initialization on low-end Android devices
      lockTimeout = setTimeout(() => {
        logger.warn('[useIndexedDB] Lock timeout (30s) - force releasing');
        releaseInitLock();
      }, 30000);
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
    next();
  } else {
    globalInitLock = false;
  }
};

interface UseIndexedDBOptions<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                  table.put({ key: localStorageKey, value: parsed }).catch(() => {});
                } else {
                  // Merge with initialValue to ensure all required fields exist
                  const merged = { ...defaults, ...parsed };
                  setData(merged as T);
                  // Migrate to IndexedDB (don't wait, fire and forget)
                  table.put({ key: localStorageKey, value: merged }).catch(() => {});
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
                  table.bulkPut(parsed).catch(() => {});
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
    loadData(true);
  }, [loadData]);

  // Subscribe to refresh events
  useEffect(() => {
    const handleRefresh = () => {
      setRefreshCounter(c => c + 1);
    };
    refreshListeners.add(handleRefresh);
    return () => {
      refreshListeners.delete(handleRefresh);
    };
  }, []);

  // Reload data when refresh is triggered
  useEffect(() => {
    if (refreshCounter > 0) {
      loadData(false);
    }
  }, [refreshCounter, loadData]);

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setData(prev => {
      const newValue = typeof value === 'function' 
        ? (value as (prev: T) => T)(prev) 
        : value;

      // Save to IndexedDB
      (async () => {
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
          }
        }
      })();

      return newValue;
    });
  }, [table, localStorageKey, idField]);

  return [data, setValue, isLoading];
}
