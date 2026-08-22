import { randomBytes } from "node:crypto";
import {
  closeSync,
  constants,
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
  type Stats,
} from "node:fs";
import path from "node:path";

export interface PrivateFileWrite {
  relativePath: string;
  contents: string;
}

export interface PrivateAtomicWriteOptions {
  replaceExisting?: boolean;
}

interface FileIdentity {
  dev: number;
  ino: number;
  mode: number;
  nlink?: number;
}

interface DirectoryIdentity {
  directoryPath: string;
  identity: FileIdentity;
}

interface StagedWrite {
  targetPath: string;
  stagePath: string;
  backupPath: string;
  parentChain: DirectoryIdentity[];
  targetIdentity: FileIdentity | null;
  stageIdentity: FileIdentity;
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
  const parentChain = assertSafeParentChain(root, path.dirname(targetPath), false);

  const before = lstatSync(targetPath);
  if (before.isSymbolicLink()) throw new Error(`Refusing symlinked RAG input: ${relativePath}`);
  if (!before.isFile()) throw new Error(`RAG input must be a regular file: ${relativePath}`);
  if (before.nlink !== 1) throw new Error(`Refusing hardlinked RAG input: ${relativePath}`);

  const descriptor = openSync(targetPath, constants.O_RDONLY | NO_FOLLOW);
  try {
    const opened = fstatSync(descriptor);
    if (!opened.isFile() || opened.nlink !== 1 || !sameIdentity(opened, identity(before, true))) {
      throw new Error(`RAG input changed during safe open: ${relativePath}`);
    }
    const contents = readFileSync(descriptor, { encoding });
    assertUnchangedDirectoryChain(parentChain, "during safe read");
    return contents;
  } finally {
    closeSync(descriptor);
  }
}

