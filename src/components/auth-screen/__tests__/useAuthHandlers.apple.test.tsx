import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthHandlers } from "../useAuthHandlers";

const mocks = vi.hoisted(() => ({
  checkAppleAuthAvailability: vi.fn(),
  signInWithOAuth: vi.fn(),
  canStartAuthFlow: vi.fn(() => true),
  startAuthFlow: vi.fn(),
  endAuthFlow: vi.fn(),
  openOAuthUrl: vi.fn(),
  authenticateWithGoogleNative: vi.fn(),
  cancelPkceAttemptFromUrl: vi.fn(),
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  analyticsSignIn: vi.fn(),
  hapticError: vi.fn(),
  platform: {
    isNative: false,
    isAndroid: false,
  },
}));

vi.mock("@/lib/appleAuthAvailability", () => ({
  checkAppleAuthAvailability: mocks.checkAppleAuthAvailability,
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      signInWithOAuth: mocks.signInWithOAuth,
      signInWithOtp: vi.fn(),
      verifyOtp: vi.fn(),
    },
  },
}));

vi.mock("@/lib/authGuard", () => ({
  canStartAuthFlow: mocks.canStartAuthFlow,
  startAuthFlow: mocks.startAuthFlow,
  endAuthFlow: mocks.endAuthFlow,
}));

vi.mock("@/lib/authRedirect", () => ({
  getAuthRedirectUrl: () =>
    mocks.platform.isNative
      ? "com.zenflow.app://login-callback"
      : "https://yehor212.github.io/people-first-app/",
}));

vi.mock("@/lib/platform", () => ({
  get isNative() {
    return mocks.platform.isNative;
  },
  get isAndroid() {
    return mocks.platform.isAndroid;
  },
}));

vi.mock("@/lib/nativeOAuthBrowser", () => ({
  openOAuthUrl: mocks.openOAuthUrl,
}));

vi.mock("@/lib/nativeGoogleAuth", () => ({
  authenticateWithGoogleNative: mocks.authenticateWithGoogleNative,
}));

vi.mock("@/lib/authTransitionCoordinator", () => ({
  cancelPkceAttemptFromUrl: mocks.cancelPkceAttemptFromUrl,
}));

vi.mock("@/lib/logger", () => ({
  logger: mocks.logger,
}));

vi.mock("@/lib/analytics", () => ({
  analytics: {
    signIn: mocks.analyticsSignIn,
  },
}));

vi.mock("@/lib/haptics", () => ({
  hapticError: mocks.hapticError,
}));

const t = {
  authAppleUnavailable: "Apple sign-in is not available yet. Please use another method.",
  authNotConfigured: "OAuth provider is not configured.",
  authSignInTooLong: "Sign-in took too long.",
  authSupabaseNotConfigured: "Supabase is not configured.",
  authTooManyAttempts: "Too many attempts.",
  authUnexpectedError: "Unexpected auth error.",
};

function createSession() {
  return {
    setError: vi.fn(),
    setDebugInfo: vi.fn(),
    setLoadingProvider: vi.fn(),
    setPhoneStep: vi.fn(),
    setPhoneNumber: vi.fn(),
    setOtpCode: vi.fn(),
    phoneNumber: "",
    otpCode: "",
    error: null,
    debugInfo: null,
    hasCompletedRef: { current: false },
    oauthTimeoutRef: { current: null as ReturnType<typeof setTimeout> | null },
    tryComplete: vi.fn(),
  } as unknown as Parameters<typeof useAuthHandlers>[0];
}

