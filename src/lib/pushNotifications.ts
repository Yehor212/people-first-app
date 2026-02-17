/**
 * Push Notifications Service - FCM for Android
 * Part of Phase 5.17
 *
 * Handles:
 * - FCM token registration
 * - Token sync to Supabase
 * - Push notification handling
 */

import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import { isNative, isAndroid } from '@/lib/platform';
import { supabase, getCurrentUserId } from './supabaseClient';
import { logger } from './logger';
import { App } from '@capacitor/app';
import { SK } from './storageKeys';
import { storageGetRaw, storageSetRaw } from './safeJson';
import { SUPABASE_URL } from '@/lib/env';

// Device ID for token management
let deviceId: string | null = null;

/**
 * Get or generate device ID
 */
async function getDeviceId(): Promise<string> {
  if (deviceId) return deviceId;

  try {
    const info = await App.getInfo();
    // Use app ID + build as device identifier
    deviceId = `${info.id}-${info.build}`;
  } catch {
    // Fallback to random ID stored in localStorage
    try {
      const stored = storageGetRaw(SK.DEVICE_ID);
      if (stored) {
        deviceId = stored;
      } else {
        deviceId = `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        storageSetRaw(SK.DEVICE_ID, deviceId);
      }
    } catch {
      deviceId = `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
  }

  return deviceId;
}

/**
 * Check if push notifications are available
 */
export function isPushAvailable(): boolean {
  return isNative && isAndroid;
}

/**
 * Request push notification permissions
 */
export async function requestPushPermission(): Promise<boolean> {
  if (!isPushAvailable()) {
    logger.log('[Push] Not available on this platform');
    return false;
  }

  try {
    const permission = await PushNotifications.checkPermissions();

    if (permission.receive === 'granted') {
      return true;
    }

    if (permission.receive === 'prompt') {
      const result = await PushNotifications.requestPermissions();
      return result.receive === 'granted';
    }

    return false;
  } catch (error) {
    logger.error('[Push] Permission check failed:', error);
    return false;
  }
}

/**
 * Register for push notifications and get FCM token
 */
export async function registerPushNotifications(): Promise<string | null> {
  if (!isPushAvailable()) {
    return null;
  }

  try {
    // Check/request permission
    const hasPermission = await requestPushPermission();
    if (!hasPermission) {
      logger.warn('[Push] Permission not granted');
      return null;
    }

    // Register with FCM
    await PushNotifications.register();

    // Token is received via listener, return null here
    // The actual token will be saved via the 'registration' listener
    logger.log('[Push] Registration initiated');
    return null;
  } catch (error) {
    logger.error('[Push] Registration failed:', error);
    return null;
  }
}

/**
 * Save FCM token to Supabase
 */
export async function savePushToken(token: string): Promise<boolean> {
  if (!supabase) {
    logger.warn('[Push] Supabase not configured');
    return false;
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    logger.warn('[Push] User not authenticated');
    return false;
  }

  try {
    const deviceIdValue = await getDeviceId();

    const { error } = await supabase
      .from('push_device_tokens')
      .upsert({
        user_id: userId,
        token,
        platform: 'android',
        device_id: deviceIdValue,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,token',
      });

    if (error) {
      logger.error('[Push] Failed to save token:', error);
      return false;
    }

    logger.log('[Push] Token saved successfully');
    return true;
  } catch (error) {
    logger.error('[Push] Token save error:', error);
    return false;
  }
}

/**
 * Remove push token on logout
 */
export async function removePushToken(): Promise<void> {
  if (!supabase) return;

  const userId = await getCurrentUserId();
  if (!userId) return;

  try {
    const deviceIdValue = await getDeviceId();

    await supabase
      .from('push_device_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('device_id', deviceIdValue);

    logger.log('[Push] Token removed');
  } catch (error) {
    logger.error('[Push] Failed to remove token:', error);
  }
}

/**
 * Handle push notification tap action
 */
function handlePushAction(notification: PushNotificationSchema): void {
  logger.log('[Push] Action:', notification);

  // Get notification data
  const data = notification.data as Record<string, string> | undefined;
  const type = data?.type;

  // Navigate based on notification type
  switch (type) {
    case 'mood':
      // Could emit event or use navigation
      logger.log('[Push] Mood reminder tapped');
      break;
    case 'habit':
      logger.log('[Push] Habit reminder tapped');
      break;
    case 'focus':
      logger.log('[Push] Focus reminder tapped');
      break;
    default:
      logger.log('[Push] Generic notification tapped');
  }
}

/**
 * Setup push notification listeners
 * Call this once on app start
 */
export function setupPushListeners(): void {
  if (!isPushAvailable()) return;

  // Token received
  // Don't log token values, even partially
  void PushNotifications.addListener('registration', async (token: Token) => {
    logger.log('[Push] Token received (length:', token.value.length, ')');
    await savePushToken(token.value);
  });

  // Registration error
  void PushNotifications.addListener('registrationError', (error) => {
    logger.error('[Push] Registration error:', error);
  });

  // Notification received while app is in foreground
  void PushNotifications.addListener('pushNotificationReceived', (notification) => {
    logger.log('[Push] Foreground notification:', notification.title);
    // In foreground, we might want to show a toast instead
    // The system won't show a heads-up notification when app is open
  });

  // Notification tapped
  void PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
    logger.log('[Push] Notification tapped');
    handlePushAction(action.notification);
  });

  logger.log('[Push] Listeners setup complete');
}

/**
 * Initialize push notifications
 * Call on app start for authenticated users
 */
export async function initializePushNotifications(): Promise<void> {
  if (!isPushAvailable()) return;

  const userId = await getCurrentUserId();
  if (!userId) {
    logger.log('[Push] Skipping - user not authenticated');
    return;
  }

  setupPushListeners();
  await registerPushNotifications();
}

/**
 * Send a test push via Supabase Edge Function
 */
export async function sendTestPush(): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/send-push-now`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'test',
          title: '🧪 Test Push',
          body: 'Push notifications work! 🎉',
        }),
      }
    );

    if (!response.ok) {
      logger.error('[Push] Test failed:', await response.text());
      return false;
    }

    logger.log('[Push] Test push sent');
    return true;
  } catch (error) {
    logger.error('[Push] Test push error:', error);
    return false;
  }
}

export default {
  isPushAvailable,
  requestPushPermission,
  registerPushNotifications,
  savePushToken,
  removePushToken,
  setupPushListeners,
  initializePushNotifications,
  sendTestPush,
};
