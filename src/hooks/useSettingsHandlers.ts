import { useCallback } from 'react';
import { useUserDataStore } from '@/stores';
import { logger } from '@/lib/logger';
import { generateId } from '@/lib/utils';
import { normalizeHabit } from '@/lib/habits';
import { runWithDataWriteBarrier } from '@/hooks/useIndexedDB';
import { clearLocalUserData, db } from '@/storage/db';
import {
  getCloudSyncAccountBoundaryEpoch,
  isCloudSyncSuspendedForAccountBoundary,
  quiesceCloudSync,
  resumeCloudSync,
  syncWithCloud,
} from '@/storage/cloudSync';
import { offlineQueue } from '@/lib/offlineQueue';
import {
  assertSettingsOwnerCurrentWithinDataWriteBarrier,
  readVerifiedSettingsOwnerRealm,
} from '@/lib/settingsOwnerBoundary';
import type { OriginAccountBoundaryGeneration } from '@/storage/accountBoundaryRuntime';
import { commitReminderSettingsUpdate } from '@/storage/reminderPersistence';
import {
  commitPrivacySettingsUpdate,
  commitProfileNameUpdate,
} from '@/storage/settingsPreferencePersistence';
import type { PrivacySettings, ReminderSettings, ScheduleEvent } from '@/types';

/**
 * Settings/data management handlers extracted from Index.tsx.
 * Handles reset, name change, pull-to-refresh, and schedule event CRUD.
 */
