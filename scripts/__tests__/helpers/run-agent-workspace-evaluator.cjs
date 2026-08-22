#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { evaluateWorkspaceEvent } = require("../../agent-workspace-command-guard.cjs");

function expectedAgentArgument(args) {
  if (args.length !== 2 || args[0] !== "--expected-agent") return "";
  return ["codex", "kimi"].includes(args[1]) ? args[1] : "";
}

function block(reason, actor) {
  process.stderr.write(
    "ZENFLOW AGENT WORKSPACE GUARD BLOCKED\n\n" +
      `Client actor: ${actor}\n` +
      `${reason}\n\n` +
      "Test-only evaluator adapter; runtime composition is tested through .codex/hooks.json.\n"
  );
  process.exit(2);
}

const expectedAgent = expectedAgentArgument(process.argv.slice(2));
if (!expectedAgent) block("Hook client actor binding is missing or invalid", "unbound");

try {
  const event = JSON.parse(fs.readFileSync(0, "utf8"));
  const result = evaluateWorkspaceEvent({
    event,
    expectedAgent,
    fallbackCwd: process.cwd(),
  });
  if (!result.allowed) block(result.reasons.join("\n"), expectedAgent);
} catch (error) {
  block(`Workspace evaluator failed closed: ${error.message || error}`, expectedAgent);
}
