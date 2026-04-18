import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { OrbPage } from "../OrbPage";
import { useMoodEntryDraftStore } from "@/stores/moodEntryDraftStore";
import { useDiaryDraftStore } from "@/stores/diaryDraftStore";

// --- Mocks ---

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      goodMorning: "Good morning",
      goodAfternoon: "Good afternoon",
      goodEvening: "Good evening",
      somLogFeeling: "Log how you feel",
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
      orbConfirm: "Save",
      orbSkip: "Later",
      orbUndo: "Undo",
      orbMoodSaved: "Mood saved",
      orbFirstRunTitle: "Three steps",
      orbFirstRunStep1: "Step one",
      orbFirstRunStep2: "Step two",
      orbFirstRunStep3: "Step three",
      orbFirstRunGotIt: "Got it",
    },
    language: "en",
    isRTL: false,
  }),
}));

vi.mock("@/lib/haptics", () => ({
  haptics: { tabChanged: vi.fn() },
  hapticSuccess: vi.fn(),
  hapticTap: vi.fn(),
  hapticSelection: vi.fn(),
  hapticMedium: vi.fn(),
}));

vi.mock("@/components/state-of-mind/ValenceOrb", () => ({
  ValenceOrb: ({ valence, size }: { valence: number; size?: number }) => (
    <div
      data-testid="valence-orb"
      data-valence={valence}
      data-size={size}
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
  }: {
    valence: number;
    selected: string[];
    onToggle: (tag: string) => void;
  }) => (
    <div data-testid="emotion-tag-grid" data-valence={valence}>
      <button
        data-testid="emotion-tag-mock-hopeful"
        data-selected={selected.includes("hopeful")}
        onClick={() => onToggle("hopeful")}
        type="button"
      >
        hopeful
      </button>
    </div>
  ),
}));

// Phase 3-B — ValenceSlider (old bar) restored on V2 OrbPage.
// The mock exposes the original `mood-orb-option-*` testids so existing
// assertions keep working unchanged; ValenceSlider uses `onChange(valence)`.
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
        data-testid="mood-orb-option-good"
        onClick={() => onChange(0.5)}
        type="button"
      >
        good slider
      </button>
      <button
        data-testid="mood-orb-option-great"
        onClick={() => onChange(1)}
        type="button"
      >
        great slider
      </button>
    </div>
  ),
}));

vi.mock("../CosmicBgAdapter", () => ({
  CosmicBgAdapter: () => <div data-testid="cosmic-orb-background">cosmic</div>,
}));

vi.mock("../ShootingStar", () => ({
  ShootingStar: () => <div data-testid="shooting-star-stub" />,
}));

vi.mock("../useCosmicParallax", () => ({
  useCosmicParallax: () => ({ current: null }),
}));

