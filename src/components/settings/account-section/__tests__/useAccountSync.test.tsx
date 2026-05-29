import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useAccountSync } from "../useAccountSync";

const mocks = vi.hoisted(() => ({
  ensureCloudSyncEnabled: vi.fn(),
  isCloudSyncEnabled: vi.fn(() => false),
  startAutoSync: vi.fn(),
  isCalendarConnected: vi.fn(() => Promise.resolve(false)),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {},
}));

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
  loadWeeklyDigest: vi.fn(() => Promise.resolve(null)),
  updateWeeklyDigest: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), log: vi.fn() },
}));

describe("useAccountSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
