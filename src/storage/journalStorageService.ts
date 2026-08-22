/**
 * Supabase Storage service for journal photos and audio.
 *
 * Path convention:
 *   journal-photos/{userId}/{photoId}.jpg
 *   journal-audio/{userId}/{audioId}.{ext}
 *
 * Offline-first: files are always saved to IndexedDB first.
 * This service handles cloud upload/download as a background layer.
 */

import { supabase } from "@/lib/supabaseClient";
import { logger } from "@/lib/logger";
import { SyncOwnerBoundaryError, validateSyncOwner } from "@/storage/sync/syncOwner";
import {
  JOURNAL_AUDIO_MAX_BYTES,
  inspectJournalAudioDataUrl,
  normalizeJournalAudioMimeType,
} from "@/features/journal/journalAudioValidation";

const PHOTO_BUCKET = "journal-photos";
const AUDIO_BUCKET = "journal-audio";
const ENCRYPTED_MEDIA_MIME = "application/octet-stream";
const ENCRYPTED_MEDIA_EXTENSION = "bin";

/** Allowed image MIME types for photo uploads */
const ALLOWED_IMAGE_MIMES: readonly string[] = ["image/jpeg", "image/png", "image/webp"];

/** Allowed audio MIME types for audio uploads */
/** Maximum photo file size: 1 MB (matches journal-photos bucket) */
const MAX_PHOTO_SIZE = 1 * 1024 * 1024;
export { MAX_PHOTO_SIZE as JOURNAL_PHOTO_UPLOAD_MAX_BYTES };

/** Maximum audio file size: 20 MB (matches journal-audio bucket) */
const MAX_AUDIO_SIZE = JOURNAL_AUDIO_MAX_BYTES;
const ENCRYPTED_MEDIA_OVERHEAD_BYTES = 4096;
const MAX_ENCRYPTED_PHOTO_SIZE = MAX_PHOTO_SIZE + ENCRYPTED_MEDIA_OVERHEAD_BYTES;
const MAX_ENCRYPTED_AUDIO_SIZE = MAX_AUDIO_SIZE + ENCRYPTED_MEDIA_OVERHEAD_BYTES;

/** Characters forbidden in storage path segments (null byte checked separately) */
const UNSAFE_PATH_CHARS = /[/\\:*?"<>|]/;

export interface JournalMediaStorageIdentity {
  bucket: "journal-photos" | "journal-audio";
  path: string;
  objectId: string;
  version: string;
  etag: string | null;
  size: number | null;
}

// ============================================
// HELPERS
// ============================================

/** Convert base64 data URL to Blob */
function base64ToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "application/octet-stream";
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    arr[i] = bytes.charCodeAt(i);
  }
  return new Blob([arr], { type: mime });
}

/** Get file extension from MIME type */
function extFromMime(mime: string): string {
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  return "bin";
}

/** Build storage path for a file -- validates inputs against path traversal (L20) */
function storagePath(userId: string, fileId: string, ext: string): string {
  if (UNSAFE_PATH_CHARS.test(fileId) || fileId.includes("..") || fileId.includes("\0")) {
    throw new Error("Invalid file ID: contains forbidden characters");
  }
  if (UNSAFE_PATH_CHARS.test(ext) || ext.includes("..") || ext.includes("\0")) {
    throw new Error("Invalid file extension: contains forbidden characters");
  }
  return `${userId}/${fileId}.${ext}`;
}

