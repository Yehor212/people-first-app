import { useState, useEffect, useCallback, useRef } from 'react';
import { isNative } from '@/lib/platform';
import { db } from '@/storage/db';
import { scheduleJournalReminder, cancelJournalReminder } from '@/lib/localNotifications';
import { logger } from '@/lib/logger';
import { SK } from '@/lib/storageKeys';
import { getToday } from '@/lib/utils';
import {
  assertOriginAccountBoundaryGeneration,
  captureOriginAccountBoundaryGeneration,
  registerAccountBoundaryRuntimeReset,
  runWithAccountBoundaryValidatedJournalWrite,
  subscribeOriginAccountBoundaryGeneration,
} from '@/storage/accountBoundaryRuntime';
import { getJournalCivilDayDifference } from './journalDateUtils';

const SETTINGS_KEY = SK.JOURNAL_REMINDER;

interface JournalReminderSettings {
  enabled: boolean;
  hour: number;
  minute: number;
}

export type JournalReminderSaveOutcome = "idle" | "saved" | "rolled-back" | "unknown";

const DEFAULT_SETTINGS: JournalReminderSettings = {
  enabled: false,
  hour: 20,
  minute: 0,
};
let journalReminderOperationTail: Promise<void> = Promise.resolve();

function runJournalReminderOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = journalReminderOperationTail
    .catch(() => undefined)
    .then(operation);
  journalReminderOperationTail = result.then(() => undefined, () => undefined);
  return result;
}

async function applyNativeReminderSettings(
  settings: JournalReminderSettings,
  translations: { reminderTitle: string; reminderBody: string },
): Promise<void> {
  if (!isNative) return;
  if (settings.enabled) {
    await scheduleJournalReminder(
      { hour: settings.hour, minute: settings.minute },
      { title: translations.reminderTitle, body: translations.reminderBody },
    );
    return;
  }
  await cancelJournalReminder();
}

export async function reconcileJournalReminderAtStartup(translations: {
  reminderTitle: string;
  reminderBody: string;
}): Promise<void> {
  if (!isNative) return;
  await runJournalReminderOperation(async () => {
    const expectedGeneration = captureOriginAccountBoundaryGeneration();
    await runWithAccountBoundaryValidatedJournalWrite(async () => {
      const entry = await db.settings.get(SETTINGS_KEY);
      assertOriginAccountBoundaryGeneration(expectedGeneration);
      const persisted = entry?.value
        ? (entry.value as JournalReminderSettings)
        : DEFAULT_SETTINGS;
      await applyNativeReminderSettings(persisted, translations);
      assertOriginAccountBoundaryGeneration(expectedGeneration);
    });
  });
}

export function useJournalReminder(translations: {
  reminderTitle: string;
  reminderBody: string;
}) {
  const [settings, setSettingsState] = useState<JournalReminderSettings>(DEFAULT_SETTINGS);
  const settledSettingsRef = useRef<JournalReminderSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState(false);
  const [saveOutcome, setSaveOutcome] = useState<JournalReminderSaveOutcome>("idle");

  useEffect(() => {
    let cancelled = false;
    const resetForAccountBoundary = () => {
      if (cancelled) return;
      settledSettingsRef.current = DEFAULT_SETTINGS;
      setSettingsState(DEFAULT_SETTINGS);
      setSaveError(false);
      setSaveOutcome("idle");
      setLoading(false);
    };
    const unregisterReset = registerAccountBoundaryRuntimeReset(resetForAccountBoundary);
    const unsubscribeGeneration = subscribeOriginAccountBoundaryGeneration(
      resetForAccountBoundary,
    );
    const expectedGeneration = captureOriginAccountBoundaryGeneration();

    void runJournalReminderOperation(() =>
      runWithAccountBoundaryValidatedJournalWrite(() => db.settings.get(SETTINGS_KEY)),
    ).then((entry) => {
      if (cancelled) return;
      assertOriginAccountBoundaryGeneration(expectedGeneration);
      const persisted = entry?.value
        ? (entry.value as JournalReminderSettings)
        : DEFAULT_SETTINGS;
      settledSettingsRef.current = persisted;
      setSettingsState(persisted);
      setSaveError(false);
      setSaveOutcome("idle");
    }).catch((error) => {
      if (cancelled) return;
      logger.warn('[Journal]', 'Reminder settings load failed:', error);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
      unregisterReset();
      unsubscribeGeneration();
    };
  }, []);

  const updateSettings = useCallback(async (updates: Partial<JournalReminderSettings>) => {
    let rollbackConfirmed = false;
    setSaveError(false);
    setSaveOutcome("idle");
    try {
      const { next, expectedGeneration } = await runJournalReminderOperation(async () => {
        const expectedGeneration = captureOriginAccountBoundaryGeneration();
        const next = await runWithAccountBoundaryValidatedJournalWrite(async () => {
          const entry = await db.settings.get(SETTINGS_KEY);
          assertOriginAccountBoundaryGeneration(expectedGeneration);
          const previous = entry?.value
            ? (entry.value as JournalReminderSettings)
            : settledSettingsRef.current;
          const candidate = { ...previous, ...updates };
          let persisted = false;
          try {
            await db.settings.put({ key: SETTINGS_KEY, value: candidate });
            persisted = true;
            assertOriginAccountBoundaryGeneration(expectedGeneration);
            await applyNativeReminderSettings(candidate, translations);
            assertOriginAccountBoundaryGeneration(expectedGeneration);
            settledSettingsRef.current = candidate;
            return candidate;
          } catch (error) {
            rollbackConfirmed = !persisted;
            if (persisted) {
              try {
                assertOriginAccountBoundaryGeneration(expectedGeneration);
                await db.settings.put({ key: SETTINGS_KEY, value: previous });
                assertOriginAccountBoundaryGeneration(expectedGeneration);
                settledSettingsRef.current = previous;
                await applyNativeReminderSettings(previous, translations);
                assertOriginAccountBoundaryGeneration(expectedGeneration);
                rollbackConfirmed = true;
              } catch (rollbackError) {
                logger.error('[Journal]', 'Reminder settings rollback failed:', rollbackError);
              }
            }
            throw error;
          }
        });
        return { next, expectedGeneration };
      });
      assertOriginAccountBoundaryGeneration(expectedGeneration);
      setSettingsState(next);
      setSaveOutcome("saved");
    } catch (error) {
      setSaveError(true);
      logger.warn('[Journal]', 'Reminder settings update failed:', error);
      setSaveOutcome(rollbackConfirmed ? "rolled-back" : "unknown");
      throw error;
    }
  }, [translations]);

  const setEnabled = useCallback((enabled: boolean) => updateSettings({ enabled }), [updateSettings]);

  const setTime = useCallback((hour: number, minute: number) => updateSettings({ hour, minute }), [updateSettings]);

  return {
    supported: isNative,
    enabled: settings.enabled,
    hour: settings.hour,
    minute: settings.minute,
    loading,
    saveError,
    saveOutcome,
    setEnabled,
    setTime,
  };
}

/**
 * Calculate days since last journal entry.
 * Returns null if there are no entries or the date set is empty.
 */
export function getDaysSinceLastEntry(
  entryDates: Map<string, unknown>,
  today = getToday(),
): number | null {
  if (entryDates.size === 0) return null;
  const dates = [...entryDates.keys()].sort().reverse();
  return Math.max(0, getJournalCivilDayDifference(dates[0], today));
}
