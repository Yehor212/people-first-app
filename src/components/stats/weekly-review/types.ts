import { Habit, MoodEntry, FocusSession } from '@/types';

export interface WeeklyReviewProps {
  habits: Habit[];
  moods: MoodEntry[];
  focusSessions: FocusSession[];
  currentStreak: number;
  className?: string;
}

export interface WeekStats {
  habitsCompleted: number;
  habitRate: number;
  focusMinutes: number;
  moodAvg: number;
  perfectDays: number;
  bestDay: string | null;
}
