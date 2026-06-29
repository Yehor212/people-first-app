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
  addStatusListener: vi.fn((listener: (status: { state: string; soundId: string | null; isUnlocked: boolean }) => void) => {
    listener({ state: "idle", soundId: null, isUnlocked: false });
    return vi.fn();
  }),
  setVolume: vi.fn(),
  playDirect: vi.fn(),
  pause: vi.fn(),
  stop: vi.fn(),
  resumeDirect: vi.fn(),
}));

vi.mock("@/hooks/useAppAudioSettings", () => ({
  useAppAudioSettings: () => audioSettingsState.snapshot,
}));

vi.mock("@/lib/ambientSounds", () => ({
  getAmbientSoundGenerator: () => generator,
  AmbientSoundGenerator: class {},
}));

describe("useHyperfocusAudio master app sound", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
