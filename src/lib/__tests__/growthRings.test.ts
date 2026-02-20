import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  computeGrowthRings,
  getGrowthRingsSummary,
  type GrowthRing,
  type GrowthRingsData,
} from '../growthRings';

// ============================================
// CONSTANTS
// ============================================

/**
 * Fixed "today" used across all tests.
 * The source module uses `new Date().toISOString().split('T')[0]` directly,
 * so we control it with vi.useFakeTimers / vi.setSystemTime.
 *
 * Date window used in tests:
 *   since = 2026-02-10
 *   today = 2026-02-19   (10 days: Feb 10 … Feb 19)
 */
const SINCE = '2026-02-10';
const TODAY = '2026-02-19';

// All 10 dates in our test window (inclusive)
const ALL_DATES = [
  '2026-02-10',
  '2026-02-11',
  '2026-02-12',
  '2026-02-13',
  '2026-02-14',
  '2026-02-15',
  '2026-02-16',
  '2026-02-17',
  '2026-02-18',
  '2026-02-19',
];

// ============================================
// SETUP / TEARDOWN
// ============================================

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-02-19T12:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

// ============================================
// computeGrowthRings — ring types and density
// ============================================

describe('computeGrowthRings — ring types', () => {
  // ──────────────────────────────────────────
  // 1. All active dates → type='active', density=1
  // ──────────────────────────────────────────
  it('marks every date as active when all dates are in activeDates', () => {
    const result = computeGrowthRings(ALL_DATES, [], SINCE);

    expect(result.rings).toHaveLength(10);
    result.rings.forEach((ring: GrowthRing) => {
      expect(ring.type).toBe('active');
      expect(ring.density).toBe(1);
    });
  });

  it('assigns density=1 to active rings', () => {
    const result = computeGrowthRings([TODAY], [], SINCE);
    const activeRing = result.rings.find(r => r.date === TODAY);
    expect(activeRing).toBeDefined();
    expect(activeRing?.density).toBe(1);
  });

  // ──────────────────────────────────────────
  // 2. Rest dates → type='rest', density=0.5
  // ──────────────────────────────────────────
  it('marks rest dates with type rest and density 0.5', () => {
    const restDate = '2026-02-15';
    const result = computeGrowthRings([], [restDate], SINCE);

    const restRing = result.rings.find(r => r.date === restDate);
    expect(restRing).toBeDefined();
    expect(restRing?.type).toBe('rest');
    expect(restRing?.density).toBe(0.5);
  });

  it('marks multiple rest dates correctly', () => {
    const restDates = ['2026-02-12', '2026-02-15', '2026-02-18'];
    const result = computeGrowthRings([], restDates, SINCE);

    restDates.forEach(date => {
      const ring = result.rings.find(r => r.date === date);
      expect(ring).toBeDefined();
      expect(ring?.type).toBe('rest');
      expect(ring?.density).toBe(0.5);
    });
  });

  // ──────────────────────────────────────────
  // 3. Gap dates → type='gap', density=0.2
  // ──────────────────────────────────────────
  it('marks dates not in activeDates or restDates as gap with density 0.2', () => {
    const result = computeGrowthRings([], [], SINCE);

    result.rings.forEach((ring: GrowthRing) => {
      expect(ring.type).toBe('gap');
      expect(ring.density).toBe(0.2);
    });
  });

  it('correctly mixes active, rest, and gap rings in one dataset', () => {
    const activeDates = ['2026-02-10', '2026-02-11'];
    const restDates   = ['2026-02-12'];
    // 2026-02-13 … 2026-02-19 become gaps

    const result = computeGrowthRings(activeDates, restDates, SINCE);

    expect(result.rings.find(r => r.date === '2026-02-10')?.type).toBe('active');
    expect(result.rings.find(r => r.date === '2026-02-11')?.type).toBe('active');
    expect(result.rings.find(r => r.date === '2026-02-12')?.type).toBe('rest');
    expect(result.rings.find(r => r.date === '2026-02-13')?.type).toBe('gap');
    expect(result.rings.find(r => r.date === '2026-02-19')?.type).toBe('gap');
  });

  it('includes today in the rings', () => {
    const result = computeGrowthRings([TODAY], [], SINCE);
    const todayRing = result.rings.find(r => r.date === TODAY);
    expect(todayRing).toBeDefined();
    expect(todayRing?.type).toBe('active');
  });

  it('includes the since date in the rings', () => {
    const result = computeGrowthRings([SINCE], [], SINCE);
    const firstRing = result.rings.find(r => r.date === SINCE);
    expect(firstRing).toBeDefined();
    expect(firstRing?.type).toBe('active');
  });

  it('generates one ring per calendar date between since and today', () => {
    const result = computeGrowthRings([], [], SINCE);
    expect(result.rings).toHaveLength(10);
    result.rings.forEach((ring, idx) => {
      expect(ring.date).toBe(ALL_DATES[idx]);
    });
  });
});

