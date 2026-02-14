/**
 * Share Actions - Download, Share, Copy operations for share cards
 * Extracted from shareCards.ts and socialShare.ts
 */

import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
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
async function deleteFileWithRetry(fileName: string): Promise<void> {
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
}

/**
 * Clean up stale cache files on app resume
 */
export async function cleanupShareCache(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

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
  if (Capacitor.isNativePlatform()) {
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

      await deleteFileWithRetry(fileName);
      return true;
    } catch (err) {
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
