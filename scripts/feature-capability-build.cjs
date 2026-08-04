#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");
const {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} = require("node:fs");
const path = require("node:path");

const {
  FEATURE_CAPABILITY_PLATFORMS,
  createFeatureCapabilityReceipt,
  serializeFeatureCapabilityReceipt,
  validateFeatureCapabilityReceipt,
} = require("./check-feature-capability-receipt.cjs");

const REPO_ROOT = path.resolve(__dirname, "..");
const POLICY_RELATIVE_PATH = "config/feature-capability-release.json";
const RECEIPT_RELATIVE_PATH = "dist/feature-capability-receipt.json";
const SOURCE_COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const POLICY_KEYS = Object.freeze([
  "schemaVersion",
  "requestedCapabilities",
  "killSwitches",
  "admission",
]);
const MAX_POLICY_BYTES = 16 * 1024;
const MAX_RECEIPT_BYTES = 16 * 1024;

class FeatureCapabilityBuildError extends Error {
  constructor(code, message) {
    super(`FEATURE CAPABILITY BUILD [${code}]: ${message}`);
    this.name = "FeatureCapabilityBuildError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new FeatureCapabilityBuildError(code, message);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function canonicalRoot(rootDir) {
  if (typeof rootDir !== "string" || rootDir.length === 0) {
    fail("INVALID_ROOT", "repository root is required");
  }
  const resolved = path.resolve(rootDir);
  let stat;
  try {
    stat = lstatSync(resolved);
  } catch {
    fail("INVALID_ROOT", "repository root is unavailable");
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    fail("INVALID_ROOT", "repository root must be a real directory");
  }
  return realpathSync(resolved);
}

function managedPath(rootDir, relativePath, options = {}) {
  const root = canonicalRoot(rootDir);
  const candidate = path.resolve(root, relativePath);
  const relative = path.relative(root, candidate);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    fail("PATH_BOUNDARY", "managed artifact escaped the repository boundary");
  }
  if (options.mustExist) {
    let stat;
    try {
      stat = lstatSync(candidate);
    } catch {
      fail("MISSING_ARTIFACT", "required capability artifact is missing");
    }
    if (!stat.isFile() || stat.isSymbolicLink()) {
      fail("UNSAFE_ARTIFACT", "capability artifact must be a regular file");
    }
    const real = realpathSync(candidate);
    const realRelative = path.relative(root, real);
    if (!realRelative || realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
      fail("PATH_BOUNDARY", "capability artifact escaped the repository boundary");
    }
  }
  return candidate;
}

function readJsonArtifact(filePath, maxBytes, code) {
  let stat;
  try {
    stat = lstatSync(filePath);
  } catch {
    fail(code, "required JSON artifact is unavailable");
  }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0 || stat.size > maxBytes) {
    fail(code, "required JSON artifact is not a bounded regular file");
  }
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    fail(code, "required JSON artifact is malformed");
  }
}

function loadReleaseInput(rootDir, sourceCommit) {
  const policyPath = managedPath(rootDir, POLICY_RELATIVE_PATH, { mustExist: true });
  const policy = readJsonArtifact(policyPath, MAX_POLICY_BYTES, "INVALID_POLICY");
  if (!isObject(policy) || Object.keys(policy).join("\0") !== POLICY_KEYS.join("\0")) {
    fail("INVALID_POLICY", "release policy must use the exact reviewed schema");
  }
  return {
    schemaVersion: policy.schemaVersion,
    sourceCommit,
    requestedCapabilities: policy.requestedCapabilities,
    killSwitches: policy.killSwitches,
    admission: policy.admission,
  };
}

function runGit(rootDir, args) {
  const result = spawnSync("git", args, {
    cwd: rootDir,
    encoding: "utf8",
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
    windowsHide: true,
  });
  if (result.error || result.signal || result.status !== 0) {
    fail("GIT_PROBE_FAILED", "exact source state could not be verified");
  }
  return result.stdout.trim();
}

function probeRepositoryGitState(rootDir) {
  const root = canonicalRoot(rootDir);
  const sourceCommit = runGit(root, ["rev-parse", "HEAD"]);
  // Equivalent evidence command: git status --porcelain --untracked-files=all
  const porcelain = runGit(root, ["status", "--porcelain=v1", "--untracked-files=all"]);
  return { sourceCommit, clean: porcelain.length === 0 };
}

