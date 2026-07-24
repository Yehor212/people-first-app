import { db } from "@/storage/db";
import { generateId } from "@/lib/utils";
import type { JournalEntry, JournalPhoto, JournalAudio } from "./types";
import {
  JOURNAL_DRAFT_ENTRY_ID,
  MAX_PHOTOS_PER_ENTRY,
  MAX_AUDIO_PER_ENTRY,
  getJournalDraftMediaOwnerId,
  isJournalDraftMediaOwnerId,
} from "./types";
import { assertValidJournalAudio } from "./journalAudioValidation";
import { getJournalContentVaultKey } from "./journalContentSession";
import {
  decryptJournalContentIfNeeded,
  encryptJournalContent,
  isEncryptedJournalContent,
} from "./journalCrypto";
import {
  decryptJournalMediaDataUrlIfNeeded,
  encryptedJournalMediaFromStorageDataUrl,
  encryptedJournalMediaToStorageBlob,
  encryptJournalMediaDataUrl,
  isEncryptedJournalMediaData,
} from "./journalMediaCrypto";
import {
  uploadPhoto,
  uploadEncryptedPhoto,
  uploadAudio as uploadAudioToStorage,
  uploadEncryptedAudio,
  deletePhotoFromStorage,
  deleteAudioFromStorage,
  deleteEntryMediaFromStorage,
  deleteJournalMediaStoragePath,
  downloadAsBase64,
  JOURNAL_PHOTO_UPLOAD_MAX_BYTES,
} from "@/storage/journalStorageService";
import {
  syncJournalEntry,
  syncJournalPhoto,
  syncJournalAudio,
  deleteJournalPhotoFromCloud,
  deleteJournalAudioFromCloud,
} from "@/storage/realtimeSync";
import { triggerSync } from "@/storage/cloudSync";
import {
  DELETION_TRACKER_KEYS,
  mergeDeletionTrackerIdsInCurrentTransaction,
} from "@/storage/deletionTracker";
import { logger } from "@/lib/logger";
import { requestPersistentStorageForCriticalData } from "@/storage/persistentStorage";
import {
  offlineQueue,
  persistCriticalOfflineActionInCurrentTransaction,
} from "@/lib/offlineQueue";
import { isCloudSyncEnabled } from "@/lib/cloudSyncSettings";
import { getCurrentSessionUserId } from "@/lib/supabaseClient";
import { SK } from "@/lib/storageKeys";
import { validateSyncOwner } from "@/storage/sync/syncOwner";
import { runWithJournalSecurityWriteLock } from "./journalSecurityWriteLock";
import { getJournalVaultKeyForWrite } from "./journalWriteSecurity";
import {
  assertOriginAccountBoundaryGeneration,
  captureOriginAccountBoundaryGeneration,
} from "@/storage/accountBoundaryRuntime";
import { encodeJournalPhotoWithinLimit } from "./journalPhotoEncoding";
import { JOURNAL_DELETE_UNDO_WINDOW_MS } from "./journalDeletePolicy";
import { JournalDraftInUseError } from "./journalDraftStorage";
import {
  getJournalAudioParentSyncDecision,
  getJournalPhotoParentSyncDecision,
} from "@/storage/sync/journalMediaParentGuard";

type JournalPhotoSyncMetadata = Pick<
  JournalPhoto,
  "id" | "entryId" | "width" | "height" | "createdAt" | "storagePath"
>;

type JournalAudioSyncMetadata = Pick<
  JournalAudio,
  "id" | "entryId" | "duration" | "mimeType" | "createdAt" | "storagePath"
>;

function captureJournalSyncOwner(): Promise<string | null> {
  return isCloudSyncEnabled() ? getCurrentSessionUserId() : Promise.resolve(null);
}

async function notifyJournalSyncAfterLocalCommit(label: string): Promise<void> {
  try {
    await offlineQueue.wakeFromDurableStorage();
  } catch (error) {
    logger.warn(
      "[JournalSync]",
      `${label} committed locally; durable queue wake was deferred:`,
      error,
    );
  }

  try {
    triggerSync();
  } catch (error) {
    logger.warn(
      "[JournalSync]",
      `${label} committed locally; sync trigger was deferred:`,
      error,
    );
  }
}

async function prunePendingJournalSecurityMigration(input: {
  entryIds?: string[];
  photoIds?: string[];
  audioIds?: string[];
}): Promise<void> {
  if (!db.settings?.get) return;
  const pending = await db.settings.get(SK.JOURNAL_SECURITY_MIGRATION);
  if (!pending?.value) return;
  const { removeDeletedJournalArtifactsFromSecurityMigration } =
    await import("./journalSecurityMigration");
  await removeDeletedJournalArtifactsFromSecurityMigration(input);
}

type JournalMediaQueueAction =
  | "UPLOAD_JOURNAL_PHOTO_STORAGE"
  | "UPLOAD_JOURNAL_AUDIO_STORAGE"
  | "DELETE_JOURNAL_PHOTO_STORAGE"
  | "DELETE_JOURNAL_AUDIO_STORAGE";

interface QueuedJournalPhotoUploadPayload {
  id: string;
  metadata?: JournalPhotoSyncMetadata;
}

interface QueuedJournalAudioUploadPayload {
  id: string;
  metadata?: JournalAudioSyncMetadata;
}

interface QueuedJournalMediaIdPayload {
  id: string;
}

function toPhotoSyncMetadata(photo: JournalPhoto): JournalPhotoSyncMetadata {
  return {
    id: photo.id,
    entryId: photo.entryId,
    width: photo.width,
    height: photo.height,
    createdAt: photo.createdAt,
    storagePath: photo.storagePath,
  };
}

function toAudioSyncMetadata(audio: JournalAudio): JournalAudioSyncMetadata {
  return {
    id: audio.id,
    entryId: audio.entryId,
    duration: audio.duration,
    mimeType: audio.mimeType,
    createdAt: audio.createdAt,
    storagePath: audio.storagePath,
  };
}

async function encryptEntryContentForStorage(entry: JournalEntry): Promise<JournalEntry> {
  if (!entry.content || isEncryptedJournalContent(entry.content)) return entry;

  const vaultKey = await getJournalVaultKeyForWrite();
  if (!vaultKey) return entry;

  return {
    ...entry,
    content: await encryptJournalContent(entry.content, vaultKey),
  };
}

async function encryptEntryChangesForStorage<T extends Partial<Pick<JournalEntry, "content">>>(
  changes: T
): Promise<T> {
  if (typeof changes.content !== "string" || changes.content.length === 0) return changes;
  if (isEncryptedJournalContent(changes.content)) return changes;

  const vaultKey = await getJournalVaultKeyForWrite();
  if (!vaultKey) return changes;

  return {
    ...changes,
    content: await encryptJournalContent(changes.content, vaultKey),
  };
}

async function decryptEntryContentForDisplay(entry: JournalEntry): Promise<JournalEntry> {
  if (!entry.content || !isEncryptedJournalContent(entry.content)) return entry;

  const vaultKey = getJournalContentVaultKey();
  if (!vaultKey) {
    return { ...entry, content: "" };
  }

  return {
    ...entry,
    content: await decryptJournalContentIfNeeded(entry.content, vaultKey),
  };
}

async function decryptEntriesForDisplay(entries: JournalEntry[]): Promise<JournalEntry[]> {
  return Promise.all(entries.map((entry) => decryptEntryContentForDisplay(entry)));
}

export interface JournalEntryPageCursor {
  createdAt: number;
  id: string;
}

export interface JournalEntryPageOptions {
  limit?: number;
  before?: JournalEntryPageCursor | null;
  beforeCreatedAt?: number | null;
}

export interface JournalEntryPageResult {
  entries: JournalEntry[];
  totalCount: number;
  hasMore: boolean;
  nextCursor: JournalEntryPageCursor | null;
}

function normalizeJournalPageLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) return 32;
  return Math.max(1, Math.min(100, Math.floor(limit)));
}

function compareJournalEntryIdsDescending(a: string, b: string): number {
  if (a === b) return 0;
  return a > b ? -1 : 1;
}

function compareJournalEntryPageOrder(a: JournalEntry, b: JournalEntry): number {
  if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
  return compareJournalEntryIdsDescending(a.id, b.id);
}

function journalEntryPageCursor(entry: JournalEntry): JournalEntryPageCursor {
  return { createdAt: entry.createdAt, id: entry.id };
}

function isEntryAfterCursorInPageOrder(
  entry: JournalEntry,
  cursor: JournalEntryPageCursor
): boolean {
  if (entry.createdAt < cursor.createdAt) return true;
  if (entry.createdAt > cursor.createdAt) return false;
  return compareJournalEntryIdsDescending(entry.id, cursor.id) > 0;
}

function dedupeJournalEntriesById(entries: JournalEntry[]): JournalEntry[] {
  return [...new Map(entries.map((entry) => [entry.id, entry])).values()];
}

async function getCreatedAtPageWithStableTies(
  limit: number,
  beforeCreatedAt?: number
): Promise<JournalEntry[]> {
  const collection =
    typeof beforeCreatedAt === "number"
      ? db.journalEntries.where("createdAt").below(beforeCreatedAt).reverse()
      : db.journalEntries.orderBy("createdAt").reverse();
  const candidates = await collection.limit(limit + 1).toArray();
  const boundaryCreatedAt = candidates[Math.min(limit, candidates.length) - 1]?.createdAt;
  if (typeof boundaryCreatedAt !== "number") return candidates;

  const boundaryTies = await db.journalEntries
    .where("createdAt")
    .equals(boundaryCreatedAt)
    .toArray();
  return dedupeJournalEntriesById([...candidates, ...boundaryTies])
    .sort(compareJournalEntryPageOrder)
    .slice(0, limit + 1);
}

async function encryptMediaDataWithVaultKey(value: string, vaultKey: string): Promise<string> {
  if (!value || isEncryptedJournalMediaData(value)) return value;
  return encryptJournalMediaDataUrl(value, vaultKey);
}

async function decryptMediaDataWithVaultKey(value: string, vaultKey: string): Promise<string> {
  if (!value) return value;
  return decryptJournalMediaDataUrlIfNeeded(value, vaultKey);
}

async function encryptMediaDataForStorage(value: string): Promise<string> {
  if (!value || isEncryptedJournalMediaData(value)) return value;
  const vaultKey = await getJournalVaultKeyForWrite();
  if (!vaultKey) return value;
  return encryptMediaDataWithVaultKey(value, vaultKey);
}

async function decryptMediaDataForDisplay(value: string): Promise<string> {
  if (!value) return value;
  const normalized = encryptedJournalMediaFromStorageDataUrl(value);
  if (!isEncryptedJournalMediaData(normalized)) return normalized;

  const vaultKey = getJournalContentVaultKey();
  if (!vaultKey) return "";

  return decryptMediaDataWithVaultKey(normalized, vaultKey);
}

async function encryptPhotoForStorage(photo: JournalPhoto): Promise<JournalPhoto> {
  return {
    ...photo,
    data: await encryptMediaDataForStorage(photo.data),
    thumbnail: await encryptMediaDataForStorage(photo.thumbnail),
  };
}

async function decryptPhotoForDisplay(photo: JournalPhoto): Promise<JournalPhoto> {
  return {
    ...photo,
    data: await decryptMediaDataForDisplay(photo.data),
    thumbnail: await decryptMediaDataForDisplay(photo.thumbnail),
  };
}

async function encryptAudioForStorage(audio: JournalAudio): Promise<JournalAudio> {
  return {
    ...audio,
    data: await encryptMediaDataForStorage(audio.data),
  };
}

async function decryptAudioForDisplay(audio: JournalAudio): Promise<JournalAudio> {
  return {
    ...audio,
    data: await decryptMediaDataForDisplay(audio.data),
  };
}

