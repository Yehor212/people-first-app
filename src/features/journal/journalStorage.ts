import { db } from "@/storage/db";
import { generateId } from "@/lib/utils";
import type { JournalEntry, JournalPhoto, JournalAudio } from "./types";
import { JOURNAL_DRAFT_ENTRY_ID, MAX_PHOTOS_PER_ENTRY, MAX_AUDIO_PER_ENTRY } from "./types";
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
} from "@/storage/journalStorageService";
import {
  syncJournalEntry,
  deleteJournalEntryFromCloud,
  syncJournalPhoto,
  syncJournalAudio,
  deleteJournalPhotoFromCloud,
  deleteJournalAudioFromCloud,
} from "@/storage/realtimeSync";
import { triggerSync } from "@/storage/cloudSync";
import { trackDeletedJournalEntryId } from "@/storage/deletionTracker";
import { logger } from "@/lib/logger";
import { offlineQueue } from "@/lib/offlineQueue";
import { isCloudSyncEnabled } from "@/lib/cloudSyncSettings";
import { getCurrentSessionUserId } from "@/lib/supabaseClient";
import { SK } from "@/lib/storageKeys";
import { validateSyncOwner } from "@/storage/sync/syncOwner";
import { runWithJournalSecurityWriteLock } from "./journalSecurityWriteLock";
import { getJournalVaultKeyForWrite } from "./journalWriteSecurity";

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

function queuePhotoDeleteRetry(photoId: string, expectedOwnerUserId: string): void {
  queueJournalMediaAction(
    "DELETE_JOURNAL_PHOTO_STORAGE",
    "journal-photo-delete:" + photoId,
    { id: photoId },
    "Photo delete retry",
    expectedOwnerUserId
  );
}

function queueAudioDeleteRetry(audioId: string, expectedOwnerUserId: string): void {
  queueJournalMediaAction(
    "DELETE_JOURNAL_AUDIO_STORAGE",
    "journal-audio-delete:" + audioId,
    { id: audioId },
    "Audio delete retry",
    expectedOwnerUserId
  );
}

function queueEntryMediaDeleteRetries(
  photoIds: string[],
  audioIds: string[],
  expectedOwnerUserId: string
): void {
  for (const photoId of photoIds) queuePhotoDeleteRetry(photoId, expectedOwnerUserId);
  for (const audioId of audioIds) queueAudioDeleteRetry(audioId, expectedOwnerUserId);
}

async function retryJournalPhotoUploadUnlocked(
  payload: unknown,
  expectedOwnerUserId: string
): Promise<void> {
  if (!isCloudSyncEnabled()) return;

  const photoId = getQueuedMediaId(payload);
  if (!photoId) {
    logger.warn("[JournalSync]", "Queued photo upload missing id");
    return;
  }

  const fallbackMetadata = getQueuedPhotoMetadata(payload);
  const photo = await db.journalPhotos.get(photoId);

  if (!photo && !fallbackMetadata) {
    logger.warn("[JournalSync]", "Queued photo upload skipped; local row missing:", photoId);
    return;
  }

  if (photo?.data && !photo.storagePath) {
    const result = await uploadPhotoPayload(photo, photo.data, expectedOwnerUserId);
    if (!result)
      throw new Error("Journal photo upload retry returned no storage result: " + photo.id);

    await db.journalPhotos.update(photo.id, {
      storagePath: result.path,
    });
    const updated = await db.journalPhotos.get(photo.id);
    await syncJournalPhoto(
      updated
        ? toPhotoSyncMetadata(updated)
        : {
            ...toPhotoSyncMetadata(photo),
            storagePath: result.path,
          },
      expectedOwnerUserId
    );
    return;
  }

  const metadata = photo ? toPhotoSyncMetadata(photo) : fallbackMetadata;
  if (metadata) await syncJournalPhoto(metadata, expectedOwnerUserId);
}

export function retryJournalPhotoUpload(
  payload: unknown,
  expectedOwnerUserId: string
): Promise<void> {
  return runWithJournalSecurityWriteLock(() =>
    retryJournalPhotoUploadUnlocked(payload, expectedOwnerUserId)
  );
}

