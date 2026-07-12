import { act, renderHook, waitFor } from "@testing-library/react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mocks } = vi.hoisted(() => ({
  mocks: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    linkIdentity: vi.fn(),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
    openOAuthUrl: vi.fn(),
    removePushToken: vi.fn(),
    initializePushNotifications: vi.fn(),
    stopAutoSync: vi.fn(),
    startAutoSync: vi.fn(),
    quiesceCloudSync: vi.fn(),
    resumeCloudSync: vi.fn(),
    clearLocalUserData: vi.fn(),
    getLocalDataOwnerId: vi.fn(),
    clearDeviceIdCache: vi.fn(),
    triggerDataRefresh: vi.fn(),
    processQueue: vi.fn(),
    hasPendingActions: vi.fn(),
    hasPendingActionsForOwner: vi.fn(),
    getCurrentSessionUserId: vi.fn(),
    runWithDataWriteBarrier: vi.fn(),
    suspendForAccountBoundary: vi.fn(),
    discardSuspendedActionsForAccountBoundary: vi.fn(),
    resumeAfterAccountBoundary: vi.fn(),
    hasPendingJournalSecurityMigrationForOwner: vi.fn(),
    clearNativeJournalBiometricCredential: vi.fn(),
    clearAccountDeviceSurfaces: vi.fn(),
    clearAccountNotificationsForBoundary: vi.fn(),
    resumeAccountNotifications: vi.fn(),
    resetAuthState: vi.fn(),
    setAuthGateChecked: vi.fn(),
  },
}));

vi.mock("@/lib/platform", () => ({
  get isNative() {
    return true;
  },
}));

vi.mock("@/lib/authRedirect", async () => {
  const actual = await vi.importActual<typeof import("@/lib/authRedirect")>("@/lib/authRedirect");
  return {
    ...actual,
    getAuthRedirectUrl: () => "com.zenflow.app://login-callback",
  };
});

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
      linkIdentity: mocks.linkIdentity,
      signInWithOAuth: mocks.signInWithOAuth,
      signOut: mocks.signOut,
    },
  },
  getCurrentSessionUserId: mocks.getCurrentSessionUserId,
}));

vi.mock("@/lib/nativeOAuthBrowser", () => ({
  openOAuthUrl: mocks.openOAuthUrl,
}));

vi.mock("@/lib/nativeGoogleAuth", () => ({
  authenticateWithGoogleNative: vi.fn(),
}));

vi.mock("@/lib/pushNotifications", () => ({
  removePushToken: mocks.removePushToken,
  initializePushNotifications: mocks.initializePushNotifications,
}));

vi.mock("@/lib/journalBiometricCredentials", () => ({
  clearNativeJournalBiometricCredential: mocks.clearNativeJournalBiometricCredential,
}));

vi.mock("@/lib/accountDeviceCleanup", () => ({
  clearAccountDeviceSurfaces: mocks.clearAccountDeviceSurfaces,
}));

vi.mock("@/lib/localNotifications", () => ({
  clearAccountNotificationsForBoundary: mocks.clearAccountNotificationsForBoundary,
  resumeAccountNotifications: mocks.resumeAccountNotifications,
}));

vi.mock("@/features/journal", () => ({
  hasPendingJournalSecurityMigrationForOwner:
    mocks.hasPendingJournalSecurityMigrationForOwner,
}));

vi.mock("@/lib/offlineQueue", () => ({
  offlineQueue: {
    processQueue: mocks.processQueue,
    hasPendingActions: mocks.hasPendingActions,
    hasPendingActionsForOwner: mocks.hasPendingActionsForOwner,
    hasPendingActionsForOwnerReady: async (ownerUserId: string) =>
      mocks.hasPendingActionsForOwner(ownerUserId),
    suspendForAccountBoundary: mocks.suspendForAccountBoundary,
    discardSuspendedActionsForAccountBoundary:
      mocks.discardSuspendedActionsForAccountBoundary,
    resumeAfterAccountBoundary: mocks.resumeAfterAccountBoundary,
  },
}));

