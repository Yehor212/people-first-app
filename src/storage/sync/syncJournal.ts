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
import {
  REQUIRED_REMOTE_COMMIT_RESULT,
  RequiredRemoteCommitError,
  type RequiredRemoteCommitOptions,
  type RequiredRemoteCommitResult,
} from "./remoteCommit";
import {
  parseJournalMediaVaultRevision,
  requireJournalVaultEpochForCloudWrite,
} from "@/features/journal/journalVaultEpoch";
import { isEncryptedJournalContent } from "@/features/journal/journalCrypto";

type JournalPhotoSyncPayload = Pick<
  JournalPhoto,
  "id" | "entryId" | "width" | "height" | "createdAt" | "storagePath" | "vaultRevision"
>;

type JournalAudioSyncPayload = Pick<
  JournalAudio,
  "id" | "entryId" | "duration" | "mimeType" | "createdAt" | "storagePath" | "vaultRevision"
>;

async function validateJournalSyncOwner(
  expectedOwnerUserId: string,
): Promise<string | null> {
  return validateSyncOwner(expectedOwnerUserId, "Journal sync");
}

function throwIfJournalSyncAborted(
  signal?: AbortSignal,
  requireRemoteCommit = false,
): void {
  if (!signal?.aborted) return;
  if (requireRemoteCommit) throw new RequiredRemoteCommitError("aborted");
  if (signal.reason instanceof Error) throw signal.reason;
  throw new DOMException("Journal sync was aborted", "AbortError");
}

interface ResolvedJournalSyncOptions {
  expectedOwnerUserId: string;
  requireRemoteCommit: boolean;
  signal?: AbortSignal;
}

function resolveJournalSyncOptions(
  ownerOrOptions: string | RequiredRemoteCommitOptions,
  legacySignal?: AbortSignal,
): ResolvedJournalSyncOptions {
  return typeof ownerOrOptions === "string"
    ? {
        expectedOwnerUserId: ownerOrOptions,
        requireRemoteCommit: false,
        signal: legacySignal,
      }
    : ownerOrOptions;
}

function rejectRequiredRemoteCommit(
  required: boolean,
  outcome: "queued" | "stale" | "no-op",
): undefined {
  if (required) throw new RequiredRemoteCommitError(outcome);
  return undefined;
}

function requiredRemoteCommitResult(
  required: boolean,
): RequiredRemoteCommitResult | undefined {
  return required ? REQUIRED_REMOTE_COMMIT_RESULT : undefined;
}

