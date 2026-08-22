import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  generation: "generation-a",
  ownerUserId: null as string | null,
  observations: new Set<() => void>(),
  resets: new Set<() => void>(),
}));

const mocks = vi.hoisted(() => ({
  clearFocusTimerBridge: vi.fn(),
  setFocusControls: vi.fn(),
  setFocusTimerBridge: vi.fn(),
}));

vi.mock("@/storage/accountBoundaryRuntime", () => ({
  ACCOUNT_BOUNDARY_DATA_WRITE_LOCK: "zenflow:data-write-barrier",
  assertOriginAccountBoundaryGeneration: vi.fn((generation: string) => {
    if (generation !== runtime.generation) throw new Error("account boundary changed");
  }),
  captureOriginAccountBoundaryGeneration: vi.fn(() => runtime.generation),
  registerAccountBoundaryRuntimeReset: vi.fn((reset: () => void) => {
    runtime.resets.add(reset);
    return () => runtime.resets.delete(reset);
  }),
  subscribeAccountSessionTransition: vi.fn((reset: () => void) => {
    runtime.resets.add(reset);
    return () => runtime.resets.delete(reset);
  }),
  subscribeOriginAccountBoundaryObservation: vi.fn((reset: () => void) => {
    runtime.observations.add(reset);
    return () => runtime.observations.delete(reset);
  }),
}));

vi.mock("@/storage/db", () => ({
  getLocalDataOwnerId: vi.fn(async () => runtime.ownerUserId),
}));

vi.mock("@/lib/originExclusiveLock", () => ({
  runWithOriginExclusiveLock: vi.fn(
    async (_name: string, operation: () => unknown) => operation()
  ),
}));

vi.mock("@/hooks/useFocusTimerConfig", () => ({
  useFocusTimerConfig: () => ({
    t: { focusCompletedShort: "Focus complete", storageErrorDesc: "Storage unavailable" },
    preset: "25" as const,
    focusMinutes: 25,
    breakMinutes: 5,
    focusInputValue: "25",
    setFocusInputValue: vi.fn(),
    breakInputValue: "5",
    setBreakInputValue: vi.fn(),
    focusDuration: 1_500,
    breakDuration: 300,
    presets: [],
    handlePresetSelect: vi.fn(),
    handleFocusInputBlur: vi.fn(),
    handleBreakInputBlur: vi.fn(),
  }),
}));

vi.mock("@/hooks/useBackHandler", () => ({ useBackHandler: vi.fn() }));
vi.mock("@/hooks/useScrollLock", () => ({ useScrollLock: vi.fn() }));
vi.mock("@/lib/haptics", () => ({
  haptics: { focusPaused: vi.fn(), focusStarted: vi.fn() },
}));
vi.mock("@/lib/a11y", () => ({ announceSuccess: vi.fn() }));
vi.mock("@/lib/focusCompletionNotification", () => ({
  scheduleFocusCompletionNotification: vi.fn(async () => undefined),
}));
vi.mock("@/stores", () => ({
  useUIStore: {
    getState: () => ({
      clearFocusTimerBridge: mocks.clearFocusTimerBridge,
      setFocusTimerBridge: mocks.setFocusTimerBridge,
    }),
  },
  setFocusControls: mocks.setFocusControls,
}));

import { useFocusTimer } from "../useFocusTimer";
import { SK } from "@/lib/storageKeys";
import type { FocusSession } from "@/types";
import type { PendingFocusCommit } from "@/types/focusTimerTypes";

function deferredCommit() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function timerState(overrides: Record<string, unknown> = {}) {
  return {
    endTime: Date.now() - 1_000,
    focusMinutes: 25,
    breakMinutes: 5,
    isRunning: true,
    isBreak: false,
    label: "Recovery proof",
    focusStartTime: Date.now() - 1_501_000,
    focusAccumulated: 0,
    preset: "25",
    ...overrides,
  };
}

