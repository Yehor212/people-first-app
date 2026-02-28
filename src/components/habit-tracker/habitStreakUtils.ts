import { Habit } from '@/types';
import { formatDate, calculateStreak } from '@/lib/utils';

/**
 * Calculate habit streak (consecutive days, custom-day aware).
 * Skipped dates (intentional pauses) do NOT break the streak.
 * Pure function — no side effects.
 */
export function getHabitStreak(habit: Habit): number {
  if (!habit.completedDates || habit.completedDates.length === 0) return 0;

  const skippedSet = new Set(habit.skippedDates || []);

  if (!habit.customDays || habit.frequency !== 'custom') {
    // For non-custom frequency, use calculateStreak but skip over skipped dates
    if (skippedSet.size === 0) return calculateStreak(habit.completedDates);

    // Walk backwards from today, skipping over skippedDates
    const completedSet = new Set(habit.completedDates);
    let streak = 0;
    const checkDate = new Date();
    for (let daysBack = 0; daysBack < 365; daysBack++) {
      const dateStr = formatDate(checkDate);
      if (skippedSet.has(dateStr)) {
        // Skipped — neutral, continue without breaking
      } else if (completedSet.has(dateStr)) {
        streak++;
      } else if (daysBack === 0) {
        // Today not yet done — grace period
      } else {
        break;
      }
      checkDate.setDate(checkDate.getDate() - 1);
    }
    return streak;
  }

  const completedSet = new Set(habit.completedDates);
  let streak = 0;
  const checkDate = new Date();
  for (let daysBack = 0; daysBack < 365; daysBack++) {
    const dateStr = formatDate(checkDate);
    const dow = checkDate.getDay();
    if (habit.customDays.includes(dow)) {
      if (skippedSet.has(dateStr)) {
        // Skipped — neutral, don't break
      } else if (completedSet.has(dateStr)) {
        streak++;
      } else if (daysBack === 0) {
        // Today is scheduled but not yet done — grace period
      } else {
        break;
      }
    }
    checkDate.setDate(checkDate.getDate() - 1);
  }
  return streak;
}
