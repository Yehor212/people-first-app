#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const RUNBOOK = "docs/release/google-play/ADMOB_OWNER_FINALIZATION_RUNBOOK.md";
const README = "docs/release/google-play/README.md";
const LEDGER = "docs/release/google-play/ADMOB_EXTERNAL_READINESS.json";
const OWNER_EVIDENCE_TEMPLATE = "docs/release/google-play/ADMOB_OWNER_EVIDENCE_TEMPLATE.json";

const REQUIRED_RUNBOOK_SNIPPETS = [
  "External Finalization Status",
  "Privacy & messages / CMP",
  "Payments, identity, tax, and holds",
  "Release-equivalent live rewarded-ad smoke",
  "Full cross-platform ad-unit expansion",
  "Psychological safety approval",
  "Public-safe evidence rules",
  "Owner PASS evidence fact requirements",
  "Each owner evidence row also has a `facts` object",
  "free-text evidence alone is never enough",
  "does not copy `facts` into the public `ADMOB_EXTERNAL_READINESS.json` ledger",
  "ADMOB_EXTERNAL_READINESS.json",
  "google-play:admob:external-check",
  "google-play:admob:external-check:pass",
  "google-play:admob:external-check:full-pass",
  "google-play:admob:owner-runbook:check",
  "google-play:admob:owner-evidence:check",
  "google-play:admob:owner-evidence:prepare",
  "google-play:admob:owner-evidence:apply",
  "google-play:privacy:artifact-check",
  "post-deploy public privacy smoke",
  "google-play:privacy:public-check",
  "ADMOB_OWNER_EVIDENCE_TEMPLATE.json",
  "output/private/admob-owner-evidence.json",
  "public_privacy_policy",
  "privacy_messages_cmp",
  "admob_app_ads_txt_status",
  "payments_tax_info",
  "payments_identity_address",
  "payments_payment_method",
  "payments_holds",
  "play_console_ads_data_safety",
  "live_ad_playback_device",
  "full_cross_platform_ad_units",
  "current Android rewarded-only gate",
  "future expansion gate, not a blocker",
  "not part of the approved current release path",
  "Privacy controls are consent, disclosure, and withdrawal only",
  "No production rewarded playback surface is approved inside Settings / Privacy",
  "separate Optional Rewards surface",
  "No scarcity or guilt copy",
  "PARTIAL",
  "UNVERIFIED",
  "https://support.google.com/admob/answer/10564477",
  "https://support.google.com/admob/answer/10448801",
  "https://support.google.com/admob/answer/14538460",
  "https://support.google.com/admob/answer/10113207",
  "https://support.google.com/admob/answer/13554116",
  "https://support.google.com/admob/answer/16918505",
  "https://support.google.com/admob/answer/9999955",
  "https://developers.google.com/admob/android/privacy",
  "https://developers.google.com/admob/ios/privacy",
  "https://developers.google.com/admob/android/privacy/play-data-disclosure",
  "https://support.google.com/admob/answer/2772513",
  "https://support.google.com/admob/answer/11601831",
  "live_ad_playback_device: PASS",
  "admob_app_ads_txt_status",
  "admob_app_readiness",
  "admob_policy_center",
  "play_console_ads_data_safety",
  "Google-certified CMP",
  "IAB Transparency and Consent Framework",
  "TCF v2.3",
  "Countries subject to GDPR (EEA, UK, and Switzerland)",
  "Do not consent",
  "Close (do not consent)",
  "English, Ukrainian, Spanish, German, French, Japanese, Arabic, and Hebrew",
  "privacy-options entry point",
  "canRequestAds",
  "privacy_messages_cmp: published European regulations message, Google-certified CMP, TCF v2.3, and ZenFlow app selection",
  "play_console_ads_data_safety: Ads=Yes, Advertising ID=Yes, Data safety includes Google Mobile Ads SDK data, and privacy policy URL matches listing",
  "payments_holds: no payment hold, no tax hold, no identity hold, no compliance hold, and no self-hold",
  "live_ad_playback_device: release-equivalent Android, consent path, rewarded video open, reward callback, revocation stop check, and no prompts or ad requests in sacred zones",
  "full_cross_platform_ad_units: Android, iOS, banner, rewarded, owner-controlled non-sample IDs, and same publisher family",
  "dataSafetyIncludesGoogleMobileAdsSdkData",
  "googleMobileAdsSdkDataDisclosureReviewed",
  "rewardCallbackGrantedAfterCompletion",
  "revocationStopsNewAdRequests",
  "noMoodCheckInPromptOrRequest",
  "noActiveFocusPromptOrRequest",
  "noFocusReflectionPromptOrRequest",
  "noJournalEditorPromptOrRequest",
  "noBadOrTerribleMoodPromptOrRequest",
  "samePublisherFamily",
];

