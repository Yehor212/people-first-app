/**
 * useInfiniteScroll Hook Tests
 * Tests pagination, loading states, and Intersection Observer
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useInfiniteScroll } from '../useInfiniteScroll';

// Mock IntersectionObserver
class MockIntersectionObserver {
  callback: IntersectionObserverCallback;
  elements: Set<Element> = new Set();

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    mockObserverInstances.push(this);
  }

  observe(element: Element) {
    this.elements.add(element);
  }

  unobserve(element: Element) {
    this.elements.delete(element);
  }

  disconnect() {
    this.elements.clear();
  }

  // Helper to simulate intersection
  triggerIntersect(isIntersecting: boolean) {
    const entries = Array.from(this.elements).map(element => ({
      target: element,
      isIntersecting,
      boundingClientRect: {} as DOMRectReadOnly,
      intersectionRatio: isIntersecting ? 1 : 0,
      intersectionRect: {} as DOMRectReadOnly,
      rootBounds: null,
      time: Date.now(),
    }));
    this.callback(entries, this as unknown as IntersectionObserver);
  }
}

let mockObserverInstances: MockIntersectionObserver[] = [];

describe('useInfiniteScroll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockObserverInstances = [];
    global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('returns initial state', () => {
      const fetchFn = vi.fn(() => Promise.resolve([]));

      const { result } = renderHook(() =>
        useInfiniteScroll({
          fetchFn,
          autoLoad: false,
        })
      );

      expect(result.current.items).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.hasMore).toBe(true);
      expect(result.current.error).toBeNull();
      expect(result.current.page).toBe(0);
    });

    it('uses initialData when provided', () => {
      const fetchFn = vi.fn(() => Promise.resolve([]));
      const initialData = [{ id: 1 }, { id: 2 }];

      const { result } = renderHook(() =>
        useInfiniteScroll({
          fetchFn,
          initialData,
          autoLoad: false,
        })
      );

      expect(result.current.items).toEqual(initialData);
      expect(result.current.page).toBe(1);
    });
  });

  describe('autoLoad', () => {
    it('loads first page on mount when autoLoad is true', async () => {
      const mockData = [{ id: 1 }, { id: 2 }];
      const fetchFn = vi.fn(() => Promise.resolve(mockData));

      const { result } = renderHook(() =>
        useInfiniteScroll({
          fetchFn,
          autoLoad: true,
        })
      );

      await waitFor(() => {
        expect(fetchFn).toHaveBeenCalledWith(0);
      });

      await waitFor(() => {
        expect(result.current.items).toEqual(mockData);
      });
    });

    it('does not load on mount when autoLoad is false', () => {
      const fetchFn = vi.fn(() => Promise.resolve([]));

      renderHook(() =>
        useInfiniteScroll({
          fetchFn,
          autoLoad: false,
        })
      );

      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('defaults autoLoad to true', async () => {
      const fetchFn = vi.fn(() => Promise.resolve([]));

      renderHook(() =>
        useInfiniteScroll({ fetchFn })
      );

      await waitFor(() => {
        expect(fetchFn).toHaveBeenCalled();
      });
    });
  });

  describe('loadMore', () => {
    it('fetches next page of data', async () => {
      const page1 = [{ id: 1 }, { id: 2 }];
      const page2 = [{ id: 3 }, { id: 4 }];
      const fetchFn = vi.fn()
        .mockResolvedValueOnce(page1)
        .mockResolvedValueOnce(page2);

      const { result } = renderHook(() =>
        useInfiniteScroll({
          fetchFn,
          autoLoad: false,
          pageSize: 2,
        })
      );

      // Load first page
      await act(async () => {
        await result.current.loadMore();
      });

      expect(result.current.items).toEqual(page1);
      expect(result.current.page).toBe(1);

      // Load second page
      await act(async () => {
        await result.current.loadMore();
      });

      expect(result.current.items).toEqual([...page1, ...page2]);
      expect(result.current.page).toBe(2);
    });

    it('sets loading state during fetch', async () => {
      let resolvePromise: (value: any[]) => void;
      const fetchFn = vi.fn(() => new Promise<any[]>(resolve => {
        resolvePromise = resolve;
      }));

      const { result } = renderHook(() =>
        useInfiniteScroll({
          fetchFn,
          autoLoad: false,
        })
      );

      expect(result.current.loading).toBe(false);

      // Start loading
      let loadPromise: Promise<void>;
      act(() => {
        loadPromise = result.current.loadMore();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      });

      // Resolve fetch
      await act(async () => {
        resolvePromise([]);
        await loadPromise;
      });

      expect(result.current.loading).toBe(false);
    });

    it('prevents concurrent loads', async () => {
      let resolveCount = 0;
      const fetchFn = vi.fn(() => new Promise<any[]>(resolve => {
        setTimeout(() => {
          resolveCount++;
          resolve([{ id: resolveCount }]);
        }, 100);
      }));

      const { result } = renderHook(() =>
        useInfiniteScroll({
          fetchFn,
          autoLoad: false,
        })
      );

      // Call loadMore multiple times quickly
      await act(async () => {
        result.current.loadMore();
        result.current.loadMore();
        result.current.loadMore();
        await new Promise(r => setTimeout(r, 150));
      });

      // Should only have called fetch once
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('does not load when hasMore is false', async () => {
      const fetchFn = vi.fn(() => Promise.resolve([])); // Empty array = no more items

      const { result } = renderHook(() =>
        useInfiniteScroll({
          fetchFn,
          autoLoad: false,
          pageSize: 20,
        })
      );

      // First load returns empty, hasMore should become false
      await act(async () => {
        await result.current.loadMore();
      });

      expect(result.current.hasMore).toBe(false);
      fetchFn.mockClear();

      // Try to load more
      await act(async () => {
        await result.current.loadMore();
      });

      expect(fetchFn).not.toHaveBeenCalled();
    });
  });

  describe('hasMore', () => {
    it('is true when fetch returns pageSize items', async () => {
      const fetchFn = vi.fn(() => Promise.resolve([
        { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 },
      ]));

      const { result } = renderHook(() =>
        useInfiniteScroll({
          fetchFn,
          autoLoad: false,
          pageSize: 5,
        })
      );

      await act(async () => {
        await result.current.loadMore();
      });

      expect(result.current.hasMore).toBe(true);
    });

    it('is false when fetch returns fewer than pageSize items', async () => {
      const fetchFn = vi.fn(() => Promise.resolve([{ id: 1 }, { id: 2 }]));

      const { result } = renderHook(() =>
        useInfiniteScroll({
          fetchFn,
          autoLoad: false,
          pageSize: 5,
        })
      );

      await act(async () => {
        await result.current.loadMore();
      });

      expect(result.current.hasMore).toBe(false);
    });
  });

  describe('error handling', () => {
    it('captures fetch errors', async () => {
      const error = new Error('Network error');
      const fetchFn = vi.fn(() => Promise.reject(error));

      const { result } = renderHook(() =>
        useInfiniteScroll({
          fetchFn,
          autoLoad: false,
        })
      );

      await act(async () => {
        await result.current.loadMore();
      });

      expect(result.current.error).toEqual(error);
      expect(result.current.loading).toBe(false);
    });

    it('wraps non-Error rejects in Error', async () => {
      const fetchFn = vi.fn(() => Promise.reject(new Error('string error')));

      const { result } = renderHook(() =>
        useInfiniteScroll({
          fetchFn,
          autoLoad: false,
        })
      );

      await act(async () => {
        await result.current.loadMore();
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('string error');
    });

    it('clears error on successful load', async () => {
      const fetchFn = vi.fn()
        .mockRejectedValueOnce(new Error('Error'))
        .mockResolvedValueOnce([{ id: 1 }]);

      const { result } = renderHook(() =>
        useInfiniteScroll({
          fetchFn,
          autoLoad: false,
        })
      );

      // First call fails
      await act(async () => {
        await result.current.loadMore();
      });

      expect(result.current.error).not.toBeNull();

      // Second call succeeds
      await act(async () => {
        await result.current.loadMore();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('reset', () => {
    it('resets all state', async () => {
      const fetchFn = vi.fn(() => Promise.resolve([{ id: 1 }]));

      const { result } = renderHook(() =>
        useInfiniteScroll({
          fetchFn,
          autoLoad: false,
        })
      );

      // Load some data
      await act(async () => {
        await result.current.loadMore();
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.page).toBe(1);

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.items).toEqual([]);
      expect(result.current.page).toBe(0);
      expect(result.current.hasMore).toBe(true);
      expect(result.current.error).toBeNull();
    });
  });

  describe('sentinelRef', () => {
    it('sets up IntersectionObserver when attached', () => {
      const fetchFn = vi.fn(() => Promise.resolve([]));

      const { result } = renderHook(() =>
        useInfiniteScroll({
          fetchFn,
          autoLoad: false,
        })
      );

      const element = document.createElement('div');

      act(() => {
        result.current.sentinelRef(element);
      });

      expect(mockObserverInstances.length).toBe(1);
      expect(mockObserverInstances[0].elements.has(element)).toBe(true);
    });

    it('disconnects previous observer when ref changes', () => {
      const fetchFn = vi.fn(() => Promise.resolve([]));

      const { result } = renderHook(() =>
        useInfiniteScroll({
          fetchFn,
          autoLoad: false,
        })
      );

      const element1 = document.createElement('div');
      const element2 = document.createElement('div');

      act(() => {
        result.current.sentinelRef(element1);
      });

      const firstObserver = mockObserverInstances[0];
      const disconnectSpy = vi.spyOn(firstObserver, 'disconnect');

      act(() => {
        result.current.sentinelRef(element2);
      });

      expect(disconnectSpy).toHaveBeenCalled();
    });

    it('triggers loadMore when sentinel intersects', async () => {
      const fetchFn = vi.fn(() => Promise.resolve([{ id: 1 }]));

      const { result } = renderHook(() =>
        useInfiniteScroll({
          fetchFn,
          autoLoad: false,
        })
      );

      const element = document.createElement('div');

      act(() => {
        result.current.sentinelRef(element);
      });

      // Simulate intersection
      await act(async () => {
        mockObserverInstances[0].triggerIntersect(true);
        await Promise.resolve();
      });

      expect(fetchFn).toHaveBeenCalled();
    });

    it('does not trigger loadMore when not intersecting', () => {
      const fetchFn = vi.fn(() => Promise.resolve([]));

      const { result } = renderHook(() =>
        useInfiniteScroll({
          fetchFn,
          autoLoad: false,
        })
      );

      const element = document.createElement('div');

      act(() => {
        result.current.sentinelRef(element);
      });

      act(() => {
        mockObserverInstances[0].triggerIntersect(false);
      });

      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('does not observe when hasMore is false', async () => {
      const fetchFn = vi.fn(() => Promise.resolve([])); // Empty = no more

      const { result } = renderHook(() =>
        useInfiniteScroll({
          fetchFn,
          autoLoad: false,
          pageSize: 20,
        })
      );

      // Load until hasMore is false
      await act(async () => {
        await result.current.loadMore();
      });

      expect(result.current.hasMore).toBe(false);
      mockObserverInstances = [];

      const element = document.createElement('div');

      act(() => {
        result.current.sentinelRef(element);
      });

      // No new observer should be created
      expect(mockObserverInstances.length).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('disconnects observer on unmount', () => {
      const fetchFn = vi.fn(() => Promise.resolve([]));

      const { result, unmount } = renderHook(() =>
        useInfiniteScroll({
          fetchFn,
          autoLoad: false,
        })
      );

      const element = document.createElement('div');

      act(() => {
        result.current.sentinelRef(element);
      });

      const disconnectSpy = vi.spyOn(mockObserverInstances[0], 'disconnect');

      unmount();

      expect(disconnectSpy).toHaveBeenCalled();
    });
  });

  describe('pageSize', () => {
    it('defaults to 20', async () => {
      // Return 20 items to keep hasMore true
      const fetchFn = vi.fn(() => Promise.resolve(Array(20).fill({ id: 1 })));

      const { result } = renderHook(() =>
        useInfiniteScroll({
          fetchFn,
          autoLoad: false,
        })
      );

      await act(async () => {
        await result.current.loadMore();
      });

      expect(result.current.hasMore).toBe(true);

      // Return 19 items = less than default pageSize
      fetchFn.mockResolvedValueOnce(Array(19).fill({ id: 2 }));

      await act(async () => {
        await result.current.loadMore();
      });

      expect(result.current.hasMore).toBe(false);
    });
  });
});
