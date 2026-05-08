import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeHabitStatsSnapshot } from "../habitStatsSnapshot";
import { makeTestHabit, datesToEntries, numericalEntries } from "@/test/habitFixtures";
import { ENTRY } from "@/types";

describe("computeHabitStatsSnapshot", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 2, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("treats a one-tap numerical target as on pace from the habit start date", () => {
    const sleep = makeTestHabit({
      id: "legacy-sleep-duration",
      name: "Legacy sleep duration",
      habitType: "numerical",
      targetValue: 8,
      unit: "hr",
      createdAt: new Date("2026-05-02T08:00:00").getTime(),
      entries: numericalEntries({ "2026-05-02": 8 }),
    });

    const snapshot = computeHabitStatsSnapshot(sleep, "2026-05-02");
    const week = snapshot.periods[0];

    expect(snapshot.today.status).toBe("done");
    expect(week.actual).toBe(8);
    expect(week.expectedToDate).toBe(8);
    expect(week.percentToDate).toBe(100);
  });

  it("does not convert an empty atMost day into success", () => {
    const limit = makeTestHabit({
      habitType: "numerical",
      targetType: "atMost",
      targetValue: 2,
      createdAt: new Date("2026-05-02T08:00:00").getTime(),
      entries: {},
    });

    const snapshot = computeHabitStatsSnapshot(limit, "2026-05-02");

    expect(snapshot.today.status).toBe("empty");
    expect(snapshot.today.isComplete).toBe(false);
  });

  it("counts an explicit zero as a valid atMost result", () => {
    const limit = makeTestHabit({
      habitType: "numerical",
      targetType: "atMost",
      targetValue: 2,
      createdAt: new Date("2026-05-02T08:00:00").getTime(),
      entries: numericalEntries({ "2026-05-02": 0 }),
    });

    const snapshot = computeHabitStatsSnapshot(limit, "2026-05-02");

    expect(snapshot.today.status).toBe("done");
    expect(snapshot.today.isComplete).toBe(true);
    expect(snapshot.completedDates).toEqual(["2026-05-02"]);
  });

  it("keeps skip separate from completion while preserving the status story", () => {
    const habit = makeTestHabit({
      entries: {
        "2026-05-02": { value: ENTRY.SKIP },
      },
    });

    const snapshot = computeHabitStatsSnapshot(habit, "2026-05-02");

    expect(snapshot.today.status).toBe("skipped");
    expect(snapshot.today.isComplete).toBe(false);
    expect(snapshot.completedDates).not.toContain("2026-05-02");
  });

  it("derives streak, total, and best weekday from completed days", () => {
    const habit = makeTestHabit({
      createdAt: new Date("2026-04-27T08:00:00").getTime(),
      entries: datesToEntries(["2026-04-30", "2026-05-01", "2026-05-02"]),
    });

    const snapshot = computeHabitStatsSnapshot(habit, "2026-05-02");

    expect(snapshot.totalCompleted).toBe(3);
    expect(snapshot.currentStreak).toBe(3);
    expect(snapshot.bestStreak).toBe(3);
    expect(snapshot.bestWeekday?.count).toBe(1);
    expect(snapshot.lowData).toBe(false);
  });

  it("counts selected weekly due days as the expected pace instead of every day", () => {
    const habit = makeTestHabit({
      createdAt: new Date("2026-04-27T08:00:00").getTime(),
      frequency: { numerator: 3, denominator: 7 },
      schedule: {
        mode: "specificDays",
        period: "week",
        targetCount: 3,
        dueDays: [1, 3, 5],
      },
      entries: datesToEntries(["2026-04-27", "2026-04-29", "2026-05-01"]),
    });

    const snapshot = computeHabitStatsSnapshot(habit, "2026-05-02");
    const week = snapshot.periods[0];

    expect(week.expectedFull).toBe(3);
    expect(week.expectedToDate).toBe(3);
    expect(week.isOnPace).toBe(true);
  });
});
