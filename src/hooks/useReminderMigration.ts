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

    const needsTimeMigration = !reminders.moodTimeMorning;
    const needsCategoryMigration =
      typeof reminders.moodCheckInsEnabled !== 'boolean' ||
      typeof reminders.focusReminderEnabled !== 'boolean';

    if (!needsTimeMigration && !needsCategoryMigration) return;

    setReminders(prev => {
      const legacyScheduleWasActive = prev.enabled === true;
      return {
        ...defaultReminderSettings,
        ...prev,
        ...(needsTimeMigration && {
          moodTimeMorning: prev.moodTime || '09:00',
          moodTimeAfternoon: prev.moodTimeAfternoon || '14:00',
          moodTimeEvening: prev.moodTimeEvening || '20:00',
          moodTime: undefined,
        }),
        moodCheckInsEnabled:
          typeof prev.moodCheckInsEnabled === 'boolean'
            ? prev.moodCheckInsEnabled
            : legacyScheduleWasActive,
        focusReminderEnabled:
          typeof prev.focusReminderEnabled === 'boolean'
            ? prev.focusReminderEnabled
            : legacyScheduleWasActive,
      };
    });
    logger.log('[Migration] Normalized reminder times and category consent');
  }, [
    isLoading,
    reminders.focusReminderEnabled,
    reminders.moodCheckInsEnabled,
    reminders.moodTimeMorning,
    setReminders,
  ]);
}
