import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PENDING_CLEANUP_KEY = "zenflow_pending_account_sign_out_cleanup";

const mocks = vi.hoisted(() => ({
  getCurrentSessionUserId: vi.fn<() => Promise<string | null>>(),
  getSession: vi.fn(),
  signOut: vi.fn(),
  getLocalDataOwnerId: vi.fn<() => Promise<string | null>>(),
  clearLocalUserData: vi.fn(),
  quiesceCloudSync: vi.fn(),
  resumeCloudSync: vi.fn(),
  startAutoSync: vi.fn(),
  suspendForAccountBoundary: vi.fn(),
  hasPendingActionsForOwnerReady: vi.fn(),
  discardSuspendedActionsForAccountBoundary: vi.fn(),
  resumeAfterAccountBoundary: vi.fn(),
  hasPendingJournalSecurityMigrationForOwner: vi.fn(),
  removePushToken: vi.fn(),
  clearAccountNotificationsForBoundary: vi.fn(),
  clearNativeJournalBiometricCredential: vi.fn(),
  clearAccountDeviceSurfaces: vi.fn(),
  runWithDataWriteBarrier: vi.fn(),
  clearJournalContentSession: vi.fn(),
  clearDeviceIdCache: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { auth: { getSession: mocks.getSession, signOut: mocks.signOut } },
  getCurrentSessionUserId: mocks.getCurrentSessionUserId,
}));

vi.mock("@/storage/db", () => ({
  getLocalDataOwnerId: mocks.getLocalDataOwnerId,
  clearLocalUserData: mocks.clearLocalUserData,
}));

vi.mock("@/storage/cloudSync", () => ({
  quiesceCloudSync: mocks.quiesceCloudSync,
  resumeCloudSync: mocks.resumeCloudSync,
  startAutoSync: mocks.startAutoSync,
}));

vi.mock("@/lib/offlineQueue", () => ({
  offlineQueue: {
    suspendForAccountBoundary: mocks.suspendForAccountBoundary,
    hasPendingActionsForOwnerReady: mocks.hasPendingActionsForOwnerReady,
    discardSuspendedActionsForAccountBoundary:
      mocks.discardSuspendedActionsForAccountBoundary,
    resumeAfterAccountBoundary: mocks.resumeAfterAccountBoundary,
  },
}));

vi.mock("@/features/journal", () => ({
  hasPendingJournalSecurityMigrationForOwner:
    mocks.hasPendingJournalSecurityMigrationForOwner,
}));

vi.mock("@/lib/pushNotifications", () => ({
  removePushToken: mocks.removePushToken,
}));

vi.mock("@/lib/localNotifications", () => ({
  clearAccountNotificationsForBoundary:
    mocks.clearAccountNotificationsForBoundary,
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
}));

vi.mock("@/lib/journalContentSession", () => ({
  clearJournalContentSession: mocks.clearJournalContentSession,
}));

vi.mock("@/storage/eventSync", () => ({
  clearDeviceIdCache: mocks.clearDeviceIdCache,
}));

vi.mock("@/lib/originExclusiveLock", () => ({
  runWithOriginExclusiveLock: async <T>(_name: string, operation: () => Promise<T>) =>
    operation(),
}));

import {
  performOwnerSafeSignOut,
  reconcilePendingAccountSignOutCleanup,
} from "@/lib/accountSignOutCleanup";

