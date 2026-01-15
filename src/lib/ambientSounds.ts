/**
 * Ambient Sound Player with local files and online variety
 * Primary: local sound files for offline use
 * Secondary: online sounds from free sources (Pixabay)
 *
 * Note: Mobile browsers require user interaction before playing audio.
 * Call unlockAudio() in response to a user gesture (click/touch) before playing sounds.
 */

export type AmbientSoundType = 'none' | 'white-noise' | 'rain' | 'ocean' | 'forest' | 'coffee-shop' | 'fireplace';

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

export interface SoundVariant {
  id: string;
  name: string;
  url: string;
  isLocal: boolean;
}

// Get base path from Vite config (or use default for GitHub Pages)
const BASE_PATH = import.meta.env.BASE_URL || '/people-first-app/';

// Local sound files (shipped with app, work offline)
// Names accurately describe the actual sound content
const LOCAL_SOUNDS: Record<Exclude<AmbientSoundType, 'none'>, SoundVariant> = {
  'white-noise': {
    id: 'white-noise-local',
    name: 'Подводный гул',
    url: `${BASE_PATH}sounds/mixkit-underwater-transmitter-hum-2135.wav`,
    isLocal: true,
  },
  'rain': {
    id: 'rain-local',
    name: 'Гроза в джунглях',
    url: `${BASE_PATH}sounds/mixkit-calm-thunderstorm-in-the-jungle-2415.wav`,
    isLocal: true,
  },
  'ocean': {
    id: 'ocean-local',
    name: 'Волны у скал',
    url: `${BASE_PATH}sounds/mixkit-small-waves-harbor-rocks-1208.wav`,
    isLocal: true,
  },
  'forest': {
    id: 'forest-local',
    name: 'Природа у реки',
    url: `${BASE_PATH}sounds/mixkit-wildlife-environment-in-a-river-2456.wav`,
    isLocal: true,
  },
  'coffee-shop': {
    id: 'coffee-local',
    name: 'Шум кафе',
    url: `${BASE_PATH}sounds/cafe-noise-32940.mp3`,
    isLocal: true,
  },
  'fireplace': {
    id: 'fireplace-local',
    name: 'Треск камина',
    url: `${BASE_PATH}sounds/fireplace-fx-56636.mp3`,
    isLocal: true,
  },
};

// Online sound variants from Pixabay (free, royalty-free)
const ONLINE_SOUND_VARIANTS: Record<Exclude<AmbientSoundType, 'none'>, SoundVariant[]> = {
  'white-noise': [
    { id: 'white-noise-soft', name: 'Мягкий шум', url: 'https://cdn.pixabay.com/audio/2022/10/30/audio_56950e78e9.mp3', isLocal: false },
    { id: 'white-noise-deep', name: 'Глубокий гул', url: 'https://cdn.pixabay.com/audio/2022/03/15/audio_8cb749d484.mp3', isLocal: false },
  ],
  'rain': [
    { id: 'rain-gentle', name: 'Легкий дождь', url: 'https://cdn.pixabay.com/audio/2022/05/16/audio_1c8a89c66b.mp3', isLocal: false },
    { id: 'rain-heavy', name: 'Сильный дождь', url: 'https://cdn.pixabay.com/audio/2022/11/17/audio_c4d8efda1a.mp3', isLocal: false },
    { id: 'rain-thunder', name: 'Гроза', url: 'https://cdn.pixabay.com/audio/2022/10/18/audio_ce377eff12.mp3', isLocal: false },
  ],
  'ocean': [
    { id: 'ocean-waves', name: 'Морские волны', url: 'https://cdn.pixabay.com/audio/2024/06/12/audio_dbb8ef1986.mp3', isLocal: false },
    { id: 'ocean-beach', name: 'Пляж', url: 'https://cdn.pixabay.com/audio/2022/06/25/audio_69a61cd6d6.mp3', isLocal: false },
  ],
  'forest': [
    { id: 'forest-birds', name: 'Птицы в лесу', url: 'https://cdn.pixabay.com/audio/2022/08/02/audio_884fe92c21.mp3', isLocal: false },
    { id: 'forest-morning', name: 'Утро в лесу', url: 'https://cdn.pixabay.com/audio/2022/03/24/audio_927c7c572e.mp3', isLocal: false },
    { id: 'forest-night', name: 'Ночной лес', url: 'https://cdn.pixabay.com/audio/2024/02/28/audio_a0fbe0c10e.mp3', isLocal: false },
  ],
  'coffee-shop': [
    { id: 'coffee-busy', name: 'Оживленное кафе', url: 'https://cdn.pixabay.com/audio/2021/09/21/audio_6feac14979.mp3', isLocal: false },
    { id: 'coffee-quiet', name: 'Тихое кафе', url: 'https://cdn.pixabay.com/audio/2022/03/17/audio_a1b2c3d4e5.mp3', isLocal: false },
  ],
  'fireplace': [
    { id: 'fireplace-crackling', name: 'Треск огня', url: 'https://cdn.pixabay.com/audio/2021/12/27/audio_6a1f7a1e04.mp3', isLocal: false },
    { id: 'fireplace-cozy', name: 'Уютный камин', url: 'https://cdn.pixabay.com/audio/2022/01/20/audio_0eec8c8f7a.mp3', isLocal: false },
  ],
};

