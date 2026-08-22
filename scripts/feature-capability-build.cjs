#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");
const {
  existsSync,
  lstatSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");
const POLICY_PATH = path.join(REPO_ROOT, "config", "feature-capabilities.json");
const RECEIPT_PATH = path.join(REPO_ROOT, "dist", "feature-capability-receipt.json");
const SOURCE_COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const PLATFORMS = Object.freeze(["web-pages", "android", "ios", "tauri"]);
const PLATFORM_SET = new Set(PLATFORMS);
const ADMISSION_KEYS = Object.freeze([
  "technical",
  "accessibility",
  "performance",
  "visualRuntime",
  "artisticCraft",
  "userApproval",
]);
const ADMISSION_VALUES = new Set(["pass", "fail", "unverified"]);

class FeatureCapabilityError extends Error {
  constructor(code, message, options) {
    super(`FEATURE CAPABILITY: ${message}`, options);
    this.name = "FeatureCapabilityError";
    this.code = code;
  }
}

function fail(code, message, options) {
  throw new FeatureCapabilityError(code, message, options);
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertPlainObject(value, label) {
  if (!isPlainObject(value)) fail("SCHEMA", `${label} must be an object`);
  return value;
}

function assertExactKeys(value, expectedKeys, label) {
  const actual = Object.keys(assertPlainObject(value, label)).sort();
  const expected = [...expectedKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail("SCHEMA", `${label} has missing or unknown fields`);
  }
}

function assertSourceCommit(value) {
  if (typeof value !== "string" || !SOURCE_COMMIT_PATTERN.test(value)) {
    fail("COMMIT", "source commit must be exactly 40 lowercase hexadecimal characters");
  }
  return value;
}

function assertPlatform(value) {
  if (typeof value !== "string" || !PLATFORM_SET.has(value)) {
    fail("PLATFORM", "platform must be one explicit supported release target");
  }
  return value;
}

function parseJson(value, label) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    fail("JSON", `${label} is not valid JSON`);
  }
}

function normalizeAdmission(value, label) {
  assertExactKeys(value, ADMISSION_KEYS, label);
  const normalized = {};
  for (const key of ADMISSION_KEYS) {
    if (!ADMISSION_VALUES.has(value[key])) {
      fail("SCHEMA", `${label}.${key} has an unsupported value`);
    }
    normalized[key] = value[key];
  }
  return Object.freeze(normalized);
}

function parseFeatureCapabilityPolicy(input) {
  const parsed = parseJson(input, "policy");
  assertExactKeys(parsed, ["schemaVersion", "capabilities"], "policy");
  if (parsed.schemaVersion !== 1) fail("SCHEMA", "policy schemaVersion must be 1");
  assertExactKeys(parsed.capabilities, ["journalSaveCeremony"], "policy.capabilities");
  const ceremony = parsed.capabilities.journalSaveCeremony;
  assertExactKeys(
    ceremony,
    ["requested", "killSwitch", "admission"],
    "policy.capabilities.journalSaveCeremony",
  );
  if (typeof ceremony.requested !== "boolean") {
    fail("SCHEMA", "journalSaveCeremony.requested must be boolean");
  }
  if (typeof ceremony.killSwitch !== "boolean") {
    fail("SCHEMA", "journalSaveCeremony.killSwitch must be boolean");
  }

  return Object.freeze({
    schemaVersion: 1,
    capabilities: Object.freeze({
      journalSaveCeremony: Object.freeze({
        requested: ceremony.requested,
        killSwitch: ceremony.killSwitch,
        admission: normalizeAdmission(
          ceremony.admission,
          "policy.capabilities.journalSaveCeremony.admission",
        ),
      }),
    }),
  });
}

function createFeatureCapabilityReceipt(input) {
  assertExactKeys(input, ["sourceCommit", "platform", "policy"], "receipt input");
  const sourceCommit = assertSourceCommit(input.sourceCommit);
  const platform = assertPlatform(input.platform);
  const policy = parseFeatureCapabilityPolicy(input.policy);
  const ceremony = policy.capabilities.journalSaveCeremony;

  // Schema v1 cannot enable production motion. Tracked request/admission strings are
  // review metadata, not an authenticated release authority.
  return Object.freeze({
    schemaVersion: 1,
    sourceCommit,
    platform,
    capabilities: Object.freeze({ journalSaveCeremony: false }),
    killSwitches: Object.freeze({ journalSaveCeremony: ceremony.killSwitch }),
    admission: ceremony.admission,
  });
}