function getQueuedMediaId(payload: unknown): string | null {
  if (typeof payload === "string") return payload;
  if (!payload || typeof payload !== "object") return null;
  const id = (payload as { id?: unknown }).id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function getQueuedPhotoMetadata(payload: unknown): JournalPhotoSyncMetadata | undefined {
  const metadata = (payload as { metadata?: Partial<JournalPhotoSyncMetadata> } | null)?.metadata;
  if (!metadata || typeof metadata.id !== "string" || typeof metadata.entryId !== "string") {
    return undefined;
  }
  return metadata as JournalPhotoSyncMetadata;
}

function getQueuedAudioMetadata(payload: unknown): JournalAudioSyncMetadata | undefined {
  const metadata = (payload as { metadata?: Partial<JournalAudioSyncMetadata> } | null)?.metadata;
  if (!metadata || typeof metadata.id !== "string" || typeof metadata.entryId !== "string") {
    return undefined;
  }
  return metadata as JournalAudioSyncMetadata;
}

function queueJournalMediaAction(
  type: JournalMediaQueueAction,
  entityId: string,
  payload:
    | QueuedJournalPhotoUploadPayload
    | QueuedJournalAudioUploadPayload
    | QueuedJournalMediaIdPayload,
  label: string,
  expectedOwnerUserId: string
): void {
  if (!isCloudSyncEnabled()) return;
  void offlineQueue
    .enqueue(type, entityId, payload, {
      expectedOwnerUserId,
      priority: "critical",
    })
    .catch((err) => logger.warn("[JournalSync]", label + " queue failed:", err));
}

function queuePhotoUploadRetry(photoId: string, expectedOwnerUserId: string): void {
  queueJournalMediaAction(
    "UPLOAD_JOURNAL_PHOTO_STORAGE",
    "journal-photo-upload:" + photoId,
    { id: photoId },
    "Photo upload retry",
    expectedOwnerUserId
  );
}

function queueAudioUploadRetry(audioId: string, expectedOwnerUserId: string): void {
  queueJournalMediaAction(
    "UPLOAD_JOURNAL_AUDIO_STORAGE",
    "journal-audio-upload:" + audioId,
    { id: audioId },
    "Audio upload retry",
    expectedOwnerUserId
  );
}

async function retryJournalPhotoUploadUnlocked(
  payload: unknown,
  expectedOwnerUserId: string,
  signal?: AbortSignal,
): Promise<void> {
  throwIfJournalPhotoProcessingAborted(signal);
  if (!isCloudSyncEnabled()) return;

  const photoId = getQueuedMediaId(payload);
  if (!photoId) {
    logger.warn("[JournalSync]", "Queued photo upload missing id");
    return;
  }

  const fallbackMetadata = getQueuedPhotoMetadata(payload);
  const photo = await db.journalPhotos.get(photoId);
  throwIfJournalPhotoProcessingAborted(signal);

  if (!photo && !fallbackMetadata) {
    logger.warn("[JournalSync]", "Queued photo upload skipped; local row missing:", photoId);
    return;
  }

  const metadata = photo ? toPhotoSyncMetadata(photo) : fallbackMetadata;
  if (!metadata) return;
  const parentDecision = await getJournalPhotoParentSyncDecision(
    photoId,
    metadata.entryId,
    expectedOwnerUserId,
  );
  throwIfJournalPhotoProcessingAborted(signal);
  if (parentDecision === "wait") {
    throw new Error("Journal photo parent has not reached the server yet");
  }
  if (parentDecision === "purge") {
    await db.journalPhotos.delete(photoId);
    await deletePhotoFromStorage(photoId, expectedOwnerUserId);
    await deleteJournalPhotoFromCloud(photoId, expectedOwnerUserId);
    return;
  }

  if (photo?.data && !photo.storagePath) {
    throwIfJournalPhotoProcessingAborted(signal);
    const result = await uploadPhotoPayload(photo, photo.data, expectedOwnerUserId);
    throwIfJournalPhotoProcessingAborted(signal);
    if (!result)
      throw new Error("Journal photo upload retry returned no storage result: " + photo.id);

    await db.journalPhotos.update(photo.id, {
      storagePath: result.path,
    });
    const updated = await db.journalPhotos.get(photo.id);
    throwIfJournalPhotoProcessingAborted(signal);
    await syncJournalPhoto(
      updated
        ? toPhotoSyncMetadata(updated)
        : {
            ...toPhotoSyncMetadata(photo),
            storagePath: result.path,
          },
      expectedOwnerUserId
    );
    throwIfJournalPhotoProcessingAborted(signal);
    return;
  }

  throwIfJournalPhotoProcessingAborted(signal);
  await syncJournalPhoto(metadata, expectedOwnerUserId);
  throwIfJournalPhotoProcessingAborted(signal);
}

export function retryJournalPhotoUpload(
  payload: unknown,
  expectedOwnerUserId: string,
  signal?: AbortSignal,
): Promise<void> {
  return runWithJournalSecurityWriteLock(() =>
    retryJournalPhotoUploadUnlocked(payload, expectedOwnerUserId, signal)
  );
}

async function retryJournalAudioUploadUnlocked(
  payload: unknown,
  expectedOwnerUserId: string,
  signal?: AbortSignal,
): Promise<void> {
  throwIfJournalPhotoProcessingAborted(signal);
  if (!isCloudSyncEnabled()) return;

  const audioId = getQueuedMediaId(payload);
  if (!audioId) {
    logger.warn("[JournalSync]", "Queued audio upload missing id");
    return;
  }

  const fallbackMetadata = getQueuedAudioMetadata(payload);
  const audio = await db.journalAudio.get(audioId);
  throwIfJournalPhotoProcessingAborted(signal);

  if (!audio && !fallbackMetadata) {
    logger.warn("[JournalSync]", "Queued audio upload skipped; local row missing:", audioId);
    return;
  }

  const metadata = audio ? toAudioSyncMetadata(audio) : fallbackMetadata;
  if (!metadata) return;
  const parentDecision = await getJournalAudioParentSyncDecision(
    audioId,
    metadata.entryId,
    expectedOwnerUserId,
  );
  throwIfJournalPhotoProcessingAborted(signal);
  if (parentDecision === "wait") {
    throw new Error("Journal audio parent has not reached the server yet");
  }
  if (parentDecision === "purge") {
    await db.journalAudio.delete(audioId);
    await deleteAudioFromStorage(audioId, expectedOwnerUserId);
    await deleteJournalAudioFromCloud(audioId, expectedOwnerUserId);
    return;
  }

  if (audio?.data && !audio.storagePath) {
    throwIfJournalPhotoProcessingAborted(signal);
    const result = await uploadAudioPayload(audio, audio.data, audio.mimeType, expectedOwnerUserId);
    throwIfJournalPhotoProcessingAborted(signal);
    if (!result)
      throw new Error("Journal audio upload retry returned no storage result: " + audio.id);

    await db.journalAudio.update(audio.id, {
      storagePath: result.path,
    });
    const updated = await db.journalAudio.get(audio.id);
    throwIfJournalPhotoProcessingAborted(signal);
    await syncJournalAudio(
      updated
        ? toAudioSyncMetadata(updated)
        : {
            ...toAudioSyncMetadata(audio),
            storagePath: result.path,
          },
      expectedOwnerUserId
    );
    throwIfJournalPhotoProcessingAborted(signal);
    return;
  }

  throwIfJournalPhotoProcessingAborted(signal);
  await syncJournalAudio(metadata, expectedOwnerUserId);
  throwIfJournalPhotoProcessingAborted(signal);
}

export function retryJournalAudioUpload(
  payload: unknown,
  expectedOwnerUserId: string,
  signal?: AbortSignal,
): Promise<void> {
  return runWithJournalSecurityWriteLock(() =>
    retryJournalAudioUploadUnlocked(payload, expectedOwnerUserId, signal)
  );
}

export async function retryJournalPhotoDelete(
  payload: unknown,
  expectedOwnerUserId: string,
  signal?: AbortSignal,
): Promise<void> {
  throwIfJournalPhotoProcessingAborted(signal);
  if (!isCloudSyncEnabled()) return;

  const photoId = getQueuedMediaId(payload);
  if (!photoId) {
    logger.warn("[JournalSync]", "Queued photo delete missing id");
    return;
  }
  await deletePhotoFromStorage(photoId, expectedOwnerUserId);
  throwIfJournalPhotoProcessingAborted(signal);
  await deleteJournalPhotoFromCloud(photoId, expectedOwnerUserId);
  throwIfJournalPhotoProcessingAborted(signal);
}

export async function retryJournalAudioDelete(
  payload: unknown,
  expectedOwnerUserId: string,
  signal?: AbortSignal,
): Promise<void> {
  throwIfJournalPhotoProcessingAborted(signal);
  if (!isCloudSyncEnabled()) return;

  const audioId = getQueuedMediaId(payload);
  if (!audioId) {
    logger.warn("[JournalSync]", "Queued audio delete missing id");
    return;
  }
  await deleteAudioFromStorage(audioId, expectedOwnerUserId);
  throwIfJournalPhotoProcessingAborted(signal);
  await deleteJournalAudioFromCloud(audioId, expectedOwnerUserId);
  throwIfJournalPhotoProcessingAborted(signal);
}

async function relinkDraftMediaToEntry(
  entryId: string,
  draftMediaOwnerId: string,
  photoIds: string[],
  audioIds: string[] = []
): Promise<{ photos: JournalPhoto[]; audios: JournalAudio[] }> {
  const relinked = { photos: [] as JournalPhoto[], audios: [] as JournalAudio[] };

  for (const photoId of new Set(photoIds)) {
    const photo = await db.journalPhotos.get(photoId);
    if (!photo || photo.entryId !== draftMediaOwnerId) continue;
    const updatedPhoto = { ...photo, entryId };
    await db.journalPhotos.update(photoId, { entryId });
    relinked.photos.push(updatedPhoto);
  }

  for (const audioId of new Set(audioIds)) {
    const audio = await db.journalAudio.get(audioId);
    if (!audio || audio.entryId !== draftMediaOwnerId) continue;
    const updatedAudio = { ...audio, entryId };
    await db.journalAudio.update(audioId, { entryId });
    relinked.audios.push(updatedAudio);
  }

  return relinked;
}

export async function commitDraftMediaToEntry(
  entryId: string,
  media: { photoIds?: string[]; audioIds?: string[] },
  draftMediaOwnerId = getJournalDraftMediaOwnerId(entryId),
): Promise<void> {
  if (!entryId || isJournalDraftMediaOwnerId(entryId)) return;
  if (!isJournalDraftMediaOwnerId(draftMediaOwnerId)) {
    throw new Error("Diary media commit requires an exact draft owner id");
  }
  const syncOwnerPromise = captureJournalSyncOwner();
  const expectedOwnerUserId = await syncOwnerPromise;

  const relinkedMedia = await runWithJournalSecurityWriteLock(async () => {
    if (expectedOwnerUserId) {
      await validateSyncOwner(expectedOwnerUserId, "Diary draft media relink commit");
    }
    let relinked: { photos: JournalPhoto[]; audios: JournalAudio[] } = {
      photos: [],
      audios: [],
    };
    await db.transaction("rw", [db.journalPhotos, db.journalAudio], async () => {
      relinked = await relinkDraftMediaToEntry(
        entryId,
        draftMediaOwnerId,
        media.photoIds || [],
        media.audioIds || [],
      );
    });
    return relinked;
  });

  if (!isCloudSyncEnabled()) return;
  if (!expectedOwnerUserId) return;

  for (const photo of relinkedMedia.photos) {
    if (photo.data && !photo.storagePath) {
      uploadPhotoAndSync(photo, photo.data, expectedOwnerUserId);
    } else {
      syncPhotoMetadata(photo, "Photo relink sync", expectedOwnerUserId);
    }
  }
  for (const audio of relinkedMedia.audios) {
    if (audio.data && !audio.storagePath) {
      uploadAudioAndSync(audio, audio.data, audio.mimeType, expectedOwnerUserId);
    } else {
      syncAudioMetadata(audio, "Audio relink sync", expectedOwnerUserId);
    }
  }
  if (relinkedMedia.photos.length || relinkedMedia.audios.length) triggerSync();
}

function syncPhotoMetadata(photo: JournalPhoto, label: string, expectedOwnerUserId: string): void {
  if (!isCloudSyncEnabled()) return;
  syncJournalPhoto(photo, expectedOwnerUserId).catch((err) =>
    logger.warn("[JournalSync]", `${label} failed:`, err)
  );
}

function syncAudioMetadata(audio: JournalAudio, label: string, expectedOwnerUserId: string): void {
  if (!isCloudSyncEnabled()) return;
  syncJournalAudio(audio, expectedOwnerUserId).catch((err) =>
    logger.warn("[JournalSync]", `${label} failed:`, err)
  );
}

async function uploadPhotoPayload(
  photo: JournalPhoto,
  dataUrl: string,
  expectedOwnerUserId: string
) {
  const result = isEncryptedJournalMediaData(dataUrl)
    ? await uploadEncryptedPhoto(
        photo.id,
        encryptedJournalMediaToStorageBlob(dataUrl),
        expectedOwnerUserId
      )
    : await uploadPhoto(photo.id, dataUrl, expectedOwnerUserId);

  if (result && photo.storagePath && photo.storagePath !== result.path) {
    void deleteJournalMediaStoragePath(
      "journal-photos",
      photo.storagePath,
      expectedOwnerUserId
    ).catch((err) => logger.warn("[JournalSync]", "Old photo storage cleanup failed:", err));
  }

  return result;
}

async function uploadAudioPayload(
  audio: JournalAudio,
  dataUrl: string,
  mimeType: string,
  expectedOwnerUserId: string
) {
  const result = isEncryptedJournalMediaData(dataUrl)
    ? await uploadEncryptedAudio(
        audio.id,
        encryptedJournalMediaToStorageBlob(dataUrl),
        expectedOwnerUserId
      )
    : await uploadAudioToStorage(audio.id, dataUrl, mimeType, expectedOwnerUserId);

  if (result && audio.storagePath && audio.storagePath !== result.path) {
    void deleteJournalMediaStoragePath(
      "journal-audio",
      audio.storagePath,
      expectedOwnerUserId
    ).catch((err) => logger.warn("[JournalSync]", "Old audio storage cleanup failed:", err));
  }

  return result;
}

type JournalMediaUploadCommitStatus = "committed" | "stale" | "missing";

async function commitPhotoUploadResult(
  photoId: string,
  uploadedPath: string,
  uploadedEncryptedPayload: boolean,
  expectedOwnerUserId: string
): Promise<JournalMediaUploadCommitStatus> {
  return runWithJournalSecurityWriteLock(async () => {
    await validateSyncOwner(expectedOwnerUserId, "Diary photo upload commit");
    const current = await db.journalPhotos.get(photoId);
    if (!current) return "missing";

    const currentEncryptedPayload = Boolean(
      current.data && isEncryptedJournalMediaData(current.data)
    );
    if (currentEncryptedPayload !== uploadedEncryptedPayload) return "stale";

    await db.journalPhotos.update(photoId, { storagePath: uploadedPath });
    const updated = await db.journalPhotos.get(photoId);
    if (updated) {
      // This metadata write stays ordered before password activation. Releasing
      // the lock first would let an older plaintext path overwrite the .bin
      // path written by the migration.
      await syncJournalPhoto(toPhotoSyncMetadata(updated), expectedOwnerUserId);
    }
    return "committed";
  });
}

async function commitAudioUploadResult(
  audioId: string,
  uploadedPath: string,
  uploadedEncryptedPayload: boolean,
  expectedOwnerUserId: string
): Promise<JournalMediaUploadCommitStatus> {
  return runWithJournalSecurityWriteLock(async () => {
    await validateSyncOwner(expectedOwnerUserId, "Diary audio upload commit");
    const current = await db.journalAudio.get(audioId);
    if (!current) return "missing";

    const currentEncryptedPayload = Boolean(
      current.data && isEncryptedJournalMediaData(current.data)
    );
    if (currentEncryptedPayload !== uploadedEncryptedPayload) return "stale";

    await db.journalAudio.update(audioId, { storagePath: uploadedPath });
    const updated = await db.journalAudio.get(audioId);
    if (updated) {
      await syncJournalAudio(toAudioSyncMetadata(updated), expectedOwnerUserId);
    }
    return "committed";
  });
}

async function removeRejectedUploadPath(
  bucket: "journal-photos" | "journal-audio",
  path: string,
  expectedOwnerUserId: string
): Promise<void> {
  await deleteJournalMediaStoragePath(bucket, path, expectedOwnerUserId);
}

function syncPhotoMetadataForUploadEpoch(
  photo: JournalPhoto,
  uploadedEncryptedPayload: boolean,
  expectedOwnerUserId: string
): void {
  void runWithJournalSecurityWriteLock(async () => {
    await validateSyncOwner(expectedOwnerUserId, "Diary photo metadata sync");
    const current = await db.journalPhotos.get(photo.id);
    if (!current) return;
    const currentEncryptedPayload = Boolean(
      current.data && isEncryptedJournalMediaData(current.data)
    );
    if (currentEncryptedPayload !== uploadedEncryptedPayload) return;
    await syncJournalPhoto(toPhotoSyncMetadata(current), expectedOwnerUserId);
  }).catch((error) => logger.warn("[JournalSync]", "Photo metadata sync failed:", error));
}

function syncAudioMetadataForUploadEpoch(
  audio: JournalAudio,
  uploadedEncryptedPayload: boolean,
  expectedOwnerUserId: string
): void {
  void runWithJournalSecurityWriteLock(async () => {
    await validateSyncOwner(expectedOwnerUserId, "Diary audio metadata sync");
    const current = await db.journalAudio.get(audio.id);
    if (!current) return;
    const currentEncryptedPayload = Boolean(
      current.data && isEncryptedJournalMediaData(current.data)
    );
    if (currentEncryptedPayload !== uploadedEncryptedPayload) return;
    await syncJournalAudio(toAudioSyncMetadata(current), expectedOwnerUserId);
  }).catch((error) => logger.warn("[JournalSync]", "Audio metadata sync failed:", error));
}

function uploadPhotoAndSync(
  photo: JournalPhoto,
  dataUrl: string,
  expectedOwnerUserId: string
): void {
  if (!isCloudSyncEnabled()) return;
  const uploadedEncryptedPayload = isEncryptedJournalMediaData(dataUrl);
  queuePhotoUploadRetry(photo.id, expectedOwnerUserId);
  syncPhotoMetadataForUploadEpoch(photo, uploadedEncryptedPayload, expectedOwnerUserId);
  void uploadPhotoPayload(photo, dataUrl, expectedOwnerUserId)
    .then(async (result) => {
      if (result) {
        const status = await commitPhotoUploadResult(
          photo.id,
          result.path,
          uploadedEncryptedPayload,
          expectedOwnerUserId
        );
        if (status !== "committed") {
          await removeRejectedUploadPath("journal-photos", result.path, expectedOwnerUserId);
          if (status === "stale") queuePhotoUploadRetry(photo.id, expectedOwnerUserId);
        }
      } else {
        logger.warn(
          "[Journal]",
          "Photo upload returned no storage result; queued for retry:",
          photo.id
        );
      }
    })
    .catch((err) => {
      logger.error("[Journal]", "Photo upload failed:", err);
      queuePhotoUploadRetry(photo.id, expectedOwnerUserId);
    });
}

function uploadAudioAndSync(
  audio: JournalAudio,
  dataUrl: string,
  mimeType: string,
  expectedOwnerUserId: string
): void {
  if (!isCloudSyncEnabled()) return;
  const uploadedEncryptedPayload = isEncryptedJournalMediaData(dataUrl);
  queueAudioUploadRetry(audio.id, expectedOwnerUserId);
  syncAudioMetadataForUploadEpoch(audio, uploadedEncryptedPayload, expectedOwnerUserId);
  void uploadAudioPayload(audio, dataUrl, mimeType, expectedOwnerUserId)
    .then(async (result) => {
      if (result) {
        const status = await commitAudioUploadResult(
          audio.id,
          result.path,
          uploadedEncryptedPayload,
          expectedOwnerUserId
        );
        if (status !== "committed") {
          await removeRejectedUploadPath("journal-audio", result.path, expectedOwnerUserId);
          if (status === "stale") queueAudioUploadRetry(audio.id, expectedOwnerUserId);
        }
      } else {
        logger.warn(
          "[Journal]",
          "Audio upload returned no storage result; queued for retry:",
          audio.id
        );
      }
    })
    .catch((err) => {
      logger.error("[Journal]", "Audio upload failed:", err);
      queueAudioUploadRetry(audio.id, expectedOwnerUserId);
    });
}

class JournalPhotoHydrationError extends Error {
  readonly code = "JOURNAL_PHOTO_DOWNLOAD_UNAVAILABLE";

  constructor() {
    super("Diary photo bytes are temporarily unavailable");
    this.name = "JournalPhotoHydrationError";
  }
}

function isQuotaExceededError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ((error as { name?: unknown }).name === "QuotaExceededError") return true;
  return isQuotaExceededError((error as { inner?: unknown }).inner);
}

