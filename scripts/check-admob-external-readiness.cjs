#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  ADMOB_READINESS_APPROVED_SOURCE_URLS,
  ADMOB_READINESS_OFFICIAL_SOURCE_HOSTS,
  ADMOB_READINESS_REQUIRED_SOURCE_URLS_BY_ITEM,
} = require("./admob-readiness-sources.cjs");

const ROOT = path.join(__dirname, "..");
const DEFAULT_LEDGER = path.join(ROOT, "docs", "release", "google-play", "ADMOB_EXTERNAL_READINESS.json");
const SCHEMA_VERSION = "zenflow-admob-external-readiness/v1";
const VALID_STATUSES = new Set(["PASS", "PARTIAL", "UNVERIFIED", "FAIL"]);
const DEFAULT_MAX_PASS_AGE_DAYS = 14;
const ALLOWED_TOP_LEVEL_KEYS = new Set(["schemaVersion", "packageName", "updatedAt", "purpose", "items"]);
const ALLOWED_ITEM_KEYS = new Set(["id", "status", "checkedAt", "evidence", "ownerAction", "sourceUrls"]);
const SENSITIVE_FIELD_NAME_PATTERN = /(?:name|email|address|tax|tin|ssn|ein|bank|routing|iban|swift|payment|profile|document|screenshot|passport|license)/i;
const REQUIRED_OFFICIAL_SOURCE_URLS_BY_ITEM = ADMOB_READINESS_REQUIRED_SOURCE_URLS_BY_ITEM;
const REQUIRED_EXTERNAL_READINESS_IDS = [
  "public_app_ads_root",
  "admob_app_ads_txt_status",
  "public_google_play_listing",
  "public_privacy_policy",
  "admob_app_readiness",
  "admob_policy_center",
  "privacy_messages_cmp",
  "payments_tax_info",
  "payments_identity_address",
  "payments_payment_method",
  "payments_holds",
  "play_console_ads_data_safety",
  "live_ad_playback_device",
  "full_cross_platform_ad_units",
];

const CURRENT_ANDROID_REWARDED_READINESS_IDS = REQUIRED_EXTERNAL_READINESS_IDS.filter(
  (id) => id !== "full_cross_platform_ad_units",
);

const FULL_CROSS_PLATFORM_READINESS_IDS = [...REQUIRED_EXTERNAL_READINESS_IDS];

const LIVE_PLAYBACK_PREREQUISITE_IDS = [
  "privacy_messages_cmp",
  "public_privacy_policy",
  "play_console_ads_data_safety",
  "admob_app_ads_txt_status",
  "admob_app_readiness",
  "admob_policy_center",
];

const REQUIRED_PASS_EVIDENCE_PATTERNS_BY_ITEM = Object.freeze({
  public_app_ads_root: [/public root app-ads check passed/i, /masked publisher/i],
  admob_app_ads_txt_status: [/verify app/i, /zenflow/i, /confirmed|done status/i],
  public_google_play_listing: [
    /public listing check passed/i,
    /developer website/i,
    /contains ads/i,
    /privacy policy/i,
    /rewarded ads copy/i,
  ],
  public_privacy_policy: [
    /google-play:privacy:public-check|public privacy policy check passed/i,
    /post-deploy public privacy smoke|GitHub Pages post-deploy/i,
    /Google Mobile Ads/i,
    /\bUMP\b|Google User Messaging Platform|privacy choices/i,
    /Advertising ID|ad-services/i,
    /optional rewarded ads|rewarded ads/i,
    /Google Mobile Ads SDK data categories|IP address/i,
  ],
  admob_app_readiness: [/ready/i, /ad serving enabled/i, /google play linked/i, /active ad units/i],
  admob_policy_center: [/policy center/i, /no violations|no blocking issues/i],
  privacy_messages_cmp: [/published/i, /european regulations/i, /google-certified cmp/i, /tcf v2\.3/i, /zenflow/i],
  payments_tax_info: [/tax/i, /no action required/i],
  payments_identity_address: [/identity/i, /address/i, /no action required|verified/i],
  payments_payment_method: [/payment method/i, /eligible|no action required/i],
  payments_holds: [/no payment hold/i, /no tax hold/i, /no identity hold/i, /no compliance hold/i, /no self-hold/i],
  play_console_ads_data_safety: [
    /ads=yes/i,
    /advertising id=yes/i,
    /data safety includes google mobile ads sdk data/i,
    /privacy policy url matches listing/i,
  ],
  live_ad_playback_device: [
    /release-equivalent android/i,
    /rewarded/i,
    /consent/i,
    /video opened/i,
    /reward callback granted/i,
    /revocation stopped new ad requests/i,
    /no prompt.{0,120}mood logging|mood logging.{0,120}no prompt/i,
    /no prompt.{0,120}active focus|active focus.{0,120}no prompt/i,
    /no prompt.{0,120}focus reflection|focus reflection.{0,120}no prompt/i,
    /no prompt.{0,120}journal editor|journal editor.{0,120}no prompt/i,
    /bad\/terrible mood states.{0,120}no prompt|no prompt.{0,120}bad\/terrible mood states/i,
  ],
  full_cross_platform_ad_units: [/android/i, /ios/i, /banner/i, /rewarded/i, /owner-controlled/i, /non-sample/i, /same publisher/i],
});

