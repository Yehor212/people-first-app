#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

const DEFAULT_FILES = {
  packageJson: "package.json",
  adController: "src/lib/adController.ts",
  adContext: "src/contexts/AdContext.tsx",
  privacySection: "src/components/settings/PrivacySection.tsx",
  v2SettingsPrivacyPanel: "src/pages/nav-v2/settings/V2SettingsPrivacyPanel.tsx",
  androidManifest: "android/app/src/main/AndroidManifest.xml",
  androidBuildGradle: "android/app/build.gradle",
  iosInfoPlist: "ios/App/App/Info.plist",
  iosProject: "ios/App/App.xcodeproj/project.pbxproj",
  iosSpmResolved: "ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved",
};

function issue(code, message, file) {
  return file ? { code, file, message } : { code, message };
}

function readFileMap(root = ROOT, files = DEFAULT_FILES) {
  const result = {};
  for (const [key, relativePath] of Object.entries(files)) {
    const filePath = path.resolve(root, relativePath);
    result[key] = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  }
  return result;
}

function requireContains(issues, files, key, snippet, code, message) {
  if (!files[key]?.includes(snippet)) {
    issues.push(issue(code, message, DEFAULT_FILES[key] || key));
  }
}

function requireRegex(issues, files, key, regex, code, message) {
  if (!regex.test(files[key] || "")) {
    issues.push(issue(code, message, DEFAULT_FILES[key] || key));
  }
}

