#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_DARWIN_PASSES = 24;
const DEFAULT_OTHER_PASSES = 1;
const DEFAULT_DELAY_MS = 500;
const DUPLICATE_ARTIFACT_PATTERN = / \d+(?=\.|$)/g;

function hasDuplicateOrdinal(name) {
  DUPLICATE_ARTIFACT_PATTERN.lastIndex = 0;
  return DUPLICATE_ARTIFACT_PATTERN.test(name);
}

function canonicalDuplicateName(name) {
  DUPLICATE_ARTIFACT_PATTERN.lastIndex = 0;
  return name.replace(DUPLICATE_ARTIFACT_PATTERN, "");
}

function resolveInsideRoot(root, childName) {
  const childPath = path.resolve(root, childName);
  const relative = path.relative(root, childPath);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to inspect outside ${root}: ${childName}`);
  }
  return childPath;
}

function findDuplicateArtifacts(root) {
  return findDuplicateArtifactEntries(root, { requireCanonicalSibling: true });
}

function findDuplicateArtifactCandidates(root) {
  return findDuplicateArtifactEntries(root, { requireCanonicalSibling: false });
}

function findDuplicateArtifactEntries(root, { requireCanonicalSibling }) {
  const resolvedRoot = path.resolve(root);
  if (!fs.existsSync(resolvedRoot)) return [];

  const duplicates = [];
  for (const entry of fs.readdirSync(resolvedRoot, { withFileTypes: true })) {
    const entryPath = resolveInsideRoot(resolvedRoot, entry.name);
    if (hasDuplicateOrdinal(entry.name)) {
      const canonicalPath = resolveInsideRoot(resolvedRoot, canonicalDuplicateName(entry.name));
      if (!requireCanonicalSibling || fs.existsSync(canonicalPath)) {
        duplicates.push(entryPath);
      }
      continue;
    }
    if (entry.isDirectory()) {
      duplicates.push(...findDuplicateArtifactEntries(entryPath, { requireCanonicalSibling }));
    }
  }
  return duplicates;
}

function pruneDuplicateArtifacts(root) {
  const duplicates = findDuplicateArtifactCandidates(root);
  for (const duplicate of duplicates) {
    fs.rmSync(duplicate, { force: true, recursive: true });
  }
  return { removed: duplicates.length, duplicates };
}

function formatRelativeDuplicates(root, duplicates) {
  const resolvedRoot = path.resolve(root);
  return duplicates.map((duplicate) => path.relative(resolvedRoot, duplicate) || path.basename(duplicate));
}

function verifyNoDuplicateArtifacts(root) {
  const duplicates = findDuplicateArtifactCandidates(root);
  if (duplicates.length > 0) {
    const listed = formatRelativeDuplicates(root, duplicates).slice(0, 20).join("\n - ");
    throw new Error(
      `Duplicate generated artifact(s) remain in ${path.resolve(root)}: ${duplicates.length}` +
        (listed ? `\n - ${listed}` : ""),
    );
  }
  return { duplicates };
}

function sleepSync(ms) {
  if (ms <= 0) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function readPositiveInteger(raw, fallback) {
  if (raw === undefined || raw === null || raw === "") return fallback;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function pruneDuplicateArtifactsUntilSettled(root, options = {}) {
  const passes = readPositiveInteger(
    options.passes ?? process.env.ZENFLOW_DUPLICATE_PRUNE_PASSES,
    process.platform === "darwin" ? DEFAULT_DARWIN_PASSES : DEFAULT_OTHER_PASSES,
  );
  const delayMs = readPositiveInteger(
    options.delayMs ?? process.env.ZENFLOW_DUPLICATE_PRUNE_DELAY_MS,
    DEFAULT_DELAY_MS,
  );

  let removed = 0;
  let completedPasses = 0;
  for (let pass = 1; pass <= passes; pass++) {
    const passRemoved = pruneDuplicateArtifacts(root).removed;
    removed += passRemoved;
    completedPasses = pass;
    if (passRemoved === 0) break;
    if (pass < passes) sleepSync(delayMs);
  }
  return { removed, passes: completedPasses };
}

function resolveCliTarget(target) {
  const cwd = process.cwd();
  const root = path.resolve(cwd, target);
  const relative = path.relative(cwd, root);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to prune outside ${cwd}: ${target}`);
  }
  return root;
}

function runCli(argv = process.argv.slice(2)) {
  const target = argv.find((arg) => !arg.startsWith("--")) || "dist";
  const passesArg = argv.find((arg) => arg.startsWith("--passes="));
  const delayArg = argv.find((arg) => arg.startsWith("--delay="));
  const verify = argv.includes("--verify");
  const root = resolveCliTarget(target);
  if (verify) {
    verifyNoDuplicateArtifacts(root);
    console.log(
      `[prune-duplicates] ${path.relative(process.cwd(), root) || "."}: verification passed`,
    );
    return { removed: 0, passes: 0 };
  }

  const result = pruneDuplicateArtifactsUntilSettled(root, {
    passes: passesArg?.slice("--passes=".length),
    delayMs: delayArg?.slice("--delay=".length),
  });
  console.log(
    `[prune-duplicates] ${path.relative(process.cwd(), root) || "."}: removed ${result.removed} duplicate artifact(s) over ${result.passes} pass(es)` +
      "",
  );
  return result;
}

if (require.main === module) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = {
  findDuplicateArtifactCandidates,
  findDuplicateArtifacts,
  pruneDuplicateArtifacts,
  pruneDuplicateArtifactsUntilSettled,
  runCli,
  verifyNoDuplicateArtifacts,
};
