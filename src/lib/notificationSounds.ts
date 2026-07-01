/**
 * Notification Sounds Configuration
 *
 * Provides different notification sound options for users.
 * Uses Android system sounds and custom channel configuration.
 */

import { LocalNotifications, type Channel } from '@capacitor/local-notifications';
import { isDesktopViewport, isNative, platform } from '@/lib/platform';
import { logger } from './logger';
import { storageGetRaw, storageSetRaw } from './safeJson';
import { SK } from '@/lib/storageKeys';

// ============================================
// TYPES
// ============================================

export type NotificationSoundType = 'default' | 'gentle' | 'chime' | 'silent';
export type NotificationSoundImportance = 1 | 2 | 3;
export type NotificationSystemSurface = 'android' | 'ios' | 'web' | 'desktop';

export interface NotificationSystemRuntime {
  isNativeRuntime: boolean;
  platformName: 'android' | 'ios' | 'web';
  isDesktopViewportRuntime: boolean;
}

export interface NotificationSoundOption {
  id: NotificationSoundType;
  labelKey: string;
  description: string;
  channelId: string;
  sound: string | undefined;
  vibrate: boolean;
  importance: NotificationSoundImportance;
}

// ============================================
// CONSTANTS
// ============================================

export const NOTIFICATION_SOUND_CHANNEL_VERSION = 'v2';

export const NOTIFICATION_SYSTEM_SETTINGS_DESCRIPTION_KEYS: Record<
  NotificationSystemSurface,
  string
> = {
  android: 'notificationSystemSettingsAndroidDescription',
  ios: 'notificationSystemSettingsIosDescription',
  web: 'notificationSystemSettingsWebDescription',
  desktop: 'notificationSystemSettingsDesktopDescription',
};

export const NOTIFICATION_SOUNDS: NotificationSoundOption[] = [
  {
    id: 'default',
    labelKey: 'soundDefault',
    description: 'System default notification sound',
    channelId: 'zenflow_default_v2',
    sound: 'default',
    vibrate: true,
    importance: 3,
  },
  {
    id: 'gentle',
    labelKey: 'soundGentle',
    description: 'Soft vibration only',
    channelId: 'zenflow_gentle_v2',
    sound: undefined,
    vibrate: true,
    importance: 2,
  },
  {
    id: 'chime',
    labelKey: 'soundChime',
    description: 'Short notification tone',
    channelId: 'zenflow_chime_v2',
    sound: 'default',
    vibrate: true,
    importance: 3,
  },
  {
    id: 'silent',
    labelKey: 'soundSilent',
    description: 'No sound or vibration',
    channelId: 'zenflow_silent_v2',
    sound: undefined,
    vibrate: false,
    importance: 1,
  },
];

// ============================================
// PLATFORM GUIDANCE
// ============================================

function getDefaultNotificationSystemRuntime(): NotificationSystemRuntime {
  return {
    isNativeRuntime: isNative,
    platformName: platform,
    isDesktopViewportRuntime: isDesktopViewport,
  };
}

export function getNotificationSystemSurface(
  runtime: NotificationSystemRuntime = getDefaultNotificationSystemRuntime()
): NotificationSystemSurface {
  if (runtime.isNativeRuntime && runtime.platformName === 'android') return 'android';
  if (runtime.isNativeRuntime && runtime.platformName === 'ios') return 'ios';
  return runtime.isDesktopViewportRuntime ? 'desktop' : 'web';
}

export function getNotificationSystemSettingsCopyKey(
  runtime?: Partial<NotificationSystemRuntime>
): string {
  const defaults = getDefaultNotificationSystemRuntime();
  const normalizedRuntime: NotificationSystemRuntime = {
    isNativeRuntime: runtime?.isNativeRuntime ?? defaults.isNativeRuntime,
    platformName: runtime?.platformName ?? defaults.platformName,
    isDesktopViewportRuntime:
      runtime?.isDesktopViewportRuntime ?? defaults.isDesktopViewportRuntime,
  };
  const surface = getNotificationSystemSurface(normalizedRuntime);
  return NOTIFICATION_SYSTEM_SETTINGS_DESCRIPTION_KEYS[surface];
}

// ============================================
// STORAGE
// ============================================

/**
 * Get saved notification sound preference
 */
export function getNotificationSound(): NotificationSoundType {
  const saved = storageGetRaw(SK.NOTIFICATION_SOUND);
  if (saved && NOTIFICATION_SOUNDS.some(s => s.id === saved)) {
    return saved as NotificationSoundType;
  }
  return 'default';
}

/**
 * Save notification sound preference
 */
export function setNotificationSound(sound: NotificationSoundType): void {
  storageSetRaw(SK.NOTIFICATION_SOUND, sound);
}

/**
 * Get the channel ID for current sound preference
 */
export function getCurrentChannelId(): string {
  const soundType = getNotificationSound();
  const sound = NOTIFICATION_SOUNDS.find(s => s.id === soundType);
  return sound?.channelId || 'zenflow_default_v2';
}

// ============================================
// CHANNEL MANAGEMENT
// ============================================

/**
 * Initialize all notification channels for different sound options.
 * Android channel sound/importance are immutable after first creation, so
 * behavior changes must use a versioned channel ID.
 */
export async function initializeNotificationChannels(): Promise<void> {
  if (!isNative) return;

  try {
    for (const soundOption of NOTIFICATION_SOUNDS) {
      const channel: Channel = {
        id: soundOption.channelId,
        name: 'ZenFlow - ' + soundOption.id.charAt(0).toUpperCase() + soundOption.id.slice(1),
        description: soundOption.description,
        importance: soundOption.importance,
        visibility: 1, // PUBLIC
        vibration: soundOption.vibrate,
        sound: soundOption.sound,
        lights: soundOption.importance >= 3,
        lightColor: '#10B981',
      };

      await LocalNotifications.createChannel(channel);
      logger.log('[NotificationSounds] Channel created:', soundOption.channelId);
    }
  } catch (error) {
    logger.error('[NotificationSounds] Failed to create channels:', error);
  }
}

/**
 * Get current sound option details
 */
export function getCurrentSoundOption(): NotificationSoundOption {
  const soundType = getNotificationSound();
  return NOTIFICATION_SOUNDS.find(s => s.id === soundType) || NOTIFICATION_SOUNDS[0];
}

/**
 * Update notification sound and return new channel ID
 */
export async function updateNotificationSound(sound: NotificationSoundType): Promise<string> {
  setNotificationSound(sound);
  logger.log('[NotificationSounds] Sound preference updated:', sound);
  return getCurrentChannelId();
}
