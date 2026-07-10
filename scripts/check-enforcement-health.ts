#!/usr/bin/env npx tsx
/**
 * Enforcement Health Check — validates the ENTIRE enforcement system integrity.
 *
 * Goes beyond "0 errors" (ratchet) to check LOGIC, CONSISTENCY, and COMPLETENESS
 * of hooks, memory, rules, and cross-references.
 *
 * Designed for non-code tasks (memory, hooks, rules changes) where ratchet:check
 * doesn't fire because there's no git commit.
 *
 * Usage: npm run enforcement:check
 */
import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "node:child_process";

const CANONICAL_WINDOWS_ROOT = "c:/project/people-first-app";
const ROOT = path.resolve(process.env.ZENFLOW_REPO_ROOT ?? process.cwd());
const HOOKS_DIR = path.join(ROOT, ".claude", "hooks");
const CODEX_HOOKS_DIR = path.join(ROOT, ".codex", "hooks");
const CODEX_HOOKS_JSON = path.join(ROOT, ".codex", "hooks.json");
const RULES_DIR = path.join(ROOT, ".claude", "rules");
const SETTINGS = path.join(ROOT, ".claude", "settings.json");
const CLAUDE_MD = path.join(ROOT, "CLAUDE.md");
const DOCS_DIR = path.join(ROOT, "docs");
const GITIGNORE = path.join(ROOT, ".gitignore");

// Memory is in user-level dir
const MEMORY_DIR = process.env.ZENFLOW_MEMORY_DIR
  ? path.resolve(process.env.ZENFLOW_MEMORY_DIR)
  : path.join(
      process.env.HOME ?? "",
      ".claude",
      "projects",
      "c--project-people-first-app",
      "memory",
    );
const MEMORY_INDEX = path.join(MEMORY_DIR, "MEMORY.md");

interface CheckResult {
  name: string;
  status: "PASS" | "FAIL" | "WARN";
  detail: string;
}

const results: CheckResult[] = [];
let failCount = 0;
let warnCount = 0;

function pass(name: string, detail: string) {
  results.push({ name, status: "PASS", detail });
}

function fail(name: string, detail: string) {
  results.push({ name, status: "FAIL", detail });
  failCount++;
}

function warn(name: string, detail: string) {
  results.push({ name, status: "WARN", detail });
  warnCount++;
}

function toRepoPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const lower = normalized.toLowerCase();
  if (lower.startsWith(CANONICAL_WINDOWS_ROOT)) {
    const relative = normalized
      .slice(CANONICAL_WINDOWS_ROOT.length)
      .replace(/^\/+/, "");
    return path.join(ROOT, relative);
  }
  if (/^[A-Za-z]:\//.test(normalized) || path.isAbsolute(filePath)) {
    return path.normalize(filePath);
  }
  return path.join(ROOT, normalized);
}

function isLocalLearningHook(filePath: string): boolean {
  return filePath.replace(/\\/g, "/").includes(".claude/learning/");
}

function matcherIncludesAll(matcher: string, tools: string[]): boolean {
  const parts = matcher
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
  return tools.every((tool) => parts.includes(tool));
}

// ============================================================
// SECTION 1: HOOK SYSTEM INTEGRITY
// ============================================================

