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
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  analyticsSignIn: vi.fn(),
  hapticError: vi.fn(),
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
  getAuthRedirectUrl: () => "https://yehor212.github.io/people-first-app/",
}));

vi.mock("@/lib/platform", () => ({
  isNative: false,
}));

vi.mock("@/lib/nativeOAuthBrowser", () => ({
  openOAuthUrl: mocks.openOAuthUrl,
}));

vi.mock("@/lib/nativeGoogleAuth", () => ({
  authenticateWithGoogleNative: mocks.authenticateWithGoogleNative,
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
    mocks.canStartAuthFlow.mockReturnValue(true);
    mocks.signInWithOAuth.mockResolvedValue({
      data: { url: "https://appleid.apple.com/auth/authorize" },
      error: null,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
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
    } finally {
      vi.useRealTimers();
    }
  });
});
