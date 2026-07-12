/**
 * useSessionTimeout Hook Tests
 * Tests idle timeout (web only), activity detection, native skip, and cleanup
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

const mockSignOut = vi.fn(
  (_options?: { scope?: string }): Promise<{ error: { message: string } | null }> =>
    Promise.resolve({ error: null })
);
const mockGetSession = vi.fn(() =>
  Promise.resolve({
    data: { session: { user: { id: 'idle-user' } } },
    error: null,
  }),
);
const mockGetCurrentSessionUserId = vi.fn(() => Promise.resolve('idle-user'));
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      signOut: (options?: { scope?: string }) => mockSignOut(options),
    },
  },
  getCurrentSessionUserId: () => mockGetCurrentSessionUserId(),
}));

const mockRemovePushToken = vi.fn(() =>
  Promise.resolve({ status: 'revoked' as const, remote: 'deleted' as const, native: 'not-applicable' as const })
);
const mockInitializePushNotifications = vi.fn(() => Promise.resolve());
vi.mock('@/lib/pushNotifications', () => ({
  removePushToken: () => mockRemovePushToken(),
  initializePushNotifications: () => mockInitializePushNotifications(),
}));

const mockStopAutoSync = vi.fn();
const mockStartAutoSync = vi.fn();
const mockQuiesceCloudSync = vi.fn(() => Promise.resolve());
const mockResumeCloudSync = vi.fn();
vi.mock('@/storage/cloudSync', () => ({
  startAutoSync: () => mockStartAutoSync(),
  stopAutoSync: () => mockStopAutoSync(),
  quiesceCloudSync: () => mockQuiesceCloudSync(),
  resumeCloudSync: () => mockResumeCloudSync(),
}));

const mockClearDeviceIdCache = vi.fn();
vi.mock('@/storage/eventSync', () => ({
  clearDeviceIdCache: () => mockClearDeviceIdCache(),
}));

const mockClearLocalUserData = vi.fn(() => Promise.resolve());
const mockGetLocalDataOwnerId = vi.fn(() => Promise.resolve<string | null>('idle-user'));
vi.mock('@/storage/db', () => ({
  clearLocalUserData: () => mockClearLocalUserData(),
  getLocalDataOwnerId: () => mockGetLocalDataOwnerId(),
}));

vi.mock('@/lib/originExclusiveLock', () => ({
  runWithOriginExclusiveLock: async <T>(
    _name: string,
    operation: () => Promise<T>,
  ) => operation(),
}));

const mockTriggerDataRefresh = vi.fn(() => Promise.resolve());
const mockRunWithDataWriteBarrier = vi.fn(async (mutation: () => Promise<unknown>) => {
  const result = await mutation();
  await mockTriggerDataRefresh();
  return result;
});
vi.mock('../useIndexedDB', () => ({
  triggerDataRefresh: () => mockTriggerDataRefresh(),
  runWithDataWriteBarrier: (
    mutation: () => Promise<unknown>,
    _options?: { deferredWrites?: 'replay' | 'discard' },
  ) => mockRunWithDataWriteBarrier(mutation),
}));

const mockClearJournalContentSession = vi.fn();
vi.mock('@/lib/journalContentSession', () => ({
  clearJournalContentSession: (reason: string) => mockClearJournalContentSession(reason),
}));

const mockClearNativeJournalBiometricCredential = vi.fn(() =>
  Promise.resolve<'removed' | 'not-native'>('not-native')
);
vi.mock('@/lib/journalBiometricCredentials', () => ({
  clearNativeJournalBiometricCredential: () =>
    mockClearNativeJournalBiometricCredential(),
}));

const mockClearAccountDeviceSurfaces = vi.fn(() => Promise.resolve());
vi.mock('@/lib/accountDeviceCleanup', () => ({
  clearAccountDeviceSurfaces: () => mockClearAccountDeviceSurfaces(),
}));

const mockClearAccountNotificationsForBoundary = vi.fn(() => Promise.resolve());
const mockResumeAccountNotifications = vi.fn();
vi.mock('@/lib/localNotifications', () => ({
  clearAccountNotificationsForBoundary: () => mockClearAccountNotificationsForBoundary(),
  resumeAccountNotifications: () => mockResumeAccountNotifications(),
}));

const mockHasPendingJournalSecurityMigrationForOwner = vi.fn(
  (_ownerUserId: string) => Promise.resolve(false),
);
vi.mock('@/features/journal', () => ({
  hasPendingJournalSecurityMigrationForOwner: (ownerUserId: string) =>
    mockHasPendingJournalSecurityMigrationForOwner(ownerUserId),
}));

const mockHasPendingActions = vi.fn(() => false);
const mockHasPendingActionsForOwner = vi.fn((_ownerUserId: string) => false);
const mockSuspendForAccountBoundary = vi.fn(() => Promise.resolve());
const mockDiscardSuspendedActionsForAccountBoundary = vi.fn(() => Promise.resolve());
const mockResumeAfterAccountBoundary = vi.fn();
vi.mock('@/lib/offlineQueue', () => ({
  offlineQueue: {
    hasPendingActions: () => mockHasPendingActions(),
    hasPendingActionsForOwner: (ownerUserId: string) =>
      mockHasPendingActionsForOwner(ownerUserId),
    hasPendingActionsForOwnerReady: async (ownerUserId: string) =>
      mockHasPendingActionsForOwner(ownerUserId),
    suspendForAccountBoundary: () => mockSuspendForAccountBoundary(),
    discardSuspendedActionsForAccountBoundary: () =>
      mockDiscardSuspendedActionsForAccountBoundary(),
    resumeAfterAccountBoundary: () => mockResumeAfterAccountBoundary(),
  },
}));

// Default: web platform (isNative = false)
const mockIsNative = vi.fn(() => false);
vi.mock('@/lib/platform', () => ({
  get isNative() {
    return mockIsNative();
  },
}));

// Mock window.location.reload
const mockReload = vi.fn();
Object.defineProperty(window, 'location', {
  value: { reload: mockReload },
  writable: true,
});

const DAY_MS = 24 * 60 * 60 * 1000;

describe('useSessionTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockIsNative.mockReturnValue(false); // default to web
    mockSignOut.mockResolvedValue({ error: null });
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'idle-user' } } },
      error: null,
    });
    mockRemovePushToken.mockResolvedValue({
      status: 'revoked',
      remote: 'deleted',
      native: 'not-applicable',
    });
    mockClearLocalUserData.mockResolvedValue(undefined);
    mockGetLocalDataOwnerId.mockResolvedValue('idle-user');
    mockTriggerDataRefresh.mockResolvedValue(undefined);
    mockGetCurrentSessionUserId.mockResolvedValue('idle-user');
    mockHasPendingActionsForOwner.mockReturnValue(false);
    mockQuiesceCloudSync.mockResolvedValue(undefined);
    mockSuspendForAccountBoundary.mockResolvedValue(undefined);
    mockDiscardSuspendedActionsForAccountBoundary.mockResolvedValue(undefined);
    mockClearNativeJournalBiometricCredential.mockResolvedValue('not-native');
    mockClearAccountDeviceSurfaces.mockResolvedValue(undefined);
    mockClearAccountNotificationsForBoundary.mockResolvedValue(undefined);
    mockHasPendingJournalSecurityMigrationForOwner.mockResolvedValue(false);
    localStorage.removeItem('zenflow_pending_account_sign_out_cleanup');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('sets up activity listeners when enabled on web', () => {
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

  describe('native platform', () => {
    it('does not set up listeners on native (session managed by Supabase)', () => {
      mockIsNative.mockReturnValue(true);
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

      renderHook(() => useSessionTimeout(true));

      expect(addEventListenerSpy).not.toHaveBeenCalledWith('mousedown', expect.any(Function), expect.anything());
    });

    it('does not sign out on native even after long inactivity', () => {
      mockIsNative.mockReturnValue(true);

      renderHook(() => useSessionTimeout(true));

      act(() => {
        vi.advanceTimersByTime(30 * DAY_MS);
      });

      expect(mockSignOut).not.toHaveBeenCalled();
    });
  });

  describe('timeout behavior (web)', () => {
    it('signs out after 24 hours of inactivity', async () => {
      renderHook(() => useSessionTimeout(true));

      await act(async () => {
        vi.advanceTimersByTime(DAY_MS);
        await Promise.resolve();
      });

      expect(mockSignOut).toHaveBeenCalled();
      expect(mockReload).toHaveBeenCalled();
    });

    it('does not sign out before timeout', () => {
      renderHook(() => useSessionTimeout(true));

      // Advance time by 23 hours
      act(() => {
        vi.advanceTimersByTime(23 * 60 * 60 * 1000);
      });

      expect(mockSignOut).not.toHaveBeenCalled();
    });
  });

  describe('activity detection', () => {
    it('resets timer on mousedown', async () => {
      renderHook(() => useSessionTimeout(true));

      // Advance 12 hours
      act(() => {
        vi.advanceTimersByTime(12 * 60 * 60 * 1000);
      });

      // Simulate activity
      act(() => {
        document.dispatchEvent(new MouseEvent('mousedown'));
      });

      // Advance another 12 hours (would be 24h total, but timer was reset)
      act(() => {
        vi.advanceTimersByTime(12 * 60 * 60 * 1000);
      });

      // Should not have signed out yet (timer was reset)
      expect(mockSignOut).not.toHaveBeenCalled();

      // Advance remaining 12 hours to trigger timeout
      await act(async () => {
        vi.advanceTimersByTime(12 * 60 * 60 * 1000);
        await Promise.resolve();
      });

      expect(mockSignOut).toHaveBeenCalled();
    });

    it('resets timer on keydown', () => {
      renderHook(() => useSessionTimeout(true));

      act(() => {
        vi.advanceTimersByTime(12 * 60 * 60 * 1000);
      });

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
      });

      act(() => {
        vi.advanceTimersByTime(12 * 60 * 60 * 1000);
      });

      expect(mockSignOut).not.toHaveBeenCalled();
    });

    it('resets timer on scroll', () => {
      renderHook(() => useSessionTimeout(true));

      act(() => {
        vi.advanceTimersByTime(12 * 60 * 60 * 1000);
      });

      act(() => {
        document.dispatchEvent(new Event('scroll'));
      });

      act(() => {
        vi.advanceTimersByTime(12 * 60 * 60 * 1000);
      });

      expect(mockSignOut).not.toHaveBeenCalled();
    });

    it('resets timer on touchstart', () => {
      renderHook(() => useSessionTimeout(true));

      act(() => {
        vi.advanceTimersByTime(12 * 60 * 60 * 1000);
      });

      act(() => {
        document.dispatchEvent(new TouchEvent('touchstart'));
      });

      act(() => {
        vi.advanceTimersByTime(12 * 60 * 60 * 1000);
      });

      expect(mockSignOut).not.toHaveBeenCalled();
    });

    it('resets timer on mousemove', () => {
      renderHook(() => useSessionTimeout(true));

      act(() => {
        vi.advanceTimersByTime(12 * 60 * 60 * 1000);
      });

      act(() => {
        document.dispatchEvent(new MouseEvent('mousemove'));
      });

      act(() => {
        vi.advanceTimersByTime(12 * 60 * 60 * 1000);
      });

      expect(mockSignOut).not.toHaveBeenCalled();
    });
  });

  describe('offline queue account boundary', () => {
    it('blocks sign-out without mutating the queue when pending owner writes exist', async () => {
      mockHasPendingActionsForOwner.mockReturnValue(true);

      renderHook(() => useSessionTimeout(true));

      await act(async () => {
        vi.advanceTimersByTime(DAY_MS);
        await Promise.resolve();
      });

      expect(mockSignOut).not.toHaveBeenCalled();
      expect(mockClearLocalUserData).not.toHaveBeenCalled();
      expect(mockResumeAfterAccountBoundary).toHaveBeenCalledTimes(1);
    });

    it('clears private device data only after local sign-out succeeds', async () => {
      mockHasPendingActionsForOwner.mockReturnValue(false);

      renderHook(() => useSessionTimeout(true));

      await act(async () => {
        vi.advanceTimersByTime(DAY_MS);
        await Promise.resolve();
      });

      expect(mockClearLocalUserData).toHaveBeenCalledTimes(1);
      expect(mockClearNativeJournalBiometricCredential).toHaveBeenCalledTimes(1);
      expect(mockClearAccountNotificationsForBoundary).toHaveBeenCalledTimes(1);
      expect(mockClearAccountDeviceSurfaces).toHaveBeenCalledTimes(1);
      expect(mockQuiesceCloudSync).toHaveBeenCalledTimes(1);
      expect(mockTriggerDataRefresh).toHaveBeenCalledTimes(1);
      expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
      expect(mockSignOut.mock.invocationCallOrder[0]).toBeLessThan(
        mockClearLocalUserData.mock.invocationCallOrder[0]
      );
    });

    it('completes idle sign-out when the suspended queue has no owner writes', async () => {
      mockHasPendingActionsForOwner.mockReturnValue(false);

      renderHook(() => useSessionTimeout(true));

      await act(async () => {
        vi.advanceTimersByTime(DAY_MS);
        await Promise.resolve();
      });

      expect(mockSignOut).toHaveBeenCalled();
    });

    it('does not let quarantined work from another owner block idle sign-out', async () => {
      mockHasPendingActions.mockReturnValue(true);
      mockHasPendingActionsForOwner.mockReturnValue(false);

      renderHook(() => useSessionTimeout(true));

      await act(async () => {
        vi.advanceTimersByTime(DAY_MS);
        await Promise.resolve();
      });

      expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
    });

    it('keeps the signed-out boundary suspended when local purge must retry', async () => {
      mockClearLocalUserData.mockRejectedValueOnce(new Error('purge failed'));

      renderHook(() => useSessionTimeout(true));

      await act(async () => {
        vi.advanceTimersByTime(DAY_MS);
        await Promise.resolve();
      });

      expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
      expect(mockResumeCloudSync).not.toHaveBeenCalled();
      expect(mockStartAutoSync).not.toHaveBeenCalled();
    });

    it('fails closed without clearing the owner context when journal credential cleanup fails', async () => {
      mockClearNativeJournalBiometricCredential.mockRejectedValueOnce(
        new Error('native journal credential delete failed')
      );

      renderHook(() => useSessionTimeout(true));

      await act(async () => {
        vi.advanceTimersByTime(DAY_MS);
        await Promise.resolve();
      });

      expect(mockClearLocalUserData).not.toHaveBeenCalled();
      expect(mockClearDeviceIdCache).not.toHaveBeenCalled();
      expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
      expect(mockReload).not.toHaveBeenCalled();
      expect(mockResumeCloudSync).not.toHaveBeenCalled();
      expect(mockStartAutoSync).not.toHaveBeenCalled();
      expect(mockResumeAfterAccountBoundary).not.toHaveBeenCalled();
    });

    it('fails closed when widget or account cache cleanup cannot complete', async () => {
      mockClearAccountDeviceSurfaces.mockRejectedValueOnce(
        new Error('widget cleanup failed')
      );

      renderHook(() => useSessionTimeout(true));

      await act(async () => {
        vi.advanceTimersByTime(DAY_MS);
        await Promise.resolve();
      });

      expect(mockClearLocalUserData).not.toHaveBeenCalled();
      expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
      expect(mockResumeCloudSync).not.toHaveBeenCalled();
      expect(mockResumeAfterAccountBoundary).not.toHaveBeenCalled();
    });

    it('resumes safe sync recovery when local Supabase sign-out fails', async () => {
      mockSignOut.mockResolvedValueOnce({ error: { message: 'sign-out failed' } });

      renderHook(() => useSessionTimeout(true));

      await act(async () => {
        vi.advanceTimersByTime(DAY_MS);
        await Promise.resolve();
      });

      expect(mockResumeCloudSync).toHaveBeenCalledTimes(1);
      expect(mockStartAutoSync).toHaveBeenCalledTimes(1);
      expect(mockClearLocalUserData).not.toHaveBeenCalled();
      expect(mockDiscardSuspendedActionsForAccountBoundary).not.toHaveBeenCalled();
      expect(mockClearNativeJournalBiometricCredential).not.toHaveBeenCalled();
      expect(mockClearAccountDeviceSurfaces).not.toHaveBeenCalled();
      expect(mockReload).not.toHaveBeenCalled();
    });

    it('retries a blocked idle sign-out after pending changes clear', async () => {
      mockHasPendingActionsForOwner.mockReturnValue(true);
      renderHook(() => useSessionTimeout(true));

      await act(async () => {
        vi.advanceTimersByTime(DAY_MS);
        await Promise.resolve();
      });
      expect(mockSignOut).not.toHaveBeenCalled();

      mockHasPendingActionsForOwner.mockReturnValue(false);
      await act(async () => {
        vi.advanceTimersByTime(5 * 60 * 1000);
        await Promise.resolve();
      });

      expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
    });

    it('keeps the session while pending actions remain after queue suspension', async () => {
      mockHasPendingActionsForOwner.mockReturnValue(true);

      renderHook(() => useSessionTimeout(true));

      await act(async () => {
        vi.advanceTimersByTime(DAY_MS);
        await Promise.resolve();
      });

      expect(mockSignOut).not.toHaveBeenCalled();
      expect(mockClearLocalUserData).not.toHaveBeenCalled();
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
        vi.advanceTimersByTime(6 * 60 * 60 * 1000); // 6 hours
      });

      unmount();

      act(() => {
        vi.advanceTimersByTime(DAY_MS);
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
