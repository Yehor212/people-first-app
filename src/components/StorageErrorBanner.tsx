/**
 * Storage Error Banner
 * Shows user-facing notification when storage fails
 * (Safari Private Mode, quota exceeded, etc.)
 */

import { useState, useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { logger } from "@/lib/logger";
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
  const [isDismissed, setIsDismissed] = useState(false);
  const hasCheckedPrivateMode = useRef(false);

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
      setErrorMessage(event.detail.message);
      setIsVisible(true);
    };

    // Also listen for offline queue full events
    const handleQueueFull = (event: CustomEvent<QueueFullEvent>) => {
      if (isDismissed) return;

      logger.warn("[StorageErrorBanner] Queue full event:", event.detail);
      setErrorMessage(event.detail.message);
      setIsVisible(true);
    };

    // Listen for IndexedDB timeout (data may be stale)
    const handleIndexedDBTimeout = (
      event: CustomEvent<IndexedDBTimeoutEvent>,
    ) => {
      if (isDismissed) return;

      logger.warn("[StorageErrorBanner] IndexedDB timeout:", event.detail);
      setErrorMessage(
        event.detail.message || "Data may be outdated. Try restarting the app.",
      );
      setIsVisible(true);
    };

    // Listen for IndexedDB queue overflow
    const handleQueueOverflow = () => {
      if (isDismissed) return;

      logger.warn("[StorageErrorBanner] IndexedDB queue overflow");
      setErrorMessage(
        "App is busy processing data. Some operations may be delayed.",
      );
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
    };
  }, [isDismissed]);

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
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
            {t.storageWarningTitle || "Storage Warning"}
          </p>
          <p className="text-xs opacity-90 mt-0.5">
            {errorMessage ||
              t.storageWarningMessage ||
              "Data may not be saved. Try disabling Private Mode or clearing storage."}
          </p>
        </div>
        <button
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
