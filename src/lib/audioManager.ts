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
import { storageGetRaw, storageSetRaw } from '@/lib/safeJson';
import { SK } from '@/lib/storageKeys';
import { shouldPlaySounds } from './animationUtils';
import { canPlayFeedbackSound, consumeAudioFeedbackBudget } from './audioComfort';

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

const HIGH_SALIENCE_SOUND_TYPES = new Set<SoundType>(['streak', 'milestone', 'levelUp']);
const DEFERRED_ACTION_SOUND_TYPES = new Set<SoundType>(['success', 'complete', 'notification']);
const LOW_SALIENCE_DELAY_MS = 160;
const HIGH_SALIENCE_SUPPRESSION_MS = 1200;

let pendingActionSound: { id: number; type: SoundType } | null = null;
let lastHighSalienceSoundAt = 0;

function getAudioSettingsSnapshot(): AudioSettingsSnapshot {
  const feedbackSoundsEnabled = shouldPlaySounds();
  return {
    muted: state.isMuted,
    volume: state.volume,
    feedbackSoundsEnabled,
    canPlayFeedback: !state.isMuted && state.volume > 0 && feedbackSoundsEnabled,
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
      event.key !== SK.AUDIO_VOLUME &&
      event.key !== SK.DOPAMINE_SETTINGS
    ) {
      return;
    }

    initAudioManager();
    notify();
  };

  window.addEventListener(AUDIO_SETTINGS_CHANGE_EVENT, notify);
  window.addEventListener('dopamine-settings-change', notify);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(AUDIO_SETTINGS_CHANGE_EVENT, notify);
    window.removeEventListener('dopamine-settings-change', notify);
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
  if (state.isMuted || state.volume <= 0 || !shouldPlaySounds()) return;
  playTone(587.33, 0.1, 'sine', 0.05);
}

export function playNotification(): void {
  if (state.isMuted || state.volume <= 0 || !shouldPlaySounds()) return;
  if (!canPlayFeedbackSound('notification')) return;
  if (!consumeAudioFeedbackBudget('notification')) return;
  playNotificationTone();
}

export function playNotificationPreview(): void {
  if (state.isMuted || state.volume <= 0 || !shouldPlaySounds()) return;
  if (!canPlayFeedbackSound('notification')) return;
  playNotificationTone();
}

function playSoundNow(type: SoundType): void {
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
  if (state.isMuted || state.volume <= 0 || !shouldPlaySounds()) {
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
    if (!canPlayFeedbackSound(type) || state.isMuted || state.volume <= 0 || !shouldPlaySounds()) return;
    if (!consumeAudioFeedbackBudget(type)) return;
    playSoundNow(type);
  }, LOW_SALIENCE_DELAY_MS);
  pendingActionSound = { id, type };
}

// Mute control
export function setMuted(muted: boolean): void {
  state.isMuted = muted;
  storageSetRaw(SK.AUDIO_MUTED, muted ? '1' : '0');
  emitAudioSettingsChange();
}

export function isMuted(): boolean {
  return state.isMuted;
}

// Volume control (0.0 - 1.0)
export function setVolume(volume: number): void {
  state.volume = Math.max(0, Math.min(1, volume));
  storageSetRaw(SK.AUDIO_VOLUME, state.volume.toString());
  emitAudioSettingsChange();
}

export function getVolume(): number {
  return state.volume;
}

// Initialize from localStorage
export function initAudioManager(): void {
  const mutedStr = storageGetRaw(SK.AUDIO_MUTED);
  state.isMuted = mutedStr === '1';

  const volumeStr = storageGetRaw(SK.AUDIO_VOLUME);
  state.volume = volumeStr ? safeParseFloat(volumeStr, 0.3, 0, 1) : 0.3;
}

// Resume context on user interaction (required for mobile)
export async function resumeOnInteraction(): Promise<void> {
  await ensureContextResumed();
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

  if (state.context) {
    void state.context.close();
    state.context = null;
  }
}

// Export state for debugging
export function getState(): Readonly<AudioManagerState> {
  return { ...state };
}
