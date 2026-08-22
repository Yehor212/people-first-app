#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  evaluateAdMobProductionReadiness,
  loadEnv,
  readAppAdsFile,
} = require("./check-admob-production-readiness.cjs");

const ROOT = path.resolve(__dirname, "..");
const EXPECTED_VERSIONS = Object.freeze({
  capacitorAdMob: "8.0.0",
  googleMobileAds: "25.4.0",
  ump: "4.0.0",
});

const RUNTIME_FILES = Object.freeze([
  "src/lib/env.ts",
  "src/lib/adConfig.ts",
  "src/lib/adController.ts",
  "src/contexts/AdContext.tsx",
  "src/components/ads/RewardedAdPrompt.tsx",
  "src/pages/nav-v2/settings/V2SettingsPrivacyPanel.tsx",
]);
const SERVICE_GATE_FILES = Object.freeze([
  "src/lib/rewardedAdsGate.ts",
  "supabase/functions/rewarded-ads-gate/gateResponse.ts",
  "supabase/functions/rewarded-ads-gate/index.ts",
]);

const FORBIDDEN_RUNTIME_PATTERNS = Object.freeze([
  /\b(?:show|hide|remove)Banner\b/,
  /\bprepareInterstitial\b/,
  /\bshowInterstitial\b/,
  /\b(?:prepare|show)RewardInterstitialAd\b/,
  /\bRewardInterstitialAd(?:PluginEvents|Options)?\b/,
  /\bNativeAd(?:View|Options|PluginEvents)?\b/,
  /\bAppOpenAd(?:Options|PluginEvents)?\b/,
]);

const FORBIDDEN_ENV_KEY = /^VITE_ADMOB_(?:BANNER|INTERSTITIAL|REWARDED_INTERSTITIAL|NATIVE|APP_OPEN)_ID_(?:ANDROID|IOS)$/;
const AUDIENCE_TREATMENT_KEYS = Object.freeze([
  "VITE_ADMOB_CHILD_DIRECTED_TREATMENT",
  "VITE_ADMOB_UNDER_AGE_OF_CONSENT",
]);
const AGE_RESTRICTED_TREATMENT_KEY = "VITE_ADMOB_AGE_RESTRICTED_TREATMENT";
const ADMOB_PLUGIN_PATCH = "patches/@capacitor-community+admob+8.0.0.patch";

function readText(rootDir, relativePath) {
  const target = path.join(rootDir, relativePath);
  return fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
}

function readAdMobReleaseSnapshot(rootDir = ROOT) {
  const runtimeSources = {};
  for (const relativePath of RUNTIME_FILES) {
    runtimeSources[relativePath] = readText(rootDir, relativePath);
  }
  const serviceGateSources = {};
  for (const relativePath of SERVICE_GATE_FILES) {
    serviceGateSources[relativePath] = readText(rootDir, relativePath);
  }

  return {
    packageJson: readText(rootDir, "package.json"),
    packageLock: readText(rootDir, "package-lock.json"),
    androidVariables: readText(rootDir, "android/variables.gradle"),
    runtimeSources,
    serviceGateSources,
    adMobPatch: readText(rootDir, ADMOB_PLUGIN_PATCH),
    supabaseConfig: readText(rootDir, "supabase/config.toml"),
    env: loadEnv(),
    appAdsText: readAppAdsFile(),
  };
}

function parseJson(source, file, issues) {
  try {
    return JSON.parse(source || "{}");
  } catch {
    issues.push({ code: "INVALID_JSON", file });
    return {};
  }
}

function gradleVersion(source, variableName) {
  const match = String(source || "").match(
    new RegExp(`\\b${variableName}\\s*=\\s*['"]([^'"]+)['"]`),
  );
  return match?.[1]?.trim() || "";
}

