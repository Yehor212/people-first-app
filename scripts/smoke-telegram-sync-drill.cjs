#!/usr/bin/env node
"use strict";

/**
 * Telegram-grade sync drill.
 *
 * This command is a release-proof orchestrator, not a new sync engine. It
 * gathers the local invariants, targeted tests, browser diagnostics, and
 * optional live-account proof into one honest status so PARTIAL/UNVERIFIED
 * cannot be reported as PASS.
 */

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const OUTPUT_PATH = process.env.ZENFLOW_TELEGRAM_SYNC_DRILL_OUTPUT || "";
const REQUIRED = process.env.ZENFLOW_TELEGRAM_SYNC_DRILL_REQUIRED === "true";
const SYNC_DRILL_URL = process.env.ZENFLOW_SYNC_DRILL_URL || "";
const MAX_BUFFER = 1024 * 1024 * 20;

const TARGETED_SYNC_TESTS = [
  "src/storage/__tests__/eventSync.test.ts",
  "src/storage/__tests__/initialDeltaSync.test.ts",
  "src/hooks/__tests__/useDeltaSyncEffects.test.ts",
  "src/hooks/__tests__/useCloudSyncEffects.test.ts",
  "src/lib/__tests__/syncBroadcast.test.ts",
  "src/lib/__tests__/syncGapDetector.test.ts",
  "src/lib/__tests__/syncLeader.test.ts",
  "src/lib/__tests__/offlineQueueHandlers.test.ts",
  "src/features/journal/__tests__/journalDraftStorage.test.ts",
  "src/storage/__tests__/cloudSync.test.ts",
  "src/storage/sync/__tests__/syncHabits.delete.test.ts",
  "src/storage/sync/__tests__/syncSettings.test.ts",
  "src/storage/sync/__tests__/serverTombstones.test.ts",
  "src/components/sync/__tests__/SyncHealthCard.test.tsx",
  "src/components/sync/__tests__/DeviceSessionsCard.test.tsx",
];

const results = [];

function npmCommand(script, args = []) {
  const npmCli = findNpmCli();
  if (npmCli) {
    return {
      command: process.execPath,
      args: [npmCli, "run", script, ...(args.length > 0 ? ["--", ...args] : [])],
    };
  }

  return {
    command: process.platform === "win32" ? "npm.cmd" : "npm",
    args: ["run", script, ...(args.length > 0 ? ["--", ...args] : [])],
  };
}

function findNpmCli() {
  const envCli = process.env.npm_execpath || "";
  if (envCli.endsWith(".js") && fs.existsSync(envCli)) return envCli;

  const localNodeNpm = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
  if (fs.existsSync(localNodeNpm)) return localNodeNpm;

  return "";
}

function nodeCommand(script, env = {}) {
  return {
    command: process.execPath,
    args: [script],
    env,
  };
}

function printOutput(label, output) {
  const trimmed = String(output || "").trim();
  if (!trimmed) return;

  console.log(`[telegram-sync-drill:${label}] output`);
  console.log(trimmed);
}

function record(name, status, evidence) {
  results.push({ name, status, evidence });
  console.log(`[telegram-sync-drill] ${status} - ${name}: ${evidence}`);
}

function runCommand(name, commandSpec, classify = classifyByExitCode) {
  const startedAt = Date.now();
  const child = spawnSync(commandSpec.command, commandSpec.args, {
    cwd: ROOT,
    env: { ...process.env, ...(commandSpec.env || {}) },
    encoding: "utf8",
    maxBuffer: MAX_BUFFER,
  });
  const durationMs = Date.now() - startedAt;

  printOutput(name, child.stdout);
  printOutput(name, child.stderr);

  const spawnError = child.error ? `${child.error.code || "SPAWN_ERROR"}: ${child.error.message}` : "";
  printOutput(name, spawnError);

  const combinedOutput = [child.stdout, child.stderr, spawnError].filter(Boolean).join("\n");
  const classified = classify(child.status, combinedOutput, durationMs, child.error);
  record(name, classified.status, classified.evidence);
}

function classifyByExitCode(status, output, durationMs, error) {
  if (status === 0) {
    return { status: "PASS", evidence: `exit=0 durationMs=${durationMs}` };
  }

  if (isEnvironmentBlocker(output, error)) {
    return {
      status: "UNVERIFIED",
      evidence: `blocked by runtime/tooling: ${firstLine(output) || "spawn failed"} durationMs=${durationMs}`,
    };
  }

  return {
    status: "FAIL",
    evidence: `exit=${status ?? "signal"} durationMs=${durationMs} output=${firstLine(output)}`,
  };
}

function classifySyncHealth(status, output, durationMs, error) {
  if (status === 0 && output.includes("[sync-health] PASS")) {
    return { status: "PASS", evidence: `privacy-safe browser diagnostic passed durationMs=${durationMs}` };
  }
  if (status === 0 && output.includes("[sync-health] UNVERIFIED")) {
    return { status: "UNVERIFIED", evidence: firstLine(output) || `durationMs=${durationMs}` };
  }
  if (status === 2 && output.includes("[sync-health] UNVERIFIED")) {
    return { status: "UNVERIFIED", evidence: firstLine(output) || `required proof missing durationMs=${durationMs}` };
  }
  if (isEnvironmentBlocker(output, error)) {
    return {
      status: "UNVERIFIED",
      evidence: `browser proof blocked by runtime/tooling: ${firstLine(output) || "spawn failed"} durationMs=${durationMs}`,
    };
  }

  return {
    status: "FAIL",
    evidence: `sync-health exit=${status ?? "signal"} durationMs=${durationMs} output=${firstLine(output)}`,
  };
}

