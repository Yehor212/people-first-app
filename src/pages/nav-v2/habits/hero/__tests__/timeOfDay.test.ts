/**
 * timeOfDay — pure-helper coverage.
 */
import { describe, it, expect } from "vitest";
import {
  bucketForHour,
  bucketForHabit,
  groupHabitsByTimeOfDay,
  parseHourFromReminderTime,
} from "../timeOfDay";
import type { Habit } from "@/types";

const habit = (overrides: Partial<Habit>): Habit => ({
  id: "h",
  name: "Habit",
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
  ...overrides,
});

describe("bucketForHour", () => {
  it("morning covers 04:00-11:59", () => {
    expect(bucketForHour(4)).toBe("morning");
    expect(bucketForHour(11)).toBe("morning");
  });
  it("afternoon covers 12:00-16:59", () => {
    expect(bucketForHour(12)).toBe("afternoon");
    expect(bucketForHour(16)).toBe("afternoon");
  });
  it("evening covers 17:00-23:59 + 00:00-03:59", () => {
    expect(bucketForHour(17)).toBe("evening");
    expect(bucketForHour(23)).toBe("evening");
    expect(bucketForHour(0)).toBe("evening");
    expect(bucketForHour(3)).toBe("evening");
  });
  it("falls back to anytime for invalid input", () => {
    expect(bucketForHour(-1)).toBe("anytime");
    expect(bucketForHour(24)).toBe("anytime");
    expect(bucketForHour(NaN)).toBe("anytime");
  });
});

describe("parseHourFromReminderTime", () => {
  it("parses HH:mm correctly", () => {
    expect(parseHourFromReminderTime("07:30")).toBe(7);
    expect(parseHourFromReminderTime("23:00")).toBe(23);
  });
  it("returns NaN for malformed input", () => {
    expect(Number.isNaN(parseHourFromReminderTime(""))).toBe(true);
    expect(Number.isNaN(parseHourFromReminderTime(undefined))).toBe(true);
    expect(Number.isNaN(parseHourFromReminderTime("not-a-time"))).toBe(true);
  });
});

describe("bucketForHabit", () => {
  it("uses earliest enabled reminder", () => {
    const h = habit({
      reminders: [
        { enabled: true, time: "20:00", days: [1] },
        { enabled: true, time: "07:00", days: [1] },
      ],
    });
    expect(bucketForHabit(h)).toBe("morning");
  });
  it("falls back to anytime when no reminders", () => {
    expect(bucketForHabit(habit({ reminders: [] }))).toBe("anytime");
  });
  it("ignores disabled reminders", () => {
    const h = habit({
      reminders: [
        { enabled: false, time: "06:00", days: [1] },
        { enabled: true, time: "21:00", days: [1] },
      ],
    });
    expect(bucketForHabit(h)).toBe("evening");
  });
});

describe("groupHabitsByTimeOfDay", () => {
  it("groups habits and preserves insertion order within a bucket", () => {
    const a = habit({ id: "a", reminders: [{ enabled: true, time: "07:00", days: [1] }] });
    const b = habit({ id: "b", reminders: [{ enabled: true, time: "08:00", days: [1] }] });
    const c = habit({ id: "c", reminders: [] });
    const groups = groupHabitsByTimeOfDay([a, b, c]);
    expect(groups.map((g) => g.bucket)).toEqual(["morning", "anytime"]);
    expect(groups[0].habits.map((h) => h.id)).toEqual(["a", "b"]);
    expect(groups[1].habits.map((h) => h.id)).toEqual(["c"]);
  });
  it("returns no group for empty input", () => {
    expect(groupHabitsByTimeOfDay([])).toEqual([]);
  });
  it("orders buckets morning → afternoon → evening → anytime", () => {
    const m = habit({ id: "m", reminders: [{ enabled: true, time: "07:00", days: [1] }] });
    const a = habit({ id: "a", reminders: [{ enabled: true, time: "13:00", days: [1] }] });
    const e = habit({ id: "e", reminders: [{ enabled: true, time: "20:00", days: [1] }] });
    const n = habit({ id: "n", reminders: [] });
    const groups = groupHabitsByTimeOfDay([n, e, a, m]);
    expect(groups.map((g) => g.bucket)).toEqual(["morning", "afternoon", "evening", "anytime"]);
  });
});
