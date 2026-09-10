import { act, cleanup, renderHook } from "@testing-library/react";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAdEntitlement as useAdEntitlementState } from "@/hooks/useAdEntitlement";
import {
  resumeAccountBoundaryWriters,
  suspendAccountBoundaryWriters,
} from "@/lib/accountBoundaryState";
import type { Session } from "@supabase/supabase-js";
import type { CurrentProductAdEntitlement } from "@/lib/adEntitlementSource";

const ACCOUNT_A = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_B = "22222222-2222-4222-8222-222222222222";
const runtime = vi.hoisted(() => ({
  native: true,
  android: true,
  dev: false,
  qa: false,
  configured: true,
  authListener: null as ((event: string, session: Session | null) => void) | null,
  appListener: null as ((state: { isActive: boolean }) => void) | null,
  unsubscribe: vi.fn(),
  removeAppListener: vi.fn(async () => undefined),
  load: vi.fn<(signal: AbortSignal) => Promise<CurrentProductAdEntitlement | null>>(),
  warn: vi.fn(),
  disableAds: vi.fn(),
}));

vi.mock("@/lib/platform", () => ({
  get isNative() {
    return runtime.native;
  },
  get isAndroid() {
    return runtime.android;
  },
}));
vi.mock("@/lib/env", () => ({
  get IS_DEV() {
    return runtime.dev;
  },
  get IS_ADMOB_QA_TEST_MODE() {
    return runtime.qa;
  },
}));
vi.mock("@/lib/adEntitlementSource", () => ({ loadCurrentProductAdEntitlement: runtime.load }));
vi.mock("@/lib/logger", () => ({ logger: { warn: runtime.warn } }));
vi.mock("@/lib/adController", () => ({ disableAds: runtime.disableAds }));
vi.mock("@/lib/supabaseClient", () => ({
  get supabase() {
    return runtime.configured
      ? {
          auth: {
            onAuthStateChange: (listener: typeof runtime.authListener) => {
              runtime.authListener = listener;
              return { data: { subscription: { unsubscribe: runtime.unsubscribe } } };
            },
          },
        }
      : null;
  },
}));
vi.mock("@capacitor/app", () => ({
  App: {
    addListener: async (_event: string, listener: typeof runtime.appListener) => {
      runtime.appListener = listener;
      return { remove: runtime.removeAppListener };
    },
  },
}));

const input = { enabled: true, accountBoundaryInProgress: false };
const useAdEntitlement = (value: Parameters<typeof useAdEntitlementState>[0]) =>
  useAdEntitlementState(value).entitlement;
const session = (id: string): Session => ({
  access_token: randomUUID(),
  refresh_token: randomUUID(),
  token_type: "bearer",
  expires_in: 3600,
  user: {
    id,
    aud: "authenticated",
    created_at: "2026-09-01T12:00:00Z",
    app_metadata: {},
    user_metadata: {},
  },
});
const flush = () => act(() => vi.advanceTimersByTimeAsync(1));

