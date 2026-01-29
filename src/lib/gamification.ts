/**
 * Gamification System for ZenFlow
 * Achievements, Badges, Levels, Rewards
 */

import { MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';
import { calculateStreak } from './utils';

// ============================================
// TYPES
// ============================================

export type AchievementId =
  | 'first_mood'
  | 'first_habit'
  | 'first_focus'
  | 'first_gratitude'
  | 'streak_3'
  | 'streak_7'
  | 'streak_30'
  | 'streak_100'
  | 'habit_master'
  | 'focus_warrior'
  | 'grateful_heart'
  | 'mood_tracker'
  | 'perfect_week'
  | 'zen_master'
  | 'productivity_beast'
  | 'consistency_king'
  | 'wellness_warrior';

export type BadgeRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Achievement {
  id: AchievementId;
  name: string;
  description: string;
  icon: string;
  rarity: BadgeRarity;
  points: number;
  unlockedAt?: number;
  progress?: number;
  total?: number;
}

export interface UserLevel {
  level: number;
  xp: number;
  nextLevelXp: number;
  title: string;
}

export interface DailyReward {
  day: number;
  claimed: boolean;
  reward: {
    type: 'xp' | 'badge' | 'unlock';
    value: number | string;
  };
}

// ============================================
// ACHIEVEMENTS DATABASE
// ============================================

export const ACHIEVEMENTS: Record<AchievementId, Omit<Achievement, 'unlockedAt' | 'progress'>> = {
  // Первые шаги
  first_mood: {
    id: 'first_mood',
    name: 'Первое настроение',
    description: 'Отметьте своё настроение в первый раз',
    icon: '😊',
    rarity: 'common',
    points: 10,
  },
  first_habit: {
    id: 'first_habit',
    name: 'Первая привычка',
    description: 'Создайте свою первую привычку',
    icon: '🎯',
    rarity: 'common',
    points: 10,
  },
  first_focus: {
    id: 'first_focus',
    name: 'Первый фокус',
    description: 'Завершите первую фокус-сессию',
    icon: '⏱️',
    rarity: 'common',
    points: 10,
  },
  first_gratitude: {
    id: 'first_gratitude',
    name: 'Первая благодарность',
    description: 'Запишите свою первую благодарность',
    icon: '🙏',
    rarity: 'common',
    points: 10,
  },

  // Стрики
  streak_3: {
    id: 'streak_3',
    name: 'На старте!',
    description: 'Ведите дневник 3 дня подряд',
    icon: '🔥',
    rarity: 'common',
    points: 25,
    total: 3,
  },
  streak_7: {
    id: 'streak_7',
    name: 'Неделя силы',
    description: 'Ведите дневник 7 дней подряд',
    icon: '💪',
    rarity: 'rare',
    points: 50,
    total: 7,
  },
  streak_30: {
    id: 'streak_30',
    name: 'Месячный марафон',
    description: 'Ведите дневник 30 дней подряд',
    icon: '🏆',
    rarity: 'epic',
    points: 150,
    total: 30,
  },
  streak_100: {
    id: 'streak_100',
    name: 'Легенда дисциплины',
    description: 'Ведите дневник 100 дней подряд',
    icon: '👑',
    rarity: 'legendary',
    points: 500,
    total: 100,
  },

  // Привычки
  habit_master: {
    id: 'habit_master',
    name: 'Мастер привычек',
    description: 'Выполните 100 привычек',
    icon: '✨',
    rarity: 'epic',
    points: 100,
    total: 100,
  },

  // Фокус
  focus_warrior: {
    id: 'focus_warrior',
    name: 'Воин фокуса',
    description: 'Завершите 50 часов фокус-сессий',
    icon: '🧘',
    rarity: 'epic',
    points: 200,
    total: 50,
  },

  // Благодарности
  grateful_heart: {
    id: 'grateful_heart',
    name: 'Благодарное сердце',
    description: 'Запишите 100 благодарностей',
    icon: '💖',
    rarity: 'rare',
    points: 75,
    total: 100,
  },

  // Настроение
  mood_tracker: {
    id: 'mood_tracker',
    name: 'Трекер эмоций',
    description: 'Отследите настроение 50 дней',
    icon: '📊',
    rarity: 'rare',
    points: 60,
    total: 50,
  },

  // Особые
  perfect_week: {
    id: 'perfect_week',
    name: 'Идеальная неделя',
    description: 'Выполните все привычки 7 дней подряд',
    icon: '⭐',
    rarity: 'epic',
    points: 120,
    total: 7,
  },

  zen_master: {
    id: 'zen_master',
    name: 'Мастер дзен',
    description: 'Достигните 1000 XP',
    icon: '🌟',
    rarity: 'legendary',
    points: 250,
    total: 1000,
  },

  productivity_beast: {
    id: 'productivity_beast',
    name: 'Зверь продуктивности',
    description: 'Завершите 10 фокус-сессий за один день',
    icon: '🦁',
    rarity: 'epic',
    points: 150,
    total: 10,
  },

  consistency_king: {
    id: 'consistency_king',
    name: 'Король постоянства',
    description: 'Ведите дневник 365 дней подряд',
    icon: '🎖️',
    rarity: 'legendary',
    points: 1000,
    total: 365,
  },

  wellness_warrior: {
    id: 'wellness_warrior',
    name: 'Воин благополучия',
    description: 'Разблокируйте все базовые достижения',
    icon: '🌿',
    rarity: 'legendary',
    points: 300,
  },
};

// ============================================
// LEVEL SYSTEM
// ============================================

const LEVEL_TITLES = [
  'Новичок',
  'Ученик',
  'Практик',
  'Адепт',
  'Эксперт',
  'Мастер',
  'Гуру',
  'Мудрец',
  'Наставник',
  'Легенда',
];

export function calculateLevel(xp: number): UserLevel {
  // XP formula: level^2 * 100 (exponential growth)
  let level = 1;
  while (level * level * 100 <= xp) {
    level++;
  }
  level = Math.max(1, level - 1);

  const nextLevelXp = level * level * 100;
  const title = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];

  return { level, xp, nextLevelXp, title };
}

