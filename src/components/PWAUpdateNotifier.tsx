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
          onClick: () => {
            navigator.serviceWorker.addEventListener('controllerchange', () => {
              window.location.reload();
            }, { once: true });
            navigator.serviceWorker.ready.then((registration) => {
              if (registration.waiting) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
              }
            });
            setTimeout(() => window.location.reload(), 2000);
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

    // Auto-reload when new SW takes control (after skipWaiting)
    const handleControllerChange = () => {
      logger.log('[PWA] New service worker activated — auto-reloading');
      if (!hasShownToast.current) {
        hasShownToast.current = true;
        toast(t.pwaUpdateAvailable || 'Update available', {
          description: t.pwaUpdateDescription || 'A new version is ready. Refreshing...',
          duration: 3000,
        });
      }
      setTimeout(() => window.location.reload(), 2000);
    };
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, [t]);

  // This component doesn't render anything
  return null;
}

export default PWAUpdateNotifier;
