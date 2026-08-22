import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { link, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const HOOK = path.resolve(".codex/hooks/agent-workspace-guard.cjs");
const WORKSPACE_EVALUATOR = path.resolve(
  "scripts/__tests__/helpers/run-agent-workspace-evaluator.cjs"
);
const SOURCE_ROOT = path.resolve(".");
const CANONICAL_REMOTE = "https://github.com/Yehor212/people-first-app.git";
const roots: string[] = [];
const BOUNDED_CHILD_PROCESS_READS = [
  [
    "trailing semicolon",
    `node -e "require('node:child_process').execFileSync('git',['status','--short'])";`,
  ],
  [
    "trailing whitespace",
    `node -e "require('node:child_process').execFileSync('git',['status','--short'])" `,
  ],
  [
    "empty options object",
    `node -e "require('node:child_process').execFileSync('git',['status','--short'],{})"`,
  ],
  [
    "additional literal console output",
    `node -e "require('node:child_process').execFileSync('git',['status','--short']);console.log('ok')"`,
  ],
  [
    "node-compatible module specifier",
    `node -e "require('child_process').execFileSync('git',['status','--short'])"`,
  ],
  [
    "destructured method binding",
    `node -e "const {execFileSync}=require('node:child_process');execFileSync('git',['status','--short'])"`,
  ],
  [
    "status branch detail",
    `node -e "require('node:child_process').execFileSync('git',['status','--short','--branch'])"`,
  ],
  [
    "opposite quote style",
    `node -e 'require("node:child_process").execFileSync("git",["status","--short"])'`,
  ],
] as const;
const SHELL_TOOL_ALIASES = [
  "Bash",
  "Shell",
  "PowerShell",
  "pwsh",
  "exec_command",
  "unified_exec",
] as const;
const OUTPUT_WRITE_COMMANDS = [
  ["git diff output", "git diff --output=../review.patch"],
  ["git show output", "git show --output=../review.patch HEAD"],
  ["git log output", "git log --output=../review.log -1"],
  ["sort output", "sort -o ../sorted.txt AGENTS.md"],
  ["macOS md5 output", "md5 -o ../digest.txt AGENTS.md"],
] as const;
const OUTPUT_WRITE_ALIAS_CASES = SHELL_TOOL_ALIASES.flatMap((toolName) =>
  OUTPUT_WRITE_COMMANDS.map(([label, command]) => [toolName, label, command] as const)
);

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Codex and Kimi workspace command guard", () => {
  it.each([
    ["Kimi write tool", { tool_name: "WriteFile", tool_input: { path: "src/new.ts" } }],
    ["Codex patch tool", { tool_name: "apply_patch", tool_input: { path: "src/new.ts" } }],
    ["Git commit", bash("git commit -m 'direct main'")],
    ["Git add", bash("git add src/new.ts")],
    ["Git pull", bash("git pull --ff-only")],
    ["non-fast-forward push", bash("git push origin main")],
    ["package formatter", bash("npm run format")],
    ["documentation generator", bash("npm run doc-counts:update")],
    ["direct npx writer", bash("npx prettier --write .")],
    ["unknown Node script", bash("node scripts/generator.mjs")],
    ["archive extraction", bash("tar -xf recovered-files.tar")],
    ["redirected shell write", bash("printf x > src/new.ts")],
  ])("blocks writes on main: %s", async (_label, event) => {
    const root = await gitWorkspace(CANONICAL_REMOTE);
    const result = runHook(root, { ...event, cwd: root });

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain("ZENFLOW AGENT WORKSPACE GUARD BLOCKED");
    expect(result.stderr).toContain("main");
  });

  it.each([
    "git reset --hard HEAD~1",
    "git reset --mixed HEAD~1",
    "git clean -fdx",
    "git restore --source=HEAD -- .",
    "git checkout -f main",
    "git switch -C rewritten",
    "git -C . rebase origin/main",
    "command git push --force-with-lease origin HEAD",
    "git push origin +HEAD:refs/heads/codex/guard-test",
    "git push --mirror origin",
    "git push --prune origin",
    "git stash push -u",
    "git remote set-url origin https://github.com/example/other.git",
    "git remote remove origin",
    "git config core.hooksPath /dev/null",
    "git -c core.hooksPath=/dev/null commit -m bypass",
    "git -c alias.ship='!git push --no-verify origin HEAD' ship",
    "HUSKY=0 git commit -m bypass",
    "env -i HUSKY=0 git commit --no-verify -m bypass",
    "git commit --no-verify -m bypass",
    "git commit -nq -m bypass",
    "git push --no-verify origin HEAD",
    "git fetch https://github.com/Yehor212/people-first-app.git +main:refs/remotes/origin/main",
    "node -e \"require('node:child_process').spawnSync('git', ['reset', '--hard'])\"",
    "git tag -f recovery-tip HEAD",
    "git notes add -m hidden-evidence",
    "git symbolic-ref HEAD refs/heads/kimi/confused",
    "git update-index --assume-unchanged README.md",
    "git hash-object -w README.md",
    "git init --initial-branch=main nested",
    "node scripts/untrusted-runner.mjs",
    "eval 'git reset --hard'",
    "source /tmp/opaque-mutator.sh",
    "rm -rf .",
    'touch "$OTHER_WORKTREE/confused.ts"',
    "git push origin HEAD:refs/tags/unsafe-release",
    "git push origin HEAD:refs/heads/kimi/cross-agent",
    "sh -lc 'git worktree remove --force ../other'",
    "/usr/bin/git branch -f old-work HEAD",
    "/usr/bin/git branch -C old-work replacement",
    "/usr/bin/git branch -D old-work",
  ])("blocks destructive Git on feature branches: %s", async (command) => {
    const root = await gitWorkspace(CANONICAL_REMOTE);
    git(root, ["switch", "-c", "codex/guard-test"]);

    const result = runHook(root, { ...bash(command), cwd: root });

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain("destructive");
  });

  it("blocks Git environment context that targets another ZenFlow lane", async () => {
    const main = await gitWorkspace(CANONICAL_REMOTE);
    const feature = await gitWorkspace(CANONICAL_REMOTE);
    git(feature, ["switch", "-c", "codex/current"]);

    const result = runHook(feature, {
      ...bash(`GIT_DIR=${path.join(main, ".git")} GIT_WORK_TREE=${main} git add .`),
      cwd: feature,
    });

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toMatch(/destructive|cross-worktree|main/);
  });

  it("tracks shell directory changes before classifying a write", async () => {
    const main = await gitWorkspace(CANONICAL_REMOTE);
    const feature = await gitWorkspace(CANONICAL_REMOTE);
    git(feature, ["switch", "-c", "codex/current"]);

    const result = runHook(feature, {
      ...bash(`cd ${main} && touch confused-deputy.ts`),
      cwd: feature,
    });

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toMatch(/cross-worktree|main/);
  });

  it.each([
    "npm run agent:workspace -- create --agent codex --task guarded --path /tmp/guarded",
    "npm --silent run agent:workspace -- create --agent codex --task guarded --path /tmp/guarded",
    "env -- pnpm --silent run agent:workspace -- create --agent codex --task guarded --path /tmp/guarded",
    "yarn --silent agent:workspace -- create --agent codex --task guarded --path /tmp/guarded",
    "bun --silent run agent:workspace -- create --agent codex --task guarded --path /tmp/guarded",
    "ACTION=create; npm run agent:workspace -- $ACTION --agent codex --task guarded --path /tmp/guarded",
    "node scripts/agent-workspace.mjs create --agent codex --task guarded --path /tmp/guarded",
    "node ./scripts/agent-workspace.mjs bootstrap-human-review --control-path /tmp/control --audio-source-path /tmp/source --audio-review-path /tmp/review --workspace-file /tmp/review.code-workspace",
    "cd scripts && node agent-workspace.mjs create --agent codex --task guarded --path /tmp/guarded",
    "Set-Location scripts; node agent-workspace.mjs sync --apply",
    "./scripts/agent-workspace.mjs sync --apply",
    "npm run agent:kimi-hook -- --apply",
    "npm --silent run agent:kimi-hook -- --apply",
    "MODE=apply; npm run agent:kimi-hook -- --$MODE",
    "$mode = 'apply'; npm --silent run agent:kimi-hook -- --$mode",
    "node scripts/install-kimi-workspace-hook.mjs --apply",
    "cd scripts && node install-kimi-workspace-hook.mjs --apply",
    "Set-Location scripts; node install-kimi-workspace-hook.mjs --restore --backup C:\\private-backup",
    "./scripts/install-kimi-workspace-hook.mjs --restore --backup /tmp/private-backup",
  ])(
    "blocks operator-only workspace mutations through every documented entrypoint: %s",
    async (command) => {
      const root = await gitWorkspace(CANONICAL_REMOTE);
      git(root, ["switch", "-c", "codex/guard-test"]);

      const result = runHook(root, { ...bash(command), cwd: root });

      expect(result.status, result.stderr).toBe(2);
      expect(result.stderr).toContain("operator-only");
    }
  );

  it("blocks an operator-only package script from a PowerShell tool surface", async () => {
    const root = await gitWorkspace(CANONICAL_REMOTE);
    git(root, ["switch", "-c", "codex/guard-test"]);

    const result = runHook(root, {
      cwd: root,
      tool_name: "PowerShell",
      tool_input: { command: "npm --silent run agent:kimi-hook -- --apply" },
    });

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain("operator-only");
  });

  it.each([
    "npm run agent':'workspace -- create --agent codex --task guarded --path /tmp/guarded",
    'npm run agent":"workspace -- create --agent codex --task guarded --path /tmp/guarded',
    "npm run agent\\:workspace -- create --agent codex --task guarded --path /tmp/guarded",
    "npm run agent:work''space -- cre''ate --agent codex --task guarded --path /tmp/guarded",
    "node scripts/agent-work''space.mjs cre''ate --agent codex --task guarded --path /tmp/guarded",
    "npm run agent:workspace -- s''ync --apply",
    "npm run agent:workspace -- sync --ap''ply",
    "npm run agent':'kimi-hook -- --apply",
    'npm run agent":"kimi-hook -- --apply',
    "npm run agent:kimi-hook -- --ap''ply",
    "npm run agent:kimi-hook -- --rest''ore --backup /tmp/private --receipt /tmp/receipt",
    "node scripts/install-kimi-workspace-ho''ok.mjs --ap''ply",
  ])("blocks operator-only shell-token concatenation: %s", async (command) => {
    const root = await gitWorkspace(CANONICAL_REMOTE);
    git(root, ["switch", "-c", "codex/guard-test"]);

    const result = runHook(root, { ...bash(command), cwd: root });

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain("operator-only");
  });

  it.each([
    "npm run agent`:workspace -- create --agent codex --task guarded --path C:\\guarded",
    "npm run agent:workspace -- sync --ap`ply",
    "npm run agent`:kimi-hook -- --apply",
    "node scripts/install-kimi-workspace-ho`ok.mjs --ap`ply",
  ])("blocks PowerShell backtick concatenation: %s", async (command) => {
    const root = await gitWorkspace(CANONICAL_REMOTE);
    git(root, ["switch", "-c", "codex/guard-test"]);

    const result = runHook(root, {
      cwd: root,
      tool_name: "PowerShell",
      tool_input: { command },
    });

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain("operator-only");
  });

  it.each([
    "npm run agent$'\\x3a'workspace -- create --agent codex --task guarded --path /tmp/guarded",
    "npm run agent$(printf :)workspace -- create --agent codex --task guarded --path /tmp/guarded",
    "ENTRY=agent:workspace; npm run $ENTRY -- create --agent codex --task guarded --path /tmp/guarded",
    'ENTRY=agent:workspace; npm run "$ENTRY" -- create --agent codex --task guarded --path /tmp/guarded',
    "npm run ${ENTRY} -- create --agent codex --task guarded --path /tmp/guarded",
    'npm run "$(printf agent:workspace)" -- create --agent codex --task guarded --path /tmp/guarded',
  ])(
    "blocks dynamic package-script selection that can hide an operator-only entrypoint: %s",
    async (command) => {
      const root = await gitWorkspace(CANONICAL_REMOTE);
      git(root, ["switch", "-c", "codex/guard-test"]);

      const result = runHook(root, { ...bash(command), cwd: root });

      expect(result.status, result.stderr).toBe(2);
      expect(result.stderr).toContain("operator-only");
    }
  );

  it.each([
    [
      "Bash",
      'pm=npm; s=agent:workspace; "$pm" run "$s" -- create --agent codex --task guarded --path /tmp/guarded',
    ],
    [
      "Bash",
      `bash -c 's=agent:workspace; npm run "$s" -- create --agent codex --task guarded --path /tmp/guarded'`,
    ],
    ["Bash", 's=agent:workspace; npm run-script "$s" -- sync --apply'],
    ["Bash", "npm run agent:worksp\\" + "\n" + "ace -- sync --apply"],
    [
      "Bash",
      "printf %s Y2QgL3RtcCAmJiBucG0gcnVuIGFnZW50OndvcmtzcGFjZSAtLSBzeW5jIC0tYXBwbHk= | base64 -d | sh",
    ],
    ["Bash", "./operator-wrapper"],
    ["Bash", "echo safe & ./operator-wrapper"],
    [
      "PowerShell",
      "cmd /c npm run agent:worksp^ace -- create --agent codex --task guarded --path C:\\guarded",
    ],
    [
      "PowerShell",
      "$pm='npm'; $s=('agent:'+'workspace'); & $pm run $s -- create --agent codex --task guarded --path C:\\guarded",
    ],
    ["PowerShell", "Invoke-Expression ('npm run agent:'+'workspace -- sync --apply')"],
    ["PowerShell", "Invoke-Expression ('npm run agent:'+'kimi-hook -- --apply')"],
    ["PowerShell", "Write-Output safe & cmd /c operator-wrapper"],
  ])(
    "fails closed for unknown or opaque operator-command dispatch: %s %s",
    async (toolName, command) => {
      const root = await gitWorkspace(CANONICAL_REMOTE);
      git(root, ["switch", "-c", "codex/guard-test"]);

      const result = runHook(root, {
        cwd: root,
        tool_name: toolName,
        tool_input: { command },
      });

      expect(result.status, result.stderr).toBe(2);
      expect(result.stderr).toMatch(/unknown|opaque|operator-only/);
    }
  );

  it("does not trust an arbitrary test-prefixed package relay", async () => {
    const root = await gitWorkspace(CANONICAL_REMOTE);
    git(root, ["switch", "-c", "codex/guard-test"]);

    const result = runHook(root, {
      ...bash("npm run test:operator-relay"),
      cwd: root,
    });

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toMatch(/unknown|reviewed/);
  });

  it("blocks executable substitutions inside otherwise allowed commands", async () => {
    const main = await gitWorkspace(CANONICAL_REMOTE);
    const feature = await gitWorkspace(CANONICAL_REMOTE);
    git(feature, ["switch", "-c", "codex/guard-test"]);
    const encoded = Buffer.from(
      `cd ${main} && npm run agent:workspace -- sync --apply`,
      "utf8"
    ).toString("base64");
    const cases = [
      ["Bash", `echo "$(printf %s ${encoded} | base64 -d | sh)"`],
      ["Bash", `git status --short "$(printf %s ${encoded} | base64 -d | sh)"`],
      ["Bash", `npm run test:agent-workspace -- "$(printf %s ${encoded} | base64 -d | sh)"`],
      ["Bash", `ls "$(printf %s ${encoded} | base64 -d | sh)"`],
      ["Bash", `cat <(printf %s ${encoded} | base64 -d | sh)`],
      ["Bash", 'echo "`printf %s ' + encoded + ' | base64 -d | sh`"'],
      [
        "PowerShell",
        `echo "$(Invoke-Expression ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'))))"`,
      ],
      ["Bash", 'echo "$\\' + "\n" + `(printf %s ${encoded} | base64 -d | sh)"`],
      ["Bash", "cat <\\" + "\n" + `(printf %s ${encoded} | base64 -d | sh)`],
      [
        "PowerShell",
        `echo @(Invoke-Expression ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'))))`,
      ],
      [
        "PowerShell",
        `echo (Invoke-Expression ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'))))`,
      ],
    ];

    for (const [toolName, command] of cases) {
      const result = runHook(feature, {
        cwd: feature,
        tool_name: toolName,
        tool_input: { command },
      });
      expect(result.status, `${command}\n${result.stderr}`).toBe(2);
      expect(result.stderr).toContain("executable shell expansion");
    }
  });

  it("recognizes a PowerShell-named tool as a shell surface", async () => {
    const root = await gitWorkspace(CANONICAL_REMOTE);
    git(root, ["switch", "-c", "codex/guard-test"]);

    const result = runHook(root, {
      cwd: root,
      tool_name: "PowerShell",
      tool_input: { command: "git reset --hard" },
    });

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain("destructive");
  });

  it("tracks PowerShell directory changes before classifying a write", async () => {
    const main = await gitWorkspace(CANONICAL_REMOTE);
    const feature = await gitWorkspace(CANONICAL_REMOTE);
    git(feature, ["switch", "-c", "codex/current"]);

    const result = runHook(feature, {
      cwd: feature,
      tool_name: "PowerShell",
      tool_input: {
        command: `Set-Location -Path ${main}; Set-Content -Path confused.ps1 -Value x`,
      },
    });

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toMatch(/cross-worktree|main/);
  });

  it("allows read-only commands and ordinary feature-branch edits", async () => {
    const root = await gitWorkspace(CANONICAL_REMOTE);
    git(root, ["switch", "-c", "codex/audio"]);

    expect(runHook(root, { ...bash("git status --short"), cwd: root }).status).toBe(0);
    expect(runHook(root, { ...bash("git remote get-url origin"), cwd: root }).status).toBe(0);
    expect(runHook(root, { ...bash("git config --get user.name"), cwd: root }).status).toBe(0);
    expect(
      runHook(root, {
        cwd: root,
        tool_name: "WriteFile",
        tool_input: { path: "public/sounds/nature/candidate.mp3" },
      }).status
    ).toBe(0);
    expect(runHook(root, { ...bash("git commit -m 'feature work'"), cwd: root }).status).toBe(0);
    expect(runHook(root, { ...bash("git clean -ndx"), cwd: root }).status).toBe(0);
    expect(runHook(root, { ...bash("echo safe 2>&1"), cwd: root }).status).toBe(0);
    expect(runHook(root, { ...bash("echo '$(literal)'"), cwd: root }).status).toBe(0);
    expect(runHook(root, { ...bash('echo "(literal)"'), cwd: root }).status).toBe(0);
    expect(runHook(root, { ...bash("npm run typecheck"), cwd: root }).status).toBe(0);
    expect(runHook(root, { ...bash("npm run test:agent-workspace"), cwd: root }).status).toBe(0);
    expect(runHook(root, { ...bash("npm run check:all"), cwd: root }).status).toBe(0);
  });

  it.each(["execFileSync", "spawnSync"])(
    "allows the direct bounded child_process git status probe via %s",
    async (method) => {
      const root = await gitWorkspace(CANONICAL_REMOTE);
      git(root, ["switch", "-c", "codex/guard-test"]);
      const command =
        `node -e "require('node:child_process').${method}` + `('git',['status','--short'])"`;

      const result = runHook(root, { ...bash(command), cwd: root });

      expect(result.status, result.stderr).toBe(0);
    }
  );

  it.each([
    [
      "literal Node file read",
      `node -e "const fs=require('node:fs'); console.log(fs.readFileSync('AGENTS.md','utf8').length + 0)"`,
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
  ])("allows the anchored corpus read-only class: %s", async (_label, command) => {
    const root = await gitWorkspace(CANONICAL_REMOTE);
    git(root, ["switch", "-c", "codex/guard-test"]);

    const result = runHook(root, { ...bash(command), cwd: root });

    expect(result.status, result.stderr).toBe(0);
  });

  it.each(["exec_command", "unified_exec"])(
    "accepts the exact literal child-process status probe from %s tool_input.cmd",
    async (toolName) => {
      const root = await gitWorkspace(CANONICAL_REMOTE);
      git(root, ["switch", "-c", "codex/guard-test"]);
      const cmd =
        `node -e "require('node:child_process').execFileSync` + `('git',['status','--short'])"`;

      const result = runHook(root, {
        cwd: root,
        tool_name: toolName,
        tool_input: { cmd },
      });

      expect(result.status, result.stderr).toBe(0);
    }
  );

  it.each([
    [
      "safe command plus mutating cmd",
      {
        command:
          `node -e "require('node:child_process').execFileSync` + `('git',['status','--short'])"`,
        cmd: "rm src/dual-field-danger.ts",
      },
    ],
    [
      "mutating command plus safe cmd",
      {
        command: "rm src/dual-field-danger.ts",
        cmd:
          `node -e "require('node:child_process').execFileSync` + `('git',['status','--short'])"`,
      },
    ],
  ])("blocks dual command fields with mixed intent: %s", async (_label, toolInput) => {
    const root = await gitWorkspace(CANONICAL_REMOTE);
    git(root, ["switch", "-c", "codex/guard-test"]);

    const result = runHook(root, {
      cwd: root,
      tool_name: "exec_command",
      tool_input: toolInput,
    });

    expect(result.status, result.stderr).toBe(2);
  });

  it("reports every mixed-field denial with a bounded evaluator owner and reason code", async () => {
    const root = await gitWorkspace(CANONICAL_REMOTE);
    git(root, ["switch", "-c", "codex/guard-test"]);
    const result = runUnifiedHook(root, {
      cwd: root,
      hook_event_name: "PreToolUse",
      tool_name: "exec_command",
      tool_input: {
        command:
          `node -e "require('node:child_process').execFileSync` + `('git',['status','--short'])"`,
        cmd: "rm src/dual-field-danger.ts",
      },
    });

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain(
      "Policy results: change_evidence:ambiguous_tool_input, " +
        "skill_routing:missing_or_invalid_skill_routing_evidence, " +
        "workspace:workspace_policy"
    );
    expect(result.stderr).toContain(
      "Reason codes: ambiguous_tool_input, missing_or_invalid_skill_routing_evidence, workspace_policy"
    );
  });

  it.each([
    [
      "path traversal in Node read",
      `node -e "const fs=require('node:fs'); console.log(fs.readFileSync('../AGENTS.md','utf8').length + 0)"`,
    ],
    [
      "path traversal in Python read",
      `python3 -c "from pathlib import Path; print(len(Path('../AGENTS.md').read_text()) + 0)"`,
    ],
    [
      "mutating Python subprocess",
      `python3 -c "import subprocess; print(subprocess.run(['git','reset','--hard'], capture_output=True).stdout)"`,
    ],
    ["rm help with an extra operand", `rm --help src/danger.ts`],
    ["git reset help with a mutating suffix", `git reset --help --hard`],
  ])("blocks the anchored corpus read-only near-miss: %s", async (_label, command) => {
    const root = await gitWorkspace(CANONICAL_REMOTE);
    git(root, ["switch", "-c", "codex/guard-test"]);

    const result = runHook(root, { ...bash(command), cwd: root });

    expect(result.status, result.stderr).toBe(2);
  });

  it.each(BOUNDED_CHILD_PROCESS_READS)(
    "allows the bounded read-only child_process variant: %s",
    async (_label, command) => {
      const root = await gitWorkspace(CANONICAL_REMOTE);
      git(root, ["switch", "-c", "codex/guard-test"]);

      const result = runHook(root, { ...bash(command), cwd: root });

      expect(result.status, result.stderr).toBe(0);
    }
  );

  it.each([
    [
      "dynamic argv",
      `node -e "const argv=['status','--short'];require('node:child_process').execFileSync('git',argv)"`,
    ],
    [
      "cwd option",
      `node -e "require('node:child_process').execFileSync('git',['status','--short'],{cwd:'..'})"`,
    ],
    [
      "env option",
      `node -e "require('node:child_process').spawnSync('git',['status','--short'],{env:{}})"`,
    ],
    [
      "shell option",
      `node -e "require('node:child_process').spawnSync('git',['status','--short'],{shell:true})"`,
    ],
    [
      "extra statement",
      `node -e "require('node:child_process').execFileSync('git',['status','--short']);require('node:fs').writeFileSync('changed.txt','x')"`,
    ],
    [
      "reset argv",
      `node -e "require('node:child_process').execFileSync('git',['reset','--hard'])"`,
    ],
    [
      "git diff output",
      `node -e "require('node:child_process').execFileSync('git',['diff','--output','review.patch'])"`,
    ],
    [
      "git show output",
      `node -e "require('node:child_process').execFileSync('git',['show','--output','review.patch'])"`,
    ],
    [
      "git log output",
      `node -e "require('node:child_process').execFileSync('git',['log','--output','review.patch'])"`,
    ],
  ])("blocks unsafe child_process probes: %s", async (_label, command) => {
    const root = await gitWorkspace(CANONICAL_REMOTE);
    git(root, ["switch", "-c", "codex/guard-test"]);

    const result = runHook(root, { ...bash(command), cwd: root });

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toMatch(/opaque|child-process|unknown|destructive/i);
  });

  it.each(BOUNDED_CHILD_PROCESS_READS)(
    "allows the bounded read-only variant through the full registered PreToolUse chain: %s",
    async (_label, command) => {
      const root = await gitWorkspace(CANONICAL_REMOTE);
      git(root, ["switch", "-c", "codex/guard-test"]);
      const results = runRegisteredPreToolChain(root, {
        ...bash(command),
        cwd: root,
        hook_event_name: "PreToolUse",
      });

      expect(results.length).toBeGreaterThan(0);
      for (const result of results) {
        expect(result.status, `${result.hook}: ${result.stderr}`).toBe(0);
      }
    }
  );

  it.each(["Bash", "Shell", "PowerShell", "pwsh", "exec_command", "unified_exec"])(
    "blocks a literal inline filesystem mutation through the full %s PreToolUse chain even with planning evidence",
    async (toolName) => {
      const root = await gitWorkspace(CANONICAL_REMOTE);
      git(root, ["switch", "-c", "codex/guard-test"]);
      await writePlanningEvidence(root);
      const command =
        `node -e "require('node:fs').writeFileSync(` +
        `'src/inline-${toolName.toLowerCase()}.ts','unsafe')"`;
      const commandField = ["exec_command", "unified_exec"].includes(toolName) ? "cmd" : "command";
      const results = runRegisteredPreToolChain(root, {
        cwd: root,
        hook_event_name: "PreToolUse",
        tool_name: toolName,
        tool_input: { [commandField]: command },
      });

      expect(results.length).toBeGreaterThan(0);
      expect(
        results.some(
          (result) => result.status === 2 && String(result.stderr).includes("workspace_policy")
        ),
        results.map((result) => `${result.hook}: ${result.stderr}`).join("\n")
      ).toBe(true);
    }
  );

  it("allows proven read-only shell commands on integration main", async () => {
    const root = await gitWorkspace(CANONICAL_REMOTE);

    expect(runHook(root, { ...bash("git status --short"), cwd: root }).status).toBe(0);
    expect(runHook(root, { ...bash("rg --files"), cwd: root }).status).toBe(0);
    expect(runHook(root, { ...bash("pwd && git diff --stat"), cwd: root }).status).toBe(0);
  });

  it.each([
    ["git diff output", "git diff --output=src/review.patch"],
    ["git show output", "git show --output=src/review.patch HEAD"],
    ["git log output", "git log --output=src/review.log -1"],
    ["sort output", "sort -o src/sorted.txt AGENTS.md"],
    ["macOS md5 output", "md5 -o src/digest.txt AGENTS.md"],
  ])("classifies the direct safe-looking write option as mutation: %s", async (_label, command) => {
    const root = await gitWorkspace(CANONICAL_REMOTE);
    git(root, ["switch", "-c", "codex/write-options"]);

    const result = runUnifiedHook(root, {
      ...bash(command),
      cwd: root,
      hook_event_name: "PreToolUse",
    });

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain(
      "Policy results: change_evidence:missing_or_invalid_change_evidence"
    );
  });

  it.each(OUTPUT_WRITE_ALIAS_CASES)(
    "attributes %s %s to both workspace and change-evidence controls",
    async (toolName, _label, command) => {
      const root = await gitWorkspace(CANONICAL_REMOTE);
      git(root, ["switch", "-c", "codex/output-owner"]);
      await writePlanningEvidence(root);
      const commandField = ["exec_command", "unified_exec"].includes(toolName) ? "cmd" : "command";

      const result = runUnifiedHook(root, {
        cwd: root,
        hook_event_name: "PreToolUse",
        tool_name: toolName,
        tool_input: { [commandField]: command },
      });

      expect(result.status, result.stderr).toBe(2);
      expect(result.stderr).toContain(
        "Policy results: change_evidence:missing_or_invalid_change_evidence, " +
          "workspace:workspace_policy"
      );
    }
  );

  it.each([
    ["git diff display option", "git diff --output-indicator-new=+"],
    ["git show display", "git show --format=oneline --no-patch HEAD"],
    ["git log display", "git log --oneline -1"],
    ["sort stdout", "sort AGENTS.md"],
    ["md5 stdout", "md5 AGENTS.md"],
  ])("keeps the corresponding no-output command read-only: %s", async (_label, command) => {
    const root = await gitWorkspace(CANONICAL_REMOTE);
    git(root, ["switch", "-c", "codex/read-options"]);

    const result = runUnifiedHook(root, {
      ...bash(command),
      cwd: root,
      hook_event_name: "PreToolUse",
    });

    expect(result.status, result.stderr).toBe(0);
  });

  it("binds nested-cwd planning evidence and guarded targets to the canonical Git root", async () => {
    const root = await gitWorkspace(CANONICAL_REMOTE);
    git(root, ["switch", "-c", "codex/nested-root"]);
    const nested = path.join(root, "packages", "nested");
    await mkdir(nested, { recursive: true });
    await writePlanningEvidence(root);
    await writeFile(path.join(nested, ".preflight-token"), "{malformed nested decoy", "utf8");

    const result = runUnifiedHook(nested, {
      cwd: nested,
      hook_event_name: "PreToolUse",
      tool_name: "WriteFile",
      tool_input: { path: path.join(root, "src", "nested-root.ts") },
    });

    expect(result.status, result.stderr).toBe(0);
  });

  it("allows a nested-cwd read-only command without consulting planning evidence", async () => {
    const root = await gitWorkspace(CANONICAL_REMOTE);
    git(root, ["switch", "-c", "codex/nested-read"]);
    const nested = path.join(root, "packages", "nested");
    await mkdir(nested, { recursive: true });
    await writeFile(path.join(root, ".preflight-token"), "{malformed root evidence", "utf8");

    const result = runUnifiedHook(nested, {
      cwd: nested,
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "git status --short" },
    });

    expect(result.status, result.stderr).toBe(0);
  });

  it("fails closed when an untrusted event cwd names a repository but launch cwd has no Git root", async () => {
    const repository = await gitWorkspace(CANONICAL_REMOTE);
    git(repository, ["switch", "-c", "codex/untrusted-event-root"]);
    const outside = await mkdtemp(path.join(tmpdir(), "zenflow-agent-guard-no-git-"));
    roots.push(outside);

    const result = runUnifiedHook(outside, {
      cwd: repository,
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "git status --short" },
    });

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain("Policy results: repository_root:repository_root_unavailable");
  });

  it("does not apply ZenFlow policy to an unrelated repository", async () => {
    const root = await gitWorkspace("https://github.com/example/other.git");

    const result = runHook(root, {
      cwd: root,
      tool_name: "WriteFile",
      tool_input: { path: "src/other.ts" },
    });

    expect(result.status, result.stderr).toBe(0);
  });

  it("does not globally block destructive Git in an unrelated repository", async () => {
    const root = await gitWorkspace("https://github.com/example/other.git");

    const result = runHook(root, {
      ...bash("git reset --hard HEAD"),
      cwd: root,
    });

    expect(result.status, result.stderr).toBe(0);
  });

  it("blocks destructive Git even when an unrelated cwd delegates with git -C", async () => {
    const zenflow = await gitWorkspace(CANONICAL_REMOTE);
    git(zenflow, ["switch", "-c", "codex/guard-test"]);
    const unrelated = await gitWorkspace("https://github.com/example/other.git");

    const result = runHook(unrelated, {
      ...bash(`git -C ${zenflow} reset --hard HEAD`),
      cwd: unrelated,
    });

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain("destructive");
  });

  it("resolves sequential git -C options before applying the ZenFlow policy", async () => {
    const zenflow = await gitWorkspace(CANONICAL_REMOTE);
    git(zenflow, ["switch", "-c", "codex/guard-test"]);
    const unrelated = await gitWorkspace("https://github.com/example/other.git");

    const result = runHook(unrelated, {
      ...bash(`git -C ${path.dirname(zenflow)} -C ${path.basename(zenflow)} reset --hard HEAD`),
      cwd: unrelated,
    });

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain("destructive");
  });

  it("blocks an absolute write into ZenFlow main from an unrelated cwd", async () => {
    const zenflow = await gitWorkspace(CANONICAL_REMOTE);
    const unrelated = await gitWorkspace("https://github.com/example/other.git");

    const result = runHook(unrelated, {
      cwd: unrelated,
      tool_name: "WriteFile",
      tool_input: { path: path.join(zenflow, "src", "confused-deputy.ts") },
    });

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain("main");
  });

  it("blocks writing from one ZenFlow feature lane into another lane", async () => {
    const current = await gitWorkspace(CANONICAL_REMOTE);
    const other = await gitWorkspace(CANONICAL_REMOTE);
    git(current, ["switch", "-c", "codex/current"]);
    git(other, ["switch", "-c", "kimi/other"]);

    const result = runHook(current, {
      cwd: current,
      tool_name: "WriteFile",
      tool_input: { path: path.join(other, "src", "cross-lane.ts") },
    });

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain("cross-worktree");
  });

  it("binds each client hook to its own branch prefix", async () => {
    const codex = await gitWorkspace(CANONICAL_REMOTE);
    const kimi = await gitWorkspace(CANONICAL_REMOTE);
    git(codex, ["switch", "-c", "codex/current"]);
    git(kimi, ["switch", "-c", "kimi/audio"]);
    const write = {
      tool_name: "WriteFile",
      tool_input: { path: "src/client-owned.ts" },
    };

    expect(runHook(codex, { ...write, cwd: codex }, "codex").status).toBe(0);
    expect(runHook(kimi, { ...write, cwd: kimi }, "kimi").status).toBe(0);

    for (const [root, actor] of [
      [codex, "kimi"],
      [kimi, "codex"],
    ] as const) {
      const result = runHook(root, { ...write, cwd: root }, actor);
      expect(result.status, result.stderr).toBe(2);
      expect(result.stderr).toMatch(/actor|client|branch prefix/i);
      expect(result.stderr).toContain(actor);
    }
  });

  it("finds cross-lane paths nested inside a multi-edit payload", async () => {
    const current = await gitWorkspace(CANONICAL_REMOTE);
    const other = await gitWorkspace(CANONICAL_REMOTE);
    git(current, ["switch", "-c", "codex/current"]);
    git(other, ["switch", "-c", "kimi/other"]);

    const result = runHook(current, {
      cwd: current,
      tool_name: "MultiEdit",
      tool_input: {
        edits: [
          {
            file_path: path.join(other, "src", "nested-cross-lane.ts"),
            new_string: "export {}",
          },
        ],
      },
    });

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain("cross-worktree");
  });

  it("fails closed when a cross-lane multi-edit target is beyond the path or depth bound", async () => {
    const current = await gitWorkspace(CANONICAL_REMOTE);
    const other = await gitWorkspace(CANONICAL_REMOTE);
    git(current, ["switch", "-c", "codex/current"]);
    git(other, ["switch", "-c", "kimi/other"]);
    const edits = Array.from({ length: 100 }, (_, index) => ({
      file_path: `src/local-${index}.ts`,
      new_string: "export {}",
    }));
    edits.push({
      file_path: path.join(other, "src", "path-101.ts"),
      new_string: "export {}",
    });

    for (const toolInput of [
      { edits },
      {
        wrapper: {
          level2: {
            level3: {
              level4: {
                level5: {
                  file_path: path.join(other, "src", "depth-5.ts"),
                },
              },
            },
          },
        },
      },
    ]) {
      const result = runHook(current, {
        cwd: current,
        tool_name: "MultiEdit",
        tool_input: toolInput,
      });

      expect(result.status, result.stderr).toBe(2);
      expect(result.stderr).toMatch(/dynamic|bounded|target/i);
    }
  });

  it("blocks filesystem commands whose omitted source operand belongs to another lane", async () => {
    const current = await gitWorkspace(CANONICAL_REMOTE);
    const other = await gitWorkspace(CANONICAL_REMOTE);
    git(current, ["switch", "-c", "codex/current"]);
    git(other, ["switch", "-c", "kimi/other"]);
    const otherFile = path.join(other, "src", "incomplete.ts");
    const events = [
      bash(`mv ${otherFile} ./recovered.ts`),
      bash(`ln ${otherFile} ./linked.ts`),
      bash(`rsync --remove-source-files ${otherFile} ./recovered.ts`),
      bash(`sed -i 's/x/y/' ${otherFile} ./local.ts`),
      {
        tool_name: "PowerShell",
        tool_input: {
          command: `Move-Item -Path '${otherFile}' -Destination './recovered.ts'`,
        },
      },
    ];

    for (const event of events) {
      const result = runHook(current, { ...event, cwd: current });
      expect(result.status, result.stderr).toBe(2);
      expect(result.stderr).toContain("cross-worktree");
    }
  });

  it("permits source-aware filesystem commands when every operand stays in the current lane", async () => {
    const current = await gitWorkspace(CANONICAL_REMOTE);
    git(current, ["switch", "-c", "codex/current"]);
    const events = [
      bash("mv ./src/a.ts ./src/b.ts"),
      bash("ln ./src/a.ts ./src/linked.ts"),
      bash("rsync --remove-source-files ./src/a.ts ./src/b.ts"),
      bash("sed -i 's/x/y/' ./src/a.ts ./src/b.ts"),
      {
        tool_name: "PowerShell",
        tool_input: {
          command: "Move-Item -Path './src/a.ts' -Destination './src/b.ts'",
        },
      },
    ];

    for (const event of events) {
      const result = runHook(current, { ...event, cwd: current });
      expect(result.status, result.stderr).toBe(0);
    }
  });

  it("blocks shell environment prefixes that can inject execution or cross-lane output", async () => {
    const current = await gitWorkspace(CANONICAL_REMOTE);
    const other = await gitWorkspace(CANONICAL_REMOTE);
    git(current, ["switch", "-c", "codex/current"]);
    git(other, ["switch", "-c", "kimi/other"]);
    const commands = [
      "GIT_EDITOR='sh -c touch /tmp/zenflow-env-sentinel' git commit",
      "GIT_EXTERNAL_DIFF='sh -c touch /tmp/zenflow-env-sentinel' git diff",
      "GIT_SSH_COMMAND='sh -c touch /tmp/zenflow-env-sentinel' git ls-remote origin",
      `GIT_TRACE=${path.join(other, "trace.log")} git status`,
      "NODE_OPTIONS=--require=/tmp/zenflow-env-sentinel npm run typecheck",
      "npm_config_script_shell=/tmp/zenflow-env-sentinel npm run typecheck",
    ];

    for (const command of commands) {
      const result = runHook(current, { ...bash(command), cwd: current });
      expect(result.status, result.stderr).toBe(2);
      expect(result.stderr).toMatch(/environment|override|unknown/i);
    }
  });

  it("blocks env split-string and chdir wrappers but permits a literal benign env wrapper", async () => {
    const current = await gitWorkspace(CANONICAL_REMOTE);
    const other = await gitWorkspace(CANONICAL_REMOTE);
    git(current, ["switch", "-c", "codex/current"]);
    git(other, ["switch", "-c", "kimi/other"]);

    for (const command of [
      `env -S 'sh -c \"touch /tmp/zenflow-env-sentinel\"'`,
      `env -C ${other} touch confused.ts`,
    ]) {
      const result = runHook(current, { ...bash(command), cwd: current });
      expect(result.status, result.stderr).toBe(2);
    }

    const benign = runHook(current, {
      ...bash("env -- npm run typecheck"),
      cwd: current,
    });
    expect(benign.status, benign.stderr).toBe(0);
  });

  it.each([
    "npm install",
    "npm update",
    "pnpm add left-pad",
    "yarn upgrade",
    "bun remove left-pad",
  ])("blocks package lifecycle execution inside agent hooks: %s", async (command) => {
    const current = await gitWorkspace(CANONICAL_REMOTE);
    git(current, ["switch", "-c", "codex/current"]);

    const result = runHook(current, { ...bash(command), cwd: current });

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toMatch(/opaque|child-process|lifecycle/i);
  });

  it.each([
    "sudo --chdir /tmp touch local-name",
    "sudo -D /tmp touch local-name",
    "doas touch local-name",
  ])("blocks privileged shell wrappers instead of guessing their cwd: %s", async (command) => {
    const current = await gitWorkspace(CANONICAL_REMOTE);
    git(current, ["switch", "-c", "codex/current"]);

    const result = runHook(current, { ...bash(command), cwd: current });

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toMatch(/privileged|operator-only/i);
  });

  it("tracks both unified-diff headers for a cross-lane deletion", async () => {
    const current = await gitWorkspace(CANONICAL_REMOTE);
    const other = await gitWorkspace(CANONICAL_REMOTE);
    git(current, ["switch", "-c", "codex/current"]);
    git(other, ["switch", "-c", "kimi/other"]);

    const result = runHook(current, {
      cwd: current,
      tool_name: "functions.apply_patch",
      tool_input: {
        input:
          `--- ${path.join(other, "src", "deleted.ts")}\n` +
          "+++ /dev/null\n" +
          "@@ -1 +0,0 @@\n" +
          "-export {};\n",
      },
    });

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain("cross-worktree");
  });

  it("concatenates adjacent quoted redirection segments before resolving the target", async () => {
    const current = await gitWorkspace(CANONICAL_REMOTE);
    const other = await gitWorkspace(CANONICAL_REMOTE);
    git(current, ["switch", "-c", "codex/current"]);
    git(other, ["switch", "-c", "kimi/other"]);
    const suffix = `/../${path.basename(other)}/confused.ts`;

    const result = runHook(current, {
      ...bash(`printf x > '${current}''${suffix}'`),
      cwd: current,
    });

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain("cross-worktree");
  });

  it("finds a cross-lane apply-patch move destination", async () => {
    const current = await gitWorkspace(CANONICAL_REMOTE);
    const other = await gitWorkspace(CANONICAL_REMOTE);
    git(current, ["switch", "-c", "codex/current"]);
    git(other, ["switch", "-c", "kimi/other"]);

    const result = runHook(current, {
      cwd: current,
      tool_name: "functions.apply_patch",
      tool_input: {
        input:
          "*** Begin Patch\n" +
          "*** Update File: src/current.ts\n" +
          `*** Move to: ${path.join(other, "src", "moved.ts")}\n` +
          "@@\n-old\n+new\n" +
          "*** End Patch\n",
      },
    });

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain("cross-worktree");
  });

  it("blocks git -C mutation from a feature lane into ZenFlow main", async () => {
    const main = await gitWorkspace(CANONICAL_REMOTE);
    const feature = await gitWorkspace(CANONICAL_REMOTE);
    git(feature, ["switch", "-c", "codex/current"]);

    const result = runHook(feature, {
      ...bash(`git -C ${main} add src/cross-lane.ts`),
      cwd: feature,
    });

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain("cross-worktree");
  });

  it("resolves an existing symlink before allowing a write target", async () => {
    const main = await gitWorkspace(CANONICAL_REMOTE);
    const feature = await gitWorkspace(CANONICAL_REMOTE);
    git(feature, ["switch", "-c", "codex/current"]);
    await mkdir(path.join(main, "src"), { recursive: true });
    const mainTarget = path.join(main, "src", "main-target.ts");
    await writeFile(mainTarget, "export {};\n", "utf8");
    const linkedTarget = path.join(feature, "linked-main-target.ts");
    await symlink(mainTarget, linkedTarget);

    const result = runHook(feature, {
      cwd: feature,
      tool_name: "WriteFile",
      tool_input: { path: linkedTarget },
    });

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain("cross-worktree");
  });

  it("blocks a structured write through an existing hardlinked target", async () => {
    const current = await gitWorkspace(CANONICAL_REMOTE);
    const other = await gitWorkspace(CANONICAL_REMOTE);
    git(current, ["switch", "-c", "codex/current"]);
    git(other, ["switch", "-c", "kimi/other"]);
    await mkdir(path.join(current, "src"), { recursive: true });
    await mkdir(path.join(other, "src"), { recursive: true });
    const otherTarget = path.join(other, "src", "shared.ts");
    const currentTarget = path.join(current, "src", "shared.ts");
    await writeFile(otherTarget, "export const shared = true;\n", "utf8");
    await link(otherTarget, currentTarget);

    const result = runHook(current, {
      cwd: current,
      tool_name: "WriteFile",
      tool_input: { path: "src/shared.ts" },
    });

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toMatch(/hardlink|multiple filesystem links/i);
  });

  it("fails closed on malformed matching-hook input", async () => {
    const root = await gitWorkspace(CANONICAL_REMOTE);
    const result = spawnSync(process.execPath, [HOOK, "--expected-agent", "codex"], {
      cwd: root,
      encoding: "utf8",
      input: "{not-json",
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Malformed hook input");
  });

  it("turns a catchable first-party dependency load failure into an owned exit-2 denial", async () => {
    const root = await gitWorkspace(CANONICAL_REMOTE);
    git(root, ["switch", "-c", "codex/bootstrap-failure"]);
    const preload = path.join(root, "block-change-evidence-load.cjs");
    await writeFile(
      preload,
      [
        `"use strict";`,
        `const Module = require("node:module");`,
        `const originalLoad = Module._load;`,
        `Module._load = function(request, parent, isMain) {`,
        `  if (String(request).includes("codex-governance/change-gate-core.cjs")) {`,
        `    throw new Error("isolated fixture dependency failure");`,
        `  }`,
        `  return Reflect.apply(originalLoad, this, [request, parent, isMain]);`,
        `};`,
        ``,
      ].join("\n"),
      "utf8"
    );

    const result = spawnSync(
      process.execPath,
      ["--require", preload, HOOK, "--expected-agent", "codex"],
      {
        cwd: root,
        encoding: "utf8",
        input: JSON.stringify({
          cwd: root,
          hook_event_name: "PreToolUse",
          tool_name: "Bash",
          tool_input: { command: "git status --short" },
        }),
      }
    );

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain("Policy results: hook_runtime:bootstrap_failure");
    expect(result.stderr).toContain("Reason codes: bootstrap_failure");
    expect(result.stderr).not.toContain("at Module._load");
  });

  it("is import-safe and still executes through a relative symlink spelling", async () => {
    const root = await gitWorkspace(CANONICAL_REMOTE);
    git(root, ["switch", "-c", "codex/direct-entry"]);
    const importProbe = spawnSync(
      process.execPath,
      [
        "-e",
        `const hook = require(${JSON.stringify(HOOK)}); ` +
          `if (typeof hook.main !== "function") process.exit(7);`,
      ],
      {
        cwd: root,
        encoding: "utf8",
      }
    );

    expect(importProbe.status, importProbe.stderr).toBe(0);
    expect(importProbe.stdout).toBe("");

    const linkDirectory = path.join(root, "tool-links");
    const linkPath = path.join(linkDirectory, "workspace-guard.cjs");
    await mkdir(linkDirectory, { recursive: true });
    await symlink(HOOK, linkPath);
    const directProbe = spawnSync(
      process.execPath,
      [path.relative(root, linkPath), "--expected-agent", "codex"],
      {
        cwd: root,
        encoding: "utf8",
        input: JSON.stringify({
          cwd: root,
          hook_event_name: "PreToolUse",
          tool_name: "Bash",
          tool_input: { command: "git status --short" },
        }),
      }
    );

    expect(directProbe.status, directProbe.stderr).toBe(0);
  });

  it("fails closed when the hook registration omits its client actor binding", async () => {
    const root = await gitWorkspace(CANONICAL_REMOTE);
    const result = spawnSync(process.execPath, [HOOK], {
      cwd: root,
      encoding: "utf8",
      input: JSON.stringify({
        cwd: root,
        tool_name: "WriteFile",
        tool_input: { path: "src/new.ts" },
      }),
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Client actor: unbound");
    expect(result.stderr).toContain("actor binding");
  });

  it("evaluates bounded 1, 20, and 100-target payloads within the Kimi hook timeout", async () => {
    const root = await gitWorkspace(CANONICAL_REMOTE);
    git(root, ["switch", "-c", "kimi/performance"]);
    const timings: Array<{ elapsedMs: number; targets: number }> = [];

    for (const count of [1, 20, 100]) {
      const startedAt = performance.now();
      const result = runHook(
        root,
        {
          cwd: root,
          tool_name: "MultiEdit",
          tool_input: {
            edits: Array.from({ length: count }, (_, index) => ({
              file_path: `src/performance-${index}.ts`,
              new_string: "export {}",
            })),
          },
        },
        "kimi"
      );
      const elapsedMs = performance.now() - startedAt;

      expect(result.status, result.stderr).toBe(0);
      expect(elapsedMs, `${count} targets took ${elapsedMs.toFixed(2)}ms`).toBeLessThan(5_000);
      timings.push({ elapsedMs: Number(elapsedMs.toFixed(2)), targets: count });
    }
    console.info("Kimi hook bounded-target timing", timings);
  });

  it("keeps the registered read-only guard below the 100-run latency budget", async () => {
    const root = await gitWorkspace(CANONICAL_REMOTE);
    git(root, ["switch", "-c", "codex/performance"]);
    const durations: number[] = [];

    for (let index = 0; index < 100; index += 1) {
      const startedAt = performance.now();
      const result = spawnSync(process.execPath, [HOOK, "--expected-agent", "codex"], {
        cwd: root,
        encoding: "utf8",
        input: JSON.stringify({
          cwd: root,
          hook_event_name: "PreToolUse",
          tool_name: "Bash",
          tool_input: { command: "git status --short" },
        }),
      });
      durations.push(performance.now() - startedAt);
      expect(result.status, result.stderr).toBe(0);
    }

    const sorted = durations.toSorted((left, right) => left - right);
    const summary = {
      p50: sorted[Math.ceil(sorted.length * 0.5) - 1],
      p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
      max: sorted.at(-1)!,
    };
    console.info("Registered read-only guard 100-run timing", summary);
    expect(summary.p95).toBeLessThan(500);
    expect(summary.max).toBeLessThan(1_000);
  }, 20_000);

  it("fails closed on a write when the Git identity probe cannot run", async () => {
    const root = await gitWorkspace(CANONICAL_REMOTE);
    const result = spawnSync(process.execPath, [HOOK, "--expected-agent", "codex"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, PATH: "" },
      input: JSON.stringify({
        cwd: root,
        tool_name: "WriteFile",
        tool_input: { path: "src/new.ts" },
      }),
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("identity");
  });
});

function bash(command: string) {
  return {
    tool_name: "Bash",
    tool_input: { command },
  };
}

async function gitWorkspace(remote: string): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "zenflow-agent-guard-"));
  roots.push(root);
  git(root, ["init", "--initial-branch=main"]);
  git(root, ["config", "user.name", "Agent Guard Test"]);
  git(root, ["config", "user.email", "agent-guard@example.invalid"]);
  git(root, ["remote", "add", "origin", remote]);
  return root;
}

