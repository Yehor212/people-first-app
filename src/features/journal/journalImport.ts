/**
 * Journal Import Service
 *
 * Imports journal backup from JSON file.
 * Deduplicates by entry ID (skips existing).
 */

import Dexie from "dexie";
import { db, getLocalDataOwnerId } from "@/storage/db";
import { triggerSync } from "@/storage/cloudSync";
import { sanitizeObject } from "@/lib/validation";
import { logger } from "@/lib/logger";
import { SK } from "@/lib/storageKeys";
import { getCurrentSessionUserId } from "@/lib/supabaseClient";
import { isCloudSyncEnabled } from "@/lib/cloudSyncSettings";
import {
  offlineQueue,
  persistCriticalOfflineActionInCurrentTransaction,
} from "@/lib/offlineQueue";
import {
  DELETION_TRACKER_KEYS,
  getDeletedJournalEntryIds,
  mergeDeletionTrackerIdsInCurrentTransaction,
} from "@/storage/deletionTracker";
import {
  assertDataWriteBoundaryGeneration,
  captureDataWriteBoundaryGeneration,
  runWithDataWriteBarrier,
} from "@/hooks/useIndexedDB";
import { encryptJournalContent, isEncryptedJournalContent } from "./journalCrypto";
import { encryptJournalMediaDataUrl, isEncryptedJournalMediaData } from "./journalMediaCrypto";
import { runWithJournalSecurityWriteLock } from "./journalSecurityWriteLock";
import { getJournalVaultKeyForWrite } from "./journalWriteSecurity";
import {
  MAX_AUDIO_PER_ENTRY,
  MAX_PHOTOS_PER_ENTRY,
  MAX_STICKERS_PER_ENTRY,
  type JournalEntry,
  type JournalPhoto,
  type JournalAudio,
} from "./types";
import { normalizeJournalPhotoLayout } from "./photoLayout";
import { normalizeJournalStyleFields } from "./journalStyleFields";
import { isCanonicalJournalDate } from "./journalDateUtils";
import { assertValidJournalAudio } from "./journalAudioValidation";
import { areAccountBoundaryWritersSuspended } from "@/lib/accountBoundaryState";

interface JournalBackup {
  version: number;
  exportedAt: number;
  entries: JournalEntry[];
  photos: JournalPhoto[];
  audio?: JournalAudio[];
  deletedEntryIds?: string[];
}

const JOURNAL_BACKUP_VERSION = 3;
const LEGACY_JOURNAL_BACKUP_VERSION = 2;
const MAX_IMPORT_SIZE = 50 * 1024 * 1024;
const MAX_HABIT_SNAPSHOT_ITEMS = 100;
const MAX_DELETED_ENTRY_IDS = 100_000;
const MAX_BACKUP_ID_LENGTH = 256;

function validateHabitSnapshot(value: unknown): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value) || value.length > MAX_HABIT_SNAPSHOT_ITEMS) return false;
  return value.every((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const habit = item as Record<string, unknown>;
    return (
      typeof habit.habitId === "string" &&
      typeof habit.habitName === "string" &&
      typeof habit.habitIcon === "string" &&
      typeof habit.completed === "boolean"
    );
  });
}

export interface ImportResult {
  imported: number;
  skipped: number;
  photosImported: number;
  audioImported: number;
  deleted: number;
  syncPending: boolean;
  errors: string[];
}

export interface JournalImportInspection {
  canImport: boolean;
  entries: number;
  photos: number;
  audio: number;
  deletions: number;
  deletionHistoryIncluded: boolean;
  issues: number;
  errors: string[];
}

function validateBackup(data: unknown): data is JournalBackup {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  if (!Number.isInteger(obj.version)) return false;
  if (typeof obj.exportedAt !== "number" || !Number.isFinite(obj.exportedAt)) return false;
  if (!Array.isArray(obj.entries)) return false;
  if (!Array.isArray(obj.photos)) return false;
  if (obj.audio !== undefined && !Array.isArray(obj.audio)) return false;
  return true;
}

function isSupportedJournalBackupVersion(version: number): boolean {
  return version === LEGACY_JOURNAL_BACKUP_VERSION || version === JOURNAL_BACKUP_VERSION;
}

