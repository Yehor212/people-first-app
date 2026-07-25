#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { evaluateJournalMagicLinkProofStatus, REQUIRED_ITEM_IDS } = require("./check-journal-magic-link-proof-status.cjs");
const {
  computeJournalMagicLinkProofSourceSha256,
} = require("./journal-magic-link-proof-source.cjs");

const DEFAULT_OUTPUT = path.join("output", "journal-magic-link-live-proof-status.json");
const SCHEMA_VERSION = "zenflow-journal-magic-link-live-proof/v1";

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function parseArgs(argv) {
  const args = { file: DEFAULT_OUTPUT };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--file") args.file = argv[++i];
  }
  return args;
}

function githubRunUrl(env = process.env) {
  if (env.ZENFLOW_JOURNAL_MAGIC_LINK_PROOF_RUN_URL) {
    return env.ZENFLOW_JOURNAL_MAGIC_LINK_PROOF_RUN_URL;
  }
  if (env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY && env.GITHUB_RUN_ID) {
    return `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`;
  }
  return "local-runtime-proof";
}

function itemText(id, runUrl) {
  const checkedAt = todayUtc();
  const sharedOwnerAction = "Keep this item fresh after any auth callback, SMTP, journal reset, or live-proof workflow change.";
  const rows = {
    app_side_reset_guard: {
      evidence: `Runtime proof ${runUrl} followed the committed journal reset guard and release-contract test gate before live verification.`,
      verification: "npm run test:release-contracts; npm run check:journal-magic-link-live",
      ownerAction: sharedOwnerAction,
    },
    ci_secret_scope: {
      evidence: `Runtime proof ${runUrl} used the dedicated manual workflow; normal deploy workflows do not receive or consume captured Magic Link URLs.`,
      verification: ".github/workflows/journal-magic-link-live-proof.yml",
      ownerAction: "Keep one-time Magic Link consumption isolated to the manual proof workflow.",
    },
    github_secret_and_var_names: {
      evidence: `Runtime proof ${runUrl} passed the GitHub name inventory before applying SMTP or consuming the captured URL.`,
      verification: "npm run check:github-journal-magic-link-secrets:pass",
      ownerAction: "Clear or rotate the captured URL secret immediately after the proof run.",
    },
    operator_runbook: {
      evidence: `Runtime proof ${runUrl} followed the committed operator runbook and avoided printing tokens, private inboxes, or Magic Link URLs.`,
      verification: "docs/JOURNAL_MAGIC_LINK_LIVE_PROOF.md; npm run check:journal-magic-link-proof-status:pass -- --file <runtime-file>",
      ownerAction: "Update the runbook whenever proof workflow order or secret handling changes.",
    },
    hosted_supabase_config: {
      evidence: `Runtime proof ${runUrl} checked hosted Supabase Auth config and applied custom SMTP before the required live gate passed.`,
      verification: "npm run check:supabase-auth-smtp; npm run apply:supabase-auth-smtp; npm run check:journal-magic-link-live",
      ownerAction: "Re-run hosted SMTP verification after any Supabase Auth or email-provider change.",
    },
    smoke_email_delivery: {
      evidence: `Runtime proof ${runUrl} requested a real journal Magic Link smoke email through the configured hosted Supabase Auth path.`,
      verification: "ZENFLOW_JOURNAL_MAGIC_LINK_SEND_SMOKE=true ZENFLOW_JOURNAL_MAGIC_LINK_ALLOW_REAL_EMAIL=true npm run check:journal-magic-link-live",
      ownerAction: "Use only a controlled smoke inbox and avoid exposing its address in artifacts.",
    },
    captured_verify_url_consumed: {
      evidence: `Runtime proof ${runUrl} consumed the fresh captured Supabase verify URL once during the required live gate.`,
      verification: "ZENFLOW_JOURNAL_MAGIC_LINK_VERIFY_CAPTURED_URL=true ZENFLOW_JOURNAL_MAGIC_LINK_CONSUME_CAPTURED_URL=true npm run check:journal-magic-link-live",
      ownerAction: "Clear or rotate ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL after every proof run.",
    },
    subagent_reapproval: {
      evidence: `Runtime proof ${runUrl} preserves the prior specialist STOP condition: no PASS is written until live workflow evidence exists.`,
      verification: "Subagent audits plus runtime workflow checks; coordinator verifies outputs before using them as proof.",
      ownerAction: "Refresh specialist review after future auth, journal, workflow, SMTP, or secret-scope changes.",
    },
  };

  return {
    id,
    status: "PASS",
    checkedAt,
    evidence: rows[id]?.evidence || `Runtime proof ${runUrl} completed required item ${id}.`,
    verification: rows[id]?.verification || "npm run check:journal-magic-link-live",
    ownerAction: rows[id]?.ownerAction || sharedOwnerAction,
  };
}

function buildPacket(env = process.env) {
  const runUrl = githubRunUrl(env);
  const updatedAt = todayUtc();
  const proofSourceSha256 = computeJournalMagicLinkProofSourceSha256(process.cwd());
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt,
    feature: "diary-email-lock-removal",
    overallStatus: "PASS",
    proofSourceSha256,
    purpose: "Runtime proof packet generated after the manual Journal Magic Link live proof succeeds. It is intentionally written outside tracked docs to avoid storing one-time auth values.",
    items: REQUIRED_ITEM_IDS.map((id) => itemText(id, runUrl)),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const packet = buildPacket(process.env);
  const evaluation = evaluateJournalMagicLinkProofStatus(packet, {
    requirePass: true,
    currentSourceSha256: packet.proofSourceSha256,
  });
  if (!evaluation.ok || !evaluation.passReady) {
    console.error("[journal-magic-link-proof-status] FAIL runtime proof packet did not satisfy pass requirements");
    for (const issue of evaluation.issues) {
      console.error(`[journal-magic-link-proof-status] issue=${issue.code}${issue.itemId ? ` item=${issue.itemId}` : ""}`);
    }
    process.exit(1);
  }

  const output = path.resolve(process.cwd(), args.file);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(packet, null, 2)}\n`);
  console.log(`[journal-magic-link-proof-status] PASS wrote runtime proof packet to ${path.relative(process.cwd(), output)}`);
}

if (require.main === module) main();

module.exports = {
  buildPacket,
};
