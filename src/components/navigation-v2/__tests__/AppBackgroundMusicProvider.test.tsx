import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AppBackgroundMusicProvider,
  useAppBackgroundMusicControl,
} from "../AppBackgroundMusicProvider";

const settings = vi.hoisted(() => ({
  muted: false,
  volume: 0.5,
  ambientEnabled: true,
}));

vi.mock("@/hooks/useAppAudioSettings", () => ({
  useAppAudioSettings: () => ({
    muted: settings.muted,
    volume: settings.volume,
    feedbackSoundsEnabled: !settings.muted,
    canPlayFeedback: !settings.muted,
    hyperfocusToneCutoffKhz: 16,
  }),
}));

vi.mock("@/hooks/useAudioComfortSettings", () => ({
  useAudioComfortSettings: () => ({
    settings: {
      profile: "balanced",
      ambientEnabled: settings.ambientEnabled,
      completionCuesEnabled: true,
      milestoneCuesEnabled: true,
      reminderCuesEnabled: true,
      avoidedTextures: [],
    },
    canPlayAmbientAsset: () => settings.ambientEnabled,
  }),
}));

vi.mock("@/lib/audioLifecycle", () => ({
  registerAudioBackgroundPauseHandler: () => () => undefined,
  registerAudioForegroundResumeHandler: () => () => undefined,
}));

vi.mock("@/lib/audioMediaSession", () => ({
  clearAppAudioMediaSession: vi.fn(),
  setAppAudioMediaSession: vi.fn(),
}));

const play = vi.fn<() => Promise<void>>();
const pause = vi.fn();

function Consumer() {
  const music = useAppBackgroundMusicControl();
  return (
    <button type="button" onClick={music.toggle} aria-pressed={music.enabled}>
      {music.state}
    </button>
  );
}

describe("AppBackgroundMusicProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    settings.muted = false;
    settings.volume = 0.5;
    settings.ambientEnabled = true;
    play.mockReset().mockResolvedValue(undefined);
    pause.mockReset();
    Object.defineProperty(window.HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: play,
    });
    Object.defineProperty(window.HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: pause,
    });
  });

  it("mounts one local loop without eager preload and exposes its controller", async () => {
    render(
      <AppBackgroundMusicProvider>
        <Consumer />
      </AppBackgroundMusicProvider>
    );

    const audio = screen.getByTestId("app-background-music-audio");
    expect(audio).toHaveAttribute(
      "src",
      expect.stringContaining("/sounds/cloudlight-evening-loop.mp3")
    );
    expect(audio).toHaveAttribute("preload", "none");
    expect(audio).toHaveAttribute("loop");
    expect(audio).toHaveAttribute("playsinline");
    expect(screen.getByRole("button")).toHaveTextContent("off");

    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByRole("button")).toHaveTextContent("playing"));
    expect((audio as HTMLAudioElement).volume).toBeCloseTo(0.09, 5);
  });

  it("throws when the controller is consumed outside its provider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      expect(() => render(<Consumer />)).toThrow(/AppBackgroundMusicProvider/);
    } finally {
      consoleError.mockRestore();
    }
  });
});
