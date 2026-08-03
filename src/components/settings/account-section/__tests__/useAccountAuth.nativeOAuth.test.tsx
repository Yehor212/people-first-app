import { act, renderHook, waitFor } from "@testing-library/react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_USER_ID = "22222222-2222-4222-8222-222222222222";

const { mocks } = vi.hoisted(() => ({
  mocks: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    linkIdentity: vi.fn(),
    signInWithOAuth: vi.fn(),
    authenticateWithGoogleNative: vi.fn(),
    platform: {
      isNative: true,
      isAndroid: false,
    },
    signOutExpectedOwnerLocally: vi.fn(),
    openOAuthUrl: vi.fn(),
    cancelPkceAttemptFromUrl: vi.fn(),
    removePushToken: vi.fn(),
    initializePushNotifications: vi.fn(),
    stopAutoSync: vi.fn(),
    startAutoSync: vi.fn(),
    quiesceCloudSync: vi.fn(),
    getCloudSyncAccountBoundaryEpoch: vi.fn(),
    isCloudSyncSuspendedForAccountBoundary: vi.fn(),
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
    runWithSettledDataRead: vi.fn(),
    suspendForAccountBoundary: vi.fn(),
    getAccountBoundaryEpoch: vi.fn(),
    isSuspendedForAccountBoundary: vi.fn(),
    discardSuspendedActionsForAccountBoundary: vi.fn(),
    resumeAfterAccountBoundary: vi.fn(),
    hasPendingJournalSecurityMigrationForOwner: vi.fn(),
    getPendingJournalSecurityMigrationRevisionForOwner: vi.fn(),
    clearNativeJournalBiometricCredential: vi.fn(),
    clearAccountDeviceSurfaces: vi.fn(),
    clearAccountNotificationsForBoundary: vi.fn(),
    resumeAccountNotifications: vi.fn(),
    leavePresenceForAccountBoundary: vi.fn(),
    resetAuthState: vi.fn(),
    setAuthGateChecked: vi.fn(),
    readVerifiedSettingsOwnerRealm: vi.fn(),
    assertSettingsOwnerCurrent: vi.fn(),
    suspendAccountBoundaryWriters: vi.fn(),
    resumeAccountBoundaryWriters: vi.fn(),
    getAccountBoundaryWritersEpoch: vi.fn(),
    areAccountBoundaryWritersSuspended: vi.fn(),
    boundaryState: {
      cloudEpoch: 0,
      cloudSuspended: false,
      queueEpoch: 0,
      queueSuspended: false,
      writerEpoch: 0,
      writersSuspended: false,
    },
  },
}));

vi.mock("@/lib/platform", () => ({
  get isNative() {
    return mocks.platform.isNative;
  },
  get isAndroid() {
    return mocks.platform.isAndroid;
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
      signOut: vi.fn(),
    },
  },
  getCurrentSessionUserId: mocks.getCurrentSessionUserId,
  getVerifiedCurrentSessionUserId: mocks.getCurrentSessionUserId,
}));

vi.mock("@/lib/ownerBoundAuthSession", () => ({
  signOutExpectedOwnerLocally: mocks.signOutExpectedOwnerLocally,
}));

vi.mock("@/lib/nativeOAuthBrowser", () => ({
  openOAuthUrl: mocks.openOAuthUrl,
}));

vi.mock("@/lib/authTransitionCoordinator", async () => {
  const actual = await vi.importActual<typeof import("@/lib/authTransitionCoordinator")>(
    "@/lib/authTransitionCoordinator",
  );
  return {
    ...actual,
    cancelPkceAttemptFromUrl: mocks.cancelPkceAttemptFromUrl,
  };
});

vi.mock("@/lib/nativeGoogleAuth", () => ({
  authenticateWithGoogleNative: mocks.authenticateWithGoogleNative,
}));

