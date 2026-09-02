import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PENDING_CLEANUP_KEY = "zenflow_pending_account_sign_out_cleanup";
const OPERATION_ID = "5bbbcf4f-3f44-4f3b-89eb-7f779c2ad85a";
const RECOVERY_SECRET = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const mocks = vi.hoisted(() => ({
  deleteAccount: vi.fn(),
  resumeAccountDeletion: vi.fn(),
  createAccountDeletionCapability: vi.fn(),
  getCurrentSessionUserId: vi.fn<() => Promise<string | null>>(),
  getSession: vi.fn(),
  signOut: vi.fn(),
  signOutExpectedOwnerLocally: vi.fn(),
  getLocalDataOwnerId: vi.fn<() => Promise<string | null>>(),
  clearLocalUserData: vi.fn(),
  quiesceCloudSync: vi.fn(),
  getCloudSyncAccountBoundaryEpoch: vi.fn(),
  isCloudSyncSuspendedForAccountBoundary: vi.fn(),
  resumeCloudSync: vi.fn(),
  startAutoSync: vi.fn(),
  suspendForAccountBoundary: vi.fn(),
  getAccountBoundaryEpoch: vi.fn(),
  isSuspendedForAccountBoundary: vi.fn(),
  hasPendingActionsForOwnerReady: vi.fn(),
  discardSuspendedActionsForAccountBoundary: vi.fn(),
  resumeAfterAccountBoundary: vi.fn(),
  hasPendingJournalSecurityMigrationForOwner: vi.fn(),
  hasPendingJournalSecurityRemovalForOwner: vi.fn(),
  getPendingJournalSecurityMigrationRevisionForOwner: vi.fn(),
  removePushToken: vi.fn(),
  revokeCurrentPush: vi.fn(),
  clearAccountNotificationsForBoundary: vi.fn(),
  resumeAccountNotifications: vi.fn(),
  clearNativeJournalBiometricCredential: vi.fn(),
  clearAccountDeviceSurfaces: vi.fn(),
  runWithDataWriteBarrier: vi.fn(),
  runWithSettledDataRead: vi.fn(),
  isDataWriteBarrierPostCommitError: vi.fn(() => false),
  clearJournalContentSession: vi.fn(),
  clearDeviceIdCache: vi.fn(),
  leavePresenceForAccountBoundary: vi.fn(),
  suspendAccountBoundaryWriters: vi.fn(),
  resumeAccountBoundaryWriters: vi.fn(),
  getAccountBoundaryWritersEpoch: vi.fn(),
  areAccountBoundaryWritersSuspended: vi.fn(),
  runWithOriginExclusiveLock: vi.fn(),
  boundaryState: {
    cloudEpoch: 0,
    cloudSuspended: false,
    queueEpoch: 0,
    queueSuspended: false,
    writerEpoch: 0,
    writersSuspended: false,
  },
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { auth: { getSession: mocks.getSession, signOut: mocks.signOut } },
  getCurrentSessionUserId: mocks.getCurrentSessionUserId,
}));

vi.mock("@/lib/accountService", () => ({
  deleteAccount: mocks.deleteAccount,
  resumeAccountDeletion: mocks.resumeAccountDeletion,
}));

vi.mock("@/lib/ownerBoundAuthSession", () => ({
  signOutExpectedOwnerLocally: mocks.signOutExpectedOwnerLocally,
}));

vi.mock("@/lib/accountDeletionCapability", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/accountDeletionCapability")>()),
  createAccountDeletionCapability: mocks.createAccountDeletionCapability,
}));

vi.mock("@/storage/db", () => ({
  getLocalDataOwnerId: mocks.getLocalDataOwnerId,
  clearLocalUserData: mocks.clearLocalUserData,
}));

vi.mock("@/storage/cloudSync", () => ({
  quiesceCloudSync: mocks.quiesceCloudSync,
  getCloudSyncAccountBoundaryEpoch: mocks.getCloudSyncAccountBoundaryEpoch,
  isCloudSyncSuspendedForAccountBoundary:
    mocks.isCloudSyncSuspendedForAccountBoundary,
  resumeCloudSync: mocks.resumeCloudSync,
  startAutoSync: mocks.startAutoSync,
}));

vi.mock("@/lib/offlineQueue", () => ({
  offlineQueue: {
    suspendForAccountBoundary: mocks.suspendForAccountBoundary,
    getAccountBoundaryEpoch: mocks.getAccountBoundaryEpoch,
    isSuspendedForAccountBoundary: mocks.isSuspendedForAccountBoundary,
    hasPendingActionsForOwnerReady: mocks.hasPendingActionsForOwnerReady,
    discardSuspendedActionsForAccountBoundary:
      mocks.discardSuspendedActionsForAccountBoundary,
    resumeAfterAccountBoundary: mocks.resumeAfterAccountBoundary,
  },
}));

vi.mock("@/lib/accountBoundaryState", () => ({
  suspendAccountBoundaryWriters: mocks.suspendAccountBoundaryWriters,
  resumeAccountBoundaryWriters: mocks.resumeAccountBoundaryWriters,
  getAccountBoundaryWritersEpoch: mocks.getAccountBoundaryWritersEpoch,
  areAccountBoundaryWritersSuspended: mocks.areAccountBoundaryWritersSuspended,
}));

vi.mock("@/features/journal", () => ({
  hasPendingJournalSecurityMigrationForOwner:
    mocks.hasPendingJournalSecurityMigrationForOwner,
  hasPendingJournalSecurityRemovalForOwner:
    mocks.hasPendingJournalSecurityRemovalForOwner,
  getPendingJournalSecurityMigrationRevisionForOwner:
    mocks.getPendingJournalSecurityMigrationRevisionForOwner,
}));

vi.mock("@/lib/pushNotifications", () => ({
  revokePushForAccountBoundary: mocks.removePushToken,
  revokePushForCurrentSession: mocks.revokeCurrentPush,
}));

vi.mock("@/lib/presenceService", () => ({
  leavePresenceForAccountBoundary: mocks.leavePresenceForAccountBoundary,
}));

vi.mock("@/lib/localNotifications", () => ({
  clearAccountNotificationsForBoundary:
    mocks.clearAccountNotificationsForBoundary,
  resumeAccountNotifications: mocks.resumeAccountNotifications,
}));

