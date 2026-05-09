import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────
vi.mock('../logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../validation', () => ({
  isAbortError: vi.fn((e: unknown) => {
    if (e instanceof DOMException) return e.name === 'AbortError' || e.code === 20;
    return false;
  }),
}));

vi.mock('@/lib/env', () => ({
  BASE_URL: '/',
}));

import {
  SOUNDS,
  getSoundById,
  getSoundByType,
  isAudioUnlocked,
  getAmbientSoundGenerator,
  preloadAmbientSounds,
  AmbientSoundGenerator,
  type AudioState,
  type AmbientSoundType,
} from '../ambientSounds';

// ─── Setup ──────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ──────────────────────────────────────────────────────

describe('SOUNDS constant', () => {
  it('contains 6 predefined sounds', () => {
    expect(SOUNDS).toHaveLength(6);
  });

  it('has unique ids for every sound', () => {
    const ids = SOUNDS.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique types for every sound', () => {
    const types = SOUNDS.map(s => s.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it('each sound has required properties', () => {
    SOUNDS.forEach(sound => {
      expect(sound.id).toBeTruthy();
      expect(sound.type).toBeTruthy();
      expect(sound.nameEn).toBeTruthy();
      expect(sound.file).toBeTruthy();
      expect(sound.description).toBeTruthy();
    });
  });

  it('includes expected sound types', () => {
    const types = SOUNDS.map(s => s.type);
    expect(types).toContain('underwater');
    expect(types).toContain('thunderstorm');
    expect(types).toContain('ocean');
    expect(types).toContain('river');
    expect(types).toContain('cafe');
    expect(types).toContain('fireplace');
  });

  it('file paths start with BASE_URL', () => {
    SOUNDS.forEach(sound => {
      expect(sound.file).toMatch(/^\//);
    });
  });

  it('ships compact MP3 files for every ambient sound', () => {
    SOUNDS.forEach(sound => {
      expect(sound.file).toMatch(/\.mp3$/);
    });
  });
});

describe('getSoundById', () => {
  it('returns the correct sound for a valid id', () => {
    const sound = getSoundById('ocean');
    expect(sound).toBeDefined();
    expect(sound?.id).toBe('ocean');
    expect(sound?.type).toBe('ocean');
  });

  it('returns undefined for an unknown id', () => {
    expect(getSoundById('nonexistent')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(getSoundById('')).toBeUndefined();
  });
});

describe('getSoundByType', () => {
  it('returns the correct sound for a valid type', () => {
    const sound = getSoundByType('fireplace');
    expect(sound).toBeDefined();
    expect(sound?.type).toBe('fireplace');
  });

  it('returns undefined for type "none"', () => {
    expect(getSoundByType('none')).toBeUndefined();
  });

  it('returns undefined for an unknown type', () => {
    expect(getSoundByType('wind' as AmbientSoundType)).toBeUndefined();
  });
});

describe('preloadAmbientSounds', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  it('does not prefetch audio on startup without an explicit sound list', () => {
    preloadAmbientSounds();

    expect(document.head.querySelectorAll('link[rel="prefetch"][as="audio"]')).toHaveLength(0);
  });

  it('prefetches only explicitly requested ambient sounds', () => {
    preloadAmbientSounds(['river']);

    const links = document.head.querySelectorAll<HTMLLinkElement>('link[rel="prefetch"][as="audio"]');
    expect(links).toHaveLength(1);
    expect(links[0].href).toContain('river');
    expect(links[0].href).toMatch(/\.mp3$/);
  });
});

describe('isAudioUnlocked', () => {
  it('returns a boolean', () => {
    expect(typeof isAudioUnlocked()).toBe('boolean');
  });
});

describe('AmbientSoundGenerator', () => {
  let generator: AmbientSoundGenerator;

  beforeEach(() => {
    generator = new AmbientSoundGenerator();
  });

  it('initial status is idle', () => {
    const status = generator.getStatus();
    expect(status.state).toBe('idle');
    expect(status.soundId).toBeNull();
    expect(status.isUnlocked).toBe(false);
  });

  it('getIsPlaying returns false initially', () => {
    expect(generator.getIsPlaying()).toBe(false);
  });

  it('getCurrentSoundId returns null initially', () => {
    expect(generator.getCurrentSoundId()).toBeNull();
  });

  it('getAllSounds returns the SOUNDS array', () => {
    const sounds = generator.getAllSounds();
    expect(sounds).toBe(SOUNDS);
    expect(sounds).toHaveLength(6);
  });

  it('setVolume clamps between 0 and 1', () => {
    generator.setVolume(1.5);
    expect(generator.getVolume()).toBe(1);

    generator.setVolume(-0.5);
    expect(generator.getVolume()).toBe(0);

    generator.setVolume(0.7);
    expect(generator.getVolume()).toBe(0.7);
  });

  it('getVolume returns default of 0.5', () => {
    expect(generator.getVolume()).toBe(0.5);
  });

  it('addStatusListener emits current status immediately', () => {
    const listener = vi.fn();
    generator.addStatusListener(listener);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ state: 'idle' }));
  });

  it('addStatusListener returns an unsubscribe function', () => {
    const listener = vi.fn();
    const unsub = generator.addStatusListener(listener);
    expect(typeof unsub).toBe('function');
    unsub();
    // After unsubscribe, stop should not call the listener again
    listener.mockClear();
    generator.stop();
    // stop triggers setStatus internally, but listener is removed
    expect(listener).not.toHaveBeenCalled();
  });

  it('stop resets status to idle', () => {
    generator.stop();
    const status = generator.getStatus();
    expect(status.state).toBe('idle');
    expect(status.soundId).toBeNull();
  });

  it('destroy calls stop and resets state', () => {
    generator.destroy();
    expect(generator.getIsPlaying()).toBe(false);
    expect(generator.getCurrentSoundId()).toBeNull();
  });

  it('getDebugInfo returns expected shape', () => {
    const debug = generator.getDebugInfo();
    expect(debug).toHaveProperty('status');
    expect(debug).toHaveProperty('currentSoundId');
    expect(debug).toHaveProperty('isPlaying');
    expect(debug).toHaveProperty('isTransitioning');
    expect(debug).toHaveProperty('volume');
  });
});

describe('getAmbientSoundGenerator (singleton)', () => {
  it('returns the same instance on repeated calls', () => {
    const a = getAmbientSoundGenerator();
    const b = getAmbientSoundGenerator();
    expect(a).toBe(b);
  });

  it('returns an AmbientSoundGenerator instance', () => {
    const gen = getAmbientSoundGenerator();
    expect(gen).toBeInstanceOf(AmbientSoundGenerator);
  });
});

describe('AudioState type coverage', () => {
  it('all expected states are valid AudioState values', () => {
    const validStates: AudioState[] = ['idle', 'loading', 'playing', 'paused', 'blocked', 'error'];
    expect(validStates).toHaveLength(6);
    validStates.forEach(state => {
      expect(typeof state).toBe('string');
    });
  });
});
