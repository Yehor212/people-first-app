import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { AppliedTheme } from "@/stores/themeStore";

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
    },
    language: "en",
    isRTL: false,
  }),
}));

vi.mock("@/lib/haptics", () => ({
  haptics: { tabChanged: vi.fn(), light: vi.fn(), medium: vi.fn() },
  hapticSuccess: vi.fn(),
  hapticTap: vi.fn(),
  hapticSelection: vi.fn(),
  hapticMedium: vi.fn(),
}));

vi.mock("@/components/state-of-mind/ValenceOrb", () => ({
  CANONICAL_ORB_ANIMATION_SPEED: 0.72,
  ValenceOrb: ({
    valence,
    size,
    transitionProfile = "v1-soft",
    animationSpeed = 0.72,
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
  ValenceSlider: ({
    value,
    onChange,
  }: {
    value: number;
    onChange: (v: number) => void;
  }) => (
    <div data-testid="mood-orb-picker" data-value={value ?? ""}>
      <button
        type="button"
        data-testid="mood-orb-option-good"
        onClick={() => onChange(0.5)}
      >
        good slider
      </button>
      <button
        type="button"
        data-testid="mood-orb-option-bad"
        onClick={() => onChange(-0.5)}
      >
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

const themeState = vi.hoisted<{ appliedTheme: AppliedTheme }>(() => ({
  appliedTheme: "ink",
}));

vi.mock("@/stores/themeStore", () => ({
  useThemeStore: (selector: (s: unknown) => unknown) =>
    selector(themeState),
}));

vi.mock("@/hooks/useShouldAnimate", () => ({
  useShouldAnimate: () => true,
}));

vi.mock("@/lib/motion", () => ({
  Bloom: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("OrbPage progressive flow", () => {
  beforeEach(() => {
    setMoodsSpy.mockClear();
    onAddMoodMock.mockClear();
    setActivePageMock.mockClear();
    themeState.appliedTheme = "ink";
    mockMoods = [];
    rebuildMoodsSnapshot();
    setViewport(1024, 900);
    useMoodEntryDraftStore.getState().reset();
    useDiaryDraftStore.getState().clearPendingMoodContext();
    window.localStorage.setItem("zenflow-orb-first-run-dismissed", "1");
  });

  it("renders the page landmark and V2 shell chrome", () => {
    render(<OrbPage onAddMood={onAddMoodMock} />);
    expect(screen.getByTestId("orb-page")).toHaveAttribute("role", "main");
    expect(screen.getByTestId("orb-page")).toHaveAttribute(
      "aria-labelledby",
      "orb-page-heading",
    );
    expect(screen.getByTestId("orb-page")).toHaveClass("orb-cosmic-scope");
    expect(screen.queryByTestId("cinematic-heading")).not.toBeInTheDocument();
    expect(document.getElementById("orb-page-heading")).toHaveClass("sr-only");
    expect(screen.getByTestId("cosmic-orb-background")).toHaveAttribute(
      "data-variant",
      "auto",
    );
    expect(screen.getByTestId("orb-page-select")).toBeInTheDocument();
  });

  it("clips horizontal overflow inside the orb step scrollers", () => {
    render(<OrbPage onAddMood={onAddMoodMock} />);

    const selectScroller = screen
      .getByTestId("orb-page-select")
      .closest(".overflow-y-auto");

    expect(selectScroller).toHaveClass("overflow-x-hidden");

    fireEvent.click(screen.getByTestId("orb-page-next"));

    const refineScroller = screen
      .getByTestId("orb-page-refine")
      .closest(".overflow-y-auto");

    expect(refineScroller).toHaveClass("overflow-x-hidden");
  });

  it("uses the day flourish instead of the shooting star in paper theme", () => {
    themeState.appliedTheme = "paper";

    render(<OrbPage onAddMood={onAddMoodMock} />);

    expect(screen.getByTestId("orb-day-flourish")).toBeInTheDocument();
    expect(screen.queryByTestId("shooting-star-stub")).toBeNull();
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

    expect(screen.getByTestId("valence-orb")).toHaveAttribute(
      "data-valence",
      "-0.143",
    );
    expect(screen.getByTestId("mood-orb-picker")).toHaveAttribute(
      "data-value",
      "0",
    );
    expect(screen.getByTestId("valence-orb")).toHaveAttribute(
      "data-size",
      "280",
    );
    expect(screen.getByTestId("valence-orb")).toHaveAttribute(
      "data-transition-profile",
      "v1-soft",
    );
    expect(screen.getByTestId("valence-orb")).toHaveAttribute(
      "data-animation-speed",
      "0.72",
    );
    expect(screen.getByTestId("valence-orb")).toHaveAttribute(
      "data-renderer",
      "webgl",
    );
    expect(screen.queryByTestId("orb-aura")).not.toBeInTheDocument();
  });

  it("keeps neutral semantics but avoids the committed neutral orb before first choice", () => {
    render(<OrbPage onAddMood={onAddMoodMock} />);

    expect(screen.getByTestId("valence-orb")).toHaveAttribute(
      "data-valence",
      "-0.143",
    );
    expect(screen.getByTestId("mood-orb-picker")).toHaveAttribute(
      "data-value",
      "0",
    );
  });

  it("keeps desktop on the same canonical orb motion as phone layouts", () => {
    setViewport(1024, 900);

    render(<OrbPage onAddMood={onAddMoodMock} />);

    expect(screen.queryByTestId("orb-aura")).not.toBeInTheDocument();
    expect(screen.getByTestId("valence-orb")).toHaveAttribute(
      "data-animation-speed",
      "0.72",
    );
    expect(screen.getByTestId("valence-orb")).toHaveAttribute(
      "data-renderer",
      "webgl",
    );
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
    expect(screen.getByTestId("orb-page-refine-heading")).toHaveTextContent(
      "Localized hopeful",
    );
    fireEvent.change(screen.getByTestId("orb-page-note-input"), {
      target: { value: "A little more grounded now." },
    });

    fireEvent.click(screen.getByTestId("orb-page-back"));
    expect(screen.getByTestId("orb-page-select")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("orb-page-next"));
    expect(screen.getByTestId("emotion-tag-mock-hopeful")).toHaveAttribute(
      "data-selected",
      "true",
    );
    expect(screen.getByTestId("orb-page-note-input")).toHaveValue(
      "A little more grounded now.",
    );
  });

  it("preserves the in-progress orb mood when the Orb tab unmounts during V2 navigation", () => {
    const { unmount } = render(<OrbPage onAddMood={onAddMoodMock} />);

    fireEvent.click(screen.getByTestId("mood-orb-option-good"));
    expect(screen.getByTestId("valence-orb")).toHaveAttribute(
      "data-valence",
      "0.5",
    );

    unmount();
    render(<OrbPage onAddMood={onAddMoodMock} />);

    expect(screen.getByTestId("valence-orb")).toHaveAttribute(
      "data-valence",
      "0.5",
    );
    expect(screen.getByTestId("mood-orb-picker")).toHaveAttribute(
      "data-value",
      "0.5",
    );
  });

  it("opens Diary with a valid handoff even when no exact feeling is chosen", () => {
    render(<OrbPage onAddMood={onAddMoodMock} />);

    fireEvent.click(screen.getByTestId("orb-page-next"));
    fireEvent.click(screen.getByTestId("orb-page-open-diary"));

    expect(setActivePageMock).toHaveBeenCalledWith("diary");
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
    render(
      <OrbPage navigateToPage={navigateToPage} onAddMood={onAddMoodMock} />,
    );

    fireEvent.click(screen.getByTestId("orb-page-next"));
    fireEvent.click(screen.getByTestId("orb-page-open-diary"));

    expect(navigateToPage).toHaveBeenCalledWith("diary");
    expect(setActivePageMock).not.toHaveBeenCalled();
    expect(onAddMoodMock).toHaveBeenCalledTimes(1);
  });
});
