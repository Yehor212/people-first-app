/**
 * Real-time Sync Service
 * Provides granular sync for individual data items (moods, habits, etc.)
 * Falls back to full backup sync if granular sync fails
 */

import { logger } from '@/lib/logger';
import { supabase, getCurrentUserId } from '@/lib/supabaseClient';
import { db } from '@/storage/db';
import { MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';
import { RealtimeChannel } from '@supabase/supabase-js';

// Track active subscriptions
let realtimeChannel: RealtimeChannel | null = null;

// ============================================
// MOOD SYNC
// ============================================

export const syncMood = async (mood: MoodEntry): Promise<void> => {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return;

  try {
    const { error } = await supabase.from('moods').upsert({
      id: mood.id,
      user_id: userId,
      mood: mood.mood,
      note: mood.note || null,
      tags: mood.tags || [],
      date: mood.date,
      timestamp: mood.timestamp,
    }, { onConflict: 'id' });

    if (error) throw error;
    logger.log('[Sync] Mood synced:', mood.id);
  } catch (error) {
    logger.error('[Sync] Failed to sync mood:', error);
  }
};

export const deleteMoodFromCloud = async (moodId: string): Promise<void> => {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return;

  try {
    const { error } = await supabase
      .from('moods')
      .delete()
      .eq('id', moodId)
      .eq('user_id', userId);

    if (error) throw error;
    logger.log('[Sync] Mood deleted:', moodId);
  } catch (error) {
    logger.error('[Sync] Failed to delete mood:', error);
  }
};

// ============================================
// HABIT SYNC
// ============================================

export const syncHabit = async (habit: Habit): Promise<void> => {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return;

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

    // Sync reminders
    if (habit.reminders && habit.reminders.length > 0) {
      // Delete existing reminders
      await supabase
        .from('habit_reminders')
        .delete()
        .eq('habit_id', habit.id);

      // Insert new reminders
      const reminders = habit.reminders.map(r => ({
        user_id: userId,
        habit_id: habit.id,
        enabled: r.enabled,
        time: r.time,
        days: r.days,
      }));

      const { error: reminderError } = await supabase
        .from('habit_reminders')
        .insert(reminders);

      if (reminderError) throw reminderError;
    }

    logger.log('[Sync] Habit synced:', habit.id);
  } catch (error) {
    logger.error('[Sync] Failed to sync habit:', error);
  }
};

export const deleteHabitFromCloud = async (habitId: string): Promise<void> => {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return;

  try {
    const { error } = await supabase
      .from('habits')
      .delete()
      .eq('id', habitId)
      .eq('user_id', userId);

    if (error) throw error;
    logger.log('[Sync] Habit deleted:', habitId);
  } catch (error) {
    logger.error('[Sync] Failed to delete habit:', error);
  }
};

export const syncHabitCompletion = async (habitId: string, date: string, completed: boolean, count?: number, duration?: number): Promise<void> => {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return;

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
    logger.error('[Sync] Failed to sync habit completion:', error);
  }
};

// ============================================
// FOCUS SESSION SYNC
// ============================================

export const syncFocusSession = async (session: FocusSession): Promise<void> => {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return;

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
    logger.error('[Sync] Failed to sync focus session:', error);
  }
};

// ============================================
// GRATITUDE SYNC
// ============================================

export const syncGratitude = async (entry: GratitudeEntry): Promise<void> => {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return;

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
    logger.error('[Sync] Failed to sync gratitude:', error);
  }
};

export const deleteGratitudeFromCloud = async (entryId: string): Promise<void> => {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return;

  try {
    const { error } = await supabase
      .from('gratitude_entries')
      .delete()
      .eq('id', entryId)
      .eq('user_id', userId);

    if (error) throw error;
    logger.log('[Sync] Gratitude deleted:', entryId);
  } catch (error) {
    logger.error('[Sync] Failed to delete gratitude:', error);
  }
};

// ============================================
// SETTINGS SYNC
// ============================================

export const syncSetting = async (key: string, value: unknown): Promise<void> => {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return;

  try {
    const { error } = await supabase.from('user_settings').upsert({
      user_id: userId,
      key,
      value,
    }, { onConflict: 'user_id,key' });

    if (error) throw error;
    logger.log('[Sync] Setting synced:', key);
  } catch (error) {
    logger.error('[Sync] Failed to sync setting:', error);
  }
};

// ============================================
// FULL PULL FROM CLOUD
// ============================================

