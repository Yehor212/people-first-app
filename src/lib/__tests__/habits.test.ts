import { describe, it, expect } from 'vitest';
import {
  normalizeHabit,
  getHabitCompletedDates,
  isHabitCompletedOnDate,
  getHabitCompletionTotal,
} from '../habits';
import type { Habit } from '@/types';
import { makeTestHabit, datesToEntries, numericalEntries } from '@/test/habitFixtures';

// ============================================
// normalizeHabit
// ============================================
describe('normalizeHabit', () => {
  it('returns habit with default habitType "boolean" when habitType is undefined', () => {
    const habit = makeTestHabit({ habitType: undefined } as Partial<Habit>);
    const result = normalizeHabit(habit);
    expect(result.habitType).toBe('boolean');
  });

  it('returns habit with default frequency when frequency is undefined', () => {
    const habit = makeTestHabit({ frequency: undefined } as Partial<Habit>);
    const result = normalizeHabit(habit);
    expect(result.frequency).toEqual({ numerator: 1, denominator: 1 });
  });

  it('returns habit with empty entries when undefined', () => {
    const habit = makeTestHabit({ entries: undefined } as Partial<Habit>);
    const result = normalizeHabit(habit);
    expect(result.entries).toEqual({});
  });

  it('returns habit with empty reminders when undefined', () => {
    const habit = makeTestHabit({ reminders: undefined } as Partial<Habit>);
    const result = normalizeHabit(habit);
    expect(result.reminders).toEqual([]);
  });

  it('preserves existing values when they are already set', () => {
    const habit = makeTestHabit({
      habitType: 'numerical',
      frequency: { numerator: 1, denominator: 7 },
      entries: numericalEntries({ '2026-01-01': 3 }),
      reminders: [{ enabled: true, time: '09:00', days: [1, 2, 3] }],
    });
    const result = normalizeHabit(habit);
    expect(result.habitType).toBe('numerical');
    expect(result.frequency).toEqual({ numerator: 1, denominator: 7 });
    expect(result.entries['2026-01-01'].value).toBe(3000);
    expect(result.reminders).toHaveLength(1);
  });
});

// ============================================
// getHabitCompletedDates
// ============================================
describe('getHabitCompletedDates', () => {
  it('returns completed dates for a boolean habit', () => {
    const habit = makeTestHabit({
      habitType: 'boolean',
      entries: datesToEntries(['2026-01-01', '2026-01-02']),
    });
    expect(getHabitCompletedDates(habit)).toEqual(['2026-01-01', '2026-01-02']);
  });

  it('returns dates meeting target for numerical habit (atMost)', () => {
    const habit = makeTestHabit({
      habitType: 'numerical',
      targetValue: 2,
      targetType: 'atMost',
      entries: numericalEntries({
        '2026-01-01': 0,
        '2026-01-02': 3,
        '2026-01-03': 1,
      }),
    });
    const result = getHabitCompletedDates(habit);
    // 0 → value=0 which is ENTRY.NO, not meeting target
    // 3 → 3 > 2, not meeting atMost target
    // 1 → 1 <= 2, meets atMost target
    expect(result).toContain('2026-01-03');
    expect(result).not.toContain('2026-01-02');
  });

  it('returns empty array for boolean habit with no entries', () => {
    const habit = makeTestHabit({ habitType: 'boolean', entries: {} });
    expect(getHabitCompletedDates(habit)).toEqual([]);
  });
});

// ============================================
// isHabitCompletedOnDate
// ============================================
describe('isHabitCompletedOnDate', () => {
  it('returns true when entry is YES_MANUAL for boolean habit', () => {
    const habit = makeTestHabit({
      habitType: 'boolean',
      entries: datesToEntries(['2026-01-15']),
    });
    expect(isHabitCompletedOnDate(habit, '2026-01-15')).toBe(true);
  });

  it('returns false when date has no entry for boolean habit', () => {
    const habit = makeTestHabit({
      habitType: 'boolean',
      entries: datesToEntries(['2026-01-15']),
    });
    expect(isHabitCompletedOnDate(habit, '2026-01-16')).toBe(false);
  });

  it('returns true for numerical habit when value meets atLeast target', () => {
    const habit = makeTestHabit({
      habitType: 'numerical',
      targetValue: 5,
      targetType: 'atLeast',
      entries: numericalEntries({ '2026-02-10': 5 }),
    });
    expect(isHabitCompletedOnDate(habit, '2026-02-10')).toBe(true);
  });

  it('returns false for numerical habit when value is below atLeast target', () => {
    const habit = makeTestHabit({
      habitType: 'numerical',
      targetValue: 5,
      targetType: 'atLeast',
      entries: numericalEntries({ '2026-02-10': 3 }),
    });
    expect(isHabitCompletedOnDate(habit, '2026-02-10')).toBe(false);
  });

  it('returns false when date has no entry for numerical habit', () => {
    const habit = makeTestHabit({
      habitType: 'numerical',
      targetValue: 5,
      entries: {},
    });
    expect(isHabitCompletedOnDate(habit, '2026-02-10')).toBe(false);
  });
});

// ============================================
// getHabitCompletionTotal
// ============================================
describe('getHabitCompletionTotal', () => {
  it('returns count of completed dates for boolean habit', () => {
    const habit = makeTestHabit({
      habitType: 'boolean',
      entries: datesToEntries(['2026-01-01', '2026-01-02', '2026-01-03']),
    });
    expect(getHabitCompletionTotal(habit)).toBe(3);
  });

  it('returns count of target-meeting dates for numerical habit', () => {
    const habit = makeTestHabit({
      habitType: 'numerical',
      targetValue: 2,
      targetType: 'atLeast',
      entries: numericalEntries({
        '2026-01-01': 2,
        '2026-01-02': 1,
        '2026-01-03': 3,
        '2026-01-04': 5,
      }),
    });
    // 2 >= 2, 1 < 2, 3 >= 2, 5 >= 2 → 3 completed
    expect(getHabitCompletionTotal(habit)).toBe(3);
  });

  it('returns 0 for a habit with no entries', () => {
    const habit = makeTestHabit({ entries: {} });
    expect(getHabitCompletionTotal(habit)).toBe(0);
  });
});