const PRIVATE_PATTERNS = [
  { code: "raw_admob_id", regex: /ca-app-pub-\d{16}[~/]\d+/i },
  { code: "raw_publisher_id", regex: /\bpub-\d{16}\b/i },
  { code: "long_numeric_identifier", regex: /\b\d{9,}\b/ },
  { code: "email_address", regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i },
  { code: "ssn", regex: /\bSSN\b/i },
  { code: "tin", regex: /\bTIN\b/i },
  { code: "ein", regex: /\bEIN\b/i },
  { code: "ssn_like_value", regex: /\b\d{3}-\d{2}-\d{4}\b/ },
  { code: "ein_like_value", regex: /\b\d{2}-\d{7}\b/ },
  { code: "tax_form", regex: /\bW-?9\b/i },
  { code: "tax_form", regex: /\bW-?8BEN\b/i },
  { code: "identity_document", regex: /\bidentity document\b/i },
  { code: "passport", regex: /\bpassport\b/i },
  { code: "drivers_license", regex: /\bdriver'?s? license\b/i },
  { code: "tax_id", regex: /\btax id\b/i },
  { code: "tax_form_detail", regex: /\btax form\b/i },
  { code: "bank_account", regex: /\bbank account\b/i },
  { code: "bank_name", regex: /\bbank name\b/i },
  { code: "account_holder", regex: /\baccount holder\b/i },
  { code: "legal_name", regex: /\blegal name\b/i },
  { code: "full_name", regex: /\bfull name\b/i },
  { code: "personal_name", regex: /\bpersonal name\b/i },
  { code: "owner_name", regex: /\bowner name\b/i },
  { code: "account_name", regex: /\baccount name\b/i },
  { code: "payment_identifier", regex: /\bpayment[ -]?(?:id|identifier|reference)\b/i },
  { code: "payout_identifier", regex: /\bpayout[ -]?(?:id|identifier|reference)\b/i },
  { code: "pay_identifier", regex: /\bPAY-[A-Z0-9-]{3,}\b/i },
  { code: "routing_number", regex: /\brouting number\b/i },
  { code: "card_number", regex: /\bcard number\b/i },
  { code: "iban", regex: /\biban\b/i },
  { code: "swift", regex: /\bswift\b/i },
  { code: "payment_profile", regex: /\bpayment profile\b/i },
  { code: "home_address", regex: /\bhome address\b/i },
  { code: "personal_address", regex: /\bpersonal address\b/i },
  { code: "street_address", regex: /\b\d{1,6}\s+[A-Za-z0-9.'-]+\s+(Street|St\.?|Road|Rd\.?|Avenue|Ave\.?|Boulevard|Blvd\.?|Lane|Ln\.?|Drive|Dr\.?)\b/i },
  { code: "card_like_number", regex: /\b(?:\d[ -]?){13,19}\b/ },
];

const PRESSURE_COPY_PATTERNS = [
  /need treats\? watch/i,
  /can't (feed|water)/i,
  /needs you/i,
  /care failure/i,
  /streak harm/i,
  /countdown/i,
];

function read(relativePath, failures) {
  const filePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(filePath)) {
    failures.push(`${relativePath} is missing`);
    return "";
  }
  return fs.readFileSync(filePath, "utf8");
}

function isSafePrivateWarningContext(text, index) {
  const context = text.slice(Math.max(0, index - 180), Math.min(text.length, index + 180));
  return /(?:do not|must not|without leaking|forbidden evidence|does not reveal|must not contain|public-safe|raw IDs|screenshots? containing)/i.test(context);
}

function hasUnsafePrivatePattern(text, regex) {
  const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
  const matcher = new RegExp(regex.source, flags);
  let match;
  while ((match = matcher.exec(text)) !== null) {
    if (!isSafePrivateWarningContext(text, match.index)) return true;
    if (match[0].length === 0) matcher.lastIndex += 1;
  }
  return false;
}

function main() {
  const failures = [];
  const runbook = read(RUNBOOK, failures);
  const readme = read(README, failures);
  const ledger = read(LEDGER, failures);
  const ownerEvidenceTemplate = read(OWNER_EVIDENCE_TEMPLATE, failures);
  const packageJson = read("package.json", failures);
  const taskCompletion = read("scripts/check-task-completion-protocol.cjs", failures);

  if (runbook) {
    for (const snippet of REQUIRED_RUNBOOK_SNIPPETS) {
      if (!runbook.includes(snippet)) failures.push(`${RUNBOOK} is missing required token: ${snippet}`);
    }
    for (const pattern of PRIVATE_PATTERNS) {
      if (hasUnsafePrivatePattern(runbook, pattern.regex)) failures.push(`${RUNBOOK} contains forbidden ${pattern.code}`);
    }
    for (const pattern of PRESSURE_COPY_PATTERNS) {
      if (pattern.test(runbook)) failures.push(`${RUNBOOK} contains forbidden pressure-copy pattern: ${pattern}`);
    }
  }

  if (readme && !readme.includes("ADMOB_OWNER_FINALIZATION_RUNBOOK.md")) {
    failures.push(`${README} must link the AdMob owner finalization runbook`);
  }
  if (ownerEvidenceTemplate) {
    for (const token of ["zenflow-admob-owner-evidence/v1", "output/private/admob-owner-evidence.json"]) {
      if (!ownerEvidenceTemplate.includes(token)) failures.push(`${OWNER_EVIDENCE_TEMPLATE} is missing ${token}`);
    }
    for (const pattern of PRIVATE_PATTERNS) {
      if (pattern.regex.test(ownerEvidenceTemplate)) failures.push(`${OWNER_EVIDENCE_TEMPLATE} contains forbidden ${pattern.code}`);
    }
  }
  if (ledger) {
    for (const id of [
      "admob_app_ads_txt_status",
      "privacy_messages_cmp",
      "payments_tax_info",
      "payments_identity_address",
      "payments_payment_method",
      "payments_holds",
      "play_console_ads_data_safety",
      "live_ad_playback_device",
      "full_cross_platform_ad_units",
    ]) {
      if (!ledger.includes(id)) failures.push(`${LEDGER} is missing ${id}`);
    }

    if (runbook) {
      try {
        const parsedLedger = JSON.parse(ledger);
        for (const item of parsedLedger.items || []) {
          const expectedRow = `| \`${item.id}\` | ${item.status} |`;
          if (!runbook.includes(expectedRow)) {
            failures.push(`${RUNBOOK} status table is not synchronized with ${LEDGER}: missing ${expectedRow}`);
          }
        }
      } catch (error) {
        failures.push(`${LEDGER} must be valid JSON: ${error.message || String(error)}`);
      }
    }
  }
  if (packageJson && !packageJson.includes('"google-play:admob:owner-runbook:check"')) {
    failures.push("package.json is missing google-play:admob:owner-runbook:check");
  }
  if (packageJson && !packageJson.includes('"google-play:admob:owner-evidence:check"')) {
    failures.push("package.json is missing google-play:admob:owner-evidence:check");
  }
  if (packageJson && !packageJson.includes('"google-play:admob:owner-evidence:prepare"')) {
    failures.push("package.json is missing google-play:admob:owner-evidence:prepare");
  }
  if (packageJson && !packageJson.includes('"google-play:admob:owner-evidence:apply"')) {
    failures.push("package.json is missing google-play:admob:owner-evidence:apply");
  }
  if (taskCompletion && !taskCompletion.includes("google-play:admob:owner-runbook:check")) {
    failures.push("task completion guard is missing google-play:admob:owner-runbook:check");
  }
  if (taskCompletion && !taskCompletion.includes("google-play:admob:owner-evidence:prepare")) {
    failures.push("task completion guard is missing google-play:admob:owner-evidence:prepare");
  }
  if (taskCompletion && !taskCompletion.includes("google-play:admob:owner-evidence:apply")) {
    failures.push("task completion guard is missing google-play:admob:owner-evidence:apply");
  }

  if (failures.length > 0) {
    console.error("[admob-owner-finalization-runbook] FAIL");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log("[admob-owner-finalization-runbook] PASS - owner-only AdMob finalization runbook is wired and public-safe");
}

main();
