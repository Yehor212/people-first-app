import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { JournalAmbienceSetting } from "../JournalAmbienceSetting";

const tx = {
  diaryAmbienceLabel: "Writing sound",
  diaryAmbiencePlay: "Play writing sound",
  diaryAmbiencePause: "Pause writing sound",
  audioLoading: "Loading…",
  audioRetry: "Try again",
  settingsSoundSummaryOff: "App sound is off.",
  settingsSoundAmbientOff: "Background sounds are off.",
  settingsSoundDiaryRainOff: "Rain is unavailable.",
  settingsSoundAmbienceTitle: "Writing sound",
  settingsSoundAmbienceNote: "Play soft rain while you write.",
};

const appAudio = vi.hoisted(() => ({
  canPlayFeedback: true,
  volume: 0.5,
}));

const comfort = vi.hoisted(() => ({
  settings: { ambientEnabled: true },
  canPlayAmbientAsset: vi.fn(() => true),
}));

const media = vi.hoisted(() => ({
  play: vi.fn(() => Promise.resolve()),
  pause: vi.fn(),
  load: vi.fn(),
}));

vi.mock("@/hooks/useAppAudioSettings", () => ({
  useAppAudioSettings: () => appAudio,
}));

vi.mock("@/hooks/useAudioComfortSettings", () => ({
  useAudioComfortSettings: () => comfort,
}));

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: vi.fn(() => Promise.resolve({ remove: vi.fn() })),
  },
}));

vi.mock("@/lib/audioMediaSession", () => ({
  clearAppAudioMediaSession: vi.fn(),
  setAppAudioMediaSession: vi.fn(),
}));

describe("JournalAmbienceSetting", () => {
  beforeEach(() => {
    appAudio.canPlayFeedback = true;
    appAudio.volume = 0.5;
    comfort.settings.ambientEnabled = true;
    comfort.canPlayAmbientAsset.mockReset();
    comfort.canPlayAmbientAsset.mockReturnValue(true);
    media.play.mockReset();
    media.play.mockResolvedValue(undefined);
    media.pause.mockReset();
    media.load.mockReset();
    Object.defineProperty(window.HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: media.play,
    });
    Object.defineProperty(window.HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: media.pause,
    });
    Object.defineProperty(window.HTMLMediaElement.prototype, "load", {
      configurable: true,
      value: media.load,
    });
  });

  it("starts only after an explicit press and exposes truthful toggle state", async () => {
    render(<JournalAmbienceSetting tx={tx} />);

    const audio = screen.getByTestId("journal-settings-ambience-audio");
    const toggle = screen.getByTestId("journal-settings-ambience-toggle");

    expect(audio).toHaveAttribute("src", expect.stringContaining("/sounds/soft-rain-veil.mp3"));
    expect(audio).toHaveAttribute("preload", "none");
    expect(audio).toHaveAttribute("loop");
    expect(audio).not.toHaveAttribute("autoplay");
    expect(media.play).not.toHaveBeenCalled();
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveAccessibleName("Play writing sound");

    fireEvent.click(toggle);

    expect(media.play).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "true"));
    expect(toggle).toHaveAccessibleName("Pause writing sound");

    fireEvent.click(toggle);

    expect(media.pause).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "false"));
  });

  it("does not start when app sound is off and explains why", () => {
    appAudio.canPlayFeedback = false;

    render(<JournalAmbienceSetting tx={tx} />);

    const toggle = screen.getByTestId("journal-settings-ambience-toggle");
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveAccessibleName("Writing sound, App sound is off.");
    expect(screen.getByRole("status")).toHaveTextContent("App sound is off.");

    fireEvent.click(toggle);
    expect(media.play).not.toHaveBeenCalled();
  });

  it("stops active audio when journal settings unmount", async () => {
    const { unmount } = render(<JournalAmbienceSetting tx={tx} />);
    fireEvent.click(screen.getByTestId("journal-settings-ambience-toggle"));
    await waitFor(() =>
      expect(screen.getByTestId("journal-settings-ambience-toggle")).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );

    media.pause.mockClear();
    unmount();

    expect(media.pause).toHaveBeenCalledTimes(1);
  });
});
