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
const TEMPLATE_FILE = path.join(ROOT, "docs", "release", "google-play", "ADMOB_OWNER_EVIDENCE_TEMPLATE.json");
const DEFAULT_PRIVATE_FILE = "output/private/admob-owner-evidence.json";
const SCHEMA_VERSION = "zenflow-admob-owner-evidence/v1";
const VALID_STATUSES = new Set(["PASS", "PARTIAL", "UNVERIFIED", "FAIL"]);
const DEFAULT_MAX_PASS_AGE_DAYS = 14;
const ALLOWED_TOP_LEVEL_KEYS = new Set(["schemaVersion", "packageName", "evidenceDate", "privateFilePath", "instructions", "items"]);
const ALLOWED_ITEM_KEYS = new Set(["id", "status", "checkedAt", "evidence", "facts", "sourceUrls"]);
const SENSITIVE_FIELD_NAME_PATTERN = /(?:name|email|address|tax|ssn|ein|bank|routing|iban|swift|payment|profile|document|screenshot|passport|license|(?:^|[_-])tin(?:$|[_-]))/i;

const OWNER_EVIDENCE_ITEM_IDS = [
  "admob_app_ads_txt_status",
  "admob_app_readiness",
  "admob_policy_center",
  "privacy_messages_cmp",
  "payments_tax_info",
  "payments_identity_address",
  "payments_payment_method",
  "payments_holds",
  "play_console_ads_data_safety",
  "live_ad_playback_device",
];

const LIVE_PLAYBACK_PREREQUISITE_IDS = [
  "privacy_messages_cmp",
  "play_console_ads_data_safety",
  "admob_app_ads_txt_status",
  "admob_app_readiness",
  "admob_policy_center",
];

const REQUIRED_PASS_EVIDENCE_PATTERNS_BY_ITEM = Object.freeze({
  admob_app_ads_txt_status: [/verify app/i, /confirmed|done/i, /zenflow/i],
  admob_app_readiness: [/ready/i, /ad serving enabled/i, /google play linked/i, /active ad units/i],
  admob_policy_center: [/policy center/i, /no violations/i, /no blocking issues/i, /no regulatory issues/i, /no advertiser-preference restrictions/i, /no restricted or disabled ad requests/i],
  privacy_messages_cmp: [/published/i, /european regulations/i, /google-certified cmp/i, /tcf v2\.3/i, /zenflow/i, /ZenFlow CMP languages en, uk, es, de, fr, and ja were all reviewed and available/i, /Google supported-language list reviewed/i, /Arabic \(ar\) and Hebrew \(he\) European regulations fallback was reviewed/i, /no Arabic or Hebrew European regulations translation is claimed/i, /do not consent/i, /close do-not-consent/i, /privacy-options entry point/i, /canRequestAds/i],
  payments_tax_info: [/tax/i, /no action required/i],
  payments_identity_address: [/identity/i, /address/i, /no action required|verified/i],
  payments_payment_method: [/payment method/i, /eligible|no action required/i],
  payments_holds: [/no payment hold/i, /no tax hold/i, /no identity hold/i, /no compliance hold/i, /no self-hold/i],
  play_console_ads_data_safety: [/ads=yes/i, /advertising id=yes/i, /data safety includes google mobile ads sdk data/i, /privacy policy url matches listing/i, /IP address/i, /user product interactions/i, /diagnostics/i, /device or other identifiers/i, /release manifest/i],
  live_ad_playback_device: [
    /release-equivalent android/i,
    /habits banner/i,
    /consent/i,
    /banner rendered/i,
    /ad request observed/i,
    /ad impression observed/i,
    /does not overlap.{0,80}(?:content|bottom navigation)|(?:content|bottom navigation).{0,80}does not overlap/i,
    /rotation.{0,80}adaptive banner/i,
    /background(?:ing)?.{0,80}(?:removed|removes) banner/i,
    /revocation stopped new ad requests/i,
    /no banner.{0,120}mood logging|mood logging.{0,120}no banner/i,
    /no banner.{0,120}active focus|active focus.{0,120}no banner/i,
    /no banner.{0,120}focus reflection|focus reflection.{0,120}no banner/i,
    /no banner.{0,120}journal editor|journal editor.{0,120}no banner/i,
    /no banner.{0,120}onboarding|onboarding.{0,120}no banner/i,
    /bad\/terrible mood states.{0,120}no banner|no banner.{0,120}bad\/terrible mood states/i,
    /drawer.{0,120}no banner|no banner.{0,120}drawer/i,
  ],
});

