import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

type CommandHook = {
  type?: string;
  command?: string;
  commandWindows?: string;
};

type HookGroup = {
  matcher?: string;
  hooks?: CommandHook[];
};

type HooksConfig = {
  hooks?: Record<string, HookGroup[]>;
};

type RoleRegistry = {
  roles?: Array<{ runtime_name?: string }>;
};

const LIFECYCLE_EVENTS = [
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "Stop",
  "SubagentStart",
  "SubagentStop",
] as const;

const EXPECTED_ENTRYPOINTS: Record<(typeof LIFECYCLE_EVENTS)[number], string> = {
  UserPromptSubmit: ".codex/hooks/skill-router-gate.cjs",
  PreToolUse: ".codex/hooks/agent-workspace-guard.cjs",
  PostToolUse: ".codex/hooks/production-data-integrity-gate.cjs",
  Stop: ".codex/hooks/no-ai-template-gate.cjs",
  SubagentStart: ".codex/hooks/subagent-evidence-gate.cjs",
  SubagentStop: ".codex/hooks/subagent-evidence-gate.cjs",
};

const hooksConfig = JSON.parse(readFileSync(".codex/hooks.json", "utf8")) as HooksConfig;
const roleRegistry = JSON.parse(
  readFileSync("config/persistent-agent-orchestra.json", "utf8")
) as RoleRegistry;
const runtimeNames = (roleRegistry.roles ?? []).map((role) => role.runtime_name ?? "");
const subagentHookPath = resolve(".codex/hooks/subagent-evidence-gate.cjs");

function commandHooks(event: (typeof LIFECYCLE_EVENTS)[number]): CommandHook[] {
  return (hooksConfig.hooks?.[event] ?? [])
    .flatMap((group) => group.hooks ?? [])
    .filter((hook) => hook.type === "command");
}

function hookGroups(event: (typeof LIFECYCLE_EVENTS)[number]): HookGroup[] {
  return hooksConfig.hooks?.[event] ?? [];
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function runHook(hookPath: string, input: unknown) {
  return spawnSync(process.execPath, [hookPath], {
    cwd: process.cwd(),
    encoding: "utf8",
    input: JSON.stringify(input),
  });
}

function runHookWithDependencyFailure(
  hookPath: string,
  dependencyFragment: string,
  input: unknown
) {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "zenflow-hook-bootstrap-failure-"));
  const preloadPath = join(fixtureRoot, "fail-local-dependency.cjs");
  writeFileSync(
    preloadPath,
    [
      `"use strict";`,
      `const Module = require("node:module");`,
      `const originalLoad = Module._load;`,
      `Module._load = function(request, parent, isMain) {`,
      `  if (String(request).includes(${JSON.stringify(dependencyFragment)})) {`,
      `    throw new Error("isolated bootstrap fixture sentinel");`,
      `  }`,
      `  return Reflect.apply(originalLoad, this, [request, parent, isMain]);`,
      `};`,
      ``,
    ].join("\n")
  );
  try {
    return spawnSync(process.execPath, ["--require", preloadPath, hookPath], {
      cwd: process.cwd(),
      encoding: "utf8",
      input: JSON.stringify(input),
    });
  } finally {
    rmSync(fixtureRoot, { force: true, recursive: true });
  }
}

function parseSingleJsonOutput(stdout: string): Record<string, unknown> {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  expect(lines).toHaveLength(1);
  return JSON.parse(lines[0]) as Record<string, unknown>;
}

function outputText(result: ReturnType<typeof runHook>): string {
  return `${result.stdout}\n${result.stderr}`;
}

function hookBlocked(result: ReturnType<typeof runHook>): boolean {
  if (result.status !== 0) return true;
  if (!result.stdout.trim()) return false;
  const output = parseSingleJsonOutput(result.stdout);
  const hookSpecificOutput = output.hookSpecificOutput as
    | { permissionDecision?: string }
    | undefined;
  return output.decision === "block" || hookSpecificOutput?.permissionDecision === "deny";
}

