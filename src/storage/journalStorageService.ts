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

async function assertExpectedOwnerCurrent(expectedOwnerUserId: string): Promise<void> {
  await validateSyncOwner(expectedOwnerUserId, "Journal media storage");
}

function isAllowedDownloadedBlob(
  bucket: typeof PHOTO_BUCKET | typeof AUDIO_BUCKET,
  path: string,
  blob: Blob,
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
    logger.warn(`[Storage] Download rejected (${bucket}/${path}): file too large`, blob.size);
    return false;
  }

  const hasAllowedMime = isEncrypted
    ? blob.type === ENCRYPTED_MEDIA_MIME
    : bucket === PHOTO_BUCKET
      ? ALLOWED_IMAGE_MIMES.includes(blob.type)
      : normalizeJournalAudioMimeType(blob.type) !== null;
  if (!hasAllowedMime) {
    logger.warn(`[Storage] Download rejected (${bucket}/${path}): disallowed MIME type`, blob.type);
    return false;
  }
  return true;
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
): Promise<UploadResult | null> {
  if (!supabase) return null;
  await assertExpectedOwnerCurrent(expectedOwnerUserId);

  try {
    if (blob.size > options.maxSize) {
      logger.warn("[Storage] " + options.label + " upload rejected: file too large", blob.size);
      throw new Error(options.label + " too large.");
    }

    const path = storagePath(expectedOwnerUserId, fileId, options.ext);
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, blob, {
      contentType: options.contentType,
      upsert: true,
    });

    if (uploadError) {
      logger.warn("[Storage] " + options.label + " upload failed:", uploadError.message);
      return null;
    }

    return { path, signedUrl: "" };
  } catch (err) {
    logger.warn("[Storage] " + options.label + " upload error:", err);
    return null;
  }
}


export interface UploadResult {
  path: string;
  signedUrl: string;
}

/**
 * Upload a photo (base64 data URL) to Supabase Storage.
 * Returns the storage path only; signed URLs are minted on demand.
 */
export async function uploadPhoto(
  photoId: string,
  dataUrl: string,
  expectedOwnerUserId: string,
): Promise<UploadResult | null> {
  if (!supabase) return null;
  await assertExpectedOwnerCurrent(expectedOwnerUserId);

  try {
    const blob = base64ToBlob(dataUrl);

    // M12: Validate MIME type against allowlist
    if (!ALLOWED_IMAGE_MIMES.includes(blob.type)) {
      logger.warn("[Storage] Photo upload rejected: disallowed MIME type", blob.type);
      throw new Error(`Unsupported image type "${blob.type}". Allowed: JPEG, PNG, WebP.`);
    }

    // M12: Enforce file size limit
    if (blob.size > MAX_PHOTO_SIZE) {
      logger.warn("[Storage] Photo upload rejected: file too large", blob.size);
      throw new Error("Photo too large. Maximum size is 1 MB.");
    }

    const ext = extFromMime(blob.type);
    const path = storagePath(expectedOwnerUserId, photoId, ext);

    const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
      contentType: blob.type,
      upsert: true,
    });

    if (uploadError) {
      logger.warn("[Storage] Photo upload failed:", uploadError.message);
      return null;
    }

    return {
      path,
      signedUrl: "",
    };
  } catch (err) {
    logger.warn("[Storage] Photo upload error:", err);
    return null;
  }
}

export async function uploadEncryptedPhoto(
  photoId: string,
  encryptedPayload: Blob,
  expectedOwnerUserId: string,
): Promise<UploadResult | null> {
  return uploadRawStorageBlob(PHOTO_BUCKET, photoId, encryptedPayload, expectedOwnerUserId, {
    contentType: ENCRYPTED_MEDIA_MIME,
    ext: ENCRYPTED_MEDIA_EXTENSION,
    maxSize: MAX_ENCRYPTED_PHOTO_SIZE,
    label: "Encrypted photo",
  });
}

/**
 * Upload an audio recording (base64 data URL) to Supabase Storage.
 */
