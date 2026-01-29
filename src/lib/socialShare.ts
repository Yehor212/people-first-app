/**
 * Social Share Service
 * Part of v1.3.0 "Harmony" - Enhanced Social Features
 *
 * Provides platform-optimized sharing for:
 * - Instagram Stories (9:16 format)
 * - WhatsApp (with text + image)
 * - Generic (Web Share API / Capacitor)
 */

import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { logger } from './logger';

// ============================================
// TYPES
// ============================================

export type SharePlatform = 'instagram' | 'whatsapp' | 'twitter' | 'generic';

export interface ShareContent {
  title: string;
  text: string;
  imageBlob?: Blob;
  url?: string;
}

export interface ShareResult {
  success: boolean;
  platform: SharePlatform;
  error?: string;
}

// ============================================
// PLATFORM DETECTION
// ============================================

/**
 * Check if Instagram is available for sharing
 */
export function isInstagramAvailable(): boolean {
  // Instagram Stories sharing only works on mobile
  return Capacitor.isNativePlatform();
}

/**
 * Check if WhatsApp is likely available
 */
export function isWhatsAppAvailable(): boolean {
  // WhatsApp sharing works via URL scheme on mobile
  // and might work on desktop if WhatsApp is installed
  return true;
}

/**
 * Get available sharing platforms
 */
export function getAvailablePlatforms(): SharePlatform[] {
  const platforms: SharePlatform[] = ['generic'];

  if (isInstagramAvailable()) {
    platforms.unshift('instagram');
  }

  if (isWhatsAppAvailable()) {
    platforms.push('whatsapp');
  }

  return platforms;
}

// ============================================
// SHARE FUNCTIONS
// ============================================

/**
 * Share to Instagram Stories
 * Requires native platform (iOS/Android)
 */
export async function shareToInstagram(content: ShareContent): Promise<ShareResult> {
  if (!Capacitor.isNativePlatform()) {
    return {
      success: false,
      platform: 'instagram',
      error: 'Instagram Stories sharing only available on mobile',
    };
  }

  if (!content.imageBlob) {
    return {
      success: false,
      platform: 'instagram',
      error: 'Image required for Instagram Stories',
    };
  }

  try {
    // Convert blob to base64
    const base64Data = await blobToBase64(content.imageBlob);

    // Save image to cache
    const fileName = `zenflow-story-${Date.now()}.png`;
    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Cache,
    });

    logger.log('[SocialShare] Saved story image:', savedFile.uri);

    // Share with Instagram intent
    // Note: This uses the general share dialog, user needs to select Instagram
    await Share.share({
      title: content.title,
      text: content.text,
      files: [savedFile.uri],
      dialogTitle: 'Share to Instagram Stories',
    });

    // Cleanup
    try {
      await Filesystem.deleteFile({
        path: fileName,
        directory: Directory.Cache,
      });
    } catch (cleanupError) {
      logger.warn('[SocialShare] Cleanup failed (non-critical):', cleanupError);
    }

    return { success: true, platform: 'instagram' };
  } catch (error) {
    logger.error('[SocialShare] Instagram share failed:', error);
    return {
      success: false,
      platform: 'instagram',
      error: error instanceof Error ? error.message : 'Share failed',
    };
  }
}

/**
 * Share to WhatsApp with image and text
 */
export async function shareToWhatsApp(content: ShareContent): Promise<ShareResult> {
  try {
    // Build WhatsApp text
    const shareText = [
      content.title,
      content.text,
      content.url || 'https://yehor212.github.io/people-first-app/',
    ]
      .filter(Boolean)
      .join('\n\n');

    if (Capacitor.isNativePlatform() && content.imageBlob) {
      // Native with image
      const base64Data = await blobToBase64(content.imageBlob);
      const fileName = `zenflow-share-${Date.now()}.png`;

      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
      });

      // Use native share
      await Share.share({
        title: content.title,
        text: shareText,
        files: [savedFile.uri],
        dialogTitle: 'Share via WhatsApp',
      });

      // Cleanup
      try {
        await Filesystem.deleteFile({
          path: fileName,
          directory: Directory.Cache,
        });
      } catch (cleanupError) {
        logger.warn('[SocialShare] Cleanup failed (non-critical):', cleanupError);
      }
    } else {
      // Web - use WhatsApp URL scheme (text only)
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
      window.open(whatsappUrl, '_blank');
    }

    return { success: true, platform: 'whatsapp' };
  } catch (error) {
    logger.error('[SocialShare] WhatsApp share failed:', error);
    return {
      success: false,
      platform: 'whatsapp',
      error: error instanceof Error ? error.message : 'Share failed',
    };
  }
}

