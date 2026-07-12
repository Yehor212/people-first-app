/**
 * Journal sync operations — entries, photos, audio push/delete.
 * Extracted from realtimeSync.ts for modularity.
 */

import { logger } from "@/lib/logger";
import { writeEventAndBroadcast, getPersistentDeviceId } from "@/storage/eventSync";
import { isAbortError } from "@/lib/validation";
import { supabase } from "@/lib/supabaseClient";
import type { Json } from "@/types/supabase";
import type { JournalEntry, JournalPhoto, JournalAudio } from "@/features/journal/types";
import { offlineQueue } from "@/lib/offlineQueue";
import { detectNetworkError } from "./syncUtils";
import { getDeletedJournalEntryIds, trackDeletedJournalEntryId } from "@/storage/deletionTracker";
import { isEntityTombstonedOnServer } from "./serverTombstones";
import { isCloudSyncEnabled } from "@/lib/cloudSyncSettings";
import { validateSyncOwner } from "./syncOwner";

type JournalPhotoSyncPayload = Pick<
  JournalPhoto,
  "id" | "entryId" | "width" | "height" | "createdAt" | "storagePath"
>;

type JournalAudioSyncPayload = Pick<
  JournalAudio,
  "id" | "entryId" | "duration" | "mimeType" | "createdAt" | "storagePath"
>;

async function validateJournalSyncOwner(
  expectedOwnerUserId: string,
): Promise<string | null> {
  return validateSyncOwner(expectedOwnerUserId, "Journal sync");
}

function toPhotoSyncPayload(photo: JournalPhotoSyncPayload): JournalPhotoSyncPayload {
  return {
    id: photo.id,
    entryId: photo.entryId,
    width: photo.width,
    height: photo.height,
    createdAt: photo.createdAt,
    storagePath: photo.storagePath,
  };
}

function toAudioSyncPayload(audio: JournalAudioSyncPayload): JournalAudioSyncPayload {
  return {
    id: audio.id,
    entryId: audio.entryId,
    duration: audio.duration,
    mimeType: audio.mimeType,
    createdAt: audio.createdAt,
    storagePath: audio.storagePath,
  };
}

async function queueJournalPhotoUploadRetry(
  photo: JournalPhotoSyncPayload,
  expectedOwnerUserId: string
): Promise<void> {
  await offlineQueue.enqueue(
    "UPLOAD_JOURNAL_PHOTO_STORAGE",
    "journal-photo-upload:" + photo.id,
    { id: photo.id, metadata: toPhotoSyncPayload(photo) },
    { expectedOwnerUserId, priority: "high" }
  );
}

async function queueJournalAudioUploadRetry(
  audio: JournalAudioSyncPayload,
  expectedOwnerUserId: string
): Promise<void> {
  await offlineQueue.enqueue(
    "UPLOAD_JOURNAL_AUDIO_STORAGE",
    "journal-audio-upload:" + audio.id,
    { id: audio.id, metadata: toAudioSyncPayload(audio) },
    { expectedOwnerUserId, priority: "high" }
  );
}

async function queueJournalPhotoDeleteRetry(
  photoId: string,
  expectedOwnerUserId: string
): Promise<void> {
  await offlineQueue.enqueue(
    "DELETE_JOURNAL_PHOTO_STORAGE",
    "journal-photo-delete:" + photoId,
    { id: photoId },
    { expectedOwnerUserId, priority: "high" }
  );
}

async function queueJournalAudioDeleteRetry(
  audioId: string,
  expectedOwnerUserId: string
): Promise<void> {
  await offlineQueue.enqueue(
    "DELETE_JOURNAL_AUDIO_STORAGE",
    "journal-audio-delete:" + audioId,
    { id: audioId },
    { expectedOwnerUserId, priority: "high" }
  );
}

// ============================================
// JOURNAL SYNC
// ============================================

/**
 * Sync a journal entry to cloud (metadata only — media binary in Storage).
 * Uses last-write-wins conflict resolution via updated_at.
 */
