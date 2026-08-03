import { ReminderSettings } from '@/types';

export const defaultReminderSettings: ReminderSettings = {
  enabled: false,
  moodCheckInsEnabled: false,
  focusReminderEnabled: false,
  // Mood check-ins: morning, afternoon, evening
  moodTimeMorning: '09:00',
  moodTimeAfternoon: '14:00',
  moodTimeEvening: '20:00',
  habitTime: '21:00',
  focusTime: '10:00',
  days: [1, 2, 3, 4, 5], // Monday to Friday
  quietHours: {
    start: '22:00',
    end: '08:00'
  },
  habitIds: []
};

/**
 * Preserve the intent of records written before mood/focus category controls
 * existed. This must run on raw storage bytes before new-user defaults merge.
 */
export function migrateStoredReminderSettings(value: unknown): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;

  const stored = value as Record<string, unknown>;
  const legacyScheduleWasActive = stored.enabled === true;
  return {
    ...stored,
    moodCheckInsEnabled:
      typeof stored.moodCheckInsEnabled === 'boolean'
        ? stored.moodCheckInsEnabled
        : legacyScheduleWasActive,
    focusReminderEnabled:
      typeof stored.focusReminderEnabled === 'boolean'
        ? stored.focusReminderEnabled
        : legacyScheduleWasActive,
  };
}
