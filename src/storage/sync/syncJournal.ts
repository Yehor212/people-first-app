/**
 * Journal sync operations — entries, photos, audio push/delete.
 * Extracted from realtimeSync.ts for modularity.
 */

import { logger } from "@/lib/logger";
import { writeEventAndBroadcast, getPersistentDeviceId } from "@/storage/eventSync";
import { isAbortError } from "@/lib/validation";
import { supabase } from "@/lib/supabaseClient";
import type { Database } from "@/types/supabase";
import type { JournalEntry, JournalPhoto, JournalAudio } from "@/features/journal/types";
import { journalStyleFieldsToCloud } from "@/features/journal/journalStyleFields";
import { offlineQueue } from "@/lib/offlineQueue";
import { detectNetworkError } from "./syncUtils";
import { getDeletedJournalEntryIds, trackDeletedJournalEntryId } from "@/storage/deletionTracker";
import { isEntityTombstonedOnServer } from "./serverTombstones";
import { isCloudSyncEnabled } from "@/lib/cloudSyncSettings";
import { validateSyncOwner } from "./syncOwner";
import { db } from "@/storage/db";
import { commitManualSyncEvent } from "./manualSyncAcceptance";

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

function throwIfJournalSyncAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  if (signal.reason instanceof Error) throw signal.reason;
  throw new DOMException("Journal sync was aborted", "AbortError");
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

async function publishJournalAudioParentRefresh(
  audio: JournalAudioSyncPayload,
  expectedOwnerUserId: string,
): Promise<void> {
  if (!audio.storagePath) return;
  const entry = await db.journalEntries.get(audio.entryId);
  if (!entry?.audioIds?.includes(audio.id)) return;
  const currentOwner = await validateJournalSyncOwner(expectedOwnerUserId);
  if (currentOwner !== expectedOwnerUserId) return;

  const deviceId = await getPersistentDeviceId();
  await writeEventAndBroadcast(
    "journal",
    entry.id,
    "upsert",
    entry as unknown as Record<string, unknown>,
    deviceId,
    { expectedOwnerUserId },
  );
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
  signal?: AbortSignal,
  eventIdempotencyKey?: string,
): Promise<void> => {
  throwIfJournalSyncAborted(signal);
  if (!isCloudSyncEnabled()) {
    if (eventIdempotencyKey) throw new Error("Journal cloud sync is unavailable");
    return;
  }

  const userId = await validateJournalSyncOwner(expectedOwnerUserId);
  if (!supabase) {
    if (eventIdempotencyKey) throw new Error("Journal remote sync is unavailable");
    return;
  }
  if (!userId) {
    logger.warn("[Sync] Cannot sync journal entry: User not authenticated");
    return;
  }

  const deletedEntryIds = await getDeletedJournalEntryIds();
  if (deletedEntryIds.has(entry.id)) {
    logger.warn("[Sync] Skipping tombstoned journal entry upsert");
    return;
  }

  if (!navigator.onLine) {
    if (eventIdempotencyKey) {
      throw new DOMException("Journal delivery paused while offline", "AbortError");
    }
    await offlineQueue.enqueue("SYNC_JOURNAL_ENTRY", entry.id, entry, {
      expectedOwnerUserId: userId,
    });
    logger.log("[Sync] Journal entry queued for offline sync");
    return;
  }

  if (await isEntityTombstonedOnServer("journal", entry.id, userId)) {
    await trackDeletedJournalEntryId(entry.id);
    logger.warn("[Sync] Skipping server-tombstoned journal entry upsert");
    return;
  }
  throwIfJournalSyncAborted(signal);

  try {
    const payload: Database["public"]["Tables"]["journal_entries"]["Insert"] = {
      id: entry.id,
      user_id: userId,
      date: entry.date,
      title: entry.title,
      content: entry.content,
      stickers: entry.stickers,
      mood: entry.mood || null,
      tags: entry.tags,
      template_id: entry.templateId || null,
      habit_snapshot: entry.habitSnapshot || null,
      photo_ids: entry.photoIds,
      audio_ids: entry.audioIds || [],
      photo_layout: entry.photoLayout || null,
      ...journalStyleFieldsToCloud(entry),
      created_at: entry.createdAt,
      updated_at: entry.updatedAt,
    };
    if (eventIdempotencyKey) {
      const { user_id: _owner, ...projection } = payload;
      const deviceId = await getPersistentDeviceId();
      await commitManualSyncEvent({
        ownerUserId: userId,
        operationId: eventIdempotencyKey,
        entityType: "journal",
        entityId: entry.id,
        op: "upsert",
        projection,
        deviceId,
        ...(signal ? { signal } : {}),
      });
      throwIfJournalSyncAborted(signal);
      logger.log("[Sync] Journal entry synced");
      return;
    }
    const upsertRequest = supabase
      .from("journal_entries")
      .upsert(payload, { onConflict: "id" })
      .select("id");
    const abortableUpsertRequest = signal
      ? upsertRequest.abortSignal(signal)
      : upsertRequest;
    const { data: acceptedRow, error } = await abortableUpsertRequest.maybeSingle();

    if (error) throw error;
    let accepted = Boolean(acceptedRow);
    if (!accepted) {
      const replayRequest = supabase.rpc(
        "is_journal_entry_payload_current",
        { p_entry: payload }
      );
      throwIfJournalSyncAborted(signal);
      const { data: exactReplay, error: replayError } = await replayRequest;
      throwIfJournalSyncAborted(signal);
      if (replayError) throw replayError;
      accepted = exactReplay === true;
    }
    if (!accepted) {
      logger.warn("[Sync] Stale journal entry rejected");
      return;
    }
    throwIfJournalSyncAborted(signal);
    logger.log("[Sync] Journal entry synced");
    const deviceId = await getPersistentDeviceId();
    const event = await writeEventAndBroadcast(
      "journal",
      entry.id,
      "upsert",
      entry as unknown as Record<string, unknown>,
      deviceId,
      {
        expectedOwnerUserId: userId,
        ...(eventIdempotencyKey
          ? {
              idempotencyKey: eventIdempotencyKey,
              queueOnFailure: false,
              requireRemoteCommit: true,
            }
          : {}),
      }
    );
    if (eventIdempotencyKey && !event) {
      throw new Error("Journal ordered event was not committed");
    }
    throwIfJournalSyncAborted(signal);
  } catch (error) {
    if (isAbortError(error)) {
      logger.warn("[Sync] Journal entry sync aborted");
      throw error;
    }
    const isNetworkError = detectNetworkError(error);
    if (isNetworkError) {
      if (eventIdempotencyKey) throw error;
      await offlineQueue.enqueue("SYNC_JOURNAL_ENTRY", entry.id, entry, {
        expectedOwnerUserId: userId,
      });
      logger.log("[Sync] Journal entry queued after network error");
    } else {
      // Keep failed journal writes visible to queue handlers; IndexedDB still has the data.
      logger.warn("[Sync] Journal entry sync failed (non-network)");
      throw error;
    }
  }
};

