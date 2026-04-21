export type MoodType = 'great' | 'good' | 'okay' | 'bad' | 'terrible';

/** State of Mind log type: momentary snapshot vs. overall day feeling */
export type MoodLogType = 'momentary' | 'overall';

export interface MoodEntry {
  id: string;
  mood: MoodType;
  note?: string;
  date: string;
  timestamp: number;
  tags?: string[];
  // v1.5.0: Emotion Wheel (Plutchik model) — deprecated, kept for migration
  emotion?: EmotionData;
  // v2.0.0: State of Mind (Apple Health model)
  valence?: number;          // -1.0 (very unpleasant) to +1.0 (very pleasant)
  logType?: MoodLogType;     // 'momentary' | 'overall'
  emotionTags?: string[];    // e.g. ['anxious', 'hopeful']
  contexts?: string[];       // e.g. ['work', 'health']
  updatedAt?: number;          // Sync timestamp for cross-device merge
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

// Habit categories for grouping
export type HabitCategory =
  | 'health'       // Здоровье (упражнения, питание, сон)
  | 'mindfulness'  // Осознанность (медитация, дневник, благодарность)
  | 'productivity' // Продуктивность (работа, учеба, навыки)
  | 'social'       // Социальное (семья, друзья, общение)
  | 'creativity'   // Творчество (музыка, искусство, письмо)
  | 'finance'      // Финансы (бюджет, сбережения)
  | 'self-care'    // Забота о себе (гигиена, отдых)
  | 'other';       // Другое

// ============================================
// LOOP HABIT TRACKER — Entry Value System
// From iSoron/uhabits Entry.kt
// ============================================

/** Entry value constants (Loop-exact integers) */
export const ENTRY = {
  UNKNOWN:    -1,  // No data for this day
  NO:          0,  // Expected but not done
  YES_AUTO:    1,  // Auto-filled by frequency algorithm (hollow checkmark)
  YES_MANUAL:  2,  // User performed (filled checkmark)
  SKIP:        3,  // Not applicable (preserves & extends streak)
} as const;

export type EntryValue = -1 | 0 | 1 | 2 | 3;

/** Single day's entry for a habit */
export interface HabitEntry {
  value: number;    // EntryValue for boolean; value×1000 for numerical
  notes?: string;   // Per-day note
}

// ============================================
// LOOP HABIT TRACKER — Habit Types
// ============================================

/** Loop habit types: boolean (yes/no) or numerical (measurable) */
export type LoopHabitType = 'boolean' | 'numerical';

/** Numerical habit target direction */
export type TargetType = 'atLeast' | 'atMost';

/** Frequency as ratio: "3 times per 7 days" = { numerator: 3, denominator: 7 } */
export interface HabitFrequencyRatio {
  numerator: number;
  denominator: number;
}

export interface HabitReminder {
  enabled: boolean;
  time: string;      // "09:00"
  days: number[];    // [1,2,3,4,5] (Mon-Fri)
}

// ============================================
// HABIT INTERFACE — Loop-Faithful + ZenFlow Extensions
// ============================================

export interface Habit {
  // === Identity ===
  id: string;
  name: string;
  icon: string;
  color: number;              // Palette index 0-19 (NOT hex string)
  position: number;           // Manual sort order
  createdAt: number;          // Timestamp ms

  // === Loop Core ===
  habitType: LoopHabitType;   // 'boolean' | 'numerical'
  frequency: HabitFrequencyRatio; // { numerator, denominator }
  question: string;           // "Did you exercise today?"
  description: string;        // Extended description
  isArchived: boolean;

  // === Numerical habits ===
  targetValue: number;        // e.g. 2.0 (liters)
  targetType: TargetType;     // 'atLeast' | 'atMost'
  unit: string;               // "L", "km", "min"

  // === Optional program window ===
  durationDays?: number;      // e.g. 30-day habit plan
  startDate?: string;         // YYYY-MM-DD when finite plan starts
  endDate?: string;           // YYYY-MM-DD derived from startDate + durationDays

  // === Entry data (user-entered only) ===
  entries: Record<string, HabitEntry>;  // YYYY-MM-DD → entry

  // === Reminders ===
  reminders: HabitReminder[];

  // === ZenFlow Extensions (not in Loop) ===
  templateId?: string;
  category?: HabitCategory;
  identityCluster?: string;    // User-defined cluster name
  identityVerb?: string;       // Identity statement
  identityIcon?: string;       // Emoji representing this identity