function validateFeatureCapabilityReceipt(receipt, expectations = {}) {
  assertExactKeys(
    receipt,
    ["schemaVersion", "sourceCommit", "platform", "capabilities", "killSwitches", "admission"],
    "receipt",
  );
  assertExactKeys(expectations, [
    ...("expectedSourceCommit" in expectations ? ["expectedSourceCommit"] : []),
    ...("expectedPlatform" in expectations ? ["expectedPlatform"] : []),
  ], "receipt expectations");
  if (receipt.schemaVersion !== 1) fail("SCHEMA", "receipt schemaVersion must be 1");
  const sourceCommit = assertSourceCommit(receipt.sourceCommit);
  const platform = assertPlatform(receipt.platform);
  assertExactKeys(receipt.capabilities, ["journalSaveCeremony"], "receipt.capabilities");
  if (receipt.capabilities.journalSaveCeremony !== false) {
    fail("ADMISSION", "schema-v1 journalSaveCeremony must remain disabled");
  }
  assertExactKeys(receipt.killSwitches, ["journalSaveCeremony"], "receipt.killSwitches");
  if (typeof receipt.killSwitches.journalSaveCeremony !== "boolean") {
    fail("SCHEMA", "receipt kill switch must be boolean");
  }
  normalizeAdmission(receipt.admission, "receipt.admission");

  if (expectations.expectedSourceCommit !== undefined) {
    if (sourceCommit !== assertSourceCommit(expectations.expectedSourceCommit)) {
      fail("COMMIT", "receipt source commit does not match the expected release commit");
    }
  }
  if (expectations.expectedPlatform !== undefined) {
    if (platform !== assertPlatform(expectations.expectedPlatform)) {
      fail("PLATFORM", "receipt platform does not match the expected release target");
    }
  }
  return true;
}

function validateFeatureCapabilityReceiptSet(receipts, expectations = {}) {
  if (!Array.isArray(receipts) || receipts.length !== PLATFORMS.length) {
    fail("PARITY", "release set must contain exactly four target receipts");
  }
  assertExactKeys(expectations, [
    ...("expectedSourceCommit" in expectations ? ["expectedSourceCommit"] : []),
  ], "release-set expectations");

  const byPlatform = new Map();
  for (const receipt of receipts) {
    validateFeatureCapabilityReceipt(receipt, {
      ...(expectations.expectedSourceCommit === undefined
        ? {}
        : { expectedSourceCommit: expectations.expectedSourceCommit }),
    });
    if (byPlatform.has(receipt.platform)) fail("PARITY", "release set has duplicate platforms");
    byPlatform.set(receipt.platform, receipt);
  }
  if (PLATFORMS.some((platform) => !byPlatform.has(platform))) {
    fail("PARITY", "release set is missing a required platform");
  }

  const first = byPlatform.get(PLATFORMS[0]);
  const parity = JSON.stringify({
    sourceCommit: first.sourceCommit,
    capabilities: first.capabilities,
    killSwitches: first.killSwitches,
    admission: first.admission,
  });
  for (const platform of PLATFORMS.slice(1)) {
    const receipt = byPlatform.get(platform);
    const candidate = JSON.stringify({
      sourceCommit: receipt.sourceCommit,
      capabilities: receipt.capabilities,
      killSwitches: receipt.killSwitches,
      admission: receipt.admission,
    });
    if (candidate !== parity) fail("PARITY", "release target receipts disagree");
  }
  return true;
}

function serializeFeatureCapabilityReceipt(receipt) {
  validateFeatureCapabilityReceipt(receipt);
  return `${JSON.stringify(receipt, null, 2)}\n`;
}

function readFeatureCapabilityPolicy(policyPath = POLICY_PATH) {
  let source;
  try {
    const stat = lstatSync(policyPath);
    if (!stat.isFile() || stat.isSymbolicLink()) fail("POLICY", "policy must be a regular file");
    source = readFileSync(policyPath, "utf8");
  } catch (error) {
    if (error instanceof FeatureCapabilityError) throw error;
    fail("POLICY", "policy file is unavailable");
  }
  return parseFeatureCapabilityPolicy(source);
}

function resolveSourceCommit({ env = process.env, rootDir = REPO_ROOT } = {}) {
  if (env === null || typeof env !== "object" || Array.isArray(env)) {
    fail("COMMIT", "environment must be an object");
  }
  const supplied = [env.ZENFLOW_SOURCE_COMMIT, env.GITHUB_SHA].filter(
    (value) => typeof value === "string" && value.length > 0,
  );
  if (supplied.length > 0) {
    const normalized = supplied.map(assertSourceCommit);
    if (normalized.some((value) => value !== normalized[0])) {
      fail("COMMIT", "conflicting source commit inputs");
    }
    return normalized[0];
  }

  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: rootDir,
    encoding: "utf8",
    shell: false,
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (result.error || result.signal || result.status !== 0) {
    fail("COMMIT", "checked-out source commit is unavailable");
  }
  return assertSourceCommit(String(result.stdout).trim());
}

