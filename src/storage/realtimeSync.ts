/**
 * Real-time Sync Service
 * Provides granular sync for individual data items (moods, habits, etc.)
 * Uses offline queue when device is offline for reliable sync.
 * Falls back to full backup sync if granular sync fails.
 */

import { logger } from '@/lib/logger';
import { addCategorizedBreadcrumb } from '@/lib/sentry';
import { isAbortError } from '@/lib/validation';
import { supabase, getCurrentUserId } from '@/lib/supabaseClient';
import { db } from '@/storage/db';
import { MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';
import { Database } from '@/types/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { offlineQueue } from '@/lib/offlineQueue';

// Type aliases for Supabase table rows (LOW priority fix: replace `as any[]`)
type MoodRow = Database['public']['Tables']['moods']['Row'];
type HabitRow = Database['public']['Tables']['habits']['Row'];
type HabitCompletionRow = Database['public']['Tables']['habit_completions']['Row'];
type HabitReminderRow = Database['public']['Tables']['habit_reminders']['Row'];
type FocusSessionRow = Database['public']['Tables']['focus_sessions']['Row'];
type GratitudeEntryRow = Database['public']['Tables']['gratitude_entries']['Row'];
type UserSettingsRow = Database['public']['Tables']['user_settings']['Row'];

// Track active subscriptions
let realtimeChannel: RealtimeChannel | null = null;

/**
 * P0 Fix: Robust network error detection
 * Uses multiple signals instead of fragile string matching:
 * 1. navigator.onLine - browser's network status
 * 2. error.name - DOMException names like 'NetworkError'
 * 3. error.code - numeric error codes (some browsers use these)
 * 4. String patterns as fallback for edge cases
 *
 * NOTE: AbortError is NOT a network error - it's handled separately
 */
const detectNetworkError = (error: unknown): boolean => {
  // First check: browser reports offline
  if (!navigator.onLine) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  // AbortError is NOT a network error - it's intentional cancellation
  if (isAbortError(error)) {
    return false;
  }

  // Check error name (more reliable than message)
  const networkErrorNames = [
    'NetworkError',
    'TimeoutError',
    'TypeError',       // fetch failures are often TypeErrors
  ];
  if (networkErrorNames.includes(error.name)) {
    // TypeError is only network-related if it's a fetch error
    if (error.name === 'TypeError') {
      return error.message.includes('fetch') || error.message.includes('network');
    }
    return true;
  }

  // Check for DOMException with network-related code
  if (error instanceof DOMException) {
    // NetworkError is code 19 in some browsers
    if (error.code === 19 || error.name === 'NetworkError') {
      return true;
    }
  }

  // Fallback: check message for known patterns (case-insensitive)
  const message = error.message.toLowerCase();
  const networkPatterns = [
    'network',
    'failed to fetch',
    'fetch failed',
    'networkerror',
    'econnrefused',
    'etimedout',
    'enotfound',
    'enetunreach',
    'connection refused',
    'connection reset',
    'socket hang up',
    'dns',
  ];

  return networkPatterns.some(pattern => message.includes(pattern));
};

const BATCH_SIZE = 20; // Max concurrent sync operations
const BATCH_DELAY = 50; // ms between batches

// Process array in batches to avoid overwhelming the backend
async function processBatched<T>(
  items: T[],
  processor: (item: T) => Promise<void>,
  batchSize: number = BATCH_SIZE
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(processor));
    // Small pause between batches to avoid rate limiting
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
  }
}

// ============================================
// MOOD SYNC
// ============================================

