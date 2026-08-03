import { runWithDataWriteBarrier, runWithSettledDataRead } from "@/hooks/useIndexedDB";
import { normalizeHabit } from "@/lib/habits";
import { logger } from "@/lib/logger";
import { defaultReminderSettings, migrateStoredReminderSettings } from "@/lib/reminders";
import { safeLocalStorageSet } from "@/lib/safeJson";
import { reminderSettingsSchema, runtimeHabitSchema } from "@/lib/schemas";
import { db } from "@/storage/db";
import { getDeletedHabitIds } from "@/storage/deletionTracker";
import { recoverCommittedSettingsValue } from "@/storage/settingsPreferencePersistence";
import type { Habit, ReminderSettings } from "@/types";

const REMINDER_SETTINGS_KEY = "zenflow-reminders";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseReminderSettings(value: unknown): ReminderSettings {
  if (value === undefined) return { ...defaultReminderSettings };

  const migrated = migrateStoredReminderSettings(value);
  if (!isRecord(migrated)) {
    throw new Error("Stored reminder settings are invalid");
  }

  const quietHours = isRecord(migrated.quietHours) ? migrated.quietHours : {};
  return reminderSettingsSchema.parse({
    ...defaultReminderSettings,
    ...migrated,
    quietHours: {
      ...defaultReminderSettings.quietHours,
      ...quietHours,
    },
  });
}

function parseHabits(habits: Habit[], deletedIds: Set<string>): Habit[] {
  return habits
    .filter((habit) => !deletedIds.has(habit.id))
    .map((habit) => normalizeHabit(runtimeHabitSchema.parse(habit) as Habit));
}

export async function commitReminderSettingsUpdate(
  update: ReminderSettings | ((previous: ReminderSettings) => ReminderSettings)
): Promise<ReminderSettings> {
  try {
    return await runWithDataWriteBarrier(async () => {
      const next = await db.transaction("rw", db.settings, async () => {
        const record = await db.settings.get(REMINDER_SETTINGS_KEY);
        const previous = parseReminderSettings(record?.value);
        const candidate = typeof update === "function" ? update(previous) : update;
        const next = parseReminderSettings(candidate);

        await db.settings.put({ key: REMINDER_SETTINGS_KEY, value: next });
        return next;
      });

      if (!safeLocalStorageSet(REMINDER_SETTINGS_KEY, next)) {
        logger.warn("[reminderPersistence] Reminder recovery copy could not be updated");
      }
      return next;
    });
  } catch (error) {
    return recoverCommittedSettingsValue<ReminderSettings>(error);
  }
}

export async function readPersistedReminderSnapshot(): Promise<{
  reminders: ReminderSettings;
  habits: Habit[];
}> {
  return runWithSettledDataRead(() =>
    db.transaction("r", db.settings, db.habits, async () => {
      const [record, habits, deletedIds] = await Promise.all([
        db.settings.get(REMINDER_SETTINGS_KEY),
        db.habits.toArray(),
        getDeletedHabitIds(),
      ]);

      return {
        reminders: parseReminderSettings(record?.value),
        habits: parseHabits(habits, deletedIds),
      };
    })
  );
}
