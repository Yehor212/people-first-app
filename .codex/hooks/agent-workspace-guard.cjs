#!/usr/bin/env node
"use strict";

// Shared Codex and Kimi PreToolUse adapter; each registration binds its client actor.
const fs = require("node:fs");
let evaluateWorkspaceEvent;
let resolveCanonicalGitRoot;
let evaluateGuard;
let analyzeToolEvent;
let audit;
let evaluateSkillRoutingEvent;
let evaluatePdiPreTool;
let bootstrapFailure = false;

try {
  ({
    evaluateWorkspaceEvent,
    resolveCanonicalGitRoot,
  } = require("../../scripts/agent-workspace-command-guard.cjs"));
  ({ evaluateGuard } = require("../../scripts/codex-governance/change-gate-core.cjs"));
  ({ analyzeToolEvent } = require("../../scripts/codex-governance/tool-targets.cjs"));
  ({ audit, evaluateSkillRoutingEvent } = require("./skill-router-gate.cjs"));
  ({ evaluatePdiPreTool } = require("./production-data-integrity-gate.cjs"));
} catch {
  bootstrapFailure = true;
}

function main(args = process.argv.slice(2)) {
  const expectedAgent = expectedAgentArgument(args);
  if (!expectedAgent) {
    blockEvaluations(
      [
        {
          owner: "hook_runtime",
          reasonCode: "invalid_actor_binding",
          reason: "Hook client actor binding is missing or invalid",
        },
      ],
      "unbound"
    );
  }

  if (bootstrapFailure) {
    blockEvaluations(
      [
        {
          owner: "hook_runtime",
          reasonCode: "bootstrap_failure",
          reason: "Hook dependency bootstrap failed closed",
        },
      ],
      expectedAgent
    );
  }

  let event;
  try {
    event = JSON.parse(fs.readFileSync(0, "utf8"));
  } catch (error) {
    blockEvaluations(
      [
        {
          owner: "hook_runtime",
          reasonCode: "invalid_hook_input",
          reason: `Malformed hook input: ${error.message || error}`,
        },
      ],
      expectedAgent
    );
  }

  let rootDir;
  try {
    rootDir = resolveCanonicalGitRoot(process.cwd());
  } catch (error) {
    blockEvaluations(
      [
        {
          owner: "repository_root",
          reasonCode: "repository_root_unavailable",
          reason: `Repository identity/root unavailable: ${error.message || error}`,
        },
      ],
      expectedAgent
    );
  }

  try {
    const analysis = analyzeToolEvent(event);
    const denials = [];

    try {
      const workspace = evaluateWorkspaceEvent({
        event,
        expectedAgent,
        fallbackCwd: rootDir,
      });
      if (!workspace.allowed) {
        denials.push({
          owner: "workspace",
          reasonCode: "workspace_policy",
          reason: workspace.reasons.join("\n"),
        });
      }
    } catch (error) {
      denials.push({
        owner: "workspace",
        reasonCode: "workspace_internal_error",
        reason: `Workspace evaluator failed closed: ${error.message || error}`,
      });
    }

    try {
      const change = evaluateChangeEvidence({ analysis, rootDir });
      if (!change.allowed) {
        denials.push({ owner: "change_evidence", ...change });
      }
    } catch (error) {
      denials.push({
        owner: "change_evidence",
        reasonCode: "change_evidence_internal_error",
        reason: `Change-evidence evaluator failed closed: ${error.message || error}`,
      });
    }

    try {
      const skill = evaluateSkillRoutingEvent(event, { analysis, rootDir });
      if (!skill.allowed) {
        audit("block", skill.reasonCode, rootDir);
        denials.push({ owner: "skill_routing", ...skill });
      }
    } catch (error) {
      audit("error", "invalid_hook_input", rootDir);
      denials.push({
        owner: "skill_routing",
        reasonCode: "skill_routing_internal_error",
        reason: `Skill-routing evaluator failed closed: ${error.message || error}`,
      });
    }

    try {
      const pdi = evaluatePdiPreTool(event);
      if (!pdi.allowed) {
        denials.push({ owner: "production_data", ...pdi });
      }
    } catch (error) {
      denials.push({
        owner: "production_data",
        reasonCode: "pdi_internal_error",
        reason: `Production-data evaluator failed closed: ${error.message || error}`,
      });
    }

    if (denials.length > 0) blockEvaluations(denials, expectedAgent);
  } catch (error) {
    blockEvaluations(
      [
        {
          owner: "hook_runtime",
          reasonCode: "guard_internal_error",
          reason: `Guard evaluation failed closed: ${error.message || error}`,
        },
      ],
      expectedAgent
    );
  }
}

function evaluateChangeEvidence({ analysis, rootDir }) {
  if (analysis.action === "read") {
    return { allowed: true, reasonCode: "", reason: "" };
  }
  if (analysis.action === "unknown") {
    return {
      allowed: false,
      reasonCode: "ambiguous_tool_input",
      reason: "Ambiguous or opaque tool input cannot be authorized by a planning token.",
    };
  }
  if (analysis.targets.length === 0) {
    return {
      allowed: false,
      reasonCode: "missing_edit_target",
      reason: "Write-like tool input did not expose a bounded target path.",
    };
  }
  const failures = [];
  for (const targetPath of analysis.targets) {
    const result = evaluateGuard({ rootDir, targetPath, now: new Date() });
    if (!result.allowed) failures.push(`${targetPath}: ${result.reasons.join("; ")}`);
  }
  return failures.length > 0
    ? {
        allowed: false,
        reasonCode: "missing_or_invalid_change_evidence",
        reason: failures.join("\n"),
      }
    : { allowed: true, reasonCode: "", reason: "" };
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

function blockEvaluations(denials, actor) {
  const normalized = denials.map((denial) => ({
    ...denial,
    owner: boundedPolicyToken(denial.owner, "hook_runtime"),
    reasonCode: boundedPolicyToken(denial.reasonCode, "invalid_policy_result"),
  }));
  const policyResults = [
    ...new Set(normalized.map((denial) => `${denial.owner}:${denial.reasonCode}`)),
  ].sort();
  const reasonCodes = [...new Set(normalized.map((denial) => denial.reasonCode))].sort();
  const reasons = denials.map((denial) => `[${denial.reasonCode}] ${denial.reason}`);
  block(
    `Policy results: ${policyResults.join(", ")}\n` +
      `Reason codes: ${reasonCodes.join(", ")}\n${reasons.join("\n")}`,
    actor
  );
}

function boundedPolicyToken(value, fallback) {
  const token = String(value || "");
  return /^[a-z][a-z0-9_]{0,63}$/.test(token) ? token : fallback;
}

function isDirectRun(invokedPath = process.argv[1]) {
  if (!invokedPath) return false;
  try {
    return fs.realpathSync.native(invokedPath) === fs.realpathSync.native(__filename);
  } catch {
    return false;
  }
}

if (require.main === module) {
  if (!isDirectRun()) {
    blockEvaluations(
      [
        {
          owner: "hook_runtime",
          reasonCode: "direct_entry_unresolved",
          reason: "Hook direct-entry path could not be resolved safely",
        },
      ],
      "unbound"
    );
  }
  main();
}

module.exports = {
  isDirectRun,
  main,
};
