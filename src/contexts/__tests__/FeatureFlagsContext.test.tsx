/**
 * FeatureFlagsContext Tests
 *
 * Tests for the feature flags provider, including toggle behavior,
 * onboarding-gated visibility, and default flag values.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { ReactNode } from "react";

// --- Mocks ---

let mockFlags: any;
let mockSetFlags: any;
let mockUserData: {
  habits: Array<{ entries?: Record<string, { value: number }> }>;
  focusSessions: unknown[];
  moods: Array<{ date: string }>;
};

const availabilityRuntimeMocks = vi.hoisted(() => ({
  getEntryCount: vi.fn<() => Promise<number>>(),
  refreshListener: undefined as ((signal: AbortSignal) => Promise<void>) | undefined,
  runtimeReset: undefined as (() => void) | undefined,
  boundaryListener: undefined as (() => void) | undefined,
  runWithSettledDataRead: vi.fn(async <T,>(operation: () => Promise<T>): Promise<T> => operation()),
  waitForAccountBoundaryDataSettlement: vi.fn(async () => undefined),
}));

vi.mock("@/hooks/useLocalStorage", () => ({
  useLocalStorage: vi.fn(() => [mockFlags, mockSetFlags]),
}));

vi.mock("@/lib/onboardingFlow", () => ({
  isFeatureUnlocked: vi.fn(() => true),
  computeGardenGateStage: vi.fn(() => "seed"),
  getFeaturesForGardenStage: vi.fn(() => ["mood", "habits"]),
}));

vi.mock("@/lib/storageKeys", () => ({
  SK: { FEATURE_FLAGS: "zenflow-feature-flags" },
}));

vi.mock("@/stores", () => ({
  useUserDataStore: vi.fn((selector: (s: any) => any) => selector(mockUserData)),
}));

vi.mock("@/lib/utils", () => ({
  getToday: vi.fn(() => "2026-02-19"),
}));

vi.mock("@/features/journal", () => ({
  getEntryCount: availabilityRuntimeMocks.getEntryCount,
}));

vi.mock("@/hooks/useIndexedDB", () => ({
  runWithSettledDataRead: availabilityRuntimeMocks.runWithSettledDataRead,
  subscribeDataRefresh: vi.fn((listener: (signal: AbortSignal) => Promise<void>) => {
    availabilityRuntimeMocks.refreshListener = listener;
    return () => {
      if (availabilityRuntimeMocks.refreshListener === listener) {
        availabilityRuntimeMocks.refreshListener = undefined;
      }
    };
  }),
}));

vi.mock("@/storage/accountBoundaryRuntime", () => ({
  registerAccountBoundaryRuntimeReset: vi.fn((reset: () => void) => {
    availabilityRuntimeMocks.runtimeReset = reset;
    return () => {
      if (availabilityRuntimeMocks.runtimeReset === reset) {
        availabilityRuntimeMocks.runtimeReset = undefined;
      }
    };
  }),
  subscribeOriginAccountBoundaryGeneration: vi.fn((listener: () => void) => {
    availabilityRuntimeMocks.boundaryListener = listener;
    return () => {
      if (availabilityRuntimeMocks.boundaryListener === listener) {
        availabilityRuntimeMocks.boundaryListener = undefined;
      }
    };
  }),
  waitForAccountBoundaryDataSettlement:
    availabilityRuntimeMocks.waitForAccountBoundaryDataSettlement,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

import { FeatureFlagsProvider, useFeatureFlags, useFeatureVisible } from "../FeatureFlagsContext";
import {
  computeGardenGateStage,
  getFeaturesForGardenStage,
  isFeatureUnlocked,
} from "@/lib/onboardingFlow";

// --- Helpers ---

const wrapper = ({ children }: { children: ReactNode }) => (
  <FeatureFlagsProvider>{children}</FeatureFlagsProvider>
);

const DEFAULT_FLAGS = {
  focusTimer: true,
  breathingExercise: true,
  gratitudeJournal: true,
  quests: true,
  tasks: true,
  challenges: true,
  aiCoach: false,
  innerWorld: true,
  deltaSync: true,
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

// --- Tests ---

describe("FeatureFlagsContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    availabilityRuntimeMocks.refreshListener = undefined;
    availabilityRuntimeMocks.runtimeReset = undefined;
    availabilityRuntimeMocks.boundaryListener = undefined;
    availabilityRuntimeMocks.getEntryCount.mockReset().mockResolvedValue(0);
    availabilityRuntimeMocks.runWithSettledDataRead
      .mockReset()
      .mockImplementation(async <T,>(operation: () => Promise<T>): Promise<T> => operation());
    availabilityRuntimeMocks.waitForAccountBoundaryDataSettlement
      .mockReset()
      .mockResolvedValue(undefined);
    vi.mocked(isFeatureUnlocked).mockReset().mockReturnValue(true);
    vi.mocked(computeGardenGateStage).mockReset().mockReturnValue("seed");
    vi.mocked(getFeaturesForGardenStage).mockReset().mockReturnValue(["mood", "habits"]);
    mockUserData = { habits: [], focusSessions: [], moods: [] };
    mockFlags = { ...DEFAULT_FLAGS };
    mockSetFlags = vi.fn((updater: any) => {
      if (typeof updater === "function") {
        mockFlags = updater(mockFlags);
      } else {
        mockFlags = updater;
      }
    });
  });

  // 1. Default flags
  it("provides default flags with all features enabled except aiCoach", () => {
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    expect(result.current.flags.focusTimer).toBe(true);
    expect(result.current.flags.breathingExercise).toBe(true);
    expect(result.current.flags.gratitudeJournal).toBe(true);
    expect(result.current.flags.quests).toBe(true);
    expect(result.current.flags.tasks).toBe(true);
    expect(result.current.flags.challenges).toBe(true);
    expect(result.current.flags.aiCoach).toBe(false);
    expect(result.current.flags.innerWorld).toBe(true);
  });

  // 2. isFeatureEnabled returns true for enabled feature
  it("isFeatureEnabled returns true for an enabled feature", () => {
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    expect(result.current.isFeatureEnabled("focusTimer")).toBe(true);
    expect(result.current.isFeatureEnabled("breathingExercise")).toBe(true);
  });

  // 3. isFeatureEnabled returns false for disabled feature (aiCoach)
  it("isFeatureEnabled returns false for aiCoach (disabled by default)", () => {
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    expect(result.current.isFeatureEnabled("aiCoach")).toBe(false);
  });

  // 4. setFlag toggles a single flag without affecting others
  it("setFlag toggles a single flag without affecting others", () => {
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    act(() => {
      result.current.setFlag("focusTimer", false);
    });

    expect(mockSetFlags).toHaveBeenCalledTimes(1);
    // The updater should produce new flags with focusTimer=false
    expect(mockFlags.focusTimer).toBe(false);
    // Other flags remain unchanged
    expect(mockFlags.breathingExercise).toBe(true);
    expect(mockFlags.quests).toBe(true);
    expect(mockFlags.aiCoach).toBe(false);
  });

  // 5. setFlag can enable aiCoach
  it("setFlag can enable aiCoach", () => {
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    act(() => {
      result.current.setFlag("aiCoach", true);
    });

    expect(mockFlags.aiCoach).toBe(true);
  });

  // 6. isFeatureVisible returns true when enabled AND unlocked
  it("isFeatureVisible returns true when feature is enabled and unlocked", () => {
    vi.mocked(isFeatureUnlocked).mockReturnValue(true);

    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    expect(result.current.isFeatureVisible("focusTimer")).toBe(true);
  });

  // 7. isFeatureVisible returns false when disabled (even if unlocked)
  it("isFeatureVisible returns false when feature is disabled even if unlocked", () => {
    vi.mocked(isFeatureUnlocked).mockReturnValue(true);

    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    // aiCoach is disabled by default
    expect(result.current.isFeatureVisible("aiCoach")).toBe(false);
  });

  // 8. isFeatureVisible returns false when enabled but NOT unlocked (onboarding requirement)
  it("isFeatureVisible returns false when enabled but not unlocked via onboarding", () => {
    vi.mocked(isFeatureUnlocked).mockReturnValue(false);

    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    // focusTimer is enabled but onboarding says not unlocked
    expect(result.current.isFeatureVisible("focusTimer")).toBe(false);
  });

  // 9. isFeatureVisible returns true for features WITHOUT onboarding requirement
  it("isFeatureVisible returns true for a confirmed consumer without onboarding requirements", () => {
    vi.mocked(isFeatureUnlocked).mockReturnValue(false);

    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    expect(result.current.isFeatureVisible("deltaSync")).toBe(true);
    expect(result.current.isFeatureVisible("breathingExercise")).toBe(false);
    expect(result.current.isFeatureVisible("gratitudeJournal")).toBe(false);
    expect(result.current.isFeatureVisible("innerWorld")).toBe(false);
  });

  // 10. resetFlags restores all defaults
  it("resetFlags restores all flags to defaults", () => {
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    // First modify some flags
    act(() => {
      result.current.setFlag("focusTimer", false);
      result.current.setFlag("aiCoach", true);
    });

    // Then reset
    act(() => {
      result.current.resetFlags();
    });

    // mockSetFlags should have been called with DEFAULT_FLAGS object
    const lastCall = mockSetFlags.mock.calls[mockSetFlags.mock.calls.length - 1];
    expect(lastCall[0]).toEqual(DEFAULT_FLAGS);
  });

  // 11. useFeatureFlags throws when used outside provider
  it("useFeatureFlags throws when used outside FeatureFlagsProvider", () => {
    // Suppress console.error for the expected error
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      renderHook(() => useFeatureFlags());
    }).toThrow("useFeatureFlags must be used within a FeatureFlagsProvider");

    consoleSpy.mockRestore();
  });

  // 12. useFeatureVisible convenience hook returns correct value
  it("useFeatureVisible returns correct visibility for a feature", () => {
    vi.mocked(isFeatureUnlocked).mockReturnValue(true);

    const { result } = renderHook(() => useFeatureVisible("focusTimer"), { wrapper });

    expect(result.current).toBe(true);
  });

  // 13. Missing persisted values fail closed
  it("does not treat an absent persisted feature value as enabled", () => {
    // Simulate a flag key that is missing from the flags object
    mockFlags = { ...DEFAULT_FLAGS };
    const mutable: Record<string, unknown> = mockFlags;
    delete mutable.deltaSync;

    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    expect(result.current.isFeatureEnabled("deltaSync")).toBe(false);
    expect(result.current.getFeatureAvailability("deltaSync")).toMatchObject({
      visible: false,
      state: "blocked",
      reason: "configuration-missing",
      source: "user-setting",
      disclosure: "silent",
    });
  });

  it("uses the authoritative IndexedDB journal count for behavioral unlocks", async () => {
    vi.mocked(isFeatureUnlocked).mockReturnValue(false);
    availabilityRuntimeMocks.getEntryCount.mockResolvedValue(3);
    mockUserData.moods = Array.from({ length: 7 }, (_, index) => ({
      date: `2026-02-${String(index + 1).padStart(2, "0")}`,
    }));
    vi.mocked(computeGardenGateStage).mockImplementation((stats) =>
      stats.journalEntries >= 3 && stats.daysActive >= 7 ? "blooming" : "seed"
    );
    vi.mocked(getFeaturesForGardenStage).mockImplementation((stage) =>
      stage === "blooming" ? ["mood", "habits", "challenges", "quests"] : ["mood", "habits"]
    );

    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    await waitFor(() => expect(result.current.isFeatureVisible("challenges")).toBe(true));
    expect(availabilityRuntimeMocks.runWithSettledDataRead).toHaveBeenCalledTimes(1);
    expect(availabilityRuntimeMocks.getEntryCount).toHaveBeenCalledTimes(1);
    expect(computeGardenGateStage).toHaveBeenLastCalledWith(
      expect.objectContaining({ journalEntries: 3 })
    );
    expect(result.current.getFeatureAvailability("challenges")).toMatchObject({
      visible: true,
      state: "available",
      source: "local-truth",
    });
  });

  it("represents a loading journal count as unknown instead of zero", () => {
    vi.mocked(isFeatureUnlocked).mockReturnValue(false);
    const pendingCount = createDeferred<number>();
    availabilityRuntimeMocks.getEntryCount.mockReturnValue(pendingCount.promise);

    const { result, unmount } = renderHook(() => useFeatureFlags(), { wrapper });

    expect(result.current.getFeatureAvailability("challenges")).toMatchObject({
      visible: false,
      state: "temporarily-unavailable",
      reason: "journal-count-loading",
      source: "local-truth",
    });
    expect(computeGardenGateStage).not.toHaveBeenCalled();

    unmount();
    pendingCount.resolve(0);
  });

  it("represents a failed journal count as unavailable instead of zero", async () => {
    vi.mocked(isFeatureUnlocked).mockReturnValue(false);
    availabilityRuntimeMocks.getEntryCount.mockRejectedValue(new Error("isolated count failure"));

    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    await waitFor(() =>
      expect(result.current.getFeatureAvailability("challenges")).toMatchObject({
        visible: false,
        state: "temporarily-unavailable",
        reason: "journal-count-unavailable",
        source: "local-truth",
      })
    );
    expect(computeGardenGateStage).not.toHaveBeenCalled();
  });

  it("refreshes the count through the settled data-refresh subscription", async () => {
    vi.mocked(isFeatureUnlocked).mockReturnValue(false);
    availabilityRuntimeMocks.getEntryCount.mockResolvedValueOnce(0);
    vi.mocked(computeGardenGateStage).mockImplementation((stats) =>
      stats.journalEntries >= 3 ? "blooming" : "seed"
    );
    vi.mocked(getFeaturesForGardenStage).mockImplementation((stage) =>
      stage === "blooming" ? ["mood", "habits", "challenges", "quests"] : ["mood", "habits"]
    );

    const { result } = renderHook(() => useFeatureFlags(), { wrapper });
    await waitFor(() => expect(availabilityRuntimeMocks.getEntryCount).toHaveBeenCalledTimes(1));
    expect(result.current.isFeatureVisible("challenges")).toBe(false);

    availabilityRuntimeMocks.getEntryCount.mockResolvedValueOnce(3);
    await act(async () => {
      await availabilityRuntimeMocks.refreshListener?.(new AbortController().signal);
    });

    await waitFor(() => expect(result.current.isFeatureVisible("challenges")).toBe(true));
    expect(availabilityRuntimeMocks.getEntryCount).toHaveBeenCalledTimes(2);
  });

  it("keeps a locally unlocked feature mounted during a same-owner count refresh", async () => {
    vi.mocked(isFeatureUnlocked).mockReturnValue(false);
    availabilityRuntimeMocks.getEntryCount.mockResolvedValueOnce(3);
    vi.mocked(computeGardenGateStage).mockImplementation((stats) =>
      stats.journalEntries >= 3 ? "blooming" : "seed"
    );
    vi.mocked(getFeaturesForGardenStage).mockImplementation((stage) =>
      stage === "blooming" ? ["mood", "habits", "challenges"] : ["mood", "habits"]
    );

    const { result } = renderHook(() => useFeatureFlags(), { wrapper });
    await waitFor(() => expect(result.current.isFeatureVisible("challenges")).toBe(true));

    const pendingRefresh = createDeferred<number>();
    availabilityRuntimeMocks.getEntryCount.mockReturnValueOnce(pendingRefresh.promise);
    let refreshPromise: Promise<void> | undefined;
    await act(async () => {
      refreshPromise = availabilityRuntimeMocks.refreshListener?.(
        new AbortController().signal,
      );
      await Promise.resolve();
    });

    expect(result.current.isFeatureVisible("challenges")).toBe(true);

    pendingRefresh.resolve(4);
    await act(async () => {
      await refreshPromise;
    });
    expect(result.current.isFeatureVisible("challenges")).toBe(true);
  });

  it("clears stale count state and reloads after an account boundary settles", async () => {
    vi.mocked(isFeatureUnlocked).mockReturnValue(false);
    availabilityRuntimeMocks.getEntryCount.mockResolvedValueOnce(3);
    vi.mocked(computeGardenGateStage).mockImplementation((stats) =>
      stats.journalEntries >= 3 ? "blooming" : "seed"
    );
    vi.mocked(getFeaturesForGardenStage).mockImplementation((stage) =>
      stage === "blooming" ? ["mood", "habits", "challenges", "quests"] : ["mood", "habits"]
    );

    const { result } = renderHook(() => useFeatureFlags(), { wrapper });
    await waitFor(() => expect(result.current.isFeatureVisible("challenges")).toBe(true));

    act(() => {
      availabilityRuntimeMocks.runtimeReset?.();
    });
    expect(result.current.getFeatureAvailability("challenges")).toMatchObject({
      visible: false,
      reason: "journal-count-loading",
    });

    availabilityRuntimeMocks.getEntryCount.mockResolvedValueOnce(0);
    act(() => {
      availabilityRuntimeMocks.boundaryListener?.();
    });

    await waitFor(() =>
      expect(availabilityRuntimeMocks.waitForAccountBoundaryDataSettlement).toHaveBeenCalledTimes(1)
    );
    await waitFor(() =>
      expect(result.current.getFeatureAvailability("challenges").reason).toBe("unlock-required")
    );
    expect(availabilityRuntimeMocks.getEntryCount).toHaveBeenCalledTimes(2);
  });

  it("keeps onboarding unlock independent while the journal count is loading", () => {
    vi.mocked(isFeatureUnlocked).mockReturnValue(true);
    const pendingCount = createDeferred<number>();
    availabilityRuntimeMocks.getEntryCount.mockReturnValue(pendingCount.promise);

    const { result, unmount } = renderHook(() => useFeatureFlags(), { wrapper });

    expect(result.current.getFeatureAvailability("challenges")).toMatchObject({
      visible: true,
      state: "available",
      source: "onboarding",
    });

    unmount();
    pendingCount.resolve(0);
  });

  it("keeps AI Coach blocked even when a stored flag requests enablement", () => {
    mockFlags = { ...DEFAULT_FLAGS, aiCoach: true };

    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    expect(result.current.isFeatureVisible("aiCoach")).toBe(false);
    expect(result.current.getFeatureAvailability("aiCoach")).toMatchObject({
      state: "blocked",
      reason: "service-not-approved",
      source: "release-policy",
      disclosure: "silent",
    });
  });

  it("keeps the compatibility boolean equal to structured visibility", () => {
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    for (const feature of Object.keys(DEFAULT_FLAGS) as Array<keyof typeof DEFAULT_FLAGS>) {
      expect(result.current.isFeatureVisible(feature)).toBe(
        result.current.getFeatureAvailability(feature).visible
      );
    }
  });
});
