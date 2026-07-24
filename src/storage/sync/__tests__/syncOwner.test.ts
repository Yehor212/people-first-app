import { beforeEach, describe, expect, it, vi } from "vitest";
import { SK } from "@/lib/storageKeys";
import { markPendingLocalBackupAccountClaim } from "@/storage/accountBoundaryRuntime";

const mocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn<() => Promise<string | null>>(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  getCurrentUserId: mocks.getCurrentUserId,
}));

import { validateSyncOwner } from "@/storage/sync/syncOwner";

describe("validateSyncOwner imported-backup admission", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.getCurrentUserId.mockReset();
    mocks.getCurrentUserId.mockResolvedValue("account-a");
  });

  it("admits the verified account when no imported backup claim is pending", async () => {
    await expect(validateSyncOwner("account-a", "Mood sync")).resolves.toBe("account-a");
  });

  it("blocks every cloud owner admission while an imported backup awaits a choice", async () => {
    expect(markPendingLocalBackupAccountClaim()).toBe(true);
    await expect(validateSyncOwner("account-a", "Mood sync")).rejects.toMatchObject({
      name: "SyncOwnerBoundaryError",
    });
  });

  it("fails closed when the imported-backup claim fence is malformed", async () => {
    localStorage.setItem(SK.PENDING_LOCAL_BACKUP_ACCOUNT_CLAIM, "malformed");
    await expect(validateSyncOwner("account-a", "Mood sync")).rejects.toMatchObject({
      name: "SyncOwnerBoundaryError",
    });
  });
});