export const syncMood = async (mood: MoodEntry): Promise<void> => {
  const userId = await getCurrentUserId();
  // P0 Fix: Explicit validation to prevent RLS violations with undefined user_id
  if (!supabase) return;
  if (!userId) {
    logger.warn('[Sync] Cannot sync mood: User not authenticated');
    return;
  }

  addCategorizedBreadcrumb('sync', 'Starting mood sync', { moodId: mood.id, date: mood.date });

  // If offline, queue for later sync
  if (!navigator.onLine) {
    await offlineQueue.enqueue('CREATE_MOOD', mood.id, mood);
    addCategorizedBreadcrumb('sync', 'Mood queued (offline)', { moodId: mood.id });
    logger.log('[Sync] Mood queued for offline sync:', mood.id);
    return;
  }

  try {
    const { error } = await supabase.from('moods').upsert({
      id: mood.id,
      user_id: userId,
      mood: mood.mood,
      note: mood.note || null,
      tags: mood.tags || [],
      date: mood.date,
      timestamp: mood.timestamp,
      emotion: mood.emotion || null,
    }, { onConflict: 'id' });

    if (error) throw error;
    addCategorizedBreadcrumb('sync', 'Mood synced successfully', { moodId: mood.id });
    logger.log('[Sync] Mood synced:', mood.id);
  } catch (error) {
    // P0 Fix: Handle AbortError separately - it's intentional, don't retry/queue
    if (isAbortError(error)) {
      addCategorizedBreadcrumb('sync', 'Mood sync aborted', { moodId: mood.id }, 'warning');
      logger.warn('[Sync] Mood sync aborted (timeout or navigation):', mood.id);
      return; // Don't retry, don't queue - this was intentional
    }

    // P0 Fix: More robust network error detection
    // Check multiple signals instead of relying on fragile string matching
    const isNetworkError = detectNetworkError(error);

    if (isNetworkError) {
      await offlineQueue.enqueue('CREATE_MOOD', mood.id, mood);
      addCategorizedBreadcrumb('sync', 'Mood queued (network error)', { moodId: mood.id }, 'warning');
      logger.log('[Sync] Mood queued after network error:', mood.id);
      // Don't re-throw network errors - they're handled via offline queue
    } else {
      addCategorizedBreadcrumb('sync', 'Mood sync failed', { moodId: mood.id, error: (error as Error).message }, 'error');
      logger.error('[Sync] Failed to sync mood:', error);
      // P0-4 Fix: Re-throw so callers (especially offline queue handlers) know sync failed
      // Without this, the offline queue removes the action thinking it succeeded
      throw error;
    }
  }
};

export const deleteMoodFromCloud = async (moodId: string): Promise<void> => {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return;

  // If offline, queue for later
  if (!navigator.onLine) {
    await offlineQueue.enqueue('DELETE_MOOD', moodId, { id: moodId });
    logger.log('[Sync] Mood delete queued for offline:', moodId);
    return;
  }

  try {
    const { error } = await supabase
      .from('moods')
      .delete()
      .eq('id', moodId)
      .eq('user_id', userId);

    if (error) throw error;
    logger.log('[Sync] Mood deleted:', moodId);
  } catch (error) {
    // P0 Fix: Handle AbortError separately
    if (isAbortError(error)) {
      logger.warn('[Sync] Mood delete aborted (timeout or navigation):', moodId);
      return;
    }
    logger.error('[Sync] Failed to delete mood:', error);
    // P0-4 Fix: Re-throw for offline queue handlers
    throw error;
  }
};

// ============================================
// HABIT SYNC
// ============================================

