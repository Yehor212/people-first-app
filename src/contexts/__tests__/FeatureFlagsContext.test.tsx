import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const mutableState: { flags: Record<string, boolean> } = { flags: {} };
  return {
  ...mutableState,
  setFlags: vi.fn(),
  journalCount: vi.fn<() => Promise<number>>(),
  refreshListener: null as null | ((signal: AbortSignal) => Promise<void>),
  boundaryListener: null as null | (() => void),
  waitForBoundarySettlement: vi.fn<() => Promise<void>>(),
  isFeatureUnlocked: vi.fn(() => true),
  store: {
    habits: [] as Array<{ entries?: Record<string, { value: number }> }>,
    focusSessions: [] as unknown[],
    moods: [] as Array<{ date?: string }>,
  },
  };
});

vi.mock("@/hooks/useLocalStorage", () => ({
  useLocalStorage: () => [mocks.flags, mocks.setFlags],
}));

vi.mock("@/lib/onboardingFlow", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/onboardingFlow")>();
  return { ...actual, isFeatureUnlocked: mocks.isFeatureUnlocked };
});

vi.mock("@/storage/db", () => ({
  db: { journalEntries: { count: mocks.journalCount } },
}));

vi.mock("@/hooks/useIndexedDB", () => ({
  captureDataWriteBoundaryGeneration: () => 0,
  assertDataWriteBoundaryGeneration: vi.fn(),
  subscribeDataRefresh: (listener: (signal: AbortSignal) => Promise<void>) => {
    mocks.refreshListener = listener;
    return () => {
      if (mocks.refreshListener === listener) mocks.refreshListener = null;
    };
  },
}));

vi.mock("@/storage/accountBoundaryRuntime", () => ({
  captureOriginAccountBoundaryGeneration: () => "origin-generation",
  assertOriginAccountBoundaryGeneration: vi.fn(),
  subscribeOriginAccountBoundaryObservation: (listener: () => void) => {
    mocks.boundaryListener = listener;
    return () => {
      if (mocks.boundaryListener === listener) mocks.boundaryListener = null;
    };
  },
  waitForAccountBoundaryDataSettlement: mocks.waitForBoundarySettlement,
}));

vi.mock("@/stores", () => ({
  useUserDataStore: (selector: (state: typeof mocks.store) => unknown) => selector(mocks.store),
}));

vi.mock("@/lib/utils", () => ({ getToday: () => "2026-08-03" }));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), log: vi.fn() },
}));

import {
  DEFAULT_FEATURE_FLAGS,
  FeatureFlagsProvider,
  requireFeatureFlagsProvider,
  useFeatureFlags,
  useFeatureVisible,
} from "../FeatureFlagsContext";

const wrapper = ({ children }: { children: ReactNode }) => (
  <FeatureFlagsProvider>{children}</FeatureFlagsProvider>
);

function setSevenActiveDays(): void {
  mocks.store.moods = Array.from({ length: 7 }, (_, index) => ({
    date: `2026-07-${String(index + 1).padStart(2, "0")}`,
  }));
}

