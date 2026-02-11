/**
 * OfflineBanner
 * Shows a prominent banner when user is offline
 *
 * Features:
 * - Auto-shows when offline detected
 * - Shows pending action count from offline queue
 * - Dismissable but reappears if still offline
 * - Listens for data drop warnings
 */

import { useState, useEffect } from 'react';
import { WifiOff, X, AlertTriangle, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { motion, AnimatePresence } from 'framer-motion';

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isDismissed, setIsDismissed] = useState(false);
  const [dataDropWarning, setDataDropWarning] = useState<string | null>(null);
  const { pendingCount } = useOfflineQueue();
  const { t } = useLanguage();

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setIsDismissed(false); // Reset dismiss on reconnect
      setDataDropWarning(null);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setIsDismissed(false); // Show banner immediately when going offline
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen for data drop warnings from offline queue
  useEffect(() => {
    const handleDataDrop = (event: CustomEvent<{ message: string }>) => {
      setDataDropWarning(event.detail.message);
      setIsDismissed(false); // Force show warning
    };

    window.addEventListener('zenflow:offline-data-dropped', handleDataDrop as EventListener);

    return () => {
      window.removeEventListener('zenflow:offline-data-dropped', handleDataDrop as EventListener);
    };
  }, []);

  // Don't render if online and no warning, or if dismissed
  if ((isOnline && !dataDropWarning) || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    // Clear data drop warning after dismissing
    if (dataDropWarning) {
      setDataDropWarning(null);
    }
  };

  const handleRetry = () => {
    // Trigger a manual sync attempt
    window.dispatchEvent(new CustomEvent('zenflow:manual-sync-request'));
    // Also try to check connection
    fetch('/favicon.ico', { method: 'HEAD', cache: 'no-cache' })
      .then(() => setIsOnline(true))
      .catch(() => setIsOnline(false));
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className={`fixed top-0 left-0 right-0 z-[999] px-4 py-2 safe-area-top ${
          dataDropWarning ? 'bg-red-500' : 'bg-amber-500'
        } text-white shadow-lg`}
        role="alert"
        aria-live="polite"
      >
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
          {/* Icon and message */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {dataDropWarning ? (
              <AlertTriangle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            ) : (
              <WifiOff className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            )}

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {dataDropWarning || (t.offlineBannerTitle || 'You are offline')}
              </p>
              {!dataDropWarning && pendingCount > 0 && (
                <p className="text-xs opacity-90 truncate">
                  {pendingCount} {t.offlineBannerPending || 'changes waiting to sync'}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {!isOnline && (
              <button
                onClick={handleRetry}
                className="p-1.5 rounded-lg bg-foreground/20 hover:bg-foreground/30 transition-colors"
                aria-label={t.offlineBannerRetry || 'Retry connection'}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-lg bg-foreground/20 hover:bg-foreground/30 transition-colors"
              aria-label={t.offlineBannerDismiss || 'Dismiss'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default OfflineBanner;
