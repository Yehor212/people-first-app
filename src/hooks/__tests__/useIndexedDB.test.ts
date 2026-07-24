/**
 * useIndexedDB Hook Tests
 * Tests data persistence, fallbacks, and error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  DATA_REFRESH_LISTENER_TIMEOUT_MS,
  DataWriteBarrierPostCommitError,
  isDataWriteBarrierPostCommitError,
  runWithDataWriteBarrier,
  runWithSettledDataRead,
  subscribeDataRefresh,
  useIndexedDB,
  triggerDataRefresh,
} from "../useIndexedDB";
import { defaultReminderSettings, migrateStoredReminderSettings } from "@/lib/reminders";
import { captureOriginAccountBoundaryGeneration } from "@/storage/accountBoundaryRuntime";

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Create mock table factory
const createMockTable = (initialData: Record<string, unknown> = {}) => {
  let storage: Record<string, unknown> = { ...initialData };

  const mockDb = {
    transaction: vi.fn((_mode: string, _table: unknown, fn: () => Promise<void>) => fn()),
  };

  return {
    db: mockDb,
    get: vi.fn((key: string) => Promise.resolve(storage[key])),
    put: vi.fn((data: { key: string; value: unknown }) => {
      storage[data.key] = data;
      return Promise.resolve();
    }),
    toArray: vi.fn(() => Promise.resolve(Object.values(storage))),
    clear: vi.fn(() => {
      storage = {};
      return Promise.resolve();
    }),
    bulkPut: vi.fn((items: unknown[]) => {
      items.forEach((item, i) => {
        const itemId =
          item && typeof item === "object" && "id" in item ? String(item.id) : `item_${i}`;
        storage[itemId] = item;
      });
      return Promise.resolve();
    }),
    bulkDelete: vi.fn((keys: string[]) => {
      for (const key of keys) delete storage[key];
      return Promise.resolve();
    }),
    _getStorage: () => storage,
    _setStorage: (data: Record<string, unknown>) => {
      storage = data;
    },
  };
};

describe("useIndexedDB", () => {
  let mockTable: ReturnType<typeof createMockTable>;
  let localStorageMock: Record<string, string>;

  beforeEach(() => {
    mockTable = createMockTable();
    localStorageMock = {};

    // Mock localStorage
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(
      (key) => localStorageMock[key] || null
    );
    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, value) => {
      localStorageMock[key] = value;
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation((key) => {
      delete localStorageMock[key];
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initial loading", () => {
    it("returns initial value while loading", async () => {
      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: "test_key",
          initialValue: { count: 0 },
          idField: "key",
        })
      );

      // Initially returns initial value
      expect(result.current[0]).toEqual({ count: 0 });
      // isLoading is initially true
      expect(result.current[2]).toBe(true);
    });

    it("loads data from IndexedDB on mount", async () => {
      mockTable._setStorage({
        test_key: { key: "test_key", value: { count: 42 } },
      });

      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: "test_key",
          initialValue: { count: 0 },
          idField: "key",
        })
      );

      await waitFor(() => {
        expect(result.current[2]).toBe(false); // isLoading
      });

      expect(result.current[0]).toEqual({ count: 42 });
    });

    it("merges loaded data with initialValue for objects", async () => {
      // Stored data is missing some fields
      mockTable._setStorage({
        test_key: { key: "test_key", value: { name: "Test" } },
      });

      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: "test_key",
          initialValue: { name: "", count: 0, active: true },
          idField: "key",
        })
      );

      await waitFor(() => {
        expect(result.current[2]).toBe(false);
      });

      // Should have merged values
      expect(result.current[0]).toEqual({
        name: "Test",
        count: 0,
        active: true,
      });
    });

    it("migrates legacy active reminder categories before new defaults are merged", async () => {
      mockTable._setStorage({
        "zenflow-reminders": {
          key: "zenflow-reminders",
          value: {
            enabled: true,
            moodTimeMorning: "09:00",
            moodTimeAfternoon: "14:00",
            moodTimeEvening: "20:00",
            focusTime: "10:00",
            days: [1],
            quietHours: { start: "22:00", end: "08:00" },
            habitIds: [],
          },
        },
      });

      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: "zenflow-reminders",
          initialValue: defaultReminderSettings,
          idField: "key",
          migrateStoredValue: migrateStoredReminderSettings,
        })
      );

      await waitFor(() => expect(result.current[2]).toBe(false));

      expect(result.current[0].moodCheckInsEnabled).toBe(true);
      expect(result.current[0].focusReminderEnabled).toBe(true);
    });

    it("does not merge primitives", async () => {
      mockTable._setStorage({
        test_key: { key: "test_key", value: "stored_string" },
      });

      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: "test_key",
          initialValue: "default",
          idField: "key",
        })
      );

      await waitFor(() => {
        expect(result.current[2]).toBe(false);
      });

      expect(result.current[0]).toBe("stored_string");
    });

    it("does not merge arrays", async () => {
      mockTable._setStorage({
        test_key: { key: "test_key", value: [1, 2, 3] },
      });

      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: "test_key",
          initialValue: [] as number[],
          idField: "key",
        })
      );

      await waitFor(() => {
        expect(result.current[2]).toBe(false);
      });

      expect(result.current[0]).toEqual([1, 2, 3]);
    });
  });

  describe("localStorage fallback", () => {
    it("falls back to localStorage when IndexedDB is empty", async () => {
      localStorageMock["test_key"] = JSON.stringify({ count: 99 });

      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: "test_key",
          initialValue: { count: 0 },
          idField: "key",
        })
      );

      await waitFor(() => {
        expect(result.current[2]).toBe(false);
      });

      expect(result.current[0]).toEqual({ count: 99 });
    });

    it("migrates localStorage data to IndexedDB", async () => {
      localStorageMock["test_key"] = JSON.stringify({ count: 99 });

      renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: "test_key",
          initialValue: { count: 0 },
          idField: "key",
        })
      );

      await waitFor(() => {
        expect(mockTable.put).toHaveBeenCalled();
      });
    });
  });

  describe("setValue", () => {
    it("updates state immediately", async () => {
      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: "test_key",
          initialValue: { count: 0 },
          idField: "key",
        })
      );

      await waitFor(() => {
        expect(result.current[2]).toBe(false);
      });

      act(() => {
        result.current[1]({ count: 10 });
      });

      expect(result.current[0]).toEqual({ count: 10 });
    });

    it("accepts function updater", async () => {
      mockTable._setStorage({
        test_key: { key: "test_key", value: { count: 5 } },
      });

      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: "test_key",
          initialValue: { count: 0 },
          idField: "key",
        })
      );

      await waitFor(() => {
        expect(result.current[2]).toBe(false);
      });

      act(() => {
        result.current[1]((prev) => ({ count: prev.count + 1 }));
      });

      expect(result.current[0]).toEqual({ count: 6 });
    });

    it("persists to IndexedDB", async () => {
      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: "test_key",
          initialValue: { count: 0 },
          idField: "key",
        })
      );

      await waitFor(() => {
        expect(result.current[2]).toBe(false);
      });

      act(() => {
        result.current[1]({ count: 100 });
      });

      await waitFor(() => {
        expect(mockTable.put).toHaveBeenCalledWith({
          key: "test_key",
          value: { count: 100 },
        });
      });
    });

    it("backs up to localStorage", async () => {
      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: "test_key",
          initialValue: { count: 0 },
          idField: "key",
        })
      );

      await waitFor(() => {
        expect(result.current[2]).toBe(false);
      });

      act(() => {
        result.current[1]({ count: 100 });
      });

      await waitFor(() => {
        expect(localStorageMock["test_key"]).toBe(JSON.stringify({ count: 100 }));
      });
    });
  });

  describe("array data", () => {
    it("loads array data from IndexedDB", async () => {
      const items = [
        { id: "1", name: "Item 1" },
        { id: "2", name: "Item 2" },
      ];
      mockTable._setStorage({
        item_0: items[0],
        item_1: items[1],
      });

      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: "items",
          initialValue: [] as Array<{ id: string; name: string }>,
          idField: "id",
        })
      );

      await waitFor(() => {
        expect(result.current[2]).toBe(false);
      });

      expect(result.current[0]).toHaveLength(2);
    });

    it("clears table before saving array", async () => {
      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: "items",
          initialValue: [] as Array<{ id: string; name: string }>,
          idField: "id",
        })
      );

      await waitFor(() => {
        expect(result.current[2]).toBe(false);
      });

      act(() => {
        result.current[1]([{ id: "1", name: "New Item" }]);
      });

      await waitFor(() => {
        expect(mockTable.clear).toHaveBeenCalled();
        expect(mockTable.bulkPut).toHaveBeenCalled();
      });
    });

    it("filters localStorage fallback arrays before migration", async () => {
      const live = { id: "live", name: "Live Item" };
      const deleted = { id: "deleted", name: "Deleted Item" };
      localStorageMock.items = JSON.stringify([live, deleted]);

      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: "items",
          initialValue: [] as Array<{ id: string; name: string }>,
          idField: "id",
          fallbackArrayFilter: (items) =>
            items.filter((item) => (item as { id?: string }).id !== "deleted"),
        })
      );

      await waitFor(() => {
        expect(result.current[2]).toBe(false);
      });

      expect(result.current[0]).toEqual([live]);
      expect(mockTable.bulkPut).toHaveBeenCalledWith([live]);
      expect(localStorageMock.items).toBe(JSON.stringify([live]));
    });
  });

  describe("triggerDataRefresh", () => {
    it("rejects a settled read that was requested before an account-boundary purge", async () => {
      let releaseFirstMutation!: () => void;
      const firstMutationGate = new Promise<void>((resolve) => {
        releaseFirstMutation = resolve;
      });
      const firstMutationStarted = vi.fn();

      const firstMutation = runWithDataWriteBarrier(async () => {
        firstMutationStarted();
        await firstMutationGate;
      });
      await waitFor(() => expect(firstMutationStarted).toHaveBeenCalledTimes(1));

      const readOperation = vi.fn(async () => "must-not-cross-account-boundary");
      const settledReadOutcome = runWithSettledDataRead(readOperation).then(
        (value) => ({ status: "resolved" as const, value }),
        (error: unknown) => ({ status: "rejected" as const, error })
      );
      const purge = runWithDataWriteBarrier(async () => undefined, {
        deferredWrites: "discard",
      });

      releaseFirstMutation();
      await Promise.all([firstMutation, purge]);

      const outcome = await settledReadOutcome;
      expect(outcome.status).toBe("rejected");
      if (outcome.status === "rejected") {
        expect(outcome.error).toMatchObject({ code: "ACCOUNT_BOUNDARY_CHANGED" });
      }
      expect(readOperation).not.toHaveBeenCalled();
    });

    it("rejects a normal mutation queued behind an account-boundary purge", async () => {
      let releaseFirstMutation!: () => void;
      const firstMutationGate = new Promise<void>((resolve) => {
        releaseFirstMutation = resolve;
      });
      const firstMutationStarted = vi.fn();

      const firstMutation = runWithDataWriteBarrier(async () => {
        firstMutationStarted();
        await firstMutationGate;
      });
      await waitFor(() => expect(firstMutationStarted).toHaveBeenCalledTimes(1));

      const purge = runWithDataWriteBarrier(async () => undefined, {
        deferredWrites: "discard",
      });
      const staleMutationOperation = vi.fn(async () => "stale-write");
      const staleMutationOutcome = runWithDataWriteBarrier(staleMutationOperation).then(
        (value) => ({ status: "resolved" as const, value }),
        (error: unknown) => ({ status: "rejected" as const, error })
      );

      releaseFirstMutation();
      await Promise.all([firstMutation, purge]);

      const outcome = await staleMutationOutcome;
      expect(outcome.status).toBe("rejected");
      if (outcome.status === "rejected") {
        expect(outcome.error).toMatchObject({ code: "ACCOUNT_BOUNDARY_CHANGED" });
      }
      expect(staleMutationOperation).not.toHaveBeenCalled();
    });

    it("does not start a settled read until an active hook write has committed", async () => {
      const originalPut = mockTable.put.getMockImplementation();
      let releasePut!: () => void;
      const putGate = new Promise<void>((resolve) => {
        releasePut = resolve;
      });
      mockTable.put.mockImplementation(async (record) => {
        await putGate;
        return originalPut?.(record);
      });

      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: "test_key",
          initialValue: { count: 0 },
          idField: "key",
        })
      );
      await waitFor(() => expect(result.current[2]).toBe(false));

      act(() => result.current[1]({ count: 2 }));
      const readOperation = vi.fn(async () => mockTable.get("test_key"));
      let settledRead: Promise<unknown>;
      try {
        settledRead = runWithSettledDataRead(readOperation);
      } catch (error) {
        releasePut();
        throw error;
      }

      await Promise.resolve();
      expect(readOperation).not.toHaveBeenCalled();

      releasePut();
      await expect(settledRead).resolves.toEqual({
        key: "test_key",
        value: { count: 2 },
      });
      expect(readOperation).toHaveBeenCalledTimes(1);
    });

    it("does not start a settled read until a deferred hook write has replayed", async () => {
      mockTable._setStorage({
        preferences: {
          key: "preferences",
          value: { enabled: false },
        },
      });
      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: "preferences",
          initialValue: { enabled: false },
          idField: "key",
        })
      );
      await waitFor(() => expect(result.current[2]).toBe(false));

      let releaseMutation!: () => void;
      const mutationGate = new Promise<void>((resolve) => {
        releaseMutation = resolve;
      });
      const mutationStarted = vi.fn();
      const mutation = runWithDataWriteBarrier(async () => {
        mutationStarted();
        await mutationGate;
      });
      await waitFor(() => expect(mutationStarted).toHaveBeenCalledTimes(1));

      let releaseReplay!: () => void;
      const replayGate = new Promise<void>((resolve) => {
        releaseReplay = resolve;
      });
      const replayStarted = vi.fn();
      const originalPut = mockTable.put.getMockImplementation();
      mockTable.put.mockImplementationOnce(async (record) => {
        replayStarted();
        await replayGate;
        return originalPut?.(record);
      });

      act(() => {
        result.current[1]((previous) => ({ ...previous, enabled: true }));
      });
      const readOperation = vi.fn(async () => mockTable.get("preferences"));
      const settledRead = runWithSettledDataRead(readOperation);

      releaseMutation();
      await waitFor(() => expect(replayStarted).toHaveBeenCalledTimes(1));
      expect(readOperation).not.toHaveBeenCalled();

      releaseReplay();
      await mutation;
      await expect(settledRead).resolves.toEqual({
        key: "preferences",
        value: { enabled: true },
      });
      expect(readOperation).toHaveBeenCalledTimes(1);
    });

    it("waits for a newly queued authoritative mutation before running a settled read", async () => {
      let releaseFirst!: () => void;
      let releaseSecond!: () => void;
      const firstGate = new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      const secondGate = new Promise<void>((resolve) => {
        releaseSecond = resolve;
      });
      const secondStarted = vi.fn();

      const firstMutation = runWithDataWriteBarrier(async () => firstGate);
      await Promise.resolve();

      const readOperation = vi.fn(async () => "settled");
      let settledRead: Promise<string>;
      try {
        settledRead = runWithSettledDataRead(readOperation);
      } catch (error) {
        releaseFirst();
        releaseSecond();
        await firstMutation;
        throw error;
      }
      const secondMutation = runWithDataWriteBarrier(async () => {
        secondStarted();
        await secondGate;
      });

      releaseFirst();
      await waitFor(() => expect(secondStarted).toHaveBeenCalledTimes(1));
      expect(readOperation).not.toHaveBeenCalled();

      releaseSecond();
      await Promise.all([firstMutation, secondMutation]);
      await expect(settledRead).resolves.toBe("settled");
      expect(readOperation).toHaveBeenCalledTimes(1);
    });

    it("uses an origin-wide exclusive lock for authoritative mutations", async () => {
      const originalLocks = Object.getOwnPropertyDescriptor(navigator, "locks");
      const request = vi.fn(
        async <T>(
          _name: string,
          _options: { mode: "exclusive" },
          callback: (lock: unknown) => T | Promise<T>
        ): Promise<T> => callback({ name: "zenflow:data-write-barrier" })
      );
      Object.defineProperty(navigator, "locks", {
        configurable: true,
        value: { request },
      });

      try {
        await runWithDataWriteBarrier(async () => "done");
        expect(request).toHaveBeenCalledWith(
          "zenflow:data-write-barrier",
          { mode: "exclusive" },
          expect.any(Function)
        );
      } finally {
        if (originalLocks) {
          Object.defineProperty(navigator, "locks", originalLocks);
        } else {
          Reflect.deleteProperty(navigator, "locks");
        }
      }
    });

    it("resolves only after mounted hooks have reloaded their IndexedDB state", async () => {
      mockTable._setStorage({
        test_key: { key: "test_key", value: { count: 1 } },
      });
      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: "test_key",
          initialValue: { count: 0 },
          idField: "key",
        })
      );
      await waitFor(() => expect(result.current[0]).toEqual({ count: 1 }));

      mockTable._setStorage({
        test_key: { key: "test_key", value: { count: 2 } },
      });

      await act(async () => {
        const refresh = triggerDataRefresh();
        expect(refresh).toBeInstanceOf(Promise);
        await refresh;
      });

      expect(result.current[0]).toEqual({ count: 2 });
    });

    it("preserves the exact committed value in a typed post-commit refresh error", async () => {
      const unsubscribe = subscribeDataRefresh(async () => {
        throw new Error("refresh listener failed");
      });
      const committedValue = { id: "committed-object" };

      try {
        const outcome = await runWithDataWriteBarrier(async () => committedValue).then(
          () => null,
          (error: unknown) => error,
        );

        expect(outcome).toBeInstanceOf(DataWriteBarrierPostCommitError);
        expect(outcome).toMatchObject({
          code: "DATA_WRITE_BARRIER_POST_COMMIT",
          issueKinds: ["mounted-refresh"],
        });
        expect((outcome as DataWriteBarrierPostCommitError<typeof committedValue>).committedValue)
          .toBe(committedValue);
        expect(
          (outcome as DataWriteBarrierPostCommitError<typeof committedValue>)
            .capturedOriginGeneration,
        ).toEqual(expect.any(String));
      } finally {
        unsubscribe();
      }
    });

    it("rejects malformed and fully populated same-code post-commit forgeries", () => {
      const generation = captureOriginAccountBoundaryGeneration();
      const forgedErrors = [
        Object.assign(new Error("missing fields"), {
          code: "DATA_WRITE_BARRIER_POST_COMMIT",
        }),
        Object.assign(new Error("wrong issue"), {
          code: "DATA_WRITE_BARRIER_POST_COMMIT",
          committedValue: { id: "forged" },
          capturedOriginGeneration: generation,
          issueKinds: ["unknown-issue"],
        }),
        Object.assign(new Error("fully populated forgery"), {
          code: "DATA_WRITE_BARRIER_POST_COMMIT",
          committedValue: { id: "forged" },
          capturedOriginGeneration: generation,
          issueKinds: ["mounted-refresh"],
        }),
      ];

      for (const error of forgedErrors) {
        expect(isDataWriteBarrierPostCommitError(error)).toBe(false);
      }
    });

    it("keeps the default refresh failure policy when a log-only mutation shares its queue", async () => {
      let releaseFirstMutation!: () => void;
      const firstMutationGate = new Promise<void>((resolve) => {
        releaseFirstMutation = resolve;
      });
      const firstMutationStarted = vi.fn();
      const unsubscribe = subscribeDataRefresh(async () => {
        throw new Error("shared refresh failed");
      });

      try {
        const firstMutation = runWithDataWriteBarrier(async () => {
          firstMutationStarted();
          await firstMutationGate;
          return "first";
        });
        await waitFor(() => expect(firstMutationStarted).toHaveBeenCalledTimes(1));
        const logOnlyMutation = runWithDataWriteBarrier(async () => "second", {
          refreshFailure: "log",
        });

        releaseFirstMutation();
        await expect(firstMutation).resolves.toBe("first");
        await expect(logOnlyMutation).rejects.toMatchObject({
          code: "DATA_WRITE_BARRIER_POST_COMMIT",
          committedValue: "second",
          issueKinds: ["mounted-refresh"],
        });
      } finally {
        unsubscribe();
      }
    });

    it("reloads data for all hooks", async () => {
      mockTable._setStorage({
        test_key: { key: "test_key", value: { count: 1 } },
      });

      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: "test_key",
          initialValue: { count: 0 },
          idField: "key",
        })
      );

      await waitFor(() => {
        expect(result.current[2]).toBe(false);
      });

      expect(result.current[0]).toEqual({ count: 1 });

      // Update storage externally
      mockTable._setStorage({
        test_key: { key: "test_key", value: { count: 999 } },
      });

      // Trigger refresh
      await act(async () => {
        await triggerDataRefresh();
      });

      await waitFor(() => {
        expect(result.current[0]).toEqual({ count: 999 });
      });
    });

    it("clears stale array state and fallback when an external sync leaves the table empty", async () => {
      const items = [
        { id: "1", name: "Item 1" },
        { id: "2", name: "Item 2" },
      ];
      mockTable._setStorage({
        item_0: items[0],
        item_1: items[1],
      });
      localStorageMock.items = JSON.stringify(items);

      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: "items",
          initialValue: [] as Array<{ id: string; name: string }>,
          idField: "id",
        })
      );

      await waitFor(() => {
        expect(result.current[0]).toHaveLength(2);
      });

      mockTable._setStorage({});

      await act(async () => {
        await triggerDataRefresh();
      });

      await waitFor(() => {
        expect(result.current[0]).toEqual([]);
      });
      expect(localStorageMock.items).toBe(JSON.stringify([]));
    });

    it("clears stale setting state and fallback when an external sync deletes the key", async () => {
      mockTable._setStorage({
        test_key: { key: "test_key", value: { count: 1 } },
      });
      localStorageMock.test_key = JSON.stringify({ count: 1 });

      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: "test_key",
          initialValue: { count: 0 },
          idField: "key",
        })
      );

      await waitFor(() => {
        expect(result.current[0]).toEqual({ count: 1 });
      });

      mockTable._setStorage({});

      await act(async () => {
        await triggerDataRefresh();
      });

      await waitFor(() => {
        expect(result.current[0]).toEqual({ count: 0 });
      });
      expect(localStorageMock.test_key).toBe(JSON.stringify({ count: 0 }));
    });

    it("replays a local array edit over authoritative remote additions", async () => {
      const local = { id: "local", name: "Before" };
      const remote = { id: "remote", name: "From cloud" };
      mockTable._setStorage({ local });

      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: "items",
          initialValue: [] as Array<{ id: string; name: string }>,
          idField: "id",
        })
      );
      await waitFor(() => expect(result.current[0]).toEqual([local]));

      let releaseMutation!: () => void;
      const mutationGate = new Promise<void>((resolve) => {
        releaseMutation = resolve;
      });
      const mutation = runWithDataWriteBarrier(async () => {
        mockTable._setStorage({ local, remote });
        await mutationGate;
      });
      await Promise.resolve();

      act(() => {
        result.current[1]([{ id: "local", name: "Edited locally" }]);
      });
      expect(result.current[0]).toEqual([local]);

      await act(async () => {
        releaseMutation();
        await mutation;
      });

      await waitFor(() =>
        expect(result.current[0]).toEqual(
          expect.arrayContaining([{ id: "local", name: "Edited locally" }, remote])
        )
      );
      expect(Object.values(mockTable._getStorage())).toEqual(
        expect.arrayContaining([{ id: "local", name: "Edited locally" }, remote])
      );
    });

    it("composes multiple deferred setting updates over authoritative fields", async () => {
      mockTable._setStorage({
        preferences: {
          key: "preferences",
          value: { first: false, second: false },
        },
      });
      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: "preferences",
          initialValue: { first: false, second: false, remote: false },
          idField: "key",
        })
      );
      await waitFor(() =>
        expect(result.current[0]).toEqual({ first: false, second: false, remote: false })
      );

      let releaseMutation!: () => void;
      const mutationGate = new Promise<void>((resolve) => {
        releaseMutation = resolve;
      });
      const mutation = runWithDataWriteBarrier(async () => {
        mockTable._setStorage({
          preferences: {
            key: "preferences",
            value: { first: false, second: false, remote: true },
          },
        });
        await mutationGate;
      });
      await Promise.resolve();

      act(() => {
        result.current[1]((previous) => ({ ...previous, first: true }));
        result.current[1]((previous) => ({ ...previous, second: true }));
      });

      await act(async () => {
        releaseMutation();
        await mutation;
      });

      await waitFor(() =>
        expect(result.current[0]).toEqual({ first: true, second: true, remote: true })
      );
    });

    it("reports every failed deferred replay once without retaining automatic retries", async () => {
      mockTable._setStorage({
        preferences: {
          key: "preferences",
          value: { local: false, remote: false },
        },
      });
      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: "preferences",
          initialValue: { local: false, remote: false },
          idField: "key",
        })
      );
      await waitFor(() => expect(result.current[0]).toEqual({ local: false, remote: false }));

      let releaseMutation!: () => void;
      const mutationGate = new Promise<void>((resolve) => {
        releaseMutation = resolve;
      });
      const mutation = runWithDataWriteBarrier(async () => {
        mockTable._setStorage({
          preferences: {
            key: "preferences",
            value: { local: false, remote: true },
          },
        });
        await mutationGate;
      });
      await Promise.resolve();

      const secondTable = createMockTable({
        appearance: {
          key: "appearance",
          value: { dim: false },
        },
      });
      const secondHook = renderHook(() =>
        useIndexedDB({
          table: secondTable as any,
          localStorageKey: "appearance",
          initialValue: { dim: false },
          idField: "key",
        }),
      );
      await waitFor(() => expect(secondHook.result.current[2]).toBe(false));

      mockTable.put.mockRejectedValueOnce(new Error("first replay failed"));
      secondTable.put.mockRejectedValueOnce(new Error("second replay failed"));
      const legacyRetryEvent = vi.fn();
      window.addEventListener("zenflow:deferred-data-write-blocked", legacyRetryEvent);
      act(() => {
        result.current[1]((previous) => ({ ...previous, local: true }));
        secondHook.result.current[1]((previous) => ({ ...previous, dim: true }));
      });

      releaseMutation();
      await expect(mutation).rejects.toMatchObject({
        code: "DATA_WRITE_BARRIER_POST_COMMIT",
        issueKinds: ["deferred-write-replay", "deferred-write-replay"],
      });
      expect(mockTable.put).toHaveBeenCalledTimes(1);
      expect(secondTable.put).toHaveBeenCalledTimes(1);
      expect(legacyRetryEvent).not.toHaveBeenCalled();

      const readOperation = vi.fn(async () => "settled-after-failure");
      await expect(
        Promise.race([
          runWithSettledDataRead(readOperation),
          new Promise<string>((resolve) => setTimeout(() => resolve("timed-out"), 50)),
        ]),
      ).resolves.toBe("settled-after-failure");
      expect(readOperation).toHaveBeenCalledTimes(1);

      window.removeEventListener("zenflow:deferred-data-write-blocked", legacyRetryEvent);
      secondHook.unmount();
    });

    it("replays a setting write accepted while the final mounted refresh is pending", async () => {
      mockTable._setStorage({
        preferences: {
          key: "preferences",
          value: { local: false, remote: false },
        },
      });
      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: "preferences",
          initialValue: { local: false, remote: false },
          idField: "key",
        }),
      );
      await waitFor(() => expect(result.current[2]).toBe(false));

      let releaseFirstRefresh!: () => void;
      let markFirstRefreshStarted!: () => void;
      const firstRefreshGate = new Promise<void>((resolve) => {
        releaseFirstRefresh = resolve;
      });
      const firstRefreshStarted = new Promise<void>((resolve) => {
        markFirstRefreshStarted = resolve;
      });
      let refreshCalls = 0;
      const unsubscribe = subscribeDataRefresh(async () => {
        refreshCalls += 1;
        if (refreshCalls !== 1) return;
        markFirstRefreshStarted();
        await firstRefreshGate;
      });

      try {
        const mutation = runWithDataWriteBarrier(async () => {
          mockTable._setStorage({
            preferences: {
              key: "preferences",
              value: { local: false, remote: true },
            },
          });
        });
        await firstRefreshStarted;

        act(() => {
          result.current[1]((previous) => ({ ...previous, local: true }));
        });
        releaseFirstRefresh();
        await mutation;

        const settledRead = runWithSettledDataRead(async () => "settled");
        const settlementBeforeFollowUp = await Promise.race([
          settledRead,
          new Promise<string>((resolve) => setTimeout(() => resolve("timed-out"), 50)),
        ]);
        const storageBeforeFollowUp = mockTable._getStorage();

        // Always clean a pre-fix orphaned queue before the test exits.
        await runWithDataWriteBarrier(async () => undefined);
        await settledRead;

        expect(settlementBeforeFollowUp).toBe("settled");
        expect(storageBeforeFollowUp).toEqual({
          preferences: {
            key: "preferences",
            value: { local: true, remote: true },
          },
        });
        expect(refreshCalls).toBeGreaterThanOrEqual(2);
        expect(result.current[0]).toEqual({ local: true, remote: true });
      } finally {
        unsubscribe();
      }
    });

    it("discards a setting write accepted while an account purge refresh is pending", async () => {
      mockTable._setStorage({
        preferences: {
          key: "preferences",
          value: { owner: "account-a" },
        },
      });
      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: "preferences",
          initialValue: { owner: "none" },
          idField: "key",
        }),
      );
      await waitFor(() => expect(result.current[2]).toBe(false));

      let releaseFirstRefresh!: () => void;
      let markFirstRefreshStarted!: () => void;
      const firstRefreshGate = new Promise<void>((resolve) => {
        releaseFirstRefresh = resolve;
      });
      const firstRefreshStarted = new Promise<void>((resolve) => {
        markFirstRefreshStarted = resolve;
      });
      let refreshCalls = 0;
      const unsubscribe = subscribeDataRefresh(async () => {
        refreshCalls += 1;
        if (refreshCalls !== 1) return;
        markFirstRefreshStarted();
        await firstRefreshGate;
      });

      try {
        const purge = runWithDataWriteBarrier(
          async () => {
            mockTable._setStorage({});
          },
          { deferredWrites: "discard" },
        );
        await firstRefreshStarted;

        act(() => {
          result.current[1]({ owner: "expired-account-action" });
        });
        releaseFirstRefresh();
        await purge;

        const settledRead = runWithSettledDataRead(async () => "settled");
        const settlementBeforeFollowUp = await Promise.race([
          settledRead,
          new Promise<string>((resolve) => setTimeout(() => resolve("timed-out"), 50)),
        ]);

        // A later ordinary barrier must never inherit and replay the purge's
        // expired action. It also cleans the orphan in the pre-fix RED state.
        await runWithDataWriteBarrier(async () => undefined);
        await settledRead;

        expect(settlementBeforeFollowUp).toBe("settled");
        expect(mockTable._getStorage()).toEqual({});
        expect(refreshCalls).toBeGreaterThanOrEqual(2);
        expect(result.current[0]).toEqual({ owner: "none" });
      } finally {
        unsubscribe();
      }
    });

    it("settles the deferred queue at the refresh-pass cutoff without starving reads", async () => {
      mockTable._setStorage({
        preferences: {
          key: "preferences",
          value: { revision: 0 },
        },
      });
      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: "preferences",
          initialValue: { revision: 0 },
          idField: "key",
        }),
      );
      await waitFor(() => expect(result.current[2]).toBe(false));

      let refreshCalls = 0;
      const unsubscribe = subscribeDataRefresh(async () => {
        refreshCalls += 1;
        act(() => {
          result.current[1]((previous) => ({ revision: previous.revision + 1 }));
        });
      });

      const outcome = await runWithDataWriteBarrier(async () => "committed").then(
        () => null,
        (error: unknown) => error,
      );
      unsubscribe();

      const settledRead = runWithSettledDataRead(async () => "settled");
      const settlementBeforeFollowUp = await Promise.race([
        settledRead,
        new Promise<string>((resolve) => setTimeout(() => resolve("timed-out"), 50)),
      ]);

      // Always clear the one orphan left by the pre-fix implementation.
      await runWithDataWriteBarrier(async () => undefined);
      await settledRead;

      expect(outcome).toBeInstanceOf(DataWriteBarrierPostCommitError);
      expect(outcome).toMatchObject({
        code: "DATA_WRITE_BARRIER_POST_COMMIT",
        committedValue: "committed",
        issueKinds: ["mounted-refresh"],
      });
      expect(settlementBeforeFollowUp).toBe("settled");
      expect(refreshCalls).toBeGreaterThan(1);
      expect(refreshCalls).toBeLessThan(20);
    });

    it("discards the final expired-account shadow at the refresh-pass cutoff", async () => {
      mockTable._setStorage({
        preferences: {
          key: "preferences",
          value: { owner: "account-a" },
        },
      });
      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: "preferences",
          initialValue: { owner: "none" },
          idField: "key",
        }),
      );
      await waitFor(() => expect(result.current[2]).toBe(false));

      let refreshCalls = 0;
      const unsubscribe = subscribeDataRefresh(async () => {
        refreshCalls += 1;
        act(() => {
          result.current[1]({ owner: `expired-action-${refreshCalls}` });
        });
      });

      const outcome = await runWithDataWriteBarrier(
        async () => {
          mockTable._setStorage({});
          return "purged";
        },
        { deferredWrites: "discard" },
      ).then(
        () => null,
        (error: unknown) => error,
      );
      unsubscribe();

      const settlement = await Promise.race([
        runWithSettledDataRead(async () => "settled"),
        new Promise<string>((resolve) => setTimeout(() => resolve("timed-out"), 50)),
      ]);
      await runWithDataWriteBarrier(async () => undefined);

      expect(outcome).toBeInstanceOf(DataWriteBarrierPostCommitError);
      expect(outcome).toMatchObject({
        code: "DATA_WRITE_BARRIER_POST_COMMIT",
        committedValue: "purged",
        issueKinds: ["mounted-refresh"],
      });
      expect(settlement).toBe("settled");
      expect(mockTable._getStorage()).toEqual({});
      expect(result.current[0]).toEqual({ owner: "none" });
      expect(refreshCalls).toBeGreaterThan(1);
      expect(refreshCalls).toBeLessThan(20);
    });

    it("aborts a never-settling refresh listener and releases DATA after 25 seconds", async () => {
      vi.useFakeTimers();
      let releaseListener!: () => void;
      let markListenerStarted!: () => void;
      let capturedSignal: AbortSignal | undefined;
      const listenerGate = new Promise<void>((resolve) => {
        releaseListener = resolve;
      });
      const listenerStarted = new Promise<void>((resolve) => {
        markListenerStarted = resolve;
      });
      const unsubscribe = subscribeDataRefresh(async (signal?: AbortSignal) => {
        capturedSignal = signal;
        markListenerStarted();
        await listenerGate;
      });

      try {
        let capturedOutcome:
          | { status: "resolved"; value: { id: string } }
          | { status: "rejected"; error: unknown }
          | undefined;
        const committedValue = { id: "deadline-committed" };
        const outcomePromise = runWithDataWriteBarrier(async () => committedValue).then(
          (value) => ({ status: "resolved" as const, value }),
          (error: unknown) => ({ status: "rejected" as const, error }),
        );
        void outcomePromise.then((outcome) => {
          capturedOutcome = outcome;
        });
        await listenerStarted;

        await vi.advanceTimersByTimeAsync(25_000);
        await Promise.resolve();
        const settledAtDeadline = capturedOutcome !== undefined;

        // Pre-fix cleanup: the listener had no signal/deadline and still owned DATA.
        releaseListener();
        const outcome = await outcomePromise;
        unsubscribe();

        await expect(runWithSettledDataRead(async () => "settled")).resolves.toBe("settled");
        await expect(
          runWithDataWriteBarrier(async () => "purged", { deferredWrites: "discard" }),
        ).resolves.toBe("purged");

        expect(settledAtDeadline).toBe(true);
        expect(capturedSignal?.aborted).toBe(true);
        expect(outcome.status).toBe("rejected");
        if (outcome.status === "rejected") {
          expect(outcome.error).toBeInstanceOf(DataWriteBarrierPostCommitError);
          expect(outcome.error).toMatchObject({
            code: "DATA_WRITE_BARRIER_POST_COMMIT",
            committedValue,
            issueKinds: ["mounted-refresh"],
          });
        }
      } finally {
        releaseListener();
        unsubscribe();
        vi.useRealTimers();
      }
    });

    it("clears an early refresh deadline without aborting a settled listener later", async () => {
      vi.useFakeTimers();
      let capturedSignal: AbortSignal | undefined;
      const unsubscribe = subscribeDataRefresh(async (signal) => {
        capturedSignal = signal;
      });

      try {
        await triggerDataRefresh();

        expect(vi.getTimerCount()).toBe(0);
        expect(capturedSignal?.aborted).toBe(false);

        await vi.advanceTimersByTimeAsync(DATA_REFRESH_LISTENER_TIMEOUT_MS);

        expect(capturedSignal?.aborted).toBe(false);
        expect(vi.getTimerCount()).toBe(0);
      } finally {
        unsubscribe();
        vi.useRealTimers();
      }
    });

    it("handles a listener rejection that arrives after its refresh deadline", async () => {
      vi.useFakeTimers();
      const unhandledRejection = vi.fn();
      process.on("unhandledRejection", unhandledRejection);
      let rejectLateListener!: (reason: unknown) => void;
      let markListenerStarted!: () => void;
      const listenerStarted = new Promise<void>((resolve) => {
        markListenerStarted = resolve;
      });
      const lateListener = new Promise<void>((_resolve, reject) => {
        rejectLateListener = reject;
      });
      const unsubscribe = subscribeDataRefresh(async () => {
        markListenerStarted();
        await lateListener;
      });

      try {
        const refreshOutcome = triggerDataRefresh().then(
          () => null,
          (error: unknown) => error,
        );
        await listenerStarted;

        await vi.advanceTimersByTimeAsync(DATA_REFRESH_LISTENER_TIMEOUT_MS);
        await expect(refreshOutcome).resolves.toMatchObject({
          code: "DATA_REFRESH_LISTENER_TIMEOUT",
        });

        rejectLateListener(new Error("late refresh rejection"));
        for (let index = 0; index < 5; index += 1) await Promise.resolve();

        expect(unhandledRejection).not.toHaveBeenCalled();
        await expect(runWithSettledDataRead(async () => "settled")).resolves.toBe("settled");
      } finally {
        rejectLateListener(new Error("late refresh cleanup"));
        process.off("unhandledRejection", unhandledRejection);
        unsubscribe();
        vi.useRealTimers();
      }
    });

    it("fences a timed-out IndexedDB refresh from late state and migration commits", async () => {
      type VersionedPreference = { owner: string; schemaVersion: number };
      const initialValue: VersionedPreference = { owner: "none", schemaVersion: 2 };
      mockTable._setStorage({
        preferences: {
          key: "preferences",
          value: { owner: "before", schemaVersion: 2 },
        },
      });
      const { result } = renderHook(() =>
        useIndexedDB<VersionedPreference>({
          table: mockTable as any,
          localStorageKey: "preferences",
          initialValue,
          idField: "key",
          migrateStoredValue: (value) =>
            value && typeof value === "object" && !Array.isArray(value)
              ? { ...value, schemaVersion: 2 }
              : value,
        }),
      );
      await waitFor(() =>
        expect(result.current[0]).toEqual({ owner: "before", schemaVersion: 2 }),
      );

      vi.useFakeTimers();
      let resolveLateRead!: (value: unknown) => void;
      let markLateReadStarted!: () => void;
      const lateRead = new Promise<unknown>((resolve) => {
        resolveLateRead = resolve;
      });
      const lateReadStarted = new Promise<void>((resolve) => {
        markLateReadStarted = resolve;
      });
      mockTable.get.mockImplementationOnce(async () => {
        markLateReadStarted();
        return lateRead;
      });

      try {
        let capturedOutcome:
          | { status: "resolved"; value: string }
          | { status: "rejected"; error: unknown }
          | undefined;
        const outcomePromise = runWithDataWriteBarrier(async () => {
          mockTable._setStorage({
            preferences: {
              key: "preferences",
              value: { owner: "late-account-a", schemaVersion: 1 },
            },
          });
          return "committed";
        }).then(
          (value) => ({ status: "resolved" as const, value }),
          (error: unknown) => ({ status: "rejected" as const, error }),
        );
        void outcomePromise.then((outcome) => {
          capturedOutcome = outcome;
        });
        await lateReadStarted;

        await vi.advanceTimersByTimeAsync(25_000);
        await Promise.resolve();
        const settledAtDeadline = capturedOutcome !== undefined;

        await act(async () => {
          resolveLateRead({
            key: "preferences",
            value: { owner: "late-account-a", schemaVersion: 1 },
          });
          await lateRead;
          for (let index = 0; index < 5; index += 1) await Promise.resolve();
        });
        const outcome = await outcomePromise;

        await expect(runWithSettledDataRead(async () => "settled")).resolves.toBe("settled");
        await act(async () => {
          await runWithDataWriteBarrier(
            async () => {
              mockTable._setStorage({});
            },
            { deferredWrites: "discard" },
          );
        });

        expect(settledAtDeadline).toBe(true);
        expect(outcome.status).toBe("rejected");
        if (outcome.status === "rejected") {
          expect(outcome.error).toMatchObject({
            code: "DATA_WRITE_BARRIER_POST_COMMIT",
            committedValue: "committed",
            issueKinds: ["mounted-refresh"],
          });
        }
        expect(mockTable.put).not.toHaveBeenCalled();
        expect(localStorageMock.preferences).toBe(JSON.stringify({ owner: "none", schemaVersion: 2 }));
        expect(result.current[0]).toEqual(initialValue);
      } finally {
        resolveLateRead({
          key: "preferences",
          value: { owner: "late-account-a", schemaVersion: 1 },
        });
        vi.useRealTimers();
      }
    });

    it("keeps the mutation failure primary when deferred finalization also fails", async () => {
      mockTable._setStorage({
        preferences: {
          key: "preferences",
          value: { local: false },
        },
      });
      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: "preferences",
          initialValue: { local: false },
          idField: "key",
        }),
      );
      await waitFor(() => expect(result.current[2]).toBe(false));

      let releaseMutation!: () => void;
      const mutationGate = new Promise<void>((resolve) => {
        releaseMutation = resolve;
      });
      const mutation = runWithDataWriteBarrier(async () => {
        await mutationGate;
        throw new Error("authoritative mutation failed");
      });
      const mutationOutcome = mutation.then(
        () => null,
        (reason: unknown) => reason,
      );
      await Promise.resolve();

      mockTable.put.mockRejectedValueOnce(new Error("deferred replay also failed"));
      act(() => result.current[1]({ local: true }));
      releaseMutation();

      const error = await mutationOutcome;
      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(DataWriteBarrierPostCommitError);
      expect(error).toMatchObject({ message: "authoritative mutation failed" });
      expect(error).not.toHaveProperty("committedValue");
      expect(mockTable.put).toHaveBeenCalledTimes(1);
    });

    it("rejects an authoritative mutation when a deferred collection replay cannot commit", async () => {
      const local = { id: "local", name: "Before" };
      const remote = { id: "remote", name: "From cloud" };
      mockTable._setStorage({ local });
      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: "items",
          initialValue: [] as Array<{ id: string; name: string }>,
          idField: "id",
        })
      );
      await waitFor(() => expect(result.current[0]).toEqual([local]));

      let releaseMutation!: () => void;
      const mutationGate = new Promise<void>((resolve) => {
        releaseMutation = resolve;
      });
      const mutation = runWithDataWriteBarrier(async () => {
        mockTable._setStorage({ local, remote });
        await mutationGate;
      });
      await Promise.resolve();

      mockTable.bulkPut.mockRejectedValueOnce(new Error("deferred collection replay failed"));
      act(() => {
        result.current[1]([{ id: "local", name: "Edited locally" }]);
      });

      releaseMutation();
      await expect(mutation).rejects.toMatchObject({
        code: "DATA_WRITE_BARRIER_POST_COMMIT",
        issueKinds: ["deferred-write-replay"],
      });
    });

    it("discards writes attempted during an account-boundary purge", async () => {
      mockTable._setStorage({
        test_key: { key: "test_key", value: { owner: "account-a" } },
      });
      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: "test_key",
          initialValue: { owner: "none" },
          idField: "key",
        })
      );
      await waitFor(() => expect(result.current[0]).toEqual({ owner: "account-a" }));

      let releaseMutation!: () => void;
      const mutationGate = new Promise<void>((resolve) => {
        releaseMutation = resolve;
      });
      const mutation = runWithDataWriteBarrier(
        async () => {
          mockTable._setStorage({});
          await mutationGate;
        },
        { deferredWrites: "discard" }
      );
      await Promise.resolve();

      act(() => {
        result.current[1]({ owner: "account-a-write-during-purge" });
      });

      await act(async () => {
        releaseMutation();
        await mutation;
      });

      await waitFor(() => expect(result.current[0]).toEqual({ owner: "none" }));
      expect(mockTable._getStorage()).toEqual({});
    });

    it("discards a stale account-A read that resolves after an account-boundary purge", async () => {
      const accountAItem = { id: "account-a", name: "Private A data" };
      mockTable._setStorage({ [accountAItem.id]: accountAItem });

      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: "items",
          initialValue: [] as Array<{ id: string; name: string }>,
          idField: "id",
        })
      );
      await waitFor(() => expect(result.current[0]).toEqual([accountAItem]));

      let releaseStaleRead!: () => void;
      const staleReadGate = new Promise<void>((resolve) => {
        releaseStaleRead = resolve;
      });
      let deferNextRead = true;
      mockTable.toArray.mockImplementation(async () => {
        if (deferNextRead) {
          deferNextRead = false;
          const staleSnapshot = [accountAItem];
          await staleReadGate;
          return staleSnapshot;
        }
        return Object.values(mockTable._getStorage());
      });

      const staleRefresh = triggerDataRefresh();
      await Promise.resolve();

      await act(async () => {
        await runWithDataWriteBarrier(
          async () => {
            mockTable._setStorage({});
          },
          { deferredWrites: "discard" }
        );
      });

      await waitFor(() => expect(result.current[0]).toEqual([]));
      expect(localStorageMock.items).toBe(JSON.stringify([]));

      await act(async () => {
        releaseStaleRead();
        await staleRefresh;
      });

      expect(result.current[0]).toEqual([]);
      expect(localStorageMock.items).toBe(JSON.stringify([]));
    });
  });

  describe("error handling", () => {
    it("handles IndexedDB errors gracefully", async () => {
      const errorTable = {
        ...mockTable,
        get: vi.fn(() => Promise.reject(new Error("IndexedDB error"))),
      };

      // Set localStorage fallback
      localStorageMock["test_key"] = JSON.stringify({ count: 50 });

      const { result } = renderHook(() =>
        useIndexedDB({
          table: errorTable as any,
          localStorageKey: "test_key",
          initialValue: { count: 0 },
          idField: "key",
        })
      );

      await waitFor(() => {
        expect(result.current[2]).toBe(false);
      });

      // Should fall back to localStorage
      expect(result.current[0]).toEqual({ count: 50 });
    });

    it("handles localStorage errors gracefully", async () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("localStorage not available");
      });

      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: "test_key",
          initialValue: { count: 0 },
          idField: "key",
        })
      );

      await waitFor(() => {
        expect(result.current[2]).toBe(false);
      });

      // Should use initial value when both fail
      expect(result.current[0]).toEqual({ count: 0 });
    });
  });
});
