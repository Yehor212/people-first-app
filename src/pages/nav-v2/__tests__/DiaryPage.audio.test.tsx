import { render, screen } from "@testing-library/react";
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

  it("keeps the soft rain reflection loop non-autoplaying without a page-level overlay control", () => {
    render(<DiaryPage />);

    const audio = screen.getByTestId("diary-page-ambience-audio");
    expect(audio).toHaveAttribute(
      "src",
      expect.stringContaining("/sounds/soft-rain-veil.mp3"),
    );
    expect(audio).toHaveAttribute("preload", "none");
    expect(audio).toHaveAttribute("loop");
    expect(audio).not.toHaveAttribute("autoplay");
    expect(media.play).not.toHaveBeenCalled();

    expect(screen.queryByTestId("diary-page-ambience-control")).toBeNull();
    expect(screen.queryByTestId("diary-page-ambience-toggle")).toBeNull();
  });

  it("keeps the diary surface free from ambience controls even while app sound is muted", () => {
    appAudioSettingsState.muted = true;

    render(<DiaryPage />);

    expect(media.play).not.toHaveBeenCalled();
    expect(screen.queryByTestId("diary-page-ambience-control")).toBeNull();
    expect(screen.queryByTestId("diary-page-ambience-toggle")).toBeNull();
  });

});
