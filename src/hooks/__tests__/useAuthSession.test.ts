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
    return false;
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
  closeOAuthBrowser: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { useAuthSession } from "@/hooks/useAuthSession";
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
    it.todo("checks Supabase session on mount");
    it.todo("sets hasValidSession to true when session exists");
    it.todo("sets hasValidSession to false when no session");
    it.todo("restores googleAuthChecked when session exists but not checked");
    it.todo("handles session check error gracefully");
  });

  describe("pending auth URL (native)", () => {
    it.todo("processes pending auth URL when supabase is ready");
    it.todo("sets user name from session metadata");
    it.todo("handles failed pending auth callback");
    it.todo("skips processing on non-native platform");
  });

  describe("cloud sync on auth change", () => {
    it.todo("syncs with cloud on initial session");
    it.todo("uses merge mode for same user");
    it.todo("uses replace mode after sign-out and re-sign-in");
    it.todo("uses replace mode on account switch");
    it.todo("starts auto-sync after successful initial sync");
    it.todo("joins presence channel on auth");
    it.todo("stops auto-sync on unmount");
  });

  describe("user name sync", () => {
    it.todo("syncs user name from session metadata on mount");
    it.todo("updates name when auth state changes");
    it.todo("does not overwrite custom user name");
  });

  describe("session expired handler", () => {
    it.todo("resets auth state when session is truly expired");
    it.todo("ignores expired event if session is still valid");
    it.todo("throttles expired events within 5s window");
  });
});
