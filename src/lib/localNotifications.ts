import { LocalNotifications, ActionPerformed, Channel } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { logger } from './logger';
import { ReminderSettings, Habit, CompanionType, MoodType } from '@/types';
import { COMPANION_EMOJIS } from '@/lib/innerWorldConstants';
import { getCurrentChannelId, initializeNotificationChannels } from './notificationSounds';
import { parseTime } from './timeUtils';

// Legacy notification channel ID for Android 8+ (kept for backwards compatibility)
const CHANNEL_ID = 'zenflow_reminders';

/**
 * Get the active channel ID based on user's sound preference
 */
function getActiveChannelId(): string {
  return getCurrentChannelId();
}

/**
 * Initialize notification channel for Android 8+
 * MUST be called before scheduling any notifications
 * Now initializes multiple channels for different sound options
 */
export async function initializeNotificationChannel(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // Initialize all sound-based channels
    await initializeNotificationChannels();

    // Also create legacy channel for backwards compatibility
    const channel: Channel = {
      id: CHANNEL_ID,
      name: 'ZenFlow Reminders',
      description: 'Reminders for habits, mood tracking, and focus sessions',
      importance: 4, // HIGH - makes sound and shows heads-up
      visibility: 1, // PUBLIC
      vibration: true,
      sound: 'default',
      lights: true,
      lightColor: '#10B981',
    };

    await LocalNotifications.createChannel(channel);
    logger.log('[Notifications] All channels initialized');
  } catch (error) {
    logger.error('[Notifications] Failed to create channel:', error);
  }
}

/**
 * Send a test notification immediately (for debugging)
 */
export async function sendTestNotification(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    logger.log('[Notifications] Test skipped - not native platform');
    return false;
  }

  try {
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') {
      const request = await LocalNotifications.requestPermissions();
      if (request.display !== 'granted') {
        logger.error('[Notifications] Permission denied');
        return false;
      }
    }

    // Schedule notification for 5 seconds from now
    const now = new Date();
    now.setSeconds(now.getSeconds() + 5);

    await LocalNotifications.schedule({
      notifications: [
        {
          id: 9999,
          title: '🧪 Test Notification',
          body: 'If you see this, notifications work! 🎉',
          channelId: getActiveChannelId(),
          schedule: { at: now, allowWhileIdle: true },
        },
      ],
    });

    logger.log('[Notifications] Test notification scheduled for:', now.toLocaleTimeString());
    return true;
  } catch (error) {
    logger.error('[Notifications] Test notification failed:', error);
    return false;
  }
}

/**
 * Check if notifications are properly configured
 */
export async function checkNotificationStatus(): Promise<{
  hasPermission: boolean;
  pendingCount: number;
  channelExists: boolean;
}> {
  if (!Capacitor.isNativePlatform()) {
    return { hasPermission: false, pendingCount: 0, channelExists: false };
  }

  try {
    const permission = await LocalNotifications.checkPermissions();
    const pending = await LocalNotifications.getPending();

    // Try to get channels (Android only)
    let channelExists = true;
    try {
      const channels = await LocalNotifications.listChannels();
      channelExists = channels.channels.some(c => c.id === CHANNEL_ID);
    } catch {
      // listChannels might not be available on all platforms
    }

    const status = {
      hasPermission: permission.display === 'granted',
      pendingCount: pending.notifications.length,
      channelExists,
    };

    logger.log('[Notifications] Status:', status);
    return status;
  } catch (error) {
    logger.error('[Notifications] Status check failed:', error);
    return { hasPermission: false, pendingCount: 0, channelExists: false };
  }
}

interface ReminderCopy {
  mood: { title: string; body: string };
  habit: { title: string; body: string };
  focus: { title: string; body: string };
}

interface CompanionNotificationCopy {
  companionMissesYou: string;
  companionWantsToPlay: string;
  companionWaiting: string;
  companionProud: string;
  companionCheersYou: string;
}

// Mood action IDs for one-tap logging
export const MOOD_ACTION_TYPE_ID = 'MOOD_QUICK_LOG';
export const MOOD_ACTIONS = {
  great: 'mood_great',
  good: 'mood_good',
  okay: 'mood_okay',
  bad: 'mood_bad',
  terrible: 'mood_terrible',
} as const;

// Callback type for mood quick-log
export type MoodActionCallback = (mood: MoodType) => void;

// Store callback for notification action handling
let moodActionCallback: MoodActionCallback | null = null;

/**
 * Generate soft, companion-based notification messages
 * Instead of "You forgot!", we say "Your 🦊 misses you!"
 */
export function getCompanionNotificationMessage(
  companionType: CompanionType,
  companionName: string,
  messageType: keyof CompanionNotificationCopy,
  translations: CompanionNotificationCopy
): { title: string; body: string } {
  const emoji = COMPANION_EMOJIS[companionType];
  const message = translations[messageType];

  return {
    title: `${emoji} ${companionName}`,
    body: message,
  };
}

