"use strict";

const { createHash } = require("node:crypto");
const path = require("node:path");

function parseWorktreePorcelain(text) {
  const records = [];
  let current = null;

  function finish() {
    if (!current) return;
    if (!current.path || !/^[0-9a-f]{40,64}$/i.test(current.head || "")) {
      throw new Error("worktree record requires an absolute path and object id");
    }
    if (!path.isAbsolute(current.path)) throw new Error("worktree path must be absolute");
    if (current.detached && current.branch) {
      throw new Error("worktree record cannot be both detached and on a branch");
    }
    records.push({
      path: current.path,
      head: current.head,
      branch: current.branch,
      detached: current.detached,
      locked: current.locked,
      prunable: current.prunable,
    });
    current = null;
  }

  for (const line of String(text || "").split(/\r?\n/)) {
    if (!line) {
      finish();
      continue;
    }
    if (line.startsWith("worktree ")) {
      finish();
      current = {
        path: line.slice("worktree ".length),
        head: "",
        branch: null,
        detached: false,
        locked: false,
        prunable: false,
      };
      continue;
    }
    if (!current) throw new Error("worktree porcelain field appeared before a worktree path");
    if (line.startsWith("HEAD ")) current.head = line.slice("HEAD ".length);
    else if (line.startsWith("branch ")) current.branch = line.slice("branch ".length);
    else if (line === "detached") current.detached = true;
    else if (line === "locked" || line.startsWith("locked ")) current.locked = true;
    else if (line === "prunable" || line.startsWith("prunable ")) current.prunable = true;
  }
  finish();
  return records;
}

function classifyRefRelation(input) {
  const values = [input?.ahead, input?.behind, input?.unique, input?.equivalent];
  if (values.every((value) => value === null)) return "UNRELATED";
  if (!values.every((value) => Number.isInteger(value) && value >= 0)) {
    throw new Error("ref relation counts must be non-negative integers or all null");
  }
  if (input.unique + input.equivalent > input.ahead) {
    throw new Error("patch counts cannot exceed ahead");
  }
  if (input.ahead === 0) return "IN_MAIN";
  if (input.unique === 0 && input.equivalent === input.ahead) return "PATCH_EQUIVALENT";
  return "UNIQUE_COMMITS";
}

function aliasLocator(locator, aliases) {
  const absolute = path.resolve(String(locator || ""));
  const candidates = (Array.isArray(aliases) ? aliases : [])
    .map((entry) => ({ alias: String(entry?.alias || ""), path: path.resolve(entry?.path || ".") }))
    .filter((entry) => entry.alias && path.isAbsolute(entry.path))
    .filter((entry) => isInsideOrEqual(entry.path, absolute))
    .sort((left, right) => right.path.length - left.path.length);

  if (candidates.length === 0) {
    return {
      alias: "UNALIASED",
      pathHash: createHash("sha256").update(absolute, "utf8").digest("hex").slice(0, 16),
    };
  }
  const selected = candidates[0];
  const relative = path.relative(selected.path, absolute);
  return { alias: selected.alias, relativePath: relative || "." };
}

function summarizeInventory(snapshot) {
  const worktrees = Array.isArray(snapshot?.worktrees) ? snapshot.worktrees : [];
  const refs = Array.isArray(snapshot?.refs) ? snapshot.refs : [];
  const pullRequests = Array.isArray(snapshot?.pullRequests) ? snapshot.pullRequests : [];
  return {
    worktrees: worktrees.length,
    activeSkipWorktrees: worktrees.filter((item) => item.activity === "ACTIVE_SKIP").length,
    dirtyWorktrees: worktrees.filter(
      (item) =>
        (Number.isInteger(item.changeCount) && item.changeCount > 0) ||
        (Number.isInteger(item.ignoredCount) && item.ignoredCount > 0)
    ).length,
    unverifiedWorktrees: worktrees.filter(
      (item) => item.activity === "UNVERIFIED" || item.changeCount === null
    ).length,
    refs: refs.length,
    logicalRefNames: new Set(refs.map((item) => item.name).filter(Boolean)).size,
    inMainRefs: refs.filter((item) => item.classification === "IN_MAIN").length,
    patchEquivalentRefs: refs.filter((item) => item.classification === "PATCH_EQUIVALENT").length,
    uniqueCommitRefs: refs.filter((item) => item.classification === "UNIQUE_COMMITS").length,
    unrelatedRefs: refs.filter((item) => item.classification === "UNRELATED").length,
    openHumanPullRequests: pullRequests.filter(
      (item) => item.state === "OPEN" && item.authorIsBot === false
    ).length,
    openBotPullRequests: pullRequests.filter(
      (item) => item.state === "OPEN" && item.authorIsBot === true
    ).length,
  };
}

function isInsideOrEqual(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  );
}

module.exports = {
  aliasLocator,
  classifyRefRelation,
  parseWorktreePorcelain,
  summarizeInventory,
};
