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
import { computeEntriesWithAuto } from '@/lib/habitComputedEntries';
import { doesNumericalStoredValueMeetTarget } from '@/lib/habits';

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

function getInitialScore(habit: Habit): number {
  return habit.habitType === 'numerical' && habit.targetType === 'atMost' ? 1.0 : 0.0;
}

function getSafeFrequency(habit: Habit): { numerator: number; denominator: number } {
  const rawNumerator = Number(habit.frequency?.numerator);
  const rawDenominator = Number(habit.frequency?.denominator);
  const denominator = Number.isFinite(rawDenominator)
    ? Math.max(1, Math.floor(rawDenominator))
    : 1;
  const numerator = Number.isFinite(rawNumerator)
    ? Math.max(1, Math.floor(rawNumerator))
    : 1;

  return {
    numerator: Math.min(numerator, denominator),
    denominator,
  };
}

function isYesValue(value: number): boolean {
  return value === ENTRY.YES_MANUAL || value === ENTRY.YES_AUTO;
}

function numericContribution(value: number): number {
  return value > 0 && value !== ENTRY.SKIP ? value / 1000 : 0;
}

function getRelevantEntryDates(
  entries: Record<string, HabitEntry> | undefined,
  createdStr: string,
  endStr: string,
): string[] {
  return Object.keys(entries ?? {})
    .filter((date) => date >= createdStr && date <= endStr)
    .sort((a, b) => a.localeCompare(b));
}

function getScoreStartIndex(
  createdDate: Date,
  firstEntryDate: string,
  totalDays: number,
  windowSize: number,
): number {
  const firstEntryIndex = daysBetween(createdDate, parseDate(firstEntryDate));
  if (!Number.isFinite(firstEntryIndex)) return 0;
  return Math.max(0, Math.min(totalDays, firstEntryIndex - windowSize + 1));
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
  // Normalize createdAt timestamp to midnight — createdAt has time-of-day
  // but end is always midnight, so without normalization end < createdDate
  // for habits created today after midnight → score = 0
  const rawCreated = new Date(habit.createdAt);
  const createdDate = new Date(rawCreated.getFullYear(), rawCreated.getMonth(), rawCreated.getDate());

  if (end < createdDate) return 0;

  const totalDays = daysBetween(createdDate, end);
  if (!Number.isFinite(totalDays) || totalDays < 0) return getInitialScore(habit);

  const { numerator, denominator: safeDenominator } = getSafeFrequency(habit);
  const freq = numerator / safeDenominator;
  const isDaily = numerator === safeDenominator;

  let score = getInitialScore(habit);
  const createdStr = toDateStr(createdDate);
  const rawEntryDates = getRelevantEntryDates(habit.entries, createdStr, endStr);

  if (habit.habitType === 'boolean') {
    const windowSize = isDaily ? safeDenominator : safeDenominator * 2;
    if (rawEntryDates.length === 0) return score;

    const startIndex = getScoreStartIndex(createdDate, rawEntryDates[0], totalDays, windowSize);
    const dates: string[] = [];
    for (let i = startIndex; i <= totalDays; i++) {
      dates.push(toDateStr(addDays(createdDate, i)));
    }
    const dateAt = (index: number) => dates[index - startIndex];

    // Use computed entries (YES_AUTO fills for non-daily boolean habits)
    const entries = computeEntriesWithAuto(habit);
    const targetCount = Math.max(1, isDaily ? numerator : numerator * 2);
    let yesCount = 0;
    let skipCount = 0;

    for (let i = startIndex; i <= totalDays; i++) {
      const added = getEntryValue(entries, dateAt(i));
      if (isYesValue(added)) yesCount++;
      if (added === ENTRY.SKIP) skipCount++;

      const staleIndex = i - windowSize;
      if (staleIndex >= startIndex) {
        const removed = getEntryValue(entries, dateAt(staleIndex));
        if (isYesValue(removed)) yesCount--;
        if (removed === ENTRY.SKIP) skipCount--;
      }

      const availableInWindow = Math.min(windowSize, i + 1);
      const effectiveTarget = Math.min(targetCount, availableInWindow);
      const allSkip = skipCount === availableInWindow;

      if (allSkip && i > 0) continue;

      const percentageCompleted = Math.min(1.0, yesCount / effectiveTarget);
      score = computeScoreStep(freq, score, percentageCompleted);
    }

    return score;
  }

  const windowSize = safeDenominator;
  if (rawEntryDates.length === 0) return score;

  const startIndex = getScoreStartIndex(createdDate, rawEntryDates[0], totalDays, windowSize);
  const dates: string[] = [];
  for (let i = startIndex; i <= totalDays; i++) {
    dates.push(toDateStr(addDays(createdDate, i)));
  }
  const dateAt = (index: number) => dates[index - startIndex];

  // Use computed entries (YES_AUTO fills for non-daily boolean habits)
  const entries = computeEntriesWithAuto(habit);
  let rollingSum = 0;

  for (let i = startIndex; i <= totalDays; i++) {
    rollingSum += numericContribution(getEntryValue(entries, dateAt(i)));

    const staleIndex = i - windowSize;
    if (staleIndex >= startIndex) {
      rollingSum -= numericContribution(getEntryValue(entries, dateAt(staleIndex)));
    }

    let percentageCompleted: number;
    if (habit.targetType === 'atMost') {
      if (habit.targetValue <= 0) {
        percentageCompleted = rollingSum === 0 ? 1.0 : 0.0;
      } else {
        percentageCompleted = Math.max(0, Math.min(1.0,
          1.0 - (rollingSum - habit.targetValue) / habit.targetValue
        ));
      }
    } else {
      if (habit.targetValue <= 0) {
        percentageCompleted = rollingSum > 0 ? 1.0 : 0.0;
      } else {
        percentageCompleted = Math.min(1.0, rollingSum / habit.targetValue);
      }
    }

    score = computeScoreStep(freq, score, percentageCompleted);
  }

  return score;
}

