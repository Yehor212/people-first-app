import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  eq: vi.fn(),
  from: vi.fn(),
  getLocalDataOwnerId: vi.fn(),
  getCurrentSessionUserId: vi.fn(),
  getCurrentUserId: vi.fn(),
  getSession: vi.fn(),
  inQuery: vi.fn(),
  loggerWarn: vi.fn(),
  maybeSingle: vi.fn(),
  safeLocalStorageGet: vi.fn(),
  safeLocalStorageSet: vi.fn(),
  select: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  getCurrentSessionUserId: mocks.getCurrentSessionUserId,
  getCurrentUserId: mocks.getCurrentUserId,
  supabase: {
    auth: {
      getSession: mocks.getSession,
    },
    from: mocks.from,
  },
}));

vi.mock("@/lib/safeJson", () => ({
  safeLocalStorageGet: mocks.safeLocalStorageGet,
  safeLocalStorageSet: mocks.safeLocalStorageSet,
}));

vi.mock("@/storage/db", () => ({
  getLocalDataOwnerId: mocks.getLocalDataOwnerId,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    log: vi.fn(),
    warn: mocks.loggerWarn,
  },
}));

import { SK } from "@/lib/storageKeys";
import {
  addFriendByCode,
  type Friend,
  type MyProfile,
  refreshFriendsData,
  updateMyLevel,
  updateMyStreak,
} from "@/storage/friendsSync";

