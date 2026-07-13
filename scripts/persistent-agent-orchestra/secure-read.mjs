import { constants as fsConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";

export async function readRegularFileInsideRoot({ rootDir, relativePath }) {
  if (typeof rootDir !== "string" || rootDir.trim() === "") {
    throw new Error("rootDir must be a non-empty path string");
  }
  if (
    typeof relativePath !== "string" ||
    relativePath.trim() === "" ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error("input path must be a non-empty relative path");
  }
  const root = path.resolve(rootDir);
  const target = path.resolve(root, relativePath);
  if (target === root || !target.startsWith(`${root}${path.sep}`)) {
    throw new Error(`input path escapes root: ${relativePath}`);
  }
  const rootStats = await lstat(root);
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    throw new Error("input root must be a real directory, not a symlink");
  }

  const parentSegments = path.relative(root, path.dirname(target)).split(path.sep).filter(Boolean);
  let current = root;
  for (const segment of parentSegments) {
    current = path.join(current, segment);
    const stats = await lstat(current);
    if (stats.isSymbolicLink()) throw new Error(`input parent is a symlink: ${current}`);
    if (!stats.isDirectory()) throw new Error(`input parent is not a directory: ${current}`);
  }
  const stats = await lstat(target);
  if (stats.isSymbolicLink()) throw new Error(`input file is a symlink: ${target}`);
  if (!stats.isFile()) throw new Error(`input target is not a regular file: ${target}`);
  if (stats.nlink !== 1) throw new Error(`input file has multiple hard links: ${target}`);

  const [canonicalRoot, canonicalParent] = await Promise.all([
    realpath(root),
    realpath(path.dirname(target)),
  ]);
  if (
    canonicalParent !== canonicalRoot &&
    !canonicalParent.startsWith(`${canonicalRoot}${path.sep}`)
  ) {
    throw new Error(`input parent escapes root through a symlink: ${relativePath}`);
  }

  const flags = fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0);
  const handle = await open(target, flags);
  try {
    const openedStats = await handle.stat();
    if (
      !openedStats.isFile() ||
      openedStats.nlink !== 1 ||
      openedStats.dev !== stats.dev ||
      openedStats.ino !== stats.ino
    ) {
      throw new Error(`input file changed identity while opening: ${relativePath}`);
    }
    return await handle.readFile("utf8");
  } finally {
    await handle.close();
  }
}