function evaluateAdMobReleaseConfig(snapshot) {
  const issues = [];
  const packageJson = parseJson(snapshot.packageJson, "package.json", issues);
  const packageLock = parseJson(snapshot.packageLock, "package-lock.json", issues);
  const dependency = packageJson.dependencies?.["@capacitor-community/admob"];
  const lockedRequest = packageLock.packages?.[""]?.dependencies?.["@capacitor-community/admob"];
  const lockedPackage = packageLock.packages?.["node_modules/@capacitor-community/admob"]?.version;

  if (
    dependency !== EXPECTED_VERSIONS.capacitorAdMob ||
    lockedRequest !== EXPECTED_VERSIONS.capacitorAdMob ||
    lockedPackage !== EXPECTED_VERSIONS.capacitorAdMob
  ) {
    issues.push({ code: "UNPINNED_CAPACITOR_ADMOB", file: "package.json" });
  }

  if (gradleVersion(snapshot.androidVariables, "playServicesAdsVersion") !== EXPECTED_VERSIONS.googleMobileAds) {
    issues.push({ code: "UNPINNED_GOOGLE_MOBILE_ADS", file: "android/variables.gradle" });
  }
  if (gradleVersion(snapshot.androidVariables, "userMessagingPlatformVersion") !== EXPECTED_VERSIONS.ump) {
    issues.push({ code: "UNPINNED_UMP", file: "android/variables.gradle" });
  }

  for (const [file, source] of Object.entries(snapshot.runtimeSources || {})) {
    if (FORBIDDEN_RUNTIME_PATTERNS.some((pattern) => pattern.test(String(source)))) {
      issues.push({ code: "FORBIDDEN_AD_FORMAT", file });
    }
  }

  for (const [key, value] of Object.entries(snapshot.env || {})) {
    if (FORBIDDEN_ENV_KEY.test(key) && String(value || "").trim()) {
      issues.push({ code: "FORBIDDEN_AD_FORMAT_ID", key });
    }
  }

  for (const key of AUDIENCE_TREATMENT_KEYS) {
    if (!/^(?:true|false)$/.test(String(snapshot.env?.[key] || ""))) {
      issues.push({ code: "AUDIENCE_TREATMENT_UNVERIFIED", key });
    }
  }

  if (String(snapshot.env?.[AGE_RESTRICTED_TREATMENT_KEY] || "") !== "teen") {
    issues.push({
      code: "AGE_RESTRICTED_TREATMENT_UNVERIFIED",
      key: AGE_RESTRICTED_TREATMENT_KEY,
    });
  }

  const gateClient = snapshot.serviceGateSources?.["src/lib/rewardedAdsGate.ts"] || "";
  const gateResponse = snapshot.serviceGateSources?.[
    "supabase/functions/rewarded-ads-gate/gateResponse.ts"
  ] || "";
  const gateEdge = snapshot.serviceGateSources?.[
    "supabase/functions/rewarded-ads-gate/index.ts"
  ] || "";
  const adController = snapshot.runtimeSources?.["src/lib/adController.ts"] || "";
  const envSource = snapshot.runtimeSources?.["src/lib/env.ts"] || "";
  const ageTreatmentMarkers = [
    [snapshot.adMobPatch || "", "setAgeRestrictedTreatment"],
    [snapshot.adMobPatch || "", "AgeRestrictedTreatment.TEEN"],
    [envSource, "ADMOB_AGE_RESTRICTED_TREATMENT"],
    [adController, "ageRestrictedTreatment:"],
  ];
  if (ageTreatmentMarkers.some(([source, marker]) => !source.includes(marker))) {
    issues.push({
      code: "AGE_RESTRICTED_TREATMENT_PATCH_MISSING",
      file: ADMOB_PLUGIN_PATCH,
    });
  }
  const requiredGateMarkers = [
    [gateClient, "MAX_REWARDED_ADS_GATE_TTL_MS"],
    [gateClient, "refreshRewardedAdsGate"],
    [gateResponse, "MAX_REWARDED_ADS_GATE_TTL_SECONDS"],
    [gateResponse, "ZENFLOW_REWARDED_ADS_ENABLED"],
    [gateEdge, "extractBearerToken"],
    [gateEdge, "auth.getUser"],
    [gateEdge, "ZENFLOW_REWARDED_ADS_REVISION"],
    [adController, "isRewardedAdsGateOpen"],
    [adController, "refreshRewardedAdsGate"],
  ];
  if (requiredGateMarkers.some(([source, marker]) => !source.includes(marker))) {
    issues.push({ code: "REWARDED_ADS_GATE_UNWIRED", file: "rewarded-ads-gate" });
  }

  if (!/^\[functions\.rewarded-ads-gate\]\s*\nverify_jwt\s*=\s*true\s*$/m.test(
    snapshot.supabaseConfig || "",
  )) {
    issues.push({
      code: "REWARDED_ADS_GATE_AUTH_UNVERIFIED",
      file: "supabase/config.toml",
    });
  }

  const productionReadiness = evaluateAdMobProductionReadiness({
    env: snapshot.env || {},
    appAdsText: snapshot.appAdsText || "",
  });
  for (const item of productionReadiness.issues) {
    issues.push({ code: item.code, key: item.key });
  }

  return {
    ok: issues.length === 0,
    issues,
    summary: {
      dependencyPinning: issues.some(({ code }) => code.startsWith("UNPINNED_")) ? "UNVERIFIED" : "PASS",
      rewardedOnlyRuntime: issues.some(({ code }) => code.startsWith("FORBIDDEN_AD_FORMAT")) ? "UNVERIFIED" : "PASS",
      audienceTreatment: issues.some(({ code }) =>
        code === "AUDIENCE_TREATMENT_UNVERIFIED" || code.startsWith("AGE_RESTRICTED_TREATMENT_"),
      ) ? "UNVERIFIED" : "PASS",
      serviceGate: issues.some(({ code }) => code.startsWith("REWARDED_ADS_GATE_")) ? "UNVERIFIED" : "PASS",
      productionIdentifiers: productionReadiness.ok ? "PASS" : "UNVERIFIED",
    },
  };
}

function main() {
  const report = evaluateAdMobReleaseConfig(readAdMobReleaseSnapshot());
  console.log(`[admob-release-config] ${report.ok ? "PASS" : "UNVERIFIED"} - rewarded-only Android release contract`);
  for (const [key, value] of Object.entries(report.summary)) {
    console.log(`[admob-release-config] ${key}=${value}`);
  }
  for (const item of report.issues) {
    console.log(
      `[admob-release-config] issue=${item.code}${item.file ? ` file=${item.file}` : ""}${item.key ? ` key=${item.key}` : ""}`,
    );
  }
  process.exit(report.ok ? 0 : 2);
}

if (require.main === module) main();

module.exports = {
  EXPECTED_VERSIONS,
  evaluateAdMobReleaseConfig,
  readAdMobReleaseSnapshot,
};
