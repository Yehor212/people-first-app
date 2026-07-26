import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── In-memory storage mock ────────────────────────────────────
let mockStorage: Record<string, string> = {};
let storageWritesSucceed = true;

vi.mock('../safeJson', () => ({
  storageGetRaw: vi.fn((key: string): string | null => mockStorage[key] ?? null),
  storageSetRaw: vi.fn((key: string, value: string) => {
    if (!storageWritesSucceed) return false;
    mockStorage[key] = value;
    return true;
  }),
  storageReadRaw: vi.fn((key: string) => ({ ok: true, value: mockStorage[key] ?? null })),
  storageRemove: vi.fn((key: string) => {
    delete mockStorage[key];
    return true;
  }),
  safeLocalStorageGet: vi.fn((key: string, fallback: unknown) => {
    const raw = mockStorage[key];
    if (raw == null) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }),
  safeLocalStorageSet: vi.fn((key: string, value: unknown) => {
    mockStorage[key] = JSON.stringify(value);
    return true;
  }),
}));

vi.mock('../storageKeys', () => ({
  SK: {
    AUDIO_MUTED: 'zenflow_audio_muted',
    AUDIO_VOLUME: 'zenflow_audio_volume',
    AUDIO_COMFORT: 'zenflow_audio_comfort',
    AUDIO_COMFORT_FEEDBACK: 'zenflow_audio_comfort_feedback',
  },
}));

vi.mock('../logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  getVolume,
  setVolume,
  isMuted,
  setMuted,
  initAudioManager,
  cleanup,
  getState,
  getAudioContext,
  playSound,
  playSuccess,
  playComplete,
  playStreakMilestone,
  playMilestone,
  playLevelUp,
  playNotification,
  playNotificationPreview,
  playFeedbackPreview,
  preloadFeedbackCues,
} from '../audioManager';
import * as audioManager from '../audioManager';

import { storageSetRaw } from '../safeJson';
import { resetAudioComfortRuntimeForTests } from '../audioComfort';

const LOW_SALIENCE_TEST_DELAY_MS = 180;

type CapturedAudioShape = {
  frequencies: number[];
  durations: number[];
  waveforms: OscillatorType[];
  gains: number[];
  gainRampTargets: number[];
  resumeCalls: number;
};

function installCapturedAudioContext(options: { initialState?: AudioContextState | "interrupted" } = {}): CapturedAudioShape {
  const captured: CapturedAudioShape = {
    frequencies: [],
    durations: [],
    waveforms: [],
    gains: [],
    gainRampTargets: [],
    resumeCalls: 0,
  };

  class MockAudioContext {
    currentTime = 10;
    destination = {};
    state = options.initialState ?? 'running';

    createOscillator() {
      const currentTime = this.currentTime;
      const oscillator = {
        frequency: { value: 0 },
        type: 'sine' as OscillatorType,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn((stopAt: number) => {
          captured.frequencies.push(oscillator.frequency.value);
          captured.durations.push(Number((stopAt - currentTime).toFixed(2)));
          captured.waveforms.push(oscillator.type);
        }),
      };

      return oscillator as unknown as OscillatorNode;
    }

    createGain() {
      return {
        connect: vi.fn(),
        gain: {
          setValueAtTime: vi.fn((gain: number) => {
            captured.gains.push(gain);
          }),
          exponentialRampToValueAtTime: vi.fn((gain: number) => {
            captured.gainRampTargets.push(gain);
          }),
        },
      } as unknown as GainNode;
    }

    close() {
      return Promise.resolve();
    }

    resume() {
      captured.resumeCalls += 1;
      this.state = 'running';
      return Promise.resolve();
    }

    suspend() {
      return Promise.resolve();
    }
  }

  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    writable: true,
    value: MockAudioContext,
  });
  Object.defineProperty(globalThis, 'AudioContext', {
    configurable: true,
    writable: true,
    value: MockAudioContext,
  });

  return captured;
}