/**
 * Share to Twitter/X
 */
export async function shareToTwitter(content: ShareContent): Promise<ShareResult> {
  try {
    const tweetText = [content.title, content.text]
      .filter(Boolean)
      .join(' - ')
      .slice(0, 240); // Leave room for URL

    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(content.url || 'https://yehor212.github.io/people-first-app/')}`;

    window.open(twitterUrl, '_blank');

    return { success: true, platform: 'twitter' };
  } catch (error) {
    logger.error('[SocialShare] Twitter share failed:', error);
    return {
      success: false,
      platform: 'twitter',
      error: error instanceof Error ? error.message : 'Share failed',
    };
  }
}

/**
 * Generic share using Web Share API or Capacitor Share
 */
export async function shareGeneric(content: ShareContent): Promise<ShareResult> {
  try {
    if (Capacitor.isNativePlatform()) {
      // Native sharing
      const shareData: {
        title: string;
        text: string;
        url?: string;
        files?: string[];
        dialogTitle: string;
      } = {
        title: content.title,
        text: content.text,
        url: content.url,
        dialogTitle: content.title,
      };

      if (content.imageBlob) {
        const base64Data = await blobToBase64(content.imageBlob);
        const fileName = `zenflow-share-${Date.now()}.png`;

        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
        });

        shareData.files = [savedFile.uri];
      }

      await Share.share(shareData);

      return { success: true, platform: 'generic' };
    }

    // Web Share API
    if (navigator.share) {
      const shareData: ShareData = {
        title: content.title,
        text: content.text,
        url: content.url,
      };

      // Add file if supported
      if (content.imageBlob && navigator.canShare) {
        const file = new File([content.imageBlob], 'zenflow-share.png', {
          type: 'image/png',
        });
        const dataWithFile = { ...shareData, files: [file] };

        if (navigator.canShare(dataWithFile)) {
          await navigator.share(dataWithFile);
          return { success: true, platform: 'generic' };
        }
      }

      await navigator.share(shareData);
      return { success: true, platform: 'generic' };
    }

    // Fallback: copy to clipboard
    const shareText = [content.title, content.text, content.url]
      .filter(Boolean)
      .join('\n');
    await navigator.clipboard.writeText(shareText);

    return {
      success: true,
      platform: 'generic',
      error: 'Copied to clipboard (sharing not supported)',
    };
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      // User cancelled - not an error
      return { success: false, platform: 'generic', error: 'User cancelled' };
    }

    logger.error('[SocialShare] Generic share failed:', error);
    return {
      success: false,
      platform: 'generic',
      error: error instanceof Error ? error.message : 'Share failed',
    };
  }
}

/**
 * Share to a specific platform
 */
export async function shareTo(
  platform: SharePlatform,
  content: ShareContent
): Promise<ShareResult> {
  switch (platform) {
    case 'instagram':
      return shareToInstagram(content);
    case 'whatsapp':
      return shareToWhatsApp(content);
    case 'twitter':
      return shareToTwitter(content);
    case 'generic':
    default:
      return shareGeneric(content);
  }
}

// ============================================
// HELPERS
// ============================================

/**
 * Convert Blob to base64 string (without data URL prefix)
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove data URL prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Get platform display info
 */
export function getPlatformInfo(platform: SharePlatform): {
  name: string;
  icon: string;
  color: string;
} {
  const info: Record<SharePlatform, { name: string; icon: string; color: string }> = {
    instagram: {
      name: 'Instagram',
      icon: '📸',
      color: '#E4405F',
    },
    whatsapp: {
      name: 'WhatsApp',
      icon: '💬',
      color: '#25D366',
    },
    twitter: {
      name: 'Twitter/X',
      icon: '𝕏',
      color: '#000000',
    },
    generic: {
      name: 'Share',
      icon: '📤',
      color: '#6B7280',
    },
  };

  return info[platform];
}

export default {
  isInstagramAvailable,
  isWhatsAppAvailable,
  getAvailablePlatforms,
  shareToInstagram,
  shareToWhatsApp,
  shareToTwitter,
  shareGeneric,
  shareTo,
  getPlatformInfo,
};
