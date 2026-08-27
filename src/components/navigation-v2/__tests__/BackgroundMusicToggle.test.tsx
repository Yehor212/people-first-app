import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BackgroundMusicToggle } from "../BackgroundMusicToggle";

const music = vi.hoisted(() => ({
  enabled: false,
  state: "off",
  toggle: vi.fn(),
  retry: vi.fn(),
  handleMediaError: vi.fn(),
}));

const audioSettings = vi.hoisted(() => ({
  muted: false,
  volume: 0.5,
}));

const comfort = vi.hoisted(() => ({
  ambientEnabled: true,
}));

vi.mock("../AppBackgroundMusicProvider", () => ({
  useAppBackgroundMusicControl: () => music,
}));

vi.mock("@/hooks/useAppAudioSettings", () => ({
  useAppAudioSettings: () => audioSettings,
}));

vi.mock("@/hooks/useAudioComfortSettings", () => ({
  useAudioComfortSettings: () => ({
    settings: { ambientEnabled: comfort.ambientEnabled },
  }),
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

  it("renders a native expanded button with visible off state and no volume slider", () => {
    render(<BackgroundMusicToggle presentation="sidebar-expanded" />);

    const button = screen.getByRole("button", { name: "Play evening music" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button.className).toContain("min-h-[44px]");
    expect(button).toHaveTextContent("Evening music");
    expect(button).toHaveTextContent("Off");
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();

    fireEvent.click(button, { detail: 0 });
    expect(music.toggle).toHaveBeenCalledTimes(1);
  });

  it("shows the playing state and exposes the pause action", () => {
    music.enabled = true;
    music.state = "playing";
    render(<BackgroundMusicToggle presentation="sidebar-expanded" />);

    const button = screen.getByRole("button", { name: "Pause evening music" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveTextContent("On");
  });

  it("keeps loading cancellable through the preference toggle", () => {
    music.enabled = true;
    music.state = "loading";
    render(<BackgroundMusicToggle presentation="sidebar-expanded" />);

    const button = screen.getByRole("button", { name: "Pause evening music" });
    expect(button).toHaveTextContent("Loading");
    fireEvent.click(button);
    expect(music.toggle).toHaveBeenCalledTimes(1);
    expect(music.retry).not.toHaveBeenCalled();
  });

  it.each([
    ["blocked", "Tap to resume"],
    ["error", "Unavailable"],
  ])("offers an explicit retry for %s state", (state, visibleStatus) => {
    music.enabled = true;
    music.state = state;
    render(<BackgroundMusicToggle presentation="sidebar-expanded" />);

    const button = screen.getByRole("button", { name: "Play evening music" });
    expect(button).toHaveTextContent(visibleStatus);
    fireEvent.click(button);
    expect(music.retry).toHaveBeenCalledTimes(1);
    expect(music.toggle).not.toHaveBeenCalled();
  });

  it("explains the master-audio gate without changing broader audio settings", () => {
    music.enabled = true;
    music.state = "paused";
    audioSettings.muted = true;
    render(<BackgroundMusicToggle presentation="sidebar-expanded" />);

    expect(screen.getByRole("button")).toHaveTextContent("Paused while app sound is off");
    fireEvent.click(screen.getByRole("button"));
    expect(music.toggle).toHaveBeenCalledTimes(1);
  });

  it("explains the ambient-comfort gate", () => {
    music.enabled = true;
    music.state = "paused";
    comfort.ambientEnabled = false;
    render(<BackgroundMusicToggle presentation="sidebar-expanded" />);

    expect(screen.getByRole("button")).toHaveTextContent(
      "Paused while background sounds are off",
    );
  });

  it("keeps a localized tooltip in collapsed rail mode", () => {
    render(<BackgroundMusicToggle presentation="sidebar-collapsed" />);

    const button = screen.getByRole("button", { name: "Play evening music" });
    expect(button).toHaveAttribute("title", "Evening music");
    expect(button.className).toContain("min-h-[44px]");
  });

  it("uses a 48px phone target in the drawer presentation", () => {
    render(<BackgroundMusicToggle presentation="drawer" />);

    expect(screen.getByRole("button").className).toContain("min-h-[48px]");
  });
});
