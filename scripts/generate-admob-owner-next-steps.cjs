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
    report.ok ? "## Ledger Validation\n\nPASS: The source ledger is public-safe and structurally valid." : "## Ledger Validation\n\nUNVERIFIED: The source ledger has validation issues.",
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

  console.log(`[admob-owner-next-steps] PASS - wrote ${args.outFile}`);
  console.log(`[admob-owner-next-steps] support=${support.supportStatus.replaceAll(" ", "_")}`);
}

if (require.main === module) main();

module.exports = {
  buildOwnerNextStepsPacket,
  evaluateSupportReadiness,
};
