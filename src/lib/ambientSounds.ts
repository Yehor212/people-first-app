/**
 * Ambient Sound Player - LOCAL FILES ONLY
 *
 * All sounds are bundled with the app for reliability.
 * No external URLs to avoid CSP issues and 403 errors.
 *
 * iOS Audio Requirements:
 * - Audio must be unlocked via user gesture (touchstart/touchend/click)
 * - AudioContext must be created/resumed during user gesture
 * - MP3 format is more reliable than WAV on iOS
 * - playsInline attribute required for inline playback
 */

import { logger } from './logger';

// ============================================
// AUDIO STATUS TRACKING (P0 Fix)
// ============================================

export type AudioState = 'idle' | 'loading' | 'playing' | 'paused' | 'blocked' | 'error';

export interface AudioError {
  code: string;
  message: string;
  recoverable: boolean;
}

export interface AudioStatus {
  state: AudioState;
  soundId: string | null;
  error?: AudioError;
  isUnlocked: boolean;
}

export type AudioStatusListener = (status: AudioStatus) => void;

// Extend Window interface for webkit AudioContext (Safari)
declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
  interface HTMLAudioElement {
    webkitPreservesPitch?: boolean;
  }
}

// Sound categories based on actual available files
export type AmbientSoundType = 'none' | 'underwater' | 'thunderstorm' | 'ocean' | 'river' | 'cafe' | 'fireplace';

// Audio unlock state for mobile browsers
let audioUnlocked = false;
let unlockPromise: Promise<void> | null = null;
let globalAudioContext: AudioContext | null = null;
let audioUnlockSetup = false;

// Silent MP3 - more iOS compatible than WAV (0.5 second silence)
const SILENT_MP3 = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

/**
 * Get or create a global AudioContext
 * Keeping it alive helps with iOS audio issues
 */
function getAudioContext(): AudioContext {
  if (!globalAudioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      globalAudioContext = new AudioContextClass();
    }
  }
  return globalAudioContext!;
}

/**
 * iOS-specific audio unlock using oscillator trick
 */
async function unlockWithOscillator(): Promise<void> {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Resume context first
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Create a silent oscillator and play it briefly
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0; // Silent
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.start(0);
    oscillator.stop(ctx.currentTime + 0.001);

    logger.log('[AmbientSounds] Oscillator trick completed');
  } catch (e) {
    logger.warn('[AmbientSounds] Oscillator unlock failed:', e);
  }
}

/**
 * Unlock audio using HTML5 Audio element
 */
async function unlockWithAudioElement(): Promise<void> {
  try {
    const audio = new Audio();
    audio.src = SILENT_MP3;
    audio.volume = 0.01;
    audio.muted = true;
    audio.playsInline = true;
    audio.setAttribute('playsinline', '');
    audio.setAttribute('webkit-playsinline', '');

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      await playPromise;
    }
    audio.pause();
    audio.src = '';

    logger.log('[AmbientSounds] Audio element unlock completed');
  } catch (e) {
    logger.warn('[AmbientSounds] Audio element unlock failed:', e);
  }
}

/**
 * Unlock audio on mobile browsers.
 * Must be called in response to a user gesture (click/touch).
 * Uses multiple methods for maximum iOS compatibility.
 */
export async function unlockAudio(): Promise<void> {
  if (audioUnlocked) return;
  if (unlockPromise) return unlockPromise;

  unlockPromise = (async () => {
    try {
      // Run all unlock methods in parallel for best results
      await Promise.all([
        unlockWithAudioElement(),
        unlockWithOscillator(),
      ]);

      // Also ensure AudioContext is running
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        await ctx.resume();
      }

      audioUnlocked = true;
      logger.log('[AmbientSounds] Audio fully unlocked for mobile browser');
    } catch (e) {
      logger.warn('[AmbientSounds] Audio unlock had issues:', e);
      // Still mark as unlocked to avoid infinite retries
      audioUnlocked = true;
    } finally {
      unlockPromise = null;
    }
  })();

  return unlockPromise;
}

// Module-level reference for audio unlock handler (ensures same reference for add/remove)
let audioUnlockHandler: (() => Promise<void>) | null = null;
let audioUnlockCleanup: (() => void) | null = null;
let audioUnlockTimeoutId: ReturnType<typeof setTimeout> | null = null;

