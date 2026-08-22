import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const requireForTest = createRequire(import.meta.url);
const checkerPath = join(process.cwd(), "scripts/check-admob-release-config.cjs");

type ReleaseSnapshot = {
  packageJson: string;
  packageLock: string;
  androidVariables: string;
  runtimeSources: Record<string, string>;
  serviceGateSources: Record<string, string>;
  adMobPatch: string;
  supabaseConfig: string;
  env: Record<string, string | undefined>;
  appAdsText: string;
};

type ReleaseReport = {
  ok: boolean;
  issues: Array<{ code: string; file?: string; key?: string }>;
};

function checker() {
  return requireForTest(checkerPath) as {
    readAdMobReleaseSnapshot: () => ReleaseSnapshot;
    evaluateAdMobReleaseConfig: (snapshot: ReleaseSnapshot) => ReleaseReport;
  };
}

const publisherId = "pub-9501460293702808";
const validProductionEnv = {
  VITE_ADMOB_APP_ID_ANDROID: `ca-app-${publisherId}~1234567890`,
  VITE_ADMOB_REWARDED_ID_ANDROID: `ca-app-${publisherId}/1234567890`,
  VITE_ADMOB_AGE_RESTRICTED_TREATMENT: "teen",
  VITE_ADMOB_CHILD_DIRECTED_TREATMENT: "false",
  VITE_ADMOB_UNDER_AGE_OF_CONSENT: "false",
};

function productionReadySnapshot(): ReleaseSnapshot {
  const snapshot = checker().readAdMobReleaseSnapshot();
  return {
    ...snapshot,
    env: validProductionEnv,
    appAdsText: `google.com, ${publisherId}, DIRECT, f08c47fec0942fa0`,
  };
}

