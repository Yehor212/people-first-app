"use strict";

const { spawnSync } = require("node:child_process");
const { existsSync, lstatSync, realpathSync, statSync } = require("node:fs");
const path = require("node:path");
const {
  analyzeGitOperations,
  analyzeToolEvent,
  hasDynamicPackageScriptSelection,
  hasExecutableShellExpansion,
  hasPrivilegedShellWrapper,
  hasShellEnvironmentAssignment,
  normalizeShellCommandTokens,
} = require("./codex-governance/tool-targets.cjs");
const { CANONICAL_REMOTE_ID, normalizeRemoteUrl } = require("./agent-workspace-core.cjs");

const STRUCTURED_MUTATION_TOOLS = new Set([
  "apply_patch",
  "functions.apply_patch",
  "edit",
  "write",
  "writefile",
  "createfile",
  "deletefile",
  "multiedit",
  "strreplacefile",
  "notebookedit",
]);

function evaluateWorkspaceEvent({ event, expectedAgent, fallbackCwd = process.cwd() }) {
  const cwd =
    nonEmpty(event?.cwd) ||
    nonEmpty(event?.tool_input?.cwd) ||
    nonEmpty(event?.tool_input?.workdir) ||
    fallbackCwd;
  const analysis = analyzeToolEvent(event);
  const gitOperations = analyzeGitOperations(analysis.command);
  const reviewedReadOnly = analysis.reviewedReadOnly === true;
  const dangerous = reviewedReadOnly
    ? []
    : gitOperations.filter((operation) => operation.dangerous);
  const scope = repositoryScope(cwd, analysis.targets, gitOperations, analysis.workingDirectories);
  const zenflowIdentities = scope.identities.filter(
    (identity) => identity.remoteId === CANONICAL_REMOTE_ID
  );
  const packageRunMutates = packageManagerRunMayMutate(analysis.command);
  const mutationIntent =
    !reviewedReadOnly &&
    (analysis.mutationIntent || analysis.unknownExecution || packageRunMutates);
  const operatorOnlyReason = operatorOnlyWorkspaceCommandReason(analysis.command);
  if (operatorOnlyReason) {
    return {
      allowed: false,
      reasons: [operatorOnlyReason],
      scope: "operator-only",
    };
  }
  if (zenflowIdentities.length === 0) {
    const probeBlocked = scope.probeError && (mutationIntent || dangerous.length > 0);
    return {
      allowed: !probeBlocked,
      reasons: probeBlocked
        ? ["repository identity unavailable; retry after the Git probe succeeds"]
        : [],
      scope: probeBlocked ? "unverified-repository" : "outside-zenflow",
    };
  }

  const reasons = dangerous.map((operation) => `destructive Git blocked: ${operation.reason}`);
  if (mutationIntent) {
    reasons.push(...structuredHardlinkReasons(event, cwd, analysis.targets));
  }
  if (analysis.opaqueExecution && !reviewedReadOnly) {
    reasons.push(
      "destructive opaque child-process execution blocked; invoke reviewed commands directly"
    );
  }
  if (analysis.unknownExecution && !reviewedReadOnly) {
    reasons.push(
      "unknown shell execution blocked; use a literal reviewed command or declared package script"
    );
  }
  if (hasExecutableShellExpansion(analysis.command)) {
    reasons.push(
      "executable shell expansion blocked; use separate literal reviewed commands without substitution"
    );
  }
  if (hasShellEnvironmentAssignment(analysis.command)) {
    reasons.push(
      "shell environment override blocked; use a literal reviewed command without prefix assignments"
    );
  }
  if (analysis.destructiveFilesystem) {
    reasons.push(
      "destructive filesystem command blocked; use a structured reviewed file operation"
    );
  }
  if (
    analysis.shellMutation &&
    analysis.recognizedCommands.some((command) => /\binline$/i.test(String(command)))
  ) {
    reasons.push(
      "inline interpreter filesystem mutation blocked; use a structured reviewed file operation"
    );
  }
  if (
    analysis.shellMutation &&
    analysis.recognizedCommands.some((command) => /\boutput$/i.test(String(command)))
  ) {
    reasons.push("shell output option mutation blocked; use a structured reviewed file operation");
  }
  if (analysis.dynamicTarget) {
    reasons.push("destructive dynamic shell target blocked; use a literal reviewed path");
  }
  if (scope.probeError && mutationIntent && reasons.length === 0) {
    reasons.push("repository identity unavailable; retry only after the Git probe succeeds");
  }
  if (
    mutationIntent &&
    zenflowIdentities.some((identity) => identity.rootDir !== scope.currentIdentity?.rootDir)
  ) {
    reasons.push(
      "cross-worktree mutation is forbidden; operate only inside the current agent lane"
    );
  }
  for (const identity of zenflowIdentities) {
    if (identity.detached && mutationIntent) {
      reasons.push("detached HEAD is read-only; open a locked codex/ or kimi/ worktree");
    }
    if (identity.branch === "main" && mutationIntent) {
      reasons.push("main is integration-only; open a locked codex/ or kimi/ worktree");
    }
    if (
      mutationIntent &&
      (!["codex", "kimi"].includes(expectedAgent) ||
        !identity.branch?.startsWith(`${expectedAgent}/`))
    ) {
      reasons.push(
        `client actor ${expectedAgent || "unbound"} may mutate only ${expectedAgent || "bound-client"}/ branch prefixes; current branch is ${identity.branch || "detached"}`
      );
    }
  }
  return {
    actor: expectedAgent || null,
    allowed: reasons.length === 0,
    branch: zenflowIdentities[0]?.branch || null,
    reasons: [...new Set(reasons)],
    scope: "zenflow",
  };
}

