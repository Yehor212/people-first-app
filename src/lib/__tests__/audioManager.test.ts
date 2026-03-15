import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── In-memory storage mock ────────────────────────────────────
let mockStorage: Record<string, string> = {};

vi.mock('../safeJson', () => ({
  storageGetRaw: vi.fn((key: string): string | null => mockStorage[key] ?? null),
  storageSetRaw: vi.fn((key: string, value: string) => { mockStorage[key] = value; }),
}));

vi.mock('../storageKeys', () => ({
  SK: {
    AUDIO_MUTED: 'zenflow_audio_muted',
    AUDIO_VOLUME: 'zenflow_audio_volume',
    DOPAMINE_SETTINGS: 'zenflow_dopamine_settings',
  },
}));

vi.mock('../logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock animationUtils — shouldPlaySounds
vi.mock('../animationUtils', () => ({
  shouldPlaySounds: vi.fn(() => true),
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
  playStreakMilestone,
  playLevelUp,
  playNotification,
} from '../audioManager';

import { storageSetRaw } from '../safeJson';

// ─── Setup ──────────────────────────────────────────────────────
beforeEach(() => {
  mockStorage = {};
  vi.clearAllMocks();
  cleanup(); // Reset module state
});

afterEach(() => {
  cleanup();
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
    const types = ['success', 'complete', 'streak', 'levelUp', 'notification'] as const;
    types.forEach(type => {
      expect(() => playSound(type)).not.toThrow();
    });
  });

  it('playSuccess does not throw', () => {
    expect(() => playSuccess()).not.toThrow();
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
});
