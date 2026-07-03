import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import type { AppliedTheme } from "@/stores/themeStore";

const appAudioSettingsState = vi.hoisted(() => ({
  muted: false,
  volume: 1,
  feedbackSoundsEnabled: true,
  canPlayFeedback: true,
}));

import { OrbPage } from "../OrbPage";
import { useDiaryDraftStore } from "@/stores/diaryDraftStore";
import { useMoodEntryDraftStore } from "@/stores/moodEntryDraftStore";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      goodMorning: "Good morning",
      goodAfternoon: "Good afternoon",
      goodEvening: "Good evening",
      somLogFeeling: "Log how you feel",
      next: "Next",
      back: "Back",
      howAreYouFeeling: "How are you feeling?",
      journalPrompt6: "How are you feeling right now?",
      journalContinueWriting: "Continue writing",
      journalStartToday: "Start today's entry",
      navV2Orb: "Orb",
      navV2OrbSubhead: "How are you feeling?",
      orbWhisper1: "How's your heart today?",
      orbWhisper2: "What rises for you now?",
      orbWhisper3: "Speak to the orb.",
      orbWhisper4: "Breathe, then listen.",
      orbWhisper5: "What's the weather inside?",
      orbScopeGroupLabel: "When?",
      orbScopeNow: "In this moment",
      orbScopeDay: "For the whole day",
      orbScopeSpecific: "At a specific time",
      orbScopeSpecificTimeLabel: "Pick a time",
      orbSkip: "Later",
      orbFirstRunTitle: "Three steps",
      orbFirstRunStep1: "Step one",
      orbFirstRunStep2: "Step two",
      orbFirstRunStep3: "Step three",
      orbFirstRunGotIt: "Got it",
      moodGreat: "Great",
      moodGood: "Good",
      moodOkay: "Okay",
      moodBad: "Bad",
      moodTerrible: "Terrible",
      somTagHopeful: "Localized hopeful",
      orbAmbienceLabel: "Orb ambience",
      orbAmbiencePlay: "Play orb ambience",
      orbAmbiencePause: "Pause orb ambience",
      audioLoading: "Loading...",
      audioRetry: "Retry",
      settingsSoundSummaryOff: "Muted",
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

vi.mock("@/lib/haptics", () => ({
  haptics: { tabChanged: vi.fn(), light: vi.fn(), medium: vi.fn() },
  hapticSuccess: vi.fn(),
  hapticTap: vi.fn(),
  hapticSelection: vi.fn(),
  hapticMedium: vi.fn(),
}));

vi.mock("@/components/state-of-mind/ValenceOrb", () => ({
  CANONICAL_ORB_ANIMATION_SPEED: 1,
  ValenceOrb: ({
    valence,
    size,
    transitionProfile = "input-soft",
    animationSpeed = 1,
    renderer = "auto",
  }: {
    valence: number;
    size?: number;
    transitionProfile?: string;
    animationSpeed?: number;
    renderer?: string;
  }) => (
    <div
      data-testid="valence-orb"
      data-valence={valence}
      data-size={size}
      data-transition-profile={transitionProfile}
      data-animation-speed={animationSpeed}
      data-renderer={renderer}
    >
      orb
    </div>
  ),
}));

vi.mock("@/components/state-of-mind/EmotionTagGrid", () => ({
  EmotionTagGrid: ({
    valence,
    selected,
    onToggle,
    expandable,
  }: {
    valence: number;
    selected: string[];
    onToggle: (tag: string) => void;
    expandable?: boolean;
  }) => (
    <div
      data-testid="emotion-tag-grid"
      data-valence={valence}
      data-expandable={expandable ? "true" : "false"}
    >
      <button
        type="button"
        data-testid="emotion-tag-mock-hopeful"
        data-selected={selected.includes("hopeful")}
        onClick={() => onToggle("hopeful")}
      >
        hopeful
      </button>
    </div>
  ),
}));

