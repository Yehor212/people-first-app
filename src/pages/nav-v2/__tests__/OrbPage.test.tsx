import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import type { AppliedTheme } from "@/stores/themeStore";

const appAudioSettingsState = vi.hoisted(() => ({
  muted: false,
  volume: 1,
  feedbackSoundsEnabled: true,
  canPlayFeedback: true,
}));

const orbVisualControl = vi.hoisted(() => ({
  mode: "auto",
  readyCallbacks: [] as Array<() => void>,
  errorCallbacks: [] as Array<() => void>,
}));

const androidBackControl = vi.hoisted(() => ({
  callback: null as null | (() => boolean),
}));
const moodPersistenceMocks = vi.hoisted(() => ({
  persistMoodEntry: vi.fn(() => Promise.resolve()),
}));

const platformControl = vi.hoisted(() => ({
  isAndroid: false,
}));

import { OrbPage } from "../OrbPage";
import { useDiaryDraftStore } from "@/stores/diaryDraftStore";
import { useMoodEntryDraftStore } from "@/stores/moodEntryDraftStore";

vi.mock("@/storage/repositories/moodsRepo", () => ({
  persistMoodEntryBeforeTransition: moodPersistenceMocks.persistMoodEntry,
}));

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
      saveMood: "Save mood",
      orbSaveMoodAndStartEntry: "Save mood and start today's entry",
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
      loading: "Loading",
      initializingApp: "Preparing ZenFlow",
      initializationError: "Initialization Error",
      orbPreparationError: "We couldn't open your mood check-in. Try again.",
      tryAgain: "Try again",
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

vi.mock("@/lib/androidBackHandler", () => ({
  registerModalCloseCallback: (callback: () => boolean) => {
    androidBackControl.callback = callback;
    return () => {
      if (androidBackControl.callback === callback) androidBackControl.callback = null;
    };
  },
}));

vi.mock("@/lib/platform", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/platform")>();
  return {
    ...actual,
    get isAndroid() {
      return platformControl.isAndroid;
    },
  };
});

vi.mock("@/components/state-of-mind/ValenceOrb", async () => {
  const { useEffect } = await import("react");
  return {
    CANONICAL_ORB_ANIMATION_SPEED: 1,
    ValenceOrb: ({
      valence,
      size,
      transitionProfile = "input-soft",
      animationSpeed = 1,
      renderer = "auto",
      onVisualReady,
      onVisualError,
    }: {
      valence: number;
      size?: number;
      transitionProfile?: string;
      animationSpeed?: number;
      renderer?: string;
      onVisualReady?: () => void;
      onVisualError?: () => void;
    }) => {
      useEffect(() => {
        if (onVisualReady) orbVisualControl.readyCallbacks.push(onVisualReady);
        if (onVisualError) orbVisualControl.errorCallbacks.push(onVisualError);
        if (orbVisualControl.mode === "auto") onVisualReady?.();
        if (orbVisualControl.mode === "error") onVisualError?.();
      }, [onVisualError, onVisualReady, size]);

      return (
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
      );
    },
  };
});

vi.mock("@/components/SplashScreen", () => ({
  SplashScreen: ({ subtitle }: { subtitle: string }) => (
    <div data-testid="orb-cold-loading-screen">{subtitle}</div>
  ),
}));