function structuredHardlinkReasons(event, cwd, targets) {
  const toolName = String(event?.tool_name || event?.toolName || "").toLowerCase();
  if (!STRUCTURED_MUTATION_TOOLS.has(toolName)) return [];
  for (const target of targets) {
    if (!nonEmpty(target)) continue;
    const absoluteTarget = path.isAbsolute(target) ? target : path.resolve(cwd, target);
    try {
      const stats = lstatSync(absoluteTarget);
      if (stats.isFile() && stats.nlink > 1) {
        return [
          "structured mutation target has multiple filesystem links; replace the hardlink with a lane-owned regular file",
        ];
      }
    } catch (error) {
      if (error?.code !== "ENOENT") {
        return [
          "structured mutation target identity is unavailable; retry only after the filesystem probe succeeds",
        ];
      }
    }
  }
  return [];
}

function repositoryScope(cwd, targets, gitOperations, shellWorkingDirectories) {
  const identities = [];
  const identityCache = new Map();
  const seen = new Set();
  let probeError = false;
  let currentIdentity = null;
  const candidates = workspaceCandidates(cwd, targets, gitOperations, shellWorkingDirectories);
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const probe = repositoryProbeDirectory(candidate);
    if (probe.error) {
      probeError = true;
      continue;
    }
    if (!probe.directory) continue;
    let identity = identityCache.get(probe.directory);
    if (identity === undefined) {
      identity =
        reusableIdentity(probe.directory, identities) || repositoryIdentity(probe.directory);
      identityCache.set(probe.directory, identity);
    }
    if (identity?.probeError) {
      probeError = true;
      continue;
    }
    if (index === 0 && identity) currentIdentity = identity;
    if (!identity || seen.has(identity.rootDir)) continue;
    seen.add(identity.rootDir);
    identities.push(identity);
  }
  return { currentIdentity, identities, probeError };
}

function reusableIdentity(directory, identities) {
  for (const identity of identities) {
    if (!pathInside(directory, identity.rootDir)) continue;
    let cursor = directory;
    let nestedRepository = false;
    while (cursor !== identity.rootDir) {
      if (existsSync(path.join(cursor, ".git"))) {
        nestedRepository = true;
        break;
      }
      const parent = path.dirname(cursor);
      if (parent === cursor) break;
      cursor = parent;
    }
    if (!nestedRepository) return identity;
  }
  return null;
}

function pathInside(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function workspaceCandidates(cwd, targets, gitOperations, shellWorkingDirectories) {
  const absoluteCwd = path.resolve(cwd);
  const candidates = [absoluteCwd];
  for (const target of Array.isArray(targets) ? targets : []) {
    if (nonEmpty(target)) candidates.push(path.resolve(absoluteCwd, target));
  }
  let shellCwd = absoluteCwd;
  for (const candidate of Array.isArray(shellWorkingDirectories) ? shellWorkingDirectories : []) {
    if (!nonEmpty(candidate)) continue;
    shellCwd = path.resolve(shellCwd, candidate);
    candidates.push(shellCwd);
  }
  for (const operation of Array.isArray(gitOperations) ? gitOperations : []) {
    let effectiveCwd = absoluteCwd;
    for (const candidate of operation.workingDirectories || []) {
      if (!nonEmpty(candidate)) continue;
      effectiveCwd = path.resolve(effectiveCwd, candidate);
      candidates.push(effectiveCwd);
    }
    for (const candidate of operation.repositoryPaths || []) {
      if (nonEmpty(candidate)) candidates.push(path.resolve(effectiveCwd, candidate));
    }
  }
  return [...new Set(candidates)];
}

function repositoryProbeDirectory(candidate) {
  if (!nonEmpty(candidate)) return { directory: "", error: false };
  let current = path.resolve(candidate);
  while (!existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) return { directory: "", error: false };
    current = parent;
  }
  try {
    const canonical = realpathSync.native(current);
    return {
      directory: statSync(canonical).isDirectory() ? canonical : path.dirname(canonical),
      error: false,
    };
  } catch {
    return { directory: "", error: true };
  }
}

