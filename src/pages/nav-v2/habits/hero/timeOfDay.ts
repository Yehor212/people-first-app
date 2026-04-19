/**
 * timeOfDay — pure helpers for bucketing habits into time-of-day groups.
 *
 * Research basis (UX patterns, 2026):
 *   - Habitify groups habits by morning / afternoon / evening for cognitive
 *     anchoring. Users complete habits at higher rates when grouped by cue.
 *   - BJ Fogg (Tiny Habits, 2019): cue specificity (when/where) is the single
 *     strongest predictor of habit formation.
 *
 * Bucket boundaries are deliberately wide and inclusive:
 *   - morning   : 04:00 – 11:59
 *   - afternoon : 12:00 – 16:59
 *   - evening   : 17:00 – 23:59 + 00:00 – 03:59  (late-night reads as evening)
 *   - anytime   : no reminder configured at all
 */

import type { Habit } from "@/types";

export type TimeOfDay = "morning" | "afternoon" | "evening" | "anytime";

export const TIME_OF_DAY_ORDER: readonly TimeOfDay[] = [
  "morning",
  "afternoon",
  "evening",
  "anytime",
] as const;

/** Pure: hour (0-23) → bucket. Out-of-range falls back to anytime. */
export function bucketForHour(hour: number): TimeOfDay {
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return "anytime";
  if (hour >= 4 && hour <= 11) return "morning";
  if (hour >= 12 && hour <= 16) return "afternoon";
  return "evening"; // 17-23 + 0-3 (late-night)
}

/** Pure: parse "HH:mm" → hour 0-23 (returns NaN on bad input). */
export function parseHourFromReminderTime(time: string | undefined): number {
  if (!time || typeof time !== "string") return Number.NaN;
  const [hh] = time.split(":");
  const n = Number(hh);
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : Number.NaN;
}

/** Pure: derive bucket from a habit's earliest reminder. */
export function bucketForHabit(habit: Habit): TimeOfDay {
  const reminders = Array.isArray(habit.reminders) ? habit.reminders : [];
  const enabled = reminders.filter((r) => r && r.enabled !== false);
  if (enabled.length === 0) return "anytime";
  const hours = enabled.map((r) => parseHourFromReminderTime(r.time)).filter(Number.isFinite);
  if (hours.length === 0) return "anytime";
  return bucketForHour(Math.min(...hours));
}

export interface TimeOfDayGroup {
  bucket: TimeOfDay;
  habits: Habit[];
}

/** Pure: group habits by time-of-day bucket; preserves input order within each. */
export function groupHabitsByTimeOfDay(habits: readonly Habit[]): TimeOfDayGroup[] {
  const map = new Map<TimeOfDay, Habit[]>();
  for (const bucket of TIME_OF_DAY_ORDER) map.set(bucket, []);
  for (const habit of habits) {
    map.get(bucketForHabit(habit))?.push(habit);
  }
  return TIME_OF_DAY_ORDER
    .map((bucket) => ({ bucket, habits: map.get(bucket) ?? [] }))
    .filter((g) => g.habits.length > 0);
}