const FORBIDDEN_PASS_EVIDENCE_PATTERNS_BY_ITEM = Object.freeze({
  admob_app_ads_txt_status: [
    /not confirmed.{0,80}(?:done|verify app)|verify app.{0,80}not confirmed|confirmed.{0,80}not shown/i,
  ],
  admob_app_readiness: [
    /\bnot ready\b/i,
    /ad serving.{0,80}(?:disabled|not enabled|not shown)/i,
    /google play.{0,80}not linked/i,
    /active ad units.{0,80}not shown|no active ad units/i,
  ],
  admob_policy_center: [
    /violations?.{0,40}(?:present|active|found|shown)/i,
    /blocking issues?.{0,40}(?:present|active|found|shown)/i,
    /no regulatory issues?.{0,80}(?:not shown|not confirmed|not found)/i,
    /no advertiser-preference restrictions?.{0,80}(?:not shown|not confirmed|not found)/i,
    /no restricted or disabled ad requests?.{0,80}(?:not shown|not confirmed|not found)/i,
    /regulatory issues?.{0,40}(?:present|active|found|shown)/i,
    /advertiser-preference restrictions?.{0,40}(?:present|active|found|shown)/i,
    /restricted or disabled ad requests?.{0,40}(?:present|active|found|shown)/i,
  ],
  privacy_messages_cmp: [
    /not published|unpublished|did not publish/i,
    /\b(?:English|Ukrainian|Spanish|German|French|Japanese|Arabic|Hebrew|en|uk|es|de|fr|ja|ar|he)\b.{0,80}(?:unavailable|missing|not offered|not reviewed|not available|not confirmed)/i,
    /(?:unavailable|missing|not offered|not reviewed|not available|not confirmed).{0,80}\b(?:English|Ukrainian|Spanish|German|French|Japanese|Arabic|Hebrew|en|uk|es|de|fr|ja|ar|he)\b/i,
    /where available/i,
    /\b(?:Arabic|Hebrew|ar|he)\b.{0,80}(?:reviewed and available|selected as (?:a )?(?:CMP|European regulations) language|available as (?:a )?(?:CMP|European regulations) language)/i,
    /privacy-options entry point.{0,80}not confirmed/i,
    /canRequestAds.{0,80}not confirmed/i,
    /zenflow app.{0,80}not selected/i,
    /google-certified cmp.{0,80}not/i,
  ],
  payments_tax_info: [
    /did not show no action required/i,
    /no action required.{0,80}not (?:shown|confirmed|found)/i,
    /tax.{0,80}(?:blocking action|action still required|review pending)/i,
  ],
  payments_identity_address: [
    /identity.{0,80}not (?:verified|shown|confirmed)/i,
    /address.{0,80}not (?:verified|shown|confirmed)/i,
    /no action required.{0,80}not (?:shown|confirmed|found)/i,
  ],
  payments_payment_method: [
    /payment method.{0,80}not eligible/i,
    /not eligible for payouts/i,
    /payout method.{0,80}needs owner action/i,
  ],
  payments_holds: [
    /\b(?:payment|tax|identity|compliance|self)[ -]?holds?\s+(?:present|active|blocking|required|found|shown)\b/i,
    /no payment hold.{0,80}not (?:shown|confirmed|found)/i,
    /no tax hold.{0,80}not (?:shown|confirmed|found)/i,
    /no identity hold.{0,80}not (?:shown|confirmed|found)/i,
    /no compliance hold.{0,80}not (?:shown|confirmed|found)/i,
    /no self-hold.{0,80}not (?:shown|confirmed|found)/i,
  ],
  play_console_ads_data_safety: [
    /data safety.{0,80}\b(?:omit|omits|omitted|missing|does not include|doesn't include)\b/i,
    /data safety.{0,160}\b(?:no|zero|without|not|omit|omits|omitted|missing)\b.{0,160}google mobile ads/i,
    /data safety.{0,160}\b(?:except|excluding|exclude|excludes|excluded|leave out|leaves out|left out|lack|lacks|lacking|apart from|other than|save for)\b.{0,160}google mobile ads/i,
    /google mobile ads.{0,160}\b(?:absent|excluded|left out|lacking|missing|omitted|not disclosed|not included)\b/i,
    /data safety.{0,80}\bwithout\b.{0,80}google mobile ads/i,
    /privacy policy.{0,80}\b(?:does not match|doesn't match|not match|mismatch|mismatched)\b/i,
  ],
  live_ad_playback_device: [
    /banner.{0,80}(?:did not render|failed|never rendered)/i,
    /ad request.{0,80}(?:not observed|missing|failed)/i,
    /ad impression.{0,80}(?:not observed|missing|failed)/i,
    /banner.{0,80}(?:(?<!does not )(?<!doesn't )\boverlaps?\b|(?<!not )\bcovered\b).{0,80}(?:content|navigation)/i,
    /background(?:ing)?.{0,80}did not remove banner/i,
    /revocation.{0,80}\b(?:not completed|not checked|did not|failed|missing)\b/i,
  ],
});

const REQUIRED_PASS_FACTS_BY_ITEM = Object.freeze({
  admob_app_ads_txt_status: ["verifyAppConfirmedDone", "zenflowAppSelected"],
  admob_app_readiness: ["ready", "adServingEnabled", "googlePlayLinked", "activeAdUnits"],
  admob_policy_center: ["policyCenterReviewed", "noViolations", "noBlockingIssues", "noRegulatoryIssues", "noAdvertiserPreferenceRestrictions", "noRestrictedOrDisabledAdRequests"],
  privacy_messages_cmp: [
    "europeanRegulationsMessagePublished",
    "googleCertifiedCmp",
    "tcfV23",
    "zenflowAppSelected",
    "eeaUkSwitzerlandTargeting",
    "privacyPolicyUrlMatched",
    "googleSupportedLanguageListReviewed",
    "cmpLanguageEnReviewed",
    "cmpLanguageUkReviewed",
    "cmpLanguageEsReviewed",
    "cmpLanguageDeReviewed",
    "cmpLanguageFrReviewed",
    "cmpLanguageJaReviewed",
    "cmpLanguageArFallbackReviewed",
    "cmpLanguageHeFallbackReviewed",
    "doNotConsentChoiceReviewed",
    "closeDoNotConsentReviewed",
    "privacyOptionsEntryPointConfirmed",
    "canRequestAdsGateConfirmed",
  ],
  payments_tax_info: ["taxNoActionRequired"],
  payments_identity_address: ["identityNoActionRequiredOrVerified", "addressNoActionRequiredOrVerified"],
  payments_payment_method: ["paymentMethodEligible"],
  payments_holds: ["noPaymentHold", "noTaxHold", "noIdentityHold", "noComplianceHold", "noSelfHold"],
  play_console_ads_data_safety: [
    "adsDeclaredYes",
    "advertisingIdDeclaredYes",
    "dataSafetyIncludesGoogleMobileAdsSdkData",
    "googleMobileAdsSdkDataDisclosureReviewed",
    "privacyPolicyUrlMatchesListing",
    "gmaIpAddressDisclosureReviewed",
    "gmaUserProductInteractionsDisclosureReviewed",
    "gmaDiagnosticsDisclosureReviewed",
    "gmaDeviceOrOtherIdentifiersDisclosureReviewed",
    "advertisingIdMatchesReleaseManifest",
  ],
  live_ad_playback_device: [
    "releaseEquivalentAndroid",
    "consentPathCompleted",
    "habitsBannerRendered",
    "adMobRequestObserved",
    "adMobImpressionObserved",
    "bannerDoesNotOverlapAppContent",
    "rotationRecreatesAdaptiveBanner",
    "backgroundRemovesBanner",
    "revocationStopsNewAdRequests",
    "noMoodCheckInBannerOrRequest",
    "noActiveFocusBannerOrRequest",
    "noFocusReflectionBannerOrRequest",
    "noJournalEditorBannerOrRequest",
    "noOnboardingBannerOrRequest",
    "noBadOrTerribleMoodBannerOrRequest",
    "noDrawerSheetModalBanner",
  ],
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
      issues.push(issue("unsafe_private_evidence_detail", "Owner evidence contains private payment, tax, address, identity, or bank-like detail", itemId));
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) scanAllowedStringFields(entry, issues, itemId);
    return;
  }
  if (value && typeof value === "object") {
    for (const entry of Object.values(value)) scanAllowedStringFields(entry, issues, itemId);
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validatePassEvidenceFacts(item, issues) {
  if (item.status !== "PASS") return;
  const patterns = REQUIRED_PASS_EVIDENCE_PATTERNS_BY_ITEM[item.id] || [];
  const evidence = typeof item.evidence === "string" ? item.evidence : "";
  const forbiddenPatterns = FORBIDDEN_PASS_EVIDENCE_PATTERNS_BY_ITEM[item.id] || [];
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(evidence)) {
      issues.push(issue(
        "contradictory_pass_evidence",
        `${item.id} PASS evidence contains wording that contradicts a PASS status for ${pattern}`,
        item.id,
      ));
    }
  }
  if (patterns.length === 0) return;
  for (const pattern of patterns) {
    if (!pattern.test(evidence)) {
      issues.push(issue(
        "missing_required_pass_evidence_fact",
        `${item.id} PASS evidence must include concrete public-safe facts for ${pattern}`,
        item.id,
      ));
    }
  }
}

function validateStructuredFacts(item, issues) {
  const allowedFacts = new Set(REQUIRED_PASS_FACTS_BY_ITEM[item.id] || []);
  const hasFacts = item.facts !== undefined;

  if (hasFacts && !isPlainObject(item.facts)) {
    issues.push(issue("invalid_facts", `${item.id} facts must be an object of boolean public-safe checklist values`, item.id));
    return;
  }

  if (hasFacts) {
    for (const [factKey, factValue] of Object.entries(item.facts)) {
      if (!allowedFacts.has(factKey)) {
        issues.push(issue("unknown_fact_key", `${item.id} contains unsupported fact ${factKey}`, item.id));
        if (SENSITIVE_FIELD_NAME_PATTERN.test(factKey)) {
          issues.push(issue("sensitive_fact_name", `${item.id} fact ${factKey} looks private`, item.id));
        }
      }
      if (typeof factValue !== "boolean") {
        issues.push(issue("invalid_fact_value", `${item.id} fact ${factKey} must be true or false`, item.id));
      }
    }
  }

  if (item.status !== "PASS") return;
  const requiredFacts = REQUIRED_PASS_FACTS_BY_ITEM[item.id] || [];
  if (requiredFacts.length === 0) return;
  if (!hasFacts || !isPlainObject(item.facts)) {
    issues.push(issue("missing_required_pass_facts", `${item.id} PASS evidence needs structured public-safe facts`, item.id));
    return;
  }
  for (const factKey of requiredFacts) {
    if (item.facts[factKey] !== true) {
      issues.push(issue("required_pass_fact_not_true", `${item.id} PASS fact ${factKey} must be true`, item.id));
    }
  }
}

function normalizeItems(input, issues) {
  if (!Array.isArray(input?.items)) {
    issues.push(issue("missing_items", "Owner evidence must include an items array"));
    return [];
  }

  return input.items.map((item) => ({
    ...item,
    id: typeof item?.id === "string" ? item.id.trim() : "",
    status: typeof item?.status === "string" ? item.status.trim().toUpperCase() : "",
  }));
}

function validateAllowedFields(input, issues) {
  for (const key of Object.keys(input)) {
    const allowed = ALLOWED_TOP_LEVEL_KEYS.has(key);
    if (!allowed) {
      issues.push(issue("unknown_top_level_field", `Owner evidence contains unsupported top-level field ${key}`));
      if (SENSITIVE_FIELD_NAME_PATTERN.test(key)) {
        issues.push(issue("sensitive_field_name", `Owner evidence top-level field ${key} looks private`));
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

function evaluateOwnerEvidence(input, options = {}) {
  const requirePass = options.requirePass === true;
  const now = options.now instanceof Date ? options.now : new Date();
  const maxPassAgeDays = Number.isFinite(options.maxPassAgeDays) ? Number(options.maxPassAgeDays) : DEFAULT_MAX_PASS_AGE_DAYS;
  const issues = [];

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      ok: false,
      ownerReady: false,
      issues: [issue("invalid_owner_evidence", "Owner evidence must be a JSON object")],
      items: [],
    };
  }

  if (input.schemaVersion !== SCHEMA_VERSION) {
    issues.push(issue("invalid_schema_version", `Owner evidence must use ${SCHEMA_VERSION}`));
  }
  if (input.packageName !== "com.zenflow.app") {
    issues.push(issue("invalid_package_name", "Owner evidence must target com.zenflow.app"));
  }
  if (hasPrivateIdentifier(input)) {
    issues.push(issue("private_identifier_leak", "Owner evidence must not contain raw ad, payment, account, or personal identifiers"));
  }
  validateAllowedFields(input, issues);
  for (const key of Object.keys(input)) {
    if (ALLOWED_TOP_LEVEL_KEYS.has(key) && key !== "items") scanAllowedStringFields(input[key], issues);
  }

  const items = normalizeItems(input, issues);
  const byId = new Map();
  const ownerIds = new Set(OWNER_EVIDENCE_ITEM_IDS);
  for (const item of items) {
    if (!item.id) {
      issues.push(issue("missing_item_id", "Every owner evidence item needs an id"));
      continue;
    }
    validateAllowedItemFields(item, issues);
    if (!ownerIds.has(item.id)) {
      issues.push(issue("unknown_owner_evidence_item", `${item.id} is not an owner evidence item`, item.id));
    }
    if (byId.has(item.id)) {
      issues.push(issue("duplicate_item_id", `Duplicate owner evidence item ${item.id}`, item.id));
    }
    byId.set(item.id, item);

    if (!VALID_STATUSES.has(item.status)) {
      issues.push(issue("invalid_item_status", `${item.id} must use PASS, PARTIAL, UNVERIFIED, or FAIL`, item.id));
    }
    if (typeof item.evidence !== "string" || item.evidence.trim().length < 16) {
      issues.push(issue("missing_item_evidence", `${item.id} needs public-safe evidence text`, item.id));
    }
    validatePassEvidenceFacts(item, issues);
    validateStructuredFacts(item, issues);
    for (const key of Object.keys(item)) {
      if (ALLOWED_ITEM_KEYS.has(key)) {
        scanAllowedStringFields(item[key], issues, item.id);
      }
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
      const requiredUrls = ADMOB_READINESS_REQUIRED_SOURCE_URLS_BY_ITEM[item.id] || [];
      for (const requiredUrl of requiredUrls) {
        if (!item.sourceUrls.includes(requiredUrl)) {
          issues.push(issue("missing_required_source_url", `${item.id} must cite ${requiredUrl}`, item.id));
        }
      }
    }
    if (item.status === "PASS") {
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

  for (const requiredId of OWNER_EVIDENCE_ITEM_IDS) {
    const item = byId.get(requiredId);
    if (!item) {
      issues.push(issue("missing_owner_evidence_item", `Missing owner evidence item ${requiredId}`, requiredId));
      continue;
    }
    if (requirePass && item.status !== "PASS") {
      issues.push(issue("owner_item_not_pass", `${requiredId} is ${item.status}, not PASS`, requiredId));
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

  const requiredItems = OWNER_EVIDENCE_ITEM_IDS.map((id) => byId.get(id)).filter(Boolean);
  const ownerReady = requiredItems.length === OWNER_EVIDENCE_ITEM_IDS.length && requiredItems.every((item) => item.status === "PASS") && issues.length === 0;

  return {
    ok: issues.length === 0,
    ownerReady,
    issues,
    items,
  };
}

function parseArgs(argv) {
  const args = { file: null, requirePass: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--file") args.file = path.resolve(ROOT, argv[++i]);
    else if (arg === "--require-pass") args.requirePass = true;
  }
  return args;
}

function readJson(file) {
  if (!fs.existsSync(file)) throw new Error(`${path.relative(ROOT, file)} is missing`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function printReport(label, report) {
  const status = report.ownerReady && report.ok ? "PASS" : "UNVERIFIED";
  console.log(`[admob-owner-evidence] ${status} - ${label}`);
  for (const item of report.items) {
    if (OWNER_EVIDENCE_ITEM_IDS.includes(item.id)) {
      console.log(`[admob-owner-evidence] ${item.id}=${item.status}`);
    }
  }
  for (const itemIssue of report.issues) {
    console.log(`[admob-owner-evidence] issue=${itemIssue.code}${itemIssue.itemId ? ` item=${itemIssue.itemId}` : ""} - ${itemIssue.message}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.file) {
    let templateReport;
    try {
      templateReport = evaluateOwnerEvidence(readJson(TEMPLATE_FILE), { requirePass: false });
    } catch (error) {
      console.log(`[admob-owner-evidence] UNVERIFIED - ${error.message}`);
      process.exit(2);
    }
    printReport("OWNER_EVIDENCE_TEMPLATE is available; prepare output/private/admob-owner-evidence.json after owner console checks", templateReport);
    console.log("[admob-owner-evidence] next=npm run google-play:admob:owner-evidence:prepare");
    console.log(`[admob-owner-evidence] next=run node scripts/check-admob-owner-evidence.cjs --file ${DEFAULT_PRIVATE_FILE}`);
    if (args.requirePass) {
      console.log(`[admob-owner-evidence] issue=missing_private_owner_evidence - strict mode needs --file ${DEFAULT_PRIVATE_FILE}`);
      process.exit(2);
    }
    process.exit(templateReport.ok ? 0 : 2);
  }

  let report;
  try {
    report = evaluateOwnerEvidence(readJson(args.file), { requirePass: args.requirePass });
  } catch (error) {
    console.log(`[admob-owner-evidence] UNVERIFIED - ${error.message}`);
    process.exit(2);
  }
  printReport(`owner evidence file ${path.relative(ROOT, args.file)} ${report.ownerReady ? "is ready" : "still has unresolved checks"}`, report);
  process.exit(report.ok && (!args.requirePass || report.ownerReady) ? 0 : 2);
}

if (require.main === module) main();

module.exports = {
  evaluateOwnerEvidence,
  OWNER_EVIDENCE_ITEM_IDS,
  LIVE_PLAYBACK_PREREQUISITE_IDS,
};
