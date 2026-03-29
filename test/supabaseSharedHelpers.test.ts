import { describe, expect, it } from "vitest";
import {
  extractBearerToken,
  isAuthorizedRequest,
  secureCompare,
} from "../supabase/functions/_shared/auth";
import {
  createJsonResponse,
  createNoContentResponse,
  getCorsHeaders,
} from "../supabase/functions/_shared/http";
import {
  redactEmail,
  redactUserRef,
} from "../supabase/functions/_shared/redaction";

describe("supabase shared auth helpers", () => {
  it("secureCompare returns true only for exact matches", () => {
    expect(secureCompare("abc", "abc")).toBe(true);
    expect(secureCompare("abc", "abcd")).toBe(false);
    expect(secureCompare("abc", "abx")).toBe(false);
  });

  it("extractBearerToken parses bearer values safely", () => {
    expect(extractBearerToken("Bearer token123")).toBe("token123");
    expect(extractBearerToken("Bearer    token123   ")).toBe("token123");
    expect(extractBearerToken("Basic token123")).toBeNull();
    expect(extractBearerToken(null)).toBeNull();
  });

  it("isAuthorizedRequest accepts cron secret or service role auth", () => {
    expect(
      isAuthorizedRequest({
        authHeader: null,
        cronSecretHeader: "cron-secret",
        serviceRoleKey: "service-role-key",
        cronSecret: "cron-secret",
      }),
    ).toBe(true);

    expect(
      isAuthorizedRequest({
        authHeader: "Bearer service-role-key",
        cronSecretHeader: null,
        serviceRoleKey: "service-role-key",
        cronSecret: "cron-secret",
      }),
    ).toBe(true);

    expect(
      isAuthorizedRequest({
        authHeader: "Bearer wrong",
        cronSecretHeader: "wrong",
        serviceRoleKey: "service-role-key",
        cronSecret: "cron-secret",
      }),
    ).toBe(false);
  });
});

describe("supabase shared redaction helpers", () => {
  it("redacts email and user references", () => {
    expect(redactEmail("john@example.com")).toBe("j***@example.com");
    expect(redactEmail("bad-email")).toBe("email:redacted");
    expect(redactUserRef("1234567890abcdef")).toBe("user:12345678");
    expect(redactUserRef(null)).toBe("user:redacted");
  });
});

describe("supabase shared http helpers", () => {
  it("creates secure cors headers", () => {
    const allowed = getCorsHeaders("capacitor://localhost");
    expect(allowed["Access-Control-Allow-Origin"]).toBe(
      "capacitor://localhost",
    );
    expect(allowed["X-Frame-Options"]).toBe("DENY");

    const fallback = getCorsHeaders("https://unknown.origin");
    expect(fallback["Access-Control-Allow-Origin"]).toBe(
      "https://yehor212.github.io",
    );
  });

  it("builds json and no-content responses", async () => {
    const json = createJsonResponse("capacitor://localhost", 201, { ok: true });
    expect(json.status).toBe(201);
    expect(json.headers.get("content-type")).toContain("application/json");
    expect(await json.json()).toEqual({ ok: true });

    const noContent = createNoContentResponse("capacitor://localhost");
    expect(noContent.status).toBe(204);
  });
});