// ============================================
// computeGrowthRings — counts
// ============================================

describe('computeGrowthRings — totalActiveDays and totalRestDays', () => {
  // ──────────────────────────────────────────
  // 4. Correct totalActiveDays and totalRestDays count
  // ──────────────────────────────────────────
  it('returns totalActiveDays=0 and totalRestDays=0 when all days are gaps', () => {
    const result = computeGrowthRings([], [], SINCE);
    expect(result.totalActiveDays).toBe(0);
    expect(result.totalRestDays).toBe(0);
  });

  it('counts every activeDates entry that falls in the date range', () => {
    const activeDates = ['2026-02-10', '2026-02-14', '2026-02-19'];
    const result = computeGrowthRings(activeDates, [], SINCE);
    expect(result.totalActiveDays).toBe(3);
  });

  it('counts every restDates entry that falls in the date range', () => {
    const restDates = ['2026-02-11', '2026-02-15'];
    const result = computeGrowthRings([], restDates, SINCE);
    expect(result.totalRestDays).toBe(2);
  });

  it('counts active and rest days independently', () => {
    const activeDates = ['2026-02-10', '2026-02-11', '2026-02-12'];
    const restDates   = ['2026-02-13', '2026-02-14'];
    const result = computeGrowthRings(activeDates, restDates, SINCE);
    expect(result.totalActiveDays).toBe(3);
    expect(result.totalRestDays).toBe(2);
  });

  it('does not count dates outside the since…today window', () => {
    // Active date before 'since' and one after 'today'
    const activeDates = ['2026-02-09', '2026-02-20'];
    const result = computeGrowthRings(activeDates, [], SINCE);
    expect(result.totalActiveDays).toBe(0);
  });

  it('counts all 10 dates as active when all are provided', () => {
    const result = computeGrowthRings(ALL_DATES, [], SINCE);
    expect(result.totalActiveDays).toBe(10);
    expect(result.totalRestDays).toBe(0);
  });
});

// ============================================
// computeGrowthRings — streak logic
// ============================================

