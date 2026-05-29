import { useCallback } from 'react';
import { useUserDataStore } from '@/stores';
import { logger } from '@/lib/logger';
import { generateId } from '@/lib/utils';
import { normalizeHabit } from '@/lib/habits';
import { triggerDataRefresh } from '@/hooks/useIndexedDB';
import { clearLocalUserData, db } from '@/storage/db';
import { stopAutoSync, syncWithCloud } from '@/storage/cloudSync';
import type { ScheduleEvent } from '@/types';

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
    stopAutoSync();
    const { clearDeviceIdCache } = await import('@/storage/eventSync');
    clearDeviceIdCache();
    await clearLocalUserData();
    resetInMemoryState();
    triggerDataRefresh();
  }, [resetInMemoryState]);

  const handleNameChange = useCallback((name: string) => {
    setUserName(name);
    setUserNameCustom(true);
  }, [setUserName, setUserNameCustom]);

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
    handlePullToRefresh,
    handleAddScheduleEvent,
    handleDeleteScheduleEvent,
  };
}