vi.mock("@/lib/journalBiometricCredentials", () => ({
  clearNativeJournalBiometricCredential:
    mocks.clearNativeJournalBiometricCredential,
}));

vi.mock("@/lib/accountDeviceCleanup", () => ({
  clearAccountDeviceSurfaces: mocks.clearAccountDeviceSurfaces,
}));

vi.mock("@/hooks/useIndexedDB", () => ({
  runWithDataWriteBarrier: mocks.runWithDataWriteBarrier,
  runWithSettledDataRead: mocks.runWithSettledDataRead,
  isDataWriteBarrierPostCommitError: mocks.isDataWriteBarrierPostCommitError,
}));

vi.mock("@/lib/journalContentSession", () => ({
  clearJournalContentSession: mocks.clearJournalContentSession,
}));

vi.mock("@/storage/eventSync", () => ({
  clearDeviceIdCache: mocks.clearDeviceIdCache,
}));

vi.mock("@/lib/originExclusiveLock", () => ({
  runWithOriginExclusiveLock: mocks.runWithOriginExclusiveLock,
}));

import {
  performOwnerSafeAccountDeletion,
  performOwnerSafeSignOut,
  commitPendingAccountSwitchCleanup,
  completePendingAccountSwitchCleanup,
  isPendingAccountCleanupMarker,
  preparePendingAccountSwitchCleanup,
  reconcilePendingAccountSignOutCleanup,
} from "@/lib/accountSignOutCleanup";

function pendingMarker(
  overrides: Partial<{
    intent: "sign-out" | "account-deletion";
    version: 1 | 2;
    ownerUserId: string;
    localDataOwnerUserId: string | null;
    phase:
      | "remote-deletion-requested"
      | "awaiting-local-cleanup"
      | "purging-local-data";
    operationId: string;
    recoverySecret: string;
  }> = {},
) {
  return {
    version: 1,
    ownerUserId: "account-a",
    localDataOwnerUserId: "account-a",
    phase: "awaiting-local-cleanup",
    createdAt: 1,
    ...overrides,
  };
}

