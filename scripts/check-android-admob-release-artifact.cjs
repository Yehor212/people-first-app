#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const DEFAULT_AAB = path.join(
  ROOT,
  "android",
  "app",
  "build",
  "outputs",
  "bundle",
  "release",
  "app-release.aab"
);
const APP_ADS_FILE = path.join(ROOT, "public", "app-ads.txt");
const SAMPLE_PUBLISHER = "pub-3940256099942544";

function publisherFrom(value) {
  return String(value || "").match(/pub-\d{16}/)?.[0] || "";
}

function evaluateArtifactBuffer({
  bytes,
  appId,
  bannerId,
  appAdsText,
  nativePluginsJson,
  dexBytes,
}) {
  const issues = [];
  let nativePlugins;
  try {
    nativePlugins = JSON.parse(nativePluginsJson || "null");
  } catch {
    nativePlugins = null;
  }
  const adMobRegistrations = Array.isArray(nativePlugins)
    ? nativePlugins.filter((plugin) => plugin?.pkg === "@capacitor-community/admob")
    : [];
  if (
    adMobRegistrations.length !== 1 ||
    adMobRegistrations[0].classpath !== "com.getcapacitor.community.admob.AdMob"
  ) {
    issues.push("invalid_or_missing_native_admob_registration");
  }
  if (
    !Buffer.isBuffer(dexBytes) ||
    !dexBytes.includes(Buffer.from("Lcom/getcapacitor/community/admob/AdMob;"))
  ) {
    issues.push("native_admob_implementation_missing");
  }
  const appPublisher = publisherFrom(appId);
  const bannerPublisher = publisherFrom(bannerId);
  const appAdsPublisher =
    String(appAdsText || "").match(
      /^google\.com, (pub-\d{16}), DIRECT, f08c47fec0942fa0\s*$/
    )?.[1] || "";

  if (!/^ca-app-pub-\d{16}~\d+$/.test(String(appId || ""))) {
    issues.push("invalid_android_app_id");
  }
  if (!/^ca-app-pub-\d{16}\/\d+$/.test(String(bannerId || ""))) {
    issues.push("invalid_android_banner_id");
  }
  if (!appAdsPublisher) issues.push("invalid_app_ads_txt");
  if (
    appPublisher &&
    bannerPublisher &&
    appAdsPublisher &&
    (appPublisher !== bannerPublisher || appPublisher !== appAdsPublisher)
  ) {
    issues.push("publisher_mismatch");
  }

  const artifact = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || "");
  if (appId && !artifact.includes(Buffer.from(appId))) {
    issues.push("configured_app_id_missing");
  }
  if (bannerId && !artifact.includes(Buffer.from(bannerId))) {
    issues.push("configured_banner_id_missing");
  }

  const text = artifact.toString("latin1");
  const adUnitIds = new Set(text.match(/ca-app-pub-\d{16}\/\d+/g) || []);
  if (text.includes(`ca-app-${SAMPLE_PUBLISHER}`)) {
    issues.push("google_sample_id_present");
  }
  if ([...adUnitIds].some((id) => id !== bannerId)) {
    issues.push("unexpected_ad_unit_id_present");
  }

  return { ok: issues.length === 0, issues, adUnitCount: adUnitIds.size };
}

function parseAabPath(argv) {
  const index = argv.indexOf("--aab");
  if (index === -1) return DEFAULT_AAB;
  if (!argv[index + 1]) throw new Error("--aab requires a file path");
  return path.resolve(ROOT, argv[index + 1]);
}

function main() {
  let aabPath;
  try {
    aabPath = parseAabPath(process.argv.slice(2));
  } catch (error) {
    console.error(`[android-admob-artifact] FAIL - ${error.message}`);
    process.exit(1);
  }

  if (!fs.existsSync(aabPath)) {
    console.error("[android-admob-artifact] FAIL - release AAB is missing");
    process.exit(1);
  }

  const expanded = spawnSync("unzip", ["-p", aabPath], {
    encoding: null,
    maxBuffer: 512 * 1024 * 1024,
  });
  if (expanded.status !== 0 || !Buffer.isBuffer(expanded.stdout)) {
    console.error("[android-admob-artifact] FAIL - release AAB could not be inspected");
    process.exit(1);
  }

  const report = evaluateArtifactBuffer({
    bytes: expanded.stdout,
    appId: process.env.VITE_ADMOB_APP_ID_ANDROID || process.env.ZENFLOW_ADMOB_ANDROID_APP_ID || "",
    bannerId: process.env.VITE_ADMOB_BANNER_ID_ANDROID || "",
    appAdsText: fs.existsSync(APP_ADS_FILE) ? fs.readFileSync(APP_ADS_FILE, "utf8") : "",
    nativePluginsJson: readAabEntry(aabPath, "base/assets/capacitor.plugins.json").toString("utf8"),
    dexBytes: readAabEntry(aabPath, "base/dex/classes*.dex"),
  });

  if (!report.ok) {
    console.error(`[android-admob-artifact] FAIL - ${report.issues.join(",")}`);
    process.exit(1);
  }
  console.log(
    `[android-admob-artifact] PASS - release AAB contains the registered native AdMob implementation, one configured production banner unit and no sample or extra ad-unit ids`
  );
}

function readAabEntry(aabPath, entry) {
  const result = spawnSync("unzip", ["-p", aabPath, entry], {
    encoding: null,
    maxBuffer: 256 * 1024 * 1024,
  });
  return result.status === 0 && Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.alloc(0);
}

if (require.main === module) main();

module.exports = { evaluateArtifactBuffer };
