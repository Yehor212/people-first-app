/**
 * useSessionTimeout Hook Tests
 * Tests idle timeout, user activity detection, and cleanup
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionTimeout } from '../useSessionTimeout';

// Mock dependencies
vi.mock('@/lib/logger', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockSignOut = vi.fn(() => Promise.resolve());
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signOut: () => mockSignOut(),
    },
  },
}));

const mockProcessQueue = vi.fn(() => Promise.resolve());
const mockHasPendingActions = vi.fn(() => false);
vi.mock('@/lib/offlineQueue', () => ({
  offlineQueue: {
    processQueue: () => mockProcessQueue(),
    hasPendingActions: () => mockHasPendingActions(),
  },
}));

// Mock window.location.reload
const mockReload = vi.fn();
Object.defineProperty(window, 'location', {
  value: { reload: mockReload },
  writable: true,
});

describe('useSessionTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('sets up activity listeners when enabled', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

      renderHook(() => useSessionTimeout(true));

      expect(addEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function), { passive: true });
      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function), { passive: true });
      expect(addEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });
      expect(addEventListenerSpy).toHaveBeenCalledWith('touchstart', expect.any(Function), { passive: true });
      expect(addEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function), { passive: true });
    });

    it('does not set up listeners when disabled', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

      renderHook(() => useSessionTimeout(false));

      expect(addEventListenerSpy).not.toHaveBeenCalledWith('mousedown', expect.any(Function), expect.anything());
    });

    it('defaults to enabled', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

      renderHook(() => useSessionTimeout());

      expect(addEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function), { passive: true });
    });
  });

  describe('timeout behavior', () => {
    it('signs out after 15 minutes of inactivity', async () => {
      renderHook(() => useSessionTimeout(true));

      // Advance time by 15 minutes
      await act(async () => {
        vi.advanceTimersByTime(15 * 60 * 1000);
        await Promise.resolve();
      });

      expect(mockSignOut).toHaveBeenCalled();
      expect(mockReload).toHaveBeenCalled();
    });

    it('does not sign out before timeout', () => {
      renderHook(() => useSessionTimeout(true));

      // Advance time by 14 minutes
      act(() => {
        vi.advanceTimersByTime(14 * 60 * 1000);
      });

      expect(mockSignOut).not.toHaveBeenCalled();
    });
  });

  describe('activity detection', () => {
    it('resets timer on mousedown', async () => {
      renderHook(() => useSessionTimeout(true));

      // Advance 10 minutes
      act(() => {
        vi.advanceTimersByTime(10 * 60 * 1000);
      });

      // Simulate activity
      act(() => {
        document.dispatchEvent(new MouseEvent('mousedown'));
      });

      // Advance another 10 minutes (would be 20 total, but timer was reset)
      act(() => {
        vi.advanceTimersByTime(10 * 60 * 1000);
      });

      // Should not have signed out yet (timer was reset)
      expect(mockSignOut).not.toHaveBeenCalled();

      // Advance remaining 5 minutes to trigger timeout
      await act(async () => {
        vi.advanceTimersByTime(5 * 60 * 1000);
        await Promise.resolve();
      });

      expect(mockSignOut).toHaveBeenCalled();
    });

    it('resets timer on keydown', () => {
      renderHook(() => useSessionTimeout(true));

      act(() => {
        vi.advanceTimersByTime(10 * 60 * 1000);
      });

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
      });

      act(() => {
        vi.advanceTimersByTime(10 * 60 * 1000);
      });

      expect(mockSignOut).not.toHaveBeenCalled();
    });

    it('resets timer on scroll', () => {
      renderHook(() => useSessionTimeout(true));

      act(() => {
        vi.advanceTimersByTime(10 * 60 * 1000);
      });

      act(() => {
        document.dispatchEvent(new Event('scroll'));
      });

      act(() => {
        vi.advanceTimersByTime(10 * 60 * 1000);
      });

      expect(mockSignOut).not.toHaveBeenCalled();
    });

    it('resets timer on touchstart', () => {
      renderHook(() => useSessionTimeout(true));

      act(() => {
        vi.advanceTimersByTime(10 * 60 * 1000);
      });

      act(() => {
        document.dispatchEvent(new TouchEvent('touchstart'));
      });

      act(() => {
        vi.advanceTimersByTime(10 * 60 * 1000);
      });

      expect(mockSignOut).not.toHaveBeenCalled();
    });

    it('resets timer on mousemove', () => {
      renderHook(() => useSessionTimeout(true));

      act(() => {
        vi.advanceTimersByTime(10 * 60 * 1000);
      });

      act(() => {
        document.dispatchEvent(new MouseEvent('mousemove'));
      });

      act(() => {
        vi.advanceTimersByTime(10 * 60 * 1000);
      });

      expect(mockSignOut).not.toHaveBeenCalled();
    });
  });

  describe('offline queue flushing', () => {
    it('flushes queue before signing out when pending actions exist', async () => {
      mockHasPendingActions.mockReturnValue(true);

      renderHook(() => useSessionTimeout(true));

      await act(async () => {
        vi.advanceTimersByTime(15 * 60 * 1000);
        await Promise.resolve();
      });

      expect(mockProcessQueue).toHaveBeenCalled();
      expect(mockSignOut).toHaveBeenCalled();
    });

    it('does not flush queue when no pending actions', async () => {
      mockHasPendingActions.mockReturnValue(false);

      renderHook(() => useSessionTimeout(true));

      await act(async () => {
        vi.advanceTimersByTime(15 * 60 * 1000);
        await Promise.resolve();
      });

      expect(mockProcessQueue).not.toHaveBeenCalled();
      expect(mockSignOut).toHaveBeenCalled();
    });

    it('signs out even if queue flush fails', async () => {
      mockHasPendingActions.mockReturnValue(true);
      mockProcessQueue.mockRejectedValueOnce(new Error('Network error'));

      renderHook(() => useSessionTimeout(true));

      await act(async () => {
        vi.advanceTimersByTime(15 * 60 * 1000);
        await Promise.resolve();
      });

      expect(mockSignOut).toHaveBeenCalled();
    });

    it('signs out if queue flush times out', async () => {
      mockHasPendingActions.mockReturnValue(true);
      // Make processQueue hang
      mockProcessQueue.mockImplementationOnce(() => new Promise(() => {}));

      renderHook(() => useSessionTimeout(true));

      await act(async () => {
        // Trigger timeout
        vi.advanceTimersByTime(15 * 60 * 1000);
        await Promise.resolve();
        // Advance past queue flush timeout (10 seconds)
        vi.advanceTimersByTime(10 * 1000);
        await Promise.resolve();
      });

      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('removes event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = renderHook(() => useSessionTimeout(true));

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('touchstart', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    });

    it('clears timeout on unmount', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const { unmount } = renderHook(() => useSessionTimeout(true));

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it('does not leak timers when unmounted before timeout', () => {
      const { unmount } = renderHook(() => useSessionTimeout(true));

      act(() => {
        vi.advanceTimersByTime(5 * 60 * 1000);
      });

      unmount();

      act(() => {
        vi.advanceTimersByTime(15 * 60 * 1000);
      });

      expect(mockSignOut).not.toHaveBeenCalled();
    });
  });

  describe('enabled prop changes', () => {
    it('starts timer when enabled becomes true', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

      const { rerender } = renderHook(
        ({ enabled }) => useSessionTimeout(enabled),
        { initialProps: { enabled: false } }
      );

      expect(addEventListenerSpy).not.toHaveBeenCalledWith('mousedown', expect.any(Function), expect.anything());

      rerender({ enabled: true });

      expect(addEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function), { passive: true });
    });

    it('stops timer when enabled becomes false', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { rerender } = renderHook(
        ({ enabled }) => useSessionTimeout(enabled),
        { initialProps: { enabled: true } }
      );

      rerender({ enabled: false });

      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
    });
  });
});
