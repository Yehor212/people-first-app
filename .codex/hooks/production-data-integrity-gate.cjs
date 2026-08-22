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
const HOOK_NAME = "production-data-integrity-gate";
let analyzeToolEvent;
let EVIDENCE_BLOCK_REASON;
let REQUIRED_CONTEXT_LINES;
let evaluateSubagentEvidence;

try {
  ({ analyzeToolEvent } = require("../../scripts/codex-governance/tool-targets.cjs"));
  ({
    EVIDENCE_BLOCK_REASON,
    REQUIRED_CONTEXT_LINES,
    evaluateSubagentEvidence,
  } = require("../../scripts/codex-governance/subagent-evidence.cjs"));
} catch (error) {
  failBootstrap(error);
}

function failBootstrap(error) {
  if (require.main !== module) throw error;
  process.stderr.write(`HOOK ERROR [${HOOK_NAME}]: bootstrap_failure\n`);
  process.exit(2);
}

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
const REVIEWED_ADDITIVE_PACKAGE_SCRIPTS = new Map([
  ["check:agent-workspace", "node scripts/check-agent-workspace-protocol.cjs"],
]);
const RELEVANT_PROMPT =
  /\b(?:synthetic|fixture|mock|fake|sample data|demo mode|seed data|fallback|stubbed|production data|data integrity|persistence|indexeddb|dexie|supabase|sync|analytics|export|backup|share|readiness|release evidence)\b/i;
const RELEVANT_PATH =
  /^(?:src\/|supabase\/|scripts\/|config\/|\.codex\/|\.github\/workflows\/|docs\/release\/|docs\/ai\/PRODUCTION_DATA_INTEGRITY_POLICY\.md|docs\/adr\/0010-|AGENTS\.md|package\.json)/;
const PROTECTED_PATH =
  /^(?:scripts\/check-production-data-integrity\.cjs|scripts\/production-data-integrity\/|scripts\/__tests__\/(?:production-data-integrity|smoke-sync-account-boundary)|scripts\/(?:check-agent-context\.mjs|check-enforcement-health\.ts|check-task-completion-protocol\.cjs|smoke-sync-account\.cjs)|config\/production-data-integrity|\.codex\/hooks\/production-data-integrity-gate\.cjs|\.codex\/hooks\.json|\.github\/workflows\/(?:production-data-integrity|deploy|deploy-v2-preview|desktop-release|drift-checks)\.yml|docs\/ai\/(?:PRODUCTION_DATA_INTEGRITY_POLICY|TASK_COMPLETION_PROTOCOL)\.md|docs\/(?:DEFINITION_OF_DONE|RELEASE_CHECKLIST)\.md|docs\/adr\/0010-production-data-integrity|src\/lib\/(?:syncIntegrity\.ts|__tests__\/syncIntegrity\.test\.ts)|AGENTS\.md|package\.json|\.github\/CODEOWNERS|\.github\/PULL_REQUEST_TEMPLATE\.md)/;
const INVENTORY_CONFIG_PATH = "config/production-data-integrity.json";
const INVENTORY_CONFIG_ARRAY_KEYS = [
  "entrypoints",
  "scanRoots",
  "productionPathGlobs",
  "testPathGlobs",
  "devPathGlobs",
  "scanExcludeGlobs",
  "generatedPathGlobs",
  "documentationPathGlobs",
  "bundleDirectories",
  "releaseEvidenceRoots",
  "releaseEvidenceGlobs",
  "releaseEvidenceExcludeGlobs",
  "enforcementPathGlobs",
];
const INVENTORY_CONFIG_PATH_KEYS = new Set([
  "entrypoints",
  "scanRoots",
  "productionPathGlobs",
  "bundleDirectories",
  "releaseEvidenceGlobs",
  "enforcementPathGlobs",
]);
const ALWAYS_RELEVANT_GIT_PATHSPECS = [
  "src",
  "supabase",
  "scripts",
  "config",
  ".codex",
  ".github/workflows",
  ".gitignore",
  ".gitattributes",
];
const PDI_PROMPT_CONTEXT =
  "PRODUCTION DATA INTEGRITY: read docs/ai/PRODUCTION_DATA_INTEGRITY_POLICY.md. Isolated test doubles are allowed; synthetic production facts, deceptive fallbacks, real-namespace demo data, fake evidence, and error masking are forbidden. Run the focused checker and cite fresh evidence.";

