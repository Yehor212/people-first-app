import type { Translations } from "@/i18n/types";
import type { ReminderCopy } from "@/lib/localNotifications";

type ReminderTranslationSource = Pick<
  Translations,
  | "reminderMoodTitle"
  | "reminderMoodBody"
  | "reminderHabitTitle"
  | "reminderHabitBody"
  | "reminderFocusTitle"
  | "reminderFocusBody"
>;

/**
 * Canonical copy shared by startup reconciliation and Settings sound changes.
 * Habit notification copy stays generic so user-authored habit names never
 * appear on lock screens or other system notification surfaces.
 */
export function buildReminderCopy(t: ReminderTranslationSource): ReminderCopy {
  return {
    mood: { title: t.reminderMoodTitle, body: t.reminderMoodBody },
    habit: { title: t.reminderHabitTitle, body: t.reminderHabitBody },
    focus: { title: t.reminderFocusTitle, body: t.reminderFocusBody },
  };
}
