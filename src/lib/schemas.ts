/**
 * Runtime Zod boundary validation schemas for ZenFlow.
 *
 * These schemas validate data coming from IndexedDB, Supabase sync,
 * or any other external boundary. All object schemas use .passthrough()
 * to preserve unknown keys that may exist in newer app versions.
 *
 * Usage:
 *   import { validateArray, runtimeHabitSchema } from '@/lib/schemas';
 *   const habits = validateArray(runtimeHabitSchema, rawHabits, 'habits');
 */

import { z } from 'zod';
import { logger } from '@/lib/logger';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Validate an array of items, keeping only valid ones.
 * Invalid items are filtered out with a warning log.
 */
export function validateArray<T>(
  schema: z.ZodType<T>,
  data: unknown[],
  label: string
): T[] {
  const valid: T[] = [];
  let dropped = 0;
  for (const item of data) {
    const result = schema.safeParse(item);
    if (result.success) {
      valid.push(result.data);
    } else {
      dropped++;
      if (dropped <= 3) {
        logger.warn(`[Schema] Invalid ${label} item dropped:`, result.error.issues[0]);
      }
    }
  }
  if (dropped > 0) {
    logger.warn(`[Schema] Dropped ${dropped}/${data.length} invalid ${label} items`);
  }
  return valid;
}

/**
 * Validate a single object. Returns validated data or null.
 */
export function validateObject<T>(
  schema: z.ZodType<T>,
  data: unknown,
  label: string
): T | null {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  logger.warn(`[Schema] Invalid ${label}:`, result.error.issues[0]);
  return null;
}

// ============================================
// SHARED PRIMITIVES
// ============================================

/** Date string in YYYY-MM-DD format */
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// ============================================
// ENUM SCHEMAS
// ============================================

const moodType = z.enum(['great', 'good', 'okay', 'bad', 'terrible']);
const habitType = z.enum(['continuous', 'daily', 'scheduled', 'multiple', 'reduce']);
const habitFrequency = z.enum(['once', 'daily', 'weekly', 'custom']);
const focusStatus = z.enum(['completed', 'aborted']);
const primaryEmotion = z.enum(['joy', 'trust', 'fear', 'surprise', 'sadness', 'disgust', 'anger', 'anticipation']);
const emotionIntensity = z.enum(['mild', 'moderate', 'intense']);

// ============================================
// SUB-SCHEMAS
// ============================================

/** EmotionData — Plutchik's emotion wheel entry */
const emotionDataSchema = z.object({
  primary: primaryEmotion,
  secondary: z.string().optional(),
  intensity: emotionIntensity,
}).passthrough();

/** HabitReminder — per-habit notification config */
const habitReminderSchema = z.object({
  enabled: z.boolean(),
  time: z.string(),
  days: z.array(z.number()),
}).passthrough();

/** TreatsWallet — unified reward currency state */
const treatsWalletSchema = z.object({
  balance: z.number(),
  lifetimeEarned: z.number(),
  lifetimeSpent: z.number(),
  lastEarnedAt: z.number().optional(),
  transactions: z.array(z.unknown()),
}).passthrough();

/** Companion — garden mascot (critical for display) */
const companionSchema = z.object({
  type: z.string(),
  name: z.string(),
  mood: z.string(),
  level: z.number(),
  experience: z.number(),
  fullness: z.number(),
  happiness: z.number(),
  hunger: z.number(),
}).passthrough();

// ============================================
// MOOD ENTRY
// ============================================

/** Runtime schema for MoodEntry */
export const runtimeMoodEntrySchema = z.object({
  id: z.string().min(1),
  mood: moodType,
  date: dateString,
  timestamp: z.number(),
  note: z.string().optional(),
  tags: z.array(z.string()).optional(),
  emotion: emotionDataSchema.optional(),
}).passthrough();

// ============================================
// HABIT
// ============================================

/**
 * Runtime schema for Habit.
 * Uses .default() for fields that old data may lack so that
 * pre-v1.4 habits without type/frequency/reminders still parse.
 */
export const runtimeHabitSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  icon: z.string(),
  color: z.string(),
  completedDates: z.array(z.string()),
  createdAt: z.number(),
  type: habitType.default('daily'),
  reminders: z.array(habitReminderSchema).default([]),
  frequency: habitFrequency.default('daily'),
  // All optional fields
  templateId: z.string().optional(),
  category: z.string().optional(),
  customDays: z.array(z.number()).optional(),
  requiresDuration: z.boolean().optional(),
  targetDuration: z.number().optional(),
  durationByDate: z.record(z.string(), z.number()).optional(),
  startDate: z.string().optional(),
  failedDates: z.array(z.string()).optional(),
  progressByDate: z.record(z.string(), z.number()).optional(),
  targetCount: z.number().optional(),
  dailyTarget: z.number().optional(),
  completionsByDate: z.record(z.string(), z.number()).optional(),
  // Identity cluster (IA Blueprint Phase 2)
  identityCluster: z.string().optional(),
  identityVerb: z.string().optional(),
  identityIcon: z.string().optional(),
}).passthrough();

