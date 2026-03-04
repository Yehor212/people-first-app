import { useCallback, useEffect, useRef } from 'react';
import { useUIStore, useUserDataStore } from '@/stores';
import { useLanguage } from '@/contexts/LanguageContext';
import { triggerXpPopup } from '@/components/XpPopup';
import { triggerSync } from '@/storage/cloudSync';
import { haptics, hapticTap } from '@/lib/haptics';
import { normalizeHabit } from '@/lib/habits';
import { getNextToggleValue, setEntryValue, toStoredValue } from '@/lib/habits';
import { findTemplateIdByName, getHabitTemplateName } from '@/lib/habitTemplates';
import { addFriendActivity, loadMyProfile } from '@/storage/friendsSync';
import { recordHabitForChallenge } from '@/lib/comebackChallenge';
import { getToday } from '@/lib/utils';
import { getChallenges, saveChallenges } from '@/lib/challengeStorage';
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
 * Toggle cycle: UNKNOWN ↔ YES_MANUAL (binary; SKIP/NO via detail sheet)
 */
export function useHabitHandlers({
  awardXp,
  earnTreats,
  plantSeed,
  waterPlants,
  updateChallengeProgress,
  checkForFeatureUnlocks,
}: UseHabitHandlersParams) {
  const { t, language } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const habits = useUserDataStore(s => s.habits);
  const setHabits = useUserDataStore(s => s.setHabits);
  const setScheduleEvents = useUserDataStore(s => s.setScheduleEvents);
  const setReminders = useUserDataStore(s => s.setReminders);
  const setConfettiBurst = useUIStore(s => s.setConfettiBurst);

  const processingHabitsRef = useRef<Set<string>>(new Set());
  const processingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

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
    const treatResult = earnTreats('habit', 10, ts.completedHabitReason || 'Completed habit');
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
    const today = getToday();
    const challengeResult = recordHabitForChallenge(today);
    if (challengeResult.challengeComplete) {
      earnTreats('habit', challengeResult.bonusXp, ts.comebackChallengeComplete || 'Comeback Challenge Complete!');
      triggerXpPopup(challengeResult.bonusXp, 'bonus');
    }
  }, [awardXp, earnTreats, plantSeed, waterPlants, setConfettiBurst, trackTimeOfDayCompletion, ts]);

  /**
   * Toggle a boolean habit entry for a given date.
   * Cycle: UNKNOWN ↔ YES_MANUAL (binary; SKIP/NO via detail sheet)
   */
  const handleToggleHabit = useCallback((habitId: string, date: string) => {
    // Guard against rapid double-clicks (per-habit-date key)
    const processingKey = `${habitId}-${date}`;
    if (processingHabitsRef.current.has(processingKey)) return;
    processingHabitsRef.current.add(processingKey);

    const prevTimeout = processingTimeoutsRef.current.get(processingKey);
    if (prevTimeout) clearTimeout(prevTimeout);
    processingTimeoutsRef.current.set(processingKey, setTimeout(() => {
      processingHabitsRef.current.delete(processingKey);
      processingTimeoutsRef.current.delete(processingKey);
    }, 500));

    // Read current value BEFORE state update to determine side effects
    const habit = habits.find(h => h.id === habitId);
    const currentValue = habit?.entries?.[date]?.value ?? ENTRY.UNKNOWN;
    const nextValue = getNextToggleValue(currentValue);

    // Pure state updater — no side effects inside
    setHabits(prev => prev.map(h => {
      if (h.id !== habitId) return h;
      return {
        ...h,
        entries: setEntryValue(h.entries || {}, date, nextValue),
        updatedAt: new Date().toISOString(),
      };
    }));

    // Side effects OUTSIDE updater (safe from React 18 double-invoke)
    if (nextValue === ENTRY.YES_MANUAL && habit) {
      fireCompletionEffects(habit);
    } else {
      void haptics.habitToggled();
    }

    triggerSync();
    updateChallengeProgress();
    checkForFeatureUnlocks();

    const completedQuests = updateAllQuestsProgress({ type: 'habit_completed', value: 1 });
    completedQuests.forEach(quest => {
      const xpReward = quest.reward.xp;
      earnTreats('habit', xpReward, `${ts.questPrefix || 'Quest'}: ${quest.title}`);
      triggerXpPopup(xpReward, 'bonus');
    });
  }, [habits, setHabits, fireCompletionEffects, earnTreats, updateChallengeProgress, checkForFeatureUnlocks, ts]);

  /**
   * Set a numerical value for a habit on a given date.
   * realValue is the user-facing number (e.g. 2.5 liters).
   */
  const handleSetNumericalValue = useCallback((habitId: string, date: string, realValue: number) => {
    // Read current state BEFORE update for completion detection
    const habit = habits.find(h => h.id === habitId);
    const prevValue = habit?.entries?.[date]?.value ?? 0;

    const storedValue = toStoredValue(realValue);

    // Pure state updater — no side effects
    setHabits(prev => prev.map(h => {
      if (h.id !== habitId) return h;
      return {
        ...h,
        entries: setEntryValue(h.entries || {}, date, storedValue),
        updatedAt: new Date().toISOString(),
      };
    }));

    // Fire completion effects OUTSIDE updater if newly meeting target
    if (habit && habit.targetValue > 0) {
      const isAtMost = habit.targetType === 'atMost';
      const prevMet = prevValue > 0 && (isAtMost
        ? (prevValue / 1000) <= habit.targetValue
        : (prevValue / 1000) >= habit.targetValue);
      const nowMet = isAtMost
        ? realValue <= habit.targetValue
        : realValue >= habit.targetValue;
      if (nowMet && !prevMet) {
        fireCompletionEffects(habit);
      }
    }

    triggerSync();
  }, [habits, setHabits, fireCompletionEffects]);

  /**
   * Adjust a numerical value by delta (increment/decrement).
   * Uses updater pattern to avoid stale closure on rapid taps.
   */
  const handleAdjustHabit = useCallback((habitId: string, date: string, delta: number) => {
    // Guard against rapid double-taps (per-habit-date key)
    const processingKey = `${habitId}-${date}`;
    if (processingHabitsRef.current.has(processingKey)) return;
    processingHabitsRef.current.add(processingKey);

    void hapticTap();

    const prevTimeout = processingTimeoutsRef.current.get(processingKey);
    if (prevTimeout) clearTimeout(prevTimeout);
    processingTimeoutsRef.current.set(processingKey, setTimeout(() => {
      processingHabitsRef.current.delete(processingKey);
      processingTimeoutsRef.current.delete(processingKey);
    }, 300));

    // Capture current state BEFORE update for completion detection
    const habit = habits.find(h => h.id === habitId);
    const currentStored = habit?.entries?.[date]?.value ?? 0;
    const currentReal = currentStored > 0 ? currentStored / 1000 : 0;
    const newReal = Math.max(0, currentReal + delta);

    setHabits(prev => {
      const h = prev.find(x => x.id === habitId);
      if (!h) return prev;

      const storedValue = toStoredValue(newReal);

      return prev.map(x => x.id !== habitId ? x : {
        ...x,
        entries: setEntryValue(x.entries || {}, date, storedValue),
        updatedAt: new Date().toISOString(),
      });
    });

    // Fire completion effects OUTSIDE updater if newly meeting target
    if (habit && habit.targetValue > 0) {
      const isAtMost = habit.targetType === 'atMost';
      const prevMet = currentReal > 0 && (isAtMost ? currentReal <= habit.targetValue : currentReal >= habit.targetValue);
      const nowMet = isAtMost ? newReal <= habit.targetValue : newReal >= habit.targetValue;
      if (nowMet && !prevMet) {
        fireCompletionEffects(habit);
      }
    }

    triggerSync();
  }, [habits, setHabits, fireCompletionEffects]);

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

    // Cascade: remove orphaned schedule events
    setScheduleEvents(prev => prev.filter(e => e.habitId !== habitId));

    // Cascade: remove habitId from reminder settings
    setReminders(prev => ({
      ...prev,
      habitIds: prev.habitIds.filter(id => id !== habitId),
    }));

    // Cascade: remove challenges referencing this habit
    const challenges = getChallenges();
    const filtered = challenges.filter(c => c.habitId !== habitId);
    if (filtered.length !== challenges.length) {
      saveChallenges(filtered);
    }

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
  // Value-based comparison (normalizeHabit always returns a new object, so !== is always true)
  const safeHabitsLength = Array.isArray(habits) ? habits.length : 0;
  useEffect(() => {
    if (safeHabitsLength === 0) return;
    setHabits(prev => {
      let changed = false;
      const updated = prev.map(habit => {
        const normalized = normalizeHabit(habit);
        const templateId = normalized.templateId || findTemplateIdByName(normalized.name);

        // Check if normalization actually changed field values (not just object identity)
        const needsNormalization = !habit.entries || !habit.reminders
          || habit.habitType !== normalized.habitType
          || habit.frequency?.numerator !== normalized.frequency?.numerator
          || habit.frequency?.denominator !== normalized.frequency?.denominator;

        if (!templateId) {
          if (needsNormalization) { changed = true; return normalized; }
          return habit;
        }
        const localizedName = getHabitTemplateName(templateId, language);
        if (needsNormalization || normalized.name !== localizedName || normalized.templateId !== templateId) {
          changed = true;
          return { ...normalized, name: localizedName, templateId };
        }
        return habit;
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
    processingTimeoutsRef,
  };
}
