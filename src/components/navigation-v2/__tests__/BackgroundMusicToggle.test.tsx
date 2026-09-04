import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BackgroundMusicToggle } from "../BackgroundMusicToggle";

const music = vi.hoisted(() => ({
  enabled: false,
  state: "off",
  activeMasterId: "cloudlight-evening-loop",
  toggle: vi.fn(),
  retry: vi.fn(),
  handleMediaError: vi.fn(),
  handleMediaEnded: vi.fn(),
  handleMediaTimeUpdate: vi.fn(),
}));

const audioSettings = vi.hoisted(() => ({ muted: false, volume: 0.5 }));
const comfort = vi.hoisted(() => ({ ambientEnabled: true }));

vi.mock("../AppBackgroundMusicProvider", () => ({
  useAppBackgroundMusicControl: () => music,
}));

vi.mock("@/hooks/useAppAudioSettings", () => ({
  useAppAudioSettings: () => audioSettings,
}));

vi.mock("@/hooks/useAudioComfortSettings", () => ({
  useAudioComfortSettings: () => ({ settings: { ambientEnabled: comfort.ambientEnabled } }),
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

describe("BackgroundMusicToggle", () => {
  beforeEach(() => {
    music.enabled = false;
    music.state = "off";
    music.toggle.mockReset();
    music.retry.mockReset();
    audioSettings.muted = false;
    audioSettings.volume = 0.5;
    comfort.ambientEnabled = true;
  });

  it.each([
    ["sidebar-expanded", "min-h-[44px]"],
    ["sidebar-collapsed", "min-h-[44px]"],
    ["drawer", "min-h-[48px]"],
    ["auth", "min-h-[48px]"],
  ] as const)("renders one icon-only %s control with an accessible name", (presentation, targetClass) => {
    render(<BackgroundMusicToggle presentation={presentation} />);

    const button = screen.getByRole("button", { name: "Play evening music" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).not.toHaveAttribute("title");
    expect(button.className).toContain(targetClass);
    expect(button.querySelectorAll("svg")).toHaveLength(1);
    expect(button.querySelector(".sr-only")).toHaveTextContent("Evening music: Off");
    expect(button.querySelectorAll('[data-visible-music-copy="true"]')).toHaveLength(0);
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });

  it("uses one button to enable and disable the shared preference", () => {
    const { rerender } = render(<BackgroundMusicToggle presentation="sidebar-expanded" />);
    fireEvent.click(screen.getByRole("button", { name: "Play evening music" }));
    expect(music.toggle).toHaveBeenCalledTimes(1);

    music.enabled = true;
    music.state = "playing";
    rerender(<BackgroundMusicToggle presentation="sidebar-expanded" />);
    const button = screen.getByRole("button", { name: "Pause evening music" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button.querySelector(".sr-only")).toHaveTextContent("Evening music: On");
    fireEvent.click(button);
    expect(music.toggle).toHaveBeenCalledTimes(2);
  });

  it.each(["loading", "fading", "recovering", "blocked", "error"])(
    "keeps %s state controllable through the same single icon",
    (state) => {
      music.enabled = true;
      music.state = state;
      render(<BackgroundMusicToggle presentation="drawer" />);

      const button = screen.getByRole("button", { name: "Pause evening music" });
      if (["loading", "recovering"].includes(state)) {
        expect(button).toHaveAttribute("aria-busy", "true");
      } else {
        expect(button).not.toHaveAttribute("aria-busy");
      }
      expect(screen.queryByTestId("background-music-disable")).not.toBeInTheDocument();
      fireEvent.click(button);
      expect(music.toggle).toHaveBeenCalledTimes(1);
      expect(music.retry).not.toHaveBeenCalled();
    },
  );

  it("keeps the paused reason available to assistive technology without visible copy", () => {
    music.enabled = true;
    music.state = "paused";
    audioSettings.muted = true;
    render(<BackgroundMusicToggle presentation="auth" />);

    const button = screen.getByRole("button", { name: "Pause evening music" });
    expect(button.querySelector(".sr-only")).toHaveTextContent(
      "Evening music: Paused while app sound is off",
    );
    expect(button.querySelectorAll('[data-visible-music-copy="true"]')).toHaveLength(0);
  });
});