export const syncHabit = async (habit: Habit): Promise<void> => {
  const userId = await getCurrentUserId();
  // P0 Fix: Explicit validation to prevent RLS violations with undefined user_id
  if (!supabase) return;
  if (!userId) {
    logger.warn('[Sync] Cannot sync habit: User not authenticated');
    return;
  }

  // If offline, queue for later sync
  if (!navigator.onLine) {
    await offlineQueue.enqueue('UPDATE_HABIT', habit.id, habit);
    logger.log('[Sync] Habit queued for offline sync:', habit.id);
    return;
  }

  try {
    // Sync habit metadata
    const { error: habitError } = await supabase.from('habits').upsert({
      id: habit.id,
      user_id: userId,
      name: habit.name,
      icon: habit.icon,
      color: habit.color,
      type: habit.type,
      frequency: habit.frequency,
      custom_days: habit.customDays || [],
      requires_duration: habit.requiresDuration || false,
      target_duration: habit.targetDuration || null,
      start_date: habit.startDate || null,
      daily_target: habit.dailyTarget || 1,
      target_count: habit.targetCount || null,
      template_id: habit.templateId || null,
    }, { onConflict: 'id' });

    if (habitError) throw habitError;

    // Sync completions
    if (habit.completedDates && habit.completedDates.length > 0) {
      const completions = habit.completedDates.map(date => ({
        user_id: userId,
        habit_id: habit.id,
        date,
        count: habit.completionsByDate?.[date] || 1,
        duration: habit.durationByDate?.[date] || null,
      }));

      const { error: completionError } = await supabase
        .from('habit_completions')
        .upsert(completions, { onConflict: 'habit_id,date' });

      if (completionError) throw completionError;
    }

    // Sync reminders - use safe insert-then-delete pattern to prevent data loss
    if (habit.reminders && habit.reminders.length > 0) {
      // Generate deterministic IDs based on habit + time + days
      const generateReminderId = (habitId: string, time: string, days: number[]) =>
        `${habitId}-${time}-${days.sort().join('')}`;

      const reminders = habit.reminders.map(r => ({
        id: generateReminderId(habit.id, r.time, r.days),
        user_id: userId,
        habit_id: habit.id,
        enabled: r.enabled,
        time: r.time,
        days: r.days,
      }));

      // Upsert reminders (safe - won't lose data on failure)
      const { error: reminderError } = await supabase
        .from('habit_reminders')
        .upsert(reminders, { onConflict: 'id' });

      if (reminderError) throw reminderError;

      // Clean up orphan reminders (non-critical - duplicates are better than data loss)
      const currentIds = reminders.map(r => r.id);
      const { error: cleanupError } = await supabase
        .from('habit_reminders')
        .delete()
        .eq('habit_id', habit.id)
        .not('id', 'in', `(${currentIds.map(id => `'${id}'`).join(',')})`);

      if (cleanupError) {
        logger.warn('[Sync] Failed to cleanup old reminders for habit:', habit.id, cleanupError);
        // Non-critical - continue anyway
      }
    } else {
      // No reminders - safe to delete all
      const { error: deleteError } = await supabase
        .from('habit_reminders')
        .delete()
        .eq('habit_id', habit.id);

      if (deleteError) {
        logger.warn('[Sync] Failed to delete reminders for habit:', habit.id, deleteError);
      }
    }

    logger.log('[Sync] Habit synced:', habit.id);
  } catch (error) {
    // P0 Fix: Handle AbortError separately
    if (isAbortError(error)) {
      logger.warn('[Sync] Habit sync aborted (timeout or navigation):', habit.id);
      return;
    }
    logger.error('[Sync] Failed to sync habit:', error);
    // P0-4 Fix: Re-throw for offline queue handlers
    throw error;
  }
};

export const deleteHabitFromCloud = async (habitId: string): Promise<void> => {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return;

  // If offline, queue for later
  if (!navigator.onLine) {
    await offlineQueue.enqueue('DELETE_HABIT', habitId, { id: habitId });
    logger.log('[Sync] Habit delete queued for offline:', habitId);
    return;
  }

  try {
    const { error } = await supabase
      .from('habits')
      .delete()
      .eq('id', habitId)
      .eq('user_id', userId);

    if (error) throw error;
    logger.log('[Sync] Habit deleted:', habitId);
  } catch (error) {
    // P0 Fix: Handle AbortError separately
    if (isAbortError(error)) {
      logger.warn('[Sync] Habit delete aborted (timeout or navigation):', habitId);
      return;
    }
    logger.error('[Sync] Failed to delete habit:', error);
    // P0-4 Fix: Re-throw for offline queue handlers
    throw error;
  }
};

/**
 * Sync habit completion to cloud
 * P1-9 Fix: Now includes offline queue support and error re-throw
 */
