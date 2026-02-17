import { Habit } from '@/types';
import { formatDate, calculateStreak } from '@/lib/utils';

/**
 * Calculate habit streak (consecutive days, custom-day aware).
 * Pure function — no side effects.
 */
export function getHabitStreak(habit: Habit): number {
  if (!habit.completedDates || habit.completedDates.length === 0) return 0;

  if (!habit.customDays || habit.frequency !== 'custom') {
    return calculateStreak(habit.completedDates);
  }

  const completedSet = new Set(habit.completedDates);
  let streak = 0;
  const checkDate = new Date();
  for (let daysBack = 0; daysBack < 365; daysBack++) {
    const dateStr = formatDate(checkDate);
    const dow = checkDate.getDay();
    if (habit.customDays.includes(dow)) {
      if (completedSet.has(dateStr)) {
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
