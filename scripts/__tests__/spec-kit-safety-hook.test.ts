import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const HOOK = resolve(".codex/hooks/spec-kit-safety-gate.cjs");
const temporaryRoots: string[] = [];

function createGitHubRepository(prefix: string): string {
  const repositoryRoot = mkdtempSync(join(tmpdir(), prefix));
  temporaryRoots.push(repositoryRoot);

  const initialized = spawnSync("git", ["init"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  if (initialized.status !== 0) {
    throw new Error(initialized.stderr || "Failed to initialize temporary git repository");
  }

  const remoteAdded = spawnSync(
    "git",
    ["remote", "add", "origin", "https://github.com/Yehor212/people-first-app.git"],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
    }
  );
  if (remoteAdded.status !== 0) {
    throw new Error(remoteAdded.stderr || "Failed to add origin to temporary git repository");
  }

  return repositoryRoot;
}

function runGitHubMcpIssueCreate(
  repositoryRoot: string,
  repositoryFullName: string,
  authorization?: string
) {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.SPECIFY_INIT_DIR;
  delete env.SPECIFY_FEATURE_DIRECTORY;
  if (authorization === undefined) {
    delete env.ZENFLOW_SPECKIT_GITHUB_ISSUES_AUTHORIZATION;
  } else {
    env.ZENFLOW_SPECKIT_GITHUB_ISSUES_AUTHORIZATION = authorization;
  }

  return spawnSync(process.execPath, [HOOK], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env,
    input: JSON.stringify({
      hook_event_name: "PreToolUse",
      tool_name: "mcp__codex_apps__github_create_issue",
      tool_input: {
        repository_full_name: repositoryFullName,
        title: "T001: test",
      },
    }),
  });
}

