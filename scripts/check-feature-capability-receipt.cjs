#!/usr/bin/env node
"use strict";

const { lstatSync, readFileSync } = require("node:fs");
const path = require("node:path");
const {
  FeatureCapabilityError,
  PLATFORMS,
  resolveSourceCommit,
  validateFeatureCapabilityReceipt,
} = require("./feature-capability-build.cjs");

const REPO_ROOT = path.resolve(__dirname, "..");
const RECEIPT_PATH = path.join(REPO_ROOT, "dist", "feature-capability-receipt.json");

function fail(message) {
  throw new FeatureCapabilityError("CHECK", message);
}

function parseArgs(argv) {
  if (!Array.isArray(argv)) fail("arguments must be an array");
  let platform;
  let sourceCommit;
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option !== "--platform" && option !== "--source-commit") {
      fail("unknown or extra option");
    }
    const value = argv[index + 1];
    if (typeof value !== "string" || value.startsWith("--")) fail("option value is missing");
    if (option === "--platform") {
      if (platform !== undefined) fail("duplicate --platform option");
      platform = value;
    } else {
      if (sourceCommit !== undefined) fail("duplicate --source-commit option");
      sourceCommit = value;
    }
    index += 1;
  }
  if (!PLATFORMS.includes(platform)) fail("platform must be an explicit release target");
  return { platform, sourceCommit };
}

function readReceipt(receiptPath = RECEIPT_PATH) {
  try {
    const stat = lstatSync(receiptPath);
    if (!stat.isFile() || stat.isSymbolicLink()) fail("receipt must be a regular file");
    return JSON.parse(readFileSync(receiptPath, "utf8"));
  } catch (error) {
    if (error instanceof FeatureCapabilityError) throw error;
    fail("receipt is unavailable or malformed");
  }
}

function checkFeatureCapabilityReceipt({
  platform,
  sourceCommit = resolveSourceCommit(),
  receiptPath = RECEIPT_PATH,
} = {}) {
  const receipt = readReceipt(receiptPath);
  validateFeatureCapabilityReceipt(receipt, {
    expectedSourceCommit: sourceCommit,
    expectedPlatform: platform,
  });
  return receipt;
}

function formatCliError(error) {
  if (error instanceof FeatureCapabilityError) return error.message.slice(0, 1_024);
  return "FEATURE CAPABILITY: unexpected receipt-check failure (details withheld)";
}

module.exports = { checkFeatureCapabilityReceipt, parseArgs, readReceipt };

if (require.main === module) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const receipt = checkFeatureCapabilityReceipt({
      platform: args.platform,
      ...(args.sourceCommit === undefined ? {} : { sourceCommit: args.sourceCommit }),
    });
    process.stdout.write(
      `FEATURE CAPABILITY: verified disabled schema-v1 receipt for ${receipt.platform} at ${receipt.sourceCommit}\n`,
    );
  } catch (error) {
    process.stderr.write(`${formatCliError(error)}\n`);
    process.exitCode = 1;
  }
}