export function useSettingsHandlers(allScheduleEvents: ScheduleEvent[]) {
  const setMoods = useUserDataStore(s => s.setMoods);
  const setHabits = useUserDataStore(s => s.setHabits);
  const setFocusSessions = useUserDataStore(s => s.setFocusSessions);
  const setGratitudeEntries = useUserDataStore(s => s.setGratitudeEntries);
  const setUserName = useUserDataStore(s => s.setUserName);
  const setUserNameCustom = useUserDataStore(s => s.setUserNameCustom);
  const setScheduleEvents = useUserDataStore(s => s.setScheduleEvents);
  const setCanvasGoals = useUserDataStore(s => s.setCanvasGoals);
  const setOnboardingComplete = useUserDataStore(s => s.setOnboardingComplete);
  const setHasSelectedLanguage = useUserDataStore(s => s.setHasSelectedLanguage);

  const resetInMemoryState = useCallback(() => {
    setMoods([]);
    setHabits([]);
    setFocusSessions([]);
    setGratitudeEntries([]);
    setScheduleEvents([]);
    setCanvasGoals([]);
    setUserName('Friend');
    setUserNameCustom(false);
    setOnboardingComplete(false);
    setHasSelectedLanguage(false);
  }, [setMoods, setHabits, setFocusSessions, setGratitudeEntries, setScheduleEvents, setCanvasGoals, setUserName, setUserNameCustom, setOnboardingComplete, setHasSelectedLanguage]);

  const handleResetData = useCallback(async () => {
    const ownerRealm = await readVerifiedSettingsOwnerRealm('Local data reset');
    if (ownerRealm.kind === 'account') {
      throw new Error('Sign out before clearing local-only data');
    }
    let cloudEpoch: number | null = null;
    let queueEpoch: number | null = null;
    const ownsWriterSuspension = (): boolean =>
      cloudEpoch !== null &&
      queueEpoch !== null &&
      getCloudSyncAccountBoundaryEpoch() === cloudEpoch &&
      isCloudSyncSuspendedForAccountBoundary() &&
      offlineQueue.getAccountBoundaryEpoch() === queueEpoch &&
      offlineQueue.isSuspendedForAccountBoundary();
    const assertOwnedWriterSuspension = (): void => {
      if (!ownsWriterSuspension()) {
        throw new Error('Local data reset lost writer-suspension ownership');
      }
    };

    try {
      const cloudEpochBefore = getCloudSyncAccountBoundaryEpoch();
      const cloudSuspension = quiesceCloudSync();
      const expectedCloudEpoch = cloudEpochBefore + 1;
      if (getCloudSyncAccountBoundaryEpoch() !== expectedCloudEpoch) {
        throw new Error('Local data reset could not own cloud writer suspension');
      }
      cloudEpoch = expectedCloudEpoch;
      await cloudSuspension;

      const queueEpochBefore = offlineQueue.getAccountBoundaryEpoch();
      const queueSuspension = offlineQueue.suspendForAccountBoundary();
      const expectedQueueEpoch = queueEpochBefore + 1;
      if (offlineQueue.getAccountBoundaryEpoch() !== expectedQueueEpoch) {
        throw new Error('Local data reset could not own offline writer suspension');
      }
      queueEpoch = expectedQueueEpoch;
      await queueSuspension;
      assertOwnedWriterSuspension();

      await runWithDataWriteBarrier(
        async () => {
          assertOwnedWriterSuspension();
          const queueFinalization =
            await offlineQueue.discardSuspendedActionsForAccountBoundary();
          if (queueFinalization.status !== 'discarded') {
            throw new Error('Local data reset could not clear offline actions');
          }
          assertOwnedWriterSuspension();
          const { clearDeviceIdCache } = await import('@/storage/eventSync');
          clearDeviceIdCache();
          await clearLocalUserData();
          resetInMemoryState();
        },
        {
          deferredWrites: 'discard',
          expectedAccountBoundaryGeneration: ownerRealm.generation,
          beforeAccountBoundaryAdvance: async () => {
            assertOwnedWriterSuspension();
            await assertSettingsOwnerCurrentWithinDataWriteBarrier(
              ownerRealm,
              'Local data reset',
            );
            assertOwnedWriterSuspension();
          },
        },
      );
    } finally {
      // Resume only the exact suspension acquired by this reset. A concurrent
      // auth/account transition owns any newer epoch and must release it itself.
      if (ownsWriterSuspension()) {
        offlineQueue.resumeAfterAccountBoundary();
        resumeCloudSync();
      }
    }
  }, [resetInMemoryState]);

  const handleNameChange = useCallback(async (
    name: string,
    userChosen = true,
    expectedOwnerGeneration?: OriginAccountBoundaryGeneration,
  ): Promise<void> => {
    const committed = await commitProfileNameUpdate(
      name,
      userChosen,
      expectedOwnerGeneration,
    );
    useUserDataStore.setState({
      userName: committed.name,
      userNameCustom: committed.userChosen,
    });
  }, []);

  const handlePrivacyChange = useCallback(async (
    update: PrivacySettings | ((previous: PrivacySettings) => PrivacySettings)
  ): Promise<void> => {
    try {
      const privacy = await commitPrivacySettingsUpdate(update);
      useUserDataStore.setState({ privacy });
    } catch (error) {
      logger.error('[Settings] Failed to save privacy settings:', error);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('zenflow:storage-error', {
            detail: {
              type: 'write_failed',
              message: 'Unable to save privacy settings.',
              table: 'settings',
            },
          })
        );
      }
      throw error;
    }
  }, []);

  const handleRemindersChange = useCallback(async (
    update: ReminderSettings | ((previous: ReminderSettings) => ReminderSettings)
  ): Promise<void> => {
    try {
      const reminders = await commitReminderSettingsUpdate(update);
      useUserDataStore.setState({ reminders });
    } catch (error) {
      logger.error('[Settings] Failed to save reminder settings:', error);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('zenflow:storage-error', {
            detail: {
              type: 'write_failed',
              message: 'Unable to save reminder settings.',
              table: 'settings',
            },
          })
        );
      }
      throw error;
    }
  }, []);

  const handlePullToRefresh = useCallback(async () => {
    try {
      await syncWithCloud('merge');
      const [m, h, f, g] = await Promise.all([
        db.moods.toArray(),
        db.habits.toArray(),
        db.focusSessions.toArray(),
        db.gratitudeEntries.toArray(),
      ]);
      setMoods(m);
      setHabits(h.map(normalizeHabit));
      setFocusSessions(f);
      setGratitudeEntries(g);
    } catch (err) {
      logger.warn('[PullToRefresh] Data refresh failed:', err);
      throw err; // Re-throw so PullToRefresh can show error feedback
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: stable callback, all deps are setters
  }, []);

  const handleAddScheduleEvent = useCallback((event: Omit<ScheduleEvent, 'id'>) => {
    const newEvent: ScheduleEvent = {
      ...event,
      id: generateId(),
      source: 'manual',
      isEditable: true,
    };
    setScheduleEvents(prev => [...prev, newEvent]);
  }, [setScheduleEvents]);

  const handleDeleteScheduleEvent = useCallback((id: string) => {
    const eventToDelete = allScheduleEvents.find(e => e.id === id);
    if (eventToDelete?.source === 'habit' || eventToDelete?.source === 'google') {
      logger.warn('[Schedule] Cannot delete habit/google-generated event directly');
      return;
    }
    setScheduleEvents(prev => prev.filter(e => e.id !== id));
  }, [allScheduleEvents, setScheduleEvents]);

  return {
    handleResetData,
    handleNameChange,
    handlePrivacyChange,
    handleRemindersChange,
    handlePullToRefresh,
    handleAddScheduleEvent,
    handleDeleteScheduleEvent,
  };
}
