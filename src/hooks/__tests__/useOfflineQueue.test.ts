/**
 * useOfflineQueue Hook Tests
 * Tests offline queue state and actions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOfflineQueue } from '../useOfflineQueue';

// Mock offlineQueue
const mockSubscribers = new Set<(state: any) => void>();
const mockState = {
  actions: [] as any[],
  lastProcessedAt: null as number | null,
  isProcessing: false,
};

vi.mock('@/lib/offlineQueue', () => ({
  offlineQueue: {
    getState: vi.fn(() => ({ ...mockState })),
    subscribe: vi.fn((callback: (state: any) => void) => {
      mockSubscribers.add(callback);
      return () => mockSubscribers.delete(callback);
    }),
    processQueue: vi.fn(() => Promise.resolve()),
    clearQueue: vi.fn(() => {
      mockState.actions = [];
      mockSubscribers.forEach(cb => cb({ ...mockState }));
    }),
  },
}));

describe('useOfflineQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.actions = [];
    mockState.lastProcessedAt = null;
    mockState.isProcessing = false;
    mockSubscribers.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('returns initial state', () => {
      const { result } = renderHook(() => useOfflineQueue());

      expect(result.current.pendingCount).toBe(0);
      expect(result.current.isProcessing).toBe(false);
      expect(result.current.hasPendingActions).toBe(false);
      expect(result.current.lastProcessedAt).toBeNull();
      expect(result.current.actions).toEqual([]);
    });

    it('returns online status', () => {
      const { result } = renderHook(() => useOfflineQueue());

      // jsdom reports navigator.onLine as true by default
      expect(typeof result.current.isOnline).toBe('boolean');
    });
  });

  describe('pendingCount', () => {
    it('reflects number of actions in queue', () => {
      mockState.actions = [
        { id: '1', type: 'sync', data: {} },
        { id: '2', type: 'sync', data: {} },
      ];

      const { result } = renderHook(() => useOfflineQueue());

      expect(result.current.pendingCount).toBe(2);
      expect(result.current.hasPendingActions).toBe(true);
    });

    it('updates when queue changes', () => {
      const { result } = renderHook(() => useOfflineQueue());

      expect(result.current.pendingCount).toBe(0);

      // Simulate queue update
      act(() => {
        mockState.actions = [{ id: '1', type: 'sync', data: {} }];
        mockSubscribers.forEach(cb => cb({ ...mockState }));
      });

      expect(result.current.pendingCount).toBe(1);
    });
  });

  describe('isProcessing', () => {
    it('reflects processing state', () => {
      mockState.isProcessing = true;

      const { result } = renderHook(() => useOfflineQueue());

      expect(result.current.isProcessing).toBe(true);
    });
  });

  describe('online/offline events', () => {
    it('updates isOnline on online event', () => {
      const { result } = renderHook(() => useOfflineQueue());

      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      expect(result.current.isOnline).toBe(true);
    });

    it('updates isOnline on offline event', () => {
      const { result } = renderHook(() => useOfflineQueue());

      act(() => {
        window.dispatchEvent(new Event('offline'));
      });

      expect(result.current.isOnline).toBe(false);
    });
  });

  describe('processQueue', () => {
    it('calls offlineQueue.processQueue', async () => {
      const { offlineQueue } = await import('@/lib/offlineQueue');
      const { result } = renderHook(() => useOfflineQueue());

      await act(async () => {
        await result.current.processQueue();
      });

      expect(offlineQueue.processQueue).toHaveBeenCalled();
    });
  });

  describe('clearQueue', () => {
    it('calls offlineQueue.clearQueue', async () => {
      const { offlineQueue } = await import('@/lib/offlineQueue');
      const { result } = renderHook(() => useOfflineQueue());

      act(() => {
        result.current.clearQueue();
      });

      expect(offlineQueue.clearQueue).toHaveBeenCalled();
    });
  });

  describe('subscription cleanup', () => {
    it('unsubscribes on unmount', () => {
      const { unmount } = renderHook(() => useOfflineQueue());

      expect(mockSubscribers.size).toBe(1);

      unmount();

      expect(mockSubscribers.size).toBe(0);
    });

    it('removes event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => useOfflineQueue());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
    });
  });

  describe('lastProcessedAt', () => {
    it('returns timestamp when set', () => {
      const timestamp = Date.now();
      mockState.lastProcessedAt = timestamp;

      const { result } = renderHook(() => useOfflineQueue());

      expect(result.current.lastProcessedAt).toBe(timestamp);
    });
  });
});
