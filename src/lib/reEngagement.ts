/**
 * Re-engagement Logic
 *
 * Detects when users return after 3+ days and triggers welcome back experience.
 * Helps with user retention by making comebacks feel positive.
 */

import { Habit } from '@/types';
import { logger } from '@/lib/logger';
import { getToday } from '@/lib/utils';

const LAST_ACTIVE_KEY = 'zenflow_last_active_date';
const WELCOME_BACK_SHOWN_KEY = 'zenflow_welcome_back_shown';
const ABSENCE_THRESHOLD_DAYS = 3;

/**
 * Update last active date to today
 */
export function updateLastActiveDate(): void {
  const today = getToday();
  localStorage.setItem(LAST_ACTIVE_KEY, today);
}

/**
 * Get last active date
 */
export function getLastActiveDate(): string | null {
  return localStorage.getItem(LAST_ACTIVE_KEY);
}

/**
 * Calculate days since last active
 */
export function getDaysSinceLastActive(): number {
  const lastActive = getLastActiveDate();
  if (!lastActive) return 0;

  const today = new Date(getToday());
  const lastActiveDate = new Date(lastActive);
  const diffTime = Math.abs(today.getTime() - lastActiveDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Check if user should see welcome back modal
 */
export function shouldShowWelcomeBack(): boolean {
  const daysAway = getDaysSinceLastActive();

  // Not absent long enough
  if (daysAway < ABSENCE_THRESHOLD_DAYS) {
    return false;
  }

  // Already shown welcome back for this return
  const lastShown = localStorage.getItem(WELCOME_BACK_SHOWN_KEY);
  const lastActive = getLastActiveDate();

  if (lastShown === lastActive) {
    return false; // Already shown for this absence period
  }

  logger.log(`[ReEngagement] User away for ${daysAway} days - showing welcome back`);
  return true;
}

/**
 * Mark welcome back modal as shown
 */
export function markWelcomeBackShown(): void {
  const lastActive = getLastActiveDate();
  if (lastActive) {
    localStorage.setItem(WELCOME_BACK_SHOWN_KEY, lastActive);
  }
  updateLastActiveDate();
}

/**
 * Calculate habit success rates
 */
export function calculateHabitSuccessRates(habits: Habit[]): Array<{ habit: Habit; successRate: number }> {
  const today = getToday();
  const results = habits.map(habit => {
    const totalDaysSinceCreation = Math.ceil(
      (new Date(today).getTime() - habit.createdAt) / (1000 * 60 * 60 * 24)
    );

    // Only consider last 30 days
    const daysToConsider = Math.min(totalDaysSinceCreation, 30);

    if (daysToConsider === 0) {
      return { habit, successRate: 0 };
    }

    const completedDays = habit.completedDates?.length || 0;
    const successRate = (completedDays / daysToConsider) * 100;

    return { habit, successRate };
  });

  // Sort by success rate descending
  return results.sort((a, b) => b.successRate - a.successRate);
}

/**
 * Check if streak was broken during absence
 */
export function wasStreakBroken(
  currentStreak: number,
  daysAway: number,
  restDays: string[]
): boolean {
  // If current streak is 0 and user was away 3+ days, streak was likely broken
  if (currentStreak === 0 && daysAway >= ABSENCE_THRESHOLD_DAYS) {
    return true;
  }

  // Check if any of the days away were rest days (streak protection)
  const lastActive = getLastActiveDate();
  if (!lastActive) return false;

  const today = getToday();
  const lastActiveDate = new Date(lastActive);
  const todayDate = new Date(today);

  // Check each day in absence period
  for (let i = 1; i < daysAway; i++) {
    const checkDate = new Date(lastActiveDate);
    checkDate.setDate(checkDate.getDate() + i);
    const dateStr = checkDate.toISOString().split('T')[0];

    // If any day is a rest day, streak might be protected
    if (restDays.includes(dateStr)) {
      return false;
    }
  }

  // If streak survived the absence, it wasn't broken
  return currentStreak === 0;
}
