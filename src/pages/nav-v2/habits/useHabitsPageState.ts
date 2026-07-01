/**
 * useHabitsPageState — selectors-only hook for the Phase 3-C HabitsPage.
 *
 * Read-only consumer of {@link useUserDataStore}. Uses {@link useShallow} to
 * subscribe to the slice this page actually renders (habits),
 * keeping component re-renders aligned with the underlying data shape rather
 * than the entire user-data record.
 *
 * No mutations are issued from this hook — Hero / Garden / MindMap zones
 * each call their own action surfaces (or compose existing shared components),
 * preserving Law 14 (State Integrity) and Law 15 (Component Isolation).
 */

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useUserDataStore } from "@/stores";
import { isHabitCompletedOnDate } from "@/lib/habits";
import { isHabitDueOnDate } from "@/lib/habitScheduling";
import { getToday } from "@/lib/utils";
import type { Habit } from "@/types";

export interface HabitsPageDailyProgress {
  /** Number of habits completed for today. */
  completed: number;
  /** Total active habits (excludes archived). */
  total: number;
  /** 0..1 — completion ratio for the daily progress ring. */
  ratio: number;
}

export interface HabitsPageStateValue {
  /** Active (non-archived) habits, stable identity across renders. */
  habits: Habit[];
  /** Subset of {@link habits} that the user is meant to perform today. */
  todaysHabits: Habit[];
  /** Aggregate daily progress for the Hero zone ring. */
  dailyProgress: HabitsPageDailyProgress;
  /** True when there are no active habits at all (empty state cue). */
  isEmpty: boolean;
}

/** Pure helper — extracted for unit testing without React. */
export function deriveHabitsPageState(
  rawHabits: readonly Habit[],
  today: string,
): HabitsPageStateValue {
  // Defensive: array might be undefined mid-hydration (Law 14 — array validation)
  const habits = Array.isArray(rawHabits) ? rawHabits.filter((h) => !h.isArchived) : [];
  const todaysHabits = habits.filter((h) => isHabitDueOnDate(h, today));
  const completed = todaysHabits.reduce(
    (acc, h) => (isHabitCompletedOnDate(h, today) ? acc + 1 : acc),
    0,
  );
  const total = todaysHabits.length;
  const ratio = total === 0 ? 0 : completed / total;

  return {
    habits,
    todaysHabits,
    dailyProgress: { completed, total, ratio },
    isEmpty: habits.length === 0,
  };
}

export function useHabitsPageState(): HabitsPageStateValue {
  const habits = useUserDataStore(useShallow((s) => s.habits));

  return useMemo(
    () => deriveHabitsPageState(habits, getToday()),
    [habits],
  );
}
