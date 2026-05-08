import { computeEntriesWithAuto } from "@/lib/habitComputedEntries";
import {
  computeAllStreaks,
  computeHabitScore,
  getFrequencyByWeekday,
  type HabitStreak,
} from "@/lib/habitScore";
import {
  doesNumericalStoredValueMeetTarget,
  getHabitCompletedDates,
} from "@/lib/habits";
import { getExpectedHabitOccurrencesBetween } from "@/lib/habitScheduling";
import { ENTRY } from "@/types";
import type { Habit, HabitEntry } from "@/types";

const DAY_MS = 86_400_000;

export type HabitStatsTone =
  | "success"
  | "warning"
  | "danger"
  | "neutral"
  | "skipped";

export type HabitTodayStatus =
  | "done"
  | "partial"
  | "empty"
  | "missed"
  | "skipped"
  | "overLimit";

export interface HabitTodayInsight {
  date: string;
  status: HabitTodayStatus;
  tone: HabitStatsTone;
  storedValue?: number;
  realValue?: number;
  targetValue?: number;
  remaining?: number;
  hasEntry: boolean;
  isComplete: boolean;
}

export interface HabitPeriodProgress {
  key: "week" | "month" | "year";
  actual: number;
  expectedToDate: number;
  expectedFull: number;
  percentToDate: number;
  percentFull: number;
  isOnPace: boolean;
  daysElapsed: number;
  daysTotal: number;
  start: string;
  end: string;
}

export interface HabitStatsSnapshot {
  score: number;
  scorePercent: number;
  currentStreak: number;
  bestStreak: number;
  allStreaks: HabitStreak[];
  completedDates: string[];
  totalCompleted: number;
  thisMonthCompleted: number;
  daysInMonth: number;
  today: HabitTodayInsight;
  periods: HabitPeriodProgress[];
  bestWeekday: { index: number; count: number } | null;
  timedEntryCount: number;
  identityProof: {
    text: string;
    count: number;
    icon?: string;
    cluster?: string;
  };
  lowData: boolean;
}

function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateStr(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysInclusive(start: string, end: string): number {
  return Math.max(0, Math.floor((parseDateStr(end).getTime() - parseDateStr(start).getTime()) / DAY_MS) + 1);
}

function maxDateStr(...dates: string[]): string {
  return dates.reduce((max, date) => (date > max ? date : max));
}

function monthPrefix(date: string): string {
  return date.slice(0, 7);
}

function getHabitStartDate(habit: Habit): string {
  return habit.startDate || toDateStr(new Date(habit.createdAt));
}

function getPeriodBounds(key: HabitPeriodProgress["key"], today: string): { start: string; end: string; fullEnd: string } {
  const now = parseDateStr(today);

  if (key === "week") {
    const jsDay = now.getDay();
    const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay;
    const start = addDays(now, mondayOffset);
    return {
      start: toDateStr(start),
      end: today,
      fullEnd: toDateStr(addDays(start, 6)),
    };
  }

  if (key === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const fullEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: toDateStr(start), end: today, fullEnd: toDateStr(fullEnd) };
  }

  const start = new Date(now.getFullYear(), 0, 1);
  const fullEnd = new Date(now.getFullYear(), 11, 31);
  return { start: toDateStr(start), end: today, fullEnd: toDateStr(fullEnd) };
}

function realNumericalValue(entry?: HabitEntry): number | undefined {
  if (!entry) return undefined;
  if (entry.value === ENTRY.UNKNOWN || entry.value === ENTRY.SKIP) return undefined;
  return Math.max(0, entry.value / 1000);
}

function countBooleanCompletions(entries: Record<string, HabitEntry>, start: string, end: string): number {
  let count = 0;
  for (const [date, entry] of Object.entries(entries)) {
    if (date < start || date > end) continue;
    if (entry.value === ENTRY.YES_MANUAL || entry.value === ENTRY.YES_AUTO) count += 1;
  }
  return count;
}

function sumNumericalValues(habit: Habit, start: string, end: string): number {
  let sum = 0;
  for (const [date, entry] of Object.entries(habit.entries || {})) {
    if (date < start || date > end) continue;
    const value = realNumericalValue(entry);
    if (value !== undefined) sum += value;
  }
  return sum;
}

function expectedForRange(habit: Habit, start: string, end: string): number {
  const occurrences = getExpectedHabitOccurrencesBetween(habit, start, end);
  const target = habit.habitType === "numerical" ? Math.max(0, habit.targetValue || 0) : 1;
  return occurrences * target;
}

function completionPercent(habit: Habit, actual: number, expected: number): number {
  if (expected <= 0) {
    return actual > 0 || habit.targetType === "atMost" ? 100 : 0;
  }

  if (habit.habitType === "numerical" && habit.targetType === "atMost") {
    if (actual <= expected) return 100;
    return Math.max(0, Math.min(100, (1 - (actual - expected) / expected) * 100));
  }

  return Math.max(0, Math.min(100, (actual / expected) * 100));
}

