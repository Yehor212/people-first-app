// MUST be first import — runs before any other module (incl. React) loads.
// Decodes GH Pages 404.html SPA redirect URL back to canonical path.
import "./lib/spaRedirect";
import "./lib/diagnosticConsoleBootstrap";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupAudioUnlock } from "./lib/ambientSounds";
import { initAudioManager } from "./lib/audioManager";
import { initAndroidBackHandler } from "./lib/androidBackHandler";
import { logger } from "./lib/logger";
import { setupDeepLinks } from "./lib/deepLinks";
import { offlineQueue } from "./lib/offlineQueue";
import { getCurrentSessionUserId } from "./lib/supabaseClient";
import { hapticSuccess } from "./lib/haptics";
import { flushSync as flushCloudSync } from "./storage/cloudSync";
import { runWithSyncLeaderLock } from "@/lib/syncLeader";
import { pullAndApplyDeltasFromLastSeq } from "@/storage/eventSync";
// Runtime crash diagnostics stay off until ZenFlow exposes an explicit,
// durable user choice. Global failures are kept only in the bounded in-memory
// buffer below and are not sent to an external service.
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
import { pruneRetainedBoundaryDiagnostics } from "./components/ErrorBoundary";
import { getErrorMessage, isChunkLoadMessage } from "./lib/chunkErrorDetection";
import { isTrustedServiceWorkerMessage } from "./lib/serviceWorkerMessages";
import { readLifecycleSnapshot, writeLifecycleSnapshot } from "./lib/lifecycleSnapshot";
import { SK } from "./lib/storageKeys";
import { safeLocalStorageGet } from "./lib/safeJson";
import { scheduleIdle } from "./lib/scheduleIdle";
import { captureOrBuffer } from "./lib/errorBuffer";
import { pruneRetainedCrashReports } from "./lib/crashReporting";
import { initWebVitalsDev } from "./observability/reportWebVitals";
import { initLongTaskObserverDev } from "./observability/initLongTaskObserverDev";
import {
  installRuntimeFlightRecorder,
  installRuntimePerformanceGuard,
} from "./observability/runtimeFlightRecorder";
import { bindPrefersColorSchemeListener } from "./stores/themeStore";
import { migrateLegacyFeedbackSettings } from "./lib/legacyFeedbackMigration";
import { retireLegacyQuickActions } from "./lib/legacyQuickActionsRetirement";
import { applyDocumentLanguage, loadLanguage, resolveInitialLanguage } from "./i18n";
import { dispatchNativeReminderReconcile } from "./lib/notificationLifecycle";

// Drop legacy raw records and enforce the current retention window before any
// new runtime failure can be recorded.
pruneRetainedBoundaryDiagnostics();
pruneRetainedCrashReports();

// Setup chunk error handler EARLY to catch lazy loading failures
// This must be before React renders to catch initial chunk load errors
setupChunkErrorHandler();

// Preserve explicit reduced-motion and vibration choices before the first
// React frame. The migration is bounded to a few synchronous localStorage
// operations and never reads IndexedDB or the network.
migrateLegacyFeedbackSettings();
void retireLegacyQuickActions();

// Initialize accessibility features (aria-live regions for screen readers)
initA11y();

// Core Web Vitals dev logger — MUST be synchronous (register listeners before
// first paint to catch LCP). No-op in production; Sentry handles vitals there.
void initWebVitalsDev();

// Long Animation Frame + Long Task dev observer — complements web-vitals
// by capturing EVERY slow frame (not just the one behind INP). No-op in
// prod; Sentry captures longtask spans server-side.
initLongTaskObserverDev();
installRuntimePerformanceGuard();
scheduleIdle(
  () => {
    installRuntimeFlightRecorder();
  },
  2000,
  250
);
bindPrefersColorSchemeListener();

function isStateOfMindRoute(): boolean {
  try {
    return /\/orb\/?$/.test(window.location.pathname);
  } catch {
    return false;
  }
}