export const syncHabitCompletion = async (habitId: string, date: string, completed: boolean, count?: number, duration?: number): Promise<void> => {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return;

  // P1-9 Fix: Add offline queue support (was missing)
  if (!navigator.onLine) {
    await offlineQueue.enqueue('TOGGLE_HABIT', `${habitId}_${date}`, {
      habitId,
      date,
      completed,
      count,
      duration,
    });
    logger.log('[Sync] Habit completion queued for offline:', habitId, date);
    return;
  }

  try {
    if (completed) {
      const { error } = await supabase.from('habit_completions').upsert({
        user_id: userId,
        habit_id: habitId,
        date,
        count: count || 1,
        duration: duration || null,
      }, { onConflict: 'habit_id,date' });

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('habit_completions')
        .delete()
        .eq('habit_id', habitId)
        .eq('date', date);

      if (error) throw error;
    }
    logger.log('[Sync] Habit completion synced:', habitId, date, completed);
  } catch (error) {
    // P0 Fix: Handle AbortError separately
    if (isAbortError(error)) {
      logger.warn('[Sync] Habit completion sync aborted:', habitId, date);
      return;
    }
    logger.error('[Sync] Failed to sync habit completion:', error);
    // P0-4 Fix: Re-throw for retry logic
    throw error;
  }
};

// ============================================
// FOCUS SESSION SYNC
// ============================================

export const syncFocusSession = async (session: FocusSession): Promise<void> => {
  const userId = await getCurrentUserId();
  // P0 Fix: Explicit validation to prevent RLS violations with undefined user_id
  if (!supabase) return;
  if (!userId) {
    logger.warn('[Sync] Cannot sync focus session: User not authenticated');
    return;
  }

  // If offline, queue for later sync
  if (!navigator.onLine) {
    await offlineQueue.enqueue('CREATE_FOCUS_SESSION', session.id, session);
    logger.log('[Sync] Focus session queued for offline sync:', session.id);
    return;
  }

  try {
    const { error } = await supabase.from('focus_sessions').upsert({
      id: session.id,
      user_id: userId,
      duration: session.duration,
      label: session.label || null,
      status: session.status || 'completed',
      reflection: session.reflection || null,
      date: session.date,
      completed_at: session.completedAt,
    }, { onConflict: 'id' });

    if (error) throw error;
    logger.log('[Sync] Focus session synced:', session.id);
  } catch (error) {
    // P0 Fix: Handle AbortError separately
    if (isAbortError(error)) {
      logger.warn('[Sync] Focus session sync aborted:', session.id);
      return;
    }
    logger.error('[Sync] Failed to sync focus session:', error);
    // P0-4 Fix: Re-throw for offline queue handlers
    throw error;
  }
};

// ============================================
// GRATITUDE SYNC
// ============================================

export const syncGratitude = async (entry: GratitudeEntry): Promise<void> => {
  const userId = await getCurrentUserId();
  // P0 Fix: Explicit validation to prevent RLS violations with undefined user_id
  if (!supabase) return;
  if (!userId) {
    logger.warn('[Sync] Cannot sync gratitude: User not authenticated');
    return;
  }

  // If offline, queue for later sync
  if (!navigator.onLine) {
    await offlineQueue.enqueue('CREATE_GRATITUDE', entry.id, entry);
    logger.log('[Sync] Gratitude queued for offline sync:', entry.id);
    return;
  }

  try {
    const { error } = await supabase.from('gratitude_entries').upsert({
      id: entry.id,
      user_id: userId,
      text: entry.text,
      date: entry.date,
      timestamp: entry.timestamp,
    }, { onConflict: 'id' });

    if (error) throw error;
    logger.log('[Sync] Gratitude synced:', entry.id);
  } catch (error) {
    // P0 Fix: Handle AbortError separately
    if (isAbortError(error)) {
      logger.warn('[Sync] Gratitude sync aborted:', entry.id);
      return;
    }
    logger.error('[Sync] Failed to sync gratitude:', error);
    // P0-4 Fix: Re-throw for offline queue handlers
    throw error;
  }
};

