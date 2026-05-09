import { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores';
import { initializeApp } from '@/lib/appInitializer';
import { initializeOfflineQueueHandlers } from '@/lib/offlineQueueHandlers';
import { getToday } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { SplashScreen } from '@capacitor/splash-screen';
import { isNative } from '@/lib/platform';
import { SK } from '@/lib/storageKeys';
import { storageGetRaw } from '@/lib/safeJson';

const WEB_MIN_DISPLAY_MS = 350;
const NATIVE_MIN_DISPLAY_MS = 800;
const LOADING_FADE_MS = 180;
const UPDATE_STATE_DELAY_MS = 700;

/**
 * Handles app initialization, splash screen, and currentDate init.
 * Owns initTimeoutRef internally.
 */
export function useAppLifecycle(): void {
  const setInitializationState = useAppStore(s => s.setInitializationState);
  const setLoadingFadeOut = useAppStore(s => s.setLoadingFadeOut);
  const currentDate = useAppStore(s => s.currentDate);
  const setCurrentDate = useAppStore(s => s.setCurrentDate);
  const initTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // App initialization + splash + loading fade
  useEffect(() => {
    let active = true;
    const initialize = async () => {
      logger.log('[Index] Starting app initialization...');
      const startTime = Date.now();

      // Hide native splash IMMEDIATELY so web animation is visible
      if (isNative) {
        SplashScreen.hide().catch(err => logger.warn('[Splash]', 'Hide failed:', err));
      }

      // Initialize offline queue handlers for offline-first sync
      initializeOfflineQueueHandlers();

      // Apply OLED mode if previously enabled
      if (storageGetRaw(SK.OLED_MODE) === 'true') {
        document.documentElement.classList.add('oled');
      }

      const result = await initializeApp();

      // Keep the branded handoff visible, but never hold users on a fake wait.
      const elapsed = Date.now() - startTime;
      const MIN_DISPLAY_MS = isNative ? NATIVE_MIN_DISPLAY_MS : WEB_MIN_DISPLAY_MS;
      if (elapsed < MIN_DISPLAY_MS) {
        await new Promise(r => window.setTimeout(r, MIN_DISPLAY_MS - elapsed));
      }

      if (!active) return;

      // Start exit fade animation
      setLoadingFadeOut(true);

      // After fade completes, remove loading screen and set final state
      await new Promise(r => window.setTimeout(r, LOADING_FADE_MS));

      if (!active) return;

      if (!result.success) {
        setInitializationState({
          isInitializing: false,
          error: result.error || 'Initialization failed',
          wasUpdated: result.wasUpdated
        });
        return;
      }

      if (result.wasUpdated) {
        logger.log('[Index] App was updated, showing update message');
        initTimeoutRef.current = setTimeout(() => {
          if (!active) return;
          setInitializationState({
            isInitializing: false,
            error: null,
            wasUpdated: true
          });
        }, UPDATE_STATE_DELAY_MS);
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
