import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteAccount: vi.fn(),
  loggerError: vi.fn(),
  signOut: vi.fn(),
  quiesceCloudSync: vi.fn(),
  resumeCloudSync: vi.fn(),
  startAutoSync: vi.fn(),
  suspendForAccountBoundary: vi.fn(),
  discardSuspendedActionsForAccountBoundary: vi.fn(),
  resumeAfterAccountBoundary: vi.fn(),
  removePushToken: vi.fn(),
  clearNativeJournalBiometricCredential: vi.fn(),
  clearAccountDeviceSurfaces: vi.fn(),
  clearAccountNotificationsForBoundary: vi.fn(),
  resumeAccountNotifications: vi.fn(),
  getCurrentSessionUserId: vi.fn(),
  clearJournalContentSession: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: { auth: { signOut: mocks.signOut } },
  getCurrentSessionUserId: mocks.getCurrentSessionUserId,
}));

vi.mock("@/lib/accountService", () => ({
  deleteAccount: mocks.deleteAccount,
}));

vi.mock("@/storage/cloudSync", () => ({
  quiesceCloudSync: mocks.quiesceCloudSync,
  resumeCloudSync: mocks.resumeCloudSync,
  startAutoSync: mocks.startAutoSync,
}));

vi.mock("@/lib/offlineQueue", () => ({
  offlineQueue: {
    suspendForAccountBoundary: mocks.suspendForAccountBoundary,
    discardSuspendedActionsForAccountBoundary:
      mocks.discardSuspendedActionsForAccountBoundary,
    resumeAfterAccountBoundary: mocks.resumeAfterAccountBoundary,
  },
}));

vi.mock("@/lib/pushNotifications", () => ({
  removePushToken: mocks.removePushToken,
}));

vi.mock("@/lib/journalBiometricCredentials", () => ({
  clearNativeJournalBiometricCredential: mocks.clearNativeJournalBiometricCredential,
}));

vi.mock("@/lib/journalContentSession", () => ({
  clearJournalContentSession: mocks.clearJournalContentSession,
}));

vi.mock("@/lib/accountDeviceCleanup", () => ({
  clearAccountDeviceSurfaces: mocks.clearAccountDeviceSurfaces,
}));

vi.mock("@/lib/localNotifications", () => ({
  clearAccountNotificationsForBoundary: mocks.clearAccountNotificationsForBoundary,
  resumeAccountNotifications: mocks.resumeAccountNotifications,
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: mocks.loggerError, warn: vi.fn() },
}));

import { useDeleteAccount } from "../useDeleteAccount";

const copy = {
  deleteAccountError: "Account was not deleted. Try again.",
  deleteAccountSuccess: "Account deleted.",
  deleteAccountDeletedCleanupFailed:
    "Your account was deleted, but cleanup on this device did not finish. Restart ZenFlow.",
};

function renderSubject(onResetData = vi.fn().mockResolvedValue(undefined)) {
  const hook = renderHook(() =>
    useDeleteAccount({ onResetData, t: copy, activeUserId: "account-a" }),
  );
  act(() => {
    hook.result.current.openDeleteConfirmation();
    hook.result.current.setDeleteConfirmInput("DELETE");
  });
  return { hook, onResetData };
}

