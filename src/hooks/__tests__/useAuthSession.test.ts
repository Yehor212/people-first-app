/**
 * useAuthSession Hook Tests
 * Tests Supabase auth session lifecycle management.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OwnerBoundLocalSignOutResult } from "@/lib/ownerBoundAuthSession";

const {
  authStateCallbacks,
  mockExchangeCodeForSession,
  mockGetSession,
  mockOnAuthStateChange,
  mockSetSession,
  mockAuthSignOut,
  mockSignOutExpectedOwnerLocally,
  mockSyncWithCloud,
  mockStartAutoSync,
  mockStopAutoSync,
  mockQuiesceCloudSync,
  mockResumeCloudSync,
  mockCloudBoundarySuspended,
  mockQueueBoundarySuspended,
  mockCloudBoundaryEpoch,
  mockQueueBoundaryEpoch,
  mockClearLocalUserData,
  mockLocalOwner,
  mockGetLocalDataOwnerId,
  mockSetLocalDataOwnerId,
  mockClearLocalDataOwnerId,
  mockTriggerDataRefresh,
  mockRunWithDataWriteBarrier,
  mockRunWithSettledDataRead,
  mockClearDeviceIdCache,
  mockClearJournalContentSession,
  mockPullPreferences,
  mockJoinPresence,
  mockLeavePresence,
  mockLeavePresenceForAccountBoundary,
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
  mockHasPendingInstallationJournalSecurityRemoval,
  mockHasPendingJournalSecurityRemovalForOwner,
  mockEnsureOwnerBoundJournalSecurityMigration,
  mockRunJournalSecurityMigration,
  mockResumePendingJournalPasswordRemoval,
  mockCommitPendingAccountSwitchCleanup,
  mockReconcilePendingAccountSignOutCleanup,
  mockNotifyAccountSessionTransition,
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
    (_options?: { scope: "local" }): Promise<{ error: { message: string } | null }> =>
      Promise.resolve({ error: null })
  );
  const mockCloseOAuthBrowser = vi.fn(() => Promise.resolve());
  const mockSignOutExpectedOwnerLocally = vi.fn<() => Promise<OwnerBoundLocalSignOutResult>>(
    async () => {
      const { error } = await mockAuthSignOut({ scope: "local" });
      if (error) throw new Error(error.message);
      return { status: "signed-out" as const };
    }
  );

  const mockLocalOwner: { value: string | null } = { value: null };

  return {
    authStateCallbacks,
    mockExchangeCodeForSession,
    mockGetSession,
    mockOnAuthStateChange,
    mockSetSession,
    mockAuthSignOut,
    mockSignOutExpectedOwnerLocally,
    mockSyncWithCloud: vi.fn(() => Promise.resolve()),
    mockStartAutoSync: vi.fn(),
    mockStopAutoSync: vi.fn(),
    mockQuiesceCloudSync: vi.fn(() => Promise.resolve()),
    mockResumeCloudSync: vi.fn(),
    mockCloudBoundarySuspended: { value: false },
    mockQueueBoundarySuspended: { value: false },
    mockCloudBoundaryEpoch: { value: 0 },
    mockQueueBoundaryEpoch: { value: 0 },
    mockClearLocalUserData: vi.fn(() => Promise.resolve()),
    mockLocalOwner,
    mockGetLocalDataOwnerId: vi.fn<() => Promise<string | null>>(() =>
      Promise.resolve(mockLocalOwner.value)
    ),
    mockSetLocalDataOwnerId: vi.fn<(ownerUserId: string) => Promise<void>>(
      async (ownerUserId: string) => {
        mockLocalOwner.value = ownerUserId;
      }
    ),
    mockClearLocalDataOwnerId: vi.fn(async () => {
      mockLocalOwner.value = null;
    }),
    mockTriggerDataRefresh: vi.fn(() => Promise.resolve()),
    mockRunWithDataWriteBarrier: vi.fn(async (mutation: () => Promise<unknown>) => {
      const result = await mutation();
      await mockTriggerDataRefresh();
      return result;
    }),
    mockRunWithSettledDataRead: vi.fn(async (operation: () => Promise<unknown>) => operation()),
    mockClearDeviceIdCache: vi.fn(),
    mockClearJournalContentSession: vi.fn(),
    mockPullPreferences: vi.fn(() => Promise.resolve()),
    mockJoinPresence: vi.fn(() => Promise.resolve()),
    mockLeavePresence: vi.fn(() => Promise.resolve()),
    mockLeavePresenceForAccountBoundary: vi.fn(() =>
      Promise.resolve({ status: "removed" as const })
    ),
    mockMigrateExistingUser: vi.fn(),
    mockResetSessionExpired: vi.fn(),
    mockProfileUpdate,
    mockCloseOAuthBrowser,
    mockIsNative: { value: false },
    mockRevokePushForAccountBoundary: vi.fn(() =>
      Promise.resolve({ status: "revoked", remote: "deleted", native: "unregistered" })
    ),
    mockClearNativeJournalBiometricCredential: vi.fn(() => Promise.resolve("removed")),
    mockClearAccountDeviceSurfaces: vi.fn(() => Promise.resolve()),
    mockClearAccountNotificationsForBoundary: vi.fn(() => Promise.resolve()),
    mockHasPendingJournalSecurityMigrationForOwner: vi.fn(() => Promise.resolve(false)),
    mockHasPendingInstallationJournalSecurityRemoval: vi.fn(() => Promise.resolve(false)),
    mockHasPendingJournalSecurityRemovalForOwner: vi.fn<
      (ownerUserId: string) => Promise<boolean>
    >(() => Promise.resolve(false)),
    mockEnsureOwnerBoundJournalSecurityMigration: vi.fn<
      () => Promise<{ revision: string } | null>
    >(() => Promise.resolve(null)),
    mockRunJournalSecurityMigration: vi.fn(() => Promise.resolve()),
    mockResumePendingJournalPasswordRemoval: vi.fn<
      () => Promise<"none" | "pending" | "completed">
    >(() => Promise.resolve("none")),
    mockCommitPendingAccountSwitchCleanup: vi.fn(
      async (
        _sourceOwnerUserId: string,
        _targetOwnerUserId: string,
        mutation: (prepareCleanupIntent: () => boolean) => Promise<void>
      ) => {
        await mutation(() => true);
        return true;
      }
    ),
    mockReconcilePendingAccountSignOutCleanup: vi.fn<
      () => Promise<{
        status: "none" | "completed" | "cancelled" | "blocked";
      }>
    >(() => Promise.resolve({ status: "none" })),
    mockNotifyAccountSessionTransition: vi.fn(),
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

// Callback ownership is covered against the real GoTrueClient in
// pkceAttemptIsolation.test.ts. This hook suite keeps its Supabase auth object
// intentionally minimal and exercises only the session lifecycle around it.
vi.mock("@/lib/authTransitionCoordinator", () => ({
  runWithPkceCallbackUrl: (
    _auth: unknown,
    _callbackUrl: string,
    operation: () => Promise<unknown>
  ) => operation(),
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
  isCloudSyncSuspendedForAccountBoundary: vi.fn(() => mockCloudBoundarySuspended.value),
  getCloudSyncAccountBoundaryEpoch: vi.fn(() => mockCloudBoundaryEpoch.value),
}));

vi.mock("@/storage/db", () => ({
  clearLocalUserData: mockClearLocalUserData,
  clearLocalDataOwnerId: mockClearLocalDataOwnerId,
  getLocalDataOwnerId: mockGetLocalDataOwnerId,
  setLocalDataOwnerId: mockSetLocalDataOwnerId,
}));

vi.mock("@/storage/accountBoundaryRuntime", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/storage/accountBoundaryRuntime")>()),
  notifyAccountSessionTransition: mockNotifyAccountSessionTransition,
}));

vi.mock("@/hooks/useIndexedDB", () => ({
  triggerDataRefresh: mockTriggerDataRefresh,
  runWithDataWriteBarrier: mockRunWithDataWriteBarrier,
  runWithSettledDataRead: mockRunWithSettledDataRead,
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
  leavePresenceForAccountBoundary: mockLeavePresenceForAccountBoundary,
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
  ensureOwnerBoundJournalSecurityMigration:
    mockEnsureOwnerBoundJournalSecurityMigration,
  hasPendingJournalSecurityMigrationForOwner: mockHasPendingJournalSecurityMigrationForOwner,
  hasPendingInstallationJournalSecurityRemoval:
    mockHasPendingInstallationJournalSecurityRemoval,
  hasPendingJournalSecurityRemovalForOwner: mockHasPendingJournalSecurityRemovalForOwner,
  resumePendingJournalPasswordRemoval: mockResumePendingJournalPasswordRemoval,
  runJournalSecurityMigration: mockRunJournalSecurityMigration,
}));

vi.mock("@/features/journal/journalSecurityRemovalLifecycle", () => ({
  resumePendingJournalPasswordRemoval: mockResumePendingJournalPasswordRemoval,
}));

vi.mock("@/lib/accountSignOutCleanup", () => ({
  commitPendingAccountSwitchCleanup: mockCommitPendingAccountSwitchCleanup,
  reconcilePendingAccountSignOutCleanup: mockReconcilePendingAccountSignOutCleanup,
}));

vi.mock("@/lib/ownerBoundAuthSession", () => ({
  signOutExpectedOwnerLocally: mockSignOutExpectedOwnerLocally,
}));

vi.mock("@/lib/offlineQueue", () => ({
  offlineQueue: {
    observeAuthStateOwner: vi.fn(),
    hasUnownedLegacyActionsReady: vi.fn(() => Promise.resolve(false)),
    claimLegacyActionsForOwner: vi.fn(() => Promise.resolve(0)),
    hasPendingActionsForOwner: vi.fn(() => false),
    hasPendingActionsForOwnerReady: vi.fn(() => Promise.resolve(false)),
    suspendForAccountBoundary: vi.fn(async () => {
      mockQueueBoundaryEpoch.value += 1;
      mockQueueBoundarySuspended.value = true;
    }),
    discardSuspendedActionsForAccountBoundary: vi.fn(() =>
      Promise.resolve({ status: "discarded" as const })
    ),
    resumeAfterAccountBoundary: vi.fn(() => {
      mockQueueBoundaryEpoch.value += 1;
      mockQueueBoundarySuspended.value = false;
    }),
    isSuspendedForAccountBoundary: vi.fn(() => mockQueueBoundarySuspended.value),
    getAccountBoundaryEpoch: vi.fn(() => mockQueueBoundaryEpoch.value),
    replayBlockedCriticalActionsForActiveOwner: vi.fn(() => Promise.resolve(0)),
  },
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
import {
  AUTH_ACCOUNT_SWITCH_PENDING_WRITES_ERROR,
  AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CANCEL_EVENT,
  AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CONFIRM_EVENT,
  AUTH_IMPORTED_BACKUP_DECISION_ALREADY_SETTLED,
  AUTH_IMPORTED_BACKUP_DECISION_SETTLED_ACK_EVENT,
  AUTH_IMPORTED_BACKUP_LOCAL_RECOVERY_EVENT,
  AUTH_IMPORTED_BACKUP_SAVE_CONTINUE_EVENT,
  readImportedBackupAccountClaim,
  readImportedBackupAccountClaimLabel,
} from "@/lib/authErrors";
import { logger } from "@/lib/logger";
import { offlineQueue } from "@/lib/offlineQueue";
import {
  clearPendingLocalBackupAccountClaim,
  hasImportedBackupLocalOnlyAccess,
  markImportedBackupLocalOnlyAccess,
  markPendingLocalBackupAccountClaim,
  readImportedBackupLocalOnlyDecisionRevision,
  readPendingLocalBackupAccountClaim,
} from "@/storage/accountBoundaryRuntime";
import {
  clearAccountCleanupRecovery,
  getAccountCleanupRecovery,
} from "@/lib/accountCleanupRecoveryState";

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
    clearAccountCleanupRecovery();
    clearPendingLocalBackupAccountClaim();
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
    mockCloudBoundarySuspended.value = false;
    mockQueueBoundarySuspended.value = false;
    mockCloudBoundaryEpoch.value = 0;
    mockQueueBoundaryEpoch.value = 0;
    mockQuiesceCloudSync.mockImplementation(async () => {
      mockCloudBoundaryEpoch.value += 1;
      mockCloudBoundarySuspended.value = true;
    });
    mockResumeCloudSync.mockImplementation(() => {
      mockCloudBoundaryEpoch.value += 1;
      mockCloudBoundarySuspended.value = false;
    });
    mockClearLocalUserData.mockResolvedValue(undefined);
    mockLocalOwner.value = null;
    mockGetLocalDataOwnerId.mockImplementation(async () => mockLocalOwner.value);
    mockSetLocalDataOwnerId.mockImplementation(async (ownerUserId: string) => {
      mockLocalOwner.value = ownerUserId;
    });
    mockClearLocalDataOwnerId.mockImplementation(async () => {
      mockLocalOwner.value = null;
    });
    mockTriggerDataRefresh.mockResolvedValue(undefined);
    mockRunWithSettledDataRead.mockImplementation(async (operation) => operation());
    mockAuthSignOut.mockResolvedValue({ error: null });
    mockSignOutExpectedOwnerLocally.mockImplementation(async () => {
      const { error } = await mockAuthSignOut({ scope: "local" });
      if (error) throw new Error(error.message);
      return { status: "signed-out" as const };
    });
    mockRevokePushForAccountBoundary.mockResolvedValue({
      status: "revoked",
      remote: "deleted",
      native: "unregistered",
    });
    mockClearNativeJournalBiometricCredential.mockResolvedValue("removed");
    mockClearAccountDeviceSurfaces.mockResolvedValue(undefined);
    mockClearAccountNotificationsForBoundary.mockResolvedValue(undefined);
    mockHasPendingJournalSecurityMigrationForOwner.mockResolvedValue(false);
    mockHasPendingInstallationJournalSecurityRemoval.mockResolvedValue(false);
    mockHasPendingJournalSecurityRemovalForOwner.mockResolvedValue(false);
    mockEnsureOwnerBoundJournalSecurityMigration.mockResolvedValue(null);
    mockRunJournalSecurityMigration.mockResolvedValue(undefined);
    mockResumePendingJournalPasswordRemoval.mockResolvedValue("none");
    mockCommitPendingAccountSwitchCleanup.mockImplementation(
      async (
        _sourceOwnerUserId: string,
        _targetOwnerUserId: string,
        mutation: (prepareCleanupIntent: () => boolean) => Promise<void>
      ) => {
        await mutation(() => true);
        return true;
      }
    );
    mockReconcilePendingAccountSignOutCleanup.mockResolvedValue({ status: "none" });
    mockLeavePresenceForAccountBoundary.mockResolvedValue({ status: "removed" });
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
        "/orb?nav=v2&navLayout=phone&code=telegram-code&state=telegram-state&journalReset=event-proof-1"
      );

      renderHook(() => useAuthSession(false));

      await waitFor(() => expect(useAppStore.getState().isProcessingWebOAuth).toBe(true));

      emitAuthEvent("SIGNED_IN", telegramSession);

      await waitFor(() => expect(useAppStore.getState().isProcessingWebOAuth).toBe(false));
      expect(
        JSON.parse(localStorage.getItem(SK.JOURNAL_PASSWORD_RESET_PROOF) || "{}")
      ).toMatchObject({
        nonce: "event-proof-1",
        userId: telegramSession.user.id,
      });
      expect(window.location.pathname + window.location.search).toBe("/orb?nav=v2&navLayout=phone");
    });

    it("does not store journal reset proof from an existing initial session when callback exchange fails", async () => {
      vi.useFakeTimers();
      try {
        window.history.pushState(
          {},
          "",
          "/orb?nav=v2&navLayout=phone&code=forged-code&state=telegram-state&journalReset=forged-proof-1"
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
        expect(window.location.pathname + window.location.search).toBe(
          "/orb?nav=v2&navLayout=phone"
        );
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

    it("keeps session truth unknown when the initial session check throws", async () => {
      usePlainAuthRoute();
      useAppStore.getState().setHasValidSession(true);
      mockGetSession
        .mockRejectedValueOnce(new Error("session unavailable"))
        .mockRejectedValueOnce(new Error("session unavailable"))
        .mockResolvedValue({ data: { session: null }, error: null });

      renderHook(() => useAuthSession(false));

      await waitFor(() => expect(useAppStore.getState().hasValidSession).toBeNull());
    });

    it("keeps session truth unknown when Supabase returns a session read error", async () => {
      usePlainAuthRoute();
      useAppStore.getState().setHasValidSession(true);
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: { message: "session storage unavailable" },
      });

      renderHook(() => useAuthSession(false));

      await waitFor(() => expect(useAppStore.getState().hasValidSession).toBeNull());
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
    it("does not write app version while an imported backup decision is unresolved", async () => {
      usePlainAuthRoute();
      expect(markPendingLocalBackupAccountClaim()).toBe(true);
      mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);

      await waitFor(() =>
        expect(readPendingLocalBackupAccountClaim().status).toBe("pending")
      );
      expect(mockProfileUpdate).not.toHaveBeenCalled();
    });

    it("keeps every unresolved imported-backup marker gated even when a local owner exists", async () => {
      usePlainAuthRoute();
      mockLocalOwner.value = telegramSession.user.id;
      expect(markPendingLocalBackupAccountClaim()).toBe(true);

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);

      await waitFor(() =>
        expect(readPendingLocalBackupAccountClaim().status).toBe("pending")
      );
      expect(useAppStore.getState().hasValidSession).toBe(false);
      expect(mockSyncWithCloud).not.toHaveBeenCalled();
    });

    it("reconciles durable sign-out cleanup before the initial account can sync", async () => {
      usePlainAuthRoute();
      mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });
      mockReconcilePendingAccountSignOutCleanup.mockResolvedValueOnce({
        status: "completed",
      });

      renderHook(() => useAuthSession(false));

      await waitFor(() => expect(mockSyncWithCloud).toHaveBeenCalledTimes(1));
      expect(mockReconcilePendingAccountSignOutCleanup).toHaveBeenCalledWith(
        telegramSession.user.id
      );
      expect(mockReconcilePendingAccountSignOutCleanup.mock.invocationCallOrder[0]).toBeLessThan(
        mockSyncWithCloud.mock.invocationCallOrder[0]
      );
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
          secondTelegramSession.user.id
        )
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
        expect(mockReconcilePendingAccountSignOutCleanup).toHaveBeenCalledWith(null)
      );
      expect(mockSyncWithCloud).not.toHaveBeenCalled();
    });

    it("syncs with cloud on initial session", async () => {
      usePlainAuthRoute();
      mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });

      renderHook(() => useAuthSession(false));

      await waitFor(() =>
        expect(mockSyncWithCloud).toHaveBeenCalledWith("merge", telegramSession.user.id)
      );
      expect(mockMigrateExistingUser).toHaveBeenCalled();
    });

    it("waits for the origin DATA boundary to bind an owner before reading it", async () => {
      usePlainAuthRoute();
      mockGetSession.mockResolvedValue({
        data: { session: secondTelegramSession },
        error: null,
      });
      const trace: string[] = ["boundary:cleared-owner"];
      let localOwnerUserId: string | null = null;
      let releaseBoundary!: () => void;
      const boundaryGate = new Promise<void>((resolve) => {
        releaseBoundary = resolve;
      });
      mockRunWithSettledDataRead.mockImplementationOnce(async (operation) => {
        trace.push("auth-read:queued-behind-data");
        await boundaryGate;
        trace.push("auth-read:entered-data");
        return operation();
      });
      mockGetLocalDataOwnerId.mockImplementation(async () => {
        trace.push(`owner-read:${localOwnerUserId ?? "null"}`);
        return localOwnerUserId;
      });

      try {
        renderHook(() => useAuthSession(false));

        await waitFor(() => expect(mockRunWithSettledDataRead).toHaveBeenCalledTimes(1));
        expect(mockGetLocalDataOwnerId).not.toHaveBeenCalled();

        trace.push("boundary:bound-account-b");
        localOwnerUserId = secondTelegramSession.user.id;
        act(() => releaseBoundary());

        await waitFor(() =>
          expect(mockSyncWithCloud).toHaveBeenCalledWith("merge", secondTelegramSession.user.id)
        );
        expect(trace.slice(0, 4)).toEqual([
          "boundary:cleared-owner",
          "auth-read:queued-behind-data",
          "boundary:bound-account-b",
          "auth-read:entered-data",
        ]);
        expect(trace.slice(4).length).toBeGreaterThanOrEqual(2);
        expect(
          trace.slice(4).every((entry) => entry === `owner-read:${secondTelegramSession.user.id}`)
        ).toBe(true);
        expect(mockClearLocalUserData).not.toHaveBeenCalled();
      } finally {
        releaseBoundary();
      }
    });

    it("owner-binds and claims legacy offline work for the already cached cold-start session", async () => {
      usePlainAuthRoute();
      mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });
      mockGetLocalDataOwnerId.mockResolvedValue(null);
      const hasLegacy = vi
        .spyOn(offlineQueue, "hasUnownedLegacyActionsReady")
        .mockResolvedValue(true);
      const claimLegacy = vi.spyOn(offlineQueue, "claimLegacyActionsForOwner").mockResolvedValue(2);

      try {
        renderHook(() => useAuthSession(false));

        await waitFor(() => expect(claimLegacy).toHaveBeenCalledWith(telegramSession.user.id));
        expect(mockSetLocalDataOwnerId).toHaveBeenCalledWith(telegramSession.user.id);
        expect(mockSetLocalDataOwnerId.mock.invocationCallOrder.at(-1)).toBeLessThan(
          claimLegacy.mock.invocationCallOrder[0]
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
    ])(
      "exits the boundary into explicit recovery after $failure rejects",
      async ({ rejectOwnerBinding }) => {
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
            expect(mockSetLocalDataOwnerId).toHaveBeenCalledWith(telegramSession.user.id)
          );
          if (rejectOwnerBinding) {
            expect(claimLegacy).not.toHaveBeenCalled();
          } else {
            await waitFor(() => expect(claimLegacy).toHaveBeenCalledWith(telegramSession.user.id));
          }
          await waitFor(() =>
            expect(useAppStore.getState().isAccountBoundaryInProgress).toBe(false)
          );

          expect(useAppStore.getState().hasValidSession).toBe(false);
          expect(useAppStore.getState().authBypassFlag).toBe(false);
          expect(useUserDataStore.getState().authGateChecked).toBe(false);
          expect(useAppStore.getState().webOAuthError).toBe(
            AUTH_ACCOUNT_SWITCH_PENDING_WRITES_ERROR
          );
          expect(mockSyncWithCloud).not.toHaveBeenCalled();
          expect(mockClearLocalUserData).not.toHaveBeenCalled();
        } finally {
          hasLegacy.mockRestore();
          claimLegacy.mockRestore();
        }
      }
    );

    it("requires explicit recovery before a later interactive sign-in can claim legacy work", async () => {
      usePlainAuthRoute();
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
      mockGetLocalDataOwnerId.mockResolvedValue(null);
      const hasLegacy = vi
        .spyOn(offlineQueue, "hasUnownedLegacyActionsReady")
        .mockResolvedValue(true);
      const claimLegacy = vi.spyOn(offlineQueue, "claimLegacyActionsForOwner").mockResolvedValue(1);

      try {
        renderHook(() => useAuthSession(false));
        await waitFor(() => expect(mockGetSession).toHaveBeenCalled());

        emitAuthEvent("SIGNED_IN", telegramSession);

        await waitFor(() =>
          expect(useAppStore.getState().webOAuthError).toBe(
            AUTH_ACCOUNT_SWITCH_PENDING_WRITES_ERROR
          )
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

        await waitFor(() => expect(claimLegacy).toHaveBeenCalledWith(telegramSession.user.id));
        await waitFor(() =>
          expect(mockSyncWithCloud).toHaveBeenCalledWith("merge", telegramSession.user.id)
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
        expect(mockSyncWithCloud).toHaveBeenCalledWith("merge", telegramSession.user.id)
      );
      emitAuthEvent("SIGNED_IN", telegramSession);

      expect(mockSyncWithCloud).toHaveBeenCalledTimes(1);
    });

    it("adopts the preserved owner-null local realm after sign-out without clearing it", async () => {
      usePlainAuthRoute();

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() =>
        expect(mockSyncWithCloud).toHaveBeenCalledWith("merge", telegramSession.user.id)
      );

      emitAuthEvent("SIGNED_OUT", null);
      mockLocalOwner.value = null;
      emitAuthEvent("SIGNED_IN", telegramSession);

      await waitFor(() =>
        expect(mockSyncWithCloud).toHaveBeenNthCalledWith(2, "merge", telegramSession.user.id)
      );
      expect(mockClearLocalUserData).not.toHaveBeenCalled();
      expect(mockSetLocalDataOwnerId).toHaveBeenLastCalledWith(telegramSession.user.id);
    });

    it("does not adopt an owner-null realm while installation cleanup is durable", async () => {
      usePlainAuthRoute();
      mockHasPendingInstallationJournalSecurityRemoval.mockResolvedValue(true);

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);

      await waitFor(() =>
        expect(mockHasPendingInstallationJournalSecurityRemoval).toHaveBeenCalled(),
      );
      expect(mockSetLocalDataOwnerId).not.toHaveBeenCalledWith(telegramSession.user.id);
      expect(mockSyncWithCloud).not.toHaveBeenCalled();
      expect(useAppStore.getState().hasValidSession).toBe(false);
    });

    it("reconciles a server removal fence before the first owner-bound sync", async () => {
      usePlainAuthRoute();
      mockResumePendingJournalPasswordRemoval.mockResolvedValue("pending");

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);

      await waitFor(() =>
        expect(mockSetLocalDataOwnerId).toHaveBeenCalledWith(telegramSession.user.id),
      );
      await waitFor(() =>
        expect(mockResumePendingJournalPasswordRemoval).toHaveBeenCalled(),
      );
      expect(mockSyncWithCloud).not.toHaveBeenCalled();
      expect(useAppStore.getState().hasValidSession).toBe(false);
    });

    it("commits an adopted protected realm vault-first before general cloud sync", async () => {
      usePlainAuthRoute();
      mockEnsureOwnerBoundJournalSecurityMigration.mockResolvedValue({
        revision: "101:adopted",
      });

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);

      await waitFor(() =>
        expect(mockRunJournalSecurityMigration).toHaveBeenCalledWith(
          { revision: "101:adopted" },
          telegramSession.user.id,
        ),
      );
      expect(mockEnsureOwnerBoundJournalSecurityMigration).toHaveBeenCalledWith(
        telegramSession.user.id,
      );
      expect(mockSyncWithCloud).not.toHaveBeenCalled();
      expect(useAppStore.getState().hasValidSession).toBe(true);
    });

    it("keeps general sync paused when adopted diary protection cannot finish", async () => {
      usePlainAuthRoute();
      mockEnsureOwnerBoundJournalSecurityMigration.mockResolvedValue({
        revision: "101:adopted",
      });
      mockRunJournalSecurityMigration.mockRejectedValue(new Error("unlock required"));

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);

      await waitFor(() =>
        expect(mockRunJournalSecurityMigration).toHaveBeenCalled(),
      );
      expect(mockSyncWithCloud).not.toHaveBeenCalled();
      expect(useAppStore.getState().hasValidSession).toBe(false);
    });

    it("requires an explicit same-account decision before an imported local backup can sync", async () => {
      usePlainAuthRoute();
      expect(markPendingLocalBackupAccountClaim()).toBe(true);
      expect(markImportedBackupLocalOnlyAccess()).toBe(true);
      const renderedDecisionRevision = readImportedBackupLocalOnlyDecisionRevision();
      expect(renderedDecisionRevision).not.toBeNull();

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);

      await waitFor(() =>
        expect(readImportedBackupAccountClaimLabel(useAppStore.getState().webOAuthError)).toBe(
          "@zen_friend"
        )
      );
      expect(mockSetLocalDataOwnerId).not.toHaveBeenCalled();
      expect(mockSyncWithCloud).not.toHaveBeenCalled();
      expect(readPendingLocalBackupAccountClaim().status).toBe("pending");
      expect(hasImportedBackupLocalOnlyAccess()).toBe(true);

      mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });
      act(() => {
        window.dispatchEvent(
          new CustomEvent(AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CONFIRM_EVENT, {
            detail: {
              expectedOwnerUserId: telegramSession.user.id,
              expectedLocalOnlyDecisionRevision: renderedDecisionRevision,
            },
          })
        );
      });

      await waitFor(() =>
        expect(mockSyncWithCloud).toHaveBeenCalledWith("merge", telegramSession.user.id)
      );
      expect(mockSetLocalDataOwnerId).toHaveBeenLastCalledWith(telegramSession.user.id);
      expect(readPendingLocalBackupAccountClaim().status).toBe("none");

      act(() => {
        window.dispatchEvent(
          new CustomEvent(AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CANCEL_EVENT, {
            detail: {
              accountLabel: "@zen_friend",
              expectedOwnerUserId: telegramSession.user.id,
              expectedLocalOnlyDecisionRevision: renderedDecisionRevision,
            },
          })
        );
      });
      await waitFor(() =>
        expect(useAppStore.getState().webOAuthError).toBe(
          AUTH_IMPORTED_BACKUP_DECISION_ALREADY_SETTLED
        )
      );
      expect(useAppStore.getState().hasValidSession).toBe(false);

      act(() => {
        window.dispatchEvent(new Event(AUTH_IMPORTED_BACKUP_DECISION_SETTLED_ACK_EVENT));
      });
      await waitFor(() => expect(useAppStore.getState().hasValidSession).toBe(true));
      expect(useUserDataStore.getState().authGateChecked).toBe(true);
      expect(mockSyncWithCloud).toHaveBeenCalledTimes(1);
    });

    it("does not apply a decision rendered for account A after the session changes to B", async () => {
      usePlainAuthRoute();
      expect(markPendingLocalBackupAccountClaim()).toBe(true);

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() =>
        expect(readImportedBackupAccountClaimLabel(useAppStore.getState().webOAuthError)).toBe(
          "@zen_friend"
        )
      );
      mockGetSession.mockResolvedValue({ data: { session: secondTelegramSession }, error: null });

      act(() => {
        window.dispatchEvent(
          new CustomEvent(AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CONFIRM_EVENT, {
            detail: { expectedOwnerUserId: telegramSession.user.id },
          })
        );
      });

      await waitFor(() =>
        expect(readImportedBackupAccountClaimLabel(useAppStore.getState().webOAuthError)).toBe(
          "@second_friend"
        )
      );
      expect(mockSetLocalDataOwnerId).not.toHaveBeenCalled();
      expect(mockSyncWithCloud).not.toHaveBeenCalled();
      expect(mockSignOutExpectedOwnerLocally).not.toHaveBeenCalled();
      expect(readPendingLocalBackupAccountClaim().status).toBe("pending");
    });

    it("keeps imported local data unowned when the account choice is cancelled", async () => {
      usePlainAuthRoute();
      expect(markPendingLocalBackupAccountClaim()).toBe(true);

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);

      await waitFor(() =>
        expect(readImportedBackupAccountClaimLabel(useAppStore.getState().webOAuthError)).toBe(
          "@zen_friend"
        )
      );
      mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });
      act(() => {
        window.dispatchEvent(
          new CustomEvent(AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CANCEL_EVENT, {
            detail: {
              accountLabel: "@zen_friend",
              expectedOwnerUserId: telegramSession.user.id,
            },
          })
        );
      });

      await waitFor(() =>
        expect(mockSignOutExpectedOwnerLocally).toHaveBeenCalledWith(telegramSession.user.id)
      );
      expect(mockSetLocalDataOwnerId).not.toHaveBeenCalled();
      expect(mockSyncWithCloud).not.toHaveBeenCalled();
      expect(readPendingLocalBackupAccountClaim().status).toBe("pending");
      expect(hasImportedBackupLocalOnlyAccess()).toBe(true);
      expect(useAppStore.getState().authBypassFlag).toBe(true);
      expect(useUserDataStore.getState().authGateChecked).toBe(true);
      expect(useAppStore.getState().isAccountBoundaryInProgress).toBe(false);
    });

    it("reports first-decision-wins when a stale cancel arrives after another realm settled", async () => {
      usePlainAuthRoute();
      renderHook(() => useAuthSession(false));
      mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });

      act(() => {
        window.dispatchEvent(
          new CustomEvent(AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CANCEL_EVENT, {
            detail: {
              accountLabel: "@zen_friend",
              expectedOwnerUserId: telegramSession.user.id,
            },
          })
        );
      });

      await waitFor(() =>
        expect(useAppStore.getState().webOAuthError).toBe(
          AUTH_IMPORTED_BACKUP_DECISION_ALREADY_SETTLED
        )
      );
      expect(mockSyncWithCloud).not.toHaveBeenCalled();
      expect(mockSignOutExpectedOwnerLocally).not.toHaveBeenCalled();
      expect(useAppStore.getState().hasValidSession).toBe(false);
      expect(useUserDataStore.getState().authGateChecked).toBe(false);

      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
      act(() => {
        window.dispatchEvent(new Event(AUTH_IMPORTED_BACKUP_DECISION_SETTLED_ACK_EVENT));
      });
      await waitFor(() => expect(useAppStore.getState().isAccountBoundaryInProgress).toBe(false));
      expect(useAppStore.getState().hasValidSession).toBe(false);
      expect(useAppStore.getState().authBypassFlag).toBe(false);
      expect(useUserDataStore.getState().authGateChecked).toBe(false);
    });

    it("keeps a stale confirm from overriding a local-only decision completed elsewhere", async () => {
      usePlainAuthRoute();
      expect(markPendingLocalBackupAccountClaim()).toBe(true);
      expect(markImportedBackupLocalOnlyAccess()).toBe(true);
      const staleDecisionRevision = readImportedBackupLocalOnlyDecisionRevision();
      expect(staleDecisionRevision).not.toBeNull();
      expect(markImportedBackupLocalOnlyAccess()).toBe(true);
      expect(readImportedBackupLocalOnlyDecisionRevision()).not.toBe(staleDecisionRevision);
      renderHook(() => useAuthSession(false));
      mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });

      act(() => {
        window.dispatchEvent(
          new CustomEvent(AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CONFIRM_EVENT, {
            detail: {
              accountLabel: "@zen_friend",
              expectedOwnerUserId: telegramSession.user.id,
              expectedLocalOnlyDecisionRevision: staleDecisionRevision,
            },
          })
        );
      });

      await waitFor(() =>
        expect(useAppStore.getState().webOAuthError).toBe(
          AUTH_IMPORTED_BACKUP_DECISION_ALREADY_SETTLED
        )
      );
      expect(mockSyncWithCloud).not.toHaveBeenCalled();
      expect(readPendingLocalBackupAccountClaim().status).toBe("pending");
      expect(hasImportedBackupLocalOnlyAccess()).toBe(true);
    });

    it("repairs imported-backup local access only after proving there is no session", async () => {
      usePlainAuthRoute();
      localStorage.setItem(SK.PENDING_LOCAL_BACKUP_ACCOUNT_CLAIM, "not-json");
      renderHook(() => useAuthSession(false));
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
      const settled = vi.fn();

      act(() => {
        window.dispatchEvent(
          new CustomEvent(AUTH_IMPORTED_BACKUP_LOCAL_RECOVERY_EVENT, {
            detail: { onSettled: settled },
          })
        );
      });

      await waitFor(() => expect(settled).toHaveBeenCalledWith(true));
      expect(readPendingLocalBackupAccountClaim().status).toBe("pending");
      expect(hasImportedBackupLocalOnlyAccess()).toBe(true);
      expect(useAppStore.getState().hasValidSession).toBe(false);
    });

    it("routes local recovery to the account choice when a session is still active", async () => {
      usePlainAuthRoute();
      localStorage.setItem(SK.PENDING_LOCAL_BACKUP_ACCOUNT_CLAIM, "not-json");
      renderHook(() => useAuthSession(false));
      mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });
      const settled = vi.fn();

      act(() => {
        window.dispatchEvent(
          new CustomEvent(AUTH_IMPORTED_BACKUP_LOCAL_RECOVERY_EVENT, {
            detail: { onSettled: settled },
          })
        );
      });

      await waitFor(() => expect(settled).toHaveBeenCalledWith(true));
      expect(readImportedBackupAccountClaimLabel(useAppStore.getState().webOAuthError)).toBe(
        "@zen_friend"
      );
      expect(readPendingLocalBackupAccountClaim().status).toBe("pending");
      expect(hasImportedBackupLocalOnlyAccess()).toBe(true);
      expect(useAppStore.getState().hasValidSession).toBe(false);

      const recoveredDecisionRevision = readImportedBackupLocalOnlyDecisionRevision();
      act(() => {
        window.dispatchEvent(
          new CustomEvent(AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CANCEL_EVENT, {
            detail: {
              accountLabel: "@zen_friend",
              expectedOwnerUserId: telegramSession.user.id,
              expectedLocalOnlyDecisionRevision: recoveredDecisionRevision,
            },
          })
        );
      });
      await waitFor(() =>
        expect(mockSignOutExpectedOwnerLocally).toHaveBeenCalledWith(telegramSession.user.id)
      );
      expect(readPendingLocalBackupAccountClaim().status).toBe("pending");
      expect(hasImportedBackupLocalOnlyAccess()).toBe(true);
      expect(useAppStore.getState().authBypassFlag).toBe(true);
    });

    it("keeps local-only recovery actionable when its durable marker write must be retried", async () => {
      usePlainAuthRoute();
      expect(markPendingLocalBackupAccountClaim()).toBe(true);

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() =>
        expect(readImportedBackupAccountClaim(useAppStore.getState().webOAuthError)?.state).toBe(
          "choice"
        )
      );
      mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });

      const originalSetItem = Storage.prototype.setItem;
      const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
        this: Storage,
        key: string,
        value: string
      ) {
        if (key === SK.IMPORTED_BACKUP_LOCAL_ONLY_ACCESS) {
          throw new DOMException("storage unavailable", "SecurityError");
        }
        return originalSetItem.call(this, key, value);
      });

      act(() => {
        window.dispatchEvent(
          new CustomEvent(AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CANCEL_EVENT, {
            detail: {
              accountLabel: "@zen_friend",
              expectedOwnerUserId: telegramSession.user.id,
            },
          })
        );
      });

      await waitFor(() =>
        expect(readImportedBackupAccountClaim(useAppStore.getState().webOAuthError)?.state).toBe(
          "action-failed"
        )
      );
      expect(hasImportedBackupLocalOnlyAccess()).toBe(false);
      expect(useAppStore.getState().authBypassFlag).toBe(false);

      setItem.mockRestore();
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
      act(() => {
        window.dispatchEvent(
          new CustomEvent(AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CANCEL_EVENT, {
            detail: { expectedOwnerUserId: telegramSession.user.id },
          })
        );
      });

      await waitFor(() => expect(hasImportedBackupLocalOnlyAccess()).toBe(true));
      expect(useAppStore.getState().webOAuthError).toBeNull();
      expect(useAppStore.getState().authBypassFlag).toBe(true);
      expect(useUserDataStore.getState().authGateChecked).toBe(true);
    });

    it("returns a failed imported-backup claim to its specific account choice", async () => {
      usePlainAuthRoute();
      expect(markPendingLocalBackupAccountClaim()).toBe(true);
      mockSetLocalDataOwnerId.mockRejectedValueOnce(new Error("owner binding unavailable"));

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() =>
        expect(readImportedBackupAccountClaimLabel(useAppStore.getState().webOAuthError)).toBe(
          "@zen_friend"
        )
      );
      mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });

      act(() => {
        window.dispatchEvent(
          new CustomEvent(AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CONFIRM_EVENT, {
            detail: { expectedOwnerUserId: telegramSession.user.id },
          })
        );
      });

      await waitFor(() => expect(useAppStore.getState().isAccountBoundaryInProgress).toBe(false));
      expect(readImportedBackupAccountClaimLabel(useAppStore.getState().webOAuthError)).toBe(
        "@zen_friend"
      );
      expect(mockSyncWithCloud).not.toHaveBeenCalled();
      expect(getAccountCleanupRecovery()).toBeNull();
      expect(readPendingLocalBackupAccountClaim().status).toBe("pending");
    });

    it("rolls owner binding back and keeps the claim gated when its marker cannot be cleared", async () => {
      usePlainAuthRoute();
      expect(markPendingLocalBackupAccountClaim()).toBe(true);
      const removeItem = Storage.prototype.removeItem;
      const removeSpy = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (
        this: Storage,
        key: string
      ) {
        if (key === SK.PENDING_LOCAL_BACKUP_ACCOUNT_CLAIM) {
          throw new DOMException("Storage removal blocked", "SecurityError");
        }
        return removeItem.call(this, key);
      });

      try {
        renderHook(() => useAuthSession(false));
        emitAuthEvent("SIGNED_IN", telegramSession);
        await waitFor(() =>
          expect(readImportedBackupAccountClaimLabel(useAppStore.getState().webOAuthError)).toBe(
            "@zen_friend"
          )
        );
        mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });

        act(() => {
          window.dispatchEvent(
            new CustomEvent(AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CONFIRM_EVENT, {
              detail: { expectedOwnerUserId: telegramSession.user.id },
            })
          );
        });

        await waitFor(() => expect(mockClearLocalDataOwnerId).toHaveBeenCalledTimes(1));
        expect(mockSyncWithCloud).not.toHaveBeenCalled();
        expect(mockLocalOwner.value).toBeNull();
        expect(readPendingLocalBackupAccountClaim().status).not.toBe("none");
        expect(useAppStore.getState().hasValidSession).toBe(false);
      } finally {
        removeSpy.mockRestore();
      }
    });

    it("shows a recoverable save outcome when the first account backup cannot finish", async () => {
      usePlainAuthRoute();
      expect(markPendingLocalBackupAccountClaim()).toBe(true);
      mockSyncWithCloud.mockRejectedValueOnce(new Error("network unavailable"));

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() =>
        expect(readImportedBackupAccountClaimLabel(useAppStore.getState().webOAuthError)).toBe(
          "@zen_friend"
        )
      );
      mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });

      act(() => {
        window.dispatchEvent(
          new CustomEvent(AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CONFIRM_EVENT, {
            detail: {
              accountLabel: "@zen_friend",
              expectedOwnerUserId: telegramSession.user.id,
            },
          })
        );
      });

      await waitFor(() =>
        expect(readImportedBackupAccountClaim(useAppStore.getState().webOAuthError)?.state).toBe(
          "save-failed"
        )
      );
      expect(useAppStore.getState().hasValidSession).toBe(false);
      expect(mockStartAutoSync).not.toHaveBeenCalled();

      act(() => {
        window.dispatchEvent(
          new CustomEvent(AUTH_IMPORTED_BACKUP_SAVE_CONTINUE_EVENT, {
            detail: {
              accountLabel: "@zen_friend",
              expectedOwnerUserId: telegramSession.user.id,
            },
          })
        );
      });

      await waitFor(() => expect(useAppStore.getState().hasValidSession).toBe(true));
      expect(mockStartAutoSync).toHaveBeenCalled();
    });

    it("does not continue a stale imported-backup save after session A changes to B", async () => {
      usePlainAuthRoute();
      expect(markPendingLocalBackupAccountClaim()).toBe(true);
      mockSyncWithCloud.mockRejectedValueOnce(new Error("network unavailable"));

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() =>
        expect(readImportedBackupAccountClaimLabel(useAppStore.getState().webOAuthError)).toBe(
          "@zen_friend"
        )
      );
      mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });
      act(() => {
        window.dispatchEvent(
          new CustomEvent(AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CONFIRM_EVENT, {
            detail: {
              accountLabel: "@zen_friend",
              expectedOwnerUserId: telegramSession.user.id,
            },
          })
        );
      });
      await waitFor(() =>
        expect(readImportedBackupAccountClaim(useAppStore.getState().webOAuthError)?.state).toBe(
          "save-failed"
        )
      );

      let releaseOwnerRead!: (owner: string | null) => void;
      mockGetLocalDataOwnerId.mockImplementationOnce(
        () => new Promise((resolve) => { releaseOwnerRead = resolve; })
      );
      act(() => {
        window.dispatchEvent(
          new CustomEvent(AUTH_IMPORTED_BACKUP_SAVE_CONTINUE_EVENT, {
            detail: {
              accountLabel: "@zen_friend",
              expectedOwnerUserId: telegramSession.user.id,
            },
          })
        );
      });
      await waitFor(() => expect(releaseOwnerRead).toBeTypeOf("function"));
      mockGetSession.mockResolvedValue({ data: { session: secondTelegramSession }, error: null });
      act(() => releaseOwnerRead(telegramSession.user.id));

      await waitFor(() => expect(useAppStore.getState().isAccountBoundaryInProgress).toBe(false));
      expect(useAppStore.getState().hasValidSession).toBe(false);
      expect(mockStartAutoSync).not.toHaveBeenCalled();
    });

    it("explains a failed device-only sign-out without attaching or removing the backup", async () => {
      usePlainAuthRoute();
      expect(markPendingLocalBackupAccountClaim()).toBe(true);
      mockSignOutExpectedOwnerLocally.mockResolvedValueOnce({
        status: "owner-changed",
        userId: secondTelegramSession.user.id,
      });

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() =>
        expect(readImportedBackupAccountClaimLabel(useAppStore.getState().webOAuthError)).toBe(
          "@zen_friend"
        )
      );
      mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });

      act(() => {
        window.dispatchEvent(
          new CustomEvent(AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CANCEL_EVENT, {
            detail: {
              accountLabel: "@zen_friend",
              expectedOwnerUserId: telegramSession.user.id,
            },
          })
        );
      });

      await waitFor(() =>
        expect(readImportedBackupAccountClaim(useAppStore.getState().webOAuthError)?.state).toBe(
          "action-failed"
        )
      );
      expect(mockSetLocalDataOwnerId).not.toHaveBeenCalled();
      expect(mockSyncWithCloud).not.toHaveBeenCalled();
      expect(readPendingLocalBackupAccountClaim().status).toBe("pending");
    });

    it("accepts only the first imported-backup decision while cancellation is pending", async () => {
      usePlainAuthRoute();
      expect(markPendingLocalBackupAccountClaim()).toBe(true);
      let finishSignOut!: () => void;
      mockSignOutExpectedOwnerLocally.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishSignOut = () => resolve({ status: "signed-out" as const });
          })
      );

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() =>
        expect(readImportedBackupAccountClaimLabel(useAppStore.getState().webOAuthError)).toBe(
          "@zen_friend"
        )
      );
      mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });

      act(() => {
        window.dispatchEvent(
          new CustomEvent(AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CANCEL_EVENT, {
            detail: { expectedOwnerUserId: telegramSession.user.id },
          })
        );
        window.dispatchEvent(
          new CustomEvent(AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CONFIRM_EVENT, {
            detail: { expectedOwnerUserId: telegramSession.user.id },
          })
        );
      });
      await waitFor(() =>
        expect(mockSignOutExpectedOwnerLocally).toHaveBeenCalledWith(telegramSession.user.id)
      );
      expect(mockSyncWithCloud).not.toHaveBeenCalled();
      expect(mockSetLocalDataOwnerId).not.toHaveBeenCalled();

      await act(async () => {
        finishSignOut();
      });
      await waitFor(() => expect(useAppStore.getState().authBypassFlag).toBe(true));
      expect(readPendingLocalBackupAccountClaim().status).toBe("pending");
    });

    it("keeps an owner-null sign-in gated until its local owner binding succeeds", async () => {
      usePlainAuthRoute();
      mockSetLocalDataOwnerId.mockRejectedValueOnce(new Error("local owner binding failed"));
      mockGetSession.mockResolvedValue({
        data: { session: telegramSession },
        error: null,
      });

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);

      await waitFor(() => expect(getAccountCleanupRecovery()).not.toBeNull());
      expect(mockSyncWithCloud).not.toHaveBeenCalled();
      expect(useAppStore.getState().hasValidSession).toBe(false);
      expect(useAppStore.getState().isAccountBoundaryInProgress).toBe(true);

      await act(async () => {
        await getAccountCleanupRecovery()?.retry();
      });

      await waitFor(() =>
        expect(mockSyncWithCloud).toHaveBeenCalledWith("merge", telegramSession.user.id)
      );
      expect(useAppStore.getState().hasValidSession).toBe(true);
      expect(mockLocalOwner.value).toBe(telegramSession.user.id);
      expect(getAccountCleanupRecovery()).toBeNull();
    });

    it("stops the previous owner's auto-sync synchronously before an unresolved account preflight", async () => {
      usePlainAuthRoute();

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() =>
        expect(mockSyncWithCloud).toHaveBeenCalledWith("merge", telegramSession.user.id)
      );

      let resolvePreflight!: (result: { status: "none" }) => void;
      const preflight = new Promise<{ status: "none" }>((resolve) => {
        resolvePreflight = resolve;
      });
      mockReconcilePendingAccountSignOutCleanup.mockReturnValueOnce(preflight);
      mockStopAutoSync.mockClear();
      mockNotifyAccountSessionTransition.mockClear();

      act(() => {
        emitAuthEvent("SIGNED_IN", secondTelegramSession);
      });

      expect(mockNotifyAccountSessionTransition).toHaveBeenCalledTimes(1);
      expect(mockStopAutoSync).toHaveBeenCalledTimes(1);
      expect(mockNotifyAccountSessionTransition.mock.invocationCallOrder[0]).toBeLessThan(
        mockStopAutoSync.mock.invocationCallOrder[0]
      );
      expect(mockSyncWithCloud).not.toHaveBeenCalledWith("replace", secondTelegramSession.user.id);

      await act(async () => {
        resolvePreflight({ status: "none" });
        await preflight;
      });
      await waitFor(() =>
        expect(mockSyncWithCloud).toHaveBeenCalledWith("replace", secondTelegramSession.user.id)
      );
    });

    it("uses replace mode on account switch", async () => {
      usePlainAuthRoute();

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() =>
        expect(mockSyncWithCloud).toHaveBeenCalledWith("merge", telegramSession.user.id)
      );
      mockTriggerDataRefresh.mockClear();

      emitAuthEvent("SIGNED_IN", secondTelegramSession);

      await waitFor(() =>
        expect(mockSyncWithCloud).toHaveBeenCalledWith("replace", secondTelegramSession.user.id)
      );
      expect(mockSyncWithCloud).toHaveBeenNthCalledWith(
        2,
        "replace",
        secondTelegramSession.user.id
      );
      expect(mockQuiesceCloudSync).toHaveBeenCalledTimes(1);
      expect(mockLeavePresenceForAccountBoundary).toHaveBeenCalledWith(telegramSession.user.id);
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
      expect(mockCommitPendingAccountSwitchCleanup).toHaveBeenCalledWith(
        telegramSession.user.id,
        secondTelegramSession.user.id,
        expect.any(Function)
      );
      expect(mockCommitPendingAccountSwitchCleanup.mock.invocationCallOrder[0]).toBeLessThan(
        mockClearLocalUserData.mock.invocationCallOrder[0]
      );
      expect(mockClearLocalUserData.mock.invocationCallOrder[0]).toBeLessThan(
        mockSyncWithCloud.mock.invocationCallOrder[1]
      );
    });

    it("stops before destructive account-switch cleanup when durable intent cannot be persisted", async () => {
      usePlainAuthRoute();
      mockGetLocalDataOwnerId.mockResolvedValue(telegramSession.user.id);
      mockCommitPendingAccountSwitchCleanup.mockResolvedValueOnce(false);

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() =>
        expect(mockSyncWithCloud).toHaveBeenCalledWith("merge", telegramSession.user.id)
      );

      emitAuthEvent("SIGNED_IN", secondTelegramSession);

      await waitFor(() => expect(mockAuthSignOut).toHaveBeenCalledWith({ scope: "local" }));
      expect(mockClearLocalUserData).not.toHaveBeenCalled();
      expect(mockSetLocalDataOwnerId).not.toHaveBeenCalledWith(secondTelegramSession.user.id);
      expect(mockSyncWithCloud).not.toHaveBeenCalledWith("replace", secondTelegramSession.user.id);
      expect(mockResumeCloudSync).toHaveBeenCalledTimes(1);
      expect(offlineQueue.resumeAfterAccountBoundary).toHaveBeenCalledTimes(1);
      expect(useAppStore.getState().hasValidSession).toBe(false);
    });

    it("finishes the account boundary when a duplicate auth event arrives for the same new user", async () => {
      usePlainAuthRoute();
      let releaseBoundarySuspension!: () => void;
      const suspendForBoundary = vi
        .spyOn(offlineQueue, "suspendForAccountBoundary")
        .mockImplementationOnce(() => {
          mockQueueBoundaryEpoch.value += 1;
          mockQueueBoundarySuspended.value = true;
          return new Promise<void>((resolve) => {
            releaseBoundarySuspension = resolve;
          });
        });
      const resumeAfterBoundary = vi.spyOn(offlineQueue, "resumeAfterAccountBoundary");

      try {
        renderHook(() => useAuthSession(false));
        emitAuthEvent("SIGNED_IN", telegramSession);
        await waitFor(() =>
          expect(mockSyncWithCloud).toHaveBeenCalledWith("merge", telegramSession.user.id)
        );

        emitAuthEvent("SIGNED_IN", secondTelegramSession);
        await waitFor(() => expect(suspendForBoundary).toHaveBeenCalledTimes(1));

        emitAuthEvent("TOKEN_REFRESHED", secondTelegramSession);
        act(() => releaseBoundarySuspension());

        await waitFor(() =>
          expect(mockSyncWithCloud).toHaveBeenCalledWith("replace", secondTelegramSession.user.id)
        );
        await waitFor(() => expect(mockResumeCloudSync).toHaveBeenCalledTimes(1));
        expect(resumeAfterBoundary).toHaveBeenCalledTimes(1);
        expect(useAppStore.getState().hasValidSession).toBe(true);
      } finally {
        suspendForBoundary.mockRestore();
        resumeAfterBoundary.mockRestore();
      }
    });

    it("rechecks account A writes before resuming a duplicate account B transition", async () => {
      usePlainAuthRoute();
      let releaseBoundarySuspension!: () => void;
      const pendingForOwner = vi
        .spyOn(offlineQueue, "hasPendingActionsForOwnerReady")
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true)
        .mockResolvedValue(true);
      const suspendForBoundary = vi
        .spyOn(offlineQueue, "suspendForAccountBoundary")
        .mockImplementationOnce(() => {
          mockQueueBoundaryEpoch.value += 1;
          mockQueueBoundarySuspended.value = true;
          return new Promise<void>((resolve) => {
            releaseBoundarySuspension = resolve;
          });
        });
      const discardSuspended = vi.spyOn(offlineQueue, "discardSuspendedActionsForAccountBoundary");
      const resumeAfterBoundary = vi.spyOn(offlineQueue, "resumeAfterAccountBoundary");

      try {
        renderHook(() => useAuthSession(false));
        emitAuthEvent("SIGNED_IN", telegramSession);
        await waitFor(() =>
          expect(mockSyncWithCloud).toHaveBeenCalledWith("merge", telegramSession.user.id)
        );

        emitAuthEvent("SIGNED_IN", secondTelegramSession);
        await waitFor(() => expect(suspendForBoundary).toHaveBeenCalledTimes(1));
        emitAuthEvent("TOKEN_REFRESHED", secondTelegramSession);
        act(() => releaseBoundarySuspension());

        await waitFor(() => expect(mockAuthSignOut).toHaveBeenCalledWith({ scope: "local" }));
        await waitFor(() => expect(mockResumeCloudSync).toHaveBeenCalledTimes(1));
        expect(pendingForOwner).toHaveBeenCalledTimes(3);
        expect(pendingForOwner.mock.invocationCallOrder[1]).toBeLessThan(
          mockResumeCloudSync.mock.invocationCallOrder[0]
        );
        expect(pendingForOwner.mock.invocationCallOrder[1]).toBeLessThan(
          resumeAfterBoundary.mock.invocationCallOrder[0]
        );
        expect(discardSuspended).not.toHaveBeenCalled();
        expect(mockClearLocalUserData).not.toHaveBeenCalled();
        expect(mockSyncWithCloud).not.toHaveBeenCalledWith(
          "replace",
          secondTelegramSession.user.id
        );
        expect(useAppStore.getState().hasValidSession).toBe(false);
      } finally {
        pendingForOwner.mockRestore();
        suspendForBoundary.mockRestore();
        discardSuspended.mockRestore();
        resumeAfterBoundary.mockRestore();
      }
    });

    it("does not admit account B until account A Presence teardown is acknowledged", async () => {
      usePlainAuthRoute();
      let releasePresence!: () => void;
      mockLeavePresenceForAccountBoundary.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releasePresence = () => resolve({ status: "removed" });
          })
      );

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() =>
        expect(mockSyncWithCloud).toHaveBeenCalledWith("merge", telegramSession.user.id)
      );
      await waitFor(() => expect(mockJoinPresence).toHaveBeenCalledTimes(1));

      emitAuthEvent("SIGNED_IN", secondTelegramSession);
      await waitFor(() =>
        expect(mockLeavePresenceForAccountBoundary).toHaveBeenCalledWith(telegramSession.user.id)
      );

      expect(mockSyncWithCloud).not.toHaveBeenCalledWith("replace", secondTelegramSession.user.id);
      expect(mockJoinPresence).toHaveBeenCalledTimes(1);

      releasePresence();

      await waitFor(() =>
        expect(mockSyncWithCloud).toHaveBeenCalledWith("replace", secondTelegramSession.user.id)
      );
      await waitFor(() => expect(mockJoinPresence).toHaveBeenCalledTimes(2));
    });

    it("keeps account B gated when account A Presence teardown fails", async () => {
      usePlainAuthRoute();

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() =>
        expect(mockSyncWithCloud).toHaveBeenCalledWith("merge", telegramSession.user.id)
      );
      await waitFor(() => expect(mockJoinPresence).toHaveBeenCalledTimes(1));

      mockLeavePresenceForAccountBoundary.mockRejectedValueOnce(
        new Error("Presence teardown was not acknowledged")
      );
      emitAuthEvent("SIGNED_IN", secondTelegramSession);

      await waitFor(() =>
        expect(mockLeavePresenceForAccountBoundary).toHaveBeenCalledWith(telegramSession.user.id)
      );
      expect(mockSyncWithCloud).not.toHaveBeenCalledWith("replace", secondTelegramSession.user.id);
      expect(mockJoinPresence).toHaveBeenCalledTimes(1);
      expect(useAppStore.getState().hasValidSession).toBe(false);
    });

    it("keeps the app gated until an account switch has purged the previous user's data", async () => {
      usePlainAuthRoute();
      let releaseBoundaryCleanup!: () => void;
      mockClearLocalUserData.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            releaseBoundaryCleanup = resolve;
          })
      );

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() =>
        expect(mockSyncWithCloud).toHaveBeenCalledWith("merge", telegramSession.user.id)
      );
      act(() => useAppStore.getState().setHasValidSession(true));
      expect(useAppStore.getState().hasValidSession).toBe(true);

      emitAuthEvent("SIGNED_IN", secondTelegramSession);
      await waitFor(() => expect(mockClearLocalUserData).toHaveBeenCalledTimes(1));

      expect(useAppStore.getState().hasValidSession).toBe(false);

      releaseBoundaryCleanup();
      await waitFor(() =>
        expect(mockSyncWithCloud).toHaveBeenCalledWith("replace", secondTelegramSession.user.id)
      );
      await waitFor(() => expect(useAppStore.getState().hasValidSession).toBe(true));
    });

    it("does not reopen the app when sign-out supersedes a slow account switch", async () => {
      usePlainAuthRoute();
      let releaseBoundaryCleanup!: () => void;
      mockClearLocalUserData.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            releaseBoundaryCleanup = resolve;
          })
      );

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() =>
        expect(mockSyncWithCloud).toHaveBeenCalledWith("merge", telegramSession.user.id)
      );
      act(() => useAppStore.getState().setHasValidSession(true));

      emitAuthEvent("SIGNED_IN", secondTelegramSession);
      await waitFor(() => expect(mockClearLocalUserData).toHaveBeenCalledTimes(1));
      emitAuthEvent("SIGNED_OUT", null);

      expect(mockResumeCloudSync).not.toHaveBeenCalled();
      expect(offlineQueue.resumeAfterAccountBoundary).not.toHaveBeenCalled();
      releaseBoundaryCleanup();

      await waitFor(() => expect(useAppStore.getState().hasValidSession).toBe(false));
      await waitFor(() => expect(mockResumeCloudSync).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(offlineQueue.resumeAfterAccountBoundary).toHaveBeenCalledTimes(1));
      expect(mockSetLocalDataOwnerId).toHaveBeenCalledWith(secondTelegramSession.user.id);
      expect(mockSyncWithCloud).not.toHaveBeenCalledWith("replace", secondTelegramSession.user.id);
      expect(useAppStore.getState().isAccountBoundaryInProgress).toBe(false);
      expect(getAccountCleanupRecovery()).toBeNull();
      expect(useAppStore.getState().hasValidSession).toBe(false);
    });

    it("resumes inherited writer suspension before readmitting the persisted owner", async () => {
      usePlainAuthRoute();
      mockGetLocalDataOwnerId.mockResolvedValue(telegramSession.user.id);
      let releaseOldBoundary!: () => void;
      const oldBoundaryGate = new Promise<void>((resolve) => {
        releaseOldBoundary = resolve;
      });
      mockClearAccountNotificationsForBoundary
        .mockImplementationOnce(() => oldBoundaryGate)
        .mockResolvedValue(undefined);

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() =>
        expect(mockSyncWithCloud).toHaveBeenCalledWith("merge", telegramSession.user.id)
      );

      emitAuthEvent("SIGNED_IN", secondTelegramSession);
      await waitFor(() => expect(offlineQueue.suspendForAccountBoundary).toHaveBeenCalled());
      await waitFor(() =>
        expect(mockClearAccountNotificationsForBoundary).toHaveBeenCalledTimes(1)
      );
      expect(mockCloudBoundarySuspended.value).toBe(true);
      expect(mockQueueBoundarySuspended.value).toBe(true);

      emitAuthEvent("SIGNED_IN", telegramSession);
      act(() => releaseOldBoundary());

      await waitFor(() => expect(mockResumeCloudSync).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(offlineQueue.resumeAfterAccountBoundary).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(useAppStore.getState().hasValidSession).toBe(true));
      expect(mockResumeCloudSync.mock.invocationCallOrder[0]).toBeLessThan(
        mockSyncWithCloud.mock.invocationCallOrder.at(-1) ?? Number.MAX_SAFE_INTEGER
      );
      expect(mockCloudBoundarySuspended.value).toBe(false);
      expect(mockQueueBoundarySuspended.value).toBe(false);

      expect(mockSetLocalDataOwnerId).not.toHaveBeenCalledWith(secondTelegramSession.user.id);
    });

    it("transfers one owned writer suspension across an A to B to C supersession", async () => {
      usePlainAuthRoute();
      mockGetLocalDataOwnerId.mockResolvedValue(telegramSession.user.id);
      const thirdTelegramSession = {
        user: {
          ...telegramSession.user,
          id: "323e4567-e89b-12d3-a456-426614174000",
        },
      };
      let releaseOldBoundary!: () => void;
      const oldBoundaryGate = new Promise<void>((resolve) => {
        releaseOldBoundary = resolve;
      });
      mockClearAccountNotificationsForBoundary
        .mockImplementationOnce(() => oldBoundaryGate)
        .mockResolvedValue(undefined);

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() =>
        expect(mockSyncWithCloud).toHaveBeenCalledWith("merge", telegramSession.user.id)
      );

      emitAuthEvent("SIGNED_IN", secondTelegramSession);
      await waitFor(() => expect(offlineQueue.suspendForAccountBoundary).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(mockClearAccountNotificationsForBoundary).toHaveBeenCalledTimes(1)
      );

      emitAuthEvent("SIGNED_IN", thirdTelegramSession);
      act(() => releaseOldBoundary());

      await waitFor(() =>
        expect(mockSetLocalDataOwnerId).toHaveBeenCalledWith(thirdTelegramSession.user.id)
      );
      await waitFor(() => expect(useAppStore.getState().hasValidSession).toBe(true));
      expect(mockQuiesceCloudSync).toHaveBeenCalledTimes(1);
      expect(offlineQueue.suspendForAccountBoundary).toHaveBeenCalledTimes(1);
      expect(mockResumeCloudSync).toHaveBeenCalledTimes(1);
      expect(offlineQueue.resumeAfterAccountBoundary).toHaveBeenCalledTimes(1);
      expect(mockSyncWithCloud).not.toHaveBeenCalledWith("replace", secondTelegramSession.user.id);
      expect(mockSyncWithCloud).toHaveBeenCalledWith("replace", thirdTelegramSession.user.id);
      expect(mockCloudBoundarySuspended.value).toBe(false);
      expect(mockQueueBoundarySuspended.value).toBe(false);
    });

    it("does not admit or resume a session while another cleanup owns writer suspension", async () => {
      usePlainAuthRoute();
      mockGetLocalDataOwnerId.mockResolvedValue(telegramSession.user.id);
      mockCloudBoundarySuspended.value = true;
      mockQueueBoundarySuspended.value = true;

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);

      await waitFor(() => expect(mockGetLocalDataOwnerId).toHaveBeenCalled());
      await Promise.resolve();

      expect(mockSyncWithCloud).not.toHaveBeenCalled();
      expect(mockStartAutoSync).not.toHaveBeenCalled();
      expect(mockResumeCloudSync).not.toHaveBeenCalled();
      expect(offlineQueue.resumeAfterAccountBoundary).not.toHaveBeenCalled();
      expect(useAppStore.getState().hasValidSession).toBe(false);
      expect(mockCloudBoundarySuspended.value).toBe(true);
      expect(mockQueueBoundarySuspended.value).toBe(true);
    });

    it("stops before destructive cleanup when another coordinator supersedes writer suspension", async () => {
      usePlainAuthRoute();
      mockGetLocalDataOwnerId.mockResolvedValue(telegramSession.user.id);
      let releaseOldBoundary!: () => void;
      const oldBoundaryGate = new Promise<void>((resolve) => {
        releaseOldBoundary = resolve;
      });
      mockClearAccountNotificationsForBoundary
        .mockImplementationOnce(() => oldBoundaryGate)
        .mockResolvedValue(undefined);

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() =>
        expect(mockSyncWithCloud).toHaveBeenCalledWith("merge", telegramSession.user.id)
      );

      emitAuthEvent("SIGNED_IN", secondTelegramSession);
      await waitFor(() => expect(offlineQueue.suspendForAccountBoundary).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(mockClearAccountNotificationsForBoundary).toHaveBeenCalledTimes(1)
      );

      // A separate account-cleanup coordinator suspended and then resumed both
      // writers. The booleans alone now look safe, but the changed epochs prove
      // that this hook no longer owns the destructive boundary.
      mockCloudBoundaryEpoch.value += 2;
      mockQueueBoundaryEpoch.value += 2;
      mockCloudBoundarySuspended.value = false;
      mockQueueBoundarySuspended.value = false;
      act(() => releaseOldBoundary());

      await waitFor(() => expect(mockAuthSignOut).toHaveBeenCalledWith({ scope: "local" }));
      expect(mockClearLocalUserData).not.toHaveBeenCalled();
      expect(mockSetLocalDataOwnerId).not.toHaveBeenCalledWith(secondTelegramSession.user.id);
      expect(mockSyncWithCloud).not.toHaveBeenCalledWith("replace", secondTelegramSession.user.id);
      expect(mockResumeCloudSync).not.toHaveBeenCalled();
      expect(offlineQueue.resumeAfterAccountBoundary).not.toHaveBeenCalled();
      expect(useAppStore.getState().hasValidSession).toBe(false);
      expect(mockCloudBoundarySuspended.value).toBe(false);
      expect(mockQueueBoundarySuspended.value).toBe(false);

      await waitFor(() => expect(getAccountCleanupRecovery()).not.toBeNull());
      emitAuthEvent("SIGNED_OUT", null);

      await waitFor(() => expect(useAppStore.getState().isAccountBoundaryInProgress).toBe(true));
      expect(getAccountCleanupRecovery()).not.toBeNull();
      expect(mockResumeCloudSync).not.toHaveBeenCalled();
      expect(offlineQueue.resumeAfterAccountBoundary).not.toHaveBeenCalled();
    });

    it("finishes an in-progress destructive owner bind before the successor switch", async () => {
      usePlainAuthRoute();
      const thirdTelegramSession = {
        user: {
          ...telegramSession.user,
          id: "323e4567-e89b-12d3-a456-426614174000",
        },
      };
      let releaseBoundaryCleanup!: () => void;
      let localOwnerUserId: string | null = telegramSession.user.id;
      mockGetLocalDataOwnerId.mockImplementation(async () => localOwnerUserId);
      mockSetLocalDataOwnerId.mockImplementation(async (ownerUserId: string) => {
        localOwnerUserId = ownerUserId;
      });
      mockClearLocalUserData
        .mockImplementationOnce(async () => {
          localOwnerUserId = null;
          await new Promise<void>((resolve) => {
            releaseBoundaryCleanup = resolve;
          });
        })
        .mockImplementation(async () => {
          localOwnerUserId = null;
        });

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() =>
        expect(mockSyncWithCloud).toHaveBeenCalledWith("merge", telegramSession.user.id)
      );

      emitAuthEvent("SIGNED_IN", secondTelegramSession);
      await waitFor(() => expect(mockClearLocalUserData).toHaveBeenCalledTimes(1));
      emitAuthEvent("SIGNED_IN", thirdTelegramSession);
      releaseBoundaryCleanup();

      await waitFor(() =>
        expect(mockSetLocalDataOwnerId).toHaveBeenCalledWith(thirdTelegramSession.user.id)
      );
      const boundaryBinds = mockSetLocalDataOwnerId.mock.calls
        .map(([ownerUserId]) => ownerUserId)
        .filter(
          (ownerUserId) =>
            ownerUserId === secondTelegramSession.user.id ||
            ownerUserId === thirdTelegramSession.user.id
        );
      expect(boundaryBinds).toEqual([secondTelegramSession.user.id, thirdTelegramSession.user.id]);
      expect(localOwnerUserId).toBe(thirdTelegramSession.user.id);
      expect(mockSyncWithCloud).not.toHaveBeenCalledWith("replace", secondTelegramSession.user.id);
      expect(mockSyncWithCloud).toHaveBeenCalledWith("replace", thirdTelegramSession.user.id);
      expect(useAppStore.getState().hasValidSession).toBe(true);
    });

    it("closes the new session when account-boundary cleanup cannot be proven", async () => {
      usePlainAuthRoute();
      mockClearLocalUserData.mockRejectedValueOnce(new Error("purge failed"));

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() => expect(mockSyncWithCloud).toHaveBeenCalledTimes(1));

      emitAuthEvent("SIGNED_IN", secondTelegramSession);

      await waitFor(() => expect(mockAuthSignOut).toHaveBeenCalledWith({ scope: "local" }));
      expect(mockSyncWithCloud).toHaveBeenCalledTimes(1);
      expect(useAppStore.getState().hasValidSession).toBe(false);
      expect(useUserDataStore.getState().authGateChecked).toBe(false);
      expect(mockResumeCloudSync).not.toHaveBeenCalled();
    });

    it("restores account A writers after closing B when native journal cleanup fails", async () => {
      usePlainAuthRoute();
      mockGetLocalDataOwnerId.mockResolvedValue(telegramSession.user.id);
      mockClearNativeJournalBiometricCredential.mockRejectedValueOnce(
        new Error("native journal credential delete failed")
      );

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() => expect(mockSyncWithCloud).toHaveBeenCalledTimes(1));

      emitAuthEvent("SIGNED_IN", secondTelegramSession);

      await waitFor(() => expect(mockAuthSignOut).toHaveBeenCalledWith({ scope: "local" }));
      expect(mockClearLocalUserData).not.toHaveBeenCalled();
      expect(mockSetLocalDataOwnerId).not.toHaveBeenCalledWith(secondTelegramSession.user.id);
      expect(mockSyncWithCloud).toHaveBeenCalledTimes(1);
      expect(useAppStore.getState().hasValidSession).toBe(false);
      expect(useUserDataStore.getState().authGateChecked).toBe(false);
      expect(mockResumeCloudSync).toHaveBeenCalledTimes(1);
      expect(offlineQueue.resumeAfterAccountBoundary).toHaveBeenCalledTimes(1);
      expect(useAppStore.getState().isAccountBoundaryInProgress).toBe(false);
      expect(getAccountCleanupRecovery()).toBeNull();
    });

    it("keeps B closed when A push revocation is neither remotely nor natively confirmed", async () => {
      usePlainAuthRoute();
      mockGetLocalDataOwnerId.mockResolvedValue(telegramSession.user.id);
      mockRevokePushForAccountBoundary.mockResolvedValueOnce({
        status: "partial",
        remote: "failed",
        native: "owner-changed",
      });

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() => expect(mockSyncWithCloud).toHaveBeenCalledTimes(1));

      emitAuthEvent("SIGNED_IN", secondTelegramSession);

      await waitFor(() => expect(mockAuthSignOut).toHaveBeenCalledWith({ scope: "local" }));
      expect(mockClearLocalUserData).not.toHaveBeenCalled();
      expect(mockSetLocalDataOwnerId).not.toHaveBeenCalledWith(secondTelegramSession.user.id);
      expect(mockSyncWithCloud).toHaveBeenCalledTimes(1);
      expect(useAppStore.getState().hasValidSession).toBe(false);
      expect(useUserDataStore.getState().authGateChecked).toBe(false);
      expect(mockResumeCloudSync).toHaveBeenCalledTimes(1);
      expect(offlineQueue.resumeAfterAccountBoundary).toHaveBeenCalledTimes(1);
      expect(useAppStore.getState().isAccountBoundaryInProgress).toBe(false);
    });

    it("keeps B closed when A push revocation is not remotely confirmed even if native unregister returns", async () => {
      usePlainAuthRoute();
      mockGetLocalDataOwnerId.mockResolvedValue(telegramSession.user.id);
      mockRevokePushForAccountBoundary.mockResolvedValueOnce({
        status: "partial",
        remote: "failed",
        native: "unregistered",
      });

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() => expect(mockSyncWithCloud).toHaveBeenCalledTimes(1));

      emitAuthEvent("SIGNED_IN", secondTelegramSession);

      await waitFor(() => expect(mockAuthSignOut).toHaveBeenCalledWith({ scope: "local" }));
      expect(mockClearLocalUserData).not.toHaveBeenCalled();
      expect(mockSetLocalDataOwnerId).not.toHaveBeenCalledWith(secondTelegramSession.user.id);
      expect(mockSyncWithCloud).toHaveBeenCalledTimes(1);
      expect(useAppStore.getState().hasValidSession).toBe(false);
      expect(useUserDataStore.getState().authGateChecked).toBe(false);
      expect(mockResumeCloudSync).toHaveBeenCalledTimes(1);
      expect(offlineQueue.resumeAfterAccountBoundary).toHaveBeenCalledTimes(1);
      expect(useAppStore.getState().isAccountBoundaryInProgress).toBe(false);
    });

    it("rolls back an exact partial suspension when queue quiescence fails before cleanup", async () => {
      usePlainAuthRoute();
      mockGetLocalDataOwnerId.mockResolvedValue(telegramSession.user.id);
      const queueSuspension = vi
        .spyOn(offlineQueue, "suspendForAccountBoundary")
        .mockImplementationOnce(async () => {
          mockQueueBoundaryEpoch.value += 1;
          mockQueueBoundarySuspended.value = true;
          throw new Error("queue quiescence failed");
        });

      try {
        renderHook(() => useAuthSession(false));
        emitAuthEvent("SIGNED_IN", telegramSession);
        await waitFor(() => expect(mockSyncWithCloud).toHaveBeenCalledTimes(1));

        emitAuthEvent("SIGNED_IN", secondTelegramSession);

        await waitFor(() => expect(mockAuthSignOut).toHaveBeenCalledWith({ scope: "local" }));
        await waitFor(() => expect(mockResumeCloudSync).toHaveBeenCalledTimes(1));
        await waitFor(() =>
          expect(offlineQueue.resumeAfterAccountBoundary).toHaveBeenCalledTimes(1)
        );
        expect(mockClearLocalUserData).not.toHaveBeenCalled();
        expect(mockSetLocalDataOwnerId).not.toHaveBeenCalledWith(secondTelegramSession.user.id);
        expect(mockCloudBoundarySuspended.value).toBe(false);
        expect(mockQueueBoundarySuspended.value).toBe(false);
        expect(useAppStore.getState().isAccountBoundaryInProgress).toBe(false);
        expect(getAccountCleanupRecovery()).toBeNull();
      } finally {
        queueSuspension.mockRestore();
      }
    });

    it("never resumes a foreign suspension when ownership changes during partial acquisition", async () => {
      usePlainAuthRoute();
      mockGetLocalDataOwnerId.mockResolvedValue(telegramSession.user.id);
      const queueSuspension = vi
        .spyOn(offlineQueue, "suspendForAccountBoundary")
        .mockImplementationOnce(async () => {
          mockQueueBoundaryEpoch.value += 2;
          mockQueueBoundarySuspended.value = true;
          throw new Error("queue suspension was superseded");
        });

      try {
        renderHook(() => useAuthSession(false));
        emitAuthEvent("SIGNED_IN", telegramSession);
        await waitFor(() => expect(mockSyncWithCloud).toHaveBeenCalledTimes(1));

        emitAuthEvent("SIGNED_IN", secondTelegramSession);

        await waitFor(() => expect(mockAuthSignOut).toHaveBeenCalledWith({ scope: "local" }));
        expect(mockResumeCloudSync).not.toHaveBeenCalled();
        expect(offlineQueue.resumeAfterAccountBoundary).not.toHaveBeenCalled();
        expect(useAppStore.getState().isAccountBoundaryInProgress).toBe(true);
        expect(getAccountCleanupRecovery()).not.toBeNull();
      } finally {
        queueSuspension.mockRestore();
      }
    });

    it("does not leave a non-actionable recovery after pre-destructive cleanup closes B", async () => {
      usePlainAuthRoute();
      mockGetLocalDataOwnerId.mockResolvedValue(telegramSession.user.id);
      mockClearNativeJournalBiometricCredential.mockRejectedValueOnce(
        new Error("native journal credential delete failed")
      );

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() => expect(mockSyncWithCloud).toHaveBeenCalledTimes(1));

      emitAuthEvent("SIGNED_IN", secondTelegramSession);
      await waitFor(() => expect(mockAuthSignOut).toHaveBeenCalledWith({ scope: "local" }));
      await waitFor(() => expect(mockResumeCloudSync).toHaveBeenCalledTimes(1));
      expect(offlineQueue.resumeAfterAccountBoundary).toHaveBeenCalledTimes(1);
      expect(getAccountCleanupRecovery()).toBeNull();

      emitAuthEvent("SIGNED_OUT", null);

      await waitFor(() => expect(useAppStore.getState().isAccountBoundaryInProgress).toBe(false));
      expect(getAccountCleanupRecovery()).toBeNull();
      expect(mockClearNativeJournalBiometricCredential).toHaveBeenCalledTimes(1);
      expect(mockClearLocalUserData).not.toHaveBeenCalled();
    });

    it("retires a stale destructive token after durable signed-out reconciliation completes", async () => {
      usePlainAuthRoute();
      mockClearLocalUserData.mockRejectedValueOnce(new Error("purge interrupted"));

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() => expect(mockSyncWithCloud).toHaveBeenCalledTimes(1));

      emitAuthEvent("SIGNED_IN", secondTelegramSession);
      await waitFor(() => expect(mockAuthSignOut).toHaveBeenCalledWith({ scope: "local" }));
      expect(mockCommitPendingAccountSwitchCleanup).toHaveBeenCalledWith(
        telegramSession.user.id,
        secondTelegramSession.user.id,
        expect.any(Function)
      );
      await waitFor(() => expect(getAccountCleanupRecovery()).not.toBeNull());

      mockReconcilePendingAccountSignOutCleanup.mockResolvedValueOnce({
        status: "completed",
      });
      mockCloudBoundaryEpoch.value += 2;
      mockQueueBoundaryEpoch.value += 2;
      mockCloudBoundarySuspended.value = false;
      mockQueueBoundarySuspended.value = false;
      emitAuthEvent("SIGNED_OUT", null);

      await waitFor(() => expect(useAppStore.getState().isAccountBoundaryInProgress).toBe(false));
      expect(getAccountCleanupRecovery()).toBeNull();
      expect(mockResumeCloudSync).not.toHaveBeenCalled();
      expect(offlineQueue.resumeAfterAccountBoundary).not.toHaveBeenCalled();
      expect(mockSetLocalDataOwnerId).not.toHaveBeenCalledWith(secondTelegramSession.user.id);
    });

    it("continues active B after durable reconciliation settles a failed destructive switch", async () => {
      usePlainAuthRoute();
      mockClearLocalUserData.mockImplementationOnce(async () => {
        mockLocalOwner.value = null;
        throw new Error("purge interrupted after clear");
      });
      mockAuthSignOut.mockResolvedValueOnce({
        error: { message: "replacement session stayed active" },
      });
      mockGetSession.mockResolvedValue({
        data: { session: secondTelegramSession },
        error: null,
      });

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() => expect(mockSyncWithCloud).toHaveBeenCalledTimes(1));

      emitAuthEvent("SIGNED_IN", secondTelegramSession);
      await waitFor(() => expect(getAccountCleanupRecovery()).not.toBeNull());

      mockReconcilePendingAccountSignOutCleanup.mockImplementationOnce(async () => {
        mockCloudBoundaryEpoch.value += 2;
        mockQueueBoundaryEpoch.value += 2;
        mockCloudBoundarySuspended.value = false;
        mockQueueBoundarySuspended.value = false;
        return { status: "completed" };
      });

      await act(async () => {
        await getAccountCleanupRecovery()?.retry();
      });

      await waitFor(() =>
        expect(mockSetLocalDataOwnerId).toHaveBeenCalledWith(secondTelegramSession.user.id)
      );
      await waitFor(() =>
        expect(mockSyncWithCloud).toHaveBeenCalledWith("merge", secondTelegramSession.user.id)
      );
      expect(useAppStore.getState().hasValidSession).toBe(true);
      expect(useAppStore.getState().isAccountBoundaryInProgress).toBe(false);
      expect(getAccountCleanupRecovery()).toBeNull();
      expect(mockResumeCloudSync).not.toHaveBeenCalled();
      expect(offlineQueue.resumeAfterAccountBoundary).not.toHaveBeenCalled();
    });

    it("releases exact pre-destructive writers when SIGNED_OUT supersedes cleanup", async () => {
      usePlainAuthRoute();
      let releaseNotificationCleanup!: () => void;
      mockClearAccountNotificationsForBoundary.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            releaseNotificationCleanup = resolve;
          })
      );

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() => expect(mockSyncWithCloud).toHaveBeenCalledTimes(1));

      emitAuthEvent("SIGNED_IN", secondTelegramSession);
      await waitFor(() =>
        expect(mockClearAccountNotificationsForBoundary).toHaveBeenCalledTimes(1)
      );
      emitAuthEvent("SIGNED_OUT", null);
      releaseNotificationCleanup();

      await waitFor(() => expect(mockResumeCloudSync).toHaveBeenCalledTimes(1));
      expect(offlineQueue.resumeAfterAccountBoundary).toHaveBeenCalledTimes(1);
      expect(mockClearLocalUserData).not.toHaveBeenCalled();
      expect(mockSetLocalDataOwnerId).not.toHaveBeenCalledWith(secondTelegramSession.user.id);
      expect(useAppStore.getState().isAccountBoundaryInProgress).toBe(false);
      expect(getAccountCleanupRecovery()).toBeNull();
    });

    it("preserves account A ownership and closes B when native account surfaces cannot be cleared", async () => {
      usePlainAuthRoute();
      mockClearAccountDeviceSurfaces.mockRejectedValueOnce(new Error("widget cleanup failed"));

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() => expect(mockSyncWithCloud).toHaveBeenCalledTimes(1));

      emitAuthEvent("SIGNED_IN", secondTelegramSession);

      await waitFor(() => expect(mockAuthSignOut).toHaveBeenCalledWith({ scope: "local" }));
      expect(mockClearLocalUserData).not.toHaveBeenCalled();
      expect(mockSetLocalDataOwnerId).not.toHaveBeenCalledWith(secondTelegramSession.user.id);
      expect(mockSyncWithCloud).toHaveBeenCalledTimes(1);
    });

    it("preserves account A data and closes B when A still has pending offline writes", async () => {
      usePlainAuthRoute();
      const pendingActions = vi
        .spyOn(offlineQueue, "hasPendingActionsForOwnerReady")
        .mockImplementation(async (ownerUserId) => ownerUserId === telegramSession.user.id);

      try {
        renderHook(() => useAuthSession(false));
        emitAuthEvent("SIGNED_IN", telegramSession);
        await waitFor(() => expect(mockSyncWithCloud).toHaveBeenCalledTimes(1));

        emitAuthEvent("SIGNED_IN", secondTelegramSession);

        await waitFor(() => expect(mockAuthSignOut).toHaveBeenCalledWith({ scope: "local" }));
        expect(mockClearLocalUserData).not.toHaveBeenCalled();
        expect(useAppStore.getState().hasValidSession).toBe(false);
      } finally {
        pendingActions.mockRestore();
      }
    });

    it("preserves account A data when password removal is durable outside the queue", async () => {
      usePlainAuthRoute();
      mockHasPendingJournalSecurityRemovalForOwner.mockImplementation(
        async (ownerUserId: string) => ownerUserId === telegramSession.user.id,
      );

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() => expect(mockSyncWithCloud).toHaveBeenCalledTimes(1));

      emitAuthEvent("SIGNED_IN", secondTelegramSession);

      await waitFor(() => expect(mockAuthSignOut).toHaveBeenCalledWith({ scope: "local" }));
      expect(mockHasPendingJournalSecurityRemovalForOwner).toHaveBeenCalledWith(
        telegramSession.user.id,
      );
      expect(mockClearLocalUserData).not.toHaveBeenCalled();
      expect(mockSetLocalDataOwnerId).not.toHaveBeenCalledWith(secondTelegramSession.user.id);
      expect(mockSyncWithCloud).toHaveBeenCalledTimes(1);
    });

    it("keeps exact writers blocked when B cannot close after the final A-write check", async () => {
      usePlainAuthRoute();
      const pendingActions = vi
        .spyOn(offlineQueue, "hasPendingActionsForOwnerReady")
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      mockAuthSignOut.mockResolvedValueOnce({
        error: { message: "local sign-out rejected" },
      });

      try {
        renderHook(() => useAuthSession(false));
        emitAuthEvent("SIGNED_IN", telegramSession);
        await waitFor(() => expect(mockSyncWithCloud).toHaveBeenCalledTimes(1));

        emitAuthEvent("SIGNED_IN", secondTelegramSession);

        await waitFor(() => expect(mockAuthSignOut).toHaveBeenCalledWith({ scope: "local" }));
        expect(mockResumeCloudSync).not.toHaveBeenCalled();
        expect(offlineQueue.resumeAfterAccountBoundary).not.toHaveBeenCalled();
        expect(useAppStore.getState().isAccountBoundaryInProgress).toBe(true);
        expect(getAccountCleanupRecovery()).not.toBeNull();
        expect(mockClearLocalUserData).not.toHaveBeenCalled();
      } finally {
        pendingActions.mockRestore();
      }
    });

    it("preserves account A when a cross-tab queue row appears at the final DATA check", async () => {
      usePlainAuthRoute();
      mockGetLocalDataOwnerId.mockResolvedValue(telegramSession.user.id);
      vi.mocked(offlineQueue.discardSuspendedActionsForAccountBoundary).mockResolvedValueOnce({
        status: "blocked",
        pendingOwnerUserIds: [telegramSession.user.id],
      });

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() =>
        expect(mockSyncWithCloud).toHaveBeenCalledWith("merge", telegramSession.user.id)
      );

      emitAuthEvent("SIGNED_IN", secondTelegramSession);

      await waitFor(() =>
        expect(offlineQueue.discardSuspendedActionsForAccountBoundary).toHaveBeenCalledWith({
          onlyIfEmpty: true,
        })
      );
      await waitFor(() => expect(mockAuthSignOut).toHaveBeenCalledWith({ scope: "local" }));

      expect(mockClearLocalUserData).not.toHaveBeenCalled();
      expect(mockSetLocalDataOwnerId).not.toHaveBeenCalledWith(secondTelegramSession.user.id);
      expect(mockSyncWithCloud).not.toHaveBeenCalledWith("replace", secondTelegramSession.user.id);
      expect(mockResumeCloudSync).toHaveBeenCalledTimes(1);
      expect(offlineQueue.resumeAfterAccountBoundary).toHaveBeenCalledTimes(1);
      expect(useAppStore.getState().hasValidSession).toBe(false);
      expect(useAppStore.getState().isAccountBoundaryInProgress).toBe(false);
      expect(getAccountCleanupRecovery()).toBeNull();
    });

    it("preserves a successor realm and releases only its own writer suspension after closing the rejected session", async () => {
      usePlainAuthRoute();
      const prepareCleanupIntent = vi.fn(() => true);

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() => expect(mockSyncWithCloud).toHaveBeenCalledTimes(1));

      mockCommitPendingAccountSwitchCleanup.mockImplementationOnce(
        async (_sourceOwnerUserId, _targetOwnerUserId, mutation) => {
          await mutation(prepareCleanupIntent);
          return true;
        }
      );
      mockRunWithDataWriteBarrier.mockImplementationOnce(async (mutation) => {
        mockLocalOwner.value = "323e4567-e89b-12d3-a456-426614174000";
        return mutation();
      });

      emitAuthEvent("SIGNED_IN", secondTelegramSession);

      await waitFor(() => expect(mockAuthSignOut).toHaveBeenCalledWith({ scope: "local" }));
      expect(prepareCleanupIntent).not.toHaveBeenCalled();
      expect(mockClearLocalUserData).not.toHaveBeenCalled();
      expect(mockSetLocalDataOwnerId).not.toHaveBeenCalledWith(secondTelegramSession.user.id);
      expect(mockResumeCloudSync).toHaveBeenCalledTimes(1);
      expect(offlineQueue.resumeAfterAccountBoundary).toHaveBeenCalledTimes(1);
      expect(useAppStore.getState().isAccountBoundaryInProgress).toBe(false);
      expect(getAccountCleanupRecovery()).toBeNull();

      const successorOwnerUserId = "323e4567-e89b-12d3-a456-426614174000";
      expect(mockLocalOwner.value).toBe(successorOwnerUserId);
      const successorSession = {
        ...secondTelegramSession,
        user: {
          ...secondTelegramSession.user,
          id: successorOwnerUserId,
        },
      };
      emitAuthEvent("SIGNED_IN", successorSession);

      await waitFor(() =>
        expect(mockSyncWithCloud).toHaveBeenCalledWith("merge", successorOwnerUserId)
      );
      expect(mockClearLocalUserData).not.toHaveBeenCalled();
      expect(mockResumeCloudSync).toHaveBeenCalledTimes(1);
      expect(offlineQueue.resumeAfterAccountBoundary).toHaveBeenCalledTimes(1);
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
          "[Auth] Failed to close the replacement session after boundary cleanup:",
          expect.objectContaining({ message: signOutError.message })
        )
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
        secondTelegramSession.user.id
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

    it("keeps admission gated when another cleanup suspends writers during Presence", async () => {
      usePlainAuthRoute();
      mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });
      mockGetLocalDataOwnerId.mockResolvedValue(telegramSession.user.id);
      let releasePresence!: () => void;
      const presenceGate = new Promise<void>((resolve) => {
        releasePresence = resolve;
      });
      mockJoinPresence.mockImplementationOnce(() => presenceGate);
      const cleanupBlocked = vi.fn();
      window.addEventListener("zenflow:account-cleanup-blocked", cleanupBlocked);

      try {
        renderHook(() => useAuthSession(false));
        await waitFor(() => expect(mockJoinPresence).toHaveBeenCalledTimes(1));

        mockCloudBoundaryEpoch.value += 1;
        mockQueueBoundaryEpoch.value += 1;
        mockCloudBoundarySuspended.value = true;
        mockQueueBoundarySuspended.value = true;
        act(() => releasePresence());

        await waitFor(() => expect(cleanupBlocked).toHaveBeenCalledTimes(1));
        expect(mockStartAutoSync).not.toHaveBeenCalled();
        expect(useAppStore.getState().hasValidSession).toBe(false);
        expect(useAppStore.getState().isAccountBoundaryInProgress).toBe(true);
        expect(mockResumeCloudSync).not.toHaveBeenCalled();
        expect(offlineQueue.resumeAfterAccountBoundary).not.toHaveBeenCalled();
      } finally {
        releasePresence();
        window.removeEventListener("zenflow:account-cleanup-blocked", cleanupBlocked);
      }
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

    it("does not start profile tracking when the backup boundary changes after admission", async () => {
      usePlainAuthRoute();
      mockPullPreferences.mockImplementationOnce(async () => {
        expect(markPendingLocalBackupAccountClaim()).toBe(true);
      });

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);

      await waitFor(() => expect(mockPullPreferences).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(readPendingLocalBackupAccountClaim().status).toBe("pending")
      );
      expect(mockProfileUpdate).not.toHaveBeenCalled();
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

    it("releases only its own pre-destructive writer suspension when unmounted", async () => {
      usePlainAuthRoute();
      mockGetLocalDataOwnerId.mockResolvedValue(telegramSession.user.id);
      let releaseNotificationCleanup!: () => void;
      const notificationCleanupGate = new Promise<void>((resolve) => {
        releaseNotificationCleanup = resolve;
      });
      mockClearAccountNotificationsForBoundary.mockImplementationOnce(
        () => notificationCleanupGate
      );

      const { unmount } = renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() =>
        expect(mockSyncWithCloud).toHaveBeenCalledWith("merge", telegramSession.user.id)
      );

      emitAuthEvent("SIGNED_IN", secondTelegramSession);
      await waitFor(() => expect(offlineQueue.suspendForAccountBoundary).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(mockClearAccountNotificationsForBoundary).toHaveBeenCalledTimes(1)
      );

      unmount();

      expect(mockResumeCloudSync).toHaveBeenCalledTimes(1);
      expect(offlineQueue.resumeAfterAccountBoundary).toHaveBeenCalledTimes(1);
      expect(mockCloudBoundarySuspended.value).toBe(false);
      expect(mockQueueBoundarySuspended.value).toBe(false);

      releaseNotificationCleanup();
      await Promise.resolve();
      expect(mockClearLocalUserData).not.toHaveBeenCalled();
      expect(mockSetLocalDataOwnerId).not.toHaveBeenCalledWith(secondTelegramSession.user.id);
    });

    it("releases its exact writer suspension after an in-progress destructive owner bind completes", async () => {
      usePlainAuthRoute();
      let releaseBoundaryCleanup!: () => void;
      let localOwnerUserId: string | null = telegramSession.user.id;
      mockGetLocalDataOwnerId.mockImplementation(async () => localOwnerUserId);
      mockSetLocalDataOwnerId.mockImplementation(async (ownerUserId: string) => {
        localOwnerUserId = ownerUserId;
      });
      mockClearLocalUserData.mockImplementationOnce(async () => {
        localOwnerUserId = null;
        await new Promise<void>((resolve) => {
          releaseBoundaryCleanup = resolve;
        });
      });

      const { unmount } = renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() =>
        expect(mockSyncWithCloud).toHaveBeenCalledWith("merge", telegramSession.user.id)
      );

      emitAuthEvent("SIGNED_IN", secondTelegramSession);
      await waitFor(() => expect(mockClearLocalUserData).toHaveBeenCalledTimes(1));
      unmount();

      expect(mockResumeCloudSync).not.toHaveBeenCalled();
      expect(offlineQueue.resumeAfterAccountBoundary).not.toHaveBeenCalled();

      releaseBoundaryCleanup();

      await waitFor(() =>
        expect(mockSetLocalDataOwnerId).toHaveBeenCalledWith(secondTelegramSession.user.id)
      );
      await waitFor(() => expect(mockResumeCloudSync).toHaveBeenCalledTimes(1));
      expect(offlineQueue.resumeAfterAccountBoundary).toHaveBeenCalledTimes(1);
      expect(localOwnerUserId).toBe(secondTelegramSession.user.id);
      expect(mockCloudBoundarySuspended.value).toBe(false);
      expect(mockQueueBoundarySuspended.value).toBe(false);
      expect(mockSyncWithCloud).not.toHaveBeenCalledWith("replace", secondTelegramSession.user.id);
    });

    it("keeps writers blocked and safely retries ambiguous cleanup after unmount", async () => {
      usePlainAuthRoute();
      mockGetLocalDataOwnerId.mockResolvedValue(telegramSession.user.id);
      let rejectBoundaryCleanup!: (error: Error) => void;
      mockClearLocalUserData.mockImplementationOnce(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectBoundaryCleanup = reject;
          })
      );
      let retryCleanup: (() => void | Promise<void>) | undefined;
      const cleanupBlocked = vi.fn((event: Event) => {
        retryCleanup = (event as CustomEvent<{ retry?: () => void | Promise<void> }>).detail?.retry;
      });
      window.addEventListener("zenflow:account-cleanup-blocked", cleanupBlocked);

      try {
        const { unmount } = renderHook(() => useAuthSession(false));
        emitAuthEvent("SIGNED_IN", telegramSession);
        await waitFor(() =>
          expect(mockSyncWithCloud).toHaveBeenCalledWith("merge", telegramSession.user.id)
        );

        emitAuthEvent("SIGNED_IN", secondTelegramSession);
        await waitFor(() => expect(mockClearLocalUserData).toHaveBeenCalledTimes(1));
        unmount();
        rejectBoundaryCleanup(new Error("cleanup outcome unavailable"));

        await waitFor(() => expect(cleanupBlocked).toHaveBeenCalled());
        expect(mockResumeCloudSync).not.toHaveBeenCalled();
        expect(offlineQueue.resumeAfterAccountBoundary).not.toHaveBeenCalled();
        expect(mockCloudBoundarySuspended.value).toBe(true);
        expect(mockQueueBoundarySuspended.value).toBe(true);
        expect(mockSetLocalDataOwnerId).not.toHaveBeenCalledWith(secondTelegramSession.user.id);

        mockClearLocalUserData.mockResolvedValue(undefined);
        mockGetSession.mockResolvedValue({
          data: { session: telegramSession },
          error: null,
        });
        await expect(retryCleanup?.()).rejects.toThrow(
          "The account changed before cleanup recovery"
        );
        expect(mockClearLocalUserData).toHaveBeenCalledTimes(1);
        expect(mockResumeCloudSync).not.toHaveBeenCalled();
        expect(offlineQueue.resumeAfterAccountBoundary).not.toHaveBeenCalled();

        mockGetSession.mockResolvedValue({
          data: { session: secondTelegramSession },
          error: null,
        });
        await act(async () => {
          await retryCleanup?.();
        });

        expect(mockClearLocalUserData).toHaveBeenCalledTimes(2);
        expect(mockSetLocalDataOwnerId).toHaveBeenCalledWith(secondTelegramSession.user.id);
        expect(mockResumeCloudSync).toHaveBeenCalledTimes(1);
        expect(offlineQueue.resumeAfterAccountBoundary).toHaveBeenCalledTimes(1);
        expect(mockCloudBoundarySuspended.value).toBe(false);
        expect(mockQueueBoundarySuspended.value).toBe(false);
      } finally {
        window.removeEventListener("zenflow:account-cleanup-blocked", cleanupBlocked);
      }
    });
  });

  describe("user name sync", () => {
    it("does not adopt cached auth metadata while an imported backup decision is unresolved", async () => {
      usePlainAuthRoute();
      expect(markPendingLocalBackupAccountClaim()).toBe(true);
      mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });

      renderHook(() => useAuthSession(false));

      await waitFor(() => expect(mockGetSession).toHaveBeenCalled());
      expect(useUserDataStore.getState().userName).toBe("Friend");
    });

    it("does not adopt web OAuth metadata while an imported backup decision is unresolved", async () => {
      expect(markPendingLocalBackupAccountClaim()).toBe(true);
      mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);

      await waitFor(() => expect(useAppStore.getState().hasValidSession).toBe(false));
      expect(useUserDataStore.getState().userName).toBe("Friend");
    });

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

    it("does not convert an expired-session verification failure into confirmed sign-out", async () => {
      usePlainAuthRoute();
      mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });

      renderHook(() => useAuthSession(false));
      await waitFor(() => expect(useAppStore.getState().hasValidSession).toBe(true));

      useAppStore.setState({ hasValidSession: true, authBypassFlag: true });
      useUserDataStore.setState({ googleAuthChecked: true });
      mockGetSession.mockRejectedValueOnce(new Error("session verification unavailable"));

      act(() => {
        window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT));
      });

      await waitFor(() => expect(useAppStore.getState().hasValidSession).toBeNull());
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
