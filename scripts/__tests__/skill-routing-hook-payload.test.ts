import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const HOOK = resolve(".codex/hooks/skill-router-gate.cjs");
const PRODUCTION_DATA_HOOK = resolve(".codex/hooks/production-data-integrity-gate.cjs");

describe("Codex skill-routing hook payload compatibility", () => {
  it("allows read-only Bash-hook commands without a fabricated path or audit side effect", () => {
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
    expect(existsSync(join(cwd, ".codex-audit.log"))).toBe(false);
  });

  it("logs a blocked edit with a bounded reason code and no target or command text", () => {
    const cwd = mkdtempSync(join(tmpdir(), "zenflow-skill-router-blocked-"));
    const privateTarget = "src/private-target-sentinel.ts";
    const result = spawnSync(process.execPath, [HOOK], {
      cwd,
      encoding: "utf8",
      input: JSON.stringify({
        hook_event_name: "PreToolUse",
        tool_name: "apply_patch",
        tool_input: {
          command: [
            "*** Begin Patch",
            `*** Add File: ${privateTarget}`,
            "+export {};",
            "*** End Patch",
          ].join("\n"),
        },
      }),
    });

    expect(result.status).toBe(2);
    const auditEntry = JSON.parse(
      readFileSync(join(cwd, ".codex-audit.log"), "utf8").trim()
    ) as Record<string, unknown>;
    expect(Object.keys(auditEntry).sort()).toEqual(["event", "hook", "reason_code", "ts"]);
    expect(auditEntry).toEqual(
      expect.objectContaining({
        event: "block",
        hook: "skill-router-gate",
        reason_code: "missing_or_invalid_skill_routing_evidence",
      })
    );
    expect(JSON.stringify(auditEntry)).not.toContain(privateTarget);
    expect(JSON.stringify(auditEntry)).not.toContain("export");
  });

  it.each(["symlink", "hardlink"])(
    "refuses an untrusted %s audit target without modifying the outside file",
    (linkType) => {
      const root = mkdtempSync(join(tmpdir(), "zenflow-skill-router-audit-link-"));
      const cwd = join(root, "repo");
      const outside = join(root, "outside.log");
      mkdirSync(cwd);
      writeFileSync(outside, "OUTSIDE_SENTINEL\n", { mode: 0o644 });
      const auditPath = join(cwd, ".codex-audit.log");
      if (linkType === "symlink") {
        symlinkSync(outside, auditPath);
      } else {
        linkSync(outside, auditPath);
      }

      const result = spawnSync(process.execPath, [HOOK], {
        cwd,
        encoding: "utf8",
        input: "{not-json",
      });

      expect(result.status).toBe(2);
      expect(readFileSync(outside, "utf8")).toBe("OUTSIDE_SENTINEL\n");
      expect(statSync(outside).mode & 0o777).toBe(0o644);
    }
  );

  it("tightens a trusted preexisting audit log to owner-only mode", () => {
    const cwd = mkdtempSync(join(tmpdir(), "zenflow-skill-router-audit-mode-"));
    const auditPath = join(cwd, ".codex-audit.log");
    writeFileSync(auditPath, "", { mode: 0o644 });
    chmodSync(auditPath, 0o644);

    const result = spawnSync(process.execPath, [HOOK], {
      cwd,
      encoding: "utf8",
      input: "{not-json",
    });

    expect(result.status).toBe(2);
    expect(statSync(auditPath).mode & 0o777).toBe(0o600);
    expect(readFileSync(auditPath, "utf8")).toContain('"reason_code":"invalid_hook_input"');
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
