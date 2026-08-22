import { useCallback, useEffect, useRef } from "react";
import { useUIStore, useUserDataStore } from "@/stores";
import { useLanguage } from "@/contexts/LanguageContext";
import { triggerXpPopup } from "@/components/XpPopup";
import { triggerSync } from "@/storage/cloudSync";
import { syncHabit, syncHabitCompletion, deleteHabitFromCloud } from "@/storage/realtimeSync";
import { commitHabitEntry, commitHabitToggle } from "@/storage/habitCompletionCommit";
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

const RAPID_COMPLETION_RETRY_WINDOW_MS = 750;

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
  const setScheduleEvents = useUserDataStore((s) => s.setScheduleEvents);
  const setReminders = useUserDataStore((s) => s.setReminders);
  const setConfettiBurst = useUIStore((s) => s.setConfettiBurst);

  const processingHabitsRef = useRef<Set<string>>(new Set());
  const processingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const recentCompletionsRef = useRef<Map<string, number>>(new Map());

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
    (habit: Habit, date: string) => {
      awardXp("habit");
      const treatResult = earnTreats("habit", 10, ts.completedHabitReason || "Completed habit");
      triggerXpPopup(treatResult.earned, "habit");
      void haptics.habitCompleted();
      const completedHabit = {
        ...habit,
        entries: setEntryValue(
          habit.entries || {},
          date,
          ENTRY.YES_MANUAL,
          undefined,
          entryMetadata(date, "quickTap")
        ),
      };
      const nextStreak = getCurrentStreak(completedHabit);
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
      entryMetadata,
    ]
  );

  /**
   * Toggle a boolean habit entry for a given date.
   * Cycle: UNKNOWN ↔ YES_MANUAL (binary; SKIP/NO via detail sheet)
   */
  const handleToggleHabit = useCallback(
    async (habitId: string, date: string) => {
      // Guard against rapid double-clicks (per-habit-date key)
      const processingKey = `${habitId}-${date}`;
      if (processingHabitsRef.current.has(processingKey)) return;
      const completedAt = recentCompletionsRef.current.get(processingKey);
      if (completedAt !== undefined) {
        if (Date.now() - completedAt < RAPID_COMPLETION_RETRY_WINDOW_MS) return;
        recentCompletionsRef.current.delete(processingKey);
      }
      processingHabitsRef.current.add(processingKey);

      try {
        const { habit, nextValue } = await commitHabitToggle(habitId, date, "quickTap");

        // The persisted record is now the source for the in-memory projection.
        setHabits((prev) => prev.map((item) => (item.id === habitId ? habit : item)));

        // Side effects and publication occur only after the durable commit.
        if (nextValue === ENTRY.YES_MANUAL) {
          recentCompletionsRef.current.set(processingKey, Date.now());
          fireCompletionEffects(habit, date);

          // Quest progress — only on actual completion, not un-completion
          const completedQuests = updateAllQuestsProgress({ type: "habit_completed", value: 1 });
          completedQuests.forEach((quest) => {
            const xpReward = quest.reward.xp;
            earnTreats("habit", xpReward, `${ts.questPrefix || "Quest"}: ${quest.title}`);
            triggerXpPopup(xpReward, "bonus");
          });
        } else {
          void haptics.habitToggled();
        }

        triggerSync();
        void syncHabitCompletion(
          habitId,
          date,
          nextValue > 0,
          nextValue > 2 ? Math.round(nextValue / 1000) : 1,
          undefined,
          {
            habitType: habit.habitType ?? "boolean",
            targetType: habit.targetType,
            entryValue: nextValue,
          }
        ).catch((err) => logger.warn("[Habits] Completion sync failed:", err));
        updateChallengeProgress();
        checkForFeatureUnlocks();
      } catch (error) {
        logger.error("[Habits] Durable completion commit failed:", error);
      } finally {
        processingHabitsRef.current.delete(processingKey);
      }
    },
    [
      habits,
      setHabits,
      fireCompletionEffects,
      earnTreats,
      updateChallengeProgress,
      checkForFeatureUnlocks,
      ts,
      entryMetadata,
    ]
  );

  /**
   * Set a numerical value for a habit on a given date.
   * realValue is the user-facing number (e.g. 2.5 liters).
   */
  const handleSetNumericalValue = useCallback(
    async (habitId: string, date: string, realValue: number) => {
      // Read current state BEFORE update for completion detection
      const habit = habits.find((h) => h.id === habitId);
      if (!habit) return;
      const prevValue = habit?.entries?.[date]?.value;

      const storedValue = toStoredValue(realValue);

      try {
        const committedHabit = await commitHabitEntry(habitId, date, storedValue, "exactInput");
        setHabits((prev) => prev.map((item) => (item.id === habitId ? committedHabit : item)));

        // Fire completion effects only after the durable commit.
        const prevMet = doesNumericalStoredValueMeetTarget(habit, prevValue);
        const nowMet = doesNumericalStoredValueMeetTarget(committedHabit, storedValue);
        if (nowMet && !prevMet) {
          fireCompletionEffects(committedHabit, date);
        }

        triggerSync();
        void syncHabitCompletion(
          habitId,
          date,
          nowMet,
          Math.max(1, Math.round(realValue)),
          storedValue,
          {
            habitType: committedHabit.habitType ?? "numerical",
            targetType: committedHabit.targetType,
            entryValue: storedValue,
          }
        ).catch((err) => logger.warn("[Habits] Completion sync failed:", err));
      } catch (error) {
        logger.error("[Habits] Durable numerical completion commit failed:", error);
      }
    },
    [habits, setHabits, fireCompletionEffects, entryMetadata]
  );

  /**
   * Adjust a numerical value by delta (increment/decrement).
   * Uses updater pattern to avoid stale closure on rapid taps.
   */
  const handleAdjustHabit = useCallback(
    async (habitId: string, date: string, delta: number) => {
      // Guard against rapid double-taps (per-habit-date key)
      const processingKey = `${habitId}-${date}`;
      if (processingHabitsRef.current.has(processingKey)) return;
      processingHabitsRef.current.add(processingKey);

      // Capture current state BEFORE update for completion detection
      const habit = habits.find((h) => h.id === habitId);
      if (!habit) return;
      const currentStored = habit?.entries?.[date]?.value;
      const currentReal = currentStored && currentStored > 0 ? currentStored / 1000 : 0;
      const newReal = Math.max(0, currentReal + delta);

      const storedValue = toStoredValue(newReal);
      try {
        const committedHabit = await commitHabitEntry(habitId, date, storedValue, "quickTap");
        setHabits((prev) => prev.map((item) => (item.id === habitId ? committedHabit : item)));
        const prevMet = doesNumericalStoredValueMeetTarget(habit, currentStored);
        const nowMet = doesNumericalStoredValueMeetTarget(committedHabit, storedValue);
        if (nowMet && !prevMet) {
          fireCompletionEffects(committedHabit, date);
        }

        void hapticTap();
        triggerSync();
        void syncHabitCompletion(
          habitId,
          date,
          nowMet,
          Math.max(1, Math.round(newReal)),
          storedValue,
          {
            habitType: committedHabit.habitType ?? "numerical",
            targetType: committedHabit.targetType,
            entryValue: storedValue,
          }
        ).catch((err) => logger.warn("[Habits] Completion sync failed:", err));
      } catch (error) {
        logger.error("[Habits] Durable numerical completion commit failed:", error);
      } finally {
        processingHabitsRef.current.delete(processingKey);
      }
    },
    [habits, setHabits, fireCompletionEffects]
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
    void syncHabit(habit).catch((err) => logger.warn("[Habits] Granular sync failed:", err));
  };

  const handleUpdateHabit = (updatedHabit: Habit) => {
    setHabits((prev) => prev.map((h) => (h.id === updatedHabit.id ? updatedHabit : h)));
    triggerSync();
    void syncHabit(updatedHabit).catch((err) => logger.warn("[Habits] Granular sync failed:", err));
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
    deleteHabitFromCloud(habitId).catch((err) => {
      // graceful: local delete already succeeded; cloud retry via syncOrchestrator
      logger.error("[Habits] Cloud delete failed:", err);
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
        (err) => logger.warn("[Habits] Archive sync failed:", err)
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
        (err) => logger.warn("[Habits] Unarchive sync failed:", err)
      );
  };

  const handleSkipHabit = (habitId: string, date: string) => {
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== habitId) return h;
        const currentValue = h.entries?.[date]?.value ?? ENTRY.UNKNOWN;
        if (currentValue === ENTRY.SKIP) return h;
        return {
          ...h,
          entries: setEntryValue(
            h.entries || {},
            date,
            ENTRY.SKIP,
            undefined,
            entryMetadata(date, "skip")
          ),
          updatedAt: new Date().toISOString(),
        };
      })
    );
    triggerSync();
    void syncHabitCompletion(habitId, date, false).catch((err) =>
      logger.warn("[Habits] Skip sync failed:", err)
    );
  };

  const handleUnskipHabit = (habitId: string, date: string) => {
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== habitId) return h;
        const currentValue = h.entries?.[date]?.value ?? ENTRY.UNKNOWN;
        if (currentValue !== ENTRY.SKIP) return h;
        return {
          ...h,
          entries: setEntryValue(h.entries || {}, date, ENTRY.UNKNOWN),
          updatedAt: new Date().toISOString(),
        };
      })
    );
    triggerSync();
    void syncHabitCompletion(habitId, date, false).catch((err) =>
      logger.warn("[Habits] Unskip sync failed:", err)
    );
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
