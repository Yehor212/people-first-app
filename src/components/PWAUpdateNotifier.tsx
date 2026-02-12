/**
 * PWA Update Notifier
 * Shows toast notification when new version is available
 *
 * Only runs on web (not Capacitor/native apps)
 */

import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { logger } from '@/lib/logger';

export function PWAUpdateNotifier() {
  const { t } = useLanguage();
  const hasShownToast = useRef(false);
  // Store interval ID in ref for proper cleanup
  const updateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Skip on native platforms - they use Google Play updates
    if (Capacitor.isNativePlatform()) {
      return;
    }

    // Skip if no service worker support
    if (!('serviceWorker' in navigator)) {
      return;
    }

    const checkForUpdates = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;

        // Listen for new SW waiting to activate
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;

          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              // New SW is installed and waiting
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // There's a new version waiting
                if (!hasShownToast.current) {
                  hasShownToast.current = true;
                  showUpdateToast();
                }
              }
            });
          }
        });

        // Also check if there's already a waiting SW
        if (registration.waiting && navigator.serviceWorker.controller) {
          if (!hasShownToast.current) {
            hasShownToast.current = true;
            showUpdateToast();
          }
        }

        // Periodically check for updates (every 15 minutes)
        updateIntervalRef.current = setInterval(() => {
          registration.update().catch(() => {
            // Ignore update check errors
          });
        }, 15 * 60 * 1000);
      } catch (error) {
        logger.warn('[PWA] Failed to check for updates:', error);
      }
    };

    const showUpdateToast = () => {
      logger.log('[PWA] New version available, showing toast');

      toast(t.pwaUpdateAvailable || 'Update available', {
        description: t.pwaUpdateDescription || 'A new version is ready. Refresh to update.',
        duration: Infinity,
        action: {
          label: t.pwaUpdateButton || 'Refresh',
          onClick: async () => {
            try {
              // Clear all caches
              if ('caches' in window) {
                const names = await caches.keys();
                await Promise.all(names.map(n => caches.delete(n)));
              }
              // Unregister all SWs
              const regs = await navigator.serviceWorker.getRegistrations();
              await Promise.all(regs.map(r => r.unregister()));
            } catch (e) {
              logger.warn('[PWA] Error clearing caches during update:', e);
            }

            // Hard reload with cache bust
            const url = new URL(window.location.href);
            url.searchParams.set('_v', String(Date.now()));
            window.location.replace(url.toString());
          },
        },
      });
    };

    void checkForUpdates();

    // Check for updates when tab regains focus
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        navigator.serviceWorker.ready.then((reg) => {
          reg.update().catch(() => {});
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [t]);

  // This component doesn't render anything
  return null;
}

export default PWAUpdateNotifier;
