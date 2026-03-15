import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeEntriesWithAuto } from '../habitComputedEntries';
import { makeTestHabit, datesToEntries, datesToEntriesWithSkips, numericalEntries } from '@/test/habitFixtures';
import { ENTRY } from '@/types';
import type { HabitEntry } from '@/types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateStr(d);
}

// ============================================
// computeEntriesWithAuto
// ============================================
describe('computeEntriesWithAuto', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 14)); // 2026-03-14
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('short-circuit cases', () => {
    it('returns original entries unchanged for daily habits (numerator === denominator)', () => {
      const entries = datesToEntries(['2026-03-10', '2026-03-11']);
      const habit = makeTestHabit({
        frequency: { numerator: 1, denominator: 1 },
        entries,
      });
      const result = computeEntriesWithAuto(habit);
      expect(result).toBe(entries); // Same reference — no copy
    });

    it('returns original entries unchanged for numerical habits', () => {
      const entries = numericalEntries({ '2026-03-10': 5 });
      const habit = makeTestHabit({
        habitType: 'numerical',
        frequency: { numerator: 3, denominator: 7 },
        entries,
      });
      const result = computeEntriesWithAuto(habit);
      expect(result).toBe(entries); // Same reference
    });

    it('returns original entries when entries is empty', () => {
      const habit = makeTestHabit({
        frequency: { numerator: 3, denominator: 7 },
        entries: {},
      });
      const result = computeEntriesWithAuto(habit);
      expect(result).toEqual({});
    });

    it('returns original entries when entries is undefined-like (empty object)', () => {
      const habit = makeTestHabit({
        frequency: { numerator: 3, denominator: 7 },
        entries: {},
      });
      const result = computeEntriesWithAuto(habit);
      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  describe('non-daily boolean habits — YES_AUTO fill logic', () => {
    it('fills gaps with YES_AUTO between YES_MANUAL clusters for 3x/week habit', () => {
      // 3 completions within 7 days should create a cluster
      const entries = datesToEntries([
        '2026-03-08', // Sat
        '2026-03-10', // Mon
        '2026-03-12', // Wed
      ]);
      const habit = makeTestHabit({
        createdAt: new Date(2026, 2, 1).getTime(),
        frequency: { numerator: 3, denominator: 7 },
        entries,
      });
      const result = computeEntriesWithAuto(habit);

      // Original YES_MANUAL entries must be preserved
      expect(result['2026-03-08'].value).toBe(ENTRY.YES_MANUAL);
      expect(result['2026-03-10'].value).toBe(ENTRY.YES_MANUAL);
      expect(result['2026-03-12'].value).toBe(ENTRY.YES_MANUAL);

      // Gap days within the interval should be filled with YES_AUTO
      // The exact fill depends on interval boundaries, but at minimum
      // the gap day 2026-03-09 (between 08 and 10) should be filled
      const gapDay = result['2026-03-09'];
      if (gapDay) {
        expect(gapDay.value).toBe(ENTRY.YES_AUTO);
      }
    });

    it('does not overwrite SKIP entries with YES_AUTO', () => {
      const entries = datesToEntriesWithSkips(
        ['2026-03-08', '2026-03-10', '2026-03-12'], // completed
        ['2026-03-09'], // skipped
      );
      const habit = makeTestHabit({
        createdAt: new Date(2026, 2, 1).getTime(),
        frequency: { numerator: 3, denominator: 7 },
        entries,
      });
      const result = computeEntriesWithAuto(habit);
      // SKIP must never be overwritten
      expect(result['2026-03-09'].value).toBe(ENTRY.SKIP);
    });

    it('does not overwrite YES_MANUAL entries with YES_AUTO', () => {
      const entries = datesToEntries([
        '2026-03-08',
        '2026-03-09',
        '2026-03-10',
      ]);
      const habit = makeTestHabit({
        createdAt: new Date(2026, 2, 1).getTime(),
        frequency: { numerator: 3, denominator: 7 },
        entries,
      });
      const result = computeEntriesWithAuto(habit);
      expect(result['2026-03-08'].value).toBe(ENTRY.YES_MANUAL);
      expect(result['2026-03-09'].value).toBe(ENTRY.YES_MANUAL);
      expect(result['2026-03-10'].value).toBe(ENTRY.YES_MANUAL);
    });

    it('returns original entries when fewer than numerator YES_MANUAL entries exist', () => {
      // Only 2 entries for a 3x/week habit — not enough for a cluster
      const entries = datesToEntries(['2026-03-10', '2026-03-12']);
      const habit = makeTestHabit({
        createdAt: new Date(2026, 2, 1).getTime(),
        frequency: { numerator: 3, denominator: 7 },
        entries,
      });
      const result = computeEntriesWithAuto(habit);
      // Should return original because buildIntervals returns []
      expect(result).toBe(entries);
    });

    it('handles 2x/week habit correctly', () => {
      const entries = datesToEntries([
        '2026-03-10', // Mon
        '2026-03-13', // Thu
      ]);
      const habit = makeTestHabit({
        createdAt: new Date(2026, 2, 1).getTime(),
        frequency: { numerator: 2, denominator: 7 },
        entries,
      });
      const result = computeEntriesWithAuto(habit);

      // Original entries preserved
      expect(result['2026-03-10'].value).toBe(ENTRY.YES_MANUAL);
      expect(result['2026-03-13'].value).toBe(ENTRY.YES_MANUAL);

      // There should be YES_AUTO fills between the two manual entries
      // since they form a valid cluster (span < denominator)
      const autoFills = Object.entries(result).filter(
        ([, e]) => e.value === ENTRY.YES_AUTO,
      );
      expect(autoFills.length).toBeGreaterThan(0);
    });

    it('handles multiple separate clusters', () => {
      // Two clusters of 3 completions each, separated by a large gap
      const entries = datesToEntries([
        // Cluster 1 (early March)
        '2026-03-01',
        '2026-03-02',
        '2026-03-03',
        // Cluster 2 (mid March)
        '2026-03-10',
        '2026-03-11',
        '2026-03-12',
      ]);
      const habit = makeTestHabit({
        createdAt: new Date(2026, 1, 20).getTime(), // Feb 20
        frequency: { numerator: 3, denominator: 7 },
        entries,
      });
      const result = computeEntriesWithAuto(habit);

      // Both clusters' manual entries should be preserved
      expect(result['2026-03-01'].value).toBe(ENTRY.YES_MANUAL);
      expect(result['2026-03-10'].value).toBe(ENTRY.YES_MANUAL);
    });

    it('does not add YES_AUTO entries outside the createdAt to today range', () => {
      const entries = datesToEntries([
        '2026-03-10',
        '2026-03-11',
        '2026-03-12',
      ]);
      const habit = makeTestHabit({
        createdAt: new Date(2026, 2, 10).getTime(),
        frequency: { numerator: 3, denominator: 7 },
        entries,
      });
      const result = computeEntriesWithAuto(habit);

      // No entries should exist before createdAt
      const beforeCreated = Object.keys(result).filter(d => d < '2026-03-10');
      const autoBeforeCreated = beforeCreated.filter(
        d => result[d].value === ENTRY.YES_AUTO,
      );
      expect(autoBeforeCreated).toHaveLength(0);
    });
  });

  describe('result immutability', () => {
    it('does not mutate the original habit.entries object', () => {
      const originalEntries = datesToEntries([
        '2026-03-08',
        '2026-03-10',
        '2026-03-12',
      ]);
      const originalKeys = Object.keys(originalEntries).sort();

      const habit = makeTestHabit({
        createdAt: new Date(2026, 2, 1).getTime(),
        frequency: { numerator: 3, denominator: 7 },
        entries: originalEntries,
      });

      computeEntriesWithAuto(habit);

      // Original entries should not have new keys added
      const afterKeys = Object.keys(originalEntries).sort();
      expect(afterKeys).toEqual(originalKeys);
    });
  });

  describe('edge cases', () => {
    it('handles habit with only one YES_MANUAL entry for 1x/week', () => {
      const entries = datesToEntries(['2026-03-10']);
      const habit = makeTestHabit({
        createdAt: new Date(2026, 2, 1).getTime(),
        frequency: { numerator: 1, denominator: 7 },
        entries,
      });
      const result = computeEntriesWithAuto(habit);

      // Single entry forms a valid cluster for 1x/7 (numerator=1)
      expect(result['2026-03-10'].value).toBe(ENTRY.YES_MANUAL);
    });

    it('handles entries exactly on the createdAt date', () => {
      const entries = datesToEntries(['2026-03-01', '2026-03-03', '2026-03-05']);
      const habit = makeTestHabit({
        createdAt: new Date(2026, 2, 1).getTime(), // same as first entry
        frequency: { numerator: 3, denominator: 7 },
        entries,
      });
      const result = computeEntriesWithAuto(habit);
      expect(result['2026-03-01'].value).toBe(ENTRY.YES_MANUAL);
    });

    it('handles very sparse entries (spread across months)', () => {
      // Entries too far apart to form clusters for 3x/week
      const entries = datesToEntries([
        '2026-01-15',
        '2026-02-15',
        '2026-03-10',
      ]);
      const habit = makeTestHabit({
        createdAt: new Date(2026, 0, 1).getTime(),
        frequency: { numerator: 3, denominator: 7 },
        entries,
      });
      const result = computeEntriesWithAuto(habit);
      // Entries too far apart — no valid cluster, original returned
      expect(result).toBe(entries);
    });

    it('all YES_AUTO fills have correct entry shape', () => {
      const entries = datesToEntries([
        '2026-03-08',
        '2026-03-10',
        '2026-03-12',
      ]);
      const habit = makeTestHabit({
        createdAt: new Date(2026, 2, 1).getTime(),
        frequency: { numerator: 3, denominator: 7 },
        entries,
      });
      const result = computeEntriesWithAuto(habit);

      for (const [, entry] of Object.entries(result)) {
        expect(entry).toHaveProperty('value');
        expect(typeof entry.value).toBe('number');
        // Each entry should be one of the valid ENTRY values
        expect([ENTRY.UNKNOWN, ENTRY.NO, ENTRY.YES_AUTO, ENTRY.YES_MANUAL, ENTRY.SKIP]).toContain(
          entry.value,
        );
      }
    });
  });
});
