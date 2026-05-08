import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Habit } from '@/types';
import { makeTestHabit, datesToEntries } from '@/test/habitFixtures';

// ============================================
// MOCKS — must come before the module import
// ============================================

vi.mock('@/lib/utils', () => ({
  getToday: vi.fn(() => '2026-02-19'),
  formatDate: vi.fn((d: Date) => d.toISOString().split('T')[0]),
  parseLocalDate: vi.fn((s: string) => new Date(s)),
}));

import {
  computeIdentityClusters,
  computeOverallAlignment,
  UNCATEGORIZED_CLUSTER_ID,
} from '../identityClusters';

// ============================================
// HELPERS
// ============================================

const TODAY = '2026-02-19';

/** Build a minimal Habit fixture. */
function makeHabit(
  id: string,
  name: string,
  opts: {
    completedDates?: string[];
    identityCluster?: string;
    identityVerb?: string;
    identityIcon?: string;
  } = {}
): Habit {
  return makeTestHabit({
    id,
    name,
    icon: '⭐',
    entries: datesToEntries(opts.completedDates ?? []),
    identityCluster: opts.identityCluster,
    identityVerb: opts.identityVerb,
    identityIcon: opts.identityIcon,
  });
}

// ============================================
// computeIdentityClusters
// ============================================

