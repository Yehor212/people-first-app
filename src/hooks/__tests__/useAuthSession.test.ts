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
  mockSyncWithCloud,
  mockStartAutoSync,
  mockStopAutoSync,
  mockPullPreferences,
  mockJoinPresence,
  mockLeavePresence,
  mockMigrateExistingUser,
  mockResetSessionExpired,
  mockProfileUpdate,
  mockCloseOAuthBrowser,
  mockIsNative,
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
  const mockCloseOAuthBrowser = vi.fn(() => Promise.resolve());

  return {
    authStateCallbacks,
    mockExchangeCodeForSession,
    mockGetSession,
    mockOnAuthStateChange,
    mockSetSession,
    mockSyncWithCloud: vi.fn(() => Promise.resolve()),
    mockStartAutoSync: vi.fn(),
    mockStopAutoSync: vi.fn(),
    mockPullPreferences: vi.fn(() => Promise.resolve()),
    mockJoinPresence: vi.fn(() => Promise.resolve()),
    mockLeavePresence: vi.fn(() => Promise.resolve()),
    mockMigrateExistingUser: vi.fn(),
    mockResetSessionExpired: vi.fn(),
    mockProfileUpdate,
    mockCloseOAuthBrowser,
    mockIsNative: { value: false },
  };
});

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      setSession: mockSetSession,
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

vi.mock("@/lib/logger", () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { useAuthSession } from "@/hooks/useAuthSession";
import { setPendingAuthUrl } from "@/lib/authRedirect";
import { useAppStore, useUserDataStore } from "@/stores";
import { isAuthFlowInProgress, resetAuthGuard, startAuthFlow } from "@/lib/authGuard";

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
    tutorialBypassFlag: false,
    onboardingBypassFlag: false,
  });
  useUserDataStore.setState({
    userName: "Friend",
    userNameCustom: false,
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
    setPendingAuthUrl(null);
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
    it.todo("sets user name from session metadata");
    it.todo("handles failed pending auth callback");
    it.todo("skips processing on non-native platform");
  });

  describe("cloud sync on auth change", () => {
    it("syncs with cloud on initial session", async () => {
      usePlainAuthRoute();
      mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });

      renderHook(() => useAuthSession(false));

      await waitFor(() => expect(mockSyncWithCloud).toHaveBeenCalledWith("merge"));
      expect(mockMigrateExistingUser).toHaveBeenCalled();
    });

    it("uses merge mode for same user", async () => {
      usePlainAuthRoute();

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);

      await waitFor(() => expect(mockSyncWithCloud).toHaveBeenCalledWith("merge"));
      emitAuthEvent("SIGNED_IN", telegramSession);

      expect(mockSyncWithCloud).toHaveBeenCalledTimes(1);
    });

    it("uses replace mode after sign-out and re-sign-in", async () => {
      usePlainAuthRoute();

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() => expect(mockSyncWithCloud).toHaveBeenCalledWith("merge"));

      emitAuthEvent("SIGNED_OUT", null);
      emitAuthEvent("SIGNED_IN", telegramSession);

      await waitFor(() => expect(mockSyncWithCloud).toHaveBeenCalledWith("replace"));
      expect(mockSyncWithCloud).toHaveBeenNthCalledWith(2, "replace");
    });

    it("uses replace mode on account switch", async () => {
      usePlainAuthRoute();

      renderHook(() => useAuthSession(false));
      emitAuthEvent("SIGNED_IN", telegramSession);
      await waitFor(() => expect(mockSyncWithCloud).toHaveBeenCalledWith("merge"));

      emitAuthEvent("SIGNED_IN", secondTelegramSession);

      await waitFor(() => expect(mockSyncWithCloud).toHaveBeenCalledWith("replace"));
      expect(mockSyncWithCloud).toHaveBeenNthCalledWith(2, "replace");
    });

    it("starts auto-sync after successful initial sync", async () => {
      usePlainAuthRoute();
      mockGetSession.mockResolvedValue({ data: { session: telegramSession }, error: null });

      renderHook(() => useAuthSession(false));

      await waitFor(() => expect(mockStartAutoSync).toHaveBeenCalled());
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
    it.todo("resets auth state when session is truly expired");
    it.todo("ignores expired event if session is still valid");
    it.todo("throttles expired events within 5s window");
  });
});
