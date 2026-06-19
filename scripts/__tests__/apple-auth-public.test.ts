import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const script = "scripts/check-apple-auth-public.cjs";
const scriptPath = join(process.cwd(), script);
const require = createRequire(import.meta.url);
const { checkAppleAuthPublic, inspectPublicAuthSettings } = require("../check-apple-auth-public.cjs") as {
  checkAppleAuthPublic: (input?: {
    env?: NodeJS.ProcessEnv;
    rootDir?: string;
    fetchImpl?: typeof fetch;
  }) => Promise<{ status: string; message: string; exitCode: number }>;
  inspectPublicAuthSettings: (settings: Record<string, unknown>) => string[];
};

interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function testSecretFixture(...parts: string[]) {
  return parts.join("_");
}

function runScript(env: NodeJS.ProcessEnv = {}, cwd = process.cwd()) {
  return new Promise<RunResult>((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd,
      env: {
        ...process.env,
        VITE_SUPABASE_PUBLISHABLE_KEY: "",
        VITE_SUPABASE_URL: "",
        VITE_SUPABASE_ANON_KEY: "",
        SUPABASE_PUBLISHABLE_KEY: "",
        SUPABASE_URL: "",
        SUPABASE_ANON_KEY: "",
        ZENFLOW_APPLE_AUTH_PUBLIC_REQUIRED: "",
        ...env,
      },
    });

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

function runScriptInFixture(files: Record<string, string>, env: NodeJS.ProcessEnv = {}) {
  const root = mkdtempSync(join(tmpdir(), "apple-auth-public-"));
  mkdirSync(join(root, "scripts"), { recursive: true });
  copyFileSync(scriptPath, join(root, script));
  for (const [file, content] of Object.entries(files)) {
    writeFileSync(join(root, file), content);
  }
  return runScript(env, root);
}

describe("check-apple-auth-public", () => {
  it("reports UNVERIFIED when public Supabase URL or anon key is missing", async () => {
    const result = await runScriptInFixture({});

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[apple-auth-public] UNVERIFIED");
    expect(result.stdout).toContain("VITE_SUPABASE_URL");
    expect(result.stdout).toContain("VITE_SUPABASE_ANON_KEY");
  });

  it("detects Apple provider state from public Auth settings", () => {
    expect(inspectPublicAuthSettings({ external: { apple: true } })).toEqual([]);
    expect(inspectPublicAuthSettings({ external: { apple: false } })).toEqual([
      "Apple provider is disabled in public Supabase Auth settings",
    ]);
  });

  it("does not treat .env.example placeholders as live Supabase config", async () => {
    const result = await runScriptInFixture({
      ".env.example": [
        "VITE_SUPABASE_URL=https://your-project-ref.supabase.co",
        "VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_public_key",
        "VITE_SUPABASE_ANON_KEY=your_supabase_anon_key",
      ].join("\n"),
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[apple-auth-public] UNVERIFIED");
    expect(result.stdout).toContain("missing VITE_SUPABASE_URL");
    expect(result.stdout).toContain("VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY");
  });

  it("checks the hosted public Auth settings endpoint without returning the anon key", async () => {
    const anonKey = testSecretFixture("anon", "fixture", "must", "stay", "hidden");
    const requests: Array<{ url: string; apikey?: string }> = [];

    const result = await checkAppleAuthPublic({
      env: {
        VITE_SUPABASE_URL: "https://supabase.example.test",
        VITE_SUPABASE_ANON_KEY: anonKey,
      },
      fetchImpl: (async (url: URL | RequestInfo, init?: RequestInit) => {
        requests.push({
          url: String(url),
          apikey: (init?.headers as Record<string, string>)?.apikey,
        });
        return new Response(JSON.stringify({ external: { apple: true } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as typeof fetch,
    });

    expect(result).toMatchObject({ status: "PASS", exitCode: 0 });
    expect(requests).toEqual([{ url: "https://supabase.example.test/auth/v1/settings", apikey: anonKey }]);
    expect(result.message).not.toContain(anonKey);
  });

  it("uses a modern publishable key when no legacy anon key is configured", async () => {
    const publishableKey = "sb_publishable_fixture_key_that_must_stay_public_but_unprinted";
    const requests: Array<{ url: string; apikey?: string; authorization?: string }> = [];

    const result = await checkAppleAuthPublic({
      env: {
        VITE_SUPABASE_URL: "https://supabase.example.test",
        VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      },
      fetchImpl: (async (url: URL | RequestInfo, init?: RequestInit) => {
        const headers = init?.headers as Record<string, string>;
        requests.push({
          url: String(url),
          apikey: headers?.apikey,
          authorization: headers?.Authorization,
        });
        return new Response(JSON.stringify({ external: { apple: true } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as typeof fetch,
    });

    expect(result).toMatchObject({ status: "PASS", exitCode: 0 });
    expect(requests).toEqual([
      {
        url: "https://supabase.example.test/auth/v1/settings",
        apikey: publishableKey,
        authorization: undefined,
      },
    ]);
    expect(result.message).not.toContain(publishableKey);
  });

  it("does not print anon key values in CLI output", async () => {
    const anonKey = testSecretFixture("anon", "fixture", "must", "stay", "hidden");
    const result = await runScript({ VITE_SUPABASE_URL: "not-a-valid-url", VITE_SUPABASE_ANON_KEY: anonKey });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[apple-auth-public] UNVERIFIED");
    expect(result.stdout).not.toContain(anonKey);
    expect(result.stderr).not.toContain(anonKey);
  });
});
