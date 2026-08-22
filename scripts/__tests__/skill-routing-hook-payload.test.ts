import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const HOOK = resolve(".codex/hooks/skill-router-gate.cjs");
const PRODUCTION_DATA_HOOK = resolve(".codex/hooks/production-data-integrity-gate.cjs");
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

function makeTemporaryDirectory(prefix: string): string {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

function freshRoutingEvidence(): string {
  return `${JSON.stringify({
    timestamp: new Date().toISOString(),
    prompt_summary: "Run the bounded routing-hook regression check.",
    selected_skills: ["speckit-implement"],
    skipped_obvious: [{ name: "unrelated skills", reason: "no unrelated surface is changed" }],
    decision: "Use the protected local routing evidence path.",
    verification_plan: "Run the focused routing-hook regression suite.",
    verdict: "GO",
  })}\n`;
}

describe("Codex skill-routing hook payload compatibility", () => {
  it("allows read-only Bash-hook commands without a fabricated path", () => {
    const cwd = makeTemporaryDirectory("zenflow-skill-router-readonly-");
    const result = spawnSync(process.execPath, [HOOK], {
      cwd,
      encoding: "utf8",
      input: JSON.stringify({
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "git status --short" },
      }),
    });

    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(join(cwd, ".codex-audit.log"))).toBe(false);
  });

  it("extracts apply_patch targets from the official tool_input.command field", () => {
    const cwd = makeTemporaryDirectory("zenflow-skill-router-command-");
    const result = spawnSync(process.execPath, [HOOK], {
      cwd,
      encoding: "utf8",
      input: JSON.stringify({
        hook_event_name: "PreToolUse",
        tool_name: "apply_patch",
        tool_input: {
          command: [
            "*** Begin Patch",
            "*** Add File: docs/ordinary-note.md",
            "+ordinary documentation",
            "*** End Patch",
          ].join("\n"),
        },
      }),
    });

    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(join(cwd, ".codex-audit.log"))).toBe(false);
  });

  it("does not create an audit file when blocking a guarded edit without evidence", () => {
    const cwd = makeTemporaryDirectory("zenflow-skill-router-block-");
    const result = spawnSync(process.execPath, [HOOK], {
      cwd,
      encoding: "utf8",
      input: JSON.stringify({
        hook_event_name: "PreToolUse",
        tool_name: "apply_patch",
        tool_input: {
          command: [
            "*** Begin Patch",
            "*** Add File: scripts/guarded-change.mjs",
            "+export const guarded = true;",
            "*** End Patch",
          ].join("\n"),
        },
      }),
    });

    expect(result.status).toBe(2);
    expect(existsSync(join(cwd, ".codex-audit.log"))).toBe(false);
  });

  it("resolves routing evidence at the Git worktree root from a nested cwd without audit output", () => {
    const root = makeTemporaryDirectory("zenflow-skill-router-root-");
    const initialized = spawnSync("git", ["init"], { cwd: root, encoding: "utf8" });
    expect(initialized.status, initialized.stderr).toBe(0);
    const nested = join(root, "src", "nested");
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(root, ".preflight-token"), freshRoutingEvidence(), "utf8");

    const result = spawnSync(process.execPath, [HOOK], {
      cwd: nested,
      encoding: "utf8",
      input: JSON.stringify({
        hook_event_name: "PreToolUse",
        tool_name: "apply_patch",
        tool_input: {
          command: [
            "*** Begin Patch",
            "*** Add File: scripts/nested-guarded-change.mjs",
            "+export const nestedGuarded = true;",
            "*** End Patch",
          ].join("\n"),
        },
      }),
    });

    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(join(root, ".codex-audit.log"))).toBe(false);
    expect(existsSync(join(nested, ".codex-audit.log"))).toBe(false);
  });

  it("declares shell-capable matchers and a Windows command for every command hook", () => {
    const config = JSON.parse(readFileSync(resolve(".codex/hooks.json"), "utf8")) as {
      hooks: Record<string, Array<{ matcher?: string; hooks: Array<Record<string, unknown>> }>>;
    };
    const preToolMatchers = config.hooks.PreToolUse.map((group) => group.matcher || "").join("|");

    for (const runtimeName of ["Bash", "apply_patch"]) {
      expect(preToolMatchers).toContain(runtimeName);
    }
    for (const groups of Object.values(config.hooks)) {
      for (const group of groups) {
        for (const hook of group.hooks) {
          if (hook.type !== "command") continue;
          expect(String(hook.commandWindows || "")).toMatch(/node/i);
        }
      }
    }
  });

  it("does not let a patch-header decoy hide protected production-data enforcement removal", () => {
    const cwd = makeTemporaryDirectory("zenflow-production-data-shell-");
    const result = spawnSync(process.execPath, [PRODUCTION_DATA_HOOK], {
      cwd,
      encoding: "utf8",
      input: JSON.stringify({
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {
          command: [
            "cat <<'EOF' >/dev/null",
            "*** Add File: docs/ordinary-note.md",
            "EOF",
            "rm docs/ai/PRODUCTION_DATA_INTEGRITY_POLICY.md",
          ].join("\n"),
        },
      }),
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('"permissionDecision":"deny"');
  });
});