vi.mock("@/components/PremiumLoader", () => ({
  PremiumLoader: ({ label }: { label?: string }) => (
    <div role="status" data-testid="orb-warm-loading-indicator" aria-label={label} />
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

function installManualRaf() {
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = nextId++;
    callbacks.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => callbacks.delete(id));

  return {
    pendingCount: () => callbacks.size,
    flushNext: () => {
      const next = callbacks.entries().next().value;
      if (!next) return;
      callbacks.delete(next[0]);
      next[1](performance.now());
    },
  };
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
  Bloom: ({
    children,
    disabled,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
  }) => (
    <div
      data-testid="orb-page-bloom"
      data-page-entrance-disabled={disabled ? "true" : "false"}
    >
      {children}
    </div>
  ),
  bloom: {
    exit: { scale: 0.96, opacity: 0, y: 8 },
    transition: { duration: 0.32, ease: [0.2, 0.9, 0.2, 1] },
  },
  bloomStatic: {
    exit: { scale: 1, opacity: 0, y: 0 },
    transition: { duration: 0 },
  },
  easings: {
    standardAccelerate: [0.3, 0, 1, 1] as const,
  },
}));

describe("OrbPage progressive flow", () => {
  beforeEach(() => {
    appAudioSettingsState.muted = false;
    appAudioSettingsState.volume = 1;
    appAudioSettingsState.feedbackSoundsEnabled = true;
    appAudioSettingsState.canPlayFeedback = true;
    setMoodsSpy.mockClear();
    onAddMoodMock.mockClear();
    moodPersistenceMocks.persistMoodEntry.mockReset();
    moodPersistenceMocks.persistMoodEntry.mockResolvedValue(undefined);
    setActivePageMock.mockClear();
    themeState.appliedTheme = "ink";
    mockUseShouldAnimate.mockReset();
    mockUseShouldAnimate.mockReturnValue(true);
    orbVisualControl.mode = "auto";
    orbVisualControl.readyCallbacks = [];
    orbVisualControl.errorCallbacks = [];
    androidBackControl.callback = null;
    platformControl.isAndroid = false;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    window.history.replaceState({ navV2Page: "orb" }, "", window.location.href);
    mockMoods = [];
    rebuildMoodsSnapshot();
    setViewport(1024, 900);
    useMoodEntryDraftStore.getState().reset();
    useDiaryDraftStore.getState().clearPendingMoodContext();
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

  it("starts the canonical page Bloom settled so route changes do not add a second entrance", () => {
    const source = readFileSync("src/pages/nav-v2/OrbPage.tsx", "utf8");

    expect(source).toContain(
      '<Bloom key="orb-page" initial={false} transition={staggerDelay("primary")}>',
    );
  });

  it("keeps a cold orb route inert until a real orb frame survives the next paint", async () => {
    orbVisualControl.mode = "manual";
    window.history.replaceState({}, "", window.location.href);
    const raf = installManualRaf();

    render(<OrbPage onAddMood={onAddMoodMock} />);

    const main = screen.getByTestId("orb-page");
    expect(screen.getByTestId("orb-cold-loading-screen")).toBeInTheDocument();
    expect(main).toHaveAttribute("aria-hidden", "true");
    expect(main).toHaveAttribute("inert");
    expect(screen.queryByTestId("orb-page-ambience-toggle")).toBeNull();
    expect(document.activeElement).not.toBe(main);

    act(() => orbVisualControl.readyCallbacks[0]?.());
    expect(main).toHaveAttribute("data-orb-visual-status", "pending");
    expect(raf.pendingCount()).toBe(1);

    act(() => raf.flushNext());
    await waitFor(() => expect(main).toHaveAttribute("data-orb-visual-status", "ready"));
    expect(screen.queryByTestId("orb-cold-loading-screen")).toBeNull();
    expect(main).not.toHaveAttribute("aria-hidden");
    expect(main).not.toHaveAttribute("inert");
    expect(screen.getByTestId("orb-page-ambience-toggle")).toBeInTheDocument();
    expect(document.activeElement).toBe(main);
  });

  it("requires a fresh renderer frame after a responsive orb resize", async () => {
    orbVisualControl.mode = "manual";
    const raf = installManualRaf();

    render(<OrbPage onAddMood={onAddMoodMock} />);
    const main = screen.getByTestId("orb-page");
    const firstReady = orbVisualControl.readyCallbacks[0];

    act(() => firstReady?.());
    act(() => raf.flushNext());
    await waitFor(() => expect(main).toHaveAttribute("data-orb-visual-status", "ready"));

    act(() => setViewport(1024, 760));

    await waitFor(() => {
      expect(screen.getByTestId("valence-orb")).toHaveAttribute("data-size", "260");
      expect(main).toHaveAttribute("data-orb-visual-status", "pending");
      expect(orbVisualControl.readyCallbacks.length).toBeGreaterThanOrEqual(2);
    });

    act(() => firstReady?.());
    expect(raf.pendingCount()).toBe(0);
    expect(main).toHaveAttribute("data-orb-visual-status", "pending");

    act(() => orbVisualControl.readyCallbacks.at(-1)?.());
    expect(raf.pendingCount()).toBe(1);
    act(() => raf.flushNext());
    await waitFor(() => expect(main).toHaveAttribute("data-orb-visual-status", "ready"));
  });

  it("coalesces transient Android resume heights before remounting the orb renderer", async () => {
    vi.useFakeTimers();
    platformControl.isAndroid = true;
    setViewport(412, 839);

    try {
      render(<OrbPage onAddMood={onAddMoodMock} />);

      expect(screen.getByTestId("valence-orb")).toHaveAttribute("data-size", "268");
      expect(orbVisualControl.readyCallbacks).toHaveLength(1);

      act(() => setViewport(412, 915));
      act(() => setViewport(412, 839));
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(screen.getByTestId("valence-orb")).toHaveAttribute("data-size", "268");
      expect(orbVisualControl.readyCallbacks).toHaveLength(1);
      expect(screen.getByTestId("orb-page")).toHaveAttribute(
        "data-orb-visual-status",
        "ready",
      );

      act(() => setViewport(412, 760));
      expect(screen.getByTestId("valence-orb")).toHaveAttribute("data-size", "268");

      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(screen.getByTestId("valence-orb")).toHaveAttribute("data-size", "243");
      expect(orbVisualControl.readyCallbacks.length).toBeGreaterThan(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("waits for a visible paint after a hidden-tab readiness signal", async () => {
    orbVisualControl.mode = "manual";
    const raf = installManualRaf();
    const hiddenDescriptor = Object.getOwnPropertyDescriptor(document, "hidden");

    try {
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      render(<OrbPage onAddMood={onAddMoodMock} />);

      act(() => orbVisualControl.readyCallbacks[0]?.());
      expect(raf.pendingCount()).toBe(0);
      expect(screen.getByTestId("orb-page")).toHaveAttribute("data-orb-visual-status", "pending");

      Object.defineProperty(document, "hidden", { configurable: true, value: false });
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      expect(raf.pendingCount()).toBe(1);
      expect(screen.getByTestId("orb-page")).toHaveAttribute("data-orb-visual-status", "pending");

      act(() => raf.flushNext());
      await waitFor(() =>
        expect(screen.getByTestId("orb-page")).toHaveAttribute("data-orb-visual-status", "ready")
      );
    } finally {
      if (hiddenDescriptor) {
        Object.defineProperty(document, "hidden", hiddenDescriptor);
      } else {
        Reflect.deleteProperty(document, "hidden");
      }
    }
  });

  it("shows a localized recovery state and ignores stale readiness after retry", async () => {
    orbVisualControl.mode = "manual";
    const raf = installManualRaf();

    render(<OrbPage onAddMood={onAddMoodMock} />);
    const firstReady = orbVisualControl.readyCallbacks[0];
    const firstError = orbVisualControl.errorCallbacks[0];

    act(() => firstError?.());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't open your mood check-in. Try again."
    );
    expect(screen.getByTestId("orb-page-retry")).toHaveAccessibleName("Try again");
    expect(screen.getByTestId("orb-page-error-back")).toHaveAccessibleName("Back");

    act(() => firstReady?.());
    expect(raf.pendingCount()).toBe(0);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("orb-page-retry"));
    await waitFor(() => expect(orbVisualControl.readyCallbacks.length).toBe(2));
    expect(screen.getByTestId("orb-warm-loading-indicator")).toBeInTheDocument();

    act(() => firstReady?.());
    expect(raf.pendingCount()).toBe(0);
    expect(screen.getByTestId("orb-page")).toHaveAttribute("data-orb-visual-status", "pending");

    act(() => orbVisualControl.readyCallbacks.at(-1)?.());
    expect(raf.pendingCount()).toBe(1);
    act(() => raf.flushNext());
    await waitFor(() =>
      expect(screen.getByTestId("orb-page")).toHaveAttribute("data-orb-visual-status", "ready")
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("routes Android Back through refine and terminal renderer states", async () => {
    const navigateToPage = vi.fn();
    render(<OrbPage navigateToPage={navigateToPage} onAddMood={onAddMoodMock} />);

    fireEvent.click(screen.getByTestId("mood-orb-option-good"));
    fireEvent.click(screen.getByTestId("orb-page-next"));
    expect(screen.getByTestId("orb-page-refine")).toBeInTheDocument();
    expect(androidBackControl.callback).not.toBeNull();
    let handled = false;
    act(() => {
      handled = androidBackControl.callback?.() ?? false;
    });
    expect(handled).toBe(true);
    expect(screen.getByTestId("orb-page-select")).toBeInTheDocument();

    const backSpy = vi.spyOn(window.history, "back").mockImplementation(() => {});
    act(() => orbVisualControl.errorCallbacks.at(-1)?.());
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    act(() => {
      handled = androidBackControl.callback?.() ?? false;
    });
    expect(handled).toBe(true);
    expect(backSpy.mock.calls.length + navigateToPage.mock.calls.length).toBe(1);
    if (navigateToPage.mock.calls.length > 0) {
      expect(navigateToPage).toHaveBeenCalledWith("habits");
    }
  });

  it("preserves the in-progress mood draft across terminal renderer retry", async () => {
    render(<OrbPage onAddMood={onAddMoodMock} />);
    fireEvent.click(screen.getByTestId("mood-orb-option-good"));
    expect(screen.getByTestId("valence-orb")).toHaveAttribute("data-valence", "0.5");

    act(() => orbVisualControl.errorCallbacks.at(-1)?.());
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByTestId("orb-page-retry")).toHaveClass("min-h-[44px]");
    expect(screen.getByTestId("orb-page-error-back")).toHaveClass("min-h-[44px]");

    fireEvent.click(screen.getByTestId("orb-page-retry"));
    await waitFor(() =>
      expect(screen.getByTestId("orb-page")).toHaveAttribute("data-orb-visual-status", "ready")
    );
    expect(screen.getByTestId("valence-orb")).toHaveAttribute("data-valence", "0.5");
    expect(screen.getByTestId("mood-orb-picker")).toHaveAttribute("data-value", "0.5");
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

    fireEvent.click(screen.getByTestId("mood-orb-option-good"));
    fireEvent.click(screen.getByTestId("orb-page-next"));

    const refineScroller = screen.getByTestId("orb-page-refine").closest(".overflow-y-auto");

    expect(refineScroller).toHaveClass("overflow-x-hidden");
  });

  it("keeps enlarged slider labels out from under the orb action footer", () => {
    render(<OrbPage onAddMood={onAddMoodMock} />);

    const selectFooter = screen.getByTestId("orb-page-footer");
    const selectScroller = screen.getByTestId("orb-page-select").closest(".overflow-y-auto");

    expect(selectFooter).toHaveClass("relative", "shrink-0", "pt-3");
    expect(selectFooter).not.toHaveClass("absolute");
    expect(selectScroller).toHaveClass("pb-3");

    fireEvent.click(screen.getByTestId("mood-orb-option-good"));
    fireEvent.click(screen.getByTestId("orb-page-next"));

    const refineScroller = screen.getByTestId("orb-page-refine").closest(".overflow-y-auto");
    const refineFooter = within(refineScroller as HTMLElement).getByTestId("orb-page-footer");

    expect(refineFooter).toHaveClass("relative", "shrink-0", "pt-3");
    expect(refineFooter).not.toHaveClass("absolute");
    expect(refineScroller).toHaveClass("pb-3");
  });

  it("keeps overflowing orb steps reachable and resets their scroll position", () => {
    const scrollTopDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTop");
    const setScrollTop = vi.fn();

    Object.defineProperty(HTMLElement.prototype, "scrollTop", {
      configurable: true,
      get: () => 120,
      set: setScrollTop,
    });

    try {
      render(<OrbPage onAddMood={onAddMoodMock} />);

      const selectScroller = screen.getByTestId("orb-page-select").closest(".overflow-y-auto");
      expect(selectScroller).toHaveClass("orb-step-scroll-safe-center");
      expect(selectScroller).not.toHaveClass("justify-center");
      expect(setScrollTop).toHaveBeenCalledWith(0);

      setScrollTop.mockClear();
      fireEvent.click(screen.getByTestId("mood-orb-option-good"));
      fireEvent.click(screen.getByTestId("orb-page-next"));

      const refineScroller = screen.getByTestId("orb-page-refine").closest(".overflow-y-auto");
      expect(refineScroller).toHaveClass("justify-start");
      expect(refineScroller).not.toHaveClass("justify-center", "[justify-content:safe_center]");
      expect(setScrollTop).toHaveBeenCalledWith(0);
    } finally {
      if (scrollTopDescriptor) {
        Object.defineProperty(HTMLElement.prototype, "scrollTop", scrollTopDescriptor);
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, "scrollTop");
      }
    }
  });

  it("bounds the refine heading to the mobile scroller without splitting ordinary words", () => {
    render(<OrbPage onAddMood={onAddMoodMock} />);
    fireEvent.click(screen.getByTestId("mood-orb-option-good"));
    fireEvent.click(screen.getByTestId("orb-page-next"));

    const heading = screen.getByTestId("orb-page-refine-heading");
    const copyColumn = heading.parentElement;
    const noteLabel = screen.getByText("Continue writing");

    expect(screen.getByTestId("orb-page-refine")).toHaveClass("px-0");
    expect(screen.getByTestId("orb-page-emotion-spectrum")).toHaveClass("px-0");
    expect(screen.getByTestId("orb-page-note")).toHaveClass("px-0");
    expect(copyColumn).toHaveClass("w-full", "max-w-full", "min-w-0");
    expect(heading).toHaveClass("min-w-0", "max-w-full", "break-words");
    expect(heading).toHaveClass("text-[1.0625rem]", "min-[360px]:text-2xl", "md:text-3xl");
    expect(heading.className).toContain("[hyphens:manual]");
    expect(heading.className).toContain("[overflow-wrap:normal]");
    expect(noteLabel).toHaveClass(
      "[hyphens:auto]",
      "[overflow-wrap:normal]",
      "[word-break:normal]"
    );
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

  it("keeps the Android ambience control visible, safe-area bounded, and touch reachable", () => {
    const css = readFileSync("src/pages/nav-v2/OrbAmbienceControl.css", "utf8");

    expect(css).toMatch(
      /:root\[data-platform="android"\] \.orb-ambience-focus-control\s*\{[^}]*position:\s*fixed;[^}]*contain:\s*none;[^}]*width:\s*auto;[^}]*height:\s*auto;[^}]*overflow:\s*visible;[^}]*clip-path:\s*none;/s,
    );
    expect(css).toContain("inset-inline-end: max(1rem, var(--safe-right))");
    expect(css).not.toContain(
      ':root[data-platform="android"] .orb-ambience-focus-control:focus-within',
    );
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
    expect(next).toHaveClass("bg-primary", "text-primary-foreground");

    fireEvent.click(next);
    expect(screen.getByTestId("orb-page-refine")).toBeInTheDocument();
    expect(useMoodEntryDraftStore.getState().valence).toBe(0);
  });

  it("retains the outgoing Orb step while the refine scene blooms in", () => {
    const source = readFileSync("src/pages/nav-v2/OrbPage.tsx", "utf8");

    expect(source).toContain('<AnimatePresence initial={false} mode="sync">');
    expect(source).toContain('data-testid="orb-page-step-scene"');
    expect(source).toContain('exit={shouldAnimate ? bloom.exit : bloomStatic.exit}');
    expect(source).toContain(
      'transition={shouldAnimate ? bloom.transition : bloomStatic.transition}',
    );
    expect(source).toContain('className="absolute inset-0 flex min-h-0 flex-col"');
    expect(source).toContain('aria-hidden={!isPresent ? true : undefined}');
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

  it("keeps the Android day flourish mounted when runtime performance protection engages", () => {
    platformControl.isAndroid = true;
    themeState.appliedTheme = "paper";
    mockUseShouldAnimate.mockImplementation(
      (options?: { respectRuntimePerformance?: boolean }) =>
        options?.respectRuntimePerformance === false
    );

    render(<OrbPage onAddMood={onAddMoodMock} />);

    expect(screen.getByTestId("orb-day-flourish")).toBeInTheDocument();
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
    expect(screen.getByTestId("orb-page-note-input")).toHaveAttribute(
      "aria-label",
      "Continue writing",
    );
    expect(screen.getByTestId("orb-page-note-input")).toHaveClass(
      "[@media(max-height:360px)]:h-[96px]",
      "[@media(max-height:360px)]:min-h-[96px]",
    );
    expect(screen.getByText("Continue writing")).toHaveClass(
      "[@media(max-height:360px)]:px-16",
      "[@media(max-height:360px)]:text-center",
    );
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

  it("recenters the refine note when the Android IME opens", () => {
    platformControl.isAndroid = true;
    const originalVisualViewport = Object.getOwnPropertyDescriptor(window, "visualViewport");
    const resizeListeners = new Set<EventListenerOrEventListenerObject>();
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: {
        addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
          if (type === "resize") resizeListeners.add(listener);
        }),
        removeEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
          if (type === "resize") resizeListeners.delete(listener);
        }),
      },
    });
    const raf = installManualRaf();
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    try {
      render(<OrbPage onAddMood={onAddMoodMock} />);
      fireEvent.click(screen.getByTestId("mood-orb-option-good"));
      fireEvent.click(screen.getByTestId("orb-page-next"));
      const note = screen.getByTestId("orb-page-note-input");
      fireEvent.focus(note);

      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: "auto",
        block: "center",
        inline: "nearest",
      });

      const pendingBeforeImeResize = raf.pendingCount();
      for (const listener of resizeListeners) {
        if (typeof listener === "function") listener(new Event("resize"));
        else listener.handleEvent(new Event("resize"));
      }
      expect(raf.pendingCount()).toBe(pendingBeforeImeResize + 1);

      fireEvent.focus(note);
      expect(raf.pendingCount()).toBe(pendingBeforeImeResize);
    } finally {
      if (originalVisualViewport) {
        Object.defineProperty(window, "visualViewport", originalVisualViewport);
      } else {
        Reflect.deleteProperty(window, "visualViewport");
      }
    }
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

  it("opens Diary with a valid handoff even when no exact feeling is chosen", async () => {
    const navigateToPage = vi.fn();
    render(<OrbPage navigateToPage={navigateToPage} onAddMood={onAddMoodMock} />);

    fireEvent.click(screen.getByTestId("mood-orb-option-good"));
    fireEvent.click(screen.getByTestId("orb-page-next"));
    expect(screen.getByTestId("orb-page-runtime-content")).toHaveClass("px-3", "md:px-6");
    const refineScroller = screen.getByTestId("orb-page-refine-scroll");
    const backToSelect = screen.getByTestId("orb-page-back");
    const saveMood = screen.getByTestId("orb-page-save-mood");
    const saveAndOpen = screen.getByTestId("orb-page-open-diary");
    expect(refineScroller).toHaveClass(
      "overflow-y-auto",
      "overflow-x-hidden",
      "px-2",
      "md:px-4",
    );
    expect(refineScroller).toContainElement(
      within(refineScroller).getByTestId("orb-page-footer"),
    );
    expect(screen.getByTestId("orb-page-refine-actions")).toHaveClass(
      "flex-col",
      "items-stretch",
      "px-0",
      "sm:flex-row"
    );
    expect(saveAndOpen).toHaveAccessibleName("Save mood and start today's entry");
    expect(saveMood).toHaveAccessibleName("Save mood");
    expect(saveAndOpen).toHaveClass(
      "min-w-0",
      "max-w-full",
      "w-full",
      "whitespace-normal",
      "text-center",
      "px-3",
      "sm:px-5",
      "sm:w-auto"
    );
    expect(saveAndOpen).toHaveClass("orb-page-continuation-button");
    expect(backToSelect).toHaveClass("px-3", "sm:px-5");
    expect(saveAndOpen.querySelector("span")).toHaveClass(
      "min-w-0",
      "flex-1",
      "[overflow-wrap:normal]",
      "[word-break:normal]"
    );
    expect(saveAndOpen.querySelector("span")).not.toHaveClass("break-words");
    expect(saveAndOpen.querySelector("svg")).toHaveClass("orb-page-save-arrow");
    expect(saveAndOpen.querySelector("svg")).not.toHaveClass("max-[359px]:hidden");
    fireEvent.click(saveAndOpen);

    await waitFor(() => expect(navigateToPage).toHaveBeenCalledWith("diary"));
    expect(setActivePageMock).not.toHaveBeenCalled();
    expect(onAddMoodMock).toHaveBeenCalledTimes(1);
    expect(setMoodsSpy).not.toHaveBeenCalled();
    expect(useDiaryDraftStore.getState().pendingMoodContext).toMatchObject({
      valence: 0.5,
      mood: "good",
      scope: "now",
      specificTime: null,
      emotion: null,
      note: null,
    });
  });

  it("saves the mood without creating a Diary handoff or navigating", async () => {
    const navigateToPage = vi.fn();
    render(<OrbPage navigateToPage={navigateToPage} onAddMood={onAddMoodMock} />);

    fireEvent.click(screen.getByTestId("mood-orb-option-good"));
    fireEvent.click(screen.getByTestId("orb-page-next"));
    fireEvent.click(screen.getByTestId("emotion-tag-mock-hopeful"));
    fireEvent.change(screen.getByTestId("orb-page-note-input"), {
      target: { value: "This note stays out of the Diary handoff." },
    });

    const saveMood = screen.getByTestId("orb-page-save-mood");
    expect(saveMood).toHaveAccessibleName("Save mood");
    expect(saveMood).toHaveClass("min-h-[44px]");
    fireEvent.click(saveMood);

    await waitFor(() => expect(onAddMoodMock).toHaveBeenCalledTimes(1));
    expect(onAddMoodMock).toHaveBeenCalledWith(
      expect.objectContaining({
        valence: 0.5,
        mood: "good",
        emotionTags: ["hopeful"],
      }),
    );
    expect(onAddMoodMock.mock.calls[0]?.[0]).not.toHaveProperty("note");
    expect(useDiaryDraftStore.getState().pendingMoodContext).toBeNull();
    expect(navigateToPage).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByTestId("orb-page-select")).toBeInTheDocument(),
    );
    expect(useMoodEntryDraftStore.getState()).toMatchObject({
      valence: null,
      emotion: null,
      note: "",
    });
  });

  it("keeps the Diary arrow decorative and hidden only below 360px through route-local CSS", () => {
    const stepsCss = readFileSync("src/pages/nav-v2/OrbPageSteps.css", "utf8");

    expect(stepsCss).toMatch(
      /\.orb-step-scroll-safe-center\s*\{[\s\S]*?justify-content:\s*safe center;?[\s\S]*?\}/
    );
    expect(stepsCss).toMatch(
      /\.orb-page-continuation-button\s*\{[\s\S]*?border-radius:\s*clamp\(24px,\s*8vw,\s*44px\);?[\s\S]*?\}/
    );
    expect(stepsCss).toMatch(/@media\s*\(max-width:\s*359px\)/);
    expect(stepsCss).toMatch(/\.orb-page-save-arrow\s*\{[\s\S]*?display:\s*none;?[\s\S]*?\}/);
  });

  it("releases the nested refine gutter below 360px so long emotion words stay inside their chip", () => {
    render(<OrbPage onAddMood={onAddMoodMock} />);
    fireEvent.click(screen.getByTestId("mood-orb-option-good"));
    fireEvent.click(screen.getByTestId("orb-page-next"));

    const stepsCss = readFileSync("src/pages/nav-v2/OrbPageSteps.css", "utf8");
    const refineScroller = screen.getByTestId("orb-page-refine-scroll");

    expect(refineScroller).toHaveClass("orb-page-refine-scroll", "px-2", "md:px-4");
    expect(stepsCss).toMatch(/@media\s*\(max-width:\s*359px\)/);
    expect(stepsCss).toMatch(
      /\.orb-page-refine-scroll\s*\{[\s\S]*?padding-inline:\s*0;?[\s\S]*?\}/
    );
  });

  it("includes exact feeling and note in the pending Diary context when provided", async () => {
    render(<OrbPage onAddMood={onAddMoodMock} />);

    fireEvent.click(screen.getByTestId("mood-orb-option-good"));
    fireEvent.click(screen.getByTestId("orb-page-next"));
    expect(screen.getByTestId("orb-page-refine")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("emotion-tag-mock-hopeful"));
    fireEvent.change(screen.getByTestId("orb-page-note-input"), {
      target: { value: "I want to remember this calm shift." },
    });
    fireEvent.click(screen.getByTestId("orb-page-open-diary"));

    await waitFor(() => expect(onAddMoodMock).toHaveBeenCalledTimes(1));
    expect(useDiaryDraftStore.getState().pendingMoodContext).toMatchObject({
      valence: 0.5,
      mood: "good",
      scope: "now",
      emotion: "hopeful",
      note: "I want to remember this calm shift.",
    });
  });

  it("prefers the orchestrator navigation callback for the final Diary transfer", async () => {
    const navigateToPage = vi.fn();
    render(<OrbPage navigateToPage={navigateToPage} onAddMood={onAddMoodMock} />);

    fireEvent.click(screen.getByTestId("mood-orb-option-good"));
    fireEvent.click(screen.getByTestId("orb-page-next"));
    fireEvent.click(screen.getByTestId("orb-page-open-diary"));

    await waitFor(() => expect(navigateToPage).toHaveBeenCalledWith("diary"));
    expect(setActivePageMock).not.toHaveBeenCalled();
    expect(onAddMoodMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the mood flow owned by the V2 orchestrator instead of creating a second navigator", () => {
    const source = readFileSync("src/pages/nav-v2/useOrbMoodFlow.ts", "utf8");

    expect(source).not.toContain("import { useNavigationV2 }");
    expect(source).not.toContain("useNavigationV2()");
  });
});
