import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getSession: vi.fn(),
  supabaseUrl: "https://example.supabase.co",
  supabaseKey: "public-anon-key",
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => mocks.createClient(...args),
}));

vi.mock("@/lib/platform", () => ({
  isNative: false,
}));

vi.mock("@/lib/env", () => ({
  get SUPABASE_URL() {
    return mocks.supabaseUrl;
  },
  get SUPABASE_PUBLIC_API_KEY() {
    return mocks.supabaseKey;
  },
  IS_DEV: false,
}));

async function loadVerifiedSessionReader() {
  vi.resetModules();
  mocks.createClient.mockReturnValue({
    auth: {
      getSession: mocks.getSession,
      signInWithOAuth: vi.fn(),
      signInWithOtp: vi.fn(),
      verifyOtp: vi.fn(),
      signInWithIdToken: vi.fn(),
      exchangeCodeForSession: vi.fn(),
      _exchangeCodeForSession: vi.fn(),
      _notifyAllSubscribers: vi.fn(async () => undefined),
    },
  });
  const module = await import("@/lib/supabaseClient");
  return module.getVerifiedCurrentSessionUserId;
}

describe("getVerifiedCurrentSessionUserId", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.getSession.mockReset();
    mocks.supabaseUrl = "https://example.supabase.co";
    mocks.supabaseKey = "public-anon-key";
  });

  it("returns null only after Supabase confirms that no session exists", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    const getVerifiedCurrentSessionUserId = await loadVerifiedSessionReader();

    await expect(getVerifiedCurrentSessionUserId()).resolves.toBeNull();
    expect(mocks.createClient).toHaveBeenCalledWith(
      mocks.supabaseUrl,
      mocks.supabaseKey,
      expect.objectContaining({
        auth: expect.objectContaining({
          storageKey: "sb-example-auth-token",
          lock: expect.any(Function),
          lockAcquireTimeout: -1,
        }),
      }),
    );
  });

  it("returns null without querying auth when Supabase is not configured", async () => {
    mocks.supabaseUrl = "";
    mocks.supabaseKey = "";
    const getVerifiedCurrentSessionUserId = await loadVerifiedSessionReader();

    await expect(getVerifiedCurrentSessionUserId()).resolves.toBeNull();
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.getSession).not.toHaveBeenCalled();
  });

  it("returns the validated owner id for a confirmed session", async () => {
    const ownerUserId = "1d4fe896-fd48-4f4f-a32e-f12d5618ed7a";
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: ownerUserId,
            email: "owner@example.com",
          },
        },
      },
      error: null,
    });
    const getVerifiedCurrentSessionUserId = await loadVerifiedSessionReader();

    await expect(getVerifiedCurrentSessionUserId()).resolves.toBe(ownerUserId);
  });

  it("rejects a returned auth error instead of treating it as signed out", async () => {
    const authError = new Error("auth storage unavailable");
    mocks.getSession.mockResolvedValue({
      data: { session: null },
      error: authError,
    });
    const getVerifiedCurrentSessionUserId = await loadVerifiedSessionReader();

    await expect(getVerifiedCurrentSessionUserId()).rejects.toMatchObject({
      message: "Unable to verify the active session",
      cause: authError,
    });
  });

  it("rejects a thrown auth error instead of treating it as signed out", async () => {
    const authError = new Error("auth adapter threw");
    mocks.getSession.mockRejectedValue(authError);
    const getVerifiedCurrentSessionUserId = await loadVerifiedSessionReader();

    await expect(getVerifiedCurrentSessionUserId()).rejects.toMatchObject({
      message: "Unable to verify the active session",
      cause: authError,
    });
  });

  it("rejects a malformed session owner instead of treating it as signed out", async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "not-a-valid-user-id" },
        },
      },
      error: null,
    });
    const getVerifiedCurrentSessionUserId = await loadVerifiedSessionReader();

    await expect(getVerifiedCurrentSessionUserId()).rejects.toThrow(
      "The active session has no valid account owner",
    );
  });

  it("rejects a malformed auth response with an absent session field", async () => {
    mocks.getSession.mockResolvedValue({
      data: {},
      error: null,
    });
    const getVerifiedCurrentSessionUserId = await loadVerifiedSessionReader();

    await expect(getVerifiedCurrentSessionUserId()).rejects.toThrow(
      "Unable to verify the active session",
    );
  });
});