const PRIVATE_VALUE_PATTERNS = [
  { code: "raw_admob_id", regex: /ca-app-pub-\d{16}[~/]\d+/i },
  { code: "raw_publisher_id", regex: /\bpub-\d{16}\b/i },
  { code: "long_numeric_identifier", regex: /\b\d{9,}\b/ },
  { code: "email_address", regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i },
];

const UNSAFE_PRIVATE_EVIDENCE_PATTERNS = [
  /\bSSN\b/i,
  /\bTIN\b/i,
  /\bEIN\b/i,
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\b\d{2}-\d{7}\b/,
  /\bW-?9\b/i,
  /\bW-?8BEN\b/i,
  /\bidentity document\b/i,
  /\bpassport\b/i,
  /\bdriver'?s? license\b/i,
  /\btax id\b/i,
  /\btax form\b/i,
  /\bbank account\b/i,
  /\bbank name\b/i,
  /\baccount holder\b/i,
  /\blegal name\b/i,
  /\bfull name\b/i,
  /\bpersonal name\b/i,
  /\bowner name\b/i,
  /\baccount name\b/i,
  /\bpayment[ -]?(?:id|identifier|reference)\b/i,
  /\bpayout[ -]?(?:id|identifier|reference)\b/i,
  /\bPAY-[A-Z0-9-]{3,}\b/i,
  /\brouting number\b/i,
  /\bcard number\b/i,
  /\biban\b/i,
  /\bswift\b/i,
  /\bpayment profile\b/i,
  /\bhome address\b/i,
  /\bpersonal address\b/i,
  /\b\d{1,6}\s+[A-Za-z0-9.'-]+\s+(Street|St\.?|Road|Rd\.?|Avenue|Ave\.?|Boulevard|Blvd\.?|Lane|Ln\.?|Drive|Dr\.?)\b/i,
  /\b(?:\d[ -]?){13,19}\b/,
];

function issue(code, message, itemId) {
  return itemId ? { code, itemId, message } : { code, message };
}

function stringifyForLeakScan(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function hasPrivateIdentifier(value) {
  const text = stringifyForLeakScan(value);
  return PRIVATE_VALUE_PATTERNS.some((pattern) => pattern.regex.test(text));
}

function hasUnsafePrivateEvidenceDetail(value) {
  const text = stringifyForLeakScan(value);
  return UNSAFE_PRIVATE_EVIDENCE_PATTERNS.some((pattern) => pattern.test(text));
}

function parseCheckedAt(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function passEvidenceAgeDays(item, now) {
  const checkedAt = parseCheckedAt(item.checkedAt);
  if (checkedAt === null) return null;
  return Math.floor((now.getTime() - checkedAt) / (24 * 60 * 60 * 1000));
}

function isOfficialSourceUrl(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ADMOB_READINESS_OFFICIAL_SOURCE_HOSTS.has(url.hostname.toLowerCase());
  } catch (_error) {
    return false;
  }
}

function sourceUrlHasQueryOrHash(value) {
  try {
    const url = new URL(value);
    return Boolean(url.search || url.hash);
  } catch (_error) {
    return false;
  }
}

function isApprovedSourceUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return ADMOB_READINESS_APPROVED_SOURCE_URLS.has(url.href);
  } catch (_error) {
    return false;
  }
}

