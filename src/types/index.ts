export type MoodType = 'great' | 'good' | 'okay' | 'bad' | 'terrible';

export interface MoodEntry {
  id: string;
  mood: MoodType;
  note?: string;
  date: string;
  timestamp: number;
  tags?: string[];
  // v1.5.0: Emotion Wheel (Plutchik model)
  emotion?: EmotionData;
}

// ============================================
// EMOTION WHEEL - Plutchik's 8 Primary Emotions
// ============================================

/** 8 primary emotions from Plutchik's Wheel of Emotions */
export type PrimaryEmotion =
  | 'joy'          // Радость
  | 'trust'        // Доверие
  | 'fear'         // Страх
  | 'surprise'     // Удивление
  | 'sadness'      // Грусть
  | 'disgust'      // Отвращение
  | 'anger'        // Гнев
  | 'anticipation'; // Ожидание

/** Emotion intensity levels (ADHD-friendly: 3 levels instead of slider) */
export type EmotionIntensity = 'mild' | 'moderate' | 'intense';

/** Secondary emotions derived from primary + intensity */
export type SecondaryEmotion =
  // Joy variants
  | 'serenity' | 'ecstasy'
  // Trust variants
  | 'acceptance' | 'admiration'
  // Fear variants
  | 'apprehension' | 'terror'
  // Surprise variants
  | 'distraction' | 'amazement'
  // Sadness variants
  | 'pensiveness' | 'grief'
  // Disgust variants
  | 'boredom' | 'loathing'
  // Anger variants
  | 'annoyance' | 'rage'
  // Anticipation variants
  | 'interest' | 'vigilance';

/** Full emotion data captured from the wheel */
export interface EmotionData {
  primary: PrimaryEmotion;
  secondary?: SecondaryEmotion;
  intensity: EmotionIntensity;
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
  gratitudeEntries: number;
  // Special badge tracking
  perfectDaysCount: number;    // Days where all habits completed
  earlyBirdCount: number;      // Habits completed before 8 AM
  nightOwlCount: number;       // Habits completed after 10 PM
  zenMasterDays: number;       // Days with mood + habits + focus + gratitude
}

export interface ReminderSettings {
  enabled: boolean;
  // Mood reminders - 3 times per day
  moodTimeMorning: string;
  moodTimeAfternoon: string;
  moodTimeEvening: string;
  // Legacy field for backwards compatibility
  moodTime?: string;
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
  consentShown?: boolean; // GDPR: track if user has been asked for consent
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
  note?: string;              // Optional note/description
  // v1.4.0: Habit-schedule sync
  source?: 'manual' | 'habit' | 'task'; // Event origin
  habitId?: string;            // Reference to source habit (if source='habit')
  taskId?: string;             // Reference to source task (if source='task')
  isAutoGenerated?: boolean;   // true for auto-generated task blocks
  isEditable?: boolean;        // false for habit-generated events
}

// ============================================
// TREATS SYSTEM - Unified reward currency
// ============================================

export type TreatSource = 'mood' | 'habit' | 'focus' | 'gratitude' | 'breathing' | 'streak_bonus' | 'daily_reward' | 'mindful';

export interface TreatTransaction {
  id: string;
  amount: number;
  source: TreatSource;
  timestamp: number;
  description?: string;
}

export interface TreatsWallet {
  balance: number;              // Current treats available
  lifetimeEarned: number;       // Total treats ever earned
  lifetimeSpent: number;        // Total treats ever spent
  lastEarnedAt?: number;        // Timestamp of last earning
  transactions: TreatTransaction[]; // Recent transactions (last 50)
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

// Tree stages for the new Seasonal Tree system
export type TreeStage = 1 | 2 | 3 | 4 | 5; // Seed, Sprout, Sapling, Tree, Great Tree

export interface Companion {
  // Legacy animal type (kept for backward compatibility)
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

  // NEW: Seasonal Tree System
  treeStage: TreeStage;             // 1-5: growth stage of the tree
  waterLevel: number;               // 0-100: needs watering
  lastWateredAt?: number;           // Timestamp of last watering
  lastTouchTime?: number;           // P1 Fix: Separate cooldown for tree touch
  treeXP: number;                   // XP specifically for tree growth

  // Simplified stats (new system)
  fullness: number;                 // 0-100: how full the companion is (fed by treats)

