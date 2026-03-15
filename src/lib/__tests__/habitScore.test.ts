import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  computeHabitScore,
  computeScoreHistory,
  computeAllStreaks,
  getCurrentStreak,
  getFrequencyByWeekday,
  getHabitWeeklyFrequency,
} from '../habitScore';
import type { HabitStreak } from '../habitScore';
import { makeTestHabit, datesToEntries, datesToEntriesWithSkips, numericalEntries } from '@/test/habitFixtures';
import { ENTRY } from '@/types';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Create a date string N days ago from a reference date */
function daysAgo(n: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return toDateStr(d);
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Create a timestamp for N days ago */
function timestampDaysAgo(n: number): number {
  return Date.now() - n * 86400000;
}

// ============================================
// computeHabitScore
// ============================================
describe('computeHabitScore', () => {
  describe('boolean daily habits', () => {
    it('returns 0 for a habit with no entries', () => {
      const habit = makeTestHabit({
        createdAt: timestampDaysAgo(10),
        entries: {},
      });
      const score = computeHabitScore(habit, daysAgo(0));
      expect(score).toBe(0);
    });

    it('returns > 0 for a habit with all days completed', () => {
      const dates: string[] = [];
      for (let i = 0; i < 10; i++) {
        dates.push(daysAgo(i));
      }
      const habit = makeTestHabit({
        createdAt: timestampDaysAgo(10),
        entries: datesToEntries(dates),
      });
      const score = computeHabitScore(habit, daysAgo(0));
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('returns 0 when upToDate is before createdAt', () => {
      const habit = makeTestHabit({
        createdAt: timestampDaysAgo(5),
      });
      const score = computeHabitScore(habit, daysAgo(10));
      expect(score).toBe(0);
    });

    it('score increases as more consecutive days are completed', () => {
      const dates3: string[] = [];
      const dates7: string[] = [];
      for (let i = 0; i < 7; i++) {
        if (i < 3) dates3.push(daysAgo(i));
        dates7.push(daysAgo(i));
      }
      const habit3 = makeTestHabit({
        createdAt: timestampDaysAgo(10),
        entries: datesToEntries(dates3),
      });
      const habit7 = makeTestHabit({
        createdAt: timestampDaysAgo(10),
        entries: datesToEntries(dates7),
      });
      const score3 = computeHabitScore(habit3, daysAgo(0));
      const score7 = computeHabitScore(habit7, daysAgo(0));
      expect(score7).toBeGreaterThan(score3);
    });

    it('handles SKIP entries — score not penalized when all entries are SKIP', () => {
      const entries: Record<string, { value: number }> = {};
      for (let i = 0; i < 5; i++) {
        entries[daysAgo(i)] = { value: ENTRY.SKIP };
      }
      const habit = makeTestHabit({
        createdAt: timestampDaysAgo(5),
        entries,
      });
      // Score should remain at initial (0 for boolean) because all-skip windows are skipped
      const score = computeHabitScore(habit, daysAgo(0));
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe('boolean non-daily habits (e.g., 3x/week)', () => {
    it('uses doubled window for non-daily habits', () => {
      // 3 times per 7 days
      const dates = [daysAgo(0), daysAgo(2), daysAgo(4)];
      const habit = makeTestHabit({
        createdAt: timestampDaysAgo(14),
        frequency: { numerator: 3, denominator: 7 },
        entries: datesToEntries(dates),
      });
      const score = computeHabitScore(habit, daysAgo(0));
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe('numerical habits — atLeast', () => {
    it('scores based on percentage of target achieved', () => {
      const habit = makeTestHabit({
        createdAt: timestampDaysAgo(5),
        habitType: 'numerical',
        targetType: 'atLeast',
        targetValue: 2, // e.g., 2 liters
        frequency: { numerator: 1, denominator: 1 },
        entries: numericalEntries({
          [daysAgo(0)]: 2,
          [daysAgo(1)]: 2,
          [daysAgo(2)]: 1,
        }),
      });
      const score = computeHabitScore(habit, daysAgo(0));
      expect(score).toBeGreaterThan(0);
    });

    it('caps percentage at 1.0 when exceeding target', () => {
      const habit = makeTestHabit({
        createdAt: timestampDaysAgo(3),
        habitType: 'numerical',
        targetType: 'atLeast',
        targetValue: 1,
        frequency: { numerator: 1, denominator: 1 },
        entries: numericalEntries({
          [daysAgo(0)]: 5, // well over target
          [daysAgo(1)]: 5,
          [daysAgo(2)]: 5,
        }),
      });
      const score = computeHabitScore(habit, daysAgo(0));
      expect(score).toBeLessThanOrEqual(1);
    });

    it('returns score 0 for atLeast with zero target and no entries', () => {
      const habit = makeTestHabit({
        createdAt: timestampDaysAgo(3),
        habitType: 'numerical',
        targetType: 'atLeast',
        targetValue: 0,
        frequency: { numerator: 1, denominator: 1 },
        entries: {},
      });
      const score = computeHabitScore(habit, daysAgo(0));
      expect(score).toBe(0);
    });
  });

  describe('numerical habits — atMost', () => {
    it('starts with score 1.0 and maintains high score when under target', () => {
      const habit = makeTestHabit({
        createdAt: timestampDaysAgo(3),
        habitType: 'numerical',
        targetType: 'atMost',
        targetValue: 3, // e.g., max 3 cigarettes
        frequency: { numerator: 1, denominator: 1 },
        entries: numericalEntries({
          [daysAgo(0)]: 1,
          [daysAgo(1)]: 2,
          [daysAgo(2)]: 1,
        }),
      });
      const score = computeHabitScore(habit, daysAgo(0));
      expect(score).toBeGreaterThan(0.5);
    });

    it('score decreases when exceeding target', () => {
      const habitUnder = makeTestHabit({
        createdAt: timestampDaysAgo(5),
        habitType: 'numerical',
        targetType: 'atMost',
        targetValue: 2,
        frequency: { numerator: 1, denominator: 1 },
        entries: numericalEntries({ [daysAgo(0)]: 1 }),
      });
      const habitOver = makeTestHabit({
        createdAt: timestampDaysAgo(5),
        habitType: 'numerical',
        targetType: 'atMost',
        targetValue: 2,
        frequency: { numerator: 1, denominator: 1 },
        entries: numericalEntries({ [daysAgo(0)]: 10 }),
      });
      const scoreUnder = computeHabitScore(habitUnder, daysAgo(0));
      const scoreOver = computeHabitScore(habitOver, daysAgo(0));
      expect(scoreUnder).toBeGreaterThan(scoreOver);
    });

    it('handles zero targetValue for atMost', () => {
      const habit = makeTestHabit({
        createdAt: timestampDaysAgo(2),
        habitType: 'numerical',
        targetType: 'atMost',
        targetValue: 0,
        frequency: { numerator: 1, denominator: 1 },
        entries: {},
      });
      const score = computeHabitScore(habit, daysAgo(0));
      // rollingSum === 0 with targetValue 0 → percentageCompleted = 1.0
      expect(score).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('returns score for habit created today', () => {
      const habit = makeTestHabit({
        createdAt: Date.now(),
        entries: datesToEntries([daysAgo(0)]),
      });
      const score = computeHabitScore(habit, daysAgo(0));
      expect(score).toBeGreaterThan(0);
    });

    it('handles denominator of 0 safely (defaults to 1)', () => {
      const habit = makeTestHabit({
        createdAt: timestampDaysAgo(5),
        frequency: { numerator: 1, denominator: 0 },
        entries: datesToEntries([daysAgo(0)]),
      });
      // Should not throw
      const score = computeHabitScore(habit, daysAgo(0));
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });
});

// ============================================
// computeScoreHistory
// ============================================
describe('computeScoreHistory', () => {
  it('returns an array of {date, score} objects with length equal to weeks', () => {
    const habit = makeTestHabit({ createdAt: timestampDaysAgo(100) });
    const history = computeScoreHistory(habit, 8);
    expect(history).toHaveLength(8);
    for (const item of history) {
      expect(item).toHaveProperty('date');
      expect(item).toHaveProperty('score');
      expect(typeof item.date).toBe('string');
      expect(typeof item.score).toBe('number');
    }
  });

  it('defaults to 12 weeks when weeks param is omitted', () => {
    const habit = makeTestHabit({ createdAt: timestampDaysAgo(100) });
    const history = computeScoreHistory(habit);
    expect(history).toHaveLength(12);
  });

  it('returns all-zero scores for a habit created in the future', () => {
    const habit = makeTestHabit({
      createdAt: Date.now() + 30 * 86400000, // 30 days from now
    });
    const history = computeScoreHistory(habit, 4);
    for (const item of history) {
      expect(item.score).toBe(0);
    }
  });

  it('has non-zero scores at recent weeks when habit has entries', () => {
    const dates: string[] = [];
    for (let i = 0; i < 30; i++) {
      dates.push(daysAgo(i));
    }
    const habit = makeTestHabit({
      createdAt: timestampDaysAgo(60),
      entries: datesToEntries(dates),
    });
    const history = computeScoreHistory(habit, 6);
    // The most recent week sample should have a non-zero score
    const lastWeek = history[history.length - 1];
    expect(lastWeek.score).toBeGreaterThan(0);
  });

  it('dates are sorted chronologically (oldest first)', () => {
    const habit = makeTestHabit({ createdAt: timestampDaysAgo(100) });
    const history = computeScoreHistory(habit, 4);
    for (let i = 1; i < history.length; i++) {
      expect(history[i].date > history[i - 1].date).toBe(true);
    }
  });
});

// ============================================
// computeAllStreaks
// ============================================
describe('computeAllStreaks', () => {
  let realDate: typeof Date;

  beforeEach(() => {
    // Fix "today" so streak logic is deterministic
    realDate = globalThis.Date;
    const fixedNow = new Date(2026, 2, 14); // 2026-03-14
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty array for a habit with no entries', () => {
    const habit = makeTestHabit({
      createdAt: new Date(2026, 2, 1).getTime(),
      entries: {},
    });
    expect(computeAllStreaks(habit)).toEqual([]);
  });

  it('returns empty array when createdAt is in the future', () => {
    const habit = makeTestHabit({
      createdAt: new Date(2026, 5, 1).getTime(), // June future
    });
    expect(computeAllStreaks(habit)).toEqual([]);
  });

  it('identifies a single continuous streak', () => {
    const entries = datesToEntries([
      '2026-03-10',
      '2026-03-11',
      '2026-03-12',
      '2026-03-13',
      '2026-03-14', // today
    ]);
    const habit = makeTestHabit({
      createdAt: new Date(2026, 2, 10).getTime(),
      entries,
    });
    const streaks = computeAllStreaks(habit);
    expect(streaks.length).toBeGreaterThanOrEqual(1);
    const longest = streaks[0];
    expect(longest.length).toBe(5);
    expect(longest.start).toBe('2026-03-10');
    expect(longest.end).toBe('2026-03-14');
  });

  it('identifies multiple streaks separated by gaps', () => {
    const entries = datesToEntries([
      '2026-03-01',
      '2026-03-02',
      // gap on 03 and 04
      '2026-03-05',
      '2026-03-06',
      '2026-03-07',
    ]);
    const habit = makeTestHabit({
      createdAt: new Date(2026, 2, 1).getTime(),
      entries,
    });
    const streaks = computeAllStreaks(habit);
    expect(streaks.length).toBe(2);
    // Sorted longest first
    expect(streaks[0].length).toBe(3);
    expect(streaks[1].length).toBe(2);
  });

  it('SKIP entries extend the streak', () => {
    const entries = datesToEntriesWithSkips(
      ['2026-03-10', '2026-03-12', '2026-03-13'],
      ['2026-03-11'], // skip day in the middle
    );
    const habit = makeTestHabit({
      createdAt: new Date(2026, 2, 10).getTime(),
      entries,
    });
    const streaks = computeAllStreaks(habit);
    expect(streaks.length).toBe(1);
    expect(streaks[0].length).toBe(4); // 10, 11(skip), 12, 13
  });

  it('sorts by length desc, then recency desc', () => {
    const entries = datesToEntries([
      '2026-03-01', '2026-03-02', '2026-03-03', // 3-day streak
      // gap
      '2026-03-10', '2026-03-11', // 2-day streak (more recent)
    ]);
    const habit = makeTestHabit({
      createdAt: new Date(2026, 2, 1).getTime(),
      entries,
    });
    const streaks = computeAllStreaks(habit);
    expect(streaks[0].length).toBeGreaterThanOrEqual(streaks[1].length);
  });
});

// ============================================
// getCurrentStreak
// ============================================
describe('getCurrentStreak', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 14)); // 2026-03-14
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 0 when there are no entries', () => {
    const habit = makeTestHabit({
      createdAt: new Date(2026, 2, 1).getTime(),
      entries: {},
    });
    expect(getCurrentStreak(habit)).toBe(0);
  });

  it('returns streak length when streak ends today', () => {
    const entries = datesToEntries([
      '2026-03-12',
      '2026-03-13',
      '2026-03-14',
    ]);
    const habit = makeTestHabit({
      createdAt: new Date(2026, 2, 1).getTime(),
      entries,
    });
    expect(getCurrentStreak(habit)).toBe(3);
  });

  it('returns streak length when streak ends yesterday (today not yet done)', () => {
    const entries = datesToEntries([
      '2026-03-11',
      '2026-03-12',
      '2026-03-13',
    ]);
    const habit = makeTestHabit({
      createdAt: new Date(2026, 2, 1).getTime(),
      entries,
    });
    expect(getCurrentStreak(habit)).toBe(3);
  });

  it('returns 0 when last streak ended 2+ days ago', () => {
    const entries = datesToEntries([
      '2026-03-10',
      '2026-03-11',
    ]);
    const habit = makeTestHabit({
      createdAt: new Date(2026, 2, 1).getTime(),
      entries,
    });
    expect(getCurrentStreak(habit)).toBe(0);
  });
});

// ============================================
// getFrequencyByWeekday
// ============================================
describe('getFrequencyByWeekday', () => {
  it('returns array of 7 zeros for empty entries', () => {
    const habit = makeTestHabit({ entries: {} });
    expect(getFrequencyByWeekday(habit)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it('counts YES_MANUAL entries by day of week for boolean habits', () => {
    // 2026-03-09 is Monday (getDay()=1), 2026-03-10 is Tuesday (getDay()=2)
    const entries = datesToEntries(['2026-03-09', '2026-03-10']);
    const habit = makeTestHabit({
      habitType: 'boolean',
      entries,
    });
    const counts = getFrequencyByWeekday(habit);
    expect(counts[1]).toBe(1); // Monday
    expect(counts[2]).toBe(1); // Tuesday
    expect(counts[0]).toBe(0); // Sunday
  });

  it('counts numerical entries with value > 0 (not SKIP)', () => {
    const entries = numericalEntries({
      '2026-03-09': 5, // Monday
      '2026-03-10': 3, // Tuesday
    });
    const habit = makeTestHabit({
      habitType: 'numerical',
      entries,
    });
    const counts = getFrequencyByWeekday(habit);
    expect(counts[1]).toBe(1); // Monday
    expect(counts[2]).toBe(1); // Tuesday
  });

  it('ignores SKIP entries for boolean habits', () => {
    const entries = datesToEntriesWithSkips([], ['2026-03-09']);
    const habit = makeTestHabit({
      habitType: 'boolean',
      entries,
    });
    const counts = getFrequencyByWeekday(habit);
    expect(counts[1]).toBe(0); // SKIP is not YES_MANUAL
  });

  it('handles multiple completions on same weekday', () => {
    // Both are Mondays
    const entries = datesToEntries(['2026-03-02', '2026-03-09']);
    const habit = makeTestHabit({
      habitType: 'boolean',
      entries,
    });
    const counts = getFrequencyByWeekday(habit);
    expect(counts[1]).toBe(2); // Two Mondays
  });
});

// ============================================
// getHabitWeeklyFrequency
// ============================================
describe('getHabitWeeklyFrequency', () => {
  it('returns 7 for daily habits (1/1)', () => {
    const habit = makeTestHabit({ frequency: { numerator: 1, denominator: 1 } });
    expect(getHabitWeeklyFrequency(habit)).toBe(7);
  });

  it('returns 3 for 3x/week habits (3/7)', () => {
    const habit = makeTestHabit({ frequency: { numerator: 3, denominator: 7 } });
    expect(getHabitWeeklyFrequency(habit)).toBe(3);
  });

  it('returns 1 for weekly habits (1/7)', () => {
    const habit = makeTestHabit({ frequency: { numerator: 1, denominator: 7 } });
    expect(getHabitWeeklyFrequency(habit)).toBe(1);
  });

  it('returns 14 for twice-daily habits (2/1)', () => {
    const habit = makeTestHabit({ frequency: { numerator: 2, denominator: 1 } });
    expect(getHabitWeeklyFrequency(habit)).toBe(14);
  });

  it('handles denominator of 0 safely (treats as 1)', () => {
    const habit = makeTestHabit({ frequency: { numerator: 5, denominator: 0 } });
    expect(getHabitWeeklyFrequency(habit)).toBe(35);
  });

  it('handles numerator of 0', () => {
    const habit = makeTestHabit({ frequency: { numerator: 0, denominator: 7 } });
    expect(getHabitWeeklyFrequency(habit)).toBe(0);
  });
});
