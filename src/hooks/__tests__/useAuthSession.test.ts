/**
 * useAuthSession Hook Tests
 * Tests Supabase auth session lifecycle management.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authStateCallbacks,
  mockExchangeCodeForSession,
  mockGetSession,
  mockOnAuthStateChange,
  mockSetSession,
  mockAuthSignOut,
  mockSyncWithCloud,
  mockStartAutoSync,
  mockStopAutoSync,
  mockQuiesceCloudSync,
  mockResumeCloudSync,
  mockClearLocalUserData,
  mockGetLocalDataOwnerId,
  mockSetLocalDataOwnerId,
  mockTriggerDataRefresh,
  mockRunWithDataWriteBarrier,
  mockClearDeviceIdCache,
  mockClearJournalContentSession,
  mockPullPreferences,
  mockJoinPresence,
  mockLeavePresence,
  mockMigrateExistingUser,
  mockResetSessionExpired,
  mockProfileUpdate,
  mockCloseOAuthBrowser,
  mockIsNative,
  mockRevokePushForAccountBoundary,
  mockClearNativeJournalBiometricCredential,
  mockClearAccountDeviceSurfaces,
  mockClearAccountNotificationsForBoundary,
  mockHasPendingJournalSecurityMigrationForOwner,
  mockReconcilePendingAccountSignOutCleanup,
} = vi.hoisted(() => {
  const authStateCallbacks: Array<(event: string, session: unknown) => void> = [];
  const mockExchangeCodeForSession = vi.fn();
  const mockGetSession = vi.fn();
  const mockOnAuthStateChange = vi.fn((callback: (event: string, session: unknown) => void) => {
    authStateCallbacks.push(callback);
    return {
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    };
  });
  const mockProfileEq = vi.fn(() => Promise.resolve({ error: null }));
  const mockProfileUpdate = vi.fn(() => ({ eq: mockProfileEq }));
  const mockSetSession = vi.fn();
  const mockAuthSignOut = vi.fn(
    (): Promise<{ error: { message: string } | null }> => Promise.resolve({ error: null }),
  );
  const mockCloseOAuthBrowser = vi.fn(() => Promise.resolve());

  return {
    authStateCallbacks,
    mockExchangeCodeForSession,
    mockGetSession,
    mockOnAuthStateChange,
    mockSetSession,
    mockAuthSignOut,
    mockSyncWithCloud: vi.fn(() => Promise.resolve()),
    mockStartAutoSync: vi.fn(),
    mockStopAutoSync: vi.fn(),
    mockQuiesceCloudSync: vi.fn(() => Promise.resolve()),
    mockResumeCloudSync: vi.fn(),
    mockClearLocalUserData: vi.fn(() => Promise.resolve()),
    mockGetLocalDataOwnerId: vi.fn(() => Promise.resolve(null)),
    mockSetLocalDataOwnerId: vi.fn(() => Promise.resolve()),
    mockTriggerDataRefresh: vi.fn(() => Promise.resolve()),
    mockRunWithDataWriteBarrier: vi.fn(async (mutation: () => Promise<unknown>) => {
      const result = await mutation();
      await mockTriggerDataRefresh();
      return result;
    }),
    mockClearDeviceIdCache: vi.fn(),
    mockClearJournalContentSession: vi.fn(),
    mockPullPreferences: vi.fn(() => Promise.resolve()),
    mockJoinPresence: vi.fn(() => Promise.resolve()),
    mockLeavePresence: vi.fn(() => Promise.resolve()),
    mockMigrateExistingUser: vi.fn(),
    mockResetSessionExpired: vi.fn(),
    mockProfileUpdate,
    mockCloseOAuthBrowser,
    mockIsNative: { value: false },
    mockRevokePushForAccountBoundary: vi.fn(() =>
      Promise.resolve({ status: "revoked", remote: "deleted", native: "unregistered" }),
    ),
    mockClearNativeJournalBiometricCredential: vi.fn(() => Promise.resolve("removed")),
    mockClearAccountDeviceSurfaces: vi.fn(() => Promise.resolve()),
    mockClearAccountNotificationsForBoundary: vi.fn(() => Promise.resolve()),
    mockHasPendingJournalSecurityMigrationForOwner: vi.fn(() => Promise.resolve(false)),
    mockReconcilePendingAccountSignOutCleanup: vi.fn<
      () => Promise<{
        status: "none" | "completed" | "cancelled" | "blocked";
      }>
    >(() => Promise.resolve({ status: "none" })),
  };
});

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      setSession: mockSetSession,
      signOut: mockAuthSignOut,
    },
    from: vi.fn(() => ({
      update: mockProfileUpdate,
    })),
  },
}));

vi.mock("@/lib/platform", () => ({
  get isNative() {
    return mockIsNative.value;
  },
}));

vi.mock("@/storage/cloudSync", () => ({
  syncWithCloud: mockSyncWithCloud,
  startAutoSync: mockStartAutoSync,
  stopAutoSync: mockStopAutoSync,
  quiesceCloudSync: mockQuiesceCloudSync,
  resumeCloudSync: mockResumeCloudSync,
}));

vi.mock("@/storage/db", () => ({
  clearLocalUserData: mockClearLocalUserData,
  getLocalDataOwnerId: mockGetLocalDataOwnerId,
  setLocalDataOwnerId: mockSetLocalDataOwnerId,
}));

vi.mock("@/hooks/useIndexedDB", () => ({
  triggerDataRefresh: mockTriggerDataRefresh,
  runWithDataWriteBarrier: mockRunWithDataWriteBarrier,
}));

vi.mock("@/storage/eventSync", () => ({
  clearDeviceIdCache: mockClearDeviceIdCache,
}));

vi.mock("@/lib/journalContentSession", () => ({
  clearJournalContentSession: mockClearJournalContentSession,
}));

vi.mock("@/storage/preferenceSync", () => ({
  pullPreferences: mockPullPreferences,
}));

vi.mock("@/lib/presenceService", () => ({
  joinPresence: mockJoinPresence,
  leavePresence: mockLeavePresence,
}));

vi.mock("@/lib/cloudSyncSettings", () => ({
  migrateExistingUser: mockMigrateExistingUser,
}));

vi.mock("@/lib/syncOrchestrator", () => ({
  syncOrchestrator: {
    resetSessionExpired: mockResetSessionExpired,
  },
}));

vi.mock("@/lib/nativeOAuthBrowser", () => ({
  closeOAuthBrowser: mockCloseOAuthBrowser,
}));

vi.mock("@/lib/pushNotifications", () => ({
  revokePushForAccountBoundary: mockRevokePushForAccountBoundary,
}));

vi.mock("@/lib/journalBiometricCredentials", () => ({
  clearNativeJournalBiometricCredential: mockClearNativeJournalBiometricCredential,
}));

vi.mock("@/lib/accountDeviceCleanup", () => ({
  clearAccountDeviceSurfaces: mockClearAccountDeviceSurfaces,
}));

vi.mock("@/lib/localNotifications", () => ({
  clearAccountNotificationsForBoundary: mockClearAccountNotificationsForBoundary,
}));

vi.mock("@/features/journal", () => ({
  hasPendingJournalSecurityMigrationForOwner:
    mockHasPendingJournalSecurityMigrationForOwner,
}));

vi.mock("@/lib/accountSignOutCleanup", () => ({
  reconcilePendingAccountSignOutCleanup:
    mockReconcilePendingAccountSignOutCleanup,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { useAuthSession } from "@/hooks/useAuthSession";
import { hasPendingAuthUrl, setPendingAuthUrl } from "@/lib/authRedirect";
import { SK } from "@/lib/storageKeys";
import { useAppStore, useUserDataStore } from "@/stores";
import { isAuthFlowInProgress, resetAuthGuard, startAuthFlow } from "@/lib/authGuard";
import { AUTH_SESSION_EXPIRED_EVENT } from "@/lib/apiClient";
import { AUTH_ACCOUNT_SWITCH_PENDING_WRITES_ERROR } from "@/lib/authErrors";
import { logger } from "@/lib/logger";
import { offlineQueue } from "@/lib/offlineQueue";

const telegramSession = {
  user: {
    id: "123e4567-e89b-12d3-a456-426614174000",
    email: null,
    phone: null,
    app_metadata: { provider: "custom:telegram" },
    user_metadata: {
      full_name: "Telegram Friend",
      preferred_username: "zen_friend",
    },
    identities: [{ provider: "custom:telegram" }],
    created_at: "2026-06-21T00:00:00.000Z",
  },
};

const secondTelegramSession = {
  user: {
    ...telegramSession.user,
    id: "223e4567-e89b-12d3-a456-426614174000",
    user_metadata: {
      full_name: "Second Telegram Friend",
      preferred_username: "second_friend",
    },
  },
};

function usePlainAuthRoute() {
  window.history.pushState({}, "", "/orb?nav=v2&navLayout=phone");
}

function emitAuthEvent(event: string, session: unknown) {
  act(() => {
    for (const callback of authStateCallbacks) {
      callback(event, session);
    }
  });
}

function resetStores() {
  useAppStore.setState({
    activeTab: "home",
    settingsOpenSection: undefined,
    initializationState: { isInitializing: false, error: null, wasUpdated: false },
    loadingFadeOut: false,
    currentDate: "2026-06-21",
    authBypassFlag: false,
    isProcessingWebOAuth: false,
    webOAuthError: null,
    hasValidSession: false,
    isAccountBoundaryInProgress: false,
    onboardingBypassFlag: false,
  });
  useUserDataStore.setState({
    userName: "Friend",
    userNameCustom: false,
    authGateChecked: false,
    googleAuthChecked: false,
    isLoading: false,
  });
}

describe("useAuthSession", () => {
  beforeEach(() => {
    window.history.pushState(
      {},
      "",
      "/orb?nav=v2&navLayout=phone&code=telegram-code&state=telegram-state"
    );
    authStateCallbacks.length = 0;
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockExchangeCodeForSession.mockResolvedValue({
      data: { session: telegramSession },
      error: null,
    });
    mockIsNative.value = false;
    mockQuiesceCloudSync.mockResolvedValue(undefined);
    mockClearLocalUserData.mockResolvedValue(undefined);
    mockGetLocalDataOwnerId.mockResolvedValue(null);
    mockSetLocalDataOwnerId.mockResolvedValue(undefined);
    mockTriggerDataRefresh.mockResolvedValue(undefined);
    mockAuthSignOut.mockResolvedValue({ error: null });
    mockRevokePushForAccountBoundary.mockResolvedValue({
      status: "revoked",
      remote: "deleted",
      native: "unregistered",
    });
    mockClearNativeJournalBiometricCredential.mockResolvedValue("removed");
    mockClearAccountDeviceSurfaces.mockResolvedValue(undefined);
    mockClearAccountNotificationsForBoundary.mockResolvedValue(undefined);
    mockHasPendingJournalSecurityMigrationForOwner.mockResolvedValue(false);
    mockReconcilePendingAccountSignOutCleanup.mockResolvedValue({ status: "none" });
    setPendingAuthUrl(null);
    localStorage.removeItem(SK.JOURNAL_PASSWORD_RESET_PROOF);
    resetStores();
    resetAuthGuard();
  });

  describe("web OAuth callback", () => {
    it("completes the app auth gate when Supabase emits SIGNED_IN for a Telegram callback", async () => {
      startAuthFlow();
      expect(isAuthFlowInProgress()).toBe(true);

      renderHook(() => useAuthSession(false));

      await waitFor(() => expect(useAppStore.getState().isProcessingWebOAuth).toBe(true));

      act(() => {
        for (const callback of authStateCallbacks) {
          callback("SIGNED_IN", telegramSession);
        }
      });

      await waitFor(() => expect(useAppStore.getState().isProcessingWebOAuth).toBe(false));

      expect(window.location.pathname + window.location.search).toBe("/orb?nav=v2&navLayout=phone");
      expect(useAppStore.getState().hasValidSession).toBe(true);
      expect(useAppStore.getState().authBypassFlag).toBe(true);
      expect(useUserDataStore.getState().googleAuthChecked).toBe(true);
      expect(useUserDataStore.getState().userName).toBe("Telegram Friend");
      expect(isAuthFlowInProgress()).toBe(false);
    });

    it("stores journal reset proof before cleaning a successful auth-event callback URL", async () => {
      window.history.pushState(
        {},
        "",
        "/orb?nav=v2&navLayout=phone&code=telegram-code&state=telegram-state&journalReset=event-proof-1",
      );

      renderHook(() => useAuthSession(false));

      await waitFor(() => expect(useAppStore.getState().isProcessingWebOAuth).toBe(true));

      emitAuthEvent("SIGNED_IN", telegramSession);

      await waitFor(() => expect(useAppStore.getState().isProcessingWebOAuth).toBe(false));
      expect(JSON.parse(localStorage.getItem(SK.JOURNAL_PASSWORD_RESET_PROOF) || "{}"))
        .toMatchObject({ nonce: "event-proof-1" });
      expect(window.location.pathname + window.location.search).toBe("/orb?nav=v2&navLayout=phone");
    });

    it("does not store journal reset proof from an existing initial session when callback exchange fails", async () => {
      vi.useFakeTimers();
      try {
        window.history.pushState(
          {},
          "",
          "/orb?nav=v2&navLayout=phone&code=forged-code&state=telegram-state&journalReset=forged-proof-1",
        );
        mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });
        mockExchangeCodeForSession.mockResolvedValue({
          data: { session: null },
          error: { message: "Code expired" },
        });

        renderHook(() => useAuthSession(false));
        emitAuthEvent("INITIAL_SESSION", telegramSession);

        await act(async () => {
          await vi.advanceTimersByTimeAsync(5000);
        });
        await Promise.resolve();

        expect(mockExchangeCodeForSession).toHaveBeenCalledWith("forged-code");
        expect(localStorage.getItem(SK.JOURNAL_PASSWORD_RESET_PROOF)).toBeNull();
        expect(useAppStore.getState().webOAuthError).toBe("Sign-in failed. Please try again.");
        expect(window.location.pathname + window.location.search).toBe("/orb?nav=v2&navLayout=phone");
      } finally {
        vi.useRealTimers();
      }
    });

    it("sanitizes unsafe OAuth error descriptions from web callback URLs", async () => {
      window.history.pushState(
        {},
        "",
        "/orb?nav=v2&navLayout=phone&error=server_error&error_description=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E"
      );

      renderHook(() => useAuthSession(false));

      await waitFor(() =>
        expect(useAppStore.getState().webOAuthError).toBe(
          "Authentication failed. Please try again."
        )
      );
      expect(useAppStore.getState().webOAuthError).not.toContain("<img");
      expect(window.location.pathname + window.location.search).toBe("/orb?nav=v2&navLayout=phone");
    });

    it("handles OAuth errors returned in the URL hash", async () => {
      window.history.pushState(
        {},
        "",
        "/orb?nav=v2&navLayout=phone#error=server_error&error_description=access_denied"
      );

      renderHook(() => useAuthSession(false));

      await waitFor(() => expect(useAppStore.getState().webOAuthError).toBe("access_denied"));
      expect(window.location.pathname + window.location.search + window.location.hash).toBe(
        "/orb?nav=v2&navLayout=phone"
      );
    });

    it("releases auth guard when a web OAuth error callback is received", async () => {
      startAuthFlow();
      expect(isAuthFlowInProgress()).toBe(true);
      window.history.pushState(
        {},
        "",
        "/orb?nav=v2&navLayout=phone&error=access_denied&error_description=access_denied"
      );

      renderHook(() => useAuthSession(false));

      await waitFor(() => expect(useAppStore.getState().webOAuthError).toBe("access_denied"));
      expect(window.location.pathname + window.location.search).toBe("/orb?nav=v2&navLayout=phone");
      expect(isAuthFlowInProgress()).toBe(false);
    });

    it("completes implicit OAuth callbacks returned in the URL hash", async () => {
      const fakeAccessToken = ["test", "public", "oauth", "value"].join(".");
      const fakeRefreshToken = ["test", "public", "refresh", "value"].join(".");
      const callbackHash = new URLSearchParams({
        access_token: fakeAccessToken,
        refresh_token: fakeRefreshToken,
        token_type: "bearer",
        expires_in: "3600",
      }).toString();
      let currentSession: unknown = null;
      mockGetSession.mockImplementation(() =>
        Promise.resolve({ data: { session: currentSession }, error: null })
      );
      mockSetSession.mockImplementation(async () => {
        currentSession = telegramSession;
        return { data: { session: telegramSession }, error: null };
      });

      window.history.pushState({}, "", `/orb?nav=v2&navLayout=phone#${callbackHash}`);

      renderHook(() => useAuthSession(false));

      await waitFor(() =>
        expect(mockSetSession).toHaveBeenCalledWith({
          access_token: fakeAccessToken,
          refresh_token: fakeRefreshToken,
        })
      );
      await waitFor(() => expect(useAppStore.getState().hasValidSession).toBe(true));

      expect(window.location.pathname + window.location.search + window.location.hash).toBe(
        "/orb?nav=v2&navLayout=phone"
      );
      expect(useAppStore.getState().isProcessingWebOAuth).toBe(false);
      expect(useAppStore.getState().authBypassFlag).toBe(true);
      expect(useUserDataStore.getState().googleAuthChecked).toBe(true);
      expect(useUserDataStore.getState().userName).toBe("Telegram Friend");
    });

    it("exchanges a web OAuth code when no Supabase auth event arrives", async () => {
      vi.useFakeTimers();
      try {
        let currentSession: unknown = null;
        mockGetSession.mockImplementation(() =>
          Promise.resolve({ data: { session: currentSession }, error: null })
        );
        mockExchangeCodeForSession.mockImplementation(async () => {
          currentSession = telegramSession;
          return { data: { session: telegramSession }, error: null };
        });

        window.history.pushState(
          {},
          "",
          "/orb?nav=v2&navLayout=phone&code=manual-code&state=telegram-state"
        );

        renderHook(() => useAuthSession(false));

        expect(useAppStore.getState().isProcessingWebOAuth).toBe(true);

        await act(async () => {
          await vi.advanceTimersByTimeAsync(5000);
        });

        expect(mockExchangeCodeForSession).toHaveBeenCalledWith("manual-code");
        expect(useAppStore.getState().hasValidSession).toBe(true);

        expect(window.location.pathname + window.location.search + window.location.hash).toBe(
          "/orb?nav=v2&navLayout=phone"
        );
        expect(useAppStore.getState().isProcessingWebOAuth).toBe(false);
        expect(useAppStore.getState().authBypassFlag).toBe(true);
        expect(useUserDataStore.getState().googleAuthChecked).toBe(true);
        expect(useUserDataStore.getState().userName).toBe("Telegram Friend");
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("session check on mount", () => {
    it("checks Supabase session on mount", async () => {
      usePlainAuthRoute();

      renderHook(() => useAuthSession(false));

      await waitFor(() => expect(mockGetSession).toHaveBeenCalled());
    });

    it("sets hasValidSession to true when session exists", async () => {
      usePlainAuthRoute();
      mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });

      renderHook(() => useAuthSession(false));

      await waitFor(() => expect(useAppStore.getState().hasValidSession).toBe(true));
    });

    it("sets hasValidSession to false when no session", async () => {
      usePlainAuthRoute();
      useAppStore.getState().setHasValidSession(true);
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

      renderHook(() => useAuthSession(false));

      await waitFor(() => expect(useAppStore.getState().hasValidSession).toBe(false));
    });

    it("restores googleAuthChecked when session exists but not checked", async () => {
      usePlainAuthRoute();
      mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });

      renderHook(() => useAuthSession(false));

      await waitFor(() => expect(useUserDataStore.getState().googleAuthChecked).toBe(true));
      expect(useAppStore.getState().hasValidSession).toBe(true);
    });

    it("handles session check error gracefully", async () => {
      usePlainAuthRoute();
      useAppStore.getState().setHasValidSession(true);
      mockGetSession
        .mockRejectedValueOnce(new Error("session unavailable"))
        .mockResolvedValue({ data: { session: null }, error: null });

      renderHook(() => useAuthSession(false));

      await waitFor(() => expect(useAppStore.getState().hasValidSession).toBe(false));
    });
  });

  describe("pending auth URL (native)", () => {
    it("processes pending auth URL when supabase is ready", async () => {
      mockIsNative.value = true;
      startAuthFlow();

      let currentSession: unknown = null;
      mockGetSession.mockImplementation(() =>
        Promise.resolve({ data: { session: currentSession }, error: null })
      );
      mockExchangeCodeForSession.mockImplementation(async () => {
        currentSession = telegramSession;
        return { data: { session: telegramSession }, error: null };
      });

      setPendingAuthUrl(
        "zenflow://auth/callback?code=native-code&state=telegram-state&provider=telegram"
      );

      renderHook(() => useAuthSession(false));

      await waitFor(() => expect(mockExchangeCodeForSession).toHaveBeenCalledWith("native-code"));
      await waitFor(() => expect(useAppStore.getState().hasValidSession).toBe(true));

      expect(mockCloseOAuthBrowser).toHaveBeenCalledTimes(1);
      expect(useAppStore.getState().authBypassFlag).toBe(true);
      expect(useAppStore.getState().webOAuthError).toBe(null);
      expect(useUserDataStore.getState().googleAuthChecked).toBe(true);
      expect(useUserDataStore.getState().userName).toBe("Telegram Friend");
      expect(isAuthFlowInProgress()).toBe(false);
    });
    it("does not overwrite a custom user name from native pending auth metadata", async () => {
      mockIsNative.value = true;
      startAuthFlow();
      useUserDataStore.setState({ userName: "My Native Name", userNameCustom: true });

      let currentSession: unknown = null;
      mockGetSession.mockImplementation(() =>
        Promise.resolve({ data: { session: currentSession }, error: null })
      );
      mockExchangeCodeForSession.mockImplementation(async () => {
        currentSession = telegramSession;
        return { data: { session: telegramSession }, error: null };
      });

      setPendingAuthUrl(
        "zenflow://auth/callback?code=native-code&state=telegram-state&provider=telegram"
      );

      renderHook(() => useAuthSession(false));

      await waitFor(() => expect(useAppStore.getState().hasValidSession).toBe(true));

      expect(useUserDataStore.getState().userName).toBe("My Native Name");
      expect(useUserDataStore.getState().userNameCustom).toBe(true);
    });
    it("handles failed pending auth callback", async () => {
      mockIsNative.value = true;
      startAuthFlow();
      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: null },
        error: { message: "bad verifier" },
      });

      setPendingAuthUrl(
        "zenflow://auth/callback?code=broken-native-code&state=telegram-state&provider=telegram"
      );

      renderHook(() => useAuthSession(false));

      await waitFor(() =>
        expect(useAppStore.getState().webOAuthError).toBe("Session exchange failed: bad verifier")
      );

      expect(mockCloseOAuthBrowser).toHaveBeenCalledTimes(1);
      expect(useAppStore.getState().hasValidSession).toBe(false);
      expect(isAuthFlowInProgress()).toBe(false);
    });
    it("skips pending auth URL processing on non-native platform", async () => {
      usePlainAuthRoute();
      mockIsNative.value = false;
      setPendingAuthUrl(
        "zenflow://auth/callback?code=native-code&state=telegram-state&provider=telegram"
      );

      renderHook(() => useAuthSession(false));

      await waitFor(() => expect(mockGetSession).toHaveBeenCalled());

      expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
      expect(mockCloseOAuthBrowser).not.toHaveBeenCalled();
      expect(hasPendingAuthUrl()).toBe(true);
    });
  });

  describe("cloud sync on auth change", () => {
    it("reconciles durable sign-out cleanup before the initial account can sync", async () => {
      usePlainAuthRoute();
      mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });
      mockReconcilePendingAccountSignOutCleanup.mockResolvedValueOnce({
        status: "completed",
      });

      renderHook(() => useAuthSession(false));

      await waitFor(() => expect(mockSyncWithCloud).toHaveBeenCalledTimes(1));
      expect(mockReconcilePendingAccountSignOutCleanup).toHaveBeenCalledWith(
        telegramSession.user.id,
      );
      expect(
        mockReconcilePendingAccountSignOutCleanup.mock.invocationCallOrder[0],
      ).toBeLessThan(mockSyncWithCloud.mock.invocationCallOrder[0]);
    });

    it("keeps a new account gated when durable sign-out cleanup remains blocked", async () => {
      usePlainAuthRoute();
      mockGetSession.mockResolvedValue({ data: { session: secondTelegramSession }, error: null });
      mockReconcilePendingAccountSignOutCleanup.mockResolvedValue({
        status: "blocked",
      });

      renderHook(() => useAuthSession(false));

      await waitFor(() =>
        expect(mockReconcilePendingAccountSignOutCleanup).toHaveBeenCalledWith(
          secondTelegramSession.user.id,
        ),
      );
      expect(mockSyncWithCloud).not.toHaveBeenCalled();
      expect(useAppStore.getState().hasValidSession).toBe(false);
      expect(useAppStore.getState().isAccountBoundaryInProgress).toBe(true);
    });

    it("reconciles a pending cleanup marker on cold start without a session", async () => {
      usePlainAuthRoute();
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
      mockReconcilePendingAccountSignOutCleanup.mockResolvedValueOnce({
        status: "completed",
      });

      renderHook(() => useAuthSession(false));

      await waitFor(() =>
        expect(mockReconcilePendingAccountSignOutCleanup).toHaveBeenCalledWith(null),
      );
      expect(mockSyncWithCloud).not.toHaveBeenCalled();
    });

    it("syncs with cloud on initial session", async () => {
      usePlainAuthRoute();
      mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });

      renderHook(() => useAuthSession(false));

      await waitFor(() =>
        expect(mockSyncWithCloud).toHaveBeenCalledWith("merge", telegramSession.user.id),
      );
      expect(mockMigrateExistingUser).toHaveBeenCalled();
    });

    it("owner-binds and claims legacy offline work for the already cached cold-start session", async () => {
      usePlainAuthRoute();
      mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });
      mockGetLocalDataOwnerId.mockResolvedValue(null);
      const hasLegacy = vi
        .spyOn(offlineQueue, "hasUnownedLegacyActionsReady")
        .mockResolvedValue(true);
      const claimLegacy = vi
        .spyOn(offlineQueue, "claimLegacyActionsForOwner")
        .mockResolvedValue(2);

      try {
        renderHook(() => useAuthSession(false));

        await waitFor(() =>
          expect(claimLegacy).toHaveBeenCalledWith(telegramSession.user.id),
        );
        expect(mockSetLocalDataOwnerId).toHaveBeenCalledWith(telegramSession.user.id);
        expect(mockSetLocalDataOwnerId.mock.invocationCallOrder.at(-1)).toBeLessThan(
          claimLegacy.mock.invocationCallOrder[0],
        );
        await waitFor(() => expect(mockSyncWithCloud).toHaveBeenCalledTimes(1));
      } finally {
        hasLegacy.mockRestore();
        claimLegacy.mockRestore();
      }
    });

    it.each([
      { failure: "local owner binding", rejectOwnerBinding: true },
      { failure: "legacy queue claim", rejectOwnerBinding: false },
    ])("exits the boundary into explicit recovery after $failure rejects", async ({
      rejectOwnerBinding,
    }) => {
      usePlainAuthRoute();
      mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });
      mockGetLocalDataOwnerId.mockResolvedValue(null);
      if (rejectOwnerBinding) {
        mockSetLocalDataOwnerId.mockRejectedValue(new Error("local owner binding failed"));
      }
      const hasLegacy = vi
        .spyOn(offlineQueue, "hasUnownedLegacyActionsReady")
        .mockResolvedValue(true);
      const claimLegacy = vi
        .spyOn(offlineQueue, "claimLegacyActionsForOwner")
        .mockImplementation(async () => {
          if (!rejectOwnerBinding) throw new Error("legacy queue claim failed");
          return 2;
        });

      try {
        renderHook(() => useAuthSession(false));

        await waitFor(() =>
          expect(mockSetLocalDataOwnerId).toHaveBeenCalledWith(telegramSession.user.id),
        );
        if (rejectOwnerBinding) {
          expect(claimLegacy).not.toHaveBeenCalled();
        } else {
          await waitFor(() =>
            expect(claimLegacy).toHaveBeenCalledWith(telegramSession.user.id),
          );
        }
        await waitFor(() =>
          expect(useAppStore.getState().isAccountBoundaryInProgress).toBe(false),
        );

        expect(useAppStore.getState().hasValidSession).toBe(false);
        expect(useAppStore.getState().authBypassFlag).toBe(false);
        expect(useUserDataStore.getState().authGateChecked).toBe(false);
        expect(useAppStore.getState().webOAuthError).toBe(
          AUTH_ACCOUNT_SWITCH_PENDING_WRITES_ERROR,
        );
        expect(mockSyncWithCloud).not.toHaveBeenCalled();
        expect(mockClearLocalUserData).not.toHaveBeenCalled();
      } finally {
        hasLegacy.mockRestore();
        claimLegacy.mockRestore();
      }
    });

    it("requires explicit recovery before a later interactive sign-in can claim legacy work", async () => {
      usePlainAuthRoute();
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
      mockGetLocalDataOwnerId.mockResolvedValue(null);
      const hasLegacy = vi
        .spyOn(offlineQueue, "hasUnownedLegacyActionsReady")
        .mockResolvedValue(true);
      const claimLegacy = vi
        .spyOn(offlineQueue, "claimLegacyActionsForOwner")
        .mockResolvedValue(1);

      try {
        renderHook(() => useAuthSession(false));
        await waitFor(() => expect(mockGetSession).toHaveBeenCalled());

        emitAuthEvent("SIGNED_IN", telegramSession);

        await waitFor(() =>
          expect(useAppStore.getState().webOAuthError).toBe(
            AUTH_ACCOUNT_SWITCH_PENDING_WRITES_ERROR,
          ),
        );
        expect(claimLegacy).not.toHaveBeenCalled();
        expect(mockSetLocalDataOwnerId).not.toHaveBeenCalled();
        expect(mockSyncWithCloud).not.toHaveBeenCalled();
        expect(mockClearLocalUserData).not.toHaveBeenCalled();
        expect(mockAuthSignOut).not.toHaveBeenCalled();

        mockGetSession.mockResolvedValue({
          data: { session: telegramSession },
          error: null,
        });
        act(() => {
          window.dispatchEvent(new Event("zenflow:recover-legacy-offline-queue"));
        });

        await waitFor(() =>
          expect(claimLegacy).toHaveBeenCalledWith(telegramSession.user.id),
        );
        await waitFor(() =>
          expect(mockSyncWithCloud).toHaveBeenCalledWith("merge", telegramSession.user.id),
        );
      } finally {
        hasLegacy.mockRestore();
        claimLegacy.mockRestore();
      }
    });

    it("uses merge mode for same user", async () => {
      usePlainAuthRoute();

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);

      await waitFor(() =>
        expect(mockSyncWithCloud).toHaveBeenCalledWith("merge", telegramSession.user.id),
      );
      emitAuthEvent("SIGNED_IN", telegramSession);

      expect(mockSyncWithCloud).toHaveBeenCalledTimes(1);
    });

    it("uses replace mode after sign-out and re-sign-in", async () => {
      usePlainAuthRoute();

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() =>
        expect(mockSyncWithCloud).toHaveBeenCalledWith("merge", telegramSession.user.id),
      );

      emitAuthEvent("SIGNED_OUT", null);
      emitAuthEvent("SIGNED_IN", telegramSession);

      await waitFor(() =>
        expect(mockSyncWithCloud).toHaveBeenCalledWith("replace", telegramSession.user.id),
      );
      expect(mockSyncWithCloud).toHaveBeenNthCalledWith(2, "replace", telegramSession.user.id);
    });

    it("uses replace mode on account switch", async () => {
      usePlainAuthRoute();

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() =>
        expect(mockSyncWithCloud).toHaveBeenCalledWith("merge", telegramSession.user.id),
      );

      emitAuthEvent("SIGNED_IN", secondTelegramSession);

      await waitFor(() =>
        expect(mockSyncWithCloud).toHaveBeenCalledWith(
          "replace",
          secondTelegramSession.user.id,
        ),
      );
      expect(mockSyncWithCloud).toHaveBeenNthCalledWith(
        2,
        "replace",
        secondTelegramSession.user.id,
      );
      expect(mockQuiesceCloudSync).toHaveBeenCalledTimes(1);
      expect(mockRevokePushForAccountBoundary).toHaveBeenCalledWith(telegramSession.user.id);
      expect(mockClearAccountNotificationsForBoundary).toHaveBeenCalledTimes(2);
      expect(mockClearNativeJournalBiometricCredential).toHaveBeenCalledTimes(1);
      expect(mockClearAccountDeviceSurfaces).toHaveBeenCalledTimes(1);
      expect(mockClearJournalContentSession).toHaveBeenCalledWith("sign-out");
      expect(mockClearLocalUserData).toHaveBeenCalledTimes(1);
      expect(mockTriggerDataRefresh).toHaveBeenCalledTimes(1);
      expect(mockResumeCloudSync).toHaveBeenCalledTimes(1);
      expect(mockQuiesceCloudSync.mock.invocationCallOrder[0]).toBeLessThan(
        mockRevokePushForAccountBoundary.mock.invocationCallOrder[0]
      );
      expect(mockRevokePushForAccountBoundary.mock.invocationCallOrder[0]).toBeLessThan(
        mockClearAccountNotificationsForBoundary.mock.invocationCallOrder[1]
      );
      expect(mockClearAccountNotificationsForBoundary.mock.invocationCallOrder[1]).toBeLessThan(
        mockClearLocalUserData.mock.invocationCallOrder[0]
      );
      expect(mockClearNativeJournalBiometricCredential.mock.invocationCallOrder[0]).toBeLessThan(
        mockClearLocalUserData.mock.invocationCallOrder[0]
      );
      expect(mockClearAccountDeviceSurfaces.mock.invocationCallOrder[0]).toBeLessThan(
        mockClearLocalUserData.mock.invocationCallOrder[0]
      );
      expect(mockClearLocalUserData.mock.invocationCallOrder[0]).toBeLessThan(
        mockSyncWithCloud.mock.invocationCallOrder[1]
      );
    });

    it("keeps the app gated until an account switch has purged the previous user's data", async () => {
      usePlainAuthRoute();
      let releaseBoundaryCleanup!: () => void;
      mockClearLocalUserData.mockImplementationOnce(
        () => new Promise<void>((resolve) => {
          releaseBoundaryCleanup = resolve;
        }),
      );

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() =>
        expect(mockSyncWithCloud).toHaveBeenCalledWith("merge", telegramSession.user.id),
      );
      act(() => useAppStore.getState().setHasValidSession(true));
      expect(useAppStore.getState().hasValidSession).toBe(true);

      emitAuthEvent("SIGNED_IN", secondTelegramSession);
      await waitFor(() => expect(mockClearLocalUserData).toHaveBeenCalledTimes(1));

      expect(useAppStore.getState().hasValidSession).toBe(false);

      releaseBoundaryCleanup();
      await waitFor(() =>
        expect(mockSyncWithCloud).toHaveBeenCalledWith(
          "replace",
          secondTelegramSession.user.id,
        ),
      );
      await waitFor(() => expect(useAppStore.getState().hasValidSession).toBe(true));
    });

    it("does not reopen the app when sign-out supersedes a slow account switch", async () => {
      usePlainAuthRoute();
      let releaseBoundaryCleanup!: () => void;
      mockClearLocalUserData.mockImplementationOnce(
        () => new Promise<void>((resolve) => {
          releaseBoundaryCleanup = resolve;
        }),
      );

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() =>
        expect(mockSyncWithCloud).toHaveBeenCalledWith("merge", telegramSession.user.id),
      );
      act(() => useAppStore.getState().setHasValidSession(true));

      emitAuthEvent("SIGNED_IN", secondTelegramSession);
      await waitFor(() => expect(mockClearLocalUserData).toHaveBeenCalledTimes(1));
      emitAuthEvent("SIGNED_OUT", null);
      releaseBoundaryCleanup();

      await waitFor(() => expect(useAppStore.getState().hasValidSession).toBe(false));
      await Promise.resolve();
      expect(mockSetLocalDataOwnerId).not.toHaveBeenCalledWith(secondTelegramSession.user.id);
      expect(useAppStore.getState().hasValidSession).toBe(false);
    });

    it("lets only the newest account transition bind local ownership", async () => {
      usePlainAuthRoute();
      const thirdTelegramSession = {
        user: {
          ...telegramSession.user,
          id: "323e4567-e89b-12d3-a456-426614174000",
        },
      };
      let releaseBoundaryCleanup!: () => void;
      mockClearLocalUserData
        .mockImplementationOnce(
          () => new Promise<void>((resolve) => {
            releaseBoundaryCleanup = resolve;
          }),
        )
        .mockResolvedValue(undefined);

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() =>
        expect(mockSyncWithCloud).toHaveBeenCalledWith("merge", telegramSession.user.id),
      );

      emitAuthEvent("SIGNED_IN", secondTelegramSession);
      await waitFor(() => expect(mockClearLocalUserData).toHaveBeenCalledTimes(1));
      emitAuthEvent("SIGNED_IN", thirdTelegramSession);
      releaseBoundaryCleanup();

      await waitFor(() =>
        expect(mockSetLocalDataOwnerId).toHaveBeenCalledWith(thirdTelegramSession.user.id),
      );
      expect(mockSetLocalDataOwnerId).not.toHaveBeenCalledWith(secondTelegramSession.user.id);
      expect(mockSetLocalDataOwnerId).toHaveBeenLastCalledWith(thirdTelegramSession.user.id);
      expect(useAppStore.getState().hasValidSession).toBe(true);
    });

    it("closes the new session when account-boundary cleanup cannot be proven", async () => {
      usePlainAuthRoute();
      mockClearLocalUserData.mockRejectedValueOnce(new Error("purge failed"));

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() => expect(mockSyncWithCloud).toHaveBeenCalledTimes(1));

      emitAuthEvent("SIGNED_IN", secondTelegramSession);

      await waitFor(() =>
        expect(mockAuthSignOut).toHaveBeenCalledWith({ scope: "local" })
      );
      expect(mockSyncWithCloud).toHaveBeenCalledTimes(1);
      expect(useAppStore.getState().hasValidSession).toBe(false);
      expect(useUserDataStore.getState().authGateChecked).toBe(false);
      expect(mockResumeCloudSync).not.toHaveBeenCalled();
    });

    it("preserves account A ownership and closes B when native journal cleanup fails", async () => {
      usePlainAuthRoute();
      mockClearNativeJournalBiometricCredential.mockRejectedValueOnce(
        new Error("native journal credential delete failed"),
      );

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() => expect(mockSyncWithCloud).toHaveBeenCalledTimes(1));

      emitAuthEvent("SIGNED_IN", secondTelegramSession);

      await waitFor(() =>
        expect(mockAuthSignOut).toHaveBeenCalledWith({ scope: "local" }),
      );
      expect(mockClearLocalUserData).not.toHaveBeenCalled();
      expect(mockSetLocalDataOwnerId).not.toHaveBeenCalledWith(secondTelegramSession.user.id);
      expect(mockSyncWithCloud).toHaveBeenCalledTimes(1);
      expect(useAppStore.getState().hasValidSession).toBe(false);
      expect(useUserDataStore.getState().authGateChecked).toBe(false);
      expect(mockResumeCloudSync).not.toHaveBeenCalled();
    });

    it("preserves account A ownership and closes B when native account surfaces cannot be cleared", async () => {
      usePlainAuthRoute();
      mockClearAccountDeviceSurfaces.mockRejectedValueOnce(
        new Error("widget cleanup failed"),
      );

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() => expect(mockSyncWithCloud).toHaveBeenCalledTimes(1));

      emitAuthEvent("SIGNED_IN", secondTelegramSession);

      await waitFor(() =>
        expect(mockAuthSignOut).toHaveBeenCalledWith({ scope: "local" }),
      );
      expect(mockClearLocalUserData).not.toHaveBeenCalled();
      expect(mockSetLocalDataOwnerId).not.toHaveBeenCalledWith(secondTelegramSession.user.id);
      expect(mockSyncWithCloud).toHaveBeenCalledTimes(1);
    });

    it("preserves account A data and closes B when A still has pending offline writes", async () => {
      usePlainAuthRoute();
      const pendingActions = vi
        .spyOn(offlineQueue, "hasPendingActionsForOwner")
        .mockImplementation((ownerUserId) => ownerUserId === telegramSession.user.id);

      try {
        renderHook(() => useAuthSession(false));
        emitAuthEvent("SIGNED_IN", telegramSession);
        await waitFor(() => expect(mockSyncWithCloud).toHaveBeenCalledTimes(1));

        emitAuthEvent("SIGNED_IN", secondTelegramSession);

        await waitFor(() =>
          expect(mockAuthSignOut).toHaveBeenCalledWith({ scope: "local" }),
        );
        expect(mockClearLocalUserData).not.toHaveBeenCalled();
        expect(useAppStore.getState().hasValidSession).toBe(false);
      } finally {
        pendingActions.mockRestore();
      }
    });

    it("reports a resolved local sign-out error after account-boundary cleanup fails", async () => {
      usePlainAuthRoute();
      const signOutError = { message: "local sign-out rejected" };
      mockClearLocalUserData.mockRejectedValueOnce(new Error("purge failed"));
      mockAuthSignOut.mockResolvedValueOnce({ error: signOutError });

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() => expect(mockSyncWithCloud).toHaveBeenCalledTimes(1));
      emitAuthEvent("SIGNED_IN", secondTelegramSession);

      await waitFor(() =>
        expect(logger.error).toHaveBeenCalledWith(
          "[Auth] Failed to close the new session after boundary cleanup:",
          signOutError,
        ),
      );
    });

    it("keeps a safely prepared account boundary and schedules recovery after replace fails", async () => {
      usePlainAuthRoute();
      mockSyncWithCloud
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("network unavailable"));

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() => expect(mockSyncWithCloud).toHaveBeenCalledTimes(1));

      emitAuthEvent("SIGNED_IN", secondTelegramSession);
      await waitFor(() => expect(mockSyncWithCloud).toHaveBeenCalledTimes(2));

      emitAuthEvent("TOKEN_REFRESHED", secondTelegramSession);
      await Promise.resolve();

      expect(mockSyncWithCloud).toHaveBeenCalledTimes(2);
      expect(mockSyncWithCloud).toHaveBeenNthCalledWith(
        2,
        "replace",
        secondTelegramSession.user.id,
      );
      expect(mockClearLocalUserData).toHaveBeenCalledTimes(1);
      expect(mockSetLocalDataOwnerId).toHaveBeenCalledWith(secondTelegramSession.user.id);
      expect(mockStartAutoSync).toHaveBeenCalledTimes(2);
    });

    it("starts auto-sync after successful initial sync", async () => {
      usePlainAuthRoute();
      mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });

      renderHook(() => useAuthSession(false));

      await waitFor(() => expect(mockStartAutoSync).toHaveBeenCalled());
    });

    it("keeps the session valid without claiming backup startup after initial sync fails", async () => {
      usePlainAuthRoute();
      mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });
      mockSyncWithCloud.mockRejectedValueOnce(new Error("initial sync failed"));

      renderHook(() => useAuthSession(false));

      await waitFor(() => expect(useAppStore.getState().hasValidSession).toBe(true));
      expect(mockStartAutoSync).not.toHaveBeenCalled();
    });

    it("joins presence channel on auth", async () => {
      usePlainAuthRoute();
      mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });

      renderHook(() => useAuthSession(false));

      await waitFor(() => expect(mockJoinPresence).toHaveBeenCalled());
    });

    it("pulls preferences and clears stale session-expired state on sign-in", async () => {
      usePlainAuthRoute();

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);

      await waitFor(() => expect(mockPullPreferences).toHaveBeenCalled());
      expect(mockResetSessionExpired).toHaveBeenCalled();
      expect(mockMigrateExistingUser).toHaveBeenCalled();
    });

    it("tracks app version in the user profile on sign-in", async () => {
      usePlainAuthRoute();

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);

      await waitFor(() =>
        expect(mockProfileUpdate).toHaveBeenCalledWith({
          app_version: expect.any(String),
        })
      );
    });

    it("tracks app version in the user profile on initial session", async () => {
      usePlainAuthRoute();

      renderHook(() => useAuthSession(false));
      emitAuthEvent("INITIAL_SESSION", telegramSession);

      await waitFor(() =>
        expect(mockProfileUpdate).toHaveBeenCalledWith({
          app_version: expect.any(String),
        })
      );
    });

    it("stops auto-sync on unmount", () => {
      usePlainAuthRoute();

      const { unmount } = renderHook(() => useAuthSession(false));
      unmount();

      expect(mockStopAutoSync).toHaveBeenCalled();
      expect(mockLeavePresence).toHaveBeenCalled();
    });
  });

  describe("user name sync", () => {
    it("syncs user name from session metadata on mount", async () => {
      usePlainAuthRoute();
      mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });

      renderHook(() => useAuthSession(false));

      await waitFor(() => expect(useUserDataStore.getState().userName).toBe("Telegram Friend"));
    });

    it("updates name when auth state changes", async () => {
      usePlainAuthRoute();

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);

      await waitFor(() => expect(useUserDataStore.getState().userName).toBe("Telegram Friend"));
    });

    it("does not overwrite custom user name", async () => {
      usePlainAuthRoute();
      useUserDataStore.setState({ userName: "My Name", userNameCustom: true });
      mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });

      renderHook(() => useAuthSession(false));
      await waitFor(() => expect(mockGetSession).toHaveBeenCalled());
      emitAuthEvent("SIGNED_IN", telegramSession);
      await Promise.resolve();

      expect(useUserDataStore.getState().userName).toBe("My Name");
    });
  });

  describe("session expired handler", () => {
    it("resets auth state when session is truly expired", async () => {
      usePlainAuthRoute();
      mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });

      renderHook(() => useAuthSession(false));
      await waitFor(() => expect(useAppStore.getState().hasValidSession).toBe(true));

      useAppStore.setState({ hasValidSession: true, authBypassFlag: true });
      useUserDataStore.setState({ googleAuthChecked: true });
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

      act(() => {
        window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT));
      });

      await waitFor(() => expect(useAppStore.getState().hasValidSession).toBe(false));
      expect(useAppStore.getState().authBypassFlag).toBe(false);
      expect(useUserDataStore.getState().googleAuthChecked).toBe(false);
    });

    it("ignores expired event if session is still valid", async () => {
      usePlainAuthRoute();
      mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });

      renderHook(() => useAuthSession(false));
      await waitFor(() => expect(useAppStore.getState().hasValidSession).toBe(true));

      useAppStore.setState({ hasValidSession: true, authBypassFlag: true });
      useUserDataStore.setState({ googleAuthChecked: true });

      act(() => {
        window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT));
      });

      await Promise.resolve();

      expect(useAppStore.getState().hasValidSession).toBe(true);
      expect(useAppStore.getState().authBypassFlag).toBe(true);
      expect(useUserDataStore.getState().googleAuthChecked).toBe(true);
    });

    it("throttles expired events within 5s window", async () => {
      usePlainAuthRoute();
      const nowSpy = vi.spyOn(Date, "now");
      nowSpy.mockReturnValue(10000);
      mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });

      try {
        renderHook(() => useAuthSession(false));
        await waitFor(() => expect(useAppStore.getState().hasValidSession).toBe(true));

        mockGetSession.mockClear();
        mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

        act(() => {
          window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT));
        });

        await waitFor(() => expect(mockGetSession).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(useAppStore.getState().hasValidSession).toBe(false));

        mockGetSession.mockClear();
        useAppStore.setState({ hasValidSession: true, authBypassFlag: true });
        useUserDataStore.setState({ googleAuthChecked: true });
        nowSpy.mockReturnValue(10001);

        act(() => {
          window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT));
        });

        await Promise.resolve();

        expect(mockGetSession).not.toHaveBeenCalled();
        expect(useAppStore.getState().hasValidSession).toBe(true);
        expect(useAppStore.getState().authBypassFlag).toBe(true);
        expect(useUserDataStore.getState().googleAuthChecked).toBe(true);
      } finally {
        nowSpy.mockRestore();
      }
    });
  });
});
