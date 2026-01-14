import { Habit } from '@/types';

export function normalizeHabit(habit: Habit): Habit {
  return {
    ...habit,
    type: habit.type || 'daily',
    frequency: habit.frequency || 'daily',
    progressByDate: habit.progressByDate || {},
    completedDates: habit.completedDates || [],
    reminders: habit.reminders || []
  };
}

export function getHabitCompletedDates(habit: Habit): string[] {
  const normalized = normalizeHabit(habit);
  
  if (normalized.type === 'reduce') {
    // For reduce habits, return dates with 0 progress
    return Object.entries(normalized.progressByDate || {})
      .filter(([_, value]) => value === 0)
      .map(([date]) => date);
  }
  
  return normalized.completedDates;
}

export function isHabitCompletedOnDate(habit: Habit, date: string): boolean {
  const normalized = normalizeHabit(habit);
  
  if (normalized.type === 'reduce') {
    const progress = normalized.progressByDate?.[date];
    return progress === 0;
  }
  
  return normalized.completedDates.includes(date);
}

export function getHabitCompletionTotal(habit: Habit): number {
  return getHabitCompletedDates(habit).length;
}
