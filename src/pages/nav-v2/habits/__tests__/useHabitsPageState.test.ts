/**
 * useHabitsPageState — derive() helper unit tests (no React).
 */
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { deriveHabitsPageState } from "../useHabitsPageState";
import type { Habit } from "@/types";

const baseHabit: Habit = {
  id: "h1",
  name: "Hydrate",
  icon: "💧",
  color: 0,
  position: 0,
  createdAt: 0,
  habitType: "boolean",
  frequency: { numerator: 1, denominator: 1 },
  question: "",
  description: "",
  isArchived: false,
  targetValue: 1,
  targetType: "atLeast",
  unit: "",
  entries: {},
  reminders: [],
};

describe("deriveHabitsPageState", () => {
  it("returns isEmpty=true and zero progress for an empty habit list", () => {
    const state = deriveHabitsPageState([], "2026-04-18");
    expect(state.isEmpty).toBe(true);
    expect(state.dailyProgress).toEqual({ completed: 0, total: 0, ratio: 0 });
  });

  it("filters out archived habits", () => {
    const archived: Habit = { ...baseHabit, id: "h2", isArchived: true };
    const state = deriveHabitsPageState([baseHabit, archived], "2026-04-18");
    expect(state.habits).toHaveLength(1);
    expect(state.habits[0]?.id).toBe("h1");
  });

  it("computes daily progress ratio based on entries for the given date", () => {
    const today = "2026-04-18";
    const completed: Habit = {
      ...baseHabit,
      id: "h2",
      entries: { [today]: { value: 1 } },
    };
    const state = deriveHabitsPageState([baseHabit, completed], today);
    expect(state.dailyProgress.completed).toBe(1);
    expect(state.dailyProgress.total).toBe(2);
    expect(state.dailyProgress.ratio).toBeCloseTo(0.5, 5);
  });

  it("counts only habits that are scheduled for today", () => {
    const today = "2026-04-20"; // Monday
    const mondayHabit: Habit = {
      ...baseHabit,
      id: "mon",
      schedule: { mode: "specificDays", period: "week", targetCount: 1, dueDays: [1] },
      entries: { [today]: { value: 2 } },
    };
    const wednesdayHabit: Habit = {
      ...baseHabit,
      id: "wed",
      schedule: { mode: "specificDays", period: "week", targetCount: 1, dueDays: [3] },
      entries: { [today]: { value: 2 } },
    };

    const state = deriveHabitsPageState([mondayHabit, wednesdayHabit], today);

    expect(state.isEmpty).toBe(false);
    expect(state.todaysHabits.map((h) => h.id)).toEqual(["mon"]);
    expect(state.dailyProgress).toEqual({ completed: 1, total: 1, ratio: 1 });
  });

  it("keeps active-habit state when no habits are due today", () => {
    const today = "2026-04-20"; // Monday
    const wednesdayHabit: Habit = {
      ...baseHabit,
      id: "wed",
      schedule: { mode: "specificDays", period: "week", targetCount: 1, dueDays: [3] },
    };

    const state = deriveHabitsPageState([wednesdayHabit], today);

    expect(state.isEmpty).toBe(false);
    expect(state.todaysHabits).toEqual([]);
    expect(state.dailyProgress).toEqual({ completed: 0, total: 0, ratio: 0 });
  });

  it("keeps the page hook subscribed only to habit data rendered by HabitsPage", () => {
    const source = readFileSync("src/pages/nav-v2/habits/useHabitsPageState.ts", "utf8");

    expect(source).not.toContain("focusSessions: s.focusSessions");
    expect(source).not.toContain("focusSessions: FocusSession[]");
  });

  it("treats a non-array habits prop as an empty list (Law 14)", () => {
    const state = deriveHabitsPageState(
      undefined as unknown as readonly Habit[],
      "2026-04-18",
    );
    expect(state.isEmpty).toBe(true);
  });
});
