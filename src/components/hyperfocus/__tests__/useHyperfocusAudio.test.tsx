import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useHyperfocusAudio } from "../useHyperfocusAudio";

const audioSettingsState = vi.hoisted(() => ({
  snapshot: {
    muted: false,
    volume: 0.6,
    feedbackSoundsEnabled: true,
    canPlayFeedback: true,
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
}));

const mediaSession = vi.hoisted(() => ({
  setAppAudioMediaSession: vi.fn(),
  clearAppAudioMediaSession: vi.fn(),
}));

vi.mock("@/hooks/useAppAudioSettings", () => ({
  useAppAudioSettings: () => audioSettingsState.snapshot,
}));

vi.mock("@/lib/ambientSounds", () => ({
  getAmbientSoundGenerator: () => generator,
  AmbientSoundGenerator: class {},
}));

vi.mock("@/lib/audioMediaSession", () => mediaSession);

describe("useHyperfocusAudio master app sound", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generator.statusListeners.length = 0;
    audioSettingsState.snapshot = {
      muted: false,
      volume: 0.6,
      feedbackSoundsEnabled: true,
      canPlayFeedback: true,
    };
  });

  it("applies master app volume to the focus ambient generator", () => {
    const { result } = renderHook(() => useHyperfocusAudio({ isRunning: true, isPaused: false }));

    expect(result.current.audioMuted).toBe(false);
    expect(generator.setVolume).toHaveBeenCalledWith(0.3);

    act(() => result.current.handleSoundSelect("river"));
    expect(generator.playDirect).toHaveBeenCalledWith("river:deep");
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
    };

    const { result } = renderHook(() => useHyperfocusAudio({ isRunning: true, isPaused: false }));

    expect(result.current.audioMuted).toBe(true);
    expect(generator.setVolume).toHaveBeenCalledWith(0);
    expect(generator.pause).toHaveBeenCalled();

    act(() => result.current.handleSoundSelect("ocean"));
    expect(generator.playDirect).not.toHaveBeenCalled();
  });
});
