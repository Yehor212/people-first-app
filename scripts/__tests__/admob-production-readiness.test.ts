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
    strictOptionalIds?: boolean;
    requireOptionalIds?: boolean;
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
const realRewardedId = `ca-app-${realPublisherId}/1234567890`;
const sampleRewardedId = "ca-app-pub-3940256099942544/5224354917";
const validAppAds = `google.com, ${realPublisherId}, DIRECT, f08c47fec0942fa0`;
const script = "scripts/check-admob-production-readiness.cjs";

describe("AdMob production readiness guards", () => {
  it("rejects Google sample ad unit IDs before production monetization", () => {
    const report = admob.evaluateAdMobProductionReadiness({
      env: {
        VITE_ADMOB_APP_ID_ANDROID: realAppId,
        VITE_ADMOB_REWARDED_ID_ANDROID: sampleRewardedId,
      },
      appAdsText: validAppAds,
    });

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        code: "sample_admob_id",
        key: "VITE_ADMOB_REWARDED_ID_ANDROID",
      }),
    );
    expect(JSON.stringify(report.summary)).not.toContain(realPublisherId);
  });

  it("passes for a real Android app ID, real rewarded unit, and matching app-ads.txt", () => {
    const report = admob.evaluateAdMobProductionReadiness({
      env: {
        VITE_ADMOB_APP_ID_ANDROID: realAppId,
        VITE_ADMOB_REWARDED_ID_ANDROID: realRewardedId,
      },
      appAdsText: validAppAds,
    });

    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.summary.VITE_ADMOB_APP_ID_ANDROID).toBe("present:pub-9501********2808");
    expect(report.summary.VITE_ADMOB_REWARDED_ID_ANDROID).toBe("present:pub-9501********2808");
  });

  it("does not block Android rewarded-only release readiness on unused optional banner or iOS sample IDs", () => {
    const report = admob.evaluateAdMobProductionReadiness({
      env: {
        VITE_ADMOB_APP_ID_ANDROID: realAppId,
        VITE_ADMOB_REWARDED_ID_ANDROID: realRewardedId,
        VITE_ADMOB_BANNER_ID_ANDROID: "ca-app-pub-3940256099942544/6300978111",
        VITE_ADMOB_REWARDED_ID_IOS: "ca-app-pub-3940256099942544/1712485313",
      },
      appAdsText: validAppAds,
    });

    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.warnings).toContainEqual(
      expect.objectContaining({
        code: "optional_sample_admob_id",
        key: "VITE_ADMOB_BANNER_ID_ANDROID",
      }),
    );
    expect(report.warnings).toContainEqual(
      expect.objectContaining({
        code: "optional_sample_admob_id",
        key: "VITE_ADMOB_REWARDED_ID_IOS",
      }),
    );
  });

  it("can treat optional banner and iOS ad IDs as blocking in strict release audits", () => {
    const report = admob.evaluateAdMobProductionReadiness({
      env: {
        VITE_ADMOB_APP_ID_ANDROID: realAppId,
        VITE_ADMOB_REWARDED_ID_ANDROID: realRewardedId,
        VITE_ADMOB_BANNER_ID_ANDROID: "ca-app-pub-3940256099942544/6300978111",
      },
      appAdsText: validAppAds,
      strictOptionalIds: true,
    });

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        code: "sample_admob_id",
        key: "VITE_ADMOB_BANNER_ID_ANDROID",
      }),
    );
  });

  it("requires every banner and iOS production ad ID in full cross-platform release audits", () => {
    const report = admob.evaluateAdMobProductionReadiness({
      env: {
        VITE_ADMOB_APP_ID_ANDROID: realAppId,
        VITE_ADMOB_REWARDED_ID_ANDROID: realRewardedId,
      },
      appAdsText: validAppAds,
      strictOptionalIds: true,
      requireOptionalIds: true,
    });

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        code: "missing_admob_id",
        key: "VITE_ADMOB_BANNER_ID_ANDROID",
      }),
    );
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        code: "missing_admob_id",
        key: "VITE_ADMOB_REWARDED_ID_IOS",
      }),
    );
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        code: "missing_admob_id",
        key: "VITE_ADMOB_BANNER_ID_IOS",
      }),
    );
  });

  it("exposes a separate full AdMob readiness command that cannot be confused with Android rewarded-only readiness", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

    expect(packageJson.scripts["google-play:admob:check"]).toBe("node scripts/check-admob-production-readiness.cjs");
    expect(packageJson.scripts["google-play:admob:check:full"]).toBe(
      "node scripts/check-admob-production-readiness.cjs --strict-optional --require-optional",
    );
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

  it("returns a blocking CLI exit code for full readiness when optional IDs are not production-ready", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "zenflow-admob-readiness-"));
    const appAdsFile = join(tempDir, "app-ads.txt");
    writeFileSync(appAdsFile, validAppAds, "utf8");

    try {
      const result = spawnSync(
        process.execPath,
        [script, "--app-ads-file", appAdsFile, "--strict-optional", "--require-optional"],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            VITE_ADMOB_APP_ID_ANDROID: realAppId,
            VITE_ADMOB_REWARDED_ID_ANDROID: realRewardedId,
            VITE_ADMOB_BANNER_ID_ANDROID: "",
            VITE_ADMOB_REWARDED_ID_IOS: "",
            VITE_ADMOB_BANNER_ID_IOS: "",
          },
          encoding: "utf8",
        },
      );

      expect(result.status).toBe(2);
      expect(result.stdout).toContain("UNVERIFIED - Full cross-platform AdMob ids");
      expect(result.stdout).toContain("issue=missing_admob_id key=VITE_ADMOB_BANNER_ID_ANDROID");
      expect(result.stdout).toContain("issue=missing_admob_id key=VITE_ADMOB_REWARDED_ID_IOS");
      expect(result.stdout).toContain("issue=missing_admob_id key=VITE_ADMOB_BANNER_ID_IOS");
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
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
  it("fails release builds instead of falling back to Google sample AdMob app id", () => {
    const buildGradle = readFileSync("android/app/build.gradle", "utf8");

    expect(buildGradle).toContain("ZENFLOW_ADMOB_ANDROID_SAMPLE_APP_IDS");
    expect(buildGradle).toContain("throw new GradleException");
    expect(buildGradle).toContain("Release builds require ZENFLOW_ADMOB_ANDROID_APP_ID");
    expect(buildGradle).toContain("gradle.taskGraph.whenReady");
  });
});