export const deleteGratitudeFromCloud = async (entryId: string): Promise<void> => {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return;

  // If offline, queue for later
  if (!navigator.onLine) {
    await offlineQueue.enqueue('DELETE_GRATITUDE', entryId, { id: entryId });
    logger.log('[Sync] Gratitude delete queued for offline:', entryId);
    return;
  }

  try {
    const { error } = await supabase
      .from('gratitude_entries')
      .delete()
      .eq('id', entryId)
      .eq('user_id', userId);

    if (error) throw error;
    logger.log('[Sync] Gratitude deleted:', entryId);
  } catch (error) {
    // P0 Fix: Handle AbortError separately
    if (isAbortError(error)) {
      logger.warn('[Sync] Gratitude delete aborted:', entryId);
      return;
    }
    logger.error('[Sync] Failed to delete gratitude:', error);
    // P0-4 Fix: Re-throw for offline queue handlers
    throw error;
  }
};

// ============================================
// SETTINGS SYNC
// ============================================

export const syncSetting = async (key: string, value: unknown): Promise<void> => {
  const userId = await getCurrentUserId();
  // P0 Fix: Explicit validation to prevent RLS violations with undefined user_id
  if (!supabase) return;
  if (!userId) {
    logger.warn('[Sync] Cannot sync setting: User not authenticated');
    return;
  }

  try {
    const { error } = await supabase.from('user_settings').upsert({
      user_id: userId,
      key,
      value,
    }, { onConflict: 'user_id,key' });

    if (error) throw error;
    logger.log('[Sync] Setting synced:', key);
  } catch (error) {
    // P0 Fix: Handle AbortError separately
    if (isAbortError(error)) {
      logger.warn('[Sync] Setting sync aborted:', key);
      return;
    }
    logger.error('[Sync] Failed to sync setting:', error);
    // P0-4 Fix: Re-throw for offline queue handlers
    throw error;
  }
};

// ============================================
// FULL PULL FROM CLOUD
// ============================================

