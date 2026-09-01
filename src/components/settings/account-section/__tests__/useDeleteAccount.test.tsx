import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loggerError: vi.fn(),
  performOwnerSafeAccountDeletion: vi.fn(),
}));

vi.mock("@/lib/accountSignOutCleanup", () => ({
  performOwnerSafeAccountDeletion: mocks.performOwnerSafeAccountDeletion,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/lib/pushNotifications", () => ({
  initializePushNotifications: vi.fn(),
}));

import { useDeleteAccount } from "../useDeleteAccount";

const copy = {
  deleteAccountError: "Account was not deleted. Try again.",
  deleteAccountOutcomeUnknown:
    "We couldn't confirm whether account deletion finished. Try again to check and finish it.",
  deleteAccountSuccess: "Account deleted.",
  deleteAccountDeletedCleanupFailed:
    "Your account was deleted, but cleanup on this device did not finish. Restart ZenFlow.",
};

function renderSubject(activeUserId: string | null = "account-a") {
  const hook = renderHook(
    ({ owner }: { owner: string | null }) =>
      useDeleteAccount({ t: copy, activeUserId: owner }),
    { initialProps: { owner: activeUserId } },
  );
  act(() => {
    hook.result.current.openDeleteConfirmation();
    hook.result.current.setDeleteConfirmInput("DELETE");
  });
  return hook;
}