function toPhotoSyncPayload(photo: JournalPhotoSyncPayload): JournalPhotoSyncPayload {
  return {
    id: photo.id,
    entryId: photo.entryId,
    width: photo.width,
    height: photo.height,
    createdAt: photo.createdAt,
    storagePath: photo.storagePath,
    vaultRevision: photo.vaultRevision,
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
    vaultRevision: audio.vaultRevision,
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
  expectedOwnerUserId: string,
  storagePath?: string,
): Promise<void> {
  await offlineQueue.enqueue(
    "DELETE_JOURNAL_PHOTO_STORAGE",
    "journal-photo-delete:" + photoId,
    storagePath ? { id: photoId, storagePath } : { id: photoId },
    { expectedOwnerUserId, priority: "high" }
  );
}

async function queueJournalAudioDeleteRetry(
  audioId: string,
  expectedOwnerUserId: string,
  storagePath?: string,
): Promise<void> {
  await offlineQueue.enqueue(
    "DELETE_JOURNAL_AUDIO_STORAGE",
    "journal-audio-delete:" + audioId,
    storagePath ? { id: audioId, storagePath } : { id: audioId },
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
export function syncJournalEntry(
  entry: JournalEntry,
  options: RequiredRemoteCommitOptions,
): Promise<RequiredRemoteCommitResult>;
export function syncJournalEntry(
  entry: JournalEntry,
  expectedOwnerUserId: string,
  signal?: AbortSignal,
): Promise<void>;
export async function syncJournalEntry(
  entry: JournalEntry,
  ownerOrOptions: string | RequiredRemoteCommitOptions,
  legacySignal?: AbortSignal,
): Promise<void | RequiredRemoteCommitResult> {
  const { expectedOwnerUserId, requireRemoteCommit, signal } = resolveJournalSyncOptions(
    ownerOrOptions,
    legacySignal,
  );
  throwIfJournalSyncAborted(signal, requireRemoteCommit);
  if (!isCloudSyncEnabled()) return rejectRequiredRemoteCommit(requireRemoteCommit, "no-op");

  const userId = await validateJournalSyncOwner(expectedOwnerUserId);
  if (!supabase) return rejectRequiredRemoteCommit(requireRemoteCommit, "no-op");
  if (!userId) {
    logger.warn("[Sync] Cannot sync journal entry: User not authenticated");
    return rejectRequiredRemoteCommit(requireRemoteCommit, "no-op");
  }

  const vaultRevision = await requireJournalVaultEpochForCloudWrite({
    surface: "entry",
    protectedPayload: isEncryptedJournalContent(entry.content),
    vaultRevision: entry.vaultRevision,
  });

  const deletedEntryIds = await getDeletedJournalEntryIds();
  if (deletedEntryIds.has(entry.id)) {
    logger.warn("[Sync] Skipping tombstoned journal entry upsert");
    return rejectRequiredRemoteCommit(requireRemoteCommit, "stale");
  }

  if (!navigator.onLine) {
    if (requireRemoteCommit) throw new RequiredRemoteCommitError("queued");
    await offlineQueue.enqueue("SYNC_JOURNAL_ENTRY", entry.id, entry, {
      expectedOwnerUserId: userId,
    });
    logger.log("[Sync] Journal entry queued for offline sync");
    return;
  }

  if (await isEntityTombstonedOnServer("journal", entry.id, userId)) {
    await trackDeletedJournalEntryId(entry.id);
    logger.warn("[Sync] Skipping server-tombstoned journal entry upsert");
    return rejectRequiredRemoteCommit(requireRemoteCommit, "stale");
  }
  throwIfJournalSyncAborted(signal, requireRemoteCommit);

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
      vault_revision: vaultRevision,
    };
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
      throwIfJournalSyncAborted(signal, requireRemoteCommit);
      const { data: exactReplay, error: replayError } = await replayRequest;
      throwIfJournalSyncAborted(signal, requireRemoteCommit);
      if (replayError) throw replayError;
      accepted = exactReplay === true;
    }
    if (!accepted) {
      logger.warn("[Sync] Stale journal entry rejected");
      return rejectRequiredRemoteCommit(requireRemoteCommit, "stale");
    }
    throwIfJournalSyncAborted(signal, requireRemoteCommit);
    logger.log("[Sync] Journal entry synced");
    const deviceId = await getPersistentDeviceId();
    await writeEventAndBroadcast(
      "journal",
      entry.id,
      "upsert",
      entry as unknown as Record<string, unknown>,
      deviceId,
      { expectedOwnerUserId: userId }
    );
    throwIfJournalSyncAborted(signal, requireRemoteCommit);
    return requiredRemoteCommitResult(requireRemoteCommit);
  } catch (error) {
    if (isAbortError(error)) {
      logger.warn("[Sync] Journal entry sync aborted");
      if (requireRemoteCommit) throw new RequiredRemoteCommitError("aborted");
      throw error;
    }
    const isNetworkError = detectNetworkError(error);
    if (isNetworkError) {
      if (requireRemoteCommit) throw new RequiredRemoteCommitError("queued");
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
}

export type JournalEntryCloudDeletionResult =
  | { status: "committed" }
  | {
      status: "deferred";
      reason: "password-removal-paused" | "connectivity";
    };

function isJournalRemovalPausedError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return (
    candidate.code === "55000"
    && candidate.message === "Journal deletion is paused for removal"
  );
}

export const deleteJournalEntryFromCloud = async (
  entryId: string,
  expectedOwnerUserId: string,
  signal?: AbortSignal,
): Promise<JournalEntryCloudDeletionResult> => {
  throwIfJournalSyncAborted(signal);
  if (!isCloudSyncEnabled()) return { status: "committed" };

  await trackDeletedJournalEntryId(entryId);

  const userId = await validateJournalSyncOwner(expectedOwnerUserId);
  if (!supabase || !userId) return { status: "committed" };

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
    logger.log("[Sync] Journal entry delete queued for offline");
    return { status: "deferred", reason: "connectivity" };
  }

  try {
    // The entry fence is the admission check for this deletion. Run it before
    // associated metadata deletes so a password-removal pause cannot partially
    // remove photos, audio, or embeddings.
    const entryRequest = supabase
      .from("journal_entries")
      .delete()
      .eq("id", entryId)
      .eq("user_id", userId);
    const entryResult = signal
      ? await entryRequest.abortSignal(signal)
      : await entryRequest;
    if (entryResult.error) throw entryResult.error;

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
    const [photosResult, audioResult, embeddingsResult] = await Promise.all([
      signal ? photosRequest.abortSignal(signal) : photosRequest,
      signal ? audioRequest.abortSignal(signal) : audioRequest,
      signal ? embeddingsRequest.abortSignal(signal) : embeddingsRequest,
    ]);
    if (photosResult.error) throw photosResult.error;
    if (audioResult.error) throw audioResult.error;
    if (embeddingsResult.error) throw embeddingsResult.error;

    throwIfJournalSyncAborted(signal);
    if ((await validateJournalSyncOwner(userId)) !== userId) {
      throw new Error("Journal entry deletion owner changed before acknowledgement");
    }
    logger.log("[Sync] Journal entry deleted from cloud");
    const deviceId = await getPersistentDeviceId();
    await writeEventAndBroadcast("journal", entryId, "delete", null, deviceId, {
      expectedOwnerUserId: userId,
    });
    throwIfJournalSyncAborted(signal);
    return { status: "committed" };
  } catch (error) {
    if (isAbortError(error)) {
      logger.warn("[Sync] Journal entry delete aborted");
      throw error;
    }
    if (isJournalRemovalPausedError(error)) {
      logger.log("[Sync] Journal entry delete deferred by password removal");
      return { status: "deferred", reason: "password-removal-paused" };
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
      logger.log("[Sync] Journal entry delete queued after network error");
      return { status: "deferred", reason: "connectivity" };
    }
    logger.warn("[Sync] Failed to delete journal entry from cloud");
    throw error;
  }
};

