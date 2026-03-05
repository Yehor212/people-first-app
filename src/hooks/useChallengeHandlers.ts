import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { useUIStore } from '@/stores';
import {
  getChallenges,
  getBadges,
  syncChallengeProgress,
} from '@/lib/challengeStorage';
import {
  checkFeatureUnlock,
  unlockFeature,
  type FeatureId,
} from '@/lib/onboardingFlow';
import { safeLocalStorageGet } from '@/lib/safeJson';
import type { Habit, MoodEntry, FocusSession, GratitudeEntry } from '@/types';
import { getHabitCompletedDates, isHabitCompletedOnDate } from '@/lib/habits';
import { computeEntriesWithAuto } from '@/lib/habitComputedEntries';
import { formatDate } from '@/lib/utils';
import { calculateStreak } from '@/lib/utils';

interface UseChallengeHandlersParams {
  safeMoods: MoodEntry[];
  safeHabits: Habit[];
  safeFocusSessions: FocusSession[];
  safeGratitudeEntries: GratitudeEntry[];
  currentActiveStreak: number;
  setChallenges: Dispatch<SetStateAction<ReturnType<typeof getChallenges>>>;
  setBadges: Dispatch<SetStateAction<ReturnType<typeof getBadges>>>;
}

/**
 * Challenge progress tracking, badge sync, and feature unlock detection.
 */
export function useChallengeHandlers({
  safeMoods,
  safeHabits,
  safeFocusSessions,
  safeGratitudeEntries,
  currentActiveStreak,
  setChallenges,
  setBadges,
}: UseChallengeHandlersParams) {
  const setFeatureToUnlock = useUIStore(s => s.setFeatureToUnlock);
  const setChallengeHabit = useUIStore(s => s.setChallengeHabit);

  const checkForFeatureUnlocks = useCallback(() => {
    const habitsCompleted = safeHabits.reduce((sum, h) => sum + getHabitCompletedDates(h, computeEntriesWithAuto(h)).length, 0);
    const focusSessionsCompleted = safeFocusSessions.length;
    const moodEntriesCount = safeMoods.length;

    const stats = { habitsCompleted, focusSessionsCompleted, moodEntriesCount };

    const featuresToCheck: FeatureId[] = ['focusTimer', 'xp', 'quests', 'tasks', 'challenges'];

    for (const feature of featuresToCheck) {
      const { shouldUnlock } = checkFeatureUnlock({ feature, stats });
      if (shouldUnlock) {
        unlockFeature(feature);
        setFeatureToUnlock(feature);
        break;
      }
    }
  }, [safeHabits, safeFocusSessions, safeMoods, setFeatureToUnlock]);

  const updateChallengeProgress = useCallback(() => {
    const totalFocusMinutes = safeFocusSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const totalGratitude = safeGratitudeEntries.length;
    const totalHabitsCompleted = safeHabits.reduce((sum, h) => sum + getHabitCompletedDates(h, computeEntriesWithAuto(h)).length, 0);

    // Build per-habit completed date sets (using computed entries for consistency)
    const habitCompletedSets = safeHabits.map(h => ({
      habit: h,
      dates: new Set(getHabitCompletedDates(h, computeEntriesWithAuto(h))),
    }));
    const habitDates = new Set<string>();
    habitCompletedSets.forEach(({ dates }) => dates.forEach(d => habitDates.add(d)));

    // Calculate perfect days (days where ALL active habits were completed)
    let perfectDaysCount = 0;
    habitDates.forEach(date => {
      const activeOnDate = habitCompletedSets.filter(({ habit: h }) => formatDate(new Date(h.createdAt)) <= date);
      const allCompleted = activeOnDate.length > 0 && activeOnDate.every(({ dates }) => dates.has(date));
      if (allCompleted) perfectDaysCount++;
    });

    // Calculate zen master days (days with mood + habits + focus + gratitude)
    const moodDates = new Set(safeMoods.map(m => m.date));
    const focusDates = new Set(safeFocusSessions.map(f => f.date));
    const gratitudeDates = new Set(safeGratitudeEntries.map(g => g.date));
    let zenMasterDays = 0;
    habitDates.forEach(date => {
      const hasMood = moodDates.has(date);
      const hasFocus = focusDates.has(date);
      const hasGratitude = gratitudeDates.has(date);
      const activeOnDate = habitCompletedSets.filter(({ habit: h }) => formatDate(new Date(h.createdAt)) <= date);
      const allHabits = activeOnDate.length > 0 && activeOnDate.every(({ dates }) => dates.has(date));
      if (hasMood && allHabits && hasFocus && hasGratitude) {
        zenMasterDays++;
      }
    });

    const specialBadgeData = safeLocalStorageGet<Record<string, number>>('zenflow-special-badges', {});

    const perHabitStreaks = safeHabits.map(h => {
      const dates = getHabitCompletedDates(h, computeEntriesWithAuto(h));
      return calculateStreak(dates);
    });
    const maxStreak = Math.max(currentActiveStreak || 0, ...perHabitStreaks, 0);

    const userStats = {
      totalFocusMinutes,
      currentStreak: currentActiveStreak || 0,
      longestStreak: maxStreak,
      habitsCompleted: totalHabitsCompleted,
      moodEntries: safeMoods.length,
      gratitudeEntries: totalGratitude,
      perfectDaysCount,
      earlyBirdCount: specialBadgeData.earlyBirdCount || 0,
      nightOwlCount: specialBadgeData.nightOwlCount || 0,
      zenMasterDays,
    };

    const newBadges = syncChallengeProgress(userStats, totalFocusMinutes, totalGratitude);

    setChallenges(getChallenges());

    if (newBadges.length > 0) {
      setBadges(getBadges());
    }
  }, [safeFocusSessions, safeGratitudeEntries, safeHabits, safeMoods, currentActiveStreak, setChallenges, setBadges]);

  const handleOpenChallenge = useCallback((habit?: Habit) => {
    setChallengeHabit(habit);
    useUIStore.getState().openModal('showChallengeModal');
  }, [setChallengeHabit]);

  return { checkForFeatureUnlocks, updateChallengeProgress, handleOpenChallenge };
}
