#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const LOCAL_APP_ADS = path.join(ROOT, "public", "app-ads.txt");
const SAMPLE_PUBLISHER_ID = "pub-3940256099942544";
const GOOGLE_SELLER_ID = "f08c47fec0942fa0";

function maskPublisherId(value) {
  const publisherId = String(value || "").match(/pub-\d{16}/)?.[0];
  if (!publisherId) return "no-publisher-fragment";
  return publisherId.replace(/^(pub-\d{4})\d+(\d{4})$/, "$1********$2");
}

function localPublisherId() {
  if (!fs.existsSync(LOCAL_APP_ADS)) return "";
  return fs.readFileSync(LOCAL_APP_ADS, "utf8").match(/pub-\d{16}/)?.[0] || "";
}

function normalizeAppAdsUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) throw new Error("Set ZENFLOW_APP_ADS_PUBLIC_URL or pass --url https://example.com/app-ads.txt");
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("Public app-ads.txt proof must use https");
  if (!url.pathname.endsWith("/app-ads.txt")) {
    url.pathname = `${url.pathname.replace(/\/$/, "")}/app-ads.txt`;
  }
  url.search = "";
  url.hash = "";
  return url.toString();
}

function validateAppAdsBody({ body, expectedPublisherId }) {
  const trimmed = String(body || "").trim();
  const match = /^google\.com, (pub-\d{16}), DIRECT, ([a-f0-9]{16})$/i.exec(trimmed);
  if (!match) {
    return { ok: false, issues: [{ code: "invalid_app_ads_format", message: "Public app-ads.txt must contain exactly one Google AdMob seller line" }] };
  }
  const [, publisherId, sellerId] = match;
  const issues = [];
  if (publisherId === SAMPLE_PUBLISHER_ID) {
    issues.push({ code: "sample_publisher_id", message: "Public app-ads.txt must not use Google's sample publisher id" });
  }
  if (sellerId.toLowerCase() !== GOOGLE_SELLER_ID) {
    issues.push({ code: "invalid_seller_id", message: `Public app-ads.txt must use Google seller id ${GOOGLE_SELLER_ID}` });
  }
  if (expectedPublisherId && publisherId !== expectedPublisherId) {
    issues.push({ code: "publisher_mismatch", message: "Public app-ads.txt publisher does not match the configured/local publisher" });
  }
  return {
    ok: issues.length === 0,
    publisherId,
    maskedPublisherId: maskPublisherId(publisherId),
    issues,
  };
}

function parseArgs(argv) {
  const args = { url: process.env.ZENFLOW_APP_ADS_PUBLIC_URL || "", publisherId: process.env.ZENFLOW_ADMOB_PUBLISHER_ID || localPublisherId() };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--url") args.url = argv[++i];
    else if (arg === "--publisher-id") args.publisherId = argv[++i];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = normalizeAppAdsUrl(args.url);
  const response = await fetch(url, { cache: "no-store" });
  const body = await response.text();
  if (response.status !== 200) {
    console.log(`[app-ads-public] UNVERIFIED - ${url} returned HTTP ${response.status}`);
    process.exit(2);
  }
  const result = validateAppAdsBody({ body, expectedPublisherId: args.publisherId });
  console.log(`[app-ads-public] ${result.ok ? "PASS" : "UNVERIFIED"} - ${url} ${result.maskedPublisherId || "no-publisher-fragment"}`);
  for (const issue of result.issues) {
    console.log(`[app-ads-public] issue=${issue.code} - ${issue.message}`);
  }
  process.exit(result.ok ? 0 : 2);
}

if (require.main === module) {
  main().catch((error) => {
    console.log(`[app-ads-public] UNVERIFIED - ${error.message}`);
    process.exit(2);
  });
}

module.exports = {
  normalizeAppAdsUrl,
  validateAppAdsBody,
};
