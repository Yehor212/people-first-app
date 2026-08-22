#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  evaluateExternalReadiness,
  CURRENT_ANDROID_REWARDED_READINESS_IDS,
  FULL_CROSS_PLATFORM_READINESS_IDS,
} = require("./check-admob-external-readiness.cjs");

const ROOT = path.join(__dirname, "..");
const DEFAULT_LEDGER = path.join(ROOT, "docs", "release", "google-play", "ADMOB_EXTERNAL_READINESS.json");
const DEFAULT_OUT = path.join(ROOT, "output", "private", "admob-owner-next-steps.md");
const OWNER_ACTION_IDS = new Set([
  "privacy_messages_cmp",
  "payments_tax_info",
  "payments_identity_address",
  "payments_payment_method",
  "payments_holds",
  "play_console_ads_data_safety",
  "live_ad_playback_device",
]);
const GOOGLE_SERVICE_IDS = new Set([
  "admob_app_ads_txt_status",
  "admob_app_readiness",
  "admob_policy_center",
]);

const OWNER_FACT_LABELS_BY_ITEM = Object.freeze({
  admob_app_ads_txt_status: [
    ["verifyAppConfirmedDone", "AdMob Verify app/app-ads.txt status is confirmed done for the ZenFlow app."],
    ["zenflowAppSelected", "The selected AdMob app is ZenFlow, without recording raw app or publisher IDs."],
  ],
  admob_app_readiness: [
    ["ready", "AdMob app readiness shows Ready."],
    ["adServingEnabled", "Ad serving is enabled for the app."],
    ["googlePlayLinked", "The AdMob app is linked to the Google Play listing."],
    ["activeAdUnits", "The app has active ad units for the intended release scope."],
  ],
  admob_policy_center: [
    ["policyCenterReviewed", "Policy Center was opened for the ZenFlow app/account scope."],
    ["noViolations", "No policy violations are shown."],
    ["noBlockingIssues", "No blocking issue prevents ad serving."],
    ["noRegulatoryIssues", "Confirm there are no regulatory issues for the app/account."],
    ["noAdvertiserPreferenceRestrictions", "Confirm there are no advertiser-preference restrictions."],
    ["noRestrictedOrDisabledAdRequests", "Confirm there are no restricted or disabled ad requests."],
  ],
  privacy_messages_cmp: [
    ["europeanRegulationsMessagePublished", "European regulations message is published."],
    ["googleCertifiedCmp", "The message uses a Google-certified CMP."],
    ["tcfV23", "TCF v2.3 is used where required."],
    ["zenflowAppSelected", "The ZenFlow AdMob app is selected."],
    ["eeaUkSwitzerlandTargeting", "EEA, UK, and Switzerland targeting is configured."],
    ["privacyPolicyUrlMatched", "The privacy policy URL matches the published listing/policy URL."],
    ["googleSupportedLanguageListReviewed", "Google Privacy & messaging supported-language list was reviewed for European regulations messages."],
    ["cmpLanguageEnReviewed", "English (en) European regulations message was reviewed and available."],
    ["cmpLanguageUkReviewed", "Ukrainian (uk) European regulations message was reviewed and available."],
    ["cmpLanguageEsReviewed", "Spanish (es) European regulations message was reviewed and available."],
    ["cmpLanguageDeReviewed", "German (de) European regulations message was reviewed and available."],
    ["cmpLanguageFrReviewed", "French (fr) European regulations message was reviewed and available."],
    ["cmpLanguageJaReviewed", "Japanese (ja) European regulations message was reviewed and available."],
    ["cmpLanguageArFallbackReviewed", "Arabic (ar) fallback was reviewed because Google does not list Arabic for European regulations messages."],
    ["cmpLanguageHeFallbackReviewed", "Hebrew (he) fallback was reviewed because Google does not list Hebrew for European regulations messages."],
    ["doNotConsentChoiceReviewed", "Do not consent choice was reviewed."],
    ["closeDoNotConsentReviewed", "Close/no-consent behavior was reviewed."],
    ["privacyOptionsEntryPointConfirmed", "In-app privacy-options entry point is confirmed."],
    ["canRequestAdsGateConfirmed", "canRequestAds gate is confirmed before ad requests."],
  ],
  payments_tax_info: [
    ["taxNoActionRequired", "Tax page shows no action required, or the row remains non-PASS."],
  ],
  payments_identity_address: [
    ["identityNoActionRequiredOrVerified", "Identity verification shows verified/no action required."],
    ["addressNoActionRequiredOrVerified", "Address verification shows verified/no action required."],
  ],
  payments_payment_method: [
    ["paymentMethodEligible", "Payment method is eligible for payouts/no action required."],
  ],
  payments_holds: [
    ["noPaymentHold", "No payment hold is shown."],
    ["noTaxHold", "No tax hold is shown."],
    ["noIdentityHold", "No identity hold is shown."],
    ["noComplianceHold", "No compliance hold is shown."],
    ["noSelfHold", "No self-hold is shown."],
  ],
  play_console_ads_data_safety: [
    ["adsDeclaredYes", "Play Console Ads declaration is Yes."],
    ["advertisingIdDeclaredYes", "Advertising ID declaration is Yes."],
    ["dataSafetyIncludesGoogleMobileAdsSdkData", "Data safety includes Google Mobile Ads SDK data."],
    ["googleMobileAdsSdkDataDisclosureReviewed", "Google Mobile Ads SDK disclosure was reviewed."],
    ["privacyPolicyUrlMatchesListing", "Privacy policy URL matches the public listing."],
    ["gmaIpAddressDisclosureReviewed", "IP address disclosure was reviewed."],
    ["gmaUserProductInteractionsDisclosureReviewed", "User product interactions disclosure was reviewed."],
    ["gmaDiagnosticsDisclosureReviewed", "Diagnostics disclosure was reviewed."],
    ["gmaDeviceOrOtherIdentifiersDisclosureReviewed", "Device or other identifiers disclosure was reviewed."],
    ["advertisingIdMatchesReleaseManifest", "Advertising ID declaration matches the release manifest."],
  ],
  live_ad_playback_device: [
    ["releaseEquivalentAndroid", "Release-equivalent Android build/device was used."],
    ["consentPathCompleted", "Consent path completed before ad request."],
    ["clearRewardAndActionDisclosureConfirmed", "Clear reward and required action disclosure appears before the ad."],
    ["affirmativeOptInBeforeEachRewardedAd", "The user gives affirmative opt-in before each rewarded ad."],
    ["rewardedVideoOpened", "Rewarded video opened only from an approved optional surface."],
    ["dismissWithoutRewardChecked", "Dismissal without reward was checked."],
    ["dismissOrSkipDoesNotBlockNormalUse", "Dismiss or skip does not block normal app use."],
    ["noPressureOrMisleadingChoiceCopy", "No pressure, guilt, scarcity, or misleading choice copy appears."],
    ["rewardCallbackGrantedAfterCompletion", "Reward callback grants only after completion."],
    ["revocationStopsNewAdRequests", "Consent revocation stops new ad requests."],
    ["noMoodCheckInPromptOrRequest", "No prompt/request in mood check-in."],
    ["noActiveFocusPromptOrRequest", "No prompt/request during active focus."],
    ["noFocusReflectionPromptOrRequest", "No prompt/request in focus reflection."],
    ["noJournalEditorPromptOrRequest", "No prompt/request in journal editor."],
    ["noOnboardingPromptOrRequest", "No prompt/request during onboarding."],
    ["noBadOrTerribleMoodPromptOrRequest", "No prompt/request for bad or terrible mood states."],
  ],
  full_cross_platform_ad_units: [
    ["androidOwnerControlledNonSample", "Android IDs are owner-controlled and non-sample."],
    ["iosOwnerControlledNonSample", "iOS IDs are owner-controlled and non-sample."],
    ["bannerOwnerControlledNonSample", "Banner IDs are owner-controlled and non-sample."],
    ["rewardedOwnerControlledNonSample", "Rewarded IDs are owner-controlled and non-sample."],
    ["samePublisherFamily", "All ad units belong to the same publisher family as app-ads.txt."],
  ],
});
function usage() {
  return [
    "Usage: node scripts/generate-admob-owner-next-steps.cjs [--file docs/release/google-play/ADMOB_EXTERNAL_READINESS.json] [--out output/private/admob-owner-next-steps.md] [--date YYYY-MM-DD] [--require-support-ready]",
    "",
    "Builds a public-safe owner action packet from ADMOB_EXTERNAL_READINESS.json.",
    "The packet deliberately refuses support-ready mode while owner-only blockers remain.",
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    ledgerFile: DEFAULT_LEDGER,
    outFile: DEFAULT_OUT,
    date: null,
    requireSupportReady: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--file") {
      args.ledgerFile = resolveInsideRepo(argv[++index], "--file");
    } else if (arg === "--out") {
      args.outFile = resolveInsideRepo(argv[++index], "--out");
    } else if (arg === "--date") {
      args.date = argv[++index];
    } else if (arg === "--require-support-ready") {
      args.requireSupportReady = true;
    } else {
      throw new Error(`Unknown argument ${arg}`);
    }
  }

  if (args.date && !/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
    throw new Error("--date must be YYYY-MM-DD");
  }
  return args;
}

