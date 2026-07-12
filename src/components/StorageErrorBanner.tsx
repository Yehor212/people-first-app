/**
 * Storage Error Banner
 * Shows user-facing notification when storage fails
 * (Safari Private Mode, quota exceeded, etc.)
 */

import { useState, useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { logger } from "@/lib/logger";
import { offlineQueue } from "@/lib/offlineQueue";
import { storageCanWrite } from "@/lib/safeJson";

interface StorageErrorEvent {
  type:
    | "write_failed"
    | "read_failed"
    | "quota_exceeded"
    | "localStorage_write_failed"
    | "persist_failed"
    | "load_failed";
  message: string;
  table?: string;
  key?: string;
  error?: string;
  recoverable?: boolean;
  queueSize?: number;
}

interface IndexedDBTimeoutEvent {
  timeoutMs: number;
  message: string;
}

interface QueueFullEvent {
  queueSize: number;
  maxSize: number;
  message: string;
  actionType?: string;
  entityId?: string;
}

interface RetryableStatusEvent {
  message: string;
  retryLabel: string;
  retry: () => void;
}

interface SessionTimeoutBlockedEvent {
  reason: "pending-changes" | "cleanup-failed" | "sign-out-failed";
  retry: () => void;
}

interface AccountCleanupBlockedEvent {
  retry: () => void;
}

interface CriticalSyncBlockedEvent {
  retry: () => void;
}

/**
 * Detect Safari Private Mode
 * In Private Mode, localStorage quota is 0 and writes throw
 */
function detectPrivateMode(): boolean {
  return !storageCanWrite();
}

export function StorageErrorBanner() {
  const { t } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [alertTitle, setAlertTitle] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<{
    label: string;
    run: () => void;
  } | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const hasCheckedPrivateMode = useRef(false);
  const hasRequestedCriticalReplay = useRef(false);

  // Check for Safari Private Mode on mount
  useEffect(() => {
    if (hasCheckedPrivateMode.current || isDismissed) return;
    hasCheckedPrivateMode.current = true;

    if (detectPrivateMode()) {
      logger.warn("[StorageErrorBanner] Private mode detected");
      setErrorMessage(
        t.storageWarningPrivateMode ||
          "Private/Incognito mode detected. Your data will not be saved.",
      );
      setIsVisible(true);
    }
  }, [isDismissed, t]);

  // Listen for storage errors
  useEffect(() => {
    const handleStorageError = (event: CustomEvent<StorageErrorEvent>) => {
      if (isDismissed) return;

      logger.warn("[StorageErrorBanner] Storage error event:", event.detail);
      setAlertTitle(null);
      setRetryAction(null);
      setErrorMessage(event.detail.message);
      setIsVisible(true);
    };

    // Also listen for offline queue full events
    const handleQueueFull = (event: CustomEvent<QueueFullEvent>) => {
      if (isDismissed) return;

      logger.warn("[StorageErrorBanner] Queue full event:", event.detail);
      setAlertTitle(null);
      setRetryAction(null);
      setErrorMessage(event.detail.message);
      setIsVisible(true);
    };

    // Listen for IndexedDB timeout (data may be stale)
    const handleIndexedDBTimeout = (
      event: CustomEvent<IndexedDBTimeoutEvent>,
    ) => {
      if (isDismissed) return;

      logger.warn("[StorageErrorBanner] IndexedDB timeout:", event.detail);
      setAlertTitle(null);
      setRetryAction(null);
      setErrorMessage(
        event.detail.message || "Data may be outdated. Try restarting the app.",
      );
      setIsVisible(true);
    };

    // Listen for IndexedDB queue overflow
    const handleQueueOverflow = () => {
      if (isDismissed) return;

      logger.warn("[StorageErrorBanner] IndexedDB queue overflow");
      setAlertTitle(null);
      setRetryAction(null);
      setErrorMessage(
        "App is busy processing data. Some operations may be delayed.",
      );
      setIsVisible(true);
    };

    const showRetryableStatus = (
      event: CustomEvent<RetryableStatusEvent>,
      title: string,
      malformedEvent: string,
    ) => {
      const { message, retryLabel, retry } = event.detail;
      if (!message || !retryLabel || typeof retry !== "function") {
        logger.warn(malformedEvent);
        return;
      }

      setIsDismissed(false);
      setAlertTitle(title);
      setErrorMessage(message);
      setRetryAction({ label: retryLabel, run: retry });
      setIsVisible(true);
    };

    const handlePushRevocationIncomplete = (event: CustomEvent<RetryableStatusEvent>) =>
      showRetryableStatus(
        event,
        t.errorBoundaryTitle || "Something went wrong",
        "[StorageErrorBanner] Ignored malformed push revocation event",
      );
    const handleReminderReconcileFailed = (event: CustomEvent<RetryableStatusEvent>) =>
      showRetryableStatus(
        event,
        t.settingsGroupNotifications || t.notifications || "Reminders",
        "[StorageErrorBanner] Ignored malformed reminder reconcile event",
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

      setIsDismissed(false);
      setAlertTitle(t.sessionTimeoutDelayedTitle || "Sign-out delayed");
      setRetryAction({ label: t.retry || "Retry", run: retry });
      setErrorMessage(
        reason === "pending-changes"
          ? t.sessionTimeoutPendingChanges ||
              "ZenFlow kept you signed in because some changes are still waiting to save. It will try again soon."
          : reason === "cleanup-failed"
            ? t.sessionTimeoutCleanupFailed ||
              "ZenFlow kept you signed in because this device could not be cleaned up safely. It will try again soon."
            : t.authSignOutFailed || "Sign-out did not complete. Try again.",
      );
      setIsVisible(true);
    };

    const handleAccountCleanupBlocked = (
      event: CustomEvent<AccountCleanupBlockedEvent>,
    ) => {
      const retry = event.detail?.retry;
      if (typeof retry !== "function") {
        logger.warn("[StorageErrorBanner] Ignored malformed account cleanup event");
        return;
      }

      setIsDismissed(false);
      setAlertTitle(t.sessionTimeoutDelayedTitle || "Finish signing out");
      setErrorMessage(
        t.authSignOutCleanupFailed ||
          "ZenFlow could not finish secure sign-out. Try again.",
      );
      setRetryAction({ label: t.retry || "Retry", run: retry });
      setIsVisible(true);
    };

    const handleCriticalSyncBlocked = (
      event: CustomEvent<CriticalSyncBlockedEvent>,
    ) => {
      if (typeof event.detail?.retry !== "function") {
        logger.warn("[StorageErrorBanner] Ignored malformed critical sync event");
        return;
      }
      setIsDismissed(false);
      setAlertTitle(t.settingsCloudSyncTitle || "Online backup");
      setErrorMessage(
        t.syncCriticalBlocked ||
          "An important online save could not finish. Your change is still on this device. Try again when connected.",
      );
      setRetryAction({ label: t.retry || "Retry", run: event.detail.retry });
      setIsVisible(true);
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
      "zenflow:offline-queue-critical-blocked",
      handleCriticalSyncBlocked as EventListener,
    );

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
        "zenflow:offline-queue-critical-blocked",
        handleCriticalSyncBlocked as EventListener,
      );
    };
  }, [
    isDismissed,
    t.errorBoundaryTitle,
    t.authSignOutCleanupFailed,
    t.authSignOutFailed,
    t.sessionTimeoutCleanupFailed,
    t.sessionTimeoutDelayedTitle,
    t.sessionTimeoutPendingChanges,
    t.settingsGroupNotifications,
    t.settingsCloudSyncTitle,
    t.notifications,
    t.syncCriticalBlocked,
    t.retry,
  ]);

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    setRetryAction(null);
  };

  const handleRetry = () => {
    const retry = retryAction?.run;
    setIsVisible(false);
    setRetryAction(null);
    retry?.();
  };

  if (!isVisible) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-[calc(5rem+var(--safe-bottom))] left-4 right-4 z-50 motion-safe:animate-slide-up"
    >
      <div className="bg-amber-500/95 dark:bg-amber-600/95 text-white rounded-xl p-4 shadow-lg backdrop-blur-sm flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">
            {alertTitle || t.storageWarningTitle || "Storage Warning"}
          </p>
          <p className="text-xs opacity-90 mt-0.5">
            {errorMessage ||
              t.storageWarningMessage ||
              "Data may not be saved. Try disabling Private Mode or clearing storage."}
          </p>
        </div>
        {retryAction && (
          <button
            type="button"
            onClick={handleRetry}
            className="min-h-[44px] shrink-0 rounded-lg px-3 text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
          >
            {retryAction.label}
          </button>
        )}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t.close || "Close"}
          className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-foreground/20 rounded-lg motion-safe:transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default StorageErrorBanner;