async function hydratePhotoFromStorage(
  photo: JournalPhoto,
  expectedOwnerUserId: string | null
): Promise<JournalPhoto> {
  const downloaded =
    !photo.data && photo.storagePath && expectedOwnerUserId
      ? await downloadAsBase64("journal-photos", photo.storagePath, expectedOwnerUserId)
      : null;
  const sourceData =
    photo.data || (downloaded ? encryptedJournalMediaFromStorageDataUrl(downloaded) : null);
  if (!sourceData) {
    if (photo.storagePath) throw new JournalPhotoHydrationError();
    return photo;
  }

  const { storedData, storedThumbnail } = await runWithJournalSecurityWriteLock(async () => {
    if (downloaded && expectedOwnerUserId) {
      await validateSyncOwner(expectedOwnerUserId, "Diary photo hydration commit");
    }
    const storedData = await encryptMediaDataForStorage(sourceData);
    const storedThumbnail = photo.thumbnail
      ? await encryptMediaDataForStorage(photo.thumbnail)
      : "";
    const changes: Partial<JournalPhoto> = {};
    if (photo.data !== storedData) changes.data = storedData;
    if (photo.thumbnail !== storedThumbnail) changes.thumbnail = storedThumbnail;
    if (Object.keys(changes).length > 0) {
      try {
        await db.journalPhotos.update(photo.id, changes);
      } catch (error) {
        if (!isQuotaExceededError(error)) throw error;
        // The downloaded encrypted/plain bytes can still be decrypted and shown
        // from memory. Keep the durable row unchanged and retry caching later.
        logger.warn("[Journal] Photo cache is full; displaying downloaded bytes without caching");
      }
    }
    return { storedData, storedThumbnail };
  });

  const displayPhoto = await decryptPhotoForDisplay({
    ...photo,
    data: storedData,
    thumbnail: storedThumbnail,
  });
  if (!displayPhoto.thumbnail && displayPhoto.data) {
    queuePhotoThumbnailRegeneration(photo.id, displayPhoto.data, expectedOwnerUserId);
    return { ...displayPhoto, thumbnail: displayPhoto.data };
  }
  return displayPhoto;
}