async function writePlanningEvidence(root: string): Promise<void> {
  const timestamp = new Date().toISOString();
  await writeFile(
    path.join(root, ".preflight-token"),
    `${JSON.stringify(
      {
        timestamp,
        goal: "Exercise the full registered PreToolUse chain in an isolated test fixture",
        depth: "L4",
        verdict: "GO",
        authorization: false,
        evidence_only: true,
        test_first: {
          timestamp,
          behavior: "Literal inline shell mutations remain blocked by the workspace policy",
          risk: "Planning evidence could be misinterpreted as mutation authority",
          evidence_type: "red_green_regression",
          command: "npx vitest run scripts/__tests__/agent-workspace-command-guard.test.ts",
          expected_red: "The registered chain currently allows the inline filesystem mutation",
          verification_plan: "Rerun the same alias matrix after the minimal guard change",
          verdict: "GO",
        },
        skill_routing: {
          timestamp,
          prompt_summary: "Verify planning evidence does not authorize shell mutations",
          explicit_plugins: [],
          selected_skills: ["superpowers:test-driven-development"],
          skipped_obvious: [
            {
              name: "superpowers:brainstorming",
              reason: "The regression contract is already defined",
            },
          ],
          decision: "Use the existing full-chain harness and exact alias matrix",
          verification_plan: "Require workspace_policy from the registered PreToolUse chain",
          verdict: "GO",
        },
      },
      null,
      2
    )}\n`,
    { mode: 0o600 }
  );
}