export const syncJournalEntry = async (
  entry: JournalEntry,
  expectedOwnerUserId: string,
): Promise<void> => {
  if (!isCloudSyncEnabled()) return;

  const userId = await validateJournalSyncOwner(expectedOwnerUserId);
  if (!supabase) return;
  if (!userId) {
    logger.warn("[Sync] Cannot sync journal entry: User not authenticated");
    return;
  }

  const deletedEntryIds = await getDeletedJournalEntryIds();
  if (deletedEntryIds.has(entry.id)) {
    logger.warn("[Sync] Skipping tombstoned journal entry upsert:", entry.id);
    return;
  }

  if (!navigator.onLine) {
    await offlineQueue.enqueue("SYNC_JOURNAL_ENTRY", entry.id, entry, {
      expectedOwnerUserId: userId,
    });
    logger.log("[Sync] Journal entry queued for offline sync:", entry.id);
    return;
  }

  if (await isEntityTombstonedOnServer("journal", entry.id, userId)) {
    await trackDeletedJournalEntryId(entry.id);
    logger.warn("[Sync] Skipping server-tombstoned journal entry upsert:", entry.id);
    return;
  }

  try {
    const { error } = await supabase.from("journal_entries").upsert(
      {
        id: entry.id,
        user_id: userId,
        date: entry.date,
        title: entry.title,
        content: entry.content,
        stickers: entry.stickers,
        mood: entry.mood || null,
        tags: entry.tags,
        template_id: entry.templateId || null,
        habit_snapshot: (entry.habitSnapshot as unknown as Json) || null,
        photo_ids: entry.photoIds,
        audio_ids: entry.audioIds || [],
        created_at: entry.createdAt,
        updated_at: entry.updatedAt,
      },
      { onConflict: "id" }
    );

    if (error) throw error;
    logger.log("[Sync] Journal entry synced:", entry.id);
    const deviceId = await getPersistentDeviceId();
    await writeEventAndBroadcast(
      "journal",
      entry.id,
      "upsert",
      entry as unknown as Record<string, unknown>,
      deviceId,
      { expectedOwnerUserId: userId }
    );
  } catch (error) {
    if (isAbortError(error)) {
      logger.warn("[Sync] Journal entry sync aborted:", entry.id);
      return;
    }
    const isNetworkError = detectNetworkError(error);
    if (isNetworkError) {
      await offlineQueue.enqueue("SYNC_JOURNAL_ENTRY", entry.id, entry, {
        expectedOwnerUserId: userId,
      });
      logger.log("[Sync] Journal entry queued after network error:", entry.id);
    } else {
      // Keep failed journal writes visible to queue handlers; IndexedDB still has the data.
      logger.warn("[Sync] Journal entry sync failed (non-network):", error);
      throw error;
    }
  }
};

export const deleteJournalEntryFromCloud = async (
  entryId: string,
  expectedOwnerUserId: string,
): Promise<void> => {
  if (!isCloudSyncEnabled()) return;

  await trackDeletedJournalEntryId(entryId);

  const userId = await validateJournalSyncOwner(expectedOwnerUserId);
  if (!supabase || !userId) return;

  if (!navigator.onLine) {
    await offlineQueue.enqueue(
      "DELETE_JOURNAL_ENTRY",
      entryId,
      {
        id: entryId,
      },
      {
        expectedOwnerUserId: userId,
      }
    );
    logger.log("[Sync] Journal entry delete queued for offline:", entryId);
    return;
  }

  try {
    // Delete entry + associated photos/audio metadata from cloud tables
    // (Storage files are cleaned up separately by journalStorage.ts)
    const [entryRes, photosRes, audioRes] = await Promise.all([
      supabase.from("journal_entries").delete().eq("id", entryId).eq("user_id", userId),
      supabase.from("journal_photos").delete().eq("entry_id", entryId).eq("user_id", userId),
      supabase.from("journal_audio").delete().eq("entry_id", entryId).eq("user_id", userId),
    ]);

    if (entryRes.error) throw entryRes.error;
    if (photosRes.error) logger.warn("[Sync] Journal photos delete failed:", photosRes.error);
    if (audioRes.error) logger.warn("[Sync] Journal audio delete failed:", audioRes.error);

    logger.log("[Sync] Journal entry deleted from cloud:", entryId);
    const deviceId = await getPersistentDeviceId();
    await writeEventAndBroadcast("journal", entryId, "delete", null, deviceId, {
      expectedOwnerUserId: userId,
    });
  } catch (error) {
    if (isAbortError(error)) {
      logger.warn("[Sync] Journal entry delete aborted:", entryId);
      return;
    }
    if (detectNetworkError(error)) {
      await offlineQueue.enqueue(
        "DELETE_JOURNAL_ENTRY",
        entryId,
        {
          id: entryId,
        },
        {
          expectedOwnerUserId: userId,
        }
      );
      logger.log("[Sync] Journal entry delete queued after network error:", entryId);
      return;
    }
    logger.warn("[Sync] Failed to delete journal entry from cloud:", error);
    throw error;
  }
};

/**
 * Sync photo metadata to cloud (NOT the binary — that's in Storage bucket).
 * Fire-and-forget: called after photo is saved to IndexedDB.
 */
