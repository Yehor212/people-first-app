/**
 * habitStreakUtils.ts — Streak calculation using entry-based model.
 * Delegates to habitScore.getCurrentStreak() for Loop-exact computation.
 */

import type { Habit } from '@/types';
import { getCurrentStreak } from '@/lib/habitScore';

/**
 * Calculate habit streak using Loop-exact algorithm.
 * In Loop: YES_MANUAL, YES_AUTO, and SKIP all extend streak (value > 0).
 */
export function getHabitStreak(habit: Habit): number {
  return getCurrentStreak(habit);
}