async function hydrateAudioFromStorage(
  audio: JournalAudio,
  expectedOwnerUserId: string | null
): Promise<JournalAudio> {
  const downloaded =
    !audio.data && audio.storagePath && expectedOwnerUserId
      ? await downloadAsBase64("journal-audio", audio.storagePath, expectedOwnerUserId)
      : null;
  const sourceData =
    audio.data || (downloaded ? encryptedJournalMediaFromStorageDataUrl(downloaded) : null);
  if (!sourceData) {
    if (!audio.data && audio.storagePath && expectedOwnerUserId) {
      throw new Error("Synced journal audio is unavailable");
    }
    return audio;
  }

  const storedData = await runWithJournalSecurityWriteLock(async () => {
    if (downloaded && expectedOwnerUserId) {
      await validateSyncOwner(expectedOwnerUserId, "Diary audio hydration commit");
    }
    const storedData = await encryptMediaDataForStorage(sourceData);
    if (audio.data !== storedData) await db.journalAudio.update(audio.id, { data: storedData });
    return storedData;
  });
  return decryptAudioForDisplay({ ...audio, data: storedData });
}

// ============================================
// JOURNAL ENTRIES CRUD
// ============================================

export async function getEntriesPage(
  options: JournalEntryPageOptions = {}
): Promise<JournalEntryPageResult> {
  const limit = normalizeJournalPageLimit(options.limit);
  const totalCountPromise = db.journalEntries.count();
  const cursor =
    options.before ??
    (typeof options.beforeCreatedAt === "number"
      ? { createdAt: options.beforeCreatedAt, id: "\uffff" }
      : null);

  let pageWithSentinel: JournalEntry[];
  if (cursor) {
    const sameTimestampEntries = await db.journalEntries
      .where("createdAt")
      .equals(cursor.createdAt)
      .toArray();
    const sameTimestampAfterCursor = sameTimestampEntries
      .filter((entry) => isEntryAfterCursorInPageOrder(entry, cursor))
      .sort(compareJournalEntryPageOrder);
    const remainingLimit = limit + 1 - sameTimestampAfterCursor.length;
    const olderEntries =
      remainingLimit > 0
        ? await getCreatedAtPageWithStableTies(remainingLimit - 1, cursor.createdAt)
        : [];
    pageWithSentinel = [...sameTimestampAfterCursor, ...olderEntries]
      .sort(compareJournalEntryPageOrder)
      .slice(0, limit + 1);
  } else {
    pageWithSentinel = await getCreatedAtPageWithStableTies(limit);
  }

  const pageEntries = pageWithSentinel.slice(0, limit);
  const hasMore = pageWithSentinel.length > limit;
  const entries = await decryptEntriesForDisplay(pageEntries);
  const totalCount = await totalCountPromise;

  return {
    entries,
    totalCount,
    hasMore,
    nextCursor:
      hasMore && pageEntries.length > 0
        ? journalEntryPageCursor(pageEntries[pageEntries.length - 1])
        : null,
  };
}

export async function getAllEntries(): Promise<JournalEntry[]> {
  const entries = await db.journalEntries.orderBy("createdAt").reverse().toArray();
  return decryptEntriesForDisplay(entries);
}

export interface JournalExportSnapshot {
  entries: JournalEntry[];
  photos: JournalPhoto[];
  audio: JournalAudio[];
  deletedEntryIds: string[];
}

export interface PendingJournalEntryDelete {
  id: string;
  expiresAt: number;
}

function normalizePendingJournalEntryDeletes(
  value: unknown,
  maxExpiresAt = Number.MAX_SAFE_INTEGER,
): PendingJournalEntryDelete[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, PendingJournalEntryDelete>();
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const candidate = item as Record<string, unknown>;
    if (
      typeof candidate.id !== "string" ||
      candidate.id.length === 0 ||
      candidate.id.length > 256 ||
      typeof candidate.expiresAt !== "number" ||
      !Number.isFinite(candidate.expiresAt) ||
      candidate.expiresAt <= 0
    ) {
      continue;
    }
    const boundedExpiresAt = Math.min(candidate.expiresAt, maxExpiresAt);
    const current = byId.get(candidate.id);
    if (!current || boundedExpiresAt > current.expiresAt) {
      byId.set(candidate.id, { id: candidate.id, expiresAt: boundedExpiresAt });
    }
  }
  return [...byId.values()].sort(
    (a, b) => a.expiresAt - b.expiresAt || a.id.localeCompare(b.id),
  );
}

export async function getPendingJournalEntryDeletes(): Promise<PendingJournalEntryDelete[]> {
  const record = await db.settings.get(SK.JOURNAL_PENDING_ENTRY_DELETES);
  const normalized = normalizePendingJournalEntryDeletes(
    record?.value,
    Date.now() + JOURNAL_DELETE_UNDO_WINDOW_MS,
  );
  if (record) {
    if (normalized.length > 0) {
      await db.settings.put({ key: SK.JOURNAL_PENDING_ENTRY_DELETES, value: normalized });
    } else {
      await db.settings.delete(SK.JOURNAL_PENDING_ENTRY_DELETES);
    }
  }
  return normalized;
}

export async function stagePendingJournalEntryDelete(
  id: string,
  expiresAt: number,
): Promise<PendingJournalEntryDelete[]> {
  const now = Date.now();
  if (!id || !Number.isFinite(expiresAt) || expiresAt <= now) {
    throw new Error("Invalid pending diary delete");
  }
  const boundedExpiresAt = Math.min(expiresAt, now + JOURNAL_DELETE_UNDO_WINDOW_MS);
  return db.transaction("rw", [db.settings, db.journalEntries], async () => {
    const entry = await db.journalEntries.get(id);
    if (!entry) throw new Error("Diary entry no longer exists");
    const record = await db.settings.get(SK.JOURNAL_PENDING_ENTRY_DELETES);
    const current = normalizePendingJournalEntryDeletes(
      record?.value,
      now + JOURNAL_DELETE_UNDO_WINDOW_MS,
    );
    const sharedExpiresAt = Math.max(
      boundedExpiresAt,
      ...current.map((item) => item.expiresAt),
    );
    const next = [
      ...current
        .filter((item) => item.id !== id)
        .map((item) => ({ ...item, expiresAt: sharedExpiresAt })),
      { id, expiresAt: sharedExpiresAt },
    ].sort((a, b) => a.id.localeCompare(b.id));
    await db.settings.put({ key: SK.JOURNAL_PENDING_ENTRY_DELETES, value: next });
    return next;
  });
}

async function removePendingJournalEntryDeletesInCurrentTransaction(
  ids: ReadonlySet<string>,
): Promise<void> {
  if (ids.size === 0) return;
  const record = await db.settings.get(SK.JOURNAL_PENDING_ENTRY_DELETES);
  const next = normalizePendingJournalEntryDeletes(record?.value).filter(
    (item) => !ids.has(item.id),
  );
  if (next.length > 0) {
    await db.settings.put({ key: SK.JOURNAL_PENDING_ENTRY_DELETES, value: next });
  } else {
    await db.settings.delete(SK.JOURNAL_PENDING_ENTRY_DELETES);
  }
}

export async function cancelPendingJournalEntryDeletes(ids: string[]): Promise<string[]> {
  const idsToCancel = new Set(ids.filter(Boolean));
  if (idsToCancel.size === 0) return [];
  return db.transaction("rw", db.settings, async () => {
    const record = await db.settings.get(SK.JOURNAL_PENDING_ENTRY_DELETES);
    const current = normalizePendingJournalEntryDeletes(record?.value);
    const cancelledIds = current
      .filter((item) => idsToCancel.has(item.id))
      .map((item) => item.id);
    await removePendingJournalEntryDeletesInCurrentTransaction(
      new Set(cancelledIds),
    );
    return cancelledIds;
  });
}

export async function getJournalExportSnapshot(): Promise<JournalExportSnapshot> {
  const expectedOwnerPromise = captureJournalSyncOwner();
  const raw = await db.transaction(
    "r",
    [db.settings, db.journalEntries, db.journalPhotos, db.journalAudio],
    async () => {
      const [entries, photos, audio, deletedEntryRecord] = await Promise.all([
        db.journalEntries.orderBy("createdAt").reverse().toArray(),
        db.journalPhotos.toArray(),
        db.journalAudio.toArray(),
        db.settings.get(DELETION_TRACKER_KEYS.journal),
      ]);
      const deletedEntryIds = [
        ...new Set(
          (Array.isArray(deletedEntryRecord?.value) ? deletedEntryRecord.value : []).filter(
            (id): id is string => typeof id === "string" && id.length > 0,
          ),
        ),
      ];
      return { entries, photos, audio, deletedEntryIds };
    },
  );
  const expectedOwnerUserId = await expectedOwnerPromise;
  const deletedEntryIdSet = new Set(raw.deletedEntryIds);
  const snapshotEntries = raw.entries.filter((entry) => !deletedEntryIdSet.has(entry.id));
  const photoOwners = new Map(
    snapshotEntries.flatMap((entry) =>
      entry.photoIds.map((photoId) => [photoId, entry.id] as const),
    ),
  );
  const audioOwners = new Map(
    snapshotEntries.flatMap((entry) =>
      (entry.audioIds || []).map((audioId) => [audioId, entry.id] as const),
    ),
  );
  const referencedPhotos = raw.photos.filter(
    (photo) => photoOwners.get(photo.id) === photo.entryId,
  );
  const referencedAudio = raw.audio.filter(
    (audio) => audioOwners.get(audio.id) === audio.entryId,
  );

  const entries = await decryptEntriesForDisplay(snapshotEntries);
  const photos: JournalPhoto[] = [];
  for (const photo of referencedPhotos) {
    photos.push(await hydratePhotoFromStorage(photo, expectedOwnerUserId));
  }
  const audio: JournalAudio[] = [];
  for (const item of referencedAudio) {
    audio.push(await hydrateAudioFromStorage(item, expectedOwnerUserId));
  }

  return { entries, photos, audio, deletedEntryIds: raw.deletedEntryIds };
}

export async function getEntriesByDate(date: string): Promise<JournalEntry[]> {
  const entries = await db.journalEntries.where("date").equals(date).reverse().sortBy("createdAt");
  return decryptEntriesForDisplay(entries);
}

export async function getEntryById(id: string): Promise<JournalEntry | undefined> {
  const entry = await db.journalEntries.get(id);
  return entry ? decryptEntryContentForDisplay(entry) : undefined;
}

export interface JournalDraftCommitContext {
  draftKey: string;
  mediaOwnerId: string;
  writerId: string;
}

function assertJournalDraftCommitContext(
  context: JournalDraftCommitContext,
): JournalDraftCommitContext {
  const draftKeyPrefix = SK.journalDraft("");
  if (!context.draftKey.startsWith(draftKeyPrefix)) {
    throw new Error("Diary draft commit requires a valid draft key");
  }
  if (!isJournalDraftMediaOwnerId(context.mediaOwnerId)) {
    throw new Error("Diary draft commit requires an exact media owner id");
  }
  if (!context.writerId) {
    throw new Error("Diary draft commit requires a writer id");
  }
  const draftSuffix = context.draftKey.slice(draftKeyPrefix.length);
  const mediaOwnerSuffix =
    context.mediaOwnerId === JOURNAL_DRAFT_ENTRY_ID
      ? ""
      : context.mediaOwnerId.slice(`${JOURNAL_DRAFT_ENTRY_ID}:`.length);
  if (mediaOwnerSuffix && mediaOwnerSuffix !== draftSuffix) {
    throw new Error("Diary draft key and media owner do not match");
  }
  return context;
}

async function assertJournalDraftWriterOwnedInCurrentTransaction(
  context: JournalDraftCommitContext,
): Promise<void> {
  const lease = await db.settings.get(SK.journalDraftLease(context.draftKey));
  const value = lease?.value as { writerId?: unknown } | undefined;
  if (value?.writerId !== context.writerId) {
    throw new JournalDraftInUseError(context.draftKey);
  }
}

