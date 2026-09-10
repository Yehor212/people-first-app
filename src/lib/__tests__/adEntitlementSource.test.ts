import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadCurrentProductAdEntitlement } from "@/lib/adEntitlementSource";

const ACCOUNT_A = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_B = "22222222-2222-4222-8222-222222222222";
const backend = vi.hoisted(() => ({
  configured: true,
  getCurrentUser: vi.fn(),
  getVerifiedCurrentSessionUserId: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  abortSignal: vi.fn(),
  maybeSingle: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  get supabase() {
    return backend.configured ? { from: backend.from } : null;
  },
  getCurrentUser: backend.getCurrentUser,
  getVerifiedCurrentSessionUserId: backend.getVerifiedCurrentSessionUserId,
}));
vi.mock("@/lib/logger", () => ({ logger: { warn: backend.warn } }));

const policy = () => ({ version: 1, enabled: true, model: "free_with_banner" });
const verifiedUser = (appMetadata: Record<string, unknown> = {}, userMetadata = {}) => ({
  id: ACCOUNT_A,
  aud: "authenticated",
  role: "authenticated",
  created_at: "2026-09-01T12:00:00Z",
  app_metadata: appMetadata,
  user_metadata: userMetadata,
});

describe("current-product Android ad entitlement source", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    backend.configured = true;
    backend.getVerifiedCurrentSessionUserId.mockResolvedValue(ACCOUNT_A);
    backend.getCurrentUser.mockResolvedValue(verifiedUser());
    backend.from.mockReturnValue(backend);
    backend.select.mockReturnValue(backend);
    backend.eq.mockReturnValue(backend);
    backend.abortSignal.mockReturnValue(backend);
    backend.maybeSingle.mockResolvedValue({ data: { value: policy() }, error: null });
  });

  it("resolves the verified current account from the server-owned free product policy", async () => {
    const signal = new AbortController().signal;
    expect(await loadCurrentProductAdEntitlement(signal)).toEqual({
      accountId: ACCOUNT_A,
      entitlement: "free",
    });
    expect(backend.from).toHaveBeenCalledWith("app_config");
    expect(backend.select).toHaveBeenCalledWith("value");
    expect(backend.eq).toHaveBeenCalledWith("key", "android_banner_policy");
    expect(backend.abortSignal).toHaveBeenCalledWith(signal);
  });

  it("retains a server-owned premium override instead of assigning ads to that account", async () => {
    backend.getCurrentUser.mockResolvedValue(verifiedUser({ ad_entitlement: "premium" }));
    expect(await loadCurrentProductAdEntitlement(new AbortController().signal)).toEqual({
      accountId: ACCOUNT_A,
      entitlement: "premium",
    });
  });

  it("does not let user-editable metadata impersonate an entitlement source", async () => {
    backend.getCurrentUser.mockResolvedValue(verifiedUser({}, { ad_entitlement: "premium" }));
    expect(await loadCurrentProductAdEntitlement(new AbortController().signal)).toEqual({
      accountId: ACCOUNT_A,
      entitlement: "free",
    });
  });

  it.each(["unknown", "paid", true, null, 1])(
    "denies an unrecognized server override: %s",
    async (override) => {
      backend.getCurrentUser.mockResolvedValue(verifiedUser({ ad_entitlement: override }));
      expect(await loadCurrentProductAdEntitlement(new AbortController().signal)).toBeNull();
    }
  );

  it.each([
    null,
    {},
    { version: 1, enabled: false, model: "free_with_banner" },
    { version: 2, enabled: true, model: "free_with_banner" },
    { version: 1, enabled: true, model: "subscription" },
    { version: 1, enabled: "true", model: "free_with_banner" },
    { version: 1, enabled: true, model: "free_with_banner", unrecognized: true },
  ])("denies missing, disabled, malformed or incompatible policy %j", async (value) => {
    backend.maybeSingle.mockResolvedValue({ data: value === null ? null : { value }, error: null });
    expect(await loadCurrentProductAdEntitlement(new AbortController().signal)).toBeNull();
  });

  it("does not treat a failed policy read as a free account", async () => {
    backend.maybeSingle.mockResolvedValue({ data: { value: policy() }, error: { code: "42501" } });
    expect(await loadCurrentProductAdEntitlement(new AbortController().signal)).toBeNull();
  });

  it("does not request policy for a signed-out account", async () => {
    backend.getVerifiedCurrentSessionUserId.mockResolvedValue(null);
    expect(await loadCurrentProductAdEntitlement(new AbortController().signal)).toBeNull();
    expect(backend.getCurrentUser).not.toHaveBeenCalled();
    expect(backend.from).not.toHaveBeenCalled();
  });

  it("requires server verification to match the session owner", async () => {
    backend.getCurrentUser.mockResolvedValue({ ...verifiedUser(), id: ACCOUNT_B });
    expect(await loadCurrentProductAdEntitlement(new AbortController().signal)).toBeNull();
    expect(backend.from).not.toHaveBeenCalled();
  });

  it("rejects a policy result after the active account changes", async () => {
    backend.getVerifiedCurrentSessionUserId
      .mockResolvedValueOnce(ACCOUNT_A)
      .mockResolvedValue(ACCOUNT_B);
    expect(await loadCurrentProductAdEntitlement(new AbortController().signal)).toBeNull();
  });

  it("keeps a missing or rejected server user unknown", async () => {
    backend.getCurrentUser.mockResolvedValue(null);
    expect(await loadCurrentProductAdEntitlement(new AbortController().signal)).toBeNull();
    expect(backend.from).not.toHaveBeenCalled();
  });

  it("handles rejected auth reads without logging account or error payloads", async () => {
    backend.getVerifiedCurrentSessionUserId.mockRejectedValue(new Error("private upstream detail"));
    expect(await loadCurrentProductAdEntitlement(new AbortController().signal)).toBeNull();
    expect(JSON.stringify(backend.warn.mock.calls)).not.toContain("private upstream detail");
  });

  it("does not start a cancelled read", async () => {
    const controller = new AbortController();
    controller.abort();
    expect(await loadCurrentProductAdEntitlement(controller.signal)).toBeNull();
    expect(backend.getVerifiedCurrentSessionUserId).not.toHaveBeenCalled();
  });

  it("ignores a response that arrives after cancellation", async () => {
    const controller = new AbortController();
    backend.maybeSingle.mockImplementation(async () => {
      controller.abort();
      return { data: { value: policy() }, error: null };
    });
    expect(await loadCurrentProductAdEntitlement(controller.signal)).toBeNull();
  });

  it("stays unknown without a configured backend", async () => {
    backend.configured = false;
    expect(await loadCurrentProductAdEntitlement(new AbortController().signal)).toBeNull();
    expect(backend.getCurrentUser).not.toHaveBeenCalled();
  });
});
