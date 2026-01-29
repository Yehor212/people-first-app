/**
 * Quick Actions - Lock Screen Widget-like Notifications
 *
 * Provides persistent notification with quick action buttons:
 * - Log Mood (one-tap)
 * - Start Focus Timer
 * - Check Habits
 *
 * The notification stays visible on lock screen for easy access.
 */

import { LocalNotifications, ActionPerformed } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { logger } from './logger';

// ============================================
// CONSTANTS
// ============================================

const QUICK_ACTIONS_CHANNEL_ID = 'zenflow_quick_actions';
const QUICK_ACTIONS_NOTIFICATION_ID = 8888;
const QUICK_ACTIONS_TYPE_ID = 'zenflow_quick_actions';

// Action IDs
export const QUICK_ACTION_IDS = {
  LOG_MOOD: 'quick_log_mood',
  START_FOCUS: 'quick_start_focus',
  VIEW_HABITS: 'quick_view_habits',
  DISMISS: 'quick_dismiss',
} as const;

type QuickActionId = typeof QUICK_ACTION_IDS[keyof typeof QUICK_ACTION_IDS];

// ============================================
// STATE
// ============================================

let quickActionCallback: ((actionId: QuickActionId) => void) | null = null;
let isQuickActionsEnabled = false;

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize the quick actions notification channel
 */
export async function initializeQuickActionsChannel(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await LocalNotifications.createChannel({
      id: QUICK_ACTIONS_CHANNEL_ID,
      name: 'ZenFlow Quick Actions',
      description: 'Quick access to mood, focus, and habits from lock screen',
      importance: 2, // LOW - silent, but visible
      visibility: 1, // PUBLIC - shown on lock screen
      vibration: false,
      sound: undefined, // No sound
      lights: false,
    });

    logger.log('[QuickActions] Channel created');
  } catch (error) {
    logger.error('[QuickActions] Failed to create channel:', error);
  }
}

/**
 * Register quick action types with the notification system
 */
export async function registerQuickActionTypes(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: QUICK_ACTIONS_TYPE_ID,
          actions: [
            {
              id: QUICK_ACTION_IDS.LOG_MOOD,
              title: '😊 Mood',
              foreground: true, // Opens app
            },
            {
              id: QUICK_ACTION_IDS.START_FOCUS,
              title: '🎯 Focus',
              foreground: true,
            },
            {
              id: QUICK_ACTION_IDS.VIEW_HABITS,
              title: '✅ Habits',
              foreground: true,
            },
          ],
        },
      ],
    });

    logger.log('[QuickActions] Action types registered');
  } catch (error) {
    logger.error('[QuickActions] Failed to register action types:', error);
  }
}

/**
 * Set up listener for quick action taps
 */
export async function setupQuickActionsListener(): Promise<() => void> {
  const listener = await LocalNotifications.addListener(
    'localNotificationActionPerformed',
    (action: ActionPerformed) => {
      const actionId = action.actionId as QuickActionId;

      // Check if this is a quick action
      if (Object.values(QUICK_ACTION_IDS).includes(actionId)) {
        logger.log('[QuickActions] Action tapped:', actionId);

        if (quickActionCallback) {
          quickActionCallback(actionId);
        }
      }
    }
  );

  return () => listener.remove();
}

/**
 * Register callback for handling quick action taps
 */
export function setQuickActionCallback(
  callback: (actionId: QuickActionId) => void
): void {
  quickActionCallback = callback;
}

// ============================================
// NOTIFICATION MANAGEMENT
// ============================================

/**
 * Show the persistent quick actions notification
 */
export async function showQuickActionsNotification(
  translations: {
    title?: string;
    body?: string;
  } = {}
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    logger.log('[QuickActions] Skipped - not native platform');
    return false;
  }

  try {
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') {
      logger.warn('[QuickActions] No notification permission');
      return false;
    }

    // Cancel any existing quick actions notification
    await LocalNotifications.cancel({ notifications: [{ id: QUICK_ACTIONS_NOTIFICATION_ID }] });

    // Show new notification
    await LocalNotifications.schedule({
      notifications: [
        {
          id: QUICK_ACTIONS_NOTIFICATION_ID,
          title: translations.title || '🌿 ZenFlow',
          body: translations.body || 'Quick access to your wellness tools',
          channelId: QUICK_ACTIONS_CHANNEL_ID,
          actionTypeId: QUICK_ACTIONS_TYPE_ID,
          ongoing: true, // Keeps notification persistent
          autoCancel: false,
          smallIcon: 'ic_stat_zenflow', // Custom small icon
          // Note: ongoing notifications need foreground service on Android 14+
        },
      ],
    });

    isQuickActionsEnabled = true;
    logger.log('[QuickActions] Notification shown');
    return true;
  } catch (error) {
    logger.error('[QuickActions] Failed to show notification:', error);
    return false;
  }
}

/**
 * Hide the quick actions notification
 */
export async function hideQuickActionsNotification(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await LocalNotifications.cancel({
      notifications: [{ id: QUICK_ACTIONS_NOTIFICATION_ID }],
    });

    isQuickActionsEnabled = false;
    logger.log('[QuickActions] Notification hidden');
  } catch (error) {
    logger.error('[QuickActions] Failed to hide notification:', error);
  }
}

/**
 * Toggle quick actions notification
 */
export async function toggleQuickActionsNotification(
  enabled: boolean,
  translations?: { title?: string; body?: string }
): Promise<boolean> {
  if (enabled) {
    return showQuickActionsNotification(translations);
  } else {
    await hideQuickActionsNotification();
    return true;
  }
}

/**
 * Check if quick actions are currently enabled
 */
export function isQuickActionsActive(): boolean {
  return isQuickActionsEnabled;
}

/**
 * Get the current quick actions setting from storage
 */
export function getQuickActionsSetting(): boolean {
  try {
    return localStorage.getItem('zenflow_quick_actions_enabled') === 'true';
  } catch {
    return false;
  }
}

/**
 * Save quick actions setting to storage
 */
export function saveQuickActionsSetting(enabled: boolean): void {
  try {
    localStorage.setItem('zenflow_quick_actions_enabled', String(enabled));
  } catch (error) {
    logger.error('[QuickActions] Failed to save setting:', error);
  }
}

// ============================================
// INITIALIZATION HELPER
// ============================================

/**
 * Initialize the complete quick actions system
 * Call this during app startup
 */
export async function initializeQuickActions(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // Create channel
    await initializeQuickActionsChannel();

    // Register action types
    await registerQuickActionTypes();

    // Restore state from settings
    const shouldBeEnabled = getQuickActionsSetting();
    if (shouldBeEnabled) {
      await showQuickActionsNotification();
    }

    logger.log('[QuickActions] Initialized, enabled:', shouldBeEnabled);
  } catch (error) {
    logger.error('[QuickActions] Initialization failed:', error);
  }
}

export default {
  initializeQuickActions,
  showQuickActionsNotification,
  hideQuickActionsNotification,
  toggleQuickActionsNotification,
  setQuickActionCallback,
  setupQuickActionsListener,
  getQuickActionsSetting,
  saveQuickActionsSetting,
  isQuickActionsActive,
  QUICK_ACTION_IDS,
};
