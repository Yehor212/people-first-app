import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const redirectScript = "../apply-supabase-auth-redirect-allow-list.cjs";
const { HOSTED_JOURNAL_REDIRECT_ALLOW_LIST_URLS, REQUIRED_JOURNAL_REDIRECT_URLS } = require("../check-journal-magic-link-live.cjs") as {
  HOSTED_JOURNAL_REDIRECT_ALLOW_LIST_URLS: string[];
  REQUIRED_JOURNAL_REDIRECT_URLS: string[];
};

describe("apply-supabase-auth-redirect-allow-list", () => {
  it("is wired as package scripts and into the live proof workflow", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts?: Record<string, string> };
    const workflow = readFileSync(".github/workflows/journal-magic-link-live-proof.yml", "utf8");

    expect(pkg.scripts?.["check:supabase-auth-redirect-allow-list"]).toBe(
      "node scripts/apply-supabase-auth-redirect-allow-list.cjs --dry-run",
    );
    expect(pkg.scripts?.["apply:supabase-auth-redirect-allow-list"]).toBe(
      "node scripts/apply-supabase-auth-redirect-allow-list.cjs --apply",
    );
    expect(pkg.scripts?.["test:release-contracts"]).toContain(
      "scripts/__tests__/supabase-auth-redirect-allow-list.test.ts",
    );
    expect(workflow).toContain("npm run check:supabase-auth-redirect-allow-list");
    expect(workflow).toContain("npm run apply:supabase-auth-redirect-allow-list");
  });

  it("builds a compact uri_allow_list patch without removing unrelated existing redirects", () => {
    const { buildRedirectAllowListPatch } = require(redirectScript) as {
      buildRedirectAllowListPatch: (input: {
        env: Record<string, string>;
        currentConfig: Record<string, unknown>;
      }) => { errors: string[]; patch: Record<string, string> };
    };
    const existingUrl = "https://existing.example/auth-callback";
    const alreadyPresent = "https://zenflow.app/diary?nav=v2&navLayout=phone&journalReset=*";

    const packet = buildRedirectAllowListPatch({
      env: validEnv(),
      currentConfig: { uri_allow_list: [existingUrl, alreadyPresent].join(",") },
    });
    const urls = packet.patch.uri_allow_list.split(",");

    expect(packet.errors).toEqual([]);
    expect(urls).toContain(existingUrl);
    expect(urls).not.toContain(alreadyPresent);
    for (const hostedUrl of HOSTED_JOURNAL_REDIRECT_ALLOW_LIST_URLS) {
      expect(urls).toContain(hostedUrl);
    }
    expect(urls).not.toEqual(expect.arrayContaining(REQUIRED_JOURNAL_REDIRECT_URLS));
    expect(new Set(urls).size).toBe(urls.length);
    expect(packet.patch.uri_allow_list.length).toBeLessThan(600);
  });

  it("requires explicit production confirmation before building a patch", () => {
    const { buildRedirectAllowListPatch, formatValidationErrors } = require(redirectScript) as {
      buildRedirectAllowListPatch: (input: {
        env: Record<string, string>;
        currentConfig: Record<string, unknown>;
      }) => { errors: string[]; patch: Record<string, string> };
      formatValidationErrors: (errors: string[]) => string[];
    };

    const packet = buildRedirectAllowListPatch({
      env: validEnv({ ZENFLOW_AUTH_REDIRECT_ALLOW_LIST_CONFIRM_PRODUCTION: "" }),
      currentConfig: {},
    });
    const formatted = formatValidationErrors(packet.errors).join("\n");

    expect(packet.errors).toContain(
      "ZENFLOW_AUTH_REDIRECT_ALLOW_LIST_CONFIRM_PRODUCTION must be true before applying hosted redirect URLs",
    );
    expect(formatted).not.toContain("sbp_test_1234567890abcdef1234567890abcdef");
  });

  it("applies the allow-list patch and verifies required redirects are present", async () => {
    const { applySupabaseAuthRedirectAllowList } = require(redirectScript) as {
      applySupabaseAuthRedirectAllowList: (input: {
        env: Record<string, string>;
        dryRun: boolean;
        fetchImpl: typeof fetch;
      }) => Promise<{ status: string; lines: string[] }>;
    };
    const calls: Array<{ method: string; body?: Record<string, unknown> }> = [];
    let patchedAllowList = "https://existing.example/auth-callback";
    const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
      const method = init?.method || "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, body });
      if (method === "PATCH") patchedAllowList = String(body?.uri_allow_list || "");
      return new Response(JSON.stringify({ uri_allow_list: patchedAllowList }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const result = await applySupabaseAuthRedirectAllowList({
      env: validEnv(),
      dryRun: false,
      fetchImpl,
    });

    expect(result.status).toBe("PASS");
    expect(calls.map((call) => call.method)).toEqual(["GET", "PATCH", "GET"]);
    expect(calls[1]?.body?.uri_allow_list).toContain("https://zenflow.app/*\\?*journalReset=*");
    expect(String(calls[1]?.body?.uri_allow_list || "").length).toBeLessThan(600);
    expect(result.lines.join("\n")).not.toContain("sbp_test_1234567890abcdef1234567890abcdef");
  });
});

function validEnv(extra: Record<string, string> = {}) {
  return {
    SUPABASE_ACCESS_TOKEN: "sbp_test_1234567890abcdef1234567890abcdef",
    SUPABASE_PROJECT_REF: "bwgfslmxmueyglpumkbf",
    ZENFLOW_AUTH_REDIRECT_ALLOW_LIST_CONFIRM_PRODUCTION: "true",
    ...extra,
  };
}