export class AmbientSoundGenerator {
  private audioElement: HTMLAudioElement | null = null;
  private isPlaying = false;
  private currentType: AmbientSoundType = 'none';
  private currentVariantId: string | null = null;
  private volume = 0.5; // 50% default volume
  private onlineAvailable = true;

  constructor() {
    // Check if online
    if (typeof window !== 'undefined') {
      this.onlineAvailable = navigator.onLine;
      window.addEventListener('online', () => this.onlineAvailable = true);
      window.addEventListener('offline', () => this.onlineAvailable = false);
    }
  }

  async play(type: AmbientSoundType, variantId?: string): Promise<void> {
    if (type === 'none') {
      this.stop();
      return;
    }

    // Stop current sound if any
    if (this.isPlaying) {
      this.stop();
    }

    this.currentType = type;
    this.isPlaying = true;

    // Determine which sound to play
    let soundUrl: string;

    if (variantId) {
      // User selected specific variant
      const allVariants = this.getVariantsForType(type);
      const variant = allVariants.find(v => v.id === variantId);
      if (variant) {
        soundUrl = variant.url;
        this.currentVariantId = variantId;
      } else {
        // Fallback to local
        soundUrl = LOCAL_SOUNDS[type].url;
        this.currentVariantId = LOCAL_SOUNDS[type].id;
      }
    } else {
      // Default: use local sound (works offline)
      soundUrl = LOCAL_SOUNDS[type].url;
      this.currentVariantId = LOCAL_SOUNDS[type].id;
    }

    try {
      await this.playAudioFile(soundUrl);
    } catch (error) {
      console.warn(`Failed to load sound ${soundUrl}, trying local fallback:`, error);
      // If online sound failed, try local
      const isLocalSound = soundUrl.includes('/sounds/') || soundUrl.includes('sounds/');
      if (!isLocalSound) {
        try {
          await this.playAudioFile(LOCAL_SOUNDS[type].url);
          this.currentVariantId = LOCAL_SOUNDS[type].id;
        } catch (fallbackError) {
          console.error('All sound sources failed:', fallbackError);
          this.isPlaying = false;
        }
      } else {
        this.isPlaying = false;
      }
    }
  }

  private async playAudioFile(url: string): Promise<void> {
    // Try to unlock audio if not already done
    await unlockAudio();

    // Create audio element
    this.audioElement = new Audio();
    this.audioElement.crossOrigin = 'anonymous';
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
      }, 15000); // 15 second timeout

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
    try {
      await this.audioElement.play();
    } catch (playError) {
      // On mobile, play() may fail if not triggered by user gesture
      console.warn('[AmbientSounds] Play failed, may need user gesture:', playError);
      throw playError;
    }
  }

  stop(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
      this.audioElement = null;
    }
    this.isPlaying = false;
    this.currentVariantId = null;
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

  // Get all available variants for a sound type
  getVariantsForType(type: Exclude<AmbientSoundType, 'none'>): SoundVariant[] {
    const local = LOCAL_SOUNDS[type];
    const online = ONLINE_SOUND_VARIANTS[type] || [];
    return [local, ...online];
  }

  // Get only local variants (for offline mode)
  getLocalVariant(type: Exclude<AmbientSoundType, 'none'>): SoundVariant {
    return LOCAL_SOUNDS[type];
  }

  // Get only online variants
  getOnlineVariants(type: Exclude<AmbientSoundType, 'none'>): SoundVariant[] {
    return ONLINE_SOUND_VARIANTS[type] || [];
  }

  // Check if online sounds are available
  isOnline(): boolean {
    return this.onlineAvailable;
  }

  // Get currently playing variant
  getCurrentVariantId(): string | null {
    return this.currentVariantId;
  }

  // Get current sound type
  getCurrentType(): AmbientSoundType {
    return this.currentType;
  }

  // Check if playing
  getIsPlaying(): boolean {
    return this.isPlaying;
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
