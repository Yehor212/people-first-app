/**
 * useIndexedDB Hook Tests
 * Tests data persistence, fallbacks, and error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { runWithDataWriteBarrier, useIndexedDB, triggerDataRefresh } from "../useIndexedDB";

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

    it("rejects an authoritative mutation when a deferred setting replay cannot commit", async () => {
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
      await waitFor(() =>
        expect(result.current[0]).toEqual({ local: false, remote: false })
      );

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

      mockTable.put.mockRejectedValueOnce(new Error("deferred setting replay failed"));
      act(() => {
        result.current[1]((previous) => ({ ...previous, local: true }));
      });

      releaseMutation();
      await expect(mutation).rejects.toThrow("deferred setting replay failed");
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
      await expect(mutation).rejects.toThrow("deferred collection replay failed");
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
