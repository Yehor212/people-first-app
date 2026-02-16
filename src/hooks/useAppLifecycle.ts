import { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores';
import { initializeApp } from '@/lib/appInitializer';
import { initializeOfflineQueueHandlers } from '@/lib/offlineQueueHandlers';
import { preloadShareCardAssets } from '@/lib/shareCards';
import { getToday } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';

/**
 * Handles app initialization, splash screen, and currentDate init.
 * Owns initTimeoutRef internally.
 */
export function useAppLifecycle(): void {
  const setInitializationState = useAppStore(s => s.setInitializationState);
  const setLoadingFadeOut = useAppStore(s => s.setLoadingFadeOut);
  const currentDate = useAppStore(s => s.currentDate);
  const setCurrentDate = useAppStore(s => s.setCurrentDate);
  const initTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  // App initialization + splash + loading fade
  useEffect(() => {
    let active = true;
    const initialize = async () => {
      logger.log('[Index] Starting app initialization...');
      const startTime = Date.now();

      // Hide native splash IMMEDIATELY so web animation is visible
      if (Capacitor.isNativePlatform()) {
        SplashScreen.hide().catch(() => {});
      }

      // Initialize offline queue handlers for offline-first sync
      initializeOfflineQueueHandlers();

      // Apply OLED mode if previously enabled
      if (localStorage.getItem('zenflow_oled_mode') === 'true') {
        document.documentElement.classList.add('oled');
      }

      const result = await initializeApp();

      // Ensure animation plays for minimum 2 seconds
      const elapsed = Date.now() - startTime;
      const MIN_DISPLAY_MS = 2000;
      if (elapsed < MIN_DISPLAY_MS) {
        await new Promise(r => window.setTimeout(r, MIN_DISPLAY_MS - elapsed));
      }

      if (!active) return;

      // Start exit fade animation
      setLoadingFadeOut(true);

      // After fade completes, remove loading screen and set final state
      await new Promise(r => window.setTimeout(r, 400));

      if (!active) return;

      if (!result.success) {
        setInitializationState({
          isInitializing: false,
          error: result.error || 'Initialization failed',
          wasUpdated: result.wasUpdated
        });
        return;
      }

      // Preload share card assets in background for faster sharing
      void preloadShareCardAssets();

      if (result.wasUpdated) {
        logger.log('[Index] App was updated, showing update message');
        initTimeoutRef.current = setTimeout(() => {
          if (!active) return;
          setInitializationState({
            isInitializing: false,
            error: null,
            wasUpdated: true
          });
        }, 1000);
      } else {
        setInitializationState({
          isInitializing: false,
          error: null,
          wasUpdated: false
        });
      }
    };

    void initialize();
    return () => {
      active = false;
      if (initTimeoutRef.current) clearTimeout(initTimeoutRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mount-only: register lifecycle listeners once

  // Initialize currentDate on mount
  useEffect(() => {
    if (!currentDate) setCurrentDate(getToday());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mount-only: initialize currentDate once
}