function scheduleCanonicalOrbPrewarmAfterStartup(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("orbPrewarm") === "off" || isStateOfMindRoute()) return;
  } catch {
    // Keep startup resilient; prewarm is an optimization, not a dependency.
  }

  scheduleIdle(
    () => {
      void import("./components/state-of-mind/canonicalOrbPrewarm")
        .then(({ prewarmCanonicalOrbWebGL }) => prewarmCanonicalOrbWebGL("post-startup-idle"))
        .catch((err) => logger.warn("[Main] Canonical orb prewarm failed:", err));
    },
    8000,
    2500
  );
}

scheduleCanonicalOrbPrewarmAfterStartup();

type NetworkConnectionLike = {
  saveData?: boolean;
  effectiveType?: string;
};

type NavigatorWithRuntimeAudioHints = Navigator & {
  connection?: NetworkConnectionLike;
  mozConnection?: NetworkConnectionLike;
  webkitConnection?: NetworkConnectionLike;
  standalone?: boolean;
};

const SLOW_RUNTIME_AUDIO_EFFECTIVE_TYPES = new Set(["slow-2g", "2g"]);

function isStandaloneRuntimeContext(): boolean {
  try {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      (navigator as NavigatorWithRuntimeAudioHints).standalone === true
    );
  } catch {
    return false;
  }
}

function getRuntimeAudioConnection(): NetworkConnectionLike | undefined {
  const nav = navigator as NavigatorWithRuntimeAudioHints;
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
}

function shouldWarmRuntimeAudioCacheAfterStartup(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    const override = params.get("audioCacheWarm");
    if (override === "off") return false;
    if (override === "on") return true;
  } catch {
    // Keep warmup optional; malformed URLs should not affect startup.
  }

  const connection = getRuntimeAudioConnection();
  if (connection?.saveData) return false;
  if (connection?.effectiveType && SLOW_RUNTIME_AUDIO_EFFECTIVE_TYPES.has(connection.effectiveType))
    return false;

  return isStandaloneRuntimeContext();
}
function scheduleRuntimeAudioCacheWarmAfterStartup(): void {
  if (isNative || !("serviceWorker" in navigator)) return;
  if (!shouldWarmRuntimeAudioCacheAfterStartup()) return;

  scheduleIdle(
    () => {
      void navigator.serviceWorker.ready
        .then((registration) => {
          const worker = registration.active ?? navigator.serviceWorker.controller;
          worker?.postMessage({ type: "WARM_RUNTIME_AUDIO_CACHE" });
        })
        .catch((err) => logger.warn("[Main] Runtime audio cache warm request failed:", err));
    },
    10000,
    3000
  );
}

// Resolve both language and direction before the first React frame. The active
// dictionary is startup-critical because rendering a target locale with English
// text is semantically incorrect, especially for RTL assistive technology.
const initialLanguage = resolveInitialLanguage(
  safeLocalStorageGet<string>(SK.LANGUAGE, ""),
  navigator.language || navigator.userLanguage,
  safeLocalStorageGet<boolean>(SK.LANGUAGE_SELECTED, false)
);
applyDocumentLanguage(initialLanguage);

async function prepareInitialLanguageBeforeRender(): Promise<void> {
  try {
    await loadLanguage(initialLanguage);
  } catch (error) {
    // Keep the document internally consistent while LanguageProvider exposes a retry.
    applyDocumentLanguage("en");
    logger.warn("[Main] Initial language dictionary unavailable", {
      language: initialLanguage,
      error,
    });
  }
}

// Listen for SW activation — new SW means new deploy, check version immediately
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.onmessage = (event) => {
    if (!isTrustedServiceWorkerMessage(event, window.location.origin)) return;
    if (event.data.type === "SW_UPDATED") {
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
  };
}

const LOCAL_DEV_CACHE_RESET_KEY = "zenflow:local-dev-cache-reset:v1";

