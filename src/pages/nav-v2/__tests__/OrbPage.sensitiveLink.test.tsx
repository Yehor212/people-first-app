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
      orbSkip: "Later",
      next: "Next",
      back: "Back",
      journalContinueWriting: "Continue writing",
      journalStartToday: "Start today's entry",
      howAreYouFeeling: "How are you feeling?",
      journalPrompt6: "How are you feeling right now?",
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
  haptics: { tabChanged: vi.fn(), light: vi.fn(), medium: vi.fn() },
  hapticSuccess: vi.fn(),
  hapticTap: vi.fn(),
  hapticSelection: vi.fn(),
  hapticMedium: vi.fn(),
}));

vi.mock("@/components/state-of-mind/ValenceOrb", () => ({
  CANONICAL_ORB_ANIMATION_SPEED: 0.72,
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

// Phase 3-B — ValenceSlider (old bar) restored on V2 OrbPage.
// Mock preserves the `mood-slider` testid used by sensitive-link tests.
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
        data-testid="mood-slider"
        onClick={() => onChange(0.5)}
        type="button"
      >
        slider good
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

describe("OrbPage — sensitive emotion integrity", () => {
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
    fireEvent.click(screen.getByTestId("orb-page-next"));
    const grid = screen.getByTestId("emotion-tag-grid");
    expect(grid.getAttribute("data-expandable")).toBe("true");
  });

  it("does not expose a support control before any emotion is chosen", () => {
    render(<OrbPage />);
    fireEvent.click(screen.getByTestId("mood-slider"));
    fireEvent.click(screen.getByTestId("orb-page-next"));
    expect(screen.queryByTestId("mood-support-link")).not.toBeInTheDocument();
  });

  it("does not expose a fake support destination for a sensitive emotion", () => {
    render(<OrbPage />);
    fireEvent.click(screen.getByTestId("mood-slider"));
    fireEvent.click(screen.getByTestId("orb-page-next"));
    fireEvent.click(screen.getByTestId("emotion-tag-mock-hopeless"));
    expect(screen.queryByTestId("mood-support-link")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Need support?" })).not.toBeInTheDocument();
  });
});
