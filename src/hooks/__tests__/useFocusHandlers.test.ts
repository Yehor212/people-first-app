/**
 * useFocusHandlers Hook Tests
 * Tests focus session completion, treat rewards, and mindful moment trigger.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// --- mocks ---

const mockSetFocusSessions = vi.fn();
const mockRewardUser = vi.fn();
const mockEarnTreats = vi.fn(() => ({ earned: 10, bonus: 0, multiplier: 1, newBalance: 10 }));
const mockUpdateChallengeProgress = vi.fn();
const mockCheckForFeatureUnlocks = vi.fn();
const mockOpenModal = vi.fn();

vi.mock("@/stores", () => ({
  useUserDataStore: vi.fn((sel: (s: Record<string, unknown>) => unknown) =>
    sel({
      setFocusSessions: mockSetFocusSessions,
      _publishDurableFocusSessions: mockSetFocusSessions,
    })
  ),
  useGamificationStore: vi.fn((sel: (s: Record<string, unknown>) => unknown) =>
    sel({ rewardUser: mockRewardUser })
  ),
  useUIStore: Object.assign(
    vi.fn(() => ({})),
    { getState: () => ({ openModal: mockOpenModal }) }
  ),
}));

vi.mock("@/components/XpPopup", () => ({
  triggerXpPopup: vi.fn(),
}));

vi.mock("@/lib/haptics", () => ({
  haptics: { focusCompleted: "focusCompleted" },
}));

vi.mock("@/lib/offlineQueue", () => ({
  offlineQueue: { wakeFromDurableStorage: vi.fn(() => Promise.resolve()) },
}));

vi.mock("@/lib/randomQuests", () => ({
  updateAllQuestsProgress: vi.fn(() => []),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    sync: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: vi.fn(() => ({ t: { storageErrorDesc: "Storage unavailable" } })),
}));

vi.mock("@/features/automation", () => ({
  persistFocusSourceRecord: vi.fn(async () => ({
    accountBoundaryGeneration: "test-boundary",
    intentId: null,
    primaryInserted: true,
    syncOutboxPersisted: true,
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

vi.mock("@/lib/analytics", () => ({
  analytics: { focusSessionCompleted: vi.fn() },
}));

// --- import under test after mocks ---

import { useFocusHandlers } from "../useFocusHandlers";
import { triggerXpPopup } from "@/components/XpPopup";
import { playSound } from "@/lib/audioManager";
import { updateAllQuestsProgress } from "@/lib/randomQuests";
import { persistFocusSourceRecord } from "@/features/automation";
import { analytics } from "@/lib/analytics";

describe("useFocusHandlers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderFocusHandlers = (options: { rewardsEnabled?: boolean } = {}) =>
    renderHook(() =>
      useFocusHandlers({
        earnTreats: mockEarnTreats,
        updateChallengeProgress: mockUpdateChallengeProgress,
        checkForFeatureUnlocks: mockCheckForFeatureUnlocks,
        ...options,
      })
    );

  const makeSession = (duration: number) => ({
    id: "focus-1",
    duration,
    completedAt: Date.now(),
    date: "2026-02-19",
  });

  async function completeSession(action: () => void | Promise<void>): Promise<void> {
    await act(async () => {
      await action();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("handleCompleteFocusSession adds session to store", async () => {
    const { result } = renderFocusHandlers();
    const session = makeSession(10);

    await completeSession(() => {
      return result.current.handleCompleteFocusSession(session);
    });

    expect(mockSetFocusSessions).toHaveBeenCalledTimes(1);
    const updater = mockSetFocusSessions.mock.calls[0][0];
    expect(updater([])).toEqual([expect.objectContaining(session)]);
  });

  it("handleCompleteFocusSession rewards treats based on duration", async () => {
    const { result } = renderFocusHandlers();
    const session = makeSession(20);

    await completeSession(() => {
      return result.current.handleCompleteFocusSession(session);
    });

    // Math.round(20 * 0.5) = 10
    expect(mockRewardUser).toHaveBeenCalledWith("focus", {
      treats: 10,
      treatReason: "Focus 20min",
      haptic: "focusCompleted",
    });
  });

  it("V2 neutral mode skips focus rewards, XP popup, and plays neutral completion feedback", async () => {
    vi.mocked(updateAllQuestsProgress).mockReturnValueOnce([
      { title: "Focus quest", reward: { xp: 30 } },
    ] as never);
    const { result } = renderFocusHandlers({ rewardsEnabled: false });
    const session = makeSession(20);

    await completeSession(() => {
      return result.current.handleCompleteFocusSession(session);
    });

    expect(playSound).toHaveBeenCalledWith("complete");
    expect(mockRewardUser).not.toHaveBeenCalled();
    expect(triggerXpPopup).not.toHaveBeenCalled();
  });

  it("handleCompleteFocusSession shows mindful moment for sessions >= 5min", async () => {
    const { result } = renderFocusHandlers();
    const session = makeSession(5);

    await completeSession(() => {
      return result.current.handleCompleteFocusSession(session);
    });

    expect(mockSetFocusSessions).toHaveBeenCalledTimes(1);
    // Advance past the 500ms timeout for the mindful moment modal
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(mockOpenModal).toHaveBeenCalledWith("showMindfulMoment");
  });

  it("handleCompleteFocusSession skips mindful moment for sessions < 5min", async () => {
    const { result } = renderFocusHandlers();
    const session = makeSession(4);

    await completeSession(() => {
      return result.current.handleCompleteFocusSession(session);
    });

    expect(mockSetFocusSessions).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(mockOpenModal).not.toHaveBeenCalled();
  });

  it("does not reopen the mindful moment for a cold duplicate primary", async () => {
    vi.mocked(persistFocusSourceRecord).mockResolvedValueOnce({
      accountBoundaryGeneration: "test-boundary",
      intentId: null,
      primaryInserted: false,
      syncOutboxPersisted: true,
    });
    const { result } = renderFocusHandlers();

    await completeSession(() => {
      return result.current.handleCompleteFocusSession({
        id: "cold-duplicate-focus",
        duration: 25,
        completedAt: 101,
        date: "2026-08-13",
        status: "completed",
        updatedAt: 101,
      });
    });
    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(mockOpenModal).not.toHaveBeenCalled();
    expect(mockRewardUser).not.toHaveBeenCalled();
    expect(updateAllQuestsProgress).not.toHaveBeenCalled();
  });

  it("persists an aborted session without completion-only effects", async () => {
    const { result } = renderFocusHandlers();

    await completeSession(() =>
      result.current.handleCompleteFocusSession({
        ...makeSession(15),
        status: "aborted",
      })
    );
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(persistFocusSourceRecord).toHaveBeenCalledOnce();
    expect(mockSetFocusSessions).toHaveBeenCalledOnce();
    expect(mockRewardUser).not.toHaveBeenCalled();
    expect(playSound).not.toHaveBeenCalled();
    expect(analytics.focusSessionCompleted).not.toHaveBeenCalled();
    expect(mockUpdateChallengeProgress).not.toHaveBeenCalled();
    expect(mockCheckForFeatureUnlocks).not.toHaveBeenCalled();
    expect(updateAllQuestsProgress).not.toHaveBeenCalled();
    expect(mockOpenModal).not.toHaveBeenCalled();
  });

  it("handleMindfulMomentComplete calls earnTreats", () => {
    const { result } = renderFocusHandlers();

    act(() => {
      result.current.handleMindfulMomentComplete();
    });

    expect(mockEarnTreats).toHaveBeenCalledWith("mindful", 1, "Mindful Moment");
  });
});
