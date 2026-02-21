import { supabase } from "@/lib/supabaseClient";
import { ReminderSettings } from "@/types";
import { syncOrchestrator } from "@/lib/syncOrchestrator";
import { logger } from "@/lib/logger";

// Circuit breaker: after first schema/table error, skip all attempts this session.
// Resets on page reload (module re-import).
let reminderSyncDisabled = false;

export const syncReminderSettings = async (
  reminders: ReminderSettings,
  language: string
) => {
  if (!supabase || reminderSyncDisabled) return;

  // Use orchestrator for queue-based sync
  await syncOrchestrator.sync('reminders', async () => {
    const {
      data: { session },
      error: authError
    } = await supabase.auth.getSession();

    if (authError || !session?.user) {
      // Silently skip if not authenticated - not an error condition
      logger.log('[ReminderSync] Not authenticated, skipping sync');
      return;
    }
    const user = session.user;

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

    // Ensure arrays are valid (Supabase expects proper array types)
    const safeDays = Array.isArray(reminders.days)
      ? reminders.days.filter(d => typeof d === 'number')
      : [];
    const safeHabitIds = Array.isArray(reminders.habitIds)
      ? reminders.habitIds.filter(id => typeof id === 'string')
      : [];

    const payload = {
      user_id: user.id,
      enabled: Boolean(reminders.enabled),
      // 3 mood times for morning/afternoon/evening check-ins
      mood_time_morning: reminders.moodTimeMorning || null,
      mood_time_afternoon: reminders.moodTimeAfternoon || null,
      mood_time_evening: reminders.moodTimeEvening || null,
      habit_time: reminders.habitTime || null,
      focus_time: reminders.focusTime || null,
      days: safeDays,
      quiet_start: reminders.quietHours?.start || null,
      quiet_end: reminders.quietHours?.end || null,
      habit_ids: safeHabitIds,
      timezone,
      language,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from("user_reminder_settings").upsert(payload, {
      onConflict: "user_id"
    });

    if (error) {
      // Don't throw on table-related errors - the table might not exist yet in Supabase
      // This is a non-critical feature, so we log and continue
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        reminderSyncDisabled = true;
        logger.warn('[ReminderSync] Table does not exist, disabling sync for this session');
        return;
      }

      // Handle 400 Bad Request errors (schema mismatch, missing columns, etc.)
      // These are common when migrations haven't been applied yet
      if (error.code === 'PGRST204' || error.message.includes('violates') ||
          error.code?.startsWith('PGRST') || error.message.includes('Bad Request')) {
        reminderSyncDisabled = true;
        logger.warn('[ReminderSync] Schema mismatch, disabling sync for this session');
        return;
      }

      // For other unexpected errors, log with details for debugging
      logger.error('[ReminderSync] Unexpected error:', error.code, error.message);
      // Don't throw - reminder sync is not critical
    }
  }, { priority: 7, maxRetries: 0 }); // No retries - settings sync failures shouldn't loop
};
