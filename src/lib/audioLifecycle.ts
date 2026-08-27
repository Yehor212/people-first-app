/**
 * Audio Lifecycle Manager
 *
 * Centralized management of audio during app pause/resume events.
 * Solves the problem: sound doesn't work after minimizing the app on iOS/Android.
 *
 * This module handles:
 * - Capacitor app pause/resume events (mobile native)
 * - Browser visibilitychange events (web/PWA)
 * - Proper re-unlock of AudioContext on iOS after background
 */

import {
  getAmbientSoundGenerator,
  armAudioUnlockAfterResume,
  type AudioStatus,
} from "./ambientSounds";
import { resumeOnInteraction, suspendContext } from "./audioManager";
import { logger } from "./logger";
import type { SeverityLevel } from "@sentry/core";

// Lazy-load sentry to keep @sentry/* (~250 KB) off the critical rendering path.
// Breadcrumbs are fire-and-forget telemetry — async import is safe.
const lazyBreadcrumb = (bc: {
  category: string;
  message: string;
  level?: SeverityLevel;
  data?: Record<string, unknown>;
}) => {
  import("@/lib/sentry")
    .then(({ addBreadcrumb }) => addBreadcrumb(bc))
    .catch((e) => logger.warn("[Sentry] lazy load skipped:", e));
};

interface AudioLifecycleState {
  wasPlaying: boolean;
  soundId: string | null;
  pausedAt: number | null;
}

let lifecycleState: AudioLifecycleState = {
  wasPlaying: false,
  soundId: null,
  pausedAt: null,
};

let deferredResumeCleanup: (() => void) | null = null;
const backgroundPauseHandlers = new Set<() => void>();
const foregroundResumeHandlers = new Set<() => void | Promise<void>>();

export function registerAudioBackgroundPauseHandler(handler: () => void): () => void {
  backgroundPauseHandlers.add(handler);
  return () => backgroundPauseHandlers.delete(handler);
}

export function registerAudioForegroundResumeHandler(
  handler: () => void | Promise<void>
): () => void {
  foregroundResumeHandlers.add(handler);
  return () => foregroundResumeHandlers.delete(handler);
}

function pauseRegisteredAudio(): void {
  for (const pause of Array.from(backgroundPauseHandlers)) {
    try {
      pause();
    } catch (error) {
      logger.warn("[AudioLifecycle] Registered audio pause failed:", error);
    }
  }
}

async function resumeRegisteredAudio(): Promise<void> {
  for (const resume of Array.from(foregroundResumeHandlers)) {
    try {
      await Promise.resolve(resume());
    } catch (error) {
      logger.warn("[AudioLifecycle] Registered audio resume failed:", error);
    }
  }
}

function resetLifecycleState(): void {
  lifecycleState = { wasPlaying: false, soundId: null, pausedAt: null };
}

function clearDeferredResume(): void {
  if (!deferredResumeCleanup) return;
  deferredResumeCleanup();
  deferredResumeCleanup = null;
}

function deferResumeUntilUserGesture(soundId: string, pauseDuration: number): void {
  clearDeferredResume();

  let cleaned = false;
  const events = ["pointerdown", "touchstart", "touchend", "keydown"] as const;
  const handler = () => {
    if (cleaned) return;
    clearDeferredResume();

    try {
      void resumeOnInteraction().catch((error) => {
        logger.warn("[AudioLifecycle] Audio manager resume after gesture failed:", error);
      });
      getAmbientSoundGenerator().resumeDirect();
      logger.log("[AudioLifecycle] Audio resume started after user gesture");

      lazyBreadcrumb({
        category: "audio",
        message: "Audio resume deferred until user gesture",
        level: "info",
        data: { soundId, pauseDuration },
      });
    } catch (error) {
      logger.error("[AudioLifecycle] Failed to resume audio after user gesture:", error);
      lazyBreadcrumb({
        category: "audio",
        message: "Deferred audio resume failed",
        level: "error",
        data: { error: String(error) },
      });
    } finally {
      resetLifecycleState();
    }
  };

  deferredResumeCleanup = () => {
    if (cleaned) return;
    cleaned = true;
    for (const eventName of events) {
      document.removeEventListener(eventName, handler, true);
    }
  };

  for (const eventName of events) {
    document.addEventListener(eventName, handler, { capture: true, passive: true });
  }

  logger.log("[AudioLifecycle] Audio resume deferred until next user gesture");
}

/**
 * Pause all audio when app goes to background.
 * Call this from Capacitor 'pause' event or visibilitychange='hidden'.
 */
export function pauseAllAudio(): void {
  pauseRegisteredAudio();

  try {
    clearDeferredResume();
    const generator = getAmbientSoundGenerator();
    const status: AudioStatus = generator.getStatus();

    // Save state for restore
    lifecycleState = {
      wasPlaying: status.state === "playing",
      soundId: status.soundId,
      pausedAt: Date.now(),
    };

    void suspendContext().catch((error) => {
      logger.warn("[AudioLifecycle] Feedback AudioContext suspend failed:", error);
    });

    if (lifecycleState.wasPlaying) {
      generator.pause();
      logger.log("[AudioLifecycle] Paused audio on app background");

      // Sentry breadcrumb for debugging
      lazyBreadcrumb({
        category: "audio",
        message: "Audio paused on app background",
        level: "info",
        data: { soundId: lifecycleState.soundId },
      });
    }
  } catch (error) {
    logger.error("[AudioLifecycle] Error pausing audio:", error);
  }
}

/**
 * Resume audio when app comes to foreground.
 * Call this from Capacitor 'resume' event or visibilitychange='visible'.
 */
export async function resumeAllAudio(): Promise<void> {
  // Resume events are not user gestures. Re-arm unlock listeners and let each
  // opted-in HTML media owner attempt its own policy-safe recovery.
  try {
    armAudioUnlockAfterResume();
  } catch (e) {
    logger.warn("[AudioLifecycle] Failed to re-arm audio unlock on resume:", e);
  }

  await resumeRegisteredAudio();

  if (!lifecycleState.wasPlaying || !lifecycleState.soundId) {
    resetLifecycleState();
    return;
  }

  const pauseDuration = lifecycleState.pausedAt ? Date.now() - lifecycleState.pausedAt : 0;

  logger.log("[AudioLifecycle] Deferring audio resume after", pauseDuration, "ms");
  deferResumeUntilUserGesture(lifecycleState.soundId, pauseDuration);
}

/**
 * Get current lifecycle state (for debugging).
 */
export function getLifecycleState(): Readonly<AudioLifecycleState> {
  return { ...lifecycleState };
}

/**
 * Check if audio was playing before pause.
 * Useful for UI to show "tap to resume" if needed.
 */
export function wasAudioPlaying(): boolean {
  return lifecycleState.wasPlaying;
}