export const pullFromCloud = async (): Promise<boolean> => {
  const userId = await getCurrentUserId();
  // P0 Fix: Explicit validation to prevent RLS violations with undefined user_id
  if (!supabase) return false;
  if (!userId) {
    logger.warn('[Sync] Cannot pull from cloud: User not authenticated');
    return false;
  }

  addCategorizedBreadcrumb('sync', 'Starting pullFromCloud');

  try {
    // Fetch all data in parallel
    const [
      moodsRes,
      habitsRes,
      completionsRes,
      remindersRes,
      focusRes,
      gratitudeRes,
      settingsRes,
    ] = await Promise.all([
      supabase.from('moods').select('*').eq('user_id', userId),
      supabase.from('habits').select('*').eq('user_id', userId).eq('is_archived', false),
      supabase.from('habit_completions').select('*').eq('user_id', userId),
      supabase.from('habit_reminders').select('*').eq('user_id', userId),
      supabase.from('focus_sessions').select('*').eq('user_id', userId),
      supabase.from('gratitude_entries').select('*').eq('user_id', userId),
      supabase.from('user_settings').select('*').eq('user_id', userId),
    ]);

    // Check for errors
    if (moodsRes.error) throw moodsRes.error;
    if (habitsRes.error) throw habitsRes.error;
    if (completionsRes.error) throw completionsRes.error;
    if (remindersRes.error) throw remindersRes.error;
    if (focusRes.error) throw focusRes.error;
    if (gratitudeRes.error) throw gratitudeRes.error;
    if (settingsRes.error) throw settingsRes.error;

    // Type-safe Supabase data (LOW priority fix: replaced `as any[]` with proper types)
    const moodsData: MoodRow[] = moodsRes.data || [];
    const habitsData: HabitRow[] = habitsRes.data || [];
    const completionsData: HabitCompletionRow[] = completionsRes.data || [];
    const remindersData: HabitReminderRow[] = remindersRes.data || [];
    const focusData: FocusSessionRow[] = focusRes.data || [];
    const gratitudeData: GratitudeEntryRow[] = gratitudeRes.data || [];
    const settingsData: UserSettingsRow[] = settingsRes.data || [];

    // Transform cloud data to local format
    const moods: MoodEntry[] = moodsData.map(m => ({
      id: m.id,
      mood: m.mood,
      note: m.note || undefined,
      date: m.date,
      timestamp: m.timestamp,
      tags: m.tags,
      emotion: m.emotion || undefined,
    }));

    // Group completions and reminders by habit
    const completionsByHabit = new Map<string, { dates: string[], byDate: Record<string, number>, durationByDate: Record<string, number> }>();
    for (const c of completionsData) {
      if (!completionsByHabit.has(c.habit_id)) {
        completionsByHabit.set(c.habit_id, { dates: [], byDate: {}, durationByDate: {} });
      }
      const habitCompletions = completionsByHabit.get(c.habit_id)!;
      habitCompletions.dates.push(c.date);
      habitCompletions.byDate[c.date] = c.count;
      if (c.duration) {
        habitCompletions.durationByDate[c.date] = c.duration;
      }
    }

    const remindersByHabit = new Map<string, Array<{ enabled: boolean; time: string; days: number[] }>>();
    for (const r of remindersData) {
      if (!remindersByHabit.has(r.habit_id)) {
        remindersByHabit.set(r.habit_id, []);
      }
      remindersByHabit.get(r.habit_id)!.push({
        enabled: r.enabled,
        time: r.time,
        days: r.days,
      });
    }

    const habits: Habit[] = habitsData.map(h => {
      const completions = completionsByHabit.get(h.id);
      const reminders = remindersByHabit.get(h.id) || [];
      return {
        id: h.id,
        name: h.name,
        icon: h.icon,
        color: h.color,
        completedDates: completions?.dates || [],
        createdAt: new Date(h.created_at).getTime(),
        templateId: h.template_id || undefined,
        type: h.type,
        reminders,
        frequency: h.frequency,
        customDays: h.custom_days,
        requiresDuration: h.requires_duration,
        targetDuration: h.target_duration || undefined,
        startDate: h.start_date || undefined,
        dailyTarget: h.daily_target,
        targetCount: h.target_count || undefined,
        completionsByDate: completions?.byDate,
        durationByDate: completions?.durationByDate,
      };
    });

    const focusSessions: FocusSession[] = focusData.map(f => ({
      id: f.id,
      duration: f.duration,
      completedAt: f.completed_at,
      date: f.date,
      label: f.label || undefined,
      status: f.status,
      reflection: f.reflection || undefined,
    }));

    const gratitudeEntries: GratitudeEntry[] = gratitudeData.map(g => ({
      id: g.id,
      text: g.text,
      date: g.date,
      timestamp: g.timestamp,
    }));

    // P2-4 Fix: Save to local DB with explicit transaction error handling
    // Dexie transactions are atomic - if any operation fails, all changes roll back
    try {
      await db.transaction('rw', db.moods, db.habits, db.focusSessions, db.gratitudeEntries, db.settings, async () => {
        // Upsert all data
        if (moods.length) await db.moods.bulkPut(moods);
        if (habits.length) await db.habits.bulkPut(habits);
        if (focusSessions.length) await db.focusSessions.bulkPut(focusSessions);
        if (gratitudeEntries.length) await db.gratitudeEntries.bulkPut(gratitudeEntries);

        // Settings
        for (const s of settingsData) {
          await db.settings.put({ key: s.key, value: s.value });
        }
      });
    } catch (transactionError) {
      // P2-4 Fix: Emit event for UI awareness when transaction fails
      logger.error('[Sync] Transaction failed during pullFromCloud:', transactionError);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('zenflow:sync-transaction-failed', {
          detail: {
            operation: 'pullFromCloud',
            error: transactionError instanceof Error ? transactionError.message : 'Transaction failed',
            dataAffected: { moods: moods.length, habits: habits.length, focusSessions: focusSessions.length, gratitudeEntries: gratitudeEntries.length }
          }
        }));
      }
      throw transactionError; // Re-throw to be caught by outer catch
    }

    addCategorizedBreadcrumb('sync', 'pullFromCloud completed', {
      moods: moods.length,
      habits: habits.length,
      focusSessions: focusSessions.length,
      gratitudeEntries: gratitudeEntries.length,
    });
    logger.log('[Sync] Pulled from cloud:', {
      moods: moods.length,
      habits: habits.length,
      focusSessions: focusSessions.length,
      gratitudeEntries: gratitudeEntries.length,
    });

    return true;
  } catch (error) {
    // P0 Fix: Handle AbortError gracefully
    if (isAbortError(error)) {
      addCategorizedBreadcrumb('sync', 'pullFromCloud aborted', {}, 'warning');
      logger.warn('[Sync] pullFromCloud aborted (timeout or navigation)');
      return false;
    }
    addCategorizedBreadcrumb('sync', 'pullFromCloud failed', { error: (error as Error).message }, 'error');
    logger.error('[Sync] Failed to pull from cloud:', error);
    return false;
  }
};