describe("useDeleteAccount owner-bound coordinator adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.performOwnerSafeAccountDeletion.mockResolvedValue({
      status: "deleted",
      remoteDeletion: "confirmed",
    });
  });

  it("delegates the irreversible flow to the durable owner-bound coordinator", async () => {
    const hook = renderSubject();

    await act(async () => {
      await hook.result.current.handleDeleteAccount();
    });

    expect(mocks.performOwnerSafeAccountDeletion).toHaveBeenCalledWith(
      "account-a",
      expect.any(Object),
    );
    expect(hook.result.current.showDeleteConfirm).toBe(false);
    expect(hook.result.current.deleteStatus).toBe(copy.deleteAccountSuccess);
  });

  it("keeps the confirmation available when the server definitively rejects deletion", async () => {
    mocks.performOwnerSafeAccountDeletion.mockResolvedValueOnce({
      status: "delete-failed",
      remoteDeletion: "not-confirmed",
    });
    const hook = renderSubject();

    await act(async () => {
      await hook.result.current.handleDeleteAccount();
    });

    expect(hook.result.current.showDeleteConfirm).toBe(true);
    expect(hook.result.current.deleteStatus).toBe(copy.deleteAccountError);
  });

  it("keeps an ambiguous durable deletion request visible and retryable", async () => {
    mocks.performOwnerSafeAccountDeletion
      .mockResolvedValueOnce({
        status: "cleanup-failed",
        remoteDeletion: "unknown",
      })
      .mockResolvedValueOnce({
        status: "deleted",
        remoteDeletion: "confirmed",
      });
    const hook = renderSubject();

    await act(async () => {
      await hook.result.current.handleDeleteAccount();
    });
    expect(hook.result.current.showDeleteConfirm).toBe(true);
    expect(hook.result.current.deleteStatus).toBe(
      copy.deleteAccountOutcomeUnknown,
    );
    expect(hook.result.current.deleteStatus).not.toBe(copy.deleteAccountError);

    await act(async () => {
      await hook.result.current.handleDeleteAccount();
    });
    expect(mocks.performOwnerSafeAccountDeletion).toHaveBeenCalledTimes(2);
    expect(hook.result.current.showDeleteConfirm).toBe(false);
    expect(hook.result.current.deleteStatus).toBe(copy.deleteAccountSuccess);
  });

  it("reports confirmed remote deletion separately when local cleanup is still pending", async () => {
    mocks.performOwnerSafeAccountDeletion.mockResolvedValueOnce({
      status: "cleanup-failed",
      remoteDeletion: "confirmed",
    });
    const hook = renderSubject();

    await act(async () => {
      await hook.result.current.handleDeleteAccount();
    });

    expect(hook.result.current.showDeleteConfirm).toBe(false);
    expect(hook.result.current.deleteStatus).toBe(
      copy.deleteAccountDeletedCleanupFailed,
    );
  });

  it("clears stale confirmation when the active account changes before submission", async () => {
    const hook = renderSubject();

    hook.rerender({ owner: "account-b" });

    expect(hook.result.current.showDeleteConfirm).toBe(false);
    expect(hook.result.current.deleteConfirmInput).toBe("");
    expect(hook.result.current.deleteStatus).toBe(copy.deleteAccountError);
    expect(mocks.performOwnerSafeAccountDeletion).not.toHaveBeenCalled();
  });

  it("does not reinterpret account A confirmation as permission for account B", async () => {
    const hook = renderSubject();
    hook.rerender({ owner: "account-b" });

    await act(async () => {
      await hook.result.current.handleDeleteAccount();
    });

    expect(mocks.performOwnerSafeAccountDeletion).not.toHaveBeenCalled();
    expect(hook.result.current.showDeleteConfirm).toBe(false);
    expect(hook.result.current.deleteStatus).toBe(copy.deleteAccountError);
  });

  it("keeps an in-progress account A request visible, then clears it without publishing into B", async () => {
    let resolveDeletion!: (value: {
      status: "session-changed";
      remoteDeletion: "not-confirmed";
    }) => void;
    mocks.performOwnerSafeAccountDeletion.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveDeletion = resolve;
        }),
    );
    const hook = renderSubject();

    let deletion!: Promise<void>;
    act(() => {
      deletion = hook.result.current.handleDeleteAccount();
    });
    await waitFor(() =>
      expect(mocks.performOwnerSafeAccountDeletion).toHaveBeenCalledWith(
        "account-a",
        expect.any(Object),
      ),
    );

    hook.rerender({ owner: "account-b" });
    expect(hook.result.current.showDeleteConfirm).toBe(true);
    expect(hook.result.current.isDeletingAccount).toBe(true);

    await act(async () => {
      resolveDeletion({
        status: "session-changed",
        remoteDeletion: "not-confirmed",
      });
      await deletion;
    });

    expect(hook.result.current.showDeleteConfirm).toBe(false);
    expect(hook.result.current.deleteStatus).toBeNull();
  });

  it.each([
    {
      label: "confirmed deletion",
      result: {
        status: "deleted" as const,
        remoteDeletion: "confirmed" as const,
      },
    },
    {
      label: "confirmed deletion with pending local cleanup",
      result: {
        status: "cleanup-failed" as const,
        remoteDeletion: "confirmed" as const,
      },
    },
  ])("does not publish account A $label after account B becomes active", async ({ result }) => {
    let resolveDeletion!: (value: typeof result) => void;
    mocks.performOwnerSafeAccountDeletion.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveDeletion = resolve;
        }),
    );
    const hook = renderSubject("account-a");

    let deletion!: Promise<void>;
    act(() => {
      deletion = hook.result.current.handleDeleteAccount();
    });
    await waitFor(() => expect(hook.result.current.isDeletingAccount).toBe(true));

    hook.rerender({ owner: "account-b" });
    await act(async () => {
      resolveDeletion(result);
      await deletion;
    });

    expect(mocks.performOwnerSafeAccountDeletion).toHaveBeenCalledTimes(1);
    expect(hook.result.current.showDeleteConfirm).toBe(false);
    expect(hook.result.current.deleteStatus).toBeNull();
    expect(hook.result.current.deleteStatus).not.toBe(copy.deleteAccountSuccess);
    expect(hook.result.current.deleteStatus).not.toBe(copy.deleteAccountDeletedCleanupFailed);
  });

  it.each([
    {
      label: "confirmed deletion",
      result: {
        status: "deleted" as const,
        remoteDeletion: "confirmed" as const,
      },
      expectedStatus: copy.deleteAccountSuccess,
    },
    {
      label: "confirmed deletion with pending local cleanup",
      result: {
        status: "cleanup-failed" as const,
        remoteDeletion: "confirmed" as const,
      },
      expectedStatus: copy.deleteAccountDeletedCleanupFailed,
    },
  ])(
    "publishes $label when the expected deletion clears the active session",
    async ({ result, expectedStatus }) => {
      let resolveDeletion!: (value: typeof result) => void;
      mocks.performOwnerSafeAccountDeletion.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveDeletion = resolve;
          }),
      );
      const hook = renderSubject("account-a");

      let deletion!: Promise<void>;
      act(() => {
        deletion = hook.result.current.handleDeleteAccount();
      });
      await waitFor(() => expect(hook.result.current.isDeletingAccount).toBe(true));

      hook.rerender({ owner: null });
      await act(async () => {
        resolveDeletion(result);
        await deletion;
      });

      expect(hook.result.current.showDeleteConfirm).toBe(false);
      expect(hook.result.current.deleteStatus).toBe(expectedStatus);
    },
  );

  it("fails closed when the coordinator throws", async () => {
    mocks.performOwnerSafeAccountDeletion.mockRejectedValueOnce(
      new Error("coordinator unavailable"),
    );
    const hook = renderSubject();

    await act(async () => {
      await hook.result.current.handleDeleteAccount();
    });

    expect(mocks.loggerError).toHaveBeenCalledTimes(1);
    expect(hook.result.current.showDeleteConfirm).toBe(true);
    expect(hook.result.current.deleteStatus).toBe(
      copy.deleteAccountOutcomeUnknown,
    );
  });

  it("refuses to open a deletion prompt without an active owner", () => {
    const hook = renderHook(() =>
      useDeleteAccount({ t: copy, activeUserId: null }),
    );

    act(() => {
      expect(hook.result.current.openDeleteConfirmation()).toBe(false);
    });

    expect(hook.result.current.showDeleteConfirm).toBe(false);
    expect(hook.result.current.deleteStatus).toBe(copy.deleteAccountError);
  });
});
