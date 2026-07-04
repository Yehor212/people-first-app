#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const {
  evaluateOwnerEvidence,
  OWNER_EVIDENCE_ITEM_IDS,
} = require("./check-admob-owner-evidence.cjs");
const {
  evaluateExternalReadiness,
} = require("./check-admob-external-readiness.cjs");

const ROOT = path.join(__dirname, "..");
const DEFAULT_LEDGER = path.join(ROOT, "docs", "release", "google-play", "ADMOB_EXTERNAL_READINESS.json");
const CANONICAL_LEDGER_RELATIVE = "docs/release/google-play/ADMOB_EXTERNAL_READINESS.json";
const CANONICAL_LEDGER_TEMP_RELATIVE = "docs/release/google-play/.ADMOB_EXTERNAL_READINESS.json.tmp";
const DEFAULT_MAX_PASS_AGE_DAYS = 14;

function usage() {
  return [
    "Usage:",
    "  node scripts/apply-admob-owner-evidence.cjs --file output/private/admob-owner-evidence.json [--ledger docs/release/google-play/ADMOB_EXTERNAL_READINESS.json] [--date YYYY-MM-DD] [--write]",
    "",
    "Default mode is DRY-RUN. Use --write only after reviewing the public-safe diff.",
  ].join("\n");
}

function issue(code, message, itemId) {
  return itemId ? { code, itemId, message } : { code, message };
}

