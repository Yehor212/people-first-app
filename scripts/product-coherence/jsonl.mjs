import { lstat, readFile } from "node:fs/promises";

export const JSONL_LIMITS = Object.freeze({
  maxFileBytes: 4 * 1024 * 1024,
  maxLineBytes: 256 * 1024,
  maxLines: 10_000,
  maxRecords: 5_000,
});

export async function readJsonl(filePath) {
  const before = await lstat(filePath);
  if (before.isSymbolicLink()) throw new Error(`${filePath}: symlinked JSONL ledger is forbidden`);
  if (!before.isFile()) throw new Error(`${filePath}: JSONL ledger must be a regular file`);
  if (before.size > JSONL_LIMITS.maxFileBytes) {
    throw new Error(`${filePath}: JSONL byte limit exceeded`);
  }

  const bytes = await readFile(filePath);
  if (bytes.length > JSONL_LIMITS.maxFileBytes) {
    throw new Error(`${filePath}: JSONL byte limit exceeded`);
  }
  const after = await lstat(filePath);
  if (
    after.isSymbolicLink() ||
    after.dev !== before.dev ||
    after.ino !== before.ino ||
    after.size !== before.size ||
    after.mtimeMs !== before.mtimeMs
  ) {
    throw new Error(`${filePath}: JSONL ledger changed while being read`);
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
