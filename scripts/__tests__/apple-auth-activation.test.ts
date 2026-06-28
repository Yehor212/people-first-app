import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const script = "scripts/check-apple-auth-activation.cjs";
const scriptPath = join(process.cwd(), script);
const require = createRequire(import.meta.url);

function loadActivationModule() {
  return require("../check-apple-auth-activation.cjs") as {
    buildActivationReport?: (input?: {
      env?: NodeJS.ProcessEnv;
      rootDir?: string;
      nowMs?: number;
      publicResult?: { status: string; message: string; exitCode: number } | null;
    }) => {
      status: string;
      exitCode: number;
      lines: string[];
    };
  };
}

function runScriptInFixture(files: Record<string, string>, env: NodeJS.ProcessEnv = {}) {
  const root = mkdtempSync(join(tmpdir(), "apple-auth-activation-"));
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
      SUPABASE_APPLE_CLIENT_ID: "",
      SUPABASE_APPLE_CLIENT_SECRET: "",
      SUPABASE_APPLE_TEAM_ID: "",
      SUPABASE_APPLE_KEY_ID: "",
      SUPABASE_APPLE_PRIVATE_KEY_PATH: "",
      SUPABASE_APPLE_PRIVATE_KEY: "",
      ZENFLOW_APPLE_AUTH_ACTIVATION_SKIP_PUBLIC: "true",
      ...env,
    },
    encoding: "utf8",
  });
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}


function redactionFixtureValue(...parts: string[]) {
  return parts.join("_");
}

const supabaseAccessTokenEnvKey = ["SUPABASE", "ACCESS", "TOKEN"].join("_");
const appleClientCredentialEnvKey = ["SUPABASE", "APPLE", "CLIENT", "SECRET"].join("_");

function fixtureAppleClientSecret(payload: Record<string, unknown>) {
  return `${base64UrlJson({ alg: "ES256", kid: "KEYID12345", typ: "JWT" })}.${base64UrlJson(payload)}.fixture-signature`;
}

describe("check-apple-auth-activation", () => {
  it("prints a secretless Apple and Supabase activation packet", () => {
    const { buildActivationReport } = loadActivationModule();
    expect(typeof buildActivationReport).toBe("function");

    const sensitiveToken = redactionFixtureValue("sbp", "redaction", "token", "must", "not", "print");
    const sensitiveJwt = redactionFixtureValue("apple", "redaction", "jwt", "must", "not", "print");
    const report = buildActivationReport?.({
      env: {
        VITE_SUPABASE_URL: "https://bwgfslmxmueyglpumkbf.supabase.co",
        [supabaseAccessTokenEnvKey]: sensitiveToken,
        SUPABASE_APPLE_CLIENT_ID: "com.zenflow.app.web",
        [appleClientCredentialEnvKey]: sensitiveJwt,
        SUPABASE_APPLE_ADDITIONAL_CLIENT_IDS: "com.zenflow.app",
      },
      publicResult: { status: "FAIL", message: "Apple provider is disabled in public Supabase Auth settings", exitCode: 1 },
    });

    const output = report?.lines.join("\n") ?? "";
    expect(report).toMatchObject({ status: "FAIL", exitCode: 1 });
    expect(output).toContain("Apple Website URL domain: bwgfslmxmueyglpumkbf.supabase.co");
    expect(output).toContain("Apple return URL: https://bwgfslmxmueyglpumkbf.supabase.co/auth/v1/callback");
    expect(output).toContain("Supabase Site URL: https://yehor212.github.io/people-first-app/");
    expect(output).toContain("Supabase redirect URL: com.zenflow.app://login-callback");
    expect(output).toContain("Present secret env: SUPABASE_ACCESS_TOKEN");
    expect(output).toContain("Present Apple OAuth input: SUPABASE_APPLE_CLIENT_ID");
    expect(output).toContain("Present Apple secret source: SUPABASE_APPLE_CLIENT_SECRET");
    expect(output).toContain("Configured native Apple additional client IDs from SUPABASE_APPLE_ADDITIONAL_CLIENT_IDS");
    expect(output).toContain("Current public provider status: FAIL Apple provider is disabled in public Supabase Auth settings");
    expect(output).toContain("Apply hosted Apple Auth safely with: npm run activate:apple-auth-live");
    expect(output).not.toContain(sensitiveToken);
    expect(output).not.toContain(sensitiveJwt);
  });

  it("warns when the Apple client secret is close to expiry without printing it", () => {
    const { buildActivationReport } = loadActivationModule();
    const nowMs = Date.UTC(2026, 5, 18, 0, 0, 0);
    const sensitiveJwt = fixtureAppleClientSecret({
      iss: "TEAMID1234",
      sub: "com.zenflow.app.web",
      aud: "https://appleid.apple.com",
      iat: Math.floor(nowMs / 1000),
      exp: Math.floor((nowMs + 10 * 24 * 60 * 60 * 1000) / 1000),
    });

    const report = buildActivationReport?.({
      env: {
        VITE_SUPABASE_URL: "https://bwgfslmxmueyglpumkbf.supabase.co",
        [supabaseAccessTokenEnvKey]: redactionFixtureValue("sbp", "redaction", "token", "must", "not", "print"),
        SUPABASE_APPLE_CLIENT_ID: "com.zenflow.app.web",
        [appleClientCredentialEnvKey]: sensitiveJwt,
      },
      nowMs,
      publicResult: { status: "PASS", message: "Apple provider is enabled in public Supabase Auth settings", exitCode: 0 },
    });

    const output = report?.lines.join("\n") ?? "";
    expect(report).toMatchObject({ status: "UNVERIFIED", exitCode: 2 });
    expect(output).toContain("Apple client secret expires in 10 day(s); rotate before applying hosted Apple Auth");
    expect(output).not.toContain(sensitiveJwt);
  });

  it("reports missing activation inputs without treating placeholders as live values", () => {
    const result = runScriptInFixture({
      ".env.example": "VITE_SUPABASE_URL=https://your-project-ref.supabase.co\n",
      ".env.local": "VITE_SUPABASE_URL=https://bwgfslmxmueyglpumkbf.supabase.co\n",
    });

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("[apple-auth-activation] INFO Apple return URL: https://bwgfslmxmueyglpumkbf.supabase.co/auth/v1/callback");
    expect(result.stdout).toContain("[apple-auth-activation] ACTION Missing secret env: SUPABASE_ACCESS_TOKEN");
    expect(result.stdout).toContain("[apple-auth-activation] ACTION Missing Apple OAuth input: SUPABASE_APPLE_CLIENT_ID");
    expect(result.stdout).toContain("[apple-auth-activation] ACTION Missing Apple secret source: SUPABASE_APPLE_CLIENT_SECRET or signing key inputs");
    expect(result.stdout).not.toContain("your-project-ref");
  });
});
