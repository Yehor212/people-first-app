import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const HOOK = resolve(".codex/hooks/production-data-integrity-gate.cjs");

type Stub = "clean" | "finding" | "error";

function write(root: string, relativePath: string, content: string): void {
  const target = join(root, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function makeRoot(stub: Stub = "clean"): string {
  const root = mkdtempSync(join(tmpdir(), "zenflow-pdi-hook-"));
  const report = stub === "finding"
    ? {
        schemaVersion: "1.0.0",
        status: "FAIL",
        mode: "diff",
        findings: [{ ruleId: "PDI002", path: "src/main.ts", line: 1, message: "synthetic history", fingerprint: "abc" }],
        summary: { errors: 1, warnings: 0, baselined: 0, waived: 0 },
      }
    : {
        schemaVersion: "1.0.0",
        status: stub === "error" ? "ERROR" : "PASS",
        mode: "diff",
        findings: [],
        summary: { errors: 0, warnings: 0, baselined: 0, waived: 0 },
      };
  write(
    root,
    "scripts/check-production-data-integrity.cjs",
    `process.stdout.write(${JSON.stringify(JSON.stringify(report))}); process.exit(${stub === "clean" ? 0 : stub === "finding" ? 1 : 2});\n`,
  );
  const initialized = spawnSync("git", ["init"], { cwd: root, encoding: "utf8" });
  if (initialized.status !== 0) throw new Error(initialized.stderr);
  return root;
}

function invoke(
  input: unknown,
  stub: Stub = "clean",
): { status: number | null; stdout: string; stderr: string; json?: Record<string, unknown> } {
  const result = spawnSync(process.execPath, [HOOK], {
    cwd: makeRoot(stub),
    encoding: "utf8",
    input: typeof input === "string" ? input : JSON.stringify(input),
  });
  let json: Record<string, unknown> | undefined;
  if (result.stdout.trim()) json = JSON.parse(result.stdout) as Record<string, unknown>;
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, json };
}

describe("production data integrity Codex hook", () => {
  it("is registered for every supported lifecycle event with bounded cross-platform commands", () => {
    const config = JSON.parse(readFileSync(".codex/hooks.json", "utf8")) as {
      hooks: Record<string, Array<{ matcher?: string; hooks: Array<{ command: string; commandWindows?: string; timeout?: number }> }>>;
    };
    for (const event of ["UserPromptSubmit", "PreToolUse", "PostToolUse", "Stop", "SubagentStart", "SubagentStop"]) {
      const handlers = (config.hooks[event] ?? []).flatMap((entry) => entry.hooks)
        .filter((handler) => handler.command.includes("production-data-integrity-gate.cjs"));
      expect(handlers, event).toHaveLength(1);
      expect(handlers[0].command).toContain("git rev-parse --show-toplevel");
      expect(handlers[0].commandWindows).toContain("git rev-parse --show-toplevel");
      expect(handlers[0].timeout).toBeGreaterThan(0);
      expect(handlers[0].timeout).toBeLessThanOrEqual(20);
    }
    expect(config.hooks.PreToolUse[0].matcher).toContain("Bash");
    expect(config.hooks.PreToolUse[0].matcher).toContain("apply_patch");
  });

  it("injects a short contract only for relevant user prompts", () => {
    const relevant = invoke({
      hook_event_name: "UserPromptSubmit",
      prompt: "Add sample records and a fallback to the production sync service",
    });
    expect(relevant.status, relevant.stderr).toBe(0);
    expect(JSON.stringify(relevant.json)).toContain("PRODUCTION_DATA_INTEGRITY_POLICY.md");
    expect(JSON.stringify(relevant.json)).toContain("test doubles");

    const neutral = invoke({ hook_event_name: "UserPromptSubmit", prompt: "Fix a typo in the README heading" });
    expect(neutral.status, neutral.stderr).toBe(0);
    expect(neutral.json).toEqual({});
  });

  it("denies obvious protected-surface weakening from the official apply_patch command field", () => {
    const result = invoke({
      hook_event_name: "PreToolUse",
      tool_name: "apply_patch",
      tool_input: {
        command: [
          "*** Begin Patch",
          "*** Update File: package.json",
          "-    \"check:production-data-integrity\": \"node scripts/check-production-data-integrity.cjs --all\",",
          "*** End Patch",
        ].join("\n"),
      },
    });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.stringify(result.json)).toContain("deny");
    expect(JSON.stringify(result.json)).toContain("production-data-integrity");
  });

  it("protects release-lifecycle wiring, not only the checker implementation", () => {
    const result = invoke({
      hook_event_name: "PreToolUse",
      tool_name: "apply_patch",
      tool_input: {
        command: [
          "*** Begin Patch",
          "*** Update File: docs/RELEASE_CHECKLIST.md",
          "-## Production Data Integrity Gate",
          "*** End Patch",
        ].join("\n"),
      },
    });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.stringify(result.json)).toContain("deny");
  });

  it("allows a neutral edit and returns JSON without diagnostics in stdout", () => {
    const result = invoke({
      hook_event_name: "PreToolUse",
      tool_name: "apply_patch",
      tool_input: { command: "*** Begin Patch\n*** Add File: docs/note.md\n+note\n*** End Patch" },
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.json).toEqual({});
  });

  it("runs a fast diff check after a relevant write and blocks findings", () => {
    const result = invoke(
      {
        hook_event_name: "PostToolUse",
        tool_name: "apply_patch",
        tool_input: { command: "*** Begin Patch\n*** Update File: src/main.ts\n*** End Patch" },
      },
      "finding",
    );
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.stringify(result.json)).toContain("PDI002");
    expect(JSON.stringify(result.json)).toContain("block");
  });

  it.each(["finding", "error"] as const)("blocks Stop when the checker returns %s", (stub) => {
    const result = invoke({ hook_event_name: "Stop", stop_hook_active: false }, stub);
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.stringify(result.json)).toContain("block");
    expect(JSON.stringify(result.json)).toContain(stub === "finding" ? "PDI002" : "internal");
  });

  it("honors the Stop recursion guard without invoking a missing checker", () => {
    const root = mkdtempSync(join(tmpdir(), "zenflow-pdi-stop-guard-"));
    const result = spawnSync(process.execPath, [HOOK], {
      cwd: root,
      encoding: "utf8",
      input: JSON.stringify({ hook_event_name: "Stop", stop_hook_active: true }),
    });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ continue: true });
  });

  it("resolves the repository root when Codex invokes the hook from a subdirectory", () => {
    const root = makeRoot("clean");
    mkdirSync(join(root, "src"), { recursive: true });
    const result = spawnSync(process.execPath, [HOOK], {
      cwd: join(root, "src"),
      encoding: "utf8",
      input: JSON.stringify({ hook_event_name: "Stop", stop_hook_active: false }),
    });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ continue: true });
  });

  it("injects the evidence contract for subagents and rejects evidence-free PASS", () => {
    const start = invoke({ hook_event_name: "SubagentStart", agent_type: "reviewer" });
    expect(start.status, start.stderr).toBe(0);
    expect(JSON.stringify(start.json)).toContain("Findings");
    expect(JSON.stringify(start.json)).toContain("Remaining risk");

    const badStop = invoke({ hook_event_name: "SubagentStop", last_assistant_message: "PASS. All clear." });
    expect(badStop.status, badStop.stderr).toBe(0);
    expect(JSON.stringify(badStop.json)).toContain("block");

    const goodStop = invoke({
      hook_event_name: "SubagentStop",
      last_assistant_message: [
        "Findings: none observed.",
        "File/source evidence: src/main.ts inspected.",
        "Platform/domain impact: Web and sync.",
        "Verification run or skipped checks: npm test ran.",
        "Remaining risk: dynamic imports remain unverified.",
        "Verdict: GO",
      ].join("\n"),
    });
    expect(goodStop.status, goodStop.stderr).toBe(0);
    expect(goodStop.json).toEqual({});
  });

  it("fails closed on malformed stdin without emitting invalid JSON", () => {
    const result = invoke("{not-json");
    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("HOOK ERROR");
  });
});