describe("FeatureFlagsContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.flags = { ...DEFAULT_FEATURE_FLAGS };
    mocks.setFlags.mockImplementation(
      (
        value:
          | Record<string, boolean>
          | ((current: Record<string, boolean>) => Record<string, boolean>)
      ) => {
        mocks.flags = typeof value === "function" ? value(mocks.flags) : value;
      }
    );
    mocks.journalCount.mockResolvedValue(0);
    mocks.refreshListener = null;
    mocks.boundaryListener = null;
    mocks.waitForBoundarySettlement.mockReset();
    mocks.waitForBoundarySettlement.mockResolvedValue(undefined);
    mocks.isFeatureUnlocked.mockReturnValue(true);
    mocks.store.habits = [];
    mocks.store.focusSessions = [];
    mocks.store.moods = [];
  });

  it("provides reviewed defaults and keeps AI Coach disabled", () => {
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    expect(result.current.flags).toEqual(DEFAULT_FEATURE_FLAGS);
    expect(result.current.isFeatureEnabled("focusTimer")).toBe(true);
    expect(result.current.isFeatureEnabled("aiCoach")).toBe(false);
    expect(result.current.getFeatureAvailability("aiCoach")).toMatchObject({
      visible: false,
      state: "blocked",
      reason: "service-not-approved",
    });
  });

  it("updates one stored choice without changing unrelated choices", () => {
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    act(() => result.current.setFlag("focusTimer", false));

    expect(mocks.flags.focusTimer).toBe(false);
    expect(mocks.flags.challenges).toBe(true);
    expect(mocks.flags.aiCoach).toBe(false);
  });

  it("uses a real settled IndexedDB count to unlock the blooming stage", async () => {
    mocks.isFeatureUnlocked.mockReturnValue(false);
    setSevenActiveDays();
    mocks.journalCount.mockResolvedValue(3);

    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    await waitFor(() =>
      expect(result.current.journalEntryCountState).toEqual({
        status: "ready",
        count: 3,
      })
    );
    expect(result.current.getFeatureAvailability("challenges")).toMatchObject({
      visible: true,
      source: "local-truth",
    });
  });

  it("keeps journal-dependent eligibility unknown while the count is loading", async () => {
    mocks.isFeatureUnlocked.mockReturnValue(false);
    setSevenActiveDays();
    let resolveCount!: (count: number) => void;
    mocks.journalCount.mockReturnValue(
      new Promise<number>((resolve) => {
        resolveCount = resolve;
      })
    );

    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    expect(result.current.getFeatureAvailability("challenges")).toMatchObject({
      visible: false,
      reason: "journal-count-loading",
    });
    resolveCount(3);
    await waitFor(() => expect(result.current.isFeatureVisible("challenges")).toBe(true));
  });

  it("does not read a stale diary count when the provider mounts during an account purge", async () => {
    mocks.isFeatureUnlocked.mockReturnValue(false);
    setSevenActiveDays();
    let postPurge = false;
    mocks.journalCount.mockImplementation(async () => (postPurge ? 0 : 3));
    let releaseSettlement!: () => void;
    mocks.waitForBoundarySettlement.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        releaseSettlement = resolve;
      })
    );

    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    expect(result.current.journalEntryCountState).toEqual({ status: "loading" });
    expect(result.current.isFeatureVisible("challenges")).toBe(false);
    expect(mocks.journalCount).not.toHaveBeenCalled();

    postPurge = true;
    await act(async () => releaseSettlement());

    await waitFor(() =>
      expect(result.current.journalEntryCountState).toEqual({
        status: "ready",
        count: 0,
      })
    );
    expect(mocks.journalCount).toHaveBeenCalledTimes(1);
    expect(result.current.isFeatureVisible("challenges")).toBe(false);
  });

  it("reports unavailable local truth instead of a verified empty journal", async () => {
    mocks.isFeatureUnlocked.mockReturnValue(false);
    setSevenActiveDays();
    mocks.journalCount.mockRejectedValue(new Error("IndexedDB unavailable"));

    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    await waitFor(() =>
      expect(result.current.getFeatureAvailability("challenges")).toMatchObject({
        visible: false,
        reason: "journal-count-unavailable",
      })
    );
    expect(result.current.journalEntryCountState).toEqual({ status: "error" });
  });

  it("keeps calendar onboarding independent from journal-count failure", async () => {
    mocks.isFeatureUnlocked.mockReturnValue(true);
    setSevenActiveDays();
    mocks.journalCount.mockRejectedValue(new Error("IndexedDB unavailable"));

    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    await waitFor(() => expect(result.current.journalEntryCountState.status).toBe("error"));
    expect(result.current.getFeatureAvailability("challenges")).toMatchObject({
      visible: true,
      source: "onboarding",
    });
  });

  it("replaces the count after a settled data refresh", async () => {
    mocks.isFeatureUnlocked.mockReturnValue(false);
    setSevenActiveDays();
    mocks.journalCount.mockResolvedValueOnce(0).mockResolvedValueOnce(3);

    const { result } = renderHook(() => useFeatureFlags(), { wrapper });
    await waitFor(() =>
      expect(result.current.journalEntryCountState).toEqual({
        status: "ready",
        count: 0,
      })
    );
    expect(result.current.isFeatureVisible("challenges")).toBe(false);

    await act(async () => {
      await mocks.refreshListener!(new AbortController().signal);
    });

    expect(result.current.journalEntryCountState).toEqual({ status: "ready", count: 3 });
    expect(result.current.isFeatureVisible("challenges")).toBe(true);
  });

  it("discards an older count after an account-boundary observation", async () => {
    mocks.isFeatureUnlocked.mockReturnValue(false);
    setSevenActiveDays();
    let resolveOldCount!: (count: number) => void;
    mocks.journalCount
      .mockReturnValueOnce(
        new Promise<number>((resolve) => {
          resolveOldCount = resolve;
        })
      )
      .mockResolvedValueOnce(0);

    const { result } = renderHook(() => useFeatureFlags(), { wrapper });
    await waitFor(() => expect(mocks.journalCount).toHaveBeenCalledTimes(1));
    act(() => mocks.boundaryListener!());
    await waitFor(() =>
      expect(result.current.journalEntryCountState).toEqual({
        status: "ready",
        count: 0,
      })
    );

    resolveOldCount(3);
    await act(async () => Promise.resolve());
    expect(result.current.journalEntryCountState).toEqual({ status: "ready", count: 0 });
  });

  it("keeps account-B eligibility loading until account-A data has finished purging", async () => {
    mocks.isFeatureUnlocked.mockReturnValue(false);
    setSevenActiveDays();
    let postPurge = false;
    mocks.journalCount.mockImplementation(async () => (postPurge ? 0 : 3));
    let releaseSettlement!: () => void;
    mocks.waitForBoundarySettlement
      .mockResolvedValueOnce(undefined)
      .mockReturnValueOnce(
        new Promise<void>((resolve) => {
          releaseSettlement = resolve;
        })
      );

    const { result } = renderHook(() => useFeatureFlags(), { wrapper });
    await waitFor(() =>
      expect(result.current.journalEntryCountState).toEqual({
        status: "ready",
        count: 3,
      })
    );
    expect(result.current.isFeatureVisible("challenges")).toBe(true);

    act(() => mocks.boundaryListener!());

    expect(result.current.journalEntryCountState).toEqual({ status: "loading" });
    expect(result.current.getFeatureAvailability("challenges")).toMatchObject({
      visible: false,
      reason: "journal-count-loading",
    });
    expect(mocks.journalCount).toHaveBeenCalledTimes(1);

    postPurge = true;
    await act(async () => releaseSettlement());

    await waitFor(() =>
      expect(result.current.journalEntryCountState).toEqual({
        status: "ready",
        count: 0,
      })
    );
    expect(mocks.journalCount).toHaveBeenCalledTimes(2);
    expect(result.current.isFeatureVisible("challenges")).toBe(false);
  });

  it("keeps the boolean adapter exactly equal to structured visibility", async () => {
    mocks.isFeatureUnlocked.mockReturnValue(false);
    setSevenActiveDays();
    mocks.journalCount.mockResolvedValue(3);
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    await waitFor(() => expect(result.current.journalEntryCountState.status).toBe("ready"));
    for (const feature of ["focusTimer", "quests", "challenges", "deltaSync"] as const) {
      expect(result.current.isFeatureVisible(feature)).toBe(
        result.current.getFeatureAvailability(feature).visible
      );
    }
  });

  it("uses a reviewed default for a missing stored key and never a permissive catch-all", () => {
    delete mocks.flags.innerWorld;
    delete mocks.flags.aiCoach;
    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    expect(result.current.isFeatureEnabled("innerWorld")).toBe(true);
    expect(result.current.isFeatureEnabled("aiCoach")).toBe(false);
    expect(result.current.isFeatureVisible("innerWorld")).toBe(false);
  });

  it("resets stored choices and exposes the convenience hook", () => {
    const flags = renderHook(() => useFeatureFlags(), { wrapper });
    act(() => flags.result.current.resetFlags());
    expect(mocks.setFlags).toHaveBeenLastCalledWith(DEFAULT_FEATURE_FLAGS);

    const visible = renderHook(() => useFeatureVisible("focusTimer"), { wrapper });
    expect(visible.result.current).toBe(true);
  });

  it("rejects context access outside the provider", () => {
    expect(() => requireFeatureFlagsProvider(undefined)).toThrow(
      "useFeatureFlags must be used within a FeatureFlagsProvider"
    );
  });
});