vi.mock("@/storage/cloudSync", () => ({
  stopAutoSync: mocks.stopAutoSync,
  startAutoSync: mocks.startAutoSync,
  quiesceCloudSync: mocks.quiesceCloudSync,
  resumeCloudSync: mocks.resumeCloudSync,
}));

vi.mock("@/storage/db", () => ({
  clearLocalUserData: mocks.clearLocalUserData,
  getLocalDataOwnerId: mocks.getLocalDataOwnerId,
}));

vi.mock("@/lib/originExclusiveLock", () => ({
  runWithOriginExclusiveLock: async (
    _name: string,
    operation: () => Promise<unknown>,
  ) => operation(),
}));

vi.mock("@/hooks/useIndexedDB", () => ({
  triggerDataRefresh: mocks.triggerDataRefresh,
  runWithDataWriteBarrier: mocks.runWithDataWriteBarrier,
}));

vi.mock("@/storage/eventSync", () => ({
  clearDeviceIdCache: mocks.clearDeviceIdCache,
}));

vi.mock("@/stores", () => ({
  useAppStore: (selector: (state: { resetAuthState: () => void }) => unknown) =>
    selector({ resetAuthState: mocks.resetAuthState }),
  useUserDataStore: (
    selector: (state: {
      setAuthGateChecked: (value: boolean) => void;
      privacy: { pushNotifications: boolean };
    }) => unknown
  ) => selector({
    setAuthGateChecked: mocks.setAuthGateChecked,
    privacy: { pushNotifications: true },
  }),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { useAccountAuth } from "@/components/settings/account-section/useAccountAuth";
import { resetAuthGuard } from "@/lib/authGuard";

const t = {
  authNotConfigured: "Auth is not configured.",
  authTooManyAttempts: "Too many attempts.",
  authProviderLinkFailed: "Could not connect provider.",
  authError: "Auth failed.",
  authUnexpectedError: "Unexpected auth error.",
  authSignedOut: "Signed out.",
  authSignOutPendingChanges: "Connect and save pending changes before signing out.",
  authSignOutCleanupFailed: "ZenFlow could not finish secure sign-out. Try again.",
  authSignOutFailed: "Sign-out did not complete. Try again.",
};

const authStateCallbacks: Array<(event: AuthChangeEvent, session: Session | null) => void> = [];

function createSession(): Session {
  return {
    access_token: "",
    refresh_token: "",
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: "telegram-user-id",
      aud: "authenticated",
      role: "authenticated",
      app_metadata: {
        provider: "telegram",
      },
      user_metadata: {
        name: "Telegram User",
      },
      created_at: "2026-06-21T00:00:00.000Z",
    },
  };
}

function renderAccountAuth(onNameChange = vi.fn()) {
  return renderHook(() => useAccountAuth({ onNameChange, t }));
}

describe("useAccountAuth native OAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStateCallbacks.length = 0;
    resetAuthGuard();
    mocks.getSession.mockResolvedValue({ data: { session: createSession() }, error: null });
    mocks.onAuthStateChange.mockImplementation((callback) => {
      authStateCallbacks.push(callback);
      return {
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      };
    });
    mocks.openOAuthUrl.mockResolvedValue(undefined);
    mocks.hasPendingActions.mockReturnValue(false);
    mocks.hasPendingActionsForOwner.mockReturnValue(false);
    mocks.getCurrentSessionUserId.mockResolvedValue("telegram-user-id");
    mocks.quiesceCloudSync.mockResolvedValue(undefined);
    mocks.runWithDataWriteBarrier.mockImplementation(async (mutation) => {
      const result = await mutation();
      await mocks.triggerDataRefresh();
      return result;
    });
    mocks.suspendForAccountBoundary.mockResolvedValue(undefined);
    mocks.discardSuspendedActionsForAccountBoundary.mockResolvedValue(undefined);
    mocks.hasPendingJournalSecurityMigrationForOwner.mockResolvedValue(false);
    mocks.clearNativeJournalBiometricCredential.mockResolvedValue("removed");
    mocks.clearAccountDeviceSurfaces.mockResolvedValue(undefined);
    mocks.clearAccountNotificationsForBoundary.mockResolvedValue(undefined);
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.removePushToken.mockResolvedValue({
      status: "revoked",
      remote: "deleted",
      native: "unregistered",
    });
    mocks.initializePushNotifications.mockResolvedValue(undefined);
    mocks.clearLocalUserData.mockResolvedValue(undefined);
    mocks.getLocalDataOwnerId.mockResolvedValue("telegram-user-id");
    mocks.triggerDataRefresh.mockResolvedValue(undefined);
    mocks.processQueue.mockResolvedValue(undefined);
    localStorage.removeItem("zenflow_pending_account_sign_out_cleanup");
  });

  it("does not expose unsafe current-session identity linking from Settings", () => {
    const { result } = renderAccountAuth();

    expect(result.current).not.toHaveProperty("handleLinkProvider");
    expect(result.current).not.toHaveProperty("linkingProvider");
    expect(mocks.linkIdentity).not.toHaveBeenCalled();
  });

  it("keeps the account session in a checking state until getSession settles", async () => {
    let resolveSession!: (value: { data: { session: Session }; error: null }) => void;
    mocks.getSession.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSession = resolve;
        }),
    );

    const { result } = renderAccountAuth();

    expect(result.current.sessionCheckState).toBe("checking");
    expect(result.current.hasSession).toBe(false);

    await act(async () => {
      resolveSession({ data: { session: createSession() }, error: null });
    });

    await waitFor(() => expect(result.current.sessionCheckState).toBe("signed-in"));
    expect(result.current.hasSession).toBe(true);
  });

  it("exposes a retryable error without treating a failed session check as signed out", async () => {
    mocks.getSession
      .mockRejectedValueOnce(new Error("session check failed"))
      .mockResolvedValueOnce({ data: { session: createSession() }, error: null });

    const { result } = renderAccountAuth();

    await waitFor(() => expect(result.current.sessionCheckState).toBe("error"));
    expect(result.current.hasSession).toBe(false);

    await act(async () => {
      await result.current.refreshSession();
    });

    expect(result.current.sessionCheckState).toBe("signed-in");
    expect(result.current.hasSession).toBe(true);
  });

  it("removes the remote push token before clearing local user data and resets the protected V2 auth gate", async () => {
    const onNameChange = vi.fn();
    mocks.getSession.mockResolvedValue({ data: { session: createSession() } });

    const { result } = renderAccountAuth(onNameChange);

    await waitFor(() => expect(result.current.hasSession).toBe(true));

    await act(async () => {
      await result.current.handleSignOut();
    });

    expect(mocks.quiesceCloudSync).toHaveBeenCalledTimes(1);
    expect(mocks.clearDeviceIdCache).toHaveBeenCalledTimes(1);
    expect(mocks.clearLocalUserData).toHaveBeenCalledTimes(1);
    expect(mocks.triggerDataRefresh).toHaveBeenCalledTimes(1);
    expect(mocks.removePushToken).toHaveBeenCalledTimes(1);
    expect(mocks.clearAccountNotificationsForBoundary).toHaveBeenCalledTimes(1);
    expect(mocks.clearNativeJournalBiometricCredential).toHaveBeenCalledTimes(1);
    expect(mocks.clearAccountDeviceSurfaces).toHaveBeenCalledTimes(1);
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.signOut.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.clearLocalUserData.mock.invocationCallOrder[0],
    );
    expect(mocks.removePushToken.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.clearAccountNotificationsForBoundary.mock.invocationCallOrder[0]
    );
    expect(mocks.clearAccountNotificationsForBoundary.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.clearLocalUserData.mock.invocationCallOrder[0]
    );
    expect(mocks.clearNativeJournalBiometricCredential.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.clearLocalUserData.mock.invocationCallOrder[0]
    );
    expect(mocks.clearAccountDeviceSurfaces.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.clearLocalUserData.mock.invocationCallOrder[0]
    );
    expect(mocks.resetAuthState).toHaveBeenCalledTimes(1);
    expect(mocks.setAuthGateChecked).toHaveBeenCalledWith(false);
    expect(onNameChange).toHaveBeenCalledWith("Friend");
    expect(mocks.resetAuthState.mock.invocationCallOrder[0]).toBeGreaterThan(
      mocks.signOut.mock.invocationCallOrder[0]
    );
    expect(mocks.setAuthGateChecked.mock.invocationCallOrder[0]).toBeGreaterThan(
      mocks.signOut.mock.invocationCallOrder[0]
    );
  });

  it("blocks sign-out when owner-bound pending actions remain under queue suspension", async () => {
    mocks.hasPendingActionsForOwner.mockReturnValue(true);
    const { result } = renderAccountAuth();

    await act(async () => {
      await result.current.handleSignOut();
    });

    expect(mocks.suspendForAccountBoundary).toHaveBeenCalledTimes(1);
    expect(mocks.processQueue).not.toHaveBeenCalled();
    expect(result.current.authStatus).toBe(t.authSignOutPendingChanges);
    expect(result.current.signOutBlockReason).toBe("pending-changes");
    expect(mocks.removePushToken).not.toHaveBeenCalled();
    expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.resetAuthState).not.toHaveBeenCalled();
  });

  it("discards pending work only through the explicit discard-and-sign-out action", async () => {
    mocks.hasPendingActionsForOwner.mockReturnValue(true);
    const { result } = renderAccountAuth();

    await act(async () => {
      await result.current.handleSignOut();
    });

    expect(mocks.discardSuspendedActionsForAccountBoundary).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.handleDiscardPendingAndSignOut();
    });

    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.discardSuspendedActionsForAccountBoundary).toHaveBeenCalledTimes(1);
    expect(result.current.signOutBlockReason).toBeNull();
  });

  it("removes a notification delivered while push revocation is in flight", async () => {
    let deliveredForPreviousOwner = 0;
    mocks.clearAccountNotificationsForBoundary.mockImplementation(async () => {
      deliveredForPreviousOwner = 0;
    });
    mocks.removePushToken.mockImplementationOnce(async () => {
      deliveredForPreviousOwner = 1;
      return {
        status: "revoked",
        remote: "deleted",
        native: "unregistered",
      } as const;
    });
    const { result } = renderAccountAuth();

    await act(async () => {
      await result.current.handleSignOut();
    });

    expect(mocks.clearAccountNotificationsForBoundary).toHaveBeenCalledTimes(1);
    expect(deliveredForPreviousOwner).toBe(0);
    expect(mocks.removePushToken.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.clearAccountNotificationsForBoundary.mock.invocationCallOrder[0],
    );
  });

  it("preserves a delayed enqueue that lands before suspension completes", async () => {
    mocks.hasPendingActionsForOwner.mockReturnValue(false);
    mocks.suspendForAccountBoundary.mockImplementationOnce(async () => {
      mocks.hasPendingActionsForOwner.mockReturnValue(true);
    });
    const { result } = renderAccountAuth();

    await act(async () => {
      await result.current.handleSignOut();
    });

    expect(result.current.authStatus).toBe(t.authSignOutPendingChanges);
    expect(mocks.discardSuspendedActionsForAccountBoundary).not.toHaveBeenCalled();
    expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.resumeAfterAccountBoundary).toHaveBeenCalledTimes(1);
  });

  it("blocks sign-out while a diary protection migration remains outside the queue", async () => {
    mocks.hasPendingJournalSecurityMigrationForOwner.mockResolvedValue(true);
    const { result } = renderAccountAuth();

    await act(async () => {
      await result.current.handleSignOut();
    });

    expect(result.current.authStatus).toBe(t.authSignOutPendingChanges);
    expect(mocks.removePushToken).not.toHaveBeenCalled();
    expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
  });

  it("does not let quarantined work from another owner block the active account sign-out", async () => {
    mocks.hasPendingActions.mockReturnValue(true);
    mocks.hasPendingActionsForOwner.mockReturnValue(false);
    const { result } = renderAccountAuth();

    await act(async () => {
      await result.current.handleSignOut();
    });

    expect(mocks.processQueue).not.toHaveBeenCalled();
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("blocks sign-out when push registration revocation is incomplete", async () => {
    mocks.removePushToken.mockResolvedValueOnce({
      status: "partial",
      remote: "failed",
      native: "unregistered",
    });
    const { result } = renderAccountAuth();

    await act(async () => {
      await result.current.handleSignOut();
    });

    expect(result.current.authStatus).toBe(t.authSignOutCleanupFailed);
    expect(mocks.stopAutoSync).not.toHaveBeenCalled();
    expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("reports incomplete cleanup after sign-out without resuming the expired account runtime", async () => {
    mocks.clearLocalUserData.mockRejectedValueOnce(new Error("purge failed"));
    const { result } = renderAccountAuth();

    await act(async () => {
      await result.current.handleSignOut();
    });

    expect(result.current.authStatus).toBe(t.authSignOutCleanupFailed);
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.resetAuthState).toHaveBeenCalledTimes(1);
    expect(mocks.setAuthGateChecked).toHaveBeenCalledWith(false);
    expect(mocks.resumeCloudSync).not.toHaveBeenCalled();
    expect(mocks.startAutoSync).not.toHaveBeenCalled();
    expect(mocks.resumeAccountNotifications).not.toHaveBeenCalled();
  });

  it("retries an incomplete post-sign-out purge after the session is already gone", async () => {
    mocks.clearLocalUserData.mockRejectedValueOnce(new Error("purge failed"));
    const { result } = renderAccountAuth();

    await act(async () => {
      await result.current.handleSignOut();
    });
    expect(result.current.authStatus).toBe(t.authSignOutCleanupFailed);

    mocks.getCurrentSessionUserId.mockResolvedValue(null);
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await act(async () => {
      await result.current.handleSignOut();
    });

    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.clearLocalUserData).toHaveBeenCalledTimes(2);
    expect(result.current.authStatus).toBe(t.authSignedOut);
    expect(result.current.signOutBlockReason).toBeNull();
  });

  it("defers the local purge when native journal cleanup must retry", async () => {
    mocks.clearNativeJournalBiometricCredential.mockRejectedValueOnce(
      new Error("native journal credential delete failed"),
    );
    const { result } = renderAccountAuth();

    await act(async () => {
      await result.current.handleSignOut();
    });

    expect(result.current.authStatus).toBe(t.authSignOutCleanupFailed);
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
    expect(mocks.clearDeviceIdCache).not.toHaveBeenCalled();
    expect(mocks.resetAuthState).toHaveBeenCalledTimes(1);
    expect(mocks.resumeCloudSync).not.toHaveBeenCalled();
    expect(mocks.startAutoSync).not.toHaveBeenCalled();
    expect(mocks.resumeAfterAccountBoundary).not.toHaveBeenCalled();
  });

  it("defers the local purge when native account surfaces must retry", async () => {
    mocks.clearAccountDeviceSurfaces.mockRejectedValueOnce(
      new Error("widget cleanup failed"),
    );
    const { result } = renderAccountAuth();

    await act(async () => {
      await result.current.handleSignOut();
    });

    expect(result.current.authStatus).toBe(t.authSignOutCleanupFailed);
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
    expect(mocks.resetAuthState).toHaveBeenCalledTimes(1);
    expect(mocks.resumeAfterAccountBoundary).not.toHaveBeenCalled();
  });

  it("does not report signed out when Supabase local sign-out fails", async () => {
    mocks.signOut.mockResolvedValueOnce({ error: { message: "network unavailable" } });
    const { result } = renderAccountAuth();

    await act(async () => {
      await result.current.handleSignOut();
    });

    expect(result.current.authStatus).toBe(t.authSignOutFailed);
    expect(mocks.resetAuthState).not.toHaveBeenCalled();
    expect(mocks.setAuthGateChecked).not.toHaveBeenCalled();
    expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
    expect(mocks.discardSuspendedActionsForAccountBoundary).not.toHaveBeenCalled();
    expect(mocks.clearAccountNotificationsForBoundary).not.toHaveBeenCalled();
    expect(mocks.clearNativeJournalBiometricCredential).not.toHaveBeenCalled();
    expect(mocks.clearAccountDeviceSurfaces).not.toHaveBeenCalled();
    expect(mocks.initializePushNotifications).toHaveBeenCalledTimes(1);
    expect(mocks.resumeCloudSync).toHaveBeenCalledTimes(1);
    expect(mocks.startAutoSync).toHaveBeenCalledTimes(1);
    expect(mocks.resumeAccountNotifications).not.toHaveBeenCalled();
  });
});
