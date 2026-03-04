import { useState, useEffect, useCallback, useRef } from 'react';
import { Table } from 'dexie';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { validateArray, validateObject } from '@/lib/schemas';

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
  let timerId: ReturnType<typeof setTimeout> | null = null;
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      timerId = setTimeout(() => {
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
  ]).finally(() => {
    if (timerId !== null) clearTimeout(timerId);
  });
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
  /** Schema for validating individual array items (when T extends unknown[]) */
  itemSchema?: z.ZodType<any>;
  /** Schema for validating single object values (when using idField='key') */
  objectSchema?: z.ZodType<any>;
}

export function useIndexedDB<T>({
  table,
  localStorageKey,
  initialValue,
  idField = 'id',
  itemSchema,
  objectSchema,
}: UseIndexedDBOptions<T>): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const [data, setData] = useState<T>(initialValue);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const initializedRef = useRef(false);
  // Store initialValue in ref to avoid dependency issues (it's only used on first load)
  const initialValueRef = useRef(initialValue);
  // Track mounted state to prevent memory leaks
  const isMountedRef = useRef(true);
  // Track pending IndexedDB writes to prevent stale reads from overwriting fresh state.
  // When setValue fires an async write, Zustand/React state is the source of truth until
  // the write completes. If triggerDataRefresh() fires during this window (e.g. from
  // visibilitychange → cloud sync), loadData would read stale IndexedDB data and
  // overwrite the correct React state — resurrecting deleted items.
  const writePendingRef = useRef(false);

  // Schemas are stable across renders (defined at module level), so store in refs
  // to prevent applyValidation → loadData → refresh effect from re-triggering on every render.
  const itemSchemaRef = useRef(itemSchema);
  const objectSchemaRef = useRef(objectSchema);

  // Apply schema validation if provided (otherwise passthrough)
  const applyValidation = useCallback((raw: unknown): T | null => {
    if (itemSchemaRef.current && Array.isArray(raw)) {
      return validateArray(itemSchemaRef.current, raw, localStorageKey) as T;
    }
    if (objectSchemaRef.current && !Array.isArray(raw)) {
      return validateObject(objectSchemaRef.current, raw, localStorageKey) as T | null;
    }
    return raw as T;
  }, [localStorageKey]);

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
            const validated = applyValidation(record.value);
            setData(validated !== null ? validated : defaults);
          } else {
            // Merge with initialValue to ensure all required fields exist (handles schema migrations)
            const merged = { ...defaults, ...record.value };
            const validated = applyValidation(merged);
            setData(validated !== null ? validated : defaults);
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
                  const validated = applyValidation(parsed);
                  setData(validated !== null ? validated : defaults);
                  table.put({ key: localStorageKey, value: parsed }).catch((err) => {
                    // Log migration errors
                    logger.warn('[useIndexedDB] Migration put failed:', err);
                  });
                } else {
                  // Merge with initialValue to ensure all required fields exist
                  const merged = { ...defaults, ...parsed };
                  const validated = applyValidation(merged);
                  setData(validated !== null ? validated : defaults);
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
          const validated = applyValidation(records);
          setData(validated !== null ? validated : defaults);
        } else if (isInitialLoad) {
          // Try localStorage fallback only on initial load
          try {
            const stored = localStorage.getItem(localStorageKey);
            if (stored) {
              try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  const validated = applyValidation(parsed);
                  setData(validated !== null ? validated : defaults);
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
              const validated = applyValidation(parsed);
              setData(validated !== null ? validated : defaults);
            } else {
              // Merge with initialValue to ensure all required fields exist
              const merged = { ...defaults, ...parsed };
              const validated = applyValidation(merged);
              setData(validated !== null ? validated : defaults);
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
  }, [table, localStorageKey, idField, applyValidation]);

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
      // If an IndexedDB write is in progress, skip this reload.
      // React/Zustand state is already up-to-date (setValue updates it synchronously),
      // and reading from IndexedDB now would return stale pre-write data — resurrecting
      // deleted items or reverting edits.
      if (writePendingRef.current) {
        logger.log(`[useIndexedDB] Skipping refresh for "${localStorageKey}" — write pending`);
        return;
      }
      void loadData(false);
    }
  }, [refreshCounter, loadData, localStorageKey]);

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setData(prev => {
      const newValue = typeof value === 'function'
        ? (value as (prev: T) => T)(prev)
        : value;

      // Mark write as pending BEFORE the async operation starts.
      // This prevents triggerDataRefresh() from reading stale IndexedDB data
      // while the write is in flight (e.g. habit deletion + immediate tab switch).
      writePendingRef.current = true;

      // Save to IndexedDB
      void (async () => {
        try {
          if (idField === 'key') {
            await table.put({ key: localStorageKey, value: newValue });
          } else if (Array.isArray(newValue)) {
            await table.db.transaction('rw', table, async () => {
              await table.clear();
              if (newValue.length > 0) {
                await table.bulkPut(newValue);
              }
            });
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
        } finally {
          // Write completed (or failed) — safe to allow refreshes again.
          writePendingRef.current = false;
        }
      })();

      return newValue;
    });
  }, [table, localStorageKey, idField]);

  return [data, setValue, isLoading];
}