function evaluateAdMobUmpReadiness(files) {
  const issues = [];

  let packageJson = {};
  try {
    packageJson = JSON.parse(files.packageJson || "{}");
  } catch (_error) {
    issues.push(issue("invalid_package_json", "package.json must be valid JSON", DEFAULT_FILES.packageJson));
  }

  if (!packageJson.dependencies?.["@capacitor-community/admob"] && !packageJson.devDependencies?.["@capacitor-community/admob"]) {
    issues.push(issue(
      "missing_capacitor_admob_dependency",
      "@capacitor-community/admob must be installed for native AdMob/UMP integration",
      DEFAULT_FILES.packageJson,
    ));
  }

  requireContains(
    issues,
    files,
    "adController",
    "export function disableAds",
    "missing_ad_disable_api",
    "Ad controller must expose a fail-closed API for local ad consent revocation",
  );
  requireContains(
    issues,
    files,
    "adController",
    "adLifecycleEpoch",
    "missing_ad_init_epoch_guard",
    "Ad controller must invalidate in-flight native ad initialization when local ad consent is revoked",
  );
  requireContains(
    issues,
    files,
    "adController",
    "requestConsentInfo",
    "missing_consent_info_refresh",
    "Ad controller must request fresh UMP consent information before enabling ad requests",
  );
  requireContains(
    issues,
    files,
    "adController",
    "showConsentForm",
    "missing_consent_form",
    "Ad controller must show the UMP consent form when required",
  );
  requireContains(
    issues,
    files,
    "adController",
    "showPrivacyOptionsForm",
    "missing_privacy_options_form",
    "Ad controller must expose the UMP privacy options form when required",
  );
  requireContains(
    issues,
    files,
    "adController",
    "state.canRequestAds",
    "missing_can_request_ads_gate",
    "Ad controller must gate SDK availability on canRequestAds",
  );
  requireRegex(
    issues,
    files,
    "adController",
    /prepareRewardVideoAd\([\s\S]*npa:\s*true/,
    "missing_non_personalized_default",
    "Rewarded ad prepare call must default to non-personalized ad requests",
  );

  requireContains(
    issues,
    files,
    "adContext",
    "disableAds({ clearPrivacyOptions })",
    "missing_context_ad_disable_call",
    "Ad context must call the controller fail-closed disable API when local ad consent or premium state disables ads",
  );
  requireContains(
    issues,
    files,
    "adContext",
    "refreshAdPrivacyOptionsStatus",
    "missing_privacy_options_status_refresh",
    "Ad context must refresh UMP privacy-options status even when local ad consent is off",
  );
  requireContains(
    issues,
    files,
    "adContext",
    "privacyOptionsRequired",
    "missing_privacy_options_state",
    "Ad context must surface whether UMP requires a visible privacy-options entry point",
  );
  requireContains(
    issues,
    files,
    "privacySection",
    "openAdPrivacyOptions",
    "missing_settings_privacy_options_entry",
    "Classic settings must expose the Google ad privacy options entry point when required",
  );
  requireContains(
    issues,
    files,
    "v2SettingsPrivacyPanel",
    "openAdPrivacyOptions",
    "missing_v2_settings_privacy_options_entry",
    "V2 settings must expose the Google ad privacy options entry point when required",
  );

  requireContains(
    issues,
    files,
    "androidManifest",
    "com.google.android.gms.ads.APPLICATION_ID",
    "missing_android_admob_app_id_metadata",
    "Android manifest must declare the AdMob application id metadata",
  );
  requireContains(
    issues,
    files,
    "androidManifest",
    "${adMobApplicationId}",
    "missing_android_admob_placeholder",
    "Android manifest must use a release-injected AdMob app id placeholder",
  );
  requireContains(
    issues,
    files,
    "androidManifest",
    "com.google.android.gms.permission.AD_ID",
    "missing_android_ad_id_permission",
    "Android manifest must declare AD_ID for the AdMob release path",
  );
  requireContains(
    issues,
    files,
    "androidBuildGradle",
    "manifestPlaceholders",
    "missing_android_manifest_placeholder_wiring",
    "Android Gradle config must wire the AdMob app id manifest placeholder",
  );
  requireContains(
    issues,
    files,
    "androidBuildGradle",
    "ZENFLOW_ADMOB_ANDROID_SAMPLE_APP_IDS",
    "missing_android_sample_id_release_guard",
    "Android release builds must reject Google sample AdMob app ids",
  );

  requireContains(
    issues,
    files,
    "iosInfoPlist",
    "GADApplicationIdentifier",
    "missing_ios_admob_app_id_key",
    "iOS Info.plist must declare GADApplicationIdentifier",
  );
  requireContains(
    issues,
    files,
    "iosInfoPlist",
    "$(ZENFLOW_ADMOB_IOS_APP_ID)",
    "missing_ios_release_placeholder",
    "iOS Info.plist must use a release-injected AdMob app id placeholder",
  );
  requireContains(
    issues,
    files,
    "iosProject",
    "ZENFLOW_ADMOB_IOS_APP_ID must be injected for Release builds",
    "missing_ios_release_sample_id_guard",
    "iOS release builds must reject missing or Google sample AdMob app ids",
  );

  requireContains(
    issues,
    files,
    "iosInfoPlist",
    "SKAdNetworkItems",
    "missing_ios_skadnetwork_items",
    "iOS Info.plist must declare SKAdNetworkItems for Google Mobile Ads attribution",
  );
  requireContains(
    issues,
    files,
    "iosInfoPlist",
    "cstr6suwn9.skadnetwork",
    "missing_ios_google_skadnetwork_identifier",
    "iOS Info.plist SKAdNetworkItems must include Google's SKAdNetworkIdentifier cstr6suwn9.skadnetwork",
  );
  requireContains(
    issues,
    files,
    "iosSpmResolved",
    "swift-package-manager-google-user-messaging-platform",
    "missing_ios_ump_package",
    "iOS project must resolve the Google User Messaging Platform package",
  );

  return {
    ok: issues.length === 0,
    issues,
    summary: {
      nativeUmpConsentGate: issues.some((item) => item.code.startsWith("missing_consent") || item.code.includes("can_request")) ? "UNVERIFIED" : "PASS",
      settingsPrivacyOptionsEntry: issues.some((item) => item.code.includes("settings_privacy_options")) ? "UNVERIFIED" : "PASS",
      androidNativeConfig: issues.some((item) => item.code.startsWith("missing_android")) ? "UNVERIFIED" : "PASS",
      iosNativeConfig: issues.some((item) => item.code.startsWith("missing_ios")) ? "UNVERIFIED" : "PASS",
    },
  };
}

function main() {
  const report = evaluateAdMobUmpReadiness(readFileMap());
  console.log(`[admob-ump-readiness] ${report.ok ? "PASS" : "UNVERIFIED"} - native UMP/privacy-options integration ${report.ok ? "is wired" : "needs release-owner action"}`);
  for (const [key, value] of Object.entries(report.summary)) {
    console.log(`[admob-ump-readiness] ${key}=${value}`);
  }
  for (const item of report.issues) {
    console.log(`[admob-ump-readiness] issue=${item.code}${item.file ? ` file=${item.file}` : ""} - ${item.message}`);
  }
  process.exit(report.ok ? 0 : 2);
}

if (require.main === module) main();

module.exports = {
  DEFAULT_FILES,
  evaluateAdMobUmpReadiness,
  readFileMap,
};
