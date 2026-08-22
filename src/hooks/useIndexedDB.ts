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
  ACCOUNT_BOUNDARY_DATA_WRITE_LOCK,
  AccountBoundaryChangedError,
  advanceOriginAccountBoundaryGeneration,
  assertOriginAccountBoundaryGeneration,
  captureOriginAccountBoundaryGeneration,
  isAccountBoundaryChangedError,
  isOriginAccountBoundaryGenerationCurrent,
  runWithAccountBoundaryJournalWriteBarrier,
  subscribeOriginAccountBoundaryGeneration,
  type OriginAccountBoundaryGeneration,
} from "@/storage/accountBoundaryRuntime";

// Event emitter for cross-hook data refresh
type RefreshListener = (signal: AbortSignal) => Promise<void>;
const refreshListeners = new Set<RefreshListener>();
const pendingDataWrites = new Set<Promise<unknown>>();
interface DeferredDataWrite {
  originGeneration: OriginAccountBoundaryGeneration;
  run: () => Promise<void>;
  discard: () => void;
}
const deferredDataWrites: DeferredDataWrite[] = [];
const staleAccountStateResets = new Set<() => void>();
let authoritativeMutationQueue: Promise<void> = Promise.resolve();
let pendingAuthoritativeMutations = 0;
let discardDeferredWritesOnQueueDrain = false;
let rejectRefreshFailureOnQueueDrain = false;
// Invalidates reads that started before an account-boundary purge. A Dexie
// read cannot be aborted once dispatched, so stale results must be rejected
// before they can repopulate React state or the localStorage fallback.
let authoritativeReadGeneration = 0;
let acceptedOriginAccountBoundaryGeneration = captureOriginAccountBoundaryGeneration();

const DATA_WRITE_BARRIER_LOCK = ACCOUNT_BOUNDARY_DATA_WRITE_LOCK;
const MAX_DATA_REFRESH_QUIESCENCE_PASSES = 8;
/**
 * A mounted single-table refresh gets 25s, then yields the origin-wide DATA
 * lock before the hook's broader 30s fallback. Slow refreshes surface the
 * existing generation-guarded Refresh recovery instead of blocking all writes.
 */
export const DATA_REFRESH_LISTENER_TIMEOUT_MS = 25_000;

export type DataWriteBarrierPostCommitIssueKind =
  | "deferred-write-replay"
  | "mounted-refresh";

const dataWriteBarrierPostCommitErrors = new WeakSet<object>();
const DATA_WRITE_BARRIER_POST_COMMIT_ISSUE_KINDS = new Set<
  DataWriteBarrierPostCommitIssueKind
>(["deferred-write-replay", "mounted-refresh"]);

/**
 * The authoritative mutation returned successfully, but one or more bounded
 * finalization steps did not. `committedValue` is the exact value returned by
 * the mutation, never a reconstructed readback from a potentially newer owner.
 */
export class DataWriteBarrierPostCommitError<T> extends Error {
  readonly code = "DATA_WRITE_BARRIER_POST_COMMIT";
  readonly committedValue: T;
  readonly capturedOriginGeneration: OriginAccountBoundaryGeneration;
  readonly issueKinds: readonly DataWriteBarrierPostCommitIssueKind[];

  constructor(
    committedValue: T,
    capturedOriginGeneration: OriginAccountBoundaryGeneration,
    issueKinds: readonly DataWriteBarrierPostCommitIssueKind[],
  ) {
    super("The data mutation committed, but post-commit finalization was incomplete");
    this.name = "DataWriteBarrierPostCommitError";
    this.committedValue = committedValue;
    this.capturedOriginGeneration = capturedOriginGeneration;
    this.issueKinds = Object.freeze([...issueKinds]);
    dataWriteBarrierPostCommitErrors.add(this);
  }
}