function isLocalDevCacheResetRequest() {
  const hostname = window.location.hostname;
  return (
    new URLSearchParams(window.location.search).get("dev") === "true" &&
    (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1")
  );
}

async function resetLocalDevPwaCaches() {
  if (!isLocalDevCacheResetRequest()) return;
  if (window.sessionStorage.getItem(LOCAL_DEV_CACHE_RESET_KEY) === "done") return;

  window.sessionStorage.setItem(LOCAL_DEV_CACHE_RESET_KEY, "done");
  const hadController = Boolean(navigator.serviceWorker?.controller);

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    if ("caches" in window) {
      const names = await window.caches.keys();
      await Promise.all(names.map((name) => window.caches.delete(name)));
    }
    if (hadController) {
      window.location.reload();
    }
  } catch (error) {
    logger.warn("[Main] Local dev cache reset failed:", error);
  }
}

void resetLocalDevPwaCaches();

// Global error handlers for unhandled exceptions and promise rejections
// These catch errors that escape React's error boundary
window.addEventListener("unhandledrejection", (event) => {
  if (event.defaultPrevented) return;
  // The bounded buffer and fixed-code logger are the canonical diagnostics.
  // Prevent the browser/WebView from additionally printing the raw reason.
  event.preventDefault();

  const reason = event.reason;
  const message = getErrorMessage(reason);

  if (isChunkLoadMessage(message)) {
    event.preventDefault();
    return;
  }

  // Suppress generic browser/Capacitor permission rejections (e.g. notification denied)
  if (reason === "Rejected" || message === "Rejected") {
    event.preventDefault();
    logger.warn("[Global] Suppressed generic rejection:", reason);
    return;
  }

  logger.error("[Global] Unhandled promise rejection:", reason);
  // Keep a bounded in-memory record for the current runtime only.
  try {
    if (reason instanceof Error) {
      captureOrBuffer(reason, { type: "unhandledrejection" });
    }
  } catch {
    logger.error("[Global] Unhandled rejection classification failed");
  }
});

window.addEventListener("error", (event) => {
  if (event.defaultPrevented) return;
  // React 18 and browsers otherwise forward the original Error to console,
  // bypassing the diagnostic privacy boundary below.
  event.preventDefault();

  const message = getErrorMessage(event.error) ?? getErrorMessage(event.message);
  if (isChunkLoadMessage(message)) {
    event.preventDefault();
    return;
  }

  logger.error("[Global] Uncaught error:", event.error || event.message);
  // Send to Sentry (buffered if Sentry not yet loaded)
  try {
    if (event.error instanceof Error) {
      captureOrBuffer(event.error, { type: "uncaught" });
    }
  } catch {
    logger.error("[Global] Uncaught error classification failed");
  }
});

// Vite preload-error handler (P1 — research 2026-04-18)
// Fires when <link rel="modulepreload"> or dynamic `import()` fails (CSS/JS chunk
// 404 after deploy). Distinct event from generic `error` — has typed `.payload`
// with the Error. Dispatch the same CHUNK_LOAD_ERROR_EVENT the dialog listens for.
// Source: vite.dev/guide/build.html#load-error-handling, vitejs/vite#11804.
window.addEventListener("vite:preloadError", (event) => {
  // Prevent Vite's default auto-reload — dialog gives user control (see research §4).
  event.preventDefault();
  logger.warn("[Vite] Preload error");
  window.dispatchEvent(
    new CustomEvent("zenflow:chunk-load-error", {
      detail: { message: "ZF_VITE_PRELOAD_ERROR", chunk: "preload", timestamp: Date.now() },
    })
  );
});

/**
 * Handle app close/background to prevent data loss
 *
 * beforeunload: Web - when tab is closed or refreshed
 * visibilitychange: Both - when app goes to background
 *
 * Synchronous localStorage marker is used here — beforeunload handlers have
 * ~10ms budget and localStorage is the only sync storage. The marker contains
 * fixed codes and a count only; the full authoritative queue remains in Dexie.
 */
// Save critical state before app closes
window.addEventListener("beforeunload", () => {
  const pendingActions = savePendingQueueSnapshot({ phase: "before-unload" });
  if (pendingActions > 0) {
    logger.log(`[Main] Saved ${pendingActions} pending actions before unload`);
  }
});

