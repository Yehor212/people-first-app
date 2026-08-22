#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";

import {
  observeLocalSkillRoutingHook,
  writeCreateOnlyObservationReceipt,
} from "./persistent-agent-orchestra/governance-observation-core.mjs";

const ROOT_RESOLUTION_TIMEOUT_MS = 1500;

try {
  const outputPath = parseArgs(process.argv.slice(2));
  const rootDir = resolveRepositoryRoot();
  const receipt = await observeLocalSkillRoutingHook({ rootDir });
  if (outputPath) {
    await writeCreateOnlyObservationReceipt({
      rootDir,
      relativePath: outputPath,
      content: `${JSON.stringify(receipt, null, 2)}\n`,
    });
  }
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
} catch {
  process.stderr.write(
    "[agent-governance-observation] local observation failed; rerun from a Git worktree and use a new safe output/agent-orchestra/*.json path when retaining a receipt.\n",
  );
  process.exitCode = 2;
}

function parseArgs(args) {
  if (args.length === 0) return null;
  if (args.length === 2 && args[0] === "--output") return args[1];
  throw new Error("invalid observation arguments");
}

function resolveRepositoryRoot() {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: ROOT_RESOLUTION_TIMEOUT_MS,
    windowsHide: true,
  });
  if (result.status !== 0 || !result.stdout.trim()) throw new Error("Git root unavailable");
  return path.resolve(result.stdout.trim());
}