function journalSaveCeremonyBuildDecision({
  mode,
  platform,
  policyPath = POLICY_PATH,
  developmentOverride = false,
} = {}) {
  if (mode !== "production" && mode !== "development") {
    fail("MODE", "build mode must be production or development");
  }
  if (mode === "development") return developmentOverride === true;
  assertPlatform(platform);
  readFeatureCapabilityPolicy(policyPath);
  return false;
}

function writeFeatureCapabilityReceipt({
  platform,
  sourceCommit = resolveSourceCommit(),
  policyPath = POLICY_PATH,
  outputPath = RECEIPT_PATH,
} = {}) {
  const receipt = createFeatureCapabilityReceipt({
    sourceCommit,
    platform,
    policy: readFeatureCapabilityPolicy(policyPath),
  });
  const outputDirectory = path.dirname(outputPath);
  try {
    const directoryStat = lstatSync(outputDirectory);
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
      fail("OUTPUT", "receipt directory must be a real directory");
    }
  } catch (error) {
    if (error instanceof FeatureCapabilityError) throw error;
    fail("OUTPUT", "receipt directory is unavailable; run the build first");
  }

  const temporaryPath = `${outputPath}.${process.pid}.tmp`;
  if (existsSync(temporaryPath)) fail("OUTPUT", "temporary receipt path already exists");
  try {
    writeFileSync(temporaryPath, serializeFeatureCapabilityReceipt(receipt), {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    renameSync(temporaryPath, outputPath);
  } catch (error) {
    try {
      unlinkSync(temporaryPath);
    } catch {
      // Nothing to clean up or the path requires manual review.
    }
    if (error instanceof FeatureCapabilityError) throw error;
    fail("OUTPUT", "receipt could not be written atomically");
  }
  return receipt;
}

function parseWriteReceiptArgs(argv) {
  if (!Array.isArray(argv)) fail("USAGE", "arguments must be an array");
  let platform;
  let sourceCommit;
  let writeReceipt = false;
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === "--write-receipt") {
      if (writeReceipt) fail("USAGE", "duplicate --write-receipt option");
      writeReceipt = true;
      continue;
    }
    if (option !== "--platform" && option !== "--source-commit") {
      fail("USAGE", "unknown or extra option");
    }
    const value = argv[index + 1];
    if (typeof value !== "string" || value.startsWith("--")) {
      fail("USAGE", "option value is missing");
    }
    if (option === "--platform") {
      if (platform !== undefined) fail("USAGE", "duplicate --platform option");
      platform = value;
    } else {
      if (sourceCommit !== undefined) fail("USAGE", "duplicate --source-commit option");
      sourceCommit = value;
    }
    index += 1;
  }
  if (!writeReceipt) fail("USAGE", "--write-receipt is required");
  assertPlatform(platform);
  if (sourceCommit !== undefined) assertSourceCommit(sourceCommit);
  return { platform, sourceCommit };
}

function formatCliError(error) {
  if (error instanceof FeatureCapabilityError) return error.message.slice(0, 1_024);
  return "FEATURE CAPABILITY: unexpected failure (details withheld)";
}

module.exports = {
  ADMISSION_KEYS,
  FeatureCapabilityError,
  PLATFORMS,
  createFeatureCapabilityReceipt,
  journalSaveCeremonyBuildDecision,
  parseFeatureCapabilityPolicy,
  parseWriteReceiptArgs,
  readFeatureCapabilityPolicy,
  resolveSourceCommit,
  serializeFeatureCapabilityReceipt,
  validateFeatureCapabilityReceipt,
  validateFeatureCapabilityReceiptSet,
  writeFeatureCapabilityReceipt,
};

if (require.main === module) {
  try {
    const { platform, sourceCommit } = parseWriteReceiptArgs(process.argv.slice(2));
    const receipt = writeFeatureCapabilityReceipt({
      platform,
      ...(sourceCommit === undefined ? {} : { sourceCommit }),
    });
    process.stdout.write(
      `FEATURE CAPABILITY: wrote disabled schema-v1 receipt for ${receipt.platform} at ${receipt.sourceCommit}\n`,
    );
  } catch (error) {
    process.stderr.write(`${formatCliError(error)}\n`);
    process.exitCode = 1;
  }
}
