import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const script = "scripts/check-apple-auth-live.cjs";
const scriptPath = join(process.cwd(), script);
const require = createRequire(import.meta.url);
const { checkAppleAuthLive, inspectAuthConfig } = require("../check-apple-auth-live.cjs") as {
  checkAppleAuthLive?: (input?: {
    env?: NodeJS.ProcessEnv;
    rootDir?: string;
    fetchImpl?: typeof fetch;
  }) => Promise<{ status: string; message: string; exitCode: number }>;
  inspectAuthConfig?: (
    config: Record<string, unknown>,
    options?: { expectedAdditionalClientIds?: string },
  ) => string[];
};

function runReadiness(env: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      SUPABASE_ACCESS_TOKEN: "",
      SUPABASE_PROJECT_REF: "",
      SUPABASE_URL: "",
      SUPABASE_EXPECTED_APPLE_CLIENT_ID: "",
      VITE_SUPABASE_URL: "",
      ZENFLOW_APPLE_AUTH_LIVE_REQUIRED: "",
      ...env,
    },
    encoding: "utf8",
  });
}

function runReadinessInFixture(files: Record<string, string>, env: NodeJS.ProcessEnv = {}) {
  const root = mkdtempSync(join(tmpdir(), "apple-auth-live-"));
  mkdirSync(join(root, "scripts"), { recursive: true });
  copyFileSync(scriptPath, join(root, script));
  for (const [file, content] of Object.entries(files)) {
    writeFileSync(join(root, file), content);
  }

  return spawnSync(process.execPath, [script], {
    cwd: root,
    env: {
      ...process.env,
      SUPABASE_ACCESS_TOKEN: "",
      SUPABASE_PROJECT_REF: "",
      SUPABASE_URL: "",
      VITE_SUPABASE_URL: "",
      ...env,
    },
    encoding: "utf8",
  });
}

describe("check-apple-auth-live", () => {
  it("reports UNVERIFIED when hosted Supabase credentials are missing", () => {
    const result = runReadinessInFixture({});

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[apple-auth-live] UNVERIFIED");
    expect(result.stdout).toContain("SUPABASE_ACCESS_TOKEN");
    expect(result.stdout).toContain("SUPABASE_PROJECT_REF");
  });

  it("exits non-zero in required mode when hosted Supabase credentials are missing", () => {
    const result = runReadinessInFixture({}, { ZENFLOW_APPLE_AUTH_LIVE_REQUIRED: "true" });

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("[apple-auth-live] UNVERIFIED");
  });

  it("infers project ref from public Supabase URL in env files", () => {
    const result = runReadinessInFixture({
      ".env.local": "VITE_SUPABASE_URL=https://bwgfslmxmueyglpumkbf.supabase.co\n",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("SUPABASE_ACCESS_TOKEN");
    expect(result.stdout).not.toContain("SUPABASE_PROJECT_REF");
  });

  it("does not print secret token values", () => {
    const token = "sbp_secret_token_value_that_must_not_appear";
    const result = runReadiness({
      SUPABASE_ACCESS_TOKEN: token,
      SUPABASE_PROJECT_REF: "projectref1234567890",
      ZENFLOW_APPLE_AUTH_LIVE_OFFLINE: "true",
    });

    expect(result.stdout).not.toContain(token);
    expect(result.stderr).not.toContain(token);
  });

  it("requires the full hosted redirect allow-list for Apple auth", () => {
    expect(typeof inspectAuthConfig).toBe("function");

    const failures = inspectAuthConfig?.({
      external_apple_enabled: true,
      external_apple_client_id: "com.zenflow.app.web",
      uri_allow_list: [
        "https://yehor212.github.io/people-first-app/",
        "https://yehor212.github.io/people-first-app/orb?nav=v2&navLayout=phone",
        "com.zenflow.app://login-callback",
      ].join(","),
    });

    expect(failures).toContain("Missing hosted redirect URL: https://yehor212.github.io/people-first-app/habits?nav=v2");
    expect(failures).toContain("Missing hosted redirect URL: capacitor://localhost/");
  });

  it("reports missing hosted Apple additional client IDs", () => {
    expect(typeof inspectAuthConfig).toBe("function");

    const failures = inspectAuthConfig?.(
      {
        external_apple_enabled: true,
        external_apple_client_id: "com.zenflow.app.web",
        external_apple_additional_client_ids: "com.zenflow.app.ios",
        uri_allow_list: [
          "https://yehor212.github.io/people-first-app/",
          "https://yehor212.github.io/people-first-app/orb?nav=v2",
          "https://yehor212.github.io/people-first-app/orb?nav=v2&navLayout=phone",
          "https://yehor212.github.io/people-first-app/habits?nav=v2",
          "https://yehor212.github.io/people-first-app/diary?nav=v2",
          "https://yehor212.github.io/people-first-app/planning?nav=v2",
          "https://yehor212.github.io/people-first-app/planning?nav=v2&navLayout=phone",
          "https://yehor212.github.io/people-first-app/settings?nav=v2",
          "capacitor://localhost/",
          "com.zenflow.app://login-callback",
        ].join(","),
      },
      { expectedAdditionalClientIds: "com.zenflow.app.ios,com.zenflow.app.android" },
    );

    expect(failures).toContain("Missing hosted Apple additional client ID: com.zenflow.app.android");
  });

  it("can verify hosted Apple auth through the exported helper without printing tokens", async () => {
    expect(typeof checkAppleAuthLive).toBe("function");
    const token = "sbp_live_token_must_not_print";
    const requests: Array<{ url: string; authorization?: string }> = [];

    const result = await checkAppleAuthLive?.({
      env: {
        SUPABASE_ACCESS_TOKEN: token,
        SUPABASE_PROJECT_REF: "bwgfslmxmueyglpumkbf",
        SUPABASE_EXPECTED_APPLE_CLIENT_ID: "com.zenflow.app.web",
        SUPABASE_EXPECTED_APPLE_ADDITIONAL_CLIENT_IDS: "com.zenflow.app",
      },
      fetchImpl: (async (url: URL | RequestInfo, init?: RequestInit) => {
        const headers = init?.headers as Record<string, string>;
        requests.push({ url: String(url), authorization: headers?.Authorization });
        return new Response(JSON.stringify({
          external_apple_enabled: true,
          external_apple_client_id: "com.zenflow.app.web",
          external_apple_additional_client_ids: "com.zenflow.app",
          uri_allow_list: [
            "https://yehor212.github.io/people-first-app/",
            "https://yehor212.github.io/people-first-app/orb?nav=v2",
            "https://yehor212.github.io/people-first-app/orb?nav=v2&navLayout=phone",
            "https://yehor212.github.io/people-first-app/habits?nav=v2",
            "https://yehor212.github.io/people-first-app/diary?nav=v2",
            "https://yehor212.github.io/people-first-app/planning?nav=v2",
            "https://yehor212.github.io/people-first-app/planning?nav=v2&navLayout=phone",
            "https://yehor212.github.io/people-first-app/settings?nav=v2",
            "capacitor://localhost/",
            "com.zenflow.app://login-callback",
          ].join(","),
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as typeof fetch,
    });

    expect(result).toMatchObject({ status: "PASS", exitCode: 0 });
    expect(result?.message).not.toContain(token);
    expect(requests).toEqual([
      {
        url: "https://api.supabase.com/v1/projects/bwgfslmxmueyglpumkbf/config/auth",
        authorization: "Bearer " + token,
      },
    ]);
  });
});
