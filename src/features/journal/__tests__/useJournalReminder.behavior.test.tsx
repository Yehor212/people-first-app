import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  schedule: vi.fn(),
  cancel: vi.fn(),
}));
const platformState = vi.hoisted(() => ({ isNative: false }));
const accountBoundaryState = vi.hoisted(() => {
  const resets = new Set<() => void>();
  const subscribers = new Set<(generation: string) => void>();
  return {
    generation: "generation-1",
    resets,
    subscribers,
    runValidated: vi.fn(<T,>(operation: () => Promise<T>) => operation()),
    capture: vi.fn(() => accountBoundaryState.generation),
    assertCurrent: vi.fn((expected: string) => {
      if (expected !== accountBoundaryState.generation) {
        throw new Error("ACCOUNT_BOUNDARY_CHANGED");
      }
    }),
    registerReset: vi.fn((reset: () => void) => {
      resets.add(reset);
      return () => resets.delete(reset);
    }),
    subscribe: vi.fn((listener: (generation: string) => void) => {
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    }),
  };
});

vi.mock("@/lib/platform", () => ({
  get isNative() {
    return platformState.isNative;
  },
}));
vi.mock("@/storage/db", () => ({
  db: { settings: { get: mocks.get, put: mocks.put } },
}));
vi.mock("@/lib/localNotifications", () => ({
  scheduleJournalReminder: mocks.schedule,
  cancelJournalReminder: mocks.cancel,
}));
vi.mock("@/storage/accountBoundaryRuntime", () => ({
  assertOriginAccountBoundaryGeneration: accountBoundaryState.assertCurrent,
  captureOriginAccountBoundaryGeneration: accountBoundaryState.capture,
  registerAccountBoundaryRuntimeReset: accountBoundaryState.registerReset,
  runWithAccountBoundaryValidatedJournalWrite: accountBoundaryState.runValidated,
  subscribeOriginAccountBoundaryGeneration: accountBoundaryState.subscribe,
}));

import {
  reconcileJournalReminderAtStartup,
  useJournalReminder,
} from "../useJournalReminder";