describe("useAuthHandlers Apple availability preflight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.platform.isNative = false;
    mocks.platform.isAndroid = false;
    mocks.canStartAuthFlow.mockReturnValue(true);
    mocks.signInWithOAuth.mockResolvedValue({
      data: { url: "https://appleid.apple.com/auth/authorize" },
      error: null,
    });
    mocks.cancelPkceAttemptFromUrl.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it("uses the owner-bound OAuth callback for Google on iOS instead of the Android native picker", async () => {
    mocks.platform.isNative = true;
    mocks.platform.isAndroid = false;
    mocks.signInWithOAuth.mockResolvedValueOnce({
      data: { url: "https://accounts.google.com/o/oauth2/v2/auth" },
      error: null,
    });
    const session = createSession();
    const { result } = renderHook(() => useAuthHandlers(session, t));

    result.current.handleProviderSignIn("google");

    await waitFor(() => {
      expect(mocks.signInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({ provider: "google" }),
      );
    });
    expect(mocks.authenticateWithGoogleNative).not.toHaveBeenCalled();
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
    if (session.oauthTimeoutRef.current) clearTimeout(session.oauthTimeoutRef.current);
  });

  it("preserves the native Google picker on Android", async () => {
    mocks.platform.isNative = true;
    mocks.platform.isAndroid = true;
    mocks.authenticateWithGoogleNative.mockResolvedValueOnce({
      success: true,
      user: { name: "Android User", email: "android@example.test" },
    });
    const session = createSession();
    const { result } = renderHook(() => useAuthHandlers(session, t));

    result.current.handleProviderSignIn("google");

    await waitFor(() => {
      expect(mocks.authenticateWithGoogleNative).toHaveBeenCalledTimes(1);
    });
    expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
    expect(session.tryComplete).toHaveBeenCalledWith(
      { name: "Android User", email: "android@example.test" },
      "nativeGoogleAuth",
    );
  });

  it("blocks Apple OAuth before redirect when hosted Supabase reports Apple disabled", async () => {
    mocks.checkAppleAuthAvailability.mockResolvedValue({
      status: "disabled",
      reason: "provider_disabled",
    });
    const session = createSession();
    const { result } = renderHook(() => useAuthHandlers(session, t));

    result.current.handleProviderSignIn("apple");

    await waitFor(() => {
      expect(session.setError).toHaveBeenCalledWith(t.authAppleUnavailable);
    });
    expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
    expect(mocks.canStartAuthFlow).not.toHaveBeenCalled();
    expect(session.setDebugInfo).toHaveBeenCalledWith(
      expect.stringContaining("Apple auth availability: disabled")
    );
  });

  it("continues to Supabase OAuth when Apple public settings are unreachable", async () => {
    mocks.checkAppleAuthAvailability.mockResolvedValue({
      status: "unknown",
      reason: "settings_unreachable",
    });
    const session = createSession();
    const { result } = renderHook(() => useAuthHandlers(session, t));

    result.current.handleProviderSignIn("apple");

    await waitFor(() => {
      expect(mocks.signInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({ provider: "apple" })
      );
    });
    expect(mocks.canStartAuthFlow).toHaveBeenCalledTimes(1);
    expect(mocks.startAuthFlow).toHaveBeenCalledTimes(1);
    const credentials = mocks.signInWithOAuth.mock.calls[0]?.[0] as {
      options?: { redirectTo?: string };
    };
    const redirect = new URL(credentials.options?.redirectTo || "");
    expect(redirect.origin).toBe("https://yehor212.github.io");
    expect(redirect.pathname).toBe("/people-first-app/");
    expect(redirect.searchParams.get("zenflowAuthAttempt")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    if (session.oauthTimeoutRef.current) clearTimeout(session.oauthTimeoutRef.current);
  });

  it("releases the auth guard when a web OAuth launch times out", async () => {
    vi.useFakeTimers();
    try {
      const session = createSession();
      const { result } = renderHook(() => useAuthHandlers(session, t));

      result.current.handleProviderSignIn("telegram");

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mocks.signInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({ provider: "custom:telegram" })
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
      });

      expect(session.setLoadingProvider).toHaveBeenCalledWith(null);
      expect(session.setError).toHaveBeenCalledWith(t.authSignInTooLong);
      expect(mocks.endAuthFlow).toHaveBeenCalledTimes(1);
      expect(session.oauthTimeoutRef.current).toBe(null);
      expect(mocks.cancelPkceAttemptFromUrl).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels only the exact attempt when Supabase returns no launch URL", async () => {
    mocks.signInWithOAuth.mockResolvedValueOnce({ data: {}, error: null });
    const session = createSession();
    const { result } = renderHook(() => useAuthHandlers(session, t));

    act(() => {
      result.current.handleProviderSignIn("telegram");
    });

    await waitFor(() => expect(mocks.cancelPkceAttemptFromUrl).toHaveBeenCalledTimes(1));
    const attemptUrl = mocks.cancelPkceAttemptFromUrl.mock.calls[0]?.[1] as string;
    expect(new URL(attemptUrl).searchParams.get("zenflowAuthAttempt")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(session.setError).toHaveBeenCalledWith(t.authUnexpectedError);
  });
});
