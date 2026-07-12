import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Badge, Challenge } from "@/types";

const state = vi.hoisted<{ activeOwnerUserId: string | null }>(() => ({
  activeOwnerUserId: "account-a",
}));

const mocks = vi.hoisted(() => ({
  validateSyncOwner: vi.fn(),
  sync: vi.fn(),
  from: vi.fn(),
  challengeUpsert: vi.fn(),
  badgeUpsert: vi.fn(),
  challengeLimit: vi.fn(),
  badgeLimit: vi.fn(),
  getChallenges: vi.fn(),
  saveChallenges: vi.fn(),
  getBadges: vi.fn(),
  saveBadges: vi.fn(),
  triggerDataRefresh: vi.fn(),
}));

vi.mock("@/storage/sync/syncOwner", () => ({
  validateSyncOwner: mocks.validateSyncOwner,
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { from: mocks.from },
}));

vi.mock("@/lib/syncOrchestrator", () => ({
  syncOrchestrator: { sync: mocks.sync },
}));

vi.mock("@/lib/challengeStorage", () => ({
  getChallenges: mocks.getChallenges,
  saveChallenges: mocks.saveChallenges,
  getBadges: mocks.getBadges,
  saveBadges: mocks.saveBadges,
}));

vi.mock("@/hooks/useIndexedDB", () => ({
  triggerDataRefresh: mocks.triggerDataRefresh,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

import {
  syncBadgesWithCloud,
  syncChallengesWithCloud,
} from "../challengeCloudSync";

const challengeOwnedByA: Challenge = {
  id: "challenge-a",
  type: "focus",
  progress: 10,
  target: 20,
  completed: false,
  startDate: "2026-07-10",
  icon: "target",
  title: { en: "Account A challenge" },
  description: { en: "Focus for twenty minutes" },
};

const badgeOwnedByA: Badge = {
  id: "badge-a",
  category: "focus",
  unlocked: true,
  unlockedDate: "2026-07-10",
  icon: "award",
  title: { en: "Account A badge" },
  description: { en: "Completed by account A" },
  requirement: 1,
  rarity: "common",
};

function makeSelectChain(limit: ReturnType<typeof vi.fn>) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(() => ({ limit })),
      })),
    })),
  };
}

describe("challengeCloudSync local account ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.activeOwnerUserId = "account-a";

    mocks.validateSyncOwner.mockImplementation(
      async (expectedOwnerUserId: string, operation: string) => {
        if (state.activeOwnerUserId !== expectedOwnerUserId) {
          throw new Error(`${operation} stopped at an account boundary`);
        }
        return expectedOwnerUserId;
      }
    );
    mocks.sync.mockImplementation(
      async (_type: string, operation: () => Promise<void>) => operation()
    );
    mocks.challengeLimit.mockResolvedValue({ data: [], error: null });
    mocks.badgeLimit.mockResolvedValue({ data: [], error: null });
    mocks.challengeUpsert.mockResolvedValue({ error: null });
    mocks.badgeUpsert.mockResolvedValue({ error: null });
    mocks.from.mockImplementation((table: string) => {
      if (table === "user_challenges") {
        return {
          ...makeSelectChain(mocks.challengeLimit),
          upsert: mocks.challengeUpsert,
        };
      }
      if (table === "user_badges") {
        return {
          ...makeSelectChain(mocks.badgeLimit),
          upsert: mocks.badgeUpsert,
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.getChallenges.mockReturnValue([challengeOwnedByA]);
    mocks.getBadges.mockReturnValue([badgeOwnedByA]);
    mocks.triggerDataRefresh.mockResolvedValue(undefined);
  });

  it("rejects a stale account-A challenge sync before shared local state is read", async () => {
    state.activeOwnerUserId = "account-b";

    await expect(syncChallengesWithCloud("account-a")).rejects.toThrow(
      "account boundary"
    );

    expect(mocks.getChallenges).not.toHaveBeenCalled();
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it("rejects a stale account-A badge sync before defaults can initialize shared storage", async () => {
    state.activeOwnerUserId = "account-b";

    await expect(syncBadgesWithCloud("account-a")).rejects.toThrow(
      "account boundary"
    );

    expect(mocks.getBadges).not.toHaveBeenCalled();
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it("does not save account-A challenges after their upsert completes under account B", async () => {
    mocks.challengeUpsert.mockImplementation(async () => {
      state.activeOwnerUserId = "account-b";
      return { error: null };
    });

    await expect(syncChallengesWithCloud("account-a")).rejects.toThrow(
      "account boundary"
    );

    expect(mocks.saveChallenges).not.toHaveBeenCalled();
    expect(mocks.triggerDataRefresh).not.toHaveBeenCalled();
  });

  it("does not save account-A badges after their upsert completes under account B", async () => {
    mocks.badgeUpsert.mockImplementation(async () => {
      state.activeOwnerUserId = "account-b";
      return { error: null };
    });

    await expect(syncBadgesWithCloud("account-a")).rejects.toThrow(
      "account boundary"
    );

    expect(mocks.saveBadges).not.toHaveBeenCalled();
    expect(mocks.triggerDataRefresh).not.toHaveBeenCalled();
  });

  it("does not return account-A challenges when refresh crosses into account B", async () => {
    mocks.triggerDataRefresh.mockImplementation(async () => {
      state.activeOwnerUserId = "account-b";
    });

    await expect(syncChallengesWithCloud("account-a")).rejects.toThrow(
      "account boundary"
    );

    expect(mocks.saveChallenges).toHaveBeenCalledWith([challengeOwnedByA]);
  });

  it("does not return account-A badges when refresh crosses into account B", async () => {
    mocks.triggerDataRefresh.mockImplementation(async () => {
      state.activeOwnerUserId = "account-b";
    });

    await expect(syncBadgesWithCloud("account-a")).rejects.toThrow(
      "account boundary"
    );

    expect(mocks.saveBadges).toHaveBeenCalledWith([badgeOwnedByA]);
  });

  it("saves legitimate challenge merges while account A remains current", async () => {
    await expect(syncChallengesWithCloud("account-a")).resolves.toEqual({
      challenges: [challengeOwnedByA],
    });

    expect(mocks.saveChallenges).toHaveBeenCalledWith([challengeOwnedByA]);
    expect(mocks.sync).toHaveBeenCalledWith(
      "challenges",
      expect.any(Function),
      expect.objectContaining({ expectedOwnerUserId: "account-a" })
    );
  });

  it("saves legitimate badge merges while account A remains current", async () => {
    await expect(syncBadgesWithCloud("account-a")).resolves.toEqual({
      badges: [badgeOwnedByA],
    });

    expect(mocks.saveBadges).toHaveBeenCalledWith([badgeOwnedByA]);
    expect(mocks.sync).toHaveBeenCalledWith(
      "badges",
      expect.any(Function),
      expect.objectContaining({ expectedOwnerUserId: "account-a" })
    );
  });
});
