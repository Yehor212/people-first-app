/**
 * Local Notifications Manager
 *
 * Handles scheduling and managing local notifications for:
 * - Habit reminders
 * - Mood check-ins
 * - Focus session alerts
 * - Daily digests
 *
 * IMPORTANT: Android Notification Channel Behavior (Android 8+)
 * ============================================================
 * Android notification channels are IMMUTABLE after first creation.
 * The following properties CANNOT be changed programmatically once set:
 *   - importance/priority level
 *   - sound
 *   - vibration pattern
 *   - lights
 *
 * To change these settings for existing users:
 * 1. Create a NEW channel with a versioned ID
 * 2. Update all notification code to use the new channel ID
 * 3. Tell users that Android system notification settings remain in control
 *
 * Users can always manually adjust settings in Android System Settings.
 * See: https://developer.android.com/develop/ui/views/notifications/channels
 */

import { LocalNotifications, type ActionPerformed } from '@capacitor/local-notifications';
import { isNative } from '@/lib/platform';
import { logger } from './logger';
import { ReminderSettings, Habit, MoodType } from '@/types';
import { getCurrentChannelId, initializeNotificationChannels } from './notificationSounds';
import { parseTime } from './timeUtils';

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
  if (!isNative) return;

  try {
    await initializeNotificationChannels();
    logger.log('[Notifications] Sound channels initialized');
  } catch (error) {
    logger.error('[Notifications] Failed to initialize channels:', error);
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
  if (!isNative) {
    return { hasPermission: false, pendingCount: 0, channelExists: false };
  }

  try {
    const permission = await LocalNotifications.checkPermissions();
    const pending = await LocalNotifications.getPending();

    // Try to get channels (Android only)
    let channelExists = true;
    try {
      const activeChannelId = getActiveChannelId();
      const channels = await LocalNotifications.listChannels();
      channelExists = channels.channels.some(c => c.id === activeChannelId);
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

interface GlobalReminderSpec {
  id: number;
  title: string;
  body: string;
  time: { hour: number; minute: number };
}

function toMinutes(time: { hour: number; minute: number }): number {
  return time.hour * 60 + time.minute;
}

function isWithinQuietHours(
  time: { hour: number; minute: number },
  quietHours: ReminderSettings['quietHours'],
): boolean {
  const start = toMinutes(parseTime(quietHours.start, 22, 0));
  const end = toMinutes(parseTime(quietHours.end, 7, 0));
  const current = toMinutes(time);

  if (start === end) return false;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

function getSelectedReminderDays(days: number[]): number[] {
  return [...new Set(days.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort(
    (a, b) => a - b,
  );
}

function toCapacitorWeekday(day: number): number {
  return day === 0 ? 1 : day + 1;
}

const JOURNAL_REMINDER_ID = 10;
const QUICK_LOG_NOTIFICATION_ID = 150;
const HABIT_REMINDER_ID_BASE = 1000;
const QUICK_LOG_WEEKDAY_ID_BASE = 9000;
const HABIT_REMINDER_ID_MAX = QUICK_LOG_WEEKDAY_ID_BASE - 1;

function isHabitReminderNotificationId(id: number): boolean {
  return id >= HABIT_REMINDER_ID_BASE && id <= HABIT_REMINDER_ID_MAX;
}

function isGlobalReminderNotificationId(id: number): boolean {
  if (id >= 1 && id <= 5) return true;
  for (let baseId = 1; baseId <= 5; baseId += 1) {
    for (let day = 0; day <= 6; day += 1) {
      if (id === baseId * 100 + day) return true;
    }
  }
  return false;
}

function buildGlobalReminderNotifications(
  reminders: ReminderSettings,
  specs: GlobalReminderSpec[],
): Array<{
  id: number;
  title: string;
  body: string;
  channelId: string;
  schedule: { on: { hour: number; minute: number; weekday?: number }; allowWhileIdle: boolean };
}> {
  const days = getSelectedReminderDays(reminders.days);
  const activeSpecs = specs.filter((spec) => !isWithinQuietHours(spec.time, reminders.quietHours));

  if (days.length === 0) {
    return activeSpecs.map((spec) => ({
      id: spec.id,
      title: spec.title,
      body: spec.body,
      channelId: getActiveChannelId(),
      schedule: { on: spec.time, allowWhileIdle: true },
    }));
  }

  return activeSpecs.flatMap((spec) =>
    days.map((day) => ({
      id: spec.id * 100 + day,
      title: spec.title,
      body: spec.body,
      channelId: getActiveChannelId(),
      schedule: { on: { ...spec.time, weekday: toCapacitorWeekday(day) }, allowWhileIdle: true },
    })),
  );
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

export async function scheduleLocalReminders(
  reminders: ReminderSettings,
  copy: ReminderCopy
): Promise<void> {
  try {
    await initializeNotificationChannel();

    // Check permission
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') {
      logger.log('Notification permission not granted for local reminders');
      return;
    }

    // Cancel all existing notifications
    const pending = await LocalNotifications.getPending();
    const globalReminderNotifications = pending.notifications.filter((notification) =>
      isGlobalReminderNotificationId(notification.id),
    );
    if (globalReminderNotifications.length > 0) {
      await LocalNotifications.cancel({ notifications: globalReminderNotifications });
    }

    if (!reminders.enabled) {
      return;
    }

    // 3 mood reminders: morning, afternoon, evening
    const moodTimeMorning = parseTime(reminders.moodTimeMorning, 9, 0);
    const moodTimeAfternoon = parseTime(reminders.moodTimeAfternoon, 14, 0);
    const moodTimeEvening = parseTime(reminders.moodTimeEvening, 20, 0);
    const habitTime = parseTime(reminders.habitTime, 21, 0);
    const focusTime = parseTime(reminders.focusTime, 10, 0);

    const notifications = buildGlobalReminderNotifications(reminders, [
      { id: 1, title: copy.mood.title, body: copy.mood.body, time: moodTimeMorning },
      { id: 2, title: copy.mood.title, body: copy.mood.body, time: moodTimeAfternoon },
      { id: 3, title: copy.mood.title, body: copy.mood.body, time: moodTimeEvening },
      { id: 4, title: copy.habit.title, body: copy.habit.body, time: habitTime },
      { id: 5, title: copy.focus.title, body: copy.focus.body, time: focusTime },
    ]);

    if (notifications.length === 0) {
      logger.log('No local reminders to schedule outside quiet hours');
      return;
    }

    await LocalNotifications.schedule({ notifications });
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
    await initializeNotificationChannel();

    // Check permission
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') {
      logger.log('Notification permission not granted for habit reminders');
      return;
    }

    // Cancel only habit reminder notifications; quick mood weekday IDs start at 9000.
    const pending = await LocalNotifications.getPending();
    const habitNotifications = pending.notifications.filter((notification) =>
      isHabitReminderNotificationId(notification.id),
    );
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

    let notificationId = HABIT_REMINDER_ID_BASE;
    let habitReminderCapacityReached = false;

    const addHabitNotification = (
      habit: Habit,
      time: { hour: number; minute: number },
      weekday?: number,
    ): void => {
      if (notificationId > HABIT_REMINDER_ID_MAX) {
        if (!habitReminderCapacityReached) {
          logger.warn('Habit reminder notification capacity reached; skipping remaining habit reminders');
        }
        habitReminderCapacityReached = true;
        return;
      }

      notifications.push({
        id: notificationId++,
        title: `${habit.icon} ${habit.name}`,
        body: translations.reminderBody.replace('{habit}', habit.name),
        channelId: getActiveChannelId(),
        schedule: {
          on: weekday === undefined ? time : { ...time, weekday },
          allowWhileIdle: true,
        },
      });
    };

    // Schedule notifications for each habit
    for (const habit of habits) {
      if (habitReminderCapacityReached) break;
      if (!habit.reminders || habit.reminders.length === 0) continue;

      for (const reminder of habit.reminders) {
        if (habitReminderCapacityReached) break;
        if (!reminder.enabled) continue;

        const time = parseTime(reminder.time, 9, 0);

        // If specific days are set, schedule for each day
        if (reminder.days && reminder.days.length > 0) {
          for (const day of getSelectedReminderDays(reminder.days)) {
            if (habitReminderCapacityReached) break;
            addHabitNotification(habit, time, toCapacitorWeekday(day));
          }
        } else {
          // Schedule for every day if no specific days
          addHabitNotification(habit, time);
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
 */
// ====== Journal Reminder ======
type ReminderSchedulePolicy = Pick<ReminderSettings, 'days' | 'quietHours'>;

function isQuickLogNotificationId(id: number): boolean {
  return id === QUICK_LOG_NOTIFICATION_ID || (id >= QUICK_LOG_WEEKDAY_ID_BASE && id <= QUICK_LOG_WEEKDAY_ID_BASE + 6);
}

export async function scheduleJournalReminder(
  time: { hour: number; minute: number },
  copy: { title: string; body: string }
): Promise<void> {
  if (!isNative) return;

  try {
    await initializeNotificationChannel();

    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') return;

    // Cancel existing journal reminder
    await cancelJournalReminder();

    await LocalNotifications.schedule({
      notifications: [{
        id: JOURNAL_REMINDER_ID,
        title: copy.title,
        body: copy.body,
        channelId: getActiveChannelId(),
        schedule: { on: time, every: 'day', allowWhileIdle: true },
      }],
    });

    logger.log('[Notifications] Journal reminder scheduled for', `${time.hour}:${time.minute}`);
  } catch (error) {
    logger.error('[Notifications] Failed to schedule journal reminder:', error);
  }
}

export async function cancelJournalReminder(): Promise<void> {
  if (!isNative) return;
  try {
    const pending = await LocalNotifications.getPending();
    const journalNotifs = pending.notifications.filter(n => n.id === JOURNAL_REMINDER_ID);
    if (journalNotifs.length > 0) {
      await LocalNotifications.cancel({ notifications: journalNotifs });
    }
  } catch (error) {
    logger.error('[Notifications] Failed to cancel journal reminder:', error);
  }
}

export async function scheduleMoodQuickLogNotification(
  time: { hour: number; minute: number },
  message: string,
  policy?: ReminderSchedulePolicy,
): Promise<void> {
  try {
    await initializeNotificationChannel();

    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') {
      return;
    }

    const pending = await LocalNotifications.getPending();
    const quickLogNotifications = pending.notifications.filter((notification) =>
      isQuickLogNotificationId(notification.id),
    );
    if (quickLogNotifications.length > 0) {
      await LocalNotifications.cancel({ notifications: quickLogNotifications });
    }

    if (policy && isWithinQuietHours(time, policy.quietHours)) {
      logger.log('Mood quick-log notification skipped during quiet hours');
      return;
    }

    const days = policy ? getSelectedReminderDays(policy.days) : [];
    const notifications = days.length === 0
      ? [
          {
            id: QUICK_LOG_NOTIFICATION_ID,
            title: '💜 ZenFlow',
            body: message,
            channelId: getActiveChannelId(),
            schedule: { on: time, every: 'day' as const, allowWhileIdle: true },
            actionTypeId: MOOD_ACTION_TYPE_ID,
          },
        ]
      : days.map((day) => ({
          id: QUICK_LOG_WEEKDAY_ID_BASE + day,
          title: '💜 ZenFlow',
          body: message,
          channelId: getActiveChannelId(),
          schedule: {
            on: { ...time, weekday: toCapacitorWeekday(day) },
            allowWhileIdle: true,
          },
          actionTypeId: MOOD_ACTION_TYPE_ID,
        }));

    await LocalNotifications.schedule({
      notifications,
    });

    logger.log('Mood quick-log notification scheduled');
  } catch (error) {
    logger.error('Failed to schedule mood quick-log notification:', error);
  }
}
