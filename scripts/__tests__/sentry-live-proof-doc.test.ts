import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const docPath = "docs/SENTRY_LIVE_PROOF.md";

describe("Sentry live proof runbook", () => {
  it("documents the exact secret-safe setup and verification flow", () => {
    const doc = readFileSync(docPath, "utf8");

    for (const key of [
      "VITE_SENTRY_DSN",
      "SENTRY_AUTH_TOKEN",
      "SENTRY_ORG",
      "SENTRY_PROJECT",
      "SENTRY_BASE_URL",
    ]) {
      expect(doc).toContain(key);
    }

    for (const command of [
      "npm run check:sentry",
      "npm run apply:sentry-github",
      "ZENFLOW_SENTRY_GITHUB_APPLY=true",
      "ZENFLOW_SENTRY_STATUS_REQUIRED=true npm run check:sentry",
      "npm run check:sentry-artifacts",
    ]) {
      expect(doc).toContain(command);
    }

    expect(doc).toContain("Never paste SENTRY_AUTH_TOKEN into chat");
    expect(doc).toContain("GitHub secret");
    expect(doc).toContain("GitHub variable");
    expect(doc).toContain("UNVERIFIED");
    expect(doc).toContain("PASS");
  });

  it("does not contain real-looking Sentry credentials", () => {
    const doc = readFileSync(docPath, "utf8");

    expect(doc).not.toMatch(/sntrys_[A-Za-z0-9_-]{20,}/);
    expect(doc).not.toMatch(/https:\/\/[^\s`]+@[A-Za-z0-9.-]*sentry\.io\/\d+/);
    expect(doc).not.toContain("--body");
  });
});
