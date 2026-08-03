import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getCurrentSessionUserId: vi.fn(),
  getLocalDataOwnerId: vi.fn(),
  getPersistentDeviceId: vi.fn(),
  readPendingLocalBackupAccountClaim: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  getCurrentSessionUserId: mocks.getCurrentSessionUserId,
  supabase: { from: mocks.from },
}));

vi.mock("@/storage/db", () => ({
  getLocalDataOwnerId: mocks.getLocalDataOwnerId,
}));

vi.mock("@/storage/eventSync", () => ({
  getPersistentDeviceId: mocks.getPersistentDeviceId,
}));

vi.mock("@/storage/accountBoundaryRuntime", () => ({
  readPendingLocalBackupAccountClaim: mocks.readPendingLocalBackupAccountClaim,
}));

import { upsertCurrentDeviceSession } from "@/storage/deviceSessions";

describe("device session account boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentSessionUserId.mockResolvedValue("account-a");
    mocks.getLocalDataOwnerId.mockResolvedValue("account-a");
    mocks.getPersistentDeviceId.mockResolvedValue("device-a");
    mocks.readPendingLocalBackupAccountClaim.mockReturnValue({ status: "none" });
    mocks.from.mockReturnValue({ upsert: mocks.upsert });
    mocks.upsert.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ single: mocks.single });
    mocks.single.mockResolvedValue({
      data: {
        id: "session-a",
        user_id: "account-a",
        device_id: "device-a",
      },
      error: null,
    });
  });

  it.each(["pending", "invalid", "unavailable"] as const)(
    "does not create a device heartbeat while the imported-backup claim is %s",
    async (status) => {
      mocks.readPendingLocalBackupAccountClaim.mockReturnValue({ status });

      await expect(upsertCurrentDeviceSession("mount")).resolves.toBeNull();

      expect(mocks.getPersistentDeviceId).not.toHaveBeenCalled();
      expect(mocks.from).not.toHaveBeenCalled();
    }
  );

  it.each([null, "account-b"])(
    "does not create a device heartbeat when the local owner is %s",
    async (localOwnerUserId) => {
      mocks.getLocalDataOwnerId.mockResolvedValue(localOwnerUserId);

      await expect(upsertCurrentDeviceSession("mount")).resolves.toBeNull();

      expect(mocks.from).not.toHaveBeenCalled();
    }
  );

  it("rechecks the boundary after resolving the device id", async () => {
    mocks.readPendingLocalBackupAccountClaim
      .mockReturnValueOnce({ status: "none" })
      .mockReturnValueOnce({ status: "none" })
      .mockReturnValue({ status: "pending" });

    await expect(upsertCurrentDeviceSession("mount")).resolves.toBeNull();

    expect(mocks.getPersistentDeviceId).toHaveBeenCalledTimes(1);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
