import { act, renderHook } from "@testing-library/react";
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
    triggerDataRefresh: vi.fn(),
    processQueue: vi.fn(),
    hasPendingActions: vi.fn(),
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

function renderAccountAuth() {
  return renderHook(() => useAccountAuth({ onNameChange: vi.fn(), t }));
}

describe("useAccountAuth native OAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthGuard();
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    mocks.onAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    });
    mocks.openOAuthUrl.mockResolvedValue(undefined);
    mocks.hasPendingActions.mockReturnValue(false);
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
      }),
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
});