/**
 * Lifecycle event deduplication
 * On native platforms, both visibilitychange AND Capacitor pause/resume fire for the same event.
 * This prevents double-calling pauseAllAudio()/resumeAllAudio() which can cause race conditions.
 */
let isHandlingPause = false;
let isHandlingResume = false;
let pendingLifecycleTaskId: number | null = null;

function savePendingQueueSnapshot(
  options: {
    phase?: "before-unload" | "hidden";
  } = {}
): number {
  try {
    const queueState = offlineQueue.getState();
    if (queueState.actions.length === 0) return 0;

    writeLifecycleSnapshot({
      phase: options.phase ?? "hidden",
      pendingActionCount: queueState.actions.length,
    });
    return queueState.actions.length;
  } catch (_error) {
    // Ignore errors during lifecycle snapshots.
    return 0;
  }
}

function inspectRetainedLifecycleSnapshot(): void {
  const lifecycleSnapshot = readLifecycleSnapshot();
  if (lifecycleSnapshot.status === "invalid-retained") {
    logger.warn("[Main] Invalid lifecycle marker could not be removed");
  }
}

function yieldToNextTask(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

function scheduleLifecycleTask(kind: "pause" | "resume"): void {
  if (pendingLifecycleTaskId !== null) {
    window.clearTimeout(pendingLifecycleTaskId);
  }

  pendingLifecycleTaskId = window.setTimeout(() => {
    pendingLifecycleTaskId = null;
    if (kind === "pause") {
      handleAppPause();
      return;
    }
    void handleAppResume();
  }, 0);
}

function handleAppPause(): void {
  if (isHandlingPause) return;
  isHandlingPause = true;

  pauseAllAudio();

  // Flush pending cloud sync immediately (bypasses 60s debounce)
  // Prevents data loss when user closes app right after recording mood/habit
  try {
    flushCloudSync();
  } catch (err) {
    logger.warn("[Main] cloudSync flush failed during pause:", err);
  }

  savePendingQueueSnapshot({ phase: "hidden" });

  // Reset flag after short delay to allow next pause event
  setTimeout(() => {
    isHandlingPause = false;
  }, 100);
}

async function handleAppResume(): Promise<void> {
  if (isHandlingResume) return;
  isHandlingResume = true;

  try {
    inspectRetainedLifecycleSnapshot();
    if (isNative) {
      try {
        dispatchNativeReminderReconcile("app-resume");
      } catch (error) {
        logger.warn("[Main] Reminder recovery wake failed:", error);
      }
    }

    await yieldToNextTask();
    await resumeAllAudio();
    await yieldToNextTask();

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
        const navigated = await forceHardReload();
        if (navigated) return;
      }
    }

    // Trigger sync if online — drain offline queue + delta pull + haptic feedback
    await yieldToNextTask();

    if (navigator.onLine) {
      const resumeOwnerUserId = await getCurrentSessionUserId();
      let queueReadyForDelta = Boolean(resumeOwnerUserId);
      if (
        resumeOwnerUserId &&
        (await offlineQueue.hasPendingActionsForOwnerReady(resumeOwnerUserId))
      ) {
        logger.log("[Main] Processing pending offline queue on resume");
        try {
          await offlineQueue.processQueue();
          queueReadyForDelta =
            (await getCurrentSessionUserId()) === resumeOwnerUserId &&
            !offlineQueue.hasPendingActionsForOwner(resumeOwnerUserId);
          if (queueReadyForDelta) {
            void hapticSuccess(); // Subtle feedback: queued changes synced
          }
        } catch (err) {
          queueReadyForDelta = false;
          logger.warn("[Main] Offline queue processing on resume failed:", err);
        }
      }
      if (queueReadyForDelta && (await getCurrentSessionUserId()) !== resumeOwnerUserId) {
        queueReadyForDelta = false;
      }
      // Delta pull on resume — fetch and apply new events from the eventSync cursor.
      if (queueReadyForDelta) {
        void runWithSyncLeaderLock("resume-delta-sync", () => pullAndApplyDeltasFromLastSeq())
          .then((locked) => {
            if (!locked.acquired) {
              logger.log("[Main] Delta pull on resume skipped; another tab owns sync");
              return;
            }

            const result = locked.value;
            if (!result) return;
            if (result.fetched > 0) {
              logger.log(
                `[Main] Delta applied on resume: fetched=${result.fetched}, applied=${result.applied}, seq=${result.lastSeq}`
              );
            }
          })
          .catch((err) => logger.warn("[Main] Delta pull on resume failed:", err));
      } else {
        logger.warn("[Main] Delta pull on resume skipped; saved actions still need retry");
      }
    }
    // Clean up stale share cache files (24+ hours old)
    void cleanupShareCache();
  } finally {
    // A blocked reload or failed resume task must not permanently disable resume handling.
    setTimeout(() => {
      isHandlingResume = false;
    }, 100);
  }
}

