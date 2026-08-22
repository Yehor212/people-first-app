import { act, renderHook, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface TestUser {
  id: string;
  app_metadata: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

interface TestSession {
  user: TestUser;
}

const OWNER_ID = "11111111-1111-4111-8111-111111111111";

const harness = vi.hoisted(() => ({
  appState: {
    hasValidSession: null as boolean | null,
    isAccountBoundaryInProgress: false,
  },
  authCallback: null as ((event: string, session: TestSession | null) => void) | null,
  getLocalDataOwnerId: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  unsubscribe: vi.fn(),
  validateSyncOwner: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: harness.getSession,
      onAuthStateChange: harness.onAuthStateChange,
    },
  },
}));

vi.mock("@/storage/sync/syncOwner", () => ({
  validateSyncOwner: harness.validateSyncOwner,
}));

vi.mock("@/storage/db", () => ({
  getLocalDataOwnerId: harness.getLocalDataOwnerId,
}));

vi.mock("@/stores/appStore", () => ({
  useAppStore: (selector: (state: typeof harness.appState) => unknown) =>
    selector(harness.appState),
}));

import {
  readAdPremiumStatusFromServerMetadata,
  useAdPremiumStatus,
} from "../useAdPremiumStatus";

function user(status?: unknown, id = OWNER_ID): TestUser {
  return {
    id,
    app_metadata:
      status === undefined ? {} : { zenflow_ad_entitlement: status },
  };
}

function session(status?: unknown, id = OWNER_ID): TestSession {
  return { user: user(status, id) };
}

describe("owner-bound rewarded-ad entitlement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.appState.hasValidSession = true;
    harness.appState.isAccountBoundaryInProgress = false;
    harness.authCallback = null;
    harness.getSession.mockResolvedValue({
      data: { session: session("free") },
      error: null,
    });
    harness.onAuthStateChange.mockImplementation(
      (callback: (event: string, nextSession: TestSession | null) => void) => {
        harness.authCallback = callback;
        return { data: { subscription: { unsubscribe: harness.unsubscribe } } };
      },
    );
    harness.getLocalDataOwnerId.mockResolvedValue(OWNER_ID);
    harness.validateSyncOwner.mockResolvedValue(OWNER_ID);
  });

  it("accepts only exact server-controlled free or premium metadata", () => {
    expect(readAdPremiumStatusFromServerMetadata(user("free"))).toBe("free");
    expect(readAdPremiumStatusFromServerMetadata(user("premium"))).toBe("premium");
    expect(readAdPremiumStatusFromServerMetadata(user("FREE"))).toBe("unknown");
    expect(readAdPremiumStatusFromServerMetadata(user(true))).toBe("unknown");
    expect(readAdPremiumStatusFromServerMetadata(user())).toBe("unknown");
    expect(
      readAdPremiumStatusFromServerMetadata({
        ...user(),
        user_metadata: { zenflow_ad_entitlement: "free" },
      }),
    ).toBe("unknown");
    expect(readAdPremiumStatusFromServerMetadata(null)).toBe("unknown");
  });

  it("wires the verified status into the production app shell", () => {
    const indexSource = readFileSync("src/pages/Index.tsx", "utf8");

    expect(indexSource).toContain("const adPremiumStatus = useAdPremiumStatus();");
    expect(indexSource).toContain("premiumStatus={adPremiumStatus}");
    expect(indexSource).not.toContain('premiumStatus="unknown"');
  });

  it("publishes free only after the admitted local owner matches the session", async () => {
    const { result } = renderHook(() => useAdPremiumStatus());

    expect(result.current).toBe("unknown");
    await waitFor(() => expect(result.current).toBe("free"));
    expect(harness.validateSyncOwner).toHaveBeenCalledWith(
      OWNER_ID,
      "Rewarded-ad entitlement",
    );
    expect(harness.getLocalDataOwnerId).toHaveBeenCalledTimes(1);
  });

  it("does not inspect or publish entitlement before account admission completes", () => {
    harness.appState.hasValidSession = null;
    harness.appState.isAccountBoundaryInProgress = true;

    const { result, rerender } = renderHook(() => useAdPremiumStatus());

    expect(result.current).toBe("unknown");
    expect(harness.getSession).not.toHaveBeenCalled();
    expect(harness.validateSyncOwner).not.toHaveBeenCalled();

    harness.appState.hasValidSession = true;
    harness.appState.isAccountBoundaryInProgress = false;
    rerender();
    return waitFor(() => expect(result.current).toBe("free"));
  });

  it("fails closed for a stale account owner or lookup error", async () => {
    harness.getLocalDataOwnerId.mockResolvedValueOnce(
      "22222222-2222-4222-8222-222222222222",
    );
    const { result, unmount } = renderHook(() => useAdPremiumStatus());

    await waitFor(() => expect(harness.validateSyncOwner).toHaveBeenCalledTimes(1));
    expect(result.current).toBe("unknown");
    unmount();

    harness.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: new Error("session unavailable"),
    });
    const failed = renderHook(() => useAdPremiumStatus());
    await waitFor(() => expect(harness.getSession).toHaveBeenCalledTimes(2));
    expect(failed.result.current).toBe("unknown");
  });

  it("tracks signed server metadata changes and clears immediately on sign-out", async () => {
    const { result, unmount } = renderHook(() => useAdPremiumStatus());
    await waitFor(() => expect(result.current).toBe("free"));

    await act(async () => {
      harness.authCallback?.("TOKEN_REFRESHED", session("premium"));
    });
    await waitFor(() => expect(result.current).toBe("premium"));

    await act(async () => {
      harness.authCallback?.("SIGNED_OUT", null);
    });
    expect(result.current).toBe("unknown");

    unmount();
    expect(harness.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