function computePeriodProgress(
  habit: Habit,
  entriesWithAuto: Record<string, HabitEntry>,
  key: HabitPeriodProgress["key"],
  today: string,
): HabitPeriodProgress {
  const bounds = getPeriodBounds(key, today);
  const effectiveStart = maxDateStr(bounds.start, getHabitStartDate(habit));
  const effectiveEnd = today < effectiveStart ? effectiveStart : today;
  const effectiveFullEnd = bounds.fullEnd < effectiveStart ? effectiveStart : bounds.fullEnd;
  const daysElapsed = daysInclusive(effectiveStart, effectiveEnd);
  const daysTotal = daysInclusive(effectiveStart, effectiveFullEnd);
  const actual =
    habit.habitType === "boolean"
      ? countBooleanCompletions(entriesWithAuto, effectiveStart, effectiveEnd)
      : sumNumericalValues(habit, effectiveStart, effectiveEnd);
  const expectedToDate = expectedForRange(habit, effectiveStart, effectiveEnd);
  const expectedFull = expectedForRange(habit, effectiveStart, effectiveFullEnd);
  const percentToDate = completionPercent(habit, actual, expectedToDate);
  const percentFull = completionPercent(habit, actual, expectedFull);

  return {
    key,
    actual,
    expectedToDate,
    expectedFull,
    percentToDate,
    percentFull,
    isOnPace:
      habit.habitType === "numerical" && habit.targetType === "atMost"
        ? actual <= expectedToDate
        : actual >= expectedToDate && expectedToDate > 0,
    daysElapsed,
    daysTotal,
    start: effectiveStart,
    end: effectiveFullEnd,
  };
}

function getCurrentStreakFrom(allStreaks: HabitStreak[], today: string): number {
  if (allStreaks.length === 0) return 0;
  const yesterday = toDateStr(addDays(parseDateStr(today), -1));
  const recent = allStreaks.reduce((best, streak) => (streak.end > best.end ? streak : best), allStreaks[0]);
  return recent.end === today || recent.end === yesterday ? recent.length : 0;
}

function computeTodayInsight(habit: Habit, entriesWithAuto: Record<string, HabitEntry>, today: string): HabitTodayInsight {
  const actualEntry = habit.entries?.[today];
  const computedEntry = entriesWithAuto[today] || actualEntry;
  const storedValue = computedEntry?.value;

  if (storedValue === ENTRY.SKIP) {
    return { date: today, status: "skipped", tone: "skipped", storedValue, hasEntry: true, isComplete: false };
  }

  if (habit.habitType === "boolean") {
    const isComplete = storedValue === ENTRY.YES_MANUAL || storedValue === ENTRY.YES_AUTO;
    if (isComplete) {
      return { date: today, status: "done", tone: "success", storedValue, hasEntry: true, isComplete };
    }
    if (storedValue === ENTRY.NO) {
      return { date: today, status: "missed", tone: "danger", storedValue, hasEntry: true, isComplete: false };
    }
    return { date: today, status: "empty", tone: "neutral", storedValue, hasEntry: false, isComplete: false };
  }

  const realValue = realNumericalValue(actualEntry);
  const hasEntry = actualEntry != null && actualEntry.value !== ENTRY.UNKNOWN;
  if (!hasEntry || realValue === undefined) {
    return {
      date: today,
      status: "empty",
      tone: "neutral",
      storedValue,
      targetValue: habit.targetValue,
      hasEntry: false,
      isComplete: false,
    };
  }

  const isComplete = doesNumericalStoredValueMeetTarget(habit, actualEntry.value);
  if (habit.targetType === "atMost") {
    return {
      date: today,
      status: isComplete ? "done" : "overLimit",
      tone: isComplete ? "success" : "danger",
      storedValue: actualEntry.value,
      realValue,
      targetValue: habit.targetValue,
      remaining: Math.max(0, habit.targetValue - realValue),
      hasEntry,
      isComplete,
    };
  }

  if (isComplete) {
    return {
      date: today,
      status: "done",
      tone: "success",
      storedValue: actualEntry.value,
      realValue,
      targetValue: habit.targetValue,
      remaining: 0,
      hasEntry,
      isComplete,
    };
  }

  return {
    date: today,
    status: realValue > 0 ? "partial" : "missed",
    tone: realValue > 0 ? "warning" : "danger",
    storedValue: actualEntry.value,
    realValue,
    targetValue: habit.targetValue,
    remaining: Math.max(0, habit.targetValue - realValue),
    hasEntry,
    isComplete: false,
  };
}

function getBestWeekday(habit: Habit): HabitStatsSnapshot["bestWeekday"] {
  const counts = getFrequencyByWeekday(habit);
  const bestCount = Math.max(...counts);
  if (bestCount <= 0) return null;
  const index = counts.findIndex((count) => count === bestCount);
  return { index, count: bestCount };
}

export function computeHabitStatsSnapshot(habit: Habit, today = toDateStr(new Date())): HabitStatsSnapshot {
  const entriesWithAuto = computeEntriesWithAuto(habit);
  const allStreaks = computeAllStreaks(habit);
  const completedDates = getHabitCompletedDates(habit, entriesWithAuto);
  const now = parseDateStr(today);
  const month = monthPrefix(today);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const bestStreak = allStreaks.length > 0 ? Math.max(...allStreaks.map((streak) => streak.length)) : 0;
  const timedEntryCount = Object.values(habit.entries || {}).filter((entry) => Boolean(entry.loggedAt)).length;
  const score = computeHabitScore(habit, today);

  return {
    score,
    scorePercent: Math.round(score * 100),
    currentStreak: getCurrentStreakFrom(allStreaks, today),
    bestStreak,
    allStreaks,
    completedDates,
    totalCompleted: completedDates.length,
    thisMonthCompleted: completedDates.filter((date) => date.startsWith(month)).length,
    daysInMonth,
    today: computeTodayInsight(habit, entriesWithAuto, today),
    periods: [
      computePeriodProgress(habit, entriesWithAuto, "week", today),
      computePeriodProgress(habit, entriesWithAuto, "month", today),
      computePeriodProgress(habit, entriesWithAuto, "year", today),
    ],
    bestWeekday: getBestWeekday(habit),
    timedEntryCount,
    identityProof: {
      text: habit.identityVerb || habit.identityCluster || habit.name,
      count: completedDates.length,
      icon: habit.identityIcon,
      cluster: habit.identityCluster,
    },
    lowData: completedDates.length < 3,
  };
}
