import { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores';
import { initializeApp } from '@/lib/appInitializer';
import { initializeOfflineQueueHandlers } from '@/lib/offlineQueueHandlers';
import { getToday } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { SplashScreen } from '@capacitor/splash-screen';
import { isAndroid, isIos, isNative } from '@/lib/platform';

const WEB_MIN_DISPLAY_MS = 350;
const NATIVE_MIN_DISPLAY_MS = 800;
const UPDATE_STATE_DELAY_MS = 700;

/**
 * Handles app initialization, splash screen, and currentDate init.
 * Owns initTimeoutRef internally.
 */
export function useAppLifecycle(): void {
  const setInitializationState = useAppStore(s => s.setInitializationState);
  const currentDate = useAppStore(s => s.currentDate);
  const setCurrentDate = useAppStore(s => s.setCurrentDate);
  const initTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // App initialization + native-to-web splash handoff
  useEffect(() => {
    let active = true;
    let firstAndroidSplashFrame: number | null = null;
    let paintedAndroidSplashFrame: number | null = null;

    const hideNativeLaunchSplash = () => {
      const hide = () => {
        void SplashScreen.hide().catch(err => logger.warn('[Splash]', 'Hide failed:', err));
      };

      if (isAndroid) {
        // Capacitor's launch splash is configured for manual release. Two RAFs
        // guarantee that the committed React splash receives a compositor frame
        // before Android removes the native launch surface.
        firstAndroidSplashFrame = window.requestAnimationFrame(() => {
          firstAndroidSplashFrame = null;
          paintedAndroidSplashFrame = window.requestAnimationFrame(() => {
            paintedAndroidSplashFrame = null;
            hide();
          });
        });
        return;
      }

      if (isIos) hide();
    };

    const initialize = async () => {
      logger.log('[Index] Starting app initialization...');
      const startTime = Date.now();

      hideNativeLaunchSplash();

      // Initialize offline queue handlers for offline-first sync
      initializeOfflineQueueHandlers();

      const result = await initializeApp();

      // Keep the branded handoff visible, but never hold users on a fake wait.
      const elapsed = Date.now() - startTime;
      const MIN_DISPLAY_MS = isNative ? NATIVE_MIN_DISPLAY_MS : WEB_MIN_DISPLAY_MS;
      if (elapsed < MIN_DISPLAY_MS) {
        await new Promise(r => window.setTimeout(r, MIN_DISPLAY_MS - elapsed));
      }

      if (!active) return;

      if (!result.success) {
        setInitializationState({
          isInitializing: false,
          error: result.error || 'Initialization failed',
          wasUpdated: result.wasUpdated
        });
        return;
      }

      // AuthGate renders one exclusive gate at a time. Switching its state in
      // one commit preserves account isolation and lets React mount the route
      // fallback atomically; fading the only mounted surface exposes the empty
      // root between the splash and the first lazy route.
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
      if (firstAndroidSplashFrame !== null) {
        window.cancelAnimationFrame(firstAndroidSplashFrame);
      }
      if (paintedAndroidSplashFrame !== null) {
        window.cancelAnimationFrame(paintedAndroidSplashFrame);
      }
      if (initTimeoutRef.current) clearTimeout(initTimeoutRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mount-only: register lifecycle listeners once

  // Initialize currentDate on mount
  useEffect(() => {
    if (!currentDate) setCurrentDate(getToday());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mount-only: initialize currentDate once
}
