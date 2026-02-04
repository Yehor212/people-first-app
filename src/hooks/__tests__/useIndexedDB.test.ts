/**
 * useIndexedDB Hook Tests
 * Tests data persistence, fallbacks, and error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useIndexedDB, triggerDataRefresh } from '../useIndexedDB';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Create mock table factory
const createMockTable = (initialData: Record<string, unknown> = {}) => {
  let storage: Record<string, unknown> = { ...initialData };

  return {
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
        storage[`item_${i}`] = item;
      });
      return Promise.resolve();
    }),
    _getStorage: () => storage,
    _setStorage: (data: Record<string, unknown>) => { storage = data; },
  };
};

describe('useIndexedDB', () => {
  let mockTable: ReturnType<typeof createMockTable>;
  let localStorageMock: Record<string, string>;

  beforeEach(() => {
    mockTable = createMockTable();
    localStorageMock = {};

    // Mock localStorage
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(
      (key) => localStorageMock[key] || null
    );
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(
      (key, value) => { localStorageMock[key] = value; }
    );
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(
      (key) => { delete localStorageMock[key]; }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial loading', () => {
    it('returns initial value while loading', async () => {
      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: 'test_key',
          initialValue: { count: 0 },
          idField: 'key',
        })
      );

      // Initially returns initial value
      expect(result.current[0]).toEqual({ count: 0 });
      // isLoading is initially true
      expect(result.current[2]).toBe(true);
    });

    it('loads data from IndexedDB on mount', async () => {
      mockTable._setStorage({
        test_key: { key: 'test_key', value: { count: 42 } },
      });

      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: 'test_key',
          initialValue: { count: 0 },
          idField: 'key',
        })
      );

      await waitFor(() => {
        expect(result.current[2]).toBe(false); // isLoading
      });

      expect(result.current[0]).toEqual({ count: 42 });
    });

    it('merges loaded data with initialValue for objects', async () => {
      // Stored data is missing some fields
      mockTable._setStorage({
        test_key: { key: 'test_key', value: { name: 'Test' } },
      });

      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: 'test_key',
          initialValue: { name: '', count: 0, active: true },
          idField: 'key',
        })
      );

      await waitFor(() => {
        expect(result.current[2]).toBe(false);
      });

      // Should have merged values
      expect(result.current[0]).toEqual({
        name: 'Test',
        count: 0,
        active: true,
      });
    });

    it('does not merge primitives', async () => {
      mockTable._setStorage({
        test_key: { key: 'test_key', value: 'stored_string' },
      });

      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: 'test_key',
          initialValue: 'default',
          idField: 'key',
        })
      );

      await waitFor(() => {
        expect(result.current[2]).toBe(false);
      });

      expect(result.current[0]).toBe('stored_string');
    });

    it('does not merge arrays', async () => {
      mockTable._setStorage({
        test_key: { key: 'test_key', value: [1, 2, 3] },
      });

      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: 'test_key',
          initialValue: [] as number[],
          idField: 'key',
        })
      );

      await waitFor(() => {
        expect(result.current[2]).toBe(false);
      });

      expect(result.current[0]).toEqual([1, 2, 3]);
    });
  });

  describe('localStorage fallback', () => {
    it('falls back to localStorage when IndexedDB is empty', async () => {
      localStorageMock['test_key'] = JSON.stringify({ count: 99 });

      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: 'test_key',
          initialValue: { count: 0 },
          idField: 'key',
        })
      );

      await waitFor(() => {
        expect(result.current[2]).toBe(false);
      });

      expect(result.current[0]).toEqual({ count: 99 });
    });

    it('migrates localStorage data to IndexedDB', async () => {
      localStorageMock['test_key'] = JSON.stringify({ count: 99 });

      renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: 'test_key',
          initialValue: { count: 0 },
          idField: 'key',
        })
      );

      await waitFor(() => {
        expect(mockTable.put).toHaveBeenCalled();
      });
    });
  });

  describe('setValue', () => {
    it('updates state immediately', async () => {
      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: 'test_key',
          initialValue: { count: 0 },
          idField: 'key',
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

    it('accepts function updater', async () => {
      mockTable._setStorage({
        test_key: { key: 'test_key', value: { count: 5 } },
      });

      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: 'test_key',
          initialValue: { count: 0 },
          idField: 'key',
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

    it('persists to IndexedDB', async () => {
      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: 'test_key',
          initialValue: { count: 0 },
          idField: 'key',
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
          key: 'test_key',
          value: { count: 100 },
        });
      });
    });

    it('backs up to localStorage', async () => {
      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: 'test_key',
          initialValue: { count: 0 },
          idField: 'key',
        })
      );

      await waitFor(() => {
        expect(result.current[2]).toBe(false);
      });

      act(() => {
        result.current[1]({ count: 100 });
      });

      await waitFor(() => {
        expect(localStorageMock['test_key']).toBe(JSON.stringify({ count: 100 }));
      });
    });
  });

  describe('array data', () => {
    it('loads array data from IndexedDB', async () => {
      const items = [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' },
      ];
      mockTable._setStorage({
        item_0: items[0],
        item_1: items[1],
      });

      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: 'items',
          initialValue: [] as Array<{ id: string; name: string }>,
          idField: 'id',
        })
      );

      await waitFor(() => {
        expect(result.current[2]).toBe(false);
      });

      expect(result.current[0]).toHaveLength(2);
    });

    it('clears table before saving array', async () => {
      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: 'items',
          initialValue: [] as Array<{ id: string; name: string }>,
          idField: 'id',
        })
      );

      await waitFor(() => {
        expect(result.current[2]).toBe(false);
      });

      act(() => {
        result.current[1]([{ id: '1', name: 'New Item' }]);
      });

      await waitFor(() => {
        expect(mockTable.clear).toHaveBeenCalled();
        expect(mockTable.bulkPut).toHaveBeenCalled();
      });
    });
  });

  describe('triggerDataRefresh', () => {
    it('reloads data for all hooks', async () => {
      mockTable._setStorage({
        test_key: { key: 'test_key', value: { count: 1 } },
      });

      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: 'test_key',
          initialValue: { count: 0 },
          idField: 'key',
        })
      );

      await waitFor(() => {
        expect(result.current[2]).toBe(false);
      });

      expect(result.current[0]).toEqual({ count: 1 });

      // Update storage externally
      mockTable._setStorage({
        test_key: { key: 'test_key', value: { count: 999 } },
      });

      // Trigger refresh
      act(() => {
        triggerDataRefresh();
      });

      await waitFor(() => {
        expect(result.current[0]).toEqual({ count: 999 });
      });
    });
  });

  describe('error handling', () => {
    it('handles IndexedDB errors gracefully', async () => {
      const errorTable = {
        ...mockTable,
        get: vi.fn(() => Promise.reject(new Error('IndexedDB error'))),
      };

      // Set localStorage fallback
      localStorageMock['test_key'] = JSON.stringify({ count: 50 });

      const { result } = renderHook(() =>
        useIndexedDB({
          table: errorTable as any,
          localStorageKey: 'test_key',
          initialValue: { count: 0 },
          idField: 'key',
        })
      );

      await waitFor(() => {
        expect(result.current[2]).toBe(false);
      });

      // Should fall back to localStorage
      expect(result.current[0]).toEqual({ count: 50 });
    });

    it('handles localStorage errors gracefully', async () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('localStorage not available');
      });

      const { result } = renderHook(() =>
        useIndexedDB({
          table: mockTable as any,
          localStorageKey: 'test_key',
          initialValue: { count: 0 },
          idField: 'key',
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