function writeFixture(root: string, relativePath: string, contents: string): void {
  const target = join(root, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
}

function createStopUnionFixture(): string {
  const root = mkdtempSync(join(tmpdir(), "zenflow-hook-topology-stop-"));
  writeFixture(
    root,
    "config/production-data-integrity.json",
    readFileSync("config/production-data-integrity.json", "utf8")
  );
  writeFixture(root, ".gitignore", readFileSync(".gitignore", "utf8"));
  writeFixture(
    root,
    "scripts/check-production-data-integrity.cjs",
    [
      `require("node:fs").writeFileSync(".pdi-stop-union-invoked", process.argv.slice(2).join(" "));`,
      `process.stdout.write(${JSON.stringify(
        JSON.stringify({
          schemaVersion: "1.0.0",
          status: "FAIL",
          mode: "diff",
          findings: [
            {
              ruleId: "PDI002",
              path: "src/main.ts",
              line: 1,
              message: "test-only integrity finding",
            },
          ],
          summary: { errors: 1, warnings: 0, baselined: 0, waived: 0 },
        })
      )});`,
      "process.exit(1);",
      "",
    ].join("\n")
  );
  writeFixture(root, "src/main.ts", "export const baseline = true;\n");
  for (const args of [
    ["init", "--initial-branch=main"],
    ["config", "user.name", "Topology Test"],
    ["config", "user.email", "topology@example.invalid"],
    ["add", "."],
    ["commit", "-m", "fixture baseline"],
  ]) {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    if (result.status !== 0) throw new Error(result.stderr);
  }
  writeFixture(root, "src/main.ts", "export const changed = true;\n");
  return root;
}

describe("Codex hook lifecycle topology", () => {
  it("registers exactly one in-process command for each of the six lifecycle events", () => {
    const registered = LIFECYCLE_EVENTS.flatMap((event) =>
      commandHooks(event).map((hook) => ({ event, hook }))
    );

    expect(registered).toHaveLength(6);
    for (const event of LIFECYCLE_EVENTS) {
      const commands = commandHooks(event);
      expect(commands, event).toHaveLength(1);
      expect(commands[0].command, event).toContain(EXPECTED_ENTRYPOINTS[event]);
      expect(commands[0].commandWindows, `${event} Windows`).toContain(EXPECTED_ENTRYPOINTS[event]);
    }
    expect(commandHooks("PreToolUse")[0].command).toContain("--expected-agent codex");
    expect(commandHooks("PreToolUse")[0].commandWindows).toContain("--expected-agent codex");
  });

  it("binds both subagent events to the exact ten registry runtime identities", () => {
    expect(runtimeNames).toHaveLength(10);
    expect(new Set(runtimeNames).size).toBe(10);
    expect(runtimeNames.every(Boolean)).toBe(true);

    const expectedMatcher = `^(?:${runtimeNames.map(escapeRegex).join("|")})$`;
    for (const event of ["SubagentStart", "SubagentStop"] as const) {
      const groups = hookGroups(event);
      expect(groups, event).toHaveLength(1);
      expect(groups[0].matcher, event).toBe(expectedMatcher);

      const matcher = new RegExp(groups[0].matcher ?? "");
      for (const runtimeName of runtimeNames) {
        expect(matcher.test(runtimeName), `${event}:${runtimeName}`).toBe(true);
      }
      for (const builtIn of ["", "default", "worker", "explorer", "reviewer"]) {
        expect(matcher.test(builtIn), `${event}:built-in:${builtIn}`).toBe(false);
      }
      expect(matcher.test(`prefix-${runtimeNames[0]}`), `${event}:prefix`).toBe(false);
      expect(matcher.test(`${runtimeNames[0]}-suffix`), `${event}:suffix`).toBe(false);
    }
  });

  it("routes one relevant user prompt to skill, no-template, and PDI context", () => {
    const result = runHook(resolve(EXPECTED_ENTRYPOINTS.UserPromptSubmit), {
      hook_event_name: "UserPromptSubmit",
      prompt:
        "Use the selected security skill to review sample data handling and production data integrity using best practices.",
    });

    expect(result.status, result.stderr).toBe(0);
    const output = parseSingleJsonOutput(result.stdout);
    const context = JSON.stringify(output);
    expect(context).toContain("SKILL ROUTING REQUIRED");
    expect(context).toContain("selected_skills");
    expect(context).toContain("NO AI TEMPLATE GATE");
    expect(context).toContain("source-backed applicability");
    expect(context).toContain("PRODUCTION DATA INTEGRITY");
    expect(context).toContain("test doubles");
  });

  it("keeps the single prompt router silent for an unrelated trivial prompt", () => {
    const result = runHook(resolve(EXPECTED_ENTRYPOINTS.UserPromptSubmit), {
      hook_event_name: "UserPromptSubmit",
      prompt: "What is 2 + 2?",
    });

    expect(result.status, result.stderr).toBe(0);
    const output = parseSingleJsonOutput(result.stdout);
    expect(JSON.stringify(output)).not.toContain("SKILL ROUTING REQUIRED");
    expect(JSON.stringify(output)).not.toContain("NO AI TEMPLATE GATE");
    expect(JSON.stringify(output)).not.toContain("PRODUCTION DATA INTEGRITY");
  });

  it.each([
    [
      "UserPromptSubmit",
      EXPECTED_ENTRYPOINTS.UserPromptSubmit,
      "codex-governance/tool-targets.cjs",
      "skill-router-gate",
      {
        hook_event_name: "UserPromptSubmit",
        prompt: "Review this governance change.",
      },
    ],
    [
      "PostToolUse",
      EXPECTED_ENTRYPOINTS.PostToolUse,
      "codex-governance/tool-targets.cjs",
      "production-data-integrity-gate",
      {
        hook_event_name: "PostToolUse",
        tool_name: "WriteFile",
        tool_input: { path: "scripts/example.cjs" },
      },
    ],
    [
      "Stop",
      EXPECTED_ENTRYPOINTS.Stop,
      "codex-governance/subagent-evidence.cjs",
      "no-ai-template-gate",
      {
        hook_event_name: "Stop",
        last_assistant_message: "Verification remains in progress.",
      },
    ],
    [
      "SubagentStart",
      EXPECTED_ENTRYPOINTS.SubagentStart,
      "codex-governance/subagent-evidence.cjs",
      "subagent-evidence-gate",
      {
        hook_event_name: "SubagentStart",
        agent_type: runtimeNames[0],
      },
    ],
    [
      "SubagentStop",
      EXPECTED_ENTRYPOINTS.SubagentStop,
      "codex-governance/subagent-evidence.cjs",
      "subagent-evidence-gate",
      {
        hook_event_name: "SubagentStop",
        agent_type: runtimeNames[0],
        last_assistant_message: "GO",
      },
    ],
  ])(
    "turns a catchable %s local dependency failure into a bounded exit-2 denial",
    (_event, entrypoint, dependencyFragment, hookName, input) => {
      const result = runHookWithDependencyFailure(resolve(entrypoint), dependencyFragment, input);

      expect(result.status, result.stderr).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr.trim()).toBe(`HOOK ERROR [${hookName}]: bootstrap_failure`);
      expect(result.stderr).not.toContain("isolated bootstrap fixture sentinel");
      expect(result.stderr).not.toContain("at Module._load");
    }
  );

  it("injects the shared evidence contract only for a custom ZenFlow role", () => {
    expect(existsSync(subagentHookPath)).toBe(true);
    const customResult = runHook(subagentHookPath, {
      hook_event_name: "SubagentStart",
      agent_type: runtimeNames[0],
    });

    expect(customResult.status, customResult.stderr).toBe(0);
    const customContext = outputText(customResult);
    expect(customContext).toContain("SUBAGENT EVIDENCE CONTRACT");
    expect(customContext).toContain("File/source evidence");
    expect(customContext).toContain("Verification run");
    expect(customContext).toContain("Verification skipped");
    expect(customContext).toContain("GO / STOP / ASK");

    const builtInResult = runHook(subagentHookPath, {
      hook_event_name: "SubagentStart",
      agent_type: "default",
    });
    expect(builtInResult.status, builtInResult.stderr).toBe(0);
    expect(outputText(builtInResult)).not.toContain("SUBAGENT EVIDENCE CONTRACT");
  });

  it("accepts semantic custom-role evidence and rejects a bare success summary", () => {
    expect(existsSync(subagentHookPath)).toBe(true);
    const validEvidenceFixture = [
      "## Findings",
      "",
      "- The topology review is limited to the cited hook configuration.",
      "## File/source evidence",
      "",
      "- scripts/__tests__/codex-hook-topology.test.ts:1",
      "- .codex/hooks.json:1",
      "## Platform/domain impact",
      "",
      "- Agent governance only; shipped product runtimes are unchanged.",
      "## Verification run",
      "",
      "- Command: npx vitest run scripts/__tests__/codex-hook-topology.test.ts",
      "## Verification skipped",
      "",
      "- Native Windows hook loading remains UNVERIFIED because no Windows runner was used.",
      "## Remaining risk",
      "",
      "- Fresh-session runtime loading remains UNVERIFIED.",
      "## Verdict",
      "",
      "GO",
    ].join("\r\n");
    const validResult = runHook(subagentHookPath, {
      hook_event_name: "SubagentStop",
      agent_type: runtimeNames[0],
      last_assistant_message: validEvidenceFixture,
    });
    expect(hookBlocked(validResult), outputText(validResult)).toBe(false);

    const summaryOnlyResult = runHook(subagentHookPath, {
      hook_event_name: "SubagentStop",
      agent_type: runtimeNames[0],
      last_assistant_message:
        "GO. No issues found. Reviewed .codex/hooks.json and everything looks correct.",
    });
    expect(hookBlocked(summaryOnlyResult), outputText(summaryOnlyResult)).toBe(true);
    expect(outputText(summaryOnlyResult)).toMatch(/evidence|source|proof/i);
  });

  it("rejects a custom-role GO verdict that retains an explicit release blocker", () => {
    const result = runHook(subagentHookPath, {
      hook_event_name: "SubagentStop",
      agent_type: runtimeNames[0],
      last_assistant_message: [
        "## Findings",
        "- A blocking governance defect remains unresolved.",
        "## File/source evidence",
        "- scripts/codex-governance/subagent-evidence.cjs:28",
        "## Platform/domain impact",
        "- Agent governance across all release lanes.",
        "## Verification run",
        "- npm run check:no-ai-templates PASS for the parser mechanics.",
        "## Verification skipped",
        "- Native Windows loading remains UNVERIFIED because no Windows runner was used.",
        "## Remaining risk",
        "- Release remains blocked by the unresolved governance defect.",
        "## Verdict",
        "GO",
      ].join("\n"),
    });

    expect(hookBlocked(result), outputText(result)).toBe(true);
    expect(outputText(result)).toContain("go_verdict_contradicts_blocking_finding");
  });

  it.each([
    [
      "negated blocker",
      "No blocking issue was found in the reviewed topology.",
      "Release is not blocked by the reviewed change.",
      "GO",
    ],
    [
      "resolved blocker",
      "The previous blocking defect was resolved by the cited change.",
      "Release is not blocked; fresh-session loading remains UNVERIFIED.",
      "GO",
    ],
    [
      "honest stop",
      "A blocking governance defect remains unresolved.",
      "Release remains blocked by the unresolved governance defect.",
      "STOP",
    ],
    [
      "honest ask",
      "A blocking governance decision remains open.",
      "Release must not proceed until the user chooses the policy.",
      "ASK",
    ],
  ])("accepts evidence-complete %s wording", (_label, finding, remainingRisk, verdict) => {
    const result = runHook(subagentHookPath, {
      hook_event_name: "SubagentStop",
      agent_type: runtimeNames[0],
      last_assistant_message: [
        "## Findings",
        `- ${finding}`,
        "## File/source evidence",
        "- scripts/codex-governance/subagent-evidence.cjs:1",
        "## Platform/domain impact",
        "- Agent governance only; product runtimes are unchanged.",
        "## Verification run",
        "- npm run check:no-ai-templates PASS.",
        "## Verification skipped",
        "- Native Windows remains UNVERIFIED because no Windows runner was used.",
        "## Remaining risk",
        `- ${remainingRisk}`,
        "## Verdict",
        verdict,
      ].join("\n"),
    });

    expect(hookBlocked(result), outputText(result)).toBe(false);
  });

  it("does not short-circuit PDI Stop inventory when no-AI output is also blocked", () => {
    const root = createStopUnionFixture();
    try {
      const result = spawnSync(process.execPath, [resolve(EXPECTED_ENTRYPOINTS.Stop)], {
        cwd: root,
        encoding: "utf8",
        input: JSON.stringify({
          hook_event_name: "Stop",
          stop_hook_active: false,
          last_assistant_message:
            "Use " + ["TODO", "replace actual copy"].join(": ") + " as the final release text.",
        }),
      });

      expect(hookBlocked(result), outputText(result)).toBe(true);
      expect(existsSync(join(root, ".pdi-stop-union-invoked"))).toBe(true);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });
});