export async function saveEntry(
  entry: Omit<JournalEntry, "id" | "createdAt" | "updatedAt">,
  draftContext?: JournalDraftCommitContext,
): Promise<JournalEntry> {
  const validatedDraftContext = draftContext
    ? assertJournalDraftCommitContext(draftContext)
    : null;
  const expectedOwnerUserId = await captureJournalSyncOwner();
  const localCommit = await runWithJournalSecurityWriteLock(async () => {
    if (expectedOwnerUserId) {
      await validateSyncOwner(expectedOwnerUserId, "Diary save outbox");
    }
    const now = Date.now();
    const full: JournalEntry = {
      ...entry,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    const storedFull = await encryptEntryContentForStorage(full);
    let relinkedMedia: { photos: JournalPhoto[]; audios: JournalAudio[] } = {
      photos: [],
      audios: [],
    };
    await db.transaction(
      "rw",
      [db.journalEntries, db.journalPhotos, db.journalAudio, db.offlineQueue, db.settings],
      async () => {
        if (validatedDraftContext) {
          await assertJournalDraftWriterOwnedInCurrentTransaction(validatedDraftContext);
        }
        await db.journalEntries.add(storedFull);
        relinkedMedia = await relinkDraftMediaToEntry(
          full.id,
          validatedDraftContext?.mediaOwnerId ?? JOURNAL_DRAFT_ENTRY_ID,
          full.photoIds,
          full.audioIds || [],
        );
        if (expectedOwnerUserId) {
          await persistCriticalOfflineActionInCurrentTransaction(
            "SYNC_JOURNAL_ENTRY",
            full.id,
            storedFull,
            expectedOwnerUserId
          );
          for (const photo of relinkedMedia.photos) {
            await persistCriticalOfflineActionInCurrentTransaction(
              "UPLOAD_JOURNAL_PHOTO_STORAGE",
              `journal-photo-upload:${photo.id}`,
              { id: photo.id, metadata: toPhotoSyncMetadata(photo) },
              expectedOwnerUserId
            );
          }
          for (const audio of relinkedMedia.audios) {
            await persistCriticalOfflineActionInCurrentTransaction(
              "UPLOAD_JOURNAL_AUDIO_STORAGE",
              `journal-audio-upload:${audio.id}`,
              { id: audio.id, metadata: toAudioSyncMetadata(audio) },
              expectedOwnerUserId
            );
          }
        }
        if (validatedDraftContext) {
          await db.settings.delete(validatedDraftContext.draftKey);
          await db.settings.delete(SK.journalDraftLease(validatedDraftContext.draftKey));
        }
      }
    );
    return { full, storedFull, relinkedMedia };
  });
  const { full } = localCommit;
  void requestPersistentStorageForCriticalData();

  if (!expectedOwnerUserId) return full;
  await notifyJournalSyncAfterLocalCommit("Diary entry save");

  return full;
}

export class JournalEntryConflictError extends Error {
  readonly code = "JOURNAL_ENTRY_CONFLICT";

  constructor(readonly entryId: string) {
    super("This diary entry changed after the editor opened it");
    this.name = "JournalEntryConflictError";
  }
}

export function isJournalEntryConflictError(error: unknown): error is JournalEntryConflictError {
  return (
    error instanceof JournalEntryConflictError ||
    (error instanceof Error &&
      (error.name === "JournalEntryConflictError" ||
        (error as Error & { code?: unknown }).code === "JOURNAL_ENTRY_CONFLICT"))
  );
}

export async function updateEntry(
  id: string,
  changes: Partial<Omit<JournalEntry, "id" | "createdAt">>,
  expectedUpdatedAt?: number,
  draftContext?: JournalDraftCommitContext,
): Promise<number> {
  const validatedDraftContext = draftContext
    ? assertJournalDraftCommitContext(draftContext)
    : null;
  const expectedOwnerUserId = await captureJournalSyncOwner();
  const updatedAt = await runWithJournalSecurityWriteLock(async () => {
    if (expectedOwnerUserId) {
      await validateSyncOwner(expectedOwnerUserId, "Diary update outbox");
    }
    const current = await db.journalEntries.get(id);
    if (!current) {
      throw new JournalEntryConflictError(id);
    }
    if (
      expectedUpdatedAt !== undefined &&
      current.updatedAt !== expectedUpdatedAt
    ) {
      throw new JournalEntryConflictError(id);
    }
    const nextUpdatedAt = Math.max(Date.now(), current.updatedAt + 1);
    const storageChanges = await encryptEntryChangesForStorage({
      ...changes,
      updatedAt: nextUpdatedAt,
    });
    const removedPhotoIds: string[] = [];
    const removedAudioIds: string[] = [];
    await db.transaction(
      "rw",
      [db.journalEntries, db.journalPhotos, db.journalAudio, db.offlineQueue, db.settings],
      async () => {
        if (validatedDraftContext) {
          await assertJournalDraftWriterOwnedInCurrentTransaction(validatedDraftContext);
        }
        const transactionCurrent = await db.journalEntries.get(id);
        if (!transactionCurrent) {
          throw new JournalEntryConflictError(id);
        }
        if (
          expectedUpdatedAt !== undefined &&
          transactionCurrent.updatedAt !== expectedUpdatedAt
        ) {
          throw new JournalEntryConflictError(id);
        }

        if (changes.photoIds !== undefined) {
          const retainedPhotoIds = new Set(changes.photoIds);
          removedPhotoIds.push(
            ...transactionCurrent.photoIds.filter((photoId) => !retainedPhotoIds.has(photoId)),
          );
        }
        if (changes.audioIds !== undefined) {
          const retainedAudioIds = new Set(changes.audioIds);
          removedAudioIds.push(
            ...(transactionCurrent.audioIds || []).filter(
              (audioId) => !retainedAudioIds.has(audioId),
            ),
          );
        }

        const transactionStorageChanges = { ...storageChanges };
        if (
          removedPhotoIds.length > 0 &&
          changes.photoLayout === undefined &&
          transactionCurrent.photoLayout
        ) {
          const nextPhotoLayout = { ...transactionCurrent.photoLayout };
          for (const photoId of removedPhotoIds) delete nextPhotoLayout[photoId];
          transactionStorageChanges.photoLayout =
            Object.keys(nextPhotoLayout).length > 0 ? nextPhotoLayout : undefined;
        }

        await db.journalEntries.update(id, transactionStorageChanges);
        const relinkedMedia = await relinkDraftMediaToEntry(
          id,
          validatedDraftContext?.mediaOwnerId ?? getJournalDraftMediaOwnerId(id),
          changes.photoIds || [],
          changes.audioIds || [],
        );

        for (const photoId of removedPhotoIds) {
          const photo = await db.journalPhotos.get(photoId);
          if (photo?.entryId !== id) continue;
          if (expectedOwnerUserId) {
            await persistCriticalOfflineActionInCurrentTransaction(
              "DELETE_JOURNAL_PHOTO_STORAGE",
              `journal-photo-delete:${photoId}`,
              { id: photoId },
              expectedOwnerUserId,
            );
          }
          await db.journalPhotos.delete(photoId);
        }
        for (const audioId of removedAudioIds) {
          const audio = await db.journalAudio.get(audioId);
          if (audio?.entryId !== id) continue;
          if (expectedOwnerUserId) {
            await persistCriticalOfflineActionInCurrentTransaction(
              "DELETE_JOURNAL_AUDIO_STORAGE",
              `journal-audio-delete:${audioId}`,
              { id: audioId },
              expectedOwnerUserId,
            );
          }
          await db.journalAudio.delete(audioId);
        }
        if (expectedOwnerUserId) {
          const updated = await db.journalEntries.get(id);
          if (updated) {
            await persistCriticalOfflineActionInCurrentTransaction(
              "SYNC_JOURNAL_ENTRY",
              id,
              updated,
              expectedOwnerUserId,
            );
          }
          for (const photo of relinkedMedia.photos) {
            await persistCriticalOfflineActionInCurrentTransaction(
              "UPLOAD_JOURNAL_PHOTO_STORAGE",
              `journal-photo-upload:${photo.id}`,
              { id: photo.id, metadata: toPhotoSyncMetadata(photo) },
              expectedOwnerUserId,
            );
          }
          for (const audio of relinkedMedia.audios) {
            await persistCriticalOfflineActionInCurrentTransaction(
              "UPLOAD_JOURNAL_AUDIO_STORAGE",
              `journal-audio-upload:${audio.id}`,
              { id: audio.id, metadata: toAudioSyncMetadata(audio) },
              expectedOwnerUserId,
            );
          }
        }
        if (validatedDraftContext) {
          await db.settings.delete(validatedDraftContext.draftKey);
          await db.settings.delete(SK.journalDraftLease(validatedDraftContext.draftKey));
        }
      },
    );
    if (removedPhotoIds.length > 0 || removedAudioIds.length > 0) {
      await prunePendingJournalSecurityMigration({
        photoIds: removedPhotoIds,
        audioIds: removedAudioIds,
      });
    }
    return nextUpdatedAt;
  });

  if (!expectedOwnerUserId) return updatedAt;
  await notifyJournalSyncAfterLocalCommit("Diary entry update");
  return updatedAt;
}

export type PendingJournalEntryDeleteCommitStatus = "committed" | "not-claimed";

async function deleteEntryWithClaim(
  id: string,
  claimAt: number | null,
): Promise<PendingJournalEntryDeleteCommitStatus> {
  const expectedOwnerUserId = await captureJournalSyncOwner();
  const status = await runWithJournalSecurityWriteLock(async () => {
    if (expectedOwnerUserId) {
      await validateSyncOwner(expectedOwnerUserId, "Diary delete outbox");
    }
    const draftKey = SK.journalDraft(id);
    const draftMediaOwnerId = getJournalDraftMediaOwnerId(id);
    const [entryPhotos, draftPhotos, entryAudios, draftAudios] = await Promise.all([
      db.journalPhotos.where("entryId").equals(id).toArray(),
      db.journalPhotos.where("entryId").equals(draftMediaOwnerId).toArray(),
      db.journalAudio.where("entryId").equals(id).toArray(),
      db.journalAudio.where("entryId").equals(draftMediaOwnerId).toArray(),
    ]);
    const photos = [
      ...new Map([...entryPhotos, ...draftPhotos].map((photo) => [photo.id, photo])).values(),
    ];
    const audios = [
      ...new Map([...entryAudios, ...draftAudios].map((audio) => [audio.id, audio])).values(),
    ];
    let committed = false;
    await db.transaction(
      "rw",
      [db.settings, db.journalEntries, db.journalPhotos, db.journalAudio, db.offlineQueue],
      async () => {
        if (claimAt !== null) {
          const pendingRecord = await db.settings.get(SK.JOURNAL_PENDING_ENTRY_DELETES);
          const marker = normalizePendingJournalEntryDeletes(pendingRecord?.value).find(
            (item) => item.id === id,
          );
          if (!marker || marker.expiresAt > claimAt) return;
        }
        await mergeDeletionTrackerIdsInCurrentTransaction(DELETION_TRACKER_KEYS.journal, [id]);
        if (expectedOwnerUserId) {
          await persistCriticalOfflineActionInCurrentTransaction(
            "DELETE_JOURNAL_ENTRY",
            id,
            { id },
            expectedOwnerUserId
          );
          for (const photo of photos) {
            await persistCriticalOfflineActionInCurrentTransaction(
              "DELETE_JOURNAL_PHOTO_STORAGE",
              `journal-photo-delete:${photo.id}`,
              { id: photo.id },
              expectedOwnerUserId
            );
          }
          for (const audio of audios) {
            await persistCriticalOfflineActionInCurrentTransaction(
              "DELETE_JOURNAL_AUDIO_STORAGE",
              `journal-audio-delete:${audio.id}`,
              { id: audio.id },
              expectedOwnerUserId
            );
          }
        }
        if (photos.length) await db.journalPhotos.bulkDelete(photos.map((photo) => photo.id));
        if (audios.length) await db.journalAudio.bulkDelete(audios.map((audio) => audio.id));
        await db.journalEntries.delete(id);
        await db.settings.delete(draftKey);
        await db.settings.delete(SK.journalDraftLease(draftKey));
        await removePendingJournalEntryDeletesInCurrentTransaction(new Set([id]));
        committed = true;
      }
    );
    if (!committed) return "not-claimed" as const;
    const photoIds = photos.map((photo) => photo.id);
    const audioIds = audios.map((audio) => audio.id);
    await prunePendingJournalSecurityMigration({ entryIds: [id], photoIds, audioIds }).catch(
      (error) => logger.warn("[Journal]", "Deleted migration cleanup failed:", error)
    );
    return "committed" as const;
  });

  if (status === "committed" && expectedOwnerUserId) {
    await notifyJournalSyncAfterLocalCommit("Diary entry delete");
  }
  return status;
}

export async function commitPendingJournalEntryDelete(
  id: string,
  claimAt = Date.now(),
): Promise<PendingJournalEntryDeleteCommitStatus> {
  return deleteEntryWithClaim(id, claimAt);
}

export async function deleteEntry(id: string): Promise<void> {
  await deleteEntryWithClaim(id, null);
}

type CancelledDraftPhotoIndex = Record<string, string[]>;

function normalizeCancelledDraftPhotoIndex(value: unknown): CancelledDraftPhotoIndex {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const normalized: CancelledDraftPhotoIndex = {};
  for (const [draftMediaOwnerId, candidateIds] of Object.entries(value)) {
    if (!isJournalDraftMediaOwnerId(draftMediaOwnerId) || !Array.isArray(candidateIds)) continue;
    const photoIds = [
      ...new Set(candidateIds.filter((id): id is string => typeof id === "string" && id.length > 0)),
    ];
    if (photoIds.length > 0) normalized[draftMediaOwnerId] = photoIds;
  }
  return normalized;
}

async function readCancelledDraftPhotoIndex(): Promise<CancelledDraftPhotoIndex> {
  const record = await db.settings.get(SK.JOURNAL_CANCELLED_DRAFT_PHOTOS);
  return normalizeCancelledDraftPhotoIndex(record?.value);
}

export async function markDraftPhotoCancellation(
  photoId: string,
  draftMediaOwnerId: string,
): Promise<void> {
  if (!photoId || !isJournalDraftMediaOwnerId(draftMediaOwnerId)) {
    throw new Error("Draft photo cancellation requires a photo and draft owner id");
  }
  await db.transaction("rw", db.settings, async () => {
    const index = await readCancelledDraftPhotoIndex();
    const photoIds = new Set(index[draftMediaOwnerId] ?? []);
    photoIds.add(photoId);
    index[draftMediaOwnerId] = [...photoIds];
    await db.settings.put({ key: SK.JOURNAL_CANCELLED_DRAFT_PHOTOS, value: index });
  });
}

export async function clearDraftPhotoCancellation(
  photoId: string,
  draftMediaOwnerId: string,
): Promise<void> {
  if (!photoId || !isJournalDraftMediaOwnerId(draftMediaOwnerId)) return;
  await db.transaction("rw", db.settings, async () => {
    const index = await readCancelledDraftPhotoIndex();
    const remaining = (index[draftMediaOwnerId] ?? []).filter((id) => id !== photoId);
    if (remaining.length > 0) index[draftMediaOwnerId] = remaining;
    else delete index[draftMediaOwnerId];
    if (Object.keys(index).length > 0) {
      await db.settings.put({ key: SK.JOURNAL_CANCELLED_DRAFT_PHOTOS, value: index });
    } else {
      await db.settings.delete(SK.JOURNAL_CANCELLED_DRAFT_PHOTOS);
    }
  });
}

/**
 * Draft photos are stored in quarantine and become recoverable only after the
 * editor still owns its writer lease and durably admits the photo.
 */
export async function acceptDraftPhoto(
  photoId: string,
  draftMediaOwnerId: string,
): Promise<void> {
  await clearDraftPhotoCancellation(photoId, draftMediaOwnerId);
}

async function retryCancelledDraftPhotoCleanup(
  draftMediaOwnerId: string,
  cancelledPhotoIds: string[],
  ownedPhotoIds: ReadonlySet<string>,
): Promise<void> {
  if (cancelledPhotoIds.length === 0) return;
  await db.transaction("rw", [db.journalPhotos, db.settings], async () => {
    const index = await readCancelledDraftPhotoIndex();
    const currentlyCancelled = new Set(index[draftMediaOwnerId] ?? []);
    const processedIds = cancelledPhotoIds.filter((id) => currentlyCancelled.has(id));
    if (processedIds.length === 0) return;
    const idsToDelete = processedIds.filter((id) => ownedPhotoIds.has(id));

    if (idsToDelete.length > 0) await db.journalPhotos.bulkDelete(idsToDelete);
    const processedIdSet = new Set(processedIds);
    const remaining = [...currentlyCancelled].filter((id) => !processedIdSet.has(id));
    if (remaining.length > 0) index[draftMediaOwnerId] = remaining;
    else delete index[draftMediaOwnerId];
    if (Object.keys(index).length > 0) {
      await db.settings.put({ key: SK.JOURNAL_CANCELLED_DRAFT_PHOTOS, value: index });
    } else {
      await db.settings.delete(SK.JOURNAL_CANCELLED_DRAFT_PHOTOS);
    }
  });
}

export async function getDraftMediaIds(
  draftMediaOwnerId: string,
): Promise<{ photoIds: string[]; audioIds: string[] }> {
  if (!isJournalDraftMediaOwnerId(draftMediaOwnerId)) {
    throw new Error("Draft media recovery requires a draft owner id");
  }
  const [photos, audios, cancellationIndex] = await Promise.all([
    db.journalPhotos.where("entryId").equals(draftMediaOwnerId).toArray(),
    db.journalAudio.where("entryId").equals(draftMediaOwnerId).toArray(),
    readCancelledDraftPhotoIndex(),
  ]);
  const cancelledPhotoIds = cancellationIndex[draftMediaOwnerId] ?? [];
  const cancelledPhotoIdSet = new Set(cancelledPhotoIds);
  if (cancelledPhotoIds.length > 0) {
    try {
      await retryCancelledDraftPhotoCleanup(
        draftMediaOwnerId,
        cancelledPhotoIds,
        new Set(photos.map((photo) => photo.id)),
      );
    } catch (error) {
      logger.warn("[Journal] Cancelled draft photo cleanup will retry", {
        name: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }
  const byCreationOrder = <T extends { id: string; createdAt: number }>(left: T, right: T) =>
    left.createdAt - right.createdAt || left.id.localeCompare(right.id);
  return {
    photoIds: photos
      .filter((photo) => !cancelledPhotoIdSet.has(photo.id))
      .sort(byCreationOrder)
      .map((photo) => photo.id),
    audioIds: audios.sort(byCreationOrder).map((audio) => audio.id),
  };
}

async function deleteDraftMediaWithOptionalDraft(
  draftMediaOwnerId: string,
  draftContext: JournalDraftCommitContext | null,
): Promise<void> {
  if (!isJournalDraftMediaOwnerId(draftMediaOwnerId)) {
    throw new Error("Draft media cleanup requires a draft owner id");
  }
  const expectedOwnerUserId = await captureJournalSyncOwner();
  const { photoIds, audioIds } = await runWithJournalSecurityWriteLock(async () => {
    if (expectedOwnerUserId) {
      await validateSyncOwner(expectedOwnerUserId, "Diary draft media delete outbox");
    }
    const photos = await db.journalPhotos.where("entryId").equals(draftMediaOwnerId).toArray();
    const audios = await db.journalAudio.where("entryId").equals(draftMediaOwnerId).toArray();
    const photoIds = photos.map((photo) => photo.id);
    const audioIds = audios.map((audio) => audio.id);
    await db.transaction(
      "rw",
      [db.journalPhotos, db.journalAudio, db.offlineQueue, db.settings],
      async () => {
        if (draftContext) {
          await assertJournalDraftWriterOwnedInCurrentTransaction(draftContext);
        }
        if (expectedOwnerUserId) {
          for (const photoId of photoIds) {
            await persistCriticalOfflineActionInCurrentTransaction(
              "DELETE_JOURNAL_PHOTO_STORAGE",
              `journal-photo-delete:${photoId}`,
              { id: photoId },
              expectedOwnerUserId,
            );
          }
          for (const audioId of audioIds) {
            await persistCriticalOfflineActionInCurrentTransaction(
              "DELETE_JOURNAL_AUDIO_STORAGE",
              `journal-audio-delete:${audioId}`,
              { id: audioId },
              expectedOwnerUserId,
            );
          }
        }
        if (photoIds.length) await db.journalPhotos.bulkDelete(photoIds);
        if (audioIds.length) await db.journalAudio.bulkDelete(audioIds);
        if (draftContext) {
          await db.settings.delete(draftContext.draftKey);
          await db.settings.delete(SK.journalDraftLease(draftContext.draftKey));
        }
      },
    );
    await prunePendingJournalSecurityMigration({ photoIds, audioIds });
    return { photoIds, audioIds };
  });

  if (expectedOwnerUserId && (photoIds.length || audioIds.length)) {
    await notifyJournalSyncAfterLocalCommit("Diary draft media delete");
    void deleteEntryMediaFromStorage(photoIds, audioIds, expectedOwnerUserId).catch((err) =>
      logger.warn("[JournalSync]", "Draft media storage delete failed:", err)
    );
    for (const photoId of photoIds) {
      deleteJournalPhotoFromCloud(photoId, expectedOwnerUserId).catch((err) =>
        logger.warn("[JournalSync]", "Draft photo delete sync failed:", err)
      );
    }
    for (const audioId of audioIds) {
      deleteJournalAudioFromCloud(audioId, expectedOwnerUserId).catch((err) =>
        logger.warn("[JournalSync]", "Draft audio delete sync failed:", err)
      );
    }
  }
}

export async function deleteDraftMedia(
  draftMediaOwnerId = JOURNAL_DRAFT_ENTRY_ID,
): Promise<void> {
  return deleteDraftMediaWithOptionalDraft(draftMediaOwnerId, null);
}

export async function discardJournalDraft(
  draftContext: JournalDraftCommitContext,
): Promise<void> {
  const validatedDraftContext = assertJournalDraftCommitContext(draftContext);
  return deleteDraftMediaWithOptionalDraft(
    validatedDraftContext.mediaOwnerId,
    validatedDraftContext,
  );
}

export async function getEntryCount(): Promise<number> {
  return db.journalEntries.count();
}

export async function encryptPlaintextJournalEntries(vaultKey: string): Promise<number> {
  const syncOwnerPromise = captureJournalSyncOwner();
  const entries = await db.journalEntries.toArray();
  const plaintextEntries = entries.filter(
    (entry) => entry.content && !isEncryptedJournalContent(entry.content)
  );
  if (plaintextEntries.length === 0) return 0;

  const encryptedEntries = await Promise.all(
    plaintextEntries.map(async (entry) => ({
      ...entry,
      content: await encryptJournalContent(entry.content, vaultKey),
      updatedAt: Date.now(),
    }))
  );

  await db.transaction("rw", [db.journalEntries], async () => {
    for (const entry of encryptedEntries) {
      await db.journalEntries.update(entry.id, {
        content: entry.content,
        updatedAt: entry.updatedAt,
      });
    }
  });

  if (!isCloudSyncEnabled()) return encryptedEntries.length;
  const expectedOwnerUserId = await syncOwnerPromise;
  if (!expectedOwnerUserId) return encryptedEntries.length;

  for (const entry of encryptedEntries) {
    syncJournalEntry(entry, expectedOwnerUserId).catch((err) =>
      logger.warn("[JournalSync]", "Entry encryption migration sync failed:", err)
    );
  }
  triggerSync();

  return encryptedEntries.length;
}

export async function hasEncryptedJournalContent(): Promise<boolean> {
  const encryptedEntry = await db.journalEntries
    .filter((entry) => Boolean(entry.content) && isEncryptedJournalContent(entry.content))
    .first();
  return Boolean(encryptedEntry);
}

export async function decryptEncryptedJournalEntries(vaultKey: string): Promise<number> {
  const syncOwnerPromise = captureJournalSyncOwner();
  const entries = await db.journalEntries.toArray();
  const encryptedEntries = entries.filter(
    (entry) => entry.content && isEncryptedJournalContent(entry.content)
  );
  if (encryptedEntries.length === 0) return 0;

  const decryptedEntries = await Promise.all(
    encryptedEntries.map(async (entry) => ({
      ...entry,
      content: await decryptJournalContentIfNeeded(entry.content, vaultKey),
      updatedAt: Date.now(),
    }))
  );

  await db.transaction("rw", [db.journalEntries], async () => {
    for (const entry of decryptedEntries) {
      await db.journalEntries.update(entry.id, {
        content: entry.content,
        updatedAt: entry.updatedAt,
      });
    }
  });

  if (!isCloudSyncEnabled()) return decryptedEntries.length;
  const expectedOwnerUserId = await syncOwnerPromise;
  if (!expectedOwnerUserId) return decryptedEntries.length;

  for (const entry of decryptedEntries) {
    syncJournalEntry(entry, expectedOwnerUserId).catch((err) =>
      logger.warn("[JournalSync]", "Entry password removal sync failed:", err)
    );
  }
  triggerSync();

  return decryptedEntries.length;
}

export async function encryptPlaintextJournalMedia(vaultKey: string): Promise<number> {
  const syncOwnerPromise = captureJournalSyncOwner();
  const [photos, audios] = await Promise.all([
    db.journalPhotos.toArray(),
    db.journalAudio.toArray(),
  ]);
  const photoUpdates = await Promise.all(
    photos
      .filter(
        (photo) =>
          Boolean(photo.data && !isEncryptedJournalMediaData(photo.data)) ||
          Boolean(photo.thumbnail && !isEncryptedJournalMediaData(photo.thumbnail))
      )
      .map(async (photo) => ({
        ...photo,
        data: await encryptMediaDataWithVaultKey(photo.data, vaultKey),
        thumbnail: await encryptMediaDataWithVaultKey(photo.thumbnail, vaultKey),
      }))
  );
  const audioUpdates = await Promise.all(
    audios
      .filter((audio) => Boolean(audio.data && !isEncryptedJournalMediaData(audio.data)))
      .map(async (audio) => ({
        ...audio,
        data: await encryptMediaDataWithVaultKey(audio.data, vaultKey),
      }))
  );

  if (photoUpdates.length === 0 && audioUpdates.length === 0) return 0;

  await db.transaction("rw", [db.journalPhotos, db.journalAudio], async () => {
    for (const photo of photoUpdates) {
      await db.journalPhotos.update(photo.id, {
        data: photo.data,
        thumbnail: photo.thumbnail,
        storagePath: undefined,
      });
    }
    for (const audio of audioUpdates) {
      await db.journalAudio.update(audio.id, {
        data: audio.data,
        storagePath: undefined,
      });
    }
  });

  if (isCloudSyncEnabled()) {
    const expectedOwnerUserId = await syncOwnerPromise;
    if (!expectedOwnerUserId) return photoUpdates.length + audioUpdates.length;
    for (const photo of photoUpdates) {
      uploadPhotoAndSync(photo, photo.data, expectedOwnerUserId);
    }
    for (const audio of audioUpdates) {
      uploadAudioAndSync(audio, audio.data, audio.mimeType, expectedOwnerUserId);
    }
    triggerSync();
  }

  return photoUpdates.length + audioUpdates.length;
}

export async function hasEncryptedJournalMedia(): Promise<boolean> {
  const [encryptedPhoto, encryptedAudio] = await Promise.all([
    db.journalPhotos
      .filter(
        (photo) =>
          Boolean(photo.data && isEncryptedJournalMediaData(photo.data)) ||
          Boolean(photo.thumbnail && isEncryptedJournalMediaData(photo.thumbnail))
      )
      .first(),
    db.journalAudio
      .filter((audio) => Boolean(audio.data && isEncryptedJournalMediaData(audio.data)))
      .first(),
  ]);
  return Boolean(encryptedPhoto || encryptedAudio);
}

export async function decryptEncryptedJournalMedia(vaultKey: string): Promise<number> {
  const syncOwnerPromise = captureJournalSyncOwner();
  const [photos, audios] = await Promise.all([
    db.journalPhotos.toArray(),
    db.journalAudio.toArray(),
  ]);
  const photoUpdates = await Promise.all(
    photos
      .filter(
        (photo) =>
          Boolean(photo.data && isEncryptedJournalMediaData(photo.data)) ||
          Boolean(photo.thumbnail && isEncryptedJournalMediaData(photo.thumbnail))
      )
      .map(async (photo) => ({
        ...photo,
        data: await decryptMediaDataWithVaultKey(photo.data, vaultKey),
        thumbnail: await decryptMediaDataWithVaultKey(photo.thumbnail, vaultKey),
      }))
  );
  const audioUpdates = await Promise.all(
    audios
      .filter((audio) => Boolean(audio.data && isEncryptedJournalMediaData(audio.data)))
      .map(async (audio) => ({
        ...audio,
        data: await decryptMediaDataWithVaultKey(audio.data, vaultKey),
      }))
  );

  if (photoUpdates.length === 0 && audioUpdates.length === 0) return 0;

  await db.transaction("rw", [db.journalPhotos, db.journalAudio], async () => {
    for (const photo of photoUpdates) {
      await db.journalPhotos.update(photo.id, {
        data: photo.data,
        thumbnail: photo.thumbnail,
        storagePath: undefined,
      });
    }
    for (const audio of audioUpdates) {
      await db.journalAudio.update(audio.id, {
        data: audio.data,
        storagePath: undefined,
      });
    }
  });

  if (isCloudSyncEnabled()) {
    const expectedOwnerUserId = await syncOwnerPromise;
    if (!expectedOwnerUserId) return photoUpdates.length + audioUpdates.length;
    for (const photo of photoUpdates) {
      uploadPhotoAndSync(photo, photo.data, expectedOwnerUserId);
    }
    for (const audio of audioUpdates) {
      uploadAudioAndSync(audio, audio.data, audio.mimeType, expectedOwnerUserId);
    }
    triggerSync();
  }

  return photoUpdates.length + audioUpdates.length;
}

// ============================================
// PHOTO COMPRESSION + STORAGE
// ============================================

const MAX_DIMENSION = 2560;
const THUMB_WIDTH = 480;
const THUMB_QUALITY = 0.72;
const IMAGE_HEADER_READ_LIMIT = 512 * 1024;
const MAX_FALLBACK_SOURCE_PIXELS = 32_000_000;

type DrawableImage = CanvasImageSource & { width: number; height: number };

export function readRasterDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }

  const isWebP =
    bytes.length >= 30 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP";
  if (isWebP) {
    const chunk = String.fromCharCode(...bytes.subarray(12, 16));
    if (chunk === "VP8X") {
      const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
      const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
      return { width, height };
    }
    if (chunk === "VP8L" && bytes[20] === 0x2f) {
      const width = 1 + bytes[21] + ((bytes[22] & 0x3f) << 8);
      const height = 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10);
      return { width, height };
    }
    if (
      chunk === "VP8 " &&
      bytes[23] === 0x9d &&
      bytes[24] === 0x01 &&
      bytes[25] === 0x2a
    ) {
      return {
        width: (bytes[26] | (bytes[27] << 8)) & 0x3fff,
        height: (bytes[28] | (bytes[29] << 8)) & 0x3fff,
      };
    }
    return null;
  }

  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (segmentLength < 2 || offset + 2 + segmentLength > bytes.length) return null;
    const isStartOfFrame =
      marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isStartOfFrame) {
      return {
        height: (bytes[offset + 5] << 8) | bytes[offset + 6],
        width: (bytes[offset + 7] << 8) | bytes[offset + 8],
      };
    }
    offset += 2 + segmentLength;
  }
  return null;
}

