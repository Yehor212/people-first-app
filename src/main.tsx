import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupAudioUnlock, preloadAmbientSounds } from "./lib/ambientSounds";
import { initAudioManager } from "./lib/audioManager";
import { initAndroidBackHandler } from "./lib/androidBackHandler";
import { logger } from "./lib/logger";
import { setupDeepLinks } from "./lib/deepLinks";
import { offlineQueue } from "./lib/offlineQueue";
import { initSentry, captureError } from "./lib/sentry";
import { cleanupShareCache } from "./lib/shareCards";
import { initA11y } from "./lib/a11y";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import {
  checkAppVersion,
  forceHardReload,
  isOAuthReturn,
  shouldCheckVersion,
  shouldAutoCheckVersion,
  markVersionChecked,
  clearNavigationCache,
} from "./lib/versionCheck";
import { pauseAllAudio, resumeAllAudio } from "./lib/audioLifecycle";
import { setupChunkErrorHandler } from "./components/UpdateRequiredDialog";

// Initialize Sentry FIRST for error monitoring (before any other code runs)
initSentry();

// Setup chunk error handler EARLY to catch lazy loading failures
// This must be before React renders to catch initial chunk load errors
setupChunkErrorHandler();

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

/**
 * P1 Fix: Lifecycle event deduplication
 * On native platforms, both visibilitychange AND Capacitor pause/resume fire for the same event.
 * This prevents double-calling pauseAllAudio()/resumeAllAudio() which can cause race conditions.
 */
let isHandlingPause = false;
let isHandlingResume = false;

function handleAppPause(): void {
  if (isHandlingPause) return;
  isHandlingPause = true;

  pauseAllAudio();

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

  // Reset flag after short delay to allow next pause event
  setTimeout(() => { isHandlingPause = false; }, 100);
}

async function handleAppResume(): Promise<void> {
  if (isHandlingResume) return;
  isHandlingResume = true;

  await resumeAllAudio();

  // Trigger sync if online and there are pending actions
  if (navigator.onLine && offlineQueue.hasPendingActions()) {
    logger.log('[Main] Processing pending offline queue on resume');
    void offlineQueue.processQueue();
  }
  // P1 Fix #12: Clean up stale share cache files (24+ hours old)
  void cleanupShareCache();

  // Reset flag after short delay to allow next resume event
  setTimeout(() => { isHandlingResume = false; }, 100);
}

// Handle visibility change (app going to background on mobile)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    handleAppPause();
  } else if (document.visibilityState === 'visible') {
    void handleAppResume();
  }
});

/**
 * P2 Fix [ANDROID]: Capacitor App lifecycle listeners
 * Handles pause/resume events for better state preservation on native platforms
 * Note: Uses deduplicated handlers to prevent race with visibilitychange
 */
if (Capacitor.isNativePlatform()) {
  // App paused (going to background)
  CapacitorApp.addListener('pause', () => {
    logger.log('[Main] App paused - saving state');
    handleAppPause();
  });

  // App resumed (coming back to foreground)
  CapacitorApp.addListener('resume', () => {
    logger.log('[Main] App resumed - checking for pending sync');
    void handleAppResume();
  });
}

// Setup audio unlock for iOS - attaches to first user interaction
setupAudioUnlock();

// Initialize audio manager - loads mute/volume settings from localStorage
initAudioManager();

// Preload ambient sounds for faster initial playback (MP3 files only)
// Uses link prefetch for non-blocking background loading
preloadAmbientSounds();

// Initialize Android back button handler (double-tap to exit + modal handling)
void initAndroidBackHandler();

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
      }).catch((err) => {
        // LOW priority fix: Log SW unregister errors in dev mode
        if (import.meta.env.DEV) {
          console.warn('[main] SW unregister failed:', err);
        }
      });
    }
    // Clear workbox/PWA caches on Capacitor only
    if ('caches' in window && window.caches) {
      window.caches.keys().then((names) => {
        names.forEach((name) => {
          if (name.includes('workbox') || name.includes('precache') || name.includes('runtime')) {
            window.caches.delete(name);
          }
        });
      }).catch((err) => {
        // LOW priority fix: Log cache clear errors in dev mode
        if (import.meta.env.DEV) {
          console.warn('[main] Cache clear failed:', err);
        }
      });
    }
  } catch (e) {
    // Ignore errors - these are non-critical cleanup operations
  }
}

/**
 * P0 Fix: Check app version before rendering.
 *
 * This prevents chunk load errors after deployment by detecting
 * version mismatch BEFORE lazy loading tries to load non-existent chunks.
 *
 * Now checks on EVERY visit (with 5-minute throttle) to prevent stale cache issues.
 * Priority checks (no throttle): OAuth returns, chunk error reloads.
 */
async function initializeApp(): Promise<boolean> {
  // Priority check: After OAuth or after chunk error reload (always check)
  const priorityCheck = isOAuthReturn() || shouldCheckVersion();
  // Auto check: Every 5 minutes for regular visits
  const autoCheck = shouldAutoCheckVersion();

  if (priorityCheck || autoCheck) {
    logger.log(`[Main] Checking app version... (priority=${priorityCheck}, auto=${autoCheck})`);

    // Clear navigation cache first to ensure fresh version.json
    await clearNavigationCache();

    const isUpToDate = await checkAppVersion();

    // Mark that we checked (for throttling)
    markVersionChecked();

    if (!isUpToDate) {
      logger.log('[Main] Outdated version detected, performing hard reload...');
      await forceHardReload();
      return false; // Don't render, page will reload
    }

    logger.log('[Main] Version is up to date');
  }

  return true;
}

// Initialize app with version check, then render
initializeApp().then((shouldRender) => {
  if (shouldRender) {
    createRoot(document.getElementById("root")!).render(<App />);
  }
});
