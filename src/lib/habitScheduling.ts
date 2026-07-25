import type { Habit, HabitFrequencyRatio, HabitSchedule, HabitScheduleMode } from '@/types';
import { parseLocalDate } from '@/lib/utils';

export const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0] as const;
export const ALL_WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

function isValidWeekday(day: number): boolean {
  return Number.isInteger(day) && day >= 0 && day <= 6;
}

export function normalizeDueDays(days?: number[]): number[] {
  const unique = new Set((days || []).filter(isValidWeekday));
  return WEEK_DAYS.filter((day) => unique.has(day));
}

/**
 * Habit reminders historically stored an empty or missing day list for a
 * daily reminder. Keep that durable contract explicit while rejecting a
 * non-empty list that contains no valid weekdays.
 */
export function normalizeHabitReminderDays(days?: number[]): number[] {
  if (!Array.isArray(days) || days.length === 0) return [...WEEK_DAYS];
  return normalizeDueDays(days);
}

function safeFrequency(frequency?: HabitFrequencyRatio): HabitFrequencyRatio {
  return {
    numerator: Math.max(1, Math.round(frequency?.numerator ?? 1)),
    denominator: Math.max(1, Math.round(frequency?.denominator ?? 1)),
  };
}

export function getWeeklyTargetCountFromFrequency(frequency?: HabitFrequencyRatio): number {
  const safe = safeFrequency(frequency);
  if (safe.numerator >= safe.denominator) return 7;
  return Math.max(1, Math.round((safe.numerator / safe.denominator) * 7));
}

export function isDailyFrequency(frequency?: HabitFrequencyRatio): boolean {
  const safe = safeFrequency(frequency);
  return safe.numerator >= safe.denominator;
}

export function getFrequencyFromSchedule(schedule: HabitSchedule): HabitFrequencyRatio {
  if (schedule.mode === 'daily') return { numerator: 1, denominator: 1 };
  return { numerator: Math.max(1, schedule.targetCount), denominator: 7 };
}

export function getSuggestedDueDays(targetCount: number): number[] {
  if (targetCount <= 1) return [1];
  if (targetCount === 2) return [2, 4];
  if (targetCount === 3) return [1, 3, 5];
  if (targetCount === 4) return [1, 2, 4, 6];
  if (targetCount === 5) return [1, 2, 3, 4, 5];
  return [...ALL_WEEK_DAYS];
}

export function createHabitSchedule(
  frequency: HabitFrequencyRatio,
  mode: HabitScheduleMode,
  dueDays?: number[],
): HabitSchedule {
  if (isDailyFrequency(frequency) || mode === 'daily') {
    return { mode: 'daily', period: 'week', targetCount: 1 };
  }

  const targetCount = getWeeklyTargetCountFromFrequency(frequency);
  if (mode === 'specificDays') {
    const normalizedDueDays = normalizeDueDays(dueDays);
    return {
      mode: 'specificDays',
      period: 'week',
      targetCount: Math.max(1, normalizedDueDays.length || targetCount),
      dueDays: normalizedDueDays.length > 0 ? normalizedDueDays : getSuggestedDueDays(targetCount),
    };
  }

  return {
    mode: 'flexiblePerPeriod',
    period: 'week',
    targetCount,
  };
}

export function normalizeHabitSchedule(habit: Pick<Habit, 'frequency' | 'schedule'>): HabitSchedule {
  if (habit.schedule) {
    return createHabitSchedule(
      getFrequencyFromSchedule(habit.schedule),
      habit.schedule.mode,
      habit.schedule.dueDays,
    );
  }

  return createHabitSchedule(
    habit.frequency || { numerator: 1, denominator: 1 },
    isDailyFrequency(habit.frequency) ? 'daily' : 'flexiblePerPeriod',
  );
}

function getDayOfWeek(dateStr: string): number | null {
  const date = parseLocalDate(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  return date.getDay();
}

export function isHabitDueOnDate(habit: Pick<Habit, 'frequency' | 'schedule'>, dateStr: string): boolean {
  const schedule = normalizeHabitSchedule(habit);
  if (schedule.mode === 'daily' || schedule.mode === 'flexiblePerPeriod') return true;

  const day = getDayOfWeek(dateStr);
  if (day === null) return false;
  return normalizeDueDays(schedule.dueDays).includes(day);
}

function daysInclusive(start: string, end: string): string[] {
  const startDate = parseLocalDate(start);
  const endDate = parseLocalDate(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
    return [];
  }

  const dates: string[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export function getExpectedHabitOccurrencesBetween(
  habit: Pick<Habit, 'frequency' | 'schedule'>,
  start: string,
  end: string,
): number {
  const schedule = normalizeHabitSchedule(habit);
  const dates = daysInclusive(start, end);
  if (dates.length === 0) return 0;

  if (schedule.mode === 'daily') return dates.length;
  if (schedule.mode === 'specificDays') {
    return dates.filter((date) => isHabitDueOnDate(habit, date)).length;
  }

  return (dates.length / 7) * schedule.targetCount;
}

export function getDefaultReminderDaysForSchedule(
  frequency: HabitFrequencyRatio,
  mode: HabitScheduleMode,
  dueDays?: number[],
): number[] {
  if (isDailyFrequency(frequency) || mode === 'daily') return [...ALL_WEEK_DAYS];
  if (mode === 'specificDays') {
    const normalized = normalizeDueDays(dueDays);
    return normalized.length > 0 ? normalized : getSuggestedDueDays(getWeeklyTargetCountFromFrequency(frequency));
  }
  return getSuggestedDueDays(getWeeklyTargetCountFromFrequency(frequency));
}
