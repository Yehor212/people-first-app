import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import capacitorConfig from "../../capacitor.config";
import { areAdsRuntimeEnabled } from "../../src/lib/adRuntimePolicy";

const require = createRequire(import.meta.url);
const checker = require("../check-android-admob-release-artifact.cjs") as {
  evaluateArtifactBuffer: (input: {
    bytes: Buffer;
    appId: string;
    bannerId: string;
    appAdsText: string;
    nativePluginsJson?: string;
    dexBytes?: Buffer;
  }) => { ok: boolean; issues: string[]; adUnitCount: number };
};

const publisher = "pub-1111222233334444";
const appId = `ca-app-${publisher}~1000000000`;
const bannerId = `ca-app-${publisher}/2000000000`;
const nativePluginsJson = JSON.stringify([
  { pkg: "@capacitor-community/admob", classpath: "com.getcapacitor.community.admob.AdMob" },
]);
const dexBytes = Buffer.from("Lcom/getcapacitor/community/admob/AdMob;");

describe("Android AdMob release artifact gate", () => {
  it("accepts exactly the configured app and banner ids", () => {
    const report = checker.evaluateArtifactBuffer({
      bytes: Buffer.from(`manifest:${appId}\nbundle:${bannerId}`),
      appId,
      bannerId,
      appAdsText: `google.com, ${publisher}, DIRECT, f08c47fec0942fa0`,
      nativePluginsJson,
      dexBytes,
    });

    expect(report).toEqual({ ok: true, issues: [], adUnitCount: 1 });
  });

  it("includes the native AdMob plugin in the Android sync allowlist", () => {
    expect(capacitorConfig.android?.includePlugins).toContain("@capacitor-community/admob");
    expect(areAdsRuntimeEnabled("android")).toBe(true);
    for (const platform of ["web", "ios", "desktop", "pwa", ""]) {
      expect(areAdsRuntimeEnabled(platform)).toBe(false);
    }
  });

  it.each([
    ["missing", undefined],
    ["malformed", "{"],
    ["not an array", "{}"],
    ["missing AdMob", "[]"],
    [
      "wrong class",
      JSON.stringify([{ pkg: "@capacitor-community/admob", classpath: "wrong.Plugin" }]),
    ],
    [
      "duplicate registration",
      JSON.stringify([
        { pkg: "@capacitor-community/admob", classpath: "com.getcapacitor.community.admob.AdMob" },
        { pkg: "@capacitor-community/admob", classpath: "com.getcapacitor.community.admob.AdMob" },
      ]),
    ],
  ])("rejects %s native plugin registration even with valid ad ids", (_label, registry) => {
    const report = checker.evaluateArtifactBuffer({
      bytes: Buffer.from(`manifest:${appId}\nbundle:${bannerId}`),
      appId,
      bannerId,
      appAdsText: `google.com, ${publisher}, DIRECT, f08c47fec0942fa0`,
      nativePluginsJson: registry,
      dexBytes,
    });
    expect(report.ok).toBe(false);
    expect(report.issues).toContain("invalid_or_missing_native_admob_registration");
  });

  it("rejects a registry-only plugin whose native implementation is absent", () => {
    const report = checker.evaluateArtifactBuffer({
      bytes: Buffer.from(`manifest:${appId}\nbundle:${bannerId}`),
      appId,
      bannerId,
      appAdsText: `google.com, ${publisher}, DIRECT, f08c47fec0942fa0`,
      nativePluginsJson,
      dexBytes: Buffer.from("unrelated native classes"),
    });
    expect(report.ok).toBe(false);
    expect(report.issues).toContain("native_admob_implementation_missing");
  });

  it("rejects Google sample ids even when the configured ids are real", () => {
    const report = checker.evaluateArtifactBuffer({
      bytes: Buffer.from(
        `manifest:${appId}\nbundle:${bannerId}\nca-app-pub-3940256099942544/6300978111`
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
      bytes: Buffer.from(`manifest:${appId}\nbundle:${bannerId}\nca-app-${publisher}/3000000000`),
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
