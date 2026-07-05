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

function loadChecker() {
  return require(checkerPath) as {
    readFileMap: () => Record<string, string>;
    evaluateAdMobUmpReadiness: (files: Record<string, string>) => UmpReadinessReport;
  };
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

  it("passes when native UMP consent, privacy options, and app-id wiring are present", () => {
    const checker = loadChecker();
    const report = checker.evaluateAdMobUmpReadiness(checker.readFileMap());

    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.summary).toMatchObject({
      nativeUmpConsentGate: "PASS",
      settingsPrivacyOptionsEntry: "PASS",
      androidNativeConfig: "PASS",
      iosNativeConfig: "PASS",
    });
  });

  it("fails if UMP consent refresh is removed from the ad controller", () => {
    const checker = loadChecker();
    const files = checker.readFileMap();
    files.adController = files.adController.replaceAll("requestConsentInfo", "removedConsentInfoCall");

    const report = checker.evaluateAdMobUmpReadiness(files);

    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "missing_consent_info_refresh" }),
    );
  });

  it("fails if local ad-consent revocation no longer disables in-flight native ads", () => {
    const checker = loadChecker();
    const files = checker.readFileMap();
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
    const files = checker.readFileMap();
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
    const files = checker.readFileMap();
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
    const files = checker.readFileMap();
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

  it("prints only public-safe status and no raw AdMob identifiers", () => {
    const result = spawnSync(process.execPath, [checkerPath], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[admob-ump-readiness] PASS");
    expect(result.stdout).not.toMatch(/ca-app-pub-\d{16}[~/]\d+/);
    expect(result.stdout).not.toMatch(/\bpub-\d{16}\b/);
  });
});