describe('computeIdentityClusters', () => {
  // Freeze time so getLastNDates inside the module is deterministic.
  // 2026-02-19 is our "today", so the last 7 days are 2026-02-13 … 2026-02-19.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-19T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ──────────────────────────────────────────
  // 1. Uncategorized habits go into sentinel fallback cluster
  // ──────────────────────────────────────────
  it('groups uncategorized habits into sentinel fallback cluster', () => {
    const habits = [
      makeHabit('h1', 'Drink water'),
      makeHabit('h2', 'Read'),
    ];
    const result = computeIdentityClusters(habits);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe(UNCATEGORIZED_CLUSTER_ID);
    expect(result[0].icon).toBe('Sparkles');
    expect(result[0].verb).toBe(UNCATEGORIZED_CLUSTER_ID);
    expect(result[0].habits).toHaveLength(2);
  });

  it('returns empty array for an empty habits list', () => {
    const result = computeIdentityClusters([]);
    expect(result).toEqual([]);
  });

  it('groups empty-string identityCluster into sentinel fallback cluster', () => {
    const habits = [
      makeHabit('h1', 'Drink water', { identityCluster: '' }),
    ];
    const result = computeIdentityClusters(habits);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe(UNCATEGORIZED_CLUSTER_ID);
  });

  // ──────────────────────────────────────────
  // 2. Groups habits by cluster name correctly
  // ──────────────────────────────────────────
  it('groups habits that share an identityCluster together', () => {
    const habits = [
      makeHabit('h1', 'Meditate', { identityCluster: 'Mindful Me' }),
      makeHabit('h2', 'Breathe',  { identityCluster: 'Mindful Me' }),
      makeHabit('h3', 'Run',      { identityCluster: 'Athlete' }),
    ];
    const result = computeIdentityClusters(habits);
    expect(result).toHaveLength(2);

    const mindful = result.find(c => c.name === 'Mindful Me');
    expect(mindful).toBeDefined();
    expect(mindful?.habits).toHaveLength(2);
    expect(mindful?.habits.map(h => h.id)).toEqual(expect.arrayContaining(['h1', 'h2']));

    const athlete = result.find(c => c.name === 'Athlete');
    expect(athlete).toBeDefined();
    expect(athlete?.habits).toHaveLength(1);
    expect(athlete?.habits[0].id).toBe('h3');
  });

  it('creates a separate cluster entry per unique cluster name', () => {
    const habits = [
      makeHabit('h1', 'A', { identityCluster: 'Alpha' }),
      makeHabit('h2', 'B', { identityCluster: 'Beta' }),
      makeHabit('h3', 'C', { identityCluster: 'Gamma' }),
    ];
    const result = computeIdentityClusters(habits);
    expect(result).toHaveLength(3);
  });

  // ──────────────────────────────────────────
  // 3. Computes daily alignment percent (completed / total)
  // ──────────────────────────────────────────
  it('computes 0% daily alignment when no habit is completed today', () => {
    const habits = [
      makeHabit('h1', 'Meditate', { identityCluster: 'Mindful Me', completedDates: [] }),
      makeHabit('h2', 'Breathe',  { identityCluster: 'Mindful Me', completedDates: [] }),
    ];
    const result = computeIdentityClusters(habits);
    expect(result[0].alignmentPercent).toBe(0);
    expect(result[0].completedToday).toBe(0);
    expect(result[0].totalToday).toBe(2);
  });

  it('computes 50% daily alignment when half the cluster is done today', () => {
    const habits = [
      makeHabit('h1', 'Meditate', { identityCluster: 'Mindful Me', completedDates: [TODAY] }),
      makeHabit('h2', 'Breathe',  { identityCluster: 'Mindful Me', completedDates: [] }),
    ];
    const result = computeIdentityClusters(habits);
    expect(result[0].completedToday).toBe(1);
    expect(result[0].totalToday).toBe(2);
    expect(result[0].alignmentPercent).toBe(50);
  });

  it('computes 100% daily alignment when every cluster habit is done today', () => {
    const habits = [
      makeHabit('h1', 'Meditate', { identityCluster: 'Mindful Me', completedDates: [TODAY] }),
      makeHabit('h2', 'Breathe',  { identityCluster: 'Mindful Me', completedDates: [TODAY] }),
    ];
    const result = computeIdentityClusters(habits);
    expect(result[0].alignmentPercent).toBe(100);
  });

  it('rounds daily alignment to the nearest integer', () => {
    // 1 out of 3 = 33.33... → rounds to 33
    const habits = [
      makeHabit('h1', 'A', { identityCluster: 'X', completedDates: [TODAY] }),
      makeHabit('h2', 'B', { identityCluster: 'X', completedDates: [] }),
      makeHabit('h3', 'C', { identityCluster: 'X', completedDates: [] }),
    ];
    const result = computeIdentityClusters(habits);
    expect(result[0].alignmentPercent).toBe(33);
  });

  // ──────────────────────────────────────────
  // 4. Computes weekly alignment percent (average over 7 days)
  // ──────────────────────────────────────────
  it('computes 0% weekly alignment when no completions in last 7 days', () => {
    const habits = [
      makeHabit('h1', 'Meditate', { identityCluster: 'Mindful Me', completedDates: ['2026-01-01'] }),
    ];
    const result = computeIdentityClusters(habits);
    expect(result[0].weeklyAlignmentPercent).toBe(0);
  });

  it('computes 100% weekly alignment when habit done every day of last 7 days', () => {
    // last 7 days: 2026-02-13 through 2026-02-19
    const last7 = ['2026-02-13', '2026-02-14', '2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19'];
    const habits = [
      makeHabit('h1', 'Meditate', { identityCluster: 'Mindful Me', completedDates: last7 }),
    ];
    const result = computeIdentityClusters(habits);
    expect(result[0].weeklyAlignmentPercent).toBe(100);
  });

  it('computes ~43% weekly alignment when habit done 3 of last 7 days', () => {
    // 3/7 ≈ 0.4286 → Math.round(3/7 * 100) = 43
    const habits = [
      makeHabit('h1', 'Meditate', {
        identityCluster: 'Mindful Me',
        completedDates: ['2026-02-13', '2026-02-14', '2026-02-15'],
      }),
    ];
    const result = computeIdentityClusters(habits);
    expect(result[0].weeklyAlignmentPercent).toBe(43);
  });

  it('averages per-day ratios over 7 days when there are multiple habits in a cluster', () => {
    // 2 habits: h1 done all 7 days, h2 done 0 days → per-day ratio is 0.5 every day → weekly = 50
    const last7 = ['2026-02-13', '2026-02-14', '2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19'];
    const habits = [
      makeHabit('h1', 'A', { identityCluster: 'X', completedDates: last7 }),
      makeHabit('h2', 'B', { identityCluster: 'X', completedDates: [] }),
    ];
    const result = computeIdentityClusters(habits);
    expect(result[0].weeklyAlignmentPercent).toBe(50);
  });

  // ──────────────────────────────────────────
  // 5. Sorts clusters by weekly alignment descending
  // ──────────────────────────────────────────
  it('sorts clusters so the highest weekly alignment comes first', () => {
    const last7 = ['2026-02-13', '2026-02-14', '2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19'];
    const habits = [
      // "Athlete" cluster: 0 completions → 0% weekly
      makeHabit('h1', 'Run', { identityCluster: 'Athlete', completedDates: [] }),
      // "Mindful Me" cluster: all 7 days → 100% weekly
      makeHabit('h2', 'Meditate', { identityCluster: 'Mindful Me', completedDates: last7 }),
      // "Scholar" cluster: 3 days → ~43% weekly
      makeHabit('h3', 'Read', {
        identityCluster: 'Scholar',
        completedDates: ['2026-02-13', '2026-02-14', '2026-02-15'],
      }),
    ];
    const result = computeIdentityClusters(habits);
    expect(result[0].name).toBe('Mindful Me');
    expect(result[1].name).toBe('Scholar');
    expect(result[2].name).toBe('Athlete');
  });

  it('does not blow up when all clusters share the same weekly alignment', () => {
    const habits = [
      makeHabit('h1', 'A', { identityCluster: 'Alpha', completedDates: [] }),
      makeHabit('h2', 'B', { identityCluster: 'Beta',  completedDates: [] }),
    ];
    const result = computeIdentityClusters(habits);
    expect(result).toHaveLength(2);
    // Both 0%, order is stable (either way is fine — just check no error)
    expect(result.every(c => c.weeklyAlignmentPercent === 0)).toBe(true);
  });

  // ──────────────────────────────────────────
  // 6. Uses first habit's identityVerb / identityIcon for cluster metadata
  // ──────────────────────────────────────────
  it('uses identityVerb and identityIcon from the first habit that has them', () => {
    const habits = [
      makeHabit('h1', 'Breathe', {
        identityCluster: 'Mindful Me',
        identityVerb: 'I am a meditator',
        identityIcon: '🧘',
      }),
      makeHabit('h2', 'Meditate', {
        identityCluster: 'Mindful Me',
        identityVerb: 'I am calm',
        identityIcon: '🌿',
      }),
    ];
    const result = computeIdentityClusters(habits);
    // First habit with a verb is h1
    expect(result[0].verb).toBe('I am a meditator');
    expect(result[0].icon).toBe('🧘');
  });

  it('falls back to a generated verb when no habit has identityVerb', () => {
    const habits = [
      makeHabit('h1', 'Run', { identityCluster: 'Athlete' }),
    ];
    const result = computeIdentityClusters(habits);
    expect(result[0].verb).toBe('I am Athlete');
  });

  it('falls back to the default Target icon when no habit has identityIcon', () => {
    const habits = [
      makeHabit('h1', 'Run', { identityCluster: 'Athlete' }),
    ];
    const result = computeIdentityClusters(habits);
    expect(result[0].icon).toBe('Target');
  });

  it('uses the habit emoji when an identity has no separate identityIcon', () => {
    const habits = [
      makeHabit('h1', 'Run', {
        identityCluster: 'Athlete',
        identityVerb: 'someone who moves daily',
      }),
    ];
    const result = computeIdentityClusters(habits);
    expect(result[0].icon).toBe('⭐');
  });

  it('skips habits without identityVerb to find the first one that does have it', () => {
    const habits = [
      // h1 has no verb
      makeHabit('h1', 'Breathe', { identityCluster: 'Mindful Me' }),
      // h2 has a verb — should be used
      makeHabit('h2', 'Meditate', {
        identityCluster: 'Mindful Me',
        identityVerb: 'I am present',
        identityIcon: '🕯️',
      }),
    ];
    const result = computeIdentityClusters(habits);
    expect(result[0].verb).toBe('I am present');
    expect(result[0].icon).toBe('🕯️');
  });

  // ──────────────────────────────────────────
  // Extra: uncategorized habits go into separate fallback cluster
  // ──────────────────────────────────────────
  it('puts uncategorized habits into sentinel cluster separate from named clusters', () => {
    const habits = [
      makeHabit('h1', 'Meditate', { identityCluster: 'Mindful Me' }),
      makeHabit('h2', 'Drink water'),   // no cluster → sentinel
    ];
    const result = computeIdentityClusters(habits);
    expect(result).toHaveLength(2);
    const named = result.find(c => c.name === 'Mindful Me');
    expect(named).toBeDefined();
    expect(named?.habits.some(h => h.id === 'h2')).toBe(false);
    const fallback = result.find(c => c.name === UNCATEGORIZED_CLUSTER_ID);
    expect(fallback).toBeDefined();
    expect(fallback?.habits[0].id).toBe('h2');
  });
});