function assertPlatform(platform) {
  if (!FEATURE_CAPABILITY_PLATFORMS.includes(platform)) {
    fail("INVALID_PLATFORM", "an explicit supported release platform is required");
  }
  return platform;
}

function assertReleaseSource({ rootDir, sourceCommit, probeGitState }) {
  if (!SOURCE_COMMIT_PATTERN.test(sourceCommit || "")) {
    fail("INVALID_SOURCE_COMMIT", "release source commit must be a lowercase full SHA");
  }
  const probe = typeof probeGitState === "function" ? probeGitState : probeRepositoryGitState;
  const state = probe(rootDir);
  if (!isObject(state) || !SOURCE_COMMIT_PATTERN.test(state.sourceCommit || "")) {
    fail("GIT_PROBE_FAILED", "exact source state could not be verified");
  }
  if (state.sourceCommit !== sourceCommit) {
    fail("SOURCE_COMMIT_MISMATCH", "release source differs from the checked-out commit");
  }
  if (state.clean !== true) {
    fail("DIRTY_RELEASE_SOURCE", "release receipts require a clean exact-commit checkout");
  }
}

function normalizeReceiptRequirement(value) {
  if (value === undefined || value === "false") return false;
  if (value === "true") return true;
  fail("INVALID_RECEIPT_REQUIREMENT", "receipt requirement must be an explicit boolean string");
}

function hasRawEnablement(env) {
  return (
    env.VITE_ENABLE_JOURNAL_SAVE_CEREMONY === "true" ||
    env.ZENFLOW_JOURNAL_SAVE_CEREMONY_BUILD_ENABLED === "true"
  );
}

function releaseDecision({ rootDir, platform, sourceCommit, probeGitState }) {
  assertPlatform(platform);
  assertReleaseSource({ rootDir, sourceCommit, probeGitState });
  const input = loadReleaseInput(rootDir, sourceCommit);
  const receipt = createFeatureCapabilityReceipt(input, platform);
  return { input, receipt };
}

function resolveFeatureCapabilityBuildEnvironment({
  rootDir,
  platform,
  mode,
  env = process.env,
  probeGitState,
}) {
  if (!isObject(env)) fail("INVALID_ENV", "build environment is required");
  assertPlatform(platform);
  if (mode !== "production" && mode !== "development") {
    fail("INVALID_MODE", "build mode is unsupported");
  }
  if (hasRawEnablement(env)) {
    fail("RAW_ENABLEMENT", "raw ceremony enablement cannot bypass the release policy");
  }

  const receiptRequired = normalizeReceiptRequirement(env.ZENFLOW_REQUIRE_CAPABILITY_RECEIPT);
  const sourceCommit = env.ZENFLOW_RELEASE_SOURCE_COMMIT;
  if (mode !== "production" && (receiptRequired || sourceCommit !== undefined)) {
    fail("NON_PRODUCTION_RECEIPT", "development builds cannot claim a release receipt");
  }
  if (receiptRequired !== (sourceCommit !== undefined)) {
    fail("INCOMPLETE_RELEASE_BINDING", "receipt requirement and source commit must be supplied together");
  }

  const next = { ...env };
  next.ZENFLOW_FEATURE_CAPABILITY_PLATFORM = platform;
  if (!receiptRequired) {
    delete next.ZENFLOW_RELEASE_SOURCE_COMMIT;
    next.ZENFLOW_REQUIRE_CAPABILITY_RECEIPT = "false";
    next.ZENFLOW_JOURNAL_SAVE_CEREMONY_BUILD_ENABLED = "false";
    return next;
  }

  const { receipt } = releaseDecision({
    rootDir,
    platform,
    sourceCommit,
    probeGitState,
  });
  next.ZENFLOW_REQUIRE_CAPABILITY_RECEIPT = "true";
  next.ZENFLOW_RELEASE_SOURCE_COMMIT = receipt.sourceCommit;
  next.ZENFLOW_JOURNAL_SAVE_CEREMONY_BUILD_ENABLED = String(
    receipt.capabilities.journalSaveCeremony,
  );
  return next;
}

