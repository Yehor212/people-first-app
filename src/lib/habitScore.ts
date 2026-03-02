/**
 * habitScore.ts — Loop-exact scoring, streaks & analytics.
 *
 * Score formula from iSoron/uhabits Score.kt + ScoreList.kt:
 *   multiplier = 0.5 ^ (sqrt(freq) / 13)
 *   score[i] = score[i-1] * multiplier + checkValue * (1 - multiplier)
 *
 * Where freq = numerator / denominator (weekly frequency equivalent).
 * Uses rolling window of `denominator` days for percentage computation.
 *
 * Pure functions — no side effects, no React dependencies.
 */

import type { Habit, HabitEntry } from '@/types';
import { ENTRY } from '@/types';

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

// ─── Entry helpers ──────────────────────────────────────────────────────────

/** Get entry value for a date, defaulting to UNKNOWN */
function getEntryValue(entries: Record<string, HabitEntry>, dateStr: string): number {
  return entries[dateStr]?.value ?? ENTRY.UNKNOWN;
}

// ─── Score algorithm (Loop-exact from Score.kt) ─────────────────────────────

/**
 * Core EMA step from Loop's Score.compute().
 */
function computeScoreStep(
  frequency: number,        // numerator / denominator
  previousScore: number,    // 0.0..1.0
  checkmarkValue: number,   // 0.0..1.0 (percentage completed)
): number {
  const multiplier = Math.pow(0.5, Math.sqrt(frequency) / 13.0);
  return previousScore * multiplier + checkmarkValue * (1.0 - multiplier);
}

/**
 * Compute Loop-exact habit score (0–1) up to a given date.
 *
 * For each day from creation to upToDate:
 * - Boolean: rolling window count of YES_MANUAL entries → percentage
 * - Numerical AT_LEAST: rolling sum / target → percentage (capped at 1.0)
 * - Numerical AT_MOST: 1 - (sum - target) / target, clamped [0, 1]
 *
 * Non-daily boolean habits: numerator and denominator are DOUBLED
 * for smoother scoring (Loop's ScoreList.recompute logic).
 */
export function computeHabitScore(habit: Habit, upToDate?: string): number {
  const endStr = upToDate || getToday();
  const end = parseDate(endStr);
  const createdDate = new Date(habit.createdAt);

  if (end < createdDate) return 0;

  const totalDays = daysBetween(createdDate, end);
  if (totalDays < 0) return 0;

  const { numerator, denominator } = habit.frequency;
  const freq = numerator / denominator;
  const isDaily = numerator === denominator;

  // Initial score: 0.0 for boolean/atLeast, 1.0 for atMost
  let score = (habit.habitType === 'numerical' && habit.targetType === 'atMost') ? 1.0 : 0.0;

  // Build date array for window lookups
  const dates: string[] = [];
  for (let i = 0; i <= totalDays; i++) {
    dates.push(toDateStr(addDays(createdDate, i)));
  }

  for (let i = 0; i <= totalDays; i++) {
    if (habit.habitType === 'boolean') {
      // Window size: denominator (doubled for non-daily)
      const windowSize = isDaily ? denominator : denominator * 2;
      const targetCount = isDaily ? numerator : numerator * 2;

      // Count YES_MANUAL in window
      let yesCount = 0;
      let allSkip = true;

      for (let w = 0; w < windowSize && (i - w) >= 0; w++) {
        const wDate = dates[i - w];
        const val = getEntryValue(habit.entries, wDate);
        if (val === ENTRY.YES_MANUAL) {
          yesCount++;
          allSkip = false;
        } else if (val !== ENTRY.SKIP) {
          allSkip = false;
        }
      }

      // If all entries in window are SKIP, score unchanged
      if (allSkip && i > 0) continue;

      const percentageCompleted = Math.min(1.0, yesCount / targetCount);
      score = computeScoreStep(freq, score, percentageCompleted);

    } else {
      // Numerical habit
      const windowSize = denominator;

      // Rolling sum of values in window (value / 1000 to get real value)
      let rollingSum = 0;
      for (let w = 0; w < windowSize && (i - w) >= 0; w++) {
        const wDate = dates[i - w];
        const val = getEntryValue(habit.entries, wDate);
        if (val > 0) {
          rollingSum += val / 1000;
        }
      }

      let percentageCompleted: number;
      if (habit.targetType === 'atMost') {
        // AT_MOST: 100% when at or under target, linear decrease above
        if (habit.targetValue <= 0) {
          percentageCompleted = rollingSum === 0 ? 1.0 : 0.0;
        } else {
          percentageCompleted = Math.max(0, Math.min(1.0,
            1.0 - (rollingSum - habit.targetValue) / habit.targetValue
          ));
        }
      } else {
        // AT_LEAST: percentage of target achieved
        if (habit.targetValue <= 0) {
          percentageCompleted = rollingSum > 0 ? 1.0 : 0.0;
        } else {
          percentageCompleted = Math.min(1.0, rollingSum / habit.targetValue);
        }
      }

      score = computeScoreStep(freq, score, percentageCompleted);
    }
  }

  return score;
}