/**
 * Setup global audio unlock listeners.
 * Call this once at app startup to enable audio unlock on first user interaction.
 * This is crucial for iOS which requires audio to be unlocked during user gesture.
 */
export function setupAudioUnlock(): void {
  if (audioUnlockSetup) return;
  audioUnlockSetup = true;

  let cleaned = false;

  // Define handler first so it's available for cleanup
  audioUnlockHandler = async () => {
    try {
      await unlockAudio();
      // Immediately remove listeners after successful unlock
      if (audioUnlocked && audioUnlockCleanup) {
        audioUnlockCleanup();
      }
    } catch {
      // Keep listeners for retry on error
    }
  };

  // Store cleanup function with reference to handler
  audioUnlockCleanup = () => {
    if (cleaned || !audioUnlockHandler) return;
    cleaned = true;

    // Clear timeout if it hasn't fired yet
    if (audioUnlockTimeoutId) {
      clearTimeout(audioUnlockTimeoutId);
      audioUnlockTimeoutId = null;
    }

    document.removeEventListener('touchstart', audioUnlockHandler, true);
    document.removeEventListener('touchend', audioUnlockHandler, true);
    document.removeEventListener('click', audioUnlockHandler, true);
    document.removeEventListener('keydown', audioUnlockHandler, true);
    logger.log('[AmbientSounds] Audio unlock listeners removed');

    // Clear references
    audioUnlockHandler = null;
  };

  // Use capture phase to catch events before they're handled
  document.addEventListener('touchstart', audioUnlockHandler, { capture: true, passive: true });
  document.addEventListener('touchend', audioUnlockHandler, { capture: true, passive: true });
  document.addEventListener('click', audioUnlockHandler, { capture: true, passive: true });
  document.addEventListener('keydown', audioUnlockHandler, { capture: true, passive: true });

  // Fallback cleanup after 30 seconds (safety net)
  audioUnlockTimeoutId = setTimeout(audioUnlockCleanup, 30000);

  logger.log('[AmbientSounds] Audio unlock listeners set up');
}

/**
 * Check if audio is unlocked
 */
export function isAudioUnlocked(): boolean {
  return audioUnlocked;
}

/**
 * Force re-unlock audio (useful after app resume on iOS)
 */
export async function forceUnlockAudio(): Promise<void> {
  audioUnlocked = false;
  unlockPromise = null;
  await unlockAudio();
}

export interface SoundInfo {
  id: string;
  type: AmbientSoundType;
  nameRu: string;
  nameEn: string;
  file: string;
  fallbackFile?: string; // P0 Fix: MP3 fallback for WAV files
  description: string;
}

// Get base path from Vite config (or use default for GitHub Pages)
const BASE_PATH = import.meta.env.BASE_URL || '/people-first-app/';

/**
 * All available sounds - LOCAL ONLY
 * Names honestly describe what's in each file
 *
 * P0 Fix: WAV files have MP3 fallbacks for better cross-device compatibility.
 * Currently using WAV as primary (files exist), with MP3 as future optimization.
 * When MP3 files are created, swap file/fallbackFile order.
 *
 * To create MP3 files (P2 optimization):
 * ffmpeg -i input.wav -codec:a libmp3lame -qscale:a 4 output.mp3
 */
