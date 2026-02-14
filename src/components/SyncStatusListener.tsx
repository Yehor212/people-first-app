/**
 * SyncStatusListener
 *
 * Listens for sync-related custom events and shows toast notifications.
 * Events:
 * - zenflow:offline-queue-full: Queue has reached max capacity
 * - zenflow:offline-queue-warning: Queue is getting full (>80%)
 * - zenflow:sync-failure: Sync operation failed
 * - zenflow:sync-success: Sync completed successfully
 * - zenflow:storage-error: Storage (IndexedDB) error
 * - zenflow:sync-transaction-failed: Database transaction failed
 * - zenflow:background-sync-failed: Background sync API failed
 */

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { WifiOff, AlertTriangle, CheckCircle2, Database, RefreshCw } from 'lucide-react';
import { offlineQueue } from '@/lib/offlineQueue';
import { logger } from '@/lib/logger';

export function SyncStatusListener() {
  const { t } = useLanguage();
  // Prevent duplicate toasts within short time window
  const lastToastTime = useRef<Record<string, number>>({});
  const TOAST_DEBOUNCE_MS = 5000; // 5 seconds between same toast type

  const shouldShowToast = (type: string): boolean => {
    const now = Date.now();
    const lastTime = lastToastTime.current[type] || 0;
    if (now - lastTime < TOAST_DEBOUNCE_MS) {
      return false;
    }
    lastToastTime.current[type] = now;
    return true;
  };

  useEffect(() => {
    // Handler: Offline queue is full
    const handleQueueFull = (e: Event) => {
      if (!shouldShowToast('queue-full')) return;
      const _detail = (e as CustomEvent).detail;
      toast.error(t.syncQueueFull || 'Sync queue is full', {
        description: t.syncQueueFullDesc || 'Some changes may not sync. Please connect to the internet.',
        icon: <WifiOff className="h-4 w-4" />,
        duration: 8000,
        action: {
          label: t.syncNow || 'Sync now',
          onClick: () => {
            void offlineQueue.processQueue();
          },
        },
      });
    };

    // Handler: Offline queue warning (>80% full)
    const handleQueueWarning = (e: Event) => {
      if (!shouldShowToast('queue-warning')) return;
      const _detail = (e as CustomEvent).detail;
      toast.warning(t.syncQueueWarning || 'Sync queue filling up', {
        description: t.syncQueueWarningDesc || 'Connect to the internet to sync your changes.',
        icon: <AlertTriangle className="h-4 w-4" />,
        duration: 5000,
      });
    };

    // Handler: Sync failure — only show after multiple consecutive failures
    const handleSyncFailure = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      // Only notify user after 3+ consecutive failures (shouldNotify flag from cloudSync)
      if (!detail?.shouldNotify) return;
      if (!shouldShowToast('sync-failure')) return;
      toast.error(t.syncError || 'Sync failed', {
        description: t.syncFailedLocal || 'Changes saved locally. Will retry when online.',
        icon: <AlertTriangle className="h-4 w-4" />,
        duration: 5000,
      });
    };

    // Handler: Sync success
    const handleSyncSuccess = (_e: Event) => {
      if (!shouldShowToast('sync-success')) return;
      toast.success(t.syncSuccess || 'Sync complete', {
        icon: <CheckCircle2 className="h-4 w-4" />,
        duration: 3000,
      });
    };

    // Handler: Storage error
    const handleStorageError = (e: Event) => {
      if (!shouldShowToast('storage-error')) return;
      const _detail = (e as CustomEvent).detail;
      toast.error(t.storageError || 'Storage error', {
        description: t.storageErrorDesc || 'There was a problem saving your data locally.',
        icon: <Database className="h-4 w-4" />,
        duration: 6000,
      });
    };

    // Handler: Transaction failed
    const handleTransactionFailed = (e: Event) => {
      if (!shouldShowToast('transaction-failed')) return;
      const _detail = (e as CustomEvent).detail;
      toast.error(t.syncTransactionFailed || 'Data save failed', {
        description: t.syncTransactionFailedDesc || 'Could not save data. Please try again.',
        icon: <Database className="h-4 w-4" />,
        duration: 6000,
      });
    };

    // Handler: Background sync failed
    const handleBackgroundSyncFailed = (_e: Event) => {
      if (!shouldShowToast('background-sync-failed')) return;
      toast.warning(t.backgroundSyncFailed || 'Background sync unavailable', {
        description: t.backgroundSyncFailedDesc || 'Changes will sync when you return to the app.',
        icon: <RefreshCw className="h-4 w-4" />,
        duration: 5000,
      });
    };

    // Handler: IndexedDB timeout — suppressed for end users
    // IndexedDB contention during backup sync causes false positives.
    // Data loads via fallback, then real data arrives. Not actionable by users.
    const handleIndexedDBTimeout = (_e: Event) => {
      logger.debug('[SyncStatus] IndexedDB timeout — suppressed toast (data loads via fallback)');
    };

    // Register all event listeners
    window.addEventListener('zenflow:offline-queue-full', handleQueueFull);
    window.addEventListener('zenflow:offline-queue-warning', handleQueueWarning);
    window.addEventListener('zenflow:sync-failure', handleSyncFailure);
    window.addEventListener('zenflow:sync-success', handleSyncSuccess);
    window.addEventListener('zenflow:storage-error', handleStorageError);
    window.addEventListener('zenflow:sync-transaction-failed', handleTransactionFailed);
    window.addEventListener('zenflow:background-sync-failed', handleBackgroundSyncFailed);
    window.addEventListener('zenflow:indexeddb-timeout', handleIndexedDBTimeout);

    // Cleanup
    return () => {
      window.removeEventListener('zenflow:offline-queue-full', handleQueueFull);
      window.removeEventListener('zenflow:offline-queue-warning', handleQueueWarning);
      window.removeEventListener('zenflow:sync-failure', handleSyncFailure);
      window.removeEventListener('zenflow:sync-success', handleSyncSuccess);
      window.removeEventListener('zenflow:storage-error', handleStorageError);
      window.removeEventListener('zenflow:sync-transaction-failed', handleTransactionFailed);
      window.removeEventListener('zenflow:background-sync-failed', handleBackgroundSyncFailed);
      window.removeEventListener('zenflow:indexeddb-timeout', handleIndexedDBTimeout);
    };
  }, [t]);

  // This component doesn't render anything - it only listens for events
  return null;
}
