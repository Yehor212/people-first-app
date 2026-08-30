import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useHyperfocusAudio } from "../useHyperfocusAudio";

const audioSettingsState = vi.hoisted(() => ({
  snapshot: {
    muted: false,
    volume: 0.6,
    feedbackSoundsEnabled: true,
    canPlayFeedback: true,
    hyperfocusToneCutoffKhz: 7,
  },
}));

const generator = vi.hoisted(() => ({
  statusListeners: [] as Array<(status: { state: string; soundId: string | null; isUnlocked: boolean }) => void>,
  addStatusListener: vi.fn((listener: (status: { state: string; soundId: string | null; isUnlocked: boolean }) => void) => {
    generator.statusListeners.push(listener);
    listener({ state: "idle", soundId: null, isUnlocked: false });
    return vi.fn();
  }),
  setVolume: vi.fn(),
  playDirect: vi.fn(),
  pause: vi.fn(),
  stop: vi.fn(),
  resumeDirect: vi.fn(),
  setToneCutoffKhz: vi.fn((cutoffKhz: number) => ({ state: "active", cutoffKhz })),
  getToneFilterStatus: vi.fn(() => ({ state: "active", cutoffKhz: 7 })),
}));

const tonePreference = vi.hoisted(() => ({
  persist: vi.fn(() => true),
}));

const mediaSession = vi.hoisted(() => ({
  setAppAudioMediaSession: vi.fn(),
  clearAppAudioMediaSession: vi.fn(),
}));

const ownership = vi.hoisted(() => ({
  claim: vi.fn(),
  release: vi.fn(),
  pauseOwner: null as null | (() => void),
}));

vi.mock("@/hooks/useAppAudioSettings", () => ({
  useAppAudioSettings: () => audioSettingsState.snapshot,
}));

vi.mock("@/lib/ambientSounds", () => ({
  getAmbientSoundGenerator: () => generator,
  AmbientSoundGenerator: class {},
}));

vi.mock("@/lib/audioMediaSession", () => mediaSession);

vi.mock("@/lib/audioPlaybackCoordinator", () => ({
  claimLongAudio: ownership.claim,
}));

vi.mock("@/lib/audioManager", () => ({
  setHyperfocusToneCutoffKhz: tonePreference.persist,
}));

