import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const checkerPath = join(process.cwd(), "scripts/check-admob-ump-readiness.cjs");

type UmpReadinessIssue = {
  code: string;
  file?: string;
  message: string;
};

type UmpReadinessReport = {
  ok: boolean;
  issues: UmpReadinessIssue[];
  summary: Record<string, string>;
};

type UmpReadinessChecker = {
  readFileMap: () => Record<string, string>;
  evaluateAdMobUmpReadiness: (files: Record<string, string>) => UmpReadinessReport;
};

function loadChecker(): UmpReadinessChecker {
  return require(checkerPath) as UmpReadinessChecker;
}

function makeAdsOnReadyFixture(checker: UmpReadinessChecker): Record<string, string> {
  const files = checker.readFileMap();
  files.androidManifest = [
    '<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="${adMobApplicationId}" />',
    '<uses-permission android:name="com.google.android.gms.permission.AD_ID" />',
  ].join("\n");
  files.androidBuildGradle = [
    'manifestPlaceholders = [adMobApplicationId: "test-only"]',
    'def ZENFLOW_ADMOB_ANDROID_SAMPLE_APP_IDS = ["test-only"]',
  ].join("\n");
  files.iosInfoPlist = [
    "<key>GADApplicationIdentifier</key>",
    "<string>$(ZENFLOW_ADMOB_IOS_APP_ID)</string>",
    "<key>SKAdNetworkItems</key>",
    "<array><dict><key>SKAdNetworkIdentifier</key><string>cstr6suwn9.skadnetwork</string></dict></array>",
  ].join("\n");
  files.iosProject = "ZENFLOW_ADMOB_IOS_APP_ID must be injected for Release builds";
  files.iosSpmResolved = "swift-package-manager-google-user-messaging-platform";

  const precondition = checker.evaluateAdMobUmpReadiness(files);
  if (!precondition.ok) {
    throw new Error(
      `test-only ads-ON readiness fixture is incomplete: ${precondition.issues
        .map(({ code }) => code)
        .join(",")}`,
    );
  }
  return files;
}

describe("AdMob UMP/native privacy readiness guard", () => {
  it("exposes a local UMP readiness command and keeps it in release contracts", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

    expect(packageJson.scripts["google-play:admob:ump-check"]).toBe(
      "node scripts/check-admob-ump-readiness.cjs",
    );
    expect(packageJson.scripts["test:release-contracts"]).toContain(
      "scripts/__tests__/admob-ump-readiness.test.ts",
    );
  });

  it("keeps native UMP/AdMob readiness blocked while advertising is OFF", () => {
    const checker = loadChecker();
    const report = checker.evaluateAdMobUmpReadiness(checker.readFileMap());

    expect(report.ok).toBe(false);
    expect(report.issues.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "missing_android_admob_app_id_metadata",
        "missing_android_admob_placeholder",
        "missing_ios_admob_app_id_key",
        "missing_ios_release_placeholder",
        "missing_ios_ump_package",
      ]),
    );
    expect(report.summary).toMatchObject({
      androidNativeConfig: "UNVERIFIED",
      iosNativeConfig: "UNVERIFIED",
    });
  });

  it("keeps a complete test-only ads-ON fixture for meaningful readiness negative controls", () => {
    const checker = loadChecker();
    const report = checker.evaluateAdMobUmpReadiness(makeAdsOnReadyFixture(checker));

    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
  });

  it("fails if UMP consent refresh is removed from the ad controller", () => {
    const checker = loadChecker();
    const files = makeAdsOnReadyFixture(checker);
    files.adController = files.adController.replaceAll("requestConsentInfo", "removedConsentInfoCall");

    const report = checker.evaluateAdMobUmpReadiness(files);

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "missing_consent_info_refresh" }),
    );
  });

  it("fails if local ad-consent revocation no longer disables in-flight native ads", () => {
    const checker = loadChecker();
    const files = makeAdsOnReadyFixture(checker);
    files.adController = files.adController
      .replace("export function disableAds", "function removedDisableAds")
      .replaceAll("adLifecycleEpoch", "removedLifecycleEpoch");
    files.adContext = files.adContext.replace("disableAds({ clearPrivacyOptions })", "void clearPrivacyOptions");

    const report = checker.evaluateAdMobUmpReadiness(files);

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "missing_ad_disable_api" }),
    );
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "missing_ad_init_epoch_guard" }),
    );
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "missing_context_ad_disable_call" }),
    );
  });

  it("fails if Android release app-id placeholder wiring is missing", () => {
    const checker = loadChecker();
    const files = makeAdsOnReadyFixture(checker);
    files.androidManifest = files.androidManifest.replace("${adMobApplicationId}", "");
    files.androidBuildGradle = files.androidBuildGradle.replaceAll("ZENFLOW_ADMOB_ANDROID_SAMPLE_APP_IDS", "");

    const report = checker.evaluateAdMobUmpReadiness(files);

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "missing_android_admob_placeholder" }),
    );
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "missing_android_sample_id_release_guard" }),
    );
  });

  it("fails if iOS UMP package or release placeholder is missing", () => {
    const checker = loadChecker();
    const files = makeAdsOnReadyFixture(checker);
    files.iosInfoPlist = files.iosInfoPlist.replace("$(ZENFLOW_ADMOB_IOS_APP_ID)", "");
    files.iosSpmResolved = files.iosSpmResolved.replaceAll(
      "swift-package-manager-google-user-messaging-platform",
      "removed-ump-package",
    );

    const report = checker.evaluateAdMobUmpReadiness(files);

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "missing_ios_release_placeholder" }),
    );
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "missing_ios_ump_package" }),
    );
  });


  it("fails if iOS SKAdNetworkItems are missing", () => {
    const checker = loadChecker();
    const files = makeAdsOnReadyFixture(checker);
    files.iosInfoPlist = files.iosInfoPlist.replace(/<key>SKAdNetworkItems<\/key>[\s\S]*?<\/array>\s*/, "");

    const report = checker.evaluateAdMobUmpReadiness(files);

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "missing_ios_skadnetwork_items" }),
    );
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "missing_ios_google_skadnetwork_identifier" }),
    );
  });

  it("prints public-safe UNVERIFIED/OFF readiness and no raw AdMob identifiers", () => {
    const result = spawnSync(process.execPath, [checkerPath], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status).toBe(2);
    expect(result.stdout).toContain("[admob-ump-readiness] UNVERIFIED");
    expect(result.stdout).toContain("androidNativeConfig=UNVERIFIED");
    expect(result.stdout).toContain("iosNativeConfig=UNVERIFIED");
    expect(result.stdout).not.toMatch(/ca-app-pub-\d{16}[~/]\d+/);
    expect(result.stdout).not.toMatch(/\bpub-\d{16}\b/);
  });
});