vi.mock("@/components/state-of-mind/StateOfMindModal", () => ({
  StateOfMindModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="som-modal">state of mind modal</div> : null,
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
let mockMoods: Array<Record<string, unknown>> = [];
// Stable selector snapshot — prevents re-render loops when useShallow wraps.
// Rebuild the snapshot only when tests mutate mockMoods (via beforeEach).
let moodsSnapshot = { moods: mockMoods, userName: "Yehor", setMoods: setMoodsSpy };
function rebuildMoodsSnapshot() {
  moodsSnapshot = { moods: mockMoods, userName: "Yehor", setMoods: setMoodsSpy };
}
vi.mock("@/stores", () => ({
  useUserDataStore: (selector: (s: unknown) => unknown) => selector(moodsSnapshot),
}));

vi.mock("@/stores/themeStore", () => ({
  useThemeStore: (selector: (s: unknown) => unknown) =>
    selector({ appliedTheme: "ink" }),
}));

const shouldAnimateMock = vi.fn(() => true);
vi.mock("@/hooks/useShouldAnimate", () => ({
  useShouldAnimate: () => shouldAnimateMock(),
}));

vi.mock("@/lib/motion", () => ({
  Bloom: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("OrbPage (Phase 3-A.2 + Phase 3-A.4b)", () => {
  beforeEach(() => {
    setMoodsSpy.mockClear();
    setActivePageMock.mockClear();
    shouldAnimateMock.mockReturnValue(true);
    mockMoods = [];
    rebuildMoodsSnapshot();
    useMoodEntryDraftStore.getState().reset();
    useDiaryDraftStore.getState().clearPendingMoodContext();
    // Ensure first-run hint has already been dismissed in the default test
    // suite (we test the eligibility explicitly below).
    window.localStorage.setItem("zenflow-orb-first-run-dismissed", "1");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the page with main role + labelled-by h1 (a11y landmark)", () => {
    render(<OrbPage />);
    const main = screen.getByTestId("orb-page");
    expect(main).toHaveAttribute("role", "main");
    expect(main).toHaveAttribute("aria-labelledby", "orb-page-heading");
  });

  it("renders CosmicBgAdapter behind content", () => {
    render(<OrbPage />);
    expect(screen.getByTestId("cosmic-orb-background")).toBeInTheDocument();
  });

  it("renders shooting-star flourish layer", () => {
    render(<OrbPage />);
    expect(screen.getByTestId("cosmic-orb-flourish-layer")).toBeInTheDocument();
    expect(screen.getByTestId("shooting-star-stub")).toBeInTheDocument();
  });

  it("renders the greeting with user name", () => {
    render(<OrbPage />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(/Yehor/);
    expect(heading.className).toContain("font-display");
  });

  it("renders the ValenceOrb hero at 280/360 sizes", () => {
    render(<OrbPage />);
    const orbs = screen.getAllByTestId("valence-orb");
    const sizes = orbs.map((el) => el.getAttribute("data-size"));
    expect(sizes).toContain("280");
    expect(sizes).toContain("360");
  });

  it("renders the ValenceSlider (old bar restored on V2, Phase 3-B)", () => {
    render(<OrbPage />);
    // Mock surfaces the slider under the same testid as the prior picker for
    // compatibility; the real MoodSliderV2 unit tests cover the slider surface.
    expect(screen.getByTestId("mood-orb-picker")).toBeInTheDocument();
    // V1 journal slider must NOT render on V2 orb page
    expect(screen.queryByTestId("mood-slider")).not.toBeInTheDocument();
  });

  it("renders the whisper subtitle with italic + font-serif", () => {
    render(<OrbPage />);
    const whisper = screen.getByTestId("orb-page-whisper");
    expect(whisper.className).toContain("italic");
    expect(whisper.className).toContain("font-serif");
  });

  it("tapping the orb opens the State of Mind modal", () => {
    render(<OrbPage />);
    expect(screen.queryByTestId("som-modal")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("orb-page-hero"));
    expect(screen.getByTestId("som-modal")).toBeInTheDocument();
  });

  // --- Phase 3-A.4b scope selector ---
  it("renders the MoodScopeSelector above the slider", () => {
    render(<OrbPage />);
    expect(screen.getByTestId("mood-scope-selector")).toBeInTheDocument();
    expect(screen.getByTestId("mood-scope-chip-now")).toBeInTheDocument();
    expect(screen.getByTestId("mood-scope-chip-day")).toBeInTheDocument();
    expect(screen.getByTestId("mood-scope-chip-specific")).toBeInTheDocument();
  });

  // --- Phase 3-A.4b emotion spectrum gate ---
  it("hides the emotion spectrum before valence is chosen", () => {
    render(<OrbPage />);
    expect(
      screen.queryByTestId("orb-page-emotion-spectrum"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("emotion-tag-grid")).not.toBeInTheDocument();
  });

  it("reveals the emotion spectrum after slider sets valence", () => {
    render(<OrbPage />);
    fireEvent.click(screen.getByTestId("mood-orb-option-good"));
    expect(
      screen.getByTestId("orb-page-emotion-spectrum"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("emotion-tag-grid")).toBeInTheDocument();
  });

  // --- Phase 3-A.4b confirm CTA gate ---
  it("shows confirm CTA disabled before emotion chosen", () => {
    render(<OrbPage />);
    fireEvent.click(screen.getByTestId("mood-orb-option-good"));
    expect(screen.getByTestId("mood-confirm-button")).toBeDisabled();
  });

  it("enables confirm CTA after emotion is chosen", () => {
    render(<OrbPage />);
    fireEvent.click(screen.getByTestId("mood-orb-option-good"));
    fireEvent.click(screen.getByTestId("emotion-tag-mock-hopeful"));
    expect(screen.getByTestId("mood-confirm-button")).not.toBeDisabled();
  });

  it("confirm after 5s saves mood + seeds diary draft + navigates", () => {
    vi.useFakeTimers();
    render(<OrbPage />);
    fireEvent.click(screen.getByTestId("mood-orb-option-good"));
    fireEvent.click(screen.getByTestId("emotion-tag-mock-hopeful"));
    fireEvent.click(screen.getByTestId("mood-confirm-button"));
    expect(setMoodsSpy).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(setMoodsSpy).toHaveBeenCalledTimes(1);
    expect(setActivePageMock).toHaveBeenCalledWith("diary");
    const ctx = useDiaryDraftStore.getState().pendingMoodContext;
    expect(ctx).not.toBeNull();
    expect(ctx?.emotion).toBe("hopeful");
    expect(ctx?.scope).toBe("now");
  });

  it("undo toast cancels save within 5s", () => {
    vi.useFakeTimers();
    render(<OrbPage />);
    fireEvent.click(screen.getByTestId("mood-orb-option-good"));
    fireEvent.click(screen.getByTestId("emotion-tag-mock-hopeful"));
    fireEvent.click(screen.getByTestId("mood-confirm-button"));
    fireEvent.click(screen.getByTestId("mood-undo-toast-button"));
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(setMoodsSpy).not.toHaveBeenCalled();
    expect(setActivePageMock).not.toHaveBeenCalled();
  });

  it("skip button clears draft without saving", () => {
    render(<OrbPage />);
    fireEvent.click(screen.getByTestId("mood-orb-option-good"));
    expect(useMoodEntryDraftStore.getState().valence).not.toBeNull();
    fireEvent.click(screen.getByTestId("mood-skip-button"));
    expect(useMoodEntryDraftStore.getState().valence).toBeNull();
    expect(setMoodsSpy).not.toHaveBeenCalled();
  });

  // --- Phase 3-A.4b first-run hint ---
  it("shows first-run hint when moods empty and not dismissed", () => {
    window.localStorage.removeItem("zenflow-orb-first-run-dismissed");
    mockMoods = [];
    render(<OrbPage />);
    expect(screen.getByTestId("mood-first-run-hint")).toBeInTheDocument();
  });

  it("hides first-run hint when mood history exists", () => {
    window.localStorage.removeItem("zenflow-orb-first-run-dismissed");
    mockMoods = [
      {
        id: "1",
        mood: "good",
        date: "2026-04-16",
        timestamp: Date.now(),
        valence: 0.5,
      },
    ];
    rebuildMoodsSnapshot();
    render(<OrbPage />);
    expect(
      screen.queryByTestId("mood-first-run-hint"),
    ).not.toBeInTheDocument();
  });

  it("hides first-run hint when already dismissed (localStorage)", () => {
    window.localStorage.setItem("zenflow-orb-first-run-dismissed", "1");
    mockMoods = [];
    render(<OrbPage />);
    expect(
      screen.queryByTestId("mood-first-run-hint"),
    ).not.toBeInTheDocument();
  });

  // --- Phase 3-A.4b aura reacts to draft valence ---
  it("aura hue derives from draft valence once slider fires", () => {
    render(<OrbPage />);
    const auraBefore = screen
      .getByTestId("orb-aura")
      .getAttribute("data-aura-hue");
    fireEvent.click(screen.getByTestId("mood-orb-option-good"));
    const auraAfter = screen
      .getByTestId("orb-aura")
      .getAttribute("data-aura-hue");
    expect(auraBefore).not.toBe(auraAfter);
  });

  it("does NOT idle-oscillate when reduced motion is requested", () => {
    shouldAnimateMock.mockReturnValue(false);
    render(<OrbPage />);
    const orbs = screen.getAllByTestId("valence-orb");
    for (const orb of orbs) {
      expect(orb.getAttribute("data-valence")).toBe("0");
    }
  });
});
