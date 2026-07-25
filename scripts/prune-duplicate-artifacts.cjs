#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { hasDuplicateArtifactOrdinal } = require("./duplicate-artifact-policy.cjs");

const DEFAULT_REPOSITORY_ROOT = path.resolve(__dirname, "..");
const DEFAULT_DARWIN_PASSES = 24;
const DEFAULT_OTHER_PASSES = 3;
const DEFAULT_DELAY_MS = 500;
const DEFAULT_STABLE_PASSES = 3;
const DEFAULT_DARWIN_MINIMUM_PASSES = DEFAULT_DARWIN_PASSES;
const DEFAULT_OTHER_MINIMUM_PASSES = 3;
const DUPLICATE_ARTIFACT_REPLACEMENT_PATTERN = / \d+(?=\.|$)/g;
const DISPOSABLE_GENERATED_ROOTS = [
  "dist",
  "android/app/src/main/assets/public",
  "ios/App/App/public",
  "output/pages-artifact.nosync",
];
const READ_ONLY_GENERATED_ROOTS = [...DISPOSABLE_GENERATED_ROOTS, "android/app/src/main/res/xml"];
const FILE_COMPARE_BUFFER_SIZE = 64 * 1024;
const INTERNAL_QUARANTINE_NAME = ".zenflow-duplicate-prune-quarantine";

function canonicalDuplicateName(name) {
  return name.replace(DUPLICATE_ARTIFACT_REPLACEMENT_PATTERN, "");
}

function getRealPath(filePath) {
  return typeof fs.realpathSync.native === "function"
    ? fs.realpathSync.native(filePath)
    : fs.realpathSync(filePath);
}

function describePath(root, entryPath) {
  return path.relative(root, entryPath) || ".";
}

