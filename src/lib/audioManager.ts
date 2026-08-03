// Procedural feedback audio manager.
// Long ambient tracks are managed separately in ambientSounds because iOS unlock
// and blessed HTMLAudioElement handling have different lifecycle requirements.

import { logger } from './logger';

// Extend Window interface for webkit AudioContext (Safari)
declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
import { safeParseFloat } from '@/lib/validation';
import { storageGetRaw, storageReadRaw, storageRemove, storageSetRaw } from '@/lib/safeJson';
import { SK } from '@/lib/storageKeys';
import { canPlayFeedbackSound, consumeAudioFeedbackBudget } from './audioComfort';
import { BASE_URL } from '@/lib/env';

export type SoundType = 'success' | 'complete' | 'streak' | 'milestone' | 'levelUp' | 'notification';

export const AUDIO_SETTINGS_CHANGE_EVENT = 'zenflow-audio-settings-change';

export interface AudioSettingsSnapshot {
  muted: boolean;
  volume: number;
  feedbackSoundsEnabled: boolean;
  canPlayFeedback: boolean;
}

interface AudioManagerState {
  context: AudioContext | null;
  isMuted: boolean;
  volume: number;
  activeTimeouts: number[];
}

const state: AudioManagerState = {
  context: null,
  isMuted: false,
  volume: 0.3,
  activeTimeouts: [],
};

const DEFAULT_AUDIO_VOLUME = 0.3;

// ============================================
// MASTERED FEEDBACK CUES (MP3) WITH PROCEDURAL FALLBACK
// ============================================
// Mastered MP3 cues live in public/sounds/feedback/. They are the primary
// voice for action feedback; the procedural oscillator tones below remain as
// the always-available fallback for the first play (before the buffer is
// decoded), offline failures, and platforms without decodeAudioData.
// Governance (salience, deferral, fatigue budgets, comfort settings, master
// volume) applies identically to both voices because it wraps playSoundNow.

const FEEDBACK_CUE_FILES: Record<SoundType, string> = {
  success: 'sounds/feedback/feedback-success.mp3',
  complete: 'sounds/feedback/feedback-complete.mp3',
  streak: 'sounds/feedback/feedback-streak.mp3',
  milestone: 'sounds/feedback/feedback-milestone.mp3',
  levelUp: 'sounds/feedback/feedback-milestone.mp3',
  notification: 'sounds/feedback/feedback-notification.mp3',
};

// Per-type loudness trims mirroring the procedural gain hierarchy so the
// mastered cues keep the same calm relative balance under the master volume.
const FEEDBACK_CUE_GAIN: Record<SoundType, number> = {
  success: 0.35,
  complete: 0.4,
  streak: 0.45,
  milestone: 0.45,
  levelUp: 0.45,
  notification: 0.2,
};

type CueCacheEntry = AudioBuffer | 'loading' | 'failed';
const cueBufferCache = new Map<SoundType, CueCacheEntry>();

function getCueUrl(type: SoundType): string {
  return BASE_URL + FEEDBACK_CUE_FILES[type];
}

function loadCueBuffer(type: SoundType): void {
  if (cueBufferCache.has(type)) return;
  const ctx = getAudioContext();
  if (!ctx || typeof ctx.decodeAudioData !== 'function' || typeof fetch !== 'function') {
    cueBufferCache.set(type, 'failed');
    return;
  }
  cueBufferCache.set(type, 'loading');
  fetch(getCueUrl(type))
    .then((response) => {
      if (!response.ok) throw new Error(`cue ${type}: HTTP ${response.status}`);
      return response.arrayBuffer();
    })
    .then((bytes) => ctx.decodeAudioData(bytes))
    .then((buffer) => {
      cueBufferCache.set(type, buffer);
    })
    .catch((e) => {
      cueBufferCache.set(type, 'failed');
      logger.warn(`[AudioManager] Mastered cue unavailable, procedural fallback stays active (${type}):`, e);
    });
}

/** Warm mastered cues from a user-gesture context (iOS-safe decode ahead of play). */
export function preloadFeedbackCues(): void {
  (Object.keys(FEEDBACK_CUE_FILES) as SoundType[]).forEach(loadCueBuffer);
}

/** Play a decoded mastered cue through the shared context. Returns false when unavailable. */
function playMasteredCueNow(type: SoundType): boolean {
  if (typeof AudioBuffer === 'undefined') return false;
  const entry = cueBufferCache.get(type);
  if (!(entry instanceof AudioBuffer)) return false;
  const ctx = getAudioContext();
  if (!ctx) return false;
  if (needsAudioContextResume(ctx)) return false; // stay procedural until context runs

  try {
    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();
    source.buffer = entry;
    gainNode.gain.value = Math.max(0.0001, state.volume * FEEDBACK_CUE_GAIN[type]);
    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    source.start(ctx.currentTime);
    return true;
  } catch (e) {
    logger.warn('[AudioManager] Mastered cue playback failed:', e);
    return false;
  }
}