  // Legacy stats (kept for backward compatibility, will be derived from fullness)
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
  // Treats wallet (unified reward system)
  treats: TreatsWallet;

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

  // Rest mode - days when user took a break but keeps streak
  restDays: string[]; // YYYY-MM-DD format
}

// ============ Insights Engine Types ============

export type InsightType =
  | 'mood-habit-correlation'  // Habit improves mood
  | 'focus-pattern'            // Best time/label for focus
  | 'habit-timing'             // Best time of day for habit
  | 'mood-tag'                 // Mood correlation with tags
  | 'energy-pattern';          // Energy levels over time

export type InsightSeverity = 'info' | 'tip' | 'warning' | 'celebration';

export interface Insight {
  id: string;
  type: InsightType;
  severity: InsightSeverity;
  title: string;                // "Meditation improves your mood"
  description: string;          // Detailed explanation
  confidence: number;           // 0-100: statistical confidence
  dataPoints: number;           // How many data points used
  createdAt: number;            // Timestamp when insight was generated

  // Type-specific data
  metadata: InsightMetadata;
}

// Metadata varies by insight type
export type InsightMetadata =
  | MoodHabitCorrelationMetadata
  | FocusPatternMetadata
  | HabitTimingMetadata
  | MoodTagMetadata
  | EnergyPatternMetadata;

// Mood-Habit Correlation: "Meditation improves mood +15%"
export interface MoodHabitCorrelationMetadata {
  type: 'mood-habit-correlation';
  habitId: string;
  habitName: string;
  moodImprovement: number;      // Percentage improvement
  avgMoodWith: number;          // Average mood (1-5) on days WITH habit
  avgMoodWithout: number;       // Average mood (1-5) on days WITHOUT habit
  sampleDays: number;           // Days with habit completed
}

// Focus Pattern: "You focus best on 'Deep Work' tasks"
export interface FocusPatternMetadata {
  type: 'focus-pattern';
  bestLabel?: string;           // Best focus label
  bestTime?: string;            // Best time of day (HH:00)
  avgDuration: number;          // Average focus duration for this pattern
  successRate: number;          // Percentage of successful sessions
  totalSessions: number;
}

// Habit Timing: "Morning runs: 85% completion vs Evening: 40%"
export interface HabitTimingMetadata {
  type: 'habit-timing';
  habitId: string;
  habitName: string;
  bestTime: 'morning' | 'afternoon' | 'evening';
  bestTimeRate: number;         // Completion rate at best time
  worstTimeRate: number;        // Completion rate at worst time
  morningCount: number;
  afternoonCount: number;
  eveningCount: number;
}

// Mood Tag: "Days with 'exercise' tag: mood +20%"
export interface MoodTagMetadata {
  type: 'mood-tag';
  tag: string;
  avgMoodWith: number;          // Average mood with this tag
  avgMoodWithout: number;       // Average mood without this tag
  improvement: number;          // Percentage improvement
  occurrences: number;          // How many times tag was used
}

// Energy Pattern: "Low energy follows days with <3h focus"
export interface EnergyPatternMetadata {
  type: 'energy-pattern';
  pattern: string;              // Description of pattern
  correlation: number;          // Correlation coefficient
  recommendation: string;       // What to do about it
}

// ====== Onboarding System Types ======

// Features that can be progressively unlocked
export type FeatureId =
  | 'mood'          // Always unlocked
  | 'habits'        // Always unlocked
  | 'focusTimer'    // Day 2
  | 'xp'            // Day 3
  | 'quests'        // Day 3
  | 'companion'     // Day 3
  | 'tasks'         // Day 4
  | 'challenges';   // Day 4

// Tutorial steps
export type TutorialStep =
  | 'welcome'           // Welcome message
  | 'mood-first'        // First mood entry
  | 'habit-created'     // First habit created
  | 'habit-completed'   // First habit completed
  | 'focus-first'       // First focus session
  | 'xp-explanation'    // XP system explained
  | 'quest-first';      // First quest shown

// Progressive onboarding state
export interface OnboardingState {
  isNewUser: boolean;           // false for existing users (skip onboarding)
  firstLoginDate: number;       // timestamp
  daysActive: number;           // 1-4+
  unlockedFeatures: FeatureId[];
  completedSteps: TutorialStep[];
  hasSeenWelcome: boolean;
}