  // === Metadata ===
  updatedAt?: string;
}

export interface GratitudeEntry {
  id: string;
  text: string;
  date: string;
  timestamp: number;
  updatedAt?: number;
}

export interface FocusSession {
  id: string;
  duration: number;
  completedAt: number;
  date: string;
  label?: string;
  status?: 'completed' | 'aborted';
  reflection?: number;
  updatedAt?: number;
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

/**
 * Personal Goal for tracking progress
 * Users can set weekly/monthly targets for habits, focus, mood, or streaks
 */
export type GoalType = 'habit' | 'focus' | 'mood' | 'streak';
export type GoalPeriod = 'week' | 'month';

export interface Goal {
  id: string;
  type: GoalType;
  target: number;        // e.g., 6 days, 120 minutes, average mood 4+
  period: GoalPeriod;
  habitId?: string;      // For habit-specific goals
  title: string;         // User-visible title
  createdAt: string;     // ISO date
  completedAt?: string;  // ISO date when goal was achieved
  status: 'active' | 'completed' | 'failed';
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
  adConsent?: boolean;    // GDPR: ad personalization consent
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
  icon: string;               // Эмодзи (fallback)
  iconName?: string;          // Premium SVG icon name (fire, star, diamond, etc.)
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
  color: string;              // HEX color (kept for backward compatibility)
  colorVar?: string;          // CSS variable reference (e.g., 'work', 'meal', 'urgent')
  urgent?: boolean;           // For urgent task red styling
  emoji?: string;
  date: string;               // Which day this event is for
  note?: string;              // Optional note/description
  // v1.4.0: Habit-schedule sync
  source?: 'manual' | 'habit' | 'task' | 'google'; // Event origin
  habitId?: string;            // Reference to source habit (if source='habit')
  taskId?: string;             // Reference to source task (if source='task')
  isAutoGenerated?: boolean;   // true for auto-generated task blocks
  isEditable?: boolean;        // false for habit-generated events
}

// ============================================
// TREATS SYSTEM - Unified reward currency
// ============================================

export type TreatSource = 'mood' | 'habit' | 'focus' | 'gratitude' | 'breathing' | 'journal' | 'streak_bonus' | 'daily_reward' | 'mindful' | 'ad';

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

export type PlantType = 'flower' | 'tree' | 'crystal' | 'mushroom' | 'story' | 'air_plant' | 'rest_flower';
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
  sourceActivity: 'mood' | 'habit' | 'focus' | 'gratitude' | 'journal' | 'breathing' | 'rest';
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
export type CompanionMood = 'sleeping' | 'calm' | 'happy' | 'excited' | 'celebrating' | 'supportive' | 'reading' | 'meditating';
export type CompanionType = 'fox' | 'cat' | 'owl' | 'rabbit' | 'dragon';

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

  // Active temporary effects (IA Blueprint Phase 4)
  activeEffects?: {
    wind?: { until: number };       // Breathing → garden wind (expires after 2h)
  };
}

// ============================================
// CANVAS GOALS — Interactive Goal Tree on Mind Map
// ============================================

export interface CanvasGoal {
  id: string;
  title: string;
  description?: string;
  icon?: string;               // lucide icon name (e.g. 'Target', 'Book')
  emoji?: string;              // user-chosen emoji (e.g. '🎯', '📚')
  color?: string;              // preset color key (e.g. 'emerald', 'rose', 'amber')
  completed: boolean;
  parentId: string | null;     // null = root-level goal
  createdAt: number;
  completedAt?: number;
  order: number;               // sibling ordering
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

// ============================================
// REFLECTION ENGINE (IA Blueprint Phase 3)
// ============================================

/** Depth level for reflection inputs */
export type ReflectionDepth = 'nano' | 'micro' | 'deep';

/** Trigger context that prompted the reflection */
export type ReflectionTrigger =
  | 'mood_joy_streak'      // 3+ days of positive mood
  | 'all_habits_complete'  // All habits done today
  | 'focus_reflection'     // After focus session
  | 'evening_checkin'      // Evening prompt
  | 'weekly_review'        // Weekly summary
  | 'streak_rest'          // After streak break / rest mode
  | 'daily_mindfulness'    // Fallback daily prompt when no context triggers fire
  | 'manual';              // User opened journal directly

/** Lightweight reflection record (not a full journal entry) */
export interface MicroReflection {
  id: string;
  text: string;                        // 1 word to 2 sentences
  depth: ReflectionDepth;
  trigger: ReflectionTrigger;
  date: string;                        // YYYY-MM-DD
  timestamp: number;
  linkedMoodId?: string;               // If prompted by mood
  linkedHabitIds?: string[];           // If prompted by habit completion
  linkedFocusSessionId?: string;       // If prompted by focus reflection
  expandedToJournalId?: string;        // If user expanded to full entry
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