function createJournalPhotoAbortError(): Error {
  const error = new Error("Journal photo processing was cancelled");
  error.name = "AbortError";
  return error;
}

function throwIfJournalPhotoProcessingAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw createJournalPhotoAbortError();
}

async function readJournalPhotoDimensions(
  file: File,
  signal?: AbortSignal,
): Promise<{ width: number; height: number } | null> {
  throwIfJournalPhotoProcessingAborted(signal);
  try {
    const header = await file.slice(0, IMAGE_HEADER_READ_LIMIT).arrayBuffer();
    throwIfJournalPhotoProcessingAborted(signal);
    return readRasterDimensions(new Uint8Array(header));
  } catch {
    throwIfJournalPhotoProcessingAborted(signal);
    return null;
  }
}

function loadImage(src: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const cleanup = () => {
      signal?.removeEventListener("abort", handleAbort);
      img.onload = null;
      img.onerror = null;
    };
    const handleAbort = () => {
      cleanup();
      img.src = "";
      reject(createJournalPhotoAbortError());
    };
    img.onload = () => {
      cleanup();
      resolve(img);
    };
    img.onerror = (error) => {
      cleanup();
      reject(error instanceof Error ? error : new Error("Diary image could not be decoded"));
    };
    if (signal?.aborted) {
      handleAbort();
      return;
    }
    signal?.addEventListener("abort", handleAbort, { once: true });
    img.src = src;
  });
}