function getValidatedBackupDeletedEntryIds(backup: JournalBackup): string[] | null {
  if (backup.version === LEGACY_JOURNAL_BACKUP_VERSION) return [];
  if (!Array.isArray(backup.deletedEntryIds)) return null;
  if (backup.deletedEntryIds.length > MAX_DELETED_ENTRY_IDS) return null;
  if (
    !backup.deletedEntryIds.every(
      (id) => typeof id === "string" && id.length > 0 && id.length <= MAX_BACKUP_ID_LENGTH,
    )
  ) {
    return null;
  }
  return [...new Set(backup.deletedEntryIds)];
}

function isValidBackupId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_BACKUP_ID_LENGTH;
}

function isFiniteTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function validateEntry(entry: unknown): entry is JournalEntry {
  if (!entry || typeof entry !== "object") return false;
  const e = entry as Record<string, unknown>;
  return (
    isValidBackupId(e.id) &&
    typeof e.date === "string" &&
    isCanonicalJournalDate(e.date) &&
    typeof e.title === "string" &&
    typeof e.content === "string" &&
    isFiniteTimestamp(e.createdAt) &&
    isFiniteTimestamp(e.updatedAt) &&
    Array.isArray(e.stickers) &&
    e.stickers.length <= MAX_STICKERS_PER_ENTRY &&
    e.stickers.every((item) => typeof item === "string") &&
    Array.isArray(e.photoIds) &&
    e.photoIds.length <= MAX_PHOTOS_PER_ENTRY &&
    e.photoIds.every(isValidBackupId) &&
    Array.isArray(e.tags) &&
    e.tags.every((item) => typeof item === "string") &&
    (e.audioIds === undefined ||
      (Array.isArray(e.audioIds) &&
        e.audioIds.length <= MAX_AUDIO_PER_ENTRY &&
        e.audioIds.every(isValidBackupId))) &&
    validateHabitSnapshot(e.habitSnapshot)
  );
}

function validatePhoto(photo: unknown): photo is JournalPhoto {
  if (!photo || typeof photo !== "object") return false;
  const p = photo as Record<string, unknown>;
  return (
    isValidBackupId(p.id) &&
    isValidBackupId(p.entryId) &&
    typeof p.data === "string" &&
    typeof p.thumbnail === "string" &&
    typeof p.width === "number" &&
    Number.isFinite(p.width) &&
    p.width > 0 &&
    typeof p.height === "number" &&
    Number.isFinite(p.height) &&
    p.height > 0 &&
    isFiniteTimestamp(p.createdAt) &&
    (p.storagePath === undefined || typeof p.storagePath === "string") &&
    (p.storageUrl === undefined || typeof p.storageUrl === "string")
  );
}

function validateAudio(audio: unknown): audio is JournalAudio {
  if (!audio || typeof audio !== "object") return false;
  const a = audio as Record<string, unknown>;
  const structurallyValid = (
    isValidBackupId(a.id) &&
    isValidBackupId(a.entryId) &&
    typeof a.data === "string" &&
    typeof a.duration === "number" &&
    Number.isFinite(a.duration) &&
    a.duration >= 0 &&
    typeof a.mimeType === "string" &&
    isFiniteTimestamp(a.createdAt) &&
    (a.storagePath === undefined || typeof a.storagePath === "string") &&
    (a.storageUrl === undefined || typeof a.storageUrl === "string")
  );
  if (!structurallyValid) return false;

  try {
    assertValidJournalAudio(a.data as string, a.duration as number, a.mimeType as string);
    return true;
  } catch {
    return false;
  }
}

function rejectedInspection(error: string): JournalImportInspection {
  return {
    canImport: false,
    entries: 0,
    photos: 0,
    audio: 0,
    deletions: 0,
    deletionHistoryIncluded: false,
    issues: 0,
    errors: [error],
  };
}