/**
 * Compute score at weekly intervals for chart display — single-pass incremental.
 *
 * Instead of calling computeHabitScore() K times (O(N²×K) for large histories),
 * runs a single EMA pass from creation to today and samples at each target week.
 * Complexity: O(N × windowSize) — same as one computeHabitScore call.
 */
export function computeScoreHistory(
  habit: Habit,
  weeks: number = 12,
): Array<{ date: string; score: number }> {
  const today = new Date();

  // Build target sample dates
  const sampleDates = new Map<string, number>();
  const resultDates: string[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const dateStr = toDateStr(addDays(today, -w * 7));
    sampleDates.set(dateStr, resultDates.length);
    resultDates.push(dateStr);
  }

  const rawCreated = new Date(habit.createdAt);
  const createdDate = new Date(rawCreated.getFullYear(), rawCreated.getMonth(), rawCreated.getDate());
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (todayMidnight < createdDate) {
    return resultDates.map(date => ({ date, score: 0 }));
  }

  const totalDays = daysBetween(createdDate, todayMidnight);
  if (!Number.isFinite(totalDays) || totalDays < 0) {
    return resultDates.map(date => ({ date, score: 0 }));
  }

  const { numerator, denominator: safeDenominator } = getSafeFrequency(habit);
  const freq = numerator / safeDenominator;
  const isDaily = numerator === safeDenominator;

  let score = getInitialScore(habit);
  const scores = new Array<number>(resultDates.length).fill(0);
  const createdStr = toDateStr(createdDate);
  const todayStr = toDateStr(todayMidnight);
  const rawEntryDates = getRelevantEntryDates(habit.entries, createdStr, todayStr);

  if (habit.habitType === 'boolean') {
    const windowSize = isDaily ? safeDenominator : safeDenominator * 2;
    if (rawEntryDates.length === 0) {
      return resultDates.map((date) => ({
        date,
        score: date >= createdStr ? score : 0,
      }));
    }

    const startIndex = getScoreStartIndex(createdDate, rawEntryDates[0], totalDays, windowSize);
    const startDate = toDateStr(addDays(createdDate, startIndex));
    for (const date of resultDates) {
      const sampleIdx = sampleDates.get(date);
      if (sampleIdx !== undefined && date >= createdStr && date < startDate) {
        scores[sampleIdx] = score;
      }
    }

    const dates: string[] = [];
    for (let i = startIndex; i <= totalDays; i++) {
      dates.push(toDateStr(addDays(createdDate, i)));
    }
    const dateAt = (index: number) => dates[index - startIndex];

    // Use computed entries (YES_AUTO fills for non-daily boolean habits)
    const entries = computeEntriesWithAuto(habit);
    const targetCount = Math.max(1, isDaily ? numerator : numerator * 2);
    let yesCount = 0;
    let skipCount = 0;

    for (let i = startIndex; i <= totalDays; i++) {
      const added = getEntryValue(entries, dateAt(i));
      if (isYesValue(added)) yesCount++;
      if (added === ENTRY.SKIP) skipCount++;

      const staleIndex = i - windowSize;
      if (staleIndex >= startIndex) {
        const removed = getEntryValue(entries, dateAt(staleIndex));
        if (isYesValue(removed)) yesCount--;
        if (removed === ENTRY.SKIP) skipCount--;
      }

      const availableInWindow = Math.min(windowSize, i + 1);
      const effectiveTarget = Math.min(targetCount, availableInWindow);
      const allSkip = skipCount === availableInWindow;

      if (!(allSkip && i > 0)) {
        score = computeScoreStep(freq, score, Math.min(1.0, yesCount / effectiveTarget));
      }

      const sampleIdx = sampleDates.get(dateAt(i));
      if (sampleIdx !== undefined) {
        scores[sampleIdx] = score;
      }
    }

    return resultDates.map((date, idx) => ({ date, score: scores[idx] }));
  }

  const windowSize = safeDenominator;
  if (rawEntryDates.length === 0) {
    return resultDates.map((date) => ({
      date,
      score: date >= createdStr ? score : 0,
    }));
  }

  const startIndex = getScoreStartIndex(createdDate, rawEntryDates[0], totalDays, windowSize);
  const startDate = toDateStr(addDays(createdDate, startIndex));
  for (const date of resultDates) {
    const sampleIdx = sampleDates.get(date);
    if (sampleIdx !== undefined && date >= createdStr && date < startDate) {
      scores[sampleIdx] = score;
    }
  }

  const dates: string[] = [];
  for (let i = startIndex; i <= totalDays; i++) {
    dates.push(toDateStr(addDays(createdDate, i)));
  }
  const dateAt = (index: number) => dates[index - startIndex];

  // Use computed entries (YES_AUTO fills for non-daily boolean habits)
  const entries = computeEntriesWithAuto(habit);
  let rollingSum = 0;

  for (let i = startIndex; i <= totalDays; i++) {
    rollingSum += numericContribution(getEntryValue(entries, dateAt(i)));

    const staleIndex = i - windowSize;
    if (staleIndex >= startIndex) {
      rollingSum -= numericContribution(getEntryValue(entries, dateAt(staleIndex)));
    }

    let pct: number;
    if (habit.targetType === 'atMost') {
      pct = habit.targetValue <= 0
        ? (rollingSum === 0 ? 1.0 : 0.0)
        : Math.max(0, Math.min(1.0, 1.0 - (rollingSum - habit.targetValue) / habit.targetValue));
    } else {
      pct = habit.targetValue <= 0
        ? (rollingSum > 0 ? 1.0 : 0.0)
        : Math.min(1.0, rollingSum / habit.targetValue);
    }

    score = computeScoreStep(freq, score, pct);

    const sampleIdx = sampleDates.get(dateAt(i));
    if (sampleIdx !== undefined) {
      scores[sampleIdx] = score;
    }
  }

  return resultDates.map((date, idx) => ({ date, score: scores[idx] }));
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
function isStreakDay(habit: Habit, dateStr: string, entries: Record<string, HabitEntry>): boolean {
  const val = getEntryValue(entries, dateStr);

  if (habit.habitType === 'boolean') {
    return val > 0; // YES_MANUAL(2), YES_AUTO(1), SKIP(3) all count
  }

  // Numerical
  if (val === ENTRY.UNKNOWN) return false;
  if (val === ENTRY.SKIP) return true; // SKIP always extends streak

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
  const rawCreated = new Date(habit.createdAt);
  const createdDate = new Date(rawCreated.getFullYear(), rawCreated.getMonth(), rawCreated.getDate());
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const totalDays = daysBetween(createdDate, today);

  if (totalDays < 0) return [];

  // For non-daily boolean habits, use computed entries (YES_AUTO fills rest days)
  // so that streaks don't break on legitimate gap days (e.g., Tue/Thu for 3x/week)
  const entries = computeEntriesWithAuto(habit);

  const streaks: HabitStreak[] = [];
  let streakStart: string | null = null;
  let streakEnd: string | null = null;
  let streakLen = 0;

  for (let i = 0; i <= totalDays; i++) {
    const dateStr = toDateStr(addDays(createdDate, i));

    if (isStreakDay(habit, dateStr, entries)) {
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
    const isCompleted =
      habit.habitType === 'boolean'
        ? entry.value === ENTRY.YES_MANUAL
        : doesNumericalStoredValueMeetTarget(habit, entry.value);
    if (isCompleted) {
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
  return (numerator / Math.max(1, denominator)) * 7;
}
