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

import { useCallback, useEffect, useRef, useState } from 'react';
import { WifiOff, X, AlertTriangle, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { useActiveAriaModal } from '@/hooks/useActiveAriaModal';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { logger } from '@/lib/logger';
import { BASE_URL } from '@/lib/env';
import { plural } from '@/lib/plural';

const CONNECTIVITY_PROBE_TIMEOUT_MS = 5000;
type DataDropReason = 'storage-limit';

export function getConnectivityProbeUrl(): string {
  if (typeof window === 'undefined') {
    return '/favicon.ico';
  }

  try {
    if (BASE_URL === './') {
      return new URL('favicon.ico', window.location.href).href;
    }

    return new URL('favicon.ico', new URL(BASE_URL || '/', window.location.origin)).href;
  } catch {
    return '/favicon.ico';
  }
}

async function probeConnectivity(signal?: AbortSignal): Promise<boolean> {
  const response = await fetch(getConnectivityProbeUrl(), {
    method: 'HEAD',
    cache: 'no-cache',
    signal,
  });

  return response.ok;
}

async function probeConnectivityWithTimeout(controller: AbortController): Promise<boolean> {
  const timeoutId = window.setTimeout(() => controller.abort(), CONNECTIVITY_PROBE_TIMEOUT_MS);
  try {
    return await probeConnectivity(controller.signal);
  } finally {
    window.clearTimeout(timeoutId);
  }
}
export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [dataDropWarning, setDataDropWarning] = useState<DataDropReason | null>(null);
  const { pendingCount, processQueue } = useOfflineQueue();
  const { language, t } = useLanguage();
  const hasActiveModal = useActiveAriaModal();
  const shouldReduceMotion = useReducedMotion();
  const activeProbeControllerRef = useRef<AbortController | null>(null);
  const probeGenerationRef = useRef(0);

  const cancelActiveProbe = useCallback(() => {
    probeGenerationRef.current += 1;
    activeProbeControllerRef.current?.abort();
    activeProbeControllerRef.current = null;
  }, []);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      cancelActiveProbe();
      setIsRetrying(false);
      setIsOnline(true);
      setIsDismissed(false); // Reset dismiss on reconnect
    };
    const handleOffline = () => {
      cancelActiveProbe();
      setIsRetrying(false);
      setIsOnline(false);
      setIsDismissed(false); // Show banner immediately when going offline
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      cancelActiveProbe();
    };
  }, [cancelActiveProbe]);

  // Listen for data drop warnings from offline queue
  useEffect(() => {
    const handleDataDrop = (event: CustomEvent<{ reason: DataDropReason }>) => {
      if (event.detail.reason !== 'storage-limit') return;
      setDataDropWarning(event.detail.reason);
      setIsDismissed(false); // Force show warning
    };

    window.addEventListener('zenflow:offline-data-dropped', handleDataDrop as EventListener);

    return () => {
      window.removeEventListener('zenflow:offline-data-dropped', handleDataDrop as EventListener);
    };
  }, []);

  // navigator.onLine can be stale in installed shells; confirm with a local app asset.
  useEffect(() => {
    if (isOnline || dataDropWarning) {
      return;
    }

    cancelActiveProbe();
    const controller = new AbortController();
    const generation = probeGenerationRef.current + 1;
    probeGenerationRef.current = generation;
    activeProbeControllerRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), CONNECTIVITY_PROBE_TIMEOUT_MS);

    probeConnectivity(controller.signal)
      .then((online) => {
        if (generation !== probeGenerationRef.current || controller.signal.aborted) return;
        setIsOnline(online);
        if (online) {
          setDataDropWarning(null);
        }
      })
      .catch((err) => {
        if (generation !== probeGenerationRef.current) return;
        if ((err as Error).name !== 'AbortError') {
          logger.warn('[Network]', 'Connectivity check failed:', err);
        }
        setIsOnline(false);
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
        if (activeProbeControllerRef.current === controller) {
          activeProbeControllerRef.current = null;
        }
      });

    return () => {
      window.clearTimeout(timeoutId);
      if (activeProbeControllerRef.current === controller) {
        activeProbeControllerRef.current = null;
        probeGenerationRef.current += 1;
      }
      controller.abort();
    };
  }, [cancelActiveProbe, dataDropWarning, isOnline]);

  const shouldShow = !((isOnline && !dataDropWarning) || isDismissed);

  const handleDismiss = () => {
    cancelActiveProbe();
    setIsRetrying(false);
    setIsDismissed(true);
    // Clear data drop warning after dismissing
    if (dataDropWarning) {
      setDataDropWarning(null);
    }
  };

  const handleRetry = () => {
    if (isRetrying) return;
    cancelActiveProbe();
    const controller = new AbortController();
    const generation = probeGenerationRef.current + 1;
    probeGenerationRef.current = generation;
    activeProbeControllerRef.current = controller;
    setIsRetrying(true);

    void probeConnectivityWithTimeout(controller)
      .then(async (online) => {
        if (generation !== probeGenerationRef.current || controller.signal.aborted) return;
        if (!online) {
          setIsOnline(false);
          return;
        }

        if (pendingCount > 0) {
          try {
            await processQueue({
              verifiedConnectivity: {
                source: 'same-origin-app-asset',
                signal: controller.signal,
              },
            });
          } catch (error) {
            if (generation !== probeGenerationRef.current) return;
            logger.warn('[Network]', 'Pending changes could not be retried:', error);
            setIsOnline(false);
            return;
          }
        }

        if (generation === probeGenerationRef.current) {
          setIsOnline(true);
        }
      })
      .catch((err) => {
        if (generation !== probeGenerationRef.current) return;
        if ((err as Error).name !== 'AbortError') {
          logger.warn('[Network]', 'Connectivity check failed:', err);
        }
        setIsOnline(false);
      })
      .finally(() => {
        if (activeProbeControllerRef.current === controller) {
          activeProbeControllerRef.current = null;
          setIsRetrying(false);
        }
      });
  };

  // A modal owns the interaction boundary immediately. Bypass AnimatePresence
  // here so an exiting global banner cannot remain clickable above its backdrop.
  if (hasActiveModal) return null;

  return (
    <AnimatePresence>
      {shouldShow ? (
        <motion.div
          key="offline-banner"
          initial={shouldReduceMotion ? false : { y: -100 }}
          animate={{ y: 0 }}
          exit={shouldReduceMotion ? { y: 0 } : { y: -100 }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { type: 'spring', damping: 25, stiffness: 300 }
          }
          className={`fixed inset-x-0 top-0 z-[54] pb-2 pt-[calc(var(--safe-top)+0.5rem)] ps-[max(1rem,var(--safe-inline-start))] pe-[max(1rem,var(--safe-inline-end))] ${
            dataDropWarning
              ? 'bg-destructive text-destructive-foreground'
              : 'bg-[hsl(var(--zf-warning))] text-[hsl(var(--zf-night-0))]'
          } max-h-[var(--app-viewport-height)] overflow-y-auto overscroll-contain shadow-lg`}
          data-testid="offline-banner"
        >
          <div className="mx-auto grid max-w-lg min-w-0 grid-cols-1 items-start gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-3">
            {/* Icon and message */}
            <div className="grid min-w-0 flex-1 grid-cols-1 items-start gap-2 sm:grid-cols-[auto_minmax(0,1fr)]">
              {dataDropWarning ? (
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
              ) : (
                <WifiOff className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
              )}

              <div
                className="w-full min-w-0 flex-1"
                role={dataDropWarning ? 'alert' : 'status'}
              >
                <p className="whitespace-normal break-words text-sm font-medium [hyphens:manual] [overflow-wrap:break-word]">
                  {dataDropWarning
                    ? t.offlineBannerStorageLimit
                    : (t.offlineBannerTitle || 'You are offline')}
                </p>
                {!dataDropWarning && pendingCount > 0 && (
                  <p className="whitespace-normal break-words text-xs opacity-90 [hyphens:manual] [overflow-wrap:break-word]">
                    {plural(t, 'offlineBannerPending', pendingCount, language) ||
                      `${pendingCount} changes waiting to save online`}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2 justify-self-end min-[420px]:flex-shrink-0">
              {!isOnline && !dataDropWarning && (
                <button
                  onClick={handleRetry}
                  disabled={isRetrying}
                  aria-busy={isRetrying}
                  className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-foreground/20 hover:bg-foreground/30 motion-safe:transition-colors disabled:cursor-wait disabled:opacity-70"
                  aria-label={t.offlineBannerRetry || 'Retry connection'}
                >
                  <RefreshCw className={`w-4 h-4 ${isRetrying ? 'motion-safe:animate-spin' : ''}`} />
                </button>
              )}

              <button
                onClick={handleDismiss}
                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-foreground/20 hover:bg-foreground/30 motion-safe:transition-colors"
                aria-label={t.offlineBannerDismiss || 'Dismiss'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default OfflineBanner;
