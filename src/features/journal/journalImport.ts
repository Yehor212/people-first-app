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
import {
  assertDataWriteBoundaryGeneration,
  captureDataWriteBoundaryGeneration,
  runWithDataWriteBarrier,
} from "@/hooks/useIndexedDB";
import { encryptJournalContent, isEncryptedJournalContent } from "./journalCrypto";
import { encryptJournalMediaDataUrl, isEncryptedJournalMediaData } from "./journalMediaCrypto";
import { runWithJournalSecurityWriteLock } from "./journalSecurityWriteLock";
import { getJournalVaultKeyForWrite } from "./journalWriteSecurity";
import type { JournalEntry, JournalPhoto, JournalAudio } from "./types";

interface JournalBackup {
  version: number;
  exportedAt: number;
  entries: JournalEntry[];
  photos: JournalPhoto[];
  audio?: JournalAudio[];
}

export interface ImportResult {
  imported: number;
  skipped: number;
  photosImported: number;
  audioImported: number;
  errors: string[];
}

function validateBackup(data: unknown): data is JournalBackup {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  if (typeof obj.version !== "number") return false;
  if (!Array.isArray(obj.entries)) return false;
  if (!Array.isArray(obj.photos)) return false;
  return true;
}

function validateEntry(entry: unknown): entry is JournalEntry {
  if (!entry || typeof entry !== "object") return false;
  const e = entry as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.date === "string" &&
    typeof e.content === "string" &&
    typeof e.createdAt === "number" &&
    Array.isArray(e.stickers) &&
    e.stickers.every((item) => typeof item === "string") &&
    Array.isArray(e.photoIds) &&
    e.photoIds.every((item) => typeof item === "string") &&
    Array.isArray(e.tags) &&
    e.tags.every((item) => typeof item === "string") &&
    (e.audioIds === undefined ||
      (Array.isArray(e.audioIds) && e.audioIds.every((item) => typeof item === "string")))
  );
}

function validatePhoto(photo: unknown): photo is JournalPhoto {
  if (!photo || typeof photo !== "object") return false;
  const p = photo as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    typeof p.entryId === "string" &&
    typeof p.data === "string" &&
    typeof p.thumbnail === "string" &&
    typeof p.width === "number" &&
    typeof p.height === "number" &&
    typeof p.createdAt === "number" &&
    (p.storagePath === undefined || typeof p.storagePath === "string") &&
    (p.storageUrl === undefined || typeof p.storageUrl === "string")
  );
}

function validateAudio(audio: unknown): audio is JournalAudio {
  if (!audio || typeof audio !== "object") return false;
  const a = audio as Record<string, unknown>;
  return (
    typeof a.id === "string" &&
    typeof a.entryId === "string" &&
    typeof a.data === "string" &&
    typeof a.duration === "number" &&
    typeof a.mimeType === "string" &&
    typeof a.createdAt === "number" &&
    (a.storagePath === undefined || typeof a.storagePath === "string") &&
    (a.storageUrl === undefined || typeof a.storageUrl === "string")
  );
}

async function encryptImportedEntryContent(
  content: string,
  vaultKey: string | null
): Promise<string> {
  if (!vaultKey || !content || isEncryptedJournalContent(content)) return content;
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

async function captureJournalImportBoundary(): Promise<JournalImportBoundary> {
  const generation = captureDataWriteBoundaryGeneration();
  const [sessionOwnerUserId, localOwnerUserId] = await Promise.all([
    getCurrentSessionUserId(),
    getLocalDataOwnerId(),
  ]);
  assertDataWriteBoundaryGeneration(generation);
  return { generation, sessionOwnerUserId, localOwnerUserId };
}

async function assertJournalImportBoundary(boundary: JournalImportBoundary): Promise<void> {
  assertDataWriteBoundaryGeneration(boundary.generation);
  const [sessionOwnerUserId, localOwnerUserId] = await Promise.all([
    getCurrentSessionUserId(),
    getLocalDataOwnerId(),
  ]);
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
    errors: [],
  };

  // L21: Enforce file size limit before reading entire file into memory
  const MAX_IMPORT_SIZE = 50 * 1024 * 1024; // 50 MB
  if (file.size > MAX_IMPORT_SIZE) {
    result.errors.push("Import file too large (max 50 MB)");
    return result;
  }

  let boundary: JournalImportBoundary;
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
        const existingEntryIds = new Set(existingEntries.map((entry) => entry.id));
        const existingPhotoIds = new Set(existingPhotos.map((photo) => photo.id));
        const existingAudioIds = new Set(existingAudio.map((audio) => audio.id));
        const preparedEntries: JournalEntry[] = [];
        const preparedPhotos: JournalPhoto[] = [];
        const preparedAudio: JournalAudio[] = [];
        const importableEntryIds = new Set(existingEntryIds);

        onProgress?.("Importing entries...");
        for (const entry of backup.entries) {
          if (!validateEntry(entry)) {
            const entryId = (entry as Record<string, unknown>).id;
            result.errors.push(
              `Invalid entry: ${typeof entryId === "string" ? entryId : "unknown"}`
            );
            continue;
          }
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
              mood: entry.mood,
              tags: Array.isArray(entry.tags) ? entry.tags : [],
              templateId: entry.templateId,
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
              !importableEntryIds.has(photo.entryId)
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
              !importableEntryIds.has(audio.entryId)
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

        const importedPhotoOwners = new Map(
          preparedPhotos.map((photo) => [photo.id, photo.entryId])
        );
        const importedAudioOwners = new Map(
          preparedAudio.map((audio) => [audio.id, audio.entryId])
        );
        for (const entry of preparedEntries) {
          entry.photoIds = entry.photoIds.filter(
            (photoId) => importedPhotoOwners.get(photoId) === entry.id
          );
          if (entry.audioIds) {
            entry.audioIds = entry.audioIds.filter(
              (audioId) => importedAudioOwners.get(audioId) === entry.id
            );
          }
        }

        await db.transaction(
          "rw",
          [db.settings, db.journalEntries, db.journalPhotos, db.journalAudio],
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
            const committedEntryIds = new Set(
              (await db.journalEntries.toArray()).map((entry) => entry.id)
            );
            for (const entry of preparedEntries) {
              if (committedEntryIds.has(entry.id)) {
                result.skipped++;
                continue;
              }
              try {
                await db.journalEntries.add(entry);
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
                committedAudioIds.add(audio.id);
                result.audioImported++;
              } catch (error) {
                if (!isConstraintError(error)) throw error;
              }
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
    result.errors.push(
      "Import transaction failed: " + (txErr instanceof Error ? txErr.message : "unknown")
    );
  }

  // Trigger backup sync so imported entries reach the cloud
  if (result.imported > 0 || result.photosImported > 0 || result.audioImported > 0) triggerSync();

  return result;
}
