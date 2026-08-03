import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authStateCallbacks, mockEndAuthFlow, mockGetSession, mockOnAuthStateChange } = vi.hoisted(
  () => {
    const authStateCallbacks: Array<(event: string, session: unknown) => void> = [];
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

    return {
      authStateCallbacks,
      mockEndAuthFlow: vi.fn(),
      mockGetSession,
      mockOnAuthStateChange,
    };
  }
);

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
  },
}));

vi.mock("@/lib/platform", () => ({
  isNative: false,
}));

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: vi.fn(),
  },
}));

vi.mock("@/lib/authRedirect", () => ({
  AUTH_COMPLETE_EVENT: "zenflow-auth-complete",
}));

vi.mock("@/lib/authGuard", () => ({
  endAuthFlow: mockEndAuthFlow,
}));

vi.mock("@/lib/authUser", () => ({
  getAuthUserDisplayName: (user: { user_metadata?: { full_name?: string; name?: string } }) =>
    user.user_metadata?.full_name || user.user_metadata?.name || "Friend",
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { useAuthSession } from "../useAuthSession";

function createTelegramSession() {
  return {
    user: {
      id: "telegram-user-1",
      email: null,
      user_metadata: {
        full_name: "Telegram Friend",
      },
      app_metadata: {
        provider: "custom:telegram",
      },
    },
  };
}

describe("auth-screen useAuthSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStateCallbacks.length = 0;
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
  });

  it("completes auth when Supabase emits INITIAL_SESSION", async () => {
    const onComplete = vi.fn();

    renderHook(() => useAuthSession({ onComplete }));

    await waitFor(() => expect(authStateCallbacks).toHaveLength(1));

    act(() => {
      authStateCallbacks[0]("INITIAL_SESSION", createTelegramSession());
    });

    await waitFor(() =>
      expect(onComplete).toHaveBeenCalledWith({ name: "Telegram Friend", email: "" })
    );
    expect(mockEndAuthFlow).toHaveBeenCalledTimes(1);
  });

  it("ends auth guard when the initial session check completes auth", async () => {
    const onComplete = vi.fn();
    mockGetSession.mockResolvedValueOnce({
      data: { session: createTelegramSession() },
      error: null,
    });

    renderHook(() => useAuthSession({ onComplete }));

    await waitFor(() =>
      expect(onComplete).toHaveBeenCalledWith({ name: "Telegram Friend", email: "" })
    );
    expect(mockEndAuthFlow).toHaveBeenCalledTimes(1);
  });

  it("ends auth guard when a web resume session check completes auth", async () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useAuthSession({ onComplete }));

    await waitFor(() => expect(mockGetSession).toHaveBeenCalledTimes(1));

    mockGetSession.mockResolvedValueOnce({
      data: { session: createTelegramSession() },
      error: null,
    });

    act(() => {
      result.current.setLoadingProvider("telegram");
    });
    await waitFor(() => expect(result.current.loadingProvider).toBe("telegram"));

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    await waitFor(() =>
      expect(onComplete).toHaveBeenCalledWith({ name: "Telegram Friend", email: "" })
    );
    expect(mockEndAuthFlow).toHaveBeenCalledTimes(1);
  });

  it("keeps a copied web OAuth error visible after the parent one-shot channel clears", async () => {
    const onComplete = vi.fn();
    const onClearError = vi.fn();
    const initialProps: { webOAuthError: string | null } = {
      webOAuthError: "access_denied",
    };
    const { result, rerender } = renderHook(
      ({ webOAuthError }: { webOAuthError: string | null }) =>
        useAuthSession({ onComplete, webOAuthError, onClearError }),
      { initialProps }
    );

    await waitFor(() => expect(result.current.error).toBe("access_denied"));
    expect(onClearError).toHaveBeenCalledTimes(1);

    rerender({ webOAuthError: null });

    await waitFor(() => expect(result.current.error).toBe("access_denied"));
    expect(onClearError).toHaveBeenCalledTimes(1);
  });
});
