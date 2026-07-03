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
    stopAutoSync: vi.fn(),
    clearLocalUserData: vi.fn(),
    clearDeviceIdCache: vi.fn(),
    triggerDataRefresh: vi.fn(),
    processQueue: vi.fn(),
    hasPendingActions: vi.fn(),
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
}));

vi.mock("@/lib/nativeOAuthBrowser", () => ({
  openOAuthUrl: mocks.openOAuthUrl,
}));

vi.mock("@/lib/nativeGoogleAuth", () => ({
  authenticateWithGoogleNative: vi.fn(),
}));

vi.mock("@/lib/pushNotifications", () => ({
  removePushToken: mocks.removePushToken,
}));

vi.mock("@/lib/offlineQueue", () => ({
  offlineQueue: {
    processQueue: mocks.processQueue,
    hasPendingActions: mocks.hasPendingActions,
  },
}));

vi.mock("@/storage/cloudSync", () => ({
  stopAutoSync: mocks.stopAutoSync,
}));

vi.mock("@/storage/db", () => ({
  clearLocalUserData: mocks.clearLocalUserData,
}));

vi.mock("@/hooks/useIndexedDB", () => ({
  triggerDataRefresh: mocks.triggerDataRefresh,
}));

vi.mock("@/storage/eventSync", () => ({
  clearDeviceIdCache: mocks.clearDeviceIdCache,
}));

vi.mock("@/stores", () => ({
  useAppStore: (selector: (state: { resetAuthState: () => void }) => unknown) =>
    selector({ resetAuthState: mocks.resetAuthState }),
  useUserDataStore: (
    selector: (state: { setAuthGateChecked: (value: boolean) => void }) => unknown
  ) => selector({ setAuthGateChecked: mocks.setAuthGateChecked }),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { useAccountAuth } from "@/components/settings/account-section/useAccountAuth";
import { isAuthFlowInProgress, resetAuthGuard } from "@/lib/authGuard";

const t = {
  authNotConfigured: "Auth is not configured.",
  authTooManyAttempts: "Too many attempts.",
  authProviderLinkFailed: "Could not connect provider.",
  authError: "Auth failed.",
  authUnexpectedError: "Unexpected auth error.",
  authSignedOut: "Signed out.",
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
    mocks.getSession.mockResolvedValue({ data: { session: null } });
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
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.removePushToken.mockResolvedValue(undefined);
    mocks.clearLocalUserData.mockResolvedValue(undefined);
    mocks.processQueue.mockResolvedValue(undefined);
  });

  it("clears Telegram linking when Supabase restores the session after native OAuth", async () => {
    mocks.linkIdentity.mockResolvedValue({
      data: { url: "https://oauth.telegram.org/auth?bot_id=123" },
      error: null,
    });

    const { result } = renderAccountAuth();

    await act(async () => {
      await result.current.handleLinkProvider("telegram");
    });

    expect(result.current.linkingProvider).toBe("telegram");
    expect(isAuthFlowInProgress()).toBe(true);

    await act(async () => {
      authStateCallbacks[0]("INITIAL_SESSION", createSession());
    });

    expect(result.current.linkingProvider).toBeNull();
    expect(isAuthFlowInProgress()).toBe(false);
  });

  it("keeps Telegram linking in progress after opening the native OAuth browser", async () => {
    mocks.linkIdentity.mockResolvedValue({
      data: { url: "https://oauth.telegram.org/auth?bot_id=123" },
      error: null,
    });

    const { result } = renderAccountAuth();

    await act(async () => {
      await result.current.handleLinkProvider("telegram");
    });

    expect(mocks.linkIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "custom:telegram",
        options: expect.objectContaining({
          redirectTo: "com.zenflow.app://login-callback",
          skipBrowserRedirect: true,
        }),
      })
    );
    expect(mocks.openOAuthUrl).toHaveBeenCalledWith("https://oauth.telegram.org/auth?bot_id=123");
    expect(result.current.linkingProvider).toBe("telegram");
    expect(isAuthFlowInProgress()).toBe(true);
  });

  it("releases Telegram linking if the native OAuth callback does not complete", async () => {
    vi.useFakeTimers();
    try {
      mocks.linkIdentity.mockResolvedValue({
        data: { url: "https://oauth.telegram.org/auth?bot_id=123" },
        error: null,
      });

      const { result } = renderAccountAuth();

      await act(async () => {
        await result.current.handleLinkProvider("telegram");
      });

      expect(result.current.linkingProvider).toBe("telegram");
      expect(isAuthFlowInProgress()).toBe(true);

      act(() => {
        vi.advanceTimersByTime(60_000);
      });

      expect(result.current.linkingProvider).toBeNull();
      expect(isAuthFlowInProgress()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("removes the remote push token before clearing local user data and resets the protected V2 auth gate", async () => {
    const onNameChange = vi.fn();
    mocks.getSession.mockResolvedValue({ data: { session: createSession() } });

    const { result } = renderAccountAuth(onNameChange);

    await waitFor(() => expect(result.current.hasSession).toBe(true));

    await act(async () => {
      await result.current.handleSignOut();
    });

    expect(mocks.stopAutoSync).toHaveBeenCalledTimes(1);
    expect(mocks.clearDeviceIdCache).toHaveBeenCalledTimes(1);
    expect(mocks.clearLocalUserData).toHaveBeenCalledTimes(1);
    expect(mocks.triggerDataRefresh).toHaveBeenCalledTimes(1);
    expect(mocks.removePushToken).toHaveBeenCalledTimes(1);
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.removePushToken.mock.invocationCallOrder[0]).toBeLessThan(
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
});