function resolveInsideRepo(value, label) {
  if (!value) throw new Error(`${label} needs a path`);
  const resolved = path.resolve(ROOT, value);
  const relative = path.relative(ROOT, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} must stay inside the repository`);
  }
  return resolved;
}

function readLedger(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`${path.relative(ROOT, file)} is missing`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function dateForReport(date) {
  if (!date) return new Date();
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error("--date must be YYYY-MM-DD");
  return parsed;
}

function itemMap(items) {
  return new Map(items.map((item) => [item.id, item]));
}

function rowsFor(ids, byId) {
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

function nonPassRows(rows) {
  return rows.filter((item) => item.status !== "PASS");
}

function markdownCell(value) {
  return String(value || "")
    .replaceAll("|", "\\|")
    .replaceAll("\n", "<br>");
}

function sourceLinks(item) {
  return item.sourceUrls.map((url) => `[source](${url})`).join("<br>");
}

function statusLine(ready) {
  return ready ? "PASS" : "UNVERIFIED";
}

function evaluateSupportReadiness(report) {
  const byId = itemMap(report.items);
  const currentRows = rowsFor(CURRENT_ANDROID_REWARDED_READINESS_IDS, byId);
  const ownerBlockers = nonPassRows(currentRows).filter((item) => OWNER_ACTION_IDS.has(item.id));
  const serviceBlockers = nonPassRows(currentRows).filter((item) => GOOGLE_SERVICE_IDS.has(item.id));

  if (!report.ok) {
    return {
      supportStatus: "NOT READY",
      reason: "external readiness ledger is invalid or unsafe",
      ownerBlockers,
      serviceBlockers,
    };
  }

  if (ownerBlockers.length > 0) {
    return {
      supportStatus: "NOT READY",
      reason: "owner blockers remain",
      ownerBlockers,
      serviceBlockers,
    };
  }

  if (serviceBlockers.length > 0) {
    return {
      supportStatus: "READY IF GOOGLE STILL DISAGREES",
      reason: "owner blockers are closed but Google-owned status still disagrees",
      ownerBlockers,
      serviceBlockers,
    };
  }

  return {
    supportStatus: report.passReady ? "NOT NEEDED" : "NOT READY",
    reason: report.passReady ? "current Android rewarded gate is ready" : "current Android rewarded gate still has unresolved checks",
    ownerBlockers,
    serviceBlockers,
  };
}

function tableFor(items) {
  if (items.length === 0) return "_None._";
  const lines = ["| Row | Status | Owner action | Official sources |", "| --- | --- | --- | --- |"];
  for (const item of items) {
    lines.push(
      `| \`${markdownCell(item.id)}\` | ${markdownCell(item.status)} | ${markdownCell(item.ownerAction)} | ${sourceLinks(item)} |`,
    );
  }
  return lines.join("\n");
}