function isInsideRoot(root, entryPath) {
  const relative = path.relative(root, entryPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function readDirectoryStat(directoryPath, label) {
  let stat;
  try {
    stat = fs.lstatSync(directoryPath);
  } catch (error) {
    throw new Error(`${label} does not exist: ${directoryPath}`, { cause: error });
  }
  if (stat.isSymbolicLink()) {
    throw new Error(`${label} must not be a symbolic link: ${directoryPath}`);
  }
  if (!stat.isDirectory()) {
    throw new Error(`${label} must be a directory: ${directoryPath}`);
  }
  return stat;
}

function resolveRepositoryContext(repositoryRoot = DEFAULT_REPOSITORY_ROOT) {
  const lexicalRoot = path.resolve(repositoryRoot);
  readDirectoryStat(lexicalRoot, "Repository root");
  return { lexicalRoot, realRoot: getRealPath(lexicalRoot) };
}

function splitPortablePath(relativeRoot) {
  return relativeRoot.split("/");
}

function resolveReadOnlyRootWithinBoundary(root, allowedRoot) {
  const lexicalAllowedRoot = path.resolve(allowedRoot);
  readDirectoryStat(lexicalAllowedRoot, "Allowed read-only root");
  const realAllowedRoot = getRealPath(lexicalAllowedRoot);

  const lexicalRoot = path.resolve(root);
  readDirectoryStat(lexicalRoot, "Generated verification root");
  const realRoot = getRealPath(lexicalRoot);
  if (!isInsideRoot(realAllowedRoot, realRoot)) {
    throw new Error(
      `Generated verification root escapes allowed read-only root ${realAllowedRoot}: ${lexicalRoot}`
    );
  }

  return {
    lexicalRoot,
    realRoot,
    repository: { lexicalRoot: lexicalAllowedRoot, realRoot: realAllowedRoot },
    relativeRoot: path.relative(realAllowedRoot, realRoot) || ".",
  };
}

function resolveGeneratedRoot(root, options = {}, { destructive = false } = {}) {
  if (!destructive && options.allowedRoot) {
    return resolveReadOnlyRootWithinBoundary(root, options.allowedRoot);
  }

  const repository = resolveRepositoryContext(options.repositoryRoot);
  const lexicalRoot = path.resolve(root);
  const allowedRoots = destructive ? DISPOSABLE_GENERATED_ROOTS : READ_ONLY_GENERATED_ROOTS;
  const matchedRelativeRoot = allowedRoots.find(
    (relativeRoot) =>
      path.resolve(repository.lexicalRoot, ...splitPortablePath(relativeRoot)) === lexicalRoot
  );

  if (!matchedRelativeRoot) {
    const kind = destructive
      ? "an allowlisted disposable generated root"
      : "an allowlisted generated verification root";
    throw new Error(`${lexicalRoot} is not ${kind}`);
  }

  let currentPath = repository.lexicalRoot;
  const traversedSegments = [];
  for (const segment of splitPortablePath(matchedRelativeRoot)) {
    traversedSegments.push(segment);
    currentPath = path.join(currentPath, segment);
    readDirectoryStat(currentPath, "Generated root path segment");

    const expectedRealPath = path.resolve(repository.realRoot, ...traversedSegments);
    const currentRealPath = getRealPath(currentPath);
    if (
      currentRealPath !== expectedRealPath ||
      !isInsideRoot(repository.realRoot, currentRealPath)
    ) {
      throw new Error(`Generated root realpath escapes the repository: ${currentPath}`);
    }
  }

  return {
    lexicalRoot,
    realRoot: getRealPath(lexicalRoot),
    repository,
    relativeRoot: matchedRelativeRoot,
  };
}

function assertSafeTreeEntry(root, entryPath) {
  if (!isInsideRoot(root, path.resolve(entryPath)) || path.resolve(entryPath) === root) {
    throw new Error(`Refusing to inspect outside generated root ${root}: ${entryPath}`);
  }

  let stat;
  try {
    stat = fs.lstatSync(entryPath);
  } catch (error) {
    throw new Error(`Generated artifact disappeared during inspection: ${entryPath}`, {
      cause: error,
    });
  }
  if (stat.isSymbolicLink()) {
    throw new Error(`Generated artifact tree contains a symbolic link: ${entryPath}`);
  }
  if (!stat.isDirectory() && !stat.isFile()) {
    throw new Error(`Generated artifact tree contains an unsupported entry: ${entryPath}`);
  }

  const realPath = getRealPath(entryPath);
  if (!isInsideRoot(root, realPath) || realPath === root) {
    throw new Error(`Generated artifact realpath escapes ${root}: ${entryPath}`);
  }
  return stat;
}

function collectDuplicateArtifactCandidates(rootInfo) {
  const candidates = [];

  function scanDirectory(directoryPath, insideNumberedCandidate) {
    const names = fs.readdirSync(directoryPath).sort((left, right) => left.localeCompare(right));
    for (const name of names) {
      const entryPath = path.join(directoryPath, name);
      const stat = assertSafeTreeEntry(rootInfo.realRoot, entryPath);
      const isNumberedCandidate = hasDuplicateArtifactOrdinal(name);
      if (isNumberedCandidate && !insideNumberedCandidate) candidates.push(entryPath);
      if (stat.isDirectory()) {
        scanDirectory(entryPath, insideNumberedCandidate || isNumberedCandidate);
      }
    }
  }

  scanDirectory(rootInfo.realRoot, false);
  return candidates;
}

function canonicalPathForCandidate(root, candidate) {
  const canonicalPath = path.join(
    path.dirname(candidate),
    canonicalDuplicateName(path.basename(candidate))
  );
  if (!isInsideRoot(root, path.resolve(canonicalPath)) || path.resolve(canonicalPath) === root) {
    throw new Error(`Canonical sibling escapes generated root ${root}: ${candidate}`);
  }
  return canonicalPath;
}

function compareRegularFiles(leftPath, rightPath) {
  const noFollow = fs.constants.O_NOFOLLOW || 0;
  let leftDescriptor;
  let rightDescriptor;
  try {
    leftDescriptor = fs.openSync(leftPath, fs.constants.O_RDONLY | noFollow);
    rightDescriptor = fs.openSync(rightPath, fs.constants.O_RDONLY | noFollow);
    const leftStat = fs.fstatSync(leftDescriptor);
    const rightStat = fs.fstatSync(rightDescriptor);
    if (!leftStat.isFile() || !rightStat.isFile() || leftStat.size !== rightStat.size) return false;

    const leftBuffer = Buffer.allocUnsafe(FILE_COMPARE_BUFFER_SIZE);
    const rightBuffer = Buffer.allocUnsafe(FILE_COMPARE_BUFFER_SIZE);
    let position = 0;
    while (position < leftStat.size) {
      const bytesToRead = Math.min(FILE_COMPARE_BUFFER_SIZE, leftStat.size - position);
      const leftRead = fs.readSync(leftDescriptor, leftBuffer, 0, bytesToRead, position);
      const rightRead = fs.readSync(rightDescriptor, rightBuffer, 0, bytesToRead, position);
      if (
        leftRead !== rightRead ||
        !leftBuffer.subarray(0, leftRead).equals(rightBuffer.subarray(0, rightRead))
      ) {
        return false;
      }
      if (leftRead === 0) return false;
      position += leftRead;
    }
    return true;
  } finally {
    if (leftDescriptor !== undefined) fs.closeSync(leftDescriptor);
    if (rightDescriptor !== undefined) fs.closeSync(rightDescriptor);
  }
}

function compareDirectoryTrees(root, leftPath, rightPath) {
  const leftNames = fs.readdirSync(leftPath).sort((left, right) => left.localeCompare(right));
  const rightNames = fs.readdirSync(rightPath).sort((left, right) => left.localeCompare(right));

  for (const name of leftNames) assertSafeTreeEntry(root, path.join(leftPath, name));
  for (const name of rightNames) assertSafeTreeEntry(root, path.join(rightPath, name));

  const rightNameSet = new Set(rightNames);
  for (const name of leftNames) {
    if (!rightNameSet.has(name)) return false;
    const leftEntry = path.join(leftPath, name);
    const rightEntry = path.join(rightPath, name);
    if (!entriesAreByteIdentical(root, leftEntry, rightEntry)) return false;
  }
  return true;
}

function entriesAreByteIdentical(root, leftPath, rightPath) {
  const leftStat = assertSafeTreeEntry(root, leftPath);
  const rightStat = assertSafeTreeEntry(root, rightPath);
  if (
    leftStat.isFile() !== rightStat.isFile() ||
    leftStat.isDirectory() !== rightStat.isDirectory()
  ) {
    return false;
  }
  return leftStat.isFile()
    ? compareRegularFiles(leftPath, rightPath)
    : compareDirectoryTrees(root, leftPath, rightPath);
}

function validateCandidatePair(root, candidate) {
  const canonicalPath = canonicalPathForCandidate(root, candidate);
  if (!fs.existsSync(canonicalPath)) {
    throw new Error(
      `Refusing to remove ${describePath(root, candidate)}: canonical sibling is missing`
    );
  }
  if (!entriesAreByteIdentical(root, candidate, canonicalPath)) {
    throw new Error(
      `Refusing to remove ${describePath(root, candidate)}: numbered copy is not recursively byte-identical to canonical sibling ${describePath(root, canonicalPath)}`
    );
  }
  return { candidate, canonicalPath };
}

function readOptionalStat(entryPath) {
  try {
    return fs.lstatSync(entryPath);
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
}

function internalQuarantinePath(root) {
  return path.join(root, INTERNAL_QUARANTINE_NAME);
}

function assertInternalQuarantineAbsent(root) {
  const quarantinePath = internalQuarantinePath(root);
  if (readOptionalStat(quarantinePath) !== null) {
    throw new Error(
      `Refusing to prune while internal quarantine state remains: ${describePath(root, quarantinePath)}`
    );
  }
  return quarantinePath;
}

function createInternalQuarantine(root) {
  const quarantinePath = assertInternalQuarantineAbsent(root);
  try {
    fs.mkdirSync(quarantinePath, { mode: 0o700 });
  } catch (error) {
    throw new Error(`Could not create exclusive internal quarantine: ${quarantinePath}`, {
      cause: error,
    });
  }

  const stat = assertSafeTreeEntry(root, quarantinePath);
  if (!stat.isDirectory()) {
    throw new Error(`Internal quarantine must be a directory: ${quarantinePath}`);
  }
  return quarantinePath;
}

function quarantineEntryPath(quarantinePath, index) {
  return path.join(quarantinePath, `entry-${String(index).padStart(6, "0")}`);
}

function assertExpectedQuarantineContents(root, quarantinePath, moved) {
  const stat = assertSafeTreeEntry(root, quarantinePath);
  if (!stat.isDirectory()) {
    throw new Error(`Internal quarantine must remain a directory: ${quarantinePath}`);
  }

  const expectedNames = moved.map((entry) => path.basename(entry.quarantinePath)).sort();
  const actualNames = fs
    .readdirSync(quarantinePath)
    .sort((left, right) => left.localeCompare(right));
  if (
    expectedNames.length !== actualNames.length ||
    expectedNames.some((name, index) => name !== actualNames[index])
  ) {
    throw new Error(
      `Internal quarantine changed during pruning; refusing to delete it: ${quarantinePath}`
    );
  }

  for (const entry of moved) {
    const quarantinedStat = assertSafeTreeEntry(root, entry.quarantinePath);
    if (!quarantinedStat.isFile() && !quarantinedStat.isDirectory()) {
      throw new Error(`Unsupported quarantined artifact: ${entry.quarantinePath}`);
    }
    if (!entriesAreByteIdentical(root, entry.quarantinePath, entry.canonicalPath)) {
      throw new Error(
        `Quarantined artifact changed after its move; refusing to delete ${describePath(root, entry.candidate)}`
      );
    }
  }
}

function removeEmptyInternalQuarantine(root, quarantinePath) {
  const stat = readOptionalStat(quarantinePath);
  if (stat === null) return;
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(`Internal quarantine became unsafe and was retained: ${quarantinePath}`);
  }
  const realPath = getRealPath(quarantinePath);
  if (!isInsideRoot(root, realPath) || realPath === root) {
    throw new Error(
      `Internal quarantine escaped the generated root and was retained: ${quarantinePath}`
    );
  }
  if (fs.readdirSync(quarantinePath).length > 0) {
    throw new Error(`Internal quarantine is not empty and was retained: ${quarantinePath}`);
  }
  fs.rmdirSync(quarantinePath);
}

function rollbackMovedCandidates(root, quarantinePath, moved, originalError) {
  const rollbackFailures = [];

  for (const entry of [...moved].reverse()) {
    try {
      const quarantinedStat = readOptionalStat(entry.quarantinePath);
      const originalStat = readOptionalStat(entry.candidate);
      if (quarantinedStat === null) {
        if (originalStat === null) {
          throw new Error(`both original and quarantined paths are missing: ${entry.candidate}`);
        }
        continue;
      }
      assertSafeTreeEntry(root, entry.quarantinePath);
      if (originalStat !== null) {
        throw new Error(`original path was recreated while quarantined: ${entry.candidate}`);
      }
      fs.renameSync(entry.quarantinePath, entry.candidate);
      assertSafeTreeEntry(root, entry.candidate);
    } catch (error) {
      rollbackFailures.push(error instanceof Error ? error.message : String(error));
    }
  }

  try {
    removeEmptyInternalQuarantine(root, quarantinePath);
  } catch (error) {
    rollbackFailures.push(error instanceof Error ? error.message : String(error));
  }

  if (rollbackFailures.length > 0) {
    throw new Error(
      `Duplicate artifact batch failed and rollback was incomplete; internal quarantine was retained. ` +
        `Original failure: ${originalError instanceof Error ? originalError.message : String(originalError)}. ` +
        `Rollback failure(s): ${rollbackFailures.join("; ")}`,
      { cause: originalError }
    );
  }
}

function findDuplicateArtifactCandidates(root, options = {}) {
  const rootInfo = resolveGeneratedRoot(root, options);
  assertInternalQuarantineAbsent(rootInfo.realRoot);
  return collectDuplicateArtifactCandidates(rootInfo);
}

function findDuplicateArtifacts(root, options = {}) {
  const rootInfo = resolveGeneratedRoot(root, options);
  assertInternalQuarantineAbsent(rootInfo.realRoot);
  return collectDuplicateArtifactCandidates(rootInfo).filter((candidate) =>
    fs.existsSync(canonicalPathForCandidate(rootInfo.realRoot, candidate))
  );
}

function pruneDuplicateArtifacts(root, options = {}) {
  const rootInfo = resolveGeneratedRoot(root, options, { destructive: true });
  const quarantinePath = assertInternalQuarantineAbsent(rootInfo.realRoot);
  const candidates = collectDuplicateArtifactCandidates(rootInfo);

  // Validate the complete batch before the first mutation so a bad candidate preserves the batch.
  const candidatePairs = candidates.map((candidate) =>
    validateCandidatePair(rootInfo.realRoot, candidate)
  );
  if (candidatePairs.length === 0) return { removed: 0, duplicates: candidates };

  createInternalQuarantine(rootInfo.realRoot);
  const moved = [];
  try {
    for (let index = 0; index < candidatePairs.length; index += 1) {
      const pair = validateCandidatePair(rootInfo.realRoot, candidatePairs[index].candidate);
      const destination = quarantineEntryPath(quarantinePath, index);
      if (readOptionalStat(destination) !== null) {
        throw new Error(`Internal quarantine destination already exists: ${destination}`);
      }
      try {
        fs.renameSync(pair.candidate, destination);
      } catch (error) {
        const candidateStat = readOptionalStat(pair.candidate);
        const destinationStat = readOptionalStat(destination);
        if (candidateStat === null && destinationStat !== null) {
          moved.push({ ...pair, quarantinePath: destination });
        }
        throw error;
      }
      moved.push({ ...pair, quarantinePath: destination });
      assertSafeTreeEntry(rootInfo.realRoot, destination);
    }

    // Re-read every moved entry immediately before the only destructive operation.
    assertExpectedQuarantineContents(rootInfo.realRoot, quarantinePath, moved);
    assertExpectedQuarantineContents(rootInfo.realRoot, quarantinePath, moved);
  } catch (error) {
    rollbackMovedCandidates(rootInfo.realRoot, quarantinePath, moved, error);
    throw error;
  }

  fs.rmSync(quarantinePath, { force: false, recursive: true });
  return { removed: candidates.length, duplicates: candidates };
}

function formatRelativeDuplicates(root, duplicates) {
  return duplicates.map((duplicate) => describePath(root, duplicate));
}

function verifyNoDuplicateArtifacts(root, options = {}) {
  const rootInfo = resolveGeneratedRoot(root, options);
  assertInternalQuarantineAbsent(rootInfo.realRoot);
  const duplicates = collectDuplicateArtifactCandidates(rootInfo);
  if (duplicates.length > 0) {
    const listed = formatRelativeDuplicates(rootInfo.realRoot, duplicates)
      .slice(0, 20)
      .join("\n - ");
    throw new Error(
      `Duplicate generated artifact(s) remain in ${rootInfo.realRoot}: ${duplicates.length}` +
        (listed ? `\n - ${listed}` : "")
    );
  }
  return { duplicates };
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function readPositiveInteger(raw, fallback, label) {
  if (raw === undefined || raw === null) return fallback;
  const parsed =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && /^[0-9]+$/.test(raw)
        ? Number(raw)
        : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

function settleDefaultsForPlatform(platform = process.platform) {
  const darwin = platform === "darwin";
  return {
    passes: darwin ? DEFAULT_DARWIN_PASSES : DEFAULT_OTHER_PASSES,
    delayMs: DEFAULT_DELAY_MS,
    stablePasses: DEFAULT_STABLE_PASSES,
    minimumPasses: darwin ? DEFAULT_DARWIN_MINIMUM_PASSES : DEFAULT_OTHER_MINIMUM_PASSES,
  };
}

function pruneDuplicateArtifactsUntilSettled(root, options = {}) {
  const defaults = settleDefaultsForPlatform();
  const passes = readPositiveInteger(
    options.passes ?? process.env.ZENFLOW_DUPLICATE_PRUNE_PASSES,
    defaults.passes,
    "passes"
  );
  const delayMs = readPositiveInteger(
    options.delayMs ?? process.env.ZENFLOW_DUPLICATE_PRUNE_DELAY_MS,
    defaults.delayMs,
    "delayMs"
  );
  const stablePasses = readPositiveInteger(
    options.stablePasses ?? process.env.ZENFLOW_DUPLICATE_PRUNE_STABLE_PASSES,
    defaults.stablePasses,
    "stablePasses"
  );
  const minimumPasses = readPositiveInteger(
    options.minimumPasses ?? process.env.ZENFLOW_DUPLICATE_PRUNE_MINIMUM_PASSES,
    defaults.minimumPasses,
    "minimumPasses"
  );
  if (passes < stablePasses) throw new Error("passes must be >= stablePasses");
  if (passes < minimumPasses) throw new Error("passes must be >= minimumPasses");

  resolveGeneratedRoot(root, options, { destructive: true });
  let removed = 0;
  let cleanPasses = 0;
  for (let pass = 1; pass <= passes; pass += 1) {
    const passRemoved = pruneDuplicateArtifacts(root, options).removed;
    removed += passRemoved;
    cleanPasses = passRemoved === 0 ? cleanPasses + 1 : 0;
    if (pass >= minimumPasses && cleanPasses >= stablePasses) {
      verifyNoDuplicateArtifacts(root, options);
      return { removed, passes: pass };
    }
    if (pass < passes) sleepSync(delayMs);
  }

  let finalVerification = "";
  try {
    verifyNoDuplicateArtifacts(root, options);
  } catch (error) {
    finalVerification = ` Final verification failed: ${error instanceof Error ? error.message : String(error)}`;
  }
  throw new Error(
    `Duplicate artifact pruning did not settle after ${passes} pass(es).${finalVerification}`
  );
}

function parseCliArguments(argv) {
  const targets = argv.filter((argument) => !argument.startsWith("--"));
  if (targets.length > 1) throw new Error("Expected at most one generated-root target");
  const supportedValuePrefixes = ["--passes=", "--delay=", "--stable-passes=", "--minimum-passes="];
  for (const argument of argv.filter((entry) => entry.startsWith("--"))) {
    if (
      argument !== "--verify" &&
      !supportedValuePrefixes.some((prefix) => argument.startsWith(prefix))
    ) {
      throw new Error(`Unknown option: ${argument}`);
    }
  }

  function readValue(prefix) {
    const values = argv.filter((argument) => argument.startsWith(prefix));
    if (values.length > 1) throw new Error(`Option may be specified only once: ${prefix}`);
    return values[0]?.slice(prefix.length);
  }

  return {
    target: targets[0] || "dist",
    verify: argv.includes("--verify"),
    passes: readValue("--passes="),
    delayMs: readValue("--delay="),
    stablePasses: readValue("--stable-passes="),
    minimumPasses: readValue("--minimum-passes="),
  };
}

function resolveCliGeneratedRoot(repositoryRoot, target, { verify }) {
  let relativeRoot;
  switch (target) {
    case "dist":
      relativeRoot = "dist";
      break;
    case "android/app/src/main/assets/public":
      relativeRoot = "android/app/src/main/assets/public";
      break;
    case "ios/App/App/public":
      relativeRoot = "ios/App/App/public";
      break;
    case "output/pages-artifact.nosync":
      relativeRoot = "output/pages-artifact.nosync";
      break;
    case "android/app/src/main/res/xml":
      if (verify) {
        relativeRoot = "android/app/src/main/res/xml";
        break;
      }
      // Fall through to the fail-closed error for read-only roots in destructive mode.
    default:
      throw new Error("Generated-root target must be an exact allowlisted relative path");
  }

  return path.resolve(repositoryRoot, ...splitPortablePath(relativeRoot));
}

function runCli(argv = process.argv.slice(2), runtime = {}) {
  const repositoryRoot = runtime.repositoryRoot || DEFAULT_REPOSITORY_ROOT;
  const cwd = path.resolve(runtime.cwd || process.cwd());
  const parsed = parseCliArguments(argv);
  const root = resolveCliGeneratedRoot(repositoryRoot, parsed.target, {
    verify: parsed.verify,
  });
  if (parsed.verify) {
    if (
      parsed.passes !== undefined ||
      parsed.delayMs !== undefined ||
      parsed.stablePasses !== undefined ||
      parsed.minimumPasses !== undefined
    ) {
      throw new Error("Settle options cannot be combined with --verify");
    }
    verifyNoDuplicateArtifacts(root, { repositoryRoot });
    console.log(`[prune-duplicates] ${path.relative(cwd, root) || "."}: verification passed`);
    return { removed: 0, passes: 0 };
  }

  const result = pruneDuplicateArtifactsUntilSettled(root, {
    repositoryRoot,
    passes: parsed.passes,
    delayMs: parsed.delayMs,
    stablePasses: parsed.stablePasses,
    minimumPasses: parsed.minimumPasses,
  });
  console.log(
    `[prune-duplicates] ${path.relative(cwd, root) || "."}: removed ${result.removed} duplicate artifact(s) over ${result.passes} pass(es)`
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
  hasDuplicateArtifactOrdinal,
  pruneDuplicateArtifacts,
  pruneDuplicateArtifactsUntilSettled,
  runCli,
  settleDefaultsForPlatform,
  verifyNoDuplicateArtifacts,
};
