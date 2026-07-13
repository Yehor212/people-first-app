#!/usr/bin/env node
/**
 * PRODUCTION DATA INTEGRITY GATE
 *
 * Early-feedback hook for relevant Codex prompts and edits. The deterministic
 * checker and CI remain the repository-local enforcement boundary; this hook
 * never treats its own output or a subagent summary as proof.
 *
 * Hook input: one JSON object on stdin. Successful stdout is JSON only.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { analyzeToolEvent } = require("../../scripts/codex-governance/tool-targets.cjs");

function resolveRepositoryRoot() {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 5000,
    windowsHide: true,
  });
  if (result.status === 0 && result.stdout.trim()) return path.resolve(result.stdout.trim());
  return process.cwd();
}

const ROOT = resolveRepositoryRoot();
const CHECKER = path.join(ROOT, "scripts", "check-production-data-integrity.cjs");
const CHECK_TIMEOUT_MS = 15000;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const RELEVANT_PROMPT = /\b(?:synthetic|fixture|mock|fake|sample data|demo mode|seed data|fallback|stubbed|production data|data integrity|persistence|indexeddb|dexie|supabase|sync|analytics|export|backup|share|readiness|release evidence)\b/i;
const RELEVANT_PATH = /^(?:src\/|supabase\/|scripts\/|config\/|\.codex\/|\.github\/workflows\/|docs\/release\/|docs\/ai\/PRODUCTION_DATA_INTEGRITY_POLICY\.md|docs\/adr\/0010-|AGENTS\.md|package\.json)/;
const PROTECTED_PATH = /^(?:scripts\/check-production-data-integrity\.cjs|scripts\/production-data-integrity\/|scripts\/__tests__\/(?:production-data-integrity|smoke-sync-account-boundary)|scripts\/(?:check-agent-context\.mjs|check-enforcement-health\.ts|check-task-completion-protocol\.cjs|smoke-sync-account\.cjs)|config\/production-data-integrity|\.codex\/hooks\/production-data-integrity-gate\.cjs|\.codex\/hooks\.json|\.github\/workflows\/(?:production-data-integrity|deploy|deploy-v2-preview|desktop-release|drift-checks)\.yml|docs\/ai\/(?:PRODUCTION_DATA_INTEGRITY_POLICY|TASK_COMPLETION_PROTOCOL)\.md|docs\/(?:DEFINITION_OF_DONE|RELEASE_CHECKLIST)\.md|docs\/adr\/0010-production-data-integrity|src\/lib\/(?:syncIntegrity\.ts|__tests__\/syncIntegrity\.test\.ts)|AGENTS\.md|package\.json|\.github\/CODEOWNERS|\.github\/PULL_REQUEST_TEMPLATE\.md)/;

function normalizePath(value) {
  return String(value || "").normalize("NFC").replace(/\\/g, "/").replace(ROOT.replace(/\\/g, "/"), "").replace(/^\/+/, "");
}

function toolText(data) {
  const input = data && data.tool_input;
  if (typeof input === "string") return input;
  if (!input || typeof input !== "object") return "";
  return [input.command, input.cmd, input.patch, input.input, input.content, input.new_string, input.old_string]
    .filter((value) => typeof value === "string")
    .join("\n");
}

function targetPaths(data) {
  return analyzeToolEvent(data).targets.map(normalizePath).filter(Boolean);
}

function emit(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function preToolDeny(reason) {
  emit({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  });
}

function block(reason) {
  emit({ decision: "block", reason });
}

function relevantToolChange(data) {
  const paths = targetPaths(data);
  const toolName = String(data.tool_name || "");
  if (toolName === "Bash" && !/(?:apply_patch|\bsed\s+-i\b|\brm\s|\bmv\s|\bcp\s|\btee\s|(?:^|\s)>\s*|\bnpm\s+run\s+(?:build|stage:release-artifacts))/m.test(toolText(data))) {
    return false;
  }
  if (paths.some((candidate) => RELEVANT_PATH.test(candidate))) return true;
  const text = toolText(data);
  return /production-data-integrity|src\/|supabase\/|docs\/release\//i.test(text);
}

function obviousTampering(data) {
  const text = toolText(data);
  const analysis = analyzeToolEvent(data);
  const protectedTarget = analysis.targets.map(normalizePath).some((candidate) => PROTECTED_PATH.test(candidate))
    || /(?:scripts\/(?:check-production-data-integrity|production-data-integrity|check-agent-context|check-enforcement-health|check-task-completion-protocol|smoke-sync-account)|config\/production-data-integrity|\.codex\/hooks(?:\.json|\/production-data-integrity)|\.github\/workflows\/(?:production-data-integrity|deploy|deploy-v2-preview|desktop-release|drift-checks)|docs\/(?:ai\/(?:PRODUCTION_DATA_INTEGRITY_POLICY|TASK_COMPLETION_PROTOCOL)|DEFINITION_OF_DONE|RELEASE_CHECKLIST))/.test(text);
  if (!protectedTarget) return null;
  if (analysis.shellMutation) {
    return "Direct shell mutation of production-data-integrity enforcement is blocked; use a reviewable patch with fresh test-first and governance evidence.";
  }
  if (/\brm(?:\s+-[^\s;&|]+)*\s+(?:docs\/ai\/PRODUCTION_DATA_INTEGRITY_POLICY\.md|scripts\/check-production-data-integrity\.cjs|\.codex\/hooks\/production-data-integrity-gate\.cjs)\b/.test(text)) {
    return "production-data-integrity enforcement cannot be removed or weakened in the same command.";
  }
  const removedContract = text.split(/\r?\n/).some((line) => /^-(?!-)/.test(line) && /production(?:-| )data(?:-| )integrity|PDI0(?:0[1-9]|1[0-2])|process\.exit\(2\)|stop_hook_active/i.test(line));
  if (removedContract) return "production-data-integrity enforcement cannot be removed or weakened in the same patch. Preserve the contract and update independent behavior tests first.";
  if (/^\+(?!\+).*\bcontinue-on-error\s*:\s*true/m.test(text) || /^\+(?!\+).*\|\|\s*true/m.test(text)) {
    return "Production data integrity checks may not be made non-blocking with continue-on-error or || true.";
  }
  if (/production-data-integrity\.yml[\s\S]*^\+(?!\+).*\bpaths(?:-ignore)?\s*:/m.test(text)) {
    return "The required production-data-integrity workflow may not use a path filter that can skip the check.";
  }
  if (/production-data-integrity-waivers[\s\S]*(?:approvedBy["']?\s*:\s*["']?(?:agent|codex|claude)|path["']?\s*:\s*["'][^"']*[*?])/i.test(text)) {
    return "Waivers require an exact path/fingerprint, expiry, tracking issue, and real human approval; agent-approved or wildcard waivers are forbidden.";
  }
  if (/production-data-integrity-baseline[\s\S]*(?:allowedViolations|"count"\s*:|"max"\s*:)/i.test(text)) {
    return "The production data integrity baseline accepts only exact fingerprints, never a broad count.";
  }
  return null;
}

function runChecker(mode) {
  if (!fs.existsSync(CHECKER)) return { kind: "error", reason: "checker is missing" };
  const result = spawnSync(process.execPath, [CHECKER, mode === "staged" ? "--staged" : "--diff", "--json"], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: CHECK_TIMEOUT_MS,
    maxBuffer: MAX_OUTPUT_BYTES,
    windowsHide: true,
  });
  if (result.error) return { kind: "error", reason: result.error.message };
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    return { kind: "error", reason: "checker returned malformed JSON" };
  }
  if (result.status === 2 || report.status === "ERROR") return { kind: "error", reason: report.error || "checker internal/config error" };
  if (result.status === 1 || report.status === "FAIL") {
    const active = Array.isArray(report.findings)
      ? report.findings.filter((finding) => (!finding.severity || finding.severity === "error") && !finding.baselined && !finding.waived).slice(0, 5)
      : [];
    const summary = active.map((finding) => `${finding.ruleId} ${finding.path}:${finding.line || 1}`).join(", ") || "integrity findings";
    return { kind: "finding", reason: summary };
  }
  if (result.status !== 0 || report.status !== "PASS") return { kind: "error", reason: `unexpected checker state: exit=${result.status} status=${report.status}` };
  return { kind: "clean", report };
}

function evidencePacketComplete(message) {
  const required = [
    /Findings\s*:/i,
    /File\/source evidence\s*:/i,
    /Platform\/domain impact\s*:/i,
    /Verification run or skipped checks\s*:/i,
    /Remaining risk\s*:/i,
    /Verdict\s*:\s*(?:GO|STOP|ASK)\b/i,
  ];
  return required.every((pattern) => pattern.test(message));
}

function handle(data) {
  const eventName = data.hook_event_name || data.event;
  if (eventName === "UserPromptSubmit") {
    const prompt = String(data.prompt || "");
    if (!RELEVANT_PROMPT.test(prompt)) return emit({});
    return emit({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: "PRODUCTION DATA INTEGRITY: read docs/ai/PRODUCTION_DATA_INTEGRITY_POLICY.md. Isolated test doubles are allowed; synthetic production facts, deceptive fallbacks, real-namespace demo data, fake evidence, and error masking are forbidden. Run the focused checker and cite fresh evidence.",
      },
    });
  }
  if (eventName === "PreToolUse") {
    const tampering = obviousTampering(data);
    if (tampering) return preToolDeny(tampering);
    return emit({});
  }
  if (eventName === "PostToolUse") {
    if (!relevantToolChange(data)) return emit({});
    const check = runChecker("diff");
    if (check.kind === "finding") return block(`Production data integrity diff check failed: ${check.reason}. Run npm run check:production-data-integrity:diff and remediate the reported rules.`);
    if (check.kind === "error") return block(`Production data integrity checker internal error; completion is not clean: ${check.reason}.`);
    return emit({});
  }
  if (eventName === "Stop") {
    if (data.stop_hook_active === true) return emit({ continue: true });
    const check = runChecker("diff");
    if (check.kind === "finding") return block(`Production data integrity Stop check failed: ${check.reason}.`);
    if (check.kind === "error") return block(`Production data integrity checker internal error at Stop: ${check.reason}.`);
    return emit({ continue: true });
  }
  if (eventName === "SubagentStart") {
    return emit({
      hookSpecificOutput: {
        hookEventName: "SubagentStart",
        additionalContext: "Production-data integrity review is read-only unless explicitly authorized. Report: Findings; File/source evidence; Platform/domain impact; Verification run or skipped checks; Remaining risk; Verdict: GO / STOP / ASK. A summary is not proof.",
      },
    });
  }
  if (eventName === "SubagentStop") {
    const message = String(data.last_assistant_message || data.message || "");
    const claimsSuccess = /\b(?:PASS|GO|READY|ALL CLEAR|NO FINDINGS)\b/i.test(message);
    if (claimsSuccess && !evidencePacketComplete(message)) {
      return block("Subagent success claim lacks the required Findings, file/source evidence, platform/domain impact, verification/skips, remaining risk, and GO/STOP/ASK verdict packet.");
    }
    return emit({});
  }
  return emit({});
}

try {
  const raw = fs.readFileSync(0, "utf8");
  const data = JSON.parse(raw);
  handle(data);
} catch (error) {
  process.stderr.write(`HOOK ERROR [production-data-integrity-gate]: ${error.message || error}\n`);
  process.exit(2);
}
