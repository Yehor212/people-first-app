import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const script = "scripts/check-sentry-readiness.cjs";

function testToken(...parts: string[]) {
  return parts.join("_");
}

function runReadiness(env: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      SENTRY_AUTH_TOKEN: "",
      SENTRY_ORG: "",
      SENTRY_PROJECT: "",
      SENTRY_BASE_URL: "",
      VITE_SENTRY_DSN: "",
      ZENFLOW_SENTRY_READINESS_REQUIRED: "",
      ...env,
    },
    encoding: "utf8",
  });
}

describe("check-sentry-readiness", () => {
  it("reports UNVERIFIED when required Sentry API/upload env is missing", () => {
    const result = runReadiness();

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[sentry-readiness] UNVERIFIED");
    expect(result.stdout).toContain("SENTRY_AUTH_TOKEN");
    expect(result.stdout).toContain("SENTRY_ORG");
    expect(result.stdout).toContain("SENTRY_PROJECT");
    expect(result.stdout).toContain("docs/SENTRY_LIVE_PROOF.md");
  });

  it("exits non-zero in required mode when Sentry upload env is missing", () => {
    const result = runReadiness({
      ZENFLOW_SENTRY_READINESS_REQUIRED: "true",
    });

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("[sentry-readiness] UNVERIFIED");
    expect(result.stdout).toContain("SENTRY_AUTH_TOKEN");
  });

  it("does not print secret values when Sentry env is present", () => {
    const secret = testToken("sentry", "fixture", "must", "stay", "hidden", "readiness");
    const result = runReadiness({
      VITE_SENTRY_DSN: "https://public@example.ingest.sentry.io/1",
      SENTRY_AUTH_TOKEN: secret,
      SENTRY_ORG: "zenflow-org",
      SENTRY_PROJECT: "zenflow-web",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[sentry-readiness] PASS");
    expect(result.stdout).not.toContain(secret);
    expect(result.stderr).not.toContain(secret);
  });

  it("documents every required Sentry readiness key without real secrets", () => {
    const example = readFileSync(".env.example", "utf8");

    for (const key of [
      "VITE_SENTRY_DSN",
      "SENTRY_AUTH_TOKEN",
      "SENTRY_ORG",
      "SENTRY_PROJECT",
      "SENTRY_BASE_URL",
    ]) {
      expect(example).toContain(`${key}=`);
    }

    expect(example).not.toMatch(/sntrys_[A-Za-z0-9_\-]{20,}/);
  });

  it("rejects placeholder Sentry upload env instead of reporting PASS", () => {
    const result = runReadiness({
      VITE_SENTRY_DSN: "https://public@example.ingest.sentry.io/1",
      SENTRY_AUTH_TOKEN: "<sentry-auth-token>",
      SENTRY_ORG: "your-org",
      SENTRY_PROJECT: "your-project",
      ZENFLOW_SENTRY_READINESS_REQUIRED: "true",
    });

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("[sentry-readiness] UNVERIFIED");
    expect(result.stdout).toContain("SENTRY_AUTH_TOKEN");
    expect(result.stdout).toContain("SENTRY_ORG");
    expect(result.stdout).toContain("SENTRY_PROJECT");
  });

  it("rejects .env.example-style underscore placeholders instead of reporting PASS", () => {
    const result = runReadiness({
      VITE_SENTRY_DSN: "https://public@example.ingest.sentry.io/1",
      SENTRY_AUTH_TOKEN: "your_sentry_auth_token_ci_only",
      SENTRY_ORG: "your_sentry_org_slug",
      SENTRY_PROJECT: "your_sentry_project_slug",
      ZENFLOW_SENTRY_READINESS_REQUIRED: "true",
    });

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("[sentry-readiness] UNVERIFIED");
    expect(result.stdout).toContain("SENTRY_AUTH_TOKEN");
    expect(result.stdout).toContain("SENTRY_ORG");
    expect(result.stdout).toContain("SENTRY_PROJECT");
  });

});