function receiptContext({ rootDir, env, probeGitState }) {
  if (!isObject(env)) fail("INVALID_ENV", "build environment is required");
  const required = normalizeReceiptRequirement(env.ZENFLOW_REQUIRE_CAPABILITY_RECEIPT);
  const platform = assertPlatform(env.ZENFLOW_FEATURE_CAPABILITY_PLATFORM);
  const receiptPath = managedPath(rootDir, RECEIPT_RELATIVE_PATH);
  if (!required) {
    if (existsSync(receiptPath)) {
      fail("STALE_RECEIPT", "a non-release build contains a stale release receipt");
    }
    return { required: false, receiptPath };
  }
  const sourceCommit = env.ZENFLOW_RELEASE_SOURCE_COMMIT;
  const { receipt } = releaseDecision({
    rootDir,
    platform,
    sourceCommit,
    probeGitState,
  });
  if (
    env.ZENFLOW_JOURNAL_SAVE_CEREMONY_BUILD_ENABLED !==
    String(receipt.capabilities.journalSaveCeremony)
  ) {
    fail("BUILD_DECISION_MISMATCH", "build flag differs from the reviewed release decision");
  }
  return { required: true, receiptPath, receipt, sourceCommit, platform };
}

function assertSafeDist(rootDir) {
  const distPath = path.dirname(managedPath(rootDir, RECEIPT_RELATIVE_PATH));
  let stat;
  try {
    stat = lstatSync(distPath);
  } catch {
    fail("MISSING_DIST", "build output directory is unavailable");
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    fail("UNSAFE_DIST", "build output must be a real directory");
  }
  return distPath;
}

function writeFeatureCapabilityReceipt({ rootDir, env = process.env, probeGitState }) {
  const context = receiptContext({ rootDir, env, probeGitState });
  if (!context.required) return null;
  assertSafeDist(rootDir);
  if (existsSync(context.receiptPath)) {
    fail("RECEIPT_ALREADY_EXISTS", "receipt output already exists");
  }
  const serialized = serializeFeatureCapabilityReceipt(context.receipt, {
    sourceCommit: context.sourceCommit,
    platform: context.platform,
  });
  writeFileSync(context.receiptPath, serialized, { encoding: "utf8", flag: "wx", mode: 0o644 });
  return validateFeatureCapabilityReceiptArtifact({ rootDir, env, probeGitState });
}

function validateFeatureCapabilityReceiptArtifact({
  rootDir,
  env = process.env,
  probeGitState,
}) {
  const context = receiptContext({ rootDir, env, probeGitState });
  if (!context.required) return null;
  const receiptPath = managedPath(rootDir, RECEIPT_RELATIVE_PATH, { mustExist: true });
  const candidate = readJsonArtifact(receiptPath, MAX_RECEIPT_BYTES, "INVALID_RECEIPT_ARTIFACT");
  return validateFeatureCapabilityReceipt(candidate, {
    sourceCommit: context.sourceCommit,
    platform: context.platform,
  });
}

function main(argv) {
  if (!Array.isArray(argv) || argv.length !== 1 || !["--write", "--validate"].includes(argv[0])) {
    fail("USAGE", "use exactly --write or --validate");
  }
  if (argv[0] === "--write") {
    const receipt = writeFeatureCapabilityReceipt({ rootDir: REPO_ROOT });
    process.stdout.write(
      receipt
        ? `FEATURE CAPABILITY BUILD: wrote disabled=${!receipt.capabilities.journalSaveCeremony} target receipt\n`
        : "FEATURE CAPABILITY BUILD: local non-release build remains disabled; no receipt emitted\n",
    );
    return;
  }
  const receipt = validateFeatureCapabilityReceiptArtifact({ rootDir: REPO_ROOT });
  process.stdout.write(
    receipt
      ? "FEATURE CAPABILITY BUILD: exact-commit target receipt validated\n"
      : "FEATURE CAPABILITY BUILD: local non-release build has no release receipt\n",
  );
}

module.exports = {
  FeatureCapabilityBuildError,
  POLICY_RELATIVE_PATH,
  RECEIPT_RELATIVE_PATH,
  probeRepositoryGitState,
  resolveFeatureCapabilityBuildEnvironment,
  validateFeatureCapabilityReceiptArtifact,
  writeFeatureCapabilityReceipt,
};

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    const message =
      error instanceof FeatureCapabilityBuildError
        ? error.message
        : "FEATURE CAPABILITY BUILD [UNEXPECTED]: operation failed";
    process.stderr.write(`${message.slice(0, 1024)}\n`);
    process.exitCode = 1;
  }
}
