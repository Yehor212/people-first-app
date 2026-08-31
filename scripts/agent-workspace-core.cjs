"use strict";

const path = require("node:path");

const CANONICAL_REMOTE_ID = "github.com/yehor212/people-first-app";
const SUPPORTED_AGENTS = new Set(["codex"]);
const CODEX_BRANCH = /^codex\//;
const CODEX_REMOTE_BRANCH = /^refs\/heads\/codex\//;
const DEFAULT_BRANCH = "main";
const ZERO_OBJECT_ID = /^0{40,64}$/;

function normalizeRemoteUrl(value) {
  let remote = String(value || "").trim();
  if (!remote) return "";

  remote = remote
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "")
    .replace(/\.git$/i, "");
  const scpLike = /^git@([^:]+):(.+)$/i.exec(remote);
  if (scpLike) {
    return `${scpLike[1]}/${scpLike[2]}`.toLowerCase();
  }

  try {
    const parsed = new URL(remote);
    const pathname = parsed.pathname.replace(/^\/+|\/+$/g, "");
    return `${parsed.hostname}/${pathname}`.toLowerCase();
  } catch {
    return remote.replace(/^\/+|\/+$/g, "").toLowerCase();
  }
}

function isCanonicalRemoteUrl(value) {
  const remote = String(value || "").trim();
  if (!remote || /[?#]/.test(remote)) return false;

  const scpLike = /^git@github\.com:(.+)$/i.exec(remote);
  if (scpLike) return canonicalRepositoryPath(scpLike[1]);

  const absolute = /^(https|ssh):\/\/([^/?#]+)(\/[^?#]*)$/i.exec(remote);
  if (!absolute) return false;
  const [, protocol, authority, rawPath] = absolute;
  if (protocol.toLowerCase() === "https") {
    if (authority.toLowerCase() !== "github.com") return false;
  } else if (authority.toLowerCase() !== "git@github.com") {
    return false;
  }
  return canonicalRepositoryPath(rawPath);
}

function canonicalRepositoryPath(value) {
  return /^\/?yehor212\/people-first-app(?:\.git)?\/?$/i.test(String(value || ""));
}

function evaluateCommitGuard({ branch, detached }) {
  const errors = [];
  const currentBranch = String(branch || "");
  if (detached || !currentBranch) errors.push("detached HEAD cannot receive a commit");
  if (currentBranch === DEFAULT_BRANCH) {
    errors.push(`${DEFAULT_BRANCH} is integration-only; commit on a named feature branch`);
  }
  return { ok: errors.length === 0, errors };
}

function evaluatePushGuard({ currentBranch, updates }) {
  const errors = [];
  const branch = String(currentBranch || "");
  const currentRef = `refs/heads/${branch}`;
  if (!CODEX_BRANCH.test(branch)) {
    errors.push("push requires the checked-out codex/ worktree branch");
  }
  for (const update of Array.isArray(updates) ? updates : []) {
    const localRef = String(update?.localRef || "");
    const remoteRef = String(update?.remoteRef || "");
    if (
      !isZeroObjectId(update?.localSha) &&
      (localRef !== currentRef || remoteRef !== currentRef)
    ) {
      errors.push(
        `push may update only the current worktree branch ${currentRef}, not ${localRef || "unknown"} -> ${remoteRef || "unknown"}`
      );
    }
    if (isZeroObjectId(update?.localSha)) {
      errors.push(`deleting remote refs is forbidden; preserve ${remoteRef || "the handoff ref"}`);
    }
    if (remoteRef === `refs/heads/${DEFAULT_BRANCH}`) {
      errors.push(`direct pushes to ${remoteRef} are forbidden; use a pull request`);
    }
    if (
      remoteRef.startsWith("refs/tags/") ||
      (!remoteRef.startsWith("refs/heads/") && !isZeroObjectId(update?.localSha))
    ) {
      errors.push(`tag or non-branch push to ${remoteRef || "unknown ref"} is forbidden`);
    }
    if (
      remoteRef.startsWith("refs/heads/") &&
      remoteRef !== `refs/heads/${DEFAULT_BRANCH}` &&
      !CODEX_REMOTE_BRANCH.test(remoteRef) &&
      !isZeroObjectId(update?.localSha)
    ) {
      errors.push(`agent handoff requires a same-named codex/ branch, not ${remoteRef}`);
    }
    if (
      CODEX_REMOTE_BRANCH.test(remoteRef) &&
      localRef !== remoteRef &&
      !isZeroObjectId(update?.localSha)
    ) {
      errors.push(
        `agent handoff must push the same-named branch (${localRef || "unknown"} -> ${remoteRef})`
      );
    }
    if (update?.nonFastForward === true) {
      errors.push(`non-fast-forward push to ${remoteRef || "unknown ref"} is forbidden`);
    }
  }
  return { ok: errors.length === 0, errors: unique(errors) };
}

function validateCreateRequest({
  agent,
  slug,
  targetPath,
  repoRoot,
  branchExists,
  targetExists,
  worktreePaths,
}) {
  const errors = [];
  validateAgent(agent, errors);
  const normalizedSlug = String(slug || "")
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(normalizedSlug)) {
    errors.push("slug must be 2-63 lowercase letters, digits, or single-purpose hyphens");
  }

  const candidate = String(targetPath || "");
  if (!path.isAbsolute(candidate)) errors.push("worktree target path must be absolute");
  const absoluteTarget = path.resolve(candidate || ".");
  const absoluteRoot = path.resolve(String(repoRoot || "."));
  if (isInsideOrEqual(absoluteRoot, absoluteTarget)) {
    errors.push("worktree target must not be inside the control repository");
  }
  if (branchExists) errors.push("agent branch already exists");
  if (targetExists) errors.push("worktree target path already exists");
  const normalizedWorktrees = (Array.isArray(worktreePaths) ? worktreePaths : []).map((item) =>
    path.resolve(String(item))
  );
  if (normalizedWorktrees.includes(absoluteTarget)) {
    errors.push("worktree target path is already registered");
  }

  return {
    ok: errors.length === 0,
    errors: unique(errors),
    branch:
      SUPPORTED_AGENTS.has(agent) && /^[a-z0-9][a-z0-9-]{1,62}$/.test(normalizedSlug)
        ? `${agent}/${normalizedSlug}`
        : "",
    targetPath: absoluteTarget,
  };
}

function validateAgent(agent, errors) {
  if (!SUPPORTED_AGENTS.has(agent)) errors.push('agent must be "codex"');
}

function isInsideOrEqual(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  );
}

function isZeroObjectId(value) {
  return ZERO_OBJECT_ID.test(String(value || ""));
}

function unique(values) {
  return [...new Set(values)];
}

module.exports = {
  CANONICAL_REMOTE_ID,
  DEFAULT_BRANCH,
  evaluateCommitGuard,
  evaluatePushGuard,
  isCanonicalRemoteUrl,
  isZeroObjectId,
  normalizeRemoteUrl,
  validateCreateRequest,
};
