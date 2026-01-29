/**
 * Notification Sounds Configuration
 *
 * Provides different notification sound options for users.
 * Uses Android system sounds and custom channel configuration.
 */

import { LocalNotifications, Channel } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { logger } from './logger';

// ============================================
// TYPES
// ============================================

export type NotificationSoundType = 'default' | 'gentle' | 'chime' | 'silent';

export interface NotificationSoundOption {
  id: NotificationSoundType;
  labelKey: string;
  description: string;
  channelId: string;
  sound: string | undefined;
  vibrate: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const STORAGE_KEY = 'zenflow_notification_sound';

export const NOTIFICATION_SOUNDS: NotificationSoundOption[] = [
  {
    id: 'default',
    labelKey: 'soundDefault',
    description: 'System default notification sound',
    channelId: 'zenflow_default',
    sound: 'default',
    vibrate: true,
  },
  {
    id: 'gentle',
    labelKey: 'soundGentle',
    description: 'Soft vibration only',
    channelId: 'zenflow_gentle',
    sound: undefined, // No sound, only vibration
    vibrate: true,
  },
  {
    id: 'chime',
    labelKey: 'soundChime',
    description: 'Short notification tone',
    channelId: 'zenflow_chime',
    sound: 'default', // Uses system sound with lower importance
    vibrate: true,
  },
  {
    id: 'silent',
    labelKey: 'soundSilent',
    description: 'No sound or vibration',
    channelId: 'zenflow_silent',
    sound: undefined,
    vibrate: false,
  },
];

// ============================================
// STORAGE
// ============================================

/**
 * Get saved notification sound preference
 */
export function getNotificationSound(): NotificationSoundType {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && NOTIFICATION_SOUNDS.some(s => s.id === saved)) {
      return saved as NotificationSoundType;
    }
  } catch {
    // Ignore storage errors
  }
  return 'default';
}

/**
 * Save notification sound preference
 */
export function setNotificationSound(sound: NotificationSoundType): void {
  try {
    localStorage.setItem(STORAGE_KEY, sound);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Get the channel ID for current sound preference
 */
export function getCurrentChannelId(): string {
  const soundType = getNotificationSound();
  const sound = NOTIFICATION_SOUNDS.find(s => s.id === soundType);
  return sound?.channelId || 'zenflow_default';
}

// ============================================
// CHANNEL MANAGEMENT
// ============================================

/**
 * Initialize all notification channels for different sound options
 * Must be called once at app startup
 */
export async function initializeNotificationChannels(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // Create channel for each sound option
    for (const soundOption of NOTIFICATION_SOUNDS) {
      const channel: Channel = {
        id: soundOption.channelId,
        name: `ZenFlow - ${soundOption.id.charAt(0).toUpperCase() + soundOption.id.slice(1)}`,
        description: soundOption.description,
        importance: soundOption.id === 'silent' ? 2 : soundOption.id === 'gentle' ? 3 : 4,
        visibility: 1, // PUBLIC
        vibration: soundOption.vibrate,
        sound: soundOption.sound,
        lights: true,
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
