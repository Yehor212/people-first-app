import { LocalNotifications } from '@capacitor/local-notifications';
import { ReminderSettings } from '@/types';

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
