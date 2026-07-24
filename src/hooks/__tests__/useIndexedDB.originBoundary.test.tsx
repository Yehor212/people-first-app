import { act, renderHook, waitFor } from "@testing-library/react";
import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SK } from "@/lib/storageKeys";
import {
  clearLocalUserData,
  db,
  getLocalDataOwnerId,
  setLocalDataOwnerId,
} from "@/storage/db";
import {
  assertOriginAccountBoundaryGeneration,
  captureOriginAccountBoundaryGeneration,
  runWithAccountBoundaryValidatedJournalWrite,
} from "@/storage/accountBoundaryRuntime";
import { runWithOriginExclusiveLock } from "@/lib/originExclusiveLock";
import { runWithDataWriteBarrier, triggerDataRefresh, useIndexedDB } from "../useIndexedDB";

const DATA_WRITE_BARRIER_LOCK = "zenflow:data-write-barrier";

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
}

interface DelayedRejection {
  lockReleased: Promise<void>;
  resume: () => void;
}

function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

class FifoWebLockManager {
  private readonly tails = new Map<string, Promise<void>>();
  private readonly held = new Set<string>();
  private readonly requests = new Map<string, number>();
  private readonly requestWaiters = new Set<() => void>();
  private readonly rejectionDelays = new Map<
    string,
    Array<{ lockReleased: Deferred; resume: Deferred }>
  >();

  request<T>(
    name: string,
    _options: { mode: "exclusive" },
    callback: (lock: unknown) => T | Promise<T>
  ): Promise<T> {
    this.requests.set(name, (this.requests.get(name) ?? 0) + 1);
    for (const notify of this.requestWaiters) notify();

    const previous = this.tails.get(name) ?? Promise.resolve();
    const release = deferred();
    const ready = previous.catch(() => undefined);
    const tail = ready.then(() => release.promise);
    this.tails.set(name, tail);

    return ready.then(async () => {
      this.held.add(name);
      let result!: T;
      let failure: unknown;
      let failed = false;
      try {
        result = await callback({ name, mode: "exclusive" });
      } catch (error) {
        failed = true;
        failure = error;
      } finally {
        this.held.delete(name);
        release.resolve();
        if (this.tails.get(name) === tail) {
          void tail.finally(() => this.tails.delete(name));
        }
      }

      if (failed) {
        const delayed = this.rejectionDelays.get(name)?.shift();
        if (delayed) {
          delayed.lockReleased.resolve();
          await delayed.resume.promise;
        }
        throw failure;
      }
      return result;
    });
  }

  delayNextRejection(name: string): DelayedRejection {
    const delayed = { lockReleased: deferred(), resume: deferred() };
    const queue = this.rejectionDelays.get(name) ?? [];
    queue.push(delayed);
    this.rejectionDelays.set(name, queue);
    return {
      lockReleased: delayed.lockReleased.promise,
      resume: delayed.resume.resolve,
    };
  }

  isHeld(name: string): boolean {
    return this.held.has(name);
  }

  requestCount(name: string): number {
    return this.requests.get(name) ?? 0;
  }

  async waitForRequestCount(name: string, expected: number): Promise<void> {
    if (this.requestCount(name) >= expected) return;
    await new Promise<void>((resolve) => {
      const notify = () => {
        if (this.requestCount(name) < expected) return;
        this.requestWaiters.delete(notify);
        resolve();
      };
      this.requestWaiters.add(notify);
    });
  }
}

async function settledWithin(promise: Promise<unknown>, timeoutMs: number): Promise<boolean> {
  return Promise.race([
    promise.then(() => true),
    new Promise<boolean>((resolve) => {
      window.setTimeout(() => resolve(false), timeoutMs);
    }),
  ]);
}

async function waitForStep<T>(promise: Promise<T>, label: string): Promise<T> {
  let timeoutId: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error(`Timed out: ${label}`)), 1_000);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}

