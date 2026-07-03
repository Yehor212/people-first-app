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

type JournalPhotoSyncMetadata = Pick<
  JournalPhoto,
  "id" | "entryId" | "width" | "height" | "createdAt" | "storagePath"
>;

type JournalAudioSyncMetadata = Pick<
  JournalAudio,
  "id" | "entryId" | "duration" | "mimeType" | "createdAt" | "storagePath"
>;

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

  const vaultKey = getJournalContentVaultKey();
  if (!vaultKey) return entry;

  return {
    ...entry,
    content: await encryptJournalContent(entry.content, vaultKey),
  };
}

async function encryptEntryChangesForStorage<T extends Partial<Pick<JournalEntry, "content">>>(
  changes: T,
): Promise<T> {
  if (typeof changes.content !== "string" || changes.content.length === 0) return changes;
  if (isEncryptedJournalContent(changes.content)) return changes;

  const vaultKey = getJournalContentVaultKey();
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

function isEntryAfterCursorInPageOrder(entry: JournalEntry, cursor: JournalEntryPageCursor): boolean {
  if (entry.createdAt < cursor.createdAt) return true;
  if (entry.createdAt > cursor.createdAt) return false;
  return compareJournalEntryIdsDescending(entry.id, cursor.id) > 0;
}

function dedupeJournalEntriesById(entries: JournalEntry[]): JournalEntry[] {
  return [...new Map(entries.map((entry) => [entry.id, entry])).values()];
}

async function getCreatedAtPageWithStableTies(
  limit: number,
  beforeCreatedAt?: number,
): Promise<JournalEntry[]> {
  const collection = typeof beforeCreatedAt === "number"
    ? db.journalEntries.where("createdAt").below(beforeCreatedAt).reverse()
    : db.journalEntries.orderBy("createdAt").reverse();
  const candidates = await collection.limit(limit + 1).toArray();
  const boundaryCreatedAt = candidates[Math.min(limit, candidates.length) - 1]?.createdAt;
  if (typeof boundaryCreatedAt !== "number") return candidates;

  const boundaryTies = await db.journalEntries.where("createdAt").equals(boundaryCreatedAt).toArray();
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
  const vaultKey = getJournalContentVaultKey();
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
  payload: QueuedJournalPhotoUploadPayload | QueuedJournalAudioUploadPayload | QueuedJournalMediaIdPayload,
  label: string
): void {
  if (!isCloudSyncEnabled()) return;
  void offlineQueue
    .enqueue(type, entityId, payload, { priority: "high" })
    .catch((err) => logger.warn("[JournalSync]", label + " queue failed:", err));
}

function queuePhotoUploadRetry(photoId: string): void {
  queueJournalMediaAction(
    "UPLOAD_JOURNAL_PHOTO_STORAGE",
    "journal-photo-upload:" + photoId,
    { id: photoId },
    "Photo upload retry"
  );
}

function queueAudioUploadRetry(audioId: string): void {
  queueJournalMediaAction(
    "UPLOAD_JOURNAL_AUDIO_STORAGE",
    "journal-audio-upload:" + audioId,
    { id: audioId },
    "Audio upload retry"
  );
}

function queuePhotoDeleteRetry(photoId: string): void {
  queueJournalMediaAction(
    "DELETE_JOURNAL_PHOTO_STORAGE",
    "journal-photo-delete:" + photoId,
    { id: photoId },
    "Photo delete retry"
  );
}

function queueAudioDeleteRetry(audioId: string): void {
  queueJournalMediaAction(
    "DELETE_JOURNAL_AUDIO_STORAGE",
    "journal-audio-delete:" + audioId,
    { id: audioId },
    "Audio delete retry"
  );
}

function queueEntryMediaDeleteRetries(photoIds: string[], audioIds: string[]): void {
  for (const photoId of photoIds) queuePhotoDeleteRetry(photoId);
  for (const audioId of audioIds) queueAudioDeleteRetry(audioId);
}

export async function retryJournalPhotoUpload(payload: unknown): Promise<void> {
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
    const result = await uploadPhotoPayload(photo, photo.data);
    if (!result) throw new Error("Journal photo upload retry returned no storage result: " + photo.id);

    await db.journalPhotos.update(photo.id, {
      storagePath: result.path,
    });
    const updated = await db.journalPhotos.get(photo.id);
    await syncJournalPhoto(updated ? toPhotoSyncMetadata(updated) : {
      ...toPhotoSyncMetadata(photo),
      storagePath: result.path,
    });
    return;
  }

  const metadata = photo ? toPhotoSyncMetadata(photo) : fallbackMetadata;
  if (metadata) await syncJournalPhoto(metadata);
}

