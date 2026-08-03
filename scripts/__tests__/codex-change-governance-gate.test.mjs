import { spawnSync } from "node:child_process";
import { chmod, copyFile, mkdtemp, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { evaluateGuard } from "../codex-governance/change-gate-core.cjs";

const NOW = new Date("2026-07-13T05:00:00.000Z");
const HOOK = path.resolve(".codex/hooks/change-governance-gate.cjs");
const PROJECT_ROOT = path.resolve(".");
const READ_ONLY_SPEC_KIT_COMMAND =
  ".specify/scripts/bash/check-prerequisites.sh --json --paths-only";
const STATEFUL_SPEC_KIT_COMMANDS = [
  ".specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks",
  ".specify/scripts/bash/setup-plan.sh --json",
  ".specify/scripts/bash/setup-tasks.sh --json",
];
const GOVERNANCE_HARNESS_FILES = [
  ".codex/hooks/change-governance-gate.cjs",
  "scripts/codex-governance/change-gate-core.cjs",
  "scripts/codex-governance/tool-targets.cjs",
  ".specify/zenflow-install-manifest.json",
  ".specify/scripts/bash/check-prerequisites.sh",
  ".specify/scripts/bash/setup-plan.sh",
  ".specify/scripts/bash/setup-tasks.sh",
];
const roots = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Codex change governance gate", () => {
  it.each([
    ["remove protected policy", "rm AGENTS.md"],
    ["redirect into protected docs", "echo weakened > docs/ai/AGENT_CHANGE_GOVERNANCE.md"],
    ["in-place edit protected config", "sed -i.bak 's/GO/ALLOW/' .codex/hooks.json"],
    ["restore protected policy", "git checkout -- AGENTS.md"],
    ["destructive reset", "git reset --hard"],
    ["redirect without surrounding whitespace", "echo weakened>AGENTS.md"],
    ["colon truncation redirect", ":>AGENTS.md"],
    ["inline Node filesystem write", `node -e "require('fs').writeFileSync('AGENTS.md','x')"`],
    ["inline Python filesystem write", `python3 -c "open('AGENTS.md','w').write('x')"`],
    ["git mutation after a global working-directory option", "git -C . reset --hard"],
    ["mutation inside a subshell", "(rm AGENTS.md)"],
    ["mutation behind a shell control keyword", "if true; then rm AGENTS.md; fi"],
    ["find exec mutation", "find . -exec rm AGENTS.md \\;"],
    ["target-directory copy", "cp -t AGENTS.md source.txt"],
    ["destructive repository removal", "rm -rf ."],
    [
      "patch-header decoy before protected removal",
      "cat <<'EOF' >/dev/null\n*** Add File: docs/ordinary-note.md\nEOF\nrm AGENTS.md",
    ],
  ])("blocks shell mutation: %s", async (_label, command) => {
    const rootDir = await workspace();
    const result = runHook(rootDir, {
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command },
    });

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain("CODEX CHANGE GOVERNANCE GATE BLOCKED");
  });

  it("allows a read-only shell command without inventing an edit target", async () => {
    const rootDir = await workspace();
    const result = runHook(rootDir, {
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "git status --short" },
    });

    expect(result.status, result.stderr).toBe(0);
  });

  it("allows the exact provenance-checked read-only Spec Kit command", async () => {
    const { hook, rootDir } = await governedSpecKitWorkspace();
    const result = runHook(
      rootDir,
      {
        cwd: rootDir,
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: READ_ONLY_SPEC_KIT_COMMAND },
      },
      hook
    );

    expect(result.status, result.stderr).toBe(0);
  });

  it.each(STATEFUL_SPEC_KIT_COMMANDS)(
    "requires change-governance evidence for the bounded stateful Spec Kit command: %s",
    async (command) => {
      const { hook, rootDir } = await governedSpecKitWorkspace();
      const result = runHook(
        rootDir,
        {
          cwd: rootDir,
          hook_event_name: "PreToolUse",
          tool_name: "Bash",
          tool_input: { command },
        },
        hook
      );

      expect(result.status, result.stderr).toBe(2);
      expect(result.stderr).toContain("preflight token");
    }
  );

  it.each(STATEFUL_SPEC_KIT_COMMANDS)(
    "allows the bounded stateful Spec Kit command with fresh change evidence: %s",
    async (command) => {
      const { hook, rootDir } = await governedSpecKitWorkspace();
      await writeFile(
        path.join(rootDir, ".preflight-token"),
        JSON.stringify(freshToken()),
        "utf8"
      );
      const result = runHook(
        rootDir,
        {
          cwd: rootDir,
          hook_event_name: "PreToolUse",
          tool_name: "Bash",
          tool_input: { command },
        },
        hook
      );

      expect(result.status, result.stderr).toBe(0);
    }
  );

  it("fails closed when a stateful Spec Kit command selects an out-of-lane target", async () => {
    const { hook, rootDir } = await governedSpecKitWorkspace();
    const result = runHook(
      rootDir,
      {
        cwd: rootDir,
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: STATEFUL_SPEC_KIT_COMMANDS[1] },
      },
      hook,
      { SPECIFY_FEATURE_DIRECTORY: path.resolve(rootDir, "../outside-feature") }
    );

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain("bounded target path");
  });

  it("does not split a quoted search expression at its pipe", async () => {
    const rootDir = await workspace();
    const result = runHook(rootDir, {
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "rg 'safe|rm AGENTS.md'" },
    });

    expect(result.status, result.stderr).toBe(0);
  });

  it("accepts the official apply_patch command field for an unguarded documentation target", async () => {
    const rootDir = await workspace();
    const result = runHook(rootDir, {
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
    });

    expect(result.status, result.stderr).toBe(0);
  });

  it("blocks guarded enforcement code without a fresh token", async () => {
    const rootDir = await workspace();
    const result = await evaluateGuard({
      rootDir,
      targetPath: path.join(rootDir, "scripts/check-agent-context.mjs"),
      now: NOW,
    });

    expect(result.allowed).toBe(false);
    expect(result.reasons.join("\n")).toContain("preflight token");
  });

  it("accepts a fresh GO token with test-first and skill-routing evidence", async () => {
    const rootDir = await workspace();
    await writeFile(path.join(rootDir, ".preflight-token"), JSON.stringify(validToken()), "utf8");

    const result = await evaluateGuard({
      rootDir,
      targetPath: path.join(rootDir, "scripts/check-agent-context.mjs"),
      now: NOW,
    });

    expect(result).toMatchObject({ allowed: true, reasons: [] });
  });

  it("treats repository root as an in-repository guarded target", async () => {
    const rootDir = await workspace();
    await writeFile(path.join(rootDir, ".preflight-token"), JSON.stringify(validToken()), "utf8");

    const result = await evaluateGuard({
      rootDir,
      targetPath: ".",
      now: NOW,
    });

    expect(result).toMatchObject({ allowed: true, reasons: [] });
    expect(result.reasons.join("\n")).not.toContain("outside repository");
  });

  it("blocks stale self-reported evidence", async () => {
    const rootDir = await workspace();
    const token = validToken();
    token.timestamp = "2026-07-12T00:00:00.000Z";
    token.test_first.timestamp = token.timestamp;
    token.skill_routing.timestamp = token.timestamp;
    await writeFile(path.join(rootDir, ".preflight-token"), JSON.stringify(token), "utf8");

    const result = await evaluateGuard({
      rootDir,
      targetPath: path.join(rootDir, "config/persistent-agent-orchestra.json"),
      now: NOW,
    });

    expect(result.allowed).toBe(false);
    expect(result.reasons.join("\n")).toContain("stale");
  });

  it("requires a separate unlock for AGENTS.md", async () => {
    const rootDir = await workspace();
    await writeFile(path.join(rootDir, ".preflight-token"), JSON.stringify(validToken()), "utf8");

    const blocked = await evaluateGuard({
      rootDir,
      targetPath: path.join(rootDir, "AGENTS.md"),
      now: NOW,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.reasons.join("\n")).toContain(".Codex-md-unlock");

    await writeFile(
      path.join(rootDir, ".Codex-md-unlock"),
      "authorized for exact-ten migration\n",
      "utf8"
    );
    const allowed = await evaluateGuard({
      rootDir,
      targetPath: path.join(rootDir, "AGENTS.md"),
      now: NOW,
    });
    expect(allowed.allowed).toBe(true);
  });

  it("blocks a target that escapes the repository", async () => {
    const rootDir = await workspace();
    await writeFile(path.join(rootDir, ".preflight-token"), JSON.stringify(validToken()), "utf8");

    const result = await evaluateGuard({
      rootDir,
      targetPath: path.join(rootDir, "../outside.ts"),
      now: NOW,
    });

    expect(result.allowed).toBe(false);
    expect(result.reasons.join("\n")).toContain("outside repository");
  });

  it("guards a repository-root Git mutation instead of misclassifying it as outside", async () => {
    const rootDir = await workspace();

    const blocked = await evaluateGuard({
      rootDir,
      targetPath: ".",
      now: NOW,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.reasons.join("\n")).toContain("preflight token");
    expect(blocked.reasons.join("\n")).not.toContain("outside repository");

    await writeFile(path.join(rootDir, ".preflight-token"), JSON.stringify(validToken()), "utf8");
    const allowed = await evaluateGuard({
      rootDir,
      targetPath: ".",
      now: NOW,
    });
    expect(allowed).toMatchObject({ allowed: true, reasons: [] });
  });
});