async function canvasToCompressedDataUrl(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<string> {
  if (typeof canvas.toBlob === "function") {
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Photo compression returned no image data"));
            return;
          }
          resolve(blob);
        }, "image/jpeg", quality);
      });
      return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(reader.error ?? new Error("Unable to read compressed photo"));
          reader.onload = () =>
            typeof reader.result === "string"
              ? resolve(reader.result)
              : reject(new Error("Unable to encode compressed photo"));
          reader.readAsDataURL(blob);
      });
    } catch {
      // Older embedded WebViews can expose toBlob but throw when it is invoked.
    }
  }
  return canvas.toDataURL("image/jpeg", quality);
}

async function resizeAndCompress(
  img: DrawableImage,
  maxDim: number,
  quality: number,
  signal?: AbortSignal,
): Promise<{ dataUrl: string; width: number; height: number }> {
  throwIfJournalPhotoProcessingAborted(signal);
  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");
  ctx.imageSmoothingEnabled = true;
  if ("imageSmoothingQuality" in ctx) {
    ctx.imageSmoothingQuality = "high";
  }
  ctx.drawImage(img, 0, 0, width, height);
  const dataUrl = await canvasToCompressedDataUrl(canvas, quality);
  throwIfJournalPhotoProcessingAborted(signal);
  return { dataUrl, width, height };
}

async function createPhotoThumbnail(dataUrl: string): Promise<string> {
  const image = await loadImage(dataUrl);
  return (await resizeAndCompress(image, THUMB_WIDTH, THUMB_QUALITY)).dataUrl;
}

async function decodeJournalPhoto(
  file: File,
  objectUrl: string,
  signal?: AbortSignal,
): Promise<{ image: DrawableImage; release: () => void }> {
  const dimensions = await readJournalPhotoDimensions(file, signal);
  throwIfJournalPhotoProcessingAborted(signal);
  if (
    !dimensions ||
    dimensions.width <= 0 ||
    dimensions.height <= 0 ||
    dimensions.width * dimensions.height > MAX_FALLBACK_SOURCE_PIXELS
  ) {
    throw new Error("Photo resolution could not be processed safely");
  }
  if (typeof createImageBitmap === "function") {
    try {
      const resizeOptions = dimensions
        ? dimensions.width >= dimensions.height
          ? { resizeWidth: Math.min(MAX_DIMENSION, dimensions.width) }
          : { resizeHeight: Math.min(MAX_DIMENSION, dimensions.height) }
        : {};
      const image = await createImageBitmap(file, {
        imageOrientation: "from-image",
        resizeQuality: "high",
        ...resizeOptions,
      });
      if (signal?.aborted) {
        image.close();
        throw createJournalPhotoAbortError();
      }
      return {
        image: image as DrawableImage,
        release: () => image.close(),
      };
    } catch (error) {
      throwIfJournalPhotoProcessingAborted(signal);
      logger.warn("[Journal] Bounded photo decode unavailable; using WebView fallback:", error);
    }
  }

  const image = await loadImage(objectUrl, signal);
  throwIfJournalPhotoProcessingAborted(signal);
  if (image.width * image.height > MAX_FALLBACK_SOURCE_PIXELS) {
    throw new Error("Photo resolution is too large for this device");
  }
  return { image: image as DrawableImage, release: () => undefined };
}

