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

export type HabitFrequency = 'once' | 'daily' | 'weekly' | 'custom';

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

  // Frequency settings
  frequency: HabitFrequency;   // Как часто выполнять привычку
  customDays?: number[];       // Для custom: дни недели [0-6] (Sun-Sat)

  // Duration settings
  requiresDuration?: boolean;  // Требует ли привычка времени на выполнение
  targetDuration?: number;     // Целевое время в минутах
  durationByDate?: Record<string, number>; // Фактическое время по датам

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

export interface ScheduleEvent {
  id: string;
  title: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  color: string;
  emoji?: string;
  date: string;               // Which day this event is for
}

// ============================================
// INNER WORLD SYSTEM - Personal Growth Garden
// ============================================

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export type PlantType = 'flower' | 'tree' | 'crystal' | 'mushroom';
export type CreatureType = 'butterfly' | 'bird' | 'firefly' | 'spirit';

export type PlantStage = 'seed' | 'sprout' | 'growing' | 'blooming' | 'magnificent';
export type CreatureStage = 'egg' | 'baby' | 'young' | 'adult' | 'legendary';

// Plant in the garden - grows from activities
export interface GardenPlant {
  id: string;
  type: PlantType;
  stage: PlantStage;
  color: string;                    // Based on mood when planted
  plantedAt: number;                // Timestamp
  lastWateredAt: number;            // Last activity timestamp
  growthPoints: number;             // Accumulated growth
  position: { x: number; y: number }; // Position in garden (0-100)
  sourceActivity: 'mood' | 'habit' | 'focus' | 'gratitude';
  isSpecial?: boolean;              // Seasonal or rare
  variant?: string;                 // Visual variant
}

// Creature in the garden - attracted by gratitude
export interface GardenCreature {
  id: string;
  type: CreatureType;
  stage: CreatureStage;
  color: string;
  arrivedAt: number;
  happiness: number;                // 0-100
  position: { x: number; y: number };
  isSpecial?: boolean;
  variant?: string;
}

// Companion mascot - lives in the garden
export type CompanionMood = 'sleeping' | 'calm' | 'happy' | 'excited' | 'celebrating' | 'supportive';
export type CompanionType = 'fox' | 'cat' | 'owl' | 'rabbit' | 'dragon';

export interface Companion {
  type: CompanionType;
  name: string;
  mood: CompanionMood;
  level: number;                    // 1-100
  experience: number;
  unlockedOutfits: string[];
  currentOutfit?: string;
  lastInteraction: number;
  lastPetTime?: number;             // Track when companion was last petted
  lastFeedTime?: number;            // Track when companion was last fed
  interactionCount: number;         // Total interactions
  happiness: number;                // 0-100: affects reactions
  hunger: number;                   // 0-100: decreases over time, affects mood
  personality: {
    energy: number;                 // 0-100: calm to energetic
    wisdom: number;                 // 0-100: playful to wise
    warmth: number;                 // 0-100: reserved to affectionate
  };
}

// Garden evolution stages
export type GardenStage =
  | 'empty'           // Just started
  | 'sprouting'       // First week
  | 'growing'         // First month
  | 'flourishing'     // Few months
  | 'magical'         // Half year
  | 'legendary';      // Year+

// Weather/atmosphere in the garden
export type GardenWeather = 'sunny' | 'cloudy' | 'rainy' | 'starry' | 'aurora' | 'magical';

// The complete Inner World state
export interface InnerWorld {
  // Garden state
  gardenStage: GardenStage;
  plants: GardenPlant[];
  creatures: GardenCreature[];
  weather: GardenWeather;
  season: Season;

  // Companion
  companion: Companion;

  // Stats
  totalPlantsGrown: number;
  totalCreaturesAttracted: number;
  daysActive: number;
  longestActiveStreak: number;
  currentActiveStreak: number;
  lastActiveDate: string;

  // Unlocks
  unlockedBackgrounds: string[];
  unlockedDecorations: string[];
  currentBackground: string;
  decorations: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
  }>;

  // Seasonal
  seasonalItemsCollected: string[];

  // Welcome back state
  pendingGrowth: {
    plantsToGrow: number;
    creaturesArrived: number;
    companionMissedYou: boolean;
  };
}
