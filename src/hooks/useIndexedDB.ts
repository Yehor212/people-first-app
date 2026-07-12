import { useState, useEffect, useCallback, useRef } from "react";
import { Table } from "dexie";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { validateArray, validateObject } from "@/lib/schemas";
import { sanitizeObject } from "@/lib/validation";
import {
  safeJsonStringify,
  safeLocalStorageSet,
  storageGetRaw,
  storageRemove,
} from "@/lib/safeJson";
import { runWithOriginExclusiveLock } from "@/lib/originExclusiveLock";
import {
  advanceOriginAccountBoundaryGeneration,
  assertOriginAccountBoundaryGeneration,
  captureOriginAccountBoundaryGeneration,
  isAccountBoundaryChangedError,
  isOriginAccountBoundaryGenerationCurrent,
  runWithAccountBoundaryJournalWriteBarrier,
  subscribeOriginAccountBoundaryGeneration,
} from "@/storage/accountBoundaryRuntime";

// Event emitter for cross-hook data refresh
type RefreshListener = () => Promise<void>;
const refreshListeners = new Set<RefreshListener>();
const pendingDataWrites = new Set<Promise<unknown>>();
interface DeferredDataWrite {
  run: () => Promise<void>;
  discard: () => void;
}
const deferredDataWrites: DeferredDataWrite[] = [];
const staleAccountStateResets = new Set<() => void>();
let authoritativeMutationQueue: Promise<void> = Promise.resolve();
let pendingAuthoritativeMutations = 0;
let discardDeferredWritesOnQueueDrain = false;
// Invalidates reads that started before an account-boundary purge. A Dexie
// read cannot be aborted once dispatched, so stale results must be rejected
// before they can repopulate React state or the localStorage fallback.
let authoritativeReadGeneration = 0;
let acceptedOriginAccountBoundaryGeneration = captureOriginAccountBoundaryGeneration();

const DATA_WRITE_BARRIER_LOCK = "zenflow:data-write-barrier";

export function captureDataWriteBoundaryGeneration(): number {
  return authoritativeReadGeneration;
}

export function assertDataWriteBoundaryGeneration(expectedGeneration: number): void {
  if (authoritativeReadGeneration !== expectedGeneration) {
    throw new Error("Account boundary changed during the data operation");
  }
  assertOriginAccountBoundaryGeneration(acceptedOriginAccountBoundaryGeneration);
}

async function runWithAcceptedOriginDataWrite<T>(
  operation: () => Promise<T>,
  expectedGeneration = acceptedOriginAccountBoundaryGeneration
): Promise<T> {
  return runWithOriginExclusiveLock(DATA_WRITE_BARRIER_LOCK, async () => {
    assertOriginAccountBoundaryGeneration(expectedGeneration);
    return operation();
  });
}

function trackPendingDataWrite<T>(write: Promise<T>): Promise<T> {
  pendingDataWrites.add(write);
  void write.then(
    () => pendingDataWrites.delete(write),
    () => pendingDataWrites.delete(write)
  );
  return write;
}

async function flushPendingDataWrites(): Promise<void> {
  while (pendingDataWrites.size > 0) {
    await Promise.all([...pendingDataWrites]);
  }
}