function passwordRemovalStoragePath(
  userId: string,
  operationRevision: string,
  fileId: string,
  ext: string
): string {
  if (!/^[0-9]+:[a-z0-9]+$/.test(operationRevision) || operationRevision.length > 128) {
    throw new Error("Invalid diary removal operation revision");
  }
  const basePath = storagePath(userId, fileId, ext);
  return `${userId}/removal/${operationRevision}/${basePath.slice(userId.length + 1)}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function throwIfJournalStorageAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  if (signal.reason instanceof Error) throw signal.reason;
  throw new DOMException("Journal media storage request was aborted", "AbortError");
}

async function awaitJournalStorageRequest<T>(
  request: PromiseLike<T>,
  signal?: AbortSignal
): Promise<T> {
  throwIfJournalStorageAborted(signal);
  if (!signal) return Promise.resolve(request);
  // Supabase Storage's public upload/remove methods do not expose a transport
  // AbortSignal. Do not report an aborted attempt as unwound while its request
  // can still mutate the previous owner's bucket. Wait for the underlying
  // request to settle, then surface the abort before any acknowledgement or
  // local progress write. The queue account-boundary barrier waits for this
  // handler promise, so a late Storage response cannot cross accounts.
  const result = await Promise.resolve(request);
  throwIfJournalStorageAborted(signal);
  return result;
}

async function resolveJournalMediaDeletePaths(
  bucket: typeof PHOTO_BUCKET | typeof AUDIO_BUCKET,
  fileId: string,
  expectedOwnerUserId: string,
  legacyExtensions: readonly string[]
): Promise<string[]> {
  const client = supabase?.storage.from(bucket);
  if (!client) return [];
  const legacyPaths = legacyExtensions.map((ext) => storagePath(expectedOwnerUserId, fileId, ext));
  const { data, error } = await client.list(expectedOwnerUserId, {
    limit: 100,
    search: fileId,
  });
  if (error) throw error;

  const escapedId = escapeRegExp(fileId);
  const exactVersionedName = new RegExp(`^${escapedId}\\.v[0-9]+\\.bin$`, "i");
  const versionedPaths = (data ?? [])
    .map((item) => item.name)
    .filter((name): name is string => typeof name === "string" && exactVersionedName.test(name))
    .map((name) => `${expectedOwnerUserId}/${name}`);
  return [...new Set([...legacyPaths, ...versionedPaths])];
}

async function assertExpectedOwnerCurrent(expectedOwnerUserId: string): Promise<void> {
  await validateSyncOwner(expectedOwnerUserId, "Journal media storage");
}

/**
 * Reads the immutable identity used by the password-removal fence. Supabase's
 * object version changes when the same path is overwritten, so callers can
 * compare a before/after identity around a decryptability download and then
 * bind that exact version in the server-side inventory transaction.
 */
export async function readJournalMediaStorageIdentity(
  bucket: "journal-photos" | "journal-audio",
  path: string,
  expectedOwnerUserId: string,
  signal?: AbortSignal
): Promise<JournalMediaStorageIdentity | null> {
  if (!supabase) return null;
  throwIfJournalStorageAborted(signal);
  await assertExpectedOwnerCurrent(expectedOwnerUserId);
  if (!path.startsWith(`${expectedOwnerUserId}/`) || path.includes("..") || path.includes("\0")) {
    throw new Error("Journal media path does not belong to the expected account");
  }

  const { data, error } = await awaitJournalStorageRequest(
    supabase.storage.from(bucket).info(path),
    signal
  );
  throwIfJournalStorageAborted(signal);
  if (error || !data) {
    logger.warn("[Storage] Journal media identity read failed", { bucket });
    return null;
  }
  await assertExpectedOwnerCurrent(expectedOwnerUserId);
  if (
    typeof data.id !== "string" ||
    data.id.length === 0 ||
    typeof data.version !== "string" ||
    data.version.length === 0 ||
    data.name !== path ||
    data.bucketId !== bucket
  ) {
    logger.warn("[Storage] Journal media identity read rejected", { bucket });
    return null;
  }

  return {
    bucket,
    path,
    objectId: data.id,
    version: data.version,
    etag: typeof data.etag === "string" && data.etag.length > 0 ? data.etag : null,
    size: Number.isSafeInteger(data.size) && Number(data.size) >= 0 ? Number(data.size) : null,
  };
}

function isAllowedDownloadedBlob(
  bucket: typeof PHOTO_BUCKET | typeof AUDIO_BUCKET,
  path: string,
  blob: Blob
): boolean {
  const isEncrypted = path.endsWith(`.${ENCRYPTED_MEDIA_EXTENSION}`);
  const maxSize =
    bucket === PHOTO_BUCKET
      ? isEncrypted
        ? MAX_ENCRYPTED_PHOTO_SIZE
        : MAX_PHOTO_SIZE
      : isEncrypted
        ? MAX_ENCRYPTED_AUDIO_SIZE
        : MAX_AUDIO_SIZE;
  if (blob.size > maxSize) {
    logger.warn("[Storage] Journal media download rejected", {
      bucket,
      reason: "size",
      size: blob.size,
    });
    return false;
  }

  const hasAllowedMime = isEncrypted
    ? blob.type === ENCRYPTED_MEDIA_MIME
    : bucket === PHOTO_BUCKET
      ? ALLOWED_IMAGE_MIMES.includes(blob.type)
      : normalizeJournalAudioMimeType(blob.type) !== null;
  if (!hasAllowedMime) {
    logger.warn("[Storage] Journal media download rejected", {
      bucket,
      reason: "mime",
    });
    return false;
  }
  return true;
}

function maximumJournalMediaDownloadBytes(
  bucket: typeof PHOTO_BUCKET | typeof AUDIO_BUCKET,
  path: string
): number {
  const isEncrypted = path.endsWith(`.${ENCRYPTED_MEDIA_EXTENSION}`);
  return bucket === PHOTO_BUCKET
    ? isEncrypted
      ? MAX_ENCRYPTED_PHOTO_SIZE
      : MAX_PHOTO_SIZE
    : isEncrypted
      ? MAX_ENCRYPTED_AUDIO_SIZE
      : MAX_AUDIO_SIZE;
}

// ============================================
// UPLOAD
// ============================================
async function uploadRawStorageBlob(
  bucket: typeof PHOTO_BUCKET | typeof AUDIO_BUCKET,
  fileId: string,
  blob: Blob,
  expectedOwnerUserId: string,
  options: { contentType: string; ext: string; maxSize: number; label: string },
  signal?: AbortSignal
): Promise<UploadResult | null> {
  if (!supabase) return null;
  throwIfJournalStorageAborted(signal);
  await assertExpectedOwnerCurrent(expectedOwnerUserId);

  try {
    if (blob.size > options.maxSize) {
      logger.warn("[Storage] Journal media upload rejected", {
        bucket,
        reason: "size",
        size: blob.size,
      });
      throw new Error(options.label + " too large.");
    }

    const path = storagePath(expectedOwnerUserId, fileId, options.ext);
    const { error: uploadError } = await awaitJournalStorageRequest(
      supabase.storage.from(bucket).upload(path, blob, {
        contentType: options.contentType,
        upsert: true,
      }),
      signal
    );
    throwIfJournalStorageAborted(signal);

    if (uploadError) {
      logger.warn("[Storage] Journal media upload failed", { bucket, stage: "provider" });
      return null;
    }

    return { path, signedUrl: "" };
  } catch {
    throwIfJournalStorageAborted(signal);
    logger.warn("[Storage] Journal media upload failed", { bucket, stage: "client" });
    return null;
  }
}

export interface UploadResult {
  path: string;
  signedUrl: string;
}

export interface JournalPasswordRemovalPreparedUpload {
  bucket: "journal-photos" | "journal-audio";
  entityId: string;
  path: string;
  contentSha256: string;
  contentSize: number;
  mimeType: string;
  blob: Blob;
}

async function journalPasswordRemovalBlobSha256(blob: Blob): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("Diary media hashing is unavailable");
  const bytes =
    typeof blob.arrayBuffer === "function"
      ? await blob.arrayBuffer()
      : await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(reader.error ?? new Error("Diary media read failed"));
          reader.onload = () =>
            reader.result instanceof ArrayBuffer
              ? resolve(reader.result)
              : reject(new Error("Diary media read returned an invalid result"));
          reader.readAsArrayBuffer(blob);
        });
  const digest = await subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

export async function preparePhotoForPasswordRemovalUpload(
  photoId: string,
  dataUrl: string,
  expectedOwnerUserId: string,
  operationRevision: string,
  signal?: AbortSignal
): Promise<JournalPasswordRemovalPreparedUpload> {
  throwIfJournalStorageAborted(signal);
  await assertExpectedOwnerCurrent(expectedOwnerUserId);
  const blob = base64ToBlob(dataUrl);
  if (!ALLOWED_IMAGE_MIMES.includes(blob.type)) {
    throw new Error("Diary photo MIME type is not allowed");
  }
  if (blob.size <= 0 || blob.size > MAX_PHOTO_SIZE) {
    throw new Error("Diary photo size is outside the removal limit");
  }
  const path = passwordRemovalStoragePath(
    expectedOwnerUserId,
    operationRevision,
    photoId,
    extFromMime(blob.type)
  );
  return {
    bucket: PHOTO_BUCKET,
    entityId: photoId,
    path,
    contentSha256: await journalPasswordRemovalBlobSha256(blob),
    contentSize: blob.size,
    mimeType: blob.type,
    blob,
  };
}

export async function prepareAudioForPasswordRemovalUpload(
  audioId: string,
  dataUrl: string,
  mimeType: string,
  expectedOwnerUserId: string,
  operationRevision: string,
  signal?: AbortSignal
): Promise<JournalPasswordRemovalPreparedUpload> {
  throwIfJournalStorageAborted(signal);
  await assertExpectedOwnerCurrent(expectedOwnerUserId);
  const inspectedAudio = inspectJournalAudioDataUrl(dataUrl, mimeType);
  if (!inspectedAudio) throw new Error("Diary audio MIME type is not allowed");
  const blob = base64ToBlob(dataUrl);
  if (blob.size <= 0 || blob.size > MAX_AUDIO_SIZE) {
    throw new Error("Diary audio size is outside the removal limit");
  }
  const normalizedMimeType = inspectedAudio.mimeType;
  const path = passwordRemovalStoragePath(
    expectedOwnerUserId,
    operationRevision,
    audioId,
    extFromMime(normalizedMimeType)
  );
  return {
    bucket: AUDIO_BUCKET,
    entityId: audioId,
    path,
    contentSha256: await journalPasswordRemovalBlobSha256(blob),
    contentSize: blob.size,
    mimeType: normalizedMimeType,
    blob,
  };
}

export async function uploadPreparedJournalPasswordRemovalMedia(
  prepared: JournalPasswordRemovalPreparedUpload,
  expectedOwnerUserId: string,
  operationRevision: string,
  signal?: AbortSignal
): Promise<UploadResult | null> {
  if (!supabase) return null;
  throwIfJournalStorageAborted(signal);
  await assertExpectedOwnerCurrent(expectedOwnerUserId);
  const expectedPath = passwordRemovalStoragePath(
    expectedOwnerUserId,
    operationRevision,
    prepared.entityId,
    extFromMime(prepared.mimeType)
  );
  if (
    prepared.path !== expectedPath ||
    prepared.contentSize !== prepared.blob.size ||
    prepared.contentSize <= 0 ||
    prepared.contentSha256 !== (await journalPasswordRemovalBlobSha256(prepared.blob))
  ) {
    throw new Error("Diary media removal receipt changed before upload");
  }
  const { error } = await awaitJournalStorageRequest(
    supabase.storage.from(prepared.bucket).upload(prepared.path, prepared.blob, {
      contentType: prepared.mimeType,
      upsert: true,
      metadata: {
        zenflowSha256: prepared.contentSha256,
        zenflowEntityId: prepared.entityId,
        zenflowOperationRevision: operationRevision,
        zenflowMimeType: prepared.mimeType,
      },
    }),
    signal
  );
  throwIfJournalStorageAborted(signal);
  if (error) {
    logger.warn("[Storage] Journal removal media upload failed", {
      bucket: prepared.bucket,
      stage: "provider",
    });
    return null;
  }
  await assertExpectedOwnerCurrent(expectedOwnerUserId);
  return { path: prepared.path, signedUrl: "" };
}

/**
 * Upload a photo (base64 data URL) to Supabase Storage.
 * Returns the storage path only; signed URLs are minted on demand.
 */
async function uploadPhotoAtRemovalBoundary(
  photoId: string,
  dataUrl: string,
  expectedOwnerUserId: string,
  signal?: AbortSignal,
  operationRevision?: string
): Promise<UploadResult | null> {
  if (!supabase) return null;
  throwIfJournalStorageAborted(signal);
  await assertExpectedOwnerCurrent(expectedOwnerUserId);

  try {
    const blob = base64ToBlob(dataUrl);

    // M12: Validate MIME type against allowlist
    if (!ALLOWED_IMAGE_MIMES.includes(blob.type)) {
      logger.warn("[Storage] Journal media upload rejected", {
        bucket: PHOTO_BUCKET,
        reason: "mime",
      });
      throw new Error(`Unsupported image type "${blob.type}". Allowed: JPEG, PNG, WebP.`);
    }

    // M12: Enforce file size limit
    if (blob.size > MAX_PHOTO_SIZE) {
      logger.warn("[Storage] Journal media upload rejected", {
        bucket: PHOTO_BUCKET,
        reason: "size",
        size: blob.size,
      });
      throw new Error("Photo too large. Maximum size is 1 MB.");
    }

    const ext = extFromMime(blob.type);
    const path = operationRevision
      ? passwordRemovalStoragePath(expectedOwnerUserId, operationRevision, photoId, ext)
      : storagePath(expectedOwnerUserId, photoId, ext);

    const { error: uploadError } = await awaitJournalStorageRequest(
      supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
        contentType: blob.type,
        upsert: true,
      }),
      signal
    );
    throwIfJournalStorageAborted(signal);

    if (uploadError) {
      logger.warn("[Storage] Journal media upload failed", {
        bucket: PHOTO_BUCKET,
        stage: "provider",
      });
      return null;
    }

    return {
      path,
      signedUrl: "",
    };
  } catch {
    throwIfJournalStorageAborted(signal);
    logger.warn("[Storage] Journal media upload failed", {
      bucket: PHOTO_BUCKET,
      stage: "client",
    });
    return null;
  }
}

export async function uploadPhoto(
  photoId: string,
  dataUrl: string,
  expectedOwnerUserId: string,
  signal?: AbortSignal
): Promise<UploadResult | null> {
  return uploadPhotoAtRemovalBoundary(photoId, dataUrl, expectedOwnerUserId, signal);
}

export async function uploadPhotoForPasswordRemoval(
  photoId: string,
  dataUrl: string,
  expectedOwnerUserId: string,
  operationRevision: string,
  signal?: AbortSignal
): Promise<UploadResult | null> {
  const prepared = await preparePhotoForPasswordRemovalUpload(
    photoId,
    dataUrl,
    expectedOwnerUserId,
    operationRevision,
    signal
  );
  return uploadPreparedJournalPasswordRemovalMedia(
    prepared,
    expectedOwnerUserId,
    operationRevision,
    signal
  );
}

export async function uploadEncryptedPhoto(
  photoId: string,
  encryptedPayload: Blob,
  expectedOwnerUserId: string,
  vaultRevision: number,
  signal?: AbortSignal
): Promise<UploadResult | null> {
  if (!Number.isSafeInteger(vaultRevision) || vaultRevision < 0) {
    throw new Error("Encrypted diary photo requires an exact vault revision");
  }
  return uploadRawStorageBlob(
    PHOTO_BUCKET,
    photoId,
    encryptedPayload,
    expectedOwnerUserId,
    {
      contentType: ENCRYPTED_MEDIA_MIME,
      ext: `v${vaultRevision}.${ENCRYPTED_MEDIA_EXTENSION}`,
      maxSize: MAX_ENCRYPTED_PHOTO_SIZE,
      label: "Encrypted photo",
    },
    signal
  );
}

/**
 * Upload an audio recording (base64 data URL) to Supabase Storage.
 */
async function uploadAudioAtRemovalBoundary(
  audioId: string,
  dataUrl: string,
  mimeType: string,
  expectedOwnerUserId: string,
  signal?: AbortSignal,
  operationRevision?: string
): Promise<UploadResult | null> {
  if (!supabase) return null;
  throwIfJournalStorageAborted(signal);
  await assertExpectedOwnerCurrent(expectedOwnerUserId);

  try {
    // M13: Validate MIME type against allowlist
    const inspectedAudio = inspectJournalAudioDataUrl(dataUrl, mimeType);
    if (!inspectedAudio) {
      logger.warn("[Storage] Journal media upload rejected", {
        bucket: AUDIO_BUCKET,
        reason: "mime",
      });
      throw new Error(`Unsupported audio type "${mimeType}". Allowed: WebM, MP4, OGG, WAV.`);
    }

    const blob = base64ToBlob(dataUrl);

    // M13: Enforce file size limit
    if (blob.size > MAX_AUDIO_SIZE) {
      logger.warn("[Storage] Journal media upload rejected", {
        bucket: AUDIO_BUCKET,
        reason: "size",
        size: blob.size,
      });
      throw new Error("Audio recording too large. Maximum size is 20 MB.");
    }

    const normalizedMimeType = inspectedAudio.mimeType;
    const ext = extFromMime(normalizedMimeType);
    const path = operationRevision
      ? passwordRemovalStoragePath(expectedOwnerUserId, operationRevision, audioId, ext)
      : storagePath(expectedOwnerUserId, audioId, ext);

    const { error: uploadError } = await awaitJournalStorageRequest(
      supabase.storage.from(AUDIO_BUCKET).upload(path, blob, {
        contentType: normalizedMimeType,
        upsert: true,
      }),
      signal
    );
    throwIfJournalStorageAborted(signal);

    if (uploadError) {
      logger.warn("[Storage] Journal media upload failed", {
        bucket: AUDIO_BUCKET,
        stage: "provider",
      });
      return null;
    }

    return {
      path,
      signedUrl: "",
    };
  } catch {
    throwIfJournalStorageAborted(signal);
    logger.warn("[Storage] Journal media upload failed", {
      bucket: AUDIO_BUCKET,
      stage: "client",
    });
    return null;
  }
}

export async function uploadAudio(
  audioId: string,
  dataUrl: string,
  mimeType: string,
  expectedOwnerUserId: string,
  signal?: AbortSignal
): Promise<UploadResult | null> {
  return uploadAudioAtRemovalBoundary(
    audioId,
    dataUrl,
    mimeType,
    expectedOwnerUserId,
    signal
  );
}

export async function uploadAudioForPasswordRemoval(
  audioId: string,
  dataUrl: string,
  mimeType: string,
  expectedOwnerUserId: string,
  operationRevision: string,
  signal?: AbortSignal
): Promise<UploadResult | null> {
  const prepared = await prepareAudioForPasswordRemovalUpload(
    audioId,
    dataUrl,
    mimeType,
    expectedOwnerUserId,
    operationRevision,
    signal
  );
  return uploadPreparedJournalPasswordRemovalMedia(
    prepared,
    expectedOwnerUserId,
    operationRevision,
    signal
  );
}

export async function uploadEncryptedAudio(
  audioId: string,
  encryptedPayload: Blob,
  expectedOwnerUserId: string,
  vaultRevision: number,
  signal?: AbortSignal
): Promise<UploadResult | null> {
  if (!Number.isSafeInteger(vaultRevision) || vaultRevision < 0) {
    throw new Error("Encrypted diary audio requires an exact vault revision");
  }
  return uploadRawStorageBlob(
    AUDIO_BUCKET,
    audioId,
    encryptedPayload,
    expectedOwnerUserId,
    {
      contentType: ENCRYPTED_MEDIA_MIME,
      ext: `v${vaultRevision}.${ENCRYPTED_MEDIA_EXTENSION}`,
      maxSize: MAX_ENCRYPTED_AUDIO_SIZE,
      label: "Encrypted audio",
    },
    signal
  );
}

// ============================================
// DOWNLOAD
// ============================================

/**
 * Download a file from Storage and return as base64 data URL.
 * Used when syncing media to a new device.
 */
export async function downloadAsBase64(
  bucket: "journal-photos" | "journal-audio",
  path: string,
  expectedOwnerUserId: string,
  signal?: AbortSignal
): Promise<string | null> {
  if (!supabase) return null;
  throwIfJournalStorageAborted(signal);
  await assertExpectedOwnerCurrent(expectedOwnerUserId);
  if (!path.startsWith(`${expectedOwnerUserId}/`)) {
    throw new Error("Journal media path does not belong to the expected account");
  }

  try {
    // Supabase Storage exposes metadata without transferring the object. Reject
    // an oversized file before allocating its Blob and base64/FileReader copy.
    const storageBucket = supabase.storage.from(bucket);
    const infoRequest = storageBucket.info(path);
    const { data: fileInfo, error: infoError } = await awaitJournalStorageRequest(
      infoRequest,
      signal
    );
    throwIfJournalStorageAborted(signal);
    if (
      infoError ||
      !fileInfo ||
      !Number.isSafeInteger(fileInfo.size) ||
      Number(fileInfo.size) < 0 ||
      Number(fileInfo.size) > maximumJournalMediaDownloadBytes(bucket, path)
    ) {
      logger.warn("[Storage] Journal media metadata rejected", { bucket });
      return null;
    }
    const { data, error } = await awaitJournalStorageRequest(storageBucket.download(path), signal);
    throwIfJournalStorageAborted(signal);

    if (error || !data) {
      logger.warn("[Storage] Journal media download failed", { bucket });
      return null;
    }

    await assertExpectedOwnerCurrent(expectedOwnerUserId);
    if (!isAllowedDownloadedBlob(bucket, path, data)) return null;
    const dataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(data);
    });
    await assertExpectedOwnerCurrent(expectedOwnerUserId);
    throwIfJournalStorageAborted(signal);
    return dataUrl;
  } catch (err) {
    throwIfJournalStorageAborted(signal);
    if (err instanceof SyncOwnerBoundaryError) throw err;
    logger.warn("[Storage] Journal media download failed", { bucket, stage: "client" });
    return null;
  }
}

/**
 * Get a fresh signed URL for a storage path.
 * Useful when existing signed URL has expired.
 */
export async function getSignedUrl(
  bucket: "journal-photos" | "journal-audio",
  path: string,
  expectedOwnerUserId: string,
  expiresInSeconds = 60 * 10
): Promise<string | null> {
  if (!supabase) return null;
  await assertExpectedOwnerCurrent(expectedOwnerUserId);
  if (!path.startsWith(`${expectedOwnerUserId}/`)) {
    throw new Error("Journal media path does not belong to the expected account");
  }

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error) {
      logger.warn("[Storage] Journal media signed URL failed", { bucket, stage: "provider" });
      return null;
    }

    await assertExpectedOwnerCurrent(expectedOwnerUserId);
    return data.signedUrl;
  } catch (err) {
    if (err instanceof SyncOwnerBoundaryError) throw err;
    logger.warn("[Storage] Journal media signed URL failed", { bucket, stage: "client" });
    return null;
  }
}

// ============================================
// DELETE
// ============================================

export async function deleteJournalMediaStoragePath(
  bucket: "journal-photos" | "journal-audio",
  path: string,
  expectedOwnerUserId: string,
  signal?: AbortSignal
): Promise<void> {
  if (!supabase) return;
  throwIfJournalStorageAborted(signal);
  await assertExpectedOwnerCurrent(expectedOwnerUserId);
  if (!path.startsWith(`${expectedOwnerUserId}/`)) {
    throw new Error("Journal media path does not belong to the expected account");
  }

  try {
    const { error } = await awaitJournalStorageRequest(
      supabase.storage.from(bucket).remove([path]),
      signal
    );
    throwIfJournalStorageAborted(signal);
    if (error) throw error;
  } catch (err) {
    throwIfJournalStorageAborted(signal);
    logger.warn("[Storage] Journal media delete failed", { bucket });
    throw err;
  }
}

/**
 * Delete a photo from Supabase Storage.
 */
export async function deletePhotoFromStorage(
  photoId: string,
  expectedOwnerUserId: string
): Promise<void> {
  if (!supabase) return;
  await assertExpectedOwnerCurrent(expectedOwnerUserId);

  try {
    const exts = ["jpg", "png", "webp", "bin"];
    const paths = await resolveJournalMediaDeletePaths(
      PHOTO_BUCKET,
      photoId,
      expectedOwnerUserId,
      exts
    );
    const { error } = await supabase.storage.from(PHOTO_BUCKET).remove(paths);
    if (error) throw error;
  } catch (err) {
    logger.warn("[Storage] Journal media delete failed", { bucket: PHOTO_BUCKET });
    throw err;
  }
}

/**
 * Delete an audio file from Supabase Storage.
 */
export async function deleteAudioFromStorage(
  audioId: string,
  expectedOwnerUserId: string
): Promise<void> {
  if (!supabase) return;
  await assertExpectedOwnerCurrent(expectedOwnerUserId);

  try {
    const exts = ["webm", "mp4", "mp3", "ogg", "wav", "bin"];
    const paths = await resolveJournalMediaDeletePaths(
      AUDIO_BUCKET,
      audioId,
      expectedOwnerUserId,
      exts
    );
    const { error } = await supabase.storage.from(AUDIO_BUCKET).remove(paths);
    if (error) throw error;
  } catch (err) {
    logger.warn("[Storage] Journal media delete failed", { bucket: AUDIO_BUCKET });
    throw err;
  }
}

/**
 * Delete all media for a journal entry from Storage.
 */
export async function deleteEntryMediaFromStorage(
  photoIds: string[],
  audioIds: string[],
  expectedOwnerUserId: string
): Promise<void> {
  const tasks: Promise<void>[] = [];
  for (const id of photoIds) tasks.push(deletePhotoFromStorage(id, expectedOwnerUserId));
  for (const id of audioIds) tasks.push(deleteAudioFromStorage(id, expectedOwnerUserId));
  await Promise.allSettled(tasks);
}