function scanAllowedStringFields(value, issues, itemId) {
  if (typeof value === "string") {
    if (hasUnsafePrivateEvidenceDetail(value)) {
      issues.push(issue("unsafe_private_evidence_detail", "External readiness evidence contains private payment, tax, address, identity, or bank-like detail", itemId));
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) scanAllowedStringFields(entry, issues, itemId);
  }
}

function validateAllowedFields(input, issues) {
  for (const key of Object.keys(input)) {
    const allowed = ALLOWED_TOP_LEVEL_KEYS.has(key);
    if (!allowed) {
      issues.push(issue("unknown_top_level_field", `External readiness ledger contains unsupported top-level field ${key}`));
      if (SENSITIVE_FIELD_NAME_PATTERN.test(key)) {
        issues.push(issue("sensitive_field_name", `External readiness top-level field ${key} looks private`));
      }
    }
  }
}

function validateAllowedItemFields(item, issues) {
  for (const key of Object.keys(item)) {
    const allowed = ALLOWED_ITEM_KEYS.has(key);
    if (!allowed) {
      issues.push(issue("unknown_item_field", `${item.id || "unknown item"} contains unsupported field ${key}`, item.id || undefined));
      if (SENSITIVE_FIELD_NAME_PATTERN.test(key)) {
        issues.push(issue("sensitive_field_name", `${item.id || "unknown item"} field ${key} looks private`, item.id || undefined));
      }
    }
  }
}

function normalizeItems(ledger, issues) {
  if (!Array.isArray(ledger?.items)) {
    issues.push(issue("missing_items", "External readiness ledger must include an items array"));
    return [];
  }

  return ledger.items.map((item) => ({
    ...item,
    id: typeof item?.id === "string" ? item.id.trim() : "",
    status: typeof item?.status === "string" ? item.status.trim().toUpperCase() : "",
  }));
}

