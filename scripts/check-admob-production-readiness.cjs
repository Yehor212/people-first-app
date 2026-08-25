#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const DEFAULT_ENV_FILES = [".env.local", ".env.production", ".env"];
const DEFAULT_APP_ADS_FILE = path.join(ROOT, "public", "app-ads.txt");
const SAMPLE_PUBLISHER_ID = "pub-3940256099942544";
const GOOGLE_SELLER_ID = "f08c47fec0942fa0";

const ADMOB_IDS = [
  {
    key: "VITE_ADMOB_APP_ID_ANDROID",
    aliases: ["ZENFLOW_ADMOB_ANDROID_APP_ID"],
    kind: "android_app_id",
  },
  { key: "VITE_ADMOB_BANNER_ID_ANDROID", aliases: [], kind: "ad_unit_id" },
];

const REQUIRED_KEYS_BY_MODE = {
  "android-banner": new Set([
    "VITE_ADMOB_APP_ID_ANDROID",
    "VITE_ADMOB_BANNER_ID_ANDROID",
  ]),
};

function maskPublisherId(value) {
  const publisherId = String(value || "").match(/pub-\d{16}/)?.[0];
  if (!publisherId) return "no-publisher-fragment";
  return publisherId.replace(/^(pub-\d{4})\d+(\d{4})$/, "$1********$2");
}

function publisherIdFromValue(value) {
  return String(value || "").match(/pub-\d{16}/)?.[0] || "";
}

function parseEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    env[key] = rawValue.replace(/^['"]|['"]$/g, "").trim();
  }
  return env;
}

function loadEnv(files = DEFAULT_ENV_FILES) {
  const env = {};
  for (const file of files) {
    Object.assign(env, parseEnvFile(path.resolve(ROOT, file)));
  }
  return { ...env, ...process.env };
}

function readAppAdsFile(file = DEFAULT_APP_ADS_FILE) {
  if (!fs.existsSync(file)) return "";
  return fs.readFileSync(file, "utf8");
}

function parseAppAdsText(text) {
  const trimmed = String(text || "").trim();
  const match = /^google\.com, (pub-\d{16}), DIRECT, ([a-f0-9]{16})$/i.exec(trimmed);
  if (!match) return { ok: false, issues: [{ code: "invalid_app_ads_format", message: "app-ads.txt must contain exactly one Google AdMob seller line" }] };
  const [, publisherId, sellerId] = match;
  const issues = [];
  if (publisherId === SAMPLE_PUBLISHER_ID) {
    issues.push({ code: "sample_publisher_id", message: "app-ads.txt must not use Google's sample AdMob publisher id" });
  }
  if (sellerId.toLowerCase() !== GOOGLE_SELLER_ID) {
    issues.push({ code: "invalid_seller_id", message: `app-ads.txt must use Google seller id ${GOOGLE_SELLER_ID}` });
  }
  return { ok: issues.length === 0, publisherId, issues };
}

function envValue(env, entry) {
  for (const key of [entry.key, ...(entry.aliases || [])]) {
    const value = String(env[key] || "").trim();
    if (value) return { key, value };
  }
  return { key: entry.key, value: "" };
}

function isValidIdForKind(value, kind) {
  if (kind === "android_app_id") return /^ca-app-pub-\d{16}~\d+$/.test(value);
  return /^ca-app-pub-\d{16}\/\d+$/.test(value);
}