function checkHookSystem() {
  console.log("\n  HOOK SYSTEM INTEGRITY\n");

  // 1a. settings.json parseable
  let settings: any;
  try {
    settings = JSON.parse(fs.readFileSync(SETTINGS, "utf8"));
    pass("settings.json", "Valid JSON");
  } catch {
    fail("settings.json", "Cannot parse settings.json");
    return;
  }

  // 1b. Extract all hook file paths from settings
  const hookPaths: string[] = [];
  const hookEvents = settings.hooks || {};
  for (const [event, matchers] of Object.entries(hookEvents)) {
    for (const matcher of matchers as any[]) {
      const hooks = matcher.hooks || [];
      for (const hook of hooks) {
        if (hook.command) {
          const match = hook.command.match(/node\s+(.+\.cjs)/);
          if (match) hookPaths.push(match[1]);
        }
      }
    }
  }

  function requiredHookRegistered(
    event: string,
    tools: string[],
    hookName: string,
  ): boolean {
    const matchers = (hookEvents[event] || []) as any[];
    return matchers.some((matcher) => {
      if (!matcherIncludesAll(String(matcher.matcher || ""), tools)) return false;
      return (matcher.hooks || []).some((hook: any) =>
        String(hook.command || "").includes(`.claude/hooks/${hookName}`),
      );
    });
  }

  if (
    requiredHookRegistered(
      "PreToolUse",
      ["Edit", "Write", "MultiEdit"],
      "test-first-gate.cjs",
    )
  ) {
    pass(
      "required:test-first-gate",
      "Registered for PreToolUse Edit|Write|MultiEdit",
    );
  } else {
    fail(
      "required:test-first-gate",
      "test-first-gate.cjs must be registered for PreToolUse Edit|Write|MultiEdit",
    );
  }

  // 1c. All registered hooks exist on disk
  const diskHooks = fs
    .readdirSync(HOOKS_DIR)
    .filter((f) => f.endsWith(".cjs") && !f.startsWith("test-"));
  for (const hp of hookPaths) {
    const normalized = hp.replace(/\\/g, "/");
    const resolved = toRepoPath(normalized);
    if (fs.existsSync(resolved)) {
      pass(`hook:${path.basename(normalized)}`, "Exists on disk");
    } else if (isLocalLearningHook(normalized)) {
      warn(
        `hook:${path.basename(normalized)}`,
        `Registered local learning hook is not present in this checkout: ${normalized}`,
      );
    } else {
      fail(
        `hook:${path.basename(normalized)}`,
        `Registered in settings.json but file missing: ${normalized}`,
      );
    }
  }

  // 1d. All disk hooks are registered
  for (const dh of diskHooks) {
    const isRegistered = hookPaths.some((hp) => hp.includes(dh));
    if (isRegistered) {
      pass(`registered:${dh}`, "Registered in settings.json");
    } else {
      warn(
        `registered:${dh}`,
        `Exists on disk but NOT registered in settings.json — orphan?`,
      );
    }
  }

  // 1e. Hook count consistency (CLAUDE.md vs actual)
  const claudeMd = fs.readFileSync(CLAUDE_MD, "utf8");
  const hookCountMatch = claudeMd.match(
    /(\d+)\s+hooks?(?:,\s*(\d+)\s+blocking|\s+across\s+\d+\s+event\s+types?)/,
  );
  if (hookCountMatch) {
    const declaredTotal = parseInt(hookCountMatch[1]);
    const actualTotal = diskHooks.length;
    if (declaredTotal === actualTotal) {
      pass(
        "hook-count",
        `CLAUDE.md says ${declaredTotal}, disk has ${actualTotal}`,
      );
    } else {
      fail(
        "hook-count",
        `CLAUDE.md says ${declaredTotal} hooks but disk has ${actualTotal}`,
      );
    }
  } else {
    warn("hook-count", "Could not parse hook count from CLAUDE.md");
  }

  // 1f. CRITICAL: No hook uses process.env.CLAUDE_FILE_PATH (the bug that broke everything)
  for (const dh of diskHooks) {
    const content = fs.readFileSync(path.join(HOOKS_DIR, dh), "utf8");
    if (
      content.includes("process.env.CLAUDE_FILE_PATH") ||
      content.includes("process.env.CLAUDE_FILE")
    ) {
      fail(
        `no-env-var:${dh}`,
        "Uses CLAUDE_FILE_PATH env var — this does NOT exist in SDK! Must use stdin JSON.",
      );
    } else {
      pass(`no-env-var:${dh}`, "Uses stdin JSON (correct)");
    }
  }

  function hasStdinJsonInput(content: string): boolean {
    return (
      content.includes("process.stdin.on('data'") ||
      content.includes('process.stdin.on("data"') ||
      /\breadStdin\s*\(/.test(content) ||
      /readFileSync\s*\(\s*0\s*,/.test(content) ||
      /readFileSync\s*\(\s*["']\/dev\/stdin["']/.test(content)
    );
  }

  function isSharedValidationModule(content: string): boolean {
    return (
      content.includes("NOT a standalone hook") ||
      content.includes("Evidence Veracity Module")
    );
  }

  function hasExplicitNoInputContract(content: string): boolean {
    return /Hook input:\s*not required/i.test(content);
  }

  // 1g. Hooks either parse stdin JSON or explicitly document why no tool input is required.
  for (const dh of diskHooks) {
    const content = fs.readFileSync(path.join(HOOKS_DIR, dh), "utf8");
    if (hasStdinJsonInput(content)) {
      pass(`stdin-parse:${dh}`, "Has stdin JSON parsing");
    } else if (isSharedValidationModule(content)) {
      pass(
        `stdin-parse:${dh}`,
        "Shared validation module; stdin handled by caller",
      );
    } else if (hasExplicitNoInputContract(content)) {
      pass(
        `stdin-parse:${dh}`,
        "Explicitly documents no stdin/tool input requirement",
      );
    } else {
      fail(
        `stdin-parse:${dh}`,
        "Missing stdin JSON parsing or explicit no-input contract",
      );
    }
  }

  // 1h. Security hooks use exit(2) in catch blocks (fail-closed)
  const securityHooks = [
    "protected-files.cjs",
    "preflight-gate.cjs",
    "commit-gate.cjs",
    "test-first-gate.cjs",
  ];
  for (const sh of securityHooks) {
    const filePath = path.join(HOOKS_DIR, sh);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, "utf8");
    if (content.includes("process.exit(2)")) {
      pass(`fail-closed:${sh}`, "Has exit(2) — fail-closed on error");
    } else {
      fail(
        `fail-closed:${sh}`,
        "Missing exit(2) — security hook would fail-OPEN on crash!",
      );
    }
  }

  // 1i. Advisory hooks DON'T block on error (exit(0) in catch)
  const advisoryHooks = [
    "goal-drift-check.cjs",
    "ide-diagnostic-gate.cjs",
    "auto-format.cjs",
    "preflight-inject.cjs",
  ];
  for (const ah of advisoryHooks) {
    const filePath = path.join(HOOKS_DIR, ah);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, "utf8");
    // Check that catch blocks don't exit(2)
    const catchBlocks =
      content.match(/catch\s*(\([^)]*\))?\s*\{[^}]*\}/g) || [];
    const hasBlockingCatch = catchBlocks.some((cb) =>
      cb.includes("process.exit(2)"),
    );
    if (hasBlockingCatch) {
      warn(
        `advisory-safe:${ah}`,
        "Advisory hook has exit(2) in catch — could block unnecessarily",
      );
    } else {
      pass(
        `advisory-safe:${ah}`,
        "Does not block on error (correct for advisory)",
      );
    }
  }
}

