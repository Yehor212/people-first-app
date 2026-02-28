import { useCallback, useEffect, useRef } from 'react';
import { useUIStore, useUserDataStore } from '@/stores';
import { useLanguage } from '@/contexts/LanguageContext';
import { triggerXpPopup } from '@/components/XpPopup';
import { triggerSync } from '@/storage/cloudSync';
import { haptics } from '@/lib/haptics';
import { normalizeHabit } from '@/lib/habits';
import { findTemplateIdByName, getHabitTemplateName } from '@/lib/habitTemplates';
import { addFriendActivity, loadMyProfile } from '@/storage/friendsSync';
import { recordHabitForChallenge } from '@/lib/comebackChallenge';
import { updateAllQuestsProgress } from '@/lib/randomQuests';
import { SK } from '@/lib/storageKeys';
import { safeLocalStorageGet, safeLocalStorageSet } from '@/lib/safeJson';
import { analytics } from '@/lib/analytics';
import type { Habit } from '@/types';

interface UseHabitHandlersParams {
  awardXp: (activity: string) => void;
  earnTreats: (source: string, amount: number, reason?: string) => { earned: number };
  plantSeed: (activity: string, extra?: string) => unknown;
  waterPlants: (activity: string) => void;
  updateChallengeProgress: () => void;
  checkForFeatureUnlocks: () => void;
}

/**
 * Habit CRUD + toggle handlers, time-of-day tracking, habit localization.
 * Owns processingHabitsRef and processingTimeoutRef internally.
 */
