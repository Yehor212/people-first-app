import { db } from "@/storage/db";
import { FocusSession, GratitudeEntry, Habit, MoodEntry } from "@/types";
import type { JournalEntry, JournalPhoto, JournalAudio } from "@/features/journal/types";
import { getJournalContentVaultKey } from "@/features/journal/journalContentSession";
import { encryptJournalContent, isEncryptedJournalContent } from "@/features/journal/journalCrypto";
import { encryptJournalMediaDataUrl, isEncryptedJournalMediaData } from "@/features/journal/journalMediaCrypto";
import { generateId } from "@/lib/utils";
import { SK } from "@/lib/storageKeys";
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
import { isAccountSyncedSettingKey } from "@/storage/sync/settingSyncPolicy";

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
const MAX_DELETION_TOMBSTONES_PER_COLLECTION = 100000;
const MAX_JOURNAL_IMPORT_ITEMS_PER_COLLECTION = 100000;

function sanitizeRecord(item: unknown): Record<string, unknown> | null {
  if (!item || typeof item !== "object") return null;
  return sanitizeObject(item as Record<string, unknown>);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validateImportedJournalEntry(item: unknown): JournalEntry | null {
  const entry = sanitizeRecord(item);
  if (!entry) return null;
  if (
    typeof entry.id !== "string" ||
    typeof entry.date !== "string" ||
    typeof entry.content !== "string" ||
    typeof entry.createdAt !== "number" ||
    !isStringArray(entry.stickers) ||
    !isStringArray(entry.photoIds) ||
    !isStringArray(entry.tags) ||
    (entry.audioIds !== undefined && !isStringArray(entry.audioIds))
  ) {
    return null;
  }

  return {
    ...(entry as unknown as JournalEntry),
    title: typeof entry.title === "string" ? entry.title : "",
    stickers: entry.stickers,
    photoIds: entry.photoIds,
    audioIds: entry.audioIds,
    tags: entry.tags,
    updatedAt: typeof entry.updatedAt === "number" ? entry.updatedAt : entry.createdAt,
  };
}

function validateImportedJournalPhoto(item: unknown): JournalPhoto | null {
  const photo = sanitizeRecord(item);
  if (!photo) return null;
  if (
    typeof photo.id !== "string" ||
    typeof photo.entryId !== "string" ||
    typeof photo.data !== "string" ||
    typeof photo.thumbnail !== "string" ||
    typeof photo.width !== "number" ||
    typeof photo.height !== "number" ||
    typeof photo.createdAt !== "number" ||
    (photo.storagePath !== undefined && typeof photo.storagePath !== "string") ||
    (photo.storageUrl !== undefined && typeof photo.storageUrl !== "string")
  ) {
    return null;
  }
  return photo as unknown as JournalPhoto;
}

function validateImportedJournalAudio(item: unknown): JournalAudio | null {
  const audio = sanitizeRecord(item);
  if (!audio) return null;
  if (
    typeof audio.id !== "string" ||
    typeof audio.entryId !== "string" ||
    typeof audio.data !== "string" ||
    typeof audio.duration !== "number" ||
    typeof audio.mimeType !== "string" ||
    typeof audio.createdAt !== "number" ||
    (audio.storagePath !== undefined && typeof audio.storagePath !== "string") ||
    (audio.storageUrl !== undefined && typeof audio.storageUrl !== "string")
  ) {
    return null;
  }
  return audio as unknown as JournalAudio;
}

function validateJournalCollection<T>(
  items: unknown,
  validator: (item: unknown) => T | null
): T[] {
  const list = Array.isArray(items) ? items : [];
  if (list.length > MAX_JOURNAL_IMPORT_ITEMS_PER_COLLECTION) {
    throw new Error(
      `Backup file too large (max ${MAX_JOURNAL_IMPORT_ITEMS_PER_COLLECTION} journal items per collection)`
    );
  }
  return list.flatMap((item) => {
    const validated = validator(item);
    return validated ? [validated] : [];
  });
}

async function encryptImportedJournalEntryForStorage(
  entry: JournalEntry,
  vaultKey: string | null
): Promise<JournalEntry> {
  if (!vaultKey || !entry.content || isEncryptedJournalContent(entry.content)) return entry;
  return { ...entry, content: await encryptJournalContent(entry.content, vaultKey) };
}

async function encryptImportedJournalMediaData(
  data: string | undefined,
  vaultKey: string | null
): Promise<string> {
  if (!data || !vaultKey || isEncryptedJournalMediaData(data)) return data || "";
  return encryptJournalMediaDataUrl(data, vaultKey);
}

async function encryptImportedJournalPhotoForStorage(
  photo: JournalPhoto,
  vaultKey: string | null
): Promise<JournalPhoto> {
  if (!vaultKey) return photo;
  return {
    ...photo,
    data: await encryptImportedJournalMediaData(photo.data, vaultKey),
    thumbnail: await encryptImportedJournalMediaData(photo.thumbnail, vaultKey),
  };
}

async function encryptImportedJournalAudioForStorage(
  audio: JournalAudio,
  vaultKey: string | null
): Promise<JournalAudio> {
  if (!vaultKey) return audio;
  return {
    ...audio,
    data: await encryptImportedJournalMediaData(audio.data, vaultKey),
  };
}

function isEncryptedJournalMediaStoragePath(path: string | undefined): boolean {
  return Boolean(path?.toLowerCase().endsWith(".bin"));
}

function isBackupPortableSettingKey(key: string): boolean {
  return isAccountSyncedSettingKey(key) && key !== SK.JOURNAL_VAULT_KEY;
}

function shouldStripJournalMediaDataForBackup(media: {
  storagePath?: string;
  data?: string;
  thumbnail?: string;
}): boolean {
  if (!media.storagePath) return false;

  const dataValues = [media.data, media.thumbnail].filter(
    (value): value is string => typeof value === "string" && value.length > 0
  );
  if (dataValues.length === 0) return true;

  const hasEncryptedData = dataValues.some((value) => isEncryptedJournalMediaData(value));
  return hasEncryptedData === isEncryptedJournalMediaStoragePath(media.storagePath);
}

function canImportJournalEntryWhileLocked(entry: JournalEntry): boolean {
  return !entry.content || isEncryptedJournalContent(entry.content);
}

function canImportJournalMediaWhileLocked(media: {
  storagePath?: string;
  data?: string;
  thumbnail?: string;
}): boolean {
  const dataValues = [media.data, media.thumbnail].filter(
    (value): value is string => typeof value === "string" && value.length > 0
  );
  if (dataValues.some((value) => !isEncryptedJournalMediaData(value))) return false;
  if (media.storagePath && !isEncryptedJournalMediaStoragePath(media.storagePath)) return false;
  return true;
}

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
  const deletedHabitSet = new Set(deletedHabitIds);
  const deletedJournalEntrySet = new Set(deletedJournalEntryIds);
  const deletedMoodSet = new Set(deletedMoodIds);
  const deletedFocusSessionSet = new Set(deletedFocusSessionIds);
  const deletedGratitudeSet = new Set(deletedGratitudeIds);

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

      const accountSyncedSettings = settings.filter((setting) =>
        isBackupPortableSettingKey(setting.key)
      );

      // Optimize: strip base64 data from media that has been uploaded to Storage
      // The binary data lives in Supabase Storage buckets and can be re-downloaded
      const optimizedPhotos = journalPhotos.map((p) => {
        const stripData = shouldStripJournalMediaDataForBackup(p);
        return {
          ...p,
          data: stripData ? "" : p.data,
          thumbnail: stripData ? "" : p.thumbnail,
        };
      });
      const optimizedAudio = journalAudio.map((a) => ({
        ...a,
        data: shouldStripJournalMediaDataForBackup(a) ? "" : a.data,
      }));

      return {
        moods: moods.filter((mood) => !deletedMoodSet.has(mood.id)),
        habits: habits.filter((habit) => !deletedHabitSet.has(habit.id)),
        focusSessions: focusSessions.filter((session) => !deletedFocusSessionSet.has(session.id)),
        gratitudeEntries: gratitudeEntries.filter((entry) => !deletedGratitudeSet.has(entry.id)),
        settings: accountSyncedSettings,
        journalEntries: journalEntries.filter((entry) => !deletedJournalEntrySet.has(entry.id)),
        journalPhotos: optimizedPhotos.filter(
          (photo) => !deletedJournalEntrySet.has(photo.entryId)
        ),
        journalAudio: optimizedAudio.filter((audio) => !deletedJournalEntrySet.has(audio.entryId)),
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
  const rawValidSettings = validateAndSanitize<{ key: string; value: unknown }>(
    settings,
    settingSchema
  );
  const accountSyncedValidSettings = rawValidSettings.valid.filter((setting) =>
    isBackupPortableSettingKey(setting.key)
  );
  const validSettings = {
    valid: accountSyncedValidSettings,
    skipped: rawValidSettings.skipped + (rawValidSettings.valid.length - accountSyncedValidSettings.length),
  };

  let validJournalEntries = validateJournalCollection<JournalEntry>(
    journalEntries,
    validateImportedJournalEntry
  );
  let validJournalPhotos = validateJournalCollection<JournalPhoto>(
    journalPhotos,
    validateImportedJournalPhoto
  );
  let validJournalAudio = validateJournalCollection<JournalAudio>(
    journalAudio,
    validateImportedJournalAudio
  );

  const journalVaultKey = getJournalContentVaultKey();
  const hasLockedLocalJournal = Boolean(await db.settings.get(SK.JOURNAL_PASSWORD)) && !journalVaultKey;
  if (hasLockedLocalJournal) {
    const incomingEntryIds = new Set(validJournalEntries.map((entry) => entry.id));
    const safeEntries = validJournalEntries.filter(canImportJournalEntryWhileLocked);
    const safeEntryIds = new Set(safeEntries.map((entry) => entry.id));
    validJournalEntries = safeEntries;
    validJournalPhotos = validJournalPhotos.filter(
      (photo) =>
        canImportJournalMediaWhileLocked(photo) &&
        (incomingEntryIds.size === 0 || safeEntryIds.has(photo.entryId))
    );
    validJournalAudio = validJournalAudio.filter(
      (audio) =>
        canImportJournalMediaWhileLocked(audio) &&
        (incomingEntryIds.size === 0 || safeEntryIds.has(audio.entryId))
    );
  } else if (journalVaultKey) {
    [validJournalEntries, validJournalPhotos, validJournalAudio] = await Promise.all([
      Promise.all(
        validJournalEntries.map((entry) =>
          encryptImportedJournalEntryForStorage(entry, journalVaultKey)
        )
      ),
      Promise.all(
        validJournalPhotos.map((photo) =>
          encryptImportedJournalPhotoForStorage(photo, journalVaultKey)
        )
      ),
      Promise.all(
        validJournalAudio.map((audio) =>
          encryptImportedJournalAudioForStorage(audio, journalVaultKey)
        )
      ),
    ]);
  }

  const existingJournalEntryKeys =
    mode === "merge" ? await db.journalEntries.toCollection().primaryKeys() : [];
  const importableJournalEntryIds = new Set<string>(
    validJournalEntries.map((entry) => entry.id)
  );
  if (mode === "merge") {
    existingJournalEntryKeys.forEach((key) => {
      if (typeof key === "string") importableJournalEntryIds.add(key);
    });
  }
  validJournalPhotos = validJournalPhotos.filter((photo) =>
    importableJournalEntryIds.has(photo.entryId)
  );
  validJournalAudio = validJournalAudio.filter((audio) =>
    importableJournalEntryIds.has(audio.entryId)
  );

  // Extract remote deletion IDs before either replace or merge. A stale backup
  // can still contain an item and its tombstone; the tombstone must win.
  const v3 = payload as BackupPayloadV3;
  const isValidIdArray = (v: unknown): v is string[] =>
    Array.isArray(v) &&
    v.length <= MAX_DELETION_TOMBSTONES_PER_COLLECTION &&
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

  if (mode === "replace") {
    const deletedHabitSet = new Set(remoteDeletedHabitIds ?? []);
    const deletedJournalSet = new Set(remoteDeletedJournalIds ?? []);
    const deletedMoodSet = new Set(remoteDeletedMoodIds ?? []);
    const deletedFocusSet = new Set(remoteDeletedFocusIds ?? []);
    const deletedGratitudeSet = new Set(remoteDeletedGratitudeIds ?? []);

    const replaceMoods = validMoods.valid.filter((item) => !deletedMoodSet.has(item.id));
    const replaceHabits = validHabits.valid.filter((item) => !deletedHabitSet.has(item.id));
    const replaceFocus = validFocus.valid.filter((item) => !deletedFocusSet.has(item.id));
    const replaceGratitude = validGratitude.valid.filter(
      (item) => !deletedGratitudeSet.has(item.id)
    );
    const replaceJournalEntries = validJournalEntries.filter(
      (item) => !deletedJournalSet.has(item.id)
    );
    const replaceJournalPhotos = validJournalPhotos.filter(
      (item) => !deletedJournalSet.has(item.entryId)
    );
    const replaceJournalAudio = validJournalAudio.filter(
      (item) => !deletedJournalSet.has(item.entryId)
    );

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
        const existingAccountSyncedSettingKeys = (await db.settings.toCollection().primaryKeys()).filter(
          (key): key is string => typeof key === "string" && isBackupPortableSettingKey(key)
        );
        if (existingAccountSyncedSettingKeys.length) {
          await db.settings.bulkDelete(existingAccountSyncedSettingKeys);
        }
        await db.journalEntries.clear();
        await db.journalPhotos.clear();
        await db.journalAudio.clear();

        if (replaceMoods.length) await db.moods.bulkAdd(replaceMoods);
        if (replaceHabits.length) await db.habits.bulkAdd(replaceHabits);
        if (replaceFocus.length) await db.focusSessions.bulkAdd(replaceFocus);
        if (replaceGratitude.length) await db.gratitudeEntries.bulkAdd(replaceGratitude);
        if (validSettings.valid.length) await db.settings.bulkAdd(validSettings.valid);
        if (replaceJournalEntries.length) await db.journalEntries.bulkAdd(replaceJournalEntries);
        if (replaceJournalPhotos.length) await db.journalPhotos.bulkAdd(replaceJournalPhotos);
        if (replaceJournalAudio.length) await db.journalAudio.bulkAdd(replaceJournalAudio);
      }
    );

    if (remoteDeletedMoodIds?.length) await mergeDeletedMoodIds(remoteDeletedMoodIds);
    if (remoteDeletedHabitIds?.length) await mergeDeletedHabitIds(remoteDeletedHabitIds);
    if (remoteDeletedFocusIds?.length) await mergeDeletedFocusSessionIds(remoteDeletedFocusIds);
    if (remoteDeletedGratitudeIds?.length)
      await mergeDeletedGratitudeIds(remoteDeletedGratitudeIds);
    if (remoteDeletedJournalIds?.length) await mergeDeletedJournalEntryIds(remoteDeletedJournalIds);

    return {
      mode,
      moods: {
        added: replaceMoods.length,
        updated: 0,
        skipped: validMoods.skipped + (validMoods.valid.length - replaceMoods.length),
      },
      habits: {
        added: replaceHabits.length,
        updated: 0,
        skipped: validHabits.skipped + (validHabits.valid.length - replaceHabits.length),
      },
      focusSessions: {
        added: replaceFocus.length,
        updated: 0,
        skipped: validFocus.skipped + (validFocus.valid.length - replaceFocus.length),
      },
      gratitudeEntries: {
        added: replaceGratitude.length,
        updated: 0,
        skipped: validGratitude.skipped + (validGratitude.valid.length - replaceGratitude.length),
      },
      settings: { added: validSettings.valid.length, updated: 0, skipped: validSettings.skipped },
      journalEntries: {
        added: replaceJournalEntries.length,
        updated: 0,
        skipped: (journalEntries || []).length - replaceJournalEntries.length,
      },
      journalPhotos: {
        added: replaceJournalPhotos.length,
        updated: 0,
        skipped: (journalPhotos || []).length - replaceJournalPhotos.length,
      },
      journalAudio: {
        added: replaceJournalAudio.length,
        updated: 0,
        skipped: (journalAudio || []).length - replaceJournalAudio.length,
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