// ============================================
// FULL PUSH TO CLOUD
// ============================================

export const pushToCloud = async (): Promise<boolean> => {
  const userId = await getCurrentUserId();
  // P0 Fix: Explicit validation to prevent RLS violations with undefined user_id
  if (!supabase) return false;
  if (!userId) {
    logger.warn('[Sync] Cannot push to cloud: User not authenticated');
    return false;
  }

  addCategorizedBreadcrumb('sync', 'Starting pushToCloud');

  try {
    const [moods, habits, focusSessions, gratitudeEntries, settings] = await Promise.all([
      db.moods.toArray(),
      db.habits.toArray(),
      db.focusSessions.toArray(),
      db.gratitudeEntries.toArray(),
      db.settings.toArray(),
    ]);

    // Sync all data in batches to avoid overwhelming the backend
    await processBatched(moods, m => syncMood(m));
    await processBatched(habits, h => syncHabit(h));
    await processBatched(focusSessions, f => syncFocusSession(f));
    await processBatched(gratitudeEntries, g => syncGratitude(g));
    await processBatched(settings, s => syncSetting(s.key, s.value));

    addCategorizedBreadcrumb('sync', 'pushToCloud completed', {
      moods: moods.length,
      habits: habits.length,
      focusSessions: focusSessions.length,
      gratitudeEntries: gratitudeEntries.length,
    });
    logger.log('[Sync] Pushed to cloud:', {
      moods: moods.length,
      habits: habits.length,
      focusSessions: focusSessions.length,
      gratitudeEntries: gratitudeEntries.length,
    });

    return true;
  } catch (error) {
    // P0 Fix: Handle AbortError gracefully
    if (isAbortError(error)) {
      addCategorizedBreadcrumb('sync', 'pushToCloud aborted', {}, 'warning');
      logger.warn('[Sync] pushToCloud aborted (timeout or navigation)');
      return false;
    }
    addCategorizedBreadcrumb('sync', 'pushToCloud failed', { error: (error as Error).message }, 'error');
    logger.error('[Sync] Failed to push to cloud:', error);
    return false;
  }
};

// ============================================
// REALTIME SUBSCRIPTIONS
// ============================================

/**
 * DISABLED: Realtime subscriptions for core tables
 *
 * Performance optimization: WAL query was consuming 96% of database time.
 * Data now syncs via pullFromCloud() on app resume instead of realtime.
 *
 * friend_challenge_members remains realtime-enabled via challengeService.ts
 * for live leaderboard updates.
 */
export const subscribeToRealtime = async (): Promise<void> => {
  // Disabled to reduce WAL overhead - data syncs on app resume via pullFromCloud()
  logger.log('[Realtime] Subscriptions disabled for performance optimization');
  return;
};

export const unsubscribeFromRealtime = async (): Promise<void> => {
  if (!supabase || !realtimeChannel) return;

  await supabase.removeChannel(realtimeChannel);
  realtimeChannel = null;
  logger.log('[Realtime] Unsubscribed');
};

// P1-10 Fix: Validation helpers for realtime data
const isValidString = (val: unknown): val is string => typeof val === 'string' && val.length > 0;
const isValidNumber = (val: unknown): val is number => typeof val === 'number' && !isNaN(val);
const isValidStringArray = (val: unknown): val is string[] =>
  Array.isArray(val) && val.every(item => typeof item === 'string');

const VALID_MOODS = ['great', 'good', 'okay', 'bad', 'terrible'] as const;
const isValidMood = (val: unknown): val is MoodEntry['mood'] =>
  typeof val === 'string' && (VALID_MOODS as readonly string[]).includes(val);