export function getXpForAction(action: 'mood' | 'habit' | 'focus' | 'gratitude' | 'streak'): number {
  const xpMap = {
    mood: 5,
    habit: 10,
    focus: 15,
    gratitude: 8,
    streak: 20,
  };
  return xpMap[action];
}

// ============================================
// ACHIEVEMENT CHECKING
// ============================================

export interface UserStats {
  moods: MoodEntry[];
  habits: Habit[];
  focusSessions: FocusSession[];
  gratitudeEntries: GratitudeEntry[];
  totalXp: number;
}

export function checkAchievements(
  stats: UserStats,
  unlockedAchievements: AchievementId[]
): { newAchievements: Achievement[]; updatedProgress: Record<AchievementId, number> } {
  const newAchievements: Achievement[] = [];
  const updatedProgress: Record<AchievementId, number> = {};

  // First time achievements
  if (stats.moods.length >= 1 && !unlockedAchievements.includes('first_mood')) {
    newAchievements.push({ ...ACHIEVEMENTS.first_mood, unlockedAt: Date.now() });
  }
  if (stats.habits.length >= 1 && !unlockedAchievements.includes('first_habit')) {
    newAchievements.push({ ...ACHIEVEMENTS.first_habit, unlockedAt: Date.now() });
  }
  if (stats.focusSessions.length >= 1 && !unlockedAchievements.includes('first_focus')) {
    newAchievements.push({ ...ACHIEVEMENTS.first_focus, unlockedAt: Date.now() });
  }
  if (stats.gratitudeEntries.length >= 1 && !unlockedAchievements.includes('first_gratitude')) {
    newAchievements.push({ ...ACHIEVEMENTS.first_gratitude, unlockedAt: Date.now() });
  }

  // Streaks (mood-based)
  const moodDates = stats.moods.map((m) => m.date);
  const currentStreak = calculateStreak(moodDates);

  if (currentStreak >= 3 && !unlockedAchievements.includes('streak_3')) {
    newAchievements.push({ ...ACHIEVEMENTS.streak_3, unlockedAt: Date.now(), progress: currentStreak });
  } else if (currentStreak < 3) {
    updatedProgress.streak_3 = currentStreak;
  }

  if (currentStreak >= 7 && !unlockedAchievements.includes('streak_7')) {
    newAchievements.push({ ...ACHIEVEMENTS.streak_7, unlockedAt: Date.now(), progress: currentStreak });
  } else if (currentStreak < 7) {
    updatedProgress.streak_7 = currentStreak;
  }

  if (currentStreak >= 30 && !unlockedAchievements.includes('streak_30')) {
    newAchievements.push({ ...ACHIEVEMENTS.streak_30, unlockedAt: Date.now(), progress: currentStreak });
  } else if (currentStreak < 30) {
    updatedProgress.streak_30 = currentStreak;
  }

  if (currentStreak >= 100 && !unlockedAchievements.includes('streak_100')) {
    newAchievements.push({ ...ACHIEVEMENTS.streak_100, unlockedAt: Date.now(), progress: currentStreak });
  } else if (currentStreak < 100) {
    updatedProgress.streak_100 = currentStreak;
  }

  if (currentStreak >= 365 && !unlockedAchievements.includes('consistency_king')) {
    newAchievements.push({ ...ACHIEVEMENTS.consistency_king, unlockedAt: Date.now(), progress: currentStreak });
  } else if (currentStreak < 365) {
    updatedProgress.consistency_king = currentStreak;
  }

  // Habit completions
  const totalHabitCompletions = stats.habits.reduce((sum, h) => sum + (h.completedDates?.length ?? 0), 0);
  if (totalHabitCompletions >= 100 && !unlockedAchievements.includes('habit_master')) {
    newAchievements.push({ ...ACHIEVEMENTS.habit_master, unlockedAt: Date.now(), progress: totalHabitCompletions });
  } else {
    updatedProgress.habit_master = totalHabitCompletions;
  }

  // Focus hours
  const totalFocusMinutes = stats.focusSessions.reduce((sum, s) => sum + s.duration, 0);
  const totalFocusHours = Math.floor(totalFocusMinutes / 60);
  if (totalFocusHours >= 50 && !unlockedAchievements.includes('focus_warrior')) {
    newAchievements.push({ ...ACHIEVEMENTS.focus_warrior, unlockedAt: Date.now(), progress: totalFocusHours });
  } else {
    updatedProgress.focus_warrior = totalFocusHours;
  }

  // Gratitude entries
  if (stats.gratitudeEntries.length >= 100 && !unlockedAchievements.includes('grateful_heart')) {
    newAchievements.push({ ...ACHIEVEMENTS.grateful_heart, unlockedAt: Date.now(), progress: stats.gratitudeEntries.length });
  } else {
    updatedProgress.grateful_heart = stats.gratitudeEntries.length;
  }

  // Mood tracking
  if (stats.moods.length >= 50 && !unlockedAchievements.includes('mood_tracker')) {
    newAchievements.push({ ...ACHIEVEMENTS.mood_tracker, unlockedAt: Date.now(), progress: stats.moods.length });
  } else {
    updatedProgress.mood_tracker = stats.moods.length;
  }

  // XP-based
  if (stats.totalXp >= 1000 && !unlockedAchievements.includes('zen_master')) {
    newAchievements.push({ ...ACHIEVEMENTS.zen_master, unlockedAt: Date.now(), progress: stats.totalXp });
  } else {
    updatedProgress.zen_master = stats.totalXp;
  }

  return { newAchievements, updatedProgress };
}