export async function uploadAudio(
  audioId: string,
  dataUrl: string,
  mimeType: string,
  expectedOwnerUserId: string,
): Promise<UploadResult | null> {
  if (!supabase) return null;
  await assertExpectedOwnerCurrent(expectedOwnerUserId);

  try {
    // M13: Validate MIME type against allowlist
    const inspectedAudio = inspectJournalAudioDataUrl(dataUrl, mimeType);
    if (!inspectedAudio) {
      logger.warn("[Storage] Audio upload rejected: disallowed MIME type", mimeType);
      throw new Error(`Unsupported audio type "${mimeType}". Allowed: WebM, MP4, OGG, WAV.`);
    }

    const blob = base64ToBlob(dataUrl);

    // M13: Enforce file size limit
    if (blob.size > MAX_AUDIO_SIZE) {
      logger.warn("[Storage] Audio upload rejected: file too large", blob.size);
      throw new Error("Audio recording too large. Maximum size is 20 MB.");
    }

    const normalizedMimeType = inspectedAudio.mimeType;
    const ext = extFromMime(normalizedMimeType);
    const path = storagePath(expectedOwnerUserId, audioId, ext);

    const { error: uploadError } = await supabase.storage.from(AUDIO_BUCKET).upload(path, blob, {
      contentType: normalizedMimeType,
      upsert: true,
    });

    if (uploadError) {
      logger.warn("[Storage] Audio upload failed:", uploadError.message);
      return null;
    }

    return {
      path,
      signedUrl: "",
    };
  } catch (err) {
    logger.warn("[Storage] Audio upload error:", err);
    return null;
  }
}

export async function uploadEncryptedAudio(
  audioId: string,
  encryptedPayload: Blob,
  expectedOwnerUserId: string,
): Promise<UploadResult | null> {
  return uploadRawStorageBlob(AUDIO_BUCKET, audioId, encryptedPayload, expectedOwnerUserId, {
    contentType: ENCRYPTED_MEDIA_MIME,
    ext: ENCRYPTED_MEDIA_EXTENSION,
    maxSize: MAX_ENCRYPTED_AUDIO_SIZE,
    label: "Encrypted audio",
  });
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
): Promise<string | null> {
  if (!supabase) return null;
  await assertExpectedOwnerCurrent(expectedOwnerUserId);
  if (!path.startsWith(`${expectedOwnerUserId}/`)) {
    throw new Error("Journal media path does not belong to the expected account");
  }

  try {
    const { data, error } = await supabase.storage.from(bucket).download(path);

    if (error || !data) {
      logger.warn(`[Storage] Download failed (${bucket}/${path}):`, error?.message);
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
    return dataUrl;
  } catch (err) {
    if (err instanceof SyncOwnerBoundaryError) throw err;
    logger.warn("[Storage] Download error:", err);
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
      logger.warn(`[Storage] Signed URL failed (${bucket}/${path}):`, error.message);
      return null;
    }

    await assertExpectedOwnerCurrent(expectedOwnerUserId);
    return data.signedUrl;
  } catch (err) {
    if (err instanceof SyncOwnerBoundaryError) throw err;
    logger.warn("[Storage] getSignedUrl error:", err);
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
): Promise<void> {
  if (!supabase) return;
  await assertExpectedOwnerCurrent(expectedOwnerUserId);
  if (!path.startsWith(`${expectedOwnerUserId}/`)) {
    throw new Error("Journal media path does not belong to the expected account");
  }

  try {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) throw error;
  } catch (err) {
    logger.warn("[Storage] Journal media path delete error:", err);
    throw err;
  }
}

/**
 * Delete a photo from Supabase Storage.
 */
export async function deletePhotoFromStorage(
  photoId: string,
  expectedOwnerUserId: string,
): Promise<void> {
  if (!supabase) return;
  await assertExpectedOwnerCurrent(expectedOwnerUserId);

  try {
    // Try common extensions since we may not know the exact one
    const exts = ["jpg", "png", "webp", "bin"];
    const paths = exts.map((ext) => storagePath(expectedOwnerUserId, photoId, ext));
    const { error } = await supabase.storage.from(PHOTO_BUCKET).remove(paths);
    if (error) throw error;
  } catch (err) {
    logger.warn("[Storage] Photo delete error:", err);
    throw err;
  }
}

/**
 * Delete an audio file from Supabase Storage.
 */
export async function deleteAudioFromStorage(
  audioId: string,
  expectedOwnerUserId: string,
): Promise<void> {
  if (!supabase) return;
  await assertExpectedOwnerCurrent(expectedOwnerUserId);

  try {
    const exts = ["webm", "mp4", "mp3", "ogg", "wav", "bin"];
    const paths = exts.map((ext) => storagePath(expectedOwnerUserId, audioId, ext));
    const { error } = await supabase.storage.from(AUDIO_BUCKET).remove(paths);
    if (error) throw error;
  } catch (err) {
    logger.warn("[Storage] Audio delete error:", err);
    throw err;
  }
}

/**
 * Delete all media for a journal entry from Storage.
 */
export async function deleteEntryMediaFromStorage(
  photoIds: string[],
  audioIds: string[],
  expectedOwnerUserId: string,
): Promise<void> {
  const tasks: Promise<void>[] = [];
  for (const id of photoIds) tasks.push(deletePhotoFromStorage(id, expectedOwnerUserId));
  for (const id of audioIds) tasks.push(deleteAudioFromStorage(id, expectedOwnerUserId));
  await Promise.allSettled(tasks);
}
