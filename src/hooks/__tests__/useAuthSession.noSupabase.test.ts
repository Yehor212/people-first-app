import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loggerMock = vi.hoisted(() => ({
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: null,
}));

vi.mock("@/lib/logger", () => ({
  logger: loggerMock,
}));

import { useAuthSession } from "@/hooks/useAuthSession";
import { AUTH_SESSION_EXPIRED_EVENT } from "@/lib/apiClient";
import { useAppStore, useUserDataStore } from "@/stores";

describe("useAuthSession without Supabase configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/settings?nav=v2&navLayout=phone");
    useAppStore.setState({
      hasValidSession: true,
      authBypassFlag: false,
      isProcessingWebOAuth: false,
      webOAuthError: null,
    });
    useUserDataStore.setState({
      authGateChecked: false,
      isLoading: false,
      userName: "Friend",
      userNameCustom: false,
    });
  });

  it("settles as signed out without logging null-client errors", async () => {
    const { unmount } = renderHook(() => useAuthSession(false));

    await waitFor(() => expect(useAppStore.getState().hasValidSession).toBe(false));

    act(() => {
      window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
    });
    await Promise.resolve();

    expect(loggerMock.error).not.toHaveBeenCalled();
    unmount();
  });
});
