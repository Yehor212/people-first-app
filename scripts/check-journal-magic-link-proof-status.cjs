#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  computeJournalMagicLinkProofSourceSha256,
} = require("./journal-magic-link-proof-source.cjs");

const ROOT = path.join(__dirname, "..");
const DEFAULT_PACKET = path.join(ROOT, "docs", "JOURNAL_MAGIC_LINK_LIVE_PROOF_STATUS.json");
const SCHEMA_VERSION = "zenflow-journal-magic-link-live-proof/v1";
const VALID_STATUSES = new Set(["PASS", "UNVERIFIED", "FAIL"]);
const DEFAULT_MAX_PASS_AGE_DAYS = 14;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const REQUIRED_ITEM_IDS = [
  "app_side_reset_guard",
  "ci_secret_scope",
  "github_secret_and_var_names",
  "operator_runbook",
  "hosted_supabase_config",
  "smoke_email_delivery",
  "captured_verify_url_consumed",
  "subagent_reapproval",
];

const SECRET_PATTERNS = [
  { code: "access_token", regex: /\baccess_token=[A-Za-z0-9._-]+/i },
  { code: "refresh_token", regex: /\brefresh_token=[A-Za-z0-9._-]+/i },
  { code: "supabase_access_token", regex: /\bsbp_[A-Za-z0-9._-]{12,}\b/i },
  { code: "magic_link_token", regex: /[?&]token(?:_hash)?=(?!redacted\b|secret\b|set-in-shell-only\b)[A-Za-z0-9._-]+/i },
  { code: "private_email", regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i },
];

function issue(code, message, itemId) {
  return itemId ? { code, itemId, message } : { code, message };
}