function checkAdMobValue({ key, value, kind, appAdsPublisherId, required }) {
  const issues = [];
  if (!value) {
    if (required) issues.push({ code: "missing_admob_id", key, message: `${key} is required for production AdMob monetization` });
    return { status: required ? "missing" : "not-configured", issues };
  }

  const publisherId = publisherIdFromValue(value);
  const masked = maskPublisherId(value);
  if (!isValidIdForKind(value, kind)) {
    issues.push({ code: "invalid_admob_id_format", key, message: `${key} must use ${kind === "android_app_id" ? "ca-app-pub-0000000000000000~0000000000" : "ca-app-pub-0000000000000000/0000000000"} format` });
  }
  if (publisherId === SAMPLE_PUBLISHER_ID) {
    issues.push({ code: "sample_admob_id", key, message: `${key} must not use Google's sample AdMob id` });
  }
  if (appAdsPublisherId && publisherId && publisherId !== appAdsPublisherId) {
    issues.push({ code: "publisher_mismatch", key, message: `${key} publisher does not match public/app-ads.txt publisher` });
  }

  const prefix = issues.length > 0 ? (publisherId === SAMPLE_PUBLISHER_ID ? "sample" : "invalid") : "present";
  return { status: `${prefix}:${masked}`, issues };
}

function evaluateAdMobProductionReadiness({
  env,
  appAdsText,
  monetizationMode = "android-banner",
}) {
  const issues = [];
  const warnings = [];
  const summary = {};
  const appAds = parseAppAdsText(appAdsText || "");
  const requiredKeys = REQUIRED_KEYS_BY_MODE[monetizationMode];
  if (!requiredKeys) {
    throw new Error("Unsupported AdMob monetization mode: " + monetizationMode);
  }

  if (!appAdsText) {
    issues.push({ code: "missing_app_ads", message: "public/app-ads.txt is required before production monetization" });
  } else {
    issues.push(...appAds.issues);
  }

  for (const entry of ADMOB_IDS) {
    const required = requiredKeys.has(entry.key);
    const { key, value } = envValue(env, entry);
    const result = checkAdMobValue({
      key: entry.key,
      value,
      kind: entry.kind,
      appAdsPublisherId: appAds.publisherId,
      required,
    });
    summary[entry.key] = result.status;
    issues.push(...result.issues);
  }

  if (appAds.publisherId) summary["public/app-ads.txt"] = `present:${maskPublisherId(appAds.publisherId)}`;

  return { ok: issues.length === 0, issues, warnings, summary };
}

function parseArgs(argv) {
  const args = {
    envFiles: [],
    appAdsFile: DEFAULT_APP_ADS_FILE,
    monetizationMode: process.env.ZENFLOW_ADMOB_MODE || "android-banner",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--env-file") args.envFiles.push(argv[++i]);
    else if (arg === "--app-ads-file") args.appAdsFile = path.resolve(ROOT, argv[++i]);
    else if (arg === "--mode") {
      args.monetizationMode = argv[++i] || "";
      if (!REQUIRED_KEYS_BY_MODE[args.monetizationMode]) {
        throw new Error("Unsupported AdMob monetization mode: " + args.monetizationMode);
      }
    } else throw new Error("Unknown argument: " + arg);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = loadEnv(args.envFiles.length > 0 ? args.envFiles : DEFAULT_ENV_FILES);
  const report = evaluateAdMobProductionReadiness({
    env,
    appAdsText: readAppAdsFile(args.appAdsFile),
    monetizationMode: args.monetizationMode,
  });
  const status = report.ok ? "PASS" : "UNVERIFIED";
  const scope = "Android banner AdMob ids";
  console.log(`[admob-readiness] ${status} - ${scope} and local app-ads.txt ${report.ok ? "are ready" : "need release-owner action"}`);
  for (const [key, value] of Object.entries(report.summary)) {
    console.log(`[admob-readiness] ${key}=${value}`);
  }
  for (const issue of report.issues) {
    console.log(`[admob-readiness] issue=${issue.code}${issue.key ? ` key=${issue.key}` : ""} - ${issue.message}`);
  }
  for (const warning of report.warnings) {
    console.log(`[admob-readiness] warning=${warning.code}${warning.key ? ` key=${warning.key}` : ""} - ${warning.message}`);
  }
  process.exit(report.ok ? 0 : 2);
}

if (require.main === module) main();

module.exports = {
  evaluateAdMobProductionReadiness,
  maskPublisherId,
  parseAppAdsText,
};
