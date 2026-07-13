#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const failures = [];

const EXPECTED_ROLE_IDS = [
  "coordinator-teamlead",
  "psychology-human-factors-emotional-safety",
  "logic-causality-state-coherence",
  "interaction-accessibility-readability-localization-culture",
  "technical-architecture-data-cross-platform",
  "security-privacy-agent-trust",
  "performance-reliability-operations",
  "qa-evidence-release-verification",
  "product-discovery-visual-craft-experience-quality",
  "independent-blind-spot-sentinel",
];

try {
  const registry = JSON.parse(read("config/persistent-agent-orchestra.json"));
  const roleIds = registry.roles?.map((role) => role.id) ?? [];
  if (JSON.stringify(roleIds) !== JSON.stringify(EXPECTED_ROLE_IDS)) {
    fail("registry must contain the exact ordered ten project role IDs");
  }

  for (const role of registry.roles ?? []) {
    const label = `role ${role.slot ?? "?"} ${role.id ?? "?"}`;
    for (const field of [
      "description",
      "mission",
      "owns",
      "does_not_own",
      "activation",
      "required_inputs",
      "checks",
      "outputs",
      "counter_hypotheses",
      "hard_stops",
      "human_escalations",
      "sandbox_intent",
      "tool_policy",
      "source_ids",
      "eval_ids",
    ]) {
      const value = role[field];
      if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
        fail(`${label} is missing substantive ${field}`);
      }
    }
    if (role.sandbox_intent !== "READ_ONLY_INTENT") {
      fail(`${label} must declare READ_ONLY_INTENT without claiming effective enforcement`);
    }
    if (!Array.isArray(role.counter_hypotheses) || role.counter_hypotheses.length < 2) {
      fail(`${label} must challenge at least two competing hypotheses`);
    }
  }

  const role10 = registry.roles?.[9];
  if (!role10?.review_protocol?.pass_a || !role10?.review_protocol?.pass_b) {
    fail("role 10 must define both independent Pass A and closure Pass B");
  }

  const agents = read("AGENTS.md");
  for (const marker of [
    "Persistent Codex Agent Orchestra",
    "smallest sufficient routed subset",
    "READ_ONLY_INTENT",
    "Structural success never implies semantic quality",
  ]) {
    if (!agents.includes(marker)) fail(`AGENTS.md must include exact-ten marker: ${marker}`);
  }

  const protocol = read("docs/ai/PERSISTENT_AGENT_ORCHESTRA_EVAL_PROTOCOL.md");
  for (const marker of [
    "| Structural |",
    "| Semantic |",
    "| Runtime |",
    "| Qualified-human |",
    "| Real-user |",
    "UNVERIFIED",
  ]) {
    if (!protocol.includes(marker)) fail(`eval protocol must separate evidence status: ${marker}`);
  }

  runCanonicalCheck("scripts/sync-persistent-agent-orchestra.mjs", ["--check"]);
  runCanonicalCheck("scripts/validate-persistent-agent-orchestra-eval-report.mjs", ["--catalog"]);
} catch (error) {
  fail(error.message);
}

if (failures.length > 0) {
  console.error("[subagent-governance] FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("[subagent-governance] OK - canonical exact-ten structure and evidence boundaries verified");

function read(relativePath) {
  return readFileSync(path.join(rootDir, relativePath), "utf8").replace(/\r\n/g, "\n");
}

function runCanonicalCheck(script, args) {
  try {
    execFileSync(process.execPath, [script, ...args], {
      cwd: rootDir,
      encoding: "utf8",
      timeout: 20_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const details = [error?.stdout, error?.stderr].filter(Boolean).join("\n").trim();
    fail(`${script} ${args.join(" ")} failed${details ? `: ${details}` : ""}`);
  }
}

function fail(message) {
  failures.push(message);
}
