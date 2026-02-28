/**
 * habitScore.ts — Loop Habit Tracker-style scoring & analytics.
 *
 * Score uses exponential smoothing:
 *   decay = 0.5 ^ (sqrt(weeklyFreq) / 13)
 *   score[i] = score[i-1] * decay + checkValue * (1 - decay)
 *
 * Pure functions — no side effects, no React dependencies.
 */

import type { Habit } from '@/types';

// ─── Date helpers ───────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86400000;
  return Math.round((b.getTime() - a.getTime()) / msPerDay);
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getToday(): string {
  return toDateStr(new Date());
}

// ─── Frequency helpers ──────────────────────────────────────────────────────

/**
 * Get expected completions per week for this habit.
 * Used as the `freq` parameter in the Loop score formula.
 */
export function getHabitWeeklyFrequency(habit: Habit): number {
  // Explicit fractional frequency (Loop-style)
  if (habit.frequencyNumerator && habit.frequencyDenominator) {
    return (habit.frequencyNumerator / habit.frequencyDenominator) * 7;
  }

  switch (habit.frequency) {
    case 'daily':
      return 7;
    case 'weekly':
      return 1;
    case 'custom':
      return habit.customDays?.length ?? 7;
    case 'once':
      return 1;
    default:
      return 7;
  }
}

/**
 * Check if a habit is due on a given date (respects customDays, frequency).
 */
export function isHabitDueOnDate(habit: Habit, dateStr: string): boolean {
  if (habit.frequency === 'daily') return true;
  if (habit.frequency === 'once') return true;

  if (habit.frequency === 'custom' && habit.customDays) {
    const dow = parseDate(dateStr).getDay();
    return habit.customDays.includes(dow);
  }

  if (habit.frequency === 'weekly') {
    // Weekly = once per week. Consider it due every day (user picks when).
    return true;
  }

  // Fractional frequency: due on any day (user tracks numerator per denominator window)
  if (habit.frequencyNumerator && habit.frequencyDenominator) {
    return true;
  }

  return true;
}

// ─── Score algorithm ────────────────────────────────────────────────────────

/**
 * Compute the Loop-style habit score (0–1) up to a given date.
 *
 * Walks day-by-day from habit creation to `upToDate`.
 * On each scheduled day:
 *   - completed → checkValue = 1
 *   - skipped   → skip iteration (score unchanged)
 *   - missed    → checkValue = 0
 */
export function computeHabitScore(habit: Habit, upToDate?: string): number {
  const endStr = upToDate || getToday();
  const end = parseDate(endStr);

  const createdDate = habit.startDate
    ? parseDate(habit.startDate)
    : new Date(habit.createdAt);

  if (end < createdDate) return 0;

  const totalDays = daysBetween(createdDate, end);
  if (totalDays < 0) return 0;

  const weeklyFreq = getHabitWeeklyFrequency(habit);
  const decay = Math.pow(0.5, Math.sqrt(weeklyFreq) / 13);

  const completedSet = new Set(habit.completedDates || []);
  const skippedSet = new Set(habit.skippedDates || []);

  let score = 0;
  const cursor = new Date(createdDate);

  for (let i = 0; i <= totalDays; i++) {
    const dateStr = toDateStr(cursor);

    if (skippedSet.has(dateStr)) {
      // Skip — score unchanged (neither penalize nor reward)
      cursor.setDate(cursor.getDate() + 1);
      continue;
    }

    if (isHabitDueOnDate(habit, dateStr)) {
      const checkValue = completedSet.has(dateStr) ? 1 : 0;
      score = score * decay + checkValue * (1 - decay);
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return score;
}

/**
 * Compute score at the end of each week for chart display.
 * Returns array of { date: string, score: number } for the last N weeks.
 */
export function computeScoreHistory(
  habit: Habit,
  weeks: number = 12,
): Array<{ date: string; score: number }> {
  const today = new Date();
  const points: Array<{ date: string; score: number }> = [];

  for (let w = weeks - 1; w >= 0; w--) {
    const weekEnd = addDays(today, -w * 7);
    const dateStr = toDateStr(weekEnd);
    points.push({ date: dateStr, score: computeHabitScore(habit, dateStr) });
  }

  return points;
}

// ─── Streak computation ─────────────────────────────────────────────────────

export interface HabitStreak {
  start: string;
  end: string;
  length: number;
}

/**
 * Compute all historical streaks for a habit.
 * Skipped dates do NOT break a streak but don't extend it either.
 * Returns streaks sorted by length (longest first), then by recency.
 */
export function computeAllStreaks(habit: Habit): HabitStreak[] {
  const completedSet = new Set(habit.completedDates || []);
  const skippedSet = new Set(habit.skippedDates || []);

  if (completedSet.size === 0) return [];

  const createdDate = habit.startDate
    ? parseDate(habit.startDate)
    : new Date(habit.createdAt);
  const today = new Date();
  const totalDays = daysBetween(createdDate, today);

  const streaks: HabitStreak[] = [];
  let streakStart: string | null = null;
  let streakEnd: string | null = null;
  let streakLen = 0;

  const cursor = new Date(createdDate);

  for (let i = 0; i <= totalDays; i++) {
    const dateStr = toDateStr(cursor);

    // Skip non-scheduled days
    if (!isHabitDueOnDate(habit, dateStr)) {
      cursor.setDate(cursor.getDate() + 1);
      continue;
    }

    // Skipped days are neutral — don't break, don't extend
    if (skippedSet.has(dateStr)) {
      cursor.setDate(cursor.getDate() + 1);
      continue;
    }

    if (completedSet.has(dateStr)) {
      if (!streakStart) streakStart = dateStr;
      streakEnd = dateStr;
      streakLen++;
    } else {
      // Today might not be done yet — grace period
      const isToday = dateStr === toDateStr(today);
      if (isToday) {
        cursor.setDate(cursor.getDate() + 1);
        continue;
      }

      // Missed — finalize current streak
      if (streakStart && streakEnd && streakLen > 0) {
        streaks.push({ start: streakStart, end: streakEnd, length: streakLen });
      }
      streakStart = null;
      streakEnd = null;
      streakLen = 0;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  // Finalize last streak
  if (streakStart && streakEnd && streakLen > 0) {
    streaks.push({ start: streakStart, end: streakEnd, length: streakLen });
  }

  // Sort: longest first, then most recent
  streaks.sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    return b.end.localeCompare(a.end);
  });

  return streaks;
}

/**
 * Get the current active streak length (0 if no current streak).
 */
export function getCurrentStreak(habit: Habit): number {
  const streaks = computeAllStreaks(habit);
  if (streaks.length === 0) return 0;

  // The most recent streak is active if its end is today or yesterday
  const today = getToday();
  const yesterday = toDateStr(addDays(new Date(), -1));

  // Find the streak that ends closest to today
  const recentStreak = streaks.reduce((best, s) =>
    s.end > best.end ? s : best
  , streaks[0]);

  if (recentStreak.end === today || recentStreak.end === yesterday) {
    return recentStreak.length;
  }

  return 0;
}

// ─── Frequency by weekday ───────────────────────────────────────────────────

/**
 * Returns completion counts by day of week [Sun=0, Mon=1, ..., Sat=6].
 */
export function getFrequencyByWeekday(habit: Habit): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const dateStr of habit.completedDates || []) {
    const dow = parseDate(dateStr).getDay();
    counts[dow]++;
  }
  return counts;
}
