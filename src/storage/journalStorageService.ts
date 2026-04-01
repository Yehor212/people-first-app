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

import { supabase, getCurrentUserId } from "@/lib/supabaseClient";
import { logger } from "@/lib/logger";

const PHOTO_BUCKET = "journal-photos";
const AUDIO_BUCKET = "journal-audio";

/** Allowed image MIME types for photo uploads */
const ALLOWED_IMAGE_MIMES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

/** Allowed audio MIME types for audio uploads */
const ALLOWED_AUDIO_MIMES: readonly string[] = [
  "audio/webm",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
];

/** Maximum photo file size: 10 MB */
const MAX_PHOTO_SIZE = 10 * 1024 * 1024;

/** Maximum audio file size: 25 MB */
const MAX_AUDIO_SIZE = 25 * 1024 * 1024;

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

// ============================================
// UPLOAD
// ============================================

export interface UploadResult {
  path: string;
  signedUrl: string;
}

/**
 * Upload a photo (base64 data URL) to Supabase Storage.
 * Returns the storage path and a signed URL (1 year expiry).
 */
export async function uploadPhoto(photoId: string, dataUrl: string): Promise<UploadResult | null> {
  if (!supabase) return null;
  const userId = await getCurrentUserId();
  if (!userId) return null;

  try {
    const blob = base64ToBlob(dataUrl);

    // M12: Validate MIME type against allowlist
    if (!ALLOWED_IMAGE_MIMES.includes(blob.type)) {
      logger.warn("[Storage] Photo upload rejected: disallowed MIME type", blob.type);
      throw new Error(
        `Unsupported image type "${blob.type}". Allowed: JPEG, PNG, WebP, HEIC, HEIF.`
      );
    }

    // M12: Enforce file size limit
    if (blob.size > MAX_PHOTO_SIZE) {
      logger.warn("[Storage] Photo upload rejected: file too large", blob.size);
      throw new Error("Photo too large. Maximum size is 10 MB.");
    }

    const ext = extFromMime(blob.type);
    const path = storagePath(userId, photoId, ext);

    const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
      contentType: blob.type,
      upsert: true,
    });

    if (uploadError) {
      logger.warn("[Storage] Photo upload failed:", uploadError.message);
      return null;
    }

    const { data: urlData } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 year

    return {
      path,
      signedUrl: urlData?.signedUrl ?? "",
    };
  } catch (err) {
    logger.warn("[Storage] Photo upload error:", err);
    return null;
  }
}

/**
 * Upload an audio recording (base64 data URL) to Supabase Storage.
 */
export async function uploadAudio(
  audioId: string,
  dataUrl: string,
  mimeType: string
): Promise<UploadResult | null> {
  if (!supabase) return null;
  const userId = await getCurrentUserId();
  if (!userId) return null;

  try {
    // M13: Validate MIME type against allowlist
    if (!ALLOWED_AUDIO_MIMES.includes(mimeType)) {
      logger.warn("[Storage] Audio upload rejected: disallowed MIME type", mimeType);
      throw new Error(`Unsupported audio type "${mimeType}". Allowed: WebM, MP4, OGG, WAV.`);
    }

    const blob = base64ToBlob(dataUrl);

    // M13: Enforce file size limit
    if (blob.size > MAX_AUDIO_SIZE) {
      logger.warn("[Storage] Audio upload rejected: file too large", blob.size);
      throw new Error("Audio recording too large. Maximum size is 25 MB.");
    }

    const ext = extFromMime(mimeType);
    const path = storagePath(userId, audioId, ext);

    const { error: uploadError } = await supabase.storage.from(AUDIO_BUCKET).upload(path, blob, {
      contentType: mimeType,
      upsert: true,
    });

    if (uploadError) {
      logger.warn("[Storage] Audio upload failed:", uploadError.message);
      return null;
    }

    const { data: urlData } = await supabase.storage
      .from(AUDIO_BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 365);

    return {
      path,
      signedUrl: urlData?.signedUrl ?? "",
    };
  } catch (err) {
    logger.warn("[Storage] Audio upload error:", err);
    return null;
  }
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
  path: string
): Promise<string | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.storage.from(bucket).download(path);

    if (error || !data) {
      logger.warn(`[Storage] Download failed (${bucket}/${path}):`, error?.message);
      return null;
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(data);
    });
  } catch (err) {
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
  expiresInSeconds = 60 * 60 * 24 * 365
): Promise<string | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error) {
      logger.warn(`[Storage] Signed URL failed (${bucket}/${path}):`, error.message);
      return null;
    }

    return data.signedUrl;
  } catch (err) {
    logger.warn("[Storage] getSignedUrl error:", err);
    return null;
  }
}

// ============================================
// DELETE
// ============================================

/**
 * Delete a photo from Supabase Storage.
 */
export async function deletePhotoFromStorage(photoId: string): Promise<void> {
  if (!supabase) return;
  const userId = await getCurrentUserId();
  if (!userId) return;

  try {
    // Try common extensions since we may not know the exact one
    const exts = ["jpg", "png", "webp"];
    const paths = exts.map((ext) => storagePath(userId, photoId, ext));
    await supabase.storage.from(PHOTO_BUCKET).remove(paths);
  } catch (err) {
    logger.warn("[Storage] Photo delete error:", err);
  }
}

/**
 * Delete an audio file from Supabase Storage.
 */
export async function deleteAudioFromStorage(audioId: string): Promise<void> {
  if (!supabase) return;
  const userId = await getCurrentUserId();
  if (!userId) return;

  try {
    const exts = ["webm", "mp4", "mp3", "ogg"];
    const paths = exts.map((ext) => storagePath(userId, audioId, ext));
    await supabase.storage.from(AUDIO_BUCKET).remove(paths);
  } catch (err) {
    logger.warn("[Storage] Audio delete error:", err);
  }
}

/**
 * Delete all media for a journal entry from Storage.
 */
export async function deleteEntryMediaFromStorage(
  photoIds: string[],
  audioIds: string[]
): Promise<void> {
  const tasks: Promise<void>[] = [];
  for (const id of photoIds) tasks.push(deletePhotoFromStorage(id));
  for (const id of audioIds) tasks.push(deleteAudioFromStorage(id));
  await Promise.allSettled(tasks);
}