function evaluateExternalReadiness(input, options = {}) {
  const requirePass = options.requirePass === true;
  const requireFullCrossPlatform = options.requireFullCrossPlatform === true;
  const now = options.now instanceof Date ? options.now : new Date();
  const maxPassAgeDays = Number.isFinite(options.maxPassAgeDays) ? Number(options.maxPassAgeDays) : DEFAULT_MAX_PASS_AGE_DAYS;
  const issues = [];

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      ok: false,
      passReady: false,
      issues: [issue("invalid_ledger", "External readiness ledger must be a JSON object")],
      items: [],
    };
  }

  if (input.schemaVersion !== SCHEMA_VERSION) {
    issues.push(issue("invalid_schema_version", `External readiness ledger must use ${SCHEMA_VERSION}`));
  }

  if (input.packageName !== "com.zenflow.app") {
    issues.push(issue("invalid_package_name", "External readiness ledger must target com.zenflow.app"));
  }

  if (hasPrivateIdentifier(input)) {
    issues.push(issue("private_identifier_leak", "External readiness ledger must not contain raw ad, payment, account, or personal identifiers"));
  }
  validateAllowedFields(input, issues);
  for (const key of Object.keys(input)) {
    if (ALLOWED_TOP_LEVEL_KEYS.has(key) && key !== "items") scanAllowedStringFields(input[key], issues);
  }

  const items = normalizeItems(input, issues);
  const byId = new Map();
  const externalIds = new Set(REQUIRED_EXTERNAL_READINESS_IDS);
  for (const item of items) {
    if (!item.id) {
      issues.push(issue("missing_item_id", "Every external readiness item needs an id"));
      continue;
    }
    validateAllowedItemFields(item, issues);
    if (!externalIds.has(item.id)) {
      issues.push(issue("unknown_external_readiness_item", `${item.id} is not an external readiness item`, item.id));
    }
    if (byId.has(item.id)) {
      issues.push(issue("duplicate_item_id", `Duplicate external readiness item ${item.id}`, item.id));
    }
    byId.set(item.id, item);

    if (!VALID_STATUSES.has(item.status)) {
      issues.push(issue("invalid_item_status", `${item.id} must use PASS, PARTIAL, UNVERIFIED, or FAIL`, item.id));
    }
    if (typeof item.evidence !== "string" || item.evidence.trim().length < 12) {
      issues.push(issue("missing_item_evidence", `${item.id} needs public-safe evidence text`, item.id));
    }
    for (const key of Object.keys(item)) {
      if (ALLOWED_ITEM_KEYS.has(key)) scanAllowedStringFields(item[key], issues, item.id);
    }
    if (typeof item.ownerAction !== "string" || item.ownerAction.trim().length < 8) {
      issues.push(issue("missing_owner_action", `${item.id} needs an owner action or recheck instruction`, item.id));
    }
    if (!Array.isArray(item.sourceUrls) || item.sourceUrls.length === 0) {
      issues.push(issue("missing_source_urls", `${item.id} needs at least one official source URL`, item.id));
    } else {
      for (const sourceUrl of item.sourceUrls) {
        if (!isOfficialSourceUrl(sourceUrl)) {
          issues.push(issue("unofficial_source_url", `${item.id} source URL must be an official Google or Android developer HTTPS URL`, item.id));
        }
        if (!isApprovedSourceUrl(sourceUrl)) {
          issues.push(issue("unapproved_source_url", `${item.id} source URL must exactly match an approved official source URL`, item.id));
        }
        if (sourceUrlHasQueryOrHash(sourceUrl)) {
          issues.push(issue("source_url_must_not_have_query_or_hash", `${item.id} source URL must not contain query or hash data`, item.id));
        }
      }
      const requiredUrls = REQUIRED_OFFICIAL_SOURCE_URLS_BY_ITEM[item.id] || [];
      for (const requiredUrl of requiredUrls) {
        if (!item.sourceUrls.includes(requiredUrl)) {
          issues.push(issue("missing_required_source_url", `${item.id} must cite ${requiredUrl}`, item.id));
        }
      }
    }
    if (item.status === "PASS") {
      const requiredPassPatterns = REQUIRED_PASS_EVIDENCE_PATTERNS_BY_ITEM[item.id] || [];
      for (const pattern of requiredPassPatterns) {
        if (!pattern.test(item.evidence || "")) {
          issues.push(issue("missing_required_pass_evidence", `${item.id} PASS evidence must include the required public-safe proof signals`, item.id));
          break;
        }
      }
      const ageDays = passEvidenceAgeDays(item, now);
      if (ageDays === null) {
        issues.push(issue("missing_checked_at", `${item.id} PASS evidence needs checkedAt as YYYY-MM-DD`, item.id));
      } else if (ageDays < 0) {
        issues.push(issue("future_pass_evidence", `${item.id} PASS evidence checkedAt is in the future`, item.id));
      } else if (ageDays > maxPassAgeDays) {
        issues.push(issue("stale_pass_evidence", `${item.id} PASS evidence is ${ageDays} days old; max is ${maxPassAgeDays}`, item.id));
      }
    }
  }

  const livePlayback = byId.get("live_ad_playback_device");
  if (livePlayback?.status === "PASS") {
    for (const prerequisiteId of LIVE_PLAYBACK_PREREQUISITE_IDS) {
      const prerequisite = byId.get(prerequisiteId);
      if (!prerequisite || prerequisite.status !== "PASS") {
        issues.push(issue("live_playback_prerequisite_not_pass", `live_ad_playback_device cannot be PASS until ${prerequisiteId} is PASS`, "live_ad_playback_device"));
      }
    }
  }

  const passGateIds = requireFullCrossPlatform ? FULL_CROSS_PLATFORM_READINESS_IDS : CURRENT_ANDROID_REWARDED_READINESS_IDS;
  for (const requiredId of REQUIRED_EXTERNAL_READINESS_IDS) {
    const item = byId.get(requiredId);
    if (!item) {
      issues.push(issue("missing_required_external_item", `Missing required external readiness item ${requiredId}`, requiredId));
      continue;
    }
    if (requirePass && passGateIds.includes(requiredId) && item.status !== "PASS") {
      issues.push(issue("external_item_not_pass", `${requiredId} is ${item.status}, not PASS`, requiredId));
    }
  }

  const currentRequiredItems = CURRENT_ANDROID_REWARDED_READINESS_IDS.map((id) => byId.get(id)).filter(Boolean);
  const fullRequiredItems = FULL_CROSS_PLATFORM_READINESS_IDS.map((id) => byId.get(id)).filter(Boolean);
  const nonPassIssues = issues.filter((itemIssue) => itemIssue.code !== "external_item_not_pass");
  const passReady = currentRequiredItems.length === CURRENT_ANDROID_REWARDED_READINESS_IDS.length && currentRequiredItems.every((item) => item.status === "PASS") && nonPassIssues.length === 0;
  const fullCrossPlatformReady = fullRequiredItems.length === FULL_CROSS_PLATFORM_READINESS_IDS.length && fullRequiredItems.every((item) => item.status === "PASS") && nonPassIssues.length === 0;

  return {
    ok: issues.length === 0,
    passReady,
    fullCrossPlatformReady,
    issues,
    items,
  };
}

