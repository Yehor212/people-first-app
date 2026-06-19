import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const appAudioSettingsState = vi.hoisted(() => ({
  muted: false,
  volume: 1,
  feedbackSoundsEnabled: true,
  canPlayFeedback: true,
}));
const loggerWarn = vi.hoisted(() => vi.fn());

import { DiaryPage } from "../DiaryPage";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      diary: "Diary",
      navV2Diary: "Diary",
      initializingApp: "Preparing your zen space...",
      diaryAmbienceLabel: "Diary ambience",
      diaryAmbiencePlay: "Play diary ambience",
      diaryAmbiencePause: "Pause diary ambience",
      audioRetry: "Retry",
      soundOn: "On",
      soundOff: "Off",
    },
    language: "en",
    isRTL: false,
  }),
}));

vi.mock("@/hooks/useAppAudioSettings", () => ({
  useAppAudioSettings: () => appAudioSettingsState,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: loggerWarn,
  },
}));

vi.mock("@/components/SplashScreen", () => ({
  SplashScreen: () => <div data-testid="splash-screen-stub" />,
}));

vi.mock("@/stores/themeStore", () => ({
  useThemeStore: (selector: (s: unknown) => unknown) =>
    selector({ appliedTheme: "ink" }),
}));

vi.mock("@/features/journal/JournalModule", () => ({
  JournalModule: () => <section data-testid="journal-module-stub">Journal</section>,
}));

const media = vi.hoisted(() => ({
  play: vi.fn(() => Promise.resolve()),
  pause: vi.fn(),
}));

describe("DiaryPage ambience audio", () => {
  beforeEach(() => {
    appAudioSettingsState.muted = false;
    appAudioSettingsState.volume = 1;
    appAudioSettingsState.feedbackSoundsEnabled = true;
    appAudioSettingsState.canPlayFeedback = true;
    media.play.mockReset();
    media.play.mockResolvedValue(undefined);
    media.pause.mockClear();
    loggerWarn.mockClear();
    Object.defineProperty(window.HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: media.play,
    });
    Object.defineProperty(window.HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: media.pause,
    });
  });

  it("offers the Gemini reflection loop as user-started diary ambience", async () => {
    render(<DiaryPage />);

    const audio = screen.getByTestId("diary-page-ambience-audio");
    expect(audio).toHaveAttribute(
      "src",
      expect.stringContaining("/sounds/v2-diary-reflection-loop.mp3"),
    );
    expect(audio).toHaveAttribute("preload", "none");
    expect(audio).toHaveAttribute("loop");
    expect(audio).not.toHaveAttribute("autoplay");
    expect(media.play).not.toHaveBeenCalled();

    const toggle = screen.getByTestId("diary-page-ambience-toggle");
    expect(toggle).toHaveAttribute("type", "button");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveAccessibleName("Play diary ambience");

    fireEvent.click(toggle);
    expect(media.play).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "true"));

    fireEvent.click(toggle);
    expect(media.pause).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "false"));
  });

  it("keeps the ambience control away from the iOS diary header actions", () => {
    render(<DiaryPage />);

    const control = screen.getByTestId("diary-page-ambience-control");
    const toggle = screen.getByTestId("diary-page-ambience-toggle");

    expect(control.className).toContain("bottom-[calc(5.35rem+var(--safe-bottom))]");
    expect(control.className).toContain("start-4");
    expect(control.className).toContain("md:top-[calc(var(--safe-top)+1rem)]");
    expect(toggle.className).toContain("pointer-events-auto");
  });

  it("does not start diary ambience while app sound is muted", () => {
    appAudioSettingsState.muted = true;

    render(<DiaryPage />);

    const toggle = screen.getByTestId("diary-page-ambience-toggle");
    expect(toggle).toBeDisabled();

    fireEvent.click(toggle);

    expect(media.play).not.toHaveBeenCalled();
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps diary ambience retryable when the browser blocks first play", async () => {
    media.play.mockRejectedValueOnce(new Error("Audio blocked"));
    media.play.mockResolvedValueOnce(undefined);

    render(<DiaryPage />);

    const toggle = screen.getByTestId("diary-page-ambience-toggle");
    fireEvent.click(toggle);

    await waitFor(() => expect(toggle).toHaveAccessibleName("Retry"));
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(loggerWarn).toHaveBeenCalledWith(
      "[DiaryPage]",
      "Diary ambience playback failed:",
      expect.any(Error),
    );

    fireEvent.click(toggle);

    expect(media.play).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "true"));
  });

  it("stops diary ambience when the diary route unmounts", async () => {
    const { unmount } = render(<DiaryPage />);

    fireEvent.click(screen.getByTestId("diary-page-ambience-toggle"));
    await waitFor(() =>
      expect(screen.getByTestId("diary-page-ambience-toggle")).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );

    media.pause.mockClear();
    unmount();

    expect(media.pause).toHaveBeenCalledTimes(1);
  });

  it("pauses diary ambience when iOS WebView backgrounds the page", async () => {
    render(<DiaryPage />);

    const toggle = screen.getByTestId("diary-page-ambience-toggle");
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "true"));

    media.pause.mockClear();
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(media.pause).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "false"));
  });
});
