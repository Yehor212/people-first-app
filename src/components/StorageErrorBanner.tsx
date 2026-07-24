import { useEffect, useReducer, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useActiveAriaModal } from "@/hooks/useActiveAriaModal";
import { logger } from "@/lib/logger";
import {
  clearAccountCleanupRecovery,
  getAccountCleanupRecovery,
  retainAccountCleanupRecovery,
} from "@/lib/accountCleanupRecoveryState";
import { offlineQueue } from "@/lib/offlineQueue";
import { StorageIncidentBanner } from "./StorageIncidentBanner";
import { useStoragePrivateModeIncident } from "./useStoragePrivateModeIncident";
import {
  INITIAL_STORAGE_INCIDENT_STATE,
  storageIncidentReducer,
  type AccountCleanupBlockedEvent,
  type CriticalSyncBlockedEvent,
  type IndexedDBTimeoutEvent,
  type QueueFullEvent,
  type RetryableStatusEvent,
  type SessionTimeoutBlockedEvent,
  type SettingsPostCommitIncidentEvent,
  type StorageErrorEvent,
} from "./storageErrorIncidentState";

const CRITICAL_SYNC_BLOCKED_EVENTS = ["zenflow:offline-queue-critical-blocked", "zenflow:offline-queue-blocked"] as const;

