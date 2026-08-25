import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const admob = require("../check-admob-production-readiness.cjs") as {
  evaluateAdMobProductionReadiness: (input: {
    env: Record<string, string | undefined>;
    appAdsText?: string;
    monetizationMode?: "android-banner";
  }) => {
    ok: boolean;
    issues: Array<{ code: string; key?: string; message: string }>;
    warnings: Array<{ code: string; key?: string; message: string }>;
    summary: Record<string, string>;
  };
};
const publicCheck = require("../check-app-ads-public.cjs") as {
  validateAppAdsBody: (input: { body: string; expectedPublisherId?: string }) => {
    ok: boolean;
    publisherId?: string;
    maskedPublisherId?: string;
    issues: Array<{ code: string; message: string }>;
  };
};

const realPublisherId = "pub-9501460293702808";
const realAppId = `ca-app-${realPublisherId}~1234567890`;
const realBannerId = `ca-app-${realPublisherId}/9876543210`;
const sampleBannerId = "ca-app-pub-3940256099942544/6300978111";
const validAppAds = `google.com, ${realPublisherId}, DIRECT, f08c47fec0942fa0`;
const script = "scripts/check-admob-production-readiness.cjs";

describe("AdMob production readiness guards", () => {
  it("accepts Android banner-only readiness without a rewarded ad unit", () => {
    const report = admob.evaluateAdMobProductionReadiness({
      env: {
        VITE_ADMOB_APP_ID_ANDROID: realAppId,
        VITE_ADMOB_BANNER_ID_ANDROID: realBannerId,
      },
      appAdsText: validAppAds,
      monetizationMode: "android-banner",
    });

    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.summary.VITE_ADMOB_BANNER_ID_ANDROID).toBe(
      "present:pub-9501********2808",
    );
    expect(report.summary).not.toHaveProperty("VITE_ADMOB_REWARDED_ID_ANDROID");
  });

  it("rejects Google's sample banner ID before production monetization", () => {
    const report = admob.evaluateAdMobProductionReadiness({
      env: {
        VITE_ADMOB_APP_ID_ANDROID: realAppId,
        VITE_ADMOB_BANNER_ID_ANDROID: sampleBannerId,
      },
      appAdsText: validAppAds,
    });

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        code: "sample_admob_id",
        key: "VITE_ADMOB_BANNER_ID_ANDROID",
      }),
    );
    expect(JSON.stringify(report.summary)).not.toContain(realPublisherId);
  });

  it("passes for a real Android app ID, real banner unit, and matching app-ads.txt", () => {
    const report = admob.evaluateAdMobProductionReadiness({
      env: {
        VITE_ADMOB_APP_ID_ANDROID: realAppId,
        VITE_ADMOB_BANNER_ID_ANDROID: realBannerId,
      },
      appAdsText: validAppAds,
    });

    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.summary.VITE_ADMOB_APP_ID_ANDROID).toBe("present:pub-9501********2808");
    expect(report.summary.VITE_ADMOB_BANNER_ID_ANDROID).toBe("present:pub-9501********2808");
  });

  it("rejects retired monetization modes instead of falling back to banner", () => {
    expect(() =>
      admob.evaluateAdMobProductionReadiness({
        env: {
          VITE_ADMOB_APP_ID_ANDROID: realAppId,
          VITE_ADMOB_BANNER_ID_ANDROID: realBannerId,
        },
        appAdsText: validAppAds,
        monetizationMode: "android-rewarded" as never,
      }),
    ).toThrow("Unsupported AdMob monetization mode");
  });

  it("makes the default release command explicitly Android banner-only", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    const assetChecker = readFileSync("scripts/check-google-play-release-assets.cjs", "utf8");

    expect(packageJson.scripts["google-play:admob:check"]).toBe(
      "node scripts/check-admob-production-readiness.cjs --mode android-banner",
    );
    expect(assetChecker).toContain(
      'packageJson.scripts?.["google-play:admob:check"] !== "node scripts/check-admob-production-readiness.cjs --mode android-banner"',
    );
    expect(packageJson.scripts).not.toHaveProperty("google-play:admob:check:full");
  });

  it("returns PASS from the banner-only CLI without a rewarded ad unit", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "zenflow-admob-banner-readiness-"));
    const appAdsFile = join(tempDir, "app-ads.txt");
    writeFileSync(appAdsFile, validAppAds, "utf8");

    try {
      const result = spawnSync(
        process.execPath,
        [script, "--mode", "android-banner", "--app-ads-file", appAdsFile],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            VITE_ADMOB_APP_ID_ANDROID: realAppId,
            VITE_ADMOB_BANNER_ID_ANDROID: realBannerId,
            VITE_ADMOB_REWARDED_ID_ANDROID: "",
            VITE_ADMOB_REWARDED_ID_IOS: "",
            VITE_ADMOB_BANNER_ID_IOS: "",
          },
          encoding: "utf8",
        },
      );

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("PASS - Android banner AdMob ids");
      expect(result.stdout).not.toContain("VITE_ADMOB_REWARDED_ID_ANDROID");
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("exposes a ZenFlow-specific public app-ads check command for repeatable live proof", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

    expect(packageJson.scripts["google-play:app-ads:public-check"]).toBe("node scripts/check-app-ads-public.cjs");
    expect(packageJson.scripts["google-play:app-ads:public-check:zenflow"]).toBe(
      "node scripts/check-app-ads-public.cjs --url https://yehor212.github.io/app-ads.txt",
    );
  });

  it("keeps privacy artifact and post-deploy public privacy proof inside Google Play release asset checks", () => {
    const checkerSource = readFileSync("scripts/check-google-play-release-assets.cjs", "utf8");

    expect(checkerSource).toContain("google-play:privacy:public-check");
    expect(checkerSource).toContain("google-play:privacy:artifact-check");
    expect(checkerSource).toContain("post-deploy public privacy smoke");
  });

  it("keeps AdMob and public Play listing guards inside the release-contract suite", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    const releaseContracts = packageJson.scripts["test:release-contracts"];

    expect(releaseContracts).toContain("scripts/__tests__/admob-production-readiness.test.ts");
    expect(releaseContracts).toContain("scripts/__tests__/google-play-public-listing.test.ts");
  });

  it("validates the public app-ads.txt body against the expected publisher", () => {
    const result = publicCheck.validateAppAdsBody({
      body: `${validAppAds}\n`,
      expectedPublisherId: realPublisherId,
    });

    expect(result.ok).toBe(true);
    expect(result.maskedPublisherId).toBe("pub-9501********2808");
    expect(result.issues).toEqual([]);
  });

  it("rejects a public 404/html response instead of treating it as deployed proof", () => {
    const result = publicCheck.validateAppAdsBody({
      body: "<!DOCTYPE html><html><title>404</title></html>",
      expectedPublisherId: realPublisherId,
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "invalid_app_ads_format" }));
  });
});


describe("Android release Gradle guard", () => {
  it("fails release builds instead of accepting an app id outside public app-ads.txt", () => {
    const buildGradle = readFileSync("android/app/build.gradle", "utf8");

    expect(buildGradle).toContain("zenflowExpectedAdMobPublisher");
    expect(buildGradle).toContain(
      "zenflowConfiguredAdMobPublisher != zenflowExpectedAdMobPublisher",
    );
    expect(buildGradle).toContain("throw new GradleException");
    expect(buildGradle).toContain("Release builds require ZENFLOW_ADMOB_ANDROID_APP_ID");
    expect(buildGradle).toContain("zenflowAdMobAndroidBannerId");
    expect(buildGradle).toContain("VITE_ADMOB_BANNER_ID_ANDROID");
    expect(buildGradle).toContain("zenflowConfiguredAdMobBannerPublisher");
    expect(buildGradle).toContain("real banner id matching public/app-ads.txt");
    expect(buildGradle).toContain("gradle.taskGraph.whenReady");
  });
});
