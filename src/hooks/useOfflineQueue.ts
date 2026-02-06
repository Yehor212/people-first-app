/**
 * React hook for offline queue status
 * Provides reactive state for UI components
 *
 * P0-1 Fix: clearQueue now properly returns the Promise
 * P1-5 Fix: Event handlers use useCallback for stable references
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

  // P1-5 Fix: Stable callback references for event handlers
  const handleOnline = useCallback(() => setIsOnline(true), []);
  const handleOffline = useCallback(() => setIsOnline(false), []);

  useEffect(() => {
    const unsubscribe = offlineQueue.subscribe(setState);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  // Returns Promise for callers who need to await completion
  const processQueue = useCallback((): Promise<void> => {
    return offlineQueue.processQueue();
  }, []);

  // P0-1 Fix: Return the Promise so callers can await if needed
  // This prevents silent failures where async operations complete unobserved
  const clearQueue = useCallback((): Promise<void> => {
    return offlineQueue.clearQueue();
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
    /** Manually trigger queue processing (returns Promise) */
    processQueue,
    /** Clear all pending actions - returns Promise (use with caution) */
    clearQueue,
    /** Full list of pending actions (for debugging) */
    actions: state.actions,
  };
}

export default useOfflineQueue;