describe("owner-safe sign-out cleanup", () => {
  it("accepts a canonical version-2 remote deletion marker", () => {
    expect(
      isPendingAccountCleanupMarker(
        pendingMarker({
          version: 2,
          intent: "account-deletion",
          phase: "remote-deletion-requested",
          operationId: OPERATION_ID,
          recoverySecret: RECOVERY_SECRET,
        }),
      ),
    ).toBe(true);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.getCurrentSessionUserId.mockResolvedValue("account-a");
    mocks.deleteAccount.mockResolvedValue({
      status: "deleted",
      userId: "account-a",
    });
    mocks.resumeAccountDeletion.mockResolvedValue({ status: "deleted" });
    mocks.createAccountDeletionCapability.mockReturnValue({
      operationId: OPERATION_ID,
      recoverySecret: RECOVERY_SECRET,
    });
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: "account-a" } } },
      error: null,
    });
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.signOutExpectedOwnerLocally.mockResolvedValue({ status: "signed-out" });
    mocks.getLocalDataOwnerId.mockResolvedValue("account-a");
    mocks.clearLocalUserData.mockResolvedValue(undefined);
    Object.assign(mocks.boundaryState, {
      cloudEpoch: 0,
      cloudSuspended: false,
      queueEpoch: 0,
      queueSuspended: false,
      writerEpoch: 0,
      writersSuspended: false,
    });
    mocks.suspendAccountBoundaryWriters.mockImplementation(() => {
      mocks.boundaryState.writerEpoch += 1;
      mocks.boundaryState.writersSuspended = true;
    });
    mocks.resumeAccountBoundaryWriters.mockImplementation(() => {
      mocks.boundaryState.writerEpoch += 1;
      mocks.boundaryState.writersSuspended = false;
    });
    mocks.getAccountBoundaryWritersEpoch.mockImplementation(
      () => mocks.boundaryState.writerEpoch,
    );
    mocks.areAccountBoundaryWritersSuspended.mockImplementation(
      () => mocks.boundaryState.writersSuspended,
    );
    mocks.quiesceCloudSync.mockImplementation(async () => {
      mocks.boundaryState.cloudEpoch += 1;
      mocks.boundaryState.cloudSuspended = true;
    });
    mocks.getCloudSyncAccountBoundaryEpoch.mockImplementation(
      () => mocks.boundaryState.cloudEpoch,
    );
    mocks.isCloudSyncSuspendedForAccountBoundary.mockImplementation(
      () => mocks.boundaryState.cloudSuspended,
    );
    mocks.resumeCloudSync.mockImplementation(() => {
      mocks.boundaryState.cloudEpoch += 1;
      mocks.boundaryState.cloudSuspended = false;
    });
    mocks.suspendForAccountBoundary.mockImplementation(async () => {
      mocks.boundaryState.queueEpoch += 1;
      mocks.boundaryState.queueSuspended = true;
    });
    mocks.getAccountBoundaryEpoch.mockImplementation(
      () => mocks.boundaryState.queueEpoch,
    );
    mocks.isSuspendedForAccountBoundary.mockImplementation(
      () => mocks.boundaryState.queueSuspended,
    );
    mocks.resumeAfterAccountBoundary.mockImplementation(() => {
      mocks.boundaryState.queueEpoch += 1;
      mocks.boundaryState.queueSuspended = false;
    });
    mocks.hasPendingActionsForOwnerReady.mockResolvedValue(false);
    mocks.discardSuspendedActionsForAccountBoundary.mockResolvedValue({
      status: "discarded",
    });
    mocks.hasPendingJournalSecurityMigrationForOwner.mockResolvedValue(false);
    mocks.hasPendingJournalSecurityRemovalForOwner.mockResolvedValue(false);
    mocks.getPendingJournalSecurityMigrationRevisionForOwner.mockResolvedValue(null);
    mocks.removePushToken.mockResolvedValue({
      status: "revoked",
      remote: "deleted",
      native: "unregistered",
    });
    mocks.revokeCurrentPush.mockResolvedValue({
      status: "revoked",
      remote: "not-registered",
      native: "not-applicable",
    });
    mocks.clearAccountNotificationsForBoundary.mockResolvedValue(undefined);
    mocks.clearNativeJournalBiometricCredential.mockResolvedValue("removed");
    mocks.clearAccountDeviceSurfaces.mockResolvedValue(undefined);
    mocks.runWithDataWriteBarrier.mockImplementation(async (operation) => operation());
    mocks.runWithSettledDataRead.mockImplementation(async (operation) => operation());
    mocks.runWithOriginExclusiveLock.mockImplementation(
      async (_name: string, operation: () => Promise<unknown>) => operation(),
    );
    mocks.leavePresenceForAccountBoundary.mockResolvedValue({ status: "removed" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("persists a purging marker before an account-switch destructive commit", async () => {
    await expect(preparePendingAccountSwitchCleanup("account-a")).resolves.toBe(true);

    expect(JSON.parse(localStorage.getItem(PENDING_CLEANUP_KEY) || "null")).toEqual(
      expect.objectContaining({
        version: 1,
        intent: "sign-out",
        ownerUserId: "account-a",
        localDataOwnerUserId: "account-a",
        phase: "purging-local-data",
      }),
    );
  });

  it("removes an account-switch marker only after the target owns the cleared realm", async () => {
    await expect(preparePendingAccountSwitchCleanup("account-a")).resolves.toBe(true);
    mocks.getLocalDataOwnerId.mockResolvedValueOnce(null);

    await expect(
      completePendingAccountSwitchCleanup("account-a", "account-b"),
    ).resolves.toBe(false);
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).not.toBeNull();

    mocks.getLocalDataOwnerId.mockResolvedValueOnce("account-b");
    await expect(
      completePendingAccountSwitchCleanup("account-a", "account-b"),
    ).resolves.toBe(true);
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toBeNull();
  });

  it("holds the cleanup coordinator before entering DATA for an account-switch commit", async () => {
    const lockOrder: string[] = [];
    let cleanupLockHeld = false;
    let localOwnerUserId = "account-a";
    mocks.runWithOriginExclusiveLock.mockImplementationOnce(
      async (_name: string, operation: () => Promise<unknown>) => {
        cleanupLockHeld = true;
        lockOrder.push("cleanup:acquired");
        try {
          return await operation();
        } finally {
          cleanupLockHeld = false;
          lockOrder.push("cleanup:released");
        }
      },
    );
    mocks.runWithDataWriteBarrier.mockImplementationOnce(async (operation) => {
      expect(cleanupLockHeld).toBe(true);
      lockOrder.push("data:entered");
      return operation();
    });
    mocks.getLocalDataOwnerId.mockImplementation(async () => localOwnerUserId);

    await expect(
      commitPendingAccountSwitchCleanup("account-a", "account-b", async (prepareIntent) => {
        await mocks.runWithDataWriteBarrier(async () => {
          expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toBeNull();
          expect(prepareIntent()).toBe(true);
          expect(localStorage.getItem(PENDING_CLEANUP_KEY)).not.toBeNull();
          localOwnerUserId = "account-b";
        });
      }),
    ).resolves.toBe(true);

    expect(lockOrder).toEqual([
      "cleanup:acquired",
      "data:entered",
      "cleanup:released",
    ]);
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toBeNull();
  });

  it("does not authorize a destructive switch when its final preflight fails", async () => {
    await expect(
      commitPendingAccountSwitchCleanup(
        "account-a",
        "account-b",
        async () => {
          throw new Error("final queue preflight blocked");
        },
      ),
    ).rejects.toThrow("final queue preflight blocked");

    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toBeNull();
  });

  it("does not clear the target realm again when owner binding already committed", async () => {
    await expect(preparePendingAccountSwitchCleanup("account-a")).resolves.toBe(true);
    mocks.getLocalDataOwnerId.mockResolvedValue("account-b");
    const mutation = vi.fn(async () => undefined);

    await expect(
      commitPendingAccountSwitchCleanup("account-a", "account-b", mutation),
    ).resolves.toBe(true);

    expect(mutation).not.toHaveBeenCalled();
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toBeNull();
  });

  it("persists cleanup intent before sign-out and purges only after sign-out succeeds", async () => {
    let markerAtSignOut: string | null = null;
    let markerAtPurge: string | null = null;
    mocks.signOutExpectedOwnerLocally.mockImplementationOnce(async () => {
      markerAtSignOut = localStorage.getItem(PENDING_CLEANUP_KEY);
      return { status: "signed-out" };
    });
    mocks.clearLocalUserData.mockImplementationOnce(async () => {
      markerAtPurge = localStorage.getItem(PENDING_CLEANUP_KEY);
    });

    const result = await performOwnerSafeSignOut();

    expect(mocks.leavePresenceForAccountBoundary).toHaveBeenCalledWith("account-a");
    expect(mocks.revokeCurrentPush).toHaveBeenCalledWith("account-a");
    expect(mocks.removePushToken).not.toHaveBeenCalled();
    expect(result.status).toBe("signed-out");
    expect(markerAtSignOut).toContain("account-a");
    expect(markerAtPurge).toContain('"phase":"purging-local-data"');
    expect(mocks.signOutExpectedOwnerLocally.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.clearLocalUserData.mock.invocationCallOrder[0],
    );
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toBeNull();
  });

  it("does not sign out or revoke push when Presence teardown is unconfirmed", async () => {
    mocks.leavePresenceForAccountBoundary.mockRejectedValueOnce(
      new Error("Presence teardown was not acknowledged"),
    );

    const result = await performOwnerSafeSignOut();

    expect(result).toEqual({ status: "cleanup-failed", sessionEnded: false });
    expect(mocks.revokeCurrentPush).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.resumeCloudSync).toHaveBeenCalledTimes(1);
    expect(mocks.resumeAfterAccountBoundary).toHaveBeenCalledTimes(1);
  });

  it("does not let a stale cleanup resume a replacement account-boundary suspension", async () => {
    let sessionReadCount = 0;
    mocks.getSession.mockImplementation(async () => {
      sessionReadCount += 1;
      if (sessionReadCount === 2) {
        // A later lifecycle of the same account ID starts its own boundary
        // while the original cleanup is verifying the failed Presence step.
        mocks.boundaryState.writerEpoch += 1;
        mocks.boundaryState.writersSuspended = true;
        mocks.boundaryState.cloudEpoch += 1;
        mocks.boundaryState.cloudSuspended = true;
        mocks.boundaryState.queueEpoch += 1;
        mocks.boundaryState.queueSuspended = true;
      }
      return {
        data: { session: { user: { id: "account-a" } } },
        error: null,
      };
    });
    mocks.leavePresenceForAccountBoundary.mockRejectedValueOnce(
      new Error("Presence teardown was not acknowledged"),
    );

    const result = await performOwnerSafeSignOut();

    expect(result).toEqual({ status: "cleanup-failed", sessionEnded: false });
    expect(mocks.resumeCloudSync).not.toHaveBeenCalled();
    expect(mocks.resumeAfterAccountBoundary).not.toHaveBeenCalled();
    expect(mocks.resumeAccountBoundaryWriters).not.toHaveBeenCalled();
    expect(mocks.startAutoSync).not.toHaveBeenCalled();
    expect(mocks.boundaryState).toMatchObject({
      cloudSuspended: true,
      queueSuspended: true,
      writersSuspended: true,
    });
  });

  it("persists account-deletion intent before the remote request and purges only after confirmation", async () => {
    let markerAtRemoteDeletion: string | null = null;
    mocks.deleteAccount.mockImplementationOnce(async (_ownerUserId, capability) => {
      markerAtRemoteDeletion = localStorage.getItem(PENDING_CLEANUP_KEY);
      expect(capability).toEqual({
        operationId: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        ),
        recoverySecret: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      });
      return { status: "deleted", userId: "account-a" };
    });

    const result = await performOwnerSafeAccountDeletion("account-a");

    expect(mocks.leavePresenceForAccountBoundary).toHaveBeenCalledWith("account-a");
    expect(mocks.removePushToken).toHaveBeenCalledWith("account-a");
    expect(mocks.leavePresenceForAccountBoundary.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.removePushToken.mock.invocationCallOrder[0],
    );
    expect(mocks.leavePresenceForAccountBoundary.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteAccount.mock.invocationCallOrder[0],
    );
    expect(result).toEqual({
      status: "deleted",
      remoteDeletion: "confirmed",
    });
    expect(markerAtRemoteDeletion).toContain('"intent":"account-deletion"');
    expect(markerAtRemoteDeletion).toContain(
      '"phase":"remote-deletion-requested"',
    );
    expect(markerAtRemoteDeletion).toContain('"version":2');
    expect(markerAtRemoteDeletion).toContain(`"operationId":"${OPERATION_ID}"`);
    expect(markerAtRemoteDeletion).toContain(
      `"recoverySecret":"${RECOVERY_SECRET}"`,
    );
    expect(mocks.deleteAccount.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.signOutExpectedOwnerLocally.mock.invocationCallOrder[0],
    );
    expect(mocks.signOutExpectedOwnerLocally.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.clearLocalUserData.mock.invocationCallOrder[0],
    );
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toBeNull();
  });

  it("does not request remote deletion when Presence teardown is unconfirmed", async () => {
    mocks.leavePresenceForAccountBoundary.mockRejectedValueOnce(
      new Error("Presence teardown was not acknowledged"),
    );

    const result = await performOwnerSafeAccountDeletion("account-a");

    expect(result).toEqual({
      status: "delete-failed",
      remoteDeletion: "not-confirmed",
    });
    expect(mocks.removePushToken).not.toHaveBeenCalled();
    expect(mocks.deleteAccount).not.toHaveBeenCalled();
    expect(mocks.resumeCloudSync).toHaveBeenCalledTimes(1);
    expect(mocks.resumeAfterAccountBoundary).toHaveBeenCalledTimes(1);
  });

  it("keeps writers blocked and the durable marker when the remote outcome is ambiguous", async () => {
    mocks.deleteAccount.mockResolvedValueOnce({
      status: "not-deleted",
      code: "invoke-failed",
    });

    const result = await performOwnerSafeAccountDeletion("account-a");

    expect(result).toEqual({
      status: "cleanup-failed",
      remoteDeletion: "unknown",
    });
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toContain(
      '"phase":"remote-deletion-requested"',
    );
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
    expect(mocks.resumeCloudSync).not.toHaveBeenCalled();
    expect(mocks.resumeAfterAccountBoundary).not.toHaveBeenCalled();
  });

  it("does not reinterpret a pending remote deletion as completed sign-out when the local session is absent", async () => {
    localStorage.setItem(
      PENDING_CLEANUP_KEY,
      JSON.stringify(
        pendingMarker({
          intent: "account-deletion",
          phase: "remote-deletion-requested",
        }),
      ),
    );
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });

    const result = await performOwnerSafeSignOut();

    expect(result).toEqual({ status: "cleanup-failed", sessionEnded: true });
    expect(mocks.deleteAccount).not.toHaveBeenCalled();
    expect(mocks.resumeAccountDeletion).not.toHaveBeenCalled();
    expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
    expect(mocks.discardSuspendedActionsForAccountBoundary).not.toHaveBeenCalled();
    expect(mocks.resumeCloudSync).not.toHaveBeenCalled();
    expect(mocks.resumeAfterAccountBoundary).not.toHaveBeenCalled();
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toContain(
      '"phase":"remote-deletion-requested"',
    );
  });

  it("recovers a lost success by capability after the deleted session disappears", async () => {
    localStorage.setItem(
      PENDING_CLEANUP_KEY,
      JSON.stringify(
        pendingMarker({
          version: 2,
          intent: "account-deletion",
          phase: "remote-deletion-requested",
          operationId: OPERATION_ID,
          recoverySecret: RECOVERY_SECRET,
        }),
      ),
    );
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mocks.getLocalDataOwnerId.mockResolvedValue("account-a");

    const result = await reconcilePendingAccountSignOutCleanup(null);

    expect(result.status).toBe("completed");
    expect(mocks.deleteAccount).not.toHaveBeenCalled();
    expect(mocks.resumeAccountDeletion).toHaveBeenCalledWith({
      operationId: OPERATION_ID,
      recoverySecret: RECOVERY_SECRET,
    });
    expect(mocks.clearLocalUserData).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toBeNull();
  });

  it("recovers by capability when a deleted account still has a stale cached session", async () => {
    localStorage.setItem(
      PENDING_CLEANUP_KEY,
      JSON.stringify(
        pendingMarker({
          version: 2,
          intent: "account-deletion",
          phase: "remote-deletion-requested",
          operationId: OPERATION_ID,
          recoverySecret: RECOVERY_SECRET,
        }),
      ),
    );
    mocks.deleteAccount.mockResolvedValueOnce({
      status: "not-deleted",
      code: "invoke-failed",
    });
    mocks.resumeAccountDeletion.mockResolvedValueOnce({ status: "deleted" });

    const result = await reconcilePendingAccountSignOutCleanup("account-a");

    expect(result.status).toBe("completed");
    expect(mocks.deleteAccount).toHaveBeenCalledWith("account-a", {
      operationId: OPERATION_ID,
      recoverySecret: RECOVERY_SECRET,
    });
    expect(mocks.resumeAccountDeletion).toHaveBeenCalledWith({
      operationId: OPERATION_ID,
      recoverySecret: RECOVERY_SECRET,
    });
    expect(mocks.clearLocalUserData).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toBeNull();
  });

  it("does not sign out a different account that appears while remote deletion completes", async () => {
    const accountASession = {
      data: { session: { user: { id: "account-a" } } },
      error: null,
    };
    const accountBSession = {
      data: { session: { user: { id: "account-b" } } },
      error: null,
    };
    mocks.getSession
      .mockResolvedValueOnce(accountASession)
      .mockResolvedValueOnce(accountASession)
      .mockResolvedValueOnce(accountASession)
      .mockResolvedValue(accountBSession);

    const result = await performOwnerSafeAccountDeletion("account-a");

    expect(result).toEqual({ status: "deleted", remoteDeletion: "confirmed" });
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.clearLocalUserData).toHaveBeenCalledTimes(1);
  });

  it("atomically preserves a different account that wins the local-session lock", async () => {
    localStorage.setItem(
      PENDING_CLEANUP_KEY,
      JSON.stringify(
        pendingMarker({
          version: 2,
          intent: "account-deletion",
          phase: "awaiting-local-cleanup",
          operationId: OPERATION_ID,
        }),
      ),
    );
    mocks.signOutExpectedOwnerLocally.mockResolvedValueOnce({
      status: "owner-changed",
      userId: "account-b",
    });

    const result = await reconcilePendingAccountSignOutCleanup("account-a");

    expect(result.status).toBe("completed");
    expect(mocks.signOutExpectedOwnerLocally).toHaveBeenCalledWith("account-a");
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.clearLocalUserData).toHaveBeenCalledTimes(1);
  });

  it("stops before any side effect when secure capability generation is unavailable", async () => {
    mocks.createAccountDeletionCapability.mockImplementationOnce(() => {
      throw new Error("Secure account deletion recovery is unavailable");
    });

    const result = await performOwnerSafeAccountDeletion("account-a");

    expect(result).toEqual({
      status: "delete-failed",
      remoteDeletion: "not-confirmed",
    });
    expect(mocks.quiesceCloudSync).not.toHaveBeenCalled();
    expect(mocks.revokeCurrentPush).not.toHaveBeenCalled();
    expect(mocks.deleteAccount).not.toHaveBeenCalled();
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toBeNull();
  });

  it("reports remote deletion as confirmed when an ambiguous retry succeeds but local cleanup remains blocked", async () => {
    mocks.deleteAccount
      .mockResolvedValueOnce({
        status: "not-deleted",
        code: "invoke-failed",
      })
      .mockResolvedValueOnce({ status: "deleted", userId: "account-a" });

    const first = await performOwnerSafeAccountDeletion("account-a");
    expect(first).toEqual({
      status: "cleanup-failed",
      remoteDeletion: "unknown",
    });

    mocks.signOutExpectedOwnerLocally.mockRejectedValueOnce(
      new Error("auth storage unavailable"),
    );
    const retry = await performOwnerSafeAccountDeletion("account-a");

    expect(retry).toEqual({
      status: "cleanup-failed",
      remoteDeletion: "confirmed",
    });
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toContain(
      '"phase":"awaiting-local-cleanup"',
    );
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toContain(
      `"operationId":"${OPERATION_ID}"`,
    );
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).not.toContain(
      "recoverySecret",
    );
    expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
  });

  it("retries confirmed account deletion cleanup after local sign-out initially fails", async () => {
    mocks.signOutExpectedOwnerLocally.mockRejectedValueOnce(
      new Error("auth storage unavailable"),
    );

    const first = await performOwnerSafeAccountDeletion("account-a");

    expect(first).toEqual({
      status: "cleanup-failed",
      remoteDeletion: "confirmed",
    });
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toContain(
      '"phase":"awaiting-local-cleanup"',
    );
    expect(mocks.clearLocalUserData).not.toHaveBeenCalled();

    const retry = await reconcilePendingAccountSignOutCleanup("account-a");

    expect(retry.status).toBe("completed");
    expect(mocks.signOutExpectedOwnerLocally).toHaveBeenCalledTimes(2);
    expect(mocks.clearLocalUserData).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toBeNull();
  });

  it("keeps a completed purge visible and retryable when marker removal fails", async () => {
    const originalRemoveItem = Storage.prototype.removeItem;
    let failMarkerRemoval = true;
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (
      this: Storage,
      key: string,
    ) {
      if (key === PENDING_CLEANUP_KEY && failMarkerRemoval) {
        throw new Error("marker removal unavailable");
      }
      return originalRemoveItem.call(this, key);
    });

    const first = await performOwnerSafeSignOut();

    expect(first.status).toBe("cleanup-failed");
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toContain(
      '"phase":"purging-local-data"',
    );

    failMarkerRemoval = false;
    mocks.getCurrentSessionUserId.mockResolvedValue(null);
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mocks.getLocalDataOwnerId.mockResolvedValue(null);

    const retry = await reconcilePendingAccountSignOutCleanup(null);

    expect(retry.status).toBe("completed");
    expect(mocks.clearLocalUserData).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toBeNull();
  });

  it("never purges local data when owner-qualified sign-out fails", async () => {
    const restorePushRegistration = vi.fn(() => Promise.resolve());
    mocks.signOutExpectedOwnerLocally.mockRejectedValueOnce(
      new Error("sign-out failed"),
    );

    const result = await performOwnerSafeSignOut({ restorePushRegistration });

    expect(result.status).toBe("sign-out-failed");
    expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
    expect(mocks.discardSuspendedActionsForAccountBoundary).toHaveBeenCalledOnce();
    expect(mocks.discardSuspendedActionsForAccountBoundary).toHaveBeenCalledWith({
      onlyIfEmpty: true,
    });
    expect(restorePushRegistration).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toContain("account-a");
  });

  it("keeps the marker and local data when owner-qualified sign-out throws but the session remains", async () => {
    const restorePushRegistration = vi.fn(() => Promise.resolve());
    mocks.signOutExpectedOwnerLocally.mockRejectedValueOnce(
      new Error("auth storage interrupted"),
    );

    const result = await performOwnerSafeSignOut({ restorePushRegistration });

    expect(result.status).toBe("sign-out-failed");
    expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
    expect(restorePushRegistration).toHaveBeenCalledTimes(1);
    expect(mocks.resumeCloudSync).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toContain("account-a");
  });

  it("fails closed before sign-out when the durable cleanup marker cannot be written", async () => {
    const restorePushRegistration = vi.fn(() => Promise.resolve());
    vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new Error("marker storage unavailable");
    });

    const result = await performOwnerSafeSignOut({ restorePushRegistration });

    expect(result.status).toBe("cleanup-failed");
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
    expect(restorePushRegistration).toHaveBeenCalledTimes(1);
    expect(mocks.resumeCloudSync).toHaveBeenCalledTimes(1);
    expect(mocks.resumeAfterAccountBoundary).toHaveBeenCalledTimes(1);
  });

  it("never treats a session read error as proof that sign-out completed", async () => {
    mocks.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: { message: "session storage unavailable" },
    });

    const result = await performOwnerSafeSignOut();

    expect(result.status).toBe("cleanup-failed");
    expect(mocks.revokeCurrentPush).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
  });

  it("bounds an unavailable session-owner read before any destructive side effect", async () => {
    vi.useFakeTimers();
    try {
      mocks.getSession.mockReturnValue(new Promise(() => undefined));
      const resultPromise = performOwnerSafeSignOut();
      let settled = false;
      void resultPromise.then(() => {
        settled = true;
      });

      await vi.advanceTimersByTimeAsync(30_000);
      await Promise.resolve();

      expect(settled).toBe(true);
      await expect(resultPromise).resolves.toEqual({
        status: "cleanup-failed",
        sessionEnded: false,
      });
      expect(mocks.revokeCurrentPush).not.toHaveBeenCalled();
      expect(mocks.signOutExpectedOwnerLocally).not.toHaveBeenCalled();
      expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries a failed post-sign-out purge with no session and clears the marker", async () => {
    mocks.clearLocalUserData.mockRejectedValueOnce(new Error("purge failed"));

    const first = await performOwnerSafeSignOut();
    expect(first.status).toBe("cleanup-failed");
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toContain("account-a");

    mocks.getCurrentSessionUserId.mockResolvedValue(null);
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    const retry = await performOwnerSafeSignOut();

    expect(retry.status).toBe("signed-out");
    expect(mocks.signOutExpectedOwnerLocally).toHaveBeenCalledTimes(1);
    expect(mocks.clearLocalUserData).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toBeNull();
  });

  it("preserves exact journal-discard consent across a failed post-sign-out purge retry", async () => {
    mocks.getPendingJournalSecurityMigrationRevisionForOwner.mockResolvedValue(
      "journal-revision-r1"
    );
    mocks.clearLocalUserData.mockRejectedValueOnce(new Error("native cleanup failed"));

    const first = await performOwnerSafeSignOut({ discardPendingChanges: true });
    expect(first).toEqual({ status: "cleanup-failed", sessionEnded: true });
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toContain("journal-revision-r1");

    mocks.getCurrentSessionUserId.mockResolvedValue(null);
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    const retry = await performOwnerSafeSignOut();

    expect(retry).toEqual({ status: "signed-out" });
    expect(mocks.clearLocalUserData).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toBeNull();
  });

  it("does not extend persisted journal-discard consent to a newer revision", async () => {
    mocks.getPendingJournalSecurityMigrationRevisionForOwner.mockResolvedValue(
      "journal-revision-r1"
    );
    mocks.clearLocalUserData.mockRejectedValueOnce(new Error("native cleanup failed"));

    const first = await performOwnerSafeSignOut({ discardPendingChanges: true });
    expect(first).toEqual({ status: "cleanup-failed", sessionEnded: true });

    mocks.getPendingJournalSecurityMigrationRevisionForOwner.mockResolvedValue(
      "journal-revision-r2"
    );
    mocks.getCurrentSessionUserId.mockResolvedValue(null);
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    const retry = await performOwnerSafeSignOut();

    expect(retry).toEqual({ status: "cleanup-failed", sessionEnded: true });
    expect(mocks.clearLocalUserData).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toContain("journal-revision-r1");
  });

  it("completes owner-matched cleanup on a cold start with no session", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    localStorage.setItem(PENDING_CLEANUP_KEY, JSON.stringify(pendingMarker()));

    const result = await reconcilePendingAccountSignOutCleanup(null);

    expect(result.status).toBe("completed");
    expect(mocks.clearLocalUserData).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toBeNull();
  });

  it("resumes local-only reminders only after durable cleanup completion is verified", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    localStorage.setItem(PENDING_CLEANUP_KEY, JSON.stringify(pendingMarker()));
    let markerWhenNotificationsResume: string | null | undefined;
    mocks.resumeAccountNotifications.mockImplementationOnce(() => {
      markerWhenNotificationsResume = localStorage.getItem(PENDING_CLEANUP_KEY);
    });

    const result = await reconcilePendingAccountSignOutCleanup(null);

    expect(result.status).toBe("completed");
    expect(mocks.resumeAccountNotifications).toHaveBeenCalledTimes(1);
    expect(markerWhenNotificationsResume).toBeNull();
  });

  it("cancels stale cleanup when the same account has signed in again", async () => {
    localStorage.setItem(PENDING_CLEANUP_KEY, JSON.stringify(pendingMarker()));

    const result = await reconcilePendingAccountSignOutCleanup("account-a");

    expect(result.status).toBe("cancelled");
    expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toBeNull();
  });

  it("finishes confirmed account-deletion cleanup instead of cancelling it for the cached session", async () => {
    localStorage.setItem(
      PENDING_CLEANUP_KEY,
      JSON.stringify(
        pendingMarker({
          intent: "account-deletion",
          phase: "awaiting-local-cleanup",
        }),
      ),
    );

    const result = await reconcilePendingAccountSignOutCleanup("account-a");

    expect(result.status).toBe("completed");
    expect(mocks.signOutExpectedOwnerLocally).toHaveBeenCalledWith("account-a");
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.clearLocalUserData).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toBeNull();
  });

  it("keeps same-account relogin blocked when stale-marker removal cannot be verified", async () => {
    localStorage.setItem(PENDING_CLEANUP_KEY, JSON.stringify(pendingMarker()));
    const originalRemoveItem = Storage.prototype.removeItem;
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (
      this: Storage,
      key: string,
    ) {
      if (key === PENDING_CLEANUP_KEY) {
        throw new Error("marker removal unavailable");
      }
      return originalRemoveItem.call(this, key);
    });

    const result = await reconcilePendingAccountSignOutCleanup("account-a");

    expect(result.status).toBe("blocked");
    expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
    expect(mocks.resumeCloudSync).not.toHaveBeenCalled();
    expect(mocks.resumeAfterAccountBoundary).not.toHaveBeenCalled();
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toContain("account-a");
  });

  it("fails closed on a corrupt durable marker instead of guessing an owner", async () => {
    localStorage.setItem(PENDING_CLEANUP_KEY, "{not-valid-json");

    const result = await reconcilePendingAccountSignOutCleanup("account-a");

    expect(result.status).toBe("blocked");
    expect(mocks.quiesceCloudSync).toHaveBeenCalledTimes(1);
    expect(mocks.suspendForAccountBoundary).toHaveBeenCalledTimes(1);
    expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
    expect(mocks.resumeCloudSync).not.toHaveBeenCalled();
    expect(mocks.resumeAccountNotifications).not.toHaveBeenCalled();
  });

  it("rejects a forged purging phase that was never authorized by an owned realm", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    localStorage.setItem(
      PENDING_CLEANUP_KEY,
      JSON.stringify(
        pendingMarker({
          localDataOwnerUserId: null,
          phase: "purging-local-data",
        }),
      ),
    );

    const result = await reconcilePendingAccountSignOutCleanup(null);

    expect(result.status).toBe("blocked");
    expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
  });

  it("cleans account A before a different account can use account A's local realm", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: "account-b" } } },
      error: null,
    });
    localStorage.setItem(PENDING_CLEANUP_KEY, JSON.stringify(pendingMarker()));

    const result = await reconcilePendingAccountSignOutCleanup("account-b");

    expect(result.status).toBe("completed");
    expect(mocks.clearLocalUserData).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toBeNull();
  });

  it("never lets account A's stale marker erase a realm already owned by account B", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: "account-b" } } },
      error: null,
    });
    mocks.getLocalDataOwnerId.mockResolvedValue("account-b");
    localStorage.setItem(PENDING_CLEANUP_KEY, JSON.stringify(pendingMarker()));

    const result = await reconcilePendingAccountSignOutCleanup("account-b");

    expect(result.status).toBe("cancelled");
    expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
    expect(mocks.clearNativeJournalBiometricCredential).not.toHaveBeenCalled();
    expect(mocks.clearAccountDeviceSurfaces).not.toHaveBeenCalled();
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toBeNull();
  });

  it("revalidates the local owner under DATA before a pending purge advances the boundary", async () => {
    localStorage.setItem(PENDING_CLEANUP_KEY, JSON.stringify(pendingMarker()));
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mocks.getLocalDataOwnerId
      .mockResolvedValueOnce("account-a")
      .mockResolvedValue("account-b");
    let barrierOptions:
      | {
          deferredWrites?: string;
          expectedAccountBoundaryGeneration?: string;
          beforeAccountBoundaryAdvance?: () => void | Promise<void>;
        }
      | undefined;
    mocks.runWithDataWriteBarrier.mockImplementationOnce(
      async (operation, options) => {
        barrierOptions = options;
        await options?.beforeAccountBoundaryAdvance?.();
        return operation();
      },
    );

    const result = await reconcilePendingAccountSignOutCleanup(null);

    expect(barrierOptions?.deferredWrites).toBe("discard");
    expect(barrierOptions?.expectedAccountBoundaryGeneration).toEqual(
      expect.any(String),
    );
    expect(barrierOptions?.beforeAccountBoundaryAdvance).toBeTypeOf("function");
    expect(result.status).toBe("blocked");
    expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toContain("account-a");
  });

  it("preserves unauthenticated owner-null local-first data", async () => {
    mocks.getLocalDataOwnerId.mockResolvedValue(null);

    const result = await performOwnerSafeSignOut();

    expect(result.status).toBe("signed-out");
    expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
    expect(mocks.discardSuspendedActionsForAccountBoundary).toHaveBeenCalledOnce();
    expect(mocks.discardSuspendedActionsForAccountBoundary).toHaveBeenCalledWith({
      onlyIfEmpty: true,
    });
    expect(mocks.clearNativeJournalBiometricCredential).not.toHaveBeenCalled();
    expect(mocks.clearAccountDeviceSurfaces).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toBeNull();
  });

  it("keeps cleanup blocked when an owner-A marker loses its owner row before purge starts", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mocks.getLocalDataOwnerId.mockResolvedValue(null);
    localStorage.setItem(
      PENDING_CLEANUP_KEY,
      JSON.stringify(pendingMarker({
        localDataOwnerUserId: "account-a",
        phase: "awaiting-local-cleanup",
      })),
    );

    const result = await reconcilePendingAccountSignOutCleanup(null);

    expect(result).toEqual({ status: "blocked" });
    expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
    expect(mocks.clearNativeJournalBiometricCredential).not.toHaveBeenCalled();
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toContain("account-a");
  });

  it("never signs out a different account that becomes active during preparation", async () => {
    mocks.getSession
      .mockResolvedValueOnce({
        data: { session: { user: { id: "account-a" } } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { session: { user: { id: "account-b" } } },
        error: null,
      });

    const result = await performOwnerSafeSignOut();

    expect(result.status).toBe("session-changed");
    expect(mocks.revokeCurrentPush).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.clearLocalUserData).toHaveBeenCalledTimes(1);
  });

  it("rejects an owner-A retry before touching a replacement owner-B realm", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: "account-b" } } },
      error: null,
    });
    mocks.getLocalDataOwnerId.mockResolvedValue("account-b");
    mocks.hasPendingActionsForOwnerReady.mockResolvedValue(true);

    const result = await performOwnerSafeSignOut({
      expectedOwnerUserId: "account-a",
      discardPendingChanges: true,
    });

    expect(result).toEqual({ status: "session-changed" });
    expect(mocks.quiesceCloudSync).not.toHaveBeenCalled();
    expect(mocks.suspendForAccountBoundary).not.toHaveBeenCalled();
    expect(mocks.discardSuspendedActionsForAccountBoundary).not.toHaveBeenCalled();
    expect(mocks.revokeCurrentPush).not.toHaveBeenCalled();
    expect(mocks.signOutExpectedOwnerLocally).not.toHaveBeenCalled();
    expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
  });

  it("preserves a replacement account that wins during final queue verification", async () => {
    mocks.signOutExpectedOwnerLocally.mockResolvedValueOnce({
      status: "owner-changed",
      userId: "account-b",
    });

    const result = await performOwnerSafeSignOut();

    expect(result).toEqual({ status: "session-changed" });
    expect(mocks.discardSuspendedActionsForAccountBoundary).toHaveBeenCalledWith({
      onlyIfEmpty: true,
    });
    expect(mocks.signOutExpectedOwnerLocally).toHaveBeenCalledWith("account-a");
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.clearLocalUserData).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toBeNull();
  });

  it("resumes an already-started local purge even when the owner row was cleared", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mocks.getLocalDataOwnerId.mockResolvedValue(null);
    localStorage.setItem(
      PENDING_CLEANUP_KEY,
      JSON.stringify(pendingMarker({ phase: "purging-local-data" })),
    );

    const result = await reconcilePendingAccountSignOutCleanup(null);

    expect(result.status).toBe("completed");
    expect(mocks.clearLocalUserData).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toBeNull();
  });

  it("blocks sign-out while owner-bound writes remain durable", async () => {
    mocks.hasPendingActionsForOwnerReady.mockResolvedValue(true);

    const result = await performOwnerSafeSignOut();

    expect(result.status).toBe("pending-changes");
    expect(mocks.revokeCurrentPush).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toBeNull();
    expect(mocks.resumeCloudSync).toHaveBeenCalledTimes(1);
    expect(mocks.resumeAfterAccountBoundary).toHaveBeenCalledTimes(1);
  });

  it("blocks sign-out when a removal intent remains even with an empty queue", async () => {
    mocks.hasPendingJournalSecurityRemovalForOwner.mockResolvedValue(true);

    const result = await performOwnerSafeSignOut();

    expect(result).toEqual({ status: "pending-changes" });
    expect(mocks.hasPendingActionsForOwnerReady).toHaveBeenCalledWith("account-a");
    expect(mocks.hasPendingJournalSecurityRemovalForOwner).toHaveBeenCalledWith(
      "account-a"
    );
    expect(mocks.signOutExpectedOwnerLocally).not.toHaveBeenCalled();
    expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
  });

  it("never treats generic discard consent as authority to purge a removal intent", async () => {
    mocks.hasPendingJournalSecurityRemovalForOwner.mockResolvedValue(true);

    const result = await performOwnerSafeSignOut({ discardPendingChanges: true });

    expect(result).toEqual({ status: "pending-changes" });
    expect(mocks.signOutExpectedOwnerLocally).not.toHaveBeenCalled();
    expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toBeNull();
  });

  it("blocks sign-out when another tab enqueues after the initial pending check", async () => {
    const trace: string[] = [];
    const restorePushRegistration = vi.fn(() => Promise.resolve());
    mocks.hasPendingActionsForOwnerReady.mockImplementationOnce(async () => {
      trace.push("preflight:queue-empty");
      return false;
    });
    mocks.revokeCurrentPush.mockImplementationOnce(async () => {
      trace.push("cross-tab:enqueue-account-a");
      return {
        status: "revoked",
        remote: "deleted",
        native: "unregistered",
      };
    });
    mocks.discardSuspendedActionsForAccountBoundary.mockImplementation(
      async (options?: { onlyIfEmpty?: boolean }) => {
        trace.push(`queue-final:${options?.onlyIfEmpty === true ? "preserve" : "discard"}`);
        return trace.includes("cross-tab:enqueue-account-a")
          ? {
              status: "blocked" as const,
              pendingOwnerUserIds: ["account-a"],
            }
          : { status: "discarded" as const };
      },
    );

    const result = await performOwnerSafeSignOut({ restorePushRegistration });

    expect(result).toEqual({ status: "pending-changes" });
    expect(trace).toContain("cross-tab:enqueue-account-a");
    expect(trace).toContain("queue-final:preserve");
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
    expect(restorePushRegistration).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toBeNull();
  });

  it("does not extend explicit discard consent to a newer journal migration", async () => {
    const trace: string[] = [];
    const restorePushRegistration = vi.fn(() => Promise.resolve());
    mocks.getPendingJournalSecurityMigrationRevisionForOwner
      .mockImplementationOnce(async () => {
        trace.push("preflight:journal-revision-old");
        return "journal-revision-old";
      })
      .mockImplementation(async () => {
        trace.push("final:journal-revision-new");
        return "journal-revision-new";
      });
    mocks.revokeCurrentPush.mockImplementationOnce(async () => {
      trace.push("cross-tab:new-journal-migration");
      return {
        status: "revoked",
        remote: "deleted",
        native: "unregistered",
      };
    });

    const result = await performOwnerSafeSignOut({
      discardPendingChanges: true,
      restorePushRegistration,
    });

    expect(result).toEqual({ status: "pending-changes" });
    expect(trace).toEqual([
      "preflight:journal-revision-old",
      "cross-tab:new-journal-migration",
      "final:journal-revision-new",
    ]);
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
    expect(restorePushRegistration).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toBeNull();
  });
});
