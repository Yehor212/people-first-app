/**
 * Ambient Sound Player - LOCAL FILES ONLY
 *
 * All sounds are bundled with the app for reliability.
 * No external URLs to avoid CSP issues and 403 errors.
 *
 * Note: Mobile browsers require user interaction before playing audio.
 * Call unlockAudio() in response to a user gesture (click/touch) before playing sounds.
 */

// Sound categories based on actual available files
export type AmbientSoundType = 'none' | 'underwater' | 'thunderstorm' | 'ocean' | 'river' | 'cafe' | 'fireplace';

// Audio unlock state for mobile browsers
let audioUnlocked = false;
let unlockPromise: Promise<void> | null = null;

// Silent audio file for unlocking (base64 encoded 1-sample WAV)
const SILENT_AUDIO = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAAA=';

/**
 * Unlock audio on mobile browsers.
 * Must be called in response to a user gesture (click/touch).
 * Call this early, e.g., on the first button press in the app.
 */
export async function unlockAudio(): Promise<void> {
  if (audioUnlocked) return;
  if (unlockPromise) return unlockPromise;

  unlockPromise = (async () => {
    try {
      // Create and play silent audio to unlock
      const silentAudio = new Audio(SILENT_AUDIO);
      silentAudio.volume = 0.01;
      silentAudio.playsInline = true;

      // Use play() promise
      const playPromise = silentAudio.play();
      if (playPromise !== undefined) {
        await playPromise;
      }
      silentAudio.pause();

      // Also try to resume AudioContext if available
      if (typeof AudioContext !== 'undefined') {
        const ctx = new AudioContext();
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        await ctx.close();
      }

      audioUnlocked = true;
      console.log('[AmbientSounds] Audio unlocked for mobile browser');
    } catch (e) {
      console.warn('[AmbientSounds] Failed to unlock audio:', e);
      // Still mark as unlocked to avoid infinite retries
      audioUnlocked = true;
    } finally {
      unlockPromise = null;
    }
  })();

  return unlockPromise;
}

/**
 * Check if audio is unlocked
 */
export function isAudioUnlocked(): boolean {
  return audioUnlocked;
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

    // Create audio element
    this.audioElement = new Audio();
    this.audioElement.loop = true;
    this.audioElement.volume = this.volume;
    this.audioElement.playsInline = true; // Required for iOS
    this.audioElement.setAttribute('playsinline', ''); // Fallback attribute
    this.audioElement.setAttribute('webkit-playsinline', ''); // Older Safari
    this.audioElement.src = url;

    // Wait for audio to be ready
    await new Promise<void>((resolve, reject) => {
      if (!this.audioElement) return reject(new Error('No audio element'));

      const timeout = setTimeout(() => {
        reject(new Error('Audio load timeout'));
      }, 10000); // 10 second timeout

      this.audioElement.oncanplaythrough = () => {
        clearTimeout(timeout);
        resolve();
      };

      this.audioElement.onerror = () => {
        clearTimeout(timeout);
        reject(new Error(`Failed to load audio: ${url}`));
      };

      this.audioElement.load();
    });

    // Play the audio
    await this.audioElement.play();
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
