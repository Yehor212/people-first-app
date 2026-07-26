import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import path from "node:path";

import { SUBJECT_IDS } from "./schemas.mjs";

const DENIED_DIRECTORIES = new Set([
  ".git",
  ".superpowers",
  "node_modules",
  "dist",
  "coverage",
  "output",
]);
const DENIED_NAMES = new Set([".env", ".mcp.json"]);
const CANDIDATE_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".sql",
  ".toml",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);
const INVENTORY_LIMITS = Object.freeze({ maxCandidates: 50_000, maxFileBytes: 16 * 1024 * 1024 });

export async function enumerateRepositoryCandidates(rootDirectory, subjectId, testingHooks = {}) {
  if (!SUBJECT_IDS.includes(subjectId)) {
    throw new Error(`--subject must be one of ${SUBJECT_IDS.join(", ")}`);
  }
  const requestedRoot = path.resolve(rootDirectory);
  const rootStat = await lstat(requestedRoot);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error("inventory root must be a real directory, not a symlink");
  }
  const root = await realpath(requestedRoot);
  const candidates = [];
  await walk(root, root, candidates, testingHooks);
  candidates.sort((left, right) => compareText(left.path, right.path));
  return { schemaVersion: "1.0.0", subjectId, candidates };
}

async function walk(root, directory, candidates, testingHooks) {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => compareText(left.name, right.name));
  for (const entry of entries) {
    if (DENIED_NAMES.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (!DENIED_DIRECTORIES.has(entry.name)) await walk(root, absolute, candidates, testingHooks);
      continue;
    }
    if (!entry.isFile() || !CANDIDATE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
    if (candidates.length >= INVENTORY_LIMITS.maxCandidates) {
      throw new Error("repository inventory candidate limit exceeded");
    }
    const bytes = await readInventoryFile(root, absolute, testingHooks);
    candidates.push({
      candidateId: `path:${relative(root, absolute)}`,
      path: relative(root, absolute),
      candidateType: classifyCandidate(entry.name),
      contentSha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
}

async function readInventoryFile(root, absolute, testingHooks) {
  let descriptor;
  try {
    descriptor = await open(absolute, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const before = await descriptor.stat();
    if (!before.isFile()) throw new Error(`repository inventory path must be a regular file: ${relative(root, absolute)}`);
    if (before.size > INVENTORY_LIMITS.maxFileBytes) {
      throw new Error(`repository inventory file byte limit exceeded: ${relative(root, absolute)}`);
    }
    await testingHooks.afterFileOpen?.(absolute);
    const bytes = await descriptor.readFile();
    const after = await descriptor.stat();
    if (!sameFileIdentity(before, after) || bytes.length !== before.size) {
      throw new Error(`repository inventory file changed while being hashed: ${relative(root, absolute)}`);
    }
    const current = await lstat(absolute);
    if (current.isSymbolicLink() || !sameFileIdentity(before, current)) {
      throw new Error(`repository inventory file identity changed while being hashed: ${relative(root, absolute)}`);
    }
    const canonical = await realpath(absolute);
    if (!canonical.startsWith(`${root}${path.sep}`)) {
      throw new Error(`repository inventory file escaped root: ${relative(root, absolute)}`);
    }
    return bytes;
  } finally {
    await descriptor?.close();
  }
}

function sameFileIdentity(left, right) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs
  );
}

function classifyCandidate(name) {
  const extension = path.extname(name).toLowerCase();
  if ([".md"].includes(extension)) return "DOCUMENTATION";
  if ([".json", ".toml", ".yaml", ".yml"].includes(extension)) return "CONFIGURATION";
  if ([".html", ".css"].includes(extension)) return "PUBLIC_SURFACE";
  return "SOURCE_FILE";
}

function relative(root, absolute) {
  return path.relative(root, absolute).split(path.sep).join("/");
}

function compareText(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}
