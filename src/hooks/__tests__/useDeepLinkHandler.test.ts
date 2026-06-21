/**
 * useDeepLinkHandler Hook Tests
 * Tests deep link processing for auth and challenge URLs
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  appUrlOpenListeners,
  mockAddListener,
  mockGetLaunchUrl,
  mockGetSession,
  mockOnAuthStateChange,
  mockHandleAuthCallback,
  mockCloseOAuthBrowser,
} = vi.hoisted(() => {
  const appUrlOpenListeners: Array<(event: { url?: string }) => void> = [];
  const mockAddListener = vi.fn(
    async (eventName: string, callback: (event: { url?: string; isActive?: boolean }) => void) => {
      if (eventName === "appUrlOpen") {
        appUrlOpenListeners.push(callback);
      }
      return { remove: vi.fn() };
    },
  );

  return {
    appUrlOpenListeners,
    mockAddListener,
    mockGetLaunchUrl: vi.fn(async () => null),
    mockGetSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    mockOnAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
    mockHandleAuthCallback: vi.fn(async () => undefined),
    mockCloseOAuthBrowser: vi.fn(async () => undefined),
  };
});

vi.mock("@/lib/platform", () => ({
  isNative: true,
}));

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: mockAddListener,
    getLaunchUrl: mockGetLaunchUrl,
  },
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
  },
}));

vi.mock("@/contexts/FeatureFlagsContext", () => ({
  useFeatureFlags: () => ({ isFeatureVisible: () => true }),
}));

vi.mock("@/lib/authRedirect", async () => {
  const actual = await vi.importActual<typeof import("@/lib/authRedirect")>("@/lib/authRedirect");
  return {
    ...actual,
    handleAuthCallback: mockHandleAuthCallback,
    notifyAuthComplete: vi.fn(),
    setPendingAuthUrl: vi.fn(),
  };
});

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

import { useDeepLinkHandler } from "@/hooks/useDeepLinkHandler";
import { useAppStore, useUserDataStore } from "@/stores";

function resetStores() {
  useAppStore.setState({
    authBypassFlag: false,
    hasValidSession: false,
    webOAuthError: null,
  });
  useUserDataStore.setState({
    googleAuthChecked: false,
    userName: "Friend",
    userNameCustom: false,
  });
}

describe('useDeepLinkHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    appUrlOpenListeners.length = 0;
    mockGetLaunchUrl.mockResolvedValue(null);
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockHandleAuthCallback.mockResolvedValue(undefined);
    resetStores();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('auth deep links', () => {
    it("uses provider-neutral copy when an OAuth callback returns without a session", async () => {
      renderHook(() => useDeepLinkHandler());

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(appUrlOpenListeners).toHaveLength(1);

      act(() => {
        appUrlOpenListeners[0]({
          url: "com.zenflow.app://login-callback?code=telegram-code&state=telegram-state",
        });
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000);
        await Promise.resolve();
      });

      expect(useAppStore.getState().webOAuthError).toBe(
        "Sign-in did not complete. Please try again.",
      );
      expect(useAppStore.getState().webOAuthError).not.toContain("Google");
      expect(mockCloseOAuthBrowser).toHaveBeenCalled();
    });

    it("ignores untrusted HTTPS OAuth callback URLs", async () => {
      renderHook(() => useDeepLinkHandler());

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(appUrlOpenListeners).toHaveLength(1);

      await act(async () => {
        appUrlOpenListeners[0]({
          url: "https://evil.example/login-callback?code=stolen-code&state=bad-state",
        });
        await Promise.resolve();
      });

      expect(mockHandleAuthCallback).not.toHaveBeenCalled();
      expect(mockCloseOAuthBrowser).not.toHaveBeenCalled();
      expect(useAppStore.getState().webOAuthError).toBeNull();
    });

    it("ignores malformed appUrlOpen URLs without throwing", async () => {
      renderHook(() => useDeepLinkHandler());

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(appUrlOpenListeners).toHaveLength(1);

      expect(() => {
        appUrlOpenListeners[0]({ url: "not a valid callback url" });
      }).not.toThrow();

      expect(mockHandleAuthCallback).not.toHaveBeenCalled();
      expect(mockCloseOAuthBrowser).not.toHaveBeenCalled();
      expect(useAppStore.getState().webOAuthError).toBeNull();
    });
    it.todo('deduplicates identical auth URLs');
    it.todo('clears dedupe cache after 50 entries');
    it.todo('stores pending URL when supabase is not ready');
    it.todo('waits for session after auth callback');
    it.todo('sets user name from session metadata on success');
    it.todo('sets error when no session after callback');
    it.todo('times out session wait after 15s');
  });

  describe('challenge deep links', () => {
    it.todo('handles zenflow://challenge?data= custom scheme');
    it.todo('handles https://zenflow.app/challenge?data= URL');
    it.todo('decodes invite data and sets challenge invite');
    it.todo('opens challenge modal when feature is enabled');
    it.todo('ignores challenge link when feature is disabled');
    it.todo('handles malformed challenge URL gracefully');
  });

  describe('launch URL (cold start)', () => {
    it.todo('processes launch URL on mount');
    it.todo('tries challenge URL before auth URL');
  });

  describe('appUrlOpen listener', () => {
    it.todo('registers listener on mount');
    it.todo('processes challenge URLs from listener');
    it.todo('processes auth URLs from listener');
    it.todo('removes listener on unmount');
  });

  describe('appStateChange', () => {
    it.todo('checks launch URL when app becomes active');
    it.todo('only processes login-callback URLs on resume');
  });

  describe('native-only guard', () => {
    it.todo('does nothing on non-native platform');
  });
});