/**
 * Compute score at intervals for chart display.
 * Returns array of { date, score } for the last N weeks.
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

// ─── Streak computation (Loop-exact from StreakList.kt) ──────────────────────

export interface HabitStreak {
  start: string;
  end: string;
  length: number;
}

/**
 * Check if a habit is "completed" on a given date (for streak purposes).
 *
 * Loop rules:
 * - Boolean: value > 0 (YES_MANUAL, YES_AUTO, SKIP all extend streak)
 * - Numerical AT_LEAST: value/1000 >= targetValue
 * - Numerical AT_MOST: value !== UNKNOWN && value/1000 <= targetValue
 */
function isStreakDay(habit: Habit, dateStr: string): boolean {
  const val = getEntryValue(habit.entries, dateStr);

  if (habit.habitType === 'boolean') {
    return val > 0; // YES_MANUAL(2), YES_AUTO(1), SKIP(3) all count
  }

  // Numerical
  if (val === ENTRY.UNKNOWN) return false;

  const realValue = val / 1000;
  if (habit.targetType === 'atMost') {
    return realValue <= habit.targetValue;
  }
  return realValue >= habit.targetValue;
}

/**
 * Compute all historical streaks for a habit.
 * Returns streaks sorted by length (longest first), then by recency.
 */
export function computeAllStreaks(habit: Habit): HabitStreak[] {
  const createdDate = new Date(habit.createdAt);
  const today = new Date();
  const totalDays = daysBetween(createdDate, today);

  if (totalDays < 0) return [];

  const streaks: HabitStreak[] = [];
  let streakStart: string | null = null;
  let streakEnd: string | null = null;
  let streakLen = 0;

  for (let i = 0; i <= totalDays; i++) {
    const dateStr = toDateStr(addDays(createdDate, i));

    if (isStreakDay(habit, dateStr)) {
      if (!streakStart) streakStart = dateStr;
      streakEnd = dateStr;
      streakLen++;
    } else {
      // Grace period: don't break on today (might not be done yet)
      const isToday = dateStr === getToday();
      if (isToday) continue;

      // Finalize current streak
      if (streakStart && streakEnd && streakLen > 0) {
        streaks.push({ start: streakStart, end: streakEnd, length: streakLen });
      }
      streakStart = null;
      streakEnd = null;
      streakLen = 0;
    }
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

  const today = getToday();
  const yesterday = toDateStr(addDays(new Date(), -1));

  // Find the most recent streak
  const recentStreak = streaks.reduce((best, s) =>
    s.end > best.end ? s : best, streaks[0]
  );

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
  for (const [dateStr, entry] of Object.entries(habit.entries)) {
    if (
      entry.value === ENTRY.YES_MANUAL ||
      (habit.habitType === 'numerical' && entry.value > 0 && entry.value !== ENTRY.SKIP)
    ) {
      const dow = parseDate(dateStr).getDay();
      counts[dow]++;
    }
  }
  return counts;
}

// ─── Weekly frequency helper ────────────────────────────────────────────────

/**
 * Get expected completions per week for this habit.
 * Used as the display frequency and for analytics.
 */
export function getHabitWeeklyFrequency(habit: Habit): number {
  const { numerator, denominator } = habit.frequency;
  return (numerator / denominator) * 7;
}
