import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentSessionUserId: vi.fn(),
  pushInnerWorldToCloud: vi.fn(),
  setWorld: vi.fn(),
  updateMyStreak: vi.fn(),
  useIndexedDB: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  getCurrentSessionUserId: mocks.getCurrentSessionUserId,
}));

vi.mock("@/storage/innerWorldCloudSync", () => ({
  pushInnerWorldToCloud: mocks.pushInnerWorldToCloud,
}));

vi.mock("@/storage/friendsSync", () => ({
  updateMyStreak: mocks.updateMyStreak,
}));

vi.mock("@/hooks/useIndexedDB", () => ({
  useIndexedDB: mocks.useIndexedDB,
}));

vi.mock("@/hooks/useRestMode", () => ({
  useRestMode: () => ({
    isRestMode: false,
    restModeStatus: {
      canActivate: true,
      daysUntilAvailable: 0,
      usedThisWeek: 0,
    },
    activateRestMode: vi.fn(),
    deactivateRestMode: vi.fn(),
  }),
}));

vi.mock("@/storage/db", () => ({
  db: { settings: {} },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

import { useInnerWorld } from "@/hooks/useInnerWorld";
import { createDefaultInnerWorld, getCurrentSeason } from "@/lib/innerWorldHelpers";
import { getToday } from "@/lib/utils";

describe("useInnerWorld cloud ownership", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    const worldOwnedByA = {
      ...createDefaultInnerWorld(),
      season: getCurrentSeason(),
      lastActiveDate: getToday(),
      currentActiveStreak: 0,
    };

    mocks.getCurrentSessionUserId.mockResolvedValue("user-a");
    mocks.pushInnerWorldToCloud.mockResolvedValue(undefined);
    mocks.useIndexedDB.mockReturnValue([worldOwnedByA, mocks.setWorld, false]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps account A stamped on the world captured by the five-second timer after switching to B", async () => {
    const { unmount } = renderHook(() => useInnerWorld());

    await act(async () => {
      await Promise.resolve();
    });

    mocks.getCurrentSessionUserId.mockResolvedValue("user-b");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(mocks.pushInnerWorldToCloud).toHaveBeenCalledWith(
      expect.objectContaining({ lastActiveDate: getToday() }),
      "user-a"
    );

    unmount();
  });

  it("stamps the originating account on a streak update before friends sync starts", async () => {
    const worldOwnedByA = {
      ...createDefaultInnerWorld(),
      season: getCurrentSeason(),
      lastActiveDate: getToday(),
      currentActiveStreak: 9,
    };
    mocks.useIndexedDB.mockReturnValue([worldOwnedByA, mocks.setWorld, false]);

    const { unmount } = renderHook(() => useInnerWorld());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mocks.updateMyStreak).toHaveBeenCalledWith(9, "user-a");

    unmount();
  });
});
