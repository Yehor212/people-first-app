export type MoodType = 'great' | 'good' | 'okay' | 'bad' | 'terrible';

export interface MoodEntry {
  id: string;
  mood: MoodType;
  note?: string;
  date: string;
  timestamp: number;
}

export interface Habit {
  id: string;
  name: string;
  icon: string;
  color: string;
  completedDates: string[];
  createdAt: number;
}

export interface GratitudeEntry {
  id: string;
  text: string;
  date: string;
  timestamp: number;
}

export interface FocusSession {
  id: string;
  duration: number;
  completedAt: number;
  date: string;
}

export interface UserStats {
  totalFocusMinutes: number;
  currentStreak: number;
  longestStreak: number;
  habitsCompleted: number;
  moodEntries: number;
}