function queuePhotoThumbnailRegeneration(
  photoId: string,
  displayData: string,
  expectedOwnerUserId: string | null
): void {
  void createPhotoThumbnail(displayData)
    .then((thumbnail) =>
      runWithJournalSecurityWriteLock(async () => {
        if (expectedOwnerUserId) {
          await validateSyncOwner(expectedOwnerUserId, "Diary thumbnail regeneration commit");
        }
        const current = await db.journalPhotos.get(photoId);
        if (!current || current.thumbnail) return;
        const storedThumbnail = await encryptMediaDataForStorage(thumbnail);
        await db.journalPhotos.update(photoId, { thumbnail: storedThumbnail });
      })
    )
    .catch((error) => {
      logger.warn("[Journal]", "Photo thumbnail regeneration failed:", error);
    });
}

export async function compressAndStorePhoto(
  file: File,
  entryId: string,
  signal?: AbortSignal,
): Promise<JournalPhoto> {
  throwIfJournalPhotoProcessingAborted(signal);
  const expectedAccountGeneration = captureOriginAccountBoundaryGeneration();
  const syncOwnerPromise = captureJournalSyncOwner();
  const objectUrl = URL.createObjectURL(file);
  try {
    const decoded = await decodeJournalPhoto(file, objectUrl, signal);
    let full: Awaited<ReturnType<typeof resizeAndCompress>>;
    let thumb: Awaited<ReturnType<typeof resizeAndCompress>>;
    try {
      full = await encodeJournalPhotoWithinLimit(
        (maxDimension, quality) =>
          resizeAndCompress(decoded.image, maxDimension, quality, signal),
        JOURNAL_PHOTO_UPLOAD_MAX_BYTES,
      );
      throwIfJournalPhotoProcessingAborted(signal);
      thumb = await resizeAndCompress(decoded.image, THUMB_WIDTH, THUMB_QUALITY, signal);
    } finally {
      decoded.release();
    }

    const photo: JournalPhoto = {
      id: generateId(),
      entryId,
      data: full.dataUrl,
      thumbnail: thumb.dataUrl,
      width: full.width,
      height: full.height,
      createdAt: Date.now(),
    };
    throwIfJournalPhotoProcessingAborted(signal);
    const encryptedPhoto = await encryptPhotoForStorage(photo);
    throwIfJournalPhotoProcessingAborted(signal);
    const storedPhoto = await runWithJournalSecurityWriteLock(async () => {
      throwIfJournalPhotoProcessingAborted(signal);
      assertOriginAccountBoundaryGeneration(expectedAccountGeneration);
      return db.transaction("rw", [db.journalPhotos, db.settings], async () => {
        const existing = await db.journalPhotos.where("entryId").equals(entryId).count();
        if (existing >= MAX_PHOTOS_PER_ENTRY) {
          throw new Error(`Maximum ${MAX_PHOTOS_PER_ENTRY} photos per entry`);
        }
        if (isJournalDraftMediaOwnerId(entryId)) {
          const index = await readCancelledDraftPhotoIndex();
          const quarantinedPhotoIds = new Set(index[entryId] ?? []);
          quarantinedPhotoIds.add(photo.id);
          index[entryId] = [...quarantinedPhotoIds];
          await db.settings.put({ key: SK.JOURNAL_CANCELLED_DRAFT_PHOTOS, value: index });
        }
        throwIfJournalPhotoProcessingAborted(signal);
        await db.journalPhotos.add(encryptedPhoto);
        return encryptedPhoto;
      });
    });

    if (!isJournalDraftMediaOwnerId(entryId)) {
      const expectedOwnerUserId = await syncOwnerPromise;
      if (expectedOwnerUserId) {
        uploadPhotoAndSync(storedPhoto, storedPhoto.data, expectedOwnerUserId);
      }
    }

    return photo;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function getPhotosForEntry(entryId: string): Promise<JournalPhoto[]> {
  const expectedOwnerPromise = captureJournalSyncOwner();
  const photos = await db.journalPhotos.where("entryId").equals(entryId).toArray();
  const expectedOwnerUserId = await expectedOwnerPromise;
  return Promise.all(photos.map((photo) => hydratePhotoFromStorage(photo, expectedOwnerUserId)));
}

export async function getPhotoById(
  id: string,
  expectedEntryId: string,
): Promise<JournalPhoto | undefined> {
  const expectedOwnerPromise = captureJournalSyncOwner();
  const photo = await db.journalPhotos.get(id);
  const expectedOwnerUserId = await expectedOwnerPromise;
  if (!photo || photo.entryId !== expectedEntryId) return undefined;
  return hydratePhotoFromStorage(photo, expectedOwnerUserId);
}

export async function getPhotoPreviewById(
  id: string,
  expectedEntryId: string,
): Promise<JournalPhoto | undefined> {
  const photo = await db.journalPhotos.get(id);
  if (!photo || photo.entryId !== expectedEntryId) return undefined;
  if (!photo.thumbnail) return getPhotoById(id, expectedEntryId);

  return {
    ...photo,
    data: "",
    thumbnail: await decryptMediaDataForDisplay(photo.thumbnail),
  };
}

export async function deletePhoto(id: string, entryId: string): Promise<void> {
  const expectedOwnerUserId = await captureJournalSyncOwner();
  let deleted = false;
  await runWithJournalSecurityWriteLock(async () => {
    if (expectedOwnerUserId) {
      await validateSyncOwner(expectedOwnerUserId, "Diary photo delete outbox");
    }
    await db.transaction("rw", [db.journalEntries, db.journalPhotos, db.offlineQueue], async () => {
      const photo = await db.journalPhotos.get(id);
      if (!photo) return;
      if (photo.entryId !== entryId) {
        throw new Error("Journal photo does not belong to the requested entry");
      }
      if (expectedOwnerUserId) {
        await persistCriticalOfflineActionInCurrentTransaction(
          "DELETE_JOURNAL_PHOTO_STORAGE",
          `journal-photo-delete:${id}`,
          { id },
          expectedOwnerUserId,
        );
      }
      await db.journalPhotos.delete(id);
      deleted = true;
      const entry = await db.journalEntries.get(entryId);
      if (entry) {
        const nextPhotoLayout = entry.photoLayout ? { ...entry.photoLayout } : undefined;
        if (nextPhotoLayout) delete nextPhotoLayout[id];
        await db.journalEntries.update(entryId, {
          photoIds: entry.photoIds.filter((pid) => pid !== id),
          photoLayout:
            nextPhotoLayout && Object.keys(nextPhotoLayout).length > 0
              ? nextPhotoLayout
              : undefined,
          updatedAt: Date.now(),
        });
      }
    });
    if (!deleted) return;
    await prunePendingJournalSecurityMigration({ photoIds: [id] });
  });

  if (!deleted) return;
  if (!expectedOwnerUserId) return;

  await notifyJournalSyncAfterLocalCommit("Diary photo delete");
  void deletePhotoFromStorage(id, expectedOwnerUserId).catch((err) =>
    logger.warn("[JournalSync]", "Photo storage delete failed:", err)
  );
  deleteJournalPhotoFromCloud(id, expectedOwnerUserId).catch((err) =>
    logger.warn("[JournalSync]", "Photo delete sync failed:", err)
  );
}

// ============================================
// AUDIO RECORDINGS
// ============================================

export async function storeAudio(
  entryId: string,
  data: string,
  duration: number,
  mimeType: string
): Promise<JournalAudio> {
  const syncOwnerPromise = captureJournalSyncOwner();
  const validatedAudio = assertValidJournalAudio(data, duration, mimeType);

  const audio: JournalAudio = {
    id: generateId(),
    entryId,
    data,
    duration,
    mimeType: validatedAudio.mimeType,
    createdAt: Date.now(),
  };
  const storedAudio = await runWithJournalSecurityWriteLock(async () => {
    const existing = await db.journalAudio.where("entryId").equals(entryId).count();
    if (existing >= MAX_AUDIO_PER_ENTRY) {
      throw new Error(`Maximum ${MAX_AUDIO_PER_ENTRY} audio recordings per entry`);
    }
    const encryptedAudio = await encryptAudioForStorage(audio);
    await db.journalAudio.add(encryptedAudio);
    return encryptedAudio;
  });

  if (!isJournalDraftMediaOwnerId(entryId)) {
    const expectedOwnerUserId = await syncOwnerPromise;
    if (expectedOwnerUserId) {
      uploadAudioAndSync(
        storedAudio,
        storedAudio.data,
        validatedAudio.mimeType,
        expectedOwnerUserId,
      );
    }
  }

  return audio;
}

export async function getAudioForEntry(entryId: string): Promise<JournalAudio[]> {
  const expectedOwnerPromise = captureJournalSyncOwner();
  const audioItems = await db.journalAudio.where("entryId").equals(entryId).toArray();
  const expectedOwnerUserId = await expectedOwnerPromise;
  return Promise.all(
    audioItems.map((audio) => hydrateAudioFromStorage(audio, expectedOwnerUserId))
  );
}

export async function getAudioById(
  id: string,
  expectedEntryIds: readonly string[],
): Promise<JournalAudio | undefined> {
  const audio = await db.journalAudio.get(id);
  if (!audio || !expectedEntryIds.includes(audio.entryId)) return undefined;
  const expectedOwnerPromise = captureJournalSyncOwner();
  const expectedOwnerUserId = await expectedOwnerPromise;
  return hydrateAudioFromStorage(audio, expectedOwnerUserId);
}

export async function deleteAudio(id: string, entryId: string): Promise<void> {
  const expectedOwnerUserId = await captureJournalSyncOwner();
  let deleted = false;
  await runWithJournalSecurityWriteLock(async () => {
    if (expectedOwnerUserId) {
      await validateSyncOwner(expectedOwnerUserId, "Diary audio delete outbox");
    }
    await db.transaction("rw", [db.journalEntries, db.journalAudio, db.offlineQueue], async () => {
      const audio = await db.journalAudio.get(id);
      if (!audio) return;
      if (audio.entryId !== entryId) {
        throw new Error("Journal audio does not belong to the requested entry");
      }
      if (expectedOwnerUserId) {
        await persistCriticalOfflineActionInCurrentTransaction(
          "DELETE_JOURNAL_AUDIO_STORAGE",
          `journal-audio-delete:${id}`,
          { id },
          expectedOwnerUserId,
        );
      }
      await db.journalAudio.delete(id);
      deleted = true;
      const entry = await db.journalEntries.get(entryId);
      if (entry && entry.audioIds) {
        await db.journalEntries.update(entryId, {
          audioIds: entry.audioIds.filter((aid) => aid !== id),
          updatedAt: Date.now(),
        });
      }
    });
    if (!deleted) return;
    await prunePendingJournalSecurityMigration({ audioIds: [id] });
  });

  if (!deleted) return;
  if (!expectedOwnerUserId) return;

  await notifyJournalSyncAfterLocalCommit("Diary audio delete");
  void deleteAudioFromStorage(id, expectedOwnerUserId).catch((err) =>
    logger.warn("[JournalSync]", "Audio storage delete failed:", err)
  );
  deleteJournalAudioFromCloud(id, expectedOwnerUserId).catch((err) =>
    logger.warn("[JournalSync]", "Audio delete sync failed:", err)
  );
}
