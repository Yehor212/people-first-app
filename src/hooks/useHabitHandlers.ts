import { useCallback, useEffect, useRef } from "react";
import { useUIStore, useUserDataStore } from "@/stores";
import { useLanguage } from "@/contexts/LanguageContext";
import { triggerXpPopup } from "@/components/XpPopup";
import { triggerSync } from "@/storage/cloudSync";
import { syncHabit, deleteHabitFromCloud } from "@/storage/realtimeSync";
import { trackDeletedHabitId } from "@/storage/deletionTracker";
import { logger } from "@/lib/logger";
import { haptics, hapticTap } from "@/lib/haptics";
import { doesNumericalStoredValueMeetTarget, normalizeHabit } from "@/lib/habits";
import { getNextToggleValue, setEntryValue, toStoredValue } from "@/lib/habits";
import { findTemplateIdByName, getHabitTemplateName } from "@/lib/habitTemplates";
import { addFriendActivity, loadMyProfile } from "@/storage/friendsSync";
import { recordHabitForChallenge } from "@/lib/comebackChallenge";
import { getToday } from "@/lib/utils";
import { getChallenges, saveChallenges } from "@/lib/challengeStorage";
import { updateAllQuestsProgress } from "@/lib/randomQuests";
import { SK } from "@/lib/storageKeys";
import { safeLocalStorageGet, safeLocalStorageSet } from "@/lib/safeJson";
import { analytics } from "@/lib/analytics";
import { playSound } from "@/lib/audioManager";
import { getCurrentStreak } from "@/lib/habitScore";
import { LIMITS } from "@/lib/constants";
import { ENTRY } from "@/types";
import type { Habit, TreatSource, MoodType } from "@/types";
import type { HabitEntrySource } from "@/types";
import type { XpAction } from "@/lib/gamification";
import type { PlantActivity } from "@/stores/useHydrateGamification";
import { commitHabitEntry } from "@/lib/habitEntryCommit";
import { reportDurablePersistenceFailure } from "@/lib/durablePersistenceFailure";

export { commitHabitEntry } from "@/lib/habitEntryCommit";

interface UseHabitHandlersParams {
  awardXp: (action: XpAction) => void;
  earnTreats: (
    source: TreatSource,
    baseAmount: number,
    description?: string
  ) => { earned: number; bonus: number; multiplier: number; newBalance: number };
  plantSeed: (sourceActivity: PlantActivity, mood?: MoodType) => null;
  waterPlants: (sourceActivity: PlantActivity) => void;
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
  const habits = useUserDataStore((s) => s.habits);
  const setHabits = useUserDataStore((s) => s.setHabits);
  const publishDurableHabits = useUserDataStore((s) => s._publishDurableHabits);
  const setScheduleEvents = useUserDataStore((s) => s.setScheduleEvents);
  const setReminders = useUserDataStore((s) => s.setReminders);
  const setConfettiBurst = useUIStore((s) => s.setConfettiBurst);

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

  const entryMetadata = useCallback(
    (date: string, source: HabitEntrySource) => ({
      loggedAt: new Date().toISOString(),
      source: date === getToday() ? source : "calendar",
    }),
    []
  );

