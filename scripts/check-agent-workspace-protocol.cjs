#!/usr/bin/env node
"use strict";

const { readFileSync, statSync } = require("node:fs");
const path = require("node:path");

const rootDir = process.cwd();
const failures = [];

function read(relativePath) {
  try {
    return readFileSync(path.join(rootDir, relativePath), "utf8");
  } catch (error) {
    failures.push(`${relativePath} is missing or unreadable: ${error.message}`);
    return "";
  }
}

function requireText(relativePath, text, marker) {
  if (!text.includes(marker)) failures.push(`${relativePath} is missing marker: ${marker}`);
}

const packageJsonText = read("package.json");
let packageJson = {};
try {
  packageJson = JSON.parse(packageJsonText);
} catch (error) {
  failures.push(`package.json is malformed: ${error.message}`);
}
if (packageJson.scripts?.["agent:workspace"] !== "node scripts/agent-workspace.mjs") {
  failures.push("package.json must expose agent:workspace");
}
if (packageJson.scripts?.["agent:kimi-hook"] !== "node scripts/install-kimi-workspace-hook.mjs") {
  failures.push("package.json must expose agent:kimi-hook");
}
for (const testPath of [
  "agent-workspace-core.test.ts",
  "agent-workspace.test.ts",
  "agent-workspace-command-guard.test.ts",
  "agent-workspace-git-hook.test.ts",
  "install-kimi-workspace-hook.test.ts",
]) {
  if (!packageJson.scripts?.["test:agent-workspace"]?.includes(testPath)) {
    failures.push(`test:agent-workspace must run ${testPath}`);
  }
}
if (
  packageJson.scripts?.["check:agent-workspace"] !==
  "node scripts/check-agent-workspace-protocol.cjs"
) {
  failures.push("package.json must expose check:agent-workspace");
}
if (!packageJson.scripts?.["ci:preflight"]?.includes("npm run check:agent-workspace")) {
  failures.push("ci:preflight must run check:agent-workspace");
}
for (const scriptName of ["test:release-contracts"]) {
  if (!packageJson.scripts?.[scriptName]?.includes("npm run test:agent-workspace")) {
    failures.push(`${scriptName} must run test:agent-workspace`);
  }
}

const settingsText = read(".vscode/settings.json");
try {
  const settings = JSON.parse(settingsText);
  if (settings["git.autoRepositoryDetection"] !== false) {
    failures.push("VS Code git.autoRepositoryDetection must be false");
  }
  if (settings["git.openRepositoryInParentFolders"] !== "never") {
    failures.push('VS Code git.openRepositoryInParentFolders must be "never"');
  }
  if (settings["git.detectWorktrees"] !== false) {
    failures.push("VS Code git.detectWorktrees must be false");
  }
  if (
    !Array.isArray(settings["git.scanRepositories"]) ||
    settings["git.scanRepositories"].length !== 0
  ) {
    failures.push("VS Code git.scanRepositories must be an empty array");
  }
  if (settings["window.title"] !== "${rootName} — ${activeEditorShort}") {
    failures.push("VS Code window.title must expose the current root name");
  }
} catch (error) {
  failures.push(`.vscode/settings.json is malformed: ${error.message}`);
}

const preCommit = read(".husky/pre-commit");
const prePush = read(".husky/pre-push");
requireText(".husky/pre-commit", preCommit, "agent-workspace-git-hook.cjs pre-commit");
requireText(".husky/pre-push", prePush, "agent-workspace-git-hook.cjs pre-push");
for (const hookPath of [".husky/pre-commit", ".husky/pre-push"]) {
  try {
    if ((statSync(path.join(rootDir, hookPath)).mode & 0o111) === 0) {
      failures.push(`${hookPath} must be executable`);
    }
  } catch {
    // read() already records the missing-file error.
  }
}
const protocol = read("docs/ai/CODEX_KIMI_WORKSPACE_PROTOCOL.md");
if (/\/Users\/[^/\s]+\/|[A-Za-z]:\\Users\\[^\\\s]+\\/i.test(protocol)) {
  failures.push(
    "docs/ai/CODEX_KIMI_WORKSPACE_PROTOCOL.md must not commit an operator-specific home path"
  );
}
for (const marker of [
  "<absolute-control-path>",
  "--reviewed-sha",
  ".code-workspace",
  "`sync` performs only `git fetch",
  "Kimi Working Directory",
  "<absolute-review-workspace-file>",
  "<absolute-audio-review-path>",
  "files.readonlyFromPermissions",
  "--disable-extensions",
  "exactly one provider",
  "owner-authorized mutations",
  "never authenticates human origin",
  "not content attestation",
  "time-of-check/time-of-use race",
  "bootstrap-human-review",
  "check-human-review",
  "Restricted Mode",
  "repositoryCount=1",
  "source/registration CI check",
  "git reset --hard",
  "git worktree",
  "handoff",
  "UNVERIFIED",
]) {
  requireText("docs/ai/CODEX_KIMI_WORKSPACE_PROTOCOL.md", protocol, marker);
}

const agents = read("AGENTS.md");
requireText("AGENTS.md", agents, "Codex And Kimi Workspace Isolation");
requireText("AGENTS.md", agents, "docs/ai/CODEX_KIMI_WORKSPACE_PROTOCOL.md");

