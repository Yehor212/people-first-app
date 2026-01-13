import { LocalNotifications } from '@capacitor/local-notifications';
import { ReminderSettings, Habit } from '@/types';

interface ReminderCopy {
  mood: { title: string; body: string };
  habit: { title: string; body: string };
  focus: { title: string; body: string };
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