  /** Fire side effects when a habit is completed (XP, treats, confetti, etc.) */
  const fireCompletionEffects = useCallback(
    (habit: Habit) => {
      awardXp("habit");
      const treatResult = earnTreats("habit", 10, ts.completedHabitReason || "Completed habit");
      triggerXpPopup(treatResult.earned, "habit");
      void haptics.habitCompleted();
      const nextStreak = getCurrentStreak(habit);
      playSound([7, 14, 21, 30, 60, 90, 100, 365].includes(nextStreak) ? "streak" : "complete");
      setConfettiBurst({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      trackTimeOfDayCompletion();
      // §15 retention cohort — emit the total active-habit count so the
      // aggregator can compute the 7-day completion rate for ≥3-habit users.
      analytics.habitCompleted(habit.name, habits.filter((h) => !h.isArchived).length);
      plantSeed("habit");
      waterPlants("habit");

      // Friends activity feed
      const friendProfile = loadMyProfile();
      if (friendProfile) {
        addFriendActivity({
          friendId: friendProfile.friendCode,
          friendName: friendProfile.displayName,
          activityType: "habit_completed",
          description: habit.name,
          icon: habit.icon || "✅",
        });
      }

      // Comeback challenge
      const today = getToday();
      const challengeResult = recordHabitForChallenge(today);
      if (challengeResult.challengeComplete) {
        earnTreats(
          "habit",
          challengeResult.bonusXp,
          ts.comebackChallengeComplete || "Comeback Challenge Complete!"
        );
        triggerXpPopup(challengeResult.bonusXp, "bonus");
      }
    },
    [
      awardXp,
      earnTreats,
      plantSeed,
      waterPlants,
      setConfettiBurst,
      trackTimeOfDayCompletion,
      ts,
      habits,
    ]
  );

  const reportPersistenceFailure = useCallback(
    (error: unknown) => {
      reportDurablePersistenceFailure(error, {
        domain: "Habits",
        localizedMessage: t.storageErrorDesc,
      });
    },
    [t.storageErrorDesc]
  );

  /**
   * Toggle a boolean habit entry for a given date.
   * Cycle: UNKNOWN ↔ YES_MANUAL (binary; SKIP/NO via detail sheet)
   */
  const handleToggleHabit = useCallback(
    (habitId: string, date: string) => {
      // Guard against rapid double-clicks (per-habit-date key)
      const processingKey = `${habitId}-${date}`;
      if (processingHabitsRef.current.has(processingKey)) return;
      processingHabitsRef.current.add(processingKey);

      // Read current value BEFORE state update to determine side effects
      const habit = habits.find((h) => h.id === habitId);
      if (!habit) {
        processingHabitsRef.current.delete(processingKey);
        return;
      }
      const currentValue = habit?.entries?.[date]?.value ?? ENTRY.UNKNOWN;
      const nextValue = getNextToggleValue(currentValue);
      const wasComplete = currentValue === ENTRY.YES_MANUAL || currentValue === ENTRY.YES_AUTO;
      const isCompletionTransition = nextValue === ENTRY.YES_MANUAL && !wasComplete;
      const metadata = entryMetadata(date, "quickTap");
      const nextHabit: Habit = {
        ...habit,
        entries: setEntryValue(habit.entries || {}, date, nextValue, undefined, metadata),
        updatedAt: metadata.loggedAt,
      };

      void commitHabitEntry(nextHabit, isCompletionTransition ? date : null, {
        entryDate: date,
        setHabits: publishDurableHabits,
        onCompleted: (committedHabit) => {
          fireCompletionEffects(committedHabit);
          const completedQuests = updateAllQuestsProgress({
            type: "habit_completed",
            value: 1,
          });
          completedQuests.forEach((quest) => {
            const xpReward = quest.reward.xp;
            earnTreats("habit", xpReward, `${ts.questPrefix || "Quest"}: ${quest.title}`);
            triggerXpPopup(xpReward, "bonus");
          });
        },
        onCommitted: () => {
          if (!isCompletionTransition) void haptics.habitToggled();
          triggerSync();
          updateChallengeProgress();
          checkForFeatureUnlocks();
        },
      })
        .catch(reportPersistenceFailure)
        .finally(() => {
          const prevTimeout = processingTimeoutsRef.current.get(processingKey);
          if (prevTimeout) clearTimeout(prevTimeout);
          processingTimeoutsRef.current.set(
            processingKey,
            setTimeout(() => {
              processingHabitsRef.current.delete(processingKey);
              processingTimeoutsRef.current.delete(processingKey);
            }, 500)
          );
        });
    },
    [
      habits,
      publishDurableHabits,
      fireCompletionEffects,
      earnTreats,
      updateChallengeProgress,
      checkForFeatureUnlocks,
      ts,
      entryMetadata,
      reportPersistenceFailure,
    ]
  );

  /**
   * Set a numerical value for a habit on a given date.
   * realValue is the user-facing number (e.g. 2.5 liters).
   */
  const handleSetNumericalValue = useCallback(
    (habitId: string, date: string, realValue: number) => {
      const habit = habits.find((h) => h.id === habitId);
      if (!habit) return;
      const prevValue = habit?.entries?.[date]?.value;
      const storedValue = toStoredValue(realValue);
      const prevMet = doesNumericalStoredValueMeetTarget(habit, prevValue);
      const nowMet = doesNumericalStoredValueMeetTarget(habit, storedValue);
      const isCompletionTransition = nowMet && !prevMet;
      const metadata = entryMetadata(date, "exactInput");
      const nextHabit: Habit = {
        ...habit,
        entries: setEntryValue(habit.entries || {}, date, storedValue, undefined, metadata),
        updatedAt: metadata.loggedAt,
      };

      void commitHabitEntry(nextHabit, isCompletionTransition ? date : null, {
        entryDate: date,
        setHabits: publishDurableHabits,
        onCompleted: fireCompletionEffects,
        onCommitted: () => {
          triggerSync();
        },
      }).catch(reportPersistenceFailure);
    },
    [habits, publishDurableHabits, fireCompletionEffects, entryMetadata, reportPersistenceFailure]
  );

  /**
   * Adjust a numerical value by delta (increment/decrement).
   * Uses updater pattern to avoid stale closure on rapid taps.
   */
  const handleAdjustHabit = useCallback(
    (habitId: string, date: string, delta: number) => {
      // Guard against rapid double-taps (per-habit-date key)
      const processingKey = `${habitId}-${date}`;
      if (processingHabitsRef.current.has(processingKey)) return;
      processingHabitsRef.current.add(processingKey);

      void hapticTap();

      // Capture current state BEFORE update for completion detection
      const habit = habits.find((h) => h.id === habitId);
      if (!habit) {
        processingHabitsRef.current.delete(processingKey);
        return;
      }
      const currentStored = habit?.entries?.[date]?.value;
      const currentReal = currentStored && currentStored > 0 ? currentStored / 1000 : 0;
      const newReal = Math.max(0, currentReal + delta);
      const storedValue = toStoredValue(newReal);
      const prevMet = doesNumericalStoredValueMeetTarget(habit, currentStored);
      const nowMet = doesNumericalStoredValueMeetTarget(habit, storedValue);
      const isCompletionTransition = nowMet && !prevMet;
      const metadata = entryMetadata(date, "quickTap");
      const nextHabit: Habit = {
        ...habit,
        entries: setEntryValue(habit.entries || {}, date, storedValue, undefined, metadata),
        updatedAt: metadata.loggedAt,
      };

      void commitHabitEntry(nextHabit, isCompletionTransition ? date : null, {
        entryDate: date,
        setHabits: publishDurableHabits,
        onCompleted: fireCompletionEffects,
        onCommitted: () => {
          triggerSync();
        },
      })
        .catch(reportPersistenceFailure)
        .finally(() => {
          const prevTimeout = processingTimeoutsRef.current.get(processingKey);
          if (prevTimeout) clearTimeout(prevTimeout);
          processingTimeoutsRef.current.set(
            processingKey,
            setTimeout(() => {
              processingHabitsRef.current.delete(processingKey);
              processingTimeoutsRef.current.delete(processingKey);
            }, 300)
          );
        });
    },
    [habits, publishDurableHabits, fireCompletionEffects, entryMetadata, reportPersistenceFailure]
  );

  const handleAddHabit = (habit: Habit) => {
    // Guard: enforce MAX_HABITS limit (non-archived only)
    const activeCount = habits.filter((h) => !h.isArchived).length;
    if (activeCount >= LIMITS.MAX_HABITS) {
      logger.warn(`[Habits] MAX_HABITS limit reached (${LIMITS.MAX_HABITS})`);
      return;
    }
    setHabits((prev) => [...prev, habit]);
    triggerSync();
    void syncHabit(habit).catch(() => logger.warn("[Habits] Granular sync failed"));
  };

  const handleUpdateHabit = (updatedHabit: Habit) => {
    setHabits((prev) => prev.map((h) => (h.id === updatedHabit.id ? updatedHabit : h)));
    triggerSync();
    void syncHabit(updatedHabit).catch(() => logger.warn("[Habits] Granular sync failed"));
  };

  const handleDeleteHabit = (habitId: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== habitId));

    // Cascade: remove orphaned schedule events
    setScheduleEvents((prev) => prev.filter((e) => e.habitId !== habitId));

    // Cascade: remove habitId from reminder settings
    setReminders((prev) => ({
      ...prev,
      habitIds: prev.habitIds.filter((id) => id !== habitId),
    }));

    // Cascade: remove challenges referencing this habit
    const challenges = getChallenges();
    const filtered = challenges.filter((c) => c.habitId !== habitId);
    if (filtered.length !== challenges.length) {
      saveChallenges(filtered);
    }

    // Track deletion locally so cloud sync merge never restores this habit
    void trackDeletedHabitId(habitId);

    // Delete from cloud habits table immediately (untrack on success)
    deleteHabitFromCloud(habitId).catch(() => {
      // graceful: local delete already succeeded; cloud retry via syncOrchestrator
      logger.error("[Habits] Cloud delete failed");
    });

    triggerSync();
  };

