import { db } from "@/storage/db";
import { FocusSession, GratitudeEntry, Habit, MoodEntry } from "@/types";
import type { JournalEntry, JournalPhoto, JournalAudio } from "@/features/journal/types";
import { generateId } from "@/lib/utils";
import {
  sanitizeObject,
  moodEntrySchema,
  habitSchema,
  focusSessionSchema,
  gratitudeEntrySchema,
  settingSchema,
  safeValidate,
} from "@/lib/validation";
import {
  getDeletedHabitIds,
  mergeDeletedHabitIds,
  getDeletedJournalEntryIds,
  mergeDeletedJournalEntryIds,
  getDeletedMoodIds,
  mergeDeletedMoodIds,
  getDeletedFocusSessionIds,
  mergeDeletedFocusSessionIds,
  getDeletedGratitudeIds,
  mergeDeletedGratitudeIds,
} from "@/storage/deletionTracker";

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
    journalAudio?: JournalAudio[];
  };
  /** Habit IDs deleted by this device — other devices must respect these deletions */
  deletedHabitIds?: string[];
  /** Journal entry IDs deleted by this device */
  deletedJournalEntryIds?: string[];
  /** Mood IDs deleted by this device */
  deletedMoodIds?: string[];
  /** Focus session IDs deleted by this device */
  deletedFocusSessionIds?: string[];
  /** Gratitude entry IDs deleted by this device */
  deletedGratitudeIds?: string[];
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
  journalAudio?: ImportReportEntry;
}

export const BACKUP_SCHEMA_VERSION = 3;

const getOrCreateDeviceId = async () => {
  const existing = await db.settings.get("zenflow-device-id");
  if (typeof existing?.value === "string" && existing.value.trim().length > 0) {
    return existing.value;
  }
  const deviceId = `device_${generateId()}`;
  await db.settings.put({ key: "zenflow-device-id", value: deviceId });
  return deviceId;
};

/**
 * Export backup atomically using Dexie transaction.
 * Ensures data doesn't change mid-export by using a read transaction.
 * This prevents race conditions where user edits data during sync.
 */
export const exportBackup = async (): Promise<BackupPayloadV3> => {
  // Get device ID before transaction (it may write to settings)
  const deviceId = await getOrCreateDeviceId();

  // Get deleted IDs to include in backup (cross-device deletion propagation)
  const deletedHabitIds = [...(await getDeletedHabitIds())];
  const deletedJournalEntryIds = [...(await getDeletedJournalEntryIds())];
  const deletedMoodIds = [...(await getDeletedMoodIds())];
  const deletedFocusSessionIds = [...(await getDeletedFocusSessionIds())];
  const deletedGratitudeIds = [...(await getDeletedGratitudeIds())];

  // Use Dexie transaction for atomic point-in-time snapshot
  // This ensures all data is read consistently without interleaved writes
  const data = await db.transaction(
    "r",
    [
      db.moods,
      db.habits,
      db.focusSessions,
      db.gratitudeEntries,
      db.settings,
      db.journalEntries,
      db.journalPhotos,
      db.journalAudio,
    ],
    async () => {
      const [
        moods,
        habits,
        focusSessions,
        gratitudeEntries,
        settings,
        journalEntries,
        journalPhotos,
        journalAudio,
      ] = await Promise.all([
        db.moods.toArray(),
        db.habits.toArray(),
        db.focusSessions.toArray(),
        db.gratitudeEntries.toArray(),
        db.settings.toArray(),
        db.journalEntries.toArray(),
        db.journalPhotos.toArray(),
        db.journalAudio.toArray(),
      ]);

      // Optimize: strip base64 data from media that has been uploaded to Storage
      // The binary data lives in Supabase Storage buckets and can be re-downloaded
      const optimizedPhotos = journalPhotos.map((p) => ({
        ...p,
        data: p.storagePath ? "" : p.data,
        thumbnail: p.storagePath ? "" : p.thumbnail,
      }));
      const optimizedAudio = journalAudio.map((a) => ({
        ...a,
        data: a.storagePath ? "" : a.data,
      }));

      return {
        moods,
        habits,
        focusSessions,
        gratitudeEntries,
        settings,
        journalEntries,
        journalPhotos: optimizedPhotos,
        journalAudio: optimizedAudio,
      };
    }
  );

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    deviceId,
    data,
    deletedHabitIds: deletedHabitIds.length > 0 ? deletedHabitIds : undefined,
    deletedJournalEntryIds: deletedJournalEntryIds.length > 0 ? deletedJournalEntryIds : undefined,
    deletedMoodIds: deletedMoodIds.length > 0 ? deletedMoodIds : undefined,
    deletedFocusSessionIds: deletedFocusSessionIds.length > 0 ? deletedFocusSessionIds : undefined,
    deletedGratitudeIds: deletedGratitudeIds.length > 0 ? deletedGratitudeIds : undefined,
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
      data: {
        ...payload.data,
        journalEntries: [] as JournalEntry[],
        journalPhotos: [] as JournalPhoto[],
        journalAudio: [] as JournalAudio[],
      },
    };
  }
  const p = payload as BackupPayloadV2 | BackupPayloadV3;
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: p.createdAt || p.exportedAt || new Date().toISOString(),
    deviceId: p.deviceId || "unknown",
    data: {
      ...p.data,
      journalEntries: ("journalEntries" in p.data ? p.data.journalEntries : undefined) || [],
      journalPhotos: ("journalPhotos" in p.data ? p.data.journalPhotos : undefined) || [],
      journalAudio: ("journalAudio" in p.data ? p.data.journalAudio : undefined) || [],
    },
  };
};