function resolveCanonicalGitRoot(cwd) {
  if (!nonEmpty(cwd)) {
    throw new Error("launch cwd is missing");
  }
  let canonicalCwd;
  try {
    canonicalCwd = realpathSync.native(path.resolve(cwd));
    if (!statSync(canonicalCwd).isDirectory()) {
      throw new Error("launch cwd is not a directory");
    }
  } catch {
    throw new Error("launch cwd is unavailable");
  }

  const rootResult = git(["-C", canonicalCwd, "rev-parse", "--show-toplevel"]);
  if (rootResult.error || rootResult.status !== 0 || !rootResult.stdout.trim()) {
    throw new Error("Git repository root is unavailable");
  }

  let canonicalRoot;
  try {
    canonicalRoot = realpathSync.native(path.resolve(canonicalCwd, rootResult.stdout.trim()));
    if (!statSync(canonicalRoot).isDirectory() || !pathInside(canonicalCwd, canonicalRoot)) {
      throw new Error("Git repository root does not contain launch cwd");
    }
  } catch {
    throw new Error("Git repository root is invalid");
  }
  return canonicalRoot;
}

function packageManagerRunMayMutate(command) {
  const text = String(command || "");
  if (/(?:^|[;&|]\s*)(?:npx|pnpm\s+exec|yarn\s+dlx|bunx)\b/i.test(text)) {
    return true;
  }
  const match = /(?:^|[;&|]\s*)(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?([a-z0-9:_-]+)/i.exec(text);
  if (!match) return false;
  const script = match[1].toLowerCase();
  if (
    /^(?:check:|test(?::|$)|typecheck$|lint$|doc-counts$|constitution:check$|agent:workspace$)/.test(
      script
    )
  ) {
    return false;
  }
  return true;
}

function operatorOnlyWorkspaceCommandReason(command) {
  const raw = String(command || "");
  if (hasPrivilegedShellWrapper(raw)) {
    return "privileged shell wrapper is operator-only; invoke the reviewed command without sudo or doas";
  }
  if (hasDynamicPackageScriptSelection(raw)) {
    return "dynamic package-script selection is operator-only; use a literal reviewed entrypoint";
  }
  const normalized = normalizeShellCommandTokens(raw);
  const text = normalized && normalized !== raw ? `${raw}\n${normalized}` : raw;
  const dynamicWorkspaceInvocation = [
    ...text.matchAll(
      /(?:agent:workspace|agent-workspace\.mjs|agent:kimi-hook|install-kimi-workspace-hook\.mjs)\b[^\r\n;&|]*/gi
    ),
  ].some((match) => /[$`]|%[A-Za-z_][A-Za-z0-9_]*%/.test(match[0]));
  if (dynamicWorkspaceInvocation) {
    return "dynamic workspace/Kimi-hook arguments are operator-only; use literal reviewed arguments";
  }
  if (
    /\bagent:workspace\b[^\r\n;&|]*\b(?:create|bootstrap-human-review)\b/i.test(text) ||
    /\bagent-workspace\.mjs\b[^\r\n;&|]*\b(?:create|bootstrap-human-review)\b/i.test(text)
  ) {
    return "agent workspace creation/bootstrap is operator-only; run it directly in a reviewed terminal";
  }
  if (
    /\bagent:workspace\b[^\r\n;&|]*\bsync\b[^\r\n;&|]*--apply\b/i.test(text) ||
    /\bagent-workspace\.mjs\b[^\r\n;&|]*\bsync\b[^\r\n;&|]*--apply\b/i.test(text)
  ) {
    return "agent workspace sync --apply is operator-only; the reviewed SHA is a TOCTOU pin, not authorization";
  }
  if (
    /\bagent:kimi-hook\b[^\r\n;&|]*--(?:apply|restore)\b/i.test(text) ||
    /\binstall-kimi-workspace-hook\.mjs\b[^\r\n;&|]*--(?:apply|restore)\b/i.test(text)
  ) {
    return "Kimi hook installation or restoration is operator-only";
  }
  return "";
}

function repositoryIdentity(cwd) {
  const rootResult = git(["-C", cwd, "rev-parse", "--show-toplevel"]);
  if (rootResult.error) return { probeError: true };
  if (rootResult.status !== 0) return null;
  const rootDir = rootResult.stdout.trim();
  const remoteResult = git(["-C", rootDir, "remote", "get-url", "origin"]);
  if (remoteResult.error) return { probeError: true };
  if (remoteResult.status !== 0) return null;
  const branchResult = git(["-C", rootDir, "symbolic-ref", "--quiet", "--short", "HEAD"]);
  if (branchResult.error) return { probeError: true };
  return {
    branch: branchResult.status === 0 ? branchResult.stdout.trim() : null,
    detached: branchResult.status !== 0,
    remoteId: normalizeRemoteUrl(remoteResult.stdout),
    rootDir,
  };
}

function git(args) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    maxBuffer: 256 * 1024,
    shell: false,
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 5_000,
  });
  return {
    error: Boolean(result.error),
    status: result.error ? 1 : result.status,
    stdout: result.stdout || "",
  };
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim() ? value : "";
}

module.exports = {
  evaluateWorkspaceEvent,
  resolveCanonicalGitRoot,
};