  // ── Loop-style actions ──────────────────────────────────────────────────────

  const handleArchiveHabit = (habitId: string) => {
    const habit = habits.find((h) => h.id === habitId);
    setHabits((prev) =>
      prev.map((h) =>
        h.id === habitId ? { ...h, isArchived: true, updatedAt: new Date().toISOString() } : h
      )
    );
    triggerSync();
    if (habit)
      void syncHabit({ ...habit, isArchived: true, updatedAt: new Date().toISOString() }).catch(
        () => logger.warn("[Habits] Archive sync failed")
      );
  };

  const handleUnarchiveHabit = (habitId: string) => {
    const habit = habits.find((h) => h.id === habitId);
    setHabits((prev) =>
      prev.map((h) =>
        h.id === habitId ? { ...h, isArchived: false, updatedAt: new Date().toISOString() } : h
      )
    );
    triggerSync();
    if (habit)
      void syncHabit({ ...habit, isArchived: false, updatedAt: new Date().toISOString() }).catch(
        () => logger.warn("[Habits] Unarchive sync failed")
      );
  };

  const handleSkipHabit = (habitId: string, date: string) => {
    const habit = habits.find((candidate) => candidate.id === habitId);
    if (!habit || habit.entries?.[date]?.value === ENTRY.SKIP) return;
    const metadata = entryMetadata(date, "skip");
    const nextHabit = {
      ...habit,
      entries: setEntryValue(habit.entries || {}, date, ENTRY.SKIP, undefined, metadata),
      updatedAt: metadata.loggedAt,
    };
    void commitHabitEntry(nextHabit, null, {
      entryDate: date,
      setHabits: publishDurableHabits,
      onCommitted: triggerSync,
    }).catch(reportPersistenceFailure);
  };

