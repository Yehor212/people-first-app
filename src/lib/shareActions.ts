/**
 * Share Actions - Download, Share, Copy operations for share cards
 * Extracted from shareCards.ts and socialShare.ts
 */

import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { isNative } from '@/lib/platform';
import { logger } from '@/lib/logger';

// Cache cleanup constants
const CACHE_FILE_PREFIX = 'zenflow-share-';
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const DELETE_RETRY_DELAYS = [100, 500, 1000];

/**
 * Convert Blob to base64 string (without data URL prefix)
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Delete file with retry logic
 */
async function deleteFileWithRetry(
  fileName: string,
  options: { failClosed?: boolean } = {},
): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= DELETE_RETRY_DELAYS.length; attempt++) {
    try {
      await Filesystem.deleteFile({
        path: fileName,
        directory: Directory.Cache,
      });
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < DELETE_RETRY_DELAYS.length) {
        await new Promise(resolve => setTimeout(resolve, DELETE_RETRY_DELAYS[attempt]));
      }
    }
  }

  logger.warn('[ShareActions] Failed to delete file after retries:', fileName, lastError?.message);
  if (options.failClosed && lastError) {
    throw lastError;
  }
}

/**
 * Remove account-owned temporary artifacts before an account boundary.
 *
 * Unlike best-effort stale cleanup, this deliberately rejects when an owned
 * artifact cannot be removed so callers do not complete sign-out/account
 * switching while private export or share data remains in the native cache.
 */
export async function cleanupAllAccountCacheFiles(): Promise<void> {
  if (!isNative) return;

  const result = await Filesystem.readdir({
    path: '',
    directory: Directory.Cache,
  });

  const ownedFiles = result.files.filter(
    (file) =>
      file.name.startsWith(CACHE_FILE_PREFIX) ||
      file.name.startsWith('ZenFlow_Backup_'),
  );

  await Promise.all(
    ownedFiles.map((file) =>
      deleteFileWithRetry(file.name, { failClosed: true }),
    ),
  );
}

/**
 * Clean up stale cache files on app resume
 */
export async function cleanupShareCache(): Promise<void> {
  if (!isNative) return;

  try {
    const result = await Filesystem.readdir({
      path: '',
      directory: Directory.Cache,
    });

    const now = Date.now();
    let cleanedCount = 0;

    for (const file of result.files) {
      if (file.name.startsWith(CACHE_FILE_PREFIX)) {
        const match = file.name.match(/zenflow-share-(\d+)\.png/);
        if (match) {
          const fileTime = parseInt(match[1], 10);
          if (now - fileTime > CACHE_MAX_AGE_MS) {
            await deleteFileWithRetry(file.name);
            cleanedCount++;
          }
        }
      }
    }

    if (cleanedCount > 0) {
      logger.log(`[ShareActions] Cleaned up ${cleanedCount} stale cache files`);
    }
  } catch (error) {
    logger.warn('[ShareActions] Cache cleanup failed:', error);
  }
}

/**
 * Download the generated image to user's device
 */
export function downloadImage(blob: Blob, filename: string = 'zenflow-share.png'): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Share image using native (Capacitor) or Web Share API
 * Returns true if shared successfully, false if fell back to download
 */
export async function shareImage(
  blob: Blob,
  title: string,
  text?: string
): Promise<boolean> {
  if (isNative) {
    try {
      const base64Data = await blobToBase64(blob);
      const fileName = `${CACHE_FILE_PREFIX}${Date.now()}.png`;
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
      });

      await Share.share({
        title,
        text: text || title,
        files: [savedFile.uri],
        dialogTitle: title,
      });

      // Don't delete file immediately — receiving app may still be reading it.
      // Cleanup handled by cleanupShareCache() on app resume (24h TTL).
      return true;
    } catch (err) {
      // User cancellation is not an error (Capacitor throws on cancel/dismiss)
      const msg = (err as Error)?.message?.toLowerCase() || '';
      if (msg.includes('cancel') || msg.includes('dismiss') || msg.includes('user')) {
        return false;
      }
      logger.error('[ShareActions] Native share failed:', err);
      return false;
    }
  }

  // Web: check Web Share API with files support
  if (navigator.share && navigator.canShare) {
    const file = new File([blob], 'zenflow-share.png', { type: 'image/png' });
    const shareData = { files: [file], title, text };

    if (navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return true;
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          logger.error('[ShareActions] Web share failed:', err);
        }
        return false;
      }
    }
  }

  // Fallback: download
  downloadImage(blob, 'zenflow-share.png');
  return false;
}

/**
 * Copy image to clipboard
 */
export async function copyImageToClipboard(blob: Blob): Promise<boolean> {
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob })
    ]);
    return true;
  } catch (err) {
    logger.error('[ShareActions] Failed to copy image:', err);
    return false;
  }
}
