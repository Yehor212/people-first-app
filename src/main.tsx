// MUST be first import — runs before any other module (incl. React) loads.
// Decodes GH Pages 404.html SPA redirect URL back to canonical path.
import "./lib/spaRedirect";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupAudioUnlock, preloadAmbientSounds } from "./lib/ambientSounds";
import { initAudioManager } from "./lib/audioManager";
import { initAndroidBackHandler } from "./lib/androidBackHandler";
import { logger } from "./lib/logger";
import { setupDeepLinks } from "./lib/deepLinks";
import { offlineQueue } from "./lib/offlineQueue";
import { hapticSuccess } from "./lib/haptics";
// Sentry and cloudSync are dynamically imported below to keep them off the critical path
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
import { scheduleIdle } from "./lib/scheduleIdle";

// Sentry is deferred to post-mount via requestIdleCallback (see below initializeApp)
// to keep it off the critical rendering path. captureError is loaded lazily.
let captureError: ((err: Error, ctx?: Record<string, unknown>) => void) | null = null;

// Pre-Sentry error buffer — catches errors thrown in the ~2s window before Sentry
// finishes its idle-callback import. Without this, global handlers silently drop
// early errors (the `if (captureError)` guard below returns no-op pre-init).
// Pattern mirrors Sentry JS Loader's `onLoad` queue. Cap at 50 to bound memory on
// pathological crash loops. Flushed in idleInit() after Sentry is wired.
// Source: docs.sentry.io/platforms/javascript/install/lazy-load-sentry/ (2025).
interface BufferedError {
  error: Error;
  context: Record<string, unknown>;
}
const preSentryErrorBuffer: BufferedError[] = [];
const BUFFER_CAP = 50;
function captureOrBuffer(error: Error, context: Record<string, unknown>): void {
  if (captureError) {
    captureError(error, context);
  } else if (preSentryErrorBuffer.length < BUFFER_CAP) {
    preSentryErrorBuffer.push({ error, context });
  }
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
    // Security: validate origin for defense-in-depth (CWE-20, CWE-345)
    if (!event.origin || event.origin !== window.location.origin) return;
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
  // Send to Sentry (buffered if Sentry not yet loaded)
  if (reason instanceof Error) {
    captureOrBuffer(reason, { type: "unhandledrejection" });
  }
});

window.addEventListener("error", (event) => {
  logger.error("[Global] Uncaught error:", event.error || event.message);
  // Send to Sentry (buffered if Sentry not yet loaded)
  if (event.error instanceof Error) {
    captureOrBuffer(event.error, { type: "uncaught" });
  }
});

// Vite preload-error handler (P1 — research 2026-04-18)
// Fires when <link rel="modulepreload"> or dynamic `import()` fails (CSS/JS chunk
// 404 after deploy). Distinct event from generic `error` — has typed `.payload`
// with the Error. Dispatch the same CHUNK_LOAD_ERROR_EVENT the dialog listens for.
// Source: vite.dev/guide/build.html#load-error-handling, vitejs/vite#11804.
window.addEventListener("vite:preloadError", (event) => {
  const message = event.payload?.message || "vite:preloadError";
  logger.warn("[Vite] Preload error:", message);
  // Prevent Vite's default auto-reload — dialog gives user control (see research §4).
  event.preventDefault();
  window.dispatchEvent(
    new CustomEvent("zenflow:chunk-load-error", {
      detail: { message, chunk: "preload", timestamp: Date.now() },
    })
  );
});

/**
 * Handle app close/background to prevent data loss
 *
 * beforeunload: Web - when tab is closed or refreshed
 * visibilitychange: Both - when app goes to background
 *
 * Synchronous localStorage snapshot is used here — beforeunload handlers have
 * ~10ms budget and localStorage is the only sync storage. Network transmission
 * for unload events lives in cloudSync.ts (sendBeacon). Keep first-10 actions
 * for recovery; full queue is already persisted via offlineQueue's Dexie store.
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
  // ROOT-CAUSE: dynamic import may fail during app backgrounding — sync retries on next resume via handleAppResume
  import("./storage/cloudSync")
    .then(({ flushSync }) => flushSync())
    .catch((err) => logger.warn("[Main] cloudSync flush failed during pause:", err));

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

  // Trigger sync if online — drain offline queue + delta pull + haptic feedback
  if (navigator.onLine) {
    if (offlineQueue.hasPendingActions()) {
      logger.log("[Main] Processing pending offline queue on resume");
      void offlineQueue.processQueue().then(() => {
        void hapticSuccess(); // Subtle feedback: queued changes synced
      });
    }
    // Delta pull on resume — fetch new events from server (Telegram pattern)
    void import("@/storage/eventSync")
      .then(({ fetchAllDeltas }) =>
        import("@/lib/syncCursor").then(({ loadSyncCursor }) =>
          loadSyncCursor().then((cursor) => {
            if (cursor.globalSeq > 0) {
              logger.log("[Main] Delta pull on resume, seq:", cursor.globalSeq);
              void fetchAllDeltas(cursor.globalSeq);
            }
          })
        )
      )
      .catch((err) => logger.warn("[Main] Delta pull on resume failed:", err));
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
  const pauseListener = CapacitorApp.addListener("pause", () => {
    logger.log("[Main] App paused - saving state");
    handleAppPause();
  });

  // App resumed (coming back to foreground)
  const resumeListener = CapacitorApp.addListener("resume", () => {
    logger.log("[Main] App resumed - checking for pending sync");
    void handleAppResume();
  });

  // Cleanup on HMR to prevent listener stacking
  if (import.meta.hot) {
    import.meta.hot.dispose(async () => {
      await (await pauseListener).remove();
      await (await resumeListener).remove();
    });
  }
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

// React 18 `onRecoverableError` forwards recoverable hydration/concurrent errors
// to Sentry (via buffer pre-load, direct post-load). React 19 adds onCaughtError/
// onUncaughtError — not yet available here.
// Source: react.dev/reference/react-dom/client/createRoot#parameters, 2025.
const rootOptions = {
  onRecoverableError: (error: unknown) => {
    if (error instanceof Error) {
      captureOrBuffer(error, { type: "recoverable", source: "react" });
    }
  },
};

// Initialize app with version check, then render
initializeApp()
  .then((shouldRender) => {
    if (shouldRender) {
      createRoot(document.getElementById("root")!, rootOptions).render(<App />);
    }
  })
  .catch((err) => {
    logger.error("[Init] Fatal:", err);
    createRoot(document.getElementById("root")!, rootOptions).render(<App />);
  });

// Defer Sentry initialization to after render — keeps @sentry/* off the critical path
// ROOT-CAUSE: Sentry is ~30KB gzipped; deferring to idle time improves TTI without losing error coverage
const idleInit = () => {
  import("./lib/sentry")
    .then(({ initSentry, captureError: ce }) => {
      try {
        initSentry();
      } catch (e) {
        logger.warn("[Main] Sentry init failed:", e);
      }
      captureError = ce;
      // Flush errors buffered during the pre-Sentry window.
      if (preSentryErrorBuffer.length > 0) {
        logger.log(`[Main] Flushing ${preSentryErrorBuffer.length} buffered errors to Sentry`);
        for (const { error, context } of preSentryErrorBuffer) {
          try {
            ce(error, { ...context, buffered: true });
          } catch (e) {
            logger.warn("[Main] Buffer flush failed for one error:", e);
          }
        }
        preSentryErrorBuffer.length = 0;
      }
    })
    .catch((err) => logger.warn("[Main] Sentry lazy load failed:", err));
};
scheduleIdle(idleInit);
