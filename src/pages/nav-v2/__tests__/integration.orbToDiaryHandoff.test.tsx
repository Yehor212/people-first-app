/**
 * Phase 3-A.4c-ii-d-c Integration Test #1 — Orb → Diary handoff via
 * `useDiaryDraftStore.pendingMoodContext`.
 *
 * Covers:
 *  - OrbPage confirm flow writes `pendingMoodContext` with the full shape
 *    documented in src/stores/diaryDraftStore.ts (valence/scope/specificTime/
 *    emotion/committedAt).
 *  - `setActivePage('diary')` fires after the draft store is populated.
 *  - (contract test) DiaryPage currently is a placeholder — it does NOT yet
 *    consume `pendingMoodContext`. We assert the CURRENT behaviour (draft
 *    survives a DiaryPage mount) + skip the "consumes and clears" assertion
 *    with a documented `it.skip` pointing at Phase 3-D (JournalModule wire-up).
 *
 * AAA pattern throughout. External deps (motion, language, stores partially
 * shallow-mocked) follow existing `OrbPage.test.tsx` conventions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { OrbPage } from "../OrbPage";
import { DiaryPage } from "../DiaryPage";
import { useDiaryDraftStore } from "@/stores/diaryDraftStore";
import { useMoodEntryDraftStore } from "@/stores/moodEntryDraftStore";

// --- Mocks (mirrored from OrbPage.test.tsx for consistency) ---

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

vi.mock("../MoodOrbPicker", () => ({
  MoodOrbPicker: ({
    onChange,
  }: {
    value: string | null;
    onChange: (m: string | null) => void;
  }) => (
    <button
      type="button"
      data-testid="mood-orb-option-okay"
      onClick={() => onChange("okay")}
    >
      okay orb
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

// MoodConfirmCta has a 5-second undo timer before onConfirm fires — stub it
// to fire synchronously so we can assert the downstream handoff.
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
      <button
        type="button"
        data-testid="orb-confirm-skip"
        onClick={onSkip}
      >
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

describe("Integration #1 — Orb → Diary handoff via pendingMoodContext", () => {
  beforeEach(() => {
    setActivePageMock.mockClear();
    setMoodsSpy.mockClear();
    useMoodEntryDraftStore.getState().reset();
    useDiaryDraftStore.getState().clearPendingMoodContext();
  });

  it("writes pendingMoodContext when the orb confirm flow completes", () => {
    // Arrange
    render(<OrbPage />);

    // Act — pick mood, pick emotion, confirm
    act(() => {
      fireEvent.click(screen.getByTestId("mood-orb-option-okay"));
    });
    act(() => {
      fireEvent.click(screen.getByTestId("emotion-tag-hopeful"));
    });
    act(() => {
      fireEvent.click(screen.getByTestId("orb-confirm-save"));
    });

    // Assert — contract shape, not speculative task-spec shape
    const ctx = useDiaryDraftStore.getState().pendingMoodContext;
    expect(ctx).not.toBeNull();
    expect(ctx).toMatchObject({
      valence: 0, // "okay" → 0
      scope: "now",
      specificTime: null,
      emotion: "hopeful",
    });
    expect(typeof ctx?.committedAt).toBe("number");
    expect(ctx?.committedAt).toBeGreaterThan(0);

    // Navigation fired
    expect(setActivePageMock).toHaveBeenCalledWith("diary");

    // Mood persisted
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
    // Confirm is disabled because emotion was never chosen. Clicking = no-op.
    const save = screen.getByTestId("orb-confirm-save");
    expect(save.disabled).toBe(true);
    act(() => {
      fireEvent.click(save);
    });
    expect(useDiaryDraftStore.getState().pendingMoodContext).toBeNull();
    expect(setActivePageMock).not.toHaveBeenCalled();
  });

  it("DiaryPage mount preserves pendingMoodContext (no consumer yet)", () => {
    // Arrange — simulate upstream orb handoff
    useDiaryDraftStore.getState().setPendingMoodContext({
      valence: 0.5,
      scope: "now",
      specificTime: null,
      emotion: "hopeful",
      committedAt: 1_700_000_000_000,
    });

    // Act
    render(<DiaryPage />);

    // Assert — placeholder should NOT clear the context. Phase 3-D will add
    // a consumer. Until then we document the current contract: draft survives.
    expect(useDiaryDraftStore.getState().pendingMoodContext).not.toBeNull();
    expect(
      useDiaryDraftStore.getState().pendingMoodContext?.emotion,
    ).toBe("hopeful");
  });

  it.skip("DiaryPage mount consumes + clears pendingMoodContext [Phase 3-D]", () => {
    // Will enable after JournalModule is wired into DiaryPage.
    // Assertion target:
    //   expect(useDiaryDraftStore.getState().pendingMoodContext).toBeNull();
    //   expect(draft.mood).toEqual({ valence: 0.5, emotion: "hopeful", ... });
  });
});