export async function retryJournalAudioUpload(payload: unknown): Promise<void> {
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
    const result = await uploadAudioPayload(audio, audio.data, audio.mimeType);
    if (!result) throw new Error("Journal audio upload retry returned no storage result: " + audio.id);

    await db.journalAudio.update(audio.id, {
      storagePath: result.path,
    });
    const updated = await db.journalAudio.get(audio.id);
    await syncJournalAudio(updated ? toAudioSyncMetadata(updated) : {
      ...toAudioSyncMetadata(audio),
      storagePath: result.path,
    });
    return;
  }

  const metadata = audio ? toAudioSyncMetadata(audio) : fallbackMetadata;
  if (metadata) await syncJournalAudio(metadata);
}

export async function retryJournalPhotoDelete(payload: unknown): Promise<void> {
  if (!isCloudSyncEnabled()) return;

  const photoId = getQueuedMediaId(payload);
  if (!photoId) {
    logger.warn("[JournalSync]", "Queued photo delete missing id");
    return;
  }
  await deletePhotoFromStorage(photoId);
  await deleteJournalPhotoFromCloud(photoId);
}

export async function retryJournalAudioDelete(payload: unknown): Promise<void> {
  if (!isCloudSyncEnabled()) return;

  const audioId = getQueuedMediaId(payload);
  if (!audioId) {
    logger.warn("[JournalSync]", "Queued audio delete missing id");
    return;
  }
  await deleteAudioFromStorage(audioId);
  await deleteJournalAudioFromCloud(audioId);
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

  let relinkedMedia: { photos: JournalPhoto[]; audios: JournalAudio[] } = { photos: [], audios: [] };
  await db.transaction("rw", [db.journalPhotos, db.journalAudio], async () => {
    relinkedMedia = await relinkDraftMediaToEntry(
      entryId,
      media.photoIds || [],
      media.audioIds || [],
    );
  });

  if (!isCloudSyncEnabled()) return;

  for (const photo of relinkedMedia.photos) {
    if (photo.data && !photo.storagePath) {
      uploadPhotoAndSync(photo, photo.data);
    } else {
      syncPhotoMetadata(photo, "Photo relink sync");
    }
  }
  for (const audio of relinkedMedia.audios) {
    if (audio.data && !audio.storagePath) {
      uploadAudioAndSync(audio, audio.data, audio.mimeType);
    } else {
      syncAudioMetadata(audio, "Audio relink sync");
    }
  }
  if (relinkedMedia.photos.length || relinkedMedia.audios.length) triggerSync();
}

function syncPhotoMetadata(photo: JournalPhoto, label: string): void {
  if (!isCloudSyncEnabled()) return;
  syncJournalPhoto(photo).catch((err) => logger.warn("[JournalSync]", `${label} failed:`, err));
}

function syncAudioMetadata(audio: JournalAudio, label: string): void {
  if (!isCloudSyncEnabled()) return;
  syncJournalAudio(audio).catch((err) => logger.warn("[JournalSync]", `${label} failed:`, err));
}


async function uploadPhotoPayload(photo: JournalPhoto, dataUrl: string) {
  const result = isEncryptedJournalMediaData(dataUrl)
    ? await uploadEncryptedPhoto(photo.id, encryptedJournalMediaToStorageBlob(dataUrl))
    : await uploadPhoto(photo.id, dataUrl);

  if (result && photo.storagePath && photo.storagePath !== result.path) {
    void deleteJournalMediaStoragePath("journal-photos", photo.storagePath).catch((err) =>
      logger.warn("[JournalSync]", "Old photo storage cleanup failed:", err),
    );
  }

  return result;
}