export async function scheduleLocalReminders(
  reminders: ReminderSettings,
  copy: ReminderCopy
): Promise<void> {
  try {
    // Check permission
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') {
      const request = await LocalNotifications.requestPermissions();
      if (request.display !== 'granted') {
        logger.log('Notification permission denied');
        return;
      }
    }

    // Cancel all existing notifications
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }

    if (!reminders.enabled) {
      return;
    }

    const notifications: Array<{
      id: number;
      title: string;
      body: string;
      channelId: string;
      schedule: { on: { hour: number; minute: number }; every: 'day'; allowWhileIdle: boolean };
    }> = [];

    // 3 mood reminders: morning, afternoon, evening
    const moodTimeMorning = parseTime(reminders.moodTimeMorning, 9, 0);
    const moodTimeAfternoon = parseTime(reminders.moodTimeAfternoon, 14, 0);
    const moodTimeEvening = parseTime(reminders.moodTimeEvening, 20, 0);
    const habitTime = parseTime(reminders.habitTime, 21, 0);
    const focusTime = parseTime(reminders.focusTime, 10, 0);

    // Mood - Morning
    notifications.push({
      id: 1,
      title: copy.mood.title,
      body: copy.mood.body,
      channelId: getActiveChannelId(),
      schedule: { on: moodTimeMorning, every: 'day', allowWhileIdle: true }
    });

    // Mood - Afternoon
    notifications.push({
      id: 2,
      title: copy.mood.title,
      body: copy.mood.body,
      channelId: getActiveChannelId(),
      schedule: { on: moodTimeAfternoon, every: 'day', allowWhileIdle: true }
    });

    // Mood - Evening
    notifications.push({
      id: 3,
      title: copy.mood.title,
      body: copy.mood.body,
      channelId: getActiveChannelId(),
      schedule: { on: moodTimeEvening, every: 'day', allowWhileIdle: true }
    });

    // Habit reminder
    notifications.push({
      id: 4,
      title: copy.habit.title,
      body: copy.habit.body,
      channelId: getActiveChannelId(),
      schedule: { on: habitTime, every: 'day', allowWhileIdle: true }
    });

    // Focus reminder
    notifications.push({
      id: 5,
      title: copy.focus.title,
      body: copy.focus.body,
      channelId: getActiveChannelId(),
      schedule: { on: focusTime, every: 'day', allowWhileIdle: true }
    });

    await LocalNotifications.schedule({ notifications: notifications as any });
    logger.log('Local notifications scheduled successfully');
  } catch (error) {
    logger.error('Failed to schedule local notifications:', error);
  }
}

/**
 * Schedule push notifications for individual habit reminders
 * Each habit can have multiple reminders with custom times and days
 */
export async function scheduleHabitReminders(
  habits: Habit[],
  translations: { reminderTitle: string; reminderBody: string }
): Promise<void> {
  try {
    // Check permission
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') {
      logger.log('Notification permission not granted for habit reminders');
      return;
    }

    // Cancel all habit reminder notifications (IDs 1000+)
    const pending = await LocalNotifications.getPending();
    const habitNotifications = pending.notifications.filter(n => n.id >= 1000);
    if (habitNotifications.length > 0) {
      await LocalNotifications.cancel({ notifications: habitNotifications });
    }

    const notifications: Array<{
      id: number;
      title: string;
      body: string;
      channelId: string;
      schedule: { on: { hour: number; minute: number; weekday?: number }; allowWhileIdle: boolean };
    }> = [];

    let notificationId = 1000; // Start from 1000 to avoid conflicts with global reminders

    // Schedule notifications for each habit
    for (const habit of habits) {
      if (!habit.reminders || habit.reminders.length === 0) continue;

      for (const reminder of habit.reminders) {
        if (!reminder.enabled) continue;

        const time = parseTime(reminder.time, 9, 0);

        // If specific days are set, schedule for each day
        if (reminder.days && reminder.days.length > 0) {
          for (const day of reminder.days) {
            notifications.push({
              id: notificationId++,
              title: `${habit.icon} ${habit.name}`,
              body: translations.reminderBody.replace('{habit}', habit.name),
              channelId: getActiveChannelId(),
              schedule: {
                on: { ...time, weekday: day },
                allowWhileIdle: true
              }
            });
          }
        } else {
          // Schedule for every day if no specific days
          notifications.push({
            id: notificationId++,
            title: `${habit.icon} ${habit.name}`,
            body: translations.reminderBody.replace('{habit}', habit.name),
            channelId: getActiveChannelId(),
            schedule: {
              on: time,
              allowWhileIdle: true
            }
          });
        }
      }
    }

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
      logger.log(`Scheduled ${notifications.length} habit reminder notifications`);
    } else {
      logger.log('No habit reminders to schedule');
    }
  } catch (error) {
    logger.error('Failed to schedule habit reminders:', error);
  }
}

/**
 * Schedule companion-based soft reminders
 * These are gentle, non-judgmental notifications from the companion mascot
 */