function runAuthorizedShellIssueCreate(
  repositoryRoot: string,
  command: string,
  ghRepository?: string
) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ZENFLOW_SPECKIT_GITHUB_ISSUES_AUTHORIZATION: "Yehor212/people-first-app#1",
  };
  delete env.SPECIFY_INIT_DIR;
  delete env.SPECIFY_FEATURE_DIRECTORY;
  if (ghRepository === undefined) {
    delete env.GH_REPO;
  } else {
    env.GH_REPO = ghRepository;
  }

  return spawnSync(process.execPath, [HOOK], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env,
    input: JSON.stringify({
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command },
    }),
  });
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("Spec Kit safety hook", () => {
  it("is registered once for Codex shell and GitHub MCP pre-tool calls on POSIX and Windows", () => {
    const configuration = JSON.parse(readFileSync(resolve(".codex/hooks.json"), "utf8")) as {
      hooks: {
        PreToolUse: Array<{
          matcher?: string;
          hooks: Array<{
            command?: string;
            commandWindows?: string;
            timeout?: number;
            type?: string;
          }>;
        }>;
      };
    };
    const registrations = configuration.hooks.PreToolUse.flatMap((group) =>
      group.hooks.map((hook) => ({ ...hook, matcher: group.matcher }))
    ).filter((hook) => hook.command?.includes("spec-kit-safety-gate.cjs"));

    expect(registrations).toHaveLength(1);
    expect(registrations[0]?.matcher).toMatch(/Bash|Shell|PowerShell|pwsh|exec_command/);
    expect(registrations[0]?.matcher).toMatch(/github_create_issue|issue_write/);
    expect(registrations[0]).toMatchObject({ type: "command", timeout: 5 });
    expect(registrations[0]?.command).toContain("spec-kit-safety-gate.cjs");
    expect(registrations[0]?.commandWindows).toContain("spec-kit-safety-gate.cjs");
  });

  it("blocks setup-plan when feature.json points outside the current repository", () => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "zenflow-spec-kit-repository-"));
    const outsideFeatureDirectory = mkdtempSync(
      join(tmpdir(), "zenflow-spec-kit-outside-feature-")
    );
    temporaryRoots.push(repositoryRoot, outsideFeatureDirectory);

    const initialized = spawnSync("git", ["init"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    if (initialized.status !== 0) {
      throw new Error(initialized.stderr || "Failed to initialize temporary git repository");
    }

    mkdirSync(join(repositoryRoot, ".specify"), { recursive: true });
    writeFileSync(
      join(repositoryRoot, ".specify", "feature.json"),
      `${JSON.stringify({ feature_directory: outsideFeatureDirectory })}\n`,
      "utf8"
    );

    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.SPECIFY_FEATURE_DIRECTORY;
    delete env.SPECIFY_INIT_DIR;
    delete env.ZENFLOW_SPECKIT_GITHUB_ISSUES_AUTHORIZATION;

    const result = spawnSync(process.execPath, [HOOK], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env,
      input: JSON.stringify({
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {
          command: ".specify/scripts/bash/setup-plan.sh --json",
        },
      }),
    });

    expect(result.status, result.stderr).toBe(2);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/outside (?:the )?current repository/i);
  });

  it("blocks setup-plan when SPECIFY_FEATURE_DIRECTORY points outside the current repository", () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), "zenflow-spec-kit-environment-"));
    const repositoryRoot = join(temporaryRoot, "repository");
    const outsideFeatureDirectory = join(temporaryRoot, "outside-feature");
    temporaryRoots.push(temporaryRoot);

    mkdirSync(repositoryRoot, { recursive: true });
    mkdirSync(outsideFeatureDirectory, { recursive: true });

    const initialized = spawnSync("git", ["init"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    if (initialized.status !== 0) {
      throw new Error(initialized.stderr || "Failed to initialize temporary git repository");
    }

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      SPECIFY_FEATURE_DIRECTORY: outsideFeatureDirectory,
    };
    delete env.SPECIFY_INIT_DIR;
    delete env.ZENFLOW_SPECKIT_GITHUB_ISSUES_AUTHORIZATION;

    const result = spawnSync(process.execPath, [HOOK], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env,
      input: JSON.stringify({
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {
          command: ".specify/scripts/bash/setup-plan.sh --json",
        },
      }),
    });

    expect(result.status, result.stderr).toBe(2);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/SPECIFY_FEATURE_DIRECTORY/i);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/outside (?:the )?current repository/i);
  });

  it("blocks create-new-feature when inherited SPECIFY_INIT_DIR points to a sibling repository", () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), "zenflow-spec-kit-init-directory-"));
    const repositoryRoot = join(temporaryRoot, "repository");
    const outsideInitDirectory = join(temporaryRoot, "outside-spec-kit-project");
    temporaryRoots.push(temporaryRoot);

    mkdirSync(join(repositoryRoot, ".specify"), { recursive: true });
    mkdirSync(join(outsideInitDirectory, ".specify"), { recursive: true });

    for (const cwd of [repositoryRoot, outsideInitDirectory]) {
      const initialized = spawnSync("git", ["init"], {
        cwd,
        encoding: "utf8",
      });
      if (initialized.status !== 0) {
        throw new Error(initialized.stderr || "Failed to initialize temporary git repository");
      }
    }

    const previousInitDirectory = process.env.SPECIFY_INIT_DIR;
    const previousFeatureDirectory = process.env.SPECIFY_FEATURE_DIRECTORY;
    const previousIssueAuthorization = process.env.ZENFLOW_SPECKIT_GITHUB_ISSUES_AUTHORIZATION;

    process.env.SPECIFY_INIT_DIR = outsideInitDirectory;
    delete process.env.SPECIFY_FEATURE_DIRECTORY;
    delete process.env.ZENFLOW_SPECKIT_GITHUB_ISSUES_AUTHORIZATION;

    try {
      const result = spawnSync(process.execPath, [HOOK], {
        cwd: repositoryRoot,
        encoding: "utf8",
        input: JSON.stringify({
          hook_event_name: "PreToolUse",
          tool_name: "Bash",
          tool_input: {
            command: ".specify/scripts/bash/create-new-feature.sh --json inherited-init-dir",
          },
        }),
      });

      expect(result.status, result.stderr).toBe(2);
      expect(`${result.stdout}\n${result.stderr}`).toMatch(/SPECIFY_INIT_DIR/i);
      expect(`${result.stdout}\n${result.stderr}`).toMatch(/outside (?:the )?current repository/i);
    } finally {
      if (previousInitDirectory === undefined) {
        delete process.env.SPECIFY_INIT_DIR;
      } else {
        process.env.SPECIFY_INIT_DIR = previousInitDirectory;
      }
      if (previousFeatureDirectory === undefined) {
        delete process.env.SPECIFY_FEATURE_DIRECTORY;
      } else {
        process.env.SPECIFY_FEATURE_DIRECTORY = previousFeatureDirectory;
      }
      if (previousIssueAuthorization === undefined) {
        delete process.env.ZENFLOW_SPECKIT_GITHUB_ISSUES_AUTHORIZATION;
      } else {
        process.env.ZENFLOW_SPECKIT_GITHUB_ISSUES_AUTHORIZATION = previousIssueAuthorization;
      }
    }
  });

  it("blocks the bundled specify workflow and requires explicit Spec Kit skills", () => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "zenflow-spec-kit-workflow-"));
    temporaryRoots.push(repositoryRoot);

    const initialized = spawnSync("git", ["init"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    if (initialized.status !== 0) {
      throw new Error(initialized.stderr || "Failed to initialize temporary git repository");
    }

    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.SPECIFY_INIT_DIR;
    delete env.SPECIFY_FEATURE_DIRECTORY;
    delete env.ZENFLOW_SPECKIT_GITHUB_ISSUES_AUTHORIZATION;

    const result = spawnSync(process.execPath, [HOOK], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env,
      input: JSON.stringify({
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {
          command: "specify workflow run speckit",
        },
      }),
    });

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toMatch(/bundled workflow is disabled/i);
    expect(result.stderr).toMatch(/explicit Spec Kit skills are required/i);
  });

  it("blocks GitHub issue creation without current direct user authorization", () => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "zenflow-spec-kit-github-issues-"));
    temporaryRoots.push(repositoryRoot);

    const initialized = spawnSync("git", ["init"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    if (initialized.status !== 0) {
      throw new Error(initialized.stderr || "Failed to initialize temporary git repository");
    }

    const remoteAdded = spawnSync(
      "git",
      ["remote", "add", "origin", "https://github.com/Yehor212/people-first-app.git"],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
      }
    );
    if (remoteAdded.status !== 0) {
      throw new Error(remoteAdded.stderr || "Failed to add origin to temporary git repository");
    }

    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.SPECIFY_INIT_DIR;
    delete env.SPECIFY_FEATURE_DIRECTORY;
    delete env.ZENFLOW_SPECKIT_GITHUB_ISSUES_AUTHORIZATION;

    const result = spawnSync(process.execPath, [HOOK], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env,
      input: JSON.stringify({
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {
          command: "gh issue create --title test --body test",
        },
      }),
    });

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toMatch(/current direct user authorization/i);
    expect(result.stderr).toMatch(/ZENFLOW_SPECKIT_GITHUB_ISSUES_AUTHORIZATION/);
  });

  it("blocks GitHub issue creation when authorization targets a different origin", () => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "zenflow-spec-kit-github-issues-"));
    temporaryRoots.push(repositoryRoot);

    const initialized = spawnSync("git", ["init"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    if (initialized.status !== 0) {
      throw new Error(initialized.stderr || "Failed to initialize temporary git repository");
    }

    const remoteAdded = spawnSync(
      "git",
      ["remote", "add", "origin", "https://github.com/Yehor212/people-first-app.git"],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
      }
    );
    if (remoteAdded.status !== 0) {
      throw new Error(remoteAdded.stderr || "Failed to add origin to temporary git repository");
    }

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ZENFLOW_SPECKIT_GITHUB_ISSUES_AUTHORIZATION: "Other/repo#1",
    };
    delete env.SPECIFY_INIT_DIR;
    delete env.SPECIFY_FEATURE_DIRECTORY;

    const result = spawnSync(process.execPath, [HOOK], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env,
      input: JSON.stringify({
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {
          command: "gh issue create --title test --body test",
        },
      }),
    });

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toMatch(/authorization target does not match origin/i);
    expect(result.stderr).toMatch(/Yehor212\/people-first-app#1/);
  });

  it("blocks shell issue creation even for the exact authorized origin", () => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "zenflow-spec-kit-github-issues-"));
    temporaryRoots.push(repositoryRoot);

    const initialized = spawnSync("git", ["init"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    if (initialized.status !== 0) {
      throw new Error(initialized.stderr || "Failed to initialize temporary git repository");
    }

    const remoteAdded = spawnSync(
      "git",
      ["remote", "add", "origin", "https://github.com/Yehor212/people-first-app.git"],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
      }
    );
    if (remoteAdded.status !== 0) {
      throw new Error(remoteAdded.stderr || "Failed to add origin to temporary git repository");
    }

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ZENFLOW_SPECKIT_GITHUB_ISSUES_AUTHORIZATION: "Yehor212/people-first-app#1",
    };
    delete env.SPECIFY_INIT_DIR;
    delete env.SPECIFY_FEATURE_DIRECTORY;

    const result = spawnSync(process.execPath, [HOOK], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env,
      input: JSON.stringify({
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {
          command: "gh issue create --title test --body test",
        },
      }),
    });

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toMatch(/shell GitHub issue commands are disabled/i);
    expect(result.stderr).toMatch(/structured GitHub MCP/i);
  });

  it("blocks an authorized shell issue write with an explicit repository override", () => {
    const repositoryRoot = createGitHubRepository("zenflow-spec-kit-github-repo-flag-");

    const result = runAuthorizedShellIssueCreate(
      repositoryRoot,
      "gh issue create --repo Other/repo --title test --body test"
    );

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toMatch(/shell GitHub issue commands are disabled/i);
    expect(result.stderr).toMatch(/structured GitHub MCP/i);
  });

  it("blocks a compact -R repository override on an authorized shell issue write", () => {
    const repositoryRoot = createGitHubRepository("zenflow-spec-kit-github-compact-repo-flag-");

    const result = runAuthorizedShellIssueCreate(
      repositoryRoot,
      "gh issue create -ROther/repo --title test --body test"
    );

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toMatch(/shell GitHub issue commands are disabled/i);
    expect(result.stderr).toMatch(/structured GitHub MCP/i);
  });

  it("blocks an authorized shell issue write with a mismatched inherited GH_REPO", () => {
    const repositoryRoot = createGitHubRepository("zenflow-spec-kit-github-repo-env-");

    const result = runAuthorizedShellIssueCreate(
      repositoryRoot,
      "gh issue create --title test --body test",
      "Other/repo"
    );

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toMatch(/shell GitHub issue commands are disabled/i);
    expect(result.stderr).toMatch(/structured GitHub MCP/i);
  });

  it.each([
    [
      "single-quoted repository selector",
      "gh issue create '--repo' Other/repo --title test --body test",
    ],
    [
      "double-quoted repository selector",
      'gh issue create "--repo" Other/repo --title test --body test',
    ],
    ["escaped issue token", "gh iss\\ue create --title test --body test"],
    ["concatenated create token", "gh issue cre''ate --title test --body test"],
    ["variable-expanded subcommand", 'gh issue "$SUBCOMMAND" --title test --body test'],
    ["issue new alias", "gh issue new --title test --body test"],
    ["PowerShell-escaped gh token", "g\u0060h issue create --title test --body test"],
    ["Windows gh.exe executable", "gh.exe issue create --repo Other/repo --title test --body test"],
    [
      "Bash variable executable",
      "\u0024{CLI} issue create --repo Other/repo --title test --body test",
    ],
    [
      "Bash command-substitution executable",
      "\u0024(printf gh) issue create --repo Other/repo --title test --body test",
    ],
    [
      "PowerShell variable executable",
      "& \u0024CLI issue create --repo Other/repo --title test --body test",
    ],
    ["shell alias executable", "g issue create --repo Other/repo --title test --body test"],
    [
      "env unset option",
      "env -u GH_REPO gh issue create --repo Other/repo --title test --body test",
    ],
    [
      "env option terminator before issue write",
      "env -- gh issue create --repo Other/repo --title test --body test",
    ],
    [
      "env empty and populated assignments",
      "env EMPTY= MODE=test gh issue create --repo Other/repo --title test --body test",
    ],
    [
      "env split-string command",
      "env -S 'gh issue create --repo Other/repo --title test --body test'",
    ],
    [
      "command option terminator",
      "command -- gh issue create --repo Other/repo --title test --body test",
    ],
    [
      "command default-path option",
      "command -p gh issue create --repo Other/repo --title test --body test",
    ],
    ["sudo user option", "sudo -u root gh issue create --repo Other/repo --title test --body test"],
    ["sudo set-home option", "sudo -H gh issue create --repo Other/repo --title test --body test"],
    [
      "Bash command wrapper",
      "bash -c 'gh issue create --repo Other/repo --title test --body test'",
    ],
    [
      "POSIX sh command wrapper",
      "sh -c 'gh issue create --repo Other/repo --title test --body test'",
    ],
    [
      "Zsh login-command wrapper",
      "zsh -lc 'gh issue create --repo Other/repo --title test --body test'",
    ],
    ["eval wrapper", "eval 'gh issue create --repo Other/repo --title test --body test'"],
    [
      "PowerShell command wrapper",
      `pwsh -Command "gh issue create --repo Other/repo --title test --body test"`,
    ],
    [
      "Windows cmd wrapper",
      "cmd.exe /c gh.exe issue create --repo Other/repo --title test --body test",
    ],
    [
      "absolute GitHub CLI path",
      "/opt/homebrew/bin/gh issue create --repo Other/repo --title test --body test",
    ],
    [
      "repository flag before the issue namespace",
      "gh -R Other/repo issue create --title test --body test",
    ],
    [
      "long repository flag before the issue namespace",
      "gh --repo Other/repo issue create --title test --body test",
    ],
    [
      "repository flag before the issue action",
      "gh issue -R Other/repo create --title test --body test",
    ],
    [
      "long repository flag before the issue action",
      "gh issue --repo=Other/repo create --title test --body test",
    ],
    ["issue edit", "gh issue edit 1 --title changed"],
    ["issue close", "gh issue close 1"],
    ["issue comment", "gh issue comment 1 --body changed"],
    ["issue delete", "gh issue delete 1 --yes"],
    ["issue develop", "gh issue develop 1 --name changed"],
    ["issue lock", "gh issue lock 1"],
    ["issue pin", "gh issue pin 1"],
    ["issue reopen", "gh issue reopen 1"],
    ["issue transfer", "gh issue transfer 1 Other/repo"],
    ["issue unlock", "gh issue unlock 1"],
    ["issue unpin", "gh issue unpin 1"],
    [
      "quoted POSIX GitHub CLI path with spaces",
      "'/Applications/GitHub CLI/gh' issue create --repo Other/repo --title test --body test",
    ],
    [
      "quoted Windows GitHub CLI path with spaces",
      '"C:\\Program Files\\GitHub CLI\\gh.exe" issue create --repo Other/repo --title test --body test',
    ],
    [
      "PowerShell quoted Windows GitHub CLI path with spaces",
      '& "C:\\Program Files\\GitHub CLI\\gh.exe" issue create --repo Other/repo --title test --body test',
    ],
    [
      "env-wrapped quoted GitHub CLI path with spaces",
      "env -- '/Applications/GitHub CLI/gh' issue create --repo Other/repo --title test --body test",
    ],
    [
      "command-wrapped quoted GitHub CLI path with spaces",
      "command -- '/Applications/GitHub CLI/gh' issue create --repo Other/repo --title test --body test",
    ],
    [
      "shell-wrapped quoted GitHub CLI path with spaces",
      "bash -c '\"/Applications/GitHub CLI/gh\" issue create --repo Other/repo --title test --body test'",
    ],
  ])("blocks the %s shell form before execution", (_label, command) => {
    const repositoryRoot = createGitHubRepository("zenflow-spec-kit-github-shell-form-");

    const result = runAuthorizedShellIssueCreate(repositoryRoot, command);

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toMatch(/shell GitHub issue commands are disabled/i);
    expect(result.stderr).toMatch(/structured GitHub MCP/i);
  });

  it("blocks an env-wrapped GitHub API issue write", () => {
    const repositoryRoot = createGitHubRepository("zenflow-spec-kit-github-env-api-write-");

    const result = runAuthorizedShellIssueCreate(
      repositoryRoot,
      "env -- gh api --method POST repos/Yehor212/people-first-app/issues -f title=test"
    );

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toMatch(/gh api issue creation is forbidden/i);
  });

  it.each([
    ["echo documentation", "echo issue create documentation"],
    ["repository search", "rg 'issue create' docs"],
    ["GitHub CLI documentation output", "echo 'gh issue create --title docs'"],
    ["GitHub CLI documentation search", "rg 'gh issue create' docs"],
    ["alias documentation output", "printf '%s\\n' 'g issue create'"],
    ["Spec Kit workflow documentation", "echo 'specify workflow run speckit'"],
    ["GitHub API documentation", "echo 'gh api --method POST repos/example/issues'"],
    ["read-only GitHub API call", "gh api repos/Yehor212/people-first-app/issues"],
    ["read-only GitHub issue list", "gh issue list"],
    ["read-only GitHub issue view", "gh issue view 1"],
    ["read-only GitHub issue status", "gh issue status"],
    ["read-only GitHub issue help", "gh issue --help"],
    ["read-only issue list after repository flag", "gh -R Yehor212/people-first-app issue list"],
    ["read-only issue view after repository flag", "gh issue -R Yehor212/people-first-app view 1"],
    [
      "explicit GET with query field",
      "gh api --method GET repos/Yehor212/people-first-app/issues -f state=open",
    ],
    [
      "compact explicit GET with typed field",
      "gh api -XGET repos/Yehor212/people-first-app/issues -F state=open",
    ],
    ["env-wrapped benign output", "env -u GH_REPO echo issue create documentation"],
    ["command-wrapped benign output", "command -- echo issue create documentation"],
    ["command executable lookup", "command -v gh"],
    ["sudo version inspection", "sudo -V gh issue create documentation"],
    ["Bash benign payload", "bash -c 'echo issue create documentation'"],
    ["POSIX sh benign payload", "sh -c 'echo gh issue create documentation'"],
    ["eval benign payload", "eval 'echo issue create documentation'"],
    ["PowerShell benign payload", `pwsh -Command "Write-Output 'issue create documentation'"`],
    [
      "env-wrapped explicit GET",
      "env -- gh api --method GET repos/Yehor212/people-first-app/issues -f state=open",
    ],
    ["focused test name", "npm test -- --testNamePattern='issue create'"],
    ["local Node output", `node -e "console.log('issue new')"`],
    [
      "quoted unrelated POSIX executable",
      "'/Applications/Other CLI/tool' issue create documentation",
    ],
    [
      "PowerShell quoted unrelated Windows executable",
      '& "C:\\Program Files\\Other CLI\\tool.exe" issue create documentation',
    ],
  ])("allows benign shell text for %s", (_label, command) => {
    const repositoryRoot = createGitHubRepository("zenflow-spec-kit-github-benign-text-");

    const result = runAuthorizedShellIssueCreate(repositoryRoot, command);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("{}");
  });

  it("blocks GitHub MCP issue creation without inherited target authorization", () => {
    const repositoryRoot = createGitHubRepository("zenflow-spec-kit-github-mcp-");

    const result = runGitHubMcpIssueCreate(repositoryRoot, "Yehor212/people-first-app");

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toMatch(/current direct user authorization/i);
    expect(result.stderr).toMatch(/ZENFLOW_SPECKIT_GITHUB_ISSUES_AUTHORIZATION/);
  });

  it("blocks GitHub MCP issue creation when the requested repository differs from origin", () => {
    const repositoryRoot = createGitHubRepository("zenflow-spec-kit-github-mcp-target-");

    const result = runGitHubMcpIssueCreate(
      repositoryRoot,
      "Other/repo",
      "Yehor212/people-first-app#1"
    );

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toMatch(/requested repository does not match origin/i);
  });

  it("allows one GitHub MCP issue creation for the exact authorized origin", () => {
    const repositoryRoot = createGitHubRepository("zenflow-spec-kit-github-mcp-authorized-");

    const result = runGitHubMcpIssueCreate(
      repositoryRoot,
      "Yehor212/people-first-app",
      "Yehor212/people-first-app#1"
    );

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("{}");
  });

  it("blocks multiple GitHub issue creations in one invocation", () => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "zenflow-spec-kit-github-issues-"));
    temporaryRoots.push(repositoryRoot);

    const initialized = spawnSync("git", ["init"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    if (initialized.status !== 0) {
      throw new Error(initialized.stderr || "Failed to initialize temporary git repository");
    }

    const remoteAdded = spawnSync(
      "git",
      ["remote", "add", "origin", "https://github.com/Yehor212/people-first-app.git"],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
      }
    );
    if (remoteAdded.status !== 0) {
      throw new Error(remoteAdded.stderr || "Failed to add origin to temporary git repository");
    }

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ZENFLOW_SPECKIT_GITHUB_ISSUES_AUTHORIZATION: "Yehor212/people-first-app#1",
    };
    delete env.SPECIFY_INIT_DIR;
    delete env.SPECIFY_FEATURE_DIRECTORY;

    const result = spawnSync(process.execPath, [HOOK], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env,
      input: JSON.stringify({
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {
          command: 'for title in one two; do gh issue create --title "$title" --body test; done',
        },
      }),
    });

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toMatch(/one issue per invocation/i);
  });

  it("allows a safe relative feature directory inside the current repository", () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), "zenflow-spec-kit-safe-relative-"));
    const repositoryRoot = join(temporaryRoot, "repository");
    temporaryRoots.push(temporaryRoot);

    mkdirSync(join(repositoryRoot, ".specify"), { recursive: true });
    mkdirSync(join(repositoryRoot, "specs", "001-safe"), { recursive: true });

    const initialized = spawnSync("git", ["init"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    if (initialized.status !== 0) {
      throw new Error(initialized.stderr || "Failed to initialize temporary git repository");
    }

    writeFileSync(
      join(repositoryRoot, ".specify", "feature.json"),
      `${JSON.stringify({ feature_directory: "specs/001-safe" })}\n`,
      "utf8"
    );

    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.SPECIFY_FEATURE_DIRECTORY;
    delete env.SPECIFY_INIT_DIR;
    delete env.ZENFLOW_SPECKIT_GITHUB_ISSUES_AUTHORIZATION;

    const result = spawnSync(process.execPath, [HOOK], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env,
      input: JSON.stringify({
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {
          command: ".specify/scripts/bash/setup-plan.sh --json",
        },
      }),
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("{}");
  });

  it("blocks feature directory traversal outside the current repository", () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), "zenflow-spec-kit-traversal-"));
    const repositoryRoot = join(temporaryRoot, "repository");
    const outsideFeatureDirectory = join(temporaryRoot, "outside-feature");
    temporaryRoots.push(temporaryRoot);

    mkdirSync(join(repositoryRoot, ".specify"), { recursive: true });
    mkdirSync(outsideFeatureDirectory, { recursive: true });

    const initialized = spawnSync("git", ["init"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    if (initialized.status !== 0) {
      throw new Error(initialized.stderr || "Failed to initialize temporary git repository");
    }

    writeFileSync(
      join(repositoryRoot, ".specify", "feature.json"),
      `${JSON.stringify({ feature_directory: "../outside-feature" })}\n`,
      "utf8"
    );

    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.SPECIFY_FEATURE_DIRECTORY;
    delete env.SPECIFY_INIT_DIR;
    delete env.ZENFLOW_SPECKIT_GITHUB_ISSUES_AUTHORIZATION;

    const result = spawnSync(process.execPath, [HOOK], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env,
      input: JSON.stringify({
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {
          command: ".specify/scripts/bash/setup-plan.sh --json",
        },
      }),
    });

    expect(result.status, result.stderr).toBe(2);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/outside (?:the )?current repository/i);
  });

  it("blocks a feature directory symlink escape", () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), "zenflow-spec-kit-symlink-escape-"));
    const repositoryRoot = join(temporaryRoot, "repository");
    const outsideFeatureDirectory = join(temporaryRoot, "outside-feature");
    temporaryRoots.push(temporaryRoot);

    mkdirSync(join(repositoryRoot, ".specify"), { recursive: true });
    mkdirSync(outsideFeatureDirectory, { recursive: true });

    const initialized = spawnSync("git", ["init"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    if (initialized.status !== 0) {
      throw new Error(initialized.stderr || "Failed to initialize temporary git repository");
    }

    symlinkSync(
      outsideFeatureDirectory,
      join(repositoryRoot, ".specify", "linked-feature"),
      process.platform === "win32" ? "junction" : "dir"
    );

    writeFileSync(
      join(repositoryRoot, ".specify", "feature.json"),
      `${JSON.stringify({ feature_directory: ".specify/linked-feature/new-child" })}\n`,
      "utf8"
    );

    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.SPECIFY_FEATURE_DIRECTORY;
    delete env.SPECIFY_INIT_DIR;
    delete env.ZENFLOW_SPECKIT_GITHUB_ISSUES_AUTHORIZATION;

    const result = spawnSync(process.execPath, [HOOK], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env,
      input: JSON.stringify({
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {
          command: ".specify/scripts/bash/setup-plan.sh --json",
        },
      }),
    });

    expect(result.status, result.stderr).toBe(2);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/outside (?:the )?current repository/i);
  });

  it("blocks inline Spec Kit directory overrides before generated scripts run", () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), "zenflow-spec-kit-inline-override-"));
    const repositoryRoot = join(temporaryRoot, "repository");
    const outsideFeatureDirectory = join(temporaryRoot, "outside-feature");
    temporaryRoots.push(temporaryRoot);

    mkdirSync(repositoryRoot, { recursive: true });
    mkdirSync(outsideFeatureDirectory, { recursive: true });

    const initialized = spawnSync("git", ["init"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    if (initialized.status !== 0) {
      throw new Error(initialized.stderr || "Failed to initialize temporary git repository");
    }

    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.SPECIFY_FEATURE_DIRECTORY;
    delete env.SPECIFY_INIT_DIR;
    delete env.ZENFLOW_SPECKIT_GITHUB_ISSUES_AUTHORIZATION;

    const result = spawnSync(process.execPath, [HOOK], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env,
      input: JSON.stringify({
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {
          command: `SPECIFY_FEATURE_DIRECTORY="${outsideFeatureDirectory}" .specify/scripts/bash/setup-plan.sh --json`,
        },
      }),
    });

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toMatch(/inline/i);
    expect(result.stderr).toMatch(/SPECIFY_FEATURE_DIRECTORY/i);
  });

  it("blocks GitHub issue writes through gh api", () => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "zenflow-spec-kit-gh-api-"));
    temporaryRoots.push(repositoryRoot);

    const initialized = spawnSync("git", ["init"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    if (initialized.status !== 0) {
      throw new Error(initialized.stderr || "Failed to initialize temporary git repository");
    }

    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.SPECIFY_FEATURE_DIRECTORY;
    delete env.SPECIFY_INIT_DIR;
    delete env.ZENFLOW_SPECKIT_GITHUB_ISSUES_AUTHORIZATION;

    const result = spawnSync(process.execPath, [HOOK], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env,
      input: JSON.stringify({
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {
          command: "gh api --method POST repos/Yehor212/people-first-app/issues -f title=test",
        },
      }),
    });

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toMatch(/gh api/i);
    expect(result.stderr).toMatch(/issue/i);
  });

  it("blocks GitHub issue writes through gh api GraphQL", () => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "zenflow-spec-kit-gh-api-graphql-"));
    temporaryRoots.push(repositoryRoot);

    const initialized = spawnSync("git", ["init"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    if (initialized.status !== 0) {
      throw new Error(initialized.stderr || "Failed to initialize temporary git repository");
    }

    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.SPECIFY_FEATURE_DIRECTORY;
    delete env.SPECIFY_INIT_DIR;
    delete env.ZENFLOW_SPECKIT_GITHUB_ISSUES_AUTHORIZATION;

    const result = spawnSync(process.execPath, [HOOK], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env,
      input: JSON.stringify({
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {
          command: 'gh api graphql -f query="mutation { createIssue(input: {}) { issue { id } } }"',
        },
      }),
    });

    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toMatch(/gh api/i);
    expect(result.stderr).toMatch(/issue/i);
  });
});