export function isDataWriteBarrierPostCommitError<T = unknown>(
  error: unknown,
): error is DataWriteBarrierPostCommitError<T> {
  if (
    !(error instanceof Error) ||
    !dataWriteBarrierPostCommitErrors.has(error)
  ) {
    return false;
  }

  const candidate = error as DataWriteBarrierPostCommitError<T>;
  return (
    candidate.code === "DATA_WRITE_BARRIER_POST_COMMIT" &&
    Object.prototype.hasOwnProperty.call(candidate, "committedValue") &&
    typeof candidate.capturedOriginGeneration === "string" &&
    candidate.capturedOriginGeneration.length > 0 &&
    Array.isArray(candidate.issueKinds) &&
    candidate.issueKinds.length > 0 &&
    candidate.issueKinds.every((kind) =>
      DATA_WRITE_BARRIER_POST_COMMIT_ISSUE_KINDS.has(kind)
    )
  );
}

export function captureDataWriteBoundaryGeneration(): number {
  return authoritativeReadGeneration;
}

export function isDataWriteBarrierPending(): boolean {
  return pendingAuthoritativeMutations > 0;
}

export type PendingDataWriteBarrierMode = "none" | "replay" | "discard";

/**
 * Distinguishes a normal authoritative mutation, behind which user actions
 * must serialize, from an account-boundary purge that must discard actions
 * accepted by the expiring account realm.
 */
