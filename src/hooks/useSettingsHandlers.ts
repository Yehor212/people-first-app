import { useCallback } from 'react';
import { useUserDataStore } from '@/stores';
import { logger } from '@/lib/logger';
import { generateId } from '@/lib/utils';
import { normalizeHabit } from '@/lib/habits';
import { db } from '@/storage/db';
import { syncWithCloud } from '@/storage/cloudSync';
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
  const setOnboardingComplete = useUserDataStore(s => s.setOnboardingComplete);
  const setHasSelectedLanguage = useUserDataStore(s => s.setHasSelectedLanguage);
  const scheduleEvents = useUserDataStore(s => s.scheduleEvents);

  const handleResetData = useCallback(() => {
    setMoods([]);
    setHabits([]);
    setFocusSessions([]);
    setGratitudeEntries([]);
    setUserName('Friend');
    setUserNameCustom(false);
    setOnboardingComplete(false);
    setHasSelectedLanguage(false);
  }, [setMoods, setHabits, setFocusSessions, setGratitudeEntries, setUserName, setUserNameCustom, setOnboardingComplete, setHasSelectedLanguage]);

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
    } catch {
      // Silently fail — offline banner will show if no connection
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setScheduleEvents(scheduleEvents.filter(e => e.id !== id));
  }, [allScheduleEvents, scheduleEvents, setScheduleEvents]);

  return {
    handleResetData,
    handleNameChange,
    handlePullToRefresh,
    handleAddScheduleEvent,
    handleDeleteScheduleEvent,
  };
}
