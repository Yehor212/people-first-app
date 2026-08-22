import { spawnSync } from "node:child_process";
import {
  appendFile,
  chmod,
  copyFile,
  link,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const HOOK = path.resolve(".codex/hooks/agent-workspace-guard.cjs");
const PROJECT_ROOT = path.resolve(".");
const CANONICAL_REMOTE = "https://github.com/Yehor212/people-first-app.git";
const REVIEWED_SPEC_KIT_COMMANDS = [
  ".specify/scripts/bash/check-prerequisites.sh --json --paths-only",
  ".specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks",
  ".specify/scripts/bash/setup-plan.sh --json",
  ".specify/scripts/bash/setup-tasks.sh --json",
] as const;
const READ_ONLY_SPEC_KIT_COMMAND = REVIEWED_SPEC_KIT_COMMANDS[0];
const STATEFUL_SPEC_KIT_COMMANDS = REVIEWED_SPEC_KIT_COMMANDS.slice(1);
const REVIEWED_SPEC_KIT_SCRIPTS = [
  ".specify/scripts/bash/check-prerequisites.sh",
  ".specify/scripts/bash/setup-plan.sh",
  ".specify/scripts/bash/setup-tasks.sh",
] as const;
const SPEC_KIT_COMMAND_BY_SCRIPT = new Map([
  [REVIEWED_SPEC_KIT_SCRIPTS[0], REVIEWED_SPEC_KIT_COMMANDS[0]],
  [REVIEWED_SPEC_KIT_SCRIPTS[1], REVIEWED_SPEC_KIT_COMMANDS[2]],
  [REVIEWED_SPEC_KIT_SCRIPTS[2], REVIEWED_SPEC_KIT_COMMANDS[3]],
]);
const setupPlan = REVIEWED_SPEC_KIT_COMMANDS[2];
const prerequisites = READ_ONLY_SPEC_KIT_COMMAND;
const SPEC_KIT_NON_EXACT_COMMANDS = [
  [
    "arbitrary script",
    () => ".specify/scripts/bash/arbitrary.sh --json",
    /unknown shell execution/,
  ],
  ["bash wrapper", () => `bash ${setupPlan}`, /opaque child-process execution/],
  ["sh wrapper", () => `sh ${setupPlan}`, /opaque child-process execution/],
  ["nested bash wrapper", () => `bash -c '${setupPlan}'`, /unknown shell execution/],
  ["nested sh wrapper", () => `sh -c '${setupPlan}'`, /unknown shell execution/],
  ["nested env execution", () => `env -- ${setupPlan}`, /unknown shell execution/],
  [
    "absolute path",
    (root: string) => `${path.join(root, ".specify/scripts/bash/setup-plan.sh")} --json`,
    /unknown shell execution/,
  ],
  ["control operator", () => `${setupPlan} && git status --short`, /unknown shell execution/],
  ["redirection", () => `${setupPlan} > /tmp/spec-kit.json`, /unknown shell execution/],
  ["substitution", () => `${setupPlan} $(pwd)`, /executable shell expansion/],
  [
    "missing argument",
    () => ".specify/scripts/bash/check-prerequisites.sh --json",
    /unknown shell execution/,
  ],
  [
    "reordered arguments",
    () => ".specify/scripts/bash/check-prerequisites.sh --paths-only --json",
    /unknown shell execution/,
  ],
  ["duplicated argument", () => `${setupPlan} --json`, /unknown shell execution/],
  ["unexpected argument", () => `${setupPlan} --verbose`, /unknown shell execution/],
  ["appended command", () => `${prerequisites}; git status --short`, /unknown shell execution/],
  ["environment prefix", () => `LC_ALL=C ${setupPlan}`, /shell environment override/],
  ["leading space", () => ` ${setupPlan}`, /unknown shell execution/],
  ["trailing space", () => `${setupPlan} `, /unknown shell execution/],
  ["leading tab", () => `\t${setupPlan}`, /unknown shell execution/],
  ["trailing tab", () => `${setupPlan}\t`, /unknown shell execution/],
  ["leading newline", () => `\n${setupPlan}`, /unknown shell execution/],
  ["trailing newline", () => `${setupPlan}\n`, /unknown shell execution/],
] satisfies ReadonlyArray<readonly [string, (root: string) => string, RegExp]>;
const HOOK_HARNESS_FILES = [
  ".codex/hooks/agent-workspace-guard.cjs",
  "scripts/agent-workspace-command-guard.cjs",
  "scripts/agent-workspace-core.cjs",
  "scripts/codex-governance/tool-targets.cjs",
  ".specify/zenflow-install-manifest.json",
  ...REVIEWED_SPEC_KIT_SCRIPTS,
] as const;
const roots: string[] = [];

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
    expect(runHook(root, { ...bash("npm run doctor:agent"), cwd: root }).status).toBe(0);
    expect(runHook(root, { ...bash("npm run check:all"), cwd: root }).status).toBe(0);
  });

  it("allows proven read-only shell commands on integration main", async () => {
    const root = await gitWorkspace(CANONICAL_REMOTE);

    expect(runHook(root, { ...bash("git status --short"), cwd: root }).status).toBe(0);
    expect(runHook(root, { ...bash("rg --files"), cwd: root }).status).toBe(0);
    expect(runHook(root, { ...bash("pwd && git diff --stat"), cwd: root }).status).toBe(0);
  });

  it("allows the exact reviewed read-only Spec Kit command on integration main", async () => {
    const { hook, root } = await guardedGitWorkspace(CANONICAL_REMOTE);

    const result = runHook(
      root,
      { ...bash(READ_ONLY_SPEC_KIT_COMMAND), cwd: root },
      "codex",
      hook
    );

    expect(result.status, result.stderr).toBe(0);
  });

  it.each(STATEFUL_SPEC_KIT_COMMANDS)(
    "blocks the exact stateful Spec Kit command on integration main: %s",
    async (command) => {
      const { hook, root } = await guardedGitWorkspace(CANONICAL_REMOTE);
      await pinFeature(root);

      const result = runHook(root, { ...bash(command), cwd: root }, "codex", hook);

      expect(result.status, result.stderr).toBe(2);
      expect(result.stderr).toContain("main is integration-only");
    }
  );

  it.each(STATEFUL_SPEC_KIT_COMMANDS)(
    "allows the exact stateful Spec Kit command in its canonical codex lane: %s",
    async (command) => {
      const { hook, root } = await guardedGitWorkspace(CANONICAL_REMOTE);
      git(root, ["switch", "-c", "codex/spec-kit"]);
      await pinFeature(root);

      const result = runHook(root, { ...bash(command), cwd: root }, "codex", hook);

      expect(result.status, result.stderr).toBe(0);
    }
  );

  it.each(STATEFUL_SPEC_KIT_COMMANDS)(
    "rejects an out-of-lane feature target for the stateful Spec Kit command: %s",
    async (command) => {
      const { hook, root } = await guardedGitWorkspace(CANONICAL_REMOTE);
      git(root, ["switch", "-c", "codex/spec-kit"]);
      await pinFeature(root, "../outside-feature", false);

      const result = runHook(root, { ...bash(command), cwd: root }, "codex", hook);

      expect(result.status, result.stderr).toBe(2);
      expect(result.stderr).toContain("unknown shell execution");
    }
  );

  it("rejects a symlinked feature target for a stateful Spec Kit command", async () => {
    const { hook, root } = await guardedGitWorkspace(CANONICAL_REMOTE);
    git(root, ["switch", "-c", "codex/spec-kit"]);
    const realFeature = path.join(root, "specs/001-real");
    const linkedFeature = path.join(root, "specs/001-linked");
    await mkdir(realFeature, { recursive: true });
    await symlink(realFeature, linkedFeature, "dir");
    await pinFeature(root, "specs/001-linked", false);

    const result = runHook(root, { ...bash(setupPlan), cwd: root }, "codex", hook);

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain("unknown shell execution");
  });

  it("rejects a symlinked setup-plan output target", async () => {
    const { hook, root } = await guardedGitWorkspace(CANONICAL_REMOTE);
    git(root, ["switch", "-c", "codex/spec-kit"]);
    const featureDirectory = "specs/001-linked-plan";
    await pinFeature(root, featureDirectory);
    const outsidePlan = path.join(root, "outside-plan.md");
    await writeFile(outsidePlan, "outside\n", "utf8");
    await symlink(outsidePlan, path.join(root, featureDirectory, "plan.md"));

    const result = runHook(root, { ...bash(setupPlan), cwd: root }, "codex", hook);

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain("unknown shell execution");
  });

  it.each(["symlink", "hard link"] as const)(
    "rejects a %s feature-state target when the environment would persist it",
    async (linkKind) => {
      const { hook, root } = await guardedGitWorkspace(CANONICAL_REMOTE);
      git(root, ["switch", "-c", "codex/spec-kit"]);
      const featureDirectory = "specs/001-env-state";
      const featureState = path.join(root, ".specify/feature.json");
      const linkedState = path.join(root, "linked-feature-state.json");
      await pinFeature(root, featureDirectory);
      await writeFile(linkedState, `${JSON.stringify({ feature_directory: featureDirectory })}\n`);
      await rm(featureState);
      if (linkKind === "symlink") await symlink(linkedState, featureState);
      else await link(linkedState, featureState);

      const result = runHook(
        root,
        { ...bash(setupPlan), cwd: root },
        "codex",
        hook,
        { SPECIFY_FEATURE_DIRECTORY: featureDirectory }
      );

      expect(result.status, result.stderr).toBe(2);
      expect(result.stderr).toContain("unknown shell execution");
    }
  );

  it("allows a canonical environment-selected feature target in its codex lane", async () => {
    const { hook, root } = await guardedGitWorkspace(CANONICAL_REMOTE);
    git(root, ["switch", "-c", "codex/spec-kit"]);
    const featureDirectory = "specs/001-env-canonical";
    await mkdir(path.join(root, featureDirectory), { recursive: true });

    const result = runHook(
      root,
      { ...bash(setupPlan), cwd: root },
      "codex",
      hook,
      { SPECIFY_FEATURE_DIRECTORY: featureDirectory }
    );

    expect(result.status, result.stderr).toBe(0);
  });

  it("rejects an environment-selected out-of-lane feature target", async () => {
    const { hook, root } = await guardedGitWorkspace(CANONICAL_REMOTE);
    git(root, ["switch", "-c", "codex/spec-kit"]);

    const result = runHook(
      root,
      { ...bash(setupPlan), cwd: root },
      "codex",
      hook,
      { SPECIFY_FEATURE_DIRECTORY: path.resolve(root, "../outside-feature") }
    );

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain("unknown shell execution");
  });

  it("rejects an environment-selected Spec Kit project outside the current lane", async () => {
    const { hook, root } = await guardedGitWorkspace(CANONICAL_REMOTE);
    git(root, ["switch", "-c", "codex/spec-kit"]);
    await pinFeature(root);

    const result = runHook(
      root,
      { ...bash(setupPlan), cwd: root },
      "codex",
      hook,
      { SPECIFY_INIT_DIR: path.resolve(root, "..") }
    );

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain("unknown shell execution");
  });

  it.each([
    [
      "root event.cwd with nested input.workdir",
      (root: string, nested: string) => ({ eventCwd: root, inputWorkdir: nested }),
    ],
    [
      "nested event.cwd with root input.workdir",
      (root: string, nested: string) => ({ eventCwd: nested, inputWorkdir: root }),
    ],
    [
      "root input.cwd with nested input.workdir",
      (root: string, nested: string) => ({ inputCwd: root, inputWorkdir: nested }),
    ],
    [
      "nested input.cwd with root input.workdir",
      (root: string, nested: string) => ({ inputCwd: nested, inputWorkdir: root }),
    ],
    [
      "root event.cwd with relative nested input.workdir",
      (root: string) => ({ eventCwd: root, inputWorkdir: "nested" }),
    ],
  ] as const)("rejects conflicting Spec Kit location evidence: %s", async (_label, locations) => {
    const { hook, root } = await guardedGitWorkspace(CANONICAL_REMOTE);
    const nested = path.join(root, "nested");
    await mkdir(nested, { recursive: true });
    const payload = bashWithLocations(prerequisites, locations(root, nested));

    const result = runHook(root, payload, "codex", hook);

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain("unknown shell execution");
  });

  it.each([
    ["relative event cwd", { eventCwd: ".", inputCwd: "./", inputWorkdir: "." }],
    ["relative input cwd", { eventCwd: "./", inputCwd: ".", inputWorkdir: "./" }],
  ] as const)(
    "allows canonically equivalent Spec Kit location evidence: %s",
    async (_label, locations) => {
      const { hook, root } = await guardedGitWorkspace(CANONICAL_REMOTE);
      const payload = bashWithLocations(prerequisites, locations);

      const result = runHook(root, payload, "codex", hook);

      expect(result.status, result.stderr).toBe(0);
    }
  );

  it.each([
    ["event.cwd only", (root: string) => ({ eventCwd: root })],
    ["input.cwd only", () => ({ inputCwd: "." })],
    ["input.workdir only", () => ({ inputWorkdir: "./" })],
  ] as const)("allows omitted Spec Kit location fields: %s", async (_label, locationsForRoot) => {
    const { hook, root } = await guardedGitWorkspace(CANONICAL_REMOTE);
    const payload = bashWithLocations(prerequisites, locationsForRoot(root));

    const result = runHook(root, payload, "codex", hook);

    expect(result.status, result.stderr).toBe(0);
  });

  it.each([
    ["empty event.cwd", (root: string) => ({ eventCwd: "", inputCwd: root })],
    ["whitespace event.cwd", (root: string) => ({ eventCwd: "\t", inputCwd: root })],
    ["empty input.cwd", (root: string) => ({ eventCwd: root, inputCwd: "" })],
    ["whitespace input.cwd", (root: string) => ({ eventCwd: root, inputCwd: "  " })],
    ["empty input.workdir", (root: string) => ({ eventCwd: root, inputWorkdir: "" })],
  ] as const)(
    "rejects supplied empty or whitespace Spec Kit location evidence: %s",
    async (_label, locationsForRoot) => {
      const { hook, root } = await guardedGitWorkspace(CANONICAL_REMOTE);
      const payload = bashWithLocations(prerequisites, locationsForRoot(root));

      const result = runHook(root, payload, "codex", hook);

      expect(result.status, result.stderr).toBe(2);
      expect(result.stderr).toContain("unknown shell execution");
    }
  );

  it("rejects a whitespace input.workdir that names a nested Spec Kit lookalike", async () => {
    const { hook, root } = await guardedGitWorkspace(CANONICAL_REMOTE);
    const whitespaceWorkdir = "   ";
    const lookalike = path.join(
      root,
      whitespaceWorkdir,
      ".specify/scripts/bash/check-prerequisites.sh"
    );
    await mkdir(path.dirname(lookalike), { recursive: true });
    await copyFile(path.join(root, ".specify/scripts/bash/check-prerequisites.sh"), lookalike);
    await chmod(lookalike, 0o755);
    const payload = bashWithLocations(prerequisites, {
      eventCwd: root,
      inputWorkdir: whitespaceWorkdir,
    });

    const result = runHook(root, payload, "codex", hook);

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain("unknown shell execution");
  });

  it.each([
    ["object event.cwd", (root: string) => ({ eventCwd: { path: root }, inputCwd: root })],
    ["numeric input.cwd", (root: string) => ({ eventCwd: root, inputCwd: 0 })],
    ["null input.workdir", (root: string) => ({ eventCwd: root, inputWorkdir: null })],
  ] as const)(
    "rejects malformed Spec Kit location evidence: %s",
    async (_label, locationsForRoot) => {
      const { hook, root } = await guardedGitWorkspace(CANONICAL_REMOTE);
      const payload = bashWithLocations(prerequisites, locationsForRoot(root));

      const result = runHook(root, payload, "codex", hook);

      expect(result.status, result.stderr).toBe(2);
      expect(result.stderr).toContain("unknown shell execution");
    }
  );

  it("rejects a reviewed Spec Kit command without payload location evidence", async () => {
    const { hook, root } = await guardedGitWorkspace(CANONICAL_REMOTE);

    const result = runHook(root, bash(prerequisites), "codex", hook);

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain("unknown shell execution");
  });

  it("rejects root payload fields when the hook executor cwd is nested", async () => {
    const { hook, root } = await guardedGitWorkspace(CANONICAL_REMOTE);
    const nested = path.join(root, "nested");
    const nestedScript = path.join(nested, ".specify/scripts/bash/check-prerequisites.sh");
    await mkdir(path.dirname(nestedScript), { recursive: true });
    await copyFile(path.join(root, ".specify/scripts/bash/check-prerequisites.sh"), nestedScript);
    await chmod(nestedScript, 0o755);
    const payload = bashWithLocations(prerequisites, {
      eventCwd: root,
      inputCwd: root,
      inputWorkdir: root,
    });

    const result = runHook(nested, payload, "codex", hook);

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain("unknown shell execution");
  });

  it.each(SPEC_KIT_NON_EXACT_COMMANDS)(
    "rejects the non-exact Spec Kit command variant: %s",
    async (label, commandForRoot, reason) => {
      const { hook, root } = await guardedGitWorkspace(CANONICAL_REMOTE);
      git(root, ["switch", "-c", "codex/spec-kit"]);
      const command = commandForRoot(root);

      const result = runHook(root, { ...bash(command), cwd: root }, "codex", hook);

      expect(result.status, `${label}: ${command}\n${result.stderr}`).toBe(2);
      expect(result.stderr, `${label}: ${command}`).toMatch(reason);
    }
  );

  it.each(REVIEWED_SPEC_KIT_COMMANDS)(
    "rejects a nested-cwd Spec Kit lookalike: %s",
    async (command) => {
      const { hook, root } = await guardedGitWorkspace(CANONICAL_REMOTE);
      git(root, ["switch", "-c", "codex/spec-kit"]);
      const script = command.split(" ", 1)[0];
      const nestedRoot = path.join(root, "nested");
      const nestedScript = path.join(nestedRoot, script);
      await mkdir(path.dirname(nestedScript), { recursive: true });
      await copyFile(path.join(root, script), nestedScript);
      await chmod(nestedScript, 0o755);

      const result = runHook(nestedRoot, { ...bash(command), cwd: nestedRoot }, "codex", hook);

      expect(result.status, result.stderr).toBe(2);
      expect(result.stderr).toContain("unknown shell execution");
    }
  );

  it.each(REVIEWED_SPEC_KIT_SCRIPTS)(
    "rejects modified reviewed Spec Kit target bytes: %s",
    async (script) => {
      const { hook, root } = await guardedGitWorkspace(CANONICAL_REMOTE);
      git(root, ["switch", "-c", "codex/spec-kit"]);
      await appendFile(path.join(root, script), "\n# modified after review\n", "utf8");
      const command = SPEC_KIT_COMMAND_BY_SCRIPT.get(script);
      expect(command).toBeTruthy();

      const result = runHook(root, { ...bash(command!), cwd: root }, "codex", hook);

      expect(result.status, result.stderr).toBe(2);
      expect(result.stderr).toContain("unknown shell execution");
    }
  );

  it.each(REVIEWED_SPEC_KIT_SCRIPTS)(
    "rejects a symlinked reviewed Spec Kit target: %s",
    async (script) => {
      const { hook, root } = await guardedGitWorkspace(CANONICAL_REMOTE);
      git(root, ["switch", "-c", "codex/spec-kit"]);
      const target = path.join(root, script);
      const lookalike = path.join(root, "lookalikes", path.basename(script));
      await mkdir(path.dirname(lookalike), { recursive: true });
      await copyFile(target, lookalike);
      await chmod(lookalike, 0o755);
      await rm(target);
      await symlink(lookalike, target);
      const command = SPEC_KIT_COMMAND_BY_SCRIPT.get(script);
      expect(command).toBeTruthy();

      const result = runHook(root, { ...bash(command!), cwd: root }, "codex", hook);

      expect(result.status, result.stderr).toBe(2);
      expect(result.stderr).toContain("unknown shell execution");
    }
  );

  it.each(REVIEWED_SPEC_KIT_SCRIPTS)(
    "rejects a hard-linked reviewed Spec Kit target: %s",
    async (script) => {
      const { hook, root } = await guardedGitWorkspace(CANONICAL_REMOTE);
      git(root, ["switch", "-c", "codex/spec-kit"]);
      const target = path.join(root, script);
      const lookalike = path.join(root, "lookalikes", path.basename(script));
      await mkdir(path.dirname(lookalike), { recursive: true });
      await link(target, lookalike);
      const command = SPEC_KIT_COMMAND_BY_SCRIPT.get(script);
      expect(command).toBeTruthy();

      const result = runHook(root, { ...bash(command!), cwd: root }, "codex", hook);

      expect(result.status, result.stderr).toBe(2);
      expect(result.stderr).toContain("unknown shell execution");
    }
  );

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