function classifySyncAccount(status, output, durationMs, error) {
  if (status === 0 && output.includes("[sync-account] PASS")) {
    return { status: "PASS", evidence: `same-account Supabase proof passed durationMs=${durationMs}` };
  }
  if (status === 0 && output.includes("[sync-account] UNVERIFIED")) {
    return { status: "UNVERIFIED", evidence: firstLine(output) || `durationMs=${durationMs}` };
  }
  if (status === 2 && output.includes("[sync-account] UNVERIFIED")) {
    return { status: "UNVERIFIED", evidence: firstLine(output) || `required proof missing durationMs=${durationMs}` };
  }
  if (isEnvironmentBlocker(output, error)) {
    return {
      status: "UNVERIFIED",
      evidence: `account proof blocked by runtime/tooling: ${firstLine(output) || "spawn failed"} durationMs=${durationMs}`,
    };
  }

  return {
    status: "FAIL",
    evidence: `sync-account exit=${status ?? "signal"} durationMs=${durationMs} output=${firstLine(output)}`,
  };
}

function isEnvironmentBlocker(output, error) {
  if (error) return true;
  return /spawn\s+\w+\s+EPERM|E_ACCESSDENIED|ENOENT|EACCES|browserType\.launch|Chromium.*(failed|could not|not found)/i.test(
    output || ""
  );
}

function firstLine(output) {
  return String(output || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)[0] || "";
}

function ensureTestFilesExist() {
  const missing = TARGETED_SYNC_TESTS.filter((file) => !fs.existsSync(path.join(ROOT, file)));
  if (missing.length > 0) {
    record("targeted sync test manifest", "FAIL", `missing test file(s): ${missing.join(", ")}`);
    return false;
  }

  record("targeted sync test manifest", "PASS", `${TARGETED_SYNC_TESTS.length} files exist`);
  return true;
}

function runLocalProof() {
  runCommand("sync contract", npmCommand("check:sync-contract"));

  if (ensureTestFilesExist()) {
    runCommand("targeted sync tests", npmCommand("test", TARGETED_SYNC_TESTS));
  }

  runCommand("canonical orb invariant", npmCommand("check:canonical-orbs"));
  runCommand("supabase migration prefixes", npmCommand("check:supabase-migration-prefixes"));
}

function runBrowserProof() {
  if (!SYNC_DRILL_URL) {
    record(
      "privacy-safe browser sync health",
      "UNVERIFIED",
      "ZENFLOW_SYNC_DRILL_URL is not set; run against a preview or public cache-busted URL"
    );
    return;
  }

  runCommand(
    "privacy-safe browser sync health",
    nodeCommand("scripts/smoke-sync-health.cjs", {
      ZENFLOW_SYNC_HEALTH_URL: SYNC_DRILL_URL,
      ZENFLOW_SYNC_HEALTH_REQUIRED: REQUIRED ? "true" : "false",
    }),
    classifySyncHealth
  );
}

function runAccountProof() {
  runCommand(
    "same-account Supabase sync",
    nodeCommand("scripts/smoke-sync-account.cjs", {
      ZENFLOW_SYNC_ACCOUNT_REQUIRED: REQUIRED ? "true" : "false",
    }),
    classifySyncAccount
  );
}

function summarize() {
  const hasFail = results.some((result) => result.status === "FAIL");
  const hasUnverified = results.some((result) => result.status === "UNVERIFIED");
  const overall = hasFail ? "FAIL" : hasUnverified ? "PARTIAL" : "PASS";

  const artifact = {
    generatedAt: new Date().toISOString(),
    required: REQUIRED,
    url: SYNC_DRILL_URL || null,
    overall,
    results,
  };

  if (OUTPUT_PATH) {
    fs.writeFileSync(path.resolve(ROOT, OUTPUT_PATH), `${JSON.stringify(artifact, null, 2)}\n`);
  }

  writeGitHubSummary(artifact);

  console.log(`[telegram-sync-drill] ${overall} - ${results.length} proof rows`);

  if (overall === "PASS") return;
  if (hasFail) process.exit(1);
  if (!REQUIRED) return;

  process.exit(2);
}

function writeGitHubSummary(artifact) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;

  const statusIcon = {
    PASS: "PASS",
    PARTIAL: "PARTIAL",
    UNVERIFIED: "UNVERIFIED",
    FAIL: "FAIL",
  };
  const rows = artifact.results
    .map(
      (result) =>
        `| ${result.name} | ${statusIcon[result.status] || result.status} | ${escapeMarkdownTable(result.evidence)} |`,
    )
    .join("\n");

  const summary = [
    "## Telegram Sync Drill",
    "",
    `Overall: **${artifact.overall}**`,
    "",
    "| Proof row | Status | Evidence |",
    "| --- | --- | --- |",
    rows,
    "",
    artifact.overall === "PASS"
      ? "Every proof row passed."
      : "Any PARTIAL or UNVERIFIED row must be named in the Done Packet before claiming 100 percent sync closure.",
    "",
  ].join("\n");

  fs.appendFileSync(summaryPath, summary);
}

function escapeMarkdownTable(value) {
  return String(value || "")
    .replaceAll("|", "\\|")
    .replace(/\r?\n/g, " ")
    .trim();
}

function main() {
  console.log("[telegram-sync-drill] starting Telegram-grade sync proof drill");
  runLocalProof();
  runBrowserProof();
  runAccountProof();
  summarize();
}

main();
