/**
 * React hook for offline queue status
 * Provides reactive state for UI components
 */

import { useState, useEffect, useCallback } from 'react';
import { offlineQueue, type OfflineAction } from '@/lib/offlineQueue';

interface OfflineQueueState {
  actions: OfflineAction[];
  lastProcessedAt: number | null;
  isProcessing: boolean;
}

export function useOfflineQueue() {
  const [state, setState] = useState<OfflineQueueState>(offlineQueue.getState());
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const unsubscribe = offlineQueue.subscribe(setState);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const processQueue = useCallback(() => {
    return offlineQueue.processQueue();
  }, []);

  const clearQueue = useCallback(() => {
    offlineQueue.clearQueue();
  }, []);

  return {
    /** Number of actions waiting to be synced */
    pendingCount: state.actions.length,
    /** Whether the queue is currently processing */
    isProcessing: state.isProcessing,
    /** Whether the device is online */
    isOnline,
    /** Whether there are any pending actions */
    hasPendingActions: state.actions.length > 0,
    /** Timestamp of last successful processing */
    lastProcessedAt: state.lastProcessedAt,
    /** Manually trigger queue processing */
    processQueue,
    /** Clear all pending actions (use with caution) */
    clearQueue,
    /** Full list of pending actions (for debugging) */
    actions: state.actions,
  };
}

export default useOfflineQueue;
