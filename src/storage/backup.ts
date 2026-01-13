import { db } from "@/storage/db";
import { FocusSession, GratitudeEntry, Habit, MoodEntry } from "@/types";
import { generateId } from "@/lib/utils";
import { sanitizeObject } from "@/lib/validation";

export type ImportMode = "merge" | "replace";

export interface BackupPayloadV1 {
  schemaVersion: 1;
  exportedAt: string;
  data: {
    moods: MoodEntry[];
    habits: Habit[];
    focusSessions: FocusSession[];
    gratitudeEntries: GratitudeEntry[];
    settings: Array<{ key: string; value: any } & Record<string, any>>;
  };
}

export interface BackupPayloadV2 {
  schemaVersion: 2;
  createdAt: string;
  deviceId: string;
  exportedAt?: string;
  data: {
    moods: MoodEntry[];
    habits: Habit[];
    focusSessions: FocusSession[];
    gratitudeEntries: GratitudeEntry[];
    settings: Array<{ key: string; value: any } & Record<string, any>>;
  };
}

export type BackupPayload = BackupPayloadV1 | BackupPayloadV2;

export interface ImportReportEntry {
  added: number;
  updated: number;
  skipped: number;
}

export interface ImportReport {
  mode: ImportMode;
  moods: ImportReportEntry;
  habits: ImportReportEntry;
  focusSessions: ImportReportEntry;
  gratitudeEntries: ImportReportEntry;
  settings: ImportReportEntry;
}

export const BACKUP_SCHEMA_VERSION = 2;

const getOrCreateDeviceId = async () => {
  const existing = await db.settings.get("zenflow-device-id");
  if (existing?.value) {
    return String(existing.value);
  }
  const deviceId = `device_${generateId()}`;
  await db.settings.put({ key: "zenflow-device-id", value: deviceId });
  return deviceId;
};

export const exportBackup = async (): Promise<BackupPayloadV2> => {
  const [moods, habits, focusSessions, gratitudeEntries, settings] = await Promise.all([
    db.moods.toArray(),
    db.habits.toArray(),
    db.focusSessions.toArray(),
    db.gratitudeEntries.toArray(),
    db.settings.toArray()
  ]);

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    deviceId: await getOrCreateDeviceId(),
    data: {
      moods,
      habits,
      focusSessions,
      gratitudeEntries,
      settings
    }
  };
};

const normalizeBackup = (payload: BackupPayload) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid backup payload.");
  }
  if (payload.schemaVersion !== 1 && payload.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error("Unsupported backup version.");
  }
  if (!("data" in payload) || !payload.data) {
    throw new Error("Backup payload missing data.");
  }
  if (payload.schemaVersion === 1) {
    return {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      createdAt: payload.exportedAt || new Date().toISOString(),
      deviceId: "legacy",
      data: payload.data
    };
  }
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: payload.createdAt || payload.exportedAt || new Date().toISOString(),
    deviceId: payload.deviceId || "unknown",
    data: payload.data
  };
};

