#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildSourceEvidence } from "./evidence-lib.mjs";

function parseArgs(argv) {
  const outputIndex = argv.indexOf("--output");
  if (outputIndex < 0 || !argv[outputIndex + 1]) {
    throw new Error(
      "Usage: collect-source-evidence.mjs --output <manifest.json> --input <path> [--input <path> ...]",
    );
  }
  const output = argv[outputIndex + 1];
  const inputs = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== "--input" || !argv[index + 1]) continue;
    inputs.push(argv[index + 1]);
    index += 1;
  }
  if (inputs.length === 0) throw new Error("At least one --input path is required");
  return { inputs, output };
}

function git(root, args, encoding = "utf8") {
  return execFileSync("git", args, {
    cwd: root,
    encoding,
    maxBuffer: 32 * 1024 * 1024,
  });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parsePorcelainV1Z(value) {
  const records = value.split("\0");
  const entries = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) continue;
    const status = record.slice(0, 2);
    const filePath = record.slice(3);
    if (!filePath) throw new Error("Git status record has no path");
    entries.push({ path: filePath, status });
    if (/[RC]/.test(status)) index += 1;
  }
  return entries;
}

const { inputs, output } = parseArgs(process.argv.slice(2));
const root = process.cwd();
const gitHead = git(root, ["rev-parse", "HEAD"]).trim();
const stagedDiffSha256 = sha256(
  git(root, ["diff", "--cached", "--binary", "--no-ext-diff"], null),
);
const unstagedDiffSha256 = sha256(
  git(root, ["diff", "--binary", "--no-ext-diff"], null),
);
const dirtyPaths = parsePorcelainV1Z(
  git(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]),
);
const source = await buildSourceEvidence({
  root,
  gitHead,
  stagedDiffSha256,
  unstagedDiffSha256,
  dirtyPaths,
  buildInputPaths: inputs,
});
const resolvedOutput = path.resolve(output);
await mkdir(path.dirname(resolvedOutput), { recursive: true });
await writeFile(
  resolvedOutput,
  `${JSON.stringify({ schemaVersion: 1, createdAt: new Date().toISOString(), source }, null, 2)}\n`,
  { encoding: "utf8", mode: 0o600 },
);
console.log(
  JSON.stringify({
    output,
    gitHead,
    stagedDiffSha256,
    unstagedDiffSha256,
    dirtyPathCount: source.dirtyPaths.length,
    buildInputCount: source.buildInputs.length,
    untrackedInputCount: source.untrackedInputs.length,
  }),
);
