/**
 * habitComputedEntries.ts — Loop-exact YES_AUTO interval algorithm.
 *
 * For non-daily boolean habits, Loop auto-fills YES_AUTO entries
 * between YES_MANUAL entries when the frequency is satisfied.
 * This creates continuous "green" runs in the heatmap for habits
 * like "3x/week".
 *
 * Algorithm from iSoron/uhabits EntryList.kt:
 * 1. buildIntervals — find clusters of YES_MANUAL within frequency windows
 * 2. snapIntervalsTogether — slide intervals to eliminate gaps
 * 3. buildEntriesFromIntervals — fill gaps with YES_AUTO
 *
 * Pure functions — no side effects, no React dependencies.
 * Computed entries are NEVER stored — derived on-the-fly for display.
 */

import { ENTRY } from '@/types';
import type { Habit, HabitEntry } from '@/types';

// ─── Date helpers ────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function daysBetween(a: string, b: string): number {
  const da = parseDate(a);
  const db = parseDate(b);
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

// ─── Interval type ───────────────────────────────────────────────────────────

interface Interval {
  begin: string;  // YYYY-MM-DD (earliest day)
  end: string;    // YYYY-MM-DD (latest day)
  center: string; // YYYY-MM-DD (midpoint of YES_MANUAL cluster)
}

// ─── Step 1: Build intervals from YES_MANUAL clusters ────────────────────────

/**
 * Walk backward from today. For each position, look at a sliding window
 * of `denominator` days. If the window contains >= `numerator` YES_MANUAL
 * entries, create an interval spanning that window.
 */
function buildIntervals(
  entries: Record<string, HabitEntry>,
  numerator: number,
  denominator: number,
  createdAt: number,
): Interval[] {
  const today = new Date();
  const todayStr = toDateStr(today);
  const createdStr = toDateStr(new Date(createdAt));

  // Collect all YES_MANUAL dates sorted descending
  const manualDates: string[] = [];
  for (const [date, entry] of Object.entries(entries)) {
    if (entry.value === ENTRY.YES_MANUAL && date >= createdStr && date <= todayStr) {
      manualDates.push(date);
    }
  }
  manualDates.sort((a, b) => b.localeCompare(a)); // newest first

  if (manualDates.length < numerator) return [];

  const intervals: Interval[] = [];
  const usedDates = new Set<string>();

  // Walk through manual dates, grouping clusters of `numerator` entries
  // that fit within a `denominator`-day window
  let i = 0;
  while (i <= manualDates.length - numerator) {
    // Try to form a cluster starting at index i
    const clusterStart = manualDates[i]; // newest in cluster
    const clusterEnd = manualDates[i + numerator - 1]; // oldest in cluster
    const span = daysBetween(clusterEnd, clusterStart); // positive number

    if (span < denominator && !usedDates.has(clusterStart)) {
      // Valid cluster — create interval spanning the full denominator window
      // Center of the cluster for snapping
      const centerIdx = Math.floor(numerator / 2);
      const center = manualDates[i + centerIdx];

      // Interval spans `denominator` days centered around the cluster
      const begin = clusterEnd;
      const end = clusterStart;

      intervals.push({ begin, end, center });

      // Mark used
      for (let j = 0; j < numerator; j++) {
        usedDates.add(manualDates[i + j]);
      }
      i += numerator; // skip past this cluster
    } else {
      i++;
    }
  }

  return intervals;
}

// ─── Step 2: Snap intervals together ─────────────────────────────────────────

/**
 * Sort intervals by center date. When consecutive intervals have gaps,
 * extend them to fill the gap: expand the end of the earlier interval
 * or the begin of the later interval to close the gap.
 */
function snapIntervalsTogether(intervals: Interval[], denominator: number): Interval[] {
  if (intervals.length <= 1) return intervals;

  // Sort oldest first (by center)
  const sorted = [...intervals].sort((a, b) => a.center.localeCompare(b.center));

  const result: Interval[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = result[result.length - 1];
    const curr = sorted[i];

    const gap = daysBetween(prev.end, curr.begin);

    if (gap <= 0) {
      // Overlapping or adjacent — merge
      prev.end = prev.end > curr.end ? prev.end : curr.end;
    } else if (gap <= denominator) {
      // Small gap — extend to fill
      // Slide curr.begin backward to meet prev.end + 1
      const nextDay = toDateStr(addDays(parseDate(prev.end), 1));
      curr.begin = nextDay;
      result.push(curr);
    } else {
      // Large gap — keep separate
      result.push(curr);
    }
  }

  return result;
}

// ─── Step 3: Fill gaps with YES_AUTO ─────────────────────────────────────────

/**
 * For each date within an interval, if the original entry is UNKNOWN,
 * set it to YES_AUTO. SKIP, NO, and YES_MANUAL entries are never overwritten.
 */
function buildEntriesFromIntervals(
  original: Record<string, HabitEntry>,
  intervals: Interval[],
): Record<string, HabitEntry> {
  if (intervals.length === 0) return original;

  const result: Record<string, HabitEntry> = { ...original };

  for (const interval of intervals) {
    const start = parseDate(interval.begin);
    const end = parseDate(interval.end);
    const days = Math.round((end.getTime() - start.getTime()) / 86400000);

    for (let d = 0; d <= days; d++) {
      const dateStr = toDateStr(addDays(start, d));
      const existing = result[dateStr];

      // Only fill UNKNOWN gaps — never overwrite user entries
      if (!existing || existing.value === ENTRY.UNKNOWN) {
        result[dateStr] = { value: ENTRY.YES_AUTO };
      }
    }
  }

  return result;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Compute entries with YES_AUTO fills for display purposes.
 *
 * Returns a MERGED entries map: original entries + computed YES_AUTO fills.
 * Only applies to non-daily boolean habits. Daily habits and numerical
 * habits return the original entries unchanged.
 *
 * Score computation should use raw habit.entries, NOT this function.
 * This is a display-only transformation.
 */
export function computeEntriesWithAuto(habit: Habit): Record<string, HabitEntry> {
  // Short-circuit: daily habits don't need auto-fill
  const { numerator, denominator } = habit.frequency;
  if (numerator === denominator) return habit.entries;

  // Short-circuit: numerical habits don't use YES_AUTO
  if (habit.habitType !== 'boolean') return habit.entries;

  // Short-circuit: no entries at all
  if (!habit.entries || Object.keys(habit.entries).length === 0) return habit.entries;

  // Step 1: Find clusters of YES_MANUAL entries
  const intervals = buildIntervals(habit.entries, numerator, denominator, habit.createdAt);

  if (intervals.length === 0) return habit.entries;

  // Step 2: Snap intervals together to fill gaps
  const snapped = snapIntervalsTogether(intervals, denominator);

  // Step 3: Fill gaps with YES_AUTO
  return buildEntriesFromIntervals(habit.entries, snapped);
}