function structurallyEqual(first: unknown, second: unknown): boolean {
  if (Object.is(first, second)) return true;
  try {
    return JSON.stringify(first) === JSON.stringify(second);
  } catch {
    return false;
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function flushDeferredDataWrites(): Promise<void> {
  while (deferredDataWrites.length > 0) {
    const batch = deferredDataWrites.splice(0);
    for (const write of batch) {
      await write.run();
    }
  }
}

function discardDeferredDataWrites(): void {
  const batch = deferredDataWrites.splice(0);
  for (const write of batch) {
    write.discard();
  }
}

subscribeOriginAccountBoundaryGeneration((generation) => {
  // A storage event is delivered only to other realms. Ignore an equivalent
  // synthetic event in the realm that already accepted this generation (tests,
  // embedded shells), but immediately invalidate every stale mounted hook.
  if (generation === acceptedOriginAccountBoundaryGeneration) return;
  authoritativeReadGeneration += 1;
  discardDeferredDataWrites();
  for (const reset of staleAccountStateResets) reset();
});

interface DataWriteBarrierOptions {
  /** Account/device purges drop writes attempted while old data is being removed. */
  deferredWrites?: "replay" | "discard";
}

/**
 * Serializes an authoritative storage mutation (for example Replace import)
 * behind every write that was already accepted by a mounted data hook.
 * React writes attempted while the mutation is pending are converted into
 * field/item patches and replayed over the authoritative result before one
 * final refresh. This preserves remote additions without silently losing a
 * user action that happened during sync.
 */
export async function runWithDataWriteBarrier<T>(
  mutation: () => Promise<T>,
  options: DataWriteBarrierOptions = {}
): Promise<T> {
  let releaseTurn!: () => void;
  const turnDone = new Promise<void>((resolve) => {
    releaseTurn = resolve;
  });
  const previousTurn = authoritativeMutationQueue;
  authoritativeMutationQueue = previousTurn.catch(() => undefined).then(() => turnDone);
  pendingAuthoritativeMutations += 1;
  if (options.deferredWrites === "discard") {
    authoritativeReadGeneration += 1;
    discardDeferredWritesOnQueueDrain = true;
  }

  await previousTurn.catch(() => undefined);

  let finalized = false;
  const finalizeBarrier = async () => {
    if (finalized) return;
    finalized = true;
    const isLastQueuedMutation = pendingAuthoritativeMutations === 1;
    try {
      if (isLastQueuedMutation) {
        if (discardDeferredWritesOnQueueDrain) {
          discardDeferredDataWrites();
        } else {
          await flushDeferredDataWrites();
        }
      }
    } finally {
      pendingAuthoritativeMutations -= 1;
      if (pendingAuthoritativeMutations === 0) {
        discardDeferredWritesOnQueueDrain = false;
      }
      try {
        if (isLastQueuedMutation) {
          await triggerDataRefresh();
        }
      } finally {
        releaseTurn();
      }
    }
  };

  try {
    // Pending same-realm writes now acquire DATA themselves. Drain them before
    // requesting DATA or the barrier would wait on a write waiting on this lock.
    await flushPendingDataWrites();
    return await runWithOriginExclusiveLock(DATA_WRITE_BARRIER_LOCK, async () => {
      if (options.deferredWrites === "discard") {
        acceptedOriginAccountBoundaryGeneration = advanceOriginAccountBoundaryGeneration();
        try {
          return await runWithAccountBoundaryJournalWriteBarrier(async () => {
            try {
              return await mutation();
            } finally {
              // Account cleanup keeps DATA and JOURNAL until mounted state has
              // adopted the cleared/bound owner snapshot.
              await finalizeBarrier();
            }
          });
        } catch (error) {
          await finalizeBarrier();
          throw error;
        }
      }

      assertOriginAccountBoundaryGeneration(acceptedOriginAccountBoundaryGeneration);
      try {
        return await mutation();
      } finally {
        // Keep the origin-wide lock until deferred writes and the mounted-state
        // refresh are complete. Otherwise another tab could purge data and a
        // deferred old-account write could replay after that purge.
        await finalizeBarrier();
      }
    });
  } finally {
    // A Web Locks implementation can reject before invoking its callback.
    // Always release the in-process queue and generation state in that case.
    await finalizeBarrier();
  }
}

export const triggerDataRefresh = async (): Promise<void> => {
  logger.log("[useIndexedDB] Triggering data refresh for all hooks");
  await Promise.all([...refreshListeners].map((listener) => listener()));
};

// Timeout for IndexedDB operations (30s — exportBackup reads 7 tables in one
// Dexie transaction which can take 10-20s on Android, blocking other hooks)
const INDEXEDDB_TIMEOUT_MS = 30000;

const sanitizeStoredValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) =>
      item !== null && typeof item === "object"
        ? sanitizeObject(item as Record<string, unknown>)
        : item
    );
  }
  if (value !== null && typeof value === "object") {
    return sanitizeObject(value as Record<string, unknown>);
  }
  return value;
};