vi.mock("@/components/state-of-mind/ValenceSlider", () => ({
  ValenceSlider: ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <div data-testid="mood-orb-picker" data-value={value ?? ""}>
      <button type="button" data-testid="mood-orb-option-good" onClick={() => onChange(0.5)}>
        good slider
      </button>
      <button type="button" data-testid="mood-orb-option-bad" onClick={() => onChange(-0.5)}>
        bad slider
      </button>
    </div>
  ),
}));

vi.mock("../CosmicBgAdapter", () => ({
  CosmicBgAdapter: ({ variant }: { variant?: string }) => (
    <div data-testid="cosmic-orb-background" data-variant={variant ?? "auto"}>
      cosmic
    </div>
  ),
}));

vi.mock("../ShootingStar", () => ({
  ShootingStar: () => <div data-testid="shooting-star-stub" />,
}));

vi.mock("../useCosmicParallax", () => ({
  useCosmicParallax: () => ({ current: null }),
}));

const setActivePageMock = vi.fn();
vi.mock("@/hooks/useNavigationV2", () => ({
  useNavigationV2: () => ({
    activePage: "orb",
    setActivePage: setActivePageMock,
    sidebarCollapsed: false,
    toggleSidebar: vi.fn(),
    drawerOpen: false,
    openDrawer: vi.fn(),
    closeDrawer: vi.fn(),
    handleBackButton: vi.fn(),
    commandPaletteOpen: false,
    setCommandPaletteOpen: vi.fn(),
  }),
}));

const setMoodsSpy = vi.fn();
const onAddMoodMock = vi.fn();
let mockMoods: Array<Record<string, unknown>> = [];
let moodsSnapshot = { moods: mockMoods, userName: "Yehor", setMoods: setMoodsSpy };
function rebuildMoodsSnapshot() {
  moodsSnapshot = { moods: mockMoods, userName: "Yehor", setMoods: setMoodsSpy };
}
function setViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: height,
  });
  window.dispatchEvent(new Event("resize"));
}

vi.mock("@/stores", () => ({
  useUserDataStore: (selector: (s: unknown) => unknown) => selector(moodsSnapshot),
}));

const media = vi.hoisted(() => ({
  play: vi.fn(() => Promise.resolve()),
  pause: vi.fn(),
}));

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

const themeState = vi.hoisted<{ appliedTheme: AppliedTheme }>(() => ({
  appliedTheme: "ink",
}));
const mockUseShouldAnimate = vi.hoisted(() =>
  vi.fn((_options?: { respectRuntimePerformance?: boolean }) => true)
);

vi.mock("@/stores/themeStore", () => ({
  useThemeStore: (selector: (s: unknown) => unknown) => selector(themeState),
}));

vi.mock("@/hooks/useShouldAnimate", () => ({
  useShouldAnimate: (options?: { respectRuntimePerformance?: boolean }) =>
    mockUseShouldAnimate(options),
}));