describe("Android production ad entitlement lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    resumeAccountBoundaryWriters();
    Object.assign(runtime, {
      native: true,
      android: true,
      dev: false,
      qa: false,
      configured: true,
      authListener: null,
      appListener: null,
    });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    runtime.load.mockReset().mockResolvedValue({ accountId: ACCOUNT_A, entitlement: "free" });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("starts unknown and enables the verified account in a production build", async () => {
    const { result } = renderHook(() => useAdEntitlement(input));
    expect(result.current).toBe("unknown");
    await flush();
    expect(result.current).toBe("free");
    expect(runtime.load).toHaveBeenCalledTimes(1);
  });

  it.each(["web", "ios", "development", "unconfigured"])(
    "does no entitlement I/O for %s",
    async (platform) => {
      if (platform === "web") runtime.native = false;
      if (platform === "ios") runtime.android = false;
      if (platform === "development") runtime.dev = true;
      if (platform === "unconfigured") runtime.configured = false;
      const { result } = renderHook(() => useAdEntitlement(input));
      await flush();
      expect(result.current).toBe("unknown");
      expect(runtime.load).not.toHaveBeenCalled();
      expect(runtime.authListener).toBeNull();
    }
  );

  it("does not fetch before consent and removes entitlement on consent revocation", async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useAdEntitlement({ ...input, enabled }),
      { initialProps: { enabled: false } }
    );
    await flush();
    expect(runtime.load).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await flush();
    expect(result.current).toBe("free");
    rerender({ enabled: false });
    expect(result.current).toBe("unknown");
  });

  it("keeps explicit QA isolated from the real backend and still denies account boundaries", async () => {
    runtime.qa = true;
    const { result, rerender } = renderHook(
      ({ boundary }) => useAdEntitlement({ ...input, accountBoundaryInProgress: boundary }),
      { initialProps: { boundary: false } }
    );
    expect(result.current).toBe("free");
    rerender({ boundary: true });
    expect(result.current).toBe("unknown");
    await flush();
    expect(runtime.load).not.toHaveBeenCalled();
  });

  it("preserves server premium and missing-source results as ad-free", async () => {
    runtime.load.mockResolvedValue({ accountId: ACCOUNT_A, entitlement: "premium" });
    const { result } = renderHook(() => useAdEntitlement(input));
    await flush();
    expect(result.current).toBe("premium");
    runtime.load.mockResolvedValue(null);
    act(() => {
      runtime.authListener?.("USER_UPDATED", session(ACCOUNT_A));
    });
    await flush();
    expect(result.current).toBe("unknown");
  });

  it("does not await Supabase work inside its auth callback or refetch on a duplicate sign-in", async () => {
    const { result } = renderHook(() => useAdEntitlement(input));
    await flush();
    const firstCount = runtime.load.mock.calls.length;
    act(() => {
      runtime.authListener?.("SIGNED_IN", session(ACCOUNT_A));
    });
    await flush();
    expect(runtime.load).toHaveBeenCalledTimes(firstCount);
    act(() => {
      expect(runtime.authListener?.("TOKEN_REFRESHED", session(ACCOUNT_A))).toBeUndefined();
      expect(runtime.load).toHaveBeenCalledTimes(firstCount);
    });
    expect(result.current).toBe("unknown");
    await flush();
    expect(result.current).toBe("free");
    expect(runtime.load).toHaveBeenCalledTimes(firstCount + 1);
  });

  it("ignores a late result from the account that signed out", async () => {
    let finish: ((value: CurrentProductAdEntitlement) => void) | undefined;
    runtime.load.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const { result } = renderHook(() => useAdEntitlement(input));
    await flush();
    expect(runtime.load).toHaveBeenCalledOnce();
    const signal = runtime.load.mock.calls[0][0];
    act(() => {
      runtime.authListener?.("SIGNED_OUT", null);
    });
    expect(signal.aborted).toBe(true);
    await act(async () => {
      finish?.({ accountId: ACCOUNT_A, entitlement: "free" });
    });
    expect(result.current).toBe("unknown");
  });

  it("invalidates native ad work synchronously at sign-out before React commits", async () => {
    const { result } = renderHook(() => useAdEntitlement(input));
    await flush();
    expect(result.current).toBe("free");
    runtime.disableAds.mockClear();
    act(() => {
      runtime.authListener?.("SIGNED_OUT", null);
      expect(runtime.disableAds).toHaveBeenCalledOnce();
    });
    expect(result.current).toBe("unknown");
  });

  it("does not let an old account response replace the newly verified account", async () => {
    let finishOld: ((value: CurrentProductAdEntitlement) => void) | undefined;
    runtime.load.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve;
        })
    );
    const { result } = renderHook(() => useAdEntitlement(input));
    await flush();
    runtime.load.mockResolvedValue({ accountId: ACCOUNT_B, entitlement: "free" });
    act(() => {
      runtime.authListener?.("SIGNED_IN", session(ACCOUNT_B));
    });
    await flush();
    expect(result.current).toBe("free");
    await act(async () => {
      finishOld?.({ accountId: ACCOUNT_A, entitlement: "premium" });
    });
    expect(result.current).toBe("free");
  });

  it("invalidates at writer boundaries and resolves again only after resume", async () => {
    const { result } = renderHook(() => useAdEntitlement(input));
    await flush();
    expect(result.current).toBe("free");
    act(() => suspendAccountBoundaryWriters());
    expect(result.current).toBe("unknown");
    await flush();
    expect(runtime.load).toHaveBeenCalledTimes(1);
    act(() => resumeAccountBoundaryWriters());
    await flush();
    expect(result.current).toBe("free");
    expect(runtime.load).toHaveBeenCalledTimes(2);
  });

  it("bounds a hung read and never accepts its late free result or loops", async () => {
    let finish: ((value: CurrentProductAdEntitlement) => void) | undefined;
    runtime.load.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const { result } = renderHook(() => useAdEntitlement(input));
    await flush();
    await act(() => vi.advanceTimersByTimeAsync(8000));
    expect(runtime.load).toHaveBeenCalledOnce();
    expect(runtime.load.mock.calls[0][0].aborted).toBe(true);
    await act(async () => {
      finish?.({ accountId: ACCOUNT_A, entitlement: "free" });
    });
    await act(() => vi.advanceTimersByTimeAsync(60000));
    expect(result.current).toBe("unknown");
    expect(runtime.load).toHaveBeenCalledTimes(1);
  });

  it("expires the five-minute lease before refreshing and does not retry a failed source", async () => {
    const { result } = renderHook(() => useAdEntitlement(input));
    await flush();
    expect(result.current).toBe("free");
    runtime.load.mockResolvedValue(null);
    await act(() => vi.advanceTimersByTimeAsync(300000));
    expect(result.current).toBe("unknown");
    expect(runtime.load).toHaveBeenCalledTimes(2);
    await act(() => vi.advanceTimersByTimeAsync(300000));
    expect(runtime.load).toHaveBeenCalledTimes(2);
  });

  it("denies native background and revalidates on foreground", async () => {
    const { result } = renderHook(() => useAdEntitlement(input));
    await flush();
    act(() => {
      runtime.appListener?.({ isActive: false });
    });
    expect(result.current).toBe("unknown");
    act(() => {
      runtime.appListener?.({ isActive: true });
    });
    await flush();
    expect(result.current).toBe("free");
    expect(runtime.load).toHaveBeenCalledTimes(2);
  });

  it("denies hidden/offline state and resolves only when both are restored", async () => {
    const { result } = renderHook(() => useAdEntitlement(input));
    await flush();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current).toBe("unknown");
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await flush();
    expect(runtime.load).toHaveBeenCalledTimes(1);
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await flush();
    expect(result.current).toBe("free");
    expect(runtime.load).toHaveBeenCalledTimes(2);
  });

  it("aborts pending work and unregisters its listeners on unmount", async () => {
    runtime.load.mockImplementationOnce(() => new Promise(() => undefined));
    const { unmount } = renderHook(() => useAdEntitlement(input));
    await flush();
    expect(runtime.load).toHaveBeenCalledOnce();
    const signal = runtime.load.mock.calls[0][0];
    unmount();
    expect(signal.aborted).toBe(true);
    expect(runtime.unsubscribe).toHaveBeenCalledOnce();
    expect(runtime.removeAppListener).toHaveBeenCalledOnce();
  });
});
