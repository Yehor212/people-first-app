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

import { getAmbientSoundGenerator, forceUnlockAudio, type AudioStatus } from './ambientSounds';
import { resumeOnInteraction } from './audioManager';
import { logger } from './logger';
import * as Sentry from '@sentry/react';

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

/**
 * Pause all audio when app goes to background.
 * Call this from Capacitor 'pause' event or visibilitychange='hidden'.
 */
export function pauseAllAudio(): void {
  try {
    const generator = getAmbientSoundGenerator();
    const status: AudioStatus = generator.getStatus();

    // Save state for restore
    lifecycleState = {
      wasPlaying: status.state === 'playing',
      soundId: status.soundId,
      pausedAt: Date.now(),
    };

    if (lifecycleState.wasPlaying) {
      generator.pause();
      logger.log('[AudioLifecycle] Paused audio on app background');

      // Sentry breadcrumb for debugging
      Sentry.addBreadcrumb({
        category: 'audio',
        message: 'Audio paused on app background',
        level: 'info',
        data: { soundId: lifecycleState.soundId },
      });
    }
  } catch (error) {
    logger.error('[AudioLifecycle] Error pausing audio:', error);
  }
}

/**
 * Resume audio when app comes to foreground.
 * Call this from Capacitor 'resume' event or visibilitychange='visible'.
 */
export async function resumeAllAudio(): Promise<void> {
  if (!lifecycleState.wasPlaying || !lifecycleState.soundId) {
    return;
  }

  const pauseDuration = lifecycleState.pausedAt
    ? Date.now() - lifecycleState.pausedAt
    : 0;

  logger.log('[AudioLifecycle] Attempting to resume audio after', pauseDuration, 'ms');

  try {
    // Force re-unlock audio (critical for iOS)
    // iOS requires re-unlock after app was in background
    await forceUnlockAudio();

    // Also ensure audioManager's context is ready
    await resumeOnInteraction();

    // Resume ambient sounds
    const generator = getAmbientSoundGenerator();
    await generator.resume();

    logger.log('[AudioLifecycle] Audio resumed successfully');

    Sentry.addBreadcrumb({
      category: 'audio',
      message: 'Audio resumed on app foreground',
      level: 'info',
      data: {
        soundId: lifecycleState.soundId,
        pauseDuration,
      },
    });
  } catch (error) {
    logger.error('[AudioLifecycle] Failed to resume audio:', error);

    Sentry.addBreadcrumb({
      category: 'audio',
      message: 'Audio resume failed',
      level: 'error',
      data: { error: String(error) },
    });
  }

  // Reset state after attempt
  lifecycleState = {
    wasPlaying: false,
    soundId: null,
    pausedAt: null,
  };
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