interface TimeoutResult<T> {
  value: T;
  timedOut: boolean;
}

// Helper to add timeout to promises
// P2-3 Fix: Emit event when timeout occurs so UI can show stale data warning
const withTimeoutResult = <T>(
  promise: Promise<T>,
  ms: number,
  fallback: T
): Promise<TimeoutResult<T>> => {
  let timerId: ReturnType<typeof setTimeout> | null = null;
  return Promise.race([
    promise.then((value) => ({ value, timedOut: false })),
    new Promise<TimeoutResult<T>>((resolve) => {
      timerId = setTimeout(() => {
        logger.warn(`[useIndexedDB] Operation timed out after ${ms}ms, using fallback`);
        // P2-3 Fix: Emit event so UI can optionally show "data may be stale" indicator
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("zenflow:indexeddb-timeout", {
              detail: {
                timeoutMs: ms,
                message: "IndexedDB operation timed out, using cached data",
              },
            })
          );
        }
        resolve({ value: fallback, timedOut: true });
      }, ms);
    }),
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
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("zenflow:indexeddb-queue-overflow", {
            detail: { queueSize: initQueue.length },
          })
        );
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
            await new Promise((r) => setTimeout(r, 10));
          }
        } catch (error) {
          logger.error("[useIndexedDB] Error during queue flush:", error);
          // Emit error event so UI can handle
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("zenflow:storage-error", {
                detail: { type: "queue_flush_failed", message: "Database queue flush failed" },
              })
            );
          }
        } finally {
          // Always release lock even on error to prevent permanent deadlock
          globalInitLock = false;
          isFlushingQueue = false;
        }
      };
      // Track flush promise with proper error handling (no fire-and-forget)
      flushQueue().catch((err) => {
        // graceful: inner try/catch already dispatches zenflow:storage-error for UI
        logger.error("[useIndexedDB] Unhandled flush error:", err);
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
  /** Filters migrated localStorage fallback rows, e.g. to remove tombstoned entities. */
  fallbackArrayFilter?: (items: unknown[]) => Promise<unknown[]> | unknown[];
}

export function useIndexedDB<T>({
  table,
  localStorageKey,
  initialValue,
  idField = "id",
  itemSchema,
  objectSchema,
  fallbackArrayFilter,
}: UseIndexedDBOptions<T>): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const [data, setData] = useState<T>(initialValue);
  const [isLoading, setIsLoading] = useState(true);
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
  const pendingWriteRef = useRef<Promise<void>>(Promise.resolve());
  const deferredValueRef = useRef<{ value: T } | null>(null);
  const deferredSequenceRef = useRef(0);
  const loadSequenceRef = useRef(0);

  // Schemas are stable across renders (defined at module level), so store in refs
  // to prevent applyValidation → loadData → refresh effect from re-triggering on every render.
  const itemSchemaRef = useRef(itemSchema);
  const objectSchemaRef = useRef(objectSchema);
  const fallbackArrayFilterRef = useRef(fallbackArrayFilter);

  // Apply schema validation if provided (otherwise passthrough)
  const applyValidation = useCallback(
    (raw: unknown): T | null => {
      if (itemSchemaRef.current && Array.isArray(raw)) {
        return validateArray(itemSchemaRef.current, raw, localStorageKey) as T;
      }
      if (objectSchemaRef.current && !Array.isArray(raw)) {
        return validateObject(objectSchemaRef.current, raw, localStorageKey) as T | null;
      }
      return raw as T;
    },
    [localStorageKey]
  );

  // Load data function (used both on init and refresh)
  const loadData = useCallback(
    async (isInitialLoad = false) => {
      const defaults = initialValueRef.current;
      const loadSequence = loadSequenceRef.current + 1;
      loadSequenceRef.current = loadSequence;
      const readGeneration = authoritativeReadGeneration;
      const canCommitRead = () =>
        isMountedRef.current &&
        loadSequenceRef.current === loadSequence &&
        authoritativeReadGeneration === readGeneration &&
        isOriginAccountBoundaryGenerationCurrent(acceptedOriginAccountBoundaryGeneration);
      const commitRead = (nextValue: T, persistFallback = true): boolean => {
        if (!canCommitRead()) return false;
        setData(nextValue);
        const serializedFallback = persistFallback ? safeJsonStringify(nextValue) : null;
        if (persistFallback && !safeLocalStorageSet(localStorageKey, nextValue)) {
          logger.warn("localStorage backup failed while refreshing data");
        }
        if (!canCommitRead()) {
          // Do not delete a newer account's fallback if it replaced this value
          // between the pre-write and post-write generation checks.
          if (
            serializedFallback !== null &&
            storageGetRaw(localStorageKey, "") === serializedFallback
          ) {
            storageRemove(localStorageKey);
          }
          return false;
        }
        return true;
      };

      // Acquire lock for initial load to prevent race conditions
      if (isInitialLoad) {
        await acquireInitLock();
      }

      try {
        // For settings table with key field
        if (idField === "key") {
          // Use timeout to prevent hanging on IndexedDB operations
          const { value: record, timedOut } = await withTimeoutResult(
            table.get(localStorageKey),
            INDEXEDDB_TIMEOUT_MS,
            undefined
          );
          if (record?.value !== undefined) {
            // Only merge objects, not primitives (strings, booleans, numbers) or arrays
            // Spreading primitives or arrays creates objects with numeric keys which breaks React rendering
            const isPrimitive = typeof record.value !== "object" || record.value === null;
            const isArray = Array.isArray(record.value);
            if (isPrimitive || isArray) {
              // Don't merge primitives or arrays - just use the value directly
              const validated = applyValidation(record.value);
              const nextValue = validated !== null ? validated : defaults;
              commitRead(nextValue);
            } else {
              // Merge with initialValue to ensure all required fields exist (handles schema migrations)
              const merged = { ...defaults, ...record.value };
              const validated = applyValidation(merged);
              const nextValue = validated !== null ? validated : defaults;
              commitRead(nextValue);
            }
          } else if (isInitialLoad) {
            // Try localStorage fallback only on initial load
            try {
              const stored = storageGetRaw(localStorageKey, "");
              if (stored) {
                try {
                  const parsed = sanitizeStoredValue(JSON.parse(stored));
                  // Only merge objects, not primitives or arrays
                  const isPrimitive = typeof parsed !== "object" || parsed === null;
                  const isArray = Array.isArray(parsed);
                  if (isPrimitive || isArray) {
                    // Don't merge primitives or arrays - just use the value directly
                    const validated = applyValidation(parsed);
                    if (!commitRead(validated !== null ? validated : defaults, false)) return;
                    void trackPendingDataWrite(
                      runWithAcceptedOriginDataWrite(() =>
                        table.put({ key: localStorageKey, value: parsed })
                      ).catch((err) => {
                        // Log migration errors
                        logger.warn("[useIndexedDB] Migration put failed:", err);
                      })
                    );
                  } else {
                    // Merge with initialValue to ensure all required fields exist
                    const merged = { ...defaults, ...parsed };
                    const validated = applyValidation(merged);
                    if (!commitRead(validated !== null ? validated : defaults, false)) return;
                    // Migrate to IndexedDB (don't wait, fire and forget)
                    void trackPendingDataWrite(
                      runWithAcceptedOriginDataWrite(() =>
                        table.put({ key: localStorageKey, value: merged })
                      ).catch((err) => {
                        // Log migration errors
                        logger.warn("[useIndexedDB] Migration merge put failed:", err);
                      })
                    );
                  }
                } catch (parseError) {
                  logger.warn("Failed to parse localStorage data for migration:", parseError);
                }
              }
            } catch (storageError) {
              // localStorage not available (Safari Private Mode, quota exceeded)
              logger.warn("localStorage not available:", storageError);
            }
          } else if (!timedOut) {
            commitRead(defaults);
          }
        } else {
          // For array tables - use timeout
          const { value: records, timedOut } = await withTimeoutResult(
            table.toArray(),
            INDEXEDDB_TIMEOUT_MS,
            [] as unknown[]
          );
          if (records.length > 0) {
            const validated = applyValidation(records);
            const nextValue = validated !== null ? validated : defaults;
            commitRead(nextValue);
          } else if (isInitialLoad) {
            // Try localStorage fallback only on initial load
            try {
              const stored = storageGetRaw(localStorageKey, "");
              if (stored) {
                try {
                  const parsed = sanitizeStoredValue(JSON.parse(stored));
                  if (Array.isArray(parsed) && parsed.length > 0) {
                    const filtered = fallbackArrayFilterRef.current
                      ? await fallbackArrayFilterRef.current(parsed)
                      : parsed;
                    const validated = applyValidation(filtered);
                    const nextValue = validated !== null ? validated : defaults;
                    if (!commitRead(nextValue, false)) return;
                    // Migrate to IndexedDB (don't wait, fire and forget)
                    if (Array.isArray(filtered) && filtered.length > 0) {
                      void trackPendingDataWrite(
                        runWithAcceptedOriginDataWrite(() => table.bulkPut(filtered)).catch((err) => {
                          // Log migration errors
                          logger.warn("[useIndexedDB] Migration bulkPut failed:", err);
                        })
                      );
                    }
                    if (canCommitRead()) {
                      const serializedFallback = safeJsonStringify(nextValue);
                      if (!safeLocalStorageSet(localStorageKey, nextValue)) {
                        logger.warn("localStorage backup failed while migrating array fallback");
                      }
                      if (
                        !canCommitRead() &&
                        serializedFallback !== null &&
                        storageGetRaw(localStorageKey, "") === serializedFallback
                      ) {
                        storageRemove(localStorageKey);
                      }
                    }
                  }
                } catch (parseError) {
                  logger.warn("Failed to parse localStorage array data for migration:", parseError);
                }
              }
            } catch (storageError) {
              // localStorage not available (Safari Private Mode, quota exceeded)
              logger.warn("localStorage not available:", storageError);
            }
          } else if (!timedOut) {
            commitRead(defaults);
          }
        }
      } catch (error) {
        logger.error("Error loading from IndexedDB:", error);
        // Fallback to localStorage
        try {
          const stored = storageGetRaw(localStorageKey, "");
          if (stored) {
            try {
              const parsed = sanitizeStoredValue(JSON.parse(stored));
              // Only merge objects, not primitives or arrays
              const isPrimitive = typeof parsed !== "object" || parsed === null;
              const isArray = Array.isArray(parsed);
              if (isPrimitive || isArray) {
                // Don't merge primitives or arrays - just use the value directly
                const validated = applyValidation(parsed);
                commitRead(validated !== null ? validated : defaults, false);
              } else {
                // Merge with initialValue to ensure all required fields exist
                const merged = { ...defaults, ...parsed };
                const validated = applyValidation(merged);
                commitRead(validated !== null ? validated : defaults, false);
              }
            } catch (parseError) {
              logger.warn("Failed to parse localStorage fallback data:", parseError);
            }
          }
        } catch (storageError) {
          // localStorage not available (Safari Private Mode, quota exceeded)
          logger.warn("localStorage fallback not available:", storageError);
        }
      } finally {
        if (isInitialLoad) {
          if (isMountedRef.current) setIsLoading(false);
          releaseInitLock();
        }
      }
    },
    [table, localStorageKey, idField, applyValidation]
  );

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
    const handleRefresh = async () => {
      if (!isMountedRef.current) return;

      let observedWrite: Promise<void>;
      do {
        observedWrite = pendingWriteRef.current;
        await observedWrite;
      } while (observedWrite !== pendingWriteRef.current);

      if (isMountedRef.current) {
        await loadData(false);
      }
    };
    refreshListeners.add(handleRefresh);
    return () => {
      refreshListeners.delete(handleRefresh);
    };
  }, [loadData]);

  const resetStaleAccountState = useCallback(() => {
    // The optimistic React update belongs to an expired account realm. Never
    // keep displaying it after durable persistence has been rejected.
    loadSequenceRef.current += 1;
    deferredSequenceRef.current += 1;
    deferredValueRef.current = null;
    if (isMountedRef.current) setData(initialValueRef.current);
  }, []);

  useEffect(() => {
    staleAccountStateResets.add(resetStaleAccountState);
    return () => {
      staleAccountStateResets.delete(resetStaleAccountState);
    };
  }, [resetStaleAccountState]);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setData((prev) => {
        const previousValue =
          pendingAuthoritativeMutations > 0 && deferredValueRef.current
            ? deferredValueRef.current.value
            : prev;
        const newValue =
          typeof value === "function" ? (value as (prev: T) => T)(previousValue) : value;

        if (pendingAuthoritativeMutations > 0) {
          logger.warn("[useIndexedDB] Deferring a write while authoritative data is being applied");
          const deferredSequence = deferredSequenceRef.current + 1;
          deferredSequenceRef.current = deferredSequence;
          deferredValueRef.current = { value: newValue };
          const clearDeferredShadow = () => {
            if (deferredSequenceRef.current === deferredSequence) {
              deferredValueRef.current = null;
            }
          };

          if (idField === "key") {
            const isObjectPatch = isPlainRecord(previousValue) && isPlainRecord(newValue);
            const removedKeys = isObjectPatch
              ? Object.keys(previousValue).filter((key) => !(key in newValue))
              : [];
            const changedEntries = isObjectPatch
              ? Object.entries(newValue).filter(
                  ([key, entryValue]) => !structurallyEqual(previousValue[key], entryValue)
                )
              : [];

            deferredDataWrites.push({
              run: async () => {
                try {
                  let replayValue: unknown = newValue;
                  if (isObjectPatch) {
                    const currentRecord = await table.get(localStorageKey);
                    const currentValue = isPlainRecord(currentRecord?.value)
                      ? currentRecord.value
                      : {};
                    const patchedValue: Record<string, unknown> = { ...currentValue };
                    for (const key of removedKeys) delete patchedValue[key];
                    for (const [key, entryValue] of changedEntries) {
                      patchedValue[key] = entryValue;
                    }
                    replayValue = patchedValue;
                  }

                  await table.put({ key: localStorageKey, value: replayValue });
                  if (!safeLocalStorageSet(localStorageKey, replayValue)) {
                    logger.warn("localStorage backup failed");
                  }
                } catch (error) {
                  logger.error("Error replaying deferred IndexedDB setting:", error);
                  throw error;
                } finally {
                  clearDeferredShadow();
                }
              },
              discard: clearDeferredShadow,
            });
          } else if (Array.isArray(previousValue) && Array.isArray(newValue)) {
            const keyFor = (item: unknown): string | null => {
              if (!item || typeof item !== "object") return null;
              const key = (item as Record<string, unknown>)[idField];
              return typeof key === "string" && key.length > 0 ? key : null;
            };
            const previousByKey = new Map(
              previousValue
                .map((item) => [keyFor(item), item] as const)
                .filter((entry): entry is readonly [string, unknown] => entry[0] !== null)
            );
            const nextByKey = new Map(
              newValue
                .map((item) => [keyFor(item), item] as const)
                .filter((entry): entry is readonly [string, unknown] => entry[0] !== null)
            );
            const removedKeys = [...previousByKey.keys()].filter((key) => !nextByKey.has(key));
            const changedItems = [...nextByKey.entries()]
              .filter(([key, item]) => !structurallyEqual(previousByKey.get(key), item))
              .map(([, item]) => item);

            deferredDataWrites.push({
              run: async () => {
                try {
                  await table.db.transaction("rw", table, async () => {
                    if (removedKeys.length > 0) await table.bulkDelete(removedKeys);
                    if (changedItems.length > 0) await table.bulkPut(changedItems);
                  });
                  const authoritativeValue = await table.toArray();
                  if (!safeLocalStorageSet(localStorageKey, authoritativeValue)) {
                    logger.warn("localStorage backup failed");
                  }
                } catch (error) {
                  logger.error("Error replaying deferred IndexedDB collection patch:", error);
                  throw error;
                } finally {
                  clearDeferredShadow();
                }
              },
              discard: clearDeferredShadow,
            });
          } else {
            clearDeferredShadow();
            logger.error("[useIndexedDB] Deferred write has no safe patch contract");
          }

          return prev;
        }

        const writeOperation = async () => {
          const writeGeneration = acceptedOriginAccountBoundaryGeneration;
          try {
            await runWithAcceptedOriginDataWrite(
              async () => {
                if (idField === "key") {
                  await table.put({ key: localStorageKey, value: newValue });
                } else if (Array.isArray(newValue)) {
                  await table.db.transaction("rw", table, async () => {
                    await table.clear();
                    if (newValue.length > 0) {
                      await table.bulkPut(newValue);
                    }
                  });
                }
                // Also save to localStorage as backup while DATA is still held.
                if (!safeLocalStorageSet(localStorageKey, newValue)) {
                  logger.warn("localStorage backup failed");
                }
              },
              writeGeneration
            );
          } catch (error) {
            if (isAccountBoundaryChangedError(error)) {
              logger.warn("[useIndexedDB] Discarded a stale write after an account change");
              resetStaleAccountState();
              return;
            }
            logger.error("Error saving to IndexedDB:", error);
            try {
              // The IndexedDB lock has been released. Reacquire DATA and assert
              // the exact generation accepted by this write before fallback;
              // a suspended old tab must not repopulate localStorage after purge.
              await runWithAcceptedOriginDataWrite(
                async () => {
                  if (safeLocalStorageSet(localStorageKey, newValue)) return;
                  logger.warn("localStorage fallback also failed");
                  window.dispatchEvent(
                    new CustomEvent("zenflow:storage-error", {
                      detail: {
                        type: "write_failed",
                        message:
                          "Unable to save data. You may be in Private Mode or storage is full.",
                        table,
                      },
                    })
                  );
                },
                writeGeneration
              );
            } catch (fallbackError) {
              if (isAccountBoundaryChangedError(fallbackError)) {
                logger.warn(
                  "[useIndexedDB] Discarded a stale fallback write after an account change"
                );
                resetStaleAccountState();
                return;
              }
              logger.error("Error saving the localStorage fallback:", fallbackError);
              window.dispatchEvent(
                new CustomEvent("zenflow:storage-error", {
                  detail: {
                    type: "write_failed",
                    message: "Unable to save data. You may be in Private Mode or storage is full.",
                    table,
                  },
                })
              );
            }
          }
        };

        // Serialize writes so an awaited refresh can never read between two pending
        // state writes and resurrect stale pre-import or pre-sync data.
        const pendingWrite = trackPendingDataWrite(pendingWriteRef.current.then(writeOperation));
        pendingWriteRef.current = pendingWrite;
        void pendingWrite;

        return newValue;
      });
    },
    [table, localStorageKey, idField, resetStaleAccountState]
  );

  return [data, setValue, isLoading];
}
