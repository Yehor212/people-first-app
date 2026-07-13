#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { evaluateGuard } = require("../../scripts/codex-governance/change-gate-core.cjs");
const { analyzeToolEvent } = require("../../scripts/codex-governance/tool-targets.cjs");

function main() {
  let event;
  try {
    event = JSON.parse(fs.readFileSync(0, "utf8"));
  } catch (error) {
    block(`Malformed hook input: ${error.message}`);
  }

  const rootDir = process.cwd();
  const analysis = analyzeToolEvent(event);
  const targets = analysis.targets;

  if (targets.length === 0) {
    if (analysis.mutationIntent) {
      block("Write-like tool input did not expose a bounded target path.");
    }
    process.exit(0);
  }

  const failures = [];
  for (const targetPath of targets) {
    const result = evaluateGuard({ rootDir, targetPath, now: new Date() });
    if (!result.allowed) failures.push(`${targetPath}: ${result.reasons.join("; ")}`);
  }
  if (failures.length > 0) block(failures.join("\n"));
}

function block(reason) {
  process.stderr.write(
    `CODEX CHANGE GOVERNANCE GATE BLOCKED\n\n${reason}\n\n` +
      "Provide fresh structured .preflight-token evidence; AGENTS.md also requires .Codex-md-unlock.\n",
  );
  process.exit(2);
}

main();
