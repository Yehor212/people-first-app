export type MoodType = 'great' | 'good' | 'okay' | 'bad' | 'terrible';

export interface MoodEntry {
  id: string;
  mood: MoodType;
  note?: string;
  date: string;
  timestamp: number;
  tags?: string[];
}

export interface Habit {
  id: string;
  name: string;
  icon: string;
  color: string;
  completedDates: string[];
  createdAt: number;
  templateId?: string;
  type?: 'daily' | 'reduce';
  progressByDate?: Record<string, number>;
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
  label?: string;
  status?: 'completed' | 'aborted';
  reflection?: number;
}

export interface UserStats {
  totalFocusMinutes: number;
  currentStreak: number;
  longestStreak: number;
  habitsCompleted: number;
  moodEntries: number;
}

export interface ReminderSettings {
  enabled: boolean;
  moodTime: string;
  habitTime: string;
  focusTime: string;
  days: number[];
  quietHours: {
    start: string;
    end: string;
  };
  habitIds: string[];
}

export interface PrivacySettings {
  noTracking: boolean;
  analytics: boolean;
}
