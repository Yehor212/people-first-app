/**
 * Journal Import Service
 *
 * Imports journal backup from JSON file.
 * Deduplicates by entry ID (skips existing).
 */

import { db } from "@/storage/db";
import { triggerSync } from "@/storage/cloudSync";
import { sanitizeObject } from "@/lib/validation";
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
    typeof e.createdAt === "number"
  );
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

  // Get existing entry IDs for deduplication
  onProgress?.("Checking existing entries...");
  const existingIds = new Set((await db.journalEntries.toArray()).map((e) => e.id));

  // Import entries
  onProgress?.("Importing entries...");
  for (const entry of backup.entries) {
    if (!validateEntry(entry)) {
      const entryId = (entry as Record<string, unknown>).id;
      result.errors.push(`Invalid entry: ${typeof entryId === "string" ? entryId : "unknown"}`);
      continue;
    }

    if (existingIds.has(entry.id)) {
      result.skipped++;
      continue;
    }

    try {
      // Ensure required fields have defaults
      const safeEntry: JournalEntry = {
        id: entry.id,
        date: entry.date,
        title: entry.title || "",
        content: entry.content || "",
        stickers: Array.isArray(entry.stickers) ? entry.stickers : [],
        photoIds: Array.isArray(entry.photoIds) ? entry.photoIds : [],
        audioIds: Array.isArray(entry.audioIds) ? entry.audioIds : undefined,
        mood: entry.mood,
        tags: Array.isArray(entry.tags) ? entry.tags : [],
        templateId: entry.templateId,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt || entry.createdAt,
      };

      await db.journalEntries.add(safeEntry);
      result.imported++;
    } catch (err) {
      result.errors.push(
        `Failed to import entry ${entry.id}: ${err instanceof Error ? err.message : "unknown"}`
      );
    }
  }

  // Import photos
  if (backup.photos.length > 0) {
    onProgress?.("Importing photos...");
    const existingPhotoIds = new Set((await db.journalPhotos.toArray()).map((p) => p.id));

    for (const photo of backup.photos) {
      if (!photo.id || existingPhotoIds.has(photo.id)) continue;
      try {
        await db.journalPhotos.add(photo);
        result.photosImported++;
      } catch {
        // Skip duplicate or invalid photos
      }
    }
  }

  // Import audio
  if (backup.audio && backup.audio.length > 0) {
    onProgress?.("Importing audio...");
    const existingAudioIds = new Set((await db.journalAudio.toArray()).map((a) => a.id));

    for (const audio of backup.audio) {
      if (!audio.id || existingAudioIds.has(audio.id)) continue;
      try {
        await db.journalAudio.add(audio);
        result.audioImported++;
      } catch {
        // Skip duplicate or invalid audio
      }
    }
  }

  // Trigger backup sync so imported entries reach the cloud
  if (result.imported > 0) triggerSync();

  return result;
}
