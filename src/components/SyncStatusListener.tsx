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
      const detail = (e as CustomEvent).detail;
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
      const detail = (e as CustomEvent).detail;
      toast.warning(t.syncQueueWarning || 'Sync queue filling up', {
        description: t.syncQueueWarningDesc || 'Connect to the internet to sync your changes.',
        icon: <AlertTriangle className="h-4 w-4" />,
        duration: 5000,
      });
    };

    // Handler: Sync failure
    const handleSyncFailure = (e: Event) => {
      if (!shouldShowToast('sync-failure')) return;
      const detail = (e as CustomEvent).detail;
      toast.error(t.syncError || 'Sync failed', {
        description: t.syncFailedLocal || 'Changes saved locally. Will retry when online.',
        icon: <AlertTriangle className="h-4 w-4" />,
        duration: 5000,
      });
    };

    // Handler: Sync success
    const handleSyncSuccess = (e: Event) => {
      if (!shouldShowToast('sync-success')) return;
      toast.success(t.syncSuccess || 'Sync complete', {
        icon: <CheckCircle2 className="h-4 w-4" />,
        duration: 3000,
      });
    };

    // Handler: Storage error
    const handleStorageError = (e: Event) => {
      if (!shouldShowToast('storage-error')) return;
      const detail = (e as CustomEvent).detail;
      toast.error(t.storageError || 'Storage error', {
        description: t.storageErrorDesc || 'There was a problem saving your data locally.',
        icon: <Database className="h-4 w-4" />,
        duration: 6000,
      });
    };

    // Handler: Transaction failed
    const handleTransactionFailed = (e: Event) => {
      if (!shouldShowToast('transaction-failed')) return;
      const detail = (e as CustomEvent).detail;
      toast.error(t.syncTransactionFailed || 'Data save failed', {
        description: t.syncTransactionFailedDesc || 'Could not save data. Please try again.',
        icon: <Database className="h-4 w-4" />,
        duration: 6000,
      });
    };

    // Handler: Background sync failed
    const handleBackgroundSyncFailed = (e: Event) => {
      if (!shouldShowToast('background-sync-failed')) return;
      toast.warning(t.backgroundSyncFailed || 'Background sync unavailable', {
        description: t.backgroundSyncFailedDesc || 'Changes will sync when you return to the app.',
        icon: <RefreshCw className="h-4 w-4" />,
        duration: 5000,
      });
    };

    // Handler: IndexedDB timeout
    const handleIndexedDBTimeout = (e: Event) => {
      if (!shouldShowToast('indexeddb-timeout')) return;
      toast.warning(t.indexedDBTimeout || 'Storage is slow', {
        description: t.indexedDBTimeoutDesc || 'The database is taking longer than expected.',
        icon: <Database className="h-4 w-4" />,
        duration: 5000,
      });
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
