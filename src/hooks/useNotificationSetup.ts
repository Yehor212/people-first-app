import { useEffect, useMemo, useRef } from 'react';
import { useAppStore, useUserDataStore } from '@/stores';
import { useLanguage } from '@/contexts/LanguageContext';
import { isNative } from '@/lib/platform';
import { logger } from '@/lib/logger';
import {
  reconcileReminderNotifications,
  registerMoodNotificationActions,
  setupNotificationActionListener,
  setMoodActionCallback,
  clearMoodActionCallback,
  resumeAccountNotifications,
} from '@/lib/localNotifications';
import { initializePushNotifications, removePushToken } from '@/lib/pushNotifications';
import { buildNotificationChannelCopy } from '@/lib/notificationSounds';
import { getCurrentSessionUserId } from '@/lib/supabaseClient';
import type { MoodEntry } from '@/types';

interface UseNotificationSetupParams {
  handleQuickMood: (mood: MoodEntry['mood']) => void;
}

const PUSH_REVOCATION_INCOMPLETE_EVENT = 'zenflow:push-revocation-incomplete';
const REMINDER_RECONCILE_FAILED_EVENT = 'zenflow:reminder-reconcile-failed';

/**
 * Sets up all native notification systems: local reminders, per-habit reminders,
 * notification channel, FCM push, mood quick-log actions.
 */
export function useNotificationSetup({ handleQuickMood }: UseNotificationSetupParams): void {
  const { t } = useLanguage();
  const reminders = useUserDataStore(s => s.reminders);
  const habits = useUserDataStore(s => s.habits);
  const pushNotificationsEnabled = useUserDataStore(s => s.privacy.pushNotifications === true);
  const hasValidSession = useAppStore(s => s.hasValidSession);
  const previousPushConsentRef = useRef<boolean | null>(null);
  const pushRevocationInFlightRef = useRef(false);
  const reminderReconcileRetryRef = useRef<() => void>(() => undefined);
  const pushRevocationCopyRef = useRef({
    message:
      t.pushRevocationIncomplete ||
      'ZenFlow could not fully disconnect remote notifications from this device.',
    retryLabel: t.retry || 'Retry',
  });
  pushRevocationCopyRef.current = {
    message:
      t.pushRevocationIncomplete ||
      'ZenFlow could not fully disconnect remote notifications from this device.',
    retryLabel: t.retry || 'Retry',
  };
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
  const notificationChannelCopy = useMemo(
    () => buildNotificationChannelCopy(t as unknown as Record<string, string>),
    [t],
  );

  useEffect(() => {
    if (!isNative || hasValidSession !== true) return;
    resumeAccountNotifications();
  }, [hasValidSession]);

  // Reconcile every app-owned master reminder in one serialized pass.
  useEffect(() => {
    if (!isNative) return;
    let active = true;

    const reconcile = async (): Promise<void> => {
      try {
        await reconcileReminderNotifications(
          reminders,
          reminders.enabled ? habits : [],
          {
            ...reminderCopy,
            quickMoodBody: t.howAreYouNow || 'How are you feeling? Tap! 😊',
            channelCopy: notificationChannelCopy,
          },
        );
      } catch (error) {
        if (!active) return;
        logger.error('Failed to reconcile local reminders:', error);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent(REMINDER_RECONCILE_FAILED_EVENT, {
              detail: {
                message:
                  t.reminderReconcileFailed ||
                  'ZenFlow could not update reminders. Your device may still use the previous schedule. Try again.',
                retryLabel: t.retry || 'Retry',
                retry: () => reminderReconcileRetryRef.current(),
              },
            }),
          );
        }
      }
    };
    const retryCurrentReconcile = () => {
      void reconcile();
    };
    reminderReconcileRetryRef.current = retryCurrentReconcile;
    void reconcile();

    return () => {
      active = false;
      if (reminderReconcileRetryRef.current === retryCurrentReconcile) {
        reminderReconcileRetryRef.current = () => undefined;
      }
    };
  }, [
    habits,
    notificationChannelCopy,
    reminderCopy,
    reminders,
    t.howAreYouNow,
    t.reminderReconcileFailed,
    t.retry,
  ]);

  // FCM uses a remote device token, so it stays behind explicit privacy consent.
  useEffect(() => {
    if (!isNative) return;
    if (pushNotificationsEnabled) {
      previousPushConsentRef.current = true;
      if (hasValidSession === true) {
        initializePushNotifications().catch((error) => {
          logger.error('Failed to initialize push notifications:', error);
        });
      }
      return;
    }

    const shouldRemoveRemoteToken = previousPushConsentRef.current !== false;
    previousPushConsentRef.current = false;
    if (!shouldRemoveRemoteToken) return;

    const revokePushRegistration = async (): Promise<void> => {
      if (useUserDataStore.getState().privacy.pushNotifications === true) return;
      if (pushRevocationInFlightRef.current) return;
      pushRevocationInFlightRef.current = true;

      try {
        const result = await removePushToken();
        if (useUserDataStore.getState().privacy.pushNotifications === true) return;
        if (result.status === 'revoked') return;

        const copy = pushRevocationCopyRef.current;
        const detail = {
          status: result.status,
          remote: result.remote,
          native: result.native,
          retryable: true,
          message: copy.message,
          retryLabel: copy.retryLabel,
          retry: () => {
            void revokePushRegistration();
          },
        } as const;
        logger.warn(
          '[Push] Registration cleanup is incomplete after consent was disabled',
          {
            status: result.status,
            remote: result.remote,
            native: result.native,
          },
        );
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent(PUSH_REVOCATION_INCOMPLETE_EVENT, { detail }),
          );
        }
      } catch (error) {
        if (useUserDataStore.getState().privacy.pushNotifications === true) return;
        logger.error('Failed to remove push notification token:', error);
        const copy = pushRevocationCopyRef.current;
        const detail = {
          status: 'failed',
          remote: 'unknown',
          native: 'unknown',
          retryable: true,
          message: copy.message,
          retryLabel: copy.retryLabel,
          retry: () => {
            void revokePushRegistration();
          },
        } as const;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent(PUSH_REVOCATION_INCOMPLETE_EVENT, { detail }),
          );
        }
      } finally {
        pushRevocationInFlightRef.current = false;
      }
    };

    void revokePushRegistration();
  }, [hasValidSession, pushNotificationsEnabled]);

  // Set up one-tap mood notification actions
  useEffect(() => {
    if (!isNative) return;
    if (hasValidSession !== true) {
      clearMoodActionCallback();
      return;
    }

    let cleanupListener: (() => Promise<void>) | null = null;
    let disposed = false;

    const setupMoodActions = async () => {
      // Register notification action types (mood emoji buttons)
      await registerMoodNotificationActions();

      // Set up listener for action taps
      cleanupListener = await setupNotificationActionListener();

      const expectedOwnerUserId = await getCurrentSessionUserId();
      if (disposed || !expectedOwnerUserId) {
        if (cleanupListener) await cleanupListener();
        cleanupListener = null;
        return;
      }

      // Register callback to handle quick mood logging
      setMoodActionCallback(handleQuickMood, expectedOwnerUserId);
    };

    setupMoodActions().catch((error) => {
      logger.error('Failed to setup mood notification actions:', error);
    });

    return () => {
      disposed = true;
      clearMoodActionCallback(handleQuickMood);
      if (cleanupListener) void cleanupListener();
    };
  }, [handleQuickMood, hasValidSession]);

}