async function uploadAudioPayload(audio: JournalAudio, dataUrl: string, mimeType: string) {
  const result = isEncryptedJournalMediaData(dataUrl)
    ? await uploadEncryptedAudio(audio.id, encryptedJournalMediaToStorageBlob(dataUrl))
    : await uploadAudioToStorage(audio.id, dataUrl, mimeType);

  if (result && audio.storagePath && audio.storagePath !== result.path) {
    void deleteJournalMediaStoragePath("journal-audio", audio.storagePath).catch((err) =>
      logger.warn("[JournalSync]", "Old audio storage cleanup failed:", err),
    );
  }

  return result;
}

function uploadPhotoAndSync(photo: JournalPhoto, dataUrl: string): void {
  if (!isCloudSyncEnabled()) return;
  queuePhotoUploadRetry(photo.id);
  void uploadPhotoPayload(photo, dataUrl)
    .then(async (result) => {
      if (result) {
        await db.journalPhotos.update(photo.id, {
          storagePath: result.path,
        });
        const updated = await db.journalPhotos.get(photo.id);
        if (updated) syncPhotoMetadata(updated, "Photo sync");
      } else {
        logger.warn("[Journal]", "Photo upload returned no storage result; queued for retry:", photo.id);
      }
    })
    .catch((err) => {
      logger.error("[Journal]", "Photo upload failed:", err);
      queuePhotoUploadRetry(photo.id);
    });

  syncPhotoMetadata(photo, "Photo metadata sync");
}

function uploadAudioAndSync(audio: JournalAudio, dataUrl: string, mimeType: string): void {
  if (!isCloudSyncEnabled()) return;
  queueAudioUploadRetry(audio.id);
  void uploadAudioPayload(audio, dataUrl, mimeType)
    .then(async (result) => {
      if (result) {
        await db.journalAudio.update(audio.id, {
          storagePath: result.path,
        });
        const updated = await db.journalAudio.get(audio.id);
        if (updated) syncAudioMetadata(updated, "Audio sync");
      } else {
        logger.warn("[Journal]", "Audio upload returned no storage result; queued for retry:", audio.id);
      }
    })
    .catch((err) => {
      logger.error("[Journal]", "Audio upload failed:", err);
      queueAudioUploadRetry(audio.id);
    });

  syncAudioMetadata(audio, "Audio metadata sync");
}

async function hydratePhotoFromStorage(photo: JournalPhoto): Promise<JournalPhoto> {
  const downloaded = !photo.data && photo.storagePath
    ? await downloadAsBase64("journal-photos", photo.storagePath)
    : null;
  const storedData = photo.data || (downloaded ? encryptedJournalMediaFromStorageDataUrl(downloaded) : null);
  if (!storedData) return photo;

  const storedThumbnail = photo.thumbnail || storedData;
  const changes: Partial<JournalPhoto> = {};
  if (!photo.data) changes.data = storedData;
  if (!photo.thumbnail) changes.thumbnail = storedThumbnail;
  if (Object.keys(changes).length > 0) {
    await db.journalPhotos.update(photo.id, changes);
  }

  return decryptPhotoForDisplay({ ...photo, data: storedData, thumbnail: storedThumbnail });
}

async function hydrateAudioFromStorage(audio: JournalAudio): Promise<JournalAudio> {
  const downloaded = !audio.data && audio.storagePath
    ? await downloadAsBase64("journal-audio", audio.storagePath)
    : null;
  const storedData = audio.data || (downloaded ? encryptedJournalMediaFromStorageDataUrl(downloaded) : null);
  if (!storedData) return audio;

  if (!audio.data) await db.journalAudio.update(audio.id, { data: storedData });
  return decryptAudioForDisplay({ ...audio, data: storedData });
}

// ============================================
// JOURNAL ENTRIES CRUD
// ============================================

