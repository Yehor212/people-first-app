import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
  isKeyboardAudioUnlockGesture,
  preloadAmbientSounds,
  setupAudioUnlock,
  AmbientSoundGenerator,
  resetAmbientSoundsForTests,
  type AudioState,
  type AmbientSoundType,
} from '../ambientSounds';

// ─── Setup ──────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  resetAmbientSoundsForTests();
});

afterEach(() => {
  resetAmbientSoundsForTests();
  vi.unstubAllGlobals();
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
    expect(types).toContain('forest');
    expect(types).toContain('rain');
    expect(types).toContain('ocean');
    expect(types).toContain('fireplace');
    expect(types).toContain('river');
    expect(types).toContain('wind');
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

  it('resolves generated three-level variant ids with a legacy fallback file', () => {
    const legacy = getSoundById('fireplace');
    const variant = getSoundById('fireplace:soft');

    expect(variant).toMatchObject({
      id: 'fireplace:soft',
      type: 'fireplace',
      nameEn: expect.stringContaining('Soft'),
    });
    expect(variant?.file).toContain('/sounds/hyperfocus/hyperfocus-fireplace-soft.mp3');
    expect(variant?.fallbackFile).toBe(legacy?.file);
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

  it('maps the old cafe type to the nature-first forest sound', () => {
    expect(getSoundByType('cafe')?.type).toBe('forest');
  });

  it('maps retired underwater and thunderstorm types to the closest nature replacements', () => {
    expect(getSoundByType('underwater')?.type).toBe('ocean');
    expect(getSoundByType('thunderstorm')?.type).toBe('rain');
  });

  it('returns undefined for an unknown type', () => {
    expect(getSoundByType('nonexistent' as AmbientSoundType)).toBeUndefined();
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

describe('setupAudioUnlock', () => {
  it('does not attach a global click listener that can delay navigation taps', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');

    setupAudioUnlock();

    expect(addSpy).toHaveBeenCalledWith('touchstart', expect.any(Function), {
      capture: true,
      passive: true,
    });
    expect(addSpy).toHaveBeenCalledWith('touchend', expect.any(Function), {
      capture: true,
      passive: true,
    });
    expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function), {
      capture: true,
      passive: true,
    });
    expect(addSpy.mock.calls.some(([eventName]) => eventName === 'click')).toBe(false);

    addSpy.mockRestore();
  });

  it('keeps slider arrow keys out of the global audio unlock path', () => {
    const slider = document.createElement('div');
    slider.setAttribute('role', 'slider');
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
    Object.defineProperty(event, 'target', { value: slider });

    expect(isKeyboardAudioUnlockGesture(event)).toBe(false);
  });

  it('still treats keyboard button activation as an audio unlock gesture', () => {
    const button = document.createElement('button');
    const enter = new KeyboardEvent('keydown', { key: 'Enter' });
    Object.defineProperty(enter, 'target', { value: button });
    const space = new KeyboardEvent('keydown', { key: ' ' });
    Object.defineProperty(space, 'target', { value: button });

    expect(isKeyboardAudioUnlockGesture(enter)).toBe(true);
    expect(isKeyboardAudioUnlockGesture(space)).toBe(true);
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

  it('routes the blessed media element through one reusable low-pass graph', () => {
    const sourceConnect = vi.fn();
    const sourceDisconnect = vi.fn();
    const filterConnect = vi.fn();
    const cancelScheduledValues = vi.fn();
    const setValueAtTime = vi.fn();
    const linearRampToValueAtTime = vi.fn();
    const createMediaElementSource = vi.fn(() => ({
      connect: sourceConnect,
      disconnect: sourceDisconnect,
    }));
    const filter = {
      type: 'allpass' as BiquadFilterType,
      connect: filterConnect,
      frequency: {
        value: 16000,
        cancelScheduledValues,
        setValueAtTime,
        linearRampToValueAtTime,
      },
      Q: { value: 0 },
    };

    class MockAudioContext {
      currentTime = 2;
      destination = {};
      state: AudioContextState = 'running';
      createMediaElementSource = createMediaElementSource;
      createBiquadFilter = vi.fn(() => filter);
      close = vi.fn(() => Promise.resolve());
    }

    const fakeAudio = {
      playsInline: false,
      loop: false,
      volume: 0,
      preload: '',
      src: '',
      onerror: null,
      onplaying: null,
      setAttribute: vi.fn(),
      play: vi.fn(() => Promise.resolve()),
      pause: vi.fn(),
    };
    const AudioConstructor = vi.fn(function AudioStub() {
      return fakeAudio;
    });
    vi.stubGlobal('Audio', AudioConstructor);
    vi.stubGlobal('AudioContext', MockAudioContext);

    generator.setToneCutoffKhz(6);
    expect(generator.getToneFilterStatus()).toMatchObject({ state: 'pending', cutoffKhz: 6 });

    generator.playDirect('rain:soft');
    generator.setToneCutoffKhz(4.5);

    expect(createMediaElementSource).toHaveBeenCalledTimes(1);
    expect(sourceConnect).toHaveBeenCalledWith(filter);
    expect(filterConnect).toHaveBeenCalledTimes(1);
    expect(filter.type).toBe('lowpass');
    expect(filter.Q.value).toBeCloseTo(Math.SQRT1_2);
    expect(linearRampToValueAtTime).toHaveBeenLastCalledWith(4500, 2.08);
    expect(generator.getToneFilterStatus()).toEqual({ state: 'active', cutoffKhz: 4.5 });
    expect(fakeAudio.loop).toBe(true);
    expect(fakeAudio).not.toHaveProperty('playbackRate');
  });

  it('keeps direct audio playback available when Web Audio routing cannot be created', () => {
    class FailingAudioContext {
      currentTime = 0;
      destination = {};
      state: AudioContextState = 'running';
      createMediaElementSource = vi.fn(() => {
        throw new DOMException('unsupported', 'NotSupportedError');
      });
      createBiquadFilter = vi.fn();
      close = vi.fn(() => Promise.resolve());
    }
    const fakeAudio = {
      playsInline: false,
      loop: false,
      volume: 0,
      preload: '',
      src: '',
      onerror: null,
      onplaying: null,
      setAttribute: vi.fn(),
      play: vi.fn(() => Promise.resolve()),
      pause: vi.fn(),
    };
    const AudioConstructor = vi.fn(function AudioStub() {
      return fakeAudio;
    });
    vi.stubGlobal('Audio', AudioConstructor);
    vi.stubGlobal('AudioContext', FailingAudioContext);

    generator.setToneCutoffKhz(5);
    generator.playDirect('ocean:deep');

    expect(fakeAudio.play).toHaveBeenCalledTimes(1);
    expect(generator.getToneFilterStatus()).toMatchObject({
      state: 'degraded',
      cutoffKhz: 5,
      reason: 'web-audio-routing-unavailable',
    });
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

  it('playDirect tries the family fallback when a generated variant fails to load', () => {
    const fakeAudio = {
      playsInline: false,
      loop: false,
      volume: 0,
      preload: '',
      src: '',
      error: { code: 4, message: 'missing generated asset' },
      onerror: null as null | (() => void),
      onplaying: null as null | (() => void),
      setAttribute: vi.fn(),
      play: vi.fn(() => Promise.resolve()),
      pause: vi.fn(),
    };
    const AudioConstructor = vi.fn(function AudioStub() {
      return fakeAudio;
    });
    vi.stubGlobal('Audio', AudioConstructor);

    const directGenerator = new AmbientSoundGenerator();
    directGenerator.playDirect('fireplace:soft');

    expect(fakeAudio.src).toContain('/sounds/hyperfocus/hyperfocus-fireplace-soft.mp3');
    fakeAudio.onerror?.();

    expect(fakeAudio.src).toContain('/sounds/hyperfocus/hyperfocus-fireplace-deep.mp3');
    expect(fakeAudio.play).toHaveBeenCalledTimes(2);
    expect(directGenerator.getDebugInfo()).toEqual(expect.objectContaining({ usedFallback: true }));

    vi.unstubAllGlobals();
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