// ─── Setup ──────────────────────────────────────────────────────
beforeEach(() => {
  mockStorage = {};
  storageWritesSucceed = true;
  vi.clearAllMocks();
  cleanup(); // Reset module state
  initAudioManager();
  resetAudioComfortRuntimeForTests();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ─── Tests ──────────────────────────────────────────────────────

describe('Volume control', () => {
  it('default volume is 0.3', () => {
    initAudioManager();
    expect(getVolume()).toBe(0.3);
  });

  it('setVolume clamps to 0 minimum', () => {
    setVolume(-5);
    expect(getVolume()).toBe(0);
  });

  it('setVolume clamps to 1 maximum', () => {
    setVolume(10);
    expect(getVolume()).toBe(1);
  });

  it('setVolume stores normal values', () => {
    setVolume(0.75);
    expect(getVolume()).toBe(0.75);
  });

  it('setVolume persists to storage', () => {
    setVolume(0.6);
    expect(storageSetRaw).toHaveBeenCalledWith('zenflow_audio_volume', '0.6');
  });

  it('keeps the previous audible volume when persistence fails', () => {
    mockStorage.zenflow_audio_volume = '0.3';
    initAudioManager();
    const listener = vi.fn();
    window.addEventListener('zenflow-audio-settings-change', listener);
    storageWritesSucceed = false;

    const saved = setVolume(0.8);

    expect(saved).toBe(false);
    expect(getVolume()).toBe(0.3);
    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener('zenflow-audio-settings-change', listener);
  });

  it('keeps notification feedback below sharp ping range', () => {
    const captured = installCapturedAudioContext();
    playNotification();

    expect(captured.frequencies).toEqual([587.33]);
    expect(captured.durations).toEqual([0.1]);
    expect(captured.waveforms).toEqual(['sine']);
    expect(Math.max(...captured.gains)).toBeLessThanOrEqual(0.03);
  });

  it('resumes a suspended AudioContext before playing direct notification feedback', async () => {
    const captured = installCapturedAudioContext({ initialState: 'suspended' });

    playNotification();

    expect(captured.resumeCalls).toBe(1);
    expect(captured.frequencies).toEqual([]);

    await Promise.resolve();

    expect(captured.frequencies).toEqual([587.33]);
  });

  it('treats master volume 0 as silence for direct notification feedback', () => {
    const captured = installCapturedAudioContext();
    setVolume(0);

    playNotification();

    expect(captured.frequencies).toEqual([]);
    expect(captured.gains).toEqual([]);
    expect(captured.gainRampTargets).toEqual([]);
  });

  it('treats master volume 0 as silence for deferred and milestone feedback', () => {
    vi.useFakeTimers();
    try {
      const captured = installCapturedAudioContext();
      setVolume(0);

      playSound('success');
      playSound('complete');
      playSound('milestone');
      vi.runAllTimers();

      expect(captured.frequencies).toEqual([]);
      expect(captured.gains).toEqual([]);
      expect(captured.gainRampTargets).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not spend notification fatigue budget while master volume is 0', () => {
    vi.useFakeTimers();
    try {
      const captured = installCapturedAudioContext();
      setVolume(0);
      for (let index = 0; index < 6; index += 1) playNotification();

      setVolume(0.3);
      playNotification();
      vi.runAllTimers();

      expect(captured.frequencies).toEqual([587.33]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps settings notification preview independent from the reminder fatigue budget', () => {
    vi.useFakeTimers();
    try {
      const captured = installCapturedAudioContext();
      for (let index = 0; index < 6; index += 1) playNotification();

      expect(captured.frequencies).toEqual([587.33, 587.33, 587.33, 587.33]);

      playNotificationPreview();
      vi.runAllTimers();

      expect(captured.frequencies).toEqual([587.33, 587.33, 587.33, 587.33, 587.33]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Effective app audio authority', () => {
  it('does not let the retired feedback-style sound flag override app audio', () => {
    initAudioManager();

    expect(audioManager.getAudioSettings()).toMatchObject({
      muted: false,
      volume: 0.3,
      feedbackSoundsEnabled: true,
      canPlayFeedback: true,
    });
  });

  it('restores an audible default volume when the single master is enabled from zero', () => {
    expect(audioManager).toHaveProperty('setAudioEnabled');
    const setAudioEnabled = (
      audioManager as typeof audioManager & { setAudioEnabled: (enabled: boolean) => void }
    ).setAudioEnabled;

    setVolume(0);
    setMuted(true);
    setAudioEnabled(true);

    expect(isMuted()).toBe(false);
    expect(getVolume()).toBe(0.3);
    expect(audioManager.getAudioSettings().canPlayFeedback).toBe(true);
  });
});

describe('Mastered feedback cues', () => {
  function installMasteredCueContext(
    fetchImpl: typeof fetch,
    options: { decodeError?: Error } = {},
  ) {
    const starts: AudioBuffer[] = [];
    const oscillatorStarts: number[] = [];
    const decodedBuffer = { duration: 0.5 } as AudioBuffer;

    class MockMasteredAudioContext {
      currentTime = 10;
      destination = {};
      state: AudioContextState = 'running';

      createBufferSource() {
        const source = {
          buffer: null as AudioBuffer | null,
          connect: vi.fn(),
          start: vi.fn(() => {
            if (source.buffer) starts.push(source.buffer);
          }),
        };
        return source as unknown as AudioBufferSourceNode;
      }

      createGain() {
        return {
          connect: vi.fn(),
          gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        } as unknown as GainNode;
      }

      createOscillator() {
        return {
          frequency: { value: 0 },
          type: 'sine',
          connect: vi.fn(),
          start: vi.fn(() => oscillatorStarts.push(1)),
          stop: vi.fn(),
        } as unknown as OscillatorNode;
      }

      decodeAudioData() {
        if (options.decodeError) return Promise.reject(options.decodeError);
        return Promise.resolve(decodedBuffer);
      }

      close() {
        return Promise.resolve();
      }

      resume() {
        return Promise.resolve();
      }
    }

    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: MockMasteredAudioContext,
    });
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      writable: true,
      value: MockMasteredAudioContext,
    });
    vi.stubGlobal('fetch', vi.fn(fetchImpl));

    cleanup();
    initAudioManager();
    return { starts, oscillatorStarts, decodedBuffer };
  }

  it('loads the scoped first-party MP3 before the first explicit preview', async () => {
    const { starts, decodedBuffer } = installMasteredCueContext(
      vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })),
    );

    const played = await playFeedbackPreview('success');

    expect(fetch).toHaveBeenCalledWith(
      '/sounds/feedback/feedback-success.mp3',
      expect.objectContaining({ cache: 'force-cache', credentials: 'same-origin' }),
    );
    expect(played).toBe(true);
    expect(starts).toEqual([decodedBuffer]);
  });

  it('retries a transient cue fetch failure instead of caching failure forever', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('temporary network failure'))
      .mockResolvedValueOnce(new Response(new Uint8Array([4, 5, 6]), { status: 200 }));
    const { starts } = installMasteredCueContext(fetchMock);

    expect(await playFeedbackPreview('complete')).toBe(false);
    expect(await playFeedbackPreview('complete')).toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(starts).toHaveLength(1);
  });

  it('deduplicates concurrent loads for the same feedback cue', async () => {
    let resolveFetch!: (response: Response) => void;
    const fetchMock = vi.fn<typeof fetch>(
      () => new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const { starts } = installMasteredCueContext(fetchMock);

    const first = playFeedbackPreview('milestone');
    const second = playFeedbackPreview('milestone');
    resolveFetch(new Response(new Uint8Array([7, 8, 9]), { status: 200 }));

    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(starts).toHaveLength(2);
  });

  it('uses a preloaded mastered cue for regular feedback without procedural overlap', async () => {
    vi.useFakeTimers();
    try {
      const { starts, oscillatorStarts, decodedBuffer } = installMasteredCueContext(
        vi.fn(async () => new Response(new Uint8Array([10, 11, 12]), { status: 200 })),
      );

      await preloadFeedbackCues();
      playSuccess();
      vi.advanceTimersByTime(LOW_SALIENCE_TEST_DELAY_MS);

      expect(starts).toEqual([decodedBuffer]);
      expect(oscillatorStarts).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses the procedural cue when a mastered cue cannot be decoded', async () => {
    const { starts, oscillatorStarts } = installMasteredCueContext(
      vi.fn(async () => new Response(new Uint8Array([13, 14, 15]), { status: 200 })),
      { decodeError: new DOMException('invalid MP3', 'EncodingError') },
    );

    await expect(playFeedbackPreview('notification')).resolves.toBe(false);

    expect(starts).toEqual([]);
    expect(oscillatorStarts).toHaveLength(1);
  });

  it('does not emit a loaded preview after the user mutes during the fetch', async () => {
    let resolveFetch!: (response: Response) => void;
    const { starts, oscillatorStarts } = installMasteredCueContext(
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );

    const preview = playFeedbackPreview('success');
    setMuted(true);
    resolveFetch(new Response(new Uint8Array([16, 17, 18]), { status: 200 }));

    await expect(preview).resolves.toBe(false);
    expect(starts).toEqual([]);
    expect(oscillatorStarts).toEqual([]);
  });
});

describe('Mute control', () => {
  it('not muted by default', () => {
    expect(isMuted()).toBe(false);
  });

  it('setMuted(true) mutes audio', () => {
    setMuted(true);
    expect(isMuted()).toBe(true);
  });

  it('setMuted(false) unmutes audio', () => {
    setMuted(true);
    setMuted(false);
    expect(isMuted()).toBe(false);
  });

  it('setMuted persists "1" for muted to storage', () => {
    setMuted(true);
    expect(storageSetRaw).toHaveBeenCalledWith('zenflow_audio_muted', '1');
  });

  it('setMuted persists "0" for unmuted to storage', () => {
    setMuted(false);
    expect(storageSetRaw).toHaveBeenCalledWith('zenflow_audio_muted', '0');
  });
});

describe('initAudioManager', () => {
  it('restores muted state from storage', () => {
    mockStorage['zenflow_audio_muted'] = '1';
    initAudioManager();
    expect(isMuted()).toBe(true);
  });

  it('does not mute when storage value is "0"', () => {
    // Ensure unmuted baseline first
    setMuted(false);
    mockStorage['zenflow_audio_muted'] = '0';
    initAudioManager();
    expect(isMuted()).toBe(false);
  });

  it('restores volume from storage', () => {
    mockStorage['zenflow_audio_volume'] = '0.8';
    initAudioManager();
    expect(getVolume()).toBe(0.8);
  });

  it('uses default volume when storage is empty', () => {
    // Reset volume to default before init
    setVolume(0.3);
    initAudioManager();
    expect(getVolume()).toBe(0.3);
  });
});

describe('getState', () => {
  it('returns state with expected properties', () => {
    const state = getState();
    expect(state).toHaveProperty('context');
    expect(state).toHaveProperty('isMuted');
    expect(state).toHaveProperty('volume');
    expect(state).toHaveProperty('activeTimeouts');
  });

  it('returns a copy (not reference)', () => {
    const s1 = getState();
    const s2 = getState();
    expect(s1).not.toBe(s2);
    expect(s1).toEqual(s2);
  });
});

describe('getAudioContext', () => {
  it('returns an AudioContext or null', () => {
    const ctx = getAudioContext();
    // In jsdom, AudioContext may or may not be available
    expect(ctx === null || ctx instanceof AudioContext).toBe(true);
  });
});

describe('cleanup', () => {
  it('clears active timeouts', () => {
    cleanup();
    const state = getState();
    expect(state.activeTimeouts).toEqual([]);
  });

  it('nullifies audio context', () => {
    cleanup();
    const state = getState();
    expect(state.context).toBeNull();
  });
});

describe('playSound dispatch', () => {
  it('does not throw for any valid sound type', () => {
    const types = ['success', 'complete', 'streak', 'milestone', 'levelUp', 'notification'] as const;
    types.forEach(type => {
      expect(() => playSound(type)).not.toThrow();
    });
  });

  it('playSuccess does not throw', () => {
    expect(() => playSuccess()).not.toThrow();
  });

  it('playComplete does not throw', () => {
    expect(() => playComplete()).not.toThrow();
  });

  it('playStreakMilestone does not throw', () => {
    expect(() => playStreakMilestone()).not.toThrow();
  });

  it('playLevelUp does not throw', () => {
    expect(() => playLevelUp()).not.toThrow();
  });

  it('playNotification does not throw', () => {
    expect(() => playNotification()).not.toThrow();
  });

  it('routes direct notification pings through sensory comfort settings', () => {
    const captured = installCapturedAudioContext();
    mockStorage.zenflow_audio_comfort = JSON.stringify({ reminderCuesEnabled: false });

    playNotification();

    expect(captured.frequencies).toEqual([]);
  });

  it('routes direct completion cues through sensory comfort settings', () => {
    vi.useFakeTimers();
    try {
      const captured = installCapturedAudioContext();
      mockStorage.zenflow_audio_comfort = JSON.stringify({ completionCuesEnabled: false });

      playComplete();
      vi.runAllTimers();

      expect(captured.frequencies).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('routes direct milestone cues through sensory comfort settings', () => {
    vi.useFakeTimers();
    try {
      const captured = installCapturedAudioContext();
      mockStorage.zenflow_audio_comfort = JSON.stringify({ milestoneCuesEnabled: false });

      playStreakMilestone();
      playMilestone();
      playLevelUp();
      vi.runAllTimers();

      expect(captured.frequencies).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('applies fatigue budget to direct milestone cues', () => {
    vi.useFakeTimers();
    try {
      const captured = installCapturedAudioContext();

      playMilestone();
      playMilestone();
      playMilestone();
      playMilestone();
      vi.runAllTimers();

      expect(captured.frequencies).toHaveLength(9);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not consume fatigue budget while feedback audio is muted', () => {
    vi.useFakeTimers();
    try {
      const captured = installCapturedAudioContext();
      setMuted(true);
      for (let index = 0; index < 6; index += 1) playSound('notification');
      vi.runOnlyPendingTimers();

      setMuted(false);
      playSound('notification');
      vi.advanceTimersByTime(LOW_SALIENCE_TEST_DELAY_MS);

      expect(captured.frequencies).toEqual([587.33]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps milestone feedback soft and below fanfare range', () => {
    vi.useFakeTimers();
    try {
      const captured = installCapturedAudioContext();
      playMilestone();
      vi.runAllTimers();

      expect(captured.frequencies.length).toBeGreaterThan(0);
      expect(Math.max(...captured.frequencies)).toBeLessThanOrEqual(587.33);
      expect(Math.max(...captured.durations)).toBeLessThanOrEqual(0.2);
      expect(Math.max(...captured.gains)).toBeLessThanOrEqual(0.045);
      expect(captured.waveforms.every((waveform) => waveform === 'triangle')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('suppresses pending lower-salience cues when a milestone cue follows immediately', () => {
    vi.useFakeTimers();
    try {
      const captured = installCapturedAudioContext();
      playSound('success');
      playSound('milestone');
      vi.runOnlyPendingTimers();

      expect(captured.frequencies.length).toBeGreaterThan(0);
      expect(Math.max(...captured.frequencies)).toBeLessThanOrEqual(587.33);
      expect(Math.max(...captured.gains)).toBeLessThanOrEqual(0.045);
      expect(captured.waveforms.every((waveform) => waveform === 'triangle')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps completion feedback distinct from generic success feedback', () => {
    vi.useFakeTimers();
    try {
      const success = installCapturedAudioContext();
      playSound('success');
      vi.runAllTimers();
      const successShape = {
        frequencies: [...success.frequencies],
        durations: [...success.durations],
        waveforms: [...success.waveforms],
      };

      cleanup();

      const complete = installCapturedAudioContext();
      playSound('complete');
      vi.runAllTimers();

      expect({
        frequencies: complete.frequencies,
        durations: complete.durations,
        waveforms: complete.waveforms,
      }).not.toEqual(successShape);
      expect(complete.frequencies.length).toBeGreaterThanOrEqual(2);
      expect(Math.max(...complete.gains)).toBeLessThanOrEqual(0.04);
    } finally {
      vi.useRealTimers();
    }
  });
});