export const syncJournalPhoto = async (
  photo: JournalPhotoSyncPayload,
  expectedOwnerUserId: string,
): Promise<void> => {
  if (!isCloudSyncEnabled()) return;

  const userId = await validateJournalSyncOwner(expectedOwnerUserId);
  if (!supabase || !userId) return;

  const deletedEntryIds = await getDeletedJournalEntryIds();
  if (deletedEntryIds.has(photo.entryId)) {
    logger.warn("[Sync] Skipping tombstoned journal photo upsert:", photo.id);
    return;
  }

  if (!navigator.onLine) {
    await queueJournalPhotoUploadRetry(photo, userId);
    logger.log("[Sync] Journal photo queued for media upload/metadata retry:", photo.id);
    return;
  }

  if (await isEntityTombstonedOnServer("journal", photo.entryId, userId)) {
    logger.warn("[Sync] Skipping server-tombstoned journal photo upsert:", photo.id);
    return;
  }

  try {
    const { error } = await supabase.from("journal_photos").upsert(
      {
        id: photo.id,
        user_id: userId,
        entry_id: photo.entryId,
        width: photo.width,
        height: photo.height,
        storage_path: photo.storagePath || null,
        storage_url: null,
        created_at: photo.createdAt,
      },
      { onConflict: "id" }
    );

    if (error) throw error;
    logger.log("[Sync] Journal photo metadata synced:", photo.id);
  } catch (error) {
    if (isAbortError(error)) {
      logger.warn("[Sync] Journal photo sync aborted:", photo.id);
      return;
    }
    if (detectNetworkError(error)) {
      await queueJournalPhotoUploadRetry(photo, userId);
      logger.log("[Sync] Journal photo queued after network error:", photo.id);
      return;
    }
    logger.warn("[Sync] Journal photo sync failed:", error);
    throw error;
  }
};

/**
 * Sync audio metadata to cloud.
 */
export const syncJournalAudio = async (
  audio: JournalAudioSyncPayload,
  expectedOwnerUserId: string,
): Promise<void> => {
  if (!isCloudSyncEnabled()) return;

  const userId = await validateJournalSyncOwner(expectedOwnerUserId);
  if (!supabase || !userId) return;

  const deletedEntryIds = await getDeletedJournalEntryIds();
  if (deletedEntryIds.has(audio.entryId)) {
    logger.warn("[Sync] Skipping tombstoned journal audio upsert:", audio.id);
    return;
  }

  if (!navigator.onLine) {
    await queueJournalAudioUploadRetry(audio, userId);
    logger.log("[Sync] Journal audio queued for media upload/metadata retry:", audio.id);
    return;
  }

  if (await isEntityTombstonedOnServer("journal", audio.entryId, userId)) {
    logger.warn("[Sync] Skipping server-tombstoned journal audio upsert:", audio.id);
    return;
  }

  try {
    const { error } = await supabase.from("journal_audio").upsert(
      {
        id: audio.id,
        user_id: userId,
        entry_id: audio.entryId,
        duration: audio.duration,
        mime_type: audio.mimeType,
        storage_path: audio.storagePath || null,
        storage_url: null,
        created_at: audio.createdAt,
      },
      { onConflict: "id" }
    );

    if (error) throw error;
    logger.log("[Sync] Journal audio metadata synced:", audio.id);
  } catch (error) {
    if (isAbortError(error)) {
      logger.warn("[Sync] Journal audio sync aborted:", audio.id);
      return;
    }
    if (detectNetworkError(error)) {
      await queueJournalAudioUploadRetry(audio, userId);
      logger.log("[Sync] Journal audio queued after network error:", audio.id);
      return;
    }
    logger.warn("[Sync] Journal audio sync failed:", error);
    throw error;
  }
};

export const deleteJournalPhotoFromCloud = async (
  photoId: string,
  expectedOwnerUserId: string,
): Promise<void> => {
  if (!isCloudSyncEnabled()) return;

  const userId = await validateJournalSyncOwner(expectedOwnerUserId);
  if (!supabase || !userId) return;

  if (!navigator.onLine) {
    await queueJournalPhotoDeleteRetry(photoId, userId);
    logger.log("[Sync] Journal photo delete queued for offline:", photoId);
    return;
  }

  try {
    const { error } = await supabase
      .from("journal_photos")
      .delete()
      .eq("id", photoId)
      .eq("user_id", userId);
    if (error) throw error;
  } catch (error) {
    if (isAbortError(error)) {
      logger.warn("[Sync] Journal photo delete aborted:", photoId);
      return;
    }
    if (detectNetworkError(error)) {
      await queueJournalPhotoDeleteRetry(photoId, userId);
      logger.log("[Sync] Journal photo delete queued after network error:", photoId);
      return;
    }
    logger.warn("[Sync] Journal photo delete from cloud failed:", error);
    throw error;
  }
};

export const deleteJournalAudioFromCloud = async (
  audioId: string,
  expectedOwnerUserId: string,
): Promise<void> => {
  if (!isCloudSyncEnabled()) return;

  const userId = await validateJournalSyncOwner(expectedOwnerUserId);
  if (!supabase || !userId) return;

  if (!navigator.onLine) {
    await queueJournalAudioDeleteRetry(audioId, userId);
    logger.log("[Sync] Journal audio delete queued for offline:", audioId);
    return;
  }

  try {
    const { error } = await supabase
      .from("journal_audio")
      .delete()
      .eq("id", audioId)
      .eq("user_id", userId);
    if (error) throw error;
  } catch (error) {
    if (isAbortError(error)) {
      logger.warn("[Sync] Journal audio delete aborted:", audioId);
      return;
    }
    if (detectNetworkError(error)) {
      await queueJournalAudioDeleteRetry(audioId, userId);
      logger.log("[Sync] Journal audio delete queued after network error:", audioId);
      return;
    }
    logger.warn("[Sync] Journal audio delete from cloud failed:", error);
    throw error;
  }
};
