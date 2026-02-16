import { useEffect } from 'react';
import { useUserDataStore } from '@/stores';
import { defaultReminderSettings } from '@/lib/reminders';
import { logger } from '@/lib/logger';

/**
 * One-time migration: old single moodTime → 3-time mood format.
 * Also ensures defaults are set for new users.
 * Reads reminders/setReminders/isLoading from store directly.
 */
export function useReminderMigration(): void {
  const isLoading = useUserDataStore(s => s.isLoading);
  const reminders = useUserDataStore(s => s.reminders);
  const setReminders = useUserDataStore(s => s.setReminders);

  useEffect(() => {
    if (isLoading) return;

    const needsMigration = reminders.moodTime && !reminders.moodTimeMorning;

    if (needsMigration) {
      const oldTime = reminders.moodTime || '09:00';
      setReminders(prev => ({
        ...defaultReminderSettings,
        ...prev,
        moodTimeMorning: oldTime,
        moodTimeAfternoon: '14:00',
        moodTimeEvening: '20:00',
        moodTime: undefined,
      }));
      logger.log('[Migration] Migrated reminder settings to 3-time mood format');
    } else if (!reminders.moodTimeMorning) {
      setReminders(prev => ({
        ...defaultReminderSettings,
        ...prev,
      }));
    }
  }, [isLoading, reminders.moodTime, reminders.moodTimeMorning, setReminders]);
}