export async function scheduleCompanionReminders(
  reminders: ReminderSettings,
  companion: { type: CompanionType; name: string },
  translations: CompanionNotificationCopy
): Promise<void> {
  try {
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') {
      return;
    }

    // Cancel existing companion reminders (IDs 100-199)
    const pending = await LocalNotifications.getPending();
    const companionNotifications = pending.notifications.filter(n => n.id >= 100 && n.id < 200);
    if (companionNotifications.length > 0) {
      await LocalNotifications.cancel({ notifications: companionNotifications });
    }

    if (!reminders.enabled) {
      return;
    }

    const emoji = COMPANION_EMOJIS[companion.type];
    const notifications: Array<{
      id: number;
      title: string;
      body: string;
      channelId: string;
      schedule: { on: { hour: number; minute: number }; every: 'day'; allowWhileIdle: boolean };
    }> = [];

    // Morning - companion misses you
    const moodTimeMorning = parseTime(reminders.moodTimeMorning, 9, 0);
    notifications.push({
      id: 100,
      title: `${emoji} ${companion.name}`,
      body: translations.companionMissesYou,
      channelId: getActiveChannelId(),
      schedule: { on: moodTimeMorning, every: 'day', allowWhileIdle: true }
    });

    // Afternoon - companion wants to play
    const moodTimeAfternoon = parseTime(reminders.moodTimeAfternoon, 14, 0);
    notifications.push({
      id: 101,
      title: `${emoji} ${companion.name}`,
      body: translations.companionWantsToPlay,
      channelId: getActiveChannelId(),
      schedule: { on: moodTimeAfternoon, every: 'day', allowWhileIdle: true }
    });

    // Evening - companion waiting (habit time)
    const habitTime = parseTime(reminders.habitTime, 21, 0);
    notifications.push({
      id: 102,
      title: `${emoji} ${companion.name}`,
      body: translations.companionWaiting,
      channelId: getActiveChannelId(),
      schedule: { on: habitTime, every: 'day', allowWhileIdle: true }
    });

    // Focus reminder - companion cheers you
    const focusTime = parseTime(reminders.focusTime, 10, 0);
    notifications.push({
      id: 103,
      title: `${emoji} ${companion.name}`,
      body: translations.companionCheersYou,
      channelId: getActiveChannelId(),
      schedule: { on: focusTime, every: 'day', allowWhileIdle: true }
    });

    await LocalNotifications.schedule({ notifications });
    logger.log('Companion reminders scheduled successfully');
  } catch (error) {
    logger.error('Failed to schedule companion reminders:', error);
  }
}

/**
 * Register notification action types for one-tap mood logging
 * This creates action buttons that appear on mood notifications
 */
export async function registerMoodNotificationActions(): Promise<void> {
  try {
    // Register action type with mood emoji buttons
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: MOOD_ACTION_TYPE_ID,
          actions: [
            { id: MOOD_ACTIONS.great, title: '😄' },
            { id: MOOD_ACTIONS.good, title: '🙂' },
            { id: MOOD_ACTIONS.okay, title: '😐' },
            { id: MOOD_ACTIONS.bad, title: '😔' },
            { id: MOOD_ACTIONS.terrible, title: '😢' },
          ],
        },
      ],
    });
    logger.log('Mood notification actions registered');
  } catch (error) {
    logger.error('Failed to register mood notification actions:', error);
  }
}

/**
 * Set up listener for notification action taps
 * Call this once during app initialization
 */
export async function setupNotificationActionListener(): Promise<() => void> {
  const listener = await LocalNotifications.addListener(
    'localNotificationActionPerformed',
    (action: ActionPerformed) => {
      const actionId = action.actionId;

      // Check if this is a mood action
      const moodEntry = Object.entries(MOOD_ACTIONS).find(
        ([, id]) => id === actionId
      );

      if (moodEntry && moodActionCallback) {
        const moodType = moodEntry[0] as MoodType;
        logger.log('Quick mood logged:', moodType);
        moodActionCallback(moodType);
      }
    }
  );

  return () => listener.remove();
}

/**
 * Register callback for handling quick mood actions
 * This should be called from the main app component
 */
export function setMoodActionCallback(callback: MoodActionCallback): void {
  moodActionCallback = callback;
}

/**
 * Schedule mood notification with quick-log action buttons
 * Uses companion for soft, friendly messaging
 */
export async function scheduleMoodQuickLogNotification(
  time: { hour: number; minute: number },
  companion: { type: CompanionType; name: string },
  message: string
): Promise<void> {
  try {
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') {
      return;
    }

    const emoji = COMPANION_EMOJIS[companion.type];

    // Cancel existing quick-log notification (ID 150)
    const pending = await LocalNotifications.getPending();
    const quickLogNotification = pending.notifications.filter(n => n.id === 150);
    if (quickLogNotification.length > 0) {
      await LocalNotifications.cancel({ notifications: quickLogNotification });
    }

    await LocalNotifications.schedule({
      notifications: [
        {
          id: 150,
          title: `${emoji} ${companion.name}`,
          body: message,
          channelId: getActiveChannelId(),
          schedule: { on: time, every: 'day', allowWhileIdle: true },
          actionTypeId: MOOD_ACTION_TYPE_ID,
        },
      ],
    });

    logger.log('Mood quick-log notification scheduled');
  } catch (error) {
    logger.error('Failed to schedule mood quick-log notification:', error);
  }
}
