import { useMemo } from 'react';
import { useAppStore, useUserDataStore } from '@/stores';
import { generateHabitScheduleEvents, mergeScheduleEvents } from '@/lib/habitScheduleSync';
import { calculateStreak } from '@/lib/utils';
import type { Habit } from '@/types';

interface InnerWorldData {
  restDays: string[];
}

/**
 * Derived data computations extracted from Index.tsx.
 * All useMemos that compute schedule events, CTA state, and widget data.
 * Reads directly from userDataStore (arrays already validated at hydration).
 */
export function useDerivedData(innerWorld: InnerWorldData, badges: Array<{ id: string; unlocked?: boolean; unlockedDate?: string; title?: Record<string, string> }>) {
  const moods = useUserDataStore(s => s.moods);
  const habits = useUserDataStore(s => s.habits);
  const focusSessions = useUserDataStore(s => s.focusSessions);
  const gratitudeEntries = useUserDataStore(s => s.gratitudeEntries);
  const scheduleEvents = useUserDataStore(s => s.scheduleEvents);
  const currentDate = useAppStore(s => s.currentDate);

  // Schedule events
  const habitScheduleEvents = useMemo(() => {
    return generateHabitScheduleEvents(habits, 7);
  }, [habits]);

  const allScheduleEvents = useMemo(() => {
    return mergeScheduleEvents(scheduleEvents, habitScheduleEvents);
  }, [scheduleEvents, habitScheduleEvents]);

  const todayAllEvents = useMemo(() => {
    return allScheduleEvents.filter(e => e.date === currentDate);
  }, [allScheduleEvents, currentDate]);

  // CTA system
  const hasMoodToday = useMemo(() => {
    return moods.some(m => m.date === currentDate);
  }, [moods, currentDate]);

  const hasFocusToday = useMemo(() => {
    return focusSessions.some(s => s.date === currentDate);
  }, [focusSessions, currentDate]);

  const hasGratitudeToday = useMemo(() => {
    return gratitudeEntries.some(g => g.date === currentDate);
  }, [gratitudeEntries, currentDate]);

  const habitsDueToday = useMemo(() => {
    const todayDow = new Date().getDay();
    return habits.filter((habit: Habit) => {
      if (habit.frequency === 'custom' && habit.customDays) {
        return habit.customDays.includes(todayDow);
      }
      if (habit.frequency === 'weekly') {
        return todayDow === new Date(habit.createdAt).getDay();
      }
      return true;
    });
  }, [habits]);

  const hasUncompletedHabits = useMemo(() => {
    if (habitsDueToday.length === 0) return false;
    return habitsDueToday.some(h => {
      const habitType = h.type || 'daily';
      if (habitType === 'continuous') return h.failedDates?.includes(currentDate) ?? false;
      if (habitType === 'reduce') {
        const progress = h.progressByDate?.[currentDate];
        return progress === undefined || progress > (h.targetCount ?? 0);
      }
      if (habitType === 'multiple') {
        const completions = h.completionsByDate?.[currentDate] ?? 0;
        return completions < (h.dailyTarget ?? 1);
      }
      return !h.completedDates?.includes(currentDate);
    });
  }, [habitsDueToday, currentDate]);

  const completedTodayCount = useMemo(() => {
    return habitsDueToday.filter(h => {
      const habitType = h.type || 'daily';
      if (habitType === 'reduce') {
        const progress = h.progressByDate?.[currentDate];
        return progress !== undefined && progress <= (h.targetCount ?? 0);
      }
      if (habitType === 'multiple') {
        const completions = h.completionsByDate?.[currentDate] ?? 0;
        return completions >= (h.dailyTarget ?? 1);
      }
      if (habitType === 'continuous') {
        return !(h.failedDates?.includes(currentDate));
      }
      return h.completedDates?.includes(currentDate);
    }).length;
  }, [habitsDueToday, currentDate]);

  const currentPrimaryCTA = useMemo(() => {
    if (!hasMoodToday) return 'mood' as const;
    if (hasUncompletedHabits) return 'habits' as const;
    if (!hasFocusToday) return 'focus' as const;
    if (!hasGratitudeToday) return 'gratitude' as const;
    return 'complete' as const;
  }, [hasMoodToday, hasUncompletedHabits, hasFocusToday, hasGratitudeToday]);

  // Widget data
  const todayFocusMinutes = useMemo(() => {
    return focusSessions
      .filter(s => s.date.startsWith(currentDate))
      .reduce((sum, s) => sum + (s.duration || 0), 0);
  }, [focusSessions, currentDate]);

  const lastBadgeName = useMemo(() => {
    const safeBadges = Array.isArray(badges) ? badges : [];
    const unlockedBadges = safeBadges.filter(b => b.unlocked && b.unlockedDate);
    if (!unlockedBadges.length) return undefined;
    const latest = unlockedBadges.sort((a, b) =>
      (b.unlockedDate || '').localeCompare(a.unlockedDate || '')
    )[0];
    return latest.title?.['en'] || latest.id;
  }, [badges]);

  const widgetStreak = useMemo(() => {
    const allActivityDates = [
      ...moods.map(m => m.date),
      ...habits.flatMap(h => h.completedDates || []),
      ...focusSessions.map(f => f.date),
      ...gratitudeEntries.map(g => g.date),
      ...(innerWorld.restDays || []),
    ];
    const uniqueActivityDates = [...new Set(allActivityDates)].sort();
    return calculateStreak(uniqueActivityDates);
  }, [moods, habits, focusSessions, gratitudeEntries, innerWorld.restDays]);

  return {
    // Schedule
    allScheduleEvents,
    todayAllEvents,
    // CTA
    habitsDueToday,
    completedTodayCount,
    currentPrimaryCTA,
    // Widget
    todayFocusMinutes,
    lastBadgeName,
    widgetStreak,
  };
}
