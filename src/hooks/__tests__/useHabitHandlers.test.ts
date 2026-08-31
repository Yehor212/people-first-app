/**
 * useHabitHandlers Hook Tests
 * Tests habit CRUD, toggle, adjust, double-click guard, and sync triggers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { ENTRY, type Habit } from "@/types";
import { makeTestHabit, datesToEntries } from "@/test/habitFixtures";
import { getToday } from "@/lib/utils";

// --- mocks ---

const mockSetHabits = vi.fn();
const mockSetScheduleEvents = vi.fn();
const mockSetReminders = vi.fn((updater: unknown) => {
  if (typeof updater === "function") updater({ habitIds: [], enabled: false, time: "08:00" });
});
const mockSetConfettiBurst = vi.fn();
const mockTriggerSync = vi.fn();
const mockSyncHabitCompletion = vi.fn(() => Promise.resolve());
const mockHabits = [
  makeTestHabit({
    id: "h1",
    name: "Meditate",
    icon: "🧘",
    entries: {},
  }),
  makeTestHabit({
    id: "h2",
    name: "Water",
    icon: "💧",
    habitType: "numerical",
    targetValue: 3,
    entries: {},
  }),
  makeTestHabit({
    id: "h3",
    name: "Less Sugar",
    icon: "🍬",
    habitType: "numerical",
    targetValue: 2,
    targetType: "atMost",
    entries: {},
  }),
];
const mockCommitHabitToggle = vi.fn(
  async (habitId: string, date: string): Promise<{ habit: Habit; nextValue: number }> => {
    const habit = mockHabits.find((item) => item.id === habitId);
    if (!habit) throw new Error(`Habit ${habitId} no longer exists`);
    return {
      habit: {
        ...habit,
        entries: { ...habit.entries, [date]: { value: ENTRY.YES_MANUAL } },
      },
      nextValue: ENTRY.YES_MANUAL,
    };
  },
);
const mockCommitHabitEntry = vi.fn(
  async (habitId: string, date: string, value: number): Promise<Habit> => {
    const habit = mockHabits.find((item) => item.id === habitId);
    if (!habit) throw new Error(`Habit ${habitId} no longer exists`);
    return { ...habit, entries: { ...habit.entries, [date]: { value } } };
  },
);

vi.mock("@/stores", () => ({
  useUserDataStore: vi.fn((sel: (s: Record<string, unknown>) => unknown) =>
    sel({
      habits: mockHabits,
      setHabits: mockSetHabits,
      setScheduleEvents: mockSetScheduleEvents,
      setReminders: mockSetReminders,
    })
  ),
  useUIStore: vi.fn((sel: (s: Record<string, unknown>) => unknown) =>
    sel({
      setConfettiBurst: mockSetConfettiBurst,
    })
  ),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: vi.fn(() => ({ language: "en", t: {} })),
}));

vi.mock("@/components/XpPopup", () => ({
  triggerXpPopup: vi.fn(),
}));

vi.mock("@/storage/cloudSync", () => ({
  triggerSync: (...args: unknown[]) => mockTriggerSync(...args),
}));

vi.mock("@/storage/realtimeSync", () => ({
  syncHabit: vi.fn(() => Promise.resolve()),
  syncHabitCompletion: (...args: Parameters<typeof mockSyncHabitCompletion>) =>
    mockSyncHabitCompletion(...args),
  deleteHabitFromCloud: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/storage/deletionTracker", () => ({
  DELETION_TRACKER_KEYS: {
    habit: "zenflow-deleted-habit-ids",
    journal: "zenflow-deleted-journal-entry-ids",
    mood: "zenflow-deleted-mood-ids",
    focus: "zenflow-deleted-focus-session-ids",
    gratitude: "zenflow-deleted-gratitude-ids",
  },
  getDeletedHabitIds: vi.fn(() => Promise.resolve(new Set())),
  trackDeletedHabitId: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/storage/habitCompletionCommit", () => ({
  commitHabitEntry: (...args: Parameters<typeof mockCommitHabitEntry>) =>
    mockCommitHabitEntry(...args),
  commitHabitToggle: (...args: Parameters<typeof mockCommitHabitToggle>) =>
    mockCommitHabitToggle(...args),
}));

vi.mock("@/lib/audioManager", () => ({
  playSound: vi.fn(),
}));

vi.mock("@/lib/haptics", () => ({
  haptics: {
    habitToggled: vi.fn(() => Promise.resolve()),
    habitCompleted: vi.fn(() => Promise.resolve()),
  },
  hapticTap: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/habits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/habits")>();
  return {
    ...actual,
    normalizeHabit: vi.fn((h: unknown) => h),
  };
});

vi.mock("@/lib/habitTemplates", () => ({
  findTemplateIdByName: vi.fn(() => null),
  getHabitTemplateName: vi.fn((id: string) => id),
}));

vi.mock("@/storage/friendsSync", () => ({
  addFriendActivity: vi.fn(),
  loadMyProfile: vi.fn(() => null),
}));

vi.mock("@/lib/comebackChallenge", () => ({
  recordHabitForChallenge: vi.fn(() => ({ challengeComplete: false, bonusXp: 0 })),
}));

vi.mock("@/lib/randomQuests", () => ({
  updateAllQuestsProgress: vi.fn(() => []),
}));

vi.mock("@/lib/challengeStorage", () => ({
  getChallenges: vi.fn(() => []),
  saveChallenges: vi.fn(),
}));

vi.mock("@/lib/storageKeys", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storageKeys")>();
  return {
    ...actual,
    SK: { ...actual.SK, SPECIAL_BADGES: "zenflow-special-badges" },
  };
});

vi.mock("@/lib/safeJson", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/safeJson")>();
  return {
    ...actual,
    safeLocalStorageGet: vi.fn(() => ({})),
    safeLocalStorageSet: vi.fn(() => true),
  };
});

// --- import under test after mocks ---

import { useHabitHandlers } from "../useHabitHandlers";
import { useUserDataStore } from "@/stores";
import { playSound } from "@/lib/audioManager";

describe("useHabitHandlers", () => {
  const mockAwardXp = vi.fn();
  const mockEarnTreats = vi.fn(() => ({ earned: 10, bonus: 0, multiplier: 1, newBalance: 10 }));
  const mockPlantSeed = vi.fn();
  const mockWaterPlants = vi.fn();
  const mockUpdateChallengeProgress = vi.fn();
  const mockCheckForFeatureUnlocks = vi.fn();

  const defaultParams = {
    awardXp: mockAwardXp,
    earnTreats: mockEarnTreats,
    plantSeed: mockPlantSeed,
    waterPlants: mockWaterPlants,
    updateChallengeProgress: mockUpdateChallengeProgress,
    checkForFeatureUnlocks: mockCheckForFeatureUnlocks,
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  /** Helper: render and clear mocks that fire from the language useEffect on mount */
  function renderAndClearEffects() {
    const hook = renderHook(() => useHabitHandlers(defaultParams));
    // The language-localization useEffect fires setHabits on mount,
    // so clear mock call history before testing individual handlers.
    mockSetHabits.mockClear();
    mockTriggerSync.mockClear();
    return hook;
  }

  /** Helper: get the last updater function passed to setHabits */
  function lastSetHabitsUpdater(): (prev: Habit[]) => Habit[] {
    const calls = mockSetHabits.mock.calls;
    return calls[calls.length - 1][0] as (prev: Habit[]) => Habit[];
  }

  it("handleAddHabit adds habit to array", () => {
    const { result } = renderAndClearEffects();

    const newHabit = makeTestHabit({
      id: "h-new",
      name: "Read",
      icon: "📖",
      entries: {},
    });

    act(() => {
      result.current.handleAddHabit(newHabit);
    });

    expect(mockSetHabits).toHaveBeenCalledWith(expect.any(Function));
    const updated = lastSetHabitsUpdater()([]);
    expect(updated).toHaveLength(1);
    expect(updated[0].id).toBe("h-new");
  });

  it("handleUpdateHabit replaces habit by id", () => {
    const { result } = renderAndClearEffects();

    const updatedHabit = { ...mockHabits[0], name: "Yoga" };

    act(() => {
      result.current.handleUpdateHabit(updatedHabit);
    });

    const updated = lastSetHabitsUpdater()(mockHabits);
    expect(updated[0].name).toBe("Yoga");
    expect(updated[1].id).toBe("h2"); // unchanged
  });

  it("handleDeleteHabit filters by id", () => {
    const { result } = renderAndClearEffects();

    act(() => {
      result.current.handleDeleteHabit("h1");
    });

    const updated = lastSetHabitsUpdater()(mockHabits);
    expect(updated).toHaveLength(2);
    expect(updated.find((h) => h.id === "h1")).toBeUndefined();
  });

  it("handleToggleHabit publishes a durable daily completion", async () => {
    const { result } = renderAndClearEffects();

    await act(async () => {
      await result.current.handleToggleHabit("h1", "2026-02-19");
    });

    expect(mockCommitHabitToggle).toHaveBeenCalledWith(
      "h1",
      "2026-02-19",
      "calendar",
    );
    const updated = lastSetHabitsUpdater()(mockHabits);
    const habit = updated.find((h) => h.id === "h1");
    expect(habit?.entries["2026-02-19"]?.value).toBe(ENTRY.YES_MANUAL);
    expect(mockAwardXp).toHaveBeenCalledWith("habit");
    expect(playSound).toHaveBeenCalledWith("complete");
  });

  it("preserves quick-tap provenance for a completion logged today", async () => {
    const { result } = renderAndClearEffects();
    const today = getToday();

    await act(async () => {
      await result.current.handleToggleHabit("h1", today);
    });

    expect(mockCommitHabitToggle).toHaveBeenCalledWith("h1", today, "quickTap");
  });

  it("does not publish a completion until its durable commit resolves", async () => {
    const { result } = renderAndClearEffects();
    let resolveCommit!: (value: { habit: Habit; nextValue: number }) => void;
    mockCommitHabitToggle.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCommit = resolve;
        }),
    );

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.handleToggleHabit("h1", "2026-02-19");
    });
    await act(async () => Promise.resolve());

    expect(mockCommitHabitToggle).toHaveBeenCalledOnce();
    expect(mockSetHabits).not.toHaveBeenCalled();
    expect(mockAwardXp).not.toHaveBeenCalled();
    expect(mockTriggerSync).not.toHaveBeenCalled();
    expect(mockSyncHabitCompletion).not.toHaveBeenCalled();

    await act(async () => {
      resolveCommit({
        habit: {
          ...mockHabits[0],
          entries: { "2026-02-19": { value: ENTRY.YES_MANUAL } },
        },
        nextValue: ENTRY.YES_MANUAL,
      });
      await pending;
    });

    expect(mockSetHabits).toHaveBeenCalledOnce();
    expect(mockAwardXp).toHaveBeenCalledWith("habit");
    expect(mockTriggerSync).toHaveBeenCalledOnce();
    expect(mockSyncHabitCompletion).toHaveBeenCalledOnce();
  });

  it("does not publish a completion when its durable commit fails", async () => {
    const { result } = renderAndClearEffects();
    mockCommitHabitToggle.mockRejectedValueOnce(new Error("durable write failed"));

    await act(async () => {
      await result.current.handleToggleHabit("h1", "2026-02-19");
    });

    expect(mockSetHabits).not.toHaveBeenCalled();
    expect(mockAwardXp).not.toHaveBeenCalled();
    expect(mockTriggerSync).not.toHaveBeenCalled();
    expect(mockSyncHabitCompletion).not.toHaveBeenCalled();
  });

  it("releases the in-flight guard after a failed durable commit", async () => {
    const { result } = renderAndClearEffects();
    mockCommitHabitToggle.mockRejectedValueOnce(new Error("durable write failed"));

    await act(async () => {
      await result.current.handleToggleHabit("h1", "2026-02-19");
      await result.current.handleToggleHabit("h1", "2026-02-19");
    });

    expect(mockCommitHabitToggle).toHaveBeenCalledTimes(2);
    expect(mockSetHabits).toHaveBeenCalledOnce();
    expect(mockAwardXp).toHaveBeenCalledOnce();
  });

  it("handleToggleHabit publishes a durable completion removal", async () => {
    const habitsWithCompleted = mockHabits.map((h) =>
      h.id === "h1" ? { ...h, entries: datesToEntries(["2026-02-19"]) } : h
    );

    // Override store to return completed habits — handleToggleHabit reads
    // current value from the store closure, not from the updater's `prev`.
    vi.mocked(useUserDataStore).mockImplementation(((
      sel: (s: Record<string, unknown>) => unknown
    ) =>
      sel({
        habits: habitsWithCompleted,
        setHabits: mockSetHabits,
        setScheduleEvents: mockSetScheduleEvents,
        setReminders: mockSetReminders,
      })) as typeof useUserDataStore);

    const { result } = renderAndClearEffects();
    mockCommitHabitToggle.mockResolvedValueOnce({
      habit: {
        ...habitsWithCompleted[0],
        entries: { "2026-02-19": { value: ENTRY.UNKNOWN } },
      },
      nextValue: ENTRY.UNKNOWN,
    });

    await act(async () => {
      await result.current.handleToggleHabit("h1", "2026-02-19");
    });

    const updated = lastSetHabitsUpdater()(habitsWithCompleted);
    const habit = updated.find((h) => h.id === "h1");
    // After toggle off, entry should not be YES_MANUAL
    const entryVal = habit?.entries["2026-02-19"]?.value;
    expect(
      entryVal === undefined ||
        entryVal === ENTRY.UNKNOWN ||
        entryVal === ENTRY.SKIP ||
        entryVal === ENTRY.NO
    ).toBe(true);

    // Restore original store mock (must include all selectors used by the hook)
    vi.mocked(useUserDataStore).mockImplementation(((
      sel: (s: Record<string, unknown>) => unknown
    ) =>
      sel({
        habits: mockHabits,
        setHabits: mockSetHabits,
        setScheduleEvents: mockSetScheduleEvents,
        setReminders: mockSetReminders,
      })) as typeof useUserDataStore);
  });

  it("handleToggleHabit durably increments numerical type completions", async () => {
    const { result } = renderAndClearEffects();

    await act(async () => {
      await result.current.handleToggleHabit("h2", "2026-02-19");
    });

    const updated = lastSetHabitsUpdater()(mockHabits);
    const habit = updated.find((h) => h.id === "h2");
    // Numerical habit should have an entry value set
    expect(habit?.entries["2026-02-19"]).toBeDefined();
    expect(mockAwardXp).toHaveBeenCalledWith("habit");
  });

  it("handleAdjustHabit publishes a durable numerical value", async () => {
    const { result } = renderAndClearEffects();

    await act(async () => {
      await result.current.handleAdjustHabit("h3", "2026-02-19", 1);
    });

    expect(mockCommitHabitEntry).toHaveBeenCalledWith(
      "h3",
      "2026-02-19",
      1000,
      "calendar",
    );
    const updated = lastSetHabitsUpdater()(mockHabits);
    const habit = updated.find((h) => h.id === "h3");
    expect(habit?.entries["2026-02-19"]).toBeDefined();
  });

  it("handleAdjustHabit durably adjusts numerical completions with delta", async () => {
    const habitsWithNumericalProgress = mockHabits.map((h) =>
      h.id === "h2" ? { ...h, entries: { "2026-02-19": { value: 2000 } } } : h
    );

    const { result } = renderAndClearEffects();

    await act(async () => {
      await result.current.handleAdjustHabit("h2", "2026-02-19", -1);
    });

    const updated = lastSetHabitsUpdater()(habitsWithNumericalProgress);
    const habit = updated.find((h) => h.id === "h2");
    expect(habit?.entries["2026-02-19"]).toBeDefined();
  });

  it("handleSetNumericalValue publishes only the durable exact value", async () => {
    const { result } = renderAndClearEffects();

    await act(async () => {
      await result.current.handleSetNumericalValue("h2", "2026-02-19", 2.5);
    });

    expect(mockCommitHabitEntry).toHaveBeenCalledWith(
      "h2",
      "2026-02-19",
      2500,
      "calendar",
    );
    const updated = lastSetHabitsUpdater()(mockHabits);
    expect(updated.find((habit) => habit.id === "h2")?.entries["2026-02-19"]?.value).toBe(
      2500,
    );
    expect(mockTriggerSync).toHaveBeenCalledOnce();
    expect(mockSyncHabitCompletion).toHaveBeenCalledOnce();
  });

  it("does not publish an exact numerical value when its durable commit fails", async () => {
    const { result } = renderAndClearEffects();
    mockCommitHabitEntry.mockRejectedValueOnce(new Error("durable write failed"));

    await act(async () => {
      await result.current.handleSetNumericalValue("h2", "2026-02-19", 2.5);
    });

    expect(mockSetHabits).not.toHaveBeenCalled();
    expect(mockAwardXp).not.toHaveBeenCalled();
    expect(mockTriggerSync).not.toHaveBeenCalled();
    expect(mockSyncHabitCompletion).not.toHaveBeenCalled();
  });

  it("double-click guard prevents duplicate numerical delta commits", async () => {
    const { result } = renderAndClearEffects();

    act(() => {
      void result.current.handleAdjustHabit("h2", "2026-02-19", 1);
      void result.current.handleAdjustHabit("h2", "2026-02-19", 1);
    });
    await act(async () => Promise.resolve());

    expect(mockCommitHabitEntry).toHaveBeenCalledTimes(1);
    expect(mockSetHabits).toHaveBeenCalledTimes(1);
    expect(mockSyncHabitCompletion).toHaveBeenCalledTimes(1);
  });

  it("double-click guard prevents rapid duplicate durable toggles", async () => {
    const { result } = renderAndClearEffects();

    act(() => {
      void result.current.handleToggleHabit("h1", "2026-02-19");
      void result.current.handleToggleHabit("h1", "2026-02-19");
    });
    await act(async () => Promise.resolve());

    expect(mockCommitHabitToggle).toHaveBeenCalledTimes(1);
    expect(mockSetHabits).toHaveBeenCalledTimes(1);

    // After the duplicate-completion window expires, an intentional toggle works again.
    act(() => {
      vi.advanceTimersByTime(751);
    });

    await act(async () => {
      await result.current.handleToggleHabit("h1", "2026-02-19");
    });

    expect(mockCommitHabitToggle).toHaveBeenCalledTimes(2);
    expect(mockSetHabits).toHaveBeenCalledTimes(2);
  });

  it("deduplicates a retry immediately after a durable completion", async () => {
    const { result } = renderAndClearEffects();

    await act(async () => {
      await result.current.handleToggleHabit("h1", "2026-02-19");
      await result.current.handleToggleHabit("h1", "2026-02-19");
    });

    expect(mockCommitHabitToggle).toHaveBeenCalledTimes(1);
    expect(mockAwardXp).toHaveBeenCalledTimes(1);
  });

  it("triggerSync is called after mutations", () => {
    const { result } = renderAndClearEffects();

    act(() => {
      result.current.handleAddHabit(
        makeTestHabit({
          id: "hx",
          name: "X",
          icon: "x",
          entries: {},
        })
      );
    });

    expect(mockTriggerSync).toHaveBeenCalled();

    mockTriggerSync.mockClear();

    act(() => {
      result.current.handleDeleteHabit("h1");
    });

    expect(mockTriggerSync).toHaveBeenCalled();
  });
});
