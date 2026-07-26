import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";

export const JSONL_LIMITS = Object.freeze({
  maxFileBytes: 4 * 1024 * 1024,
  maxLineBytes: 256 * 1024,
  maxLines: 10_000,
  maxRecords: 5_000,
});

export async function readJsonl(filePath, testingHooks = {}) {
  let descriptor;
  let bytes;
  try {
    descriptor = await open(filePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const before = await descriptor.stat();
    if (!before.isFile()) throw new Error(`${filePath}: JSONL ledger must be a regular file`);
    if (before.size > JSONL_LIMITS.maxFileBytes) {
      throw new Error(`${filePath}: JSONL byte limit exceeded`);
    }
    await testingHooks.afterFileOpen?.(filePath);
    bytes = await descriptor.readFile();
    const after = await descriptor.stat();
    if (!sameFileIdentity(before, after) || bytes.length !== before.size) {
      throw new Error(`${filePath}: JSONL ledger changed while being read`);
    }
    const current = await lstat(filePath);
    if (current.isSymbolicLink() || !sameFileIdentity(before, current)) {
      throw new Error(`${filePath}: JSONL ledger path identity changed while being read`);
    }
    if (testingHooks.expectedRoot) {
      const root = await realpath(path.resolve(testingHooks.expectedRoot));
      const canonical = await realpath(filePath);
      if (!canonical.startsWith(`${root}${path.sep}`)) {
        throw new Error(`${filePath}: JSONL ledger realpath escapes input directory`);
      }
    }
  } finally {
    await descriptor?.close();
  }

  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
  } catch {
    throw new Error(`${filePath}: JSONL ledger is not strict UTF-8`);
  }
  const lines = text.split(/\r?\n/);
  if (lines.length > JSONL_LIMITS.maxLines) {
    throw new Error(`${filePath}: JSONL line limit exceeded`);
  }

  const records = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (Buffer.byteLength(line, "utf8") > JSONL_LIMITS.maxLineBytes) {
      throw new Error(`${filePath}:${index + 1}: JSONL line byte limit exceeded`);
    }
    if (line.trim().length === 0) continue;
    if (records.length >= JSONL_LIMITS.maxRecords) {
      throw new Error(`${filePath}: JSONL record limit exceeded`);
    }
    try {
      records.push(JSON.parse(line));
    } catch {
      throw new Error(`${filePath}:${index + 1}: invalid JSONL record`);
    }
  }
  return records;
}

function sameFileIdentity(left, right) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs
  );
}