function parseArgs(argv) {
  const args = {
    evidenceFile: null,
    ledgerFile: null,
    write: false,
    date: null,
    maxPassAgeDays: DEFAULT_MAX_PASS_AGE_DAYS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--file") args.evidenceFile = resolveRepoPath(argv[++index] || "", "--file");
    else if (arg === "--ledger") args.ledgerFile = resolveRepoPath(argv[++index] || "", "--ledger");
    else if (arg === "--write") args.write = true;
    else if (arg === "--date") args.date = argv[++index] || "";
    else if (arg === "--max-pass-age-days") args.maxPassAgeDays = Number(argv[++index]);
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function resolveRepoPath(value, label) {
  const resolved = path.resolve(ROOT, value);
  const relative = path.relative(ROOT, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} must point inside the repository`);
  }
  return resolved;
}

function readJson(file) {
  if (!file || !fs.existsSync(file)) {
    throw new Error(`${path.relative(ROOT, file || "") || "file"} is missing`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function isCanonicalLedger(file) {
  return path.resolve(file) === DEFAULT_LEDGER;
}

function writeCanonicalLedger(ledger, options = {}) {
  const fsApi = options.fsApi || fs;
  const getCwd = options.getCwd || (() => process.cwd());
  const chdir = options.chdir || ((target) => process.chdir(target));
  const previousCwd = getCwd();
  chdir(ROOT);
  try {
    fsApi.writeFileSync(CANONICAL_LEDGER_TEMP_RELATIVE, `${JSON.stringify(ledger, null, 2)}\n`, { mode: 0o600 });
    const readBack = JSON.parse(fsApi.readFileSync(CANONICAL_LEDGER_TEMP_RELATIVE, "utf8"));
    const report = evaluateExternalReadiness(readBack, { requirePass: false });
    if (!report.ok) {
      throw new Error(`Refusing to replace canonical ledger with invalid JSON: ${report.issues.map((itemIssue) => itemIssue.code).join(", ")}`);
    }
    fsApi.renameSync(CANONICAL_LEDGER_TEMP_RELATIVE, CANONICAL_LEDGER_RELATIVE);
  } finally {
    if (typeof fsApi.existsSync === "function" && fsApi.existsSync(CANONICAL_LEDGER_TEMP_RELATIVE)) {
      fsApi.rmSync(CANONICAL_LEDGER_TEMP_RELATIVE, { force: true });
    }
    chdir(previousCwd);
  }
}

function parseDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (Number.isNaN(timestamp)) return null;
  return new Date(timestamp);
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function passEvidenceAgeDays(item, now) {
  const checkedAt = parseDate(item.checkedAt);
  if (!checkedAt) return null;
  return Math.floor((now.getTime() - checkedAt.getTime()) / (24 * 60 * 60 * 1000));
}

function findStalePassIssues(ownerEvidence, now, maxPassAgeDays) {
  const issues = [];
  const items = Array.isArray(ownerEvidence?.items) ? ownerEvidence.items : [];

  for (const item of items) {
    if (item?.status !== "PASS") continue;
    const ageDays = passEvidenceAgeDays(item, now);
    if (ageDays === null) {
      issues.push(issue("missing_checked_at", `${item.id || "unknown"} PASS evidence needs checkedAt as YYYY-MM-DD`, item.id));
    } else if (ageDays < 0) {
      issues.push(issue("future_pass_evidence", `${item.id} PASS evidence checkedAt is in the future`, item.id));
    } else if (ageDays > maxPassAgeDays) {
      issues.push(issue("stale_pass_evidence", `${item.id} PASS evidence is ${ageDays} days old; max is ${maxPassAgeDays}`, item.id));
    }
  }

  return issues;
}

function ownerItemsById(ownerEvidence) {
  return new Map((ownerEvidence.items || []).map((item) => [item.id, item]));
}

function ownerItemStatus(ownerEvidence, itemId) {
  return ownerItemsById(ownerEvidence).get(itemId)?.status;
}

function runFullCrossPlatformGate() {
  return spawnSync("npm", ["run", "google-play:admob:check:full"], {
    cwd: ROOT,
    encoding: "utf8",
  });
}

function applyOwnerEvidenceToLedger(ledger, ownerEvidence, updatedAt) {
  const ownerIds = new Set(OWNER_EVIDENCE_ITEM_IDS);
  const ownerItems = ownerItemsById(ownerEvidence);

  return {
    ...ledger,
    updatedAt,
    items: ledger.items.map((item) => {
      if (!ownerIds.has(item.id) || !ownerItems.has(item.id)) return item;
      const ownerItem = ownerItems.get(item.id);
      return {
        ...item,
        status: ownerItem.status,
        checkedAt: ownerItem.checkedAt,
        evidence: ownerItem.evidence,
        sourceUrls: ownerItem.sourceUrls,
      };
    }),
  };
}

function printIssues(scope, issues) {
  for (const itemIssue of issues) {
    console.log(`[admob-owner-evidence-apply] issue=${itemIssue.code}${itemIssue.itemId ? ` item=${itemIssue.itemId}` : ""} scope=${scope} - ${itemIssue.message}`);
  }
}

function summarizeChanges(beforeLedger, afterLedger) {
  const beforeById = new Map(beforeLedger.items.map((item) => [item.id, item]));
  return afterLedger.items
    .filter((item) => {
      const before = beforeById.get(item.id);
      return before && (
        before.status !== item.status ||
        before.checkedAt !== item.checkedAt ||
        before.evidence !== item.evidence ||
        JSON.stringify(before.sourceUrls) !== JSON.stringify(item.sourceUrls)
      );
    })
    .map((item) => `${item.id}:${beforeById.get(item.id).status}->${item.status}`);
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.log(`[admob-owner-evidence-apply] UNVERIFIED - ${error.message}`);
    console.log(usage());
    process.exit(2);
  }

  if (args.help) {
    console.log(usage());
    process.exit(0);
  }
  if (!args.evidenceFile) {
    console.log("[admob-owner-evidence-apply] UNVERIFIED - --file output/private/admob-owner-evidence.json is required");
    console.log(usage());
    process.exit(2);
  }
  if (!Number.isFinite(args.maxPassAgeDays) || args.maxPassAgeDays < 0) {
    console.log("[admob-owner-evidence-apply] UNVERIFIED - --max-pass-age-days must be a non-negative number");
    process.exit(2);
  }

  let ownerEvidence;
  let ledger;
  const ledgerFile = args.ledgerFile || DEFAULT_LEDGER;
  try {
    ownerEvidence = readJson(args.evidenceFile);
    ledger = readJson(ledgerFile);
  } catch (error) {
    console.log(`[admob-owner-evidence-apply] UNVERIFIED - ${error.message}`);
    process.exit(2);
  }

  const requestedDate = args.date ? parseDate(args.date) : new Date();
  if (!requestedDate) {
    console.log("[admob-owner-evidence-apply] UNVERIFIED - --date must be YYYY-MM-DD when provided");
    process.exit(2);
  }
  const updatedAt = formatDate(requestedDate);

  const ownerReport = evaluateOwnerEvidence(ownerEvidence, {
    requirePass: false,
    now: requestedDate,
    maxPassAgeDays: args.maxPassAgeDays,
  });
  const staleIssues = findStalePassIssues(ownerEvidence, requestedDate, args.maxPassAgeDays);
  if (!ownerReport.ok || staleIssues.length > 0) {
    console.log("[admob-owner-evidence-apply] UNVERIFIED - owner evidence is not public-safe or fresh enough to apply");
    printIssues("owner", ownerReport.issues);
    printIssues("owner", staleIssues);
    process.exit(2);
  }

  if (ownerItemStatus(ownerEvidence, "full_cross_platform_ad_units") === "PASS") {
    const fullGate = runFullCrossPlatformGate();
    if (fullGate.status !== 0) {
      console.log("[admob-owner-evidence-apply] UNVERIFIED - full cross-platform monetization PASS requires google-play:admob:check:full to pass in this run");
      printIssues("owner", [issue("full_cross_platform_gate_not_pass", "full_cross_platform_ad_units cannot be promoted to PASS until npm run google-play:admob:check:full exits 0", "full_cross_platform_ad_units")]);
      process.exit(2);
    }
  }

  const currentLedgerReport = evaluateExternalReadiness(ledger, {
    requirePass: false,
    now: requestedDate,
    maxPassAgeDays: args.maxPassAgeDays,
  });
  if (!currentLedgerReport.ok) {
    console.log("[admob-owner-evidence-apply] UNVERIFIED - current external readiness ledger is invalid before apply");
    printIssues("current-ledger", currentLedgerReport.issues);
    process.exit(2);
  }

  const nextLedger = applyOwnerEvidenceToLedger(ledger, ownerEvidence, updatedAt);
  const nextLedgerReport = evaluateExternalReadiness(nextLedger, {
    requirePass: false,
    now: requestedDate,
    maxPassAgeDays: args.maxPassAgeDays,
  });
  if (!nextLedgerReport.ok) {
    console.log("[admob-owner-evidence-apply] UNVERIFIED - proposed external readiness ledger is invalid after apply");
    printIssues("proposed-ledger", nextLedgerReport.issues);
    process.exit(2);
  }

  const changes = summarizeChanges(ledger, nextLedger);
  const mode = args.write ? "WRITE" : "DRY-RUN";
  console.log(`[admob-owner-evidence-apply] ${mode} - ${changes.length} owner-owned ledger row(s) would change`);
  for (const change of changes) console.log(`[admob-owner-evidence-apply] change=${change}`);

  if (args.write) {
    if (!isCanonicalLedger(ledgerFile)) {
      console.log("[admob-owner-evidence-apply] UNVERIFIED - --write is allowed only for the canonical ADMOB_EXTERNAL_READINESS.json ledger");
      process.exit(2);
    }
    writeCanonicalLedger(nextLedger);
  }

  process.exit(0);
}

if (require.main === module) main();

module.exports = {
  applyOwnerEvidenceToLedger,
  findStalePassIssues,
  writeCanonicalLedger,
};
