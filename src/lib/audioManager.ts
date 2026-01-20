// Centralized Audio Manager - Single source of truth for all app audio
// Prevents conflicts from multiple AudioContext instances

type SoundType = 'success' | 'complete' | 'streak' | 'levelUp' | 'notification';

interface AudioManagerState {
  context: AudioContext | null;
  isMuted: boolean;
  volume: number;
}

const state: AudioManagerState = {
  context: null,
  isMuted: false,
  volume: 0.3,
};

// Lazy initialization of AudioContext (required for mobile)
function getAudioContext(): AudioContext | null {
  if (state.context) return state.context;

  try {
    state.context = new (window.AudioContext || (window as any).webkitAudioContext)();
    return state.context;
  } catch (e) {
    console.warn('[AudioManager] AudioContext not available:', e);
    return null;
  }
}

// Resume context if suspended (required for iOS)
async function ensureContextResumed(): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx) return false;

  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch (e) {
      console.warn('[AudioManager] Failed to resume context:', e);
      return false;
    }
  }
  return true;
}

// Play a simple tone (for UI feedback)
function playTone(frequency: number, duration: number, type: OscillatorType = 'sine'): void {
  if (state.isMuted) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;

    const volume = state.volume * 0.5; // Reduce oscillator volume
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch (e) {
    // Audio not available - silent fail
  }
}

// Play success chime (task completed)
export function playSuccess(): void {
  if (state.isMuted) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    // C-E-G chord progression (happy chime)
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5

    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.2), i * 80);
    });
  } catch (e) {
    // Silent fail
  }
}

// Play streak milestone sound
export function playStreakMilestone(): void {
  if (state.isMuted) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    // Ascending arpeggio
    const notes = [392, 493.88, 587.33, 783.99]; // G4, B4, D5, G5

    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.3, 'triangle'), i * 100);
    });
  } catch (e) {
    // Silent fail
  }
}

// Play level up fanfare
export function playLevelUp(): void {
  if (state.isMuted) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    // Victory fanfare
    const notes = [
      { freq: 523.25, delay: 0 },
      { freq: 659.25, delay: 100 },
      { freq: 783.99, delay: 200 },
      { freq: 1046.5, delay: 350 },
    ];

    notes.forEach(({ freq, delay }) => {
      setTimeout(() => playTone(freq, 0.4, 'sine'), delay);
    });
  } catch (e) {
    // Silent fail
  }
}

// Play notification ping
export function playNotification(): void {
  if (state.isMuted) return;
  playTone(880, 0.15, 'sine'); // A5
}

// Play by sound type
export function playSound(type: SoundType): void {
  switch (type) {
    case 'success':
    case 'complete':
      playSuccess();
      break;
    case 'streak':
      playStreakMilestone();
      break;
    case 'levelUp':
      playLevelUp();
      break;
    case 'notification':
      playNotification();
      break;
  }
}

// Mute control
export function setMuted(muted: boolean): void {
  state.isMuted = muted;
  localStorage.setItem('zenflow-audio-muted', muted ? '1' : '0');
}

export function isMuted(): boolean {
  return state.isMuted;
}

// Volume control (0.0 - 1.0)
export function setVolume(volume: number): void {
  state.volume = Math.max(0, Math.min(1, volume));
  localStorage.setItem('zenflow-audio-volume', state.volume.toString());
}

export function getVolume(): number {
  return state.volume;
}

// Initialize from localStorage
export function initAudioManager(): void {
  const mutedStr = localStorage.getItem('zenflow-audio-muted');
  if (mutedStr === '1') {
    state.isMuted = true;
  }

  const volumeStr = localStorage.getItem('zenflow-audio-volume');
  if (volumeStr) {
    state.volume = parseFloat(volumeStr) || 0.3;
  }
}

// Resume context on user interaction (required for mobile)
export async function resumeOnInteraction(): Promise<void> {
  await ensureContextResumed();
}

// Cleanup (for testing/unmount)
export function cleanup(): void {
  if (state.context) {
    state.context.close();
    state.context = null;
  }
}

// Export state for debugging
export function getState(): Readonly<AudioManagerState> {
  return { ...state };
}