// ============================================================
// SECTION 1B: CODEX SKILL ROUTING INTEGRITY
// ============================================================

function checkCodexSkillRouting() {
  console.log("\n  CODEX SKILL ROUTING INTEGRITY\n");

  let codexHooksConfig: any = {};
  if (!fs.existsSync(CODEX_HOOKS_JSON)) {
    fail(
      "codex:hooks-json",
      ".codex/hooks.json missing; Codex skill routing is not registered",
    );
  } else {
    try {
      codexHooksConfig = JSON.parse(fs.readFileSync(CODEX_HOOKS_JSON, "utf8"));
      pass("codex:hooks-json", "Valid JSON");
    } catch {
      fail("codex:hooks-json", "Cannot parse .codex/hooks.json");
    }
  }

  const hookEvents = codexHooksConfig.hooks || {};

  function codexHookRegistered(
    event: string,
    tools: string[],
    hookName: string,
  ): boolean {
    const matchers = (hookEvents[event] || []) as any[];
    return matchers.some((matcher) => {
      if (tools.length > 0 && !matcherIncludesAll(String(matcher.matcher || ""), tools)) {
        return false;
      }
      return (matcher.hooks || []).some((hook: any) =>
        String(hook.command || "").includes(`.codex/hooks/${hookName}`),
      );
    });
  }

  if (codexHookRegistered("UserPromptSubmit", [], "skill-router-gate.cjs")) {
    pass(
      "codex:skill-router-prompt",
      "Registered for UserPromptSubmit context injection",
    );
  } else {
    fail(
      "codex:skill-router-prompt",
      "skill-router-gate.cjs must be registered for UserPromptSubmit",
    );
  }

  if (
    codexHookRegistered(
      "PreToolUse",
      ["apply_patch", "Edit", "Write", "MultiEdit"],
      "skill-router-gate.cjs",
    )
  ) {
    pass(
      "codex:skill-router-pretool",
      "Registered for PreToolUse apply_patch|Edit|Write|MultiEdit",
    );
  } else {
    fail(
      "codex:skill-router-pretool",
      "skill-router-gate.cjs must guard PreToolUse apply_patch|Edit|Write|MultiEdit",
    );
  }

  const hookPath = path.join(CODEX_HOOKS_DIR, "skill-router-gate.cjs");
  if (!fs.existsSync(hookPath)) {
    fail(
      "codex:skill-router-file",
      ".codex/hooks/skill-router-gate.cjs missing",
    );
    return;
  }

  pass("codex:skill-router-file", "Exists on disk");
  const content = fs.readFileSync(hookPath, "utf8");
  if (
    content.includes("readFileSync(0") ||
    content.includes("process.stdin.on('data'") ||
    content.includes('process.stdin.on("data"')
  ) {
    pass("codex:skill-router-stdin", "Has stdin JSON parsing");
  } else {
    fail("codex:skill-router-stdin", "Missing stdin JSON parsing");
  }

  if (content.includes("process.exit(2)")) {
    pass("codex:skill-router-fail-closed", "Has exit(2) fail-closed path");
  } else {
    fail(
      "codex:skill-router-fail-closed",
      "Missing exit(2); guarded hook would fail open on error",
    );
  }
  if (codexHookRegistered("UserPromptSubmit", [], "no-ai-template-gate.cjs")) {
    pass(
      "codex:no-ai-template-prompt",
      "Registered for UserPromptSubmit no-template context injection",
    );
  } else {
    fail(
      "codex:no-ai-template-prompt",
      "no-ai-template-gate.cjs must be registered for UserPromptSubmit",
    );
  }

  if (codexHookRegistered("Stop", [], "no-ai-template-gate.cjs")) {
    pass(
      "codex:no-ai-template-stop",
      "Registered for Stop output review",
    );
  } else {
    fail(
      "codex:no-ai-template-stop",
      "no-ai-template-gate.cjs must be registered for Stop",
    );
  }

  if (codexHookRegistered("SubagentStart", [], "no-ai-template-gate.cjs")) {
    pass(
      "codex:no-ai-template-subagent-start",
      "Registered for SubagentStart context injection",
    );
  } else {
    fail(
      "codex:no-ai-template-subagent-start",
      "no-ai-template-gate.cjs must be registered for SubagentStart",
    );
  }

  if (codexHookRegistered("SubagentStop", [], "no-ai-template-gate.cjs")) {
    pass(
      "codex:no-ai-template-subagent-stop",
      "Registered for SubagentStop output review",
    );
  } else {
    fail(
      "codex:no-ai-template-subagent-stop",
      "no-ai-template-gate.cjs must be registered for SubagentStop",
    );
  }

  const noAiHookPath = path.join(CODEX_HOOKS_DIR, "no-ai-template-gate.cjs");
  if (!fs.existsSync(noAiHookPath)) {
    fail(
      "codex:no-ai-template-file",
      ".codex/hooks/no-ai-template-gate.cjs missing",
    );
  } else {
    pass("codex:no-ai-template-file", "Exists on disk");
    const noAiContent = fs.readFileSync(noAiHookPath, "utf8");
    if (noAiContent.includes("readFileSync(0")) {
      pass("codex:no-ai-template-stdin", "Has stdin JSON parsing");
    } else {
      fail("codex:no-ai-template-stdin", "Missing stdin JSON parsing");
    }
    for (const marker of [
      "NO AI TEMPLATE GATE",
      "SUBAGENT EVIDENCE CONTRACT",
      "Best-Practices-Only Proposal Gate",
      "best-practices laundering",
      "subagent proof laundering",
      "SubagentStop",
      "process.exit(2)",
    ]) {
      if (noAiContent.includes(marker)) {
        pass("codex:no-ai-template-marker:" + marker, "Required marker present");
      } else {
        fail("codex:no-ai-template-marker:" + marker, "Required marker missing");
      }
    }
  }
}