function parseArgs(argv) {
  const args = { ledgerFile: DEFAULT_LEDGER, requirePass: false, requireFullCrossPlatform: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--file") args.ledgerFile = path.resolve(ROOT, argv[++i]);
    else if (arg === "--require-pass") args.requirePass = true;
    else if (arg === "--require-full-cross-platform") args.requireFullCrossPlatform = true;
  }
  return args;
}

function readLedger(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`${path.relative(ROOT, file)} is missing`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  let report;
  try {
    report = evaluateExternalReadiness(readLedger(args.ledgerFile), {
      requirePass: args.requirePass,
      requireFullCrossPlatform: args.requireFullCrossPlatform,
    });
  } catch (error) {
    console.log(`[admob-external-readiness] UNVERIFIED - ${error.message}`);
    process.exit(2);
  }

  const gate = args.requireFullCrossPlatform ? "full-cross-platform" : "current-android-rewarded";
  const gateReady = args.requireFullCrossPlatform ? report.fullCrossPlatformReady : report.passReady;
  const status = gateReady && report.ok ? "PASS" : "UNVERIFIED";
  console.log(`[admob-external-readiness] ${status} - ${gate} Google/owner monetization evidence ${gateReady ? "is ready" : "still has unresolved checks"}`);
  for (const item of report.items) {
    if (REQUIRED_EXTERNAL_READINESS_IDS.includes(item.id)) {
      console.log(`[admob-external-readiness] ${item.id}=${item.status}`);
    }
  }
  for (const itemIssue of report.issues) {
    console.log(`[admob-external-readiness] issue=${itemIssue.code}${itemIssue.itemId ? ` item=${itemIssue.itemId}` : ""} - ${itemIssue.message}`);
  }

  process.exit(report.ok && (!args.requirePass || gateReady) ? 0 : 2);
}

if (require.main === module) main();

module.exports = {
  evaluateExternalReadiness,
  REQUIRED_EXTERNAL_READINESS_IDS,
  CURRENT_ANDROID_REWARDED_READINESS_IDS,
  FULL_CROSS_PLATFORM_READINESS_IDS,
  REQUIRED_OFFICIAL_SOURCE_URLS_BY_ITEM,
};