vi.mock("@/lib/motion", () => ({
  Bloom: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("OrbPage progressive flow", () => {
  beforeEach(() => {
    appAudioSettingsState.muted = false;
    appAudioSettingsState.volume = 1;
    appAudioSettingsState.feedbackSoundsEnabled = true;
    appAudioSettingsState.canPlayFeedback = true;
    setMoodsSpy.mockClear();
    onAddMoodMock.mockClear();
    setActivePageMock.mockClear();
    themeState.appliedTheme = "ink";
    mockUseShouldAnimate.mockReset();
    mockUseShouldAnimate.mockReturnValue(true);
    mockMoods = [];
    rebuildMoodsSnapshot();
    setViewport(1024, 900);
    useMoodEntryDraftStore.getState().reset();
    useDiaryDraftStore.getState().clearPendingMoodContext();
    window.localStorage.setItem("zenflow-orb-first-run-dismissed", "1");
    media.play.mockClear();
    media.pause.mockClear();
    Object.defineProperty(window.HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: media.play,
    });
    Object.defineProperty(window.HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: media.pause,
    });
  });

  it("renders the page landmark and V2 shell chrome", () => {
    render(<OrbPage onAddMood={onAddMoodMock} />);
    expect(screen.getByTestId("orb-page")).toHaveAttribute("role", "main");
    expect(screen.getByTestId("orb-page")).toHaveAttribute("aria-labelledby", "orb-page-heading");
    expect(screen.getByTestId("orb-page")).toHaveClass("orb-cosmic-scope");
    expect(screen.queryByTestId("cinematic-heading")).not.toBeInTheDocument();
    expect(document.getElementById("orb-page-heading")).toHaveClass("sr-only");
    expect(screen.getByTestId("cosmic-orb-background")).toHaveAttribute("data-variant", "auto");
    expect(screen.getByTestId("orb-page-select")).toBeInTheDocument();
  });

  it("does not let runtime-performance CSS suppress the V2 orb surface", () => {
    const css = readFileSync("src/pages/nav-v2/CosmicBgAdapter.css", "utf8");

    expect(css).not.toContain(":root[data-runtime-perf] .orb-cosmic-scope .orb-page-rim-glow");
    expect(css).not.toContain("orb-night-rim-orbit");
  });

  it("clips horizontal overflow inside the orb step scrollers", () => {
    render(<OrbPage onAddMood={onAddMoodMock} />);

    const selectScroller = screen.getByTestId("orb-page-select").closest(".overflow-y-auto");

    expect(selectScroller).toHaveClass("overflow-x-hidden");

    fireEvent.click(screen.getByTestId("orb-page-next"));

    const refineScroller = screen.getByTestId("orb-page-refine").closest(".overflow-y-auto");

    expect(refineScroller).toHaveClass("overflow-x-hidden");
  });

  it("constrains scope controls so translated labels cannot create horizontal scrollbars", () => {
    const scopeCss = readFileSync("src/pages/nav-v2/MoodScopeSelector.css", "utf8");

    expect(scopeCss).toContain(".mood-scope-chip-row");
    expect(scopeCss).toContain("max-width: 100%");
    expect(scopeCss).toContain("overflow-x: clip");
    expect(scopeCss).toContain(".mood-scope-time-reveal");
  });

  it("uses the day flourish instead of the shooting star in paper theme", () => {
    themeState.appliedTheme = "paper";

    render(<OrbPage onAddMood={onAddMoodMock} />);

    expect(screen.getByTestId("orb-day-flourish")).toBeInTheDocument();
    expect(screen.queryByTestId("shooting-star-stub")).toBeNull();
  });

  it("keeps orb ambience outside the animated Bloom subtree while preserving forward keyboard order", () => {
    const source = readFileSync("src/pages/nav-v2/OrbPage.tsx", "utf8");
    const ambienceIndex = source.indexOf("<OrbAmbienceControl");
    const bloomIndex = source.indexOf("<Bloom");
    const bloomCloseIndex = source.indexOf("</Bloom>");

    expect(ambienceIndex).toBeGreaterThan(-1);
    expect(bloomIndex).toBeGreaterThan(-1);
    expect(bloomCloseIndex).toBeGreaterThan(bloomIndex);
    expect(ambienceIndex).toBeGreaterThan(bloomCloseIndex);
  });

  it("offers gentle water ambience as user-started orb audio without changing the canonical orb", async () => {
    render(<OrbPage onAddMood={onAddMoodMock} />);

    const audio = screen.getByTestId("orb-page-ambience-audio");
    expect(audio).toHaveAttribute("src", expect.stringContaining("/sounds/gentle-water-bed.mp3"));
    expect(audio).toHaveAttribute("preload", "none");
    expect(audio).toHaveAttribute("loop");
    expect(audio).not.toHaveAttribute("autoplay");
    expect(media.play).not.toHaveBeenCalled();

    expect(screen.getByTestId("valence-orb")).toHaveAttribute("data-renderer", "webgpu");

    const toggle = screen.getByTestId("orb-page-ambience-toggle");
    expect(toggle).toHaveAttribute("type", "button");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveAccessibleName("Play orb ambience");

    fireEvent.click(toggle);
    expect(media.play).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "true"));

    fireEvent.click(toggle);
    expect(media.pause).toHaveBeenCalled();
    await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "false"));
  });

  it("keeps orb ambience off until the browser confirms playback", async () => {
    const playback = createDeferred();
    media.play.mockReturnValueOnce(playback.promise);

    render(<OrbPage onAddMood={onAddMoodMock} />);

    const toggle = screen.getByTestId("orb-page-ambience-toggle");
    fireEvent.click(toggle);

    expect(media.play).toHaveBeenCalledTimes(1);
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveAccessibleName("Orb ambience Loading...");

    playback.resolve();
    await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "true"));
    expect(toggle).toHaveAccessibleName("Pause orb ambience");
  });

  it("reveals the hidden orb ambience control on focus instead of trapping users invisibly", () => {
    render(<OrbPage onAddMood={onAddMoodMock} />);

    const toggle = screen.getByTestId("orb-page-ambience-toggle");
    const chrome = toggle.parentElement;

    const css = readFileSync("src/pages/nav-v2/OrbAmbienceControl.css", "utf8");

    expect(chrome?.className).toContain("orb-ambience-focus-control");
    expect(css).toContain(".orb-ambience-focus-control:focus-within");
    expect(css).toContain("clip-path: inset(50%)");
    expect(css).toContain("clip-path: none");
    expect(toggle).not.toHaveAttribute("tabindex", "-1");
  });

  it("does not start orb ambience while app sound is muted", () => {
    appAudioSettingsState.muted = true;

    render(<OrbPage onAddMood={onAddMoodMock} />);

    const toggle = screen.getByTestId("orb-page-ambience-toggle");
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveAccessibleName("Muted");
    expect(toggle).toHaveTextContent("Muted");

    fireEvent.click(toggle);

    expect(media.play).not.toHaveBeenCalled();
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps orb ambience retryable when the browser blocks the first play", async () => {
    media.play.mockRejectedValueOnce(new Error("Audio blocked"));
    media.play.mockResolvedValueOnce(undefined);

    render(<OrbPage onAddMood={onAddMoodMock} />);

    const toggle = screen.getByTestId("orb-page-ambience-toggle");
    fireEvent.click(toggle);

    await waitFor(() => expect(toggle).toHaveAccessibleName("Retry"));
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(toggle);

    expect(media.play).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "true"));
  });

  it("stops orb ambience on hidden and pagehide lifecycle events", async () => {
    const hiddenDescriptor = Object.getOwnPropertyDescriptor(document, "hidden");
    try {
      render(<OrbPage onAddMood={onAddMoodMock} />);
      const toggle = screen.getByTestId("orb-page-ambience-toggle");

      fireEvent.click(toggle);
      await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "true"));
      media.pause.mockClear();

      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));

      expect(media.pause).toHaveBeenCalled();
      await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "false"));

      Object.defineProperty(document, "hidden", { configurable: true, value: false });
      fireEvent.click(toggle);
      await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "true"));
      media.pause.mockClear();

      window.dispatchEvent(new Event("pagehide"));

      expect(media.pause).toHaveBeenCalled();
      await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "false"));
    } finally {
      if (hiddenDescriptor) {
        Object.defineProperty(document, "hidden", hiddenDescriptor);
      } else {
        Reflect.deleteProperty(document, "hidden");
      }
    }
  });

  it("stops orb ambience when the orb route unmounts", async () => {
    const { unmount } = render(<OrbPage onAddMood={onAddMoodMock} />);

    fireEvent.click(screen.getByTestId("orb-page-ambience-toggle"));
    await waitFor(() =>
      expect(screen.getByTestId("orb-page-ambience-toggle")).toHaveAttribute("aria-pressed", "true")
    );

    media.pause.mockClear();
    unmount();

    expect(media.pause).toHaveBeenCalled();
  });

  it("allows Next from the neutral center on first render", () => {
    render(<OrbPage onAddMood={onAddMoodMock} />);
    const next = screen.getByTestId("orb-page-next");
    expect(next).not.toBeDisabled();

    fireEvent.click(next);

    expect(screen.getByTestId("orb-page-refine")).toBeInTheDocument();
    expect(useMoodEntryDraftStore.getState().valence).toBe(0);
  });

  it("keeps the V1 neutral orb baseline before the user moves the slider", () => {
    setViewport(399, 869);
    mockMoods = [{ id: "previous", date: "2026-04-30", valence: -1 }];
    rebuildMoodsSnapshot();

    render(<OrbPage onAddMood={onAddMoodMock} />);

    expect(screen.getByTestId("valence-orb")).toHaveAttribute("data-valence", "-0.143");
    expect(screen.getByTestId("mood-orb-picker")).toHaveAttribute("data-value", "0");
    expect(screen.getByTestId("valence-orb")).toHaveAttribute("data-size", "280");
    expect(screen.getByTestId("valence-orb")).toHaveAttribute(
      "data-transition-profile",
      "input-soft"
    );
    expect(screen.getByTestId("valence-orb")).toHaveAttribute("data-animation-speed", "1");
    expect(screen.getByTestId("valence-orb")).toHaveAttribute("data-renderer", "webgpu");
    expect(screen.queryByTestId("orb-aura")).not.toBeInTheDocument();
  });

  it("keeps neutral semantics but avoids the committed neutral orb before first choice", () => {
    render(<OrbPage onAddMood={onAddMoodMock} />);

    expect(screen.getByTestId("valence-orb")).toHaveAttribute("data-valence", "-0.143");
    expect(screen.getByTestId("mood-orb-picker")).toHaveAttribute("data-value", "0");
  });

  it("keeps desktop and phone on the same restored full-speed canonical orb motion", () => {
    setViewport(1024, 900);

    render(<OrbPage onAddMood={onAddMoodMock} />);

    expect(screen.queryByTestId("orb-aura")).not.toBeInTheDocument();
    expect(screen.getByTestId("valence-orb")).toHaveAttribute("data-animation-speed", "1");
    expect(screen.getByTestId("valence-orb")).toHaveAttribute("data-renderer", "webgpu");
  });

  it("keeps the Orb ambience control on the logical end edge for RTL-safe top chrome", () => {
    render(<OrbPage onAddMood={onAddMoodMock} />);

    const chrome = screen.getByTestId("orb-page-ambience-toggle").parentElement;
    const css = readFileSync("src/pages/nav-v2/OrbAmbienceControl.css", "utf8");

    expect(chrome?.className).toContain("orb-ambience-focus-control");
    expect(css).toContain("inset-inline-end");
    expect(css).toContain("var(--safe-right)");
    expect(css).toContain("var(--safe-left)");
    expect(css).not.toContain("right:");
  });

  it("keeps the desktop ambient orb breathing alive during runtime performance startup", () => {
    mockUseShouldAnimate.mockImplementation(
      (options?: { respectRuntimePerformance?: boolean }) =>
        options?.respectRuntimePerformance === false
    );
    setViewport(1098, 768);

    render(<OrbPage onAddMood={onAddMoodMock} />);

    expect(screen.getByTestId("orb-page-rim-glow")).toHaveAttribute("data-orb-breathing", "true");
    expect(screen.queryByTestId("shooting-star-stub")).toBeNull();
    expect(mockUseShouldAnimate).toHaveBeenCalledWith({
      respectRuntimePerformance: false,
    });
  });

  it("requires a time before leaving the select step when scope is specific", () => {
    render(<OrbPage onAddMood={onAddMoodMock} />);

    fireEvent.click(screen.getByTestId("mood-scope-chip-specific"));
    expect(screen.getByTestId("orb-page-next")).toBeDisabled();

    fireEvent.change(screen.getByTestId("mood-scope-time-input"), {
      target: { value: "14:30" },
    });
    expect(screen.getByTestId("orb-page-next")).not.toBeDisabled();
  });

  it("shows refine step with precise feelings and preserves note + emotion when going back", () => {
    render(<OrbPage onAddMood={onAddMoodMock} />);

    fireEvent.click(screen.getByTestId("mood-orb-option-good"));
    fireEvent.click(screen.getByTestId("orb-page-next"));

    expect(screen.getByTestId("emotion-tag-grid")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("emotion-tag-mock-hopeful"));
    expect(screen.getByTestId("orb-page-refine-heading")).toHaveTextContent("Localized hopeful");
    fireEvent.change(screen.getByTestId("orb-page-note-input"), {
      target: { value: "A little more grounded now." },
    });

    fireEvent.click(screen.getByTestId("orb-page-back"));
    expect(screen.getByTestId("orb-page-select")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("orb-page-next"));
    expect(screen.getByTestId("emotion-tag-mock-hopeful")).toHaveAttribute("data-selected", "true");
    expect(screen.getByTestId("orb-page-note-input")).toHaveValue("A little more grounded now.");
  });

  it("preserves the in-progress orb mood when the Orb tab unmounts during V2 navigation", () => {
    const { unmount } = render(<OrbPage onAddMood={onAddMoodMock} />);

    fireEvent.click(screen.getByTestId("mood-orb-option-good"));
    expect(screen.getByTestId("valence-orb")).toHaveAttribute("data-valence", "0.5");

    unmount();
    render(<OrbPage onAddMood={onAddMoodMock} />);

    expect(screen.getByTestId("valence-orb")).toHaveAttribute("data-valence", "0.5");
    expect(screen.getByTestId("mood-orb-picker")).toHaveAttribute("data-value", "0.5");
  });

  it("opens Diary with a valid handoff even when no exact feeling is chosen", () => {
    const navigateToPage = vi.fn();
    render(<OrbPage navigateToPage={navigateToPage} onAddMood={onAddMoodMock} />);

    fireEvent.click(screen.getByTestId("orb-page-next"));
    fireEvent.click(screen.getByTestId("orb-page-open-diary"));

    expect(navigateToPage).toHaveBeenCalledWith("diary");
    expect(setActivePageMock).not.toHaveBeenCalled();
    expect(onAddMoodMock).toHaveBeenCalledTimes(1);
    expect(setMoodsSpy).not.toHaveBeenCalled();
    expect(useDiaryDraftStore.getState().pendingMoodContext).toMatchObject({
      valence: 0,
      mood: "okay",
      scope: "now",
      specificTime: null,
      emotion: null,
      note: null,
    });
  });

  it("includes exact feeling and note in the pending Diary context when provided", () => {
    render(<OrbPage onAddMood={onAddMoodMock} />);

    fireEvent.click(screen.getByTestId("mood-orb-option-good"));
    fireEvent.click(screen.getByTestId("orb-page-next"));
    expect(screen.getByTestId("orb-page-refine")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("emotion-tag-mock-hopeful"));
    fireEvent.change(screen.getByTestId("orb-page-note-input"), {
      target: { value: "I want to remember this calm shift." },
    });
    fireEvent.click(screen.getByTestId("orb-page-open-diary"));

    expect(onAddMoodMock).toHaveBeenCalledTimes(1);
    expect(useDiaryDraftStore.getState().pendingMoodContext).toMatchObject({
      valence: 0.5,
      mood: "good",
      scope: "now",
      emotion: "hopeful",
      note: "I want to remember this calm shift.",
    });
  });

  it("prefers the orchestrator navigation callback for the final Diary transfer", () => {
    const navigateToPage = vi.fn();
    render(<OrbPage navigateToPage={navigateToPage} onAddMood={onAddMoodMock} />);

    fireEvent.click(screen.getByTestId("orb-page-next"));
    fireEvent.click(screen.getByTestId("orb-page-open-diary"));

    expect(navigateToPage).toHaveBeenCalledWith("diary");
    expect(setActivePageMock).not.toHaveBeenCalled();
    expect(onAddMoodMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the mood flow owned by the V2 orchestrator instead of creating a second navigator", () => {
    const source = readFileSync("src/pages/nav-v2/useOrbMoodFlow.ts", "utf8");

    expect(source).not.toContain("import { useNavigationV2 }");
    expect(source).not.toContain("useNavigationV2()");
  });
});