function uniqueRows(items) {
  const byId = new Map();
  for (const item of items) byId.set(item.id, item);
  return Array.from(byId.values());
}

function checklistFor(items) {
  const rows = uniqueRows(items).filter((item) => OWNER_FACT_LABELS_BY_ITEM[item.id]?.length > 0);
  if (rows.length === 0) return "_No public-safe owner evidence facts are pending._";

  const lines = [];
  for (const item of rows) {
    lines.push(`### \`${markdownCell(item.id)}\``, "");
    lines.push("Set `status` to `PASS` only when every fact below is true. PASS evidence must be affirmative, current, and non-conditional. If any required Google-supported language is unavailable, missing, not offered, or not reviewed, or if the Arabic/Hebrew fallback is not documented, or if the UI is unknown, negated, pending, or unclear, keep this row non-PASS (`PARTIAL`, `UNVERIFIED`, or `FAIL`).", "");
    for (const [factKey, label] of OWNER_FACT_LABELS_BY_ITEM[item.id]) {
      lines.push(`- \`${factKey}\`: ${label}`);
    }
    lines.push("", "Public-safe evidence: one sentence summarizing status only; no screenshots or pasted account, payment, tax, address, email, bank, or raw AdMob identifiers.", "");
  }
  return lines.join("\n");
}
function buildOwnerNextStepsPacket(ledger, options = {}) {
  const now = dateForReport(options.date);
  const generated = options.date || now.toISOString().slice(0, 10);
  const report = evaluateExternalReadiness(ledger, { now });
  const support = evaluateSupportReadiness(report);
  const byId = itemMap(report.items);
  const currentRows = rowsFor(CURRENT_ANDROID_REWARDED_READINESS_IDS, byId);
  const fullRows = rowsFor(FULL_CROSS_PLATFORM_READINESS_IDS, byId);
  const currentBlockers = nonPassRows(currentRows);
  const fullBlockers = nonPassRows(fullRows);
  const currentStatus = statusLine(report.ok && report.passReady);
  const fullStatus = statusLine(report.ok && report.fullCrossPlatformReady);
  const ownerRows = currentBlockers.filter((item) => OWNER_ACTION_IDS.has(item.id));
  const serviceRows = currentBlockers.filter((item) => GOOGLE_SERVICE_IDS.has(item.id));
  const futureRows = fullBlockers.filter((item) => !CURRENT_ANDROID_REWARDED_READINESS_IDS.includes(item.id));
  const checklistRows = uniqueRows([...ownerRows, ...serviceRows, ...futureRows]);

  const unsafeIssues = report.issues.map((itemIssue) => {
    const item = itemIssue.itemId ? ` item=${itemIssue.itemId}` : "";
    return `- \`${itemIssue.code}\`${item}: ${itemIssue.message}`;
  });

  return [
    "# ZenFlow AdMob Owner Next Steps",
    "",
    `Generated: ${generated}`,
    "Source ledger: `docs/release/google-play/ADMOB_EXTERNAL_READINESS.json`",
    "",
    `Current Android rewarded monetization: ${currentStatus}`,
    `Full cross-platform monetization: ${fullStatus}`,
    "",
    "## Support Escalation Status",
    "",
    `Support escalation: ${support.supportStatus}`,
    support.supportStatus === "NOT READY"
      ? "Do not contact AdMob support yet. Resolve the owner-owned blockers below, then rerun the strict pass gate."
      : "Support can be used only if the owner-owned blockers are closed and Google's console still disagrees with the public-safe evidence.",
    "",
    `Reason: ${support.reason}.`,
    "",
    "## Owner-owned Current Blockers",
    "",
    tableFor(ownerRows),
    "",
    "## Google-owned Current Blockers",
    "",
    serviceRows.length > 0
      ? tableFor(serviceRows)
      : "_None in the current ledger. Recheck these rows before escalating because Google crawler and policy states can change._",
    "",
    "## Future Expansion Blockers",
    "",
    futureRows.length > 0
      ? tableFor(futureRows)
      : "_None. Current Android rewarded readiness and full cross-platform readiness now match._",
    "",
    "## Public-Safe Owner Evidence Checklist",
    "",
    checklistFor(checklistRows),
    "",
    "## Safe Workflow",
    "",
    "```bash",
    "npm run google-play:admob:owner-evidence:prepare",
    "node scripts/check-admob-owner-evidence.cjs --file output/private/admob-owner-evidence.json",
    "npm run google-play:admob:owner-evidence:apply -- --file output/private/admob-owner-evidence.json",
    "npm run google-play:admob:external-check",
    "npm run google-play:admob:external-check:pass",
    "npm run google-play:admob:owner-next-steps -- --require-support-ready",
    "```",
    "",
    "## Evidence Safety",
    "",
    "- Keep `output/private/admob-owner-evidence.json` untracked.",
    "- Record only PASS, PARTIAL, UNVERIFIED, or FAIL summaries and boolean facts.",
    "- Do not paste payment, tax, identity, address, email, bank, or raw AdMob identifiers into public files.",
    "- Do not run live rewarded playback inside Settings or Privacy; use only the separately approved optional rewards surface after CMP and Play Console declarations are closed.",
    "",
    report.ok ? "## Ledger Validation\n\nSource ledger validation: STRUCTURALLY_VALID. This only means the ledger is public-safe and structurally valid; it does not mean monetization is ready." : "## Ledger Validation\n\nSource ledger validation: UNVERIFIED. The source ledger has validation issues.",
    "",
    unsafeIssues.length > 0 ? unsafeIssues.join("\n") : "_No ledger validation issues._",
    "",
  ].join("\n");
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.log(`[admob-owner-next-steps] UNVERIFIED - ${error.message}`);
    console.log(usage());
    process.exit(2);
  }

  if (args.help) {
    console.log(usage());
    return;
  }

  let ledger;
  let report;
  let packet;
  try {
    ledger = readLedger(args.ledgerFile);
    const now = dateForReport(args.date);
    report = evaluateExternalReadiness(ledger, { now });
    packet = buildOwnerNextStepsPacket(ledger, { date: args.date });
  } catch (error) {
    console.log(`[admob-owner-next-steps] UNVERIFIED - ${error.message}`);
    process.exit(2);
  }

  if (!report.ok) {
    console.log("[admob-owner-next-steps] UNVERIFIED - external readiness ledger is not public-safe enough for an owner packet");
    for (const itemIssue of report.issues) {
      console.log(`[admob-owner-next-steps] issue=${itemIssue.code}${itemIssue.itemId ? ` item=${itemIssue.itemId}` : ""} - ${itemIssue.message}`);
    }
    process.exit(2);
  }

  const support = evaluateSupportReadiness(report);
  fs.mkdirSync(path.dirname(args.outFile), { recursive: true });
  fs.writeFileSync(args.outFile, packet);

  if (args.requireSupportReady && support.supportStatus === "NOT READY") {
    const ownerIds = support.ownerBlockers.map((item) => item.id).join(", ");
    console.log(
      `[admob-owner-next-steps] UNVERIFIED - support escalation is not ready; owner blockers remain${ownerIds ? `: ${ownerIds}` : ""}`,
    );
    console.log(`[admob-owner-next-steps] wrote ${args.outFile}`);
    process.exit(2);
  }

  const readinessStatus = report.passReady ? "READY" : "UNVERIFIED";
  console.log(`[admob-owner-next-steps] WROTE - generated public-safe owner packet ${args.outFile}`);
  console.log(`[admob-owner-next-steps] readiness=${readinessStatus}`);
  console.log(`[admob-owner-next-steps] support=${support.supportStatus.replaceAll(" ", "_")}`);
}

if (require.main === module) main();

module.exports = {
  buildOwnerNextStepsPacket,
  evaluateSupportReadiness,
};