// ============================================
// computeOverallAlignment
// ============================================

describe('computeOverallAlignment', () => {
  // ──────────────────────────────────────────
  // 7. Returns 0 when no clustered habits
  // ──────────────────────────────────────────
  it('returns 0 when the habits list is empty', () => {
    expect(computeOverallAlignment([])).toBe(0);
  });

  it('returns 0 when no habit has an identityCluster', () => {
    const habits = [
      makeHabit('h1', 'Drink water'),
      makeHabit('h2', 'Sleep early'),
    ];
    expect(computeOverallAlignment(habits)).toBe(0);
  });

  it('returns 0 when clustered habits exist but none completed today', () => {
    const habits = [
      makeHabit('h1', 'Meditate', { identityCluster: 'Mindful Me', completedDates: [] }),
      makeHabit('h2', 'Breathe',  { identityCluster: 'Mindful Me', completedDates: ['2026-01-01'] }),
    ];
    expect(computeOverallAlignment(habits)).toBe(0);
  });

  // ──────────────────────────────────────────
  // 8. Computes correctly for mixed completion
  // ──────────────────────────────────────────
  it('returns 100 when every clustered habit is completed today', () => {
    const habits = [
      makeHabit('h1', 'Meditate', { identityCluster: 'Mindful Me', completedDates: [TODAY] }),
      makeHabit('h2', 'Breathe',  { identityCluster: 'Athlete',    completedDates: [TODAY] }),
    ];
    expect(computeOverallAlignment(habits)).toBe(100);
  });

  it('returns 50 when half of clustered habits are completed today', () => {
    const habits = [
      makeHabit('h1', 'Meditate', { identityCluster: 'Mindful Me', completedDates: [TODAY] }),
      makeHabit('h2', 'Breathe',  { identityCluster: 'Mindful Me', completedDates: [] }),
    ];
    expect(computeOverallAlignment(habits)).toBe(50);
  });

  it('ignores unclustered habits when computing overall alignment', () => {
    const habits = [
      // clustered, done today
      makeHabit('h1', 'Meditate', { identityCluster: 'Mindful Me', completedDates: [TODAY] }),
      // no cluster — must not affect the percentage
      makeHabit('h2', 'Drink water', { completedDates: [] }),
      makeHabit('h3', 'Read',        { completedDates: [] }),
    ];
    // Only h1 is clustered and completed → 1/1 = 100%
    expect(computeOverallAlignment(habits)).toBe(100);
  });

  it('returns 33 when 1 of 3 clustered habits is completed today', () => {
    const habits = [
      makeHabit('h1', 'A', { identityCluster: 'X', completedDates: [TODAY] }),
      makeHabit('h2', 'B', { identityCluster: 'X', completedDates: [] }),
      makeHabit('h3', 'C', { identityCluster: 'X', completedDates: [] }),
    ];
    expect(computeOverallAlignment(habits)).toBe(33);
  });

  it('counts completions across multiple different clusters', () => {
    const habits = [
      // cluster A: 1 done, 1 not
      makeHabit('h1', 'Meditate', { identityCluster: 'A', completedDates: [TODAY] }),
      makeHabit('h2', 'Breathe',  { identityCluster: 'A', completedDates: [] }),
      // cluster B: 1 done, 1 not
      makeHabit('h3', 'Run',   { identityCluster: 'B', completedDates: [TODAY] }),
      makeHabit('h4', 'Cycle', { identityCluster: 'B', completedDates: [] }),
    ];
    // 2 completed out of 4 clustered total = 50%
    expect(computeOverallAlignment(habits)).toBe(50);
  });

  it('rounds the result to the nearest integer', () => {
    // 2 out of 3 = 66.67 → rounds to 67
    const habits = [
      makeHabit('h1', 'A', { identityCluster: 'X', completedDates: [TODAY] }),
      makeHabit('h2', 'B', { identityCluster: 'X', completedDates: [TODAY] }),
      makeHabit('h3', 'C', { identityCluster: 'X', completedDates: [] }),
    ];
    expect(computeOverallAlignment(habits)).toBe(67);
  });
});
