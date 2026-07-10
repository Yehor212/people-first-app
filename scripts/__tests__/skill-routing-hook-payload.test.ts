import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const HOOK = resolve(".codex/hooks/skill-router-gate.cjs");

describe("Codex skill-routing hook payload compatibility", () => {
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
});