describe("useDeleteAccount staged deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.quiesceCloudSync.mockResolvedValue(undefined);
    mocks.suspendForAccountBoundary.mockResolvedValue(undefined);
    mocks.discardSuspendedActionsForAccountBoundary.mockResolvedValue(undefined);
    mocks.removePushToken.mockResolvedValue({
      status: "revoked",
      remote: "deleted",
      native: "unregistered",
    });
    mocks.clearNativeJournalBiometricCredential.mockResolvedValue("removed");
    mocks.clearAccountDeviceSurfaces.mockResolvedValue(undefined);
    mocks.clearAccountNotificationsForBoundary.mockResolvedValue(undefined);
    mocks.getCurrentSessionUserId.mockResolvedValue("account-a");
  });

  it("does not clean up locally when the server did not confirm deletion", async () => {
    mocks.deleteAccount.mockResolvedValue({ status: "not-deleted", code: "invoke-failed" });
    const { hook, onResetData } = renderSubject();

    await act(async () => {
      await hook.result.current.handleDeleteAccount();
    });

    expect(onResetData).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(hook.result.current.deleteStatus).toBe(copy.deleteAccountError);
    expect(hook.result.current.showDeleteConfirm).toBe(true);
  });

  it("keeps a critical deletion error visible until the user retries", async () => {
    vi.useFakeTimers();
    try {
      mocks.deleteAccount.mockResolvedValue({ status: "not-deleted", code: "invoke-failed" });
      const { hook } = renderSubject();

      await act(async () => {
        await hook.result.current.handleDeleteAccount();
      });
      expect(hook.result.current.deleteStatus).toBe(copy.deleteAccountError);

      act(() => {
        vi.advanceTimersByTime(3_100);
      });
      expect(hook.result.current.deleteStatus).toBe(copy.deleteAccountError);
    } finally {
      vi.useRealTimers();
    }
  });

  it("quiesces writers before remote deletion and restores them if deletion is rejected", async () => {
    mocks.deleteAccount.mockResolvedValue({ status: "not-deleted", code: "invoke-failed" });
    const { hook } = renderSubject();

    await act(async () => {
      await hook.result.current.handleDeleteAccount();
    });

    expect(mocks.quiesceCloudSync.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.suspendForAccountBoundary.mock.invocationCallOrder[0],
    );
    expect(mocks.suspendForAccountBoundary.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteAccount.mock.invocationCallOrder[0],
    );
    expect(mocks.discardSuspendedActionsForAccountBoundary).not.toHaveBeenCalled();
    expect(mocks.resumeCloudSync).toHaveBeenCalledTimes(1);
    expect(mocks.startAutoSync).toHaveBeenCalledTimes(1);
    expect(mocks.resumeAfterAccountBoundary).toHaveBeenCalledTimes(1);
  });

  it("purges device data after confirmed deletion even when local sign-out fails", async () => {
    mocks.deleteAccount.mockResolvedValue({ status: "deleted", userId: "account-a" });
    mocks.signOut.mockResolvedValue({ error: { message: "session already gone" } });
    const { hook, onResetData } = renderSubject();

    await act(async () => {
      await hook.result.current.handleDeleteAccount();
    });

    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.quiesceCloudSync).toHaveBeenCalledTimes(1);
    expect(onResetData).toHaveBeenCalledTimes(1);
    expect(mocks.quiesceCloudSync.mock.invocationCallOrder[0]).toBeLessThan(
      onResetData.mock.invocationCallOrder[0]
    );
    expect(hook.result.current.showDeleteConfirm).toBe(false);
    expect(hook.result.current.deleteStatus).toBe(copy.deleteAccountDeletedCleanupFailed);
  });

  it("reports deleted-but-cleanup-failed when device purge rejects", async () => {
    mocks.deleteAccount.mockResolvedValue({ status: "deleted", userId: "account-a" });
    const onResetData = vi.fn().mockRejectedValue(new Error("device purge failed"));
    const { hook } = renderSubject(onResetData);

    await act(async () => {
      await hook.result.current.handleDeleteAccount();
    });

    expect(hook.result.current.showDeleteConfirm).toBe(false);
    expect(hook.result.current.deleteStatus).toBe(copy.deleteAccountDeletedCleanupFailed);
  });

  it("reports complete success only after local sign-out and purge succeed", async () => {
    mocks.deleteAccount.mockResolvedValue({ status: "deleted", userId: "account-a" });
    const { hook, onResetData } = renderSubject();

    await act(async () => {
      await hook.result.current.handleDeleteAccount();
    });

    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.clearNativeJournalBiometricCredential).toHaveBeenCalledTimes(1);
    expect(mocks.clearAccountDeviceSurfaces).toHaveBeenCalledTimes(1);
    expect(mocks.clearAccountNotificationsForBoundary).toHaveBeenCalledTimes(3);
    expect(onResetData).toHaveBeenCalledTimes(1);
    expect(mocks.clearNativeJournalBiometricCredential.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteAccount.mock.invocationCallOrder[0],
    );
    expect(mocks.clearAccountDeviceSurfaces.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteAccount.mock.invocationCallOrder[0],
    );
    expect(mocks.removePushToken.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.clearAccountNotificationsForBoundary.mock.invocationCallOrder[1],
    );
    expect(mocks.deleteAccount.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.clearAccountNotificationsForBoundary.mock.invocationCallOrder[2],
    );
    expect(mocks.deleteAccount).toHaveBeenCalledWith("account-a");
    expect(hook.result.current.deleteStatus).toBe(copy.deleteAccountSuccess);
  });

  it("fails before remote deletion when native credential cleanup cannot complete", async () => {
    mocks.deleteAccount.mockResolvedValue({ status: "deleted", userId: "account-a" });
    mocks.clearNativeJournalBiometricCredential.mockRejectedValueOnce(
      new Error("native journal credential delete failed"),
    );
    const { hook, onResetData } = renderSubject();

    await act(async () => {
      await hook.result.current.handleDeleteAccount();
    });

    expect(mocks.deleteAccount).not.toHaveBeenCalled();
    expect(mocks.clearNativeJournalBiometricCredential).toHaveBeenCalledTimes(1);
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(onResetData).not.toHaveBeenCalled();
    expect(hook.result.current.showDeleteConfirm).toBe(true);
    expect(hook.result.current.deleteStatus).toBe(copy.deleteAccountError);
    expect(hook.result.current.deleteStatus).not.toBe(copy.deleteAccountSuccess);
  });

  it("fails before remote deletion when widget or cache cleanup cannot complete", async () => {
    mocks.deleteAccount.mockResolvedValue({ status: "deleted", userId: "account-a" });
    mocks.clearAccountDeviceSurfaces.mockRejectedValueOnce(
      new Error("widget cleanup failed"),
    );
    const { hook, onResetData } = renderSubject();

    await act(async () => {
      await hook.result.current.handleDeleteAccount();
    });

    expect(mocks.deleteAccount).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(onResetData).not.toHaveBeenCalled();
    expect(hook.result.current.deleteStatus).toBe(copy.deleteAccountError);
  });

  it("revokes this device push registration before deleting the remote account", async () => {
    mocks.deleteAccount.mockResolvedValue({ status: "deleted", userId: "account-a" });
    const { hook } = renderSubject();

    await act(async () => {
      await hook.result.current.handleDeleteAccount();
    });

    expect(mocks.removePushToken).toHaveBeenCalledTimes(1);
    expect(mocks.removePushToken.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteAccount.mock.invocationCallOrder[0],
    );
  });

  it("cancels account-A deletion if the authenticated account changes to B before invoke", async () => {
    mocks.getCurrentSessionUserId
      .mockResolvedValueOnce("account-a")
      .mockResolvedValueOnce("account-b");
    mocks.deleteAccount.mockResolvedValue({ status: "deleted", userId: "account-a" });
    const { hook, onResetData } = renderSubject();

    await act(async () => {
      await hook.result.current.handleDeleteAccount();
    });

    expect(mocks.deleteAccount).not.toHaveBeenCalled();
    expect(onResetData).not.toHaveBeenCalled();
    expect(mocks.resumeCloudSync).toHaveBeenCalledTimes(1);
    expect(mocks.resumeAfterAccountBoundary).toHaveBeenCalledTimes(1);
    expect(hook.result.current.deleteStatus).toBe(copy.deleteAccountError);
  });

  it("does not reinterpret an account-A confirmation as permission to delete account B", async () => {
    mocks.getCurrentSessionUserId.mockResolvedValue("account-a");
    mocks.deleteAccount.mockResolvedValue({ status: "deleted", userId: "account-b" });
    const { hook, onResetData } = renderSubject();
    act(() => hook.result.current.setDeleteConfirmInput("DELETE"));

    // The confirmation was opened for A. Before the final action, B becomes active.
    mocks.getCurrentSessionUserId.mockResolvedValue("account-b");
    await act(async () => {
      await hook.result.current.handleDeleteAccount();
    });

    expect(mocks.deleteAccount).not.toHaveBeenCalled();
    expect(mocks.quiesceCloudSync).not.toHaveBeenCalled();
    expect(onResetData).not.toHaveBeenCalled();
    expect(hook.result.current.showDeleteConfirm).toBe(false);
    expect(hook.result.current.deleteConfirmInput).toBe("");
    expect(hook.result.current.deleteStatus).toBe(copy.deleteAccountError);
  });

  it("clears a typed confirmation as soon as the active account changes", () => {
    const onResetData = vi.fn().mockResolvedValue(undefined);
    const hook = renderHook(
      ({ activeUserId }: { activeUserId: string | null }) =>
        useDeleteAccount({ onResetData, t: copy, activeUserId }),
      { initialProps: { activeUserId: "account-a" } },
    );

    act(() => {
      hook.result.current.openDeleteConfirmation();
      hook.result.current.setDeleteConfirmInput("DELETE");
    });
    expect(hook.result.current.showDeleteConfirm).toBe(true);

    hook.rerender({ activeUserId: "account-b" });

    expect(hook.result.current.showDeleteConfirm).toBe(false);
    expect(hook.result.current.deleteConfirmInput).toBe("");
    expect(hook.result.current.deleteStatus).toBe(copy.deleteAccountError);
    expect(mocks.deleteAccount).not.toHaveBeenCalled();
  });

  it("keeps an in-progress account-A deletion visible when account B becomes active", async () => {
    let resolveRemoteDelete!: (result: { status: "deleted"; userId: string }) => void;
    mocks.deleteAccount.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRemoteDelete = resolve;
        }),
    );
    const onResetData = vi.fn().mockResolvedValue(undefined);
    const hook = renderHook(
      ({ activeUserId }: { activeUserId: string | null }) =>
        useDeleteAccount({ onResetData, t: copy, activeUserId }),
      { initialProps: { activeUserId: "account-a" } },
    );
    act(() => {
      hook.result.current.openDeleteConfirmation();
      hook.result.current.setDeleteConfirmInput("DELETE");
    });

    let deletion!: Promise<void>;
    act(() => {
      deletion = hook.result.current.handleDeleteAccount();
    });
    await waitFor(() => expect(mocks.deleteAccount).toHaveBeenCalledWith("account-a"));

    hook.rerender({ activeUserId: "account-b" });

    expect(hook.result.current.showDeleteConfirm).toBe(true);
    expect(hook.result.current.isDeletingAccount).toBe(true);

    mocks.getCurrentSessionUserId.mockResolvedValue("account-b");
    await act(async () => {
      resolveRemoteDelete({ status: "deleted", userId: "account-a" });
      await deletion;
    });
    expect(hook.result.current.showDeleteConfirm).toBe(false);
  });

  it("does not purge or sign out account B when account A deletion resolves after a session switch", async () => {
    let resolveRemoteDelete!: (result: {
      status: "deleted";
      userId: string;
    }) => void;
    mocks.deleteAccount.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRemoteDelete = resolve;
        }),
    );
    const { hook, onResetData } = renderSubject();

    let deletion!: Promise<void>;
    act(() => {
      deletion = hook.result.current.handleDeleteAccount();
    });
    await waitFor(() => expect(mocks.deleteAccount).toHaveBeenCalledWith("account-a"));

    // The remote request still belongs to A, but B is now the active session.
    mocks.getCurrentSessionUserId.mockResolvedValue("account-b");
    await act(async () => {
      resolveRemoteDelete({ status: "deleted", userId: "account-a" });
      await deletion;
    });

    expect(mocks.getCurrentSessionUserId.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(onResetData).not.toHaveBeenCalled();
    expect(mocks.discardSuspendedActionsForAccountBoundary).not.toHaveBeenCalled();
    expect(mocks.clearJournalContentSession).not.toHaveBeenCalled();
    expect(mocks.clearAccountDeviceSurfaces).toHaveBeenCalledTimes(1);
    expect(mocks.clearAccountNotificationsForBoundary).toHaveBeenCalledTimes(2);

    // Account-switch cleanup owns writer recovery; this stale A flow must not
    // resume global writers while B's boundary may still be in progress.
    expect(mocks.resumeCloudSync).not.toHaveBeenCalled();
    expect(mocks.startAutoSync).not.toHaveBeenCalled();
    expect(mocks.resumeAfterAccountBoundary).not.toHaveBeenCalled();
    expect(mocks.resumeAccountNotifications).not.toHaveBeenCalled();
    expect(hook.result.current.showDeleteConfirm).toBe(false);
    expect(hook.result.current.deleteStatus).toBe(copy.deleteAccountDeletedCleanupFailed);
  });
});