function runHook(cwd, payload, hook = HOOK, environment = {}) {
  const childEnvironment = { ...process.env };
  delete childEnvironment.SPECIFY_FEATURE_DIRECTORY;
  delete childEnvironment.SPECIFY_INIT_DIR;
  Object.assign(childEnvironment, environment);
  return spawnSync(process.execPath, [hook], {
    cwd,
    encoding: "utf8",
    env: childEnvironment,
    input: JSON.stringify(payload),
  });
}

async function governedSpecKitWorkspace() {
  const rootDir = await realpath(await workspace());
  for (const relativePath of GOVERNANCE_HARNESS_FILES) {
    const destination = path.join(rootDir, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(PROJECT_ROOT, relativePath), destination);
    if (relativePath.endsWith(".sh")) await chmod(destination, 0o755);
  }
  const featureDirectory = "specs/001-change-governance";
  await mkdir(path.join(rootDir, featureDirectory), { recursive: true });
  await writeFile(
    path.join(rootDir, ".specify/feature.json"),
    `${JSON.stringify({ feature_directory: featureDirectory })}\n`,
    "utf8"
  );
  return {
    hook: path.join(rootDir, ".codex/hooks/change-governance-gate.cjs"),
    rootDir,
  };
}

async function workspace() {
  const rootDir = await mkdtemp(path.join(tmpdir(), "zenflow-codex-gate-"));
  roots.push(rootDir);
  await mkdir(path.join(rootDir, "scripts"), { recursive: true });
  await mkdir(path.join(rootDir, "config"), { recursive: true });
  return rootDir;
}

