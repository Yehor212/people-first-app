import { ReminderSettings } from '@/types';

export const defaultReminderSettings: ReminderSettings = {
  enabled: false,
  moodTime: '09:00',
  habitTime: '20:00',
  focusTime: '13:00',
  days: [1, 2, 3, 4, 5], // Monday to Friday
  quietHours: {
    start: '22:00',
    end: '08:00'
  },
  habitIds: []
};
