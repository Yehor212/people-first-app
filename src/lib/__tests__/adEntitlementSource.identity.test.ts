import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";

const ACCOUNT_A = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_B = "22222222-2222-4222-8222-222222222222";
const transport = vi.hoisted(() => ({
  createClient: vi.fn(),
  getSession: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  abortSignal: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => transport.createClient(...args),
}));
vi.mock("@/lib/platform", () => ({ isNative: false }));
vi.mock("@/lib/env", () => ({
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLIC_API_KEY: randomUUID(),
  IS_DEV: false,
}));

// Exercise the real first-party client helpers, with only the external SDK
// transport replaced. These isolated identities never reach a real backend.
async function loadSource() {
  vi.resetModules();
  transport.createClient.mockReturnValue({
    from: transport.from,
    auth: {
      getSession: transport.getSession,
      getUser: transport.getUser,
      signInWithOAuth: vi.fn(),
      signInWithOtp: vi.fn(),
      verifyOtp: vi.fn(),
      signInWithIdToken: vi.fn(),
      exchangeCodeForSession: vi.fn(),
      _exchangeCodeForSession: vi.fn(),
      _notifyAllSubscribers: vi.fn(async () => undefined),
    },
  });
  return (await import("@/lib/adEntitlementSource")).loadCurrentProductAdEntitlement;
}

const user = (overrides: Record<string, unknown> = {}) => ({
  id: ACCOUNT_A,
  email: "",
  aud: "authenticated",
  role: "authenticated",
  is_anonymous: false,
  created_at: "2026-09-01T12:00:00Z",
  app_metadata: {},
  user_metadata: {},
  ...overrides,
});

describe("ad entitlement identity without an email requirement", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    transport.getSession.mockResolvedValue({ data: { session: { user: user() } }, error: null });
    transport.getUser.mockResolvedValue({ data: { user: user() }, error: null });
    transport.from.mockReturnValue(transport);
    transport.select.mockReturnValue(transport);
    transport.eq.mockReturnValue(transport);
    transport.abortSignal.mockReturnValue(transport);
    transport.maybeSingle.mockResolvedValue({
      data: { value: { version: 1, enabled: true, model: "free_with_banner" } },
      error: null,
    });
  });

  it("accepts an email-less account only after fresh server verification", async () => {
    const resolve = await loadSource();
    expect(await resolve(new AbortController().signal)).toEqual({
      accountId: ACCOUNT_A,
      entitlement: "free",
    });
    expect(transport.getUser).toHaveBeenCalledTimes(1);
    expect(transport.getSession).toHaveBeenCalledTimes(2);
  });

  it("preserves the server premium override for an email-less account", async () => {
    transport.getUser.mockResolvedValue({
      data: { user: user({ app_metadata: { ad_entitlement: "premium" } }) },
      error: null,
    });
    const resolve = await loadSource();
    expect(await resolve(new AbortController().signal)).toEqual({
      accountId: ACCOUNT_A,
      entitlement: "premium",
    });
  });

  it("does not authorize an account from a local session alone", async () => {
    transport.getUser.mockResolvedValue({ data: { user: user() }, error: { code: "invalid_jwt" } });
    const resolve = await loadSource();
    expect(await resolve(new AbortController().signal)).toBeNull();
    expect(transport.from).not.toHaveBeenCalled();
  });

  it("rejects an anonymous server identity even with an email-shaped label", async () => {
    transport.getSession.mockResolvedValue({
      data: { session: { user: user({ email: "account@example.com" }) } },
      error: null,
    });
    transport.getUser.mockResolvedValue({
      data: { user: user({ email: "account@example.com", is_anonymous: true }) },
      error: null,
    });
    const resolve = await loadSource();
    expect(await resolve(new AbortController().signal)).toBeNull();
    expect(transport.from).not.toHaveBeenCalled();
  });

  it("rejects malformed server account ids", async () => {
    transport.getUser.mockResolvedValue({ data: { user: user({ id: "invalid" }) }, error: null });
    const resolve = await loadSource();
    expect(await resolve(new AbortController().signal)).toBeNull();
    expect(transport.from).not.toHaveBeenCalled();
  });

  it("rejects an account switch after reading the policy", async () => {
    transport.getSession
      .mockResolvedValueOnce({ data: { session: { user: user() } }, error: null })
      .mockResolvedValue({ data: { session: { user: user({ id: ACCOUNT_B }) } }, error: null });
    const resolve = await loadSource();
    expect(await resolve(new AbortController().signal)).toBeNull();
  });

  it("rejects malformed server metadata rather than inferring free", async () => {
    transport.getUser.mockResolvedValue({
      data: { user: user({ app_metadata: null }) },
      error: null,
    });
    const resolve = await loadSource();
    expect(await resolve(new AbortController().signal)).toBeNull();
    expect(transport.from).not.toHaveBeenCalled();
  });
});