function validToken() {
  return {
    timestamp: "2026-07-13T04:55:00.000Z",
    goal: "Install the canonical exact-ten Codex role system",
    depth: "L4",
    verdict: "GO",
    test_first: {
      timestamp: "2026-07-13T04:55:00.000Z",
      behavior: "Missing or forged exact-ten evidence must fail closed.",
      risk: "A false-green guard would approve an absent role system.",
      evidence_type: "red-test",
      command: "npx vitest run scripts/__tests__/persistent-agent-orchestra-registry.test.mjs",
      expected_red: "The core module and canonical registry are absent before implementation.",
      verification_plan: "Rerun the same focused test green and then run drift checks.",
      verdict: "GO",
    },
    skill_routing: {
      timestamp: "2026-07-13T04:55:00.000Z",
      prompt_summary: "Implement an exact-ten Codex governance system.",
      selected_skills: ["superpowers:test-driven-development"],
      skipped_obvious: [{ name: "browser", reason: "No UI runtime change" }],
      decision: "Use test-first governance implementation.",
      verification_plan: "Run focused tests and fresh governance checks.",
      verdict: "GO",
    },
  };
}

function freshToken() {
  const token = validToken();
  const timestamp = new Date().toISOString();
  token.timestamp = timestamp;
  token.test_first.timestamp = timestamp;
  token.skill_routing.timestamp = timestamp;
  return token;
}
