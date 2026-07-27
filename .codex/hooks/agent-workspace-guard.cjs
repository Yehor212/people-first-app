#!/usr/bin/env node
"use strict";

// Shared Codex and Kimi PreToolUse adapter; each registration binds its client actor.
const fs = require("node:fs");
const { evaluateWorkspaceEvent } = require("../../scripts/agent-workspace-command-guard.cjs");

const expectedAgent = expectedAgentArgument(process.argv.slice(2));
if (!expectedAgent) {
  block("Hook client actor binding is missing or invalid", "unbound");
}

let event;
try {
  event = JSON.parse(fs.readFileSync(0, "utf8"));
} catch (error) {
  block(`Malformed hook input: ${error.message}`, expectedAgent);
}

try {
  const result = evaluateWorkspaceEvent({
    event,
    expectedAgent,
    fallbackCwd: process.cwd(),
  });
  if (!result.allowed) block(result.reasons.join("\n"), expectedAgent);
} catch (error) {
  block(`Guard evaluation failed closed: ${error.message}`, expectedAgent);
}

function expectedAgentArgument(args) {
  if (args.length !== 2 || args[0] !== "--expected-agent") return "";
  return ["codex", "kimi"].includes(args[1]) ? args[1] : "";
}

function block(reason, actor) {
  process.stderr.write(
    "ZENFLOW AGENT WORKSPACE GUARD BLOCKED\n\n" +
      `Client actor: ${actor}\n` +
      `${reason}\n\n` +
      "Hooks are a secondary guardrail. Use the isolated workspace CLI and keep confirmations enabled.\n"
  );
  process.exit(2);
}
