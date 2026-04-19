/**
 * useHabitsPageState — derive() helper unit tests (no React).
 */
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
    const state = deriveHabitsPageState([], [], "2026-04-18");
    expect(state.isEmpty).toBe(true);
    expect(state.dailyProgress).toEqual({ completed: 0, total: 0, ratio: 0 });
  });

  it("filters out archived habits", () => {
    const archived: Habit = { ...baseHabit, id: "h2", isArchived: true };
    const state = deriveHabitsPageState([baseHabit, archived], [], "2026-04-18");
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
    const state = deriveHabitsPageState([baseHabit, completed], [], today);
    expect(state.dailyProgress.completed).toBe(1);
    expect(state.dailyProgress.total).toBe(2);
    expect(state.dailyProgress.ratio).toBeCloseTo(0.5, 5);
  });

  it("treats a non-array habits prop as an empty list (Law 14)", () => {
    const state = deriveHabitsPageState(
      undefined as unknown as readonly Habit[],
      undefined as unknown as never[],
      "2026-04-18",
    );
    expect(state.isEmpty).toBe(true);
    expect(state.focusSessions).toEqual([]);
  });
});