// ============================================
// FOCUS SESSION
// ============================================

/** Runtime schema for FocusSession */
export const runtimeFocusSessionSchema = z.object({
  id: z.string().min(1),
  duration: z.number().min(0),
  completedAt: z.number(),
  date: dateString,
  label: z.string().optional(),
  status: focusStatus.optional(),
  reflection: z.number().optional(),
}).passthrough();

// ============================================
// GRATITUDE ENTRY
// ============================================

/** Runtime schema for GratitudeEntry */
export const runtimeGratitudeEntrySchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  date: dateString,
  timestamp: z.number(),
}).passthrough();

// ============================================
// SETTINGS SCHEMAS
// ============================================

/** ReminderSettings — notification schedule config */
export const reminderSettingsSchema = z.object({
  enabled: z.boolean(),
  moodTimeMorning: z.string(),
  moodTimeAfternoon: z.string(),
  moodTimeEvening: z.string(),
  habitTime: z.string(),
  focusTime: z.string(),
  days: z.array(z.number()),
  quietHours: z.object({
    start: z.string(),
    end: z.string(),
  }),
  habitIds: z.array(z.string()),
  moodTime: z.string().optional(),
}).passthrough();

/** PrivacySettings — GDPR-compliant tracking preferences */
export const privacySettingsSchema = z.object({
  noTracking: z.boolean(),
  analytics: z.boolean(),
  consentShown: z.boolean().optional(),
  adConsent: z.boolean().optional(),
}).passthrough();

// ============================================
// SCHEDULE EVENT
// ============================================

/** ScheduleEvent — daily planner time block */
export const scheduleEventSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  startHour: z.number(),
  startMinute: z.number(),
  endHour: z.number(),
  endMinute: z.number(),
  color: z.string(),
  date: z.string(),
  // All optional fields
  colorVar: z.string().optional(),
  urgent: z.boolean().optional(),
  emoji: z.string().optional(),
  note: z.string().optional(),
  source: z.enum(['manual', 'habit', 'task', 'google']).optional(),
  habitId: z.string().optional(),
  taskId: z.string().optional(),
  isAutoGenerated: z.boolean().optional(),
  isEditable: z.boolean().optional(),
}).passthrough();

// ============================================
// INNER WORLD
// ============================================

/**
 * InnerWorld — structural validation.
 * Validates top-level fields and critical nested objects (treats, companion).
 * Arrays like plants/creatures use z.unknown() for flexibility.
 */
export const innerWorldSchema = z.object({
  treats: treatsWalletSchema,
  gardenStage: z.string(),
  plants: z.array(z.unknown()),
  creatures: z.array(z.unknown()),
  weather: z.string(),
  season: z.string(),
  companion: companionSchema,
  totalPlantsGrown: z.number(),
  totalCreaturesAttracted: z.number(),
  daysActive: z.number(),
  longestActiveStreak: z.number(),
  currentActiveStreak: z.number(),
  lastActiveDate: z.string(),
  // Active temporary effects (IA Blueprint Phase 4)
  activeEffects: z.object({
    wind: z.object({ until: z.number() }).optional(),
  }).optional(),
}).passthrough();

// ============================================
// GAMIFICATION STATE
// ============================================

/**
 * GamificationState — XP, achievements, and progress tracking.
 * Keys in achievementProgress are AchievementId strings.
 */
export const gamificationStateSchema = z.object({
  totalXp: z.number(),
  unlockedAchievements: z.array(z.string()),
  achievementProgress: z.record(z.string(), z.number()),
  lastClaimedReward: z.string().optional(),
  shownAchievementToasts: z.array(z.string()).optional(),
}).passthrough();

// ============================================
// MICRO REFLECTION (IA Blueprint Phase 3)
// ============================================

const reflectionDepth = z.enum(['nano', 'micro', 'deep']);
const reflectionTrigger = z.enum([
  'mood_joy_streak', 'all_habits_complete', 'focus_reflection',
  'evening_checkin', 'weekly_review', 'streak_rest', 'daily_mindfulness', 'manual',
]);

/** MicroReflection — lightweight reflection record */
export const microReflectionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  depth: reflectionDepth,
  trigger: reflectionTrigger,
  date: dateString,
  timestamp: z.number(),
  linkedMoodId: z.string().optional(),
  linkedHabitIds: z.array(z.string()).optional(),
  linkedFocusSessionId: z.string().optional(),
  expandedToJournalId: z.string().optional(),
}).passthrough();
