/**
 * Infinite Scroll Hook
 *
 * Provides pagination with automatic loading when scrolling near the bottom.
 * Uses Intersection Observer for performance.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

interface UseInfiniteScrollOptions<T> {
  /** Function to fetch a page of data */
  fetchFn: (page: number) => Promise<T[]>;
  /** Number of items per page (default: 20) */
  pageSize?: number;
  /** Initial data to start with */
  initialData?: T[];
  /** Threshold in pixels before end of list to trigger load (default: 200) */
  threshold?: number;
  /** Whether to automatically load first page on mount (default: true) */
  autoLoad?: boolean;
}

interface UseInfiniteScrollReturn<T> {
  /** Current loaded items */
  items: T[];
  /** Whether currently loading more items */
  loading: boolean;
  /** Whether there are more items to load */
  hasMore: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Manually load more items */
  loadMore: () => Promise<void>;
  /** Reset and reload from beginning */
  reset: () => void;
  /** Ref to attach to the sentinel element at bottom of list */
  sentinelRef: React.RefCallback<HTMLElement>;
  /** Current page number */
  page: number;
}

export function useInfiniteScroll<T>({
  fetchFn,
  pageSize = 20,
  initialData = [],
  threshold = 200,
  autoLoad = true,
}: UseInfiniteScrollOptions<T>): UseInfiniteScrollReturn<T> {
  const [items, setItems] = useState<T[]>(initialData);
  const [page, setPage] = useState(initialData.length > 0 ? 1 : 0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef(false); // Prevent concurrent loads

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const newItems = await fetchFn(page);

      setItems(prev => [...prev, ...newItems]);
      setHasMore(newItems.length >= pageSize);
      setPage(prev => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load more items'));
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [fetchFn, page, pageSize, hasMore]);

  const reset = useCallback(() => {
    setItems([]);
    setPage(0);
    setHasMore(true);
    setError(null);
    loadingRef.current = false;
  }, []);

  // Sentinel ref callback for Intersection Observer
  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      // Cleanup previous observer
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      if (!node || !hasMore) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting && hasMore && !loadingRef.current) {
            loadMore();
          }
        },
        {
          rootMargin: `${threshold}px`,
        }
      );

      observerRef.current.observe(node);
    },
    [hasMore, loadMore, threshold]
  );

  // Auto-load first page on mount
  useEffect(() => {
    if (autoLoad && items.length === 0 && hasMore) {
      loadMore();
    }
  }, [autoLoad]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return {
    items,
    loading,
    hasMore,
    error,
    loadMore,
    reset,
    sentinelRef,
    page,
  };
}