export function StorageErrorBanner() {
  const { t } = useLanguage();
  const hasActiveModal = useActiveAriaModal();
  const [incidentState, dispatchIncident] = useReducer(
    storageIncidentReducer,
    INITIAL_STORAGE_INCIDENT_STATE,
  );
  const hasRequestedCriticalReplay = useRef(false);
  const activeIncident = incidentState.active;
  const activeIncidentRef = useRef(activeIncident);
  activeIncidentRef.current = activeIncident;
  const retryingIncidentKeyRef = useRef<string | null>(null);
  const [retryingIncidentKey, setRetryingIncidentKey] = useState<string | null>(null);
  useStoragePrivateModeIncident(
    t.storageWarningPrivateMode ||
      "Private/Incognito mode detected. Your data will not be saved.",
    dispatchIncident,
  );

  // Listen for storage errors
  useEffect(() => {
    const handleStorageError = (event: CustomEvent<StorageErrorEvent>) => {
      logger.warn("[StorageErrorBanner] Storage error event:", event.detail);
      dispatchIncident({
        type: "present",
        incident: {
          key: "storage-error",
          priority: 1,
          title: null,
          message: event.detail.message,
          retryAction: null,
        },
      });
    };

    // Also listen for offline queue full events
    const handleQueueFull = (event: CustomEvent<QueueFullEvent>) => {
      logger.warn("[StorageErrorBanner] Queue full event:", event.detail);
      dispatchIncident({
        type: "present",
        incident: {
          key: "offline-queue-full",
          priority: 2,
          title: null,
          message: event.detail.message,
          retryAction: null,
        },
      });
    };

    // Listen for IndexedDB timeout (data may be stale)
    const handleIndexedDBTimeout = (
      event: CustomEvent<IndexedDBTimeoutEvent>,
    ) => {
      logger.warn("[StorageErrorBanner] IndexedDB timeout:", event.detail);
      dispatchIncident({
        type: "present",
        incident: {
          key: "indexeddb-timeout",
          priority: 1,
          title: null,
          message:
            event.detail.message || "Data may be outdated. Try restarting the app.",
          retryAction: null,
        },
      });
    };

    // Listen for IndexedDB queue overflow
    const handleQueueOverflow = () => {
      logger.warn("[StorageErrorBanner] IndexedDB queue overflow");
      dispatchIncident({
        type: "present",
        incident: {
          key: "indexeddb-queue-overflow",
          priority: 1,
          title: null,
          message: "App is busy processing data. Some operations may be delayed.",
          retryAction: null,
        },
      });
    };

    const showRetryableStatus = (
      event: CustomEvent<RetryableStatusEvent>,
      title: string,
      malformedEvent: string,
      key: string,
    ) => {
      const { message, retryLabel, retry } = event.detail;
      if (!message || !retryLabel || typeof retry !== "function") {
        logger.warn(malformedEvent);
        return;
      }

      dispatchIncident({
        type: "present",
        incident: {
          key,
          priority: 2,
          title,
          message,
          retryAction: { label: retryLabel, run: retry },
        },
      });
    };

    const handlePushRevocationIncomplete = (event: CustomEvent<RetryableStatusEvent>) =>
      showRetryableStatus(
        event,
        t.errorBoundaryTitle || "Something went wrong",
        "[StorageErrorBanner] Ignored malformed push revocation event",
        "push-revocation",
      );
    const handleReminderReconcileFailed = (event: CustomEvent<RetryableStatusEvent>) =>
      showRetryableStatus(
        event,
        t.settingsGroupNotifications || t.notifications || "Reminders",
        "[StorageErrorBanner] Ignored malformed reminder reconcile event",
        "reminder-reconcile",
      );

    const handleSessionTimeoutBlocked = (
      event: CustomEvent<SessionTimeoutBlockedEvent>,
    ) => {
      const reason = event.detail?.reason;
      const retry = event.detail?.retry;
      if (
        (reason !== "pending-changes" &&
          reason !== "cleanup-failed" &&
          reason !== "sign-out-failed") ||
        typeof retry !== "function"
      ) {
        logger.warn("[StorageErrorBanner] Ignored malformed session timeout event");
        return;
      }

      dispatchIncident({
        type: "present",
        incident: {
          key: "session-timeout",
          priority: 3,
          title: t.sessionTimeoutDelayedTitle || "Automatic sign-out delayed",
          retryAction: { label: t.retry || "Retry", run: retry },
          message:
            reason === "pending-changes"
              ? t.sessionTimeoutPendingChanges ||
                "Automatic sign-out was delayed because some changes are still waiting to save. ZenFlow will try again soon."
              : reason === "cleanup-failed"
                ? t.sessionTimeoutCleanupFailed ||
                  "ZenFlow kept you signed in because automatic sign-out could not finish safely. It will try again soon."
                : t.authSignOutFailed || "Sign-out did not complete. Try again.",
        },
      });
    };

    const handleAccountCleanupBlocked = (
      event: CustomEvent<AccountCleanupBlockedEvent>,
    ) => {
      const retry = event.detail?.retry;
      if (typeof retry !== "function") {
        logger.warn("[StorageErrorBanner] Ignored malformed account cleanup event");
        return;
      }

      const existingRecovery = getAccountCleanupRecovery();
      const recovery =
        existingRecovery?.retry === retry
          ? existingRecovery
          : retainAccountCleanupRecovery(retry);

      dispatchIncident({
        type: "present",
        incident: {
          key: "account-cleanup",
          priority: 3,
          title: t.authSignOutRecoveryTitle || "Finish signing out",
          message:
            t.authSignOutCleanupFailed ||
            "ZenFlow could not finish secure sign-out. Try again.",
          retryAction: {
            label: t.retry || "Retry",
            run: async () => {
              await retry();
              clearAccountCleanupRecovery(recovery.version);
            },
          },
        },
      });
    };

    const handleCriticalSyncBlocked = (
      event: CustomEvent<CriticalSyncBlockedEvent>,
    ) => {
      if (typeof event.detail?.retry !== "function") {
        logger.warn("[StorageErrorBanner] Ignored malformed critical sync event");
        return;
      }
      dispatchIncident({
        type: "present",
        incident: {
          key: "critical-sync",
          priority: 3,
          title: t.settingsCloudSyncTitle || "Online backup",
          message:
            t.syncCriticalBlocked ||
            "An important online save could not finish. Your change is still on this device. Try again when connected.",
          retryAction: { label: t.retry || "Retry", run: event.detail.retry },
        },
      });
    };

    const handleSettingsPostCommitIncident = (
      event: CustomEvent<SettingsPostCommitIncidentEvent>,
    ) => {
      const issueKinds = event.detail?.issueKinds;
      if (
        !Array.isArray(issueKinds) ||
        issueKinds.length === 0 ||
        issueKinds.some(
          (kind) => kind !== "deferred-write-replay" && kind !== "mounted-refresh",
        )
      ) {
        logger.warn("[StorageErrorBanner] Ignored malformed Settings post-commit event");
        return;
      }
      const refreshOnly = issueKinds.every((kind) => kind === "mounted-refresh");
      const refresh = refreshOnly && typeof event.detail.retry === "function"
        ? event.detail.retry
        : null;
      dispatchIncident({
        type: "present",
        incident: {
          key: "settings-post-commit",
          priority: 2,
          title: t.storageError || "Storage error",
          message: refreshOnly
            ? t.settingsPostCommitRefresh ||
              "This setting was saved, but the screen may not show the latest value yet."
            : t.settingsPostCommitDeferred ||
              "This setting was saved, but another change on this device could not finish saving.",
          retryAction: refresh
            ? { label: t.refresh || "Refresh", run: refresh }
            : null,
        },
      });
    };

    window.addEventListener(
      "zenflow:storage-error",
      handleStorageError as EventListener,
    );
    window.addEventListener(
      "zenflow:offline-queue-full",
      handleQueueFull as EventListener,
    );
    window.addEventListener(
      "zenflow:indexeddb-timeout",
      handleIndexedDBTimeout as EventListener,
    );
    window.addEventListener(
      "zenflow:indexeddb-queue-overflow",
      handleQueueOverflow,
    );
    window.addEventListener(
      "zenflow:push-revocation-incomplete",
      handlePushRevocationIncomplete as EventListener,
    );
    window.addEventListener(
      "zenflow:reminder-reconcile-failed",
      handleReminderReconcileFailed as EventListener,
    );
    window.addEventListener(
      "zenflow:session-timeout-blocked",
      handleSessionTimeoutBlocked as EventListener,
    );
    window.addEventListener(
      "zenflow:account-cleanup-blocked",
      handleAccountCleanupBlocked as EventListener,
    );
    window.addEventListener(
      "zenflow:settings-post-commit-incident",
      handleSettingsPostCommitIncident as EventListener,
    );
    for (const eventName of CRITICAL_SYNC_BLOCKED_EVENTS) {
      window.addEventListener(eventName, handleCriticalSyncBlocked as EventListener);
    }

    if (!hasRequestedCriticalReplay.current) {
      hasRequestedCriticalReplay.current = true;
      void offlineQueue.replayBlockedCriticalActionsForActiveOwner().catch((error) => {
        logger.warn("[StorageErrorBanner] Failed to replay blocked sync actions", error);
      });
    }

    return () => {
      window.removeEventListener(
        "zenflow:storage-error",
        handleStorageError as EventListener,
      );
      window.removeEventListener(
        "zenflow:offline-queue-full",
        handleQueueFull as EventListener,
      );
      window.removeEventListener(
        "zenflow:indexeddb-timeout",
        handleIndexedDBTimeout as EventListener,
      );
      window.removeEventListener(
        "zenflow:indexeddb-queue-overflow",
        handleQueueOverflow,
      );
      window.removeEventListener(
        "zenflow:push-revocation-incomplete",
        handlePushRevocationIncomplete as EventListener,
      );
      window.removeEventListener(
        "zenflow:reminder-reconcile-failed",
        handleReminderReconcileFailed as EventListener,
      );
      window.removeEventListener(
        "zenflow:session-timeout-blocked",
        handleSessionTimeoutBlocked as EventListener,
      );
      window.removeEventListener(
        "zenflow:account-cleanup-blocked",
        handleAccountCleanupBlocked as EventListener,
      );
      window.removeEventListener(
        "zenflow:settings-post-commit-incident",
        handleSettingsPostCommitIncident as EventListener,
      );
      for (const eventName of CRITICAL_SYNC_BLOCKED_EVENTS) {
        window.removeEventListener(eventName, handleCriticalSyncBlocked as EventListener);
      }
    };
  }, [
    t.errorBoundaryTitle,
    t.authSignOutRecoveryTitle,
    t.authSignOutCleanupFailed,
    t.authSignOutFailed,
    t.sessionTimeoutCleanupFailed,
    t.sessionTimeoutDelayedTitle,
    t.sessionTimeoutPendingChanges,
    t.settingsGroupNotifications,
    t.settingsCloudSyncTitle,
    t.notifications,
    t.syncCriticalBlocked,
    t.settingsPostCommitDeferred,
    t.settingsPostCommitRefresh,
    t.refresh,
    t.retry,
    t.storageError,
    t.storageErrorDesc,
  ]);

  const handleDismiss = () => {
    dispatchIncident({ type: "advance" });
  };

  const handleRetry = async () => {
    const incident = activeIncident;
    const retry = incident?.retryAction?.run;
    if (!incident || !retry || retryingIncidentKeyRef.current !== null) return;

    retryingIncidentKeyRef.current = incident.key;
    setRetryingIncidentKey(incident.key);
    let completed = false;
    try {
      await retry();
      completed = true;
    } catch (error) {
      logger.warn("[StorageErrorBanner] Retry action failed:", error);
    } finally {
      retryingIncidentKeyRef.current = null;
      setRetryingIncidentKey(null);
      if (completed && activeIncidentRef.current === incident) {
        dispatchIncident({ type: "advance" });
      }
    }
  };

  if (!activeIncident || hasActiveModal) return null;

  const { title: alertTitle, message: errorMessage, retryAction } = activeIncident;

  return (
    <StorageIncidentBanner
      title={alertTitle || t.storageWarningTitle || "Storage Warning"}
      message={
        errorMessage ||
        t.storageWarningMessage ||
        "Data may not be saved. Try disabling Private Mode or clearing storage."
      }
      retryLabel={retryAction?.label}
      onRetry={retryAction ? handleRetry : undefined}
      isRetrying={retryingIncidentKey === activeIncident.key}
      closeLabel={t.close || "Close"}
      onDismiss={handleDismiss}
    />
  );
}

export default StorageErrorBanner;