  const handleUnskipHabit = (habitId: string, date: string) => {
    const habit = habits.find((candidate) => candidate.id === habitId);
    if (!habit || habit.entries?.[date]?.value !== ENTRY.SKIP) return;
    const nextHabit = {
      ...habit,
      entries: setEntryValue(habit.entries || {}, date, ENTRY.UNKNOWN),
      updatedAt: new Date().toISOString(),
    };
    void commitHabitEntry(nextHabit, null, {
      entryDate: date,
      setHabits: publishDurableHabits,
      onCommitted: triggerSync,
    }).catch(reportPersistenceFailure);
  };

  // Habit localization: update habit names when language changes
  // Value-based comparison (normalizeHabit always returns a new object, so !== is always true)
  const safeHabitsLength = Array.isArray(habits) ? habits.length : 0;
  useEffect(() => {
    if (safeHabitsLength === 0) return;
    setHabits((prev) => {
      let changed = false;
      const updated = prev.map((habit) => {
        const normalized = normalizeHabit(habit);
        const templateId = normalized.templateId || findTemplateIdByName(normalized.name);

        // Check if normalization actually changed field values (not just object identity)
        const needsNormalization =
          !habit.entries ||
          !habit.reminders ||
          habit.habitType !== normalized.habitType ||
          habit.frequency?.numerator !== normalized.frequency?.numerator ||
          habit.frequency?.denominator !== normalized.frequency?.denominator;

        if (!templateId) {
          if (needsNormalization) {
            changed = true;
            return normalized;
          }
          return habit;
        }
        const localizedName = getHabitTemplateName(templateId, language);
        if (
          needsNormalization ||
          normalized.name !== localizedName ||
          normalized.templateId !== templateId
        ) {
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
