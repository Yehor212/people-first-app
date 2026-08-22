#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { evaluateGuard } = require("../../codex-governance/change-gate-core.cjs");
const { analyzeToolEvent } = require("../../codex-governance/tool-targets.cjs");

function block(reason) {
  process.stderr.write(
    `CODEX CHANGE GOVERNANCE GATE BLOCKED\n\n${reason}\n\n` +
      "Test-only evaluator adapter; runtime composition is tested through .codex/hooks.json.\n"
  );
  process.exit(2);
}

try {
  const event = JSON.parse(fs.readFileSync(0, "utf8"));
  const rootDir = process.cwd();
  const analysis = analyzeToolEvent(event);
  if (analysis.action === "read") process.exit(0);
  if (analysis.action === "unknown") {
    block("Ambiguous or opaque tool input cannot be authorized by a planning token.");
  }
  if (analysis.targets.length === 0) {
    block("Write-like tool input did not expose a bounded target path.");
  }

  const failures = [];
  for (const targetPath of analysis.targets) {
    const result = evaluateGuard({ rootDir, targetPath, now: new Date() });
    if (!result.allowed) failures.push(`${targetPath}: ${result.reasons.join("; ")}`);
  }
  if (failures.length > 0) block(failures.join("\n"));
} catch (error) {
  block(`Evaluator failed closed: ${error.message || error}`);
}