describe('computeGrowthRings — streak computation', () => {
  // ──────────────────────────────────────────
  // 5. Current streak resets on gap, preserved through rest
  // ──────────────────────────────────────────
  it('returns currentStreak=0 when the most recent days are all gaps', () => {
    // Active only on 2026-02-10, then all gaps up to today
    const result = computeGrowthRings(['2026-02-10'], [], SINCE);
    expect(result.currentStreak).toBe(0);
  });

  it('resets currentStreak to 0 after a gap', () => {
    // active: Feb 10, 11 — gap: Feb 12 — active: Feb 13–19
    const activeDates = [
      '2026-02-10', '2026-02-11',
      '2026-02-13', '2026-02-14', '2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19',
    ];
    const result = computeGrowthRings(activeDates, [], SINCE);
    // Gap on Feb 12 resets the streak; Feb 13–19 is 7 consecutive active days
    expect(result.currentStreak).toBe(7);
  });

  it('preserves currentStreak through rest days (rest does not break streak)', () => {
    // active: Feb 17, rest: Feb 18, active: Feb 19
    const activeDates = ['2026-02-17', '2026-02-19'];
    const restDates   = ['2026-02-18'];
    const result = computeGrowthRings(activeDates, restDates, SINCE);
    // Streak started Feb 17; rest on Feb 18 doesn't reset; active again Feb 19
    // The streak counter only increments on active days, so it should be 2
    // (the rest day simply passes without resetting currentStreak)
    expect(result.currentStreak).toBe(2);
  });

  it('counts consecutive active days up to today as the current streak', () => {
    // All 10 days active
    const result = computeGrowthRings(ALL_DATES, [], SINCE);
    expect(result.currentStreak).toBe(10);
  });

  it('currentStreak is 1 when only today is active', () => {
    const result = computeGrowthRings([TODAY], [], SINCE);
    expect(result.currentStreak).toBe(1);
  });

  // ──────────────────────────────────────────
  // 6. Longest streak computation
  // ──────────────────────────────────────────
  it('returns longestStreak=0 when there are no active days', () => {
    const result = computeGrowthRings([], [], SINCE);
    expect(result.longestStreak).toBe(0);
  });

  it('computes longestStreak correctly when there are two separate runs', () => {
    // Run A: Feb 10–12 (3 days), gap Feb 13–14, Run B: Feb 15–17 (3 days), gaps after
    const activeDates = [
      '2026-02-10', '2026-02-11', '2026-02-12',
      '2026-02-15', '2026-02-16', '2026-02-17',
    ];
    const result = computeGrowthRings(activeDates, [], SINCE);
    expect(result.longestStreak).toBe(3);
  });

  it('longestStreak equals currentStreak when there is one unbroken run', () => {
    const activeDates = ['2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19'];
    const result = computeGrowthRings(activeDates, [], SINCE);
    expect(result.longestStreak).toBe(5);
    expect(result.currentStreak).toBe(5);
  });

  it('longestStreak captures a past run even if the current run is shorter', () => {
    // Long run at start: Feb 10–14 (5 days), gap Feb 15–16, short run Feb 17–19 (3 days)
    const activeDates = [
      '2026-02-10', '2026-02-11', '2026-02-12', '2026-02-13', '2026-02-14',
      '2026-02-17', '2026-02-18', '2026-02-19',
    ];
    const result = computeGrowthRings(activeDates, [], SINCE);
    expect(result.longestStreak).toBe(5);
    expect(result.currentStreak).toBe(3);
  });

  it('counts all 10 days as the longest streak when all are active', () => {
    const result = computeGrowthRings(ALL_DATES, [], SINCE);
    expect(result.longestStreak).toBe(10);
  });
});

// ============================================
// getGrowthRingsSummary
// ============================================

