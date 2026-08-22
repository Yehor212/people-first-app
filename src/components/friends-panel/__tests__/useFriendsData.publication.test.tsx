import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureMyFriendProfilePublished: vi.fn(),
  publishedProfile: {
    friendCode: "ZF-ACCOUNTA",
    displayName: "Avery",
    avatarEmoji: "🌱",
    currentStreak: 4,
    level: 2,
    shareStreak: true,
    shareLevel: true,
    shareActivity: true,
  },
}));

vi.mock("@/lib/haptics", () => ({ hapticTap: vi.fn() }));
vi.mock("@/lib/presenceService", () => ({ subscribeToPresence: () => () => undefined }));
vi.mock("@/storage/friendsSync", () => ({
  ensureMyFriendProfilePublished: mocks.ensureMyFriendProfilePublished,
  getFriendsSortedByActivity: () => [],
  getRecentActivities: () => [],
  initializeMyProfile: () => mocks.publishedProfile,
  loadMyProfile: () => mocks.publishedProfile,
  updateMyProfile: vi.fn(),
}));

import { useFriendsData } from "@/components/friends-panel/useFriendsData";

const publishedProfile = mocks.publishedProfile;

describe("useFriendsData share readiness", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exposes a friend code only after owner-fenced cloud publication succeeds", async () => {
    mocks.ensureMyFriendProfilePublished.mockResolvedValue(publishedProfile);

    const { result } = renderHook(() =>
      useFriendsData({ userName: "Avery", currentStreak: 4, level: 2 }),
    );

    expect(result.current.profilePublication).toBe("loading");
    expect(result.current.myProfile).toBeNull();

    await waitFor(() => expect(result.current.profilePublication).toBe("ready"));
    expect(result.current.myProfile).toEqual(publishedProfile);
  });

  it("keeps the code unavailable when publication cannot be verified", async () => {
    mocks.ensureMyFriendProfilePublished.mockResolvedValue(null);

    const { result } = renderHook(() =>
      useFriendsData({ userName: "Avery", currentStreak: 4, level: 2 }),
    );

    await act(async () => Promise.resolve());
    await waitFor(() => expect(result.current.profilePublication).toBe("unavailable"));
    expect(result.current.myProfile).toBeNull();
  });
});
