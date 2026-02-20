/**
 * Identity Cluster computation (IA Blueprint Phase 2)
 *
 * Groups habits by user-defined identity clusters and computes
 * alignment percentages. Pure functions — no React dependency.
 */

import type { Habit } from '@/types';
import { getToday } from './utils';

export interface IdentityCluster {
  name: string;
  icon: string;
  verb: string; // "I am a meditator"
  habits: Habit[];
  completedToday: number;
  totalToday: number;
  alignmentPercent: number; // 0-100
  weeklyAlignmentPercent: number; // 0-100 average over last 7 days
}

/** Get the last N dates as YYYY-MM-DD strings */
function getLastNDates(n: number): string[] {
  const dates: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

/**
 * Groups habits by `identityCluster` and computes daily + weekly alignment.
 * Habits without a cluster are grouped under "Uncategorized".
 */
export function computeIdentityClusters(habits: Habit[]): IdentityCluster[] {
  const today = getToday();
  const last7Days = getLastNDates(7);

  // Group habits by cluster
  const clusterMap = new Map<string, Habit[]>();
  for (const habit of habits) {
    const key = habit.identityCluster || '';
    const existing = clusterMap.get(key);
    if (existing) { existing.push(habit); }
    else { clusterMap.set(key, [habit]); }
  }

  const clusters: IdentityCluster[] = [];

  for (const [clusterName, clusterHabits] of clusterMap) {
    // Skip uncategorized cluster in the identity view
    if (!clusterName) continue;

    const completedToday = clusterHabits.filter(h =>
      h.completedDates?.includes(today)
    ).length;

    const totalToday = clusterHabits.length;
    const alignmentPercent = totalToday > 0
      ? Math.round((completedToday / totalToday) * 100)
      : 0;

    // Weekly alignment: average of daily alignment over 7 days
    let weeklyTotal = 0;
    for (const date of last7Days) {
      const completed = clusterHabits.filter(h =>
        h.completedDates?.includes(date)
      ).length;
      weeklyTotal += totalToday > 0 ? completed / totalToday : 0;
    }
    const weeklyAlignmentPercent = Math.round((weeklyTotal / 7) * 100);

    // Use the first habit's identity metadata or defaults
    const firstWithMeta = clusterHabits.find(h => h.identityVerb);

    clusters.push({
      name: clusterName,
      icon: firstWithMeta?.identityIcon || 'Target',
      verb: firstWithMeta?.identityVerb || `I am ${clusterName}`,
      habits: clusterHabits,
      completedToday,
      totalToday,
      alignmentPercent,
      weeklyAlignmentPercent,
    });
  }

  // Sort by weekly alignment descending (most aligned first)
  return clusters.sort((a, b) => b.weeklyAlignmentPercent - a.weeklyAlignmentPercent);
}

/**
 * Computes the overall identity alignment for today (all clusters averaged).
 * Returns 0-100.
 */
export function computeOverallAlignment(habits: Habit[]): number {
  const clustered = habits.filter(h => h.identityCluster);
  if (clustered.length === 0) return 0;

  const today = getToday();
  const completed = clustered.filter(h => h.completedDates?.includes(today)).length;
  return Math.round((completed / clustered.length) * 100);
}
