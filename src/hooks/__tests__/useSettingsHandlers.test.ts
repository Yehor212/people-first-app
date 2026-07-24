/**
 * useSettingsHandlers Hook Tests
 * Tests reset data, name change, pull-to-refresh, and schedule event CRUD.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { defaultReminderSettings } from '@/lib/reminders';
import type { ReminderSettings } from '@/types';

// --- mocks ---

const ownerBoundaryMocks = vi.hoisted(() => {
  class BoundaryError extends Error {
    constructor(operation = 'Local data reset', cause?: unknown) {
      super(`${operation} stopped at an account boundary`);
      this.name = 'SettingsOwnerBoundaryError';
      if (cause !== undefined) {
        (this as Error & { cause?: unknown }).cause = cause;
      }
    }
  }

  return {
    BoundaryError,
    assertWithinDataWriteBarrier: vi.fn(),
    readVerifiedRealm: vi.fn(),
  };
});

const mockSetMoods = vi.fn();
const mockSetHabits = vi.fn();
const mockSetFocusSessions = vi.fn();
const mockSetGratitudeEntries = vi.fn();
const mockSetUserName = vi.fn();
const mockSetUserNameCustom = vi.fn();
const mockSetScheduleEvents = vi.fn();
const mockSetCanvasGoals = vi.fn();
const mockSetOnboardingComplete = vi.fn();
const mockSetHasSelectedLanguage = vi.fn();
const mockSetUserDataStoreState = vi.fn();
const mockCommitReminderSettingsUpdate = vi.fn();
const mockCommitPrivacySettingsUpdate = vi.fn();
const mockCommitProfileNameUpdate = vi.fn();
const mockClearLocalUserData = vi.fn(() => Promise.resolve());
const mockStopAutoSync = vi.fn();
const writerBoundaryState = {
  cloudEpoch: 0,
  cloudSuspended: false,
  queueEpoch: 0,
  queueSuspended: false,
};
const mockQuiesceCloudSync = vi.fn(async () => {
  writerBoundaryState.cloudEpoch += 1;
  writerBoundaryState.cloudSuspended = true;
});
const mockResumeCloudSync = vi.fn(() => {
  writerBoundaryState.cloudEpoch += 1;
  writerBoundaryState.cloudSuspended = false;
});
const mockStartAutoSync = vi.fn();
const mockClearDeviceIdCache = vi.fn();
const mockTriggerDataRefresh = vi.fn();
const mockRunWithDataWriteBarrier = vi.fn(
  async (
    mutation: () => Promise<unknown>,
    options?: {
      beforeAccountBoundaryAdvance?: () => void | Promise<void>;
      expectedAccountBoundaryGeneration?: string;
    },
  ) => {
    await options?.beforeAccountBoundaryAdvance?.();
    const result = await mutation();
    await mockTriggerDataRefresh();
    return result;
  },
);
const mockSuspendForAccountBoundary = vi.fn(async () => {
  writerBoundaryState.queueEpoch += 1;
  writerBoundaryState.queueSuspended = true;
});
const mockDiscardSuspendedActionsForAccountBoundary = vi.fn(async () => ({
  status: 'discarded' as const,
}));
const mockResumeAfterAccountBoundary = vi.fn(() => {
  writerBoundaryState.queueEpoch += 1;
  writerBoundaryState.queueSuspended = false;
});
const mockGetCurrentSessionUserId = vi.fn(() => Promise.resolve<string | null>(null));
const mockScheduleEvents = [
  { id: 'e1', title: 'Manual Event', date: '2026-02-19', startHour: 9, startMinute: 0, endHour: 10, endMinute: 0, color: '#ff0000', source: 'manual' as const },
  { id: 'e2', title: 'Habit Event', date: '2026-02-19', startHour: 11, startMinute: 0, endHour: 12, endMinute: 0, color: '#00ff00', source: 'habit' as const },
];

vi.mock('@/stores', () => {
  const useUserDataStore = Object.assign(
    vi.fn((sel: (s: Record<string, unknown>) => unknown) =>
      sel({
      setMoods: mockSetMoods,
      setHabits: mockSetHabits,
      setFocusSessions: mockSetFocusSessions,
      setGratitudeEntries: mockSetGratitudeEntries,
      setUserName: mockSetUserName,
      setUserNameCustom: mockSetUserNameCustom,
      setScheduleEvents: mockSetScheduleEvents,
      setCanvasGoals: mockSetCanvasGoals,
      setOnboardingComplete: mockSetOnboardingComplete,
      setHasSelectedLanguage: mockSetHasSelectedLanguage,
      scheduleEvents: mockScheduleEvents,
      })
    ),
    { setState: (value: unknown) => mockSetUserDataStoreState(value) }
  );
  return { useUserDataStore };
});

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), log: vi.fn(), error: vi.fn() },
}));

vi.mock('@/storage/reminderPersistence', () => ({
  commitReminderSettingsUpdate: (update: unknown) =>
    mockCommitReminderSettingsUpdate(update),
}));

vi.mock('@/storage/settingsPreferencePersistence', () => ({
  commitPrivacySettingsUpdate: (update: unknown) =>
    mockCommitPrivacySettingsUpdate(update),
  commitProfileNameUpdate: (
    name: string,
    userChosen: boolean,
    expectedOwnerGeneration?: string,
  ) => mockCommitProfileNameUpdate(name, userChosen, expectedOwnerGeneration),
}));

vi.mock('@/lib/utils', () => ({
  generateId: vi.fn(() => 'generated-id'),
}));

vi.mock('@/lib/habits', () => ({
  normalizeHabit: vi.fn((h: unknown) => h),
}));

const mockSyncWithCloud = vi.fn((_mode: unknown) => Promise.resolve());
vi.mock('@/storage/cloudSync', () => ({
  syncWithCloud: (mode: unknown) => mockSyncWithCloud(mode),
  stopAutoSync: () => mockStopAutoSync(),
  quiesceCloudSync: () => mockQuiesceCloudSync(),
  getCloudSyncAccountBoundaryEpoch: () => writerBoundaryState.cloudEpoch,
  isCloudSyncSuspendedForAccountBoundary: () => writerBoundaryState.cloudSuspended,
  resumeCloudSync: () => mockResumeCloudSync(),
  startAutoSync: () => mockStartAutoSync(),
}));

vi.mock('@/lib/offlineQueue', () => ({
  offlineQueue: {
    suspendForAccountBoundary: () => mockSuspendForAccountBoundary(),
    discardSuspendedActionsForAccountBoundary: () =>
      mockDiscardSuspendedActionsForAccountBoundary(),
    getAccountBoundaryEpoch: () => writerBoundaryState.queueEpoch,
    isSuspendedForAccountBoundary: () => writerBoundaryState.queueSuspended,
    resumeAfterAccountBoundary: () => mockResumeAfterAccountBoundary(),
  },
}));

vi.mock('@/lib/supabaseClient', () => ({
  getCurrentSessionUserId: () => mockGetCurrentSessionUserId(),
}));

vi.mock('@/lib/settingsOwnerBoundary', () => ({
  SettingsOwnerBoundaryError: ownerBoundaryMocks.BoundaryError,
  assertSettingsOwnerCurrentWithinDataWriteBarrier:
    ownerBoundaryMocks.assertWithinDataWriteBarrier,
  readVerifiedSettingsOwnerRealm: ownerBoundaryMocks.readVerifiedRealm,
}));

const mockMoodsToArray = vi.fn(() => Promise.resolve([{ id: 'm1' }]));
const mockHabitsToArray = vi.fn(() => Promise.resolve([{ id: 'h1' }]));
const mockFocusSessionsToArray = vi.fn(() => Promise.resolve([{ id: 'f1' }]));
const mockGratitudeEntriesToArray = vi.fn(() => Promise.resolve([{ id: 'g1' }]));

vi.mock('@/storage/db', () => ({
  clearLocalUserData: () => mockClearLocalUserData(),
  db: {
    moods: { toArray: () => mockMoodsToArray() },
    habits: { toArray: () => mockHabitsToArray() },
    focusSessions: { toArray: () => mockFocusSessionsToArray() },
    gratitudeEntries: { toArray: () => mockGratitudeEntriesToArray() },
  },
}));

vi.mock('@/storage/eventSync', () => ({
  clearDeviceIdCache: () => mockClearDeviceIdCache(),
}));

vi.mock('@/hooks/useIndexedDB', () => ({
  triggerDataRefresh: () => mockTriggerDataRefresh(),
  runWithDataWriteBarrier: (
    mutation: () => Promise<unknown>,
    options?: {
      beforeAccountBoundaryAdvance?: () => void | Promise<void>;
      expectedAccountBoundaryGeneration?: string;
    },
  ) => mockRunWithDataWriteBarrier(mutation, options),
}));

// --- import under test after mocks ---

import { useSettingsHandlers } from '../useSettingsHandlers';
import { logger } from '@/lib/logger';

describe('useSettingsHandlers', () => {
  const allScheduleEvents = mockScheduleEvents;

  beforeEach(() => {
    vi.clearAllMocks();
    writerBoundaryState.cloudEpoch = 0;
    writerBoundaryState.cloudSuspended = false;
    writerBoundaryState.queueEpoch = 0;
    writerBoundaryState.queueSuspended = false;
    mockGetCurrentSessionUserId.mockResolvedValue(null);
    ownerBoundaryMocks.readVerifiedRealm.mockResolvedValue({
      kind: 'local',
      ownerUserId: null,
      generation: 'settings-generation-a',
    });
    ownerBoundaryMocks.assertWithinDataWriteBarrier.mockResolvedValue(undefined);
    mockCommitReminderSettingsUpdate.mockImplementation(
      async (
        update:
          | ReminderSettings
          | ((previous: ReminderSettings) => ReminderSettings)
      ) =>
        typeof update === 'function'
          ? update(defaultReminderSettings)
          : update
    );
    mockCommitProfileNameUpdate.mockImplementation(async (name: string, userChosen: boolean) => ({
      name,
      userChosen,
    }));
    mockCommitPrivacySettingsUpdate.mockImplementation(async (update: unknown) =>
      typeof update === 'function'
        ? update({
            noTracking: false,
            analytics: false,
            consentShown: true,
            adConsent: false,
            pushNotifications: false,
          })
        : update
    );
  });

  it('handleResetData clears persistent local data, arrays, and sets name to Friend', async () => {
    const { result } = renderHook(() => useSettingsHandlers(allScheduleEvents));

    await act(async () => {
      await result.current.handleResetData();
    });

    expect(mockQuiesceCloudSync).toHaveBeenCalled();
    expect(mockSuspendForAccountBoundary).toHaveBeenCalledTimes(1);
    expect(mockDiscardSuspendedActionsForAccountBoundary).toHaveBeenCalledTimes(1);
    expect(mockClearDeviceIdCache).toHaveBeenCalled();
    expect(mockClearLocalUserData).toHaveBeenCalled();
    expect(mockSetMoods).toHaveBeenCalledWith([]);
    expect(mockSetHabits).toHaveBeenCalledWith([]);
    expect(mockSetFocusSessions).toHaveBeenCalledWith([]);
    expect(mockSetGratitudeEntries).toHaveBeenCalledWith([]);
    expect(mockSetScheduleEvents).toHaveBeenCalledWith([]);
    expect(mockSetCanvasGoals).toHaveBeenCalledWith([]);
    expect(mockSetUserName).toHaveBeenCalledWith('Friend');
    expect(mockSetUserNameCustom).toHaveBeenCalledWith(false);
    expect(mockSetOnboardingComplete).toHaveBeenCalledWith(false);
    expect(mockSetHasSelectedLanguage).toHaveBeenCalledWith(false);
    expect(mockTriggerDataRefresh).toHaveBeenCalled();
    expect(mockResumeAfterAccountBoundary).toHaveBeenCalledTimes(1);
    expect(mockResumeCloudSync).toHaveBeenCalledTimes(1);
    expect(mockStartAutoSync).not.toHaveBeenCalled();
    expect(
      ownerBoundaryMocks.assertWithinDataWriteBarrier.mock.invocationCallOrder[0],
    ).toBeLessThan(mockDiscardSuspendedActionsForAccountBoundary.mock.invocationCallOrder[0]);
    expect(
      mockDiscardSuspendedActionsForAccountBoundary.mock.invocationCallOrder[0],
    ).toBeLessThan(mockClearLocalUserData.mock.invocationCallOrder[0]);
  });

  it('handleResetData refuses a local-only wipe when an account session is active', async () => {
    mockGetCurrentSessionUserId.mockResolvedValueOnce('account-a');
    ownerBoundaryMocks.readVerifiedRealm.mockResolvedValueOnce({
      kind: 'account',
      ownerUserId: 'account-a',
      generation: 'settings-generation-a',
    });
    const { result } = renderHook(() => useSettingsHandlers(allScheduleEvents));

    await act(async () => {
      await expect(result.current.handleResetData()).rejects.toThrow(/sign out|account/i);
    });

    expect(mockQuiesceCloudSync).not.toHaveBeenCalled();
    expect(mockSuspendForAccountBoundary).not.toHaveBeenCalled();
    expect(mockClearLocalUserData).not.toHaveBeenCalled();
  });

  it('handleResetData rechecks the session inside the destructive data barrier', async () => {
    mockGetCurrentSessionUserId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('account-a');
    ownerBoundaryMocks.assertWithinDataWriteBarrier.mockRejectedValueOnce(
      new ownerBoundaryMocks.BoundaryError(),
    );
    const { result } = renderHook(() => useSettingsHandlers(allScheduleEvents));

    await act(async () => {
      await expect(result.current.handleResetData()).rejects.toThrow(/sign out|account/i);
    });

    expect(mockQuiesceCloudSync).toHaveBeenCalledTimes(1);
    expect(mockRunWithDataWriteBarrier).toHaveBeenCalledTimes(1);
    expect(mockDiscardSuspendedActionsForAccountBoundary).not.toHaveBeenCalled();
    expect(mockClearLocalUserData).not.toHaveBeenCalled();
    expect(mockResumeAfterAccountBoundary).toHaveBeenCalledTimes(1);
    expect(mockResumeCloudSync).toHaveBeenCalledTimes(1);
  });

  it('handleResetData never resumes writer suspensions after their ownership changes', async () => {
    ownerBoundaryMocks.assertWithinDataWriteBarrier.mockImplementationOnce(async () => {
      writerBoundaryState.cloudEpoch += 1;
      writerBoundaryState.queueEpoch += 1;
      throw new ownerBoundaryMocks.BoundaryError();
    });
    const { result } = renderHook(() => useSettingsHandlers(allScheduleEvents));

    await act(async () => {
      await expect(result.current.handleResetData()).rejects.toThrow(/account boundary/i);
    });

    expect(mockDiscardSuspendedActionsForAccountBoundary).not.toHaveBeenCalled();
    expect(mockClearLocalUserData).not.toHaveBeenCalled();
    expect(mockResumeAfterAccountBoundary).not.toHaveBeenCalled();
    expect(mockResumeCloudSync).not.toHaveBeenCalled();
    expect(mockStartAutoSync).not.toHaveBeenCalled();
  });

  it.each([
    'getSession returned an auth error',
    'getSession threw',
    'the session was null while durable data remained account-owned',
  ])('handleResetData runs no reset side effect when %s', async () => {
    ownerBoundaryMocks.readVerifiedRealm.mockRejectedValueOnce(
      new ownerBoundaryMocks.BoundaryError(),
    );
    const { result } = renderHook(() => useSettingsHandlers(allScheduleEvents));

    await act(async () => {
      await expect(result.current.handleResetData()).rejects.toThrow(/account boundary/i);
    });

    expect(mockQuiesceCloudSync).not.toHaveBeenCalled();
    expect(mockSuspendForAccountBoundary).not.toHaveBeenCalled();
    expect(mockRunWithDataWriteBarrier).not.toHaveBeenCalled();
    expect(mockClearDeviceIdCache).not.toHaveBeenCalled();
    expect(mockClearLocalUserData).not.toHaveBeenCalled();
    expect(mockSetMoods).not.toHaveBeenCalled();
  });

  it('handleNameChange publishes the profile only after the durable commit', async () => {
    const { result } = renderHook(() => useSettingsHandlers(allScheduleEvents));

    await act(async () => {
      await result.current.handleNameChange('Alice');
    });

    expect(mockCommitProfileNameUpdate).toHaveBeenCalledWith('Alice', true, undefined);
    expect(mockSetUserDataStoreState).toHaveBeenCalledWith({
      userName: 'Alice',
      userNameCustom: true,
    });
  });

  it('handleNameChange can durably reset a system fallback without marking it user-chosen', async () => {
    const { result } = renderHook(() => useSettingsHandlers(allScheduleEvents));

    await act(async () => {
      await result.current.handleNameChange('Friend', false);
    });

    expect(mockCommitProfileNameUpdate).toHaveBeenCalledWith('Friend', false, undefined);
    expect(mockSetUserDataStoreState).toHaveBeenCalledWith({
      userName: 'Friend',
      userNameCustom: false,
    });
  });

  it('keeps the previous privacy state when the durable commit fails', async () => {
    mockCommitPrivacySettingsUpdate.mockRejectedValueOnce(new Error('IndexedDB unavailable'));
    const dispatch = vi.spyOn(window, 'dispatchEvent');
    const { result } = renderHook(() => useSettingsHandlers(allScheduleEvents));

    await act(async () => {
      await expect(
        result.current.handlePrivacyChange((previous) => ({ ...previous, adConsent: true }))
      ).rejects.toThrow('IndexedDB unavailable');
    });

    expect(mockSetUserDataStoreState).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'zenflow:storage-error',
        detail: expect.objectContaining({ type: 'write_failed' }),
      })
    );
    dispatch.mockRestore();
  });

  it('handleAddScheduleEvent adds event with generated id', () => {
    const { result } = renderHook(() => useSettingsHandlers(allScheduleEvents));

    act(() => {
      result.current.handleAddScheduleEvent({
        title: 'New Event',
        date: '2026-02-19',
        startHour: 14,
        startMinute: 0,
        endHour: 15,
        endMinute: 0,
        color: '#0000ff',
      });
    });

    expect(mockSetScheduleEvents).toHaveBeenCalledWith(expect.any(Function));
    // Call the updater function to verify the new event
    const updater = mockSetScheduleEvents.mock.calls[0][0] as (prev: unknown[]) => unknown[];
    const newEvents = updater([]);
    expect(newEvents).toHaveLength(1);
    expect(newEvents[0]).toMatchObject({
      id: 'generated-id',
      title: 'New Event',
      source: 'manual',
      isEditable: true,
    });
  });

  it('handleDeleteScheduleEvent removes manual events', () => {
    const { result } = renderHook(() => useSettingsHandlers(allScheduleEvents));

    act(() => {
      result.current.handleDeleteScheduleEvent('e1');
    });

    // Should call setScheduleEvents with filtered array (removing 'e1')
    expect(mockSetScheduleEvents).toHaveBeenCalled();
  });

  it('handleDeleteScheduleEvent skips habit events and logs warning', () => {
    const { result } = renderHook(() => useSettingsHandlers(allScheduleEvents));

    act(() => {
      result.current.handleDeleteScheduleEvent('e2');
    });

    expect(logger.warn).toHaveBeenCalledWith(
      '[Schedule] Cannot delete habit/google-generated event directly',
    );
    // setScheduleEvents should NOT be called for habit events
    expect(mockSetScheduleEvents).not.toHaveBeenCalled();
  });

  it('handlePullToRefresh calls syncWithCloud then reloads from db', async () => {
    const { result } = renderHook(() => useSettingsHandlers(allScheduleEvents));

    await act(async () => {
      await result.current.handlePullToRefresh();
    });

    expect(mockSyncWithCloud).toHaveBeenCalledWith('merge');
    expect(mockSetMoods).toHaveBeenCalledWith([{ id: 'm1' }]);
    expect(mockSetHabits).toHaveBeenCalled(); // normalizeHabit is called on each
    expect(mockSetFocusSessions).toHaveBeenCalledWith([{ id: 'f1' }]);
    expect(mockSetGratitudeEntries).toHaveBeenCalledWith([{ id: 'g1' }]);
  });

  it('handlePullToRefresh re-throws errors for UI feedback', async () => {
    mockSyncWithCloud.mockRejectedValueOnce(new Error('offline'));

    const { result } = renderHook(() => useSettingsHandlers(allScheduleEvents));

    // Should re-throw so PullToRefresh can show error feedback
    await act(async () => {
      await expect(result.current.handlePullToRefresh()).rejects.toThrow('offline');
    });

    // setMoods should NOT be called since sync failed
    expect(mockSetMoods).not.toHaveBeenCalled();
  });

  it('handleResetData resets onboarding state', async () => {
    const { result } = renderHook(() => useSettingsHandlers(allScheduleEvents));

    await act(async () => {
      await result.current.handleResetData();
    });

    expect(mockSetOnboardingComplete).toHaveBeenCalledWith(false);
    expect(mockSetHasSelectedLanguage).toHaveBeenCalledWith(false);
  });

  it('publishes a reminder change to memory only after its durable commit succeeds', async () => {
    const committed = {
      ...defaultReminderSettings,
      enabled: true,
      focusReminderEnabled: true,
    };
    mockCommitReminderSettingsUpdate.mockResolvedValueOnce(committed);
    const { result } = renderHook(() => useSettingsHandlers(allScheduleEvents));
    const update = (previous: ReminderSettings) => ({
      ...previous,
      enabled: true,
    });

    await act(async () => {
      await result.current.handleRemindersChange(update);
    });

    expect(mockCommitReminderSettingsUpdate).toHaveBeenCalledWith(update);
    expect(mockSetUserDataStoreState).toHaveBeenCalledWith({ reminders: committed });
  });

  it('keeps the previous reminder state and reports storage failure when the commit fails', async () => {
    mockCommitReminderSettingsUpdate.mockRejectedValueOnce(
      new Error('IndexedDB unavailable')
    );
    const dispatch = vi.spyOn(window, 'dispatchEvent');
    const { result } = renderHook(() => useSettingsHandlers(allScheduleEvents));

    await act(async () => {
      await expect(
        result.current.handleRemindersChange((previous) => ({
          ...previous,
          enabled: true,
        }))
      ).rejects.toThrow('IndexedDB unavailable');
    });

    expect(mockSetUserDataStoreState).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'zenflow:storage-error',
        detail: expect.objectContaining({ type: 'write_failed' }),
      })
    );
    dispatch.mockRestore();
  });
});