export function useHabitHandlers({
  awardXp,
  earnTreats,
  plantSeed,
  waterPlants,
  updateChallengeProgress,
  checkForFeatureUnlocks,
}: UseHabitHandlersParams) {
  const { language } = useLanguage();
  const habits = useUserDataStore(s => s.habits);
  const setHabits = useUserDataStore(s => s.setHabits);
  const setConfettiBurst = useUIStore(s => s.setConfettiBurst);

  const processingHabitsRef = useRef<Set<string>>(new Set());
  const processingTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Track early bird / night owl for special badges
  const trackTimeOfDayCompletion = useCallback(() => {
    const hour = new Date().getHours();
    const data: Record<string, number> = safeLocalStorageGet(SK.SPECIAL_BADGES, {});

    if (hour < 8) {
      data.earlyBirdCount = (data.earlyBirdCount || 0) + 1;
    } else if (hour >= 22) {
      data.nightOwlCount = (data.nightOwlCount || 0) + 1;
    }

    safeLocalStorageSet(SK.SPECIAL_BADGES, data);
  }, []);

  const handleToggleHabit = (habitId: string, date: string) => {
    // Guard against rapid double-clicks
    const processingKey = `${habitId}-${date}`;
    if (processingHabitsRef.current.has(processingKey)) return;
    processingHabitsRef.current.add(processingKey);

    processingTimeoutRef.current = setTimeout(() => {
      processingHabitsRef.current.delete(processingKey);
    }, 500);

    setHabits(prev => prev.map(habit => {
      if (habit.id !== habitId) return habit;

      const habitType = habit.type || 'daily';

      if (habitType === 'reduce') return habit;
      if (habitType === 'continuous') return habit;

      // Multiple times per day habits
      if (habitType === 'multiple') {
        const completionsByDate = { ...(habit.completionsByDate || {}) };
        const current = completionsByDate[date] ?? 0;
        const target = habit.dailyTarget ?? 1;

        if (current < target) {
          completionsByDate[date] = current + 1;
          awardXp('habit');
          const treatResult = earnTreats('habit', 10, 'Completed habit');
          triggerXpPopup(treatResult.earned, 'habit');
          void haptics.habitToggled();
          trackTimeOfDayCompletion();
          analytics.habitCompleted(habit.name);
        }

        const existingDates = habit.completedDates || [];
        return {
          ...habit,
          completionsByDate,
          completedDates: completionsByDate[date] >= target
            ? [...new Set([...existingDates, date])]
            : existingDates.filter(d => d !== date),
          updatedAt: new Date().toISOString(),
        };
      }

      // Daily and scheduled habits (normal toggle)
      const existingDates = habit.completedDates || [];
      const completed = existingDates.includes(date);
      if (!completed) {
        awardXp('habit');
        const treatResult = earnTreats('habit', 10, 'Completed habit');
        triggerXpPopup(treatResult.earned, 'habit');
        void haptics.habitCompleted();
        setConfettiBurst({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        trackTimeOfDayCompletion();
        analytics.habitCompleted(habit.name);
        plantSeed('habit');
        waterPlants('habit');

        // Track for friends activity feed
        const friendProfile = loadMyProfile();
        if (friendProfile) {
          addFriendActivity({
            friendId: friendProfile.friendCode,
            friendName: friendProfile.displayName,
            activityType: 'habit_completed',
            description: habit.name,
            icon: habit.icon || '✅',
          });
        }

        // Track comeback challenge progress
        const challengeResult = recordHabitForChallenge(date);
        if (challengeResult.challengeComplete) {
          earnTreats('habit', challengeResult.bonusXp, 'Comeback Challenge Complete!');
          triggerXpPopup(challengeResult.bonusXp, 'bonus');
        }
      }
      return {
        ...habit,
        completedDates: completed
          ? existingDates.filter(d => d !== date)
          : [...existingDates, date],
        updatedAt: new Date().toISOString(),
      };
    }));
    triggerSync();

    updateChallengeProgress();
    checkForFeatureUnlocks();

    const completedQuests = updateAllQuestsProgress({ type: 'habit_completed', value: 1 });
    completedQuests.forEach(quest => {
      const xpReward = quest.reward.xp;
      earnTreats('habit', xpReward, `Quest: ${quest.title}`);
      triggerXpPopup(xpReward, 'bonus');
    });
  };

  const handleAdjustHabit = (habitId: string, date: string, delta: number) => {
    setHabits(prev => prev.map(habit => {
      if (habit.id !== habitId) return habit;
      const habitType = habit.type || 'daily';

      if (habitType === 'reduce') {
        const progressByDate = { ...(habit.progressByDate || {}) };
        const current = typeof progressByDate[date] === 'number' ? progressByDate[date] : 0;
        progressByDate[date] = Math.max(0, current + delta);
        return { ...habit, progressByDate };
      }

      if (habitType === 'multiple') {
        const completionsByDate = { ...(habit.completionsByDate || {}) };
        const current = completionsByDate[date] ?? 0;
        const target = habit.dailyTarget ?? 1;
        const next = Math.max(0, Math.min(target, current + delta));
        completionsByDate[date] = next;
        const existingDates = habit.completedDates || [];
        return {
          ...habit,
          completionsByDate,
          completedDates: next >= target
            ? [...new Set([...existingDates, date])]
            : existingDates.filter(d => d !== date),
          updatedAt: new Date().toISOString(),
        };
      }

      return habit;
    }));
    triggerSync();
  };

  const handleAddHabit = (habit: Habit) => {
    setHabits(prev => [...prev, habit]);
    triggerSync();
  };

  const handleUpdateHabit = (updatedHabit: Habit) => {
    setHabits(prev => prev.map(h => h.id === updatedHabit.id ? updatedHabit : h));
    triggerSync();
  };

  const handleDeleteHabit = (habitId: string) => {
    setHabits(prev => prev.filter(h => h.id !== habitId));
    triggerSync();
  };

  // ── Loop-style Habit Hub actions ──────────────────────────────────────────

  const handleArchiveHabit = (habitId: string) => {
    setHabits(prev => prev.map(h =>
      h.id === habitId ? { ...h, isArchived: true, updatedAt: new Date().toISOString() } : h,
    ));
    triggerSync();
  };

  const handleUnarchiveHabit = (habitId: string) => {
    setHabits(prev => prev.map(h =>
      h.id === habitId ? { ...h, isArchived: false, updatedAt: new Date().toISOString() } : h,
    ));
    triggerSync();
  };

  const handleSkipHabit = (habitId: string, date: string) => {
    setHabits(prev => prev.map(h => {
      if (h.id !== habitId) return h;
      const existing = h.skippedDates || [];
      if (existing.includes(date)) return h; // no duplicates
      return { ...h, skippedDates: [...existing, date], updatedAt: new Date().toISOString() };
    }));
    triggerSync();
  };

  const handleUnskipHabit = (habitId: string, date: string) => {
    setHabits(prev => prev.map(h => {
      if (h.id !== habitId) return h;
      const existing = h.skippedDates || [];
      if (!existing.includes(date)) return h;
      return { ...h, skippedDates: existing.filter(d => d !== date), updatedAt: new Date().toISOString() };
    }));
    triggerSync();
  };

  // Habit localization: update habit names when language changes
  const safeHabitsLength = Array.isArray(habits) ? habits.length : 0;
  useEffect(() => {
    if (safeHabitsLength === 0) return;
    setHabits(prev => {
      let changed = false;
      const updated = prev.map(habit => {
        const normalized = normalizeHabit(habit);
        const templateId = normalized.templateId || findTemplateIdByName(normalized.name);
        if (!templateId) {
          if (normalized !== habit) changed = true;
          return normalized;
        }
        const localizedName = getHabitTemplateName(templateId, language);
        if (normalized.name !== localizedName || normalized.templateId !== templateId || normalized !== habit) {
          changed = true;
          return { ...normalized, name: localizedName, templateId };
        }
        if (normalized !== habit) changed = true;
        return normalized;
      });
      return changed ? updated : prev;
    });
  }, [language, safeHabitsLength, setHabits]);

  return {
    handleToggleHabit,
    handleAdjustHabit,
    handleAddHabit,
    handleUpdateHabit,
    handleDeleteHabit,
    handleArchiveHabit,
    handleUnarchiveHabit,
    handleSkipHabit,
    handleUnskipHabit,
    processingTimeoutRef,
  };
}
