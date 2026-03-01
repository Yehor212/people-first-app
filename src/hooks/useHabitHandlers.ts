import { useCallback, useEffect, useRef } from 'react';
import { useUIStore, useUserDataStore } from '@/stores';
import { useLanguage } from '@/contexts/LanguageContext';
import { triggerXpPopup } from '@/components/XpPopup';
import { triggerSync } from '@/storage/cloudSync';
import { haptics } from '@/lib/haptics';
import { normalizeHabit } from '@/lib/habits';
import { getNextToggleValue, setEntryValue, toStoredValue } from '@/lib/habits';
import { findTemplateIdByName, getHabitTemplateName } from '@/lib/habitTemplates';
import { addFriendActivity, loadMyProfile } from '@/storage/friendsSync';
import { recordHabitForChallenge } from '@/lib/comebackChallenge';
import { updateAllQuestsProgress } from '@/lib/randomQuests';
import { SK } from '@/lib/storageKeys';
import { safeLocalStorageGet, safeLocalStorageSet } from '@/lib/safeJson';
import { analytics } from '@/lib/analytics';
import { ENTRY } from '@/types';
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
 * Habit CRUD + entry-based toggle handlers.
 * Toggle cycle: UNKNOWN → YES_MANUAL → SKIP → NO → UNKNOWN
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

  /** Fire side effects when a habit is completed (XP, treats, confetti, etc.) */
  const fireCompletionEffects = useCallback((habit: Habit) => {
    awardXp('habit');
    const treatResult = earnTreats('habit', 10, 'Completed habit');
    triggerXpPopup(treatResult.earned, 'habit');
    void haptics.habitCompleted();
    setConfettiBurst({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    trackTimeOfDayCompletion();
    analytics.habitCompleted(habit.name);
    plantSeed('habit');
    waterPlants('habit');

    // Friends activity feed
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

    // Comeback challenge
    const today = new Date().toISOString().slice(0, 10);
    const challengeResult = recordHabitForChallenge(today);
    if (challengeResult.challengeComplete) {
      earnTreats('habit', challengeResult.bonusXp, 'Comeback Challenge Complete!');
      triggerXpPopup(challengeResult.bonusXp, 'bonus');
    }
  }, [awardXp, earnTreats, plantSeed, waterPlants, setConfettiBurst, trackTimeOfDayCompletion]);

  /**
   * Toggle a boolean habit entry for a given date.
   * Cycle: UNKNOWN → YES_MANUAL → SKIP → NO → UNKNOWN
   */
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

      const currentValue = habit.entries?.[date]?.value ?? ENTRY.UNKNOWN;
      const nextValue = getNextToggleValue(currentValue);

      // Fire effects when transitioning TO YES_MANUAL
      if (nextValue === ENTRY.YES_MANUAL) {
        fireCompletionEffects(habit);
      } else {
        void haptics.habitToggled();
      }

      return {
        ...habit,
        entries: setEntryValue(habit.entries || {}, date, nextValue),
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

  /**
   * Set a numerical value for a habit on a given date.
   * realValue is the user-facing number (e.g. 2.5 liters).
   */
  const handleSetNumericalValue = (habitId: string, date: string, realValue: number) => {
    setHabits(prev => prev.map(habit => {
      if (habit.id !== habitId) return habit;

      const storedValue = toStoredValue(realValue);
      const prevValue = habit.entries?.[date]?.value ?? 0;

      // Fire effects if newly meeting target
      if (habit.targetValue > 0) {
        const prevMet = prevValue > 0 && (prevValue / 1000) >= habit.targetValue;
        const nowMet = realValue >= habit.targetValue;
        if (nowMet && !prevMet) {
          fireCompletionEffects(habit);
        }
      }

      return {
        ...habit,
        entries: setEntryValue(habit.entries || {}, date, storedValue),
        updatedAt: new Date().toISOString(),
      };
    }));
    triggerSync();
  };

  /**
   * Adjust a numerical value by delta (increment/decrement).
   */
  const handleAdjustHabit = (habitId: string, date: string, delta: number) => {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    const currentStored = habit.entries?.[date]?.value ?? 0;
    const currentReal = currentStored > 0 ? currentStored / 1000 : 0;
    const newReal = Math.max(0, currentReal + delta);

    handleSetNumericalValue(habitId, date, newReal);
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

  // ── Loop-style actions ──────────────────────────────────────────────────────

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
      const currentValue = h.entries?.[date]?.value ?? ENTRY.UNKNOWN;
      if (currentValue === ENTRY.SKIP) return h;
      return {
        ...h,
        entries: setEntryValue(h.entries || {}, date, ENTRY.SKIP),
        updatedAt: new Date().toISOString(),
      };
    }));
    triggerSync();
  };

  const handleUnskipHabit = (habitId: string, date: string) => {
    setHabits(prev => prev.map(h => {
      if (h.id !== habitId) return h;
      const currentValue = h.entries?.[date]?.value ?? ENTRY.UNKNOWN;
      if (currentValue !== ENTRY.SKIP) return h;
      return {
        ...h,
        entries: setEntryValue(h.entries || {}, date, ENTRY.UNKNOWN),
        updatedAt: new Date().toISOString(),
      };
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
    handleSetNumericalValue,
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
