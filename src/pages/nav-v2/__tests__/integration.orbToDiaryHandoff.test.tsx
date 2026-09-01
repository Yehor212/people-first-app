import { readFileSync } from "node:fs";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useOrbMoodFlow } from "../useOrbMoodFlow";
import { DataWriteBarrierPostCommitError } from "@/hooks/useIndexedDB";
import { useDiaryDraftStore } from "@/stores/diaryDraftStore";
import { useMoodEntryDraftStore } from "@/stores/moodEntryDraftStore";
import type { MoodEntry } from "@/types";

const diaryPageSource = readFileSync("src/pages/nav-v2/DiaryPage.tsx", "utf8");
const journalModuleSource = readFileSync("src/features/journal/JournalModule.tsx", "utf8");

const setActivePageMock = vi.fn();
const setMoodsSpy = vi.fn();
const rewardUserSpy = vi.fn();
const onAddMoodMock = vi.fn();
const moodPersistenceMocks = vi.hoisted(() => ({
  persistMoodEntry: vi.fn<(entry: MoodEntry) => Promise<MoodEntry | undefined>>(() =>
    Promise.resolve(undefined),
  ),
}));
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

vi.mock("@/storage/repositories/moodsRepo", () => ({
  persistMoodEntryBeforeTransition: moodPersistenceMocks.persistMoodEntry,
}));

describe("Integration - Orb -> Diary handoff via pendingMoodContext", () => {
  beforeEach(() => {
    setActivePageMock.mockClear();
    setMoodsSpy.mockClear();
    rewardUserSpy.mockClear();
    onAddMoodMock.mockClear();
    moodPersistenceMocks.persistMoodEntry.mockReset();
    moodPersistenceMocks.persistMoodEntry.mockResolvedValue(undefined);
    useMoodEntryDraftStore.getState().reset();
    useDiaryDraftStore.getState().clearPendingMoodContext();
  });

  it("saves a mood without opening Diary or creating a pending entry suggestion", async () => {
    const { result } = renderHook(() =>
      useOrbMoodFlow({
        navigateToPage: setActivePageMock,
        onAddMood: onAddMoodMock,
      }),
    );

    act(() => result.current.handleSliderCommit(0.5));
    act(() => result.current.handleNextStep());
    act(() => result.current.handleEmotionToggle("hopeful"));
    act(() => result.current.handleNoteChange("Keep this private mood context."));

    await act(async () => {
      await result.current.handleSaveMood();
    });

    expect(onAddMoodMock).toHaveBeenCalledTimes(1);
    expect(onAddMoodMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mood: "good",
        valence: 0.5,
        emotionTags: ["hopeful"],
      }),
    );
    expect(setActivePageMock).not.toHaveBeenCalled();
    expect(useDiaryDraftStore.getState().pendingMoodContext).toBeNull();
    expect(useMoodEntryDraftStore.getState().valence).toBeNull();
    expect(result.current.step).toBe("orb-select");
  });

  it("writes enriched pendingMoodContext only on final transfer", async () => {
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
    await act(async () => {
      await result.current.handleOpenDiary();
    });

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

  it("keeps the draft and route until the mood write is durably accepted", async () => {
    let resolvePersistence!: (entry?: MoodEntry) => void;
    moodPersistenceMocks.persistMoodEntry.mockReturnValueOnce(
      new Promise<MoodEntry | undefined>((resolve) => {
        resolvePersistence = resolve;
      }),
    );
    const { result } = renderHook(() =>
      useOrbMoodFlow({
        navigateToPage: setActivePageMock,
        onAddMood: onAddMoodMock,
      }),
    );

    act(() => result.current.handleSliderCommit(0.5));
    act(() => result.current.handleNextStep());
    act(() => {
      void result.current.handleOpenDiary();
    });

    expect(result.current.step).toBe("refine-for-diary");
    expect(useMoodEntryDraftStore.getState().valence).toBe(0.5);
    expect(onAddMoodMock).not.toHaveBeenCalled();
    expect(setActivePageMock).not.toHaveBeenCalled();

    await act(async () => {
      resolvePersistence();
      await Promise.resolve();
    });

    expect(onAddMoodMock).toHaveBeenCalledTimes(1);
    expect(setActivePageMock).toHaveBeenCalledWith("diary");
    expect(useMoodEntryDraftStore.getState().valence).toBeNull();
  });

  it("preserves the draft and route when durable mood persistence fails", async () => {
    moodPersistenceMocks.persistMoodEntry.mockRejectedValueOnce(
      new Error("IndexedDB unavailable"),
    );
    const { result } = renderHook(() =>
      useOrbMoodFlow({
        navigateToPage: setActivePageMock,
        onAddMood: onAddMoodMock,
      }),
    );

    act(() => result.current.handleSliderCommit(-0.5));
    act(() => result.current.handleNextStep());
    await act(async () => {
      await result.current.handleOpenDiary();
    });

    expect(result.current.step).toBe("refine-for-diary");
    expect(useMoodEntryDraftStore.getState().valence).toBe(-0.5);
    expect(useDiaryDraftStore.getState().pendingMoodContext).toBeNull();
    expect(onAddMoodMock).not.toHaveBeenCalled();
    expect(setActivePageMock).not.toHaveBeenCalled();
  });

  it("continues with the exact durable mood after a post-commit finalization issue", async () => {
    moodPersistenceMocks.persistMoodEntry.mockImplementationOnce(async (entry: MoodEntry) => {
      throw new DataWriteBarrierPostCommitError(
        entry,
        "test-origin-generation",
        ["deferred-write-replay"],
      );
    });
    const { result } = renderHook(() =>
      useOrbMoodFlow({
        navigateToPage: setActivePageMock,
        onAddMood: onAddMoodMock,
      }),
    );

    act(() => result.current.handleSliderCommit(0.25));
    act(() => result.current.handleNextStep());
    await act(async () => {
      await result.current.handleOpenDiary();
    });

    expect(onAddMoodMock).toHaveBeenCalledTimes(1);
    expect(setActivePageMock).toHaveBeenCalledWith("diary");
    expect(useMoodEntryDraftStore.getState().valence).toBeNull();
    expect(result.current.moodSaveFailed).toBe(false);
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
