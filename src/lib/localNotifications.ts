import { LocalNotifications, ActionPerformed } from '@capacitor/local-notifications';
import { ReminderSettings, Habit, CompanionType, MoodType } from '@/types';
import { COMPANION_EMOJIS } from '@/lib/innerWorldConstants';

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
        console.log('Notification permission denied');
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
      schedule: { on: { hour: number; minute: number }; every: 'day' };
    }> = [];

    const parseTime = (time: string) => {
      const [hours, minutes] = time.split(':').map(Number);
      return { hour: hours, minute: minutes };
    };

    const moodTime = parseTime(reminders.moodTime);
    const habitTime = parseTime(reminders.habitTime);
    const focusTime = parseTime(reminders.focusTime);

    notifications.push({
      id: 1,
      title: copy.mood.title,
      body: copy.mood.body,
      schedule: { on: moodTime, every: 'day' }
    });

    notifications.push({
      id: 2,
      title: copy.habit.title,
      body: copy.habit.body,
      schedule: { on: habitTime, every: 'day' }
    });

    notifications.push({
      id: 3,
      title: copy.focus.title,
      body: copy.focus.body,
      schedule: { on: focusTime, every: 'day' }
    });

    await LocalNotifications.schedule({ notifications });
    console.log('Local notifications scheduled successfully');
  } catch (error) {
    console.error('Failed to schedule local notifications:', error);
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
      console.log('Notification permission not granted for habit reminders');
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
      schedule: { on: { hour: number; minute: number; weekday?: number }; allowWhileIdle: boolean };
    }> = [];

    const parseTime = (time: string) => {
      const [hours, minutes] = time.split(':').map(Number);
      return { hour: hours || 9, minute: minutes || 0 };
    };

    let notificationId = 1000; // Start from 1000 to avoid conflicts with global reminders

    // Schedule notifications for each habit
    for (const habit of habits) {
      if (!habit.reminders || habit.reminders.length === 0) continue;

      for (const reminder of habit.reminders) {
        if (!reminder.enabled) continue;

        const time = parseTime(reminder.time);

        // If specific days are set, schedule for each day
        if (reminder.days && reminder.days.length > 0) {
          for (const day of reminder.days) {
            notifications.push({
              id: notificationId++,
              title: `${habit.icon} ${habit.name}`,
              body: translations.reminderBody.replace('{habit}', habit.name),
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
      console.log(`Scheduled ${notifications.length} habit reminder notifications`);
    } else {
      console.log('No habit reminders to schedule');
    }
  } catch (error) {
    console.error('Failed to schedule habit reminders:', error);
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
      schedule: { on: { hour: number; minute: number }; every: 'day' };
    }> = [];

    const parseTime = (time: string) => {
      const [hours, minutes] = time.split(':').map(Number);
      return { hour: hours, minute: minutes };
    };

    // Mood reminder - companion misses you
    const moodTime = parseTime(reminders.moodTime);
    notifications.push({
      id: 100,
      title: `${emoji} ${companion.name}`,
      body: translations.companionMissesYou,
      schedule: { on: moodTime, every: 'day' }
    });

    // Habit reminder - companion waiting
    const habitTime = parseTime(reminders.habitTime);
    notifications.push({
      id: 101,
      title: `${emoji} ${companion.name}`,
      body: translations.companionWaiting,
      schedule: { on: habitTime, every: 'day' }
    });

    // Focus reminder - companion cheers you
    const focusTime = parseTime(reminders.focusTime);
    notifications.push({
      id: 102,
      title: `${emoji} ${companion.name}`,
      body: translations.companionCheersYou,
      schedule: { on: focusTime, every: 'day' }
    });

    await LocalNotifications.schedule({ notifications });
    console.log('Companion reminders scheduled successfully');
  } catch (error) {
    console.error('Failed to schedule companion reminders:', error);
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
    console.log('Mood notification actions registered');
  } catch (error) {
    console.error('Failed to register mood notification actions:', error);
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
        console.log('Quick mood logged:', moodType);
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
          schedule: { on: time, every: 'day' },
          actionTypeId: MOOD_ACTION_TYPE_ID,
        },
      ],
    });

    console.log('Mood quick-log notification scheduled');
  } catch (error) {
    console.error('Failed to schedule mood quick-log notification:', error);
  }
}