export const SOUNDS: SoundInfo[] = [
  {
    id: 'underwater',
    type: 'underwater',
    nameRu: 'Подводный гул',
    nameEn: 'Underwater Hum',
    file: `${BASE_PATH}sounds/mixkit-underwater-transmitter-hum-2135.wav`,
    fallbackFile: `${BASE_PATH}sounds/underwater.mp3`, // P2: Add MP3 for smaller size
    description: 'Deep underwater ambient sound'
  },
  {
    id: 'thunderstorm',
    type: 'thunderstorm',
    nameRu: 'Гроза в джунглях',
    nameEn: 'Jungle Thunderstorm',
    file: `${BASE_PATH}sounds/mixkit-calm-thunderstorm-in-the-jungle-2415.wav`,
    fallbackFile: `${BASE_PATH}sounds/thunderstorm.mp3`, // P2: Add MP3 for smaller size
    description: 'Thunder and rain in tropical jungle'
  },
  {
    id: 'ocean',
    type: 'ocean',
    nameRu: 'Волны у скал',
    nameEn: 'Waves on Rocks',
    file: `${BASE_PATH}sounds/mixkit-small-waves-harbor-rocks-1208.wav`,
    fallbackFile: `${BASE_PATH}sounds/ocean.mp3`, // P2: Add MP3 for smaller size
    description: 'Small waves hitting harbor rocks'
  },
  {
    id: 'river',
    type: 'river',
    nameRu: 'Природа у реки',
    nameEn: 'River Wildlife',
    file: `${BASE_PATH}sounds/mixkit-wildlife-environment-in-a-river-2456.wav`,
    fallbackFile: `${BASE_PATH}sounds/river.mp3`, // P2: Add MP3 for smaller size
    description: 'River sounds with wildlife'
  },
  {
    id: 'cafe',
    type: 'cafe',
    nameRu: 'Шум кафе',
    nameEn: 'Cafe Ambience',
    file: `${BASE_PATH}sounds/cafe-noise-32940.mp3`,
    description: 'Coffee shop background noise'
  },
  {
    id: 'fireplace',
    type: 'fireplace',
    nameRu: 'Треск камина',
    nameEn: 'Fireplace Crackling',
    file: `${BASE_PATH}sounds/fireplace-fx-56636.mp3`,
    description: 'Cozy fireplace crackling'
  }
];

/**
 * Get sound by ID
 */
export function getSoundById(id: string): SoundInfo | undefined {
  return SOUNDS.find(s => s.id === id);
}

/**
 * Get sound by type
 */
export function getSoundByType(type: AmbientSoundType): SoundInfo | undefined {
  if (type === 'none') return undefined;
  return SOUNDS.find(s => s.type === type);
}

export class AmbientSoundGenerator {
  private audioElement: HTMLAudioElement | null = null;
  private isPlaying = false;
  private currentSoundId: string | null = null;
  private volume = 0.5; // 50% default volume

  // Race condition prevention
  private isTransitioning = false;
  private playbackId = 0;
  private pendingPlayback: {
    id: number;
    abortController: AbortController;
  } | null = null;

  // P0 Fix: Status tracking
  private status: AudioStatus = {
    state: 'idle',
    soundId: null,
    isUnlocked: false,
  };
  private statusListeners: Set<AudioStatusListener> = new Set();
  private usedFallback = false; // Track if fallback was used (for diagnostics)