/**
 * Sync photo metadata to cloud (NOT the binary — that's in Storage bucket).
 * Fire-and-forget: called after photo is saved to IndexedDB.
 */
export function syncJournalPhoto(
  photo: JournalPhotoSyncPayload,
  options: RequiredRemoteCommitOptions,
): Promise<RequiredRemoteCommitResult>;
export function syncJournalPhoto(
  photo: JournalPhotoSyncPayload,
  expectedOwnerUserId: string,
): Promise<void>;
export async function syncJournalPhoto(
  photo: JournalPhotoSyncPayload,
  ownerOrOptions: string | RequiredRemoteCommitOptions,
): Promise<void | RequiredRemoteCommitResult> {
  const { expectedOwnerUserId, requireRemoteCommit, signal } = resolveJournalSyncOptions(
    ownerOrOptions,
  );
  throwIfJournalSyncAborted(signal, requireRemoteCommit);
  if (!isCloudSyncEnabled()) return rejectRequiredRemoteCommit(requireRemoteCommit, "no-op");

  const userId = await validateJournalSyncOwner(expectedOwnerUserId);
  if (!supabase || !userId) return rejectRequiredRemoteCommit(requireRemoteCommit, "no-op");
  const pathVaultRevision = parseJournalMediaVaultRevision(photo.storagePath);
  const vaultRevision = await requireJournalVaultEpochForCloudWrite({
    surface: "photo",
    protectedPayload: Boolean(photo.storagePath?.toLowerCase().endsWith(".bin")),
    vaultRevision: photo.vaultRevision,
  });
  if (vaultRevision !== pathVaultRevision) {
    throw new Error("Diary photo storage path does not match its vault epoch");
  }

  const deletedEntryIds = await getDeletedJournalEntryIds();
  if (deletedEntryIds.has(photo.entryId)) {
    logger.warn("[Sync] Skipping tombstoned journal photo upsert");
    return rejectRequiredRemoteCommit(requireRemoteCommit, "stale");
  }

  if (!navigator.onLine) {
    if (requireRemoteCommit) throw new RequiredRemoteCommitError("queued");
    await queueJournalPhotoUploadRetry(photo, userId);
    logger.log("[Sync] Journal photo queued for media upload/metadata retry");
    return;
  }

  if (await isEntityTombstonedOnServer("journal", photo.entryId, userId)) {
    logger.warn("[Sync] Skipping server-tombstoned journal photo upsert");
    return rejectRequiredRemoteCommit(requireRemoteCommit, "stale");
  }
  throwIfJournalSyncAborted(signal, requireRemoteCommit);

  try {
    const upsertRequest = supabase.from("journal_photos").upsert(
      {
        id: photo.id,
        user_id: userId,
        entry_id: photo.entryId,
        width: photo.width,
        height: photo.height,
        storage_path: photo.storagePath || null,
        storage_url: null,
        created_at: photo.createdAt,
        vault_revision: vaultRevision,
      },
      { onConflict: "id" }
    );
    if (requireRemoteCommit) {
      const selectedRequest = upsertRequest.select("id");
      const abortableRequest = signal ? selectedRequest.abortSignal(signal) : selectedRequest;
      const { data: acceptedRow, error } = await abortableRequest.maybeSingle();
      if (error) throw error;
      if (!acceptedRow) throw new RequiredRemoteCommitError("no-op");
    } else {
      const { error } = await upsertRequest;
      if (error) throw error;
    }

    throwIfJournalSyncAborted(signal, requireRemoteCommit);
    logger.log("[Sync] Journal photo metadata synced");
    return requiredRemoteCommitResult(requireRemoteCommit);
  } catch (error) {
    if (isAbortError(error)) {
      logger.warn("[Sync] Journal photo sync aborted");
      if (requireRemoteCommit) throw new RequiredRemoteCommitError("aborted");
      throw error;
    }
    if (detectNetworkError(error)) {
      if (requireRemoteCommit) throw new RequiredRemoteCommitError("queued");
      await queueJournalPhotoUploadRetry(photo, userId);
      logger.log("[Sync] Journal photo queued after network error");
      return;
    }
    logger.warn("[Sync] Journal photo sync failed");
    throw error;
  }
}

