import Dexie from "dexie";

interface WebLockManagerLike {
  request<T>(
    name: string,
    options: { mode: "exclusive" },
    callback: (lock: unknown) => T | Promise<T>
  ): Promise<T>;
}

interface OriginLockSentinel {
  id: "exclusive";
}

const FALLBACK_LOCK_DATABASE_PREFIX = "ZenFlowOriginExclusiveLock:";
const FALLBACK_LOCK_STORE = "mutex";
const FALLBACK_LOCK_SENTINEL: OriginLockSentinel = { id: "exclusive" };
// Dexie.waitFor() defaults to 60 seconds. Account cleanup and encrypted diary
// migrations can legitimately remain suspended in a background tab for longer,
// so keep the IndexedDB transaction alive for the largest browser timer window.
const FALLBACK_LOCK_MAX_HOLD_MS = 2_147_000_000;

const fallbackLockTails = new Map<string, Promise<void>>();

function getWebLockManager(): WebLockManagerLike | null {
  if (typeof navigator === "undefined") return null;
  const candidate = (navigator as Navigator & { locks?: WebLockManagerLike }).locks;
  return candidate && typeof candidate.request === "function" ? candidate : null;
}

async function runWithIndexedDbExclusiveLock<T>(
  name: string,
  operation: () => Promise<T>
): Promise<T> {
  if (typeof globalThis.indexedDB === "undefined") {
    throw new Error("Same-origin exclusive locking is unavailable");
  }

  // A database per lock name preserves named-lock independence. Using a single
  // object store for DATA and JOURNAL would deadlock the required nesting order
  // (DATA outer -> JOURNAL inner), because IndexedDB serializes read-write
  // transactions at object-store scope rather than record scope.
  const lockDb = new Dexie(`${FALLBACK_LOCK_DATABASE_PREFIX}${name}`);
  lockDb.version(1).stores({ [FALLBACK_LOCK_STORE]: "&id" });
  const mutex = lockDb.table<OriginLockSentinel, string>(FALLBACK_LOCK_STORE);

  try {
    await lockDb.open();
    return await lockDb.transaction("rw", mutex, async () => {
      // This write is the acquisition point. A read-write transaction in every
      // other realm for the same named-lock database waits until this one ends.
      await mutex.put(FALLBACK_LOCK_SENTINEL);
      // Run application work outside the mutex transaction's Dexie PSD. The
      // operation may open another Dexie transaction or call Dexie.waitFor();
      // inheriting this mutex PSD would turn that into a nested wait on the same
      // spin loop and strand the lock after the first call.
      const isolatedOperation = Dexie.ignoreTransaction(operation);
      return Dexie.waitFor(isolatedOperation, FALLBACK_LOCK_MAX_HOLD_MS);
    });
  } finally {
    lockDb.close();
  }
}

async function runInFallbackQueue<T>(name: string, operation: () => Promise<T>): Promise<T> {
  let releaseTurn!: () => void;
  const turnFinished = new Promise<void>((resolve) => {
    releaseTurn = resolve;
  });
  const previousTurn = fallbackLockTails.get(name) ?? Promise.resolve();
  const ready = previousTurn.catch(() => undefined);
  const tail = ready.then(() => turnFinished);
  fallbackLockTails.set(name, tail);

  await ready;
  try {
    return await runWithIndexedDbExclusiveLock(name, operation);
  } finally {
    releaseTurn();
    if (fallbackLockTails.get(name) === tail) {
      void tail.then(() => {
        if (fallbackLockTails.get(name) === tail) fallbackLockTails.delete(name);
      });
    }
  }
}

/**
 * Coordinates a mutation across same-origin tabs and workers. Web Locks is the
 * primary path; engines without it use a named IndexedDB read-write transaction
 * plus an in-process FIFO. If neither primitive is available, the operation is
 * rejected before it can mutate data.
 */
export async function runWithOriginExclusiveLock<T>(
  name: string,
  operation: () => Promise<T>
): Promise<T> {
  const locks = getWebLockManager();
  if (!locks) return runInFallbackQueue(name, operation);
  return locks.request(name, { mode: "exclusive" }, () => operation());
}