  /**
   * P0 Fix: Subscribe to status changes
   */
  addStatusListener(listener: AudioStatusListener): () => void {
    this.statusListeners.add(listener);
    // Immediately emit current status
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  /**
   * P0 Fix: Update and emit status
   */
  private setStatus(updates: Partial<AudioStatus>): void {
    this.status = { ...this.status, ...updates };
    this.statusListeners.forEach(listener => {
      try {
        listener(this.status);
      } catch (e) {
        logger.warn('[AmbientSounds] Status listener error:', e);
      }
    });
    logger.log('[AmbientSounds] Status updated:', this.status.state, this.status.soundId);
  }

  /**
   * P0 Fix: Get current status (for debugging)
   */
  getStatus(): AudioStatus {
    return { ...this.status };
  }

  /**
   * P0 Fix: Get debug info for diagnostics
   */
  getDebugInfo(): Record<string, unknown> {
    const ctx = globalAudioContext;
    return {
      status: this.status,
      audioContextState: ctx?.state ?? 'not created',
      audioUnlocked,
      currentSoundId: this.currentSoundId,
      isPlaying: this.isPlaying,
      isTransitioning: this.isTransitioning,
      volume: this.volume,
      usedFallback: this.usedFallback,
      audioElementState: this.audioElement ? {
        paused: this.audioElement.paused,
        readyState: this.audioElement.readyState,
        networkState: this.audioElement.networkState,
        error: this.audioElement.error?.message,
      } : null,
    };
  }

  async play(soundId: string): Promise<void> {
    if (soundId === 'none') {
      this.stop();
      return;
    }

    const sound = getSoundById(soundId);
    if (!sound) {
      logger.error(`[AmbientSounds] Sound not found: ${soundId}`);
      this.setStatus({
        state: 'error',
        soundId: null,
        error: { code: 'SOUND_NOT_FOUND', message: `Sound "${soundId}" not found`, recoverable: false },
      });
      return;
    }

    // Skip if already playing this exact sound
    if (this.currentSoundId === soundId && this.isPlaying && this.audioElement) {
      logger.log(`[AmbientSounds] Already playing ${soundId}, skipping`);
      return;
    }

    // Cancel any pending playback
    if (this.pendingPlayback) {
      this.pendingPlayback.abortController.abort();
      this.pendingPlayback = null;
    }

    // P0 Fix: Set loading status
    this.setStatus({ state: 'loading', soundId, error: undefined });

    // Wait if another transition is in progress (mutex)
    let waitCount = 0;
    while (this.isTransitioning && waitCount < 20) {
      await new Promise(resolve => setTimeout(resolve, 50));
      waitCount++;
    }

    // Acquire lock
    this.isTransitioning = true;
    const myPlaybackId = ++this.playbackId;

    // Create abort controller for this playback
    const abortController = new AbortController();
    this.pendingPlayback = { id: myPlaybackId, abortController };

    try {
      // Synchronous cleanup first
      this.stopImmediate();

      // Check abort before async operations
      if (abortController.signal.aborted) {
        logger.log('[AmbientSounds] Playback aborted before start');
        this.setStatus({ state: 'idle', soundId: null });
        return;
      }

      // P0 Fix: Check if audio is blocked by browser policy
      if (!audioUnlocked) {
        this.setStatus({
          state: 'blocked',
          soundId,
          isUnlocked: false,
          error: { code: 'AUDIO_BLOCKED', message: 'Tap to enable sound', recoverable: true },
        });
        // Still try to unlock
        await unlockAudio();
        if (audioUnlocked) {
          this.setStatus({ state: 'loading', soundId, isUnlocked: true, error: undefined });
        }
      }

      // Load and play audio (async) - pass abort signal and sound info for fallback
      await this.playAudioFile(sound.file, myPlaybackId, abortController.signal, sound.fallbackFile);

      // Final check after async load
      if (abortController.signal.aborted || myPlaybackId !== this.playbackId) {
        logger.log('[AmbientSounds] Playback superseded after load');
        if (this.audioElement) {
          this.audioElement.pause();
          this.audioElement.src = '';
        }
        this.setStatus({ state: 'idle', soundId: null });
        return;
      }

      // CRITICAL: Only set state AFTER successful load
      this.currentSoundId = soundId;
      this.isPlaying = true;

      // P0 Fix: Set playing status
      this.setStatus({ state: 'playing', soundId, isUnlocked: true, error: undefined });

      logger.log(`[AmbientSounds] Playing: ${sound.nameEn}`);
    } catch (error) {
      // Distinguish abort errors from real errors
      if (error instanceof DOMException && error.name === 'AbortError') {
        logger.log('[AmbientSounds] Playback cancelled');
        this.setStatus({ state: 'idle', soundId: null });
      } else if (myPlaybackId === this.playbackId) {
        logger.error(`[AmbientSounds] Failed to play:`, error);
        this.isPlaying = false;
        this.currentSoundId = null;

        // P0 Fix: Set error status with helpful message
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const isNetworkError = errorMessage.includes('load') || errorMessage.includes('network');
        this.setStatus({
          state: 'error',
          soundId,
          error: {
            code: isNetworkError ? 'LOAD_ERROR' : 'PLAYBACK_ERROR',
            message: isNetworkError ? 'Failed to load audio file' : errorMessage,
            recoverable: true,
          },
        });
      }
    } finally {
      if (this.pendingPlayback?.id === myPlaybackId) {
        this.pendingPlayback = null;
      }
      this.isTransitioning = false;
    }
  }

  /**
   * Play by type (convenience method)
   */
  async playByType(type: AmbientSoundType): Promise<void> {
    if (type === 'none') {
      this.stop();
      return;
    }
    const sound = getSoundByType(type);
    if (sound) {
      await this.play(sound.id);
    }
  }

  /**
   * Immediate synchronous stop - clears all handlers and resources
   */
  private stopImmediate(): void {
    if (this.audioElement) {
      try {
        this.audioElement.pause();
        // Clear ALL event handlers to prevent callbacks
        this.audioElement.oncanplay = null;
        this.audioElement.oncanplaythrough = null;
        this.audioElement.onerror = null;
        this.audioElement.onended = null;
        this.audioElement.onloadstart = null;
        this.audioElement.onloadeddata = null;
        this.audioElement.onloadedmetadata = null;
        this.audioElement.onpause = null;
        this.audioElement.onplay = null;
        this.audioElement.src = '';
        this.audioElement.load(); // Force release
      } catch (e) {
        logger.warn('[AmbientSounds] Error during stopImmediate:', e);
      }
      this.audioElement = null;
    }
    this.isPlaying = false;
    this.currentSoundId = null;
  }

  private async playAudioFile(
    url: string,
    playbackId: number,
    signal: AbortSignal,
    fallbackUrl?: string
  ): Promise<void> {
    logger.log('[AmbientSounds] playAudioFile called with URL:', url);
    this.usedFallback = false;

    // Check abort signal
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    // Try to unlock audio if not already done
    await unlockAudio();
    this.setStatus({ isUnlocked: audioUnlocked });

    // Check after async operation
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    if (playbackId !== this.playbackId) throw new DOMException('Superseded', 'AbortError');

    // Ensure global AudioContext is running (helps iOS)
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        await ctx.resume();
        logger.log('[AmbientSounds] AudioContext resumed');
      }
    } catch (e) {
      logger.warn('[AmbientSounds] AudioContext resume failed:', e);
    }

