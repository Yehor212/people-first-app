import { useEffect, useMemo, useRef } from 'react';
import { useAppStore, useUserDataStore } from '@/stores';
import { useLanguage } from '@/contexts/LanguageContext';
import { isNative } from '@/lib/platform';
import { logger } from '@/lib/logger';
import {
  registerMoodNotificationActions,
  setupNotificationActionListener,
  setMoodActionCallback,
  clearMoodActionCallback,
  resumeAccountNotifications,
} from '@/lib/localNotifications';
import { reconcilePersistedMasterReminders } from '@/lib/persistedReminderReconciliation';
import { initializePushNotifications, removePushToken } from '@/lib/pushNotifications';
import { buildNotificationChannelCopy } from '@/lib/notificationSounds';
import { buildReminderCopy } from '@/lib/reminderCopy';
import type { MoodEntry } from '@/types';
import { reconcileJournalReminderAtStartup } from '@/features/journal';
import {
  assertVerifiedNotificationRealmCurrent,
  readVerifiedNotificationRealm,
} from '@/storage/notificationRealm';
import {
  NATIVE_REMINDER_RECONCILE_EVENT,
  requestReminderSettingsNavigation,
  type NativeReminderReconcileEventDetail,
} from '@/lib/notificationLifecycle';

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
  const isUserDataLoading = useUserDataStore(s => s.isLoading);
  const pushNotificationsEnabled = useUserDataStore(s => s.privacy.pushNotifications === true);
  const pushConsentWasShown = useUserDataStore(s => s.privacy.consentShown === true);
  const hasValidSession = useAppStore(s => s.hasValidSession);
  const isAccountBoundaryInProgress = useAppStore(s => s.isAccountBoundaryInProgress);
  const previousPushConsentRef = useRef<boolean | null>(null);
  const pushRevocationInFlightRef = useRef(false);
  const reminderReconcileRetryRef = useRef<() => void>(() => undefined);
  const journalReconcileRetryRef = useRef<() => void>(() => undefined);
  const permissionIncidentActiveRef = useRef(false);
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
  const reminderCopy = useMemo(() => buildReminderCopy(t), [t]);
  const notificationChannelCopy = useMemo(
    () => buildNotificationChannelCopy(t as unknown as Record<string, string>),
    [t],
  );

  useEffect(() => {
    if (!isNative || hasValidSession !== true || isAccountBoundaryInProgress) return;
    resumeAccountNotifications();
  }, [hasValidSession, isAccountBoundaryInProgress]);

  // Reconcile every app-owned master reminder in one serialized pass.
  useEffect(() => {
    if (
      !isNative ||
      isUserDataLoading ||
      hasValidSession === null ||
      isAccountBoundaryInProgress
    ) return;
    let active = true;

    const publishReminderIncident = (
      reason: 'retryable' | 'permission-required' | 'previous-restored' | 'schedule-uncertain',
      error: unknown,
    ): void => {
      logger.error('Failed to reconcile local reminders:', error);
      if (typeof window === 'undefined') return;
      const opensSettings = reason === 'permission-required' || reason === 'schedule-uncertain';
      const message =
        reason === 'permission-required'
          ? t.pushPermissionDenied ||
            t.notificationTestNoPermission ||
            'Turn on notifications for ZenFlow in your device settings.'
          : reason === 'previous-restored'
            ? t.reminderReconcileRestored ||
              'ZenFlow could not apply the latest reminder change. Reminders that are still enabled use their previous schedule.'
            : reason === 'schedule-uncertain'
              ? t.reminderReconcileUncertain ||
                'ZenFlow could not finish updating reminders. Some reminders may be missing or duplicated.'
              : t.reminderReconcileFailed ||
                'ZenFlow could not update reminders. Your device may still use the previous schedule. Try again.';
      window.dispatchEvent(
        new CustomEvent(REMINDER_RECONCILE_FAILED_EVENT, {
          detail: {
            reason,
            message,
            retryLabel: opensSettings
              ? t.settingsGroupReminders || 'Reminder settings'
              : t.retry || 'Retry',
            retry: opensSettings
              ? () => requestReminderSettingsNavigation(reason)
              : () => reminderReconcileRetryRef.current(),
          },
        }),
      );
    };

    const reconcile = async (): Promise<void> => {
      try {
        const assertNotificationSetupCurrent = (): void => {
          if (!active) throw new Error('Notification setup is no longer active');
          if (useAppStore.getState().isAccountBoundaryInProgress) {
            throw new Error('Account cleanup is still in progress');
          }
        };
        assertNotificationSetupCurrent();
        const result = await reconcilePersistedMasterReminders(
          {
            ...reminderCopy,
            quickMoodBody: t.howAreYouNow,
            channelCopy: notificationChannelCopy,
          },
          { assertRequestCurrent: assertNotificationSetupCurrent },
        );
        if (!active) return;
        if (result.status === 'permission-required') {
          if (!permissionIncidentActiveRef.current) {
            permissionIncidentActiveRef.current = true;
            publishReminderIncident(
              'permission-required',
              new Error('Native notification permission is required'),
            );
          }
        } else if (result.status === 'native-restored') {
          permissionIncidentActiveRef.current = false;
          publishReminderIncident('previous-restored', result.error);
        } else if (result.status === 'native-uncertain') {
          permissionIncidentActiveRef.current = false;
          publishReminderIncident('schedule-uncertain', result.error);
        } else {
          permissionIncidentActiveRef.current = false;
        }
      } catch (error) {
        if (!active) return;
        permissionIncidentActiveRef.current = false;
        publishReminderIncident('retryable', error);
      }
    };
    const retryCurrentReconcile = () => {
      void reconcile();
    };
    reminderReconcileRetryRef.current = retryCurrentReconcile;
    const handleLifecycleWake = (event: Event) => {
      const detail = (event as CustomEvent<NativeReminderReconcileEventDetail>).detail;
      if (detail?.reason !== 'app-resume' && detail?.reason !== 'account-cleanup') return;
      void reconcile();
    };
    window.addEventListener(NATIVE_REMINDER_RECONCILE_EVENT, handleLifecycleWake);
    void reconcile();

    return () => {
      active = false;
      window.removeEventListener(NATIVE_REMINDER_RECONCILE_EVENT, handleLifecycleWake);
      if (reminderReconcileRetryRef.current === retryCurrentReconcile) {
        reminderReconcileRetryRef.current = () => undefined;
      }
    };
  }, [
    habits,
    hasValidSession,
    isAccountBoundaryInProgress,
    isUserDataLoading,
    notificationChannelCopy,
    reminderCopy,
    reminders,
    t.howAreYouNow,
    t.notificationTestNoPermission,
    t.pushPermissionDenied,
    t.reminderReconcileFailed,
    t.reminderReconcileRestored,
    t.reminderReconcileUncertain,
    t.retry,
    t.settingsGroupReminders,
    t.viewDetails,
  ]);

  // The journal reminder has its own lifecycle owner. Master reminder or habit
  // changes must not rebuild this unrelated native schedule.
  useEffect(() => {
    if (
      !isNative ||
      isUserDataLoading ||
      hasValidSession === null ||
      isAccountBoundaryInProgress
    ) return;
    let active = true;

    const publishJournalIncident = (error: unknown): void => {
      logger.error('Failed to reconcile the journal reminder:', error);
      if (typeof window === 'undefined') return;
      window.dispatchEvent(
        new CustomEvent(REMINDER_RECONCILE_FAILED_EVENT, {
          detail: {
            reason: 'retryable',
            message:
              t.reminderReconcileFailed ||
              'ZenFlow could not update reminders. Your device may still use the previous schedule. Try again.',
            retryLabel: t.retry || 'Retry',
            retry: () => journalReconcileRetryRef.current(),
          },
        }),
      );
    };

    const reconcileJournal = async (): Promise<void> => {
      try {
        const realm = await readVerifiedNotificationRealm();
        if (!active) return;
        if (useAppStore.getState().isAccountBoundaryInProgress) {
          throw new Error('Account cleanup is still in progress');
        }
        await assertVerifiedNotificationRealmCurrent(realm);
        if (!active) return;
        await reconcileJournalReminderAtStartup({
          reminderTitle: t.journalReminderNotifTitle,
          reminderBody: t.journalReminderNotifBody,
        });
      } catch (error) {
        if (active) publishJournalIncident(error);
      }
    };
    const retryCurrentJournal = () => {
      void reconcileJournal();
    };
    journalReconcileRetryRef.current = retryCurrentJournal;
    const handleLifecycleWake = (event: Event) => {
      const detail = (event as CustomEvent<NativeReminderReconcileEventDetail>).detail;
      if (detail?.reason !== 'app-resume' && detail?.reason !== 'account-cleanup') return;
      void reconcileJournal();
    };
    window.addEventListener(NATIVE_REMINDER_RECONCILE_EVENT, handleLifecycleWake);
    void reconcileJournal();

    return () => {
      active = false;
      window.removeEventListener(NATIVE_REMINDER_RECONCILE_EVENT, handleLifecycleWake);
      if (journalReconcileRetryRef.current === retryCurrentJournal) {
        journalReconcileRetryRef.current = () => undefined;
      }
    };
  }, [
    hasValidSession,
    isAccountBoundaryInProgress,
    isUserDataLoading,
    t.journalReminderNotifBody,
    t.journalReminderNotifTitle,
    t.reminderReconcileFailed,
    t.retry,
  ]);

  // FCM uses a remote device token, so it stays behind explicit privacy consent.
  useEffect(() => {
    if (!isNative) return;
    if (pushNotificationsEnabled) {
      previousPushConsentRef.current = true;
      if (hasValidSession === true && !isAccountBoundaryInProgress) {
        initializePushNotifications().catch((error) => {
          logger.error('Failed to initialize push notifications:', error);
        });
      }
      return;
    }

    if (previousPushConsentRef.current !== true && !pushConsentWasShown) {
      previousPushConsentRef.current = false;
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
          retry: () => revokePushRegistration(),
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
          retry: () => revokePushRegistration(),
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
  }, [
    hasValidSession,
    isAccountBoundaryInProgress,
    pushConsentWasShown,
    pushNotificationsEnabled,
  ]);

  // Set up one-tap mood notification actions
  useEffect(() => {
    if (!isNative) return;
    if (hasValidSession !== true || isAccountBoundaryInProgress) {
      clearMoodActionCallback();
      return;
    }

    let cleanupListener: (() => Promise<void>) | null = null;
    let disposed = false;

    const setupMoodActions = async () => {
      const realm = await readVerifiedNotificationRealm();
      if (realm.kind !== 'account' || disposed) return;
      const assertRealmCurrent = async (): Promise<void> => {
        if (useAppStore.getState().isAccountBoundaryInProgress) {
          throw new Error('Account cleanup is still in progress');
        }
        await assertVerifiedNotificationRealmCurrent(realm);
      };

      await assertRealmCurrent();
      if (disposed) return;
      // Register notification action types (mood emoji buttons)
      await registerMoodNotificationActions();
      await assertRealmCurrent();
      if (disposed) return;

      // Set up listener for action taps
      cleanupListener = await setupNotificationActionListener();

      try {
        await assertRealmCurrent();
      } catch (error) {
        if (cleanupListener) await cleanupListener();
        cleanupListener = null;
        throw error;
      }
      if (disposed) {
        if (cleanupListener) await cleanupListener();
        cleanupListener = null;
        return;
      }

      // Register callback to handle quick mood logging
      setMoodActionCallback(handleQuickMood, realm.ownerUserId);
    };

    setupMoodActions().catch((error) => {
      logger.error('Failed to setup mood notification actions:', error);
    });

    return () => {
      disposed = true;
      clearMoodActionCallback(handleQuickMood);
      if (cleanupListener) void cleanupListener();
    };
  }, [handleQuickMood, hasValidSession, isAccountBoundaryInProgress]);

}
