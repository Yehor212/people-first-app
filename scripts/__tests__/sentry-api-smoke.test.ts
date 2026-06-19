import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const script = "scripts/smoke-sentry-api.cjs";
const require = createRequire(import.meta.url);
const { smokeSentryApi } = require("../smoke-sentry-api.cjs") as {
  smokeSentryApi: (input?: {
    env?: NodeJS.ProcessEnv;
    fetchImpl?: typeof fetch;
  }) => Promise<{ status: string; message: string; exitCode: number }>;
};

function testToken(...parts: string[]) {
  return parts.join("_");
}

function runSmoke(env: NodeJS.ProcessEnv = {}) {
  return new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(process.execPath, [script], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        SENTRY_AUTH_TOKEN: "",
        SENTRY_ORG: "",
        SENTRY_PROJECT: "",
        SENTRY_BASE_URL: "",
        SENTRY_ENVIRONMENT: "",
        SENTRY_TIME_RANGE: "",
        ZENFLOW_SENTRY_API_REQUIRED: "",
        ...env,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

describe("smoke-sentry-api", () => {
  it("is wired as an npm script and does not contain token-printing helpers", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts?: Record<string, string> };
    const source = readFileSync(script, "utf8");

    expect(pkg.scripts?.["smoke:sentry-api"]).toBe("node scripts/smoke-sentry-api.cjs");
    expect(source).toContain("SENTRY_AUTH_TOKEN");
    expect(source).toContain("/api/0/projects/");
    expect(source).not.toContain("console.log(process.env.SENTRY_AUTH_TOKEN");
    expect(source).not.toContain("SENTRY_AUTH_TOKEN=");
  });

  it("reports UNVERIFIED without failing when API env is missing", async () => {
    const result = await runSmoke();

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[sentry-api] UNVERIFIED");
    expect(result.stdout).toContain("SENTRY_AUTH_TOKEN");
    expect(result.stdout).toContain("SENTRY_ORG");
    expect(result.stdout).toContain("SENTRY_PROJECT");
    expect(result.stdout).toContain("docs/SENTRY_LIVE_PROOF.md");
  });

  it("exits 2 in required mode when API env is missing", async () => {
    const result = await runSmoke({ ZENFLOW_SENTRY_API_REQUIRED: "true" });

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("[sentry-api] UNVERIFIED");
  });

  it("passes after making a read-only list-issues request", async () => {
    const secret = testToken("sentry", "live", "fixture", "must", "stay", "hidden");
    const requests: Array<{ url: URL; init?: RequestInit }> = [];

    const result = await smokeSentryApi({
      env: {
        SENTRY_AUTH_TOKEN: secret,
        SENTRY_ORG: "zenflow-org",
        SENTRY_PROJECT: "zenflow-web",
        SENTRY_BASE_URL: "https://sentry.example.test",
      },
      fetchImpl: (async (url: URL | RequestInfo, init?: RequestInit) => {
        requests.push({ url: new URL(String(url)), init });
        return new Response(JSON.stringify([{ id: "1" }]), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as typeof fetch,
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].init?.method).toBe("GET");
    expect(requests[0].url.pathname).toBe("/api/0/projects/zenflow-org/zenflow-web/issues/");
    expect(requests[0].url.searchParams.get("statsPeriod")).toBe("24h");
    expect((requests[0].init?.headers as Record<string, string>).authorization).toBe("Bearer " + secret);
    expect(result).toMatchObject({ status: "PASS", exitCode: 0 });
    expect(result.message).toContain("issuesSample=1");
    expect(result.message).not.toContain(secret);
  });

  it("fails without returning the token when Sentry returns auth errors", async () => {
    const secret = testToken("sentry", "bad", "fixture", "must", "stay", "hidden");

    const result = await smokeSentryApi({
      env: {
        SENTRY_AUTH_TOKEN: secret,
        SENTRY_ORG: "zenflow-org",
        SENTRY_PROJECT: "zenflow-web",
        SENTRY_BASE_URL: "https://sentry.example.test",
      },
      fetchImpl: (async () =>
        new Response(JSON.stringify({ detail: "bad token" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        })) as typeof fetch,
    });

    expect(result).toMatchObject({ status: "FAIL", exitCode: 1 });
    expect(result.message).toContain("status=401");
    expect(result.message).not.toContain(secret);
  });

  it("rejects placeholder Sentry API env before calling fetch", async () => {
    let called = false;

    const result = await smokeSentryApi({
      env: {
        SENTRY_AUTH_TOKEN: "<sentry-auth-token>",
        SENTRY_ORG: "your-org",
        SENTRY_PROJECT: "your-project",
        ZENFLOW_SENTRY_API_REQUIRED: "true",
      },
      fetchImpl: (async () => {
        called = true;
        return new Response("[]", { status: 200 });
      }) as typeof fetch,
    });

    expect(called).toBe(false);
    expect(result).toMatchObject({ status: "UNVERIFIED", exitCode: 2 });
    expect(result.message).toContain("SENTRY_AUTH_TOKEN");
    expect(result.message).toContain("SENTRY_ORG");
    expect(result.message).toContain("SENTRY_PROJECT");
  });

  it("rejects .env.example-style underscore placeholders before calling fetch", async () => {
    let called = false;

    const result = await smokeSentryApi({
      env: {
        SENTRY_AUTH_TOKEN: "your_sentry_auth_token_ci_only",
        SENTRY_ORG: "your_sentry_org_slug",
        SENTRY_PROJECT: "your_sentry_project_slug",
        ZENFLOW_SENTRY_API_REQUIRED: "true",
      },
      fetchImpl: (async () => {
        called = true;
        return new Response("[]", { status: 200 });
      }) as typeof fetch,
    });

    expect(called).toBe(false);
    expect(result).toMatchObject({ status: "UNVERIFIED", exitCode: 2 });
    expect(result.message).toContain("SENTRY_AUTH_TOKEN");
    expect(result.message).toContain("SENTRY_ORG");
    expect(result.message).toContain("SENTRY_PROJECT");
  });

  it("reports UNVERIFIED when the runtime has no fetch implementation", async () => {
    const result = await smokeSentryApi({
      env: {
        SENTRY_AUTH_TOKEN: testToken("sentry", "token", "present"),
        SENTRY_ORG: "zenflow-org",
        SENTRY_PROJECT: "zenflow-web",
        SENTRY_BASE_URL: "https://sentry.example.test",
        ZENFLOW_SENTRY_API_REQUIRED: "true",
      },
      fetchImpl: null as unknown as typeof fetch,
    });

    expect(result).toMatchObject({ status: "UNVERIFIED", exitCode: 2 });
    expect(result.message).toContain("fetch");
  });

});
