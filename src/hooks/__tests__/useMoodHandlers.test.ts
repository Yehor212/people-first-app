/**
 * useMoodHandlers Hook Tests
 * Tests mood entry creation, quick mood, and update handlers.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// --- mocks ---

const {
  mockSetMoods,
  mockRewardUser,
  mockUpdateChallengeProgress,
  mockTriggerSync,
  mockMoodState,
  mockUseUserDataStore,
} = vi.hoisted(() => {
  const mockSetMoods = vi.fn();
  const mockMoodState: { currentMoods: Array<Record<string, unknown>> } = {
    currentMoods: [],
  };
  const mockUseUserDataStore = Object.assign(
    vi.fn((sel: (s: Record<string, unknown>) => unknown) =>
      sel({
        moods: mockMoodState.currentMoods,
        setMoods: mockSetMoods,
        _publishDurableMoods: mockSetMoods,
      }),
    ),
    {
      getState: () => ({ moods: mockMoodState.currentMoods }),
    },
  );

  return {
    mockSetMoods,
    mockRewardUser: vi.fn(),
    mockUpdateChallengeProgress: vi.fn(),
    mockTriggerSync: vi.fn(),
    mockMoodState,
    mockUseUserDataStore,
  };
});

vi.mock("@/stores", () => ({
  useUserDataStore: mockUseUserDataStore,
  useGamificationStore: vi.fn((sel: (s: Record<string, unknown>) => unknown) =>
    sel({ rewardUser: mockRewardUser })
  ),
}));

vi.mock("@/lib/utils", () => ({
  getToday: vi.fn(() => "2026-02-19"),
  generateId: vi.fn(() => "test-id"),
  generateUuid: vi.fn(() => "11111111-1111-4111-8111-111111111111"),
}));

vi.mock("@/storage/cloudSync", () => ({
  triggerSync: (...args: unknown[]) => mockTriggerSync(...args),
}));

vi.mock("@/storage/realtimeSync", () => ({
  syncMood: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/haptics", () => ({
  haptics: { moodSaved: "moodSaved" },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: vi.fn(() => ({ t: { storageErrorDesc: "Storage unavailable" } })),
}));

vi.mock("@/features/automation", () => ({
  persistMoodSourceRecord: vi.fn(async () => ({
    accountBoundaryGeneration: "test-boundary",
    intentId: null,
  })),
}));

vi.mock("@/storage/accountBoundaryRuntime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/storage/accountBoundaryRuntime")>();
  return {
    ...actual,
    assertOriginAccountBoundaryGeneration: vi.fn(),
  };
});

vi.mock("@/lib/audioManager", () => ({
  playSound: vi.fn(),
}));

// --- import under test after mocks ---

import { useMoodHandlers } from "../useMoodHandlers";
import { playSound } from "@/lib/audioManager";

describe("useMoodHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMoodState.currentMoods = [];
  });

  const renderMoodHandlers = (options: { rewardsEnabled?: boolean } = {}) =>
    renderHook(() =>
      useMoodHandlers({
        updateChallengeProgress: mockUpdateChallengeProgress,
        ...options,
      })
    );

  it("handleAddMood calls setMoods with new entry appended", async () => {
    const { result } = renderMoodHandlers();

    const entry = { id: "1", mood: "good" as const, date: "2026-02-19", timestamp: 1000 };
    await act(async () => {
      await result.current.handleAddMood(entry);
    });

    await waitFor(() => expect(mockSetMoods).toHaveBeenCalledTimes(1));
    // The updater function should append the entry
    const updater = mockSetMoods.mock.calls[0][0];
    expect(updater([])).toEqual([expect.objectContaining(entry)]);
  });

  it("keeps a durable mood idempotent when mounted state already refreshed it", async () => {
    const { result } = renderMoodHandlers();
    const entry = {
      id: "durable-1",
      mood: "good" as const,
      date: "2026-02-19",
      timestamp: 1000,
      updatedAt: 1000,
    };

    await act(async () => {
      await result.current.handleAddMood(entry);
    });

    const updater = mockSetMoods.mock.calls[0][0];
    const updated = updater([{ ...entry }]);
    expect(updated).toHaveLength(1);
    expect(updated[0]).toEqual(expect.objectContaining(entry));
  });

  it("handleAddMood calls rewardUser with mood treats", async () => {
    const { result } = renderMoodHandlers();

    const entry = { id: "2", mood: "great" as const, date: "2026-02-19", timestamp: 2000 };
    await act(async () => {
      await result.current.handleAddMood(entry);
    });

    await waitFor(() =>
      expect(mockRewardUser).toHaveBeenCalledWith("mood", {
        treats: 5,
        treatReason: "Logged mood",
        haptic: "moodSaved",
        seedExtra: "great",
      }),
    );
  });

  it("V2 neutral mode skips rewardUser and plays only neutral mood feedback", async () => {
    const { result } = renderMoodHandlers({ rewardsEnabled: false });

    const entry = { id: "v2-mood", mood: "great" as const, date: "2026-02-19", timestamp: 2000 };
    await act(async () => {
      await result.current.handleAddMood(entry);
    });

    await waitFor(() => expect(playSound).toHaveBeenCalledWith("success"));
    expect(mockRewardUser).not.toHaveBeenCalled();
  });

  it("handleAddMood calls updateChallengeProgress", async () => {
    const { result } = renderMoodHandlers();

    const entry = { id: "3", mood: "okay" as const, date: "2026-02-19", timestamp: 3000 };
    await act(async () => {
      await result.current.handleAddMood(entry);
    });

    await waitFor(() => expect(mockUpdateChallengeProgress).toHaveBeenCalledTimes(1));
  });

  it("handleQuickMood creates entry with generated id and today date", async () => {
    const { result } = renderMoodHandlers();

    act(() => {
      result.current.handleQuickMood("bad");
    });

    await waitFor(() => expect(mockSetMoods).toHaveBeenCalledTimes(1));
    const updater = mockSetMoods.mock.calls[0][0];
    const created = updater([])[0];
    expect(created).toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      mood: "bad",
      date: "2026-02-19",
    });
    expect(created.timestamp).toEqual(expect.any(Number));
  });

  it("handleUpdateMood updates specific entry mood and triggers sync", async () => {
    const { result } = renderMoodHandlers();

    const existing = [
      { id: "entry-1", mood: "bad", date: "2026-02-19", timestamp: 100, note: "old" },
      { id: "entry-2", mood: "okay", date: "2026-02-19", timestamp: 200 },
    ];
    mockMoodState.currentMoods = existing;

    act(() => {
      result.current.handleUpdateMood("entry-1", "great", "feeling better");
    });

    await waitFor(() => expect(mockSetMoods).toHaveBeenCalledTimes(1));
    // Verify the updater correctly maps entries
    const updater = mockSetMoods.mock.calls[0][0];
    const updated = updater(existing);
    expect(updated[0].mood).toBe("great");
    expect(updated[0].note).toBe("feeling better");
    expect(updated[1].mood).toBe("okay");

    expect(mockTriggerSync).toHaveBeenCalledTimes(1);
  });
});
