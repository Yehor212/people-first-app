import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── In-memory raw storage mock ─────────────────────────────────
let rawStorage: Record<string, string | null> = {};

vi.mock('../safeJson', () => ({
  storageGetRaw: vi.fn((key: string) => rawStorage[key] ?? null),
  storageSetRaw: vi.fn((key: string, value: string) => {
    rawStorage[key] = value;
  }),
}));

vi.mock('../utils', () => ({
  getToday: vi.fn(() => '2026-02-17'),
}));

vi.mock('../logger', () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import {
  updateLastActiveDate,
  getLastActiveDate,
  getDaysSinceLastActive,
  shouldShowWelcomeBack,
  markWelcomeBackShown,
  calculateHabitSuccessRates,
  wasStreakBroken,
} from '@/lib/reEngagement';
import { storageSetRaw } from '../safeJson';
import { SK } from '@/lib/storageKeys';
import type { Habit } from '@/types';
import { makeTestHabit, datesToEntries } from '@/test/habitFixtures';

// ─── Helper ─────────────────────────────────────────────────────
function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return makeTestHabit({
    createdAt: new Date('2026-02-10').getTime(),
    ...overrides,
  });
}

beforeEach(() => {
  rawStorage = {};
  vi.clearAllMocks();
});

// ─── updateLastActiveDate ───────────────────────────────────────

describe('updateLastActiveDate', () => {
  it('stores today in LAST_ACTIVE_DATE', () => {
    updateLastActiveDate();
    expect(storageSetRaw).toHaveBeenCalledWith(SK.LAST_ACTIVE_DATE, '2026-02-17');
  });

  it('overwrites previous value', () => {
    rawStorage[SK.LAST_ACTIVE_DATE] = '2026-02-10';
    updateLastActiveDate();
    expect(rawStorage[SK.LAST_ACTIVE_DATE]).toBe('2026-02-17');
  });
});

// ─── getLastActiveDate ──────────────────────────────────────────

describe('getLastActiveDate', () => {
  it('returns null when storage is empty', () => {
    expect(getLastActiveDate()).toBeNull();
  });

  it('returns the stored date string', () => {
    rawStorage[SK.LAST_ACTIVE_DATE] = '2026-02-14';
    expect(getLastActiveDate()).toBe('2026-02-14');
  });

  it('returns null when stored value is empty string', () => {
    rawStorage[SK.LAST_ACTIVE_DATE] = '';
    expect(getLastActiveDate()).toBeNull();
  });
});

// ─── getDaysSinceLastActive ─────────────────────────────────────

describe('getDaysSinceLastActive', () => {
  it('returns 0 when no last active date is stored', () => {
    expect(getDaysSinceLastActive()).toBe(0);
  });

  it('returns 1 for yesterday', () => {
    rawStorage[SK.LAST_ACTIVE_DATE] = '2026-02-16';
    expect(getDaysSinceLastActive()).toBe(1);
  });

  it('returns 7 for one week ago', () => {
    rawStorage[SK.LAST_ACTIVE_DATE] = '2026-02-10';
    expect(getDaysSinceLastActive()).toBe(7);
  });

  it('returns 0 for today (same day)', () => {
    rawStorage[SK.LAST_ACTIVE_DATE] = '2026-02-17';
    expect(getDaysSinceLastActive()).toBe(0);
  });
});

// ─── shouldShowWelcomeBack ──────────────────────────────────────

describe('shouldShowWelcomeBack', () => {
  it('returns false when days away is less than 3', () => {
    rawStorage[SK.LAST_ACTIVE_DATE] = '2026-02-16'; // 1 day away
    expect(shouldShowWelcomeBack()).toBe(false);
  });

  it('returns true when days away is exactly 3', () => {
    rawStorage[SK.LAST_ACTIVE_DATE] = '2026-02-14'; // 3 days away
    expect(shouldShowWelcomeBack()).toBe(true);
  });

  it('returns true when days away is more than 3', () => {
    rawStorage[SK.LAST_ACTIVE_DATE] = '2026-02-10'; // 7 days away
    expect(shouldShowWelcomeBack()).toBe(true);
  });

  it('returns false when welcome back was already shown for this absence', () => {
    rawStorage[SK.LAST_ACTIVE_DATE] = '2026-02-10'; // 7 days away
    rawStorage[SK.WELCOME_BACK_SHOWN] = '2026-02-10'; // already shown for this lastActive
    expect(shouldShowWelcomeBack()).toBe(false);
  });

  it('returns true when welcome back was shown for a different absence period', () => {
    rawStorage[SK.LAST_ACTIVE_DATE] = '2026-02-10';
    rawStorage[SK.WELCOME_BACK_SHOWN] = '2026-02-05'; // shown for earlier absence
    expect(shouldShowWelcomeBack()).toBe(true);
  });

  it('returns false when no last active date (0 days away)', () => {
    expect(shouldShowWelcomeBack()).toBe(false);
  });
});

// ─── markWelcomeBackShown ───────────────────────────────────────

