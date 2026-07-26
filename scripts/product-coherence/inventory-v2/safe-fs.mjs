import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import path from "node:path";

import {
  DENIED_DIRECTORY_NAMES,
  DENIED_FILE_EXTENSIONS,
  DENIED_FILE_NAMES,
  INVENTORY_V2_LIMITS,
  TEXT_EXTENSIONS,
} from "./constants.mjs";

export async function collectSafeInventoryFiles(rootDirectory, configuredLimits = {}) {
  const limits = { ...INVENTORY_V2_LIMITS, ...configuredLimits };
  const requestedRoot = path.resolve(rootDirectory);
  const rootStat = await lstat(requestedRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error("inventory-v2 root must be a real directory, not a symlink");
  }
  const root = await realpath(requestedRoot);
  const files = [];
  const state = { totalBytes: 0 };
  await walk(root, root, files, state, limits);
  files.sort((left, right) => compareText(left.path, right.path));
  return files;
}

async function walk(root, directory, files, state, limits) {
  await assertDirectoryInsideRoot(root, directory);
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => compareText(left.name, right.name));
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!DENIED_DIRECTORY_NAMES.has(entry.name)) await walk(root, absolute, files, state, limits);
      continue;
    }
    if (!entry.isFile() || isDeniedFileName(entry.name)) continue;
    if (files.length >= limits.maxFiles) throw new Error("inventory-v2 file limit exceeded");
    const record = await readStableFile(root, absolute, limits);
    state.totalBytes += record.byteLength;
    if (state.totalBytes > limits.maxTotalBytes) throw new Error("inventory-v2 total byte limit exceeded");
    files.push(record);
  }
}

async function assertDirectoryInsideRoot(root, directory) {
  const metadata = await lstat(directory);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new Error("inventory-v2 encountered a symlinked or non-directory path");
  }
  const canonical = await realpath(directory);
  if (canonical !== root && !canonical.startsWith(`${root}${path.sep}`)) {
    throw new Error("inventory-v2 directory escaped root");
  }
}

async function readStableFile(root, absolute, limits) {
  let descriptor;
  try {
    descriptor = await open(absolute, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const before = await descriptor.stat();
    const relativePath = toRelativePath(root, absolute);
    if (!before.isFile() || before.size > limits.maxFileBytes) {
      throw new Error(`inventory-v2 file is not safely readable: ${relativePath}`);
    }
    const bytes = await descriptor.readFile();
    const after = await descriptor.stat();
    const current = await lstat(absolute);
    if (
      !sameFileIdentity(before, after) ||
      !sameFileIdentity(before, current) ||
      current.isSymbolicLink() ||
      bytes.length !== before.size
    ) {
      throw new Error(`inventory-v2 file changed while being read: ${relativePath}`);
    }
    const canonical = await realpath(absolute);
    if (!canonical.startsWith(`${root}${path.sep}`)) {
      throw new Error(`inventory-v2 file escaped root: ${relativePath}`);
    }
    const extension = path.extname(absolute).toLowerCase();
    const isText = TEXT_EXTENSIONS.has(extension) && !bytes.includes(0);
    return {
      path: relativePath,
      byteLength: bytes.length,
      contentSha256: createHash("sha256").update(bytes).digest("hex"),
      isText,
      text: isText ? bytes.toString("utf8") : undefined,
    };
  } finally {
    await descriptor?.close();
  }
}

function isDeniedFileName(name) {
  const lower = name.toLowerCase();
  return DENIED_FILE_NAMES.has(lower) || lower.startsWith(".env.") || DENIED_FILE_EXTENSIONS.has(path.extname(lower));
}

function sameFileIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.size === right.size && left.mtimeMs === right.mtimeMs;
}

function toRelativePath(root, absolute) {
  const relative = path.relative(root, absolute).split(path.sep).join("/");
  if (!relative || relative.startsWith("../") || path.isAbsolute(relative)) {
    throw new Error("inventory-v2 encountered an invalid repository-relative path");
  }
  return relative;
}

export function compareText(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}
