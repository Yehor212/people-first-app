#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const RUNBOOK = "docs/release/google-play/ADMOB_OWNER_FINALIZATION_RUNBOOK.md";
const LEDGER = "docs/release/google-play/ADMOB_EXTERNAL_READINESS.json";
const TEMPLATE = "docs/release/google-play/ADMOB_OWNER_EVIDENCE_TEMPLATE.json";

const REQUIRED_SNIPPETS = [
  "current Android banner gate",
  "Release-equivalent live Android banner smoke",
  "VITE_ADMOB_BANNER_ID_ANDROID",
  "must not use Google sample IDs",
  "Privacy & messages / CMP",
  "canRequestAds",
  "privacy-options entry point",
  "Play Console and privacy declarations",
  "Data safety",
  "Policy Center",
  "Payments, identity, tax, and holds",
  "Forbidden evidence: raw IDs",
  "live_ad_playback_device: PASS",
  "habitsBannerRendered",
  "adMobRequestObserved",
  "adMobImpressionObserved",
  "bannerDoesNotOverlapAppContent",
  "noDrawerSheetModalBanner",
  "google-play:admob:external-check:pass",
  "google-play:admob:owner-evidence:prepare",
  "output/private/admob-owner-evidence.json",
  "https://developers.google.com/admob/android/banner",
  "https://developers.google.com/admob/android/privacy",
  "https://developers.google.com/admob/android/privacy/play-data-disclosure",
];

const FORBIDDEN_CURRENT_PATTERNS = [
  /current[^\n]{0,100}rewarded/i,
  /approved[^\n]{0,100}rewarded/i,
  /VITE_ADMOB_REWARDED_ID_ANDROID/,
  /rewardCallbackGrantedAfterCompletion/,
  /affirmativeOptInBeforeEachRewardedAd/,
];

const PRIVATE_PATTERNS = [
  /ca-app-pub-\d{16}[~/]\d+/i,
  /\bpub-\d{16}\b/i,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
];

function main() {
  const failures = [];
  const runbook = fs.readFileSync(path.join(ROOT, RUNBOOK), "utf8");
  const ledger = JSON.parse(fs.readFileSync(path.join(ROOT, LEDGER), "utf8"));
  const template = JSON.parse(fs.readFileSync(path.join(ROOT, TEMPLATE), "utf8"));

  for (const snippet of REQUIRED_SNIPPETS) {
    if (!runbook.includes(snippet)) failures.push(`runbook is missing ${snippet}`);
  }
  for (const pattern of FORBIDDEN_CURRENT_PATTERNS) {
    if (pattern.test(runbook)) failures.push(`runbook contains obsolete current rewarded contract ${pattern}`);
  }
  for (const pattern of PRIVATE_PATTERNS) {
    if (pattern.test(runbook)) failures.push(`runbook contains private/raw identifier ${pattern}`);
  }
  for (const item of ledger.items || []) {
    const row = `| \`${item.id}\` | ${item.status} |`;
    if (!runbook.includes(row)) failures.push(`runbook status table is stale for ${item.id}`);
  }

  const liveItem = (template.items || []).find((item) => item.id === "live_ad_playback_device");
  const requiredFacts = [
    "releaseEquivalentAndroid",
    "consentPathCompleted",
    "habitsBannerRendered",
    "adMobRequestObserved",
    "adMobImpressionObserved",
    "bannerDoesNotOverlapAppContent",
    "rotationRecreatesAdaptiveBanner",
    "backgroundRemovesBanner",
    "revocationStopsNewAdRequests",
    "noDrawerSheetModalBanner",
  ];
  for (const fact of requiredFacts) {
    if (!(fact in (liveItem?.facts || {})) || !runbook.includes(`\`${fact}\``)) {
      failures.push(`banner evidence fact is missing or undocumented: ${fact}`);
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) console.log(`[admob-owner-runbook] FAIL - ${failure}`);
    process.exit(1);
  }
  console.log("[admob-owner-runbook] PASS - Android banner owner finalization contract is coherent");
}

if (require.main === module) main();
