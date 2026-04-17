import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OrbPage } from "../OrbPage";
import { useMoodEntryDraftStore } from "@/stores/moodEntryDraftStore";
import { useDiaryDraftStore } from "@/stores/diaryDraftStore";

// --- Mocks — mirror OrbPage.test.tsx with 4c-ii-c additions ---

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
      emotionMorePrecise: "More precise",
      moodSupportLink: "Need support?",
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
    <div data-testid="valence-orb" data-valence={valence} data-size={size}>
      orb
    </div>
  ),
}));

// Expose `expandable` prop on the stub + offer three emotion tags so tests
// can drive sensitive vs non-sensitive selection.
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
        data-testid="emotion-tag-mock-hopeful"
        data-selected={selected.includes("hopeful")}
        onClick={() => onToggle("hopeful")}
        type="button"
      >
        hopeful
      </button>
      <button
        data-testid="emotion-tag-mock-hopeless"
        data-selected={selected.includes("hopeless")}
        onClick={() => onToggle("hopeless")}
        type="button"
      >
        hopeless
      </button>
      <button
        data-testid="emotion-tag-mock-happy"
        data-selected={selected.includes("happy")}
        onClick={() => onToggle("happy")}
        type="button"
      >
        happy
      </button>
    </div>
  ),
}));

vi.mock("@/features/journal", () => ({
  MoodSlider: ({
    onChange,
    showEmojis,
  }: {
    onChange: (m: string) => void;
    showEmojis?: boolean;
  }) => (
    <button
      data-testid="mood-slider"
      data-show-emojis={String(showEmojis ?? true)}
      onClick={() => onChange("good")}
      type="button"
    >
      slider
    </button>
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
const moodsSnapshot = { moods: [], userName: "Yehor", setMoods: setMoodsSpy };
vi.mock("@/stores", () => ({
  useUserDataStore: (selector: (s: unknown) => unknown) =>
    selector(moodsSnapshot),
}));

let mockAppliedTheme: "ink" | "paper" = "ink";
vi.mock("@/stores/themeStore", () => ({
  useThemeStore: (selector: (s: unknown) => unknown) =>
    selector({ appliedTheme: mockAppliedTheme }),
}));

vi.mock("@/hooks/useShouldAnimate", () => ({
  useShouldAnimate: () => true,
}));

vi.mock("@/lib/motion", () => ({
  Bloom: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("OrbPage — Phase 3-A.4c-ii-c sensitive emotion support link", () => {
  beforeEach(() => {
    setMoodsSpy.mockClear();
    setActivePageMock.mockClear();
    mockAppliedTheme = "ink";
    useMoodEntryDraftStore.getState().reset();
    useDiaryDraftStore.getState().clearPendingMoodContext();
    window.localStorage.setItem("zenflow-orb-first-run-dismissed", "1");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- progressive disclosure wiring ---
  it("passes expandable=true to EmotionTagGrid on OrbPage", () => {
    render(<OrbPage />);
    fireEvent.click(screen.getByTestId("mood-slider"));
    const grid = screen.getByTestId("emotion-tag-grid");
    expect(grid.getAttribute("data-expandable")).toBe("true");
  });

  // --- sensitive-link visibility ---
  it("hides support link before any emotion is chosen", () => {
    render(<OrbPage />);
    fireEvent.click(screen.getByTestId("mood-slider"));
    expect(screen.queryByTestId("mood-support-link")).not.toBeInTheDocument();
  });

  it("hides support link when a non-sensitive emotion is chosen", () => {
    render(<OrbPage />);
    fireEvent.click(screen.getByTestId("mood-slider"));
    fireEvent.click(screen.getByTestId("emotion-tag-mock-happy"));
    expect(screen.queryByTestId("mood-support-link")).not.toBeInTheDocument();
  });

  it("reveals support link when a sensitive emotion (hopeless) is chosen", () => {
    render(<OrbPage />);
    fireEvent.click(screen.getByTestId("mood-slider"));
    fireEvent.click(screen.getByTestId("emotion-tag-mock-hopeless"));
    expect(screen.getByTestId("mood-support-link")).toBeInTheDocument();
  });

  it("support link uses the i18n moodSupportLink copy", () => {
    render(<OrbPage />);
    fireEvent.click(screen.getByTestId("mood-slider"));
    fireEvent.click(screen.getByTestId("emotion-tag-mock-hopeless"));
    expect(screen.getByTestId("mood-support-link")).toHaveTextContent(
      "Need support?",
    );
  });

  // --- scope-aware styling ---
  it("support link styling uses cosmic (white/50) palette on dark theme", () => {
    render(<OrbPage />);
    fireEvent.click(screen.getByTestId("mood-slider"));
    fireEvent.click(screen.getByTestId("emotion-tag-mock-hopeless"));
    const link = screen.getByTestId("mood-support-link");
    expect(link.className).toContain("text-white/50");
    expect(link.className).not.toContain("text-warm-brown-ink/50");
  });

  it("support link styling switches to warm-brown on day (paper) theme", () => {
    mockAppliedTheme = "paper";
    render(<OrbPage />);
    fireEvent.click(screen.getByTestId("mood-slider"));
    fireEvent.click(screen.getByTestId("emotion-tag-mock-hopeless"));
    const link = screen.getByTestId("mood-support-link");
    expect(link.className).toContain("text-warm-brown-ink/50");
    expect(link.className).not.toContain("text-white/50");
  });

  // --- interaction ---
  it("support link calls preventDefault (stub route for future /support)", () => {
    render(<OrbPage />);
    fireEvent.click(screen.getByTestId("mood-slider"));
    fireEvent.click(screen.getByTestId("emotion-tag-mock-hopeless"));
    const link = screen.getByTestId("mood-support-link");
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    const propagated = link.dispatchEvent(event);
    // dispatchEvent returns false when preventDefault was called on a
    // cancelable event.
    expect(propagated).toBe(false);
  });

  it("support link disappears when the sensitive choice is toggled off", () => {
    render(<OrbPage />);
    fireEvent.click(screen.getByTestId("mood-slider"));
    fireEvent.click(screen.getByTestId("emotion-tag-mock-hopeless"));
    expect(screen.getByTestId("mood-support-link")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("emotion-tag-mock-hopeless"));
    expect(screen.queryByTestId("mood-support-link")).not.toBeInTheDocument();
  });
});