export function writePrivateFilesAtomicallyInsideRoot(
  rootDir: string,
  writes: readonly PrivateFileWrite[],
  options: PrivateAtomicWriteOptions = {}
): void {
  if (writes.length === 0) return;
  const root = requireSafeRoot(rootDir);
  const replaceExisting = options.replaceExisting ?? true;
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
      const parentChain = assertSafeParentChain(root, parentPath, true);
      const targetIdentity = inspectWritableTarget(targetPath, write.relativePath);
      if (!replaceExisting && targetIdentity) {
        throw new Error(`RAG immutable output appeared before commit: ${write.relativePath}`);
      }
      const suffix = `${process.pid}-${randomBytes(12).toString("hex")}`;
      const stagePath = path.join(parentPath, `.${path.basename(targetPath)}.${suffix}.stage`);
      const backupPath = path.join(parentPath, `.${path.basename(targetPath)}.${suffix}.backup`);
      const descriptor = openSync(
        stagePath,
        constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | NO_FOLLOW,
        0o600
      );
      let stageIdentity: FileIdentity;
      try {
        writeFileSync(descriptor, write.contents, "utf8");
        fchmodSync(descriptor, 0o600);
        fsyncSync(descriptor);
        const stagedStats = fstatSync(descriptor);
        if (!stagedStats.isFile() || stagedStats.nlink !== 1) {
          throw new Error(`RAG output stage is not a private regular file: ${write.relativePath}`);
        }
        stageIdentity = identity(stagedStats, true);
      } finally {
        closeSync(descriptor);
      }

      staged.push({
        targetPath,
        stagePath,
        backupPath,
        parentChain,
        targetIdentity,
        stageIdentity,
        backupCreated: false,
        committed: false,
      });
    }

    for (const item of staged) {
      assertUnchangedDirectoryChain(item.parentChain, "before commit");
      assertUnchangedTarget(item.targetPath, item.targetIdentity);
      assertExactFile(item.stagePath, item.stageIdentity, "RAG output stage changed before commit");
    }

    for (const item of staged) {
      assertUnchangedDirectoryChain(item.parentChain, "before commit");
      assertUnchangedTarget(item.targetPath, item.targetIdentity);
      assertExactFile(item.stagePath, item.stageIdentity, "RAG output stage changed before commit");
      if (item.targetIdentity) {
        renameSync(item.targetPath, item.backupPath);
        item.backupCreated = true;
        assertUnchangedDirectoryChain(item.parentChain, "after backup rename");
        assertExactFile(
          item.backupPath,
          item.targetIdentity,
          "RAG output backup changed after rename"
        );
        assertPathAbsent(item.targetPath, "RAG output remained after backup rename");
      }
      assertUnchangedDirectoryChain(item.parentChain, "before staged rename");
      assertExactFile(item.stagePath, item.stageIdentity, "RAG output stage changed before rename");
      assertPathAbsent(item.targetPath, "RAG output appeared before staged rename");
      renameSync(item.stagePath, item.targetPath);
      item.committed = true;
      assertUnchangedDirectoryChain(item.parentChain, "after staged rename");
      assertExactFile(
        item.targetPath,
        item.stageIdentity,
        "RAG output changed after staged rename"
      );
      assertPathAbsent(item.stagePath, "RAG output stage remained after rename");
    }

    for (const item of staged) {
      if (!item.backupCreated || !item.targetIdentity) continue;
      assertUnchangedDirectoryChain(item.parentChain, "before backup cleanup");
      assertExactFile(
        item.backupPath,
        item.targetIdentity,
        "RAG output backup changed before cleanup"
      );
      rmSync(item.backupPath);
      item.backupCreated = false;
      assertUnchangedDirectoryChain(item.parentChain, "after backup cleanup");
      assertPathAbsent(item.backupPath, "RAG output backup remained after cleanup");
    }
  } catch (error) {
    for (const item of [...staged].reverse()) {
      try {
        assertUnchangedDirectoryChain(item.parentChain, "before rollback");
      } catch {
        // Never follow a path through an ancestor whose identity is no longer trusted.
        // Private stage/backup files remain visible evidence of the incomplete transaction.
        continue;
      }
      try {
        if (item.committed) {
          assertExactFile(
            item.targetPath,
            item.stageIdentity,
            "RAG committed output changed before rollback"
          );
          assertUnchangedDirectoryChain(item.parentChain, "before committed-output rollback");
          rmSync(item.targetPath);
          item.committed = false;
          assertUnchangedDirectoryChain(item.parentChain, "after committed-output rollback");
          assertPathAbsent(item.targetPath, "RAG committed output remained after rollback");
        }
        if (item.backupCreated && item.targetIdentity) {
          assertUnchangedDirectoryChain(item.parentChain, "before backup restore");
          assertExactFile(
            item.backupPath,
            item.targetIdentity,
            "RAG output backup changed before restore"
          );
          assertPathAbsent(item.targetPath, "RAG output target occupied before backup restore");
          renameSync(item.backupPath, item.targetPath);
          item.backupCreated = false;
          assertUnchangedDirectoryChain(item.parentChain, "after backup restore");
          assertExactFile(
            item.targetPath,
            item.targetIdentity,
            "RAG output target changed after backup restore"
          );
        }
        removeExactFileIfPresent(
          item.stagePath,
          item.stageIdentity,
          item.parentChain,
          "RAG output stage changed before rollback cleanup"
        );
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

function assertSafeParentChain(
  root: string,
  parentPath: string,
  create: boolean
): DirectoryIdentity[] {
  const relativeParent = path.relative(root, parentPath);
  if (relativeParent.startsWith("..") || path.isAbsolute(relativeParent)) {
    throw new Error("RAG parent path escapes the root");
  }

  let current = root;
  const chain: DirectoryIdentity[] = [];
  recordSafeDirectory(current, chain);
  for (const segment of relativeParent.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if (!tryLstat(current)) {
      if (!create) throw new Error(`Missing RAG parent directory: ${current}`);
      try {
        mkdirSync(current, { mode: 0o700 });
      } catch (error) {
        if (!hasErrorCode(error, "EEXIST")) throw error;
      }
    }
    recordSafeDirectory(current, chain);
  }
  return chain;
}

function hasErrorCode(error: unknown, expectedCode: string): boolean {
  return (
    typeof error === "object" && error !== null && "code" in error && error.code === expectedCode
  );
}

function inspectWritableTarget(targetPath: string, relativePath: string): FileIdentity | null {
  const targetStats = tryLstat(targetPath);
  if (!targetStats) return null;
  if (targetStats.isSymbolicLink())
    throw new Error(`Refusing symlinked RAG output: ${relativePath}`);
  if (!targetStats.isFile()) {
    throw new Error(`RAG output target must be a regular file: ${relativePath}`);
  }
  return identity(targetStats, true);
}

function recordSafeDirectory(directoryPath: string, chain: DirectoryIdentity[]): void {
  const currentStats = lstatSync(directoryPath);
  if (currentStats.isSymbolicLink()) {
    throw new Error(`Refusing symlinked RAG parent directory: ${directoryPath}`);
  }
  if (!currentStats.isDirectory()) {
    throw new Error(`RAG parent path is not a directory: ${directoryPath}`);
  }
  chain.push({ directoryPath, identity: identity(currentStats) });
}

function assertUnchangedDirectoryChain(chain: readonly DirectoryIdentity[], phase: string): void {
  for (const expected of [...chain].reverse()) {
    const current = lstatSync(expected.directoryPath);
    if (
      current.isSymbolicLink() ||
      !current.isDirectory() ||
      !sameIdentity(current, expected.identity)
    ) {
      throw new Error(`RAG output parent changed ${phase}: ${expected.directoryPath}`);
    }
  }
}

function assertUnchangedTarget(targetPath: string, expected: FileIdentity | null): void {
  if (!expected) {
    assertPathAbsent(targetPath, "RAG output appeared before commit");
    return;
  }
  assertExactFile(targetPath, expected, "RAG output changed before commit");
}

function assertExactFile(targetPath: string, expected: FileIdentity, message: string): void {
  const current = tryLstat(targetPath);
  if (
    !current ||
    current.isSymbolicLink() ||
    !current.isFile() ||
    !sameIdentity(current, expected)
  ) {
    throw new Error(`${message}: ${targetPath}`);
  }
}

function assertPathAbsent(targetPath: string, message: string): void {
  if (tryLstat(targetPath)) throw new Error(`${message}: ${targetPath}`);
}

function removeExactFileIfPresent(
  targetPath: string,
  expected: FileIdentity,
  parentChain: readonly DirectoryIdentity[],
  message: string
): void {
  const current = tryLstat(targetPath);
  if (!current) return;
  assertExactFile(targetPath, expected, message);
  assertUnchangedDirectoryChain(parentChain, "before rollback cleanup");
  rmSync(targetPath);
  assertUnchangedDirectoryChain(parentChain, "after rollback cleanup");
  assertPathAbsent(targetPath, "RAG private stage remained after rollback cleanup");
}

function tryLstat(targetPath: string): Stats | null {
  try {
    return lstatSync(targetPath);
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) return null;
    throw error;
  }
}

function identity(
  stats: { dev: number; ino: number; mode: number; nlink: number },
  includeLinkCount = false
): FileIdentity {
  return {
    dev: stats.dev,
    ino: stats.ino,
    mode: stats.mode,
    ...(includeLinkCount ? { nlink: stats.nlink } : {}),
  };
}

function sameIdentity(
  stats: { dev: number; ino: number; mode: number; nlink: number },
  expected: FileIdentity
): boolean {
  return (
    stats.dev === expected.dev &&
    stats.ino === expected.ino &&
    stats.mode === expected.mode &&
    (expected.nlink === undefined || stats.nlink === expected.nlink)
  );
}