const HIGH_SALIENCE_SOUND_TYPES = new Set<SoundType>(['streak', 'milestone', 'levelUp']);
const DEFERRED_ACTION_SOUND_TYPES = new Set<SoundType>(['success', 'complete', 'notification']);
const LOW_SALIENCE_DELAY_MS = 160;
const HIGH_SALIENCE_SUPPRESSION_MS = 1200;

let pendingActionSound: { id: number; type: SoundType } | null = null;
let lastHighSalienceSoundAt = 0;

function getAudioSettingsSnapshot(): AudioSettingsSnapshot {
  const canPlayFeedback = !state.isMuted && state.volume > 0;
  return {
    muted: state.isMuted,
    volume: state.volume,
    feedbackSoundsEnabled: canPlayFeedback,
    canPlayFeedback,
  };
}

function emitAudioSettingsChange(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<AudioSettingsSnapshot>(AUDIO_SETTINGS_CHANGE_EVENT, {
      detail: getAudioSettingsSnapshot(),
    }),
  );
}

export function getAudioSettings(): AudioSettingsSnapshot {
  return getAudioSettingsSnapshot();
}

export function getAppAudioVolume(baseVolume = 1): number {
  if (state.isMuted) return 0;
  return Math.max(0, Math.min(1, state.volume * baseVolume));
}

export function canPlayAppAudio(): boolean {
  return !state.isMuted;
}

export function subscribeAudioSettings(
  listener: (settings: AudioSettingsSnapshot) => void,
): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const notify = () => listener(getAudioSettingsSnapshot());
  const handleStorage = (event: StorageEvent) => {
    if (
      event.key !== SK.AUDIO_MUTED &&
      event.key !== SK.AUDIO_VOLUME
    ) {
      return;
    }

    initAudioManager();
    notify();
  };

  window.addEventListener(AUDIO_SETTINGS_CHANGE_EVENT, notify);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(AUDIO_SETTINGS_CHANGE_EVENT, notify);
    window.removeEventListener('storage', handleStorage);
  };
}

// Helper to schedule timeout with tracking
function scheduleTimeout(callback: () => void, delay: number): number {
  const id = window.setTimeout(() => {
    callback();
    // Remove from active list after execution
    const index = state.activeTimeouts.indexOf(id);
    if (index > -1) state.activeTimeouts.splice(index, 1);
  }, delay);
  state.activeTimeouts.push(id);
  return id;
}

function clearPendingActionSound(): void {
  if (!pendingActionSound) return;
  clearTimeout(pendingActionSound.id);
  const index = state.activeTimeouts.indexOf(pendingActionSound.id);
  if (index > -1) state.activeTimeouts.splice(index, 1);
  pendingActionSound = null;
}

// Lazy initialization of AudioContext (required for mobile)
// Exported for shared use with ambientSounds
export function getAudioContext(): AudioContext | null {
  if (state.context) return state.context;

  try {
    state.context = new (window.AudioContext || window.webkitAudioContext)();
    return state.context;
  } catch (e) {
    logger.warn('[AudioManager] AudioContext not available:', e);
    return null;
  }
}

// Resume context if suspended or interrupted (required for iOS)
async function ensureContextResumed(): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx) return false;

  if (needsAudioContextResume(ctx)) {
    try {
      await ctx.resume();
    } catch (e) {
      logger.warn('[AudioManager] Failed to resume context:', e);
      return false;
    }
  }
  return true;
}

function needsAudioContextResume(ctx: AudioContext): boolean {
  return ctx.state === 'suspended' || (ctx.state as string) === 'interrupted';
}

function emitToneWithContext(
  ctx: AudioContext,
  frequency: number,
  duration: number,
  type: OscillatorType,
  gainScale: number,
): void {
  try {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;

    const scaledVolume = state.volume * gainScale;
    if (scaledVolume <= 0) return;
    const volume = Math.max(0.0001, scaledVolume);
    const fadeTarget = Math.min(volume, 0.01);
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(fadeTarget, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch (_e) {
    // Audio not available - silent fail
  }
}

// Play a simple tone (for UI feedback)
function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  gainScale = 0.1,
): void {
  if (state.isMuted || state.volume <= 0) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  const emitIfStillAllowed = () => {
    if (state.isMuted || state.volume <= 0 || needsAudioContextResume(ctx)) return;
    emitToneWithContext(ctx, frequency, duration, type, gainScale);
  };

  if (needsAudioContextResume(ctx)) {
    void ctx
      .resume()
      .then(emitIfStillAllowed)
      .catch((e) => logger.warn('[AudioManager] Failed to resume context before tone:', e));
    return;
  }

  emitToneWithContext(ctx, frequency, duration, type, gainScale);
}

// Play success chime (task completed)
function emitSuccessTone(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const notes = [
      { freq: 392, delay: 0, duration: 0.12 },
      { freq: 493.88, delay: 70, duration: 0.14 },
    ];

    notes.forEach(({ freq, delay, duration }) => {
      scheduleTimeout(() => playTone(freq, duration, 'sine', 0.105), delay);
    });
  } catch (_e) {
    // Silent fail
  }
}