describe("rewarded-only AdMob release configuration", () => {
  it("is wired into the Android release and release-contract commands", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

    expect(packageJson.scripts["google-play:admob:release-config-check"]).toBe(
      "node scripts/check-admob-release-config.cjs",
    );
    expect(packageJson.scripts["test:release-contracts"]).toContain(
      "scripts/__tests__/admobReleaseConfig.test.ts",
    );
  });

  it("fails closed instead of embedding a stale owner App ID as the Android fallback", () => {
    const gradle = readFileSync("android/app/build.gradle", "utf8");
    const sampleBlock = gradle.match(
      /ZENFLOW_ADMOB_ANDROID_SAMPLE_APP_IDS\s*=\s*\[([\s\S]*?)\]\s*as Set/,
    )?.[1];
    const configuredFallback = gradle.match(
      /System\.getenv\("VITE_ADMOB_APP_ID_ANDROID"\)\s*\n\s*\?:\s*"([^"]+)"/,
    )?.[1];

    expect(sampleBlock).toBeTruthy();
    expect(configuredFallback).toBeTruthy();
    expect(sampleBlock).toContain(`"${configuredFallback}"`);
  });

  it("patches the pinned Android plugin to use the non-deprecated age-treatment API", () => {
    const pluginPatch = readFileSync(
      "patches/@capacitor-community+admob+8.0.0.patch",
      "utf8",
    );
    const controller = readFileSync("src/lib/adController.ts", "utf8");

    expect(pluginPatch).toContain("setAgeRestrictedTreatment");
    expect(pluginPatch).toContain("AgeRestrictedTreatment.TEEN");
    expect(controller).toContain("ADMOB_AGE_RESTRICTED_TREATMENT");
    expect(controller).toContain("ageRestrictedTreatment:");
  });

  it("accepts only the pinned rewarded-only Android configuration with publisher-bound IDs", () => {
    const report = checker().evaluateAdMobReleaseConfig(productionReadySnapshot());

    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
  });

  it("rejects floating Capacitor, Google Mobile Ads, or UMP dependency versions", () => {
    const snapshot = productionReadySnapshot();
    snapshot.packageJson = snapshot.packageJson.replace('"@capacitor-community/admob": "8.0.0"', '"@capacitor-community/admob": "^8.0.0"');
    snapshot.androidVariables = snapshot.androidVariables
      .replace("playServicesAdsVersion = '25.4.0'", "playServicesAdsVersion = '25.4.+ '")
      .replace("userMessagingPlatformVersion = '4.0.0'", "userMessagingPlatformVersion = '4.+ '");

    const codes = checker().evaluateAdMobReleaseConfig(snapshot).issues.map(({ code }) => code);

    expect(codes).toEqual(expect.arrayContaining([
      "UNPINNED_CAPACITOR_ADMOB",
      "UNPINNED_GOOGLE_MOBILE_ADS",
      "UNPINNED_UMP",
    ]));
  });

  it("rejects banner, interstitial, rewarded-interstitial, native, or app-open runtime surfaces", () => {
    const forbiddenTokens = [
      "showBanner",
      "prepareInterstitial",
      "prepareRewardInterstitialAd",
      "NativeAd",
      "AppOpenAd",
    ];

    for (const token of forbiddenTokens) {
      const snapshot = productionReadySnapshot();
      snapshot.runtimeSources = {
        ...snapshot.runtimeSources,
        "src/lib/forbiddenAdSurface.ts": `export const forbidden = AdMob.${token};`,
      };

      expect(
        checker().evaluateAdMobReleaseConfig(snapshot).issues,
        token,
      ).toContainEqual(expect.objectContaining({ code: "FORBIDDEN_AD_FORMAT" }));
    }
  });

  it("rejects retired format identifiers even when they are supplied only through the environment", () => {
    const snapshot = productionReadySnapshot();
    snapshot.env = {
      ...snapshot.env,
      VITE_ADMOB_BANNER_ID_ANDROID: `ca-app-${publisherId}/9876543210`,
    };

    expect(checker().evaluateAdMobReleaseConfig(snapshot).issues).toContainEqual(
      expect.objectContaining({
        code: "FORBIDDEN_AD_FORMAT_ID",
        key: "VITE_ADMOB_BANNER_ID_ANDROID",
      }),
    );
  });

  it("rejects missing, Google-demo, and app-ads-unbound Android production identifiers", () => {
    const cases: Array<[Record<string, string>, string]> = [
      [{}, "missing_admob_id"],
      [{
        VITE_ADMOB_APP_ID_ANDROID: "ca-app-pub-3940256099942544~3347511713",
        VITE_ADMOB_REWARDED_ID_ANDROID: "ca-app-pub-3940256099942544/5224354917",
      }, "sample_admob_id"],
      [{
        VITE_ADMOB_APP_ID_ANDROID: "ca-app-pub-1111111111111111~1234567890",
        VITE_ADMOB_REWARDED_ID_ANDROID: "ca-app-pub-1111111111111111/1234567890",
      }, "publisher_mismatch"],
    ];

    for (const [env, expectedCode] of cases) {
      const snapshot = productionReadySnapshot();
      snapshot.env = env;

      expect(
        checker().evaluateAdMobReleaseConfig(snapshot).issues.map(({ code }) => code),
        expectedCode,
      ).toContain(expectedCode);
    }
  });

  it("rejects missing or ambiguous owner audience-treatment configuration", () => {
    for (const env of [
      { ...validProductionEnv, VITE_ADMOB_AGE_RESTRICTED_TREATMENT: "" },
      { ...validProductionEnv, VITE_ADMOB_AGE_RESTRICTED_TREATMENT: "unspecified" },
      { ...validProductionEnv, VITE_ADMOB_CHILD_DIRECTED_TREATMENT: "" },
      { ...validProductionEnv, VITE_ADMOB_UNDER_AGE_OF_CONSENT: "unknown" },
    ]) {
      const snapshot = productionReadySnapshot();
      snapshot.env = env;

      expect(
        checker().evaluateAdMobReleaseConfig(snapshot).issues.map(({ code }) => code),
      ).toEqual(expect.arrayContaining([
        expect.stringMatching(/^(?:AGE_RESTRICTED_TREATMENT|AUDIENCE_TREATMENT)_UNVERIFIED$/),
      ]));
    }
  });

  it("rejects a missing pinned plugin patch for Android age treatment", () => {
    const snapshot = productionReadySnapshot();
    snapshot.adMobPatch = "";

    expect(checker().evaluateAdMobReleaseConfig(snapshot).issues).toContainEqual(
      expect.objectContaining({ code: "AGE_RESTRICTED_TREATMENT_PATCH_MISSING" }),
    );
  });

  it("rejects a missing or unauthenticated service-owned rewarded-ads gate", () => {
    const missingClient = productionReadySnapshot();
    missingClient.serviceGateSources["src/lib/rewardedAdsGate.ts"] = "";
    expect(
      checker().evaluateAdMobReleaseConfig(missingClient).issues.map(({ code }) => code),
    ).toContain("REWARDED_ADS_GATE_UNWIRED");

    const unauthenticatedEdge = productionReadySnapshot();
    unauthenticatedEdge.supabaseConfig = unauthenticatedEdge.supabaseConfig.replace(
      "[functions.rewarded-ads-gate]\nverify_jwt = true",
      "[functions.rewarded-ads-gate]\nverify_jwt = false",
    );
    expect(
      checker().evaluateAdMobReleaseConfig(unauthenticatedEdge).issues.map(({ code }) => code),
    ).toContain("REWARDED_ADS_GATE_AUTH_UNVERIFIED");
  });
});
