import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const checker = require("../check-android-admob-release-artifact.cjs") as {
  evaluateArtifactBuffer: (input: {
    bytes: Buffer;
    appId: string;
    bannerId: string;
    appAdsText: string;
  }) => { ok: boolean; issues: string[]; adUnitCount: number };
};

const publisher = "pub-1111222233334444";
const appId = `ca-app-${publisher}~1000000000`;
const bannerId = `ca-app-${publisher}/2000000000`;

describe("Android AdMob release artifact gate", () => {
  it("accepts exactly the configured app and banner ids", () => {
    const report = checker.evaluateArtifactBuffer({
      bytes: Buffer.from(`manifest:${appId}\nbundle:${bannerId}`),
      appId,
      bannerId,
      appAdsText: `google.com, ${publisher}, DIRECT, f08c47fec0942fa0`,
    });

    expect(report).toEqual({ ok: true, issues: [], adUnitCount: 1 });
  });

  it("rejects Google sample ids even when the configured ids are real", () => {
    const report = checker.evaluateArtifactBuffer({
      bytes: Buffer.from(
        `manifest:${appId}\nbundle:${bannerId}\nca-app-pub-3940256099942544/6300978111`,
      ),
      appId,
      bannerId,
      appAdsText: `google.com, ${publisher}, DIRECT, f08c47fec0942fa0`,
    });

    expect(report.ok).toBe(false);
    expect(report.issues).toContain("google_sample_id_present");
  });

  it("rejects any second ad unit id such as a legacy rewarded unit", () => {
    const report = checker.evaluateArtifactBuffer({
      bytes: Buffer.from(
        `manifest:${appId}\nbundle:${bannerId}\nca-app-${publisher}/3000000000`,
      ),
      appId,
      bannerId,
      appAdsText: `google.com, ${publisher}, DIRECT, f08c47fec0942fa0`,
    });

    expect(report.ok).toBe(false);
    expect(report.issues).toContain("unexpected_ad_unit_id_present");
  });

  it("rejects an artifact that omits the configured production banner", () => {
    const report = checker.evaluateArtifactBuffer({
      bytes: Buffer.from(`manifest:${appId}`),
      appId,
      bannerId,
      appAdsText: `google.com, ${publisher}, DIRECT, f08c47fec0942fa0`,
    });

    expect(report.ok).toBe(false);
    expect(report.issues).toContain("configured_banner_id_missing");
  });
});
