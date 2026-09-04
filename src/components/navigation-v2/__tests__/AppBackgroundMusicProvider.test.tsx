import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import {
  AppBackgroundMusicProvider,
  useAppBackgroundMusicControl,
} from "../AppBackgroundMusicProvider";
import { BackgroundMusicToggle } from "../BackgroundMusicToggle";

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

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      backgroundMusicTitle: "Evening music",
      backgroundMusicStateOn: "On",
      backgroundMusicStateOff: "Off",
      backgroundMusicStateLoading: "Loading",
      backgroundMusicStateBlocked: "Tap to resume",
      backgroundMusicStateUnavailable: "Unavailable",
      backgroundMusicPlayAction: "Play evening music",
      backgroundMusicPauseAction: "Pause evening music",
      backgroundMusicPausedMaster: "Paused while app sound is off",
      backgroundMusicPausedComfort: "Paused while background sounds are off",
      backgroundMusicPausedOtherSound: "Paused while another sound plays",
    },
  }),
}));

const play = vi.fn<() => Promise<void>>();
const pause = vi.fn();
const load = vi.fn();

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
    load.mockReset();
    Object.defineProperty(window.HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: play,
    });
    Object.defineProperty(window.HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: pause,
    });
    Object.defineProperty(window.HTMLMediaElement.prototype, "load", {
      configurable: true,
      value: load,
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
    expect(audio).not.toHaveAttribute("loop");
    expect(audio).toHaveAttribute("playsinline");
    expect(screen.getByRole("button")).toHaveTextContent("off");

    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByRole("button")).toHaveTextContent("playing"));
    expect((audio as HTMLAudioElement).volume).toBeCloseTo(0.09, 5);
  });

  it("advances one shared media element to the next collection master", async () => {
    render(
      <AppBackgroundMusicProvider>
        <Consumer />
      </AppBackgroundMusicProvider>,
    );
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByRole("button")).toHaveTextContent("playing"));

    const audio = screen.getByTestId("app-background-music-audio");
    fireEvent.ended(audio);

    await waitFor(() =>
      expect(audio).toHaveAttribute("src", expect.stringContaining("/sounds/music/lantern-air.mp3")),
    );
    expect(screen.getAllByTestId("app-background-music-audio")).toHaveLength(1);
  });

  it("throws when the controller is consumed outside its provider", () => {
    expect(() => renderToString(<Consumer />)).toThrow(/AppBackgroundMusicProvider/);
  });

  it("lets one blocked-state icon disable the saved preference without reloading", async () => {
    localStorage.setItem("zenflow-app-background-music-enabled", "true");
    play.mockRejectedValueOnce(new DOMException("gesture required", "NotAllowedError"));

    render(
      <AppBackgroundMusicProvider>
        <BackgroundMusicToggle presentation="sidebar-expanded" />
      </AppBackgroundMusicProvider>,
    );

    const button = await screen.findByRole("button", { name: "Pause evening music" });
    await waitFor(() => expect(button).toHaveTextContent("Tap to resume"));

    fireEvent.click(button);
    expect(load).not.toHaveBeenCalled();
    await waitFor(() => expect(button).toHaveAttribute("aria-pressed", "false"));
    expect(play).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("zenflow-app-background-music-enabled")).toBe("false");
  });

  it("keeps focus on the same icon when blocked playback is turned off", async () => {
    localStorage.setItem("zenflow-app-background-music-enabled", "true");
    play.mockRejectedValueOnce(new DOMException("gesture required", "NotAllowedError"));

    render(
      <AppBackgroundMusicProvider>
        <BackgroundMusicToggle presentation="sidebar-expanded" />
      </AppBackgroundMusicProvider>,
    );

    const primary = await screen.findByRole("button", { name: "Pause evening music" });
    await waitFor(() => expect(primary).toHaveTextContent("Tap to resume"));
    primary.focus();
    expect(document.activeElement).toBe(primary);

    fireEvent.click(primary);

    await waitFor(() => expect(primary).toHaveAttribute("aria-pressed", "false"));
    expect(screen.queryByTestId("background-music-disable")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(primary);
    expect(localStorage.getItem("zenflow-app-background-music-enabled")).toBe("false");
  });
});