export const deleteJournalEntryFromCloud = async (
  entryId: string,
  expectedOwnerUserId: string,
  signal?: AbortSignal,
  eventIdempotencyKey?: string,
): Promise<void> => {
  throwIfJournalSyncAborted(signal);
  if (!isCloudSyncEnabled()) {
    if (eventIdempotencyKey) throw new Error("Journal cloud delete is unavailable");
    return;
  }

  await trackDeletedJournalEntryId(entryId);

  const userId = await validateJournalSyncOwner(expectedOwnerUserId);
  if (!supabase) {
    if (eventIdempotencyKey) throw new Error("Journal remote delete is unavailable");
    return;
  }
  if (!userId) return;

  if (!navigator.onLine) {
    if (eventIdempotencyKey) {
      throw new DOMException("Journal delete delivery paused while offline", "AbortError");
    }
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
    logger.log("[Sync] Journal entry delete queued for offline");
    return;
  }

  try {
    // Delete entry + associated photos/audio metadata from cloud tables
    // (Storage files are cleaned up separately by journalStorage.ts)
    const entryRequest = supabase
      .from("journal_entries")
      .delete()
      .eq("id", entryId)
      .eq("user_id", userId);
    const photosRequest = supabase
      .from("journal_photos")
      .delete()
      .eq("entry_id", entryId)
      .eq("user_id", userId);
    const audioRequest = supabase
      .from("journal_audio")
      .delete()
      .eq("entry_id", entryId)
      .eq("user_id", userId);
    const embeddingsRequest = supabase
      .from("journal_embeddings")
      .delete()
      .eq("entry_id", entryId)
      .eq("user_id", userId);
    const [entryRes, photosRes, audioRes, embeddingsRes] = await Promise.all([
      signal ? entryRequest.abortSignal(signal) : entryRequest,
      signal ? photosRequest.abortSignal(signal) : photosRequest,
      signal ? audioRequest.abortSignal(signal) : audioRequest,
      signal ? embeddingsRequest.abortSignal(signal) : embeddingsRequest,
    ]);

    if (entryRes.error) throw entryRes.error;
    if (photosRes.error) throw photosRes.error;
    if (audioRes.error) throw audioRes.error;
    if (embeddingsRes.error) throw embeddingsRes.error;

    throwIfJournalSyncAborted(signal);
    logger.log("[Sync] Journal entry deleted from cloud");
    const deviceId = await getPersistentDeviceId();
    const event = await writeEventAndBroadcast("journal", entryId, "delete", null, deviceId, {
      expectedOwnerUserId: userId,
      ...(eventIdempotencyKey
        ? {
            idempotencyKey: eventIdempotencyKey,
            queueOnFailure: false,
            requireRemoteCommit: true,
          }
        : {}),
    });
    if (eventIdempotencyKey && !event) {
      throw new Error("Journal delete ordered event was not committed");
    }
    throwIfJournalSyncAborted(signal);
  } catch (error) {
    if (isAbortError(error)) {
      logger.warn("[Sync] Journal entry delete aborted");
      throw error;
    }
    if (detectNetworkError(error)) {
      if (eventIdempotencyKey) throw error;
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
      logger.log("[Sync] Journal entry delete queued after network error");
      return;
    }
    logger.warn("[Sync] Failed to delete journal entry from cloud");
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
    logger.warn("[Sync] Skipping tombstoned journal photo upsert");
    return;
  }

  if (!navigator.onLine) {
    await queueJournalPhotoUploadRetry(photo, userId);
    logger.log("[Sync] Journal photo queued for media upload/metadata retry");
    return;
  }

  if (await isEntityTombstonedOnServer("journal", photo.entryId, userId)) {
    logger.warn("[Sync] Skipping server-tombstoned journal photo upsert");
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
    logger.log("[Sync] Journal photo metadata synced");
  } catch (error) {
    if (isAbortError(error)) {
      logger.warn("[Sync] Journal photo sync aborted");
      throw error;
    }
    if (detectNetworkError(error)) {
      await queueJournalPhotoUploadRetry(photo, userId);
      logger.log("[Sync] Journal photo queued after network error");
      return;
    }
    logger.warn("[Sync] Journal photo sync failed");
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
    logger.warn("[Sync] Skipping tombstoned journal audio upsert");
    return;
  }

  if (!navigator.onLine) {
    await queueJournalAudioUploadRetry(audio, userId);
    logger.log("[Sync] Journal audio queued for media upload/metadata retry");
    return;
  }

  if (await isEntityTombstonedOnServer("journal", audio.entryId, userId)) {
    logger.warn("[Sync] Skipping server-tombstoned journal audio upsert");
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
    logger.log("[Sync] Journal audio metadata synced");
    await publishJournalAudioParentRefresh(audio, userId);
  } catch (error) {
    if (isAbortError(error)) {
      logger.warn("[Sync] Journal audio sync aborted");
      throw error;
    }
    if (detectNetworkError(error)) {
      await queueJournalAudioUploadRetry(audio, userId);
      logger.log("[Sync] Journal audio queued after network error");
      return;
    }
    logger.warn("[Sync] Journal audio sync failed");
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
    logger.log("[Sync] Journal photo delete queued for offline");
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
      logger.warn("[Sync] Journal photo delete aborted");
      throw error;
    }
    if (detectNetworkError(error)) {
      await queueJournalPhotoDeleteRetry(photoId, userId);
      logger.log("[Sync] Journal photo delete queued after network error");
      return;
    }
    logger.warn("[Sync] Journal photo delete from cloud failed");
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
    logger.log("[Sync] Journal audio delete queued for offline");
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
      logger.warn("[Sync] Journal audio delete aborted");
      throw error;
    }
    if (detectNetworkError(error)) {
      await queueJournalAudioDeleteRetry(audioId, userId);
      logger.log("[Sync] Journal audio delete queued after network error");
      return;
    }
    logger.warn("[Sync] Journal audio delete from cloud failed");
    throw error;
  }
};
