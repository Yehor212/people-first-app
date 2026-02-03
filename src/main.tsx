import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupAudioUnlock } from "./lib/ambientSounds";
import { initAudioManager } from "./lib/audioManager";
import { initAndroidBackHandler } from "./lib/androidBackHandler";
import { logger } from "./lib/logger";
import { setupDeepLinks } from "./lib/deepLinks";
import { offlineQueue } from "./lib/offlineQueue";
import { initSentry, captureError } from "./lib/sentry";
import { initA11y } from "./lib/a11y";

// Initialize Sentry FIRST for error monitoring (before any other code runs)
initSentry();

// P1 Fix: Initialize accessibility features (aria-live regions for screen readers)
initA11y();

// Global error handlers for unhandled exceptions and promise rejections
// These catch errors that escape React's error boundary
window.addEventListener('unhandledrejection', (event) => {
  logger.error('[Global] Unhandled promise rejection:', event.reason);
  // Send to Sentry
  if (event.reason instanceof Error) {
    captureError(event.reason, { type: 'unhandledrejection' });
  }
});

window.addEventListener('error', (event) => {
  logger.error('[Global] Uncaught error:', event.error || event.message);
  // Send to Sentry
  if (event.error instanceof Error) {
    captureError(event.error, { type: 'uncaught' });
  }
});

/**
 * P0 Fix [ANDROID/WEB]: Handle app close/background to prevent data loss
 *
 * beforeunload: Web - when tab is closed or refreshed
 * visibilitychange: Both - when app goes to background
 *
 * Uses sendBeacon for reliable data transmission even during page unload.
 */
const LAST_STATE_KEY = 'zenflow_last_state';

// Save critical state before app closes
window.addEventListener('beforeunload', () => {
  try {
    // Save offline queue state synchronously
    const queueState = offlineQueue.getState();
    if (queueState.actions.length > 0) {
      // Use localStorage as it's synchronous
      localStorage.setItem(LAST_STATE_KEY, JSON.stringify({
        timestamp: Date.now(),
        pendingActions: queueState.actions.length,
        queueSnapshot: queueState.actions.slice(0, 10), // Save first 10 for recovery
      }));
      logger.log(`[Main] Saved ${queueState.actions.length} pending actions before unload`);
    }
  } catch (error) {
    // Ignore errors during unload
  }
});

// Handle visibility change (app going to background on mobile)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    try {
      const queueState = offlineQueue.getState();
      if (queueState.actions.length > 0) {
        localStorage.setItem(LAST_STATE_KEY, JSON.stringify({
          timestamp: Date.now(),
          pendingActions: queueState.actions.length,
          hidden: true,
        }));
      }
    } catch (error) {
      // Ignore errors
    }
  }
});

// Setup audio unlock for iOS - attaches to first user interaction
setupAudioUnlock();

// Initialize audio manager - loads mute/volume settings from localStorage
initAudioManager();

// Initialize Android back button handler (double-tap to exit + modal handling)
initAndroidBackHandler();

// Initialize deep link handler for challenge invites and other app URLs
setupDeepLinks();

// Only unregister service workers on Capacitor (native apps don't need PWA)
// Web PWA keeps SW for offline support
const isCapacitor = typeof window !== 'undefined' &&
  (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();

if (isCapacitor) {
  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      }).catch(() => {});
    }
    // Clear workbox/PWA caches on Capacitor only
    if ('caches' in window && window.caches) {
      window.caches.keys().then((names) => {
        names.forEach((name) => {
          if (name.includes('workbox') || name.includes('precache') || name.includes('runtime')) {
            window.caches.delete(name);
          }
        });
      }).catch(() => {});
    }
  } catch (e) {
    // Ignore errors
  }
}

createRoot(document.getElementById("root")!).render(<App />);