function stringifyForScan(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function parseDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function evidenceAgeDays(item, now) {
  const checkedAt = parseDate(item.checkedAt);
  if (checkedAt === null) return null;
  return Math.floor((now.getTime() - checkedAt) / (24 * 60 * 60 * 1000));
}

function normalizeItems(packet, issues) {
  if (!Array.isArray(packet?.items)) {
    issues.push(issue("missing_items", "Journal Magic Link proof status must include an items array"));
    return [];
  }

  return packet.items.map((item) => ({
    ...item,
    id: typeof item?.id === "string" ? item.id.trim() : "",
    status: typeof item?.status === "string" ? item.status.trim().toUpperCase() : "",
  }));
}

function evaluateJournalMagicLinkProofStatus(input, options = {}) {
  const requirePass = options.requirePass === true;
  const now = options.now instanceof Date ? options.now : new Date();
  const maxPassAgeDays = Number.isFinite(options.maxPassAgeDays)
    ? Number(options.maxPassAgeDays)
    : DEFAULT_MAX_PASS_AGE_DAYS;
  const issues = [];

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      ok: false,
      passReady: false,
      issues: [issue("invalid_packet", "Journal Magic Link proof status must be a JSON object")],
      items: [],
    };
  }

  if (input.schemaVersion !== SCHEMA_VERSION) {
    issues.push(issue("invalid_schema_version", `Journal Magic Link proof status must use ${SCHEMA_VERSION}`));
  }
  if (input.feature !== "diary-email-lock-removal") {
    issues.push(issue("invalid_feature", "Journal Magic Link proof status must target diary-email-lock-removal"));
  }
  if (!VALID_STATUSES.has(String(input.overallStatus || "").toUpperCase())) {
    issues.push(issue("invalid_overall_status", "overallStatus must be PASS, UNVERIFIED, or FAIL"));
  }
  if (parseDate(input.updatedAt) === null) {
    issues.push(issue("invalid_updated_at", "updatedAt must be YYYY-MM-DD"));
  }
  const proofSourceSha256 =
    typeof input.proofSourceSha256 === "string" ? input.proofSourceSha256.trim() : "";
  if (!SHA256_PATTERN.test(proofSourceSha256)) {
    issues.push(issue(
      "missing_proof_source_sha256",
      "Journal Magic Link proof status must include the reviewed source SHA-256",
    ));
  }
  const currentSourceSha256 =
    typeof options.currentSourceSha256 === "string"
      ? options.currentSourceSha256.trim()
      : "";
  if (currentSourceSha256 && !SHA256_PATTERN.test(currentSourceSha256)) {
    issues.push(issue(
      "invalid_current_source_sha256",
      "Current Journal Magic Link proof source SHA-256 is invalid",
    ));
  } else if (
    SHA256_PATTERN.test(proofSourceSha256) &&
    SHA256_PATTERN.test(currentSourceSha256) &&
    proofSourceSha256 !== currentSourceSha256
  ) {
    issues.push(issue(
      "proof_source_mismatch",
      "Journal Magic Link proof was produced for different auth or recovery source",
    ));
  }

  const text = stringifyForScan(input);
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.regex.test(text)) {
      issues.push(issue("secret_or_private_value", `Proof status must not contain ${pattern.code}`));
    }
  }

  const items = normalizeItems(input, issues);
  const byId = new Map();
  for (const item of items) {
    if (!item.id) {
      issues.push(issue("missing_item_id", "Every proof status item needs an id"));
      continue;
    }
    if (byId.has(item.id)) {
      issues.push(issue("duplicate_item_id", `Duplicate proof status item ${item.id}`, item.id));
    }
    byId.set(item.id, item);

    if (!VALID_STATUSES.has(item.status)) {
      issues.push(issue("invalid_item_status", `${item.id} must use PASS, UNVERIFIED, or FAIL`, item.id));
    }
    if (typeof item.evidence !== "string" || item.evidence.trim().length < 16) {
      issues.push(issue("missing_item_evidence", `${item.id} needs concrete evidence text`, item.id));
    }
    if (typeof item.verification !== "string" || item.verification.trim().length < 8) {
      issues.push(issue("missing_item_verification", `${item.id} needs a verification command or proof path`, item.id));
    }
    if (typeof item.ownerAction !== "string" || item.ownerAction.trim().length < 8) {
      issues.push(issue("missing_owner_action", `${item.id} needs an owner action`, item.id));
    }
    if (item.status === "PASS") {
      const ageDays = evidenceAgeDays(item, now);
      if (ageDays === null) {
        issues.push(issue("missing_checked_at", `${item.id} PASS evidence needs checkedAt as YYYY-MM-DD`, item.id));
      } else if (requirePass && ageDays < 0) {
        issues.push(issue("future_pass_evidence", `${item.id} PASS evidence checkedAt is in the future`, item.id));
      } else if (requirePass && ageDays > maxPassAgeDays) {
        issues.push(issue("stale_pass_evidence", `${item.id} PASS evidence is ${ageDays} days old; max is ${maxPassAgeDays}`, item.id));
      }
    }
    if (item.status === "UNVERIFIED" && item.checkedAt) {
      issues.push(issue("unverified_checked_at", `${item.id} must not look like fresh PASS evidence while still UNVERIFIED`, item.id));
    }
  }

  for (const requiredId of REQUIRED_ITEM_IDS) {
    const item = byId.get(requiredId);
    if (!item) {
      issues.push(issue("missing_required_item", `Missing required proof status item ${requiredId}`, requiredId));
      continue;
    }
    if (requirePass && item.status !== "PASS") {
      issues.push(issue("required_item_not_pass", `${requiredId} is ${item.status}, not PASS`, requiredId));
    }
  }

  const requiredItems = REQUIRED_ITEM_IDS.map((id) => byId.get(id)).filter(Boolean);
  const requiredItemsPass =
    requiredItems.length === REQUIRED_ITEM_IDS.length &&
    requiredItems.every((item) => item.status === "PASS");
  const passReady = requiredItemsPass && issues.length === 0;
  const normalizedOverallStatus = String(input.overallStatus || "").toUpperCase();

  if (!requiredItemsPass && normalizedOverallStatus === "PASS") {
    issues.push(issue("premature_overall_pass", "overallStatus cannot be PASS while any required proof item is not PASS"));
  }
  if (passReady && normalizedOverallStatus !== "PASS") {
    issues.push(issue("missing_overall_pass", "overallStatus should be PASS when every required proof item is PASS"));
  }

  return {
    ok: issues.length === 0,
    passReady: passReady && normalizedOverallStatus === "PASS",
    issues,
    items,
  };
}

function parseArgs(argv) {
  const args = { file: DEFAULT_PACKET, requirePass: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--file") args.file = path.resolve(ROOT, argv[++i]);
    else if (arg === "--require-pass") args.requirePass = true;
  }
  return args;
}

function readPacket(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`${path.relative(ROOT, file)} is missing`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  let report;
  try {
    report = evaluateJournalMagicLinkProofStatus(readPacket(args.file), {
      requirePass: args.requirePass,
      currentSourceSha256: computeJournalMagicLinkProofSourceSha256(ROOT),
    });
  } catch (error) {
    console.log(`[journal-magic-link-proof-status] UNVERIFIED - ${error.message}`);
    process.exit(2);
  }

  const status = report.passReady && report.ok ? "PASS" : "UNVERIFIED";
  console.log(
    `[journal-magic-link-proof-status] ${status} - journal Magic Link proof ${report.passReady ? "is complete" : "still has unresolved checks"}`,
  );
  for (const item of report.items) {
    if (REQUIRED_ITEM_IDS.includes(item.id)) {
      console.log(`[journal-magic-link-proof-status] ${item.id}=${item.status}`);
    }
  }
  for (const itemIssue of report.issues) {
    console.log(
      `[journal-magic-link-proof-status] issue=${itemIssue.code}${itemIssue.itemId ? ` item=${itemIssue.itemId}` : ""} - ${itemIssue.message}`,
    );
  }

  process.exit(report.ok && (!args.requirePass || report.passReady) ? 0 : 2);
}

if (require.main === module) main();

module.exports = {
  evaluateJournalMagicLinkProofStatus,
  REQUIRED_ITEM_IDS,
};
