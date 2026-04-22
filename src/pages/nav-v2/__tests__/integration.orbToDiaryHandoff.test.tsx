/**
 * Integration Test — Orb -> Diary handoff via `useDiaryDraftStore`.
 *
 * Covers:
 *  - Orb confirm writes the transient mood context and navigates to Diary.
 *  - DiaryPage forwards that handoff as a soft diary suggestion while keeping
 *    the history-first shell intact.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { OrbPage } from "../OrbPage";
import { DiaryPage } from "../DiaryPage";
import { useDiaryDraftStore } from "@/stores/diaryDraftStore";
import { useMoodEntryDraftStore } from "@/stores/moodEntryDraftStore";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      goodMorning: "Good morning",
      goodAfternoon: "Good afternoon",
      goodEvening: "Good evening",
      somLogFeeling: "Log how you feel",
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
      orbConfirm: "Save",
      orbSkip: "Later",
      orbFirstRunTitle: "Three steps",
      orbFirstRunStep1: "A",
      orbFirstRunStep2: "B",
      orbFirstRunStep3: "C",
      orbFirstRunGotIt: "Got it",
      navV2Diary: "Diary",
      howAreYouFeeling: "How are you feeling?",
      journalPrompt4: "Describe a moment that stood out today.",
      journalPrompt6: "How are you feeling right now?",
      journalPrompt7: "What would you like to remember about today?",
      reflectionEvening: "How was your day? Even one word helps.",
      loading: "Loading...",
      diary: "Diary",
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
  ValenceSlider: ({
    onChange,
  }: {
    value: number;
    onChange: (v: number) => void;
  }) => (
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

vi.mock("../MoodConfirmCta", () => ({
  MoodConfirmCta: ({
    enabled,
    onConfirm,
    onSkip,
  }: {
    enabled: boolean;
    onConfirm: () => void;
    onSkip: () => void;
  }) => (
    <>
      <button
        type="button"
        data-testid="orb-confirm-save"
        disabled={!enabled}
        onClick={() => enabled && onConfirm()}
      >
        Save
      </button>
      <button type="button" data-testid="orb-confirm-skip" onClick={onSkip}>
        Later
      </button>
    </>
  ),
}));

vi.mock("../MoodScopeSelector", () => ({
  MoodScopeSelector: () => <div data-testid="mood-scope-selector-stub" />,
}));

vi.mock("../MoodFirstRunHint", () => ({
  MoodFirstRunHint: () => null,
}));

vi.mock("@/components/state-of-mind/emotionTags", () => ({
  isSensitiveTag: () => false,
}));

vi.mock("@/components/state-of-mind/StateOfMindModal", () => ({
  StateOfMindModal: () => null,
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
    useMoodEntryDraftStore.getState().reset();
    useDiaryDraftStore.getState().clearPendingMoodContext();
  });

  it("writes pendingMoodContext when the orb confirm flow completes", () => {
    render(<OrbPage />);

    act(() => {
      fireEvent.click(screen.getByTestId("mood-orb-option-okay"));
    });
    act(() => {
      fireEvent.click(screen.getByTestId("emotion-tag-hopeful"));
    });
    act(() => {
      fireEvent.click(screen.getByTestId("orb-confirm-save"));
    });

    const ctx = useDiaryDraftStore.getState().pendingMoodContext;
    expect(ctx).not.toBeNull();
    expect(ctx).toMatchObject({
      valence: 0,
      scope: "now",
      specificTime: null,
      emotion: "hopeful",
    });
    expect(typeof ctx?.committedAt).toBe("number");
    expect(ctx?.committedAt).toBeGreaterThan(0);
    expect(setActivePageMock).toHaveBeenCalledWith("diary");
    expect(setMoodsSpy).toHaveBeenCalledTimes(1);
  });

  it("does NOT write pendingMoodContext on skip", () => {
    render(<OrbPage />);
    act(() => {
      fireEvent.click(screen.getByTestId("mood-orb-option-okay"));
    });
    act(() => {
      fireEvent.click(screen.getByTestId("orb-confirm-skip"));
    });
    expect(useDiaryDraftStore.getState().pendingMoodContext).toBeNull();
  });

  it("does NOT write pendingMoodContext if emotion is missing (confirm disabled)", () => {
    render(<OrbPage />);
    act(() => {
      fireEvent.click(screen.getByTestId("mood-orb-option-okay"));
    });

    const save = screen.getByTestId("orb-confirm-save");
    expect(save.getAttribute("disabled")).not.toBeNull();
    act(() => {
      fireEvent.click(save);
    });

    expect(useDiaryDraftStore.getState().pendingMoodContext).toBeNull();
    expect(setActivePageMock).not.toHaveBeenCalled();
  });

  it("DiaryPage keeps pendingMoodContext until the suggestion is consumed", async () => {
    useDiaryDraftStore.getState().setPendingMoodContext({
      valence: 0.5,
      scope: "now",
      specificTime: null,
      emotion: "hopeful",
      committedAt: 1_700_000_000_000,
    });

    render(<DiaryPage />);
    await screen.findByTestId("journal-module-stub");

    expect(useDiaryDraftStore.getState().pendingMoodContext).toMatchObject({
      emotion: "hopeful",
      scope: "now",
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
      scope: "now",
      prefill: {
        title: "Hopeful",
        mood: "good",
        tags: ["hopeful"],
      },
    });

    act(() => {
      (capturedJournalModuleProps?.onInitialEntrySuggestionConsumed as (() => void) | undefined)?.();
    });

    expect(useDiaryDraftStore.getState().pendingMoodContext).toBeNull();
  });

  it("DiaryPage preserves specific-time context inside the handed-off prefill", async () => {
    useDiaryDraftStore.getState().setPendingMoodContext({
      valence: -0.1,
      scope: "specific",
      specificTime: "14:30",
      emotion: "curious",
      committedAt: 1_700_000_000_100,
    });

    render(<DiaryPage />);
    await screen.findByTestId("journal-module-stub");

    expect(capturedInitialSuggestion).toMatchObject({
      source: "orb",
      emotion: "curious",
      mood: "okay",
      scope: "specific",
      specificTime: "14:30",
      prefill: {
        title: "Curious",
        mood: "okay",
        tags: ["curious"],
      },
    });
    const prefill = capturedInitialSuggestion?.prefill as Record<string, unknown> | undefined;
    expect(String(prefill?.content)).toContain("Specific - 14:30");
  });
});