const profileOwnedByA: MyProfile = {
  friendCode: "ZF-ACCOUNTA",
  displayName: "Account A",
  avatarEmoji: "🌱",
  currentStreak: 4,
  level: 2,
  shareStreak: true,
  shareLevel: true,
  shareActivity: true,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

const friendOwnedByA: Friend = {
  id: "friend-a",
  userId: "friend-user",
  friendCode: "ZF-FRIEND01",
  displayName: "Existing friend",
  avatarEmoji: "🌿",
  currentStreak: 3,
  lastActive: "2026-07-10T12:00:00.000Z",
  level: 2,
  friendsSince: "2026-06-10T12:00:00.000Z",
};

describe("friendsSync account ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.safeLocalStorageGet.mockReturnValue({ ...profileOwnedByA });
    mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.select.mockReturnValue({ eq: mocks.eq, in: mocks.inQuery });
    mocks.from.mockReturnValue({ select: mocks.select, upsert: mocks.upsert });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.getCurrentUserId.mockResolvedValue("user-a");
    mocks.getCurrentSessionUserId.mockResolvedValue("user-a");
    mocks.getLocalDataOwnerId.mockResolvedValue("user-a");
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: "user-a" } } },
      error: null,
    });
  });

  it("does not write account A streak locally or remotely after the active account changes to B", async () => {
    mocks.getCurrentUserId.mockResolvedValue("user-b");
    mocks.getCurrentSessionUserId.mockResolvedValue("user-b");
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: "user-b" } } },
      error: null,
    });

    await updateMyStreak(12, "user-a");

    expect(mocks.safeLocalStorageSet).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("does not write account A level locally or remotely after the active account changes to B", async () => {
    mocks.getCurrentUserId.mockResolvedValue("user-b");
    mocks.getCurrentSessionUserId.mockResolvedValue("user-b");

    await updateMyLevel(7, "user-a");

    expect(mocks.safeLocalStorageSet).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("upserts a legitimate streak only under its explicitly stamped owner", async () => {
    await updateMyStreak(12, "user-a");

    expect(mocks.upsert).toHaveBeenCalledTimes(1);

    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-a",
        current_streak: 12,
      }),
      { onConflict: "user_id" }
    );
  });

  it("does not append account A friend data after a delayed lookup resolves under account B", async () => {
    const lookup = deferred<{
      data: {
        user_id: string;
        display_name: string;
        avatar_emoji: string;
        current_streak: number;
        level: number;
        updated_at: string;
        status: string | null;
      };
      error: null;
    }>();
    mocks.getCurrentUserId.mockResolvedValueOnce("user-a").mockResolvedValue("user-b");
    mocks.safeLocalStorageGet.mockImplementation((key: string) => {
      if (key === SK.FRIENDS) return [];
      if (key === SK.MY_FRIEND_PROFILE) return { ...profileOwnedByA };
      return null;
    });
    mocks.maybeSingle.mockReturnValue(lookup.promise);

    const pendingAdd = addFriendByCode("ZF-FRIEND01");
    await vi.waitFor(() => expect(mocks.maybeSingle).toHaveBeenCalledTimes(1));

    lookup.resolve({
      data: {
        user_id: "friend-user",
        display_name: "Cloud friend",
        avatar_emoji: "🌿",
        current_streak: 8,
        level: 4,
        updated_at: "2026-07-10T13:00:00.000Z",
        status: null,
      },
      error: null,
    });

    await expect(pendingAdd).resolves.toEqual({ success: false });
    expect(mocks.safeLocalStorageSet).not.toHaveBeenCalled();
  });

  it("does not create an account A fallback friend after an empty lookup settles under account B", async () => {
    const lookup = deferred<{ data: null; error: null }>();
    mocks.getCurrentUserId.mockResolvedValueOnce("user-a").mockResolvedValue("user-b");
    mocks.safeLocalStorageGet.mockImplementation((key: string) => {
      if (key === SK.FRIENDS) return [];
      if (key === SK.MY_FRIEND_PROFILE) return { ...profileOwnedByA };
      return null;
    });
    mocks.maybeSingle.mockReturnValue(lookup.promise);

    const pendingAdd = addFriendByCode("ZF-FRIEND01");
    await vi.waitFor(() => expect(mocks.maybeSingle).toHaveBeenCalledTimes(1));

    lookup.resolve({ data: null, error: null });

    await expect(pendingAdd).resolves.toEqual({ success: false });
    expect(mocks.safeLocalStorageSet).not.toHaveBeenCalled();
  });

  it("adds a cloud friend when the verified, session, and local owners stay aligned", async () => {
    mocks.safeLocalStorageGet.mockImplementation((key: string) => {
      if (key === SK.FRIENDS) return [];
      if (key === SK.MY_FRIEND_PROFILE) return { ...profileOwnedByA };
      return null;
    });
    mocks.maybeSingle.mockResolvedValue({
      data: {
        user_id: "friend-user",
        display_name: "Cloud friend",
        avatar_emoji: "🌿",
        current_streak: 8,
        level: 4,
        updated_at: "2026-07-10T13:00:00.000Z",
        status: null,
      },
      error: null,
    });

    const result = await addFriendByCode("ZF-FRIEND01");

    expect(result).toEqual({
      success: true,
      friend: expect.objectContaining({
        friendCode: "ZF-FRIEND01",
        userId: "friend-user",
      }),
    });
    expect(mocks.safeLocalStorageSet).toHaveBeenCalledWith(
      SK.FRIENDS,
      [expect.objectContaining({ friendCode: "ZF-FRIEND01", userId: "friend-user" })]
    );
  });

  it("does not fabricate or save a friend when the code has no authoritative cloud match", async () => {
    mocks.safeLocalStorageGet.mockImplementation((key: string) => {
      if (key === SK.FRIENDS) return [];
      if (key === SK.MY_FRIEND_PROFILE) return { ...profileOwnedByA };
      return null;
    });
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await addFriendByCode("ZF-FRIEND01");

    expect(result).toEqual({ success: false });
    expect(mocks.safeLocalStorageSet).not.toHaveBeenCalled();
  });

  it("does not replace missing authoritative identity fields with client placeholders", async () => {
    mocks.safeLocalStorageGet.mockImplementation((key: string) => {
      if (key === SK.FRIENDS) return [];
      if (key === SK.MY_FRIEND_PROFILE) return { ...profileOwnedByA };
      return null;
    });
    mocks.maybeSingle.mockResolvedValue({
      data: {
        user_id: "friend-user",
        display_name: null,
        avatar_emoji: null,
        current_streak: 8,
        level: 4,
        updated_at: "2026-07-10T13:00:00.000Z",
        status: null,
      },
      error: null,
    });

    const result = await addFriendByCode("ZF-FRIEND01");

    expect(result).toEqual({ success: false });
    expect(mocks.safeLocalStorageSet).not.toHaveBeenCalled();
  });

  it("keeps private cloud metrics hidden instead of presenting fallback values as real", async () => {
    mocks.safeLocalStorageGet.mockImplementation((key: string) => {
      if (key === SK.FRIENDS) return [];
      if (key === SK.MY_FRIEND_PROFILE) return { ...profileOwnedByA };
      return null;
    });
    mocks.maybeSingle.mockResolvedValue({
      data: {
        user_id: "friend-user",
        display_name: "Private friend",
        avatar_emoji: "🌿",
        current_streak: null,
        level: null,
        updated_at: "2026-07-10T13:00:00.000Z",
        status: null,
      },
      error: null,
    });

    const result = await addFriendByCode("ZF-FRIEND01");

    expect(result).toEqual({
      success: true,
      friend: expect.objectContaining({
        streakHidden: true,
        levelHidden: true,
      }),
    });
    expect(mocks.safeLocalStorageSet).toHaveBeenCalledWith(
      SK.FRIENDS,
      [expect.objectContaining({ streakHidden: true, levelHidden: true })]
    );
  });

  it("does not fabricate or save a friend when cloud lookup is unavailable", async () => {
    mocks.safeLocalStorageGet.mockImplementation((key: string) => {
      if (key === SK.FRIENDS) return [];
      if (key === SK.MY_FRIEND_PROFILE) return { ...profileOwnedByA };
      return null;
    });
    mocks.maybeSingle.mockRejectedValue(new Error("network unavailable"));

    const result = await addFriendByCode("ZF-FRIEND01");

    expect(result).toEqual({ success: false });
    expect(mocks.safeLocalStorageSet).not.toHaveBeenCalled();
  });

  it("does not overwrite account B friends after account A refresh resolves late", async () => {
    const refresh = deferred<{
      data: Array<{
        user_id: string;
        friend_code: string;
        display_name: string;
        avatar_emoji: string;
        current_streak: number;
        level: number;
        updated_at: string;
        status: string | null;
        share_activity: boolean;
      }>;
      error: null;
    }>();
    mocks.getCurrentUserId.mockResolvedValueOnce("user-a").mockResolvedValue("user-b");
    mocks.safeLocalStorageGet.mockImplementation((key: string) =>
      key === SK.FRIENDS ? [{ ...friendOwnedByA }] : null
    );
    mocks.inQuery.mockReturnValue(refresh.promise);

    const pendingRefresh = refreshFriendsData();
    await vi.waitFor(() => expect(mocks.inQuery).toHaveBeenCalledTimes(1));

    refresh.resolve({
      data: [
        {
          user_id: "friend-user",
          friend_code: friendOwnedByA.friendCode,
          display_name: "Late cloud name",
          avatar_emoji: "🌳",
          current_streak: 9,
          level: 5,
          updated_at: "2026-07-10T14:00:00.000Z",
          status: null,
          share_activity: true,
        },
      ],
      error: null,
    });

    await pendingRefresh;
    expect(mocks.safeLocalStorageSet).not.toHaveBeenCalled();
  });

  it("refreshes friends when the verified, session, and local owners stay aligned", async () => {
    mocks.safeLocalStorageGet.mockImplementation((key: string) =>
      key === SK.FRIENDS ? [{ ...friendOwnedByA }] : null
    );
    mocks.inQuery.mockResolvedValue({
      data: [
        {
          user_id: "friend-user",
          friend_code: friendOwnedByA.friendCode,
          display_name: "Current cloud name",
          avatar_emoji: "🌳",
          current_streak: 9,
          level: 5,
          updated_at: "2026-07-10T14:00:00.000Z",
          status: null,
          share_activity: true,
        },
      ],
      error: null,
    });

    await refreshFriendsData();

    expect(mocks.safeLocalStorageSet).toHaveBeenCalledWith(
      SK.FRIENDS,
      [
        expect.objectContaining({
          displayName: "Current cloud name",
          friendCode: friendOwnedByA.friendCode,
          level: 5,
        }),
      ]
    );
  });
});
