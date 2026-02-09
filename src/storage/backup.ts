import { db } from "@/storage/db";
import { FocusSession, GratitudeEntry, Habit, MoodEntry } from "@/types";
import type { JournalEntry, JournalPhoto } from "@/features/journal/types";
import { generateId } from "@/lib/utils";
import {
  sanitizeObject,
  moodEntrySchema,
  habitSchema,
  focusSessionSchema,
  gratitudeEntrySchema,
  settingSchema,
  safeValidate
} from "@/lib/validation";

export type ImportMode = "merge" | "replace";

// Settings entry type - value can be any JSON-serializable data
export interface SettingsEntry {
  key: string;
  value: unknown;
}

export interface BackupPayloadV1 {
  schemaVersion: 1;
  exportedAt: string;
  data: {
    moods: MoodEntry[];
    habits: Habit[];
    focusSessions: FocusSession[];
    gratitudeEntries: GratitudeEntry[];
    settings: SettingsEntry[];
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
    settings: SettingsEntry[];
  };
}

export interface BackupPayloadV3 {
  schemaVersion: 3;
  createdAt: string;
  deviceId: string;
  exportedAt?: string;
  data: {
    moods: MoodEntry[];
    habits: Habit[];
    focusSessions: FocusSession[];
    gratitudeEntries: GratitudeEntry[];
    settings: SettingsEntry[];
    journalEntries?: JournalEntry[];
    journalPhotos?: JournalPhoto[];
  };
}

export type BackupPayload = BackupPayloadV1 | BackupPayloadV2 | BackupPayloadV3;

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
  journalEntries?: ImportReportEntry;
  journalPhotos?: ImportReportEntry;
}

export const BACKUP_SCHEMA_VERSION = 3;

const getOrCreateDeviceId = async () => {
  const existing = await db.settings.get("zenflow-device-id");
  if (existing?.value) {
    return typeof existing.value === 'string' ? existing.value : String(existing.value as string | number | boolean);
  }
  const deviceId = `device_${generateId()}`;
  await db.settings.put({ key: "zenflow-device-id", value: deviceId });
  return deviceId;
};

/**
 * Export backup atomically using Dexie transaction.
 * P0 Fix: Ensures data doesn't change mid-export by using a read transaction.
 * This prevents race conditions where user edits data during sync.
 */
export const exportBackup = async (): Promise<BackupPayloadV3> => {
  // Get device ID before transaction (it may write to settings)
  const deviceId = await getOrCreateDeviceId();

  // Use Dexie transaction for atomic point-in-time snapshot
  // This ensures all data is read consistently without interleaved writes
  const data = await db.transaction(
    'r',
    [db.moods, db.habits, db.focusSessions, db.gratitudeEntries, db.settings, db.journalEntries, db.journalPhotos],
    async () => {
      const [moods, habits, focusSessions, gratitudeEntries, settings, journalEntries, journalPhotos] = await Promise.all([
        db.moods.toArray(),
        db.habits.toArray(),
        db.focusSessions.toArray(),
        db.gratitudeEntries.toArray(),
        db.settings.toArray(),
        db.journalEntries.toArray(),
        db.journalPhotos.toArray(),
      ]);

      return { moods, habits, focusSessions, gratitudeEntries, settings, journalEntries, journalPhotos };
    }
  );

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    deviceId,
    data
  };
};

const normalizeBackup = (payload: BackupPayload) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid backup payload.");
  }
  const version = (payload as { schemaVersion?: number }).schemaVersion;
  if (version !== 1 && version !== 2 && version !== BACKUP_SCHEMA_VERSION) {
    throw new Error("Unsupported backup version.");
  }
  if (!("data" in payload) || !payload.data) {
    throw new Error("Backup payload missing data.");
  }
  if (version === 1) {
    return {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      createdAt: (payload as BackupPayloadV1).exportedAt || new Date().toISOString(),
      deviceId: "legacy",
      data: { ...payload.data, journalEntries: [] as JournalEntry[], journalPhotos: [] as JournalPhoto[] }
    };
  }
  const p = payload as BackupPayloadV2 | BackupPayloadV3;
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: p.createdAt || p.exportedAt || new Date().toISOString(),
    deviceId: p.deviceId || "unknown",
    data: {
      ...p.data,
      journalEntries: ('journalEntries' in p.data ? p.data.journalEntries : undefined) || [],
      journalPhotos: ('journalPhotos' in p.data ? p.data.journalPhotos : undefined) || [],
    }
  };
};

