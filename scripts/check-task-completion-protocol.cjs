#!/usr/bin/env node
"use strict";

/**
 * Guard for the ZenFlow completion protocol.
 *
 * This is intentionally a static invariant check. It makes sure future agents
 * cannot claim sync/runtime/Desktop/Public release completion while the durable
 * Done Packet, proof matrix, and release-gate wiring have drifted out of the
 * repo.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const failures = [];
let passCount = 0;

function abs(file) {
  return path.join(ROOT, file);
}

function rel(file) {
  return file.replaceAll("\\", "/");
}

function read(file) {
  const target = abs(file);
  if (!fs.existsSync(target)) {
    failures.push(`${rel(file)} is missing`);
    return "";
  }

  return fs.readFileSync(target, "utf8");
}

function requireIncludes(file, snippets) {
  const source = read(file);
  if (!source) return;

  for (const snippet of snippets) {
    if (!source.includes(snippet)) {
      failures.push(`${rel(file)} is missing required completion token: ${snippet}`);
    } else {
      passCount += 1;
    }
  }
}

function requireRegex(file, regex, label) {
  const source = read(file);
  if (!source) return;

  if (!regex.test(source)) {
    failures.push(`${rel(file)} is missing required completion pattern: ${label}`);
  } else {
    passCount += 1;
  }
}

function main() {
  requireIncludes("docs/ai/TASK_COMPLETION_PROTOCOL.md", [
    "DONE is an evidence state",
    "No evidence = FAIL",
    "Done Packet",
    "PASS",
    "PARTIAL",
    "UNVERIFIED",
    "FAIL",
    "WAIVED",
    "Scope is locked",
    "Relevant contracts are read",
    "Implementation boundaries are declared",
    "Proof map is chosen before claiming completion",
    "Verification runs after the final change",
    "Regression scan is task-specific",
    "Known gaps",
    "Rollback",
    "Commit/deploy",
    "Sync/account/data",
    "Performance/startup",
    "Desktop EXE/runtime",
    "Security/privacy",
    "Release/public URL",
    "Native/PWA/cross-platform",
    "telegram-sync-drill",
    "TELEGRAM_GRADE_SYNC_100_PERCENT_CLOSURE.md",
    "TELEGRAM_GRADE_20_IDEA_LEDGER.md",
    "DESKTOP_EXE_RUNTIME_CONTRACT.md",
  ]);

  requireIncludes("docs/ai/SYNC_CONTRACT.md", [
    "latest user action",
    "sync_events.seq",
    "WRITE_SYNC_EVENT",
    "runWithSyncLeaderLock",
    "anti-resurrection",
    "TELEGRAM_GRADE_SYNC_100_PERCENT_CLOSURE.md",
    "TELEGRAM_GRADE_20_IDEA_LEDGER.md",
  ]);

  requireIncludes("docs/ai/TELEGRAM_GRADE_RUNTIME_CONTRACT.md", [
    "docs/ai/TASK_COMPLETION_PROTOCOL.md",
    "No evidence means not complete",
    "Public-user claims need public-user proof",
    "Ordered sync beats arrival order",
    "Platform Matrix",
  ]);

  requireIncludes("docs/ai/TELEGRAM_GRADE_SYNC_100_PERCENT_CLOSURE.md", [
    "100 percent is a proof state",
    "If a proof path is unavailable",
    "UNVERIFIED",
    "smoke:sync-account",
    "smoke:telegram-sync-drill",
    "Account Boundary Is Never Mixed",
    "Deletes Cannot Resurrect",
  ]);

  requireIncludes("docs/ai/TELEGRAM_GRADE_20_IDEA_LEDGER.md", [
    "Release-Critical Rows",
    "Known Non-PASS Conditions",
    "Done Packet Addendum",
    "Sync Inbox",
    "Telegram Sync Drill Release Gate",
  ]);

  requireIncludes("docs/DEFINITION_OF_DONE.md", [
    "Task completion protocol",
    "TASK_COMPLETION_PROTOCOL.md",
    "Telegram sync drill",
    "Sync 100 percent closure matrix",
    "Desktop EXE contract",
  ]);

  requireIncludes("docs/RELEASE_CHECKLIST.md", [
    "TASK_COMPLETION_PROTOCOL.md",
    "TELEGRAM_GRADE_SYNC_100_PERCENT_CLOSURE.md",
    "smoke:telegram-sync-drill",
    "telegram-sync-drill",
  ]);

  requireIncludes("package.json", [
    '"check:task-completion": "node scripts/check-task-completion-protocol.cjs"',
    "npm run check:task-completion",
    "npm run check:sync-contract",
    "npm run check:canonical-orbs",
  ]);

  requireIncludes(".github/workflows/deploy.yml", [
    "Check task completion protocol",
    "npm run check:task-completion",
    "Check Telegram-grade sync contract",
    "Run Telegram sync drill",
  ]);

  requireIncludes("scripts/check-sync-contract.cjs", [
    "check:task-completion",
    "TASK_COMPLETION_PROTOCOL.md",
    "TELEGRAM_GRADE_20_IDEA_LEDGER.md",
  ]);

  requireRegex(
    "docs/ai/TASK_COMPLETION_PROTOCOL.md",
    /Evidence:\s*\n\| Requirement \| Status \| Evidence \|[\s\S]*Known gaps:/,
    "Done Packet keeps evidence table before known gaps",
  );

  if (failures.length > 0) {
    console.error("[task-completion-protocol] FAIL");
    console.error("");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    console.error("");
    console.error("Fix: restore the evidence-backed Done Packet, platform matrix, and sync/runtime release gates.");
    process.exit(1);
  }

  console.log(`[task-completion-protocol] PASS - ${passCount} invariants verified.`);
}

main();