function bashWithLocations(
  command: string,
  locations: {
    eventCwd?: unknown;
    inputCwd?: unknown;
    inputWorkdir?: unknown;
  }
) {
  const payload: {
    cwd?: unknown;
    tool_name: string;
    tool_input: { command: string; cwd?: unknown; workdir?: unknown };
  } = bash(command);
  if (Object.hasOwn(locations, "eventCwd")) payload.cwd = locations.eventCwd;
  if (Object.hasOwn(locations, "inputCwd")) payload.tool_input.cwd = locations.inputCwd;
  if (Object.hasOwn(locations, "inputWorkdir")) {
    payload.tool_input.workdir = locations.inputWorkdir;
  }
  return payload;
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

async function guardedGitWorkspace(remote: string): Promise<{ hook: string; root: string }> {
  const root = await realpath(await gitWorkspace(remote));
  for (const relativePath of HOOK_HARNESS_FILES) {
    const destination = path.join(root, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(PROJECT_ROOT, relativePath), destination);
    if (relativePath.endsWith(".sh")) await chmod(destination, 0o755);
  }
  return { hook: path.join(root, ".codex/hooks/agent-workspace-guard.cjs"), root };
}

function runHook(
  cwd: string,
  payload: object,
  expectedAgent = "codex",
  hook = HOOK,
  environment: NodeJS.ProcessEnv = {}
) {
  const childEnvironment = { ...process.env };
  delete childEnvironment.SPECIFY_FEATURE_DIRECTORY;
  delete childEnvironment.SPECIFY_INIT_DIR;
  Object.assign(childEnvironment, environment);
  return spawnSync(process.execPath, [hook, "--expected-agent", expectedAgent], {
    cwd,
    encoding: "utf8",
    env: childEnvironment,
    input: JSON.stringify(payload),
  });
}

async function pinFeature(
  root: string,
  featureDirectory = "specs/001-workspace-guard",
  createDirectory = true
) {
  await mkdir(path.join(root, ".specify"), { recursive: true });
  await writeFile(
    path.join(root, ".specify/feature.json"),
    `${JSON.stringify({ feature_directory: featureDirectory })}\n`,
    "utf8"
  );
  if (createDirectory) {
    await mkdir(path.resolve(root, featureDirectory), { recursive: true });
  }
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
