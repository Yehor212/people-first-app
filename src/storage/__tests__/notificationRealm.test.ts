import { beforeEach, describe, expect, it, vi } from "vitest";
import { SK } from "@/lib/storageKeys";
import {
  advanceOriginAccountBoundaryGeneration,
  captureOriginAccountBoundaryGeneration,
  clearPendingLocalBackupAccountClaim,
  hasImportedBackupLocalOnlyAccess,
  markImportedBackupLocalOnlyAccess,
  markPendingLocalBackupAccountClaim,
  readImportedBackupLocalOnlyDecisionRevision,
  readPendingLocalBackupAccountClaim,
} from "@/storage/accountBoundaryRuntime";
import { db } from "@/storage/db";
import {
  assertVerifiedNotificationRealmCurrent,
  readVerifiedNotificationRealm,
} from "@/storage/notificationRealm";

const mocks = vi.hoisted(() => ({
  getVerifiedCurrentSessionUserId: vi.fn<() => Promise<string | null>>(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  getVerifiedCurrentSessionUserId: mocks.getVerifiedCurrentSessionUserId,
}));

const ACCOUNT_A = "1d4fe896-fd48-4f4f-a32e-f12d5618ed7a";
const ACCOUNT_B = "97b42a9c-0378-47b7-98c1-45d700c14568";

async function bindLocalOwner(ownerUserId: string): Promise<void> {
  await db.settings.put({ key: SK.DATA_OWNER_ID, value: ownerUserId });
}

describe("notificationRealm", () => {
  beforeEach(async () => {
    await db.open();
    await db.settings.clear();
    localStorage.clear();
    mocks.getVerifiedCurrentSessionUserId.mockReset();
    mocks.getVerifiedCurrentSessionUserId.mockResolvedValue(null);
  });

  it("accepts the confirmed signed-out, unowned device realm", async () => {
    await expect(readVerifiedNotificationRealm()).resolves.toEqual({
      kind: "local",
      ownerUserId: null,
      generation: captureOriginAccountBoundaryGeneration(),
    });
  });

  it("accepts an account realm only when session and durable owner match", async () => {
    mocks.getVerifiedCurrentSessionUserId.mockResolvedValue(ACCOUNT_A);
    await bindLocalOwner(ACCOUNT_A);

    await expect(readVerifiedNotificationRealm()).resolves.toEqual({
      kind: "account",
      ownerUserId: ACCOUNT_A,
      generation: captureOriginAccountBoundaryGeneration(),
    });
  });

  it("blocks when session verification fails", async () => {
    mocks.getVerifiedCurrentSessionUserId.mockRejectedValue(
      new Error("Unable to verify the active session")
    );

    await expect(readVerifiedNotificationRealm()).rejects.toThrow(
      "Unable to verify the active session"
    );
  });

  it("blocks while a valid account cleanup marker is present", async () => {
    localStorage.setItem(
      SK.PENDING_ACCOUNT_SIGN_OUT_CLEANUP,
      JSON.stringify({
        version: 1,
        ownerUserId: ACCOUNT_A,
        localDataOwnerUserId: ACCOUNT_A,
        phase: "purging-local-data",
        createdAt: Date.now(),
      })
    );

    await expect(readVerifiedNotificationRealm()).rejects.toMatchObject({
      reason: "cleanup-pending",
    });
    expect(mocks.getVerifiedCurrentSessionUserId).not.toHaveBeenCalled();
  });

  it("blocks a corrupt account cleanup marker instead of ignoring it", async () => {
    localStorage.setItem(SK.PENDING_ACCOUNT_SIGN_OUT_CLEANUP, "{not-json");

    await expect(readVerifiedNotificationRealm()).rejects.toMatchObject({
      reason: "cleanup-pending",
    });
  });

  it("blocks when the cleanup marker cannot be read", async () => {
    const originalGetItem = Storage.prototype.getItem;
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (
      this: Storage,
      key: string
    ) {
      if (key === SK.PENDING_ACCOUNT_SIGN_OUT_CLEANUP) {
        throw new DOMException("Storage unavailable", "SecurityError");
      }
      return originalGetItem.call(this, key);
    });

    try {
      await expect(readVerifiedNotificationRealm()).rejects.toMatchObject({
        reason: "cleanup-marker-unavailable",
      });
    } finally {
      getItem.mockRestore();
    }
  });

  it("blocks a session and durable owner mismatch", async () => {
    mocks.getVerifiedCurrentSessionUserId.mockResolvedValue(ACCOUNT_A);
    await bindLocalOwner(ACCOUNT_B);

    await expect(readVerifiedNotificationRealm()).rejects.toMatchObject({
      reason: "owner-mismatch",
    });
  });

  it("blocks a malformed durable owner record", async () => {
    await db.settings.put({ key: SK.DATA_OWNER_ID, value: 42 });

    await expect(readVerifiedNotificationRealm()).rejects.toMatchObject({
      reason: "invalid-data-owner",
    });
  });

  it("rejects a previously verified realm after the session changes", async () => {
    mocks.getVerifiedCurrentSessionUserId.mockResolvedValue(ACCOUNT_A);
    await bindLocalOwner(ACCOUNT_A);
    const realm = await readVerifiedNotificationRealm();
    mocks.getVerifiedCurrentSessionUserId.mockResolvedValue(ACCOUNT_B);

    await expect(assertVerifiedNotificationRealmCurrent(realm)).rejects.toMatchObject({
      reason: "owner-mismatch",
    });
  });

  it("rejects a previously verified realm after the durable owner changes", async () => {
    mocks.getVerifiedCurrentSessionUserId.mockResolvedValue(ACCOUNT_A);
    await bindLocalOwner(ACCOUNT_A);
    const realm = await readVerifiedNotificationRealm();
    await bindLocalOwner(ACCOUNT_B);

    await expect(assertVerifiedNotificationRealmCurrent(realm)).rejects.toMatchObject({
      reason: "owner-mismatch",
    });
  });

  it("rejects a previously verified realm when cleanup starts", async () => {
    const realm = await readVerifiedNotificationRealm();
    localStorage.setItem(SK.PENDING_ACCOUNT_SIGN_OUT_CLEANUP, "{}");

    await expect(assertVerifiedNotificationRealmCurrent(realm)).rejects.toMatchObject({
      reason: "cleanup-pending",
    });
  });

  it("rejects a previously verified realm after the account generation advances", async () => {
    const realm = await readVerifiedNotificationRealm();
    advanceOriginAccountBoundaryGeneration();

    await expect(assertVerifiedNotificationRealmCurrent(realm)).rejects.toMatchObject({
      code: "ACCOUNT_BOUNDARY_CHANGED",
    });
  });

  it("persists and clears the owner-null backup account-claim fence", () => {
    expect(readPendingLocalBackupAccountClaim()).toEqual({ status: "none" });
    expect(markPendingLocalBackupAccountClaim()).toBe(true);
    expect(readPendingLocalBackupAccountClaim()).toEqual({
      status: "pending",
      generation: captureOriginAccountBoundaryGeneration(),
    });
    expect(clearPendingLocalBackupAccountClaim()).toBe(true);
    expect(readPendingLocalBackupAccountClaim()).toEqual({ status: "none" });
  });

  it("keeps local-only recovery usable when pending-claim removal fails", () => {
    expect(markPendingLocalBackupAccountClaim()).toBe(true);
    expect(markImportedBackupLocalOnlyAccess()).toBe(true);
    const originalRemoveItem = Storage.prototype.removeItem;
    const removeItem = vi
      .spyOn(Storage.prototype, "removeItem")
      .mockImplementation(function (this: Storage, key: string) {
        if (key === SK.PENDING_LOCAL_BACKUP_ACCOUNT_CLAIM) {
          throw new DOMException("storage unavailable", "SecurityError");
        }
        return originalRemoveItem.call(this, key);
      });

    try {
      expect(clearPendingLocalBackupAccountClaim()).toBe(false);
      expect(readPendingLocalBackupAccountClaim().status).toBe("pending");
      expect(hasImportedBackupLocalOnlyAccess()).toBe(true);
    } finally {
      removeItem.mockRestore();
    }
  });

  it("advances the durable decision revision whenever local-only is chosen again", () => {
    expect(markPendingLocalBackupAccountClaim()).toBe(true);
    expect(markImportedBackupLocalOnlyAccess()).toBe(true);
    const firstRevision = readImportedBackupLocalOnlyDecisionRevision();
    expect(firstRevision).toMatch(/^[0-9a-f-]{32,36}$/i);

    expect(markImportedBackupLocalOnlyAccess()).toBe(true);
    expect(readImportedBackupLocalOnlyDecisionRevision()).not.toBe(firstRevision);
  });

  it("fails closed when the backup account-claim fence is malformed", () => {
    localStorage.setItem(SK.PENDING_LOCAL_BACKUP_ACCOUNT_CLAIM, "not-json");
    expect(readPendingLocalBackupAccountClaim()).toEqual({ status: "invalid" });
  });
});