describe('getGrowthRingsSummary', () => {
  // Helper that builds GrowthRingsData directly from computeGrowthRings
  function make(activeDates: string[], restDates: string[]): GrowthRingsData {
    return computeGrowthRings(activeDates, restDates, SINCE);
  }

  // ──────────────────────────────────────────
  // 7. getGrowthRingsSummary returns correct totalRings text
  // ──────────────────────────────────────────
  it('returns "0 rings of growth" when there are no active or rest days', () => {
    const data = make([], []);
    const { totalRings } = getGrowthRingsSummary(data);
    expect(totalRings).toBe('0 rings of growth');
  });

  it('counts only active + rest days in the totalRings label (not gaps)', () => {
    // 3 active + 2 rest = 5 rings
    const activeDates = ['2026-02-10', '2026-02-11', '2026-02-12'];
    const restDates   = ['2026-02-13', '2026-02-14'];
    const data = make(activeDates, restDates);
    const { totalRings } = getGrowthRingsSummary(data);
    expect(totalRings).toBe('5 rings of growth');
  });

  it('counts only active days when there are no rest days', () => {
    const data = make(['2026-02-17', '2026-02-18', '2026-02-19'], []);
    const { totalRings } = getGrowthRingsSummary(data);
    expect(totalRings).toBe('3 rings of growth');
  });

  it('builds the totalRings string as "{n} rings of growth"', () => {
    const data = make(ALL_DATES, []);
    const { totalRings } = getGrowthRingsSummary(data);
    expect(totalRings).toBe('10 rings of growth');
  });

  // ──────────────────────────────────────────
  // 8. weekSummary mentions rest when rest days exist in last 7 rings
  // ──────────────────────────────────────────
  it('includes rest count in weekSummary when rest days exist in last 7 rings', () => {
    // last 7 rings = Feb 13–19; make Feb 15 a rest day
    const activeDates = ['2026-02-13', '2026-02-14', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19'];
    const restDates   = ['2026-02-15'];
    const data = make(activeDates, restDates);
    const { weekSummary } = getGrowthRingsSummary(data);
    // Should say "You grew for 6 days and rested for 1. Perfect balance."
    expect(weekSummary).toContain('rested for 1');
    expect(weekSummary).toContain('6');
    expect(weekSummary).toContain('Perfect balance');
  });

  it('mentions the correct rest count when there are 2 rest days in last 7', () => {
    // last 7 rings: Feb 13–19; Feb 13 and Feb 15 are rest
    const activeDates = ['2026-02-14', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19'];
    const restDates   = ['2026-02-13', '2026-02-15'];
    const data = make(activeDates, restDates);
    const { weekSummary } = getGrowthRingsSummary(data);
    expect(weekSummary).toContain('rested for 2');
    expect(weekSummary).toContain('5');
  });

  // ──────────────────────────────────────────
  // 9. Full week summary says "A full week of growth!"
  // ──────────────────────────────────────────
  it('returns "A full week of growth!" when all 7 of the last rings are active', () => {
    // last 7 rings: Feb 13–19 all active, no rest
    const activeDates = ['2026-02-13', '2026-02-14', '2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19'];
    const data = make(activeDates, []);
    const { weekSummary } = getGrowthRingsSummary(data);
    expect(weekSummary).toBe('A full week of growth!');
  });

  it('does NOT say "A full week of growth!" when only 6 of the last 7 are active', () => {
    const activeDates = ['2026-02-13', '2026-02-14', '2026-02-15', '2026-02-16', '2026-02-17', '2026-02-19'];
    // Feb 18 is a gap
    const data = make(activeDates, []);
    const { weekSummary } = getGrowthRingsSummary(data);
    expect(weekSummary).not.toBe('A full week of growth!');
  });

  it('shows plain active-count summary when no rest days and fewer than 7 active', () => {
    // last 7 rings: Feb 13–19; only 4 active, no rest → plain count path
    const activeDates = ['2026-02-13', '2026-02-14', '2026-02-15', '2026-02-16'];
    const data = make(activeDates, []);
    const { weekSummary } = getGrowthRingsSummary(data);
    expect(weekSummary).toBe('4 days of growth this week.');
  });

  it('shows 0 days of growth this week when no active or rest days in last 7', () => {
    // All gaps
    const data = make([], []);
    const { weekSummary } = getGrowthRingsSummary(data);
    expect(weekSummary).toBe('0 days of growth this week.');
  });

  // ──────────────────────────────────────────
  // Edge cases
  // ──────────────────────────────────────────
  it('uses the last 7 rings, not the entire history', () => {
    // Early dates (Feb 10–12) are all active, but last 7 (Feb 13–19) are all gaps
    const activeDates = ['2026-02-10', '2026-02-11', '2026-02-12'];
    const data = make(activeDates, []);
    const { weekSummary } = getGrowthRingsSummary(data);
    // Last 7 rings are all gaps → 0 active, 0 rest → plain count
    expect(weekSummary).toBe('0 days of growth this week.');
  });

  it('rest days in last 7 rings take priority over the full-week branch', () => {
    // 6 active + 1 rest in last 7 — should NOT say "A full week of growth!"
    const activeDates = ['2026-02-13', '2026-02-14', '2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18'];
    const restDates   = ['2026-02-19'];
    const data = make(activeDates, restDates);
    const { weekSummary } = getGrowthRingsSummary(data);
    expect(weekSummary).toContain('Perfect balance');
    expect(weekSummary).not.toBe('A full week of growth!');
  });
});
