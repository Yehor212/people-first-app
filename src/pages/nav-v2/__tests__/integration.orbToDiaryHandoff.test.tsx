import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { DiaryPage } from "../DiaryPage";
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
      orbWhisper1: "whisper",
      orbWhisper2: "whisper",
      orbWhisper3: "whisper",
      orbWhisper4: "whisper",
      orbWhisper5: "whisper",
      orbScopeGroupLabel: "When?",
      orbScopeNow: "Now",
      orbScopeDay: "Day",
      orbScopeSpecific: "Specific",
      orbScopeSpecificTimeLabel: "Pick time",
      orbSkip: "Later",
      orbFirstRunTitle: "Three steps",
      orbFirstRunStep1: "A",
      orbFirstRunStep2: "B",
      orbFirstRunStep3: "C",
      orbFirstRunGotIt: "Got it",
      navV2Diary: "Diary",
      diary: "Diary",
      loading: "Loading...",
      moodGreat: "Great",
      moodGood: "Good",
      moodOkay: "Okay",
      moodBad: "Bad",
      moodTerrible: "Terrible",
      somTagHopeful: "Hopeful",
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
  ValenceOrb: () => <div data-testid="valence-orb" />,
}));

vi.mock("@/components/state-of-mind/EmotionTagGrid", () => ({
  EmotionTagGrid: ({ onToggle }: { onToggle: (tag: string) => void }) => (
    <button
      type="button"
      data-testid="emotion-tag-hopeful"
      onClick={() => onToggle("hopeful")}
    >
      hopeful
    </button>
  ),
}));

vi.mock("@/components/state-of-mind/ValenceSlider", () => ({
  ValenceSlider: ({ onChange }: { value: number; onChange: (v: number) => void }) => (
    <button
      type="button"
      data-testid="mood-orb-option-okay"
      onClick={() => onChange(0)}
    >
      okay slider
    </button>
  ),
}));

vi.mock("../CosmicBgAdapter", () => ({
  CosmicBgAdapter: () => <div data-testid="cosmic-orb-background" />,
}));

vi.mock("../ShootingStar", () => ({
  ShootingStar: () => <div />,
}));

vi.mock("../useCosmicParallax", () => ({
  useCosmicParallax: () => ({ current: null }),
}));

vi.mock("../MoodFirstRunHint", () => ({
  MoodFirstRunHint: () => null,
}));

vi.mock("@/components/state-of-mind/emotionTags", () => ({
  EMOTION_TAGS: [{ key: "hopeful", minValence: -1, maxValence: 1 }],
  isSensitiveTag: () => false,
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
const moodsSnapshot = { moods: [], userName: "Yehor", setMoods: setMoodsSpy };
vi.mock("@/stores", () => ({
  useUserDataStore: (selector: (s: unknown) => unknown) => selector(moodsSnapshot),
}));

vi.mock("@/stores/themeStore", () => ({
  useThemeStore: (selector: (s: unknown) => unknown) =>
    selector({ appliedTheme: "paper" }),
}));

vi.mock("@/hooks/useShouldAnimate", () => ({
  useShouldAnimate: () => false,
}));

vi.mock("@/lib/motion", () => ({
  Bloom: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

let capturedJournalModuleProps: Record<string, unknown> | null = null;
let capturedInitialSuggestion: Record<string, unknown> | null = null;
vi.mock("@/features/journal/JournalModule", () => ({
  JournalModule: (props: Record<string, unknown>) => {
    capturedJournalModuleProps = props;
    if (props.initialEntrySuggestion && !capturedInitialSuggestion) {
      capturedInitialSuggestion = props.initialEntrySuggestion as Record<string, unknown>;
    }

    return <div data-testid="journal-module-stub" />;
  },
}));

describe("Integration — Orb -> Diary handoff via pendingMoodContext", () => {
  beforeEach(() => {
    capturedJournalModuleProps = null;
    capturedInitialSuggestion = null;
    setActivePageMock.mockClear();
    setMoodsSpy.mockClear();
    onAddMoodMock.mockClear();
    useMoodEntryDraftStore.getState().reset();
    useDiaryDraftStore.getState().clearPendingMoodContext();
  });

  it("writes enriched pendingMoodContext only on final transfer", () => {
    render(<OrbPage onAddMood={onAddMoodMock} />);

    fireEvent.click(screen.getByTestId("mood-orb-option-okay"));
    fireEvent.click(screen.getByTestId("orb-page-next"));
    expect(screen.getByTestId("orb-page-refine")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("emotion-tag-hopeful"));
    fireEvent.change(screen.getByTestId("orb-page-note-input"), {
      target: { value: "A steady moment worth keeping." },
    });
    fireEvent.click(screen.getByTestId("orb-page-open-diary"));

    const ctx = useDiaryDraftStore.getState().pendingMoodContext;
    expect(ctx).toMatchObject({
      valence: 0,
      mood: "okay",
      scope: "now",
      specificTime: null,
      emotion: "hopeful",
      note: "A steady moment worth keeping.",
    });
    expect(typeof ctx?.committedAt).toBe("number");
    expect(setActivePageMock).toHaveBeenCalledWith("diary");
    expect(onAddMoodMock).toHaveBeenCalledTimes(1);
    expect(setMoodsSpy).not.toHaveBeenCalled();
  });

  it("keeps pendingMoodContext null before the user continues", () => {
    render(<OrbPage onAddMood={onAddMoodMock} />);
    expect(screen.queryByTestId("orb-page-skip")).toBeNull();
    expect(useDiaryDraftStore.getState().pendingMoodContext).toBeNull();
  });

  it("DiaryPage keeps history-first behavior and forwards a draft-card suggestion", async () => {
    useDiaryDraftStore.getState().setPendingMoodContext({
      valence: 0.5,
      mood: "good",
      scope: "specific",
      specificTime: "14:30",
      emotion: "hopeful",
      note: "I want to keep this with me.",
      committedAt: 1_700_000_000_000,
    });

    render(<DiaryPage />);
    await screen.findByTestId("journal-module-stub", {}, { timeout: 10_000 });

    expect(useDiaryDraftStore.getState().pendingMoodContext).toMatchObject({
      emotion: "hopeful",
      scope: "specific",
    });
    expect(capturedJournalModuleProps).toMatchObject({
      startOpen: true,
      disableCardShell: true,
      hideCloseButton: true,
      presentation: "page",
    });
    expect(capturedInitialSuggestion).toMatchObject({
      source: "orb",
      emotion: "hopeful",
      mood: "good",
      scope: "specific",
      specificTime: "14:30",
      note: "I want to keep this with me.",
    });

    const prefill = capturedInitialSuggestion?.prefill as Record<string, unknown>;
    expect(prefill.title).toBe("Hopeful");
    expect(String(prefill.content)).toContain("I want to keep this with me.");
  });
});
