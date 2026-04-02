import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupAudioUnlock, preloadAmbientSounds } from "./lib/ambientSounds";
import { initAudioManager } from "./lib/audioManager";
import { initAndroidBackHandler } from "./lib/androidBackHandler";
import { logger } from "./lib/logger";
import { setupDeepLinks } from "./lib/deepLinks";
import { offlineQueue } from "./lib/offlineQueue";
import { flushSync } from "./storage/cloudSync";
import { initSentry, captureError } from "./lib/sentry";
import { cleanupShareCache } from "./lib/shareActions";
import { initA11y } from "./lib/a11y";
import { App as CapacitorApp } from "@capacitor/app";
import { isNative } from "@/lib/platform";
import {
  checkAppVersion,
  forceHardReload,
  isOAuthReturn,
  shouldCheckVersion,
  shouldAutoCheckVersion,
  markVersionChecked,
} from "./lib/versionCheck";
import { pauseAllAudio, resumeAllAudio } from "./lib/audioLifecycle";
import { setupChunkErrorHandler } from "./components/UpdateRequiredDialog";
import { checkDatabaseHealth } from "./storage/db";
import { SK } from "./lib/storageKeys";
import { safeLocalStorageSet } from "./lib/safeJson";

// Initialize Sentry FIRST for error monitoring (before any other code runs)
// Wrapped in try/catch — Sentry must never crash the app
try {
  initSentry();
} catch (e) {
  logger.warn("[Main] Sentry init failed:", e);
}

// Setup chunk error handler EARLY to catch lazy loading failures
// This must be before React renders to catch initial chunk load errors
setupChunkErrorHandler();

// Initialize accessibility features (aria-live regions for screen readers)
initA11y();

// Set html lang attribute early (before React hydrates) for non-EN users (WCAG 3.1.1)
// CSP blocks inline scripts in index.html, so we do it here in the module entry point.
// useLocalStorage stores values as JSON strings, so we parse accordingly.
try {
  const storedLang = localStorage.getItem("zenflow-language");
  if (storedLang) {
    const parsed = JSON.parse(storedLang);
    if (typeof parsed === "string" && parsed.length >= 2) {
      document.documentElement.lang = parsed;
    }
  }
} catch {
  // Ignore — React LanguageContext will set it once mounted
}

// Listen for SW activation — new SW means new deploy, check version immediately
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    // Security: validate origin for defense-in-depth (CWE-345)
    if (event.origin && event.origin !== window.location.origin) return;
    if (event.data?.type === "SW_UPDATED") {
      logger.log("[Main] New SW activated, checking version...");
      checkAppVersion()
        .then((isUpToDate) => {
          markVersionChecked();
          if (!isUpToDate) {
            logger.log("[Main] Version mismatch after SW update, reloading...");
            void forceHardReload();
          }
        })
        .catch((err) => {
          logger.warn("[Main] SW update version check failed:", err);
        });
    }
  });
}

// Global error handlers for unhandled exceptions and promise rejections
// These catch errors that escape React's error boundary
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;

  // Suppress generic browser/Capacitor permission rejections (e.g. notification denied)
  if (reason === "Rejected" || (reason instanceof Error && reason.message === "Rejected")) {
    event.preventDefault();
    logger.warn("[Global] Suppressed generic rejection:", reason);
    return;
  }

  logger.error("[Global] Unhandled promise rejection:", reason);
  // Send to Sentry
  if (reason instanceof Error) {
    captureError(reason, { type: "unhandledrejection" });
  }
});

window.addEventListener("error", (event) => {
  logger.error("[Global] Uncaught error:", event.error || event.message);
  // Send to Sentry
  if (event.error instanceof Error) {
    captureError(event.error, { type: "uncaught" });
  }
});

/**
 * Handle app close/background to prevent data loss
 *
 * beforeunload: Web - when tab is closed or refreshed
 * visibilitychange: Both - when app goes to background
 *
 * Uses sendBeacon for reliable data transmission even during page unload.
 */
// Save critical state before app closes
window.addEventListener("beforeunload", () => {
  try {
    // Save offline queue state synchronously
    const queueState = offlineQueue.getState();
    if (queueState.actions.length > 0) {
      // Use localStorage as it's synchronous
      safeLocalStorageSet(SK.LAST_STATE, {
        timestamp: Date.now(),
        pendingActions: queueState.actions.length,
        queueSnapshot: queueState.actions.slice(0, 10), // Save first 10 for recovery
      });
      logger.log(`[Main] Saved ${queueState.actions.length} pending actions before unload`);
    }
  } catch (_error) {
    // Ignore errors during unload
  }
});

/**
 * Lifecycle event deduplication
 * On native platforms, both visibilitychange AND Capacitor pause/resume fire for the same event.
 * This prevents double-calling pauseAllAudio()/resumeAllAudio() which can cause race conditions.
 */
let isHandlingPause = false;
let isHandlingResume = false;

function handleAppPause(): void {
  if (isHandlingPause) return;
  isHandlingPause = true;

  pauseAllAudio();

  // Flush pending cloud sync immediately (bypasses 60s debounce)
  // Prevents data loss when user closes app right after recording mood/habit
  flushSync();

  try {
    const queueState = offlineQueue.getState();
    if (queueState.actions.length > 0) {
      safeLocalStorageSet(SK.LAST_STATE, {
        timestamp: Date.now(),
        pendingActions: queueState.actions.length,
        hidden: true,
      });
    }
  } catch (_error) {
    // Ignore errors
  }

  // Reset flag after short delay to allow next pause event
  setTimeout(() => {
    isHandlingPause = false;
  }, 100);
}