export const importBackup = async (payload: BackupPayload, mode: ImportMode): Promise<ImportReport> => {
  const normalized = normalizeBackup(payload);

  const { moods, habits, focusSessions, gratitudeEntries, settings, journalEntries, journalPhotos } = normalized.data;

  // Type-safe validation using Zod schemas
  const validateAndSanitize = <T>(
    items: unknown[] | undefined,
    schema: Parameters<typeof safeValidate>[0],
    maxItems = 100000
  ): { valid: T[]; skipped: number } => {
    const list = items || [];
    // Limit array size to prevent DOS attacks
    if (list.length > maxItems) {
      throw new Error(`Backup file too large (max ${maxItems} items per collection)`);
    }

    const valid: T[] = [];
    let skipped = 0;

    for (const item of list) {
      // First sanitize to prevent prototype pollution
      const sanitized = sanitizeObject(item as Record<string, unknown>);
      // Then validate against schema
      const validated = safeValidate(schema, sanitized);
      if (validated) {
        valid.push(validated as T);
      } else {
        skipped++;
      }
    }

    return { valid, skipped };
  };

  // Validate each collection with strict type checking
  const validMoods = validateAndSanitize<MoodEntry>(moods, moodEntrySchema);
  const validHabits = validateAndSanitize<Habit>(habits, habitSchema);
  const validFocus = validateAndSanitize<FocusSession>(focusSessions, focusSessionSchema);
  const validGratitude = validateAndSanitize<GratitudeEntry>(gratitudeEntries, gratitudeEntrySchema);
  const validSettings = validateAndSanitize<{ key: string; value: unknown }>(settings, settingSchema);

  // Journal entries: lightweight validation (no Zod schema, just basic shape check)
  const validJournalEntries = (journalEntries || []).filter(
    (e) => !!e && typeof e === 'object' && typeof e.id === 'string' && typeof e.date === 'string'
  );
  const validJournalPhotos = (journalPhotos || []).filter(
    (p) => !!p && typeof p === 'object' && typeof p.id === 'string' && typeof p.entryId === 'string'
  );

  if (mode === "replace") {
    await db.transaction("rw", db.moods, db.habits, db.focusSessions, db.gratitudeEntries, db.settings, db.journalEntries, db.journalPhotos, async () => {
      await db.moods.clear();
      await db.habits.clear();
      await db.focusSessions.clear();
      await db.gratitudeEntries.clear();
      await db.settings.clear();
      await db.journalEntries.clear();
      await db.journalPhotos.clear();

      if (validMoods.valid.length) await db.moods.bulkAdd(validMoods.valid);
      if (validHabits.valid.length) await db.habits.bulkAdd(validHabits.valid);
      if (validFocus.valid.length) await db.focusSessions.bulkAdd(validFocus.valid);
      if (validGratitude.valid.length) await db.gratitudeEntries.bulkAdd(validGratitude.valid);
      if (validSettings.valid.length) await db.settings.bulkAdd(validSettings.valid);
      if (validJournalEntries.length) await db.journalEntries.bulkAdd(validJournalEntries);
      if (validJournalPhotos.length) await db.journalPhotos.bulkAdd(validJournalPhotos);
    });

    return {
      mode,
      moods: { added: validMoods.valid.length, updated: 0, skipped: validMoods.skipped },
      habits: { added: validHabits.valid.length, updated: 0, skipped: validHabits.skipped },
      focusSessions: { added: validFocus.valid.length, updated: 0, skipped: validFocus.skipped },
      gratitudeEntries: { added: validGratitude.valid.length, updated: 0, skipped: validGratitude.skipped },
      settings: { added: validSettings.valid.length, updated: 0, skipped: validSettings.skipped },
      journalEntries: { added: validJournalEntries.length, updated: 0, skipped: (journalEntries || []).length - validJournalEntries.length },
      journalPhotos: { added: validJournalPhotos.length, updated: 0, skipped: (journalPhotos || []).length - validJournalPhotos.length },
    };
  }

  const [moodKeys, habitKeys, focusKeys, gratitudeKeys, settingsKeys] = await Promise.all([
    db.moods.toCollection().primaryKeys(),
    db.habits.toCollection().primaryKeys(),
    db.focusSessions.toCollection().primaryKeys(),
    db.gratitudeEntries.toCollection().primaryKeys(),
    db.settings.toCollection().primaryKeys()
  ]);

  const moodKeySet = new Set(moodKeys);
  const habitKeySet = new Set(habitKeys);
  const focusKeySet = new Set(focusKeys);
  const gratitudeKeySet = new Set(gratitudeKeys);
  const settingsKeySet = new Set(settingsKeys);

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

  // Journal keys for merge counting
  const [journalEntryKeys, journalPhotoKeys] = await Promise.all([
    db.journalEntries.toCollection().primaryKeys(),
    db.journalPhotos.toCollection().primaryKeys(),
  ]);
  const journalEntryKeySet = new Set(journalEntryKeys);
  const journalPhotoKeySet = new Set(journalPhotoKeys);
  const journalEntryAdds = validJournalEntries.filter(e => !journalEntryKeySet.has(e.id)).length;
  const journalPhotoAdds = validJournalPhotos.filter(p => !journalPhotoKeySet.has(p.id)).length;

  await db.transaction("rw", db.moods, db.habits, db.focusSessions, db.gratitudeEntries, db.settings, db.journalEntries, db.journalPhotos, async () => {
    if (validMoods.valid.length) await db.moods.bulkPut(validMoods.valid);

    // For habits: use timestamp-based conflict resolution to prevent data loss
    if (validHabits.valid.length) {
      const localHabits = await db.habits.toArray();
      const localHabitMap = new Map(localHabits.map(h => [h.id, h]));

      const mergedHabits = validHabits.valid.map(remoteHabit => {
        const localHabit = localHabitMap.get(remoteHabit.id);

        // If no local habit exists, use remote
        if (!localHabit) return remoteHabit;

        // Compare timestamps - keep the more recent version
        const localTime = localHabit.updatedAt ? new Date(localHabit.updatedAt).getTime() : 0;
        const remoteTime = remoteHabit.updatedAt ? new Date(remoteHabit.updatedAt).getTime() : 0;

        // If local is newer, preserve local data (don't overwrite with stale remote)
        if (localTime > remoteTime) {
          return localHabit;
        }

        return remoteHabit;
      });

      await db.habits.bulkPut(mergedHabits);
    }

    if (validFocus.valid.length) await db.focusSessions.bulkPut(validFocus.valid);
    if (validGratitude.valid.length) await db.gratitudeEntries.bulkPut(validGratitude.valid);
    if (validSettings.valid.length) await db.settings.bulkPut(validSettings.valid);
    if (validJournalEntries.length) await db.journalEntries.bulkPut(validJournalEntries);
    if (validJournalPhotos.length) await db.journalPhotos.bulkPut(validJournalPhotos);
  });

  return {
    mode,
    moods: { added: moodAdds, updated: moodUpdates, skipped: validMoods.skipped },
    habits: { added: habitAdds, updated: habitUpdates, skipped: validHabits.skipped },
    focusSessions: { added: focusAdds, updated: focusUpdates, skipped: validFocus.skipped },
    gratitudeEntries: { added: gratitudeAdds, updated: gratitudeUpdates, skipped: validGratitude.skipped },
    settings: { added: settingsAdds, updated: settingsUpdates, skipped: validSettings.skipped },
    journalEntries: { added: journalEntryAdds, updated: validJournalEntries.length - journalEntryAdds, skipped: (journalEntries || []).length - validJournalEntries.length },
    journalPhotos: { added: journalPhotoAdds, updated: validJournalPhotos.length - journalPhotoAdds, skipped: (journalPhotos || []).length - validJournalPhotos.length },
  };
};
