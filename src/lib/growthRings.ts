/**
 * Growth Rings model (IA Blueprint Phase 2.3)
 *
 * Replaces streak anxiety with a never-resetting growth visualization.
 * A tree doesn't lose its rings when it has a dry season —
 * the rings just get thinner. Growth is permanent.
 *
 * Pure functions — no React dependency.
 */

export interface GrowthRing {
  date: string; // YYYY-MM-DD
  type: 'active' | 'rest' | 'gap';
  density: number; // 0-1, how "thick" the ring is (activity intensity)
}

export interface GrowthRingsData {
  rings: GrowthRing[];
  totalActiveDays: number; // Never resets
  totalRestDays: number;
  currentStreak: number; // For internal gamification math
  longestStreak: number;
}

/** Get all dates between two dates (inclusive) */
function getDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start);
  const endDate = new Date(end);
  while (current <= endDate) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/**
 * Computes growth rings from raw activity data.
 *
 * @param activeDates - All dates where user was active (mood logged, habit done, etc.)
 * @param restDates - Dates where rest mode was activated
 * @param since - First date to include (usually first app usage date)
 */
export function computeGrowthRings(
  activeDates: string[],
  restDates: string[],
  since: string,
): GrowthRingsData {
  const today = new Date().toISOString().split('T')[0];
  const allDates = getDateRange(since, today);

  const activeSet = new Set(activeDates);
  const restSet = new Set(restDates);

  const rings: GrowthRing[] = [];
  let currentStreak = 0;
  let longestStreak = 0;
  let totalActiveDays = 0;
  let totalRestDays = 0;

  for (const date of allDates) {
    if (activeSet.has(date)) {
      totalActiveDays++;
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
      rings.push({ date, type: 'active', density: 1 });
    } else if (restSet.has(date)) {
      totalRestDays++;
      // Rest days don't break streak — they count as intentional
      rings.push({ date, type: 'rest', density: 0.5 });
    } else {
      // Gap day — thinner ring, never erased
      currentStreak = 0;
      rings.push({ date, type: 'gap', density: 0.2 });
    }
  }

  return {
    rings,
    totalActiveDays,
    totalRestDays,
    currentStreak,
    longestStreak,
  };
}

/**
 * Summary text for growth rings (guilt-free language).
 * Examples:
 *   "42 rings of growth" (not "42-day streak")
 *   "You grew for 6 days and rested for 1. Perfect balance."
 */
export function getGrowthRingsSummary(data: GrowthRingsData): {
  totalRings: string;
  weekSummary: string;
} {
  const total = data.totalActiveDays + data.totalRestDays;
  const totalRings = `${total} rings of growth`;

  // Last 7 days summary
  const last7 = data.rings.slice(-7);
  const activeLast7 = last7.filter(r => r.type === 'active').length;
  const restLast7 = last7.filter(r => r.type === 'rest').length;

  let weekSummary: string;
  if (restLast7 > 0) {
    weekSummary = `You grew for ${activeLast7} days and rested for ${restLast7}. Perfect balance.`;
  } else if (activeLast7 === 7) {
    weekSummary = `A full week of growth!`;
  } else {
    weekSummary = `${activeLast7} days of growth this week.`;
  }

  return { totalRings, weekSummary };
}
