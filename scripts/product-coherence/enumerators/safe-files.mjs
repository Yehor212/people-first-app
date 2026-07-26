import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const HARD_INVENTORY_LIMITS = Object.freeze({
  maxFiles: 50_000,
  maxRows: 100_000,
  maxFileBytes: 16 * 1024 * 1024,
  maxTotalBytes: 256 * 1024 * 1024,
  maxGitListBytes: 8 * 1024 * 1024,
});

export function resolveInventoryLimits(overrides = {}) {
  if (!isPlainObject(overrides)) throw new Error("inventory limits must be a plain object");
  const unknown = Object.keys(overrides).filter((key) => !(key in HARD_INVENTORY_LIMITS));
  if (unknown.length > 0)
    throw new Error(`unknown inventory limit ${unknown.sort(compareText)[0]}`);

  const limits = {};
  for (const [name, hardMaximum] of Object.entries(HARD_INVENTORY_LIMITS)) {
    const value = overrides[name] ?? hardMaximum;
    if (!Number.isSafeInteger(value) || value <= 0 || value > hardMaximum) {
      throw new Error(`${name} must be a positive integer no greater than ${hardMaximum}`);
    }
    limits[name] = value;
  }
  return Object.freeze(limits);
}

export async function resolveExactGitRoot(rootDirectory) {
  const requestedRoot = path.resolve(rootDirectory);
  const rootStat = await lstat(requestedRoot);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error("inventory root must be a real directory, not a symlink");
  }
  const root = await realpath(requestedRoot);
  const { stdout } = await execFileAsync("git", ["-C", root, "rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024,
  });
  const gitRoot = await realpath(stdout.trim());
  if (gitRoot !== root) {
    throw new Error("inventory root must equal the Git worktree root");
  }
  return root;
}

export async function listTrackedPaths(root, limits) {
  let result;
  try {
    result = await execFileAsync("git", ["-C", root, "ls-files", "-z", "--cached"], {
      encoding: "buffer",
      maxBuffer: limits.maxGitListBytes + 1,
    });
  } catch (error) {
    if (
      error?.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER" ||
      /maxBuffer/iu.test(error?.message ?? "")
    ) {
      throw new Error("tracked path listing byte limit exceeded");
    }
    throw new Error(`unable to list tracked paths: ${safeGitError(error)}`);
  }

  const stdout = Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.from(result.stdout);
  if (stdout.length > limits.maxGitListBytes) {
    throw new Error("tracked path listing byte limit exceeded");
  }
  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(stdout);
  const rawPaths = decoded.length === 0 ? [] : decoded.split("\u0000").filter(Boolean);
  if (rawPaths.length > limits.maxFiles) throw new Error("tracked file count limit exceeded");

  const paths = rawPaths.map(normalizeRepositoryPath);
  const unique = new Set(paths);
  if (unique.size !== paths.length)
    throw new Error("tracked path listing contains duplicate paths");
  paths.sort(compareText);
  return paths;
}

export async function inspectTrackedPath(
  root,
  locator,
  limits,
  budget,
  testingHooks = {},
  readMode = "CONTENT"
) {
  const absolute = path.join(root, ...locator.split("/"));
  let initial;
  try {
    initial = await lstat(absolute);
  } catch (error) {
    if (error?.code === "ENOENT") return { status: "MISSING" };
    throw error;
  }

  if (initial.isSymbolicLink()) {
    const target = await realpath(absolute);
    if (!isInsideRoot(root, target)) {
      throw new Error(`tracked symlink escape outside subject root: ${locator}`);
    }
    return { status: "SYMLINK_INSIDE_ROOT" };
  }
  if (!initial.isFile()) {
    return { status: "NON_FILE" };
  }
  if (readMode === "METADATA_ONLY") {
    const canonical = await realpath(absolute);
    if (!isInsideRoot(root, canonical)) {
      throw new Error(`tracked file escaped subject root: ${locator}`);
    }
    const current = await lstat(absolute);
    if (current.isSymbolicLink() || !sameFileIdentity(initial, current)) {
      throw new Error(`tracked file identity changed or became a symlink: ${locator}`);
    }
    return { status: "METADATA_ONLY" };
  }
  if (readMode !== "CONTENT") throw new Error("unknown tracked file read mode");

  let descriptor;
  try {
    descriptor = await open(absolute, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const before = await descriptor.stat();
    if (!before.isFile()) throw new Error(`tracked path is not a regular file: ${locator}`);
    if (before.size > limits.maxFileBytes) {
      throw new Error(`inventory file byte limit exceeded: ${locator}`);
    }
    if (budget.totalBytes + before.size > limits.maxTotalBytes) {
      throw new Error("inventory total byte limit exceeded");
    }

    await testingHooks.afterFileOpen?.(absolute);
    const bytes = await descriptor.readFile();
    const after = await descriptor.stat();
    if (!sameFileIdentity(before, after) || bytes.length !== before.size) {
      throw new Error(`tracked file changed while being read: ${locator}`);
    }

    let current;
    try {
      current = await lstat(absolute);
    } catch (error) {
      if (error?.code === "ENOENT") {
        throw new Error(`tracked file identity changed while being read: ${locator}`);
      }
      throw error;
    }
    if (current.isSymbolicLink() || !sameFileIdentity(before, current)) {
      throw new Error(`tracked file identity changed or became a symlink: ${locator}`);
    }
    const canonical = await realpath(absolute);
    if (!isInsideRoot(root, canonical)) {
      throw new Error(`tracked file escaped subject root: ${locator}`);
    }

    budget.totalBytes += bytes.length;
    budget.filesRead += 1;
    return {
      status: "FILE",
      bytes,
      contentSha256: sha256(bytes),
    };
  } finally {
    await descriptor?.close();
  }
}

export function normalizeRepositoryPath(input) {
  if (
    typeof input !== "string" ||
    input.length === 0 ||
    input.length > 1_024 ||
    input.startsWith("/") ||
    input.startsWith("\\") ||
    /^[a-z]:/iu.test(input) ||
    input.includes("\\") ||
    /[\u0000-\u001f\u007f]/u.test(input)
  ) {
    throw new Error("tracked path must be a bounded normalized repository-relative path");
  }
  const segments = input.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    throw new Error("tracked path must be a bounded normalized repository-relative path");
  }
  const normalized = path.posix.normalize(input);
  if (normalized !== input) throw new Error("tracked path is not normalized");
  return normalized;
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function compareText(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

export function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function isInsideRoot(root, candidate) {
  const relative = path.relative(root, candidate);
  return (
    relative !== "" &&
    !relative.startsWith(`..${path.sep}`) &&
    relative !== ".." &&
    !path.isAbsolute(relative)
  );
}

function sameFileIdentity(left, right) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs
  );
}

function safeGitError(error) {
  const stderr = typeof error?.stderr === "string" ? error.stderr.trim() : "";
  return stderr.length > 0 && stderr.length <= 256 ? stderr : "git command failed";
}