function pendingMarker(
  overrides: Partial<{
    ownerUserId: string;
    localDataOwnerUserId: string | null;
    phase: "awaiting-local-cleanup" | "purging-local-data";
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
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.getCurrentSessionUserId.mockResolvedValue("account-a");
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: "account-a" } } },
      error: null,
    });
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.getLocalDataOwnerId.mockResolvedValue("account-a");
    mocks.clearLocalUserData.mockResolvedValue(undefined);
    mocks.quiesceCloudSync.mockResolvedValue(undefined);
    mocks.suspendForAccountBoundary.mockResolvedValue(undefined);
    mocks.hasPendingActionsForOwnerReady.mockResolvedValue(false);
    mocks.discardSuspendedActionsForAccountBoundary.mockResolvedValue(undefined);
    mocks.hasPendingJournalSecurityMigrationForOwner.mockResolvedValue(false);
    mocks.removePushToken.mockResolvedValue({
      status: "revoked",
      remote: "deleted",
      native: "unregistered",
    });
    mocks.clearAccountNotificationsForBoundary.mockResolvedValue(undefined);
    mocks.clearNativeJournalBiometricCredential.mockResolvedValue("removed");
    mocks.clearAccountDeviceSurfaces.mockResolvedValue(undefined);
    mocks.runWithDataWriteBarrier.mockImplementation(async (operation) => operation());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("persists cleanup intent before sign-out and purges only after sign-out succeeds", async () => {
    let markerAtSignOut: string | null = null;
    let markerAtPurge: string | null = null;
    mocks.signOut.mockImplementationOnce(async () => {
      markerAtSignOut = localStorage.getItem(PENDING_CLEANUP_KEY);
      return { error: null };
    });
    mocks.clearLocalUserData.mockImplementationOnce(async () => {
      markerAtPurge = localStorage.getItem(PENDING_CLEANUP_KEY);
    });

    const result = await performOwnerSafeSignOut();

    expect(result.status).toBe("signed-out");
    expect(markerAtSignOut).toContain("account-a");
    expect(markerAtPurge).toContain('"phase":"purging-local-data"');
    expect(mocks.signOut.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.clearLocalUserData.mock.invocationCallOrder[0],
    );
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

  it("never purges local data when Supabase sign-out fails", async () => {
    const restorePushRegistration = vi.fn(() => Promise.resolve());
    mocks.signOut.mockResolvedValueOnce({ error: { message: "sign-out failed" } });

    const result = await performOwnerSafeSignOut({ restorePushRegistration });

    expect(result.status).toBe("sign-out-failed");
    expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
    expect(mocks.discardSuspendedActionsForAccountBoundary).not.toHaveBeenCalled();
    expect(restorePushRegistration).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toContain("account-a");
  });

  it("keeps the marker and local data when Supabase sign-out throws but the session remains", async () => {
    const restorePushRegistration = vi.fn(() => Promise.resolve());
    mocks.signOut.mockRejectedValueOnce(new Error("auth storage interrupted"));

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
    expect(mocks.removePushToken).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
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
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.clearLocalUserData).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toBeNull();
  });

  it("completes owner-matched cleanup on a cold start with no session", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    localStorage.setItem(PENDING_CLEANUP_KEY, JSON.stringify(pendingMarker()));

    const result = await reconcilePendingAccountSignOutCleanup(null);

    expect(result.status).toBe("completed");
    expect(mocks.clearLocalUserData).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toBeNull();
  });

  it("cancels stale cleanup when the same account has signed in again", async () => {
    localStorage.setItem(PENDING_CLEANUP_KEY, JSON.stringify(pendingMarker()));

    const result = await reconcilePendingAccountSignOutCleanup("account-a");

    expect(result.status).toBe("cancelled");
    expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
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

  it("preserves unauthenticated owner-null local-first data", async () => {
    mocks.getLocalDataOwnerId.mockResolvedValue(null);

    const result = await performOwnerSafeSignOut();

    expect(result.status).toBe("signed-out");
    expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
    expect(mocks.discardSuspendedActionsForAccountBoundary).not.toHaveBeenCalled();
    expect(mocks.clearNativeJournalBiometricCredential).not.toHaveBeenCalled();
    expect(mocks.clearAccountDeviceSurfaces).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toBeNull();
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
    expect(mocks.removePushToken).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.clearLocalUserData).toHaveBeenCalledTimes(1);
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
    expect(mocks.removePushToken).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(localStorage.getItem(PENDING_CLEANUP_KEY)).toBeNull();
    expect(mocks.resumeCloudSync).toHaveBeenCalledTimes(1);
    expect(mocks.resumeAfterAccountBoundary).toHaveBeenCalledTimes(1);
  });
});