function checkProductionDataIntegrity() {
  console.log("\n  PRODUCTION DATA INTEGRITY\n");

  const requiredFiles = [
    "config/production-data-integrity.json",
    "config/production-data-integrity-baseline.json",
    "config/production-data-integrity-waivers.json",
    "scripts/check-production-data-integrity.cjs",
    "scripts/production-data-integrity/core.cjs",
    ".codex/hooks/production-data-integrity-gate.cjs",
    ".github/workflows/production-data-integrity.yml",
    "docs/ai/PRODUCTION_DATA_INTEGRITY_POLICY.md",
    "docs/adr/0010-production-data-integrity-enforcement.md",
    "scripts/__tests__/production-data-integrity.test.ts",
    "scripts/__tests__/production-data-integrity-hook.test.ts",
    "scripts/__tests__/production-data-integrity-workflow.test.ts",
  ];
  for (const relativePath of requiredFiles) {
    if (fs.existsSync(path.join(ROOT, relativePath))) pass(`pdi:file:${relativePath}`, "Exists");
    else fail(`pdi:file:${relativePath}`, "Required production-data integrity surface is missing");
  }

  try {
    const hooks = JSON.parse(fs.readFileSync(CODEX_HOOKS_JSON, "utf8"));
    for (const event of ["UserPromptSubmit", "PreToolUse", "PostToolUse", "Stop", "SubagentStart", "SubagentStop"]) {
      const registered = (hooks.hooks?.[event] || []).some((matcher: any) =>
        (matcher.hooks || []).some((hook: any) => String(hook.command || "").includes("production-data-integrity-gate.cjs")),
      );
      if (registered) pass(`pdi:hook:${event}`, "Registered");
      else fail(`pdi:hook:${event}`, "production-data-integrity-gate.cjs is not registered");
    }
  } catch (error) {
    fail("pdi:hooks-json", `Cannot validate hook registration: ${error instanceof Error ? error.message : String(error)}`);
  }

  const hookPath = path.join(CODEX_HOOKS_DIR, "production-data-integrity-gate.cjs");
  if (fs.existsSync(hookPath)) {
    const hook = fs.readFileSync(hookPath, "utf8");
    for (const marker of ["PRODUCTION DATA INTEGRITY GATE", "resolveRepositoryRoot", "stop_hook_active", "SubagentStop", "process.exit(2)"]) {
      if (hook.includes(marker)) pass(`pdi:hook-marker:${marker}`, "Present");
      else fail(`pdi:hook-marker:${marker}`, "Missing");
    }
  }

  const corePath = path.join(ROOT, "scripts/production-data-integrity/core.cjs");
  if (fs.existsSync(corePath)) {
    const core = fs.readFileSync(corePath, "utf8");
    for (const marker of [
      "REQUIRED_CONFIG_VALUES",
      "PINNED_CONFIG_DIGESTS",
      "CANONICAL_PACKAGE_SCRIPTS",
      "materializeIndex",
      "TextDecoder",
      "assertExistingRealpathInsideRoot",
      "findEvidenceStatuses",
      "EVIDENCE_PROOF_KEYS",
      "explicit bundle directory is missing",
      'entry.ruleId === "PDI010"',
    ]) {
      if (core.includes(marker)) pass(`pdi:core-marker:${marker}`, "Present");
      else fail(`pdi:core-marker:${marker}`, "Missing");
    }
  }

  try {
    const config = JSON.parse(fs.readFileSync(path.join(ROOT, "config/production-data-integrity.json"), "utf8"));
    const ruleIds = Object.keys(config.rules || {}).sort();
    const expected = Array.from({ length: 12 }, (_, index) => `PDI${String(index + 1).padStart(3, "0")}`);
    if (JSON.stringify(ruleIds) === JSON.stringify(expected)) pass("pdi:rules", "PDI001-PDI012 present");
    else fail("pdi:rules", `Expected ${expected.join(", ")}; got ${ruleIds.join(", ")}`);
    if (config.rules?.PDI012?.severity === "warning" && config.rules?.PDI012?.confidence === "medium") {
      pass("pdi:warning-boundary", "PDI012 remains medium warning");
    } else {
      fail("pdi:warning-boundary", "PDI012 severity/confidence contract changed");
    }
    for (const marker of ["android/app/src/main/java", "ios/App/App", "ios/App/CapApp-SPM/Sources", "src-tauri/build.rs", "public/**", "vite.config.ts", "output/*/*readiness*.json", "releaseEvidenceRoots"]) {
      if (JSON.stringify(config).includes(marker)) pass(`pdi:config-marker:${marker}`, "Present");
      else fail(`pdi:config-marker:${marker}`, "Missing canonical coverage");
    }
  } catch (error) {
    fail("pdi:config", `Cannot parse config: ${error instanceof Error ? error.message : String(error)}`);
  }

  for (const [file, field] of [
    ["config/production-data-integrity-baseline.json", "entries"],
    ["config/production-data-integrity-waivers.json", "waivers"],
  ] as const) {
    try {
      const ledger = JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
      if (ledger.schemaVersion === "1.0.0" && Array.isArray(ledger[field])) pass(`pdi:ledger:${field}`, "Exact ledger schema valid");
      else fail(`pdi:ledger:${field}`, "Ledger schema is invalid");
    } catch (error) {
      fail(`pdi:ledger:${field}`, `Cannot parse ${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const workflowPath = path.join(ROOT, ".github/workflows/production-data-integrity.yml");
  if (fs.existsSync(workflowPath)) {
    const workflow = fs.readFileSync(workflowPath, "utf8");
    for (const marker of [
      "name: production-data-integrity",
      "merge_group:",
      "contents: read",
      "node scripts/check-production-data-integrity.cjs --all --bundle dist",
      "public/pdi-ci-source-canary.json",
      "dist/assets/pdi-ci-bundle-canary.txt",
      "result.status !== 1",
    ]) {
      if (workflow.includes(marker)) pass(`pdi:workflow:${marker}`, "Present");
      else fail(`pdi:workflow:${marker}`, "Missing");
    }
    for (const forbidden of ["continue-on-error:", "|| true", "pull_request_target:", "paths:"]) {
      if (workflow.includes(forbidden)) fail(`pdi:workflow-forbidden:${forbidden}`, "Forbidden masking/skip marker present");
      else pass(`pdi:workflow-forbidden:${forbidden}`, "Absent");
    }
  }

  const packageJson = fs.readFileSync(path.join(ROOT, "package.json"), "utf8");
  for (const marker of ["check:production-data-integrity", "check:production-data-integrity:diff", "check:production-data-integrity:staged", "check:production-data-integrity:bundle"]) {
    if (packageJson.includes(`\"${marker}\"`)) pass(`pdi:package:${marker}`, "Defined");
    else fail(`pdi:package:${marker}`, "Missing package script");
  }

  const checkerPath = path.join(ROOT, "scripts/check-production-data-integrity.cjs");
  if (fs.existsSync(checkerPath)) {
    try {
      const raw = execFileSync(process.execPath, [checkerPath, "--all", "--json"], {
        cwd: ROOT,
        encoding: "utf8",
        timeout: 30000,
        stdio: ["ignore", "pipe", "pipe"],
      });
      const report = JSON.parse(raw);
      if (report.status === "PASS") pass("pdi:behavior", `Checker PASS (${report.summary?.scannedFiles ?? "?"} files)`);
      else fail("pdi:behavior", `Checker returned ${report.status}`);
    } catch (error: any) {
      let detail = error?.message || String(error);
      try {
        const report = JSON.parse(String(error?.stdout || ""));
        detail = `${report.status}: ${report.summary?.errors ?? "?"} errors`;
      } catch {}
      fail("pdi:behavior", `Full checker did not pass: ${detail}`);
    }
  }
}

// ============================================================
// SECTION 2: RULES SYSTEM INTEGRITY
// ============================================================

function checkRulesSystem() {
  console.log("\n  RULES SYSTEM INTEGRITY\n");

  // 2a. All rules files have valid frontmatter
  const ruleFiles = fs.readdirSync(RULES_DIR).filter((f) => f.endsWith(".md"));

  // 2b. Rules count in CLAUDE.md
  const claudeMd = fs.readFileSync(CLAUDE_MD, "utf8");
  const rulesCountMatch = claudeMd.match(/(\d+)\s+rule\s+files?/);
  if (rulesCountMatch) {
    const declared = parseInt(rulesCountMatch[1]);
    if (declared === ruleFiles.length) {
      pass(
        "rules-count",
        `CLAUDE.md says ${declared}, disk has ${ruleFiles.length}`,
      );
    } else {
      fail(
        "rules-count",
        `CLAUDE.md says ${declared} rule files but disk has ${ruleFiles.length}`,
      );
    }
  }

  for (const rf of ruleFiles) {
    const content = fs.readFileSync(path.join(RULES_DIR, rf), "utf8");

    // Check frontmatter exists
    if (!content.startsWith("---")) {
      fail(`frontmatter:${rf}`, "Missing frontmatter (---)");
      continue;
    }

    // Check uses description: not globs: (the IDE warning bug)
    if (content.includes("globs:")) {
      fail(
        `no-globs:${rf}`,
        'Uses "globs:" frontmatter — IDE warning! Use "description:" instead',
      );
    }

    if (content.includes("description:")) {
      pass(`frontmatter:${rf}`, "Has description: frontmatter");
    } else {
      warn(`frontmatter:${rf}`, "Missing description: in frontmatter");
    }
  }
}

// ============================================================
// SECTION 3: MEMORY SYSTEM INTEGRITY
// ============================================================

function checkMemorySystem() {
  console.log("\n  MEMORY SYSTEM INTEGRITY\n");

  if (!fs.existsSync(MEMORY_DIR)) {
    warn(
      "memory-dir",
      "Memory directory not found (may be different on other machines)",
    );
    return;
  }

  // 3a. MEMORY.md exists and is under 200 lines
  if (fs.existsSync(MEMORY_INDEX)) {
    const content = fs.readFileSync(MEMORY_INDEX, "utf8");
    const lines = content.split("\n").length;
    if (lines <= 200) {
      pass(
        "memory-index",
        `MEMORY.md exists, ${lines} lines (under 200 limit)`,
      );
    } else {
      fail(
        "memory-index",
        `MEMORY.md has ${lines} lines — exceeds 200-line truncation limit!`,
      );
    }
  } else {
    fail("memory-index", "MEMORY.md missing");
    return;
  }

  // 3b. All .md files in memory dir have frontmatter (except MEMORY.md itself)
  const memFiles = fs
    .readdirSync(MEMORY_DIR)
    .filter((f) => f.endsWith(".md") && f !== "MEMORY.md");
  for (const mf of memFiles) {
    const content = fs.readFileSync(path.join(MEMORY_DIR, mf), "utf8");
    if (content.startsWith("---") && content.includes("type:")) {
      pass(`memory-fm:${mf}`, "Has valid frontmatter with type");
    } else if (mf === "ARCHITECTURE.md") {
      // Architecture reference is special
      pass(`memory-fm:${mf}`, "Architecture reference (special format)");
    } else {
      warn(`memory-fm:${mf}`, "Missing frontmatter or type field");
    }
  }

  // 3c. Cross-reference: files referenced in MEMORY.md should exist
  const memoryContent = fs.readFileSync(MEMORY_INDEX, "utf8");
  const mdLinkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  const checkedPaths = new Set<string>();
  while ((match = mdLinkPattern.exec(memoryContent)) !== null) {
    const linkTarget = match[2];
    // Skip external links and anchors
    if (linkTarget.startsWith("http") || linkTarget.startsWith("#")) continue;

    // Memory-local references
    if (!linkTarget.includes("/") && linkTarget.endsWith(".md")) {
      const fullPath = path.join(MEMORY_DIR, linkTarget);
      if (checkedPaths.has(fullPath)) continue;
      checkedPaths.add(fullPath);
      if (fs.existsSync(fullPath)) {
        pass(`ref:${linkTarget}`, "Referenced file exists");
      } else {
        fail(
          `ref:${linkTarget}`,
          `Referenced in MEMORY.md but file missing: ${fullPath}`,
        );
      }
    }

    // Docs references
    if (linkTarget.startsWith("docs/")) {
      const fullPath = path.join(ROOT, linkTarget);
      if (checkedPaths.has(fullPath)) continue;
      checkedPaths.add(fullPath);
      if (fs.existsSync(fullPath)) {
        pass(`ref:${linkTarget}`, "Referenced doc exists");
      } else {
        fail(
          `ref:${linkTarget}`,
          `Referenced in MEMORY.md but file missing: ${fullPath}`,
        );
      }
    }
  }

  // 3d. Orphan check — memory files not referenced anywhere
  for (const mf of memFiles) {
    if (!memoryContent.includes(mf)) {
      // Check if referenced from rules instead
      let referencedElsewhere = false;
      const ruleFiles = fs
        .readdirSync(RULES_DIR)
        .filter((f) => f.endsWith(".md"));
      for (const rf of ruleFiles) {
        const ruleContent = fs.readFileSync(path.join(RULES_DIR, rf), "utf8");
        if (ruleContent.includes(mf)) {
          referencedElsewhere = true;
          break;
        }
      }
      if (referencedElsewhere) {
        pass(`orphan:${mf}`, "Not in MEMORY.md but referenced from rules/");
      } else {
        warn(
          `orphan:${mf}`,
          "Not referenced in MEMORY.md or rules — potential orphan",
        );
      }
    }
  }
}

// ============================================================
// SECTION 4: LAW SPEC INTEGRITY
// ============================================================

function checkLawSpecs() {
  console.log("\n  LAW SPEC INTEGRITY\n");

  const requiredLawFiles = [
    "laws1-7.md",
    "laws8-13.md",
    "laws14-15.md",
    "law16-mirror.md",
    "laws17-20.md",
    "law21-surgeon.md",
    "law22-artisan.md",
    "law23-philosopher.md",
    "law24-empathy.md",
    "law25-concurrency.md",
    "law26-techdebt.md",
    "law27-ratchet.md",
    "law28-alchemist.md",
    "visual-aesthetic.md",
  ];

  // 4a. All 14 spec files exist
  let existCount = 0;
  for (const lf of requiredLawFiles) {
    const fullPath = path.join(DOCS_DIR, lf);
    if (fs.existsSync(fullPath)) {
      existCount++;
    } else {
      warn(
        `law-spec:${lf}`,
        "Local law spec file missing; these private docs are intentionally gitignored",
      );
    }
  }
  if (existCount === requiredLawFiles.length) {
    pass("law-specs", `All ${requiredLawFiles.length} law spec files exist`);
  } else {
    warn(
      "law-specs",
      `${existCount}/${requiredLawFiles.length} private law spec files present in this checkout`,
    );
  }

  // 4b. commit-gate REQUIRED_LAW_FILES matches our list
  const commitGate = fs.readFileSync(
    path.join(HOOKS_DIR, "commit-gate.cjs"),
    "utf8",
  );
  const gateMatch = commitGate.match(/REQUIRED_LAW_FILES\s*=\s*\[([\s\S]*?)\]/);
  if (gateMatch) {
    const gateFiles =
      gateMatch[1].match(/'([^']+)'/g)?.map((s) => s.replace(/'/g, "")) || [];
    const missing = requiredLawFiles.filter((f) => !gateFiles.includes(f));
    const extra = gateFiles.filter((f) => !requiredLawFiles.includes(f));
    if (missing.length === 0 && extra.length === 0) {
      pass(
        "law-gate-sync",
        "commit-gate REQUIRED_LAW_FILES matches all 14 specs",
      );
    } else {
      if (missing.length > 0)
        fail(
          "law-gate-sync",
          `Missing from commit-gate: ${missing.join(", ")}`,
        );
      if (extra.length > 0)
        warn("law-gate-sync", `Extra in commit-gate: ${extra.join(", ")}`);
    }
  }

  // 4c. Law docs gitignored (should NOT be committed)
  const gitignore = fs.readFileSync(GITIGNORE, "utf8");
  if (gitignore.includes("docs/law") || gitignore.includes("law*.md")) {
    pass("law-gitignore", "Law docs pattern in .gitignore");
  } else {
    fail(
      "law-gitignore",
      "Law docs NOT in .gitignore — could be accidentally committed",
    );
  }
}