export function playSuccess(): void {
  playSound('success');
}

// Play completion chime (habit/focus finished)
function emitCompleteTone(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const notes = [
      { freq: 329.63, delay: 0, duration: 0.13 },
      { freq: 392, delay: 80, duration: 0.15 },
      { freq: 493.88, delay: 170, duration: 0.18 },
    ];

    notes.forEach(({ freq, delay, duration }) => {
      scheduleTimeout(() => playTone(freq, duration, 'triangle', 0.12), delay);
    });
  } catch (_e) {
    // Silent fail
  }
}

export function playComplete(): void {
  playSound('complete');
}

// Play streak milestone sound
function emitStreakMilestoneTone(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const notes = [
      { freq: 349.23, delay: 0, duration: 0.14 },
      { freq: 440, delay: 80, duration: 0.16 },
      { freq: 523.25, delay: 170, duration: 0.18 },
      { freq: 587.33, delay: 270, duration: 0.2 },
    ];

    notes.forEach(({ freq, delay, duration }) => {
      scheduleTimeout(() => playTone(freq, duration, 'triangle', 0.135), delay);
    });
  } catch (_e) {
    // Silent fail
  }
}

export function playStreakMilestone(): void {
  playSound('streak');
}

// Play a soft cue reserved for rare milestones.
function emitMilestoneTone(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const notes = [
      { freq: 392, delay: 0, duration: 0.14 },
      { freq: 493.88, delay: 80, duration: 0.16 },
      { freq: 587.33, delay: 175, duration: 0.2 },
    ];

    notes.forEach(({ freq, delay, duration }) => {
      scheduleTimeout(() => playTone(freq, duration, 'triangle', 0.135), delay);
    });
  } catch (_e) {
    // Silent fail
  }
}

export function playMilestone(): void {
  playSound('milestone');
}

export function playLevelUp(): void {
  playSound('levelUp');
}

// Play notification ping
function playNotificationTone(): void {
  if (state.isMuted || state.volume <= 0) return;
  playTone(587.33, 0.1, 'sine', 0.05);
}

export function playNotification(): void {
  if (state.isMuted || state.volume <= 0) return;
  if (!canPlayFeedbackSound('notification')) return;
  if (!consumeAudioFeedbackBudget('notification')) return;
  loadCueBuffer('notification');
  if (playMasteredCueNow('notification')) return;
  playNotificationTone();
}

/**
 * Explicit user-initiated preview of a feedback cue (settings screen).
 * Plays immediately without deferral or fatigue-budget consumption,
 * mastered MP3 first with procedural fallback. Honors comfort toggles so
 * the preview honestly reflects what a real event would play.
 */
export function playFeedbackPreview(type: SoundType): void {
  if (state.isMuted || state.volume <= 0) return;
  if (!canPlayFeedbackSound(type)) return;
  playSoundNow(type);
}

export function playNotificationPreview(): void {
  playFeedbackPreview('notification');
}

function playSoundNow(type: SoundType): void {
  // Mastered MP3 cue is the primary voice once decoded; kick off the load so
  // subsequent plays use it. Procedural tones cover the first play and any
  // environment where the cue cannot be fetched or decoded.
  loadCueBuffer(type);
  if (playMasteredCueNow(type)) return;

  switch (type) {
    case 'success':
      emitSuccessTone();
      break;
    case 'complete':
      emitCompleteTone();
      break;
    case 'streak':
      emitStreakMilestoneTone();
      break;
    case 'milestone':
      emitMilestoneTone();
      break;
    case 'levelUp':
      emitMilestoneTone();
      break;
    case 'notification':
      playNotificationTone();
      break;
  }
}

