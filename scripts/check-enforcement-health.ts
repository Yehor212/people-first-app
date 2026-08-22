#!/usr/bin/env npx tsx
/**
 * Codex enforcement health check.
 *
 * This validates the active, tracked control plane. It deliberately does not
 * count dormant prompt files or local audit volume as proof of effectiveness.
 * Runtime hook loading and effective agent permissions remain UNVERIFIED until
 * a current Codex runtime probe supplies independent evidence.
 */
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

type Status = "PASS" | "FAIL" | "UNVERIFIED";
type Result = { name: string; status: Status; detail: string };
type HookEntry = { type?: string; command?: string; commandWindows?: string; timeout?: number };
type HookGroup = { matcher?: string; hooks?: HookEntry[] };
type HookConfig = { hooks?: Record<string, HookGroup[]> };
type RoleRegistry = { roles?: Array<{ runtime_name?: string }> };

const ROOT = path.resolve(process.env.ZENFLOW_REPO_ROOT ?? process.cwd());
const HOOKS_JSON = path.join(ROOT, ".codex", "hooks.json");
const HOOKS_DIR = path.join(ROOT, ".codex", "hooks");
const results: Result[] = [];

const LIFECYCLE_ENTRYPOINTS = {
  UserPromptSubmit: "skill-router-gate.cjs",
  PreToolUse: "agent-workspace-guard.cjs",
  PostToolUse: "production-data-integrity-gate.cjs",
  Stop: "no-ai-template-gate.cjs",
  SubagentStart: "subagent-evidence-gate.cjs",
  SubagentStop: "subagent-evidence-gate.cjs",
} as const;
const REQUIRED_COMPOSITION_MARKERS: Readonly<Record<string, readonly string[]>> = {
  "skill-router-gate.cjs": [
    "buildSkillRoutingContext",
    "buildPromptContext",
    "isNoTemplatePromptRelevant",
    "isPdiPromptRelevant",
    "if (!additionalContext)",
  ],
  "agent-workspace-guard.cjs": [
    "evaluateWorkspaceEvent",
    "evaluateGuard",
    "evaluateSkillRoutingEvent",
    "evaluatePdiPreTool",
  ],
  "production-data-integrity-gate.cjs": [
    "PostToolUse",
    "effect_applied_checker_failed",
    "no rollback or automatic retry",
  ],
  "no-ai-template-gate.cjs": [
    "detectViolations",
    "evaluatePdiStop",
    "productionDataIntegrityContext",
  ],
  "subagent-evidence-gate.cjs": [
    "evaluateSubagentEvidence",
    "detectSubagentViolations",
    "loadProjectRoleNames",
    "PDI_TRUST_CONTEXT",
  ],
};

function add(name: string, status: Status, detail: string): void {
  results.push({ name, status, detail });
}

function pass(name: string, detail: string): void {
  add(name, "PASS", detail);
}

function fail(name: string, detail: string): void {
  add(name, "FAIL", detail);
}

function unverified(name: string, detail: string): void {
  add(name, "UNVERIFIED", detail);
}

function readJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch (error) {
    fail(path.relative(ROOT, filePath), error instanceof Error ? error.message : String(error));
    return null;
  }
}

function hookFileFromCommand(command: string): string | null {
  const normalized = command.replace(/\\/g, "/");
  const match = normalized.match(/\.codex\/hooks\/([A-Za-z0-9._-]+\.cjs)/);
  return match?.[1] ?? null;
}