// ============================================================
// SECTION 5: GITIGNORE COMPLETENESS
// ============================================================

function checkGitignore() {
  console.log("\n  GITIGNORE COMPLETENESS\n");

  const gitignore = fs.readFileSync(GITIGNORE, "utf8");
  const required = [
    { pattern: ".preflight-token", desc: "PRE-FLIGHT token" },
    { pattern: ".test-first-token", desc: "TEST-FIRST token" },
    { pattern: ".skill-routing-token", desc: "SKILL-ROUTING token" },
    { pattern: ".Codex-md-unlock", desc: "Codex one-time unlock token" },
    { pattern: ".postflight-done", desc: "POST-FLIGHT token" },
    { pattern: ".fullcycle-active", desc: "Full cycle flag" },
    { pattern: ".fullcycle-laws-read", desc: "Laws read token" },
    { pattern: ".claude-audit.log", desc: "Audit log" },
    { pattern: ".prettier-circuit-breaker", desc: "Circuit breaker state" },
    { pattern: ".env", desc: "Environment secrets" },
  ];

  for (const r of required) {
    if (gitignore.includes(r.pattern)) {
      pass(`gitignore:${r.pattern}`, r.desc);
    } else {
      fail(`gitignore:${r.pattern}`, `${r.desc} NOT in .gitignore`);
    }
  }
}