    // Check after context resume
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    if (playbackId !== this.playbackId) throw new DOMException('Superseded', 'AbortError');

    // P0 Fix: Try primary URL, then fallback if it fails
    let loadError: Error | null = null;
    const urlsToTry = [url];
    if (fallbackUrl) {
      urlsToTry.push(fallbackUrl);
    }

    for (let i = 0; i < urlsToTry.length; i++) {
      const currentUrl = urlsToTry[i];
      const isFallback = i > 0;

      if (isFallback) {
        logger.log('[AmbientSounds] Primary file failed, trying fallback:', currentUrl);
        this.usedFallback = true;
      }

      try {
        await this.loadAndPlayUrl(currentUrl, playbackId, signal);
        // Success - exit loop
        if (isFallback) {
          logger.log('[AmbientSounds] Fallback file loaded successfully');
        }
        return;
      } catch (error) {
        loadError = error instanceof Error ? error : new Error(String(error));

        // If it's an abort error, don't try fallback
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw error;
        }

        // If there's a fallback, continue to next iteration
        if (i < urlsToTry.length - 1) {
          logger.warn('[AmbientSounds] Failed to load, will try fallback:', loadError.message);
          continue;
        }
      }
    }

    // All URLs failed
    throw loadError || new Error('Failed to load audio');
  }

  /**
   * P0 Fix: Extracted URL loading logic for reuse with fallback
   */
  private async loadAndPlayUrl(url: string, playbackId: number, signal: AbortSignal): Promise<void> {
    // Create audio element with iOS-friendly settings
    this.audioElement = new Audio();
    this.audioElement.loop = true;
    this.audioElement.volume = this.volume;
    this.audioElement.preload = 'auto';
    this.audioElement.playsInline = true; // Required for iOS
    this.audioElement.setAttribute('playsinline', ''); // Fallback attribute
    this.audioElement.setAttribute('webkit-playsinline', ''); // Older Safari
    this.audioElement.webkitPreservesPitch = true; // Safari
    this.audioElement.src = url;

    logger.log('[AmbientSounds] Audio element created, volume:', this.volume, 'url:', url);

    // P0 Fix: Determine timeout based on file type (WAV files are larger, need more time)
    const isWavFile = url.toLowerCase().endsWith('.wav');
    const loadTimeout = isWavFile ? 30000 : 15000; // 30s for WAV, 15s for MP3

    // Wait for audio to be ready with proper cleanup
    await new Promise<void>((resolve, reject) => {
      if (!this.audioElement) return reject(new Error('No audio element'));

      let timeoutId: number | null = null;
      let resolved = false;

      const cleanup = () => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (this.audioElement) {
          this.audioElement.oncanplaythrough = null;
          this.audioElement.oncanplay = null;
          this.audioElement.onerror = null;
        }
      };

      const handleResolve = () => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve();
      };

      const handleReject = (error: unknown) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        reject(error);
      };

      // Abort listener
      signal.addEventListener('abort', () => {
        handleReject(new DOMException('Aborted during load', 'AbortError'));
      }, { once: true });

      // P0 Fix: Longer timeout for large files
      timeoutId = window.setTimeout(() => {
        logger.warn(`[AmbientSounds] Audio load timeout (${loadTimeout}ms) - attempting play anyway`);
        handleResolve();
      }, loadTimeout);

      // Ready listeners
      this.audioElement.oncanplaythrough = () => {
        logger.log('[AmbientSounds] Audio canplaythrough event');
        handleResolve();
      };

      this.audioElement.oncanplay = () => {
        logger.log('[AmbientSounds] Audio canplay event');
        handleResolve();
      };

      // Error listener
      this.audioElement.onerror = (e) => {
        const audioEl = this.audioElement;
        const errorCode = audioEl?.error?.code;
        const errorMsg = audioEl?.error?.message;
        logger.error('[AmbientSounds] Audio load error:', { errorCode, errorMsg, url, event: e });
        handleReject(new Error(`Failed to load audio: ${url} (code: ${errorCode})`));
      };

      this.audioElement.load();
    });

    // Final check before play
    if (signal.aborted) throw new DOMException('Aborted before play', 'AbortError');
    if (playbackId !== this.playbackId) {
      if (this.audioElement) {
        this.audioElement.pause();
        this.audioElement.src = '';
      }
      throw new DOMException('Superseded before play', 'AbortError');
    }

    // Play the audio with retry for iOS
    try {
      await this.audioElement.play();
    } catch (playError) {
      logger.warn('[AmbientSounds] First play attempt failed, retrying...', playError);
      // iOS sometimes needs a second attempt
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check again before retry
      if (signal.aborted || playbackId !== this.playbackId) {
        throw new DOMException('Aborted before retry', 'AbortError');
      }

      if (this.audioElement) {
        await this.audioElement.play();
      }
    }
  }

  stop(): void {
    // Cancel any pending playback
    if (this.pendingPlayback) {
      this.pendingPlayback.abortController.abort();
      this.pendingPlayback = null;
    }

    // Invalidate any pending playback requests
    this.playbackId++;
    this.stopImmediate();

    // P0 Fix: Update status
    this.setStatus({ state: 'idle', soundId: null, error: undefined });
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.audioElement) {
      this.audioElement.volume = this.volume;
    }
  }

  getVolume(): number {
    return this.volume;
  }

  pause(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      // P0 Fix: Update status
      this.setStatus({ state: 'paused' });
    }
  }

  async resume(): Promise<void> {
    if (!this.audioElement || !this.isPlaying) return;

    // P0 Fix: Set loading while resuming
    this.setStatus({ state: 'loading' });

    try {
      // Re-unlock audio for mobile (iOS especially needs this after pause)
      await unlockAudio();
      this.setStatus({ isUnlocked: audioUnlocked });

      // Ensure AudioContext is running
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        await ctx.resume();
        logger.log('[AmbientSounds] AudioContext resumed for playback');
      }

      // Try to play with retry for iOS
      try {
        await this.audioElement.play();
        // P0 Fix: Update status on success
        this.setStatus({ state: 'playing', error: undefined });
      } catch (firstError) {
        logger.warn('[AmbientSounds] Resume first attempt failed, retrying...', firstError);
        await new Promise(resolve => setTimeout(resolve, 100));
        await this.audioElement.play();
        // P0 Fix: Update status on success
        this.setStatus({ state: 'playing', error: undefined });
      }
    } catch (err) {
      logger.error('[AmbientSounds] Failed to resume audio:', err);
      // P0 Fix: Update status on error
      this.setStatus({
        state: 'error',
        error: {
          code: 'RESUME_ERROR',
          message: 'Failed to resume audio',
          recoverable: true,
        },
      });
    }
  }

  getCurrentSoundId(): string | null {
    return this.currentSoundId;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Get all available sounds
   */
  getAllSounds(): SoundInfo[] {
    return SOUNDS;
  }

  destroy(): void {
    this.stop();
  }
}

// Singleton instance for global use
let globalSoundGenerator: AmbientSoundGenerator | null = null;

export function getAmbientSoundGenerator(): AmbientSoundGenerator {
  if (!globalSoundGenerator) {
    globalSoundGenerator = new AmbientSoundGenerator();
  }
  return globalSoundGenerator;
}
