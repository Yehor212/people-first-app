import { supabase } from "@/lib/supabaseClient";
import { ReminderSettings } from "@/types";

export const syncReminderSettings = async (
  reminders: ReminderSettings,
  language: string
) => {
  if (!supabase) return;

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return;

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  const payload = {
    user_id: user.id,
    enabled: reminders.enabled,
    mood_time: reminders.moodTime,
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

  await supabase.from("user_reminder_settings").upsert(payload, {
    onConflict: "user_id"
  });
};
