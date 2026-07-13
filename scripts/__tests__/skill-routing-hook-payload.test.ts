import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const HOOK = resolve(".codex/hooks/skill-router-gate.cjs");
const PRODUCTION_DATA_HOOK = resolve(".codex/hooks/production-data-integrity-gate.cjs");

describe("Codex skill-routing hook payload compatibility", () => {
  it("allows read-only Bash-hook commands without a fabricated path", () => {
    const cwd = mkdtempSync(join(tmpdir(), "zenflow-skill-router-readonly-"));
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
  });

  it("extracts apply_patch targets from the official tool_input.command field", () => {
    const cwd = mkdtempSync(join(tmpdir(), "zenflow-skill-router-command-"));
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
    const cwd = mkdtempSync(join(tmpdir(), "zenflow-production-data-shell-"));
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