async function handleAppResume(): Promise<void> {
  if (isHandlingResume) return;
  isHandlingResume = true;

  await resumeAllAudio();

  // Proactive version check on EVERY tab resume — prevents stale chunk errors.
  // When user returns to a tab left open across deploys, old JS in memory
  // tries to lazy-load chunks with old hashes (404). Check BEFORE that happens.
  // No throttle — the fetch is ~100ms, and stale-tab errors are the #1 cause
  // of chunk-load failures. Skip on native (assets are bundled locally).
  if (!isNative && navigator.onLine) {
    const isUpToDate = await checkAppVersion();
    markVersionChecked();
    if (!isUpToDate) {
      logger.log("[Main] Stale version on resume, reloading...");
      await forceHardReload();
      return; // Page will reload
    }
  }

  // Trigger sync if online and there are pending actions
  if (navigator.onLine && offlineQueue.hasPendingActions()) {
    logger.log("[Main] Processing pending offline queue on resume");
    void offlineQueue.processQueue();
  }
  // Clean up stale share cache files (24+ hours old)
  void cleanupShareCache();

  // Reset flag after short delay to allow next resume event
  setTimeout(() => {
    isHandlingResume = false;
  }, 100);
}

// Handle visibility change (app going to background on mobile)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    handleAppPause();
  } else if (document.visibilityState === "visible") {
    void handleAppResume();
  }
});

/**
 * Capacitor App lifecycle listeners
 * Handles pause/resume events for better state preservation on native platforms
 * Note: Uses deduplicated handlers to prevent race with visibilitychange
 */
if (isNative) {
  // App paused (going to background)
  void CapacitorApp.addListener("pause", () => {
    logger.log("[Main] App paused - saving state");
    handleAppPause();
  });

  // App resumed (coming back to foreground)
  void CapacitorApp.addListener("resume", () => {
    logger.log("[Main] App resumed - checking for pending sync");
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

// Splash screen is hidden in Index.tsx after initialization completes
// This prevents white flash on slow devices during DB health check + migrations

// Initialize deep link handler for challenge invites and other app URLs
setupDeepLinks();

// Only unregister service workers on Capacitor (native apps don't need PWA)
// Web PWA keeps SW for offline support
const isCapacitor =
  typeof window !== "undefined" &&
  (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();

if (isCapacitor) {
  try {
    if ("serviceWorker" in navigator && navigator.serviceWorker) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {
          registrations.forEach((registration) => registration.unregister());
        })
        .catch((err) => {
          // Log SW unregister errors in dev mode
          logger.warn("[Main] SW unregister failed:", err);
        });
    }
    // Clear workbox/PWA caches on Capacitor only
    if ("caches" in window && window.caches) {
      window.caches
        .keys()
        .then((names) => {
          names.forEach((name) => {
            if (name.includes("workbox") || name.includes("precache") || name.includes("runtime")) {
              void window.caches.delete(name);
            }
          });
        })
        .catch((err) => {
          // Log cache clear errors in dev mode
          logger.warn("[Main] Cache clear failed:", err);
        });
    }
  } catch (_e) {
    // Ignore errors - these are non-critical cleanup operations
  }
}

/**
 * Check app version and database health before rendering.
 *
 * This prevents chunk load errors after deployment by detecting
 * version mismatch BEFORE lazy loading tries to load non-existent chunks.
 *
 * Now checks on EVERY visit (with 5-minute throttle) to prevent stale cache issues.
 * Priority checks (no throttle): OAuth returns, chunk error reloads.
 */
async function initializeApp(): Promise<boolean> {
  // Check database health early to detect IndexedDB issues
  // This runs on every app start to catch database corruption/deletion
  try {
    logger.log("[Main] Checking database health...");
    const dbHealthy = await checkDatabaseHealth();
    if (!dbHealthy) {
      logger.warn("[Main] Database health check failed - app will use localStorage fallback");
      // Don't block app startup, just log the warning
      // The useIndexedDB hook has its own fallback logic
    } else {
      logger.log("[Main] Database is healthy");
    }
  } catch (dbError) {
    logger.warn("[Main] Database health check error:", dbError);
    // Continue anyway - app has fallbacks
  }

  // Priority check: After OAuth or after chunk error reload (always check)
  const priorityCheck = isOAuthReturn() || shouldCheckVersion();
  // Auto check: Every 5 minutes for regular visits
  const autoCheck = shouldAutoCheckVersion();

  if (priorityCheck || autoCheck) {
    logger.log(`[Main] Checking app version... (priority=${priorityCheck}, auto=${autoCheck})`);

    const isUpToDate = await checkAppVersion();

    // Mark that we checked (for throttling)
    markVersionChecked();

    if (!isUpToDate) {
      logger.log("[Main] Outdated version detected, performing hard reload...");
      await forceHardReload();
      return false; // Don't render, page will reload
    }

    logger.log("[Main] Version is up to date");
  }

  return true;
}

// Initialize app with version check, then render
initializeApp()
  .then((shouldRender) => {
    if (shouldRender) {
      createRoot(document.getElementById("root")!).render(<App />);
    }
  })
  .catch((err) => {
    logger.error("[Init] Fatal:", err);
    createRoot(document.getElementById("root")).render(<App />);
  });
