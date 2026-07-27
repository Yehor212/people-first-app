#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const {
  evaluateCommitGuard,
  evaluatePushGuard,
  isCanonicalRemoteUrl,
  isZeroObjectId,
} = require("./agent-workspace-core.cjs");

const hook = process.argv[2];

if (hook === "pre-commit") {
  const branch = optionalGit(["symbolic-ref", "--quiet", "--short", "HEAD"]).trim();
  finish(
    evaluateCommitGuard({
      branch,
      detached: !branch,
    })
  );
} else if (hook === "pre-push") {
  assertCanonicalPushRemote(process.argv[3], process.argv[4]);
  const currentBranch = optionalGit(["symbolic-ref", "--quiet", "--short", "HEAD"]).trim();
  const updates = parsePushUpdates(fs.readFileSync(0, "utf8")).map((update) => ({
    ...update,
    nonFastForward: isNonFastForward(update),
  }));
  finish(evaluatePushGuard({ currentBranch, updates }));
} else {
  fail(`unknown hook mode "${hook || ""}"`);
}

function assertCanonicalPushRemote(remoteName, remoteUrl) {
  if (remoteName !== "origin") {
    fail("push remote must be the canonical origin");
  }
  if (!isCanonicalRemoteUrl(remoteUrl)) {
    fail("push remote identity is not the canonical ZenFlow repository");
  }
}

function parsePushUpdates(input) {
  return String(input || "")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [localRef, localSha, remoteRef, remoteSha] = line.trim().split(/\s+/);
      if (!localRef || !localSha || !remoteRef || !remoteSha) {
        fail("malformed pre-push update");
      }
      return { localRef, localSha, remoteRef, remoteSha };
    });
}

function isNonFastForward(update) {
  if (isZeroObjectId(update.localSha) || isZeroObjectId(update.remoteSha)) return false;
  const result = spawnSync(
    "git",
    ["merge-base", "--is-ancestor", update.remoteSha, update.localSha],
    {
      encoding: "utf8",
      shell: false,
      timeout: 30_000,
      stdio: ["ignore", "ignore", "pipe"],
    }
  );
  if (result.error) fail(result.error.message);
  if (result.status === 0) return false;
  if (result.status === 1) return true;
  fail("cannot prove that a proposed push is fast-forward");
}

function optionalGit(args) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    shell: false,
    timeout: 30_000,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) fail(result.error.message);
  return result.status === 0 ? result.stdout || "" : "";
}

function finish(result) {
  if (result.ok) process.exit(0);
  for (const error of result.errors) {
    process.stderr.write(`ZENFLOW AGENT WORKSPACE GUARD: ${error}\n`);
  }
  process.exit(1);
}

function fail(message) {
  process.stderr.write(`ZENFLOW AGENT WORKSPACE GUARD: ${message}\n`);
  process.exit(1);
}