export function getPendingDataWriteBarrierMode(): PendingDataWriteBarrierMode {
  if (pendingAuthoritativeMutations === 0) return "none";
  return discardDeferredWritesOnQueueDrain ? "discard" : "replay";
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

async function drainDeferredDataWrites(): Promise<DataWriteBarrierPostCommitIssueKind[]> {
  const issues: DataWriteBarrierPostCommitIssueKind[] = [];
  while (deferredDataWrites.length > 0) {
    const batch = deferredDataWrites.splice(0);
    for (const write of batch) {
      if (!isOriginAccountBoundaryGenerationCurrent(write.originGeneration)) {
        write.discard();
        logger.warn(
          "[useIndexedDB] Discarded a deferred write from an expired account generation",
        );
        continue;
      }
      try {
        assertOriginAccountBoundaryGeneration(write.originGeneration);
        await write.run();
        assertOriginAccountBoundaryGeneration(write.originGeneration);
      } catch (error) {
        // A stale deferred patch cannot be replayed safely later: a newer user
        // action or account generation may already exist. Record the incident,
        // clear its optimistic shadow, and continue so later patches are still
        // attempted exactly once.
        issues.push("deferred-write-replay");
        write.discard();
        logger.error("[useIndexedDB] Deferred data-write replay failed:", error);
      }
    }
  }
  return issues;
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
  /**
   * Runs under the origin-wide DATA lock, immediately before a discard purge
   * advances the account generation. Use this for fail-closed owner checks
   * that must inspect the expiring realm without nesting another DATA lock.
   */
  beforeAccountBoundaryAdvance?: () => void | Promise<void>;
  /** Exact expiring realm required when a pre-advance owner check is supplied. */
  expectedAccountBoundaryGeneration?: OriginAccountBoundaryGeneration;
  /** Durable callers may log a post-commit mounted-refresh failure without lying about the commit. */
  refreshFailure?: "reject" | "log";
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
  const requestedOriginGeneration = acceptedOriginAccountBoundaryGeneration;
  const hasBoundaryPrecondition =
    options.beforeAccountBoundaryAdvance !== undefined ||
    options.expectedAccountBoundaryGeneration !== undefined;
  if (
    hasBoundaryPrecondition &&
    (options.deferredWrites !== "discard" ||
      options.beforeAccountBoundaryAdvance === undefined ||
      options.expectedAccountBoundaryGeneration === undefined)
  ) {
    throw new Error(
      "A discard boundary precondition requires deferredWrites=discard, an expected generation, and a validator",
    );
  }
  if (
    hasBoundaryPrecondition &&
    options.expectedAccountBoundaryGeneration !== requestedOriginGeneration
  ) {
    throw new AccountBoundaryChangedError();
  }
  let releaseTurn!: () => void;
  const turnDone = new Promise<void>((resolve) => {
    releaseTurn = resolve;
  });
  const previousTurn = authoritativeMutationQueue;
  authoritativeMutationQueue = previousTurn.catch(() => undefined).then(() => turnDone);
  pendingAuthoritativeMutations += 1;
  if (options.refreshFailure !== "log") {
    rejectRefreshFailureOnQueueDrain = true;
  }
  await previousTurn.catch(() => undefined);

  let committedOriginGeneration = requestedOriginGeneration;
  let finalizationPromise:
    | Promise<readonly DataWriteBarrierPostCommitIssueKind[]>
    | undefined;
  const finalizeBarrier = (): Promise<readonly DataWriteBarrierPostCommitIssueKind[]> => {
    if (finalizationPromise) return finalizationPromise;

    finalizationPromise = (async () => {
      const issueKinds: DataWriteBarrierPostCommitIssueKind[] = [];
      const isLastQueuedMutation = pendingAuthoritativeMutations === 1;
      const shouldRejectRefreshFailure = rejectRefreshFailureOnQueueDrain;

      const settleDeferredWrites = async (): Promise<void> => {
        if (discardDeferredWritesOnQueueDrain) {
          discardDeferredDataWrites();
          return;
        }
        issueKinds.push(...(await drainDeferredDataWrites()));
      };

      const recordMountedRefreshIssue = (): void => {
        if (!issueKinds.includes("mounted-refresh")) {
          issueKinds.push("mounted-refresh");
        }
      };

      try {
        if (isLastQueuedMutation) {
          let refreshPass = 0;
          while (pendingAuthoritativeMutations === 1) {
            await settleDeferredWrites();
            refreshPass += 1;

            let refreshFailed = false;
            try {
              await triggerDataRefresh();
            } catch (error) {
              refreshFailed = true;
              if (shouldRejectRefreshFailure) {
                recordMountedRefreshIssue();
              }
              logger.error(
                "[useIndexedDB] Mounted data refresh failed after a durable commit:",
                error,
              );
            }

            // A mutation queued during this refresh owns the eventual final
            // drain and refresh. Keep its deferred patches ordered behind it.
            if (pendingAuthoritativeMutations !== 1) break;
            if (deferredDataWrites.length === 0) break;

            if (refreshFailed || refreshPass >= MAX_DATA_REFRESH_QUIESCENCE_PASSES) {
              // Never leave an orphan that can hang settled reads or leak an
              // expired account action into the next barrier. Replay/discard
              // the final batch, then report that mounted state may be stale.
              await settleDeferredWrites();
              if (!refreshFailed) recordMountedRefreshIssue();
              if (refreshPass >= MAX_DATA_REFRESH_QUIESCENCE_PASSES) {
                logger.error(
                  "[useIndexedDB] Mounted refresh did not reach write quiescence; " +
                    "finalized durable writes without another automatic refresh",
                );
              }
              break;
            }
          }
        }
      } finally {
        pendingAuthoritativeMutations -= 1;
        if (pendingAuthoritativeMutations === 0) {
          discardDeferredWritesOnQueueDrain = false;
          rejectRefreshFailureOnQueueDrain = false;
        }
        releaseTurn();
      }

      return issueKinds;
    })();

    return finalizationPromise;
  };

  const runMutationAndFinalize = async (): Promise<T> => {
    let committedValue: T;
    try {
      committedValue = await mutation();
    } catch (mutationError) {
      // Finalization still drains every accepted patch, but it must never
      // replace the primary mutation failure or manufacture a committed value.
      await finalizeBarrier();
      throw mutationError;
    }

    const issueKinds = await finalizeBarrier();
    if (issueKinds.length > 0) {
      throw new DataWriteBarrierPostCommitError(
        committedValue,
        committedOriginGeneration,
        issueKinds,
      );
    }
    return committedValue;
  };

  const abortBeforeDataLock = (): void => {
    if (finalizationPromise) return;
    const isLastQueuedMutation = pendingAuthoritativeMutations === 1;
    if (isLastQueuedMutation) {
      // DATA was never acquired, so replaying a write here would be unlocked.
      // Its optimistic shadow is cleared and the barrier error remains visible
      // to the initiating operation.
      discardDeferredDataWrites();
    }
    pendingAuthoritativeMutations -= 1;
    if (pendingAuthoritativeMutations === 0) {
      discardDeferredWritesOnQueueDrain = false;
      rejectRefreshFailureOnQueueDrain = false;
    }
    releaseTurn();
    finalizationPromise = Promise.resolve([]);
  };

  try {
    // Pending same-realm writes now acquire DATA themselves. Drain them before
    // requesting DATA or the barrier would wait on a write waiting on this lock.
    await flushPendingDataWrites();
    return await runWithOriginExclusiveLock(DATA_WRITE_BARRIER_LOCK, async () => {
      try {
        if (options.deferredWrites === "discard") {
          // Every discard is an account-boundary mutation, including callers
          // that do not need an additional owner/session precondition. A stale
          // module realm must fail before it can advance the durable boundary
          // or purge data adopted by a replacement tab/account lifecycle.
          assertOriginAccountBoundaryGeneration(requestedOriginGeneration);
          if (hasBoundaryPrecondition) {
            const expectedGeneration = options.expectedAccountBoundaryGeneration!;
            await options.beforeAccountBoundaryAdvance!();
            // The validator may await session or IndexedDB reads. A second realm
            // must not be able to expire the captured owner during that gap.
            assertOriginAccountBoundaryGeneration(expectedGeneration);
          }

          const nextGeneration = advanceOriginAccountBoundaryGeneration();
          acceptedOriginAccountBoundaryGeneration = nextGeneration;
          committedOriginGeneration = nextGeneration;
          authoritativeReadGeneration += 1;
          discardDeferredWritesOnQueueDrain = true;
          return await runWithAccountBoundaryJournalWriteBarrier(runMutationAndFinalize);
        }

        assertOriginAccountBoundaryGeneration(requestedOriginGeneration);
        // Keep DATA until deferred writes and mounted state have settled. A
        // second realm therefore cannot purge data between commit and adoption.
        return await runMutationAndFinalize();
      } catch (error) {
        // Every callback-entered failure settles under DATA. In particular, a
        // rejected owner precondition must never replay writes after unlocking.
        await finalizeBarrier();
        throw error;
      }
    });
  } catch (error) {
    // A Web Locks/fallback implementation can reject before invoking its
    // callback. Release the in-process turn without unlocked replay/refresh.
    abortBeforeDataLock();
    throw error;
  }
}

/**
 * Runs a read only after every already accepted hook write and every queued
 * authoritative mutation has settled. The queue is rechecked after awaiting it
 * so a mutation added while an earlier one is finishing cannot be skipped.
 */
export async function runWithSettledDataRead<T>(operation: () => Promise<T>): Promise<T> {
  const requestedReadGeneration = authoritativeReadGeneration;
  const requestedOriginGeneration = acceptedOriginAccountBoundaryGeneration;
  const assertRequestedRealm = () => {
    // Check the durable same-origin boundary first so callers receive the
    // typed account-boundary error whenever both generations changed.
    assertOriginAccountBoundaryGeneration(requestedOriginGeneration);
    if (authoritativeReadGeneration !== requestedReadGeneration) {
      throw new AccountBoundaryChangedError();
    }
  };

  while (true) {
    const observedMutationQueue = authoritativeMutationQueue;
    await observedMutationQueue.catch(() => undefined);
    await flushPendingDataWrites();
    assertRequestedRealm();

    if (
      observedMutationQueue !== authoritativeMutationQueue ||
      pendingAuthoritativeMutations > 0 ||
      pendingDataWrites.size > 0 ||
      deferredDataWrites.length > 0
    ) {
      continue;
    }

    const result = await runWithOriginExclusiveLock(DATA_WRITE_BARRIER_LOCK, async () => {
      if (
        observedMutationQueue !== authoritativeMutationQueue ||
        pendingAuthoritativeMutations > 0 ||
        pendingDataWrites.size > 0 ||
        deferredDataWrites.length > 0
      ) {
        return { retry: true as const };
      }

      assertRequestedRealm();
      const value = await operation();
      assertRequestedRealm();
      return { retry: false as const, value };
    });

    if (!result.retry) return result.value;
  }
}

class DataRefreshListenerTimeoutError extends Error {
  readonly code = "DATA_REFRESH_LISTENER_TIMEOUT";

  constructor() {
    super(
      `A mounted data refresh exceeded ${DATA_REFRESH_LISTENER_TIMEOUT_MS}ms and was aborted`,
    );
    this.name = "DataRefreshListenerTimeoutError";
  }
}

/**
 * Grants one listener time-bounded refresh ownership. Aborting the signal is
 * part of the contract: listeners must fence every state or migration commit
 * after an await so late storage resolution cannot outlive this ownership.
 */
async function runBoundedRefreshListener(listener: RefreshListener): Promise<void> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const listenerResult = Promise.resolve().then(() => listener(controller.signal));
  const deadline = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      try {
        controller.abort();
      } finally {
        reject(new DataRefreshListenerTimeoutError());
      }
    }, DATA_REFRESH_LISTENER_TIMEOUT_MS);
  });

  try {
    await Promise.race([listenerResult, deadline]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

export const triggerDataRefresh = async (): Promise<void> => {
  logger.log("[useIndexedDB] Triggering data refresh for all hooks");
  const results = await Promise.allSettled(
    [...refreshListeners].map((listener) => runBoundedRefreshListener(listener)),
  );
  const failure = results.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failure) throw failure.reason;
};

export function subscribeDataRefresh(listener: RefreshListener): () => void {
  refreshListeners.add(listener);
  return () => {
    refreshListeners.delete(listener);
  };
}

// Timeout for IndexedDB operations (30s — exportBackup reads 7 tables in one
// Dexie transaction which can take 10-20s on Android, blocking other hooks)
const INDEXEDDB_TIMEOUT_MS = 30000;

type IndexedDBTimeoutRecoveryState = "cached" | "unavailable" | "unknown";

const reportIndexedDBReadTimeout = (
  recoveryState: IndexedDBTimeoutRecoveryState,
): void => {
  const detail = Object.freeze({
    code: "IDB_OPERATION_TIMEOUT" as const,
    phase: "read" as const,
    deadlineMs: INDEXEDDB_TIMEOUT_MS,
    recoveryState,
  });
  logger.warn("[useIndexedDB] IndexedDB read deadline reached", detail);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("zenflow:indexeddb-timeout", { detail }),
    );
  }
};

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