// Play by sound type. Low-salience action cues are briefly deferred so a
// rare milestone cue in the same transaction can replace them instead of stacking.
export function playSound(type: SoundType): void {
  if (state.isMuted || state.volume <= 0) {
    clearPendingActionSound();
    return;
  }
  if (!canPlayFeedbackSound(type)) return;

  if (HIGH_SALIENCE_SOUND_TYPES.has(type)) {
    clearPendingActionSound();
    if (!consumeAudioFeedbackBudget(type)) return;
    lastHighSalienceSoundAt = Date.now();
    playSoundNow(type);
    return;
  }

  if (!DEFERRED_ACTION_SOUND_TYPES.has(type)) {
    if (!consumeAudioFeedbackBudget(type)) return;
    playSoundNow(type);
    return;
  }

  if (Date.now() - lastHighSalienceSoundAt < HIGH_SALIENCE_SUPPRESSION_MS) return;

  clearPendingActionSound();
  const id = scheduleTimeout(() => {
    pendingActionSound = null;
    if (Date.now() - lastHighSalienceSoundAt < HIGH_SALIENCE_SUPPRESSION_MS) return;
    if (!canPlayFeedbackSound(type) || state.isMuted || state.volume <= 0) return;
    if (!consumeAudioFeedbackBudget(type)) return;
    playSoundNow(type);
  }, LOW_SALIENCE_DELAY_MS);
  pendingActionSound = { id, type };
}

// Mute control
export function setMuted(muted: boolean): boolean {
  if (!storageSetRaw(SK.AUDIO_MUTED, muted ? '1' : '0')) return false;
  state.isMuted = muted;
  emitAudioSettingsChange();
  return true;
}

export function setAudioEnabled(enabled: boolean): boolean {
  const nextMuted = !enabled;
  const nextVolume = enabled && state.volume <= 0 ? DEFAULT_AUDIO_VOLUME : state.volume;
  const previousMuted = storageReadRaw(SK.AUDIO_MUTED);

  if (!storageSetRaw(SK.AUDIO_MUTED, nextMuted ? '1' : '0')) return false;
  if (nextVolume !== state.volume && !storageSetRaw(SK.AUDIO_VOLUME, nextVolume.toString())) {
    if (previousMuted.ok && previousMuted.value !== null) {
      storageSetRaw(SK.AUDIO_MUTED, previousMuted.value);
    } else {
      storageRemove(SK.AUDIO_MUTED);
    }
    return false;
  }

  state.isMuted = nextMuted;
  state.volume = nextVolume;
  emitAudioSettingsChange();
  return true;
}

export function isMuted(): boolean {
  return state.isMuted;
}

// Volume control (0.0 - 1.0)
export function setVolume(volume: number): boolean {
  const nextVolume = Math.max(0, Math.min(1, volume));
  if (!storageSetRaw(SK.AUDIO_VOLUME, nextVolume.toString())) return false;
  state.volume = nextVolume;
  emitAudioSettingsChange();
  return true;
}

export function getVolume(): number {
  return state.volume;
}

// Initialize from localStorage
export function initAudioManager(): void {
  const mutedStr = storageGetRaw(SK.AUDIO_MUTED);
  state.isMuted = mutedStr === '1';

  const volumeStr = storageGetRaw(SK.AUDIO_VOLUME);
  state.volume = volumeStr
    ? safeParseFloat(volumeStr, DEFAULT_AUDIO_VOLUME, 0, 1)
    : DEFAULT_AUDIO_VOLUME;
}

// Resume context on user interaction (required for mobile)
export async function resumeOnInteraction(): Promise<void> {
  await ensureContextResumed();
  // User gesture is the safest moment to warm mastered feedback cues (iOS).
  preloadFeedbackCues();
}

/**
 * Suspend AudioContext when app goes to background.
 * This releases audio resources and prevents battery drain.
 */
export async function suspendContext(): Promise<void> {
  const ctx = state.context;
  if (!ctx || ctx.state === 'closed') return;

  try {
    if (ctx.state === 'running') {
      await ctx.suspend();
      logger.log('[AudioManager] Context suspended');
    }
  } catch (e) {
    logger.warn('[AudioManager] Failed to suspend context:', e);
  }
}

/**
 * Resume AudioContext when app comes to foreground.
 * Returns true if context is running after resume attempt.
 */
export async function resumeContext(): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx) return false;

  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
      logger.log('[AudioManager] Context resumed');
    }
    return ctx.state === 'running';
  } catch (e) {
    logger.warn('[AudioManager] Failed to resume context:', e);
    return false;
  }
}

// Cleanup (for testing/unmount)
export function cleanup(): void {
  // Clear all pending audio timeouts
  state.activeTimeouts.forEach(id => clearTimeout(id));
  state.activeTimeouts.length = 0;
  pendingActionSound = null;
  lastHighSalienceSoundAt = 0;
  cueBufferCache.clear();

  if (state.context) {
    void state.context.close();
    state.context = null;
  }
}

// Export state for debugging
export function getState(): Readonly<AudioManagerState> {
  return { ...state };
}