export const importBackup = async (payload: BackupPayload, mode: ImportMode): Promise<ImportReport> => {
  const normalized = normalizeBackup(payload);

  const { moods, habits, focusSessions, gratitudeEntries, settings } = normalized.data;

  const filterValid = <T extends Record<string, unknown>>(items: T[] | undefined, predicate: (item: T) => boolean) => {
    const list = items || [];
    // Limit array size to prevent DOS attacks
    if (list.length > 100000) {
      throw new Error('Backup file too large (max 100,000 items per collection)');
    }
    // Sanitize each object to prevent prototype pollution
    const sanitized = list.map(item => sanitizeObject(item));
    const valid = sanitized.filter(predicate);
    return { valid, skipped: list.length - valid.length };
  };

  const validMoods = filterValid(moods, (item) => Boolean((item as MoodEntry).id));
  const validHabits = filterValid(habits, (item) => Boolean((item as Habit).id));
  const validFocus = filterValid(focusSessions, (item) => Boolean((item as FocusSession).id));
  const validGratitude = filterValid(gratitudeEntries, (item) => Boolean((item as GratitudeEntry).id));
  const validSettings = filterValid(settings, (item) => Boolean((item as { key?: string }).key));

  if (mode === "replace") {
    await db.transaction("rw", db.moods, db.habits, db.focusSessions, db.gratitudeEntries, db.settings, async () => {
      await db.moods.clear();
      await db.habits.clear();
      await db.focusSessions.clear();
      await db.gratitudeEntries.clear();
      await db.settings.clear();

      if (validMoods.valid.length) await db.moods.bulkAdd(validMoods.valid);
      if (validHabits.valid.length) await db.habits.bulkAdd(validHabits.valid);
      if (validFocus.valid.length) await db.focusSessions.bulkAdd(validFocus.valid);
      if (validGratitude.valid.length) await db.gratitudeEntries.bulkAdd(validGratitude.valid);
      if (validSettings.valid.length) await db.settings.bulkAdd(validSettings.valid);
    });

    return {
      mode,
      moods: { added: validMoods.valid.length, updated: 0, skipped: validMoods.skipped },
      habits: { added: validHabits.valid.length, updated: 0, skipped: validHabits.skipped },
      focusSessions: { added: validFocus.valid.length, updated: 0, skipped: validFocus.skipped },
      gratitudeEntries: { added: validGratitude.valid.length, updated: 0, skipped: validGratitude.skipped },
      settings: { added: validSettings.valid.length, updated: 0, skipped: validSettings.skipped }
    };
  }

  const [moodKeys, habitKeys, focusKeys, gratitudeKeys, settingsKeys] = await Promise.all([
    db.moods.toCollection().primaryKeys(),
    db.habits.toCollection().primaryKeys(),
    db.focusSessions.toCollection().primaryKeys(),
    db.gratitudeEntries.toCollection().primaryKeys(),
    db.settings.toCollection().primaryKeys()
  ]);

  const moodKeySet = new Set(moodKeys as string[]);
  const habitKeySet = new Set(habitKeys as string[]);
  const focusKeySet = new Set(focusKeys as string[]);
  const gratitudeKeySet = new Set(gratitudeKeys as string[]);
  const settingsKeySet = new Set(settingsKeys as string[]);

  const moodAdds = validMoods.valid.filter((item) => !moodKeySet.has(item.id)).length;
  const habitAdds = validHabits.valid.filter((item) => !habitKeySet.has(item.id)).length;
  const focusAdds = validFocus.valid.filter((item) => !focusKeySet.has(item.id)).length;
  const gratitudeAdds = validGratitude.valid.filter((item) => !gratitudeKeySet.has(item.id)).length;
  const settingsAdds = validSettings.valid.filter((item) => !settingsKeySet.has(item.key)).length;

  const moodUpdates = validMoods.valid.length - moodAdds;
  const habitUpdates = validHabits.valid.length - habitAdds;
  const focusUpdates = validFocus.valid.length - focusAdds;
  const gratitudeUpdates = validGratitude.valid.length - gratitudeAdds;
  const settingsUpdates = validSettings.valid.length - settingsAdds;

  await db.transaction("rw", db.moods, db.habits, db.focusSessions, db.gratitudeEntries, db.settings, async () => {
    if (validMoods.valid.length) await db.moods.bulkPut(validMoods.valid);
    if (validHabits.valid.length) await db.habits.bulkPut(validHabits.valid);
    if (validFocus.valid.length) await db.focusSessions.bulkPut(validFocus.valid);
    if (validGratitude.valid.length) await db.gratitudeEntries.bulkPut(validGratitude.valid);
    if (validSettings.valid.length) await db.settings.bulkPut(validSettings.valid);
  });

  return {
    mode,
    moods: { added: moodAdds, updated: moodUpdates, skipped: validMoods.skipped },
    habits: { added: habitAdds, updated: habitUpdates, skipped: validHabits.skipped },
    focusSessions: { added: focusAdds, updated: focusUpdates, skipped: validFocus.skipped },
    gratitudeEntries: { added: gratitudeAdds, updated: gratitudeUpdates, skipped: validGratitude.skipped },
    settings: { added: settingsAdds, updated: settingsUpdates, skipped: validSettings.skipped }
  };
};