const cli = read("scripts/agent-workspace.mjs");
const runtime = read("scripts/agent-workspace-runtime.cjs");
const runtimeTypes = read("scripts/agent-workspace-runtime.d.cts");
const commandGuard = read("scripts/agent-workspace-command-guard.cjs");
const kimiInstaller = read("scripts/install-kimi-workspace-hook.mjs");
const kimiInstallerTypes = read("scripts/install-kimi-workspace-hook.d.mts");
const codexGuard = read(".codex/hooks/agent-workspace-guard.cjs");
const hooksJson = read(".codex/hooks.json");
try {
  const parsedHooks = JSON.parse(hooksJson);
  const registrations = (parsedHooks?.hooks?.PreToolUse || [])
    .flatMap((group) => group?.hooks || [])
    .filter(
      (hook) =>
        String(hook?.command || "").includes("agent-workspace-guard.cjs") ||
        String(hook?.commandWindows || "").includes("agent-workspace-guard.cjs")
    );
  if (registrations.length !== 1) {
    failures.push(
      `.codex/hooks.json must register exactly one workspace guard; found ${registrations.length}`
    );
  }
} catch (error) {
  failures.push(`.codex/hooks.json is malformed: ${error.message}`);
}
for (const [relativePath, text] of [
  ["scripts/agent-workspace.mjs", cli],
  ["scripts/agent-workspace-runtime.cjs", runtime],
  ["scripts/agent-workspace-command-guard.cjs", commandGuard],
  ["scripts/install-kimi-workspace-hook.mjs", kimiInstaller],
]) {
  if (/\bshell\s*:\s*true\b/.test(text)) {
    failures.push(`${relativePath} must never execute through a shell`);
  }
}
if (
  /\b(?:git|optionalGit)\(\s*[^,\n]+,\s*\[\s*["'](?:reset|clean|stash|rebase|pull|push)["']/.test(
    runtime
  )
) {
  failures.push(
    "agent-workspace runtime must not invoke destructive or implicit sync Git operations"
  );
}
for (const marker of [
  '"fetch-only"',
  "KIMI_AUDIO_REVIEW_2026_07_26",
  "bootstrapHumanReviewWorkspace",
  "inspectHumanReviewWorkspace",
  "HUMAN_REVIEW_WORKSPACE_INVALID",
  "AUDIO_REVIEW_REPOSITORY",
  "PROTECTED_INCOMING_REVIEW_REQUIRED",
  "CREDENTIAL_BEARING_REMOTE",
  "REMOTE_PUSH_MISSING",
  "HANDOFF_PATH_LIMIT_EXCEEDED",
  "HANDOFF_RACE_DETECTED",
  "UNSAFE_VERIFICATION_RECEIPT",
  "MAIN_LANE_COUNT",
  "NESTED_REPOSITORY_TARGET",
  "canonicalProspectivePath",
  "WORKTREE_CREATE_ROLLBACK_REFUSED",
  "O_NOFOLLOW",
  '"merge", "--ff-only"',
  "FEATURE_SYNC_REFUSED",
  "behindMain",
  "/^scripts\\//",
]) {
  requireText("scripts/agent-workspace-runtime.cjs", runtime, marker);
}
for (const marker of [
  "main",
  "client actor",
  "destructive Git blocked",
  "cross-worktree mutation is forbidden",
  "CANONICAL_REMOTE_ID",
  "operator-only",
  "unknown shell execution blocked",
  "executable shell expansion blocked",
  "unverified-repository",
]) {
  requireText("scripts/agent-workspace-command-guard.cjs", commandGuard, marker);
}
requireText(
  "scripts/codex-governance/tool-targets.cjs",
  read("scripts/codex-governance/tool-targets.cjs"),
  "REVIEWED_PACKAGE_SCRIPTS"
);
for (const marker of ["handoffWorkspace", "behindMain", "WorkspaceInspection"]) {
  requireText("scripts/agent-workspace-runtime.d.cts", runtimeTypes, marker);
}
requireText(
  "scripts/agent-workspace-core.cjs",
  read("scripts/agent-workspace-core.cjs"),
  "deleting remote refs is forbidden"
);
for (const marker of ["PreToolUse", "process.exit(2)", "secondary guardrail"]) {
  requireText(".codex/hooks/agent-workspace-guard.cjs", codexGuard, marker);
}
for (const marker of [
  "agent-workspace-guard.cjs",
  "exec_command",
  "PowerShell",
  "Shell",
  "WriteFile",
  "--expected-agent codex",
]) {
  requireText(".codex/hooks.json", hooksJson, marker);
}
for (const marker of [
  "[[hooks]]",
  'event = "PreToolUse"',
  "zenflow-agent-workspace-guard:v1",
  "0o600",
  "replaceIfUnchanged",
  "assertRegularFile",
  "assertSnapshotUnchanged",
  "hookReady",
  "nlink",
  "--expected-agent kimi",
]) {
  requireText("scripts/install-kimi-workspace-hook.mjs", kimiInstaller, marker);
}
for (const marker of ["applyKimiHook", "inspectKimiHook", "restoreKimiBackup"]) {
  requireText("scripts/install-kimi-workspace-hook.d.mts", kimiInstallerTypes, marker);
}
if (!/sync fetches only by default/.test(cli)) {
  failures.push("agent-workspace CLI help must state fetch-only default");
}
for (const marker of ["bootstrap-human-review", "check-human-review"]) {
  requireText("scripts/agent-workspace.mjs", cli, marker);
}
if (/\bshell\s*:\s*true\b/.test(cli)) {
  failures.push("agent-workspace must never execute through a shell");
}

if (failures.length > 0) {
  process.stderr.write("Agent workspace protocol check failed:\n");
  for (const failure of failures) process.stderr.write(`- ${failure}\n`);
  process.exit(1);
}

process.stdout.write(
  "Agent workspace protocol: PASS (isolated worktrees, main guards, VS Code root isolation, safe sync, exact-tip handoff)\n"
);
