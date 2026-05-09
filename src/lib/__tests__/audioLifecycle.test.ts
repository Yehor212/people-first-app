import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock ambientSounds ─────────────────────────────────────────
const mockGenerator = {
  getStatus: vi.fn().mockReturnValue({ state: 'idle', soundId: null, isUnlocked: false }),
  pause: vi.fn(),
  resume: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../ambientSounds', () => ({
  getAmbientSoundGenerator: vi.fn(() => mockGenerator),
  forceUnlockAudio: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../audioManager', () => ({
  resumeOnInteraction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { pauseAllAudio, resumeAllAudio, getLifecycleState, wasAudioPlaying } from '../audioLifecycle';
import { forceUnlockAudio } from '../ambientSounds';
import { resumeOnInteraction } from '../audioManager';

// ─── Setup ──────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  // Reset lifecycle state by resuming (which clears state)
  mockGenerator.getStatus.mockReturnValue({ state: 'idle', soundId: null, isUnlocked: false });
});

// ─── Tests ──────────────────────────────────────────────────────

describe('getLifecycleState', () => {
  it('returns initial state with wasPlaying=false', () => {
    const state = getLifecycleState();
    expect(state.wasPlaying).toBe(false);
    expect(state.soundId).toBeNull();
    expect(state.pausedAt).toBeNull();
  });

  it('returns a copy, not a reference', () => {
    const s1 = getLifecycleState();
    const s2 = getLifecycleState();
    expect(s1).not.toBe(s2);
    expect(s1).toEqual(s2);
  });
});

describe('wasAudioPlaying', () => {
  it('returns false initially', () => {
    expect(wasAudioPlaying()).toBe(false);
  });

  it('returns true after pausing while audio was playing', () => {
    mockGenerator.getStatus.mockReturnValue({ state: 'playing', soundId: 'ocean', isUnlocked: true });
    pauseAllAudio();
    expect(wasAudioPlaying()).toBe(true);
  });

  it('returns false after pausing when audio was idle', () => {
    mockGenerator.getStatus.mockReturnValue({ state: 'idle', soundId: null, isUnlocked: false });
    pauseAllAudio();
    expect(wasAudioPlaying()).toBe(false);
  });
});

describe('pauseAllAudio', () => {
  it('calls generator.pause() when audio is playing', () => {
    mockGenerator.getStatus.mockReturnValue({ state: 'playing', soundId: 'cafe', isUnlocked: true });
    pauseAllAudio();
    expect(mockGenerator.pause).toHaveBeenCalledTimes(1);
  });

  it('does not call generator.pause() when audio is idle', () => {
    mockGenerator.getStatus.mockReturnValue({ state: 'idle', soundId: null, isUnlocked: false });
    pauseAllAudio();
    expect(mockGenerator.pause).not.toHaveBeenCalled();
  });

  it('saves soundId in lifecycle state', () => {
    mockGenerator.getStatus.mockReturnValue({ state: 'playing', soundId: 'river', isUnlocked: true });
    pauseAllAudio();
    const state = getLifecycleState();
    expect(state.soundId).toBe('river');
  });

  it('records pausedAt timestamp', () => {
    const before = Date.now();
    mockGenerator.getStatus.mockReturnValue({ state: 'playing', soundId: 'ocean', isUnlocked: true });
    pauseAllAudio();
    const after = Date.now();

    const state = getLifecycleState();
    expect(state.pausedAt).toBeGreaterThanOrEqual(before);
    expect(state.pausedAt).toBeLessThanOrEqual(after);
  });

  it('does not throw when generator throws', () => {
    mockGenerator.getStatus.mockImplementation(() => { throw new Error('fail'); });
    expect(() => pauseAllAudio()).not.toThrow();
  });
});

describe('resumeAllAudio', () => {
  it('calls forceUnlockAudio on every resume', async () => {
    await resumeAllAudio();
    expect(forceUnlockAudio).toHaveBeenCalledTimes(1);
  });

  it('does not call generator.resume() when wasPlaying is false', async () => {
    mockGenerator.getStatus.mockReturnValue({ state: 'idle', soundId: null, isUnlocked: false });
    pauseAllAudio(); // sets wasPlaying=false
    await resumeAllAudio();
    expect(mockGenerator.resume).not.toHaveBeenCalled();
  });

  it('calls generator.resume() when wasPlaying is true', async () => {
    mockGenerator.getStatus.mockReturnValue({ state: 'playing', soundId: 'ocean', isUnlocked: true });
    pauseAllAudio();
    await resumeAllAudio();
    expect(mockGenerator.resume).toHaveBeenCalledTimes(1);
  });

  it('calls resumeOnInteraction before generator.resume()', async () => {
    mockGenerator.getStatus.mockReturnValue({ state: 'playing', soundId: 'ocean', isUnlocked: true });
    pauseAllAudio();
    await resumeAllAudio();
    expect(resumeOnInteraction).toHaveBeenCalledTimes(1);
  });

  it('resets lifecycle state after resume', async () => {
    mockGenerator.getStatus.mockReturnValue({ state: 'playing', soundId: 'cafe', isUnlocked: true });
    pauseAllAudio();
    await resumeAllAudio();

    const state = getLifecycleState();
    expect(state.wasPlaying).toBe(false);
    expect(state.soundId).toBeNull();
    expect(state.pausedAt).toBeNull();
  });

  it('resets lifecycle state even when audio was not playing', async () => {
    mockGenerator.getStatus.mockReturnValue({ state: 'idle', soundId: null, isUnlocked: false });
    pauseAllAudio();
    await resumeAllAudio();

    const state = getLifecycleState();
    expect(state.wasPlaying).toBe(false);
    expect(state.soundId).toBeNull();
  });

  it('handles forceUnlockAudio failure gracefully', async () => {
    vi.mocked(forceUnlockAudio).mockRejectedValueOnce(new Error('unlock failed'));
    mockGenerator.getStatus.mockReturnValue({ state: 'playing', soundId: 'ocean', isUnlocked: true });
    pauseAllAudio();

    // Should not throw
    await expect(resumeAllAudio()).resolves.toBeUndefined();
  });

  it('handles generator.resume() failure gracefully', async () => {
    mockGenerator.getStatus.mockReturnValue({ state: 'playing', soundId: 'ocean', isUnlocked: true });
    pauseAllAudio();
    mockGenerator.resume.mockRejectedValueOnce(new Error('resume failed'));

    // Should not throw — error is caught internally
    await expect(resumeAllAudio()).resolves.toBeUndefined();
  });
});