export async function inspectJournalBackup(file: File): Promise<JournalImportInspection> {
  if (file.size > MAX_IMPORT_SIZE) {
    return rejectedInspection("Import file too large (max 50 MB)");
  }

  let data: unknown;
  try {
    data = sanitizeObject(JSON.parse(await file.text()));
  } catch {
    return rejectedInspection("Invalid JSON file");
  }

  if (!validateBackup(data)) return rejectedInspection("Invalid backup format");
  if (!isSupportedJournalBackupVersion(data.version)) {
    return rejectedInspection(`Unsupported backup version: ${data.version}`);
  }
  const deletedEntryIds = getValidatedBackupDeletedEntryIds(data);
  if (!deletedEntryIds) return rejectedInspection("Invalid deletion history");

  const validEntries = data.entries.filter(validateEntry);
  const validEntryIds = new Set(validEntries.map((entry) => entry.id));
  let issues = data.entries.length - validEntries.length;
  let photos = 0;
  for (const photo of data.photos) {
    if (validatePhoto(photo) && validEntryIds.has(photo.entryId)) photos += 1;
    else issues += 1;
  }

  let audio = 0;
  for (const audioItem of data.audio || []) {
    if (validateAudio(audioItem) && validEntryIds.has(audioItem.entryId)) audio += 1;
    else issues += 1;
  }

  return {
    canImport: true,
    entries: validEntries.length,
    photos,
    audio,
    deletions: deletedEntryIds.length,
    deletionHistoryIncluded: data.version === JOURNAL_BACKUP_VERSION,
    issues,
    errors: [],
  };
}

async function encryptImportedEntryContent(
  content: string,
  vaultKey: string | null
): Promise<string> {
  if (!vaultKey || isEncryptedJournalContent(content)) return content;
  return encryptJournalContent(content, vaultKey);
}

async function encryptImportedMediaData(
  data: string | undefined,
  vaultKey: string | null
): Promise<string> {
  if (!data || !vaultKey || isEncryptedJournalMediaData(data)) return data || "";
  return encryptJournalMediaDataUrl(data, vaultKey);
}

function protectedImportedStoragePath(
  storagePath: string | undefined,
  vaultKey: string | null
): string | undefined {
  if (!vaultKey || !storagePath) return storagePath;
  return storagePath.toLowerCase().endsWith(".bin") ? storagePath : undefined;
}

function isConstraintError(error: unknown): boolean {
  return error instanceof Error && error.name === "ConstraintError";
}

interface JournalImportBoundary {
  generation: number;
  sessionOwnerUserId: string | null;
  localOwnerUserId: string | null;
}

function assertJournalImportWritersAvailable(): void {
  if (areAccountBoundaryWritersSuspended()) {
    throw new Error("Account boundary changed during diary import");
  }
}

async function captureJournalImportBoundary(): Promise<JournalImportBoundary> {
  assertJournalImportWritersAvailable();
  const generation = captureDataWriteBoundaryGeneration();
  const [sessionOwnerUserId, localOwnerUserId] = await Promise.all([
    getCurrentSessionUserId(),
    getLocalDataOwnerId(),
  ]);
  assertJournalImportWritersAvailable();
  assertDataWriteBoundaryGeneration(generation);
  return { generation, sessionOwnerUserId, localOwnerUserId };
}

async function assertJournalImportBoundary(boundary: JournalImportBoundary): Promise<void> {
  assertJournalImportWritersAvailable();
  assertDataWriteBoundaryGeneration(boundary.generation);
  const [sessionOwnerUserId, localOwnerUserId] = await Promise.all([
    getCurrentSessionUserId(),
    getLocalDataOwnerId(),
  ]);
  assertJournalImportWritersAvailable();
  assertDataWriteBoundaryGeneration(boundary.generation);
  if (
    sessionOwnerUserId !== boundary.sessionOwnerUserId ||
    localOwnerUserId !== boundary.localOwnerUserId
  ) {
    throw new Error("Account boundary changed during diary import");
  }
}