/**
 * Merge incoming items with local by timestamp. Keeps newer per-item.
 * Items in deletedIds are skipped (prevent re-import of deleted data).
 */
export async function mergeByTimestamp<T extends { id: string }>(
  table: import("dexie").Table<T, string>,
  incoming: T[],
  getTime: (item: T) => number,
  deletedIds?: Set<string>
): Promise<void> {
  if (!incoming.length) return;

  const localItems = await table.toArray();
  const localMap = new Map(localItems.map((item) => [item.id, item]));

  const merged = incoming
    .filter((remote) => !deletedIds?.has(remote.id))
    .map((remote) => {
      const local = localMap.get(remote.id);
      if (!local) return remote;

      const localTime = getTime(local);
      const remoteTime = getTime(remote);

      // Keep newer; ties go to remote (cloud authority). NaN guard: invalid timestamps default to 0.
      const safeLocal = Number.isFinite(localTime) ? localTime : 0;
      const safeRemote = Number.isFinite(remoteTime) ? remoteTime : 0;
      return safeLocal > safeRemote ? local : remote;
    });

  if (merged.length) await table.bulkPut(merged);
}

export const importBackup = async (
  payload: BackupPayload,
  mode: ImportMode
): Promise<ImportReport> => {
  const normalized = normalizeBackup(payload);

  const {
    moods,
    habits,
    focusSessions,
    gratitudeEntries,
    settings,
    journalEntries,
    journalPhotos,
    journalAudio,
  } = normalized.data;

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
  const validGratitude = validateAndSanitize<GratitudeEntry>(
    gratitudeEntries,
    gratitudeEntrySchema
  );
  const validSettings = validateAndSanitize<{ key: string; value: unknown }>(
    settings,
    settingSchema
  );

  // Journal entries: lightweight validation (no Zod schema, just basic shape check)
  const validJournalEntries = (journalEntries || []).filter(
    (e) => !!e && typeof e === "object" && typeof e.id === "string" && typeof e.date === "string"
  );
  const validJournalPhotos = (journalPhotos || []).filter(
    (p) => !!p && typeof p === "object" && typeof p.id === "string" && typeof p.entryId === "string"
  );
  const validJournalAudio = (journalAudio || []).filter(
    (a) => !!a && typeof a === "object" && typeof a.id === "string" && typeof a.entryId === "string"
  );

  if (mode === "replace") {
    await db.transaction(
      "rw",
      [
        db.moods,
        db.habits,
        db.focusSessions,
        db.gratitudeEntries,
        db.settings,
        db.journalEntries,
        db.journalPhotos,
        db.journalAudio,
      ],
      async () => {
        await db.moods.clear();
        await db.habits.clear();
        await db.focusSessions.clear();
        await db.gratitudeEntries.clear();
        await db.settings.clear();
        await db.journalEntries.clear();
        await db.journalPhotos.clear();
        await db.journalAudio.clear();

        if (validMoods.valid.length) await db.moods.bulkAdd(validMoods.valid);
        if (validHabits.valid.length) await db.habits.bulkAdd(validHabits.valid);
        if (validFocus.valid.length) await db.focusSessions.bulkAdd(validFocus.valid);
        if (validGratitude.valid.length) await db.gratitudeEntries.bulkAdd(validGratitude.valid);
        if (validSettings.valid.length) await db.settings.bulkAdd(validSettings.valid);
        if (validJournalEntries.length) await db.journalEntries.bulkAdd(validJournalEntries);
        if (validJournalPhotos.length) await db.journalPhotos.bulkAdd(validJournalPhotos);
        if (validJournalAudio.length) await db.journalAudio.bulkAdd(validJournalAudio);
      }
    );

    return {
      mode,
      moods: { added: validMoods.valid.length, updated: 0, skipped: validMoods.skipped },
      habits: { added: validHabits.valid.length, updated: 0, skipped: validHabits.skipped },
      focusSessions: { added: validFocus.valid.length, updated: 0, skipped: validFocus.skipped },
      gratitudeEntries: {
        added: validGratitude.valid.length,
        updated: 0,
        skipped: validGratitude.skipped,
      },
      settings: { added: validSettings.valid.length, updated: 0, skipped: validSettings.skipped },
      journalEntries: {
        added: validJournalEntries.length,
        updated: 0,
        skipped: (journalEntries || []).length - validJournalEntries.length,
      },
      journalPhotos: {
        added: validJournalPhotos.length,
        updated: 0,
        skipped: (journalPhotos || []).length - validJournalPhotos.length,
      },
      journalAudio: {
        added: validJournalAudio.length,
        updated: 0,
        skipped: (journalAudio || []).length - validJournalAudio.length,
      },
    };
  }

  const [moodKeys, habitKeys, focusKeys, gratitudeKeys, settingsKeys] = await Promise.all([
    db.moods.toCollection().primaryKeys(),
    db.habits.toCollection().primaryKeys(),
    db.focusSessions.toCollection().primaryKeys(),
    db.gratitudeEntries.toCollection().primaryKeys(),
    db.settings.toCollection().primaryKeys(),
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
  const [journalEntryKeys, journalPhotoKeys, journalAudioKeys] = await Promise.all([
    db.journalEntries.toCollection().primaryKeys(),
    db.journalPhotos.toCollection().primaryKeys(),
    db.journalAudio.toCollection().primaryKeys(),
  ]);
  const journalEntryKeySet = new Set(journalEntryKeys);
  const journalPhotoKeySet = new Set(journalPhotoKeys);
  const journalAudioKeySet = new Set(journalAudioKeys);
  const journalEntryAdds = validJournalEntries.filter((e) => !journalEntryKeySet.has(e.id)).length;
  const journalPhotoAdds = validJournalPhotos.filter((p) => !journalPhotoKeySet.has(p.id)).length;
  const journalAudioAdds = validJournalAudio.filter((a) => !journalAudioKeySet.has(a.id)).length;

  // Extract remote deletion IDs BEFORE the merge transaction
  // so they can be merged into the local tracker before filtering
  const v3 = payload as BackupPayloadV3;
  const isValidIdArray = (v: unknown): v is string[] =>
    Array.isArray(v) &&
    v.length <= 10000 &&
    v.every((s) => typeof s === "string" && s.length > 0 && s.length <= 100);
  const remoteDeletedHabitIds = isValidIdArray(v3.deletedHabitIds) ? v3.deletedHabitIds : undefined;
  const remoteDeletedJournalIds = isValidIdArray(v3.deletedJournalEntryIds)
    ? v3.deletedJournalEntryIds
    : undefined;
  const remoteDeletedMoodIds = isValidIdArray(v3.deletedMoodIds) ? v3.deletedMoodIds : undefined;
  const remoteDeletedFocusIds = isValidIdArray(v3.deletedFocusSessionIds)
    ? v3.deletedFocusSessionIds
    : undefined;
  const remoteDeletedGratitudeIds = isValidIdArray(v3.deletedGratitudeIds)
    ? v3.deletedGratitudeIds
    : undefined;

  await db.transaction(
    "rw",
    [
      db.moods,
      db.habits,
      db.focusSessions,
      db.gratitudeEntries,
      db.settings,
      db.journalEntries,
      db.journalPhotos,
      db.journalAudio,
    ],
    async () => {
      if (validMoods.valid.length) {
        // CRITICAL: Merge remote deletion tracker FIRST to prevent resurrection
        if (remoteDeletedMoodIds?.length) {
          await mergeDeletedMoodIds(remoteDeletedMoodIds);
        }
        const deletedMoodIds = await getDeletedMoodIds();
        await mergeByTimestamp(
          db.moods,
          validMoods.valid,
          (m) => m.updatedAt || m.timestamp || 0,
          deletedMoodIds
        );
      }

      // For habits: use timestamp-based conflict resolution + deletion tracking
      if (validHabits.valid.length) {
        const localHabits = await db.habits.toArray();
        const localHabitMap = new Map(localHabits.map((h) => [h.id, h]));

        // CRITICAL: Merge remote deletion tracker FIRST, before filtering
        // Without this, a new device has an empty tracker and resurrects deleted habits
        if (remoteDeletedHabitIds?.length) {
          await mergeDeletedHabitIds(remoteDeletedHabitIds);
        }
        // Now get the COMBINED deletion tracker (local + remote)
        const deletedIds = await getDeletedHabitIds();

        const mergedHabits = validHabits.valid
          .filter((remoteHabit) => !deletedIds.has(remoteHabit.id))
          .map((remoteHabit) => {
            const localHabit = localHabitMap.get(remoteHabit.id);

            // If no local habit exists, use remote
            if (!localHabit) return remoteHabit;

            // Compare timestamps - keep the more recent version
            const localTime = localHabit.updatedAt ? new Date(localHabit.updatedAt).getTime() : 0;
            const remoteTime = remoteHabit.updatedAt
              ? new Date(remoteHabit.updatedAt).getTime()
              : 0;

            // If local is newer, preserve local data (don't overwrite with stale remote)
            if (localTime > remoteTime) {
              return localHabit;
            }

            return remoteHabit;
          });

        await db.habits.bulkPut(mergedHabits);
      }

      if (validFocus.valid.length) {
        // CRITICAL: Merge remote deletion tracker FIRST to prevent resurrection
        if (remoteDeletedFocusIds?.length) {
          await mergeDeletedFocusSessionIds(remoteDeletedFocusIds);
        }
        const deletedFocusIds = await getDeletedFocusSessionIds();
        await mergeByTimestamp(
          db.focusSessions,
          validFocus.valid,
          (f) => f.updatedAt || f.completedAt || 0,
          deletedFocusIds
        );
      }
      if (validGratitude.valid.length) {
        // CRITICAL: Merge remote deletion tracker FIRST to prevent resurrection
        if (remoteDeletedGratitudeIds?.length) {
          await mergeDeletedGratitudeIds(remoteDeletedGratitudeIds);
        }
        const deletedGratitudeIds = await getDeletedGratitudeIds();
        await mergeByTimestamp(
          db.gratitudeEntries,
          validGratitude.valid,
          (g) => g.updatedAt || g.timestamp || 0,
          deletedGratitudeIds
        );
      }
      if (validSettings.valid.length) await db.settings.bulkPut(validSettings.valid);
      // For journal entries: filter out locally deleted entries before merging
      if (validJournalEntries.length) {
        // CRITICAL: Merge remote deletion tracker FIRST to prevent resurrection
        if (remoteDeletedJournalIds?.length) {
          await mergeDeletedJournalEntryIds(remoteDeletedJournalIds);
        }
        const deletedEntryIds = await getDeletedJournalEntryIds();
        const filteredEntries =
          deletedEntryIds.size > 0
            ? validJournalEntries.filter((e) => !deletedEntryIds.has(e.id))
            : validJournalEntries;
        if (filteredEntries.length) await db.journalEntries.bulkPut(filteredEntries);

        // Also filter photos/audio belonging to deleted entries
        const deletedEntryIdSet = deletedEntryIds;
        if (validJournalPhotos.length) {
          const filteredPhotos =
            deletedEntryIdSet.size > 0
              ? validJournalPhotos.filter((p) => !deletedEntryIdSet.has(p.entryId))
              : validJournalPhotos;
          if (filteredPhotos.length) await db.journalPhotos.bulkPut(filteredPhotos);
        }
        if (validJournalAudio.length) {
          const filteredAudio =
            deletedEntryIdSet.size > 0
              ? validJournalAudio.filter((a) => !deletedEntryIdSet.has(a.entryId))
              : validJournalAudio;
          if (filteredAudio.length) await db.journalAudio.bulkPut(filteredAudio);
        }
      } else {
        if (validJournalPhotos.length) await db.journalPhotos.bulkPut(validJournalPhotos);
        if (validJournalAudio.length) await db.journalAudio.bulkPut(validJournalAudio);
      }
    }
  );

  // Defense-in-depth: bulkDelete any remaining items that slipped through the filter
  // (remoteDeleted* variables already declared and merged above the main transaction)

  const hasRemoteDeletions =
    remoteDeletedHabitIds?.length ||
    remoteDeletedJournalIds?.length ||
    remoteDeletedMoodIds?.length ||
    remoteDeletedFocusIds?.length ||
    remoteDeletedGratitudeIds?.length;

  if (hasRemoteDeletions) {
    await db.transaction(
      "rw",
      [
        db.moods,
        db.habits,
        db.focusSessions,
        db.gratitudeEntries,
        db.journalEntries,
        db.journalPhotos,
        db.journalAudio,
        db.settings,
      ],
      async () => {
        if (remoteDeletedHabitIds?.length) {
          await mergeDeletedHabitIds(remoteDeletedHabitIds);
          await db.habits.bulkDelete(remoteDeletedHabitIds);
        }
        if (remoteDeletedJournalIds?.length) {
          await mergeDeletedJournalEntryIds(remoteDeletedJournalIds);
          await db.journalEntries.bulkDelete(remoteDeletedJournalIds);
          for (const entryId of remoteDeletedJournalIds) {
            const photos = await db.journalPhotos.where("entryId").equals(entryId).primaryKeys();
            if (photos.length) await db.journalPhotos.bulkDelete(photos);
            const audios = await db.journalAudio.where("entryId").equals(entryId).primaryKeys();
            if (audios.length) await db.journalAudio.bulkDelete(audios);
          }
        }
        if (remoteDeletedMoodIds?.length) {
          await mergeDeletedMoodIds(remoteDeletedMoodIds);
          await db.moods.bulkDelete(remoteDeletedMoodIds);
        }
        if (remoteDeletedFocusIds?.length) {
          await mergeDeletedFocusSessionIds(remoteDeletedFocusIds);
          await db.focusSessions.bulkDelete(remoteDeletedFocusIds);
        }
        if (remoteDeletedGratitudeIds?.length) {
          await mergeDeletedGratitudeIds(remoteDeletedGratitudeIds);
          await db.gratitudeEntries.bulkDelete(remoteDeletedGratitudeIds);
        }
      }
    );
  }

  return {
    mode,
    moods: { added: moodAdds, updated: moodUpdates, skipped: validMoods.skipped },
    habits: { added: habitAdds, updated: habitUpdates, skipped: validHabits.skipped },
    focusSessions: { added: focusAdds, updated: focusUpdates, skipped: validFocus.skipped },
    gratitudeEntries: {
      added: gratitudeAdds,
      updated: gratitudeUpdates,
      skipped: validGratitude.skipped,
    },
    settings: { added: settingsAdds, updated: settingsUpdates, skipped: validSettings.skipped },
    journalEntries: {
      added: journalEntryAdds,
      updated: validJournalEntries.length - journalEntryAdds,
      skipped: (journalEntries || []).length - validJournalEntries.length,
    },
    journalPhotos: {
      added: journalPhotoAdds,
      updated: validJournalPhotos.length - journalPhotoAdds,
      skipped: (journalPhotos || []).length - validJournalPhotos.length,
    },
    journalAudio: {
      added: journalAudioAdds,
      updated: validJournalAudio.length - journalAudioAdds,
      skipped: (journalAudio || []).length - validJournalAudio.length,
    },
  };
};