describe('markWelcomeBackShown', () => {
  it('stores lastActive as the WELCOME_BACK_SHOWN value', () => {
    rawStorage[SK.LAST_ACTIVE_DATE] = '2026-02-10';
    markWelcomeBackShown();
    expect(rawStorage[SK.WELCOME_BACK_SHOWN]).toBe('2026-02-10');
  });

  it('calls updateLastActiveDate to set today', () => {
    rawStorage[SK.LAST_ACTIVE_DATE] = '2026-02-10';
    markWelcomeBackShown();
    expect(rawStorage[SK.LAST_ACTIVE_DATE]).toBe('2026-02-17');
  });

  it('does not set WELCOME_BACK_SHOWN when no lastActive', () => {
    markWelcomeBackShown();
    // WELCOME_BACK_SHOWN should not be set since lastActive was null
    expect(rawStorage[SK.WELCOME_BACK_SHOWN]).toBeUndefined();
  });
});

// ─── calculateHabitSuccessRates ─────────────────────────────────

describe('calculateHabitSuccessRates', () => {
  it('returns empty array for empty input', () => {
    expect(calculateHabitSuccessRates([])).toEqual([]);
  });

  it('calculates success rate for a habit with completions', () => {
    const habit = makeHabit({
      createdAt: new Date('2026-02-10').getTime(), // 7 days ago
      entries: datesToEntries(['2026-02-10', '2026-02-11', '2026-02-12']),
    });
    const result = calculateHabitSuccessRates([habit]);
    // 3 completions / 7 days * 100
    expect(result).toHaveLength(1);
    expect(result[0].successRate).toBeCloseTo((3 / 7) * 100, 1);
  });

  it('returns 0 success rate for a habit created today (0 days)', () => {
    const habit = makeHabit({
      createdAt: new Date('2026-02-17').getTime(), // today
      entries: {},
    });
    const result = calculateHabitSuccessRates([habit]);
    expect(result[0].successRate).toBe(0);
  });

  it('caps consideration period at 30 days', () => {
    const habit = makeHabit({
      createdAt: new Date('2026-01-01').getTime(), // 47 days ago
      entries: datesToEntries(['2026-02-01', '2026-02-02', '2026-02-03']),
    });
    const result = calculateHabitSuccessRates([habit]);
    // Capped at 30 days: 3 / 30 * 100
    expect(result[0].successRate).toBeCloseTo((3 / 30) * 100, 1);
  });

  it('sorts results by success rate descending', () => {
    const habitHigh = makeHabit({
      id: 'high',
      createdAt: new Date('2026-02-10').getTime(),
      entries: datesToEntries([
        '2026-02-10', '2026-02-11', '2026-02-12',
        '2026-02-13', '2026-02-14', '2026-02-15', '2026-02-16',
      ]),
    });
    const habitLow = makeHabit({
      id: 'low',
      createdAt: new Date('2026-02-10').getTime(),
      entries: datesToEntries(['2026-02-10']),
    });
    const result = calculateHabitSuccessRates([habitLow, habitHigh]);
    expect(result[0].habit.id).toBe('high');
    expect(result[1].habit.id).toBe('low');
    expect(result[0].successRate).toBeGreaterThan(result[1].successRate);
  });

  it('handles habit with no entries (empty)', () => {
    const habit = makeHabit({
      createdAt: new Date('2026-02-10').getTime(),
      entries: {},
    });
    const result = calculateHabitSuccessRates([habit]);
    expect(result[0].successRate).toBe(0);
  });
});

// ─── wasStreakBroken ────────────────────────────────────────────

describe('wasStreakBroken', () => {
  it('returns true when streak is 0 and days away >= 3', () => {
    rawStorage[SK.LAST_ACTIVE_DATE] = '2026-02-14';
    expect(wasStreakBroken(0, 3, [])).toBe(true);
  });

  it('returns true when streak is 0 and days away is large', () => {
    rawStorage[SK.LAST_ACTIVE_DATE] = '2026-02-10';
    expect(wasStreakBroken(0, 7, [])).toBe(true);
  });

  it('returns false when streak > 0 and no rest days in absence', () => {
    rawStorage[SK.LAST_ACTIVE_DATE] = '2026-02-14';
    // streak=5, daysAway=3 → first check: 5!==0, skip. Loop finds no rest days.
    // Returns currentStreak===0 → false
    expect(wasStreakBroken(5, 3, [])).toBe(false);
  });

  it('returns false when no last active date is stored', () => {
    // streak=5, daysAway=2 → first check: false. lastActive=null → returns false.
    expect(wasStreakBroken(5, 2, [])).toBe(false);
  });

  it('returns false when a rest day protects the streak', () => {
    rawStorage[SK.LAST_ACTIVE_DATE] = '2026-02-15';
    // streak=5, daysAway=2 → first check: 5!==0, skip.
    // Loop i=1: checks 2026-02-16. restDays includes it → returns false.
    expect(wasStreakBroken(5, 2, ['2026-02-16'])).toBe(false);
  });

  it('returns true for streak 0 with daysAway < 3 and no rest day protection', () => {
    rawStorage[SK.LAST_ACTIVE_DATE] = '2026-02-16';
    // streak=0, daysAway=2 → first check: 0===0 && 2>=3 → false. Skip.
    // lastActive exists. Loop i=1 (i<2): checks 2026-02-17. Not in restDays.
    // Returns currentStreak===0 → true
    expect(wasStreakBroken(0, 2, [])).toBe(true);
  });

  it('returns false for streak 0, daysAway < 3 when rest day protects', () => {
    rawStorage[SK.LAST_ACTIVE_DATE] = '2026-02-16';
    // streak=0, daysAway=2 → first check: false.
    // Loop i=1: checks 2026-02-17 → is in restDays → returns false.
    expect(wasStreakBroken(0, 2, ['2026-02-17'])).toBe(false);
  });
});
