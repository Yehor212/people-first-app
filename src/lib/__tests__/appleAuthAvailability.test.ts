import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkAppleAuthAvailability,
  clearAppleAuthAvailabilityCache,
  inspectAppleAuthSettings,
} from "@/lib/appleAuthAvailability";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Apple Auth public availability", () => {
  beforeEach(() => {
    clearAppleAuthAvailabilityCache();
  });

  afterEach(() => {
    clearAppleAuthAvailabilityCache();
  });

  it("detects Apple enabled and disabled states from Supabase public auth settings", () => {
    expect(inspectAppleAuthSettings({ external: { apple: true } })).toMatchObject({
      status: "available",
    });
    expect(inspectAppleAuthSettings({ external: { apple: false } })).toMatchObject({
      status: "disabled",
      reason: "provider_disabled",
    });
  });

  it("checks /auth/v1/settings with only the public anon key", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ external: { apple: false } }),
    );

    const result = await checkAppleAuthAvailability({
      supabaseUrl: "https://project-ref.supabase.co/",
      anonKey: "public-anon-key",
      fetchImpl,
      now: () => 1_000,
    });

    expect(result).toMatchObject({ status: "disabled", reason: "provider_disabled" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const call = fetchImpl.mock.calls[0];
    expect(call).toBeDefined();
    if (!call) throw new Error("Apple Auth settings fetch was not called");
    const [url, init] = call;
    expect(url).toBe("https://project-ref.supabase.co/auth/v1/settings");
    expect(init?.headers).toMatchObject({
      apikey: "public-anon-key",
      Authorization: "Bearer public-anon-key",
    });
  });

  it("caches the known provider state briefly to avoid repeated preflight calls", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ external: { apple: true } }),
    );

    const first = await checkAppleAuthAvailability({
      supabaseUrl: "https://project-ref.supabase.co",
      anonKey: "public-anon-key",
      fetchImpl,
      now: () => 10_000,
    });
    const second = await checkAppleAuthAvailability({
      supabaseUrl: "https://project-ref.supabase.co",
      anonKey: "public-anon-key",
      fetchImpl,
      now: () => 11_000,
    });

    expect(first.status).toBe("available");
    expect(second.status).toBe("available");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("returns unknown instead of blocking OAuth when public settings cannot be checked", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      throw new Error("network down");
    });

    await expect(
      checkAppleAuthAvailability({
        supabaseUrl: "https://project-ref.supabase.co",
        anonKey: "public-anon-key",
        fetchImpl,
      }),
    ).resolves.toMatchObject({ status: "unknown", reason: "settings_unreachable" });
  });
});
