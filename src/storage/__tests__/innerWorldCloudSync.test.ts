import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getCurrentUserId: vi.fn(),
  getLocalDataOwnerId: vi.fn(),
  readPendingLocalBackupAccountClaim: vi.fn(),
  getSession: vi.fn(),
  upsert: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  getCurrentUserId: mocks.getCurrentUserId,
  supabase: {
    auth: {
      getSession: mocks.getSession,
    },
    from: mocks.from,
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/storage/db", () => ({
  getLocalDataOwnerId: mocks.getLocalDataOwnerId,
}));

vi.mock("@/storage/accountBoundaryRuntime", () => ({
  readPendingLocalBackupAccountClaim: mocks.readPendingLocalBackupAccountClaim,
}));

import { createDefaultInnerWorld } from "@/lib/innerWorldHelpers";
import { SK } from "@/lib/storageKeys";
import {
  pullInnerWorldFromCloud,
  pushInnerWorldToCloud,
  syncInnerWorld,
} from "@/storage/innerWorldCloudSync";

describe("innerWorldCloudSync account ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.from.mockReturnValue({ select: mocks.select, upsert: mocks.upsert });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.getCurrentUserId.mockResolvedValue("user-a");
    mocks.getLocalDataOwnerId.mockResolvedValue("user-a");
    mocks.readPendingLocalBackupAccountClaim.mockReturnValue({ status: "none" });
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: "user-a" } } },
      error: null,
    });
  });

  it("does not upsert account A world data after the active account changes to B", async () => {
    mocks.getCurrentUserId.mockResolvedValue("user-b");
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: "user-b" } } },
      error: null,
    });

    await pushInnerWorldToCloud(createDefaultInnerWorld(), "user-a");

    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("upserts a legitimate world only under its explicitly stamped owner", async () => {
    const world = createDefaultInnerWorld();

    await pushInnerWorldToCloud(world, "user-a");

    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-a",
        world_data: world,
      }),
      { onConflict: "user_id" }
    );
  });

  it.each(["pending", "invalid", "unavailable"] as const)(
    "does not reach Supabase while the imported-backup claim is %s",
    async (status) => {
      mocks.readPendingLocalBackupAccountClaim.mockReturnValue({ status });

      await pushInnerWorldToCloud(createDefaultInnerWorld(), "user-a");

      expect(mocks.from).not.toHaveBeenCalled();
      expect(mocks.upsert).not.toHaveBeenCalled();
    }
  );

  it.each([null, "user-b"])(
    "does not reach Supabase when the local data owner is %s",
    async (localOwnerUserId) => {
      mocks.getLocalDataOwnerId.mockResolvedValue(localOwnerUserId);

      await pushInnerWorldToCloud(createDefaultInnerWorld(), "user-a");

      expect(mocks.from).not.toHaveBeenCalled();
      expect(mocks.upsert).not.toHaveBeenCalled();
    }
  );

  it("discards a pulled world if the exact local owner changes during the request", async () => {
    const cloudWorld = { ...createDefaultInnerWorld(), currentActiveStreak: 9 };
    mocks.maybeSingle.mockResolvedValue({ data: { world_data: cloudWorld }, error: null });
    mocks.getLocalDataOwnerId.mockResolvedValueOnce("user-a").mockResolvedValueOnce("user-b");

    await expect(pullInnerWorldFromCloud("user-a")).resolves.toBeNull();

    expect(mocks.from).toHaveBeenCalledTimes(1);
  });

  it("does not apply or upload a pulled world if ownership changes before local apply", async () => {
    const localWorld = createDefaultInnerWorld();
    const cloudWorld = { ...createDefaultInnerWorld(), currentActiveStreak: 9 };
    mocks.maybeSingle.mockResolvedValue({ data: { world_data: cloudWorld }, error: null });
    mocks.getLocalDataOwnerId
      .mockResolvedValueOnce("user-a")
      .mockResolvedValueOnce("user-a")
      .mockResolvedValueOnce("user-b");

    await expect(syncInnerWorld(localWorld, "user-a")).resolves.toBe(localWorld);

    expect(localStorage.getItem(SK.INNER_WORLD)).toBeNull();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