/**
 * Sync audio metadata to cloud.
 */
export function syncJournalAudio(
  audio: JournalAudioSyncPayload,
  options: RequiredRemoteCommitOptions,
): Promise<RequiredRemoteCommitResult>;
export function syncJournalAudio(
  audio: JournalAudioSyncPayload,
  expectedOwnerUserId: string,
): Promise<void>;
export async function syncJournalAudio(
  audio: JournalAudioSyncPayload,
  ownerOrOptions: string | RequiredRemoteCommitOptions,
): Promise<void | RequiredRemoteCommitResult> {
  const { expectedOwnerUserId, requireRemoteCommit, signal } = resolveJournalSyncOptions(
    ownerOrOptions,
  );
  throwIfJournalSyncAborted(signal, requireRemoteCommit);
  if (!isCloudSyncEnabled()) return rejectRequiredRemoteCommit(requireRemoteCommit, "no-op");

  const userId = await validateJournalSyncOwner(expectedOwnerUserId);
  if (!supabase || !userId) return rejectRequiredRemoteCommit(requireRemoteCommit, "no-op");
  const pathVaultRevision = parseJournalMediaVaultRevision(audio.storagePath);
  const vaultRevision = await requireJournalVaultEpochForCloudWrite({
    surface: "audio",
    protectedPayload: Boolean(audio.storagePath?.toLowerCase().endsWith(".bin")),
    vaultRevision: audio.vaultRevision,
  });
  if (vaultRevision !== pathVaultRevision) {
    throw new Error("Diary audio storage path does not match its vault epoch");
  }

  const deletedEntryIds = await getDeletedJournalEntryIds();
  if (deletedEntryIds.has(audio.entryId)) {
    logger.warn("[Sync] Skipping tombstoned journal audio upsert");
    return rejectRequiredRemoteCommit(requireRemoteCommit, "stale");
  }

  if (!navigator.onLine) {
    if (requireRemoteCommit) throw new RequiredRemoteCommitError("queued");
    await queueJournalAudioUploadRetry(audio, userId);
    logger.log("[Sync] Journal audio queued for media upload/metadata retry");
    return;
  }

  if (await isEntityTombstonedOnServer("journal", audio.entryId, userId)) {
    logger.warn("[Sync] Skipping server-tombstoned journal audio upsert");
    return rejectRequiredRemoteCommit(requireRemoteCommit, "stale");
  }
  throwIfJournalSyncAborted(signal, requireRemoteCommit);

  try {
    const upsertRequest = supabase.from("journal_audio").upsert(
      {
        id: audio.id,
        user_id: userId,
        entry_id: audio.entryId,
        duration: audio.duration,
        mime_type: audio.mimeType,
        storage_path: audio.storagePath || null,
        storage_url: null,
        created_at: audio.createdAt,
        vault_revision: vaultRevision,
      },
      { onConflict: "id" }
    );
    if (requireRemoteCommit) {
      const selectedRequest = upsertRequest.select("id");
      const abortableRequest = signal ? selectedRequest.abortSignal(signal) : selectedRequest;
      const { data: acceptedRow, error } = await abortableRequest.maybeSingle();
      if (error) throw error;
      if (!acceptedRow) throw new RequiredRemoteCommitError("no-op");
    } else {
      const { error } = await upsertRequest;
      if (error) throw error;
    }

    throwIfJournalSyncAborted(signal, requireRemoteCommit);
    logger.log("[Sync] Journal audio metadata synced");
    await publishJournalAudioParentRefresh(audio, userId);
    throwIfJournalSyncAborted(signal, requireRemoteCommit);
    return requiredRemoteCommitResult(requireRemoteCommit);
  } catch (error) {
    if (isAbortError(error)) {
      logger.warn("[Sync] Journal audio sync aborted");
      if (requireRemoteCommit) throw new RequiredRemoteCommitError("aborted");
      throw error;
    }
    if (detectNetworkError(error)) {
      if (requireRemoteCommit) throw new RequiredRemoteCommitError("queued");
      await queueJournalAudioUploadRetry(audio, userId);
      logger.log("[Sync] Journal audio queued after network error");
      return;
    }
    logger.warn("[Sync] Journal audio sync failed");
    throw error;
  }
}

export const deleteJournalPhotoFromCloud = async (
  photoId: string,
  expectedOwnerUserId: string,
  storagePath?: string,
): Promise<void> => {
  if (!isCloudSyncEnabled()) return;

  const userId = await validateJournalSyncOwner(expectedOwnerUserId);
  if (!supabase || !userId) return;

  if (!navigator.onLine) {
    await queueJournalPhotoDeleteRetry(photoId, userId, storagePath);
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
      await queueJournalPhotoDeleteRetry(photoId, userId, storagePath);
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
  storagePath?: string,
): Promise<void> => {
  if (!isCloudSyncEnabled()) return;

  const userId = await validateJournalSyncOwner(expectedOwnerUserId);
  if (!supabase || !userId) return;

  if (!navigator.onLine) {
    await queueJournalAudioDeleteRetry(audioId, userId, storagePath);
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
      await queueJournalAudioDeleteRetry(audioId, userId, storagePath);
      logger.log("[Sync] Journal audio delete queued after network error");
      return;
    }
    logger.warn("[Sync] Journal audio delete from cloud failed");
    throw error;
  }
};