async function retryJournalAudioUploadUnlocked(
  payload: unknown,
  expectedOwnerUserId: string
): Promise<void> {
  if (!isCloudSyncEnabled()) return;

  const audioId = getQueuedMediaId(payload);
  if (!audioId) {
    logger.warn("[JournalSync]", "Queued audio upload missing id");
    return;
  }

  const fallbackMetadata = getQueuedAudioMetadata(payload);
  const audio = await db.journalAudio.get(audioId);

  if (!audio && !fallbackMetadata) {
    logger.warn("[JournalSync]", "Queued audio upload skipped; local row missing:", audioId);
    return;
  }

  if (audio?.data && !audio.storagePath) {
    const result = await uploadAudioPayload(audio, audio.data, audio.mimeType, expectedOwnerUserId);
    if (!result)
      throw new Error("Journal audio upload retry returned no storage result: " + audio.id);

    await db.journalAudio.update(audio.id, {
      storagePath: result.path,
    });
    const updated = await db.journalAudio.get(audio.id);
    await syncJournalAudio(
      updated
        ? toAudioSyncMetadata(updated)
        : {
            ...toAudioSyncMetadata(audio),
            storagePath: result.path,
          },
      expectedOwnerUserId
    );
    return;
  }

  const metadata = audio ? toAudioSyncMetadata(audio) : fallbackMetadata;
  if (metadata) await syncJournalAudio(metadata, expectedOwnerUserId);
}

export function retryJournalAudioUpload(
  payload: unknown,
  expectedOwnerUserId: string
): Promise<void> {
  return runWithJournalSecurityWriteLock(() =>
    retryJournalAudioUploadUnlocked(payload, expectedOwnerUserId)
  );
}

export async function retryJournalPhotoDelete(
  payload: unknown,
  expectedOwnerUserId: string
): Promise<void> {
  if (!isCloudSyncEnabled()) return;

  const photoId = getQueuedMediaId(payload);
  if (!photoId) {
    logger.warn("[JournalSync]", "Queued photo delete missing id");
    return;
  }
  await deletePhotoFromStorage(photoId, expectedOwnerUserId);
  await deleteJournalPhotoFromCloud(photoId, expectedOwnerUserId);
}

export async function retryJournalAudioDelete(
  payload: unknown,
  expectedOwnerUserId: string
): Promise<void> {
  if (!isCloudSyncEnabled()) return;

  const audioId = getQueuedMediaId(payload);
  if (!audioId) {
    logger.warn("[JournalSync]", "Queued audio delete missing id");
    return;
  }
  await deleteAudioFromStorage(audioId, expectedOwnerUserId);
  await deleteJournalAudioFromCloud(audioId, expectedOwnerUserId);
}

async function relinkDraftMediaToEntry(
  entryId: string,
  photoIds: string[],
  audioIds: string[] = []
): Promise<{ photos: JournalPhoto[]; audios: JournalAudio[] }> {
  const relinked = { photos: [] as JournalPhoto[], audios: [] as JournalAudio[] };

  for (const photoId of new Set(photoIds)) {
    const photo = await db.journalPhotos.get(photoId);
    if (photo?.entryId !== JOURNAL_DRAFT_ENTRY_ID) continue;
    const updatedPhoto = { ...photo, entryId };
    await db.journalPhotos.update(photoId, { entryId });
    relinked.photos.push(updatedPhoto);
  }

  for (const audioId of new Set(audioIds)) {
    const audio = await db.journalAudio.get(audioId);
    if (audio?.entryId !== JOURNAL_DRAFT_ENTRY_ID) continue;
    const updatedAudio = { ...audio, entryId };
    await db.journalAudio.update(audioId, { entryId });
    relinked.audios.push(updatedAudio);
  }

  return relinked;
}