describe("useHyperfocusAudio master app sound", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generator.statusListeners.length = 0;
    ownership.release = vi.fn();
    ownership.pauseOwner = null;
    ownership.claim.mockReset().mockImplementation((_ownerId, pauseOwner) => {
      ownership.pauseOwner = pauseOwner;
      return ownership.release;
    });
    audioSettingsState.snapshot = {
      muted: false,
      volume: 0.6,
      feedbackSoundsEnabled: true,
      canPlayFeedback: true,
      hyperfocusToneCutoffKhz: 7,
    };
  });

  it("applies master app volume without a second hidden attenuation", () => {
    const { result } = renderHook(() => useHyperfocusAudio({ isRunning: true, isPaused: false }));

    expect(result.current.audioMuted).toBe(false);
    expect(generator.setVolume).toHaveBeenCalledWith(0.6);

    act(() => result.current.handleSoundSelect("river"));
    expect(generator.playDirect).toHaveBeenCalledWith("river:deep");
  });

  it("claims Hyperfocus before direct playback and releases on pause", () => {
    const { result } = renderHook(() =>
      useHyperfocusAudio({ isRunning: true, isPaused: false }),
    );

    act(() => result.current.handleSoundSelect("rain"));

    expect(ownership.claim).toHaveBeenCalledWith("hyperfocus", expect.any(Function));
    expect(ownership.claim.mock.invocationCallOrder[0]).toBeLessThan(
      generator.playDirect.mock.invocationCallOrder[0],
    );

    act(() => result.current.pauseAudio());
    expect(ownership.release).toHaveBeenCalledTimes(1);
  });

  it("stops and releases when another long-audio owner replaces Hyperfocus", () => {
    const { result } = renderHook(() =>
      useHyperfocusAudio({ isRunning: true, isPaused: false }),
    );
    act(() => result.current.handleSoundSelect("ocean"));
    generator.pause.mockClear();

    act(() => ownership.pauseOwner?.());

    expect(generator.pause).toHaveBeenCalledTimes(1);
    expect(ownership.release).toHaveBeenCalledTimes(1);
  });

  it("applies the persisted cutoff without changing playback speed or selected sound", () => {
    const { result } = renderHook(() => useHyperfocusAudio({ isRunning: true, isPaused: false }));

    expect(result.current.toneCutoffKhz).toBe(7);
    expect(generator.setToneCutoffKhz).toHaveBeenCalledWith(7);

    act(() => result.current.handleSoundSelect("river"));

    expect(generator.setToneCutoffKhz).toHaveBeenLastCalledWith(7);
    expect(generator.playDirect).toHaveBeenCalledWith("river:deep");
  });

  it("persists a user cutoff before applying it to the live graph", () => {
    const { result } = renderHook(() => useHyperfocusAudio({ isRunning: true, isPaused: false }));
    generator.setToneCutoffKhz.mockClear();

    let saved = false;
    act(() => {
      saved = result.current.setToneCutoffKhz(5.5);
    });

    expect(saved).toBe(true);
    expect(tonePreference.persist).toHaveBeenCalledWith(5.5);
    expect(generator.setToneCutoffKhz).toHaveBeenCalledWith(5.5);
  });

  it("leaves the live graph unchanged when cutoff persistence fails", () => {
    tonePreference.persist.mockReturnValueOnce(false);
    const { result } = renderHook(() => useHyperfocusAudio({ isRunning: true, isPaused: false }));
    generator.setToneCutoffKhz.mockClear();

    let saved = true;
    act(() => {
      saved = result.current.setToneCutoffKhz(4);
    });

    expect(saved).toBe(false);
    expect(generator.setToneCutoffKhz).not.toHaveBeenCalled();
  });

  it("normalizes legacy sound ids to deep variants before storing and playing", () => {
    const { result } = renderHook(() => useHyperfocusAudio({ isRunning: true, isPaused: false }));

    act(() => result.current.handleSoundSelect("river"));

    expect(result.current.selectedSoundId).toBe("river:deep");
    expect(generator.playDirect).toHaveBeenCalledWith("river:deep");
  });

  it("maps the removed cafe option to forest for legacy selections", () => {
    const { result } = renderHook(() => useHyperfocusAudio({ isRunning: true, isPaused: false }));

    act(() => result.current.handleSoundSelect("cafe"));

    expect(result.current.selectedSoundId).toBe("forest:deep");
    expect(generator.playDirect).toHaveBeenCalledWith("forest:deep");
  });

  it("clears the playing indicator and media session when the generator pauses or blocks", () => {
    const { result } = renderHook(() => useHyperfocusAudio({ isRunning: true, isPaused: false }));
    const listener = generator.statusListeners[0];

    act(() => listener({ state: "playing", soundId: "rain:deep", isUnlocked: true }));
    expect(result.current.isSoundPlaying).toBe(true);
    expect(mediaSession.setAppAudioMediaSession).toHaveBeenCalledWith(expect.objectContaining({
      title: "ZenFlow Hyperfocus",
      onPause: expect.any(Function),
      onStop: expect.any(Function),
    }));
    const mediaOptions = mediaSession.setAppAudioMediaSession.mock.calls.at(-1)?.[0] as { onStop: () => void };
    generator.pause.mockClear();
    generator.stop.mockClear();
    act(() => mediaOptions.onStop());
    expect(generator.pause).toHaveBeenCalled();
    expect(generator.stop).not.toHaveBeenCalled();

    act(() => listener({ state: "paused", soundId: "rain:deep", isUnlocked: true }));
    expect(result.current.isSoundPlaying).toBe(false);
    expect(mediaSession.clearAppAudioMediaSession).toHaveBeenCalled();

    act(() => listener({ state: "playing", soundId: "rain:deep", isUnlocked: true }));
    act(() => listener({ state: "blocked", soundId: "rain:deep", isUnlocked: false }));
    expect(result.current.isSoundPlaying).toBe(false);
  });

  it("does not start focus ambience while app sound is muted", () => {
    audioSettingsState.snapshot = {
      muted: true,
      volume: 0.8,
      feedbackSoundsEnabled: true,
      canPlayFeedback: false,
      hyperfocusToneCutoffKhz: 7,
    };

    const { result } = renderHook(() => useHyperfocusAudio({ isRunning: true, isPaused: false }));

    expect(result.current.audioMuted).toBe(true);
    expect(generator.setVolume).toHaveBeenCalledWith(0);
    expect(generator.pause).toHaveBeenCalled();

    act(() => result.current.handleSoundSelect("ocean"));
    expect(generator.playDirect).not.toHaveBeenCalled();
  });
});
