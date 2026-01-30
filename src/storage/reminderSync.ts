import { supabase } from "@/lib/supabaseClient";
import { ReminderSettings } from "@/types";
import { syncOrchestrator } from "@/lib/syncOrchestrator";
import { logger } from "@/lib/logger";

export const syncReminderSettings = async (
  reminders: ReminderSettings,
  language: string
) => {
  if (!supabase) return;

  // Use orchestrator for queue-based sync
  await syncOrchestrator.sync('reminders', async () => {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) return;

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

    const payload = {
      user_id: user.id,
      enabled: reminders.enabled,
      // 3 mood times for morning/afternoon/evening check-ins
      mood_time_morning: reminders.moodTimeMorning,
      mood_time_afternoon: reminders.moodTimeAfternoon,
      mood_time_evening: reminders.moodTimeEvening,
      habit_time: reminders.habitTime,
      focus_time: reminders.focusTime,
      days: reminders.days,
      quiet_start: reminders.quietHours.start,
      quiet_end: reminders.quietHours.end,
      habit_ids: reminders.habitIds,
      timezone,
      language,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from("user_reminder_settings").upsert(payload, {
      onConflict: "user_id"
    });

    if (error) {
      logger.error('[ReminderSync] Failed to push settings:', error);
      throw new Error(error.message);
    }
  }, { priority: 7, maxRetries: 0 }); // No retries - settings sync failures shouldn't loop
};
