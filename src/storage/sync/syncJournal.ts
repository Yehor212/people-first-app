/**
 * Journal sync operations — entries, photos, audio push/delete.
 * Extracted from realtimeSync.ts for modularity.
 */

import { logger } from "@/lib/logger";
import { writeEventAndBroadcast, getPersistentDeviceId } from "@/storage/eventSync";
import { isAbortError } from "@/lib/validation";
import { supabase, getCurrentUserId } from "@/lib/supabaseClient";
import type { Json } from "@/types/supabase";
import type { JournalEntry, JournalPhoto, JournalAudio } from "@/features/journal/types";
import { offlineQueue } from "@/lib/offlineQueue";
import { generateEmbeddings } from "@/lib/journalAI";
import { detectNetworkError } from "./syncUtils";

// ============================================
// JOURNAL SYNC
// ============================================

/**
 * Sync a journal entry to cloud (metadata only — media binary in Storage).
 * Uses last-write-wins conflict resolution via updated_at.
 */
export const syncJournalEntry = async (entry: JournalEntry): Promise<void> => {
  const userId = await getCurrentUserId();
  if (!supabase) return;
  if (!userId) {
    logger.warn("[Sync] Cannot sync journal entry: User not authenticated");
    return;
  }

  if (!navigator.onLine) {
    await offlineQueue.enqueue("SYNC_JOURNAL_ENTRY", entry.id, entry);
    logger.log("[Sync] Journal entry queued for offline sync:", entry.id);
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
      deviceId
    );

    // Fire-and-forget: generate vector embedding for semantic search
    generateEmbeddings([entry.id]).catch((err) =>
      logger.warn("[Sync]", "Embedding generation failed:", err)
    );
  } catch (error) {
    if (isAbortError(error)) {
      logger.warn("[Sync] Journal entry sync aborted:", entry.id);
      return;
    }
    const isNetworkError = detectNetworkError(error);
    if (isNetworkError) {
      await offlineQueue.enqueue("SYNC_JOURNAL_ENTRY", entry.id, entry);
      logger.log("[Sync] Journal entry queued after network error:", entry.id);
    } else {
      // Keep failed journal writes visible to queue handlers; IndexedDB still has the data.
      logger.warn("[Sync] Journal entry sync failed (non-network):", error);
      throw error;
    }
  }
};

export const deleteJournalEntryFromCloud = async (entryId: string): Promise<void> => {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return;

  if (!navigator.onLine) {
    await offlineQueue.enqueue("DELETE_JOURNAL_ENTRY", entryId, {
      id: entryId,
    });
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
    await writeEventAndBroadcast("journal", entryId, "delete", null, deviceId);
  } catch (error) {
    if (isAbortError(error)) {
      logger.warn("[Sync] Journal entry delete aborted:", entryId);
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
export const syncJournalPhoto = async (photo: JournalPhoto): Promise<void> => {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return;

  try {
    const { error } = await supabase.from("journal_photos").upsert(
      {
        id: photo.id,
        user_id: userId,
        entry_id: photo.entryId,
        width: photo.width,
        height: photo.height,
        storage_path: photo.storagePath || null,
        storage_url: photo.storageUrl || null,
        created_at: photo.createdAt,
      },
      { onConflict: "id" }
    );

    if (error) throw error;
    logger.log("[Sync] Journal photo metadata synced:", photo.id);
  } catch (error) {
    if (!isAbortError(error)) {
      logger.warn("[Sync] Journal photo sync failed:", error);
    }
  }
};

/**
 * Sync audio metadata to cloud.
 */
export const syncJournalAudio = async (audio: JournalAudio): Promise<void> => {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return;

  try {
    const { error } = await supabase.from("journal_audio").upsert(
      {
        id: audio.id,
        user_id: userId,
        entry_id: audio.entryId,
        duration: audio.duration,
        mime_type: audio.mimeType,
        storage_path: audio.storagePath || null,
        storage_url: audio.storageUrl || null,
        created_at: audio.createdAt,
      },
      { onConflict: "id" }
    );

    if (error) throw error;
    logger.log("[Sync] Journal audio metadata synced:", audio.id);
  } catch (error) {
    if (!isAbortError(error)) {
      logger.warn("[Sync] Journal audio sync failed:", error);
    }
  }
};

export const deleteJournalPhotoFromCloud = async (photoId: string): Promise<void> => {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return;

  try {
    await supabase.from("journal_photos").delete().eq("id", photoId).eq("user_id", userId);
  } catch (error) {
    if (!isAbortError(error)) {
      logger.warn("[Sync] Journal photo delete from cloud failed:", error);
    }
  }
};

export const deleteJournalAudioFromCloud = async (audioId: string): Promise<void> => {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return;

  try {
    await supabase.from("journal_audio").delete().eq("id", audioId).eq("user_id", userId);
  } catch (error) {
    if (!isAbortError(error)) {
      logger.warn("[Sync] Journal audio delete from cloud failed:", error);
    }
  }
};