function normalizePath(value) {
  const candidate = String(value || "").normalize("NFC");
  if (!candidate) return "";
  const absolute = path.isAbsolute(candidate);
  const relative = absolute ? path.relative(ROOT, path.resolve(candidate)) : candidate;
  const normalized = path.posix
    .normalize(relative.replace(/\\/g, "/").replace(/^\.\//, ""))
    .replace(/^\/+/, "");
  if (
    !normalized ||
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    path.isAbsolute(normalized)
  ) {
    return "";
  }
  return normalized;
}

function toolText(data) {
  const input = data && data.tool_input;
  if (typeof input === "string") return input;
  if (!input || typeof input !== "object") return "";
  return [
    input.command,
    input.cmd,
    input.patch,
    input.input,
    input.content,
    input.new_string,
    input.old_string,
  ]
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

function blockWithCode(reasonCode, reason, details = {}) {
  emit({ decision: "block", reason_code: reasonCode, ...details, reason });
}

function postToolRelevance(data) {
  const analysis = analyzeToolEvent(data);
  if (analysis.action === "read") return { relevant: false, targets: [] };
  const paths = analysis.targets.map(normalizePath).filter(Boolean);
  if (paths.length === 0) return { relevant: false, targets: [] };
  try {
    const configuredPaths = configuredRelevantPaths();
    const relevantTargets = paths.filter((candidate) =>
      configuredPaths.some((pattern) => configuredPathMatches(candidate, pattern))
    );
    if (relevantTargets.length > 0) {
      return { relevant: true, targets: [...new Set(relevantTargets)].sort() };
    }
    return { relevant: false, targets: [] };
  } catch {
    return {
      relevant: true,
      targets: [...new Set(paths)].sort(),
      scopeError: true,
    };
  }
}

function maskPreservedContractRemovals(text) {
  const marker =
    /production-data-integrity(?::[a-z0-9-]+)?|production data integrity|PDI0(?:0[1-9]|1[0-2])|process\.exit\(2\)|stop_hook_active/gi;
  if (!/\*\*\* Update File: package\.json(?:\r?\n|$)/.test(text)) return text;
  const lines = String(text).split(/\r?\n/);
  const removedLines = lines.filter((line) => /^-(?!-)/.test(line));
  const addedText = lines.filter((line) => /^\+(?!\+)/.test(line)).join("\n");
  const removedCounts = countMarkers(removedLines.join("\n"), marker);
  const addedCounts = countMarkers(addedText, marker);
  const contractRemovals = removedLines.filter((line) => markerPresent(line, marker));
  if (
    removedCounts.size === 0 ||
    [...removedCounts].some(([token, count]) => (addedCounts.get(token) || 0) < count) ||
    contractRemovals.some((line) => !isAdditivePackageScriptReplacement(line, lines))
  ) {
    return text;
  }
  return lines
    .map((line) =>
      /^-(?!-)/.test(line) && markerPresent(line, marker) ? ` ${line.slice(1)}` : line
    )
    .join("\n");
}

function countMarkers(text, pattern) {
  const counts = new Map();
  for (const match of String(text).matchAll(pattern)) {
    const token = match[0].toLowerCase();
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return counts;
}

function markerPresent(text, pattern) {
  pattern.lastIndex = 0;
  return pattern.test(text);
}

function isAdditivePackageScriptReplacement(removedLine, lines) {
  const removed = parsePackageScriptLine(removedLine, "-");
  if (!removed) return false;
  const additions = lines
    .map((line) => parsePackageScriptLine(line, "+"))
    .filter((candidate) => candidate?.key === removed.key);
  if (additions.length !== 1) return false;

  const previous = commandSequence(removed.value);
  const next = commandSequence(additions[0].value);
  if (
    previous.length === 0 ||
    next.length < previous.length ||
    next.some(
      (command) =>
        !/^(?:npm\s+run|npx)\s+\S/.test(command) ||
        /[|;&<>$`\r\n]/.test(command) ||
        /\b(?:exec|exit|return|trap)\b/.test(command)
    )
  ) {
    return false;
  }
  let previousIndex = 0;
  const insertedCommands = [];
  for (const command of next) {
    if (command === previous[previousIndex]) {
      previousIndex += 1;
    } else {
      insertedCommands.push(command);
    }
  }
  return (
    previousIndex === previous.length &&
    new Set(insertedCommands).size === insertedCommands.length &&
    insertedCommands.every((command) => isReviewedPackageScriptCommand(command, lines))
  );
}

function isReviewedPackageScriptCommand(command, patchLines) {
  const match = /^npm\s+run\s+([a-z0-9:_-]+)$/i.exec(command);
  if (!match) return false;
  const scriptName = match[1];
  const expected = REVIEWED_ADDITIVE_PACKAGE_SCRIPTS.get(scriptName);
  if (!expected) return false;

  const patchDefinitions = patchLines
    .map((line) => parsePackageScriptLine(line, "+"))
    .filter((candidate) => candidate?.key === scriptName);
  if (patchDefinitions.length > 0) {
    return patchDefinitions.length === 1 && patchDefinitions[0].value === expected;
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    return packageJson?.scripts?.[scriptName] === expected;
  } catch {
    return false;
  }
}

function parsePackageScriptLine(line, prefix) {
  const escapedPrefix = prefix === "+" ? "\\+" : "-";
  const match = new RegExp(
    `^${escapedPrefix}(?!${escapedPrefix})\\s*"([^"]+)"\\s*:\\s*"((?:\\\\.|[^"])*)"\\s*,?\\s*$`
  ).exec(line);
  if (!match) return null;
  try {
    return { key: match[1], value: JSON.parse(`"${match[2]}"`) };
  } catch {
    return null;
  }
}

function commandSequence(value) {
  return String(value)
    .split(/\s*&&\s*/)
    .map((command) => command.trim())
    .filter(Boolean);
}

function obviousTampering(data) {
  let text = toolText(data);
  text = maskPreservedContractRemovals(text);
  const analysis = analyzeToolEvent(data);
  const normalizedTargets = analysis.targets.map(normalizePath).filter(Boolean);
  const reliableTargets =
    normalizedTargets.length > 0 &&
    normalizedTargets.length === analysis.targets.length &&
    !analysis.dynamicTarget &&
    !analysis.opaqueExecution;
  const protectedTarget = reliableTargets
    ? normalizedTargets.some((candidate) => PROTECTED_PATH.test(candidate))
    : /(?:scripts\/(?:check-production-data-integrity|production-data-integrity|check-agent-context|check-enforcement-health|check-task-completion-protocol|smoke-sync-account)|config\/production-data-integrity|\.codex\/hooks(?:\.json|\/production-data-integrity)|\.github\/workflows\/(?:production-data-integrity|deploy|deploy-v2-preview|desktop-release|drift-checks)|docs\/(?:ai\/(?:PRODUCTION_DATA_INTEGRITY_POLICY|TASK_COMPLETION_PROTOCOL)|DEFINITION_OF_DONE|RELEASE_CHECKLIST))/.test(
        text
      );
  if (!protectedTarget) return null;
  if (analysis.shellMutation) {
    return "Direct shell mutation of production-data-integrity enforcement is blocked; use a reviewable patch with fresh test-first and governance evidence.";
  }
  if (
    /\brm(?:\s+-[^\s;&|]+)*\s+(?:docs\/ai\/PRODUCTION_DATA_INTEGRITY_POLICY\.md|scripts\/check-production-data-integrity\.cjs|\.codex\/hooks\/production-data-integrity-gate\.cjs)\b/.test(
      text
    )
  ) {
    return "production-data-integrity enforcement cannot be removed or weakened in the same command.";
  }
  const removedContract = text
    .split(/\r?\n/)
    .some(
      (line) =>
        /^-(?!-)/.test(line) &&
        /production(?:-| )data(?:-| )integrity|PDI0(?:0[1-9]|1[0-2])|process\.exit\(2\)|stop_hook_active/i.test(
          line
        )
    );
  if (removedContract)
    return "production-data-integrity enforcement cannot be removed or weakened in the same patch. Preserve the contract and update independent behavior tests first.";
  if (
    /^\+(?!\+).*\bcontinue-on-error\s*:\s*true/m.test(text) ||
    /^\+(?!\+).*\|\|\s*true/m.test(text)
  ) {
    return "Production data integrity checks may not be made non-blocking with continue-on-error or || true.";
  }
  if (/production-data-integrity\.yml[\s\S]*^\+(?!\+).*\bpaths(?:-ignore)?\s*:/m.test(text)) {
    return "The required production-data-integrity workflow may not use a path filter that can skip the check.";
  }
  if (
    /production-data-integrity-waivers[\s\S]*(?:approvedBy["']?\s*:\s*["']?(?:agent|codex|claude)|path["']?\s*:\s*["'][^"']*[*?])/i.test(
      text
    )
  ) {
    return "Waivers require an exact path/fingerprint, expiry, tracking issue, and real human approval; agent-approved or wildcard waivers are forbidden.";
  }
  if (
    /production-data-integrity-baseline[\s\S]*(?:allowedViolations|"count"\s*:|"max"\s*:)/i.test(
      text
    )
  ) {
    return "The production data integrity baseline accepts only exact fingerprints, never a broad count.";
  }
  return null;
}

function runChecker(mode) {
  const checkerHealth = validateCheckerFile();
  if (!checkerHealth.ok) return { kind: "error", reason: checkerHealth.reason };
  const modeArgument = mode === "all" ? "--all" : mode === "staged" ? "--staged" : "--diff";
  const result = spawnSync(process.execPath, [CHECKER, modeArgument, "--json"], {
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
  if (result.status === 2 || report.status === "ERROR")
    return { kind: "error", reason: report.error || "checker internal/config error" };
  if (result.status === 1 || report.status === "FAIL") {
    const active = Array.isArray(report.findings)
      ? report.findings
          .filter(
            (finding) =>
              (!finding.severity || finding.severity === "error") &&
              !finding.baselined &&
              !finding.waived
          )
          .slice(0, 5)
      : [];
    const summary =
      active
        .map((finding) => `${finding.ruleId} ${finding.path}:${finding.line || 1}`)
        .join(", ") || "integrity findings";
    return { kind: "finding", reason: summary };
  }
  if (result.status !== 0 || report.status !== "PASS")
    return {
      kind: "error",
      reason: `unexpected checker state: exit=${result.status} status=${report.status}`,
    };
  return { kind: "clean", report };
}

function inventoryRelevantChanges() {
  try {
    const checkerHealth = validateCheckerFile();
    if (!checkerHealth.ok) return { kind: "error" };
    const config = readInventoryConfig();
    const pathspecs = configuredRelevantGitPathspecs(config);
    const tracked = spawnSync(
      "git",
      ["status", "--short", "--untracked-files=all", "--", ...pathspecs],
      {
        cwd: ROOT,
        encoding: "utf8",
        timeout: 1000,
        maxBuffer: 256 * 1024,
        windowsHide: true,
      }
    );
    if (tracked.error || tracked.status !== 0) return { kind: "error" };
    if (tracked.stdout.length > 0) return { kind: "relevant" };

    const ignored = inventoryIgnoredRelevantPaths(config);
    if (ignored.kind === "error") return ignored;
    return { kind: ignored.paths.length > 0 ? "ignored_relevant" : "clean" };
  } catch {
    return { kind: "error" };
  }
}

function validateCheckerFile() {
  try {
    const stats = fs.lstatSync(CHECKER);
    if (stats.isSymbolicLink() || !stats.isFile() || stats.nlink !== 1) {
      return { ok: false, reason: "checker is not a single regular file" };
    }
    return { ok: true, reason: "" };
  } catch {
    return { ok: false, reason: "checker is missing or unreadable" };
  }
}

function inventoryIgnoredRelevantPaths(config) {
  const sourcePatterns = [
    ...config.entrypoints,
    ...config.scanRoots,
    ...config.productionPathGlobs,
  ].map(normalizeConfiguredPath);
  const enforcementPatterns = [
    INVENTORY_CONFIG_PATH,
    config.baselineFile,
    config.waiversFile,
    ...config.enforcementPathGlobs,
    ...config.repositoryContracts.map((contract) => contract.path),
  ].map(normalizeConfiguredPath);
  const evidencePatterns = config.releaseEvidenceGlobs.map(normalizeConfiguredPath);
  const sourceExclusions = [
    ...config.testPathGlobs,
    ...config.devPathGlobs,
    ...config.scanExcludeGlobs,
    ...config.generatedPathGlobs,
    ...config.documentationPathGlobs,
  ].map(normalizeConfiguredPath);
  const evidenceExclusions = config.releaseEvidenceExcludeGlobs.map(normalizeConfiguredPath);
  const searchPathspecs = [
    ...new Set([...sourcePatterns, ...enforcementPatterns, ...evidencePatterns]),
  ].map((candidate) => (/[*?]/.test(candidate) ? `:(glob)${candidate}` : candidate));
  const ignored = spawnSync(
    "git",
    ["ls-files", "--others", "--ignored", "--exclude-standard", "-z", "--", ...searchPathspecs],
    {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 1000,
      maxBuffer: 256 * 1024,
      windowsHide: true,
    }
  );
  if (ignored.error || ignored.status !== 0) return { kind: "error", paths: [] };
  const paths = ignored.stdout
    .split("\0")
    .map(normalizePath)
    .filter(Boolean)
    .filter((candidate) => {
      const enforcementRelevant = enforcementPatterns.some((pattern) =>
        configuredPathMatches(candidate, pattern)
      );
      const sourceRelevant =
        sourcePatterns.some((pattern) => configuredPathMatches(candidate, pattern)) &&
        !sourceExclusions.some((pattern) => configuredPathMatches(candidate, pattern));
      const evidenceRelevant =
        evidencePatterns.some((pattern) => configuredPathMatches(candidate, pattern)) &&
        !evidenceExclusions.some((pattern) => configuredPathMatches(candidate, pattern));
      return enforcementRelevant || sourceRelevant || evidenceRelevant;
    });
  return { kind: "clean", paths: [...new Set(paths)].sort() };
}

function configuredRelevantGitPathspecs(config) {
  return configuredRelevantPaths(config).map((candidate) =>
    /[*?]/.test(candidate) ? `:(glob)${candidate}` : candidate
  );
}

function readInventoryConfig() {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, INVENTORY_CONFIG_PATH), "utf8"));
  for (const key of INVENTORY_CONFIG_ARRAY_KEYS) {
    if (
      !Array.isArray(config[key]) ||
      config[key].length === 0 ||
      config[key].some((candidate) => typeof candidate !== "string" || !candidate.trim())
    ) {
      throw new Error(`Invalid production-data integrity inventory field: ${key}`);
    }
  }
  for (const key of ["baselineFile", "waiversFile"]) {
    if (typeof config[key] !== "string" || !config[key].trim()) {
      throw new Error(`Invalid production-data integrity inventory field: ${key}`);
    }
  }
  if (!Array.isArray(config.repositoryContracts) || config.repositoryContracts.length === 0) {
    throw new Error("Invalid production-data integrity inventory field: repositoryContracts");
  }
  for (const contract of config.repositoryContracts) {
    if (!contract || typeof contract.path !== "string" || !contract.path.trim()) {
      throw new Error("Invalid production-data integrity repository contract path");
    }
  }
  return config;
}

function configuredRelevantPaths(config = readInventoryConfig()) {
  const configuredPaths = [];
  for (const key of INVENTORY_CONFIG_PATH_KEYS) configuredPaths.push(...config[key]);
  configuredPaths.push(config.baselineFile, config.waiversFile);
  configuredPaths.push(...config.repositoryContracts.map((contract) => contract.path));
  return [
    ...new Set(
      [...ALWAYS_RELEVANT_GIT_PATHSPECS, INVENTORY_CONFIG_PATH, ...configuredPaths].map(
        normalizeConfiguredPath
      )
    ),
  ].sort();
}

function normalizeConfiguredPath(value) {
  const candidate = String(value).normalize("NFC").replace(/\\/g, "/");
  if (
    !candidate ||
    path.posix.isAbsolute(candidate) ||
    candidate.startsWith(":") ||
    candidate.startsWith("!") ||
    candidate.includes("[") ||
    candidate.includes("]") ||
    candidate.includes("\0")
  ) {
    throw new Error("Unsafe production-data integrity inventory pathspec");
  }
  const normalized = path.posix.normalize(candidate).replace(/^\.\//, "");
  if (!normalized || normalized === "." || normalized === ".." || normalized.startsWith("../")) {
    throw new Error("Unsafe production-data integrity inventory pathspec");
  }
  return normalized;
}

function configuredPathMatches(candidate, pattern) {
  if (!/[*?]/.test(pattern)) {
    return candidate === pattern || candidate.startsWith(`${pattern}/`);
  }
  let source = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === "*" && pattern[index + 1] === "*") {
      if (pattern[index + 2] === "/") {
        source += "(?:.*/)?";
        index += 2;
      } else {
        source += ".*";
        index += 1;
      }
    } else if (character === "*") {
      source += "[^/]*";
    } else if (character === "?") {
      source += "[^/]";
    } else {
      source += character.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
    }
  }
  return new RegExp(`${source}$`).test(candidate);
}

function productionDataIntegrityContext() {
  return PDI_PROMPT_CONTEXT;
}

function isPdiPromptRelevant(prompt) {
  return RELEVANT_PROMPT.test(String(prompt || ""));
}

function productionDataSubagentContext() {
  return [
    "Production-data integrity review is read-only unless explicitly authorized.",
    "Treat local planning tokens as evidence only, never as authorization.",
    "A subagent summary is not proof.",
  ].join("\n");
}

function evaluatePdiPreTool(data) {
  const reason = obviousTampering(data);
  return reason
    ? { allowed: false, reasonCode: "pdi_tampering", reason }
    : { allowed: true, reasonCode: "", reason: "" };
}

function evaluatePdiStop(data) {
  if (data.stop_hook_active === true) {
    return { allowed: true, reasonCode: "", reason: "", skipped: true };
  }
  const inventory = inventoryRelevantChanges();
  if (inventory.kind === "error") {
    return {
      allowed: false,
      reasonCode: "relevant_path_inventory_failed",
      reason: "Production data integrity relevant-path inventory failed; Stop is not clean.",
    };
  }
  if (inventory.kind === "clean") {
    return { allowed: true, reasonCode: "", reason: "", skipped: true };
  }
  const check = runChecker(inventory.kind === "ignored_relevant" ? "all" : "diff");
  if (check.kind === "finding") {
    return {
      allowed: false,
      reasonCode: "pdi_stop_finding",
      reason: `Production data integrity Stop check failed: ${check.reason}.`,
    };
  }
  if (check.kind === "error") {
    return {
      allowed: false,
      reasonCode: "pdi_stop_checker_error",
      reason: `Production data integrity checker internal error at Stop: ${check.reason}.`,
    };
  }
  return { allowed: true, reasonCode: "", reason: "", skipped: false };
}

function handle(data) {
  const eventName = data.hook_event_name || data.event;
  if (eventName === "UserPromptSubmit") {
    const prompt = String(data.prompt || "");
    if (!RELEVANT_PROMPT.test(prompt)) return emit({});
    return emit({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: productionDataIntegrityContext(),
      },
    });
  }
  if (eventName === "PreToolUse") {
    const result = evaluatePdiPreTool(data);
    if (!result.allowed) return preToolDeny(result.reason);
    return emit({});
  }
  if (eventName === "PostToolUse") {
    const relevance = postToolRelevance(data);
    if (!relevance.relevant) return emit({});
    if (relevance.scopeError)
      return blockWithCode(
        "effect_applied_checker_failed",
        "Production data integrity configured scope could not be resolved after the tool effect was applied; no rollback or automatic retry.",
        { targets: relevance.targets }
      );
    const check = runChecker("diff");
    if (check.kind === "finding")
      return blockWithCode(
        "effect_applied_checker_failed",
        `Production data integrity diff check failed after the tool effect was applied: ${check.reason}; no rollback or automatic retry. Run npm run check:production-data-integrity:diff and remediate the reported rules.`,
        { targets: relevance.targets }
      );
    if (check.kind === "error")
      return blockWithCode(
        "effect_applied_checker_failed",
        `Production data integrity checker internal error after the tool effect was applied: ${check.reason}; no rollback or automatic retry.`,
        { targets: relevance.targets }
      );
    return emit({});
  }
  if (eventName === "Stop") {
    const result = evaluatePdiStop(data);
    if (!result.allowed) {
      if (result.reasonCode === "relevant_path_inventory_failed") {
        return blockWithCode(result.reasonCode, result.reason);
      }
      return block(result.reason);
    }
    return emit({ continue: true });
  }
  if (eventName === "SubagentStart") {
    return emit({
      hookSpecificOutput: {
        hookEventName: "SubagentStart",
        additionalContext: [productionDataSubagentContext(), ...REQUIRED_CONTEXT_LINES].join("\n"),
      },
    });
  }
  if (eventName === "SubagentStop") {
    const message = String(data.last_assistant_message || data.message || "");
    const evidence = evaluateSubagentEvidence(message);
    if (!evidence.complete) return block(EVIDENCE_BLOCK_REASON);
    return emit({});
  }
  return emit({});
}

function runCli() {
  try {
    const raw = fs.readFileSync(0, "utf8");
    const data = JSON.parse(raw);
    handle(data);
  } catch (error) {
    process.stderr.write(`HOOK ERROR [${HOOK_NAME}]: ${error.message || error}\n`);
    process.exit(2);
  }
}

if (require.main === module) runCli();

module.exports = {
  evaluatePdiPreTool,
  evaluatePdiStop,
  isPdiPromptRelevant,
  productionDataIntegrityContext,
  productionDataSubagentContext,
};
