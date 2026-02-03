/**
 * PWA Update Notifier
 * P2 Fix #17: Shows toast notification when new version is available
 *
 * Only runs on web (not Capacitor/native apps)
 */

import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { logger } from '@/lib/logger';

export function PWAUpdateNotifier() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const hasShownToast = useRef(false);

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

        // Periodically check for updates (every 60 minutes)
        const intervalId = setInterval(() => {
          registration.update().catch(() => {
            // Ignore update check errors
          });
        }, 60 * 60 * 1000);

        return () => clearInterval(intervalId);
      } catch (error) {
        logger.warn('[PWA] Failed to check for updates:', error);
      }
    };

    const showUpdateToast = () => {
      logger.log('[PWA] New version available, showing toast');

      toast({
        title: t.pwaUpdateAvailable || 'Update available',
        description: t.pwaUpdateDescription || 'A new version is ready. Refresh to update.',
        duration: 0, // Don't auto-dismiss
        action: (
          <button
            onClick={() => {
              // Tell SW to skip waiting and activate immediately
              navigator.serviceWorker.ready.then((registration) => {
                if (registration.waiting) {
                  registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                }
              });
              // Reload the page to get new version
              window.location.reload();
            }}
            className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            {t.pwaUpdateButton || 'Refresh'}
          </button>
        ),
      });
    };

    void checkForUpdates();

    // Listen for SW controller change (happens after skipWaiting)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // New SW has taken control
      logger.log('[PWA] New service worker activated');
    });
  }, [toast, t]);

  // This component doesn't render anything
  return null;
}

export default PWAUpdateNotifier;
