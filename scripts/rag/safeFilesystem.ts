import { randomBytes } from "node:crypto";
import {
  closeSync,
  constants,
  existsSync,
  fchmodSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

export interface PrivateFileWrite {
  relativePath: string;
  contents: string;
}

interface FileIdentity {
  dev: number;
  ino: number;
  mode: number;
}

interface StagedWrite {
  targetPath: string;
  stagePath: string;
  backupPath: string;
  parentPath: string;
  parentIdentity: FileIdentity;
  targetIdentity: FileIdentity | null;
  backupCreated: boolean;
  committed: boolean;
}

const NO_FOLLOW = constants.O_NOFOLLOW ?? 0;

export function readRegularFileInsideRoot(
  rootDir: string,
  relativePath: string,
  encoding: BufferEncoding = "utf8"
): string {
  const root = requireSafeRoot(rootDir);
  const targetPath = resolveInsideRoot(root, relativePath);
  assertSafeParentChain(root, path.dirname(targetPath), false);

  const before = lstatSync(targetPath);
  if (before.isSymbolicLink()) throw new Error(`Refusing symlinked RAG input: ${relativePath}`);
  if (!before.isFile()) throw new Error(`RAG input must be a regular file: ${relativePath}`);
  if (before.nlink !== 1) throw new Error(`Refusing hardlinked RAG input: ${relativePath}`);

  const descriptor = openSync(targetPath, constants.O_RDONLY | NO_FOLLOW);
  try {
    const opened = fstatSync(descriptor);
    if (!opened.isFile() || opened.nlink !== 1 || !sameIdentity(opened, identity(before))) {
      throw new Error(`RAG input changed during safe open: ${relativePath}`);
    }
    return readFileSync(descriptor, { encoding });
  } finally {
    closeSync(descriptor);
  }
}

export function writePrivateFilesAtomicallyInsideRoot(
  rootDir: string,
  writes: readonly PrivateFileWrite[]
): void {
  if (writes.length === 0) return;
  const root = requireSafeRoot(rootDir);
  const targets = new Set<string>();
  const staged: StagedWrite[] = [];

  try {
    for (const write of writes) {
      const targetPath = resolveInsideRoot(root, write.relativePath);
      if (targets.has(targetPath)) {
        throw new Error(`Duplicate atomic RAG output target: ${write.relativePath}`);
      }
      targets.add(targetPath);

      const parentPath = path.dirname(targetPath);
      assertSafeParentChain(root, parentPath, true);
      const parentIdentity = identity(lstatSync(parentPath));
      const targetIdentity = inspectWritableTarget(targetPath, write.relativePath);
      const suffix = `${process.pid}-${randomBytes(12).toString("hex")}`;
      const stagePath = path.join(parentPath, `.${path.basename(targetPath)}.${suffix}.stage`);
      const backupPath = path.join(parentPath, `.${path.basename(targetPath)}.${suffix}.backup`);
      const descriptor = openSync(
        stagePath,
        constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | NO_FOLLOW,
        0o600
      );
      try {
        writeFileSync(descriptor, write.contents, "utf8");
        fchmodSync(descriptor, 0o600);
        fsyncSync(descriptor);
      } finally {
        closeSync(descriptor);
      }

      staged.push({
        targetPath,
        stagePath,
        backupPath,
        parentPath,
        parentIdentity,
        targetIdentity,
        backupCreated: false,
        committed: false,
      });
    }

    for (const item of staged) {
      assertUnchangedDirectory(item.parentPath, item.parentIdentity);
      assertUnchangedTarget(item.targetPath, item.targetIdentity);
      if (item.targetIdentity) {
        renameSync(item.targetPath, item.backupPath);
        item.backupCreated = true;
      }
      renameSync(item.stagePath, item.targetPath);
      item.committed = true;
    }

    for (const item of staged) {
      if (item.backupCreated) rmSync(item.backupPath, { force: true });
    }
  } catch (error) {
    for (const item of [...staged].reverse()) {
      try {
        if (item.committed) rmSync(item.targetPath, { force: true });
        if (item.backupCreated && existsSync(item.backupPath)) {
          renameSync(item.backupPath, item.targetPath);
        }
        rmSync(item.stagePath, { force: true });
      } catch {
        // Preserve the original failure. Any leftover private stage/backup remains
        // visible evidence that the transaction did not complete.
      }
    }
    throw error;
  }
}

function requireSafeRoot(rootDir: string): string {
  if (typeof rootDir !== "string" || rootDir.trim() === "") {
    throw new Error("RAG rootDir must be a non-empty path string");
  }
  const root = path.resolve(rootDir);
  const rootStats = lstatSync(root);
  if (rootStats.isSymbolicLink()) throw new Error("Refusing a symlinked RAG root");
  if (!rootStats.isDirectory()) throw new Error("RAG root must be a directory");
  return root;
}

function resolveInsideRoot(root: string, relativePath: string): string {
  if (
    typeof relativePath !== "string" ||
    relativePath.trim() === "" ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error("RAG file path must be a non-empty relative path");
  }
  const targetPath = path.resolve(root, relativePath);
  if (targetPath !== root && !targetPath.startsWith(`${root}${path.sep}`)) {
    throw new Error(`RAG file path escapes the root: ${relativePath}`);
  }
  return targetPath;
}

function assertSafeParentChain(root: string, parentPath: string, create: boolean): void {
  const relativeParent = path.relative(root, parentPath);
  if (relativeParent.startsWith("..") || path.isAbsolute(relativeParent)) {
    throw new Error("RAG parent path escapes the root");
  }

  let current = root;
  for (const segment of relativeParent.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if (!existsSync(current)) {
      if (!create) throw new Error(`Missing RAG parent directory: ${current}`);
      mkdirSync(current, { mode: 0o700 });
    }
    const currentStats = lstatSync(current);
    if (currentStats.isSymbolicLink()) {
      throw new Error(`Refusing symlinked RAG parent directory: ${current}`);
    }
    if (!currentStats.isDirectory()) {
      throw new Error(`RAG parent path is not a directory: ${current}`);
    }
  }
}

function inspectWritableTarget(targetPath: string, relativePath: string): FileIdentity | null {
  if (!existsSync(targetPath)) return null;
  const targetStats = lstatSync(targetPath);
  if (targetStats.isSymbolicLink()) throw new Error(`Refusing symlinked RAG output: ${relativePath}`);
  if (!targetStats.isFile()) {
    throw new Error(`RAG output target must be a regular file: ${relativePath}`);
  }
  return identity(targetStats);
}

function assertUnchangedDirectory(parentPath: string, expected: FileIdentity): void {
  const current = lstatSync(parentPath);
  if (current.isSymbolicLink() || !current.isDirectory() || !sameIdentity(current, expected)) {
    throw new Error(`RAG output parent changed before commit: ${parentPath}`);
  }
}

function assertUnchangedTarget(targetPath: string, expected: FileIdentity | null): void {
  if (!expected) {
    if (existsSync(targetPath)) throw new Error(`RAG output appeared before commit: ${targetPath}`);
    return;
  }
  if (!existsSync(targetPath)) throw new Error(`RAG output disappeared before commit: ${targetPath}`);
  const current = lstatSync(targetPath);
  if (current.isSymbolicLink() || !current.isFile() || !sameIdentity(current, expected)) {
    throw new Error(`RAG output changed before commit: ${targetPath}`);
  }
}

function identity(stats: { dev: number; ino: number; mode: number }): FileIdentity {
  return { dev: stats.dev, ino: stats.ino, mode: stats.mode };
}

function sameIdentity(
  stats: { dev: number; ino: number; mode: number },
  expected: FileIdentity
): boolean {
  return stats.dev === expected.dev && stats.ino === expected.ino && stats.mode === expected.mode;
}
