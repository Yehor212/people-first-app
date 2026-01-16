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
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
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

    console.log('[AmbientSounds] Oscillator trick completed');
  } catch (e) {
    console.warn('[AmbientSounds] Oscillator unlock failed:', e);
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

    console.log('[AmbientSounds] Audio element unlock completed');
  } catch (e) {
    console.warn('[AmbientSounds] Audio element unlock failed:', e);
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
      console.log('[AmbientSounds] Audio fully unlocked for mobile browser');
    } catch (e) {
      console.warn('[AmbientSounds] Audio unlock had issues:', e);
      // Still mark as unlocked to avoid infinite retries
      audioUnlocked = true;
    } finally {
      unlockPromise = null;
    }
  })();

  return unlockPromise;
}

/**
 * Setup global audio unlock listeners.
 * Call this once at app startup to enable audio unlock on first user interaction.
 * This is crucial for iOS which requires audio to be unlocked during user gesture.
 */
export function setupAudioUnlock(): void {
  if (audioUnlockSetup) return;
  audioUnlockSetup = true;

  const handleInteraction = () => {
    unlockAudio();
    // Keep listeners for a while in case first attempt fails
    setTimeout(() => {
      document.removeEventListener('touchstart', handleInteraction, true);
      document.removeEventListener('touchend', handleInteraction, true);
      document.removeEventListener('click', handleInteraction, true);
      document.removeEventListener('keydown', handleInteraction, true);
    }, 5000);
  };

  // Use capture phase to catch events before they're handled
  document.addEventListener('touchstart', handleInteraction, { capture: true, passive: true });
  document.addEventListener('touchend', handleInteraction, { capture: true, passive: true });
  document.addEventListener('click', handleInteraction, { capture: true, passive: true });
  document.addEventListener('keydown', handleInteraction, { capture: true, passive: true });

  console.log('[AmbientSounds] Audio unlock listeners set up');
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
  description: string;
}

// Get base path from Vite config (or use default for GitHub Pages)
const BASE_PATH = import.meta.env.BASE_URL || '/people-first-app/';

/**
 * All available sounds - LOCAL ONLY
 * Names honestly describe what's in each file
 */
export const SOUNDS: SoundInfo[] = [
  {
    id: 'underwater',
    type: 'underwater',
    nameRu: 'Подводный гул',
    nameEn: 'Underwater Hum',
    file: `${BASE_PATH}sounds/mixkit-underwater-transmitter-hum-2135.wav`,
    description: 'Deep underwater ambient sound'
  },
  {
    id: 'thunderstorm',
    type: 'thunderstorm',
    nameRu: 'Гроза в джунглях',
    nameEn: 'Jungle Thunderstorm',
    file: `${BASE_PATH}sounds/mixkit-calm-thunderstorm-in-the-jungle-2415.wav`,
    description: 'Thunder and rain in tropical jungle'
  },
  {
    id: 'ocean',
    type: 'ocean',
    nameRu: 'Волны у скал',
    nameEn: 'Waves on Rocks',
    file: `${BASE_PATH}sounds/mixkit-small-waves-harbor-rocks-1208.wav`,
    description: 'Small waves hitting harbor rocks'
  },
  {
    id: 'river',
    type: 'river',
    nameRu: 'Природа у реки',
    nameEn: 'River Wildlife',
    file: `${BASE_PATH}sounds/mixkit-wildlife-environment-in-a-river-2456.wav`,
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

  async play(soundId: string): Promise<void> {
    if (soundId === 'none') {
      this.stop();
      return;
    }

    const sound = getSoundById(soundId);
    if (!sound) {
      console.error(`[AmbientSounds] Sound not found: ${soundId}`);
      return;
    }

    // Stop current sound if any
    if (this.isPlaying) {
      this.stop();
    }

    this.currentSoundId = soundId;
    this.isPlaying = true;

    try {
      await this.playAudioFile(sound.file);
      console.log(`[AmbientSounds] Playing: ${sound.nameEn}`);
    } catch (error) {
      console.error(`[AmbientSounds] Failed to play ${sound.nameEn}:`, error);
      this.isPlaying = false;
      this.currentSoundId = null;
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

  private async playAudioFile(url: string): Promise<void> {
    // Try to unlock audio if not already done
    await unlockAudio();

    // Ensure AudioContext is running (helps iOS)
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
      }
    } catch (e) {
      console.warn('[AmbientSounds] AudioContext resume failed:', e);
    }

    // Create audio element with iOS-friendly settings
    this.audioElement = new Audio();
    this.audioElement.loop = true;
    this.audioElement.volume = this.volume;
    this.audioElement.preload = 'auto';
    this.audioElement.playsInline = true; // Required for iOS
    this.audioElement.setAttribute('playsinline', ''); // Fallback attribute
    this.audioElement.setAttribute('webkit-playsinline', ''); // Older Safari
    (this.audioElement as any).webkitPreservesPitch = true; // Safari
    this.audioElement.src = url;

    // Wait for audio to be ready
    await new Promise<void>((resolve, reject) => {
      if (!this.audioElement) return reject(new Error('No audio element'));

      const timeout = setTimeout(() => {
        // On iOS, sometimes oncanplaythrough doesn't fire - try anyway
        console.warn('[AmbientSounds] Audio load timeout - attempting play anyway');
        resolve();
      }, 10000); // 10 second timeout

      this.audioElement.oncanplaythrough = () => {
        clearTimeout(timeout);
        resolve();
      };

      // Also listen for canplay (fires earlier than canplaythrough)
      this.audioElement.oncanplay = () => {
        clearTimeout(timeout);
        resolve();
      };

      this.audioElement.onerror = (e) => {
        clearTimeout(timeout);
        console.error('[AmbientSounds] Audio error:', e);
        reject(new Error(`Failed to load audio: ${url}`));
      };

      this.audioElement.load();
    });

    // Play the audio with retry for iOS
    try {
      await this.audioElement.play();
    } catch (playError) {
      console.warn('[AmbientSounds] First play attempt failed, retrying...', playError);
      // iOS sometimes needs a second attempt
      await new Promise(resolve => setTimeout(resolve, 100));
      await this.audioElement.play();
    }
  }

  stop(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
      this.audioElement = null;
    }
    this.isPlaying = false;
    this.currentSoundId = null;
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
    }
  }

  resume(): void {
    if (this.audioElement && this.isPlaying) {
      this.audioElement.play().catch(console.error);
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