// Bound an operation without claiming that a recovery source exists. The caller
// reports the outcome only after its domain fallback has been validated.
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
  /** Normalizes raw stored bytes before defaults are merged and schema validation runs. */
  migrateStoredValue?: (value: unknown) => unknown;
  /** Supplies a coherent recovery value when the primary record is unavailable. */
  readFallbackValue?: () => unknown;
  /** Persists an explicit write to a domain-specific recovery envelope. */
  writeFallbackValue?: (value: T) => boolean;
  /** Domain mirrors can persist once after validating a multi-record snapshot. */
  persistFallbackOnRead?: boolean;
}

export function useIndexedDB<T>({
  table,
  localStorageKey,
  initialValue,
  idField = "id",
  itemSchema,
  objectSchema,
  fallbackArrayFilter,
  migrateStoredValue,
  readFallbackValue,
  writeFallbackValue,
  persistFallbackOnRead = true,
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
  const migrateStoredValueRef = useRef(migrateStoredValue);
  const readFallbackValueRef = useRef(readFallbackValue);
  const writeFallbackValueRef = useRef(writeFallbackValue);
  const persistFallbackOnReadRef = useRef(persistFallbackOnRead);

  readFallbackValueRef.current = readFallbackValue;
  writeFallbackValueRef.current = writeFallbackValue;
  persistFallbackOnReadRef.current = persistFallbackOnRead;

  const persistFallbackValue = useCallback(
    (value: T): boolean =>
      writeFallbackValueRef.current
        ? writeFallbackValueRef.current(value)
        : safeLocalStorageSet(localStorageKey, value),
    [localStorageKey],
  );

  const prepareStoredValue = useCallback((raw: unknown): unknown => {
    return migrateStoredValueRef.current ? migrateStoredValueRef.current(raw) : raw;
  }, []);

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
    async (isInitialLoad = false, refreshSignal?: AbortSignal) => {
      if (refreshSignal?.aborted) return;
      const defaults = initialValueRef.current;
      const loadSequence = loadSequenceRef.current + 1;
      loadSequenceRef.current = loadSequence;
      const readGeneration = authoritativeReadGeneration;
      const canCommitRead = () =>
        !refreshSignal?.aborted &&
        isMountedRef.current &&
        loadSequenceRef.current === loadSequence &&
        authoritativeReadGeneration === readGeneration &&
        isOriginAccountBoundaryGenerationCurrent(acceptedOriginAccountBoundaryGeneration);
      const commitRead = (nextValue: T, persistFallback = true): boolean => {
        if (!canCommitRead()) return false;
        setData(nextValue);
        const shouldPersistFallback =
          persistFallback && persistFallbackOnReadRef.current;
        const serializedFallback =
          shouldPersistFallback && !writeFallbackValueRef.current
            ? safeJsonStringify(nextValue)
            : null;
        if (shouldPersistFallback && !persistFallbackValue(nextValue)) {
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
            const storedValue = prepareStoredValue(record.value);
            // Only merge objects, not primitives (strings, booleans, numbers) or arrays
            // Spreading primitives or arrays creates objects with numeric keys which breaks React rendering
            const isPrimitive = typeof storedValue !== "object" || storedValue === null;
            const isArray = Array.isArray(storedValue);
            if (isPrimitive || isArray) {
              // Don't merge primitives or arrays - just use the value directly
              const validated = applyValidation(storedValue);
              const nextValue = validated !== null ? validated : defaults;
              commitRead(nextValue);
            } else {
              // Merge with initialValue to ensure all required fields exist (handles schema migrations)
              const merged = { ...defaults, ...storedValue };
              const validated = applyValidation(merged);
              const nextValue = validated !== null ? validated : defaults;
              const committed = commitRead(nextValue);
              if (
                committed &&
                migrateStoredValueRef.current &&
                !structurallyEqual(record.value, merged)
              ) {
                void trackPendingDataWrite(
                  runWithAcceptedOriginDataWrite(() =>
                    table.put({ key: localStorageKey, value: merged })
                  ).catch((error) => {
                    logger.warn("[useIndexedDB] Stored-value migration put failed:", error);
                  })
                );
              }
            }
          } else if (isInitialLoad) {
            // Try localStorage fallback only on initial load
            let recoveredFromFallback = false;
            try {
              if (readFallbackValueRef.current) {
                const parsed = prepareStoredValue(readFallbackValueRef.current());
                const isPrimitive = typeof parsed !== "object" || parsed === null;
                const isArray = Array.isArray(parsed);
                const candidate = isPrimitive || isArray
                  ? parsed
                  : { ...defaults, ...parsed };
                const validated = applyValidation(candidate);
                const committed = commitRead(
                  validated !== null ? validated : defaults,
                  false,
                );
                if (timedOut && committed) {
                  reportIndexedDBReadTimeout(
                    validated !== null ? "cached" : "unavailable",
                  );
                }
                return;
              }
              const stored = storageGetRaw(localStorageKey, "");
              if (stored) {
                try {
                  const parsed = prepareStoredValue(sanitizeStoredValue(JSON.parse(stored)));
                  // Only merge objects, not primitives or arrays
                  const isPrimitive = typeof parsed !== "object" || parsed === null;
                  const isArray = Array.isArray(parsed);
                  if (isPrimitive || isArray) {
                    // Don't merge primitives or arrays - just use the value directly
                    const validated = applyValidation(parsed);
                    if (!commitRead(validated !== null ? validated : defaults, false)) return;
                    recoveredFromFallback = validated !== null;
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
                    recoveredFromFallback = validated !== null;
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
            if (timedOut) {
              reportIndexedDBReadTimeout(
                recoveredFromFallback ? "cached" : "unavailable",
              );
            }
          } else if (!timedOut) {
            commitRead(defaults);
          } else {
            reportIndexedDBReadTimeout("unknown");
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
            let recoveredFromFallback = false;
            try {
              const stored = storageGetRaw(localStorageKey, "");
              if (stored) {
                try {
                  const parsed = prepareStoredValue(sanitizeStoredValue(JSON.parse(stored)));
                  if (Array.isArray(parsed) && parsed.length > 0) {
                    const filtered = fallbackArrayFilterRef.current
                      ? await fallbackArrayFilterRef.current(parsed)
                      : parsed;
                    const validated = applyValidation(filtered);
                    const nextValue = validated !== null ? validated : defaults;
                    if (!commitRead(nextValue, false)) return;
                    recoveredFromFallback = validated !== null;
                    // Migrate to IndexedDB (don't wait, fire and forget)
                    if (Array.isArray(filtered) && filtered.length > 0) {
                      void trackPendingDataWrite(
                        runWithAcceptedOriginDataWrite(() => table.bulkPut(filtered)).catch(
                          (err) => {
                            // Log migration errors
                            logger.warn("[useIndexedDB] Migration bulkPut failed:", err);
                          }
                        )
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
            if (timedOut) {
              reportIndexedDBReadTimeout(
                recoveredFromFallback ? "cached" : "unavailable",
              );
            }
          } else if (!timedOut) {
            commitRead(defaults);
          } else {
            reportIndexedDBReadTimeout("unknown");
          }
        }
      } catch (error) {
        if (refreshSignal?.aborted) return;
        logger.error("Error loading from IndexedDB:", error);
        // Fallback to localStorage
        try {
          if (readFallbackValueRef.current) {
            const parsed = prepareStoredValue(readFallbackValueRef.current());
            const isPrimitive = typeof parsed !== "object" || parsed === null;
            const isArray = Array.isArray(parsed);
            const candidate = isPrimitive || isArray
              ? parsed
              : { ...defaults, ...parsed };
            const validated = applyValidation(candidate);
            commitRead(validated !== null ? validated : defaults, false);
            return;
          }
          const stored = storageGetRaw(localStorageKey, "");
          if (stored) {
            try {
              const parsed = prepareStoredValue(sanitizeStoredValue(JSON.parse(stored)));
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
    [
      table,
      localStorageKey,
      idField,
      applyValidation,
      prepareStoredValue,
      persistFallbackValue,
    ]
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
    const handleRefresh = async (signal: AbortSignal) => {
      if (signal.aborted || !isMountedRef.current) return;

      let observedWrite: Promise<void>;
      do {
        if (signal.aborted) return;
        observedWrite = pendingWriteRef.current;
        await observedWrite;
        if (signal.aborted) return;
      } while (observedWrite !== pendingWriteRef.current);

      if (!signal.aborted && isMountedRef.current) {
        await loadData(false, signal);
      }
    };
    return subscribeDataRefresh(handleRefresh);
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
              originGeneration: acceptedOriginAccountBoundaryGeneration,
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
                  if (!persistFallbackValue(replayValue as T)) {
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
              originGeneration: acceptedOriginAccountBoundaryGeneration,
              run: async () => {
                try {
                  await table.db.transaction("rw", table, async () => {
                    if (removedKeys.length > 0) await table.bulkDelete(removedKeys);
                    if (changedItems.length > 0) await table.bulkPut(changedItems);
                  });
                  const authoritativeValue = await table.toArray();
                  if (!persistFallbackValue(authoritativeValue as T)) {
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
            await runWithAcceptedOriginDataWrite(async () => {
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
              if (!persistFallbackValue(newValue)) {
                logger.warn("localStorage backup failed");
              }
            }, writeGeneration);
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
              await runWithAcceptedOriginDataWrite(async () => {
                if (persistFallbackValue(newValue)) return;
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
              }, writeGeneration);
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
    [table, localStorageKey, idField, persistFallbackValue, resetStaleAccountState]
  );

  return [data, setValue, isLoading];
}
