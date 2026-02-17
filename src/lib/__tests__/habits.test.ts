import { describe, it, expect } from 'vitest';
import {
  normalizeHabit,
  getHabitCompletedDates,
  isHabitCompletedOnDate,
  getHabitCompletionTotal,
} from '../habits';
import { Habit } from '@/types';

// ============================================
// Helper: create a minimal Habit for testing
// ============================================
function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-1',
    name: 'Test Habit',
    icon: '🧪',
    color: '#FF0000',
    completedDates: [],
    createdAt: Date.now(),
    type: 'daily',
    frequency: 'daily',
    reminders: [],
    ...overrides,
  } as Habit;
}

// ============================================
// normalizeHabit
// ============================================
describe('normalizeHabit', () => {
  it('returns habit with default type "daily" when type is undefined', () => {
    const habit = makeHabit({ type: undefined } as Partial<Habit>);
    const result = normalizeHabit(habit);
    expect(result.type).toBe('daily');
  });

  it('returns habit with default frequency "daily" when frequency is undefined', () => {
    const habit = makeHabit({ frequency: undefined } as Partial<Habit>);
    const result = normalizeHabit(habit);
    expect(result.frequency).toBe('daily');
  });

  it('returns habit with empty progressByDate when undefined', () => {
    const habit = makeHabit({ progressByDate: undefined });
    const result = normalizeHabit(habit);
    expect(result.progressByDate).toEqual({});
  });

  it('returns habit with empty completedDates when undefined', () => {
    const habit = makeHabit({ completedDates: undefined } as Partial<Habit>);
    const result = normalizeHabit(habit);
    expect(result.completedDates).toEqual([]);
  });

  it('returns habit with empty reminders when undefined', () => {
    const habit = makeHabit({ reminders: undefined } as Partial<Habit>);
    const result = normalizeHabit(habit);
    expect(result.reminders).toEqual([]);
  });

  it('preserves existing values when they are already set', () => {
    const habit = makeHabit({
      type: 'continuous',
      frequency: 'weekly',
      progressByDate: { '2026-01-01': 3 },
      completedDates: ['2026-01-01'],
      reminders: [{ enabled: true, time: '09:00', days: [1, 2, 3] }],
    });
    const result = normalizeHabit(habit);
    expect(result.type).toBe('continuous');
    expect(result.frequency).toBe('weekly');
    expect(result.progressByDate).toEqual({ '2026-01-01': 3 });
    expect(result.completedDates).toEqual(['2026-01-01']);
    expect(result.reminders).toHaveLength(1);
  });
});

// ============================================
// getHabitCompletedDates
// ============================================
describe('getHabitCompletedDates', () => {
  it('returns completedDates for a daily habit', () => {
    const habit = makeHabit({
      type: 'daily',
      completedDates: ['2026-01-01', '2026-01-02'],
    });
    expect(getHabitCompletedDates(habit)).toEqual(['2026-01-01', '2026-01-02']);
  });

  it('returns dates with progress === 0 for reduce habits', () => {
    const habit = makeHabit({
      type: 'reduce',
      progressByDate: {
        '2026-01-01': 0,
        '2026-01-02': 3,
        '2026-01-03': 0,
      },
    });
    const result = getHabitCompletedDates(habit);
    expect(result).toContain('2026-01-01');
    expect(result).toContain('2026-01-03');
    expect(result).not.toContain('2026-01-02');
  });

  it('returns empty array for reduce habit with no zero-progress dates', () => {
    const habit = makeHabit({
      type: 'reduce',
      progressByDate: { '2026-01-01': 5, '2026-01-02': 2 },
    });
    expect(getHabitCompletedDates(habit)).toEqual([]);
  });

  it('returns empty array for daily habit with no completed dates', () => {
    const habit = makeHabit({ type: 'daily', completedDates: [] });
    expect(getHabitCompletedDates(habit)).toEqual([]);
  });
});

// ============================================
// isHabitCompletedOnDate
// ============================================
describe('isHabitCompletedOnDate', () => {
  it('returns true when date is in completedDates for daily habit', () => {
    const habit = makeHabit({
      type: 'daily',
      completedDates: ['2026-01-15'],
    });
    expect(isHabitCompletedOnDate(habit, '2026-01-15')).toBe(true);
  });

  it('returns false when date is NOT in completedDates for daily habit', () => {
    const habit = makeHabit({
      type: 'daily',
      completedDates: ['2026-01-15'],
    });
    expect(isHabitCompletedOnDate(habit, '2026-01-16')).toBe(false);
  });

  it('returns true when progressByDate[date] === 0 for reduce habit', () => {
    const habit = makeHabit({
      type: 'reduce',
      progressByDate: { '2026-02-10': 0 },
    });
    expect(isHabitCompletedOnDate(habit, '2026-02-10')).toBe(true);
  });

  it('returns false when progressByDate[date] > 0 for reduce habit', () => {
    const habit = makeHabit({
      type: 'reduce',
      progressByDate: { '2026-02-10': 5 },
    });
    expect(isHabitCompletedOnDate(habit, '2026-02-10')).toBe(false);
  });

  it('returns false when date has no entry in progressByDate for reduce habit', () => {
    const habit = makeHabit({
      type: 'reduce',
      progressByDate: {},
    });
    expect(isHabitCompletedOnDate(habit, '2026-02-10')).toBe(false);
  });
});

// ============================================
// getHabitCompletionTotal
// ============================================
describe('getHabitCompletionTotal', () => {
  it('returns count of completed dates for daily habit', () => {
    const habit = makeHabit({
      type: 'daily',
      completedDates: ['2026-01-01', '2026-01-02', '2026-01-03'],
    });
    expect(getHabitCompletionTotal(habit)).toBe(3);
  });

  it('returns count of zero-progress dates for reduce habit', () => {
    const habit = makeHabit({
      type: 'reduce',
      progressByDate: {
        '2026-01-01': 0,
        '2026-01-02': 2,
        '2026-01-03': 0,
        '2026-01-04': 0,
      },
    });
    expect(getHabitCompletionTotal(habit)).toBe(3);
  });

  it('returns 0 for a habit with no completions', () => {
    const habit = makeHabit({ completedDates: [] });
    expect(getHabitCompletionTotal(habit)).toBe(0);
  });
});
