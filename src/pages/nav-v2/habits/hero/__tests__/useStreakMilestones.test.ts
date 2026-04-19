/**
 * useStreakMilestones — pure helpers + hook transition coverage.
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  didCrossMilestone,
  milestoneForStreak,
  useStreakMilestones,
  STREAK_MILESTONES,
} from "../useStreakMilestones";
import type { Habit } from "@/types";

vi.mock("@/lib/habitScore", () => ({
  // Simple mock: return habit.__mockStreak — lets us drive transitions from tests
  getCurrentStreak: (h: Habit & { __mockStreak?: number }) => h.__mockStreak ?? 0,
}));

const habit = (id: string, streak: number): Habit & { __mockStreak: number } => ({
  id,
  name: `h-${id}`,
  icon: "x",
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
  __mockStreak: streak,
});

describe("milestoneForStreak", () => {
  it("returns matching threshold", () => {
    for (const m of STREAK_MILESTONES) {
      expect(milestoneForStreak(m)).toBe(m);
    }
  });
  it("returns null for non-milestones", () => {
    [0, 1, 2, 4, 20, 22, 65, 67, 99, 101].forEach((n) => {
      expect(milestoneForStreak(n)).toBeNull();
    });
  });
});

describe("didCrossMilestone", () => {
  it("detects crossing into 3", () => {
    expect(didCrossMilestone(2, 3)).toBe(3);
    expect(didCrossMilestone(0, 3)).toBe(3);
  });
  it("detects crossing into 7", () => {
    expect(didCrossMilestone(6, 7)).toBe(7);
    expect(didCrossMilestone(3, 7)).toBe(7); // jump past 3 is OK — returns next crossed
  });
  it("returns earliest crossed when multiple", () => {
    // prev=0, next=10 crosses 3 AND 7 — returns the earliest (3)
    expect(didCrossMilestone(0, 10)).toBe(3);
  });
  it("does not fire on non-increase", () => {
    expect(didCrossMilestone(7, 7)).toBeNull();
    expect(didCrossMilestone(10, 5)).toBeNull();
  });
  it("does not fire when no milestone in range", () => {
    expect(didCrossMilestone(8, 20)).toBeNull(); // 21 not yet crossed
    expect(didCrossMilestone(22, 30)).toBeNull();
  });
});

describe("useStreakMilestones hook", () => {
  it("does not fire on initial seed", () => {
    const { result } = renderHook(({ habits }) => useStreakMilestones(habits), {
      initialProps: { habits: [habit("a", 7)] as Habit[] },
    });
    expect(result.current.event).toBeNull();
  });

  it("fires when streak crosses a milestone", () => {
    const { result, rerender } = renderHook(
      ({ habits }) => useStreakMilestones(habits),
      { initialProps: { habits: [habit("a", 2)] as Habit[] } },
    );
    expect(result.current.event).toBeNull();
    rerender({ habits: [habit("a", 3)] as Habit[] });
    expect(result.current.event?.milestone).toBe(3);
    expect(result.current.event?.streak).toBe(3);
    expect(result.current.event?.habit.id).toBe("a");
  });

  it("queues multi-habit simultaneous transitions FIFO", () => {
    const { result, rerender } = renderHook(
      ({ habits }) => useStreakMilestones(habits),
      {
        initialProps: {
          habits: [habit("a", 2), habit("b", 6)] as Habit[],
        },
      },
    );
    rerender({ habits: [habit("a", 3), habit("b", 7)] as Habit[] });
    // First event = habit a @ milestone 3
    expect(result.current.event?.habit.id).toBe("a");
    act(() => result.current.dismiss());
    // Dismiss surfaces the next queued event (b @ 7)
    expect(result.current.event?.habit.id).toBe("b");
    expect(result.current.event?.milestone).toBe(7);
  });

  it("does not re-fire on the same streak rerender", () => {
    const { result, rerender } = renderHook(
      ({ habits }) => useStreakMilestones(habits),
      { initialProps: { habits: [habit("a", 2)] as Habit[] } },
    );
    rerender({ habits: [habit("a", 3)] as Habit[] });
    expect(result.current.event?.milestone).toBe(3);
    act(() => result.current.dismiss());
    // Streak stays at 3 — no new event
    rerender({ habits: [habit("a", 3)] as Habit[] });
    expect(result.current.event).toBeNull();
  });

  it("dismiss clears the current event", () => {
    const { result, rerender } = renderHook(
      ({ habits }) => useStreakMilestones(habits),
      { initialProps: { habits: [habit("a", 2)] as Habit[] } },
    );
    rerender({ habits: [habit("a", 3)] as Habit[] });
    expect(result.current.event).not.toBeNull();
    act(() => result.current.dismiss());
    expect(result.current.event).toBeNull();
  });
});
