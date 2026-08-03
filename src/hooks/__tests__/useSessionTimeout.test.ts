/**
 * useSessionTimeout Hook Tests
 * Tests idle timeout (web only), activity detection, native skip, and cleanup
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionTimeout } from '../useSessionTimeout';
import { advanceOriginAccountBoundaryGeneration } from '@/storage/accountBoundaryRuntime';

const IDLE_USER_ID = '11111111-1111-4111-8111-111111111111';
const mockBoundaryState = vi.hoisted(() => ({
  cloudEpoch: 0,
  cloudSuspended: false,
  queueEpoch: 0,
  queueSuspended: false,
  writerEpoch: 0,
  writersSuspended: false,
}));

// Mock dependencies
vi.mock('@/lib/logger', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockGetSession = vi.fn(() =>
  Promise.resolve({
    data: { session: { user: { id: IDLE_USER_ID } } },
    error: null,
  }),
);
const mockGetCurrentSessionUserId = vi.fn<() => Promise<string | null>>(() =>
  Promise.resolve(IDLE_USER_ID)
);
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      signOut: vi.fn(),
    },
  },
  getCurrentSessionUserId: () => mockGetCurrentSessionUserId(),
  getVerifiedCurrentSessionUserId: () => mockGetCurrentSessionUserId(),
}));

const mockSignOutExpectedOwnerLocally = vi.fn((_expectedOwnerUserId: string) =>
  Promise.resolve({ status: 'signed-out' as const })
);
vi.mock('@/lib/ownerBoundAuthSession', () => ({
  signOutExpectedOwnerLocally: (expectedOwnerUserId: string) =>
    mockSignOutExpectedOwnerLocally(expectedOwnerUserId),
}));

const mockRevokePushForAccountBoundary = vi.fn((_ownerUserId: string) =>
  Promise.resolve({ status: 'revoked' as const, remote: 'deleted' as const, native: 'not-applicable' as const })
);
const mockInitializePushNotifications = vi.fn(() => Promise.resolve());
vi.mock('@/lib/pushNotifications', () => ({
  revokePushForAccountBoundary: (ownerUserId: string) =>
    mockRevokePushForAccountBoundary(ownerUserId),
  initializePushNotifications: () => mockInitializePushNotifications(),
}));

const mockLeavePresenceForAccountBoundary = vi.fn((_ownerUserId: string) =>
  Promise.resolve({ status: 'removed' as const })
);
vi.mock('@/lib/presenceService', () => ({
  leavePresenceForAccountBoundary: (ownerUserId: string) =>
    mockLeavePresenceForAccountBoundary(ownerUserId),
}));

const mockStopAutoSync = vi.fn();
const mockStartAutoSync = vi.fn();
const mockQuiesceCloudSync = vi.fn(() => Promise.resolve());
const mockResumeCloudSync = vi.fn(() => {
  mockBoundaryState.cloudEpoch += 1;
  mockBoundaryState.cloudSuspended = false;
});
vi.mock('@/storage/cloudSync', () => ({
  startAutoSync: () => mockStartAutoSync(),
  stopAutoSync: () => mockStopAutoSync(),
  quiesceCloudSync: () => mockQuiesceCloudSync(),
  resumeCloudSync: () => mockResumeCloudSync(),
  getCloudSyncAccountBoundaryEpoch: () => mockBoundaryState.cloudEpoch,
  isCloudSyncSuspendedForAccountBoundary: () => mockBoundaryState.cloudSuspended,
}));

const mockSuspendAccountBoundaryWriters = vi.fn(() => {
  mockBoundaryState.writerEpoch += 1;
  mockBoundaryState.writersSuspended = true;
});
const mockResumeAccountBoundaryWriters = vi.fn(() => {
  mockBoundaryState.writerEpoch += 1;
  mockBoundaryState.writersSuspended = false;
});
vi.mock('@/lib/accountBoundaryState', () => ({
  suspendAccountBoundaryWriters: () => mockSuspendAccountBoundaryWriters(),
  resumeAccountBoundaryWriters: () => mockResumeAccountBoundaryWriters(),
  getAccountBoundaryWritersEpoch: () => mockBoundaryState.writerEpoch,
  areAccountBoundaryWritersSuspended: () => mockBoundaryState.writersSuspended,
}));

const mockClearDeviceIdCache = vi.fn();
vi.mock('@/storage/eventSync', () => ({
  clearDeviceIdCache: () => mockClearDeviceIdCache(),
}));

const mockClearLocalUserData = vi.fn(() => Promise.resolve());
const mockGetLocalDataOwnerId = vi.fn(() => Promise.resolve<string | null>(IDLE_USER_ID));
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
const mockRunWithDataWriteBarrier = vi.fn(async (
  mutation: () => Promise<unknown>,
  options?: { beforeAccountBoundaryAdvance?: () => void | Promise<void> },
) => {
  await options?.beforeAccountBoundaryAdvance?.();
  const result = await mutation();
  await mockTriggerDataRefresh();
  return result;
});
const mockRunWithSettledDataRead = vi.fn(async (operation: () => Promise<unknown>) =>
  operation()
);
vi.mock('../useIndexedDB', () => ({
  triggerDataRefresh: () => mockTriggerDataRefresh(),
  runWithDataWriteBarrier: (
    mutation: () => Promise<unknown>,
    options?: {
      deferredWrites?: 'replay' | 'discard';
      beforeAccountBoundaryAdvance?: () => void | Promise<void>;
    },
  ) => mockRunWithDataWriteBarrier(mutation, options),
  runWithSettledDataRead: (operation: () => Promise<unknown>) =>
    mockRunWithSettledDataRead(operation),
  isDataWriteBarrierPostCommitError: () => false,
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
const mockGetPendingJournalSecurityMigrationRevisionForOwner = vi.fn(
  (_ownerUserId: string) => Promise.resolve<string | null>(null),
);
vi.mock('@/features/journal', () => ({
  hasPendingJournalSecurityMigrationForOwner: (ownerUserId: string) =>
    mockHasPendingJournalSecurityMigrationForOwner(ownerUserId),
  getPendingJournalSecurityMigrationRevisionForOwner: (ownerUserId: string) =>
    mockGetPendingJournalSecurityMigrationRevisionForOwner(ownerUserId),
}));

const mockHasPendingActions = vi.fn(() => false);
const mockHasPendingActionsForOwner = vi.fn((_ownerUserId: string) => false);
const mockSuspendForAccountBoundary = vi.fn(async () => {
  mockBoundaryState.queueEpoch += 1;
  mockBoundaryState.queueSuspended = true;
});
const mockDiscardSuspendedActionsForAccountBoundary = vi.fn(
  (_options?: { onlyIfEmpty?: boolean }) =>
    Promise.resolve({ status: 'discarded' as const })
);
const mockResumeAfterAccountBoundary = vi.fn(() => {
  mockBoundaryState.queueEpoch += 1;
  mockBoundaryState.queueSuspended = false;
});
vi.mock('@/lib/offlineQueue', () => ({
  offlineQueue: {
    hasPendingActions: () => mockHasPendingActions(),
    hasPendingActionsForOwner: (ownerUserId: string) =>
      mockHasPendingActionsForOwner(ownerUserId),
    hasPendingActionsForOwnerReady: async (ownerUserId: string) =>
      mockHasPendingActionsForOwner(ownerUserId),
    suspendForAccountBoundary: () => mockSuspendForAccountBoundary(),
    getAccountBoundaryEpoch: () => mockBoundaryState.queueEpoch,
    isSuspendedForAccountBoundary: () => mockBoundaryState.queueSuspended,
    discardSuspendedActionsForAccountBoundary: (options?: { onlyIfEmpty?: boolean }) =>
      mockDiscardSuspendedActionsForAccountBoundary(options),
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

const mockReloadAppSafely = vi.fn(() => Promise.resolve());
vi.mock('@/lib/versionCheck', () => ({
  reloadAppSafely: () => mockReloadAppSafely(),
}));

const DAY_MS = 24 * 60 * 60 * 1000;

describe('useSessionTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockIsNative.mockReturnValue(false); // default to web
    mockSignOutExpectedOwnerLocally.mockResolvedValue({ status: 'signed-out' });
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: IDLE_USER_ID } } },
      error: null,
    });
    mockRevokePushForAccountBoundary.mockResolvedValue({
      status: 'revoked',
      remote: 'deleted',
      native: 'not-applicable',
    });
    mockLeavePresenceForAccountBoundary.mockResolvedValue({ status: 'removed' });
    mockClearLocalUserData.mockResolvedValue(undefined);
    mockGetLocalDataOwnerId.mockResolvedValue(IDLE_USER_ID);
    mockTriggerDataRefresh.mockResolvedValue(undefined);
    mockGetCurrentSessionUserId.mockResolvedValue(IDLE_USER_ID);
    Object.assign(mockBoundaryState, {
      cloudEpoch: 0,
      cloudSuspended: false,
      queueEpoch: 0,
      queueSuspended: false,
      writerEpoch: 0,
      writersSuspended: false,
    });
    mockHasPendingActionsForOwner.mockReturnValue(false);
    mockQuiesceCloudSync.mockImplementation(async () => {
      mockBoundaryState.cloudEpoch += 1;
      mockBoundaryState.cloudSuspended = true;
    });
    mockSuspendForAccountBoundary.mockImplementation(async () => {
      mockBoundaryState.queueEpoch += 1;
      mockBoundaryState.queueSuspended = true;
    });
    mockDiscardSuspendedActionsForAccountBoundary.mockResolvedValue({ status: 'discarded' });
    mockClearNativeJournalBiometricCredential.mockResolvedValue('not-native');
    mockClearAccountDeviceSurfaces.mockResolvedValue(undefined);
    mockClearAccountNotificationsForBoundary.mockResolvedValue(undefined);
    mockHasPendingJournalSecurityMigrationForOwner.mockResolvedValue(false);
    mockGetPendingJournalSecurityMigrationRevisionForOwner.mockResolvedValue(null);
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

      expect(mockSignOutExpectedOwnerLocally).not.toHaveBeenCalled();
    });
  });

  describe('timeout behavior (web)', () => {
    it('signs out after 24 hours of inactivity', async () => {
      renderHook(() => useSessionTimeout(true));

      await act(async () => {
        vi.advanceTimersByTime(DAY_MS);
        await Promise.resolve();
      });

      expect(mockSignOutExpectedOwnerLocally).toHaveBeenCalled();
      expect(mockReloadAppSafely).toHaveBeenCalled();
    });

    it('does not sign out before timeout', () => {
      renderHook(() => useSessionTimeout(true));

      // Advance time by 23 hours
      act(() => {
        vi.advanceTimersByTime(23 * 60 * 60 * 1000);
      });

      expect(mockSignOutExpectedOwnerLocally).not.toHaveBeenCalled();
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
      expect(mockSignOutExpectedOwnerLocally).not.toHaveBeenCalled();

      // Advance remaining 12 hours to trigger timeout
      await act(async () => {
        vi.advanceTimersByTime(12 * 60 * 60 * 1000);
        await Promise.resolve();
      });

      expect(mockSignOutExpectedOwnerLocally).toHaveBeenCalled();
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

      expect(mockSignOutExpectedOwnerLocally).not.toHaveBeenCalled();
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

      expect(mockSignOutExpectedOwnerLocally).not.toHaveBeenCalled();
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

      expect(mockSignOutExpectedOwnerLocally).not.toHaveBeenCalled();
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

      expect(mockSignOutExpectedOwnerLocally).not.toHaveBeenCalled();
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

      expect(mockSignOutExpectedOwnerLocally).not.toHaveBeenCalled();
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
      expect(mockLeavePresenceForAccountBoundary).toHaveBeenCalledWith(IDLE_USER_ID);
      expect(mockRevokePushForAccountBoundary).toHaveBeenCalledWith(IDLE_USER_ID);
      expect(mockSignOutExpectedOwnerLocally).toHaveBeenCalledWith(IDLE_USER_ID);
      expect(mockLeavePresenceForAccountBoundary.mock.invocationCallOrder[0]).toBeLessThan(
        mockRevokePushForAccountBoundary.mock.invocationCallOrder[0]
      );
      expect(mockRevokePushForAccountBoundary.mock.invocationCallOrder[0]).toBeLessThan(
        mockSignOutExpectedOwnerLocally.mock.invocationCallOrder[0]
      );
      expect(mockSignOutExpectedOwnerLocally.mock.invocationCallOrder[0]).toBeLessThan(
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

      expect(mockSignOutExpectedOwnerLocally).toHaveBeenCalled();
    });

    it('does not let quarantined work from another owner block idle sign-out', async () => {
      mockHasPendingActions.mockReturnValue(true);
      mockHasPendingActionsForOwner.mockReturnValue(false);

      renderHook(() => useSessionTimeout(true));

      await act(async () => {
        vi.advanceTimersByTime(DAY_MS);
        await Promise.resolve();
      });

      expect(mockSignOutExpectedOwnerLocally).toHaveBeenCalledWith(IDLE_USER_ID);
    });

    it('keeps the signed-out boundary suspended when local purge must retry', async () => {
      mockClearLocalUserData.mockRejectedValueOnce(new Error('purge failed'));

      renderHook(() => useSessionTimeout(true));

      await act(async () => {
        vi.advanceTimersByTime(DAY_MS);
        await Promise.resolve();
      });

      expect(mockSignOutExpectedOwnerLocally).toHaveBeenCalledWith(IDLE_USER_ID);
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
      expect(mockSignOutExpectedOwnerLocally).toHaveBeenCalledWith(IDLE_USER_ID);
      expect(mockReloadAppSafely).not.toHaveBeenCalled();
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
      expect(mockSignOutExpectedOwnerLocally).toHaveBeenCalledWith(IDLE_USER_ID);
      expect(mockResumeCloudSync).not.toHaveBeenCalled();
      expect(mockResumeAfterAccountBoundary).not.toHaveBeenCalled();
    });

    it('resumes safe sync recovery when owner-qualified local sign-out fails', async () => {
      mockSignOutExpectedOwnerLocally.mockRejectedValueOnce(new Error('sign-out failed'));

      renderHook(() => useSessionTimeout(true));

      await act(async () => {
        vi.advanceTimersByTime(DAY_MS);
        await Promise.resolve();
      });

      expect(mockResumeCloudSync).toHaveBeenCalledTimes(1);
      expect(mockStartAutoSync).toHaveBeenCalledTimes(1);
      expect(mockClearLocalUserData).not.toHaveBeenCalled();
      expect(mockDiscardSuspendedActionsForAccountBoundary).toHaveBeenCalledTimes(1);
      expect(mockDiscardSuspendedActionsForAccountBoundary).toHaveBeenCalledWith({
        onlyIfEmpty: true,
      });
      expect(mockClearNativeJournalBiometricCredential).not.toHaveBeenCalled();
      expect(mockClearAccountDeviceSurfaces).not.toHaveBeenCalled();
      expect(mockReloadAppSafely).not.toHaveBeenCalled();
    });

    it('retries a blocked idle sign-out after pending changes clear', async () => {
      mockHasPendingActionsForOwner.mockReturnValue(true);
      renderHook(() => useSessionTimeout(true));

      await act(async () => {
        vi.advanceTimersByTime(DAY_MS);
        await Promise.resolve();
      });
      expect(mockSignOutExpectedOwnerLocally).not.toHaveBeenCalled();

      mockHasPendingActionsForOwner.mockReturnValue(false);
      await act(async () => {
        vi.advanceTimersByTime(5 * 60 * 1000);
        await Promise.resolve();
      });

      expect(mockSignOutExpectedOwnerLocally).toHaveBeenCalledWith(IDLE_USER_ID);
    });

    it('keeps a banner retry bound to the owner whose idle sign-out failed', async () => {
      let retry: (() => void) | undefined;
      const onBlocked = (event: Event) => {
        retry = (event as CustomEvent<{ retry: () => void }>).detail.retry;
      };
      window.addEventListener('zenflow:session-timeout-blocked', onBlocked);
      mockLeavePresenceForAccountBoundary.mockRejectedValueOnce(
        new Error('owner A presence teardown failed'),
      );
      renderHook(() => useSessionTimeout(true));

      await act(async () => {
        vi.advanceTimersByTime(DAY_MS);
        await Promise.resolve();
      });
      expect(retry).toBeTypeOf('function');
      expect(mockLeavePresenceForAccountBoundary).toHaveBeenCalledWith(IDLE_USER_ID);

      const ownerB = '22222222-2222-4222-8222-222222222222';
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: ownerB } } },
        error: null,
      });
      mockGetCurrentSessionUserId.mockResolvedValue(ownerB);

      await act(async () => {
        retry?.();
        await Promise.resolve();
      });

      expect(mockLeavePresenceForAccountBoundary).not.toHaveBeenCalledWith(ownerB);
      expect(mockRevokePushForAccountBoundary).not.toHaveBeenCalledWith(ownerB);
      expect(mockSignOutExpectedOwnerLocally).not.toHaveBeenCalledWith(ownerB);
      window.removeEventListener('zenflow:session-timeout-blocked', onBlocked);
    });

    it('keeps the automatic five-minute retry from targeting a replacement owner', async () => {
      mockLeavePresenceForAccountBoundary.mockRejectedValueOnce(
        new Error('owner A presence teardown failed'),
      );
      renderHook(() => useSessionTimeout(true));

      await act(async () => {
        vi.advanceTimersByTime(DAY_MS);
        await Promise.resolve();
      });

      const ownerB = '22222222-2222-4222-8222-222222222222';
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: ownerB } } },
        error: null,
      });
      mockGetCurrentSessionUserId.mockResolvedValue(ownerB);

      await act(async () => {
        vi.advanceTimersByTime(5 * 60 * 1000);
        await Promise.resolve();
      });

      expect(mockLeavePresenceForAccountBoundary).not.toHaveBeenCalledWith(ownerB);
      expect(mockRevokePushForAccountBoundary).not.toHaveBeenCalledWith(ownerB);
      expect(mockSignOutExpectedOwnerLocally).not.toHaveBeenCalledWith(ownerB);
    });

    it('does not rebind a failed idle sign-out to a later lifecycle of the same owner ID', async () => {
      let retry: (() => void) | undefined;
      const onBlocked = (event: Event) => {
        retry = (event as CustomEvent<{ retry: () => void }>).detail.retry;
      };
      window.addEventListener('zenflow:session-timeout-blocked', onBlocked);
      mockLeavePresenceForAccountBoundary.mockImplementationOnce(async () => {
        advanceOriginAccountBoundaryGeneration();
        throw new Error('the original owner lifecycle ended during cleanup');
      });
      renderHook(() => useSessionTimeout(true));

      await act(async () => {
        vi.advanceTimersByTime(DAY_MS);
        await Promise.resolve();
      });
      expect(retry).toBeUndefined();
      expect(mockLeavePresenceForAccountBoundary).toHaveBeenCalledTimes(1);
      expect(mockRevokePushForAccountBoundary).not.toHaveBeenCalled();
      expect(mockSignOutExpectedOwnerLocally).not.toHaveBeenCalled();
      window.removeEventListener('zenflow:session-timeout-blocked', onBlocked);
    });

    it('keeps the session while pending actions remain after queue suspension', async () => {
      mockHasPendingActionsForOwner.mockReturnValue(true);

      renderHook(() => useSessionTimeout(true));

      await act(async () => {
        vi.advanceTimersByTime(DAY_MS);
        await Promise.resolve();
      });

      expect(mockSignOutExpectedOwnerLocally).not.toHaveBeenCalled();
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

      expect(mockSignOutExpectedOwnerLocally).not.toHaveBeenCalled();
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