export async function importJournalBackup(
  file: File,
  onProgress?: (step: string) => void
): Promise<ImportResult> {
  const result: ImportResult = {
    imported: 0,
    skipped: 0,
    photosImported: 0,
    audioImported: 0,
    deleted: 0,
    syncPending: false,
    errors: [],
  };

  // L21: Enforce file size limit before reading entire file into memory
  if (file.size > MAX_IMPORT_SIZE) {
    result.errors.push("Import file too large (max 50 MB)");
    return result;
  }

  let boundary: JournalImportBoundary;
  let existingEntriesUpdated = 0;
  try {
    boundary = await captureJournalImportBoundary();
  } catch (error) {
    result.errors.push(
      "Import blocked by account boundary: " + (error instanceof Error ? error.message : "unknown")
    );
    return result;
  }

  onProgress?.("Reading file...");
  const text = await file.text();

  let data: unknown;
  try {
    data = sanitizeObject(JSON.parse(text));
  } catch {
    result.errors.push("Invalid JSON file");
    return result;
  }

  if (!validateBackup(data)) {
    result.errors.push("Invalid backup format");
    return result;
  }

  const backup = data;
  if (!isSupportedJournalBackupVersion(backup.version)) {
    result.errors.push(`Unsupported backup version: ${backup.version}`);
    return result;
  }
  const backupDeletedEntryIds = getValidatedBackupDeletedEntryIds(backup);
  if (!backupDeletedEntryIds) {
    result.errors.push("Invalid deletion history");
    return result;
  }

  const syncOwnerUserId =
    isCloudSyncEnabled() &&
    boundary.sessionOwnerUserId !== null &&
    boundary.sessionOwnerUserId === boundary.localOwnerUserId
      ? boundary.sessionOwnerUserId
      : null;
  let tombstonesQueued = 0;

  // Prepare non-IndexedDB work before the write transaction. IndexedDB can
  // auto-commit while WebCrypto is pending, which would break atomicity.
  try {
    await runWithDataWriteBarrier(async () => {
      await assertJournalImportBoundary(boundary);
      await runWithJournalSecurityWriteLock(async () => {
        // Password activation may have completed while the file was being read.
        // Capture the vault only after acquiring the shared mutation lock so the
        // transaction cannot commit plaintext outside the migration snapshot.
        const vaultKey = await getJournalVaultKeyForWrite();
        onProgress?.("Checking existing entries...");
        const [existingEntries, existingPhotos, existingAudio] = await Promise.all([
          db.journalEntries.toArray(),
          db.journalPhotos.toArray(),
          db.journalAudio.toArray(),
        ]);
        const localDeletedEntryIds = await getDeletedJournalEntryIds();
        const deletedEntryIds = new Set([
          ...localDeletedEntryIds,
          ...backupDeletedEntryIds,
        ]);
        const newBackupTombstoneIds = backupDeletedEntryIds.filter(
          (id) => !localDeletedEntryIds.has(id),
        );
        const existingEntryById = new Map(
          existingEntries
            .filter((entry) => !deletedEntryIds.has(entry.id))
            .map((entry) => [entry.id, entry]),
        );
        const existingEntryIds = new Set(existingEntryById.keys());
        const existingPhotoIds = new Set(existingPhotos.map((photo) => photo.id));
        const existingAudioIds = new Set(existingAudio.map((audio) => audio.id));
        const preparedEntries: JournalEntry[] = [];
        const preparedPhotos: JournalPhoto[] = [];
        const preparedAudio: JournalAudio[] = [];
        const importableEntryIds = new Set(existingEntryIds);
        const requestedMediaByEntry = new Map<
          string,
          { photoIds: Set<string>; audioIds: Set<string>; photoLayout: unknown }
        >();

        onProgress?.("Importing entries...");
        for (const entry of backup.entries) {
          if (!validateEntry(entry)) {
            const entryId = (entry as Record<string, unknown>).id;
            result.errors.push(
              `Invalid entry: ${typeof entryId === "string" ? entryId : "unknown"}`
            );
            continue;
          }
          if (deletedEntryIds.has(entry.id)) {
            result.skipped++;
            continue;
          }
          requestedMediaByEntry.set(entry.id, {
            photoIds: new Set(entry.photoIds),
            audioIds: new Set(entry.audioIds || []),
            photoLayout: entry.photoLayout,
          });
          if (existingEntryIds.has(entry.id)) {
            result.skipped++;
            continue;
          }

          try {
            preparedEntries.push({
              id: entry.id,
              date: entry.date,
              title: entry.title || "",
              content: await encryptImportedEntryContent(entry.content || "", vaultKey),
              stickers: Array.isArray(entry.stickers) ? entry.stickers : [],
              photoIds: Array.isArray(entry.photoIds) ? entry.photoIds : [],
              audioIds: Array.isArray(entry.audioIds) ? entry.audioIds : undefined,
              photoLayout: normalizeJournalPhotoLayout(
                (entry as { photoLayout?: unknown }).photoLayout,
                Array.isArray(entry.photoIds) ? entry.photoIds : [],
              ),
              ...normalizeJournalStyleFields(entry),
              mood: entry.mood,
              tags: Array.isArray(entry.tags) ? entry.tags : [],
              templateId: entry.templateId,
              habitSnapshot: entry.habitSnapshot,
              createdAt: entry.createdAt,
              updatedAt: entry.updatedAt || entry.createdAt,
            });
            importableEntryIds.add(entry.id);
          } catch (error) {
            result.errors.push(
              `Failed to prepare entry ${entry.id}: ${error instanceof Error ? error.message : "unknown"}`
            );
          }
        }

        if (backup.photos.length > 0) {
          onProgress?.("Importing photos...");
          for (const photo of backup.photos) {
            if (
              !validatePhoto(photo) ||
              existingPhotoIds.has(photo.id) ||
              !importableEntryIds.has(photo.entryId) ||
              !requestedMediaByEntry.get(photo.entryId)?.photoIds.has(photo.id)
            ) {
              continue;
            }
            try {
              preparedPhotos.push({
                ...photo,
                data: await encryptImportedMediaData(photo.data, vaultKey),
                thumbnail: await encryptImportedMediaData(photo.thumbnail, vaultKey),
                storagePath: protectedImportedStoragePath(photo.storagePath, vaultKey),
                storageUrl: vaultKey ? undefined : photo.storageUrl,
              });
            } catch (error) {
              result.errors.push(
                `Failed to prepare photo ${photo.id}: ${error instanceof Error ? error.message : "unknown"}`
              );
            }
          }
        }

        if (backup.audio && backup.audio.length > 0) {
          onProgress?.("Importing audio...");
          for (const audio of backup.audio) {
            if (
              !validateAudio(audio) ||
              existingAudioIds.has(audio.id) ||
              !importableEntryIds.has(audio.entryId) ||
              !requestedMediaByEntry.get(audio.entryId)?.audioIds.has(audio.id)
            ) {
              continue;
            }
            try {
              preparedAudio.push({
                ...audio,
                data: await encryptImportedMediaData(audio.data, vaultKey),
                storagePath: protectedImportedStoragePath(audio.storagePath, vaultKey),
                storageUrl: vaultKey ? undefined : audio.storageUrl,
              });
            } catch (error) {
              result.errors.push(
                `Failed to prepare audio ${audio.id}: ${error instanceof Error ? error.message : "unknown"}`
              );
            }
          }
        }

        const importedPhotoOwners = new Map<string, string>();
        existingPhotos.forEach((photo) => importedPhotoOwners.set(photo.id, photo.entryId));
        preparedPhotos.forEach((photo) => importedPhotoOwners.set(photo.id, photo.entryId));
        const importedAudioOwners = new Map<string, string>();
        existingAudio.forEach((audio) => importedAudioOwners.set(audio.id, audio.entryId));
        preparedAudio.forEach((audio) => importedAudioOwners.set(audio.id, audio.entryId));
        for (const entry of preparedEntries) {
          entry.photoIds = entry.photoIds.filter(
            (photoId) => importedPhotoOwners.get(photoId) === entry.id
          );
          entry.photoLayout = normalizeJournalPhotoLayout(entry.photoLayout, entry.photoIds);
          if (entry.audioIds) {
            entry.audioIds = entry.audioIds.filter(
              (audioId) => importedAudioOwners.get(audioId) === entry.id
            );
          }
        }

        const existingEntryMediaUpdates = [...requestedMediaByEntry.entries()].flatMap(
          ([entryId, requested]) => {
            const existingEntry = existingEntryById.get(entryId);
            if (!existingEntry) return [];
            const photoIds = [
              ...new Set([
                ...(existingEntry.photoIds || []),
                ...[...requested.photoIds].filter(
                  (photoId) => importedPhotoOwners.get(photoId) === entryId,
                ),
              ]),
            ].slice(0, MAX_PHOTOS_PER_ENTRY);
            const audioIds = [
              ...new Set([
                ...(existingEntry.audioIds || []),
                ...[...requested.audioIds].filter(
                  (audioId) => importedAudioOwners.get(audioId) === entryId,
                ),
              ]),
            ].slice(0, MAX_AUDIO_PER_ENTRY);
            const incomingLayout = normalizeJournalPhotoLayout(requested.photoLayout, photoIds);
            const photoLayout = normalizeJournalPhotoLayout(
              { ...(existingEntry.photoLayout || {}), ...(incomingLayout || {}) },
              photoIds,
            );
            if (
              photoIds.length === (existingEntry.photoIds || []).length &&
              audioIds.length === (existingEntry.audioIds || []).length
            ) {
              return [];
            }
            return [{ entryId, photoIds, audioIds, photoLayout }];
          },
        );

        await assertJournalImportBoundary(boundary);
        await db.transaction(
          "rw",
          [db.settings, db.journalEntries, db.journalPhotos, db.journalAudio, db.offlineQueue],
          async () => {
            assertDataWriteBoundaryGeneration(boundary.generation);
            const ownerRecord = await db.settings.get(SK.DATA_OWNER_ID);
            const transactionOwnerUserId =
              typeof ownerRecord?.value === "string" && ownerRecord.value.trim()
                ? ownerRecord.value
                : null;
            if (transactionOwnerUserId !== boundary.localOwnerUserId) {
              throw new Error("Account boundary changed during diary import");
            }
            const transactionDeletedEntryIds =
              await mergeDeletionTrackerIdsInCurrentTransaction(
                DELETION_TRACKER_KEYS.journal,
                backupDeletedEntryIds,
              );
            const backupDeletedEntryIdSet = new Set(backupDeletedEntryIds);
            const transactionEntries = await db.journalEntries.toArray();
            const tombstonedEntries = transactionEntries.filter((entry) =>
              backupDeletedEntryIdSet.has(entry.id),
            );
            const transactionPhotos = await db.journalPhotos.toArray();
            const tombstonedPhotos = transactionPhotos.filter((photo) =>
              backupDeletedEntryIdSet.has(photo.entryId),
            );
            const transactionAudio = await db.journalAudio.toArray();
            const tombstonedAudio = transactionAudio.filter((audio) =>
              backupDeletedEntryIdSet.has(audio.entryId),
            );

            if (syncOwnerUserId) {
              for (const entryId of newBackupTombstoneIds) {
                await persistCriticalOfflineActionInCurrentTransaction(
                  "DELETE_JOURNAL_ENTRY",
                  entryId,
                  { id: entryId },
                  syncOwnerUserId,
                );
                tombstonesQueued++;
              }
              for (const photo of tombstonedPhotos) {
                await persistCriticalOfflineActionInCurrentTransaction(
                  "DELETE_JOURNAL_PHOTO_STORAGE",
                  `journal-photo-delete:${photo.id}`,
                  photo.storagePath
                    ? { id: photo.id, storagePath: photo.storagePath }
                    : { id: photo.id },
                  syncOwnerUserId,
                );
              }
              for (const audio of tombstonedAudio) {
                await persistCriticalOfflineActionInCurrentTransaction(
                  "DELETE_JOURNAL_AUDIO_STORAGE",
                  `journal-audio-delete:${audio.id}`,
                  audio.storagePath
                    ? { id: audio.id, storagePath: audio.storagePath }
                    : { id: audio.id },
                  syncOwnerUserId,
                );
              }
            }
            if (tombstonedPhotos.length > 0) {
              await db.journalPhotos.bulkDelete(tombstonedPhotos.map((photo) => photo.id));
            }
            if (tombstonedAudio.length > 0) {
              await db.journalAudio.bulkDelete(tombstonedAudio.map((audio) => audio.id));
            }
            if (tombstonedEntries.length > 0) {
              await db.journalEntries.bulkDelete(tombstonedEntries.map((entry) => entry.id));
              result.deleted += tombstonedEntries.length;
            }
            const committedEntryIds = new Set(
              (await db.journalEntries.toArray())
                .filter((entry) => !transactionDeletedEntryIds.has(entry.id))
                .map((entry) => entry.id),
            );
            for (const entry of preparedEntries) {
              if (transactionDeletedEntryIds.has(entry.id) || committedEntryIds.has(entry.id)) {
                result.skipped++;
                continue;
              }
              try {
                await db.journalEntries.add(entry);
                if (syncOwnerUserId) {
                  await persistCriticalOfflineActionInCurrentTransaction(
                    "SYNC_JOURNAL_ENTRY",
                    entry.id,
                    entry,
                    syncOwnerUserId,
                  );
                }
                committedEntryIds.add(entry.id);
                result.imported++;
              } catch (error) {
                if (!isConstraintError(error)) throw error;
                committedEntryIds.add(entry.id);
                result.skipped++;
              }
            }

            const committedPhotoIds = new Set(
              (await db.journalPhotos.toArray()).map((photo) => photo.id)
            );
            for (const photo of preparedPhotos) {
              if (committedPhotoIds.has(photo.id) || !committedEntryIds.has(photo.entryId))
                continue;
              try {
                await db.journalPhotos.add(photo);
                if (syncOwnerUserId) {
                  await persistCriticalOfflineActionInCurrentTransaction(
                    "UPLOAD_JOURNAL_PHOTO_STORAGE",
                    `journal-photo-upload:${photo.id}`,
                    { id: photo.id },
                    syncOwnerUserId,
                  );
                }
                committedPhotoIds.add(photo.id);
                result.photosImported++;
              } catch (error) {
                if (!isConstraintError(error)) throw error;
              }
            }

            const committedAudioIds = new Set(
              (await db.journalAudio.toArray()).map((audio) => audio.id)
            );
            for (const audio of preparedAudio) {
              if (committedAudioIds.has(audio.id) || !committedEntryIds.has(audio.entryId))
                continue;
              try {
                await db.journalAudio.add(audio);
                if (syncOwnerUserId) {
                  await persistCriticalOfflineActionInCurrentTransaction(
                    "UPLOAD_JOURNAL_AUDIO_STORAGE",
                    `journal-audio-upload:${audio.id}`,
                    { id: audio.id },
                    syncOwnerUserId,
                  );
                }
                committedAudioIds.add(audio.id);
                result.audioImported++;
              } catch (error) {
                if (!isConstraintError(error)) throw error;
              }
            }

            for (const update of existingEntryMediaUpdates) {
              if (transactionDeletedEntryIds.has(update.entryId)) continue;
              await db.journalEntries.update(update.entryId, {
                photoIds: update.photoIds,
                audioIds: update.audioIds.length > 0 ? update.audioIds : undefined,
                photoLayout: update.photoLayout,
                updatedAt: Date.now(),
              });
              if (syncOwnerUserId) {
                const updatedEntry = await db.journalEntries.get(update.entryId);
                if (updatedEntry) {
                  await persistCriticalOfflineActionInCurrentTransaction(
                    "SYNC_JOURNAL_ENTRY",
                    update.entryId,
                    updatedEntry,
                    syncOwnerUserId,
                  );
                }
              }
              existingEntriesUpdated++;
            }

            const finalSessionOwnerUserId = await Dexie.waitFor(getCurrentSessionUserId());
            assertDataWriteBoundaryGeneration(boundary.generation);
            if (finalSessionOwnerUserId !== boundary.sessionOwnerUserId) {
              throw new Error("Account boundary changed during diary import");
            }
          }
        );
      });
    });
  } catch (txErr) {
    logger.error("[JournalImport] Transaction failed — all writes rolled back", txErr);
    result.imported = 0;
    result.photosImported = 0;
    result.audioImported = 0;
    result.deleted = 0;
    existingEntriesUpdated = 0;
    tombstonesQueued = 0;
    result.errors.push(
      "Import transaction failed: " + (txErr instanceof Error ? txErr.message : "unknown")
    );
  }

  if (
    syncOwnerUserId &&
    (result.imported > 0 ||
      existingEntriesUpdated > 0 ||
      tombstonesQueued > 0 ||
      result.photosImported > 0 ||
      result.audioImported > 0)
  ) {
    try {
      await offlineQueue.wakeFromDurableStorage();
    } catch (error) {
      result.syncPending = true;
      logger.warn("[JournalImport] Imported locally; durable sync wake will retry", {
        name: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }

  // Trigger backup sync so imported entries reach the cloud
  if (
    result.imported > 0 ||
    result.deleted > 0 ||
    tombstonesQueued > 0 ||
    result.photosImported > 0 ||
    result.audioImported > 0
  ) {
    triggerSync();
  }

  return result;
}