// Handle visibility change (app going to background on mobile)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    savePendingQueueSnapshot({ phase: "hidden" });
    scheduleLifecycleTask("pause");
  } else if (document.visibilityState === "visible") {
    scheduleLifecycleTask("resume");
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
    scheduleLifecycleTask("pause");
  });

  // App resumed (coming back to foreground)
  const resumeListener = CapacitorApp.addListener("resume", () => {
    logger.log("[Main] App resumed - checking for pending sync");
    scheduleLifecycleTask("resume");
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

// Ambient sounds load on demand so the web/PWA/Capacitor startup path stays light.

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
 * Check app version before rendering only for recovery-critical paths.
 *
 * This prevents chunk load errors after deployment by detecting
 * version mismatch before OAuth/chunk-retry flows load additional chunks.
 * Regular freshness checks run after first paint so startup stays responsive.
 */
let didBlockingVersionCheck = false;

async function ensureFreshVersionBeforeRender(): Promise<boolean> {
  const priorityCheck = isOAuthReturn() || shouldCheckVersion();
  if (!priorityCheck) return true;

  didBlockingVersionCheck = true;
  logger.log("[Main] Checking app version before recovery render...");

  const isUpToDate = await checkAppVersion();
  markVersionChecked();

  if (!isUpToDate) {
    logger.log("[Main] Outdated version detected, performing hard reload...");
    await forceHardReload();
    return false;
  }

  logger.log("[Main] Version is up to date");
  return true;
}

function scheduleVersionCheckAfterStartup(): void {
  if (didBlockingVersionCheck || isNative || !navigator.onLine || !shouldAutoCheckVersion()) {
    return;
  }

  scheduleIdle(
    () => {
      checkAppVersion()
        .then((isUpToDate) => {
          markVersionChecked();
          if (!isUpToDate) {
            logger.log("[Main] Outdated version detected after startup, reloading...");
            void forceHardReload();
          }
        })
        .catch((err) => logger.warn("[Main] Startup version check failed:", err));
    },
    5000,
    3000
  );
}

// React 18 `onRecoverableError` forwards recoverable hydration/concurrent errors
// to the bounded in-memory buffer. React 19 adds onCaughtError/onUncaughtError —
// not yet available here.
// Source: react.dev/reference/react-dom/client/createRoot#parameters, 2025.
const rootOptions = {
  onRecoverableError: (error: unknown) => {
    if (error instanceof Error) {
      captureOrBuffer(error, { type: "recoverable", source: "react" });
    }
  },
};

inspectRetainedLifecycleSnapshot();

function renderConfiguredRoot(): void {
  createRoot(document.getElementById("root")!, rootOptions).render(<App />);
}

// Language is part of the first useful frame; version checks block only recovery paths.
Promise.all([ensureFreshVersionBeforeRender(), prepareInitialLanguageBeforeRender()])
  .then(([shouldRender]) => {
    if (shouldRender) {
      renderConfiguredRoot();
      scheduleVersionCheckAfterStartup();
      scheduleRuntimeAudioCacheWarmAfterStartup();
    }
  })
  .catch((err) => {
    logger.error("[Init] Fatal:", err);
    renderConfiguredRoot();
    scheduleVersionCheckAfterStartup();
    scheduleRuntimeAudioCacheWarmAfterStartup();
  });
