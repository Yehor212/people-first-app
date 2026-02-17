import { MoodEntry, Habit, FocusSession, GratitudeEntry, PrimaryEmotion } from '@/types';

export type StatsRange = 'week' | 'month' | 'all';

export interface UseStatsCalculationsProps {
  moods: MoodEntry[];
  habits: Habit[];
  focusSessions: FocusSession[];
  gratitudeEntries: GratitudeEntry[];
  restDays: string[];
  currentFocusMinutes?: number;
  range: StatsRange;
  selectedTag: string;
  monthNames: string[];
}

export interface Stats {
  totalFocusMinutes: number;
  allTimeFocusMinutes: number;
  totalHabitCompletions: number;
  currentStreak: number;
  moodCounts: Record<string, number>;
  emotionCounts: Record<PrimaryEmotion, number>;
  totalEmotionEntries: number;
  thisMonthMoods: number;
  thisMonthFocusMinutes: number;
  thisMonthGratitude: number;
  monthName: string;
}

export interface PremiumStats {
  moodScore: number;
  habitRate: number;
  focusScore: number;
  weekScore: number;
  weeklyChange: number;
  currentMood: string;
}

export interface MoodInsights {
  bestDay: { day: string; avg: number } | null;
  focusAvg: { withFocus: number; withoutFocus: number } | null;
  habitDiffs: Array<{ id: string; name: string; diff: number }>;
}