function runHook(cwd: string, payload: object, expectedAgent = "codex") {
  return spawnSync(process.execPath, [WORKSPACE_EVALUATOR, "--expected-agent", expectedAgent], {
    cwd,
    encoding: "utf8",
    input: JSON.stringify(payload),
  });
}

function runUnifiedHook(cwd: string, payload: object, expectedAgent = "codex") {
  return spawnSync(process.execPath, [HOOK, "--expected-agent", expectedAgent], {
    cwd,
    encoding: "utf8",
    input: JSON.stringify(payload),
  });
}

function runRegisteredPreToolChain(cwd: string, payload: Record<string, unknown>) {
  const config = JSON.parse(readFileSync(path.join(SOURCE_ROOT, ".codex/hooks.json"), "utf8")) as {
    hooks: {
      PreToolUse: Array<{
        matcher?: string;
        hooks: Array<{ command: string }>;
      }>;
    };
  };
  const toolName = String(payload.tool_name || "");
  return config.hooks.PreToolUse.flatMap((group) => {
    const matchers = String(group.matcher || "")
      .split("|")
      .map((token) => token.trim())
      .filter(Boolean);
    if (matchers.length > 0 && !matchers.includes(toolName)) return [];
    return group.hooks.map((registration) => {
      const hookMatch = registration.command.match(/\.codex\/hooks\/([A-Za-z0-9._-]+\.cjs)/);
      if (!hookMatch)
        throw new Error(`Unsupported registered hook command: ${registration.command}`);
      const hook = path.join(SOURCE_ROOT, ".codex", "hooks", hookMatch[1]);
      const args = registration.command.includes("--expected-agent codex")
        ? [hook, "--expected-agent", "codex"]
        : [hook];
      const result = spawnSync(process.execPath, args, {
        cwd,
        encoding: "utf8",
        input: JSON.stringify(payload),
      });
      return { hook: hookMatch[1], ...result };
    });
  });
}

function git(cwd: string, args: string[]): string {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout;
}
