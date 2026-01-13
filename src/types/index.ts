export type MoodType = 'great' | 'good' | 'okay' | 'bad' | 'terrible';

export interface MoodEntry {
  id: string;
  mood: MoodType;
  note?: string;
  date: string;
  timestamp: number;
  tags?: string[];
}

export type HabitType =
  | 'continuous'   // Бросить курить/пить - отслеживает дни без срыва
  | 'daily'        // Зарядка, медитация - 1 раз в день
  | 'scheduled'    // Витамины, еда - в определенное время
  | 'multiple'     // Пить воду - несколько раз в день
  | 'reduce';      // Сократить что-то

export interface HabitReminder {
  enabled: boolean;
  time: string;      // "09:00"
  days: number[];    // [1,2,3,4,5] (Mon-Fri)
}

export interface Habit {
  id: string;
  name: string;
  icon: string;
  color: string;
  completedDates: string[];
  createdAt: number;
  templateId?: string;

  // New fields for enhanced habit system
  type: HabitType;
  reminders: HabitReminder[];  // Каждая привычка может иметь несколько напоминаний

  // For continuous habits (quit smoking/drinking)
  startDate?: string;          // Дата начала отказа
  failedDates?: string[];      // Даты срывов

  // For reduce habits
  progressByDate?: Record<string, number>;
  targetCount?: number;        // Целевое количество в день

  // For multiple daily habits
  dailyTarget?: number;        // Сколько раз в день нужно выполнить
  completionsByDate?: Record<string, number>; // Сколько раз выполнено в этот день
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

export type ChallengeType =
  | 'streak'      // Челлендж на стрик (например, 30 дней подряд)
  | 'total'       // Общее количество (например, 100 медитаций)
  | 'focus'       // Фокус-время (например, 500 минут)
  | 'gratitude';  // Благодарности (например, 50 записей)

export interface Challenge {
  id: string;
  type: ChallengeType;
  habitId?: string;           // Для habit-specific челленджей
  target: number;             // Целевое значение
  progress: number;           // Текущий прогресс
  startDate: string;          // Дата начала
  endDate?: string;           // Дата окончания (опционально)
  completed: boolean;         // Завершен ли челлендж
  completedDate?: string;     // Дата завершения
  icon: string;               // Иконка челленджа
  title: Record<string, string>; // Название на разных языках
  description: Record<string, string>; // Описание на разных языках
  reward?: string;            // ID награды/бейджа
}

export type BadgeCategory =
  | 'streak'      // За стрики
  | 'habit'       // За привычки
  | 'focus'       // За фокус
  | 'gratitude'   // За благодарности
  | 'special';    // Специальные достижения

export interface Badge {
  id: string;
  category: BadgeCategory;
  icon: string;               // Эмодзи или иконка
  title: Record<string, string>;
  description: Record<string, string>;
  requirement: number;        // Требование для получения
  unlocked: boolean;          // Разблокирован ли
  unlockedDate?: string;      // Дата разблокировки
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}
