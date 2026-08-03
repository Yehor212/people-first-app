import { readFileSync } from "node:fs";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useOrbMoodFlow } from "../useOrbMoodFlow";
import { useDiaryDraftStore } from "@/stores/diaryDraftStore";
import { useMoodEntryDraftStore } from "@/stores/moodEntryDraftStore";

const diaryPageSource = readFileSync("src/pages/nav-v2/DiaryPage.tsx", "utf8");
const journalModuleSource = readFileSync("src/features/journal/JournalModule.tsx", "utf8");

const setActivePageMock = vi.fn();
const setMoodsSpy = vi.fn();
const rewardUserSpy = vi.fn();
const onAddMoodMock = vi.fn();
const moodsSnapshot = { moods: [], userName: "Yehor", setMoods: setMoodsSpy };

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

vi.mock("@/stores", () => ({
  useUserDataStore: (selector: (s: unknown) => unknown) => selector(moodsSnapshot),
  useGamificationStore: (selector: (s: unknown) => unknown) =>
    selector({ rewardUser: rewardUserSpy }),
}));

vi.mock("@/hooks/useShouldAnimate", () => ({
  useShouldAnimate: () => false,
}));

vi.mock("@/hooks/useMoodHandlers", () => ({
  commitMoodEntry: vi.fn(),
}));

describe("Integration - Orb -> Diary handoff via pendingMoodContext", () => {
  beforeEach(() => {
    setActivePageMock.mockClear();
    setMoodsSpy.mockClear();
    rewardUserSpy.mockClear();
    onAddMoodMock.mockClear();
    useMoodEntryDraftStore.getState().reset();
    useDiaryDraftStore.getState().clearPendingMoodContext();
  });

  it("writes enriched pendingMoodContext only on final transfer", () => {
    const { result } = renderHook(() =>
      useOrbMoodFlow({
        navigateToPage: setActivePageMock,
        onAddMood: onAddMoodMock,
      }),
    );

    expect(useDiaryDraftStore.getState().pendingMoodContext).toBeNull();

    act(() => result.current.handleSliderCommit(0));
    expect(useDiaryDraftStore.getState().pendingMoodContext).toBeNull();

    act(() => result.current.handleNextStep());
    expect(useDiaryDraftStore.getState().pendingMoodContext).toBeNull();

    act(() => result.current.handleEmotionToggle("hopeful"));
    act(() => result.current.handleNoteChange("A steady moment worth keeping."));
    act(() => result.current.handleOpenDiary());

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

  it("Diary keeps the orb handoff as a pending user-confirmed suggestion", () => {
    expect(diaryPageSource).toContain("initialEntrySuggestion={initialEntrySuggestion}");
    expect(diaryPageSource).not.toContain("autoCreateInitialEntry");

    expect(journalModuleSource).toContain("handleNewEntryWithPrefill(suggestion.prefill)");
    expect(journalModuleSource).not.toContain("portalEntryPrefill ?? initialSuggestionRef.current?.prefill");
    expect(journalModuleSource).toMatch(
      /const hasInitialEntrySuggestion =\s*!!initialEntrySuggestion &&\s*!!initialSuggestionRef\.current &&\s*!initialSuggestionConsumedRef\.current &&\s*deferredInitialSuggestionKey !== currentInitialSuggestionKey &&\s*journal\.view === "list";/,
    );
    expect(journalModuleSource).toMatch(/const visibleExtraSuggestions = useMemo\([\s\S]*?showEntrySuggestionCards/);
  });

  it("keeps V2 diary saves out of XP, treat, and reward-audio behavior", () => {
    expect(diaryPageSource).toContain("rewardsEnabled={false}");
    expect(journalModuleSource).toContain("rewardsEnabled?: boolean");
    expect(journalModuleSource).toContain("rewardsEnabled = true");
    expect(journalModuleSource).toContain("if (isNew && rewardsEnabled)");

    const rewardBlock = journalModuleSource.match(
      /if \(isNew && rewardsEnabled\) \{[\s\S]*?const handleDeleteEntry/,
    )?.[0];
    expect(rewardBlock).toContain('rewardUser("journal"');
    expect(rewardBlock).toContain("playStreakMilestone");
  });
});
