import { spawnSync } from "node:child_process";
import { link, mkdtemp, mkdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { evaluateGuard } from "../codex-governance/change-gate-core.cjs";

const NOW = new Date("2026-07-13T05:00:00.000Z");
const HOOK = path.resolve("scripts/__tests__/helpers/run-change-evidence-evaluator.cjs");
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

  it.each([
    [
      "literal Node file read",
      `node -e "const fs=require('node:fs'); console.log(fs.readFileSync('AGENTS.md','utf8').length + 0)"`,
    ],
    [
      "exact direct execFileSync status",
      `node -e "require('node:child_process').execFileSync('git',['status','--short'])"`,
    ],
    [
      "exact direct spawnSync status",
      `node -e "require('node:child_process').spawnSync('git',['status','--short'])"`,
    ],
    [
      "literal Node execFileSync status read",
      `node -e "const {execFileSync}=require('node:child_process'); console.log(execFileSync('git',['status','--short'],{encoding:'utf8'}).length + 0)"`,
    ],
    [
      "literal Node spawnSync status read",
      `node -e "const {spawnSync}=require('node:child_process'); console.log(spawnSync('git',['status','--short'],{encoding:'utf8'}).stdout.length + 0)"`,
    ],
    [
      "literal Python pathlib read",
      `python3 -c "from pathlib import Path; print(len(Path('AGENTS.md').read_text()) + 0)"`,
    ],
    [
      "literal Python subprocess status read",
      `python3 -c "import subprocess; print(len(subprocess.run(['git','status','--short'], capture_output=True).stdout) + 0)"`,
    ],
    [
      "operand-free tee in a read-only pipeline",
      `git ls-tree -r HEAD | rg 'agent-0' | tee | shasum -a 256`,
    ],
    ["rm help pipeline", `rm --help | sed -n '1p'`],
    ["git reset help pipeline", `git reset --help | sed -n '1p'`],
    ["chmod help pipeline", `chmod --help | sed -n '1p'`],
    [
      "write primitive mentioned only as literal text",
      `node -e "console.log('writeFileSync example 0')"`,
    ],
  ])(
    "allows the anchored corpus read-only class without a planning token: %s",
    async (_label, command) => {
      const rootDir = await workspace();
      const result = runHook(rootDir, {
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command },
      });

      expect(result.status, result.stderr).toBe(0);
    }
  );

  it.each([
    [
      "Node read path traversal",
      `node -e "const fs=require('node:fs'); console.log(fs.readFileSync('../AGENTS.md','utf8').length + 0)"`,
    ],
    [
      "Python subprocess mutation",
      `python3 -c "import subprocess; print(subprocess.run(['git','reset','--hard'], capture_output=True).stdout)"`,
    ],
    [
      "extra Node write statement",
      `node -e "const fs=require('node:fs'); console.log(fs.readFileSync('AGENTS.md','utf8').length);fs.writeFileSync('src/danger.ts','x')"`,
    ],
    ["tee guarded output operand", `git ls-tree -r HEAD | tee src/danger.ts | shasum -a 256`],
    ["rm help extra operand", `rm --help AGENTS.md`],
    ["git reset help mutating suffix", `git reset --help --hard`],
    ["chmod help extra operand", `chmod --help src/danger.ts`],
    [
      "literal marker plus real write",
      `node -e "console.log('writeFileSync example');require('node:fs').writeFileSync('AGENTS.md','x')"`,
    ],
  ])("keeps the anchored corpus read-only near-miss fail-closed: %s", async (_label, command) => {
    const rootDir = await workspace();
    const result = runHook(rootDir, {
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command },
    });

    expect(result.status, result.stderr).toBe(2);
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

  it("blocks a new structured target below a symlinked ancestor that resolves outside the repository", async () => {
    const rootDir = await workspace();
    const outside = await mkdtemp(path.join(tmpdir(), "zenflow-codex-gate-outside-"));
    roots.push(outside);
    await mkdir(path.join(rootDir, "src"), { recursive: true });
    await symlink(outside, path.join(rootDir, "src", "external"));
    await writeFile(path.join(rootDir, ".preflight-token"), JSON.stringify(validToken()), "utf8");

    const result = await evaluateGuard({
      rootDir,
      targetPath: path.join(rootDir, "src", "external", "new.ts"),
      now: NOW,
    });

    expect(result.allowed).toBe(false);
    expect(result.reasons).toEqual(["target path is outside repository"]);
  });

  it("blocks an existing structured target symlink that resolves outside the repository", async () => {
    const rootDir = await workspace();
    const outside = await mkdtemp(path.join(tmpdir(), "zenflow-codex-gate-outside-"));
    roots.push(outside);
    await mkdir(path.join(rootDir, "src"), { recursive: true });
    const outsideTarget = path.join(outside, "outside.ts");
    await writeFile(outsideTarget, "export {};\n", "utf8");
    await symlink(outsideTarget, path.join(rootDir, "src", "linked.ts"));
    await writeFile(path.join(rootDir, ".preflight-token"), JSON.stringify(validToken()), "utf8");

    const result = await evaluateGuard({
      rootDir,
      targetPath: path.join(rootDir, "src", "linked.ts"),
      now: NOW,
    });

    expect(result.allowed).toBe(false);
    expect(result.reasons).toEqual(["target path is outside repository"]);
  });

  it("blocks an existing structured target with multiple filesystem links", async () => {
    const rootDir = await workspace();
    const outside = await mkdtemp(path.join(tmpdir(), "zenflow-codex-gate-outside-"));
    roots.push(outside);
    await mkdir(path.join(rootDir, "src"), { recursive: true });
    const outsideTarget = path.join(outside, "shared.ts");
    const linkedTarget = path.join(rootDir, "src", "shared.ts");
    await writeFile(outsideTarget, "export const shared = true;\n", "utf8");
    await link(outsideTarget, linkedTarget);
    await writeFile(path.join(rootDir, ".preflight-token"), JSON.stringify(validToken()), "utf8");

    const result = await evaluateGuard({
      rootDir,
      targetPath: linkedTarget,
      now: NOW,
    });

    expect(result.allowed).toBe(false);
    expect(result.reasons).toEqual(["target path has multiple filesystem links"]);
  });

  it("follows the host filesystem case semantics for protected path prefixes", async () => {
    const rootDir = await workspace();
    await mkdir(path.join(rootDir, "docs", "ai"), { recursive: true });
    let caseInsensitive = false;
    try {
      await realpath(path.join(rootDir, "DOCS", "AI"));
      caseInsensitive = true;
    } catch {
      caseInsensitive = false;
    }

    const blockedWithoutEvidence = await evaluateGuard({
      rootDir,
      targetPath: path.join(rootDir, "DOCS", "AI", "case-policy.md"),
      now: NOW,
    });

    if (caseInsensitive) {
      expect(blockedWithoutEvidence.allowed).toBe(false);
      expect(blockedWithoutEvidence.reasons.join("\n")).toContain("preflight token");
    } else {
      expect(blockedWithoutEvidence).toMatchObject({
        allowed: true,
        reasons: [],
        evidence: ["target is outside guarded change surfaces"],
      });
    }

    await writeFile(path.join(rootDir, ".preflight-token"), JSON.stringify(validToken()), "utf8");
    const allowedWithEvidence = await evaluateGuard({
      rootDir,
      targetPath: path.join(rootDir, "DOCS", "AI", "case-policy.md"),
      now: NOW,
    });
    expect(allowedWithEvidence.allowed).toBe(true);
  });

  it("allows an ordinary new guarded target with valid planning evidence", async () => {
    const rootDir = await workspace();
    await mkdir(path.join(rootDir, "src"), { recursive: true });
    await writeFile(path.join(rootDir, ".preflight-token"), JSON.stringify(validToken()), "utf8");

    const result = await evaluateGuard({
      rootDir,
      targetPath: path.join(rootDir, "src", "ordinary.ts"),
      now: NOW,
    });

    expect(result).toMatchObject({ allowed: true, reasons: [] });
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

function runHook(cwd, payload) {
  return spawnSync(process.execPath, [HOOK], {
    cwd,
    encoding: "utf8",
    input: JSON.stringify(payload),
  });
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