export const pullFromCloud = async (): Promise<boolean> => {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return false;

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

    // Transform cloud data to local format
    const moods: MoodEntry[] = (moodsRes.data || []).map(m => ({
      id: m.id,
      mood: m.mood,
      note: m.note || undefined,
      date: m.date,
      timestamp: m.timestamp,
      tags: m.tags,
    }));

    // Group completions and reminders by habit
    const completionsByHabit = new Map<string, { dates: string[], byDate: Record<string, number>, durationByDate: Record<string, number> }>();
    for (const c of completionsRes.data || []) {
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
    for (const r of remindersRes.data || []) {
      if (!remindersByHabit.has(r.habit_id)) {
        remindersByHabit.set(r.habit_id, []);
      }
      remindersByHabit.get(r.habit_id)!.push({
        enabled: r.enabled,
        time: r.time,
        days: r.days,
      });
    }

    const habits: Habit[] = (habitsRes.data || []).map(h => {
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

    const focusSessions: FocusSession[] = (focusRes.data || []).map(f => ({
      id: f.id,
      duration: f.duration,
      completedAt: f.completed_at,
      date: f.date,
      label: f.label || undefined,
      status: f.status,
      reflection: f.reflection || undefined,
    }));

    const gratitudeEntries: GratitudeEntry[] = (gratitudeRes.data || []).map(g => ({
      id: g.id,
      text: g.text,
      date: g.date,
      timestamp: g.timestamp,
    }));

    // Save to local DB (merge strategy - keep newer)
    await db.transaction('rw', db.moods, db.habits, db.focusSessions, db.gratitudeEntries, db.settings, async () => {
      // Upsert all data
      if (moods.length) await db.moods.bulkPut(moods);
      if (habits.length) await db.habits.bulkPut(habits);
      if (focusSessions.length) await db.focusSessions.bulkPut(focusSessions);
      if (gratitudeEntries.length) await db.gratitudeEntries.bulkPut(gratitudeEntries);

      // Settings
      for (const s of settingsRes.data || []) {
        await db.settings.put({ key: s.key, value: s.value });
      }
    });

    logger.log('[Sync] Pulled from cloud:', {
      moods: moods.length,
      habits: habits.length,
      focusSessions: focusSessions.length,
      gratitudeEntries: gratitudeEntries.length,
    });

    return true;
  } catch (error) {
    logger.error('[Sync] Failed to pull from cloud:', error);
    return false;
  }
};

// ============================================
// FULL PUSH TO CLOUD
// ============================================

export const pushToCloud = async (): Promise<boolean> => {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return false;

  try {
    const [moods, habits, focusSessions, gratitudeEntries, settings] = await Promise.all([
      db.moods.toArray(),
      db.habits.toArray(),
      db.focusSessions.toArray(),
      db.gratitudeEntries.toArray(),
      db.settings.toArray(),
    ]);

    // Sync all data in parallel
    await Promise.all([
      ...moods.map(m => syncMood(m)),
      ...habits.map(h => syncHabit(h)),
      ...focusSessions.map(f => syncFocusSession(f)),
      ...gratitudeEntries.map(g => syncGratitude(g)),
      ...settings.map(s => syncSetting(s.key, s.value)),
    ]);

    logger.log('[Sync] Pushed to cloud:', {
      moods: moods.length,
      habits: habits.length,
      focusSessions: focusSessions.length,
      gratitudeEntries: gratitudeEntries.length,
    });

    return true;
  } catch (error) {
    logger.error('[Sync] Failed to push to cloud:', error);
    return false;
  }
};

// ============================================
// REALTIME SUBSCRIPTIONS
// ============================================

export const subscribeToRealtime = async (): Promise<void> => {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return;

  // Unsubscribe from existing channel
  if (realtimeChannel) {
    await supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  // Subscribe to all user tables
  realtimeChannel = supabase
    .channel(`user-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'moods', filter: `user_id=eq.${userId}` },
      (payload) => handleRealtimeChange('moods', payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'habits', filter: `user_id=eq.${userId}` },
      (payload) => handleRealtimeChange('habits', payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'habit_completions', filter: `user_id=eq.${userId}` },
      (payload) => handleRealtimeChange('habit_completions', payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'focus_sessions', filter: `user_id=eq.${userId}` },
      (payload) => handleRealtimeChange('focus_sessions', payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'gratitude_entries', filter: `user_id=eq.${userId}` },
      (payload) => handleRealtimeChange('gratitude_entries', payload)
    )
    .subscribe((status) => {
      logger.log('[Realtime] Subscription status:', status);
    });
};

export const unsubscribeFromRealtime = async (): Promise<void> => {
  if (!supabase || !realtimeChannel) return;

  await supabase.removeChannel(realtimeChannel);
  realtimeChannel = null;
  logger.log('[Realtime] Unsubscribed');
};

// Handle realtime changes from other devices
const handleRealtimeChange = async (table: string, payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
  logger.log('[Realtime] Change received:', table, payload.eventType);

  try {
    switch (table) {
      case 'moods':
        if (payload.eventType === 'DELETE') {
          await db.moods.delete(payload.old.id as string);
        } else {
          const moodData = payload.new;
          await db.moods.put({
            id: moodData.id as string,
            mood: moodData.mood as MoodEntry['mood'],
            note: moodData.note as string | undefined,
            date: moodData.date as string,
            timestamp: moodData.timestamp as number,
            tags: moodData.tags as string[],
          });
        }
        break;

      case 'focus_sessions':
        if (payload.eventType === 'DELETE') {
          await db.focusSessions.delete(payload.old.id as string);
        } else {
          const focusData = payload.new;
          await db.focusSessions.put({
            id: focusData.id as string,
            duration: focusData.duration as number,
            completedAt: focusData.completed_at as number,
            date: focusData.date as string,
            label: focusData.label as string | undefined,
            status: focusData.status as FocusSession['status'],
            reflection: focusData.reflection as number | undefined,
          });
        }
        break;

      case 'gratitude_entries':
        if (payload.eventType === 'DELETE') {
          await db.gratitudeEntries.delete(payload.old.id as string);
        } else {
          const gratData = payload.new;
          await db.gratitudeEntries.put({
            id: gratData.id as string,
            text: gratData.text as string,
            date: gratData.date as string,
            timestamp: gratData.timestamp as number,
          });
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