const VALID_FOCUS_STATUSES = ['completed', 'abandoned', 'paused'] as const;
const isValidFocusStatus = (val: unknown): val is FocusSession['status'] =>
  typeof val === 'string' && (VALID_FOCUS_STATUSES as readonly string[]).includes(val);

// Handle realtime changes from other devices
const handleRealtimeChange = async (table: string, payload: { eventType: string; new: Record<string, unknown> | null; old: Record<string, unknown> | null }) => {
  logger.log('[Realtime] Change received:', table, payload.eventType);

  try {
    switch (table) {
      case 'moods':
        if (payload.eventType === 'DELETE') {
          const oldId = payload.old?.id;
          if (isValidString(oldId)) await db.moods.delete(oldId);
        } else if (payload.new) {
          const moodData = payload.new;
          // P1-10 Fix: Validate all required fields before inserting
          if (
            isValidString(moodData.id) &&
            isValidMood(moodData.mood) &&
            isValidString(moodData.date)
          ) {
            await db.moods.put({
              id: moodData.id,
              mood: moodData.mood,
              note: isValidString(moodData.note) ? moodData.note : undefined,
              date: moodData.date,
              timestamp: isValidNumber(moodData.timestamp) ? moodData.timestamp : Date.now(),
              tags: isValidStringArray(moodData.tags) ? moodData.tags : [],
              emotion: isValidString(moodData.emotion) ? moodData.emotion as MoodEntry['emotion'] : undefined,
            });
          } else {
            logger.warn('[Realtime] Invalid mood data received, skipping:', moodData);
          }
        }
        break;

      case 'focus_sessions':
        if (payload.eventType === 'DELETE') {
          const oldId = payload.old?.id;
          if (isValidString(oldId)) await db.focusSessions.delete(oldId);
        } else if (payload.new) {
          const focusData = payload.new;
          // P1-10 Fix: Validate all required fields before inserting
          if (
            isValidString(focusData.id) &&
            isValidString(focusData.date)
          ) {
            await db.focusSessions.put({
              id: focusData.id,
              duration: isValidNumber(focusData.duration) ? focusData.duration : 0,
              completedAt: isValidNumber(focusData.completed_at) ? focusData.completed_at : Date.now(),
              date: focusData.date,
              label: isValidString(focusData.label) ? focusData.label : undefined,
              status: isValidFocusStatus(focusData.status) ? focusData.status : 'completed',
              reflection: isValidNumber(focusData.reflection) ? focusData.reflection : undefined,
            });
          } else {
            logger.warn('[Realtime] Invalid focus session data received, skipping:', focusData);
          }
        }
        break;

      case 'gratitude_entries':
        if (payload.eventType === 'DELETE') {
          const oldId = payload.old?.id;
          if (isValidString(oldId)) await db.gratitudeEntries.delete(oldId);
        } else if (payload.new) {
          const gratData = payload.new;
          // P1-10 Fix: Validate all required fields before inserting
          if (
            isValidString(gratData.id) &&
            isValidString(gratData.text) &&
            isValidString(gratData.date)
          ) {
            await db.gratitudeEntries.put({
              id: gratData.id,
              text: gratData.text,
              date: gratData.date,
              timestamp: isValidNumber(gratData.timestamp) ? gratData.timestamp : Date.now(),
            });
          } else {
            logger.warn('[Realtime] Invalid gratitude data received, skipping:', gratData);
          }
        }
        break;

      case 'habits':
      case 'habit_completions':
        // For habits, we need to refetch the full habit with completions
        // This is simpler than trying to merge partial updates
        await pullFromCloud();
        break;
    }

    // Dispatch custom event to notify UI
    window.dispatchEvent(new CustomEvent('realtime-sync', { detail: { table, event: payload.eventType } }));
  } catch (error) {
    logger.error('[Realtime] Failed to handle change:', error);
  }
};

// ============================================
// USER STATS
// ============================================

export const fetchUserStats = async () => {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return null;

  try {
    const { data, error } = await supabase.rpc('get_user_stats', { p_user_id: userId });
    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('[Sync] Failed to fetch user stats:', error);
    return null;
  }
};
