/**
 * DatabaseRecoveryDialog
 *
 * Shows when IndexedDB cannot be read reliably.
 * Retries the local health check without deleting or replacing saved data.
 */

import { useEffect, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBackHandler } from '@/hooks/useBackHandler';
import { Database, RefreshCw } from 'lucide-react';
import { checkDatabaseHealth } from '@/storage/db';
import { triggerDataRefresh } from '@/hooks/useIndexedDB';

import { logger } from '@/lib/logger';

export function DatabaseRecoveryDialog() {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const isRetryingRef = useRef(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useBackHandler(isOpen && !isRetrying, () => setIsOpen(false));

  useEffect(() => {
    const handleRecoveryNeeded = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      logger.log('[DatabaseRecovery] Recovery needed:', detail);
      if (!previousFocusRef.current?.isConnected) {
        previousFocusRef.current =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
      }
      setIsOpen(true);
    };

    const handleRecoveryFailed = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      logger.error('[DatabaseRecovery] Recovery failed:', detail);
    };

    window.addEventListener('zenflow:database-recovery-needed', handleRecoveryNeeded);
    window.addEventListener('zenflow:database-recovery-failed', handleRecoveryFailed);

    return () => {
      window.removeEventListener('zenflow:database-recovery-needed', handleRecoveryNeeded);
      window.removeEventListener('zenflow:database-recovery-failed', handleRecoveryFailed);
    };
  }, [t]);

  const handleRetry = async () => {
    isRetryingRef.current = true;
    setIsRetrying(true);
    try {
      const healthy = await checkDatabaseHealth();
      if (!healthy) return;
      await triggerDataRefresh();
      setIsOpen(false);
    } catch (error) {
      logger.error('[DatabaseRecovery] Health retry failed:', error);
    } finally {
      isRetryingRef.current = false;
      setIsRetrying(false);
    }
  };

  const handleNotNow = () => {
    setIsOpen(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isRetryingRef.current) return;
    setIsOpen(nextOpen);
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogContent
        className="max-w-md"
        onCloseAutoFocus={(event) => {
          const previousFocus = previousFocusRef.current;
          previousFocusRef.current = null;
          if (!previousFocus?.isConnected) return;

          // The modal's outside-content guards are still active during this
          // callback, so an immediate focus() can be rejected by WebView.
          event.preventDefault();
          window.requestAnimationFrame(() => {
            if (previousFocus.isConnected) {
              previousFocus.focus({ preventScroll: true });
            }
          });
        }}
      >
        <AlertDialogHeader>
          <div className="mb-2 grid min-w-0 grid-cols-1 items-center gap-3 min-[420px]:grid-cols-[auto_minmax(0,1fr)]">
            <div className="justify-self-center rounded-full bg-amber-500/10 p-2 min-[420px]:justify-self-auto">
              <Database className="h-6 w-6 text-amber-500" />
            </div>
            <AlertDialogTitle className="text-center min-[420px]:text-start">
              {t.databaseRecoveryTitle || 'Your saved data is temporarily unavailable'}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-start">
            {t.databaseRecoveryDesc ||
              'ZenFlow did not delete anything. Keep the app open and try again.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel
            onClick={handleNotNow}
            disabled={isRetrying}
            className="flex w-full items-center gap-2 md:w-auto"
          >
            <RefreshCw className="h-4 w-4" />
            {t.databaseRecoveryStartFresh || 'Not now'}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRetry}
            disabled={isRetrying}
            className="flex w-full items-center gap-2 md:w-auto"
          >
            {isRetrying ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Database className="h-4 w-4" />
            )}
            {isRetrying
              ? (t.databaseRecoveryChecking || 'Checking...')
              : (t.databaseRecoveryRestore || 'Try again')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