// ============================================
// DAILY REWARDS
// ============================================

export function generateDailyRewards(day: number): DailyReward {
  const rewards: DailyReward['reward'][] = [
    { type: 'xp', value: 10 },
    { type: 'xp', value: 15 },
    { type: 'xp', value: 20 },
    { type: 'xp', value: 25 },
    { type: 'xp', value: 30 },
    { type: 'xp', value: 40 },
    { type: 'xp', value: 50 },
  ];

  return {
    day,
    claimed: false,
    reward: rewards[(day - 1) % 7],
  };
}

// ============================================
// BADGE COLORS
// ============================================

export function getBadgeColor(rarity: BadgeRarity): string {
  const colors = {
    common: 'bg-gray-100 text-gray-700 border-gray-300',
    rare: 'bg-blue-100 text-blue-700 border-blue-300',
    epic: 'bg-purple-100 text-purple-700 border-purple-300',
    legendary: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  };
  return colors[rarity];
}

export function getBadgeGlow(rarity: BadgeRarity): string {
  const glows = {
    common: '',
    rare: 'shadow-lg shadow-blue-200',
    epic: 'shadow-xl shadow-purple-300 animate-pulse-soft',
    legendary: 'shadow-2xl shadow-yellow-300 animate-pulse-soft',
  };
  return glows[rarity];
}
