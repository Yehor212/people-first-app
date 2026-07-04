#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_PRIVACY_POLICY_URL = "https://yehor212.github.io/people-first-app/privacy.html";
const OLD_NO_ADS_CLAIM = "No ads. No selling your data. Ever.";
const ALLOWED_LOCAL_PRIVACY_FILES = new Set([
  "public/privacy.html",
  "public/privacy-policy.html",
  "docs/privacy-policy.html",
  "dist/privacy.html",
  "output/pages-artifact.nosync/privacy.html",
]);

function normalizeText(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAll(body, patterns) {
  return patterns.every((pattern) => pattern.test(body));
}

function evaluatePublicPrivacyPolicyHtml({ html }) {
  const body = normalizeText(html);
  const issues = [];
  const signals = {
    zenflowPolicyVisible: /ZenFlow/i.test(body) && /Privacy Policy/i.test(body),
    googleMobileAdsVisible: /AdMob|Google Mobile Ads/i.test(body),
    umpVisible: /Google User Messaging Platform|\bUMP\b|privacy choices/i.test(body),
    advertisingIdVisible: /Advertising ID|ad ID|ad-services/i.test(body),
    rewardedAdsVisible: /optional rewarded ads|rewarded ads/i.test(body),
    googleMobileAdsDataVisible: hasAll(body, [
      /IP address/i,
      /user product interactions|ad interactions|video views/i,
      /diagnostic information|diagnostics/i,
      /device\/account identifiers|device and account identifiers|device identifiers/i,
      /advertising|analytics|fraud prevention/i,
    ]),
    oldNoAdsClaimVisible: body.includes(OLD_NO_ADS_CLAIM),
  };

  if (!signals.zenflowPolicyVisible) {
    issues.push({ code: "zenflow_policy_missing", message: "Privacy policy must identify ZenFlow and be recognizable as a privacy policy" });
  }
  if (!signals.googleMobileAdsVisible) {
    issues.push({ code: "google_mobile_ads_missing", message: "Privacy policy must disclose AdMob / Google Mobile Ads when the Play artifact contains ads" });
  }
  if (!signals.umpVisible) {
    issues.push({ code: "ump_missing", message: "Privacy policy must disclose the Google UMP / privacy choices entry point" });
  }
  if (!signals.advertisingIdVisible) {
    issues.push({ code: "advertising_id_missing", message: "Privacy policy must mention Advertising ID or ad-services declarations for ads-enabled Android builds" });
  }
  if (!signals.rewardedAdsVisible) {
    issues.push({ code: "rewarded_ads_missing", message: "Privacy policy must describe ZenFlow ads as optional rewarded ads" });
  }
  if (!signals.googleMobileAdsDataVisible) {
    issues.push({ code: "google_mobile_ads_data_missing", message: "Privacy policy must disclose Google Mobile Ads SDK data categories: IP address, user product interactions, diagnostic information, and device/account identifiers" });
  }
  if (signals.oldNoAdsClaimVisible) {
    issues.push({ code: "old_no_ads_claim_visible", message: "Privacy policy must not expose the stale no-ads claim" });
  }

  return { ok: issues.length === 0, issues, signals };
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    file: process.env.ZENFLOW_PUBLIC_PRIVACY_FILE || "",
    url: process.env.ZENFLOW_PUBLIC_PRIVACY_URL || DEFAULT_PRIVACY_POLICY_URL,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--file") {
      args.file = argv[++i] || "";
    } else if (arg === "--url") {
      args.url = argv[++i] || "";
    } else {
      throw new Error("Unknown argument: " + arg);
    }
  }

  return args;
}

function resolveLocalPrivacyFile(file) {
  const normalized = String(file || "").replace(/\\/g, "/").replace(/^\.\//, "");
  if (path.isAbsolute(normalized) || !ALLOWED_LOCAL_PRIVACY_FILES.has(normalized)) {
    throw new Error("Unsupported local privacy policy file: " + file);
  }
  return { normalized, filePath: path.join(process.cwd(), normalized) };
}

async function loadPrivacyPolicyHtml(args) {
  if (args.file) {
    const { normalized, filePath } = resolveLocalPrivacyFile(args.file);
    return {
      html: fs.readFileSync(filePath, "utf8"),
      source: "file:" + normalized,
      status: "local",
    };
  }

  const response = await fetch(args.url, { cache: "no-store", redirect: "follow" });
  return {
    html: await response.text(),
    source: args.url,
    status: response.status,
  };
}

async function main() {
  const loaded = await loadPrivacyPolicyHtml(parseArgs());
  const report = evaluatePublicPrivacyPolicyHtml({ html: loaded.html });

  if (typeof loaded.status === "number" && (loaded.status < 200 || loaded.status >= 300)) {
    report.issues.unshift({ code: "http_status", message: "Privacy policy returned HTTP " + loaded.status });
    report.ok = false;
  }

  console.log("[privacy-public] " + (report.ok ? "PASS" : "UNVERIFIED") + " - " + loaded.source + " " + loaded.status);
  console.log("[privacy-public] googleMobileAds=" + (report.signals.googleMobileAdsVisible ? "present" : "missing"));
  console.log("[privacy-public] ump=" + (report.signals.umpVisible ? "present" : "missing"));
  console.log("[privacy-public] advertisingId=" + (report.signals.advertisingIdVisible ? "present" : "missing"));
  console.log("[privacy-public] rewardedAds=" + (report.signals.rewardedAdsVisible ? "present" : "missing"));
  console.log("[privacy-public] googleMobileAdsData=" + (report.signals.googleMobileAdsDataVisible ? "present" : "missing"));
  console.log("[privacy-public] oldNoAdsClaim=" + (report.signals.oldNoAdsClaimVisible ? "visible" : "absent"));
  for (const issue of report.issues) {
    console.log("[privacy-public] issue=" + issue.code + " - " + issue.message);
  }
  process.exit(report.ok ? 0 : 2);
}

if (require.main === module) {
  main().catch((error) => {
    console.log("[privacy-public] UNVERIFIED - " + (error.message || error));
    process.exit(2);
  });
}

module.exports = {
  DEFAULT_PRIVACY_POLICY_URL,
  OLD_NO_ADS_CLAIM,
  ALLOWED_LOCAL_PRIVACY_FILES,
  evaluatePublicPrivacyPolicyHtml,
  loadPrivacyPolicyHtml,
  normalizeText,
  parseArgs,
  resolveLocalPrivacyFile,
};
