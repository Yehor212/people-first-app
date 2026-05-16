import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SK } from "@/lib/storageKeys";
import {
  resetSyncLeaderForTests,
  runWithSyncLeaderLock,
  SYNC_LEADER_LOCK_NAME,
} from "../syncLeader";

const originalNavigator = globalThis.navigator;
type TestLock = { name: string; mode: "exclusive" };
type TestLockCallback<T> = (lock: TestLock | null) => T | Promise<T>;

function setNavigator(value: unknown): void {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value,
  });
}

describe("syncLeader", () => {
  beforeEach(() => {
    localStorage.clear();
    resetSyncLeaderForTests();
    setNavigator({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
  });

  it("runs the task through Web Locks when this tab gets ownership", async () => {
    const task = vi.fn().mockResolvedValue("done");
    const request = vi.fn(async <T,>(
      _name: string,
      _options: { mode?: "exclusive"; ifAvailable?: boolean },
      callback: TestLockCallback<T>
    ) =>
      callback({ name: SYNC_LEADER_LOCK_NAME, mode: "exclusive" })
    );
    setNavigator({ locks: { request } });

    const result = await runWithSyncLeaderLock("test-sync", task);

    expect(request).toHaveBeenCalledWith(
      SYNC_LEADER_LOCK_NAME,
      { mode: "exclusive", ifAvailable: true },
      expect.any(Function)
    );
    expect(task).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ acquired: true, value: "done" });
  });

  it("skips the task when Web Locks reports another owner", async () => {
    const task = vi.fn().mockResolvedValue("done");
    const request = vi.fn(
      async <T,>(
        _name: string,
        _options: { mode?: "exclusive"; ifAvailable?: boolean },
        callback: TestLockCallback<T>
      ) => callback(null)
    );
    setNavigator({ locks: { request } });

    const result = await runWithSyncLeaderLock("test-sync", task);

    expect(task).not.toHaveBeenCalled();
    expect(result).toEqual({ acquired: false });
  });

  it("uses the localStorage lease when Web Locks are unavailable", async () => {
    const task = vi.fn().mockResolvedValue(42);

    const result = await runWithSyncLeaderLock("fallback-sync", task);

    expect(task).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ acquired: true, value: 42 });
    expect(localStorage.getItem(SK.SYNC_LEADER_LOCK)).toBeNull();
  });

  it("skips when another live localStorage lease is present", async () => {
    localStorage.setItem(
      SK.SYNC_LEADER_LOCK,
      JSON.stringify({
        ownerId: "other-tab",
        token: "live",
        expiresAt: Date.now() + 10_000,
      })
    );
    const task = vi.fn().mockResolvedValue("done");

    const result = await runWithSyncLeaderLock("fallback-sync", task);

    expect(task).not.toHaveBeenCalled();
    expect(result).toEqual({ acquired: false });
  });

  it("takes over an expired localStorage lease", async () => {
    localStorage.setItem(
      SK.SYNC_LEADER_LOCK,
      JSON.stringify({
        ownerId: "stale-tab",
        token: "expired",
        expiresAt: Date.now() - 1,
      })
    );
    const task = vi.fn().mockResolvedValue("fresh");

    const result = await runWithSyncLeaderLock("fallback-sync", task);

    expect(task).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ acquired: true, value: "fresh" });
    expect(localStorage.getItem(SK.SYNC_LEADER_LOCK)).toBeNull();
  });

  it("prevents two concurrent localStorage fallback runs in the same tab", async () => {
    let finishFirst!: (value: string) => void;
    const firstTask = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finishFirst = resolve;
        })
    );
    const secondTask = vi.fn().mockResolvedValue("second");

    const firstRun = runWithSyncLeaderLock("first-sync", firstTask);
    await vi.waitFor(() => expect(firstTask).toHaveBeenCalledTimes(1));
    const secondRun = await runWithSyncLeaderLock("second-sync", secondTask);

    expect(secondRun).toEqual({ acquired: false });
    expect(secondTask).not.toHaveBeenCalled();

    finishFirst("first");
    await expect(firstRun).resolves.toEqual({ acquired: true, value: "first" });
    expect(localStorage.getItem(SK.SYNC_LEADER_LOCK)).toBeNull();
  });

  it("does not retry the task without a lock when the owned task fails", async () => {
    const error = new Error("apply failed");
    const task = vi.fn().mockRejectedValue(error);

    await expect(runWithSyncLeaderLock("fallback-sync", task)).rejects.toThrow("apply failed");

    expect(task).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(SK.SYNC_LEADER_LOCK)).toBeNull();
  });
});
