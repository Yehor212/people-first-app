import { describe, expect, it } from 'vitest';
import {
  createHabitSchedule,
  getExpectedHabitOccurrencesBetween,
  getFrequencyFromSchedule,
  getSuggestedDueDays,
  isHabitDueOnDate,
  normalizeHabitSchedule,
} from '../habitScheduling';
import { makeTestHabit } from '@/test/habitFixtures';

describe('habitScheduling', () => {
  it('keeps daily habits as daily schedule with legacy frequency fallback', () => {
    const habit = makeTestHabit({ frequency: { numerator: 1, denominator: 1 } });

    expect(normalizeHabitSchedule(habit)).toEqual({
      mode: 'daily',
      period: 'week',
      targetCount: 1,
    });
    expect(isHabitDueOnDate(habit, '2026-05-04')).toBe(true);
  });

  it('derives flexible weekly target from old 3x/week frequency', () => {
    const habit = makeTestHabit({ frequency: { numerator: 3, denominator: 7 } });

    expect(normalizeHabitSchedule(habit)).toEqual({
      mode: 'flexiblePerPeriod',
      period: 'week',
      targetCount: 3,
    });
    expect(getExpectedHabitOccurrencesBetween(habit, '2026-05-04', '2026-05-10')).toBe(3);
  });

  it('supports selected due days without counting every day as due', () => {
    const schedule = createHabitSchedule(
      { numerator: 3, denominator: 7 },
      'specificDays',
      [1, 3, 5],
    );
    const habit = makeTestHabit({
      frequency: getFrequencyFromSchedule(schedule),
      schedule,
    });

    expect(isHabitDueOnDate(habit, '2026-05-04')).toBe(true); // Monday
    expect(isHabitDueOnDate(habit, '2026-05-05')).toBe(false); // Tuesday
    expect(getExpectedHabitOccurrencesBetween(habit, '2026-05-04', '2026-05-10')).toBe(3);
  });

  it('uses smart suggested days for weekly targets', () => {
    expect(getSuggestedDueDays(1)).toEqual([1]);
    expect(getSuggestedDueDays(2)).toEqual([2, 4]);
    expect(getSuggestedDueDays(3)).toEqual([1, 3, 5]);
  });
});
