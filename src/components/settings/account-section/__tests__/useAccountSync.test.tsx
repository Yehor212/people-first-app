import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useAccountSync } from "../useAccountSync";

const mocks = vi.hoisted(() => ({
  currentOwnerUserId: "account-a",
  ensureCloudSyncEnabled: vi.fn(),
  getCurrentSessionUserId: vi.fn(),
  isCloudSyncEnabled: vi.fn(() => false),
  startAutoSync: vi.fn(),
  isCalendarConnected: vi.fn(() => Promise.resolve(false)),
  loadWeeklyDigest: vi.fn(),
  updateWeeklyDigest: vi.fn(),
  validateSyncOwner: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {},
  getCurrentSessionUserId: mocks.getCurrentSessionUserId,
}));

vi.mock("@/storage/sync/syncOwner", () => {
  class SyncOwnerBoundaryError extends Error {
    constructor(operation: string) {
      super(`${operation} stopped at an account boundary`);
      this.name = "SyncOwnerBoundaryError";
    }
  }
  return {
    SyncOwnerBoundaryError,
    validateSyncOwner: mocks.validateSyncOwner,
  };
});

vi.mock("@/lib/cloudSyncSettings", () => ({
  ensureCloudSyncEnabled: mocks.ensureCloudSyncEnabled,
  isCloudSyncEnabled: mocks.isCloudSyncEnabled,
}));

vi.mock("@/storage/cloudSync", () => ({
  startAutoSync: mocks.startAutoSync,
}));

vi.mock("@/lib/googleCalendar", () => ({
  isCalendarConnected: mocks.isCalendarConnected,
}));

vi.mock("@/lib/accountService", () => ({
  loadWeeklyDigest: mocks.loadWeeklyDigest,
  updateWeeklyDigest: mocks.updateWeeklyDigest,
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), log: vi.fn() },
}));

describe("useAccountSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentOwnerUserId = "account-a";
    mocks.getCurrentSessionUserId.mockImplementation(async () => mocks.currentOwnerUserId);
    mocks.validateSyncOwner.mockImplementation(async (expectedOwnerUserId: string) => {
      if (mocks.currentOwnerUserId !== expectedOwnerUserId) {
        const error = new Error("Weekly digest stopped at an account boundary");
        error.name = "SyncOwnerBoundaryError";
        throw error;
      }
      return expectedOwnerUserId;
    });
    mocks.loadWeeklyDigest.mockResolvedValue(null);
    mocks.updateWeeklyDigest.mockResolvedValue(true);
    mocks.isCloudSyncEnabled.mockReturnValue(false);
  });

  it("turns signed-in accounts into automatic sync accounts", async () => {
    const { result } = renderHook(() =>
      useAccountSync({
        sessionUserId: "user-1",
        setAuthStatus: vi.fn(),
        t: {},
      }),
    );

    await waitFor(() => {
      expect(mocks.ensureCloudSyncEnabled).toHaveBeenCalledTimes(1);
      expect(mocks.startAutoSync).toHaveBeenCalledTimes(1);
    });
    expect(result.current.cloudSyncEnabled).toBe(true);
  });

  it("does not start automatic sync without a signed-in account", () => {
    const { result } = renderHook(() =>
      useAccountSync({
        sessionUserId: null,
        setAuthStatus: vi.fn(),
        t: {},
      }),
    );

    expect(mocks.ensureCloudSyncEnabled).not.toHaveBeenCalled();
    expect(mocks.startAutoSync).not.toHaveBeenCalled();
    expect(result.current.cloudSyncEnabled).toBe(false);
  });

  it("resets touched state for account B and ignores account A's delayed digest load", async () => {
    let finishAccountALoad!: (value: boolean) => void;
    const accountALoad = new Promise<boolean>((resolve) => {
      finishAccountALoad = resolve;
    });
    mocks.loadWeeklyDigest
      .mockReturnValueOnce(accountALoad)
      .mockResolvedValueOnce(true);

    const { result, rerender } = renderHook(
      ({ sessionUserId }) =>
        useAccountSync({
          sessionUserId,
          setAuthStatus: vi.fn(),
          t: {},
        }),
      { initialProps: { sessionUserId: "account-a" } },
    );

    await waitFor(() => expect(mocks.loadWeeklyDigest).toHaveBeenCalledWith("account-a"));
    act(() => {
      result.current.weeklyDigestTouchedRef.current = true;
      result.current.setWeeklyDigestEnabled(false);
    });

    mocks.currentOwnerUserId = "account-b";
    rerender({ sessionUserId: "account-b" });

    await waitFor(() => {
      expect(result.current.weeklyDigestTouchedRef.current).toBe(false);
      expect(mocks.loadWeeklyDigest).toHaveBeenCalledWith("account-b");
      expect(result.current.weeklyDigestEnabled).toBe(true);
    });

    await act(async () => {
      finishAccountALoad(false);
      await accountALoad;
    });

    expect(result.current.weeklyDigestEnabled).toBe(true);
  });

  it("ignores account A's delayed failed toggle after account B loads its own value", async () => {
    let finishAccountAUpdate!: (value: boolean) => void;
    const accountAUpdate = new Promise<boolean>((resolve) => {
      finishAccountAUpdate = resolve;
    });
    mocks.loadWeeklyDigest
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    mocks.updateWeeklyDigest.mockReturnValueOnce(accountAUpdate);
    const setAuthStatus = vi.fn();

    const { result, rerender } = renderHook(
      ({ sessionUserId }) =>
        useAccountSync({
          sessionUserId,
          setAuthStatus,
          t: { weeklyDigestError: "Digest failed" },
        }),
      { initialProps: { sessionUserId: "account-a" } },
    );
    await waitFor(() => expect(mocks.loadWeeklyDigest).toHaveBeenCalledWith("account-a"));

    let togglePromise!: Promise<void>;
    act(() => {
      result.current.weeklyDigestTouchedRef.current = true;
      result.current.setWeeklyDigestEnabled(true);
      togglePromise = result.current.handleWeeklyDigestToggle(true);
    });
    await waitFor(() => expect(mocks.updateWeeklyDigest).toHaveBeenCalledWith("account-a", true));

    mocks.currentOwnerUserId = "account-b";
    rerender({ sessionUserId: "account-b" });
    await waitFor(() => expect(result.current.weeklyDigestEnabled).toBe(true));

    await act(async () => {
      finishAccountAUpdate(false);
      await togglePromise;
    });

    expect(result.current.weeklyDigestEnabled).toBe(true);
    expect(setAuthStatus).not.toHaveBeenCalledWith("Digest failed");
  });
});