// ============================================================
// SECTION 6: CROSS-SYSTEM CONSISTENCY
// ============================================================

function checkCrossSystem() {
  console.log("\n  CROSS-SYSTEM CONSISTENCY\n");

  // 6a. Protected files in hook match what CLAUDE.md says is sensitive
  const protectedHook = fs.readFileSync(
    path.join(HOOKS_DIR, "protected-files.cjs"),
    "utf8",
  );
  const blockedMatch = protectedHook.match(/BLOCKED\s*=\s*\[([\s\S]*?)\]/);
  if (blockedMatch) {
    const blockedFiles =
      blockedMatch[1].match(/'([^']+)'/g)?.map((s) => s.replace(/'/g, "")) ||
      [];
    const mustProtect = [".env", ".env.local", ".env.production"];
    for (const mp of mustProtect) {
      if (blockedFiles.includes(mp)) {
        pass(`protected:${mp}`, "In BLOCKED list");
      } else {
        fail(`protected:${mp}`, "NOT in protected-files.cjs BLOCKED list");
      }
    }
    // Audit log self-protection
    if (blockedFiles.includes(".claude-audit.log")) {
      pass("protected:audit-log", "Audit log is self-protected");
    } else {
      fail("protected:audit-log", "Audit log NOT protected from agent writes");
    }
  }

  // 6b. MEMORY.md hook table row count matches actual hooks
  if (fs.existsSync(MEMORY_INDEX)) {
    const memContent = fs.readFileSync(MEMORY_INDEX, "utf8");
    const hookTableRows = (memContent.match(/\*\*[\w-]+\.cjs\*\*/g) || [])
      .length;
    const diskHookCount = fs
      .readdirSync(HOOKS_DIR)
      .filter((f) => f.endsWith(".cjs") && !f.startsWith("test-")).length;
    if (hookTableRows === diskHookCount) {
      pass(
        "memory-hook-count",
        `MEMORY.md table has ${hookTableRows} rows, disk has ${diskHookCount} hooks`,
      );
    } else {
      fail(
        "memory-hook-count",
        `MEMORY.md table: ${hookTableRows} rows vs disk: ${diskHookCount} hooks`,
      );
    }
  }

  // 6c. Enforcement feedback memory references hooks correctly
  const feedbackPath = path.join(MEMORY_DIR, "feedback_enforcement_hooks.md");
  if (fs.existsSync(feedbackPath)) {
    const feedback = fs.readFileSync(feedbackPath, "utf8");
    const feedbackHookCount = feedback.match(/(\d+)\s+hooks?/);
    const diskHookCount = fs
      .readdirSync(HOOKS_DIR)
      .filter((f) => f.endsWith(".cjs") && !f.startsWith("test-")).length;
    if (feedbackHookCount) {
      const declared = parseInt(feedbackHookCount[1]);
      if (declared === diskHookCount) {
        pass(
          "feedback-hook-count",
          `feedback_enforcement_hooks.md says ${declared}, disk has ${diskHookCount}`,
        );
      } else {
        fail(
          "feedback-hook-count",
          `feedback says ${declared} hooks but disk has ${diskHookCount}`,
        );
      }
    }
  }
}