function completedSession(id = "completed-session-id"): FocusSession {
  const completedAt = Date.now();
  return {
    id,
    duration: 25,
    completedAt,
    date: "2026-08-13",
    label: "Recovery proof",
    status: "completed",
    updatedAt: completedAt,
  };
}

function pendingCommit(
  session: FocusSession,
  requiresReflection = session.status !== "aborted"
): PendingFocusCommit {
  return {
    schemaVersion: 1,
    ownerUserId: runtime.ownerUserId,
    accountBoundaryGeneration: runtime.generation,
    session,
    requiresReflection,
  };
}

function storePending(pending: PendingFocusCommit): void {
  localStorage.setItem(SK.FOCUS_PENDING_COMMIT, JSON.stringify(pending));
}

describe("useFocusTimer durable completion acknowledgement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    runtime.generation = "generation-a";
    runtime.ownerUserId = null;
    runtime.observations.clear();
    runtime.resets.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retains the pending reflection until the primary focus commit resolves", async () => {
    const commit = deferredCommit();
    const onCompleteSession = vi.fn(() => commit.promise);
    const { result } = renderHook(() =>
      useFocusTimer({ sessions: [], onCompleteSession })
    );

    act(() => result.current.handleHyperfocusComplete());
    await waitFor(() => expect(result.current.showReflection).toBe(true));

    let save!: Promise<boolean>;
    act(() => {
      save = result.current.handleSaveReflection(4);
    });
    await waitFor(() => expect(onCompleteSession).toHaveBeenCalledTimes(1));
    expect(result.current.showReflection).toBe(true);

    await act(async () => {
      commit.resolve();
      await expect(save).resolves.toBe(true);
    });
    expect(result.current.showReflection).toBe(false);
  });

  it("keeps an aborted running timer recoverable until its primary commit resolves", async () => {
    const commit = deferredCommit();
    const onCompleteSession = vi.fn(() => commit.promise);
    const { result } = renderHook(() =>
      useFocusTimer({ sessions: [], onCompleteSession })
    );

    act(() => result.current.throttledToggle());
    expect(result.current.isRunning).toBe(true);
    act(() => result.current.throttledReset());
    await waitFor(() => expect(onCompleteSession).toHaveBeenCalledTimes(1));
    expect(result.current.isRunning).toBe(false);
    expect(localStorage.getItem(SK.FOCUS_PENDING_COMMIT)).not.toBeNull();

    await act(async () => {
      commit.resolve();
      await commit.promise;
    });
    await waitFor(() => expect(localStorage.getItem(SK.FOCUS_PENDING_COMMIT)).toBeNull());
  });

  it("restores an expired pending session after restart until its primary commit is durable", async () => {
    localStorage.setItem(
      SK.TIMER_STATE,
      JSON.stringify(timerState({ label: "Restart proof" }))
    );

    const firstCommit = vi.fn(async () => undefined);
    const firstMount = renderHook(() =>
      useFocusTimer({ sessions: [], onCompleteSession: firstCommit })
    );
    await waitFor(() => expect(firstMount.result.current.showReflection).toBe(true));
    const firstPending = JSON.parse(
      localStorage.getItem(SK.FOCUS_PENDING_COMMIT) ?? "null"
    );
    firstMount.unmount();

    const restartedCommit = vi.fn(async (_session: FocusSession) => undefined);
    const restarted = renderHook(() =>
      useFocusTimer({ sessions: [], onCompleteSession: restartedCommit })
    );
    await waitFor(() => expect(restarted.result.current.showReflection).toBe(true));
    await act(async () => {
      await expect(restarted.result.current.handleSaveReflection(null)).resolves.toBe(true);
    });

    expect(firstCommit).not.toHaveBeenCalled();
    expect(restartedCommit).toHaveBeenCalledTimes(1);
    expect(restartedCommit.mock.calls[0]?.[0]).toMatchObject({
      id: firstPending.session.id,
      duration: 25,
      label: "Restart proof",
      status: "completed",
    });
    expect(localStorage.getItem(SK.FOCUS_PENDING_COMMIT)).toBeNull();
  });

  it("preserves the exact expired checkpoint through pending-write denial, toggle, and unmount", async () => {
    const expiredTimer = JSON.stringify(timerState({ label: "Quota proof" }));
    localStorage.setItem(SK.TIMER_STATE, expiredTimer);
    const originalSetItem = Storage.prototype.setItem;
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, key, value) {
        if (key === SK.FOCUS_PENDING_COMMIT) {
          throw new DOMException("quota", "QuotaExceededError");
        }
        return originalSetItem.call(this, key, value);
      });

    const onCompleteSession = vi.fn(async () => undefined);
    const failedRecovery = renderHook(() =>
      useFocusTimer({ sessions: [], onCompleteSession })
    );
    await waitFor(() => expect(failedRecovery.result.current.showReflection).toBe(false));
    act(() => failedRecovery.result.current.throttledToggle());
    expect(failedRecovery.result.current.isRunning).toBe(false);
    expect(localStorage.getItem(SK.TIMER_STATE)).toBe(expiredTimer);
    failedRecovery.unmount();
    expect(localStorage.getItem(SK.TIMER_STATE)).toBe(expiredTimer);
    expect(onCompleteSession).not.toHaveBeenCalled();

    setItem.mockRestore();
    const restarted = renderHook(() =>
      useFocusTimer({ sessions: [], onCompleteSession })
    );
    await waitFor(() => expect(restarted.result.current.showReflection).toBe(true));
    await act(async () => {
      await expect(restarted.result.current.handleSaveReflection(null)).resolves.toBe(true);
    });
    expect(onCompleteSession).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the durable pending receipt cannot be read", async () => {
    const pending = pendingCommit(completedSession("pending-read-denied"));
    const pendingRaw = JSON.stringify(pending);
    const timerRaw = JSON.stringify(timerState({ label: "Unreadable pending proof" }));
    localStorage.setItem(SK.FOCUS_PENDING_COMMIT, pendingRaw);
    localStorage.setItem(SK.TIMER_STATE, timerRaw);
    const originalGetItem = Storage.prototype.getItem;
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(function (this: Storage, key) {
        if (key === SK.FOCUS_PENDING_COMMIT) {
          throw new DOMException("denied", "SecurityError");
        }
        return originalGetItem.call(this, key);
      });
    const onCompleteSession = vi.fn(async (_session: FocusSession) => undefined);
    const storageErrors: CustomEvent[] = [];
    const onStorageError = (event: Event) => storageErrors.push(event as CustomEvent);
    window.addEventListener("zenflow:storage-error", onStorageError);

    const blocked = renderHook(() => useFocusTimer({ sessions: [], onCompleteSession }));
    await waitFor(() => expect(blocked.result.current.showReflection).toBe(false));
    act(() => blocked.result.current.throttledToggle());
    expect(blocked.result.current.isRunning).toBe(false);
    expect(onCompleteSession).not.toHaveBeenCalled();
    blocked.unmount();
    window.removeEventListener("zenflow:storage-error", onStorageError);
    getItem.mockRestore();

    expect(localStorage.getItem(SK.FOCUS_PENDING_COMMIT)).toBe(pendingRaw);
    expect(localStorage.getItem(SK.TIMER_STATE)).toBe(timerRaw);
    expect(storageErrors).toHaveLength(1);
    expect(storageErrors[0].detail).toEqual({
      type: "read_failed",
      message: "Storage unavailable",
    });
  });

  it("fails closed when the durable timer checkpoint cannot be read", () => {
    const timerRaw = JSON.stringify(
      timerState({ endTime: Date.now() + 60_000, label: "Unreadable timer proof" })
    );
    localStorage.setItem(SK.TIMER_STATE, timerRaw);
    const originalGetItem = Storage.prototype.getItem;
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(function (this: Storage, key) {
        if (key === SK.TIMER_STATE) {
          throw new DOMException("denied", "SecurityError");
        }
        return originalGetItem.call(this, key);
      });
    const onCompleteSession = vi.fn(async (_session: FocusSession) => undefined);

    const blocked = renderHook(() => useFocusTimer({ sessions: [], onCompleteSession }));
    act(() => blocked.result.current.throttledToggle());
    expect(blocked.result.current.isRunning).toBe(false);
    expect(onCompleteSession).not.toHaveBeenCalled();
    blocked.unmount();
    getItem.mockRestore();

    expect(localStorage.getItem(SK.TIMER_STATE)).toBe(timerRaw);
  });

  it("keeps a running timer active when an abort receipt cannot be persisted", async () => {
    const onCompleteSession = vi.fn(async () => undefined);
    const mounted = renderHook(() => useFocusTimer({ sessions: [], onCompleteSession }));
    act(() => mounted.result.current.throttledToggle());
    await waitFor(() => expect(mounted.result.current.isRunning).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 350));
    const runningCheckpoint = localStorage.getItem(SK.TIMER_STATE);
    expect(runningCheckpoint).not.toBeNull();

    const originalSetItem = Storage.prototype.setItem;
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, key, value) {
        if (key === SK.FOCUS_PENDING_COMMIT) {
          throw new DOMException("quota", "QuotaExceededError");
        }
        return originalSetItem.call(this, key, value);
    });
    act(() => mounted.result.current.throttledReset());
    await waitFor(() => {
      expect(setItem).toHaveBeenCalledWith(SK.FOCUS_PENDING_COMMIT, expect.any(String));
    });
    expect(localStorage.getItem(SK.FOCUS_PENDING_COMMIT)).toBeNull();
    expect(mounted.result.current.isRunning).toBe(true);
    expect(onCompleteSession).not.toHaveBeenCalled();
    setItem.mockRestore();
    mounted.unmount();

    const restarted = renderHook(() => useFocusTimer({ sessions: [], onCompleteSession }));
    expect(restarted.result.current.isRunning).toBe(true);
    expect(onCompleteSession).not.toHaveBeenCalled();
    restarted.unmount();
  });

  it("keeps Hyperfocus open when its completion receipt cannot be persisted", async () => {
    const onCompleteSession = vi.fn(async () => undefined);
    const mounted = renderHook(() => useFocusTimer({ sessions: [], onCompleteSession }));
    act(() => mounted.result.current.setShowHyperfocus(true));

    const originalSetItem = Storage.prototype.setItem;
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, key, value) {
        if (key === SK.FOCUS_PENDING_COMMIT) {
          throw new DOMException("quota", "QuotaExceededError");
        }
        return originalSetItem.call(this, key, value);
    });
    act(() => mounted.result.current.handleHyperfocusComplete());
    await waitFor(() => {
      expect(setItem).toHaveBeenCalledWith(SK.FOCUS_PENDING_COMMIT, expect.any(String));
    });
    expect(localStorage.getItem(SK.FOCUS_PENDING_COMMIT)).toBeNull();
    expect(mounted.result.current.showHyperfocus).toBe(true);
    expect(mounted.result.current.showReflection).toBe(false);
    expect(onCompleteSession).not.toHaveBeenCalled();
    setItem.mockRestore();

    act(() => mounted.result.current.handleHyperfocusComplete());
    await waitFor(() => expect(mounted.result.current.showReflection).toBe(true));
    expect(mounted.result.current.showHyperfocus).toBe(false);
  });

  it("replays the exact interrupted aborted session after restart without resuming the timer", async () => {
    localStorage.setItem(
      SK.TIMER_STATE,
      JSON.stringify(timerState({ endTime: Date.now() + 60_000, label: "Abort proof" }))
    );
    const completedAt = Date.now();
    const aborted: FocusSession = {
      id: "aborted-session-id",
      duration: 1,
      completedAt,
      date: "2026-08-13",
      label: "Abort proof",
      status: "aborted",
      updatedAt: completedAt,
    };
    storePending(pendingCommit(aborted, false));

    const commit = deferredCommit();
    const onCompleteSession = vi.fn((_session: FocusSession) => commit.promise);
    const restarted = renderHook(() => useFocusTimer({ sessions: [], onCompleteSession }));
    await waitFor(() => expect(onCompleteSession).toHaveBeenCalledTimes(1));
    expect(onCompleteSession.mock.calls[0]?.[0]).toEqual(aborted);
    expect(restarted.result.current.isRunning).toBe(false);
    expect(localStorage.getItem(SK.FOCUS_PENDING_COMMIT)).not.toBeNull();

    await act(async () => {
      commit.resolve();
      await commit.promise;
    });
    await waitFor(() => expect(localStorage.getItem(SK.FOCUS_PENDING_COMMIT)).toBeNull());
  });

  it("does not acknowledge a completed session until both recovery records can be cleared", async () => {
    localStorage.setItem(SK.TIMER_STATE, JSON.stringify(timerState({ label: "Ack proof" })));
    const onCompleteSession = vi.fn(async (_session: FocusSession) => undefined);
    const mounted = renderHook(() => useFocusTimer({ sessions: [], onCompleteSession }));
    await waitFor(() => expect(mounted.result.current.showReflection).toBe(true));
    const pendingBefore = JSON.parse(
      localStorage.getItem(SK.FOCUS_PENDING_COMMIT) ?? "null"
    );

    const originalRemoveItem = Storage.prototype.removeItem;
    const removeItem = vi
      .spyOn(Storage.prototype, "removeItem")
      .mockImplementation(function (this: Storage, key) {
        if (key === SK.TIMER_STATE) throw new DOMException("denied", "SecurityError");
        return originalRemoveItem.call(this, key);
      });
    await act(async () => {
      await expect(mounted.result.current.handleSaveReflection(4)).resolves.toBe(false);
    });
    expect(mounted.result.current.showReflection).toBe(true);
    expect(JSON.parse(localStorage.getItem(SK.FOCUS_PENDING_COMMIT) ?? "null")).toMatchObject({
      session: { id: pendingBefore.session.id, reflection: 4 },
    });
    removeItem.mockRestore();

    await act(async () => {
      await expect(mounted.result.current.handleSaveReflection(4)).resolves.toBe(true);
    });
    expect(onCompleteSession).toHaveBeenCalledTimes(2);
    expect(onCompleteSession.mock.calls[0]?.[0].id).toBe(
      onCompleteSession.mock.calls[1]?.[0].id
    );
    expect(localStorage.getItem(SK.FOCUS_PENDING_COMMIT)).toBeNull();
    const idle = JSON.parse(localStorage.getItem(SK.TIMER_STATE) ?? "null");
    expect(idle === null || (idle.endTime === null && idle.isRunning === false)).toBe(true);
  });

  it("retains the fenced pending marker if stale-owner cleanup cannot remove the timer", async () => {
    runtime.ownerUserId = "owner-a";
    const stale = pendingCommit(completedSession("stale-owner-session"));
    storePending(stale);
    const checkpoint = JSON.stringify(timerState({ label: "Owner A private label" }));
    localStorage.setItem(SK.TIMER_STATE, checkpoint);
    runtime.ownerUserId = "owner-b";
    runtime.generation = "generation-b";

    const originalRemoveItem = Storage.prototype.removeItem;
    const removeItem = vi
      .spyOn(Storage.prototype, "removeItem")
      .mockImplementation(function (this: Storage, key) {
        if (key === SK.TIMER_STATE) throw new DOMException("denied", "SecurityError");
        return originalRemoveItem.call(this, key);
      });
    const onCompleteSession = vi.fn(async () => undefined);
    const blocked = renderHook(() => useFocusTimer({ sessions: [], onCompleteSession }));
    await waitFor(() => expect(blocked.result.current.showReflection).toBe(false));
    expect(localStorage.getItem(SK.TIMER_STATE)).toBe(checkpoint);
    expect(localStorage.getItem(SK.FOCUS_PENDING_COMMIT)).not.toBeNull();
    expect(onCompleteSession).not.toHaveBeenCalled();
    blocked.unmount();
    removeItem.mockRestore();

    const retried = renderHook(() => useFocusTimer({ sessions: [], onCompleteSession }));
    await waitFor(() => expect(localStorage.getItem(SK.FOCUS_PENDING_COMMIT)).toBeNull());
    expect(localStorage.getItem(SK.TIMER_STATE)).toBeNull();
    retried.unmount();
  });

  it("invalidates live pending UI on an account-boundary reset", async () => {
    runtime.ownerUserId = "owner-a";
    const onCompleteSession = vi.fn(async () => undefined);
    const mounted = renderHook(() => useFocusTimer({ sessions: [], onCompleteSession }));
    act(() => mounted.result.current.handleHyperfocusComplete());
    await waitFor(() => expect(mounted.result.current.showReflection).toBe(true));

    runtime.ownerUserId = "owner-b";
    runtime.generation = "generation-b";
    act(() => {
      for (const reset of runtime.observations) reset();
      for (const reset of runtime.resets) reset();
    });
    expect(mounted.result.current.showReflection).toBe(false);
    await act(async () => {
      await expect(mounted.result.current.handleSaveReflection(5)).resolves.toBe(false);
    });
    expect(onCompleteSession).not.toHaveBeenCalled();
  });

  it("rejects a stale same-origin reflection update after a newer durable value", async () => {
    const initial = pendingCommit(completedSession("same-origin-update"));
    storePending(initial);
    localStorage.setItem(SK.TIMER_STATE, JSON.stringify(timerState()));
    const newerCommit = deferredCommit();
    const newer = renderHook(() =>
      useFocusTimer({ sessions: [], onCompleteSession: vi.fn(() => newerCommit.promise) })
    );
    const stale = renderHook(() =>
      useFocusTimer({ sessions: [], onCompleteSession: vi.fn(async () => undefined) })
    );
    await waitFor(() => expect(newer.result.current.showReflection).toBe(true));
    await waitFor(() => expect(stale.result.current.showReflection).toBe(true));

    let newerSave!: Promise<boolean>;
    act(() => {
      newerSave = newer.result.current.handleSaveReflection(5);
    });
    await waitFor(() => {
      expect(
        JSON.parse(localStorage.getItem(SK.FOCUS_PENDING_COMMIT) ?? "null").session.reflection
      ).toBe(5);
    });
    await act(async () => {
      await expect(stale.result.current.handleSaveReflection(4)).resolves.toBe(false);
    });
    expect(
      JSON.parse(localStorage.getItem(SK.FOCUS_PENDING_COMMIT) ?? "null").session.reflection
    ).toBe(5);

    await act(async () => {
      newerCommit.resolve();
      await expect(newerSave).resolves.toBe(true);
    });
  });

  it("does not clear a newer pending payload after an older primary call resolves", async () => {
    const initial = pendingCommit(completedSession("same-origin-ack"));
    storePending(initial);
    localStorage.setItem(SK.TIMER_STATE, JSON.stringify(timerState()));
    const commit = deferredCommit();
    const mounted = renderHook(() =>
      useFocusTimer({ sessions: [], onCompleteSession: vi.fn(() => commit.promise) })
    );
    await waitFor(() => expect(mounted.result.current.showReflection).toBe(true));
    let save!: Promise<boolean>;
    act(() => {
      save = mounted.result.current.handleSaveReflection(5);
    });
    await waitFor(() => {
      expect(
        JSON.parse(localStorage.getItem(SK.FOCUS_PENDING_COMMIT) ?? "null").session.reflection
      ).toBe(5);
    });
    const newer = JSON.parse(localStorage.getItem(SK.FOCUS_PENDING_COMMIT) ?? "null");
    newer.session.reflection = 4;
    localStorage.setItem(SK.FOCUS_PENDING_COMMIT, JSON.stringify(newer));

    await act(async () => {
      commit.resolve();
      await expect(save).resolves.toBe(false);
    });
    expect(
      JSON.parse(localStorage.getItem(SK.FOCUS_PENDING_COMMIT) ?? "null").session.reflection
    ).toBe(4);
  });
});
