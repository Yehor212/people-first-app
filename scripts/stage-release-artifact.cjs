#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  INTERNAL_BUILD_MANIFEST_PATH,
  PREPARED_PAGES_MANIFEST_PATH,
  verifyArtifactFilesAgainstPreparedManifest,
  verifyPreparedPagesArtifactManifest,
  verifyReleaseArtifactIntegrity,
} = require("./check-release-artifact-integrity.cjs");

const ALLOWED_CLI_STAGE_PAIR = {
  source: "dist",
  target: "output/pages-artifact.nosync",
};

function realpathForCandidate(candidate, mustExist = false) {
  let current = path.resolve(candidate);
  if (mustExist) return fs.realpathSync.native(current);

  const suffix = [];
  while (!fs.existsSync(current)) {
    suffix.unshift(path.basename(current));
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.join(fs.realpathSync.native(current), ...suffix);
}

function assertInsideRoot(root, candidate, label, options = {}) {
  const realRoot = fs.realpathSync.native(root);
  const resolvedCandidate = path.resolve(candidate);
  const candidateForCheck = realpathForCandidate(resolvedCandidate, options.mustExist === true);
  const relative = path.relative(realRoot, candidateForCheck);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to stage ${label} outside ${realRoot}: ${candidate}`);
  }
}

function assertDistinctRoots(source, target) {
  const relativeTarget = path.relative(source, target);
  if (
    relativeTarget === "" ||
    (!relativeTarget.startsWith("..") && !path.isAbsolute(relativeTarget))
  ) {
    throw new Error(`Refusing to stage release artifact inside its source: ${target}`);
  }
  const relativeSource = path.relative(target, source);
  if (
    relativeSource === "" ||
    (!relativeSource.startsWith("..") && !path.isAbsolute(relativeSource))
  ) {
    throw new Error(`Refusing to stage release artifact from inside its target: ${source}`);
  }
}

function stageReleaseArtifact(source, target, options = {}) {
  const allowedRoot = path.resolve(options.allowedRoot || process.cwd());
  const resolvedSource = path.resolve(source);
  const resolvedTarget = path.resolve(target);
  if (!fs.existsSync(resolvedSource)) {
    throw new Error(`Cannot stage missing release source: ${resolvedSource}`);
  }
  assertInsideRoot(allowedRoot, resolvedSource, "source", { mustExist: true });
  assertInsideRoot(allowedRoot, resolvedTarget, "target");
  assertDistinctRoots(resolvedSource, resolvedTarget);

  const preparedEvidence = verifyPreparedPagesArtifactManifest(resolvedSource);
  verifyReleaseArtifactIntegrity(resolvedSource, {
    allowedRoot,
    allowInternalBuildManifest: true,
    allowPreparedPagesManifest: true,
  });
  verifyPreparedPagesArtifactManifest(resolvedSource);

  fs.rmSync(resolvedTarget, { force: true, recursive: true });
  fs.mkdirSync(path.dirname(resolvedTarget), { recursive: true });
  const excludedInternalPaths = new Set([
    path.resolve(resolvedSource, INTERNAL_BUILD_MANIFEST_PATH),
    path.resolve(resolvedSource, PREPARED_PAGES_MANIFEST_PATH),
  ]);
  fs.cpSync(resolvedSource, resolvedTarget, {
    recursive: true,
    dereference: false,
    filter: (candidate) => !excludedInternalPaths.has(path.resolve(candidate)),
  });
  verifyPreparedPagesArtifactManifest(resolvedSource);
  verifyArtifactFilesAgainstPreparedManifest(resolvedTarget, preparedEvidence.manifest);
  verifyReleaseArtifactIntegrity(resolvedTarget, { allowedRoot });
  verifyArtifactFilesAgainstPreparedManifest(resolvedTarget, preparedEvidence.manifest);

  return {
    copied: fs.existsSync(resolvedTarget) ? 1 : 0,
    checkedFiles: preparedEvidence.checkedFiles,
    artifactFilesSha256: preparedEvidence.artifactFilesSha256,
    source: resolvedSource,
    target: resolvedTarget,
  };
}

function runCli(argv = process.argv.slice(2)) {
  if (argv.length > 0) {
    throw new Error(
      "stage-release-artifact does not accept path arguments; use the canonical dist -> staged artifact pair."
    );
  }
  const source = path.resolve(process.cwd(), ALLOWED_CLI_STAGE_PAIR.source);
  const target = path.resolve(process.cwd(), ALLOWED_CLI_STAGE_PAIR.target);
  const result = stageReleaseArtifact(source, target);
  console.log(
    `[stage-release] ${path.relative(process.cwd(), source)} -> ${path.relative(process.cwd(), target)}; artifact staged`
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
  runCli,
  stageReleaseArtifact,
};