// ============================================================
// RUN ALL CHECKS
// ============================================================

console.log("==================================================");
console.log("  ENFORCEMENT HEALTH CHECK");
console.log("==================================================");

checkHookSystem();
checkCodexSkillRouting();
checkProductionDataIntegrity();
checkRulesSystem();
checkMemorySystem();
checkLawSpecs();
checkGitignore();
checkCrossSystem();

// ============================================================
// SUMMARY
// ============================================================

console.log("\n==================================================");
console.log("  RESULTS\n");

const statusIcon = (status: CheckResult["status"]) => {
  if (status === "FAIL") return "✗";
  if (status === "WARN") return "~";
  return "✓";
};
const statusColor = (status: CheckResult["status"]) => {
  if (status === "FAIL") return "\x1b[31m";
  if (status === "WARN") return "\x1b[33m";
  return "\x1b[32m";
};
const reset = "\x1b[0m";

for (const r of results) {
  if (r.status !== "PASS") {
    console.log(
      `  ${statusColor(r.status)}${statusIcon(r.status)}${reset}  ${r.name}: ${r.detail}`,
    );
  }
}

const passCount = results.filter((r) => r.status === "PASS").length;
console.log(
  `\n  TOTAL: ${results.length} checks — ${passCount} pass, ${failCount} fail, ${warnCount} warn`,
);

if (failCount > 0) {
  console.log(
    `\n  ${statusColor("FAIL")}RESULT: FAIL (${failCount} failures)${reset}`,
  );
  console.log("==================================================\n");
  process.exit(1);
} else if (warnCount > 0) {
  console.log(
    `\n  ${statusColor("WARN")}RESULT: PASS with ${warnCount} warning(s)${reset}`,
  );
  console.log("==================================================\n");
  process.exit(0);
} else {
  console.log(`\n  ${statusColor("PASS")}RESULT: PASS (all checks green)${reset}`);
  console.log("==================================================\n");
  process.exit(0);
}