export async function getEntriesPage(
  options: JournalEntryPageOptions = {},
): Promise<JournalEntryPageResult> {
  const limit = normalizeJournalPageLimit(options.limit);
  const totalCountPromise = db.journalEntries.count();
  const cursor = options.before
    ?? (typeof options.beforeCreatedAt === "number"
      ? { createdAt: options.beforeCreatedAt, id: "\uffff" }
      : null);

  let pageWithSentinel: JournalEntry[];
  if (cursor) {
    const sameTimestampEntries = await db.journalEntries.where("createdAt").equals(cursor.createdAt).toArray();
    const sameTimestampAfterCursor = sameTimestampEntries
      .filter((entry) => isEntryAfterCursorInPageOrder(entry, cursor))
      .sort(compareJournalEntryPageOrder);
    const remainingLimit = limit + 1 - sameTimestampAfterCursor.length;
    const olderEntries = remainingLimit > 0
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
    nextCursor: hasMore && pageEntries.length > 0
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
  const now = Date.now();
  const full: JournalEntry = {
    ...entry,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };
  const storedFull = await encryptEntryContentForStorage(full);
  let relinkedMedia: { photos: JournalPhoto[]; audios: JournalAudio[] } = { photos: [], audios: [] };
  await db.transaction("rw", [db.journalEntries, db.journalPhotos, db.journalAudio], async () => {
    await db.journalEntries.add(storedFull);
    relinkedMedia = await relinkDraftMediaToEntry(full.id, full.photoIds, full.audioIds || []);
  });

  if (!isCloudSyncEnabled()) return full;

  // Granular sync to cloud (non-blocking)
  syncJournalEntry(storedFull).catch((err) => logger.warn("[JournalSync]", "Entry sync failed:", err));
  for (const photo of relinkedMedia.photos) {
    if (photo.data && !photo.storagePath) {
      uploadPhotoAndSync(photo, photo.data);
    } else {
      syncPhotoMetadata(photo, "Photo relink sync");
    }
  }
  for (const audio of relinkedMedia.audios) {
    if (audio.data && !audio.storagePath) {
      uploadAudioAndSync(audio, audio.data, audio.mimeType);
    } else {
      syncAudioMetadata(audio, "Audio relink sync");
    }
  }
  triggerSync();

  return full;
}

export async function updateEntry(
  id: string,
  changes: Partial<Omit<JournalEntry, "id" | "createdAt">>
): Promise<void> {
  const updatedAt = Date.now();
  const storageChanges = await encryptEntryChangesForStorage({ ...changes, updatedAt });
  await db.journalEntries.update(id, storageChanges);

  if (!isCloudSyncEnabled()) return;

  // Granular sync to cloud (non-blocking) — re-read full entry for sync
  void db.journalEntries.get(id).then((updated) => {
    if (updated)
      syncJournalEntry(updated).catch((err) =>
        logger.warn("[JournalSync]", "Entry update sync failed:", err)
      );
  });
  triggerSync();
}

export async function deleteEntry(id: string): Promise<void> {
  // Collect associated media before deleting
  const photos = await db.journalPhotos.where("entryId").equals(id).toArray();
  const audios = await db.journalAudio.where("entryId").equals(id).toArray();

  // Track deletion before local rows disappear so stale remote pulls cannot resurrect it.
  await trackDeletedJournalEntryId(id);

  // Delete from local IndexedDB (photos + audio + entry)
  await db.transaction("rw", [db.journalEntries, db.journalPhotos, db.journalAudio], async () => {
    if (photos.length) {
      await db.journalPhotos.bulkDelete(photos.map((p) => p.id));
    }
    if (audios.length) {
      await db.journalAudio.bulkDelete(audios.map((a) => a.id));
    }
    await db.journalEntries.delete(id);
  });

  const photoIds = photos.map((p) => p.id);
  const audioIds = audios.map((a) => a.id);

  if (!isCloudSyncEnabled()) return;

  queueEntryMediaDeleteRetries(photoIds, audioIds);

  // Clean up from Supabase Storage (fire-and-forget, durable queue is already recorded)
  void deleteEntryMediaFromStorage(photoIds, audioIds);

  // Delete from cloud tables (fire-and-forget)
  deleteJournalEntryFromCloud(id).catch((err) =>
    logger.warn("[JournalSync]", "Entry delete sync failed:", err)
  );
  triggerSync();
}

export async function deleteDraftMedia(): Promise<void> {
  const photos = await db.journalPhotos.where("entryId").equals(JOURNAL_DRAFT_ENTRY_ID).toArray();
  const audios = await db.journalAudio.where("entryId").equals(JOURNAL_DRAFT_ENTRY_ID).toArray();
  const photoIds = photos.map((p) => p.id);
  const audioIds = audios.map((a) => a.id);

  await db.transaction("rw", [db.journalPhotos, db.journalAudio], async () => {
    if (photoIds.length) await db.journalPhotos.bulkDelete(photoIds);
    if (audioIds.length) await db.journalAudio.bulkDelete(audioIds);
  });

  if (isCloudSyncEnabled() && (photoIds.length || audioIds.length)) {
    queueEntryMediaDeleteRetries(photoIds, audioIds);
    void deleteEntryMediaFromStorage(photoIds, audioIds);
    for (const photoId of photoIds) {
      deleteJournalPhotoFromCloud(photoId).catch((err) =>
        logger.warn("[JournalSync]", "Draft photo delete sync failed:", err)
      );
    }
    for (const audioId of audioIds) {
      deleteJournalAudioFromCloud(audioId).catch((err) =>
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
  const entries = await db.journalEntries.toArray();
  const plaintextEntries = entries.filter((entry) => entry.content && !isEncryptedJournalContent(entry.content));
  if (plaintextEntries.length === 0) return 0;

  const encryptedEntries = await Promise.all(
    plaintextEntries.map(async (entry) => ({
      ...entry,
      content: await encryptJournalContent(entry.content, vaultKey),
      updatedAt: Date.now(),
    })),
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

  for (const entry of encryptedEntries) {
    syncJournalEntry(entry).catch((err) =>
      logger.warn("[JournalSync]", "Entry encryption migration sync failed:", err),
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
  const entries = await db.journalEntries.toArray();
  const encryptedEntries = entries.filter((entry) => entry.content && isEncryptedJournalContent(entry.content));
  if (encryptedEntries.length === 0) return 0;

  const decryptedEntries = await Promise.all(
    encryptedEntries.map(async (entry) => ({
      ...entry,
      content: await decryptJournalContentIfNeeded(entry.content, vaultKey),
      updatedAt: Date.now(),
    })),
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

  for (const entry of decryptedEntries) {
    syncJournalEntry(entry).catch((err) =>
      logger.warn("[JournalSync]", "Entry password removal sync failed:", err),
    );
  }
  triggerSync();

  return decryptedEntries.length;
}


export async function encryptPlaintextJournalMedia(vaultKey: string): Promise<number> {
  const [photos, audios] = await Promise.all([db.journalPhotos.toArray(), db.journalAudio.toArray()]);
  const photoUpdates = await Promise.all(
    photos
      .filter((photo) =>
        Boolean(photo.data && !isEncryptedJournalMediaData(photo.data)) ||
        Boolean(photo.thumbnail && !isEncryptedJournalMediaData(photo.thumbnail)),
      )
      .map(async (photo) => ({
        ...photo,
        data: await encryptMediaDataWithVaultKey(photo.data, vaultKey),
        thumbnail: await encryptMediaDataWithVaultKey(photo.thumbnail, vaultKey),
      })),
  );
  const audioUpdates = await Promise.all(
    audios
      .filter((audio) => Boolean(audio.data && !isEncryptedJournalMediaData(audio.data)))
      .map(async (audio) => ({
        ...audio,
        data: await encryptMediaDataWithVaultKey(audio.data, vaultKey),
      })),
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
    for (const photo of photoUpdates) uploadPhotoAndSync(photo, photo.data);
    for (const audio of audioUpdates) uploadAudioAndSync(audio, audio.data, audio.mimeType);
    triggerSync();
  }

  return photoUpdates.length + audioUpdates.length;
}

export async function hasEncryptedJournalMedia(): Promise<boolean> {
  const [encryptedPhoto, encryptedAudio] = await Promise.all([
    db.journalPhotos
      .filter((photo) =>
        Boolean(photo.data && isEncryptedJournalMediaData(photo.data)) ||
        Boolean(photo.thumbnail && isEncryptedJournalMediaData(photo.thumbnail)),
      )
      .first(),
    db.journalAudio
      .filter((audio) => Boolean(audio.data && isEncryptedJournalMediaData(audio.data)))
      .first(),
  ]);
  return Boolean(encryptedPhoto || encryptedAudio);
}

export async function decryptEncryptedJournalMedia(vaultKey: string): Promise<number> {
  const [photos, audios] = await Promise.all([db.journalPhotos.toArray(), db.journalAudio.toArray()]);
  const photoUpdates = await Promise.all(
    photos
      .filter((photo) =>
        Boolean(photo.data && isEncryptedJournalMediaData(photo.data)) ||
        Boolean(photo.thumbnail && isEncryptedJournalMediaData(photo.thumbnail)),
      )
      .map(async (photo) => ({
        ...photo,
        data: await decryptMediaDataWithVaultKey(photo.data, vaultKey),
        thumbnail: await decryptMediaDataWithVaultKey(photo.thumbnail, vaultKey),
      })),
  );
  const audioUpdates = await Promise.all(
    audios
      .filter((audio) => Boolean(audio.data && isEncryptedJournalMediaData(audio.data)))
      .map(async (audio) => ({
        ...audio,
        data: await decryptMediaDataWithVaultKey(audio.data, vaultKey),
      })),
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
    for (const photo of photoUpdates) uploadPhotoAndSync(photo, photo.data);
    for (const audio of audioUpdates) uploadAudioAndSync(audio, audio.data, audio.mimeType);
    triggerSync();
  }

  return photoUpdates.length + audioUpdates.length;
}

// ============================================
// PHOTO COMPRESSION + STORAGE
// ============================================

const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.7;
const THUMB_WIDTH = 100;
const THUMB_QUALITY = 0.5;

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

export async function compressAndStorePhoto(file: File, entryId: string): Promise<JournalPhoto> {
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
    const storedPhoto = await encryptPhotoForStorage(photo);

    await db.journalPhotos.add(storedPhoto);

    if (entryId !== JOURNAL_DRAFT_ENTRY_ID) {
      uploadPhotoAndSync(storedPhoto, storedPhoto.data);
    }

    return photo;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function getPhotosForEntry(entryId: string): Promise<JournalPhoto[]> {
  const photos = await db.journalPhotos.where("entryId").equals(entryId).toArray();
  return Promise.all(photos.map((photo) => hydratePhotoFromStorage(photo)));
}

export async function getPhotoById(id: string): Promise<JournalPhoto | undefined> {
  const photo = await db.journalPhotos.get(id);
  return photo ? hydratePhotoFromStorage(photo) : undefined;
}

export async function deletePhoto(id: string, entryId: string): Promise<void> {
  await db.transaction("rw", [db.journalEntries, db.journalPhotos], async () => {
    await db.journalPhotos.delete(id);
    const entry = await db.journalEntries.get(entryId);
    if (entry) {
      await db.journalEntries.update(entryId, {
        photoIds: entry.photoIds.filter((pid) => pid !== id),
        updatedAt: Date.now(),
      });
    }
  });

  if (!isCloudSyncEnabled()) return;

  // Clean up from Supabase Storage + cloud table (fire-and-forget, durable queue is already recorded)
  queuePhotoDeleteRetry(id);
  void deletePhotoFromStorage(id).catch((err) =>
    logger.warn("[JournalSync]", "Photo storage delete failed:", err)
  );
  deleteJournalPhotoFromCloud(id).catch((err) =>
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
  const storedAudio = await encryptAudioForStorage(audio);

  await db.journalAudio.add(storedAudio);

  if (entryId !== JOURNAL_DRAFT_ENTRY_ID) {
    uploadAudioAndSync(storedAudio, storedAudio.data, mimeType);
  }

  return audio;
}

export async function getAudioForEntry(entryId: string): Promise<JournalAudio[]> {
  const audioItems = await db.journalAudio.where("entryId").equals(entryId).toArray();
  return Promise.all(audioItems.map((audio) => hydrateAudioFromStorage(audio)));
}

export async function getAudioById(id: string): Promise<JournalAudio | undefined> {
  const audio = await db.journalAudio.get(id);
  return audio ? hydrateAudioFromStorage(audio) : undefined;
}

export async function deleteAudio(id: string, entryId: string): Promise<void> {
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

  if (!isCloudSyncEnabled()) return;

  // Clean up from Supabase Storage + cloud table (fire-and-forget, durable queue is already recorded)
  queueAudioDeleteRetry(id);
  void deleteAudioFromStorage(id).catch((err) =>
    logger.warn("[JournalSync]", "Audio storage delete failed:", err)
  );
  deleteJournalAudioFromCloud(id).catch((err) =>
    logger.warn("[JournalSync]", "Audio delete sync failed:", err)
  );
}