describe("journal reminder durable settings", () => {
  beforeEach(() => {
    platformState.isNative = false;
    accountBoundaryState.generation = "generation-1";
    accountBoundaryState.resets.clear();
    accountBoundaryState.subscribers.clear();
    accountBoundaryState.runValidated.mockClear();
    accountBoundaryState.capture.mockClear();
    accountBoundaryState.assertCurrent.mockClear();
    accountBoundaryState.registerReset.mockClear();
    accountBoundaryState.subscribe.mockClear();
    mocks.get.mockReset().mockResolvedValue(undefined);
    mocks.put.mockReset().mockResolvedValue(undefined);
    mocks.schedule.mockReset().mockResolvedValue(undefined);
    mocks.cancel.mockReset().mockResolvedValue(undefined);
  });

  it("reconciles persisted journal intent through the root-owned startup service", async () => {
    platformState.isNative = true;
    mocks.get.mockResolvedValue({
      value: { enabled: true, hour: 7, minute: 35 },
    });

    await reconcileJournalReminderAtStartup({
      reminderTitle: "Write",
      reminderBody: "Take a moment",
    });

    expect(mocks.schedule).toHaveBeenCalledWith(
      { hour: 7, minute: 35 },
      { title: "Write", body: "Take a moment" },
    );
    expect(accountBoundaryState.runValidated).toHaveBeenCalledTimes(1);
  });

  it("does not commit a stale load after the account generation changes", async () => {
    const deferred = createDeferred<{
      value: { enabled: boolean; hour: number; minute: number };
    }>();
    mocks.get.mockReturnValueOnce(deferred.promise);

    const { result } = renderHook(() =>
      useJournalReminder({ reminderTitle: "Write", reminderBody: "Take a moment" }),
    );

    accountBoundaryState.generation = "generation-2";
    deferred.resolve({ value: { enabled: true, hour: 7, minute: 35 } });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.enabled).toBe(false);
    expect(result.current.hour).toBe(20);
    expect(accountBoundaryState.assertCurrent).toHaveBeenCalledWith("generation-1");
  });

  it("clears a mounted reminder view when the account boundary resets", async () => {
    mocks.get.mockResolvedValue({ value: { enabled: true, hour: 7, minute: 35 } });
    const { result } = renderHook(() =>
      useJournalReminder({ reminderTitle: "Write", reminderBody: "Take a moment" }),
    );

    await waitFor(() => expect(result.current.enabled).toBe(true));
    expect(accountBoundaryState.resets.size).toBe(1);

    act(() => {
      for (const reset of accountBoundaryState.resets) reset();
    });

    expect(result.current.enabled).toBe(false);
    expect(result.current.hour).toBe(20);
    expect(result.current.saveError).toBe(false);
  });

  it("loads persisted intent without creating a second route-level scheduler owner", async () => {
    platformState.isNative = true;
    mocks.get.mockResolvedValue({
      value: { enabled: true, hour: 7, minute: 35 },
    });

    const { result } = renderHook(() =>
      useJournalReminder({ reminderTitle: "Write", reminderBody: "Take a moment" }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mocks.schedule).not.toHaveBeenCalled();
    expect(mocks.cancel).not.toHaveBeenCalled();
    expect(result.current.enabled).toBe(true);
    expect(result.current.saveError).toBe(false);
    expect(result.current.saveOutcome).toBe("idle");
    expect(result.current.supported).toBe(true);
  });

  it("reports reminders as unsupported when no native scheduler exists", async () => {
    const { result } = renderHook(() =>
      useJournalReminder({ reminderTitle: "Write", reminderBody: "Take a moment" }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.supported).toBe(false);
    expect(mocks.schedule).not.toHaveBeenCalled();
    expect(mocks.cancel).not.toHaveBeenCalled();
  });

  it("keeps persisted intent visible while root startup owns native reconciliation", async () => {
    platformState.isNative = true;
    mocks.get.mockResolvedValue({
      value: { enabled: true, hour: 21, minute: 5 },
    });

    const { result } = renderHook(() =>
      useJournalReminder({ reminderTitle: "Write", reminderBody: "Take a moment" }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.enabled).toBe(true);
    expect(result.current.saveError).toBe(false);
    expect(mocks.schedule).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it("keeps the previous visible setting and exposes an error when persistence fails", async () => {
    mocks.put.mockRejectedValueOnce(new Error("indexeddb unavailable"));
    const { result } = renderHook(() =>
      useJournalReminder({ reminderTitle: "Write", reminderBody: "Take a moment" }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.setEnabled(true)).rejects.toThrow("indexeddb unavailable");
    });

    expect(result.current.enabled).toBe(false);
    expect(result.current.saveError).toBe(true);
    expect(result.current.saveOutcome).toBe("rolled-back");
  });

  it("reports a confirmed rollback when native scheduling fails but the old intent is restored", async () => {
    platformState.isNative = true;
    mocks.schedule.mockRejectedValueOnce(new Error("native schedule failed"));
    const { result } = renderHook(() =>
      useJournalReminder({ reminderTitle: "Write", reminderBody: "Take a moment" }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.setEnabled(true)).rejects.toThrow("native schedule failed");
    });

    expect(result.current.enabled).toBe(false);
    expect(result.current.saveOutcome).toBe("rolled-back");
    expect(mocks.cancel).toHaveBeenCalledOnce();
  });

  it("reports an unknown native state when both scheduling and rollback fail", async () => {
    platformState.isNative = true;
    mocks.put
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("rollback persistence failed"));
    mocks.schedule.mockRejectedValueOnce(new Error("native schedule failed"));
    const { result } = renderHook(() =>
      useJournalReminder({ reminderTitle: "Write", reminderBody: "Take a moment" }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.setEnabled(true)).rejects.toThrow("native schedule failed");
    });

    expect(result.current.enabled).toBe(false);
    expect(result.current.saveOutcome).toBe("unknown");
  });

  it("finishes a failed update rollback before applying a newer queued change", async () => {
    platformState.isNative = true;
    mocks.get.mockResolvedValue({
      value: { enabled: true, hour: 20, minute: 0 },
    });

    let rejectFirstSchedule!: (error: Error) => void;
    const firstSchedule = new Promise<void>((_resolve, reject) => {
      rejectFirstSchedule = reject;
    });
    let releaseRollbackWrite!: () => void;
    const rollbackWrite = new Promise<void>((resolve) => {
      releaseRollbackWrite = resolve;
    });

    mocks.schedule.mockImplementation(({ hour }: { hour: number }) => {
      if (hour === 7) return firstSchedule;
      return Promise.resolve();
    });
    mocks.put.mockImplementation(({ value }: { value: { hour: number } }) => {
      if (value.hour === 20) return rollbackWrite;
      return Promise.resolve();
    });

    const { result } = renderHook(() =>
      useJournalReminder({ reminderTitle: "Write", reminderBody: "Take a moment" }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    let failedUpdate!: Promise<void>;
    let newerUpdate!: Promise<void>;
    act(() => {
      failedUpdate = result.current.setTime(7, 0);
    });
    await waitFor(() =>
      expect(mocks.schedule).toHaveBeenCalledWith(
        { hour: 7, minute: 0 },
        { title: "Write", body: "Take a moment" },
      ),
    );

    act(() => {
      newerUpdate = result.current.setTime(8, 0);
      rejectFirstSchedule(new Error("native schedule failed"));
    });
    await waitFor(() =>
      expect(mocks.put).toHaveBeenCalledWith({
        key: "journal_reminder",
        value: { enabled: true, hour: 20, minute: 0 },
      }),
    );

    // The newer change must remain queued until both durable and native rollback finish.
    expect(mocks.put).not.toHaveBeenCalledWith({
      key: "journal_reminder",
      value: { enabled: true, hour: 8, minute: 0 },
    });

    releaseRollbackWrite();
    await act(async () => {
      await expect(failedUpdate).rejects.toThrow("native schedule failed");
      await expect(newerUpdate).resolves.toBeUndefined();
    });

    expect(result.current.hour).toBe(8);
    expect(mocks.schedule).toHaveBeenLastCalledWith(
      { hour: 8, minute: 0 },
      { title: "Write", body: "Take a moment" },
    );
  });

  it("merges rapid successful changes with the latest serialized intent", async () => {
    platformState.isNative = true;
    const { result } = renderHook(() =>
      useJournalReminder({ reminderTitle: "Write", reminderBody: "Take a moment" }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await Promise.all([
        result.current.setEnabled(true),
        result.current.setTime(7, 45),
      ]);
    });

    expect(result.current.enabled).toBe(true);
    expect(result.current.hour).toBe(7);
    expect(result.current.minute).toBe(45);
    expect(mocks.put).toHaveBeenLastCalledWith({
      key: "journal_reminder",
      value: { enabled: true, hour: 7, minute: 45 },
    });
  });

  it("merges an update over the latest durable record instead of a stale render snapshot", async () => {
    platformState.isNative = true;
    mocks.get
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        value: { enabled: true, hour: 9, minute: 15 },
      });
    const { result } = renderHook(() =>
      useJournalReminder({ reminderTitle: "Write", reminderBody: "Take a moment" }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.setTime(7, 45);
    });

    expect(mocks.put).toHaveBeenLastCalledWith({
      key: "journal_reminder",
      value: { enabled: true, hour: 7, minute: 45 },
    });
    expect(result.current.enabled).toBe(true);
  });

  it("does not show a successful update after the account changes before state commit", async () => {
    platformState.isNative = true;
    mocks.get.mockResolvedValue({ value: { enabled: true, hour: 20, minute: 0 } });
    const scheduled = createDeferred<void>();
    mocks.schedule.mockReturnValueOnce(scheduled.promise);
    const { result } = renderHook(() =>
      useJournalReminder({ reminderTitle: "Write", reminderBody: "Take a moment" }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    let update!: Promise<void>;
    act(() => {
      update = result.current.setTime(7, 0);
    });
    await waitFor(() =>
      expect(mocks.put).toHaveBeenCalledWith({
        key: "journal_reminder",
        value: { enabled: true, hour: 7, minute: 0 },
      }),
    );

    accountBoundaryState.generation = "generation-2";
    scheduled.resolve();

    await act(async () => {
      await expect(update).rejects.toThrow("ACCOUNT_BOUNDARY_CHANGED");
    });
    expect(result.current.hour).toBe(20);
    expect(result.current.saveOutcome).not.toBe("saved");
  });
});