export async function commitDraftMediaToEntry(
  entryId: string,
  media: { photoIds?: string[]; audioIds?: string[] }
): Promise<void> {
  if (!entryId || entryId === JOURNAL_DRAFT_ENTRY_ID) return;
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
      relinked = await relinkDraftMediaToEntry(entryId, media.photoIds || [], media.audioIds || []);
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
  if (!sourceData) return photo;

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
    if (Object.keys(changes).length > 0) await db.journalPhotos.update(photo.id, changes);
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
  if (!sourceData) return audio;

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

export async function getEntriesByDate(date: string): Promise<JournalEntry[]> {
  const entries = await db.journalEntries.where("date").equals(date).reverse().sortBy("createdAt");
  return decryptEntriesForDisplay(entries);
}

export async function getEntryById(id: string): Promise<JournalEntry | undefined> {
  const entry = await db.journalEntries.get(id);
  return entry ? decryptEntryContentForDisplay(entry) : undefined;
}

export async function saveEntry(
  entry: Omit<JournalEntry, "id" | "createdAt" | "updatedAt">
): Promise<JournalEntry> {
  const syncOwnerPromise = captureJournalSyncOwner();
  const localCommit = await runWithJournalSecurityWriteLock(async () => {
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
    await db.transaction("rw", [db.journalEntries, db.journalPhotos, db.journalAudio], async () => {
      await db.journalEntries.add(storedFull);
      relinkedMedia = await relinkDraftMediaToEntry(full.id, full.photoIds, full.audioIds || []);
    });
    return { full, storedFull, relinkedMedia };
  });
  const { full, storedFull, relinkedMedia } = localCommit;

  if (!isCloudSyncEnabled()) return full;
  const expectedOwnerUserId = await syncOwnerPromise;
  if (!expectedOwnerUserId) return full;

  // Granular sync to cloud (non-blocking)
  syncJournalEntry(storedFull, expectedOwnerUserId).catch((err) =>
    logger.warn("[JournalSync]", "Entry sync failed:", err)
  );
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
  triggerSync();

  return full;
}

export async function updateEntry(
  id: string,
  changes: Partial<Omit<JournalEntry, "id" | "createdAt">>
): Promise<void> {
  const syncOwnerPromise = captureJournalSyncOwner();
  await runWithJournalSecurityWriteLock(async () => {
    const updatedAt = Date.now();
    const storageChanges = await encryptEntryChangesForStorage({ ...changes, updatedAt });
    await db.journalEntries.update(id, storageChanges);
  });

  if (!isCloudSyncEnabled()) return;
  const expectedOwnerUserId = await syncOwnerPromise;
  if (!expectedOwnerUserId) return;

  // Granular sync to cloud (non-blocking) — re-read full entry for sync
  void db.journalEntries.get(id).then((updated) => {
    if (updated)
      syncJournalEntry(updated, expectedOwnerUserId).catch((err) =>
        logger.warn("[JournalSync]", "Entry update sync failed:", err)
      );
  });
  triggerSync();
}

export async function deleteEntry(id: string): Promise<void> {
  const syncOwnerPromise = captureJournalSyncOwner();
  const { photoIds, audioIds } = await runWithJournalSecurityWriteLock(async () => {
    const photos = await db.journalPhotos.where("entryId").equals(id).toArray();
    const audios = await db.journalAudio.where("entryId").equals(id).toArray();
    await trackDeletedJournalEntryId(id);
    await db.transaction("rw", [db.journalEntries, db.journalPhotos, db.journalAudio], async () => {
      if (photos.length) await db.journalPhotos.bulkDelete(photos.map((photo) => photo.id));
      if (audios.length) await db.journalAudio.bulkDelete(audios.map((audio) => audio.id));
      await db.journalEntries.delete(id);
    });
    const photoIds = photos.map((photo) => photo.id);
    const audioIds = audios.map((audio) => audio.id);
    await prunePendingJournalSecurityMigration({
      entryIds: [id],
      photoIds,
      audioIds,
    });
    return { photoIds, audioIds };
  });

  if (!isCloudSyncEnabled()) return;
  const expectedOwnerUserId = await syncOwnerPromise;
  if (!expectedOwnerUserId) return;

  queueEntryMediaDeleteRetries(photoIds, audioIds, expectedOwnerUserId);

  // Clean up from Supabase Storage (fire-and-forget, durable queue is already recorded)
  void deleteEntryMediaFromStorage(photoIds, audioIds, expectedOwnerUserId);

  // Delete from cloud tables (fire-and-forget)
  deleteJournalEntryFromCloud(id, expectedOwnerUserId).catch((err) =>
    logger.warn("[JournalSync]", "Entry delete sync failed:", err)
  );
  triggerSync();
}

export async function deleteDraftMedia(): Promise<void> {
  const syncOwnerPromise = captureJournalSyncOwner();
  const { photoIds, audioIds } = await runWithJournalSecurityWriteLock(async () => {
    const photos = await db.journalPhotos.where("entryId").equals(JOURNAL_DRAFT_ENTRY_ID).toArray();
    const audios = await db.journalAudio.where("entryId").equals(JOURNAL_DRAFT_ENTRY_ID).toArray();
    const photoIds = photos.map((photo) => photo.id);
    const audioIds = audios.map((audio) => audio.id);
    await db.transaction("rw", [db.journalPhotos, db.journalAudio], async () => {
      if (photoIds.length) await db.journalPhotos.bulkDelete(photoIds);
      if (audioIds.length) await db.journalAudio.bulkDelete(audioIds);
    });
    await prunePendingJournalSecurityMigration({ photoIds, audioIds });
    return { photoIds, audioIds };
  });

  if (isCloudSyncEnabled() && (photoIds.length || audioIds.length)) {
    const expectedOwnerUserId = await syncOwnerPromise;
    if (!expectedOwnerUserId) return;
    queueEntryMediaDeleteRetries(photoIds, audioIds, expectedOwnerUserId);
    void deleteEntryMediaFromStorage(photoIds, audioIds, expectedOwnerUserId);
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
    triggerSync();
  }
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

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;
const THUMB_WIDTH = 320;
const THUMB_QUALITY = 0.72;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function resizeAndCompress(
  img: HTMLImageElement,
  maxDim: number,
  quality: number
): { dataUrl: string; width: number; height: number } {
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
  ctx.drawImage(img, 0, 0, width, height);
  return { dataUrl: canvas.toDataURL("image/jpeg", quality), width, height };
}

async function createPhotoThumbnail(dataUrl: string): Promise<string> {
  const image = await loadImage(dataUrl);
  return resizeAndCompress(image, THUMB_WIDTH, THUMB_QUALITY).dataUrl;
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

export async function compressAndStorePhoto(file: File, entryId: string): Promise<JournalPhoto> {
  const syncOwnerPromise = captureJournalSyncOwner();
  // Check photo limit
  const existing = await db.journalPhotos.where("entryId").equals(entryId).count();
  if (existing >= MAX_PHOTOS_PER_ENTRY) {
    throw new Error(`Maximum ${MAX_PHOTOS_PER_ENTRY} photos per entry`);
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const full = resizeAndCompress(img, MAX_DIMENSION, JPEG_QUALITY);
    const thumb = resizeAndCompress(img, THUMB_WIDTH, THUMB_QUALITY);

    const photo: JournalPhoto = {
      id: generateId(),
      entryId,
      data: full.dataUrl,
      thumbnail: thumb.dataUrl,
      width: full.width,
      height: full.height,
      createdAt: Date.now(),
    };
    const storedPhoto = await runWithJournalSecurityWriteLock(async () => {
      const encryptedPhoto = await encryptPhotoForStorage(photo);
      await db.journalPhotos.add(encryptedPhoto);
      return encryptedPhoto;
    });

    if (entryId !== JOURNAL_DRAFT_ENTRY_ID) {
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

export async function getPhotoById(id: string): Promise<JournalPhoto | undefined> {
  const expectedOwnerPromise = captureJournalSyncOwner();
  const photo = await db.journalPhotos.get(id);
  const expectedOwnerUserId = await expectedOwnerPromise;
  return photo ? hydratePhotoFromStorage(photo, expectedOwnerUserId) : undefined;
}

export async function getPhotoPreviewById(id: string): Promise<JournalPhoto | undefined> {
  const photo = await db.journalPhotos.get(id);
  if (!photo) return undefined;
  if (!photo.thumbnail) return getPhotoById(id);

  return {
    ...photo,
    data: "",
    thumbnail: await decryptMediaDataForDisplay(photo.thumbnail),
  };
}

export async function deletePhoto(id: string, entryId: string): Promise<void> {
  const syncOwnerPromise = captureJournalSyncOwner();
  await runWithJournalSecurityWriteLock(async () => {
    await db.transaction("rw", [db.journalEntries, db.journalPhotos], async () => {
      await db.journalPhotos.delete(id);
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
    await prunePendingJournalSecurityMigration({ photoIds: [id] });
  });

  if (!isCloudSyncEnabled()) return;
  const expectedOwnerUserId = await syncOwnerPromise;
  if (!expectedOwnerUserId) return;

  // Clean up from Supabase Storage + cloud table (fire-and-forget, durable queue is already recorded)
  queuePhotoDeleteRetry(id, expectedOwnerUserId);
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

/** Maximum audio file size: 20 MB (matches journal-audio bucket) */
const MAX_AUDIO_SIZE = 20 * 1024 * 1024;

export async function storeAudio(
  entryId: string,
  data: string,
  duration: number,
  mimeType: string
): Promise<JournalAudio> {
  const syncOwnerPromise = captureJournalSyncOwner();
  // M13: Estimate decoded blob size from base64 and enforce limit
  const commaIdx = data.indexOf(",");
  const b64Length = commaIdx >= 0 ? data.length - commaIdx - 1 : data.length;
  const estimatedBytes = Math.ceil((b64Length * 3) / 4);
  if (estimatedBytes > MAX_AUDIO_SIZE) {
    throw new Error("Audio recording too large. Maximum size is 20 MB.");
  }

  const existing = await db.journalAudio.where("entryId").equals(entryId).count();
  if (existing >= MAX_AUDIO_PER_ENTRY) {
    throw new Error(`Maximum ${MAX_AUDIO_PER_ENTRY} audio recordings per entry`);
  }

  const audio: JournalAudio = {
    id: generateId(),
    entryId,
    data,
    duration,
    mimeType,
    createdAt: Date.now(),
  };
  const storedAudio = await runWithJournalSecurityWriteLock(async () => {
    const encryptedAudio = await encryptAudioForStorage(audio);
    await db.journalAudio.add(encryptedAudio);
    return encryptedAudio;
  });

  if (entryId !== JOURNAL_DRAFT_ENTRY_ID) {
    const expectedOwnerUserId = await syncOwnerPromise;
    if (expectedOwnerUserId) {
      uploadAudioAndSync(storedAudio, storedAudio.data, mimeType, expectedOwnerUserId);
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

export async function getAudioById(id: string): Promise<JournalAudio | undefined> {
  const expectedOwnerPromise = captureJournalSyncOwner();
  const audio = await db.journalAudio.get(id);
  const expectedOwnerUserId = await expectedOwnerPromise;
  return audio ? hydrateAudioFromStorage(audio, expectedOwnerUserId) : undefined;
}

export async function deleteAudio(id: string, entryId: string): Promise<void> {
  const syncOwnerPromise = captureJournalSyncOwner();
  await runWithJournalSecurityWriteLock(async () => {
    await db.transaction("rw", [db.journalEntries, db.journalAudio], async () => {
      await db.journalAudio.delete(id);
      const entry = await db.journalEntries.get(entryId);
      if (entry && entry.audioIds) {
        await db.journalEntries.update(entryId, {
          audioIds: entry.audioIds.filter((aid) => aid !== id),
          updatedAt: Date.now(),
        });
      }
    });
    await prunePendingJournalSecurityMigration({ audioIds: [id] });
  });

  if (!isCloudSyncEnabled()) return;
  const expectedOwnerUserId = await syncOwnerPromise;
  if (!expectedOwnerUserId) return;

  // Clean up from Supabase Storage + cloud table (fire-and-forget, durable queue is already recorded)
  queueAudioDeleteRetry(id, expectedOwnerUserId);
  void deleteAudioFromStorage(id, expectedOwnerUserId).catch((err) =>
    logger.warn("[JournalSync]", "Audio storage delete failed:", err)
  );
  deleteJournalAudioFromCloud(id, expectedOwnerUserId).catch((err) =>
    logger.warn("[JournalSync]", "Audio delete sync failed:", err)
  );
}