describe("useIndexedDB origin-wide account boundary", () => {
  let originalLocks: PropertyDescriptor | undefined;

  beforeEach(async () => {
    vi.restoreAllMocks();
    originalLocks = Object.getOwnPropertyDescriptor(navigator, "locks");
    localStorage.clear();
    const initialGeneration = JSON.stringify("initial");
    localStorage.setItem(SK.ACCOUNT_BOUNDARY_GENERATION, initialGeneration);
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: SK.ACCOUNT_BOUNDARY_GENERATION,
        newValue: initialGeneration,
      })
    );
    db.close();
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    if (originalLocks) {
      Object.defineProperty(navigator, "locks", originalLocks);
    } else {
      Reflect.deleteProperty(navigator, "locks");
    }
    localStorage.clear();
    db.close();
    await db.delete();
  });

  it("prevents an old tab's delayed and post-purge setting writes from repopulating account A data", async () => {
    const locks = new FifoWebLockManager();
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: locks,
    });

    await setLocalDataOwnerId("account-a");
    await db.settings.put({ key: SK.PRIVACY, value: { owner: "account-a" } });

    const delayedWriteEntered = deferred();
    const releaseDelayedWrite = deferred();
    const delayedWriteFinished = deferred();
    const delayedSettingsTable = new Proxy(db.settings, {
      get(target, property) {
        if (property === "put") {
          return async (record: { key: string; value: unknown }) => {
            if (
              record.key === SK.PRIVACY &&
              (record.value as { owner?: string }).owner === "account-a-delayed"
            ) {
              delayedWriteEntered.resolve();
              await releaseDelayedWrite.promise;
            }
            try {
              return await target.put(record);
            } finally {
              delayedWriteFinished.resolve();
            }
          };
        }
        const value = Reflect.get(target, property, target) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    });

    const { result } = renderHook(() =>
      useIndexedDB({
        table: delayedSettingsTable,
        localStorageKey: SK.PRIVACY,
        initialValue: { owner: "none" },
        idField: "key",
      })
    );
    await waitFor(() => expect(result.current[2]).toBe(false));
    expect(result.current[0]).toEqual({ owner: "account-a" });

    act(() => {
      result.current[1]({ owner: "account-a-delayed" });
    });
    await delayedWriteEntered.promise;
    const delayedWriteHeldOriginBarrier = locks.isHeld(DATA_WRITE_BARRIER_LOCK);

    // A fresh module realm models tab B: its in-memory pending-write set cannot
    // see the delayed setter accepted by tab A. Only an origin-wide contract can.
    vi.resetModules();
    const { runWithDataWriteBarrier: runTabBBoundary } = await import("../useIndexedDB");
    const expectedBoundaryRequestCount = locks.requestCount(DATA_WRITE_BARRIER_LOCK) + 1;
    const accountBoundary = runTabBBoundary(
      async () => {
        await clearLocalUserData();
        await setLocalDataOwnerId("account-b");
      },
      { deferredWrites: "discard" }
    );
    await locks.waitForRequestCount(DATA_WRITE_BARRIER_LOCK, expectedBoundaryRequestCount);
    const purgeFinishedBeforeOldWrite = await settledWithin(accountBoundary, 250);

    releaseDelayedWrite.resolve();
    await delayedWriteFinished.promise;
    await accountBoundary;

    // The already-mounted tab A must also be unable to write after tab B has
    // advanced the account boundary and bound the device to account B.
    act(() => {
      result.current[1]({ owner: "account-a-after-purge" });
    });
    await act(async () => {
      await triggerDataRefresh();
    });

    expect(delayedWriteHeldOriginBarrier).toBe(true);
    expect(purgeFinishedBeforeOldWrite).toBe(false);
    expect(await getLocalDataOwnerId()).toBe("account-b");
    expect(await db.settings.get(SK.PRIVACY)).toBeUndefined();
    expect(localStorage.getItem(SK.PRIVACY) ?? "").not.toContain("account-a");
    expect(result.current[0]).toEqual({ owner: "none" });
  });

  it("revalidates a suspended tab's localStorage fallback after its failed IndexedDB write", async () => {
    const locks = new FifoWebLockManager();
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: locks,
    });

    await setLocalDataOwnerId("account-a");
    await db.settings.put({ key: SK.PRIVACY, value: { owner: "account-a" } });

    const failedWriteEntered = deferred();
    const failingSettingsTable = new Proxy(db.settings, {
      get(target, property) {
        if (property === "put") {
          return async (record: { key: string; value: unknown }) => {
            if (
              record.key === SK.PRIVACY &&
              (record.value as { owner?: string }).owner === "account-a-fallback"
            ) {
              failedWriteEntered.resolve();
              throw new Error("IndexedDB write failed");
            }
            return target.put(record);
          };
        }
        const value = Reflect.get(target, property, target) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    });

    const { result } = renderHook(() =>
      useIndexedDB({
        table: failingSettingsTable,
        localStorageKey: SK.PRIVACY,
        initialValue: { owner: "none" },
        idField: "key",
      })
    );
    await waitFor(() => expect(result.current[2]).toBe(false));

    const delayedRejection = locks.delayNextRejection(DATA_WRITE_BARRIER_LOCK);
    try {
      act(() => {
        result.current[1]({ owner: "account-a-fallback" });
      });
      await waitForStep(failedWriteEntered.promise, "failed write entered DATA");
      await waitForStep(delayedRejection.lockReleased, "failed DATA request released its lock");

      // Tab A is suspended after its DATA-locked IndexedDB failure. Tab B can now
      // finish the purge before tab A resumes its error fallback.
      vi.resetModules();
      const { runWithDataWriteBarrier: runTabBBoundary } = await import("../useIndexedDB");
      const boundary = runTabBBoundary(
        async () => {
          await clearLocalUserData();
          await setLocalDataOwnerId("account-b");
        },
        { deferredWrites: "discard" }
      );
      await waitForStep(boundary, "tab B account boundary");
    } finally {
      delayedRejection.resume();
    }
    await act(async () => {
      await waitForStep(triggerDataRefresh(), "tab A failed write and refresh");
    });

    expect(await getLocalDataOwnerId()).toBe("account-b");
    expect(await db.settings.get(SK.PRIVACY)).toBeUndefined();
    expect(localStorage.getItem(SK.PRIVACY) ?? "").not.toContain("account-a");
    expect(result.current[0]).toEqual({ owner: "none" });
  });

  it("resets a passive stale tab on a generation storage event without resetting the fresh realm", async () => {
    const locks = new FifoWebLockManager();
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: locks,
    });

    await setLocalDataOwnerId("account-a");
    await db.settings.put({ key: SK.PRIVACY, value: { owner: "account-a" } });

    const { result: staleTab } = renderHook(() =>
      useIndexedDB({
        table: db.settings,
        localStorageKey: SK.PRIVACY,
        initialValue: { owner: "none" },
        idField: "key",
      })
    );
    await waitFor(() => expect(staleTab.current[2]).toBe(false));
    expect(staleTab.current[0]).toEqual({ owner: "account-a" });

    // A fresh module realm models tab B. Mount its hook before the purge so the
    // test also proves the realm that accepted the new generation is not reset.
    vi.resetModules();
    const tabB = await import("../useIndexedDB");
    const { db: tabBDb, setLocalDataOwnerId: setTabBOwner } = await import("@/storage/db");
    const { result: freshTab } = renderHook(() =>
      tabB.useIndexedDB({
        table: tabBDb.settings,
        localStorageKey: SK.PRIVACY,
        initialValue: { owner: "none" },
        idField: "key",
      })
    );
    await waitFor(() => expect(freshTab.current[2]).toBe(false));

    await tabB.runWithDataWriteBarrier(
      async () => {
        await clearLocalUserData();
        await setTabBOwner("account-b");
        await tabBDb.settings.put({ key: SK.PRIVACY, value: { owner: "account-b" } });
      },
      { deferredWrites: "discard" }
    );
    await waitFor(() => expect(freshTab.current[0]).toEqual({ owner: "account-b" }));

    const nextGeneration = localStorage.getItem(SK.ACCOUNT_BOUNDARY_GENERATION);
    expect(nextGeneration).not.toBeNull();
    // A foreground task can observe durable storage before the queued storage
    // event is delivered. That read must not consume the passive-reset signal.
    expect(captureOriginAccountBoundaryGeneration()).not.toBe("initial");
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: SK.ACCOUNT_BOUNDARY_GENERATION,
          newValue: nextGeneration,
        })
      );
    });

    await waitFor(() => expect(staleTab.current[0]).toEqual({ owner: "none" }));
    expect(freshTab.current[0]).toEqual({ owner: "account-b" });
    expect(await tabBDb.settings.get(SK.PRIVACY)).toEqual({
      key: SK.PRIVACY,
      value: { owner: "account-b" },
    });
  });

  it("serializes isolated realms through IndexedDB when Web Locks is unavailable", async () => {
    Reflect.deleteProperty(navigator, "locks");

    await setLocalDataOwnerId("account-a");
    await db.settings.put({ key: SK.PRIVACY, value: { owner: "account-a" } });

    const delayedWriteEntered = deferred();
    const releaseDelayedWrite = deferred();
    const delayedSettingsTable = new Proxy(db.settings, {
      get(target, property) {
        if (property === "put") {
          return async (record: { key: string; value: unknown }) => {
            if (
              record.key === SK.PRIVACY &&
              (record.value as { owner?: string }).owner === "account-a-delayed"
            ) {
              delayedWriteEntered.resolve();
              await releaseDelayedWrite.promise;
            }
            return target.put(record);
          };
        }
        const value = Reflect.get(target, property, target) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    });

    const { result } = renderHook(() =>
      useIndexedDB({
        table: delayedSettingsTable,
        localStorageKey: SK.PRIVACY,
        initialValue: { owner: "none" },
        idField: "key",
      })
    );
    await waitFor(() => expect(result.current[2]).toBe(false));

    act(() => {
      result.current[1]({ owner: "account-a-delayed" });
    });
    await waitForStep(delayedWriteEntered.promise, "tab A entered fallback DATA lock");

    // Resetting the module graph gives tab B a distinct in-process queue. The
    // shared IndexedDB origin is therefore the only remaining mutex surface.
    vi.resetModules();
    const { runWithDataWriteBarrier: runTabBBoundary } = await import("../useIndexedDB");
    const boundary = runTabBBoundary(
      async () => {
        await clearLocalUserData();
        await setLocalDataOwnerId("account-b");
      },
      { deferredWrites: "discard" }
    );
    const purgeFinishedBeforeOldWrite = await settledWithin(boundary, 250);

    releaseDelayedWrite.resolve();
    await waitForStep(boundary, "tab B fallback account boundary");
    const nextGeneration = localStorage.getItem(SK.ACCOUNT_BOUNDARY_GENERATION);
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: SK.ACCOUNT_BOUNDARY_GENERATION,
          newValue: nextGeneration,
        })
      );
    });
    await act(async () => {
      await triggerDataRefresh();
    });

    expect(purgeFinishedBeforeOldWrite).toBe(false);
    expect(await getLocalDataOwnerId()).toBe("account-b");
    expect(await db.settings.get(SK.PRIVACY)).toBeUndefined();
    expect(localStorage.getItem(SK.PRIVACY) ?? "").not.toContain("account-a");
    expect(result.current[0]).toEqual({ owner: "none" });
  });

  it("fails closed before cleanup when the shared generation cannot be persisted", async () => {
    const mutation = vi.fn(() => Promise.resolve());
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("origin storage unavailable");
    });

    await expect(
      runWithDataWriteBarrier(mutation, { deferredWrites: "discard" })
    ).rejects.toThrow(/persist.*account boundary/i);

    expect(mutation).not.toHaveBeenCalled();
  });

  it("fails closed before mutation when neither Web Locks nor IndexedDB is available", async () => {
    Reflect.deleteProperty(navigator, "locks");
    vi.stubGlobal("indexedDB", undefined);
    const mutation = vi.fn(() => Promise.resolve());

    await expect(runWithOriginExclusiveLock(DATA_WRITE_BARRIER_LOCK, mutation)).rejects.toThrow(
      /exclusive locking is unavailable/i
    );

    expect(mutation).not.toHaveBeenCalled();
  });

  it("never replays a deferred write outside DATA when lock acquisition fails", async () => {
    const key = "failed-data-lock-write";
    const { result } = renderHook(() =>
      useIndexedDB({
        table: db.settings,
        localStorageKey: key,
        initialValue: { owner: "local" },
        idField: "key",
      }),
    );
    await waitFor(() => expect(result.current[2]).toBe(false));
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: vi.fn(() => Promise.reject(new Error("DATA lock unavailable"))),
      },
    });

    const boundary = runWithDataWriteBarrier(async () => undefined);
    act(() => {
      result.current[1]({ owner: "must-not-replay-unlocked" });
    });

    await expect(boundary).rejects.toThrow(/DATA lock unavailable/i);
    expect(await db.settings.get(key)).toBeUndefined();
    expect(localStorage.getItem(key)).toBeNull();
  });

  it("rejects an incomplete discard precondition before joining the mutation queue", async () => {
    const mutation = vi.fn(() => Promise.resolve());

    await expect(
      runWithDataWriteBarrier(mutation, {
        beforeAccountBoundaryAdvance: async () => undefined,
      }),
    ).rejects.toThrow(/discard boundary precondition/i);

    expect(mutation).not.toHaveBeenCalled();
    await expect(runWithDataWriteBarrier(async () => "released")).resolves.toBe("released");
  });

  it("replays a same-realm write under DATA when the discard owner precondition fails", async () => {
    const key = "discard-precondition-preserves-write";
    const preconditionEntered = deferred();
    const releasePrecondition = deferred();
    const mutation = vi.fn(() => Promise.resolve());
    const capturedGeneration = captureOriginAccountBoundaryGeneration();
    const { result } = renderHook(() =>
      useIndexedDB({
        table: db.settings,
        localStorageKey: key,
        initialValue: { owner: "local" },
        idField: "key",
      }),
    );
    await waitFor(() => expect(result.current[2]).toBe(false));

    const boundary = runWithDataWriteBarrier(mutation, {
      deferredWrites: "discard",
      expectedAccountBoundaryGeneration: capturedGeneration,
      beforeAccountBoundaryAdvance: async () => {
        preconditionEntered.resolve();
        await releasePrecondition.promise;
        throw new Error("owner check rejected local reset");
      },
    });
    await waitForStep(preconditionEntered.promise, "discard owner precondition");
    act(() => {
      result.current[1]({ owner: "preserved-local-edit" });
    });
    releasePrecondition.resolve();

    await expect(boundary).rejects.toThrow(/owner check rejected local reset/i);
    expect(mutation).not.toHaveBeenCalled();
    expect(captureOriginAccountBoundaryGeneration()).toBe(capturedGeneration);
    expect(await db.settings.get(key)).toEqual({
      key,
      value: { owner: "preserved-local-edit" },
    });
    await expect(runWithDataWriteBarrier(async () => "released")).resolves.toBe("released");
  });

  it("discards an expired deferred write when generation changes during owner validation", async () => {
    const key = "discard-precondition-expired-write";
    const capturedGeneration = captureOriginAccountBoundaryGeneration();
    const preconditionEntered = deferred();
    const releasePrecondition = deferred();
    const mutation = vi.fn(() => Promise.resolve());
    const { result } = renderHook(() =>
      useIndexedDB({
        table: db.settings,
        localStorageKey: key,
        initialValue: { owner: "local" },
        idField: "key",
      }),
    );
    await waitFor(() => expect(result.current[2]).toBe(false));

    const boundary = runWithDataWriteBarrier(mutation, {
      deferredWrites: "discard",
      expectedAccountBoundaryGeneration: capturedGeneration,
      beforeAccountBoundaryAdvance: async () => {
        preconditionEntered.resolve();
        await releasePrecondition.promise;
      },
    });
    await waitForStep(preconditionEntered.promise, "awaited discard precondition");
    act(() => {
      result.current[1]({ owner: "expired-local-edit" });
    });
    localStorage.setItem(
      SK.ACCOUNT_BOUNDARY_GENERATION,
      JSON.stringify("replacement-generation"),
    );
    releasePrecondition.resolve();

    await expect(boundary).rejects.toMatchObject({
      name: "AccountBoundaryChangedError",
    });
    expect(mutation).not.toHaveBeenCalled();
    expect(await db.settings.get(key)).toBeUndefined();

    localStorage.setItem(
      SK.ACCOUNT_BOUNDARY_GENERATION,
      JSON.stringify(capturedGeneration),
    );
  });

  it("releases fallback DATA and JOURNAL locks between sequential nested operations", async () => {
    Reflect.deleteProperty(navigator, "locks");
    const nestedMutation = () =>
      runWithDataWriteBarrier(() =>
        runWithAccountBoundaryValidatedJournalWrite(async () => {
          // Journal import waits for an owner read inside its own transaction.
          // The fallback mutex must not leak its Dexie transaction context into
          // that operation or this nested wait can strand the mutex spin loop.
          await Dexie.waitFor(Promise.resolve("owner"));
        })
      );

    await waitForStep(nestedMutation(), "first fallback DATA to JOURNAL operation");
    await waitForStep(nestedMutation(), "second fallback DATA to JOURNAL operation");
  });

  it("validates a captured owner realm under DATA before a discard boundary advances", async () => {
    const capturedGeneration = captureOriginAccountBoundaryGeneration();
    const order: string[] = [];

    await runWithDataWriteBarrier(
      async () => {
        order.push("mutation");
        expect(captureOriginAccountBoundaryGeneration()).not.toBe(capturedGeneration);
      },
      {
        deferredWrites: "discard",
        expectedAccountBoundaryGeneration: capturedGeneration,
        beforeAccountBoundaryAdvance: async () => {
          order.push("validation");
          assertOriginAccountBoundaryGeneration(capturedGeneration);
        },
      },
    );

    expect(order).toEqual(["validation", "mutation"]);
  });

  it("rejects a current durable token when the barrier module still owns an older generation", async () => {
    const acceptedGeneration = captureOriginAccountBoundaryGeneration();
    const replacementGeneration = "durable-generation-from-another-realm";
    localStorage.setItem(
      SK.ACCOUNT_BOUNDARY_GENERATION,
      JSON.stringify(replacementGeneration),
    );
    const mutation = vi.fn(() => Promise.resolve());

    await expect(
      runWithDataWriteBarrier(mutation, {
        deferredWrites: "discard",
        expectedAccountBoundaryGeneration: replacementGeneration,
        beforeAccountBoundaryAdvance: async () => undefined,
      }),
    ).rejects.toMatchObject({ name: "AccountBoundaryChangedError" });
    expect(mutation).not.toHaveBeenCalled();

    localStorage.setItem(
      SK.ACCOUNT_BOUNDARY_GENERATION,
      JSON.stringify(acceptedGeneration),
    );
  });

  it("rejects a stale realm's plain discard after a replacement realm advances the boundary", async () => {
    const staleRealmMutation = vi.fn(async () => {
      await clearLocalUserData();
      await setLocalDataOwnerId("account-a-stale");
    });

    // Keep the top-level runWithDataWriteBarrier reference as tab A, then load
    // a fresh module realm as tab B and let B adopt the durable account realm.
    vi.resetModules();
    const tabB = await import("../useIndexedDB");
    const tabBStorage = await import("@/storage/db");
    await tabB.runWithDataWriteBarrier(
      async () => {
        await tabBStorage.clearLocalUserData();
        await tabBStorage.setLocalDataOwnerId("account-b");
        await tabBStorage.db.settings.put({
          key: SK.PRIVACY,
          value: { owner: "account-b" },
        });
      },
      { deferredWrites: "discard" },
    );

    await expect(
      runWithDataWriteBarrier(staleRealmMutation, { deferredWrites: "discard" }),
    ).rejects.toMatchObject({ name: "AccountBoundaryChangedError" });
    expect(staleRealmMutation).not.toHaveBeenCalled();
    expect(await tabBStorage.getLocalDataOwnerId()).toBe("account-b");
    expect(await tabBStorage.db.settings.get(SK.PRIVACY)).toEqual({
      key: SK.PRIVACY,
      value: { owner: "account-b" },
    });
  });
});