function hasStdinContract(content: string): boolean {
  return (
    /readFileSync\s*\(\s*0\s*,/.test(content) ||
    /process\.stdin\.on\s*\(/.test(content) ||
    /async\s+function\s+readStdin\s*\(/.test(content)
  );
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function expectedProjectRoleMatcher(): string | null {
  const registry = readJson<RoleRegistry>(
    path.join(ROOT, "config", "persistent-agent-orchestra.json")
  );
  const names = registry?.roles?.map((role) => role.runtime_name?.trim() ?? "") ?? [];
  if (names.length !== 10 || names.some((name) => !name) || new Set(names).size !== 10) {
    fail(
      "subagent-role-registry",
      "persistent-agent-orchestra.json must contain exactly ten unique non-empty runtime_name values"
    );
    return null;
  }
  return `^(?:${names.map(escapeRegex).join("|")})$`;
}

function validateHooks(): void {
  const config = readJson<HookConfig>(HOOKS_JSON);
  if (!config?.hooks) return;
  if (!existsSync(HOOKS_DIR)) {
    fail("codex-hooks-dir", ".codex/hooks is missing");
    return;
  }
  if (lstatSync(HOOKS_DIR).isSymbolicLink()) {
    fail("codex-hooks-dir", ".codex/hooks must not be a symbolic link");
    return;
  }

  const registeredByEvent = new Map<string, string[]>();
  const registeredFiles = new Set<string>();
  let registeredCommandCount = 0;
  for (const [event, groups] of Object.entries(config.hooks)) {
    const eventFiles: string[] = [];
    for (const group of groups) {
      for (const hook of group.hooks ?? []) {
        if (hook.type !== "command") {
          fail(
            `hook-type:${event}`,
            `unsupported registered hook type: ${String(hook.type ?? "")}`
          );
          continue;
        }
        registeredCommandCount += 1;
        const command = String(hook.command ?? "");
        if (!command) {
          fail(`hook-command:${event}`, "registered hook command is empty");
          continue;
        }
        if (/\.claude[\\/]/i.test(command)) {
          fail(`hook-command:${event}`, "legacy .claude hook command remains registered");
        }
        const filename = hookFileFromCommand(command);
        if (!filename) {
          fail(`hook-command:${event}`, `command is not confined to .codex/hooks: ${command}`);
          continue;
        }
        const windowsFilename = hookFileFromCommand(String(hook.commandWindows ?? ""));
        if (windowsFilename !== filename) {
          fail(
            `hook-command-windows:${event}`,
            "commandWindows must resolve to the same .codex/hooks entrypoint as command"
          );
        }
        eventFiles.push(filename);
        registeredFiles.add(filename);
      }
    }
    registeredByEvent.set(event, eventFiles);
  }

  if (registeredCommandCount === 6) {
    pass("hook-command-count", "exactly six lifecycle handler commands are registered");
  } else {
    fail(
      "hook-command-count",
      `expected exactly 6 registered commands, found ${registeredCommandCount}`
    );
  }

  for (const [event, filename] of Object.entries(LIFECYCLE_ENTRYPOINTS)) {
    const eventFiles = registeredByEvent.get(event) ?? [];
    if (eventFiles.length !== 1) {
      fail(`registration:${event}`, `expected exactly one command, found ${eventFiles.length}`);
      continue;
    }
    if (eventFiles[0] === filename) {
      pass(`registration:${event}:${filename}`, "sole lifecycle entrypoint is registered");
    } else {
      fail(`registration:${event}:${filename}`, `expected ${filename}, found ${eventFiles[0]}`);
    }
  }
  for (const event of registeredByEvent.keys()) {
    if (!(event in LIFECYCLE_ENTRYPOINTS)) {
      fail(`registration:${event}`, "unexpected lifecycle event has a registered command");
    }
  }

  const preGroups = config.hooks.PreToolUse ?? [];
  const preCommands = preGroups.flatMap((group) => group.hooks ?? []);
  const preCommand = preCommands[0];
  if (
    preCommands.length === 1 &&
    /(?:^|\s)--expected-agent\s+codex(?:\s|$)/.test(String(preCommand.command ?? "")) &&
    /(?:^|\s)--expected-agent\s+codex(?:["\s]|$)/.test(String(preCommand.commandWindows ?? ""))
  ) {
    pass("pretool-actor-binding", "consolidated PreToolUse command is bound to the codex actor");
  } else {
    fail("pretool-actor-binding", "PreToolUse must bind both commands to --expected-agent codex");
  }

  const expectedMatcher = expectedProjectRoleMatcher();
  if (expectedMatcher) {
    for (const event of ["SubagentStart", "SubagentStop"] as const) {
      const groups = config.hooks[event] ?? [];
      if (groups.length === 1 && groups[0].matcher === expectedMatcher) {
        pass(
          `subagent-matcher:${event}`,
          "matcher is anchored to the exact ten project role names"
        );
      } else {
        fail(
          `subagent-matcher:${event}`,
          "matcher must equal the anchored exact-ten runtime_name set"
        );
      }
    }
  }

  const diskFiles = readdirSync(HOOKS_DIR)
    .filter((name) => name.endsWith(".cjs"))
    .sort();
  for (const filename of registeredFiles) {
    const filePath = path.join(HOOKS_DIR, filename);
    if (!existsSync(filePath)) {
      fail(`hook-file:${filename}`, "registered hook file is missing");
      continue;
    }
    if (lstatSync(filePath).isSymbolicLink()) {
      fail(`hook-file:${filename}`, "registered hook must not be a symbolic link");
      continue;
    }
    const content = readFileSync(filePath, "utf8");
    if (hasStdinContract(content)) pass(`hook-stdin:${filename}`, "parses hook input from stdin");
    else fail(`hook-stdin:${filename}`, "missing explicit stdin input contract");
    if (content.includes("process.exit(2)"))
      pass(`hook-fail-closed:${filename}`, "has blocking error path");
    else fail(`hook-fail-closed:${filename}`, "missing process.exit(2) fail-closed path");
    for (const marker of REQUIRED_COMPOSITION_MARKERS[filename] ?? []) {
      if (content.includes(marker)) {
        pass(`hook-composition:${filename}:${marker}`, "required union evaluator is composed");
      } else {
        fail(
          `hook-composition:${filename}:${marker}`,
          "required union evaluator marker is missing"
        );
      }
    }
    try {
      execFileSync(process.execPath, ["--check", filePath], {
        cwd: ROOT,
        encoding: "utf8",
        timeout: 5_000,
        stdio: ["ignore", "pipe", "pipe"],
      });
      pass(`hook-syntax:${filename}`, "node --check passed");
    } catch (error) {
      fail(`hook-syntax:${filename}`, error instanceof Error ? error.message : String(error));
    }
  }

  const unexpectedDiskFiles: string[] = [];
  for (const filename of diskFiles) {
    if (registeredFiles.has(filename)) continue;
    unexpectedDiskFiles.push(filename);
    fail(`hook-orphan:${filename}`, "unregistered Codex hook file");
  }
  if (unexpectedDiskFiles.length === 0) {
    pass(
      "hook-inventory",
      `${registeredFiles.size} active entrypoint files implement 6 lifecycle commands; no unexpected adapters`
    );
  }
}

function runNodeGate(name: string, script: string, args: string[], timeout: number): void {
  try {
    const stdout = execFileSync(process.execPath, [script, ...args], {
      cwd: ROOT,
      encoding: "utf8",
      timeout,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    pass(name, stdout.split("\n").at(-1) || "exit 0");
  } catch (error) {
    const candidate = error as { stdout?: string; stderr?: string; message?: string };
    const detail = [candidate.stdout, candidate.stderr, candidate.message]
      .filter(Boolean)
      .join("\n")
      .trim();
    fail(name, detail || "gate failed");
  }
}

function checkProductionDataIntegrity(): void {
  runNodeGate(
    "production-data-integrity",
    "scripts/check-production-data-integrity.cjs",
    ["--diff"],
    60_000
  );

  const hookName = "production-data-integrity-gate.cjs";
  const hookPath = path.join(HOOKS_DIR, hookName);
  if (existsSync(hookPath)) {
    pass("pdi-hook-file", `${hookName} is present`);
  } else {
    fail("pdi-hook-file", `${hookName} is missing`);
  }
}

function validateCanonicalControlPlane(): void {
  runNodeGate(
    "check:agent-orchestra",
    "scripts/sync-persistent-agent-orchestra.mjs",
    ["--check"],
    20_000
  );
  runNodeGate(
    "check:agent-orchestra:eval",
    "scripts/validate-persistent-agent-orchestra-eval-report.mjs",
    ["--catalog"],
    20_000
  );
  runNodeGate("check:no-ai-templates", "scripts/check-no-ai-templates.cjs", [], 30_000);
  checkProductionDataIntegrity();

  const bridge = readFileSync(path.join(ROOT, "CLAUDE.md"), "utf8");
  if (bridge.trimStart().startsWith("@AGENTS.md") && !/\.claude\/agents|Ruflow/i.test(bridge)) {
    pass("claude-bridge", "thin compatibility bridge only; no competing role source");
  } else {
    fail("claude-bridge", "CLAUDE.md must remain a thin bridge without role prompts");
  }

  for (const relativePath of [
    ".claude/agents",
    ".claude/hooks",
    ".claude/rules",
    ".claude/skills",
    ".claude/settings.json",
    "tools/ruflow-plus",
    "scripts/sync-ruflow-plus.mjs",
    "CLAUDE_CONTEXT.md",
    ".github/hooks/context-mode.json",
    ".github/workflows/claude-agent.yml",
    ".github/workflows/claude-review.yml",
  ]) {
    if (existsSync(path.join(ROOT, relativePath)))
      fail(`legacy:${relativePath}`, "competing live source remains");
    else pass(`legacy:${relativePath}`, "absent");
  }

  const gitignore = readFileSync(path.join(ROOT, ".gitignore"), "utf8");
  if (gitignore.includes(".codex-audit.log")) pass("audit-boundary", ".codex-audit.log is ignored");
  else fail("audit-boundary", ".codex-audit.log must stay ignored");

  unverified(
    "runtime-loading",
    "Static files and registrations cannot prove that the current Codex runtime loaded hooks or custom profiles."
  );
  unverified(
    "effective-permissions",
    "sandbox_mode and READ_ONLY_INTENT are declarations; effective inherited permissions need a current runtime probe."
  );
}

console.log("==================================================");
console.log("  CODEX ENFORCEMENT HEALTH");
console.log("==================================================");

validateHooks();
validateCanonicalControlPlane();

for (const result of results.filter((item) => item.status !== "PASS")) {
  console.log(`  ${result.status.padEnd(10)} ${result.name}: ${result.detail}`);
}

const passCount = results.filter((item) => item.status === "PASS").length;
const failCount = results.filter((item) => item.status === "FAIL").length;
const unverifiedCount = results.filter((item) => item.status === "UNVERIFIED").length;
console.log(
  `  TOTAL ${results.length}: ${passCount} PASS, ${failCount} FAIL, ${unverifiedCount} UNVERIFIED`
);

if (failCount > 0) {
  console.log("  RESULT: FAIL");
  process.exit(1);
}

console.log("  RESULT: STRUCTURAL_PASS; runtime and effective permissions remain UNVERIFIED");
