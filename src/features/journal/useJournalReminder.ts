import { useState, useEffect, useCallback } from 'react';
import { isNative } from '@/lib/platform';
import { db } from '@/storage/db';
import { scheduleJournalReminder, cancelJournalReminder } from '@/lib/localNotifications';
import { logger } from '@/lib/logger';
import { SK } from '@/lib/storageKeys';

const SETTINGS_KEY = SK.JOURNAL_REMINDER;

interface JournalReminderSettings {
  enabled: boolean;
  hour: number;
  minute: number;
}

const DEFAULT_SETTINGS: JournalReminderSettings = {
  enabled: false,
  hour: 20,
  minute: 0,
};

export function useJournalReminder(translations: {
  reminderTitle: string;
  reminderBody: string;
}) {
  const [settings, setSettingsState] = useState<JournalReminderSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  // Load settings from DB
  useEffect(() => {
    db.settings.get(SETTINGS_KEY).then(entry => {
      if (entry?.value) {
        setSettingsState(entry.value as JournalReminderSettings);
      }
    }).catch(err => logger.warn('[Journal]', 'Reminder settings load failed:', err)).finally(() => setLoading(false));
  }, []);

  // Sync notification scheduling whenever settings change
  useEffect(() => {
    if (loading) return;
    if (!isNative) return;

    if (settings.enabled) {
      void scheduleJournalReminder(
        { hour: settings.hour, minute: settings.minute },
        { title: translations.reminderTitle, body: translations.reminderBody },
      );
    } else {
      void cancelJournalReminder();
    }
  }, [settings, loading, translations.reminderTitle, translations.reminderBody]);

  const updateSettings = useCallback(async (updates: Partial<JournalReminderSettings>) => {
    const next = { ...settings, ...updates };
    setSettingsState(next);
    await db.settings.put({ key: SETTINGS_KEY, value: next });
  }, [settings]);

  const setEnabled = useCallback((enabled: boolean) => updateSettings({ enabled }), [updateSettings]);

  const setTime = useCallback((hour: number, minute: number) => updateSettings({ hour, minute }), [updateSettings]);

  return {
    enabled: settings.enabled,
    hour: settings.hour,
    minute: settings.minute,
    loading,
    setEnabled,
    setTime,
  };
}

/**
 * Calculate days since last journal entry.
 * Returns null if there are no entries or the date set is empty.
 */
export function getDaysSinceLastEntry(entryDates: Map<string, unknown>): number | null {
  if (entryDates.size === 0) return null;
  const dates = [...entryDates.keys()].sort().reverse();
  const lastDate = new Date(dates[0] + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = today.getTime() - lastDate.getTime();
  return Math.floor(diffMs / 86400000);
}
