import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

describe("ad journey contract", () => {
  it("does not document rewarded ads inside the focus reflection dialog", () => {
    const doc = readFileSync(join(repoRoot, "docs/AD_SYSTEM_JOURNEY.md"), "utf8");

    expect(doc).not.toMatch(/RewardedAdPrompt[^\n]+reflection dialog/i);
    expect(doc).not.toMatch(/\[reflection dialog\][\s\S]{0,240}RewardedAdPrompt/i);
  });

  it("does not allow scarcity or care-failure pressure for the Android banner placement", () => {
    const doc = readFileSync(join(repoRoot, "docs/AD_SYSTEM_JOURNEY.md"), "utf8");

    expect(doc).not.toMatch(/can't (feed|water)/i);
    expect(doc).not.toMatch(/need treats\? watch/i);
    expect(doc).not.toMatch(/needs you|care failure|streak harm|countdown/i);
    expect(doc).toContain("No scarcity or guilt copy");
  });

  it("keeps the docs privacy policy aligned with optional external services", () => {
    const doc = readFileSync(join(repoRoot, "docs/privacy-policy.html"), "utf8");

    expect(doc).toContain("Google Mobile Ads");
    expect(doc).toContain("Google User Messaging Platform");
    expect(doc).not.toContain("All data is stored locally on your device");
    expect(doc).not.toContain("No data transmission means no risk of server breaches");
  });
});