vi.mock("@/lib/pushNotifications", () => ({
  removePushToken: mocks.removePushToken,
  revokePushForAccountBoundary: mocks.removePushToken,
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

vi.mock("@/lib/presenceService", () => ({
  leavePresenceForAccountBoundary: mocks.leavePresenceForAccountBoundary,
}));

vi.mock("@/features/journal", () => ({
  hasPendingJournalSecurityMigrationForOwner:
    mocks.hasPendingJournalSecurityMigrationForOwner,
  getPendingJournalSecurityMigrationRevisionForOwner:
    mocks.getPendingJournalSecurityMigrationRevisionForOwner,
}));

vi.mock("@/lib/offlineQueue", () => ({
  offlineQueue: {
    processQueue: mocks.processQueue,
    hasPendingActions: mocks.hasPendingActions,
    hasPendingActionsForOwner: mocks.hasPendingActionsForOwner,
    hasPendingActionsForOwnerReady: async (ownerUserId: string) =>
      mocks.hasPendingActionsForOwner(ownerUserId),
    suspendForAccountBoundary: mocks.suspendForAccountBoundary,
    getAccountBoundaryEpoch: mocks.getAccountBoundaryEpoch,
    isSuspendedForAccountBoundary: mocks.isSuspendedForAccountBoundary,
    discardSuspendedActionsForAccountBoundary:
      mocks.discardSuspendedActionsForAccountBoundary,
    resumeAfterAccountBoundary: mocks.resumeAfterAccountBoundary,
  },
}));

vi.mock("@/storage/cloudSync", () => ({
  stopAutoSync: mocks.stopAutoSync,
  startAutoSync: mocks.startAutoSync,
  quiesceCloudSync: mocks.quiesceCloudSync,
  getCloudSyncAccountBoundaryEpoch: mocks.getCloudSyncAccountBoundaryEpoch,
  isCloudSyncSuspendedForAccountBoundary:
    mocks.isCloudSyncSuspendedForAccountBoundary,
  resumeCloudSync: mocks.resumeCloudSync,
}));

vi.mock("@/lib/accountBoundaryState", () => ({
  suspendAccountBoundaryWriters: mocks.suspendAccountBoundaryWriters,
  resumeAccountBoundaryWriters: mocks.resumeAccountBoundaryWriters,
  getAccountBoundaryWritersEpoch: mocks.getAccountBoundaryWritersEpoch,
  areAccountBoundaryWritersSuspended: mocks.areAccountBoundaryWritersSuspended,
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
  runWithSettledDataRead: mocks.runWithSettledDataRead,
  isDataWriteBarrierPostCommitError: () => false,
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

vi.mock("@/lib/settingsOwnerBoundary", () => ({
  SettingsOwnerBoundaryError: class SettingsOwnerBoundaryError extends Error {},
  readVerifiedSettingsOwnerRealm: mocks.readVerifiedSettingsOwnerRealm,
  assertSettingsOwnerCurrent: mocks.assertSettingsOwnerCurrent,
}));

import { useAccountAuth } from "@/components/settings/account-section/useAccountAuth";
import {
  clearAccountCleanupRecovery,
  getAccountCleanupRecovery,
  publishAccountCleanupRecovery,
} from "@/lib/accountCleanupRecoveryState";
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

function createSession(userId = TEST_USER_ID): Session {
  return {
    access_token: "",
    refresh_token: "",
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: userId,
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
    mocks.platform.isNative = true;
    mocks.platform.isAndroid = false;
    clearAccountCleanupRecovery();
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
    mocks.cancelPkceAttemptFromUrl.mockResolvedValue(true);
    mocks.hasPendingActions.mockReturnValue(false);
    mocks.hasPendingActionsForOwner.mockReturnValue(false);
    mocks.getCurrentSessionUserId.mockResolvedValue(TEST_USER_ID);
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
    mocks.runWithDataWriteBarrier.mockImplementation(async (mutation) => {
      const result = await mutation();
      await mocks.triggerDataRefresh();
      return result;
    });
    mocks.runWithSettledDataRead.mockImplementation(async (operation) => operation());
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
    mocks.discardSuspendedActionsForAccountBoundary.mockResolvedValue({
      status: "discarded",
    });
    mocks.hasPendingJournalSecurityMigrationForOwner.mockResolvedValue(false);
    mocks.getPendingJournalSecurityMigrationRevisionForOwner.mockResolvedValue(null);
    mocks.clearNativeJournalBiometricCredential.mockResolvedValue("removed");
    mocks.clearAccountDeviceSurfaces.mockResolvedValue(undefined);
    mocks.clearAccountNotificationsForBoundary.mockResolvedValue(undefined);
    mocks.leavePresenceForAccountBoundary.mockResolvedValue({ status: "removed" });
    mocks.signOutExpectedOwnerLocally.mockImplementation(async () => {
      mocks.getCurrentSessionUserId.mockResolvedValue(null);
      return { status: "signed-out" as const };
    });
    mocks.removePushToken.mockResolvedValue({
      status: "revoked",
      remote: "deleted",
      native: "unregistered",
    });
    mocks.initializePushNotifications.mockResolvedValue(undefined);
    mocks.clearLocalUserData.mockResolvedValue(undefined);
    mocks.getLocalDataOwnerId.mockResolvedValue(TEST_USER_ID);
    mocks.triggerDataRefresh.mockResolvedValue(undefined);
    mocks.processQueue.mockResolvedValue(undefined);
    mocks.readVerifiedSettingsOwnerRealm.mockResolvedValue({
      kind: "local",
      ownerUserId: null,
      generation: "signed-out-generation",
    });
    mocks.assertSettingsOwnerCurrent.mockResolvedValue(undefined);
    localStorage.removeItem("zenflow_pending_account_sign_out_cleanup");
  });

  it("does not expose unsafe current-session identity linking from Settings", () => {
    const { result } = renderAccountAuth();

    expect(result.current).not.toHaveProperty("handleLinkProvider");
    expect(result.current).not.toHaveProperty("linkingProvider");
    expect(mocks.linkIdentity).not.toHaveBeenCalled();
  });

  it("starts native OAuth with one opaque attempt owner on the configured callback", async () => {
    vi.useFakeTimers();
    try {
      mocks.signInWithOAuth.mockResolvedValueOnce({
        data: { url: "https://oauth.telegram.org/auth" },
        error: null,
      });
      const { result } = renderAccountAuth();

      await act(async () => {
        await result.current.handleProvider("telegram");
      });

      expect(mocks.signInWithOAuth).toHaveBeenCalledTimes(1);
      const credentials = mocks.signInWithOAuth.mock.calls[0]?.[0] as {
        options?: { redirectTo?: string; skipBrowserRedirect?: boolean };
      };
      const redirect = new URL(credentials.options?.redirectTo || "");
      expect(redirect.protocol).toBe("com.zenflow.app:");
      expect(redirect.hostname).toBe("login-callback");
      expect(redirect.searchParams.get("zenflowAuthAttempt")).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(credentials.options?.skipBrowserRedirect).toBe(true);
      expect(mocks.openOAuthUrl).toHaveBeenCalledWith("https://oauth.telegram.org/auth");
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      expect(mocks.cancelPkceAttemptFromUrl).not.toHaveBeenCalled();
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("uses the owner-bound OAuth callback for Google on iOS instead of the Android native picker", async () => {
    vi.useFakeTimers();
    try {
      mocks.signInWithOAuth.mockResolvedValueOnce({
        data: { url: "https://accounts.google.com/o/oauth2/v2/auth" },
        error: null,
      });
      const { result } = renderAccountAuth();

      await act(async () => {
        await result.current.handleProvider("google");
      });

      expect(mocks.authenticateWithGoogleNative).not.toHaveBeenCalled();
      expect(mocks.signInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({ provider: "google" }),
      );
      const credentials = mocks.signInWithOAuth.mock.calls[0]?.[0] as {
        options?: { redirectTo?: string; skipBrowserRedirect?: boolean };
      };
      const redirect = new URL(credentials.options?.redirectTo || "");
      expect(redirect.protocol).toBe("com.zenflow.app:");
      expect(redirect.hostname).toBe("login-callback");
      expect(credentials.options?.skipBrowserRedirect).toBe(true);
      expect(mocks.openOAuthUrl).toHaveBeenCalledWith(
        "https://accounts.google.com/o/oauth2/v2/auth",
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("preserves the native Google picker in Settings on Android", async () => {
    mocks.platform.isAndroid = true;
    mocks.authenticateWithGoogleNative.mockResolvedValueOnce({ success: true });
    const { result } = renderAccountAuth();

    await act(async () => {
      await result.current.handleProvider("google");
    });

    expect(mocks.authenticateWithGoogleNative).toHaveBeenCalledTimes(1);
    expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
    expect(mocks.openOAuthUrl).not.toHaveBeenCalled();
  });

  it("cancels the exact settings attempt when no provider navigation can start", async () => {
    mocks.signInWithOAuth.mockResolvedValueOnce({ data: {}, error: null });
    const { result } = renderAccountAuth();

    await act(async () => {
      await result.current.handleProvider("telegram");
    });

    expect(mocks.openOAuthUrl).not.toHaveBeenCalled();
    expect(mocks.cancelPkceAttemptFromUrl).toHaveBeenCalledTimes(1);
    const attemptUrl = mocks.cancelPkceAttemptFromUrl.mock.calls[0]?.[1] as string;
    expect(new URL(attemptUrl).searchParams.get("zenflowAuthAttempt")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(result.current.authStatus).toBe(t.authUnexpectedError);
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
    expect(mocks.signOutExpectedOwnerLocally).toHaveBeenCalledWith(TEST_USER_ID);
    expect(mocks.signOutExpectedOwnerLocally.mock.invocationCallOrder[0]).toBeLessThan(
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
    expect(onNameChange).not.toHaveBeenCalled();
    expect(mocks.resetAuthState.mock.invocationCallOrder[0]).toBeGreaterThan(
      mocks.signOutExpectedOwnerLocally.mock.invocationCallOrder[0]
    );
    expect(mocks.setAuthGateChecked.mock.invocationCallOrder[0]).toBeGreaterThan(
      mocks.signOutExpectedOwnerLocally.mock.invocationCallOrder[0]
    );
  });

  it("does not write a new default profile after the durable account cleanup", async () => {
    const onNameChange = vi.fn();
    const { result } = renderAccountAuth(onNameChange);
    await waitFor(() => expect(result.current.hasSession).toBe(true));

    await act(async () => {
      await result.current.handleSignOut();
    });

    expect(onNameChange).not.toHaveBeenCalled();
    expect(result.current.authStatus).toBe(t.authSignedOut);
  });

  it("does not finalize owner A sign-out UI after owner B has already claimed the realm", async () => {
    const onNameChange = vi.fn();
    mocks.readVerifiedSettingsOwnerRealm.mockResolvedValueOnce({
      kind: "account",
      ownerUserId: "33333333-3333-4333-8333-333333333333",
      generation: "owner-b-generation",
    });
    const { result } = renderAccountAuth(onNameChange);
    await waitFor(() => expect(result.current.hasSession).toBe(true));

    await act(async () => {
      await result.current.handleSignOut();
    });

    expect(mocks.signOutExpectedOwnerLocally).toHaveBeenCalledWith(TEST_USER_ID);
    expect(mocks.resetAuthState).not.toHaveBeenCalled();
    expect(mocks.setAuthGateChecked).not.toHaveBeenCalled();
    expect(onNameChange).not.toHaveBeenCalled();
    expect(result.current.authStatus).not.toBe(t.authSignedOut);
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
    expect(mocks.signOutExpectedOwnerLocally).not.toHaveBeenCalled();
    expect(mocks.resetAuthState).not.toHaveBeenCalled();
  });

  it("does not publish pending-change status into a later same-ID lifecycle", async () => {
    const generationKey = "zenflow_account_boundary_generation";
    localStorage.setItem(generationKey, JSON.stringify("pending-lifecycle-1"));
    mocks.hasPendingActionsForOwner.mockImplementation(() => {
      localStorage.setItem(generationKey, JSON.stringify("pending-lifecycle-2"));
      return true;
    });
    const { result } = renderAccountAuth();

    await act(async () => {
      await result.current.handleSignOut();
    });

    expect(result.current.signOutBlockReason).toBeNull();
    expect(result.current.authStatus).not.toBe(t.authSignOutPendingChanges);
  });

  it("discards pending work only through the explicit discard-and-sign-out action", async () => {
    mocks.hasPendingActionsForOwner.mockReturnValue(true);
    const { result } = renderAccountAuth();

    await act(async () => {
      await result.current.handleSignOut();
    });

    expect(mocks.discardSuspendedActionsForAccountBoundary).not.toHaveBeenCalled();
    expect(mocks.signOutExpectedOwnerLocally).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.handleDiscardPendingAndSignOut();
    });

    expect(mocks.signOutExpectedOwnerLocally).toHaveBeenCalledWith(TEST_USER_ID);
    expect(mocks.discardSuspendedActionsForAccountBoundary).toHaveBeenCalledTimes(3);
    expect(mocks.discardSuspendedActionsForAccountBoundary).toHaveBeenNthCalledWith(1, {
      onlyIfEmpty: false,
    });
    expect(mocks.discardSuspendedActionsForAccountBoundary).toHaveBeenNthCalledWith(2, {
      onlyIfEmpty: true,
    });
    expect(mocks.discardSuspendedActionsForAccountBoundary).toHaveBeenNthCalledWith(3, {
      onlyIfEmpty: true,
    });
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
      mocks.boundaryState.queueEpoch += 1;
      mocks.boundaryState.queueSuspended = true;
      mocks.hasPendingActionsForOwner.mockReturnValue(true);
    });
    const { result } = renderAccountAuth();

    await act(async () => {
      await result.current.handleSignOut();
    });

    expect(result.current.authStatus).toBe(t.authSignOutPendingChanges);
    expect(mocks.discardSuspendedActionsForAccountBoundary).not.toHaveBeenCalled();
    expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
    expect(mocks.signOutExpectedOwnerLocally).not.toHaveBeenCalled();
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
    expect(mocks.signOutExpectedOwnerLocally).toHaveBeenCalledWith(TEST_USER_ID);
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
    expect(mocks.signOutExpectedOwnerLocally).not.toHaveBeenCalled();
  });

  it("keeps generic recovery visible when an interrupted cleanup owner cannot be rechecked", async () => {
    let retry: (() => void | Promise<void>) | undefined;
    const captureRetry = (event: Event) => {
      retry = (
        event as CustomEvent<{ retry?: () => void | Promise<void> }>
      ).detail?.retry;
    };
    window.addEventListener("zenflow:account-cleanup-blocked", captureRetry);
    mocks.removePushToken.mockResolvedValueOnce({
      status: "partial",
      remote: "failed",
      native: "unregistered",
    });
    const { result } = renderAccountAuth();

    try {
      await waitFor(() => expect(result.current.hasSession).toBe(true));
      mocks.getCurrentSessionUserId.mockRejectedValueOnce(
        new Error("session verification unavailable")
      );
      await act(async () => {
        await result.current.handleSignOut();
      });

      expect(result.current.signOutBlockReason).toBe("cleanup-failed");
      expect(result.current.authStatus).toBe(t.authSignOutCleanupFailed);
      expect(retry).toBeTypeOf("function");
    } finally {
      window.removeEventListener("zenflow:account-cleanup-blocked", captureRetry);
    }
  });

  it("keeps cleanup recovery visible while a retry is still running", async () => {
    mocks.removePushToken.mockResolvedValueOnce({
      status: "partial",
      remote: "failed",
      native: "unregistered",
    });
    const { result } = renderAccountAuth();

    await act(async () => {
      await result.current.handleSignOut();
    });
    expect(result.current.signOutBlockReason).toBe("cleanup-failed");

    let resolveRetryCleanup!: (value: {
      status: "complete";
      remote: "removed";
      native: "unregistered";
    }) => void;
    const retryCleanup = new Promise<{
      status: "complete";
      remote: "removed";
      native: "unregistered";
    }>((resolve) => {
      resolveRetryCleanup = resolve;
    });
    mocks.removePushToken.mockImplementationOnce(() => retryCleanup);

    let retryPromise!: Promise<void>;
    act(() => {
      retryPromise = result.current.handleSignOut();
    });

    await waitFor(() => expect(result.current.isSigningOut).toBe(true));
    expect(result.current.signOutBlockReason).toBe("cleanup-failed");
    expect(result.current.authStatus).toBe(t.authSignOutCleanupFailed);

    await act(async () => {
      resolveRetryCleanup({
        status: "complete",
        remote: "removed",
        native: "unregistered",
      });
      await retryPromise;
    });
  });

  it("restores shared cleanup recovery after the Settings hook remounts", async () => {
    const retry = vi.fn(() => Promise.resolve());
    publishAccountCleanupRecovery(retry);

    const first = renderAccountAuth();
    await waitFor(() =>
      expect(first.result.current.signOutBlockReason).toBe("cleanup-failed"),
    );
    first.unmount();

    const second = renderAccountAuth();
    await waitFor(() =>
      expect(second.result.current.signOutBlockReason).toBe("cleanup-failed"),
    );

    await act(async () => {
      await second.result.current.handleAccountCleanupRetry();
    });

    expect(retry).toHaveBeenCalledTimes(1);
    expect(second.result.current.signOutBlockReason).toBeNull();
  });

  it("keeps cleanup recovery visible when a shared retry rejects", async () => {
    const retry = vi.fn(() => Promise.reject(new Error("cleanup still blocked")));
    publishAccountCleanupRecovery(retry);
    const { result } = renderAccountAuth();
    await waitFor(() =>
      expect(result.current.signOutBlockReason).toBe("cleanup-failed"),
    );

    await act(async () => {
      await expect(result.current.handleAccountCleanupRetry()).resolves.toBeUndefined();
    });

    expect(retry).toHaveBeenCalledTimes(1);
    expect(result.current.signOutBlockReason).toBe("cleanup-failed");
    expect(result.current.authStatus).toBe(t.authSignOutCleanupFailed);
    expect(getAccountCleanupRecovery()).not.toBeNull();
  });

  it("keeps a failed owner-A cleanup retry from targeting a later owner-B session", async () => {
    let retry: (() => void | Promise<void>) | undefined;
    const captureRetry = (event: Event) => {
      retry = (
        event as CustomEvent<{ retry?: () => void | Promise<void> }>
      ).detail?.retry;
    };
    window.addEventListener("zenflow:account-cleanup-blocked", captureRetry);
    mocks.removePushToken.mockResolvedValueOnce({
      status: "partial",
      remote: "failed",
      native: "unregistered",
    });
    const { result } = renderAccountAuth();

    try {
      await act(async () => {
        await result.current.handleSignOut();
      });
      expect(retry).toBeTypeOf("function");

      const ownerB = "33333333-3333-4333-8333-333333333333";
      const ownerBSession = createSession(ownerB);
      mocks.getSession.mockResolvedValue({
        data: { session: ownerBSession },
        error: null,
      });
      mocks.getLocalDataOwnerId.mockResolvedValue(ownerB);
      act(() => {
        authStateCallbacks[0]?.("SIGNED_IN", ownerBSession);
      });
      await act(async () => {
        await retry?.();
      });

      expect(mocks.removePushToken).toHaveBeenCalledTimes(1);
      expect(mocks.discardSuspendedActionsForAccountBoundary).not.toHaveBeenCalled();
      expect(mocks.signOutExpectedOwnerLocally).not.toHaveBeenCalled();
      expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("zenflow:account-cleanup-blocked", captureRetry);
    }
  });

  it("does not publish a stale cleanup retry for a later lifecycle of the same owner ID", async () => {
    const generationKey = "zenflow_account_boundary_generation";
    localStorage.setItem(generationKey, JSON.stringify("account-a-lifecycle-1"));
    let retry: (() => void) | undefined;
    const captureRetry = (event: Event) => {
      retry = (event as CustomEvent<{ retry?: () => void }>).detail?.retry;
    };
    window.addEventListener("zenflow:account-cleanup-blocked", captureRetry);
    mocks.removePushToken.mockImplementationOnce(async () => {
      localStorage.setItem(generationKey, JSON.stringify("account-a-lifecycle-2"));
      return {
        status: "partial",
        remote: "failed",
        native: "unregistered",
      } as const;
    });
    const { result } = renderAccountAuth();

    try {
      await act(async () => {
        await result.current.handleSignOut();
      });

      expect(retry).toBeUndefined();
      expect(result.current.signOutBlockReason).toBeNull();
      expect(result.current.authStatus).not.toBe(t.authSignOutCleanupFailed);
    } finally {
      window.removeEventListener("zenflow:account-cleanup-blocked", captureRetry);
    }
  });

  it("reports incomplete cleanup after sign-out without resuming the expired account runtime", async () => {
    mocks.clearLocalUserData.mockRejectedValueOnce(new Error("purge failed"));
    const { result } = renderAccountAuth();

    await act(async () => {
      await result.current.handleSignOut();
    });

    expect(result.current.authStatus).toBe(t.authSignOutCleanupFailed);
    expect(mocks.signOutExpectedOwnerLocally).toHaveBeenCalledWith(TEST_USER_ID);
    expect(mocks.resetAuthState).not.toHaveBeenCalled();
    expect(mocks.setAuthGateChecked).not.toHaveBeenCalled();
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

    expect(mocks.signOutExpectedOwnerLocally).toHaveBeenCalledTimes(1);
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
    expect(mocks.signOutExpectedOwnerLocally).toHaveBeenCalledWith(TEST_USER_ID);
    expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
    expect(mocks.clearDeviceIdCache).not.toHaveBeenCalled();
    expect(mocks.resetAuthState).not.toHaveBeenCalled();
    expect(mocks.resumeCloudSync).not.toHaveBeenCalled();
    expect(mocks.startAutoSync).not.toHaveBeenCalled();
    expect(mocks.resumeAfterAccountBoundary).not.toHaveBeenCalled();
  });

  it("does not let owner-A cleanup failure clear owner-B auth state after B signs in", async () => {
    const ownerB = "33333333-3333-4333-8333-333333333333";
    const ownerBSession = createSession(ownerB);
    mocks.clearLocalUserData.mockImplementationOnce(async () => {
      mocks.getSession.mockResolvedValue({
        data: { session: ownerBSession },
        error: null,
      });
      mocks.getCurrentSessionUserId.mockResolvedValue(ownerB);
      authStateCallbacks[0]?.("SIGNED_IN", ownerBSession);
      throw new Error("owner A purge failed after sign-out");
    });
    const { result } = renderAccountAuth();
    await waitFor(() => expect(result.current.hasSession).toBe(true));

    await act(async () => {
      await result.current.handleSignOut();
    });

    expect(result.current.sessionUser?.id).toBe(ownerB);
    expect(mocks.resetAuthState).not.toHaveBeenCalled();
    expect(mocks.setAuthGateChecked).not.toHaveBeenCalled();
    expect(result.current.authStatus).not.toBe(t.authSignOutCleanupFailed);
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
    expect(mocks.signOutExpectedOwnerLocally).toHaveBeenCalledWith(TEST_USER_ID);
    expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
    expect(mocks.resetAuthState).not.toHaveBeenCalled();
    expect(mocks.resumeAfterAccountBoundary).not.toHaveBeenCalled();
  });

  it("does not report signed out when owner-qualified local sign-out fails", async () => {
    mocks.signOutExpectedOwnerLocally.mockRejectedValueOnce(
      new Error("network unavailable"),
    );
    const { result } = renderAccountAuth();

    await act(async () => {
      await result.current.handleSignOut();
    });

    expect(result.current.authStatus).toBe(t.authSignOutFailed);
    expect(mocks.resetAuthState).not.toHaveBeenCalled();
    expect(mocks.setAuthGateChecked).not.toHaveBeenCalled();
    expect(mocks.clearLocalUserData).not.toHaveBeenCalled();
    expect(mocks.discardSuspendedActionsForAccountBoundary).toHaveBeenCalledTimes(1);
    expect(mocks.discardSuspendedActionsForAccountBoundary).toHaveBeenCalledWith({
      onlyIfEmpty: true,
    });
    expect(mocks.clearAccountNotificationsForBoundary).not.toHaveBeenCalled();
    expect(mocks.clearNativeJournalBiometricCredential).not.toHaveBeenCalled();
    expect(mocks.clearAccountDeviceSurfaces).not.toHaveBeenCalled();
    expect(mocks.initializePushNotifications).toHaveBeenCalledTimes(1);
    expect(mocks.resumeCloudSync).toHaveBeenCalledTimes(1);
    expect(mocks.startAutoSync).toHaveBeenCalledTimes(1);
    expect(mocks.resumeAccountNotifications).not.toHaveBeenCalled();
  });

  it("does not publish sign-out failure into a later same-ID lifecycle", async () => {
    const generationKey = "zenflow_account_boundary_generation";
    localStorage.setItem(generationKey, JSON.stringify("failure-lifecycle-1"));
    mocks.signOutExpectedOwnerLocally.mockImplementationOnce(async () => {
      localStorage.setItem(generationKey, JSON.stringify("failure-lifecycle-2"));
      throw new Error("old lifecycle auth storage failed");
    });
    const { result } = renderAccountAuth();

    await act(async () => {
      await result.current.handleSignOut();
    });

    expect(result.current.signOutBlockReason).toBeNull();
    expect(result.current.authStatus).not.toBe(t.authSignOutFailed);
  });
});
