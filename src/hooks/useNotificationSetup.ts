import { useEffect, useMemo } from 'react';
import { useUserDataStore } from '@/stores';
import { useLanguage } from '@/contexts/LanguageContext';
import { isNativePlatform } from '@/lib/authRedirect';
import { logger } from '@/lib/logger';
import {
  scheduleLocalReminders,
  scheduleHabitReminders,
  registerMoodNotificationActions,
  setupNotificationActionListener,
  setMoodActionCallback,
  scheduleMoodQuickLogNotification,
  initializeNotificationChannel,
} from '@/lib/localNotifications';
import { initializePushNotifications } from '@/lib/pushNotifications';
import type { MoodEntry } from '@/types';

interface UseNotificationSetupParams {
  handleQuickMood: (mood: MoodEntry['mood']) => void;
}

/**
 * Sets up all native notification systems: local reminders, per-habit reminders,
 * notification channel, FCM push, mood quick-log actions.
 */
export function useNotificationSetup({ handleQuickMood }: UseNotificationSetupParams): void {
  const { t } = useLanguage();
  const reminders = useUserDataStore(s => s.reminders);
  const habits = useUserDataStore(s => s.habits);
  // Compute reminder copy for notification text (moved from Index.tsx)
  const reminderCopy = useMemo(() => {
    const safeHabits = Array.isArray(habits) ? habits : [];
    const habitNameMap = new Map(safeHabits.map((habit) => [habit.id, habit.name]));
    const habitNames = reminders.habitIds
      .map((id: string) => habitNameMap.get(id))
      .filter(Boolean);
    const habitBody =
      habitNames.length === 0
        ? t.reminderHabitBody
        : `${t.reminderHabitBody} ${habitNames.join(", ")}`;

    return {
      mood: { title: t.reminderMoodTitle, body: t.reminderMoodBody },
      habit: { title: t.reminderHabitTitle, body: habitBody },
      focus: { title: t.reminderFocusTitle, body: t.reminderFocusBody },
    };
  }, [habits, reminders.habitIds, t]);

  // Schedule local reminders
  useEffect(() => {
    if (!isNativePlatform()) return;
    scheduleLocalReminders(reminders, reminderCopy).catch((error) => {
      logger.error("Failed to schedule local reminders:", error);
    });
  }, [reminders, reminderCopy]);

  // Schedule per-habit push notifications
  useEffect(() => {
    if (!isNativePlatform()) return;
    scheduleHabitReminders(habits, {
      reminderTitle: t.reminderHabitTitle,
      reminderBody: t.reminderHabitBody,
    }).catch((error) => {
      logger.error("Failed to schedule habit reminders:", error);
    });
  }, [habits, t.reminderHabitTitle, t.reminderHabitBody]);

  // Initialize notification channel (Android 8+ requirement)
  useEffect(() => {
    if (!isNativePlatform()) return;
    initializeNotificationChannel().catch((error) => {
      logger.error('Failed to initialize notification channel:', error);
    });
  }, []);

  // Initialize FCM push notifications (Android)
  useEffect(() => {
    if (!isNativePlatform()) return;
    initializePushNotifications().catch((error) => {
      logger.error('Failed to initialize push notifications:', error);
    });
  }, []);

  // Set up one-tap mood notification actions
  useEffect(() => {
    if (!isNativePlatform()) return;

    let cleanupListener: (() => void) | null = null;

    const setupMoodActions = async () => {
      // Register notification action types (mood emoji buttons)
      await registerMoodNotificationActions();

      // Set up listener for action taps
      cleanupListener = await setupNotificationActionListener();

      // Register callback to handle quick mood logging
      setMoodActionCallback(handleQuickMood);
    };

    setupMoodActions().catch((error) => {
      logger.error('Failed to setup mood notification actions:', error);
    });

    return () => {
      if (cleanupListener) cleanupListener();
    };
  }, [handleQuickMood]);

  // Schedule mood quick-log notification with action buttons (morning check-in)
  useEffect(() => {
    if (!isNativePlatform() || !reminders.enabled) return;

    const parseTime = (time: string) => {
      const [hours, minutes] = time.split(':').map(Number);
      return { hour: hours, minute: minutes };
    };

    // Use morning time for the quick-log notification
    scheduleMoodQuickLogNotification(
      parseTime(reminders.moodTimeMorning),
      t.howAreYouNow || 'How are you feeling? Tap! 😊',
    ).catch((error) => {
      logger.error('Failed to schedule mood quick-log notification:', error);
    });
  }, [reminders.enabled, reminders.moodTimeMorning, t.howAreYouNow]);
}
