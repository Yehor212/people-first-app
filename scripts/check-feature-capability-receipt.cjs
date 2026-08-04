#!/usr/bin/env node
"use strict";

const SOURCE_COMMIT_PATTERN = /^[a-f0-9]{40}$/;
// Schema v1 records a privacy-safe disabled decision only. Its admission rows
// are review metadata, not authenticated evidence, so literal `pass` strings
// cannot enable production motion. A later schema must add evidence-bound
// authorization before this constant can be removed in a separately reviewed
// release change.
const SCHEMA_V1_ENABLEMENT_SUPPORTED = false;
const ADMISSION_STATUSES = new Set(["pass", "fail", "unverified"]);
const ADMISSION_KEYS = Object.freeze([
  "technical",
  "accessibility",
  "performance",
  "visualRuntime",
  "artisticCraft",
  "userApproval",
]);
const RELEASE_INPUT_KEYS = Object.freeze([
  "schemaVersion",
  "sourceCommit",
  "requestedCapabilities",
  "killSwitches",
  "admission",
]);
const RECEIPT_KEYS = Object.freeze([
  "schemaVersion",
  "sourceCommit",
  "platform",
  "capabilities",
  "killSwitches",
  "admission",
]);
const CAPABILITY_KEYS = Object.freeze(["journalSaveCeremony"]);
const FORBIDDEN_FIELD_NAMES = new Set([
  "account",
  "accountid",
  "absolutepath",
  "activity",
  "activityhistory",
  "credential",
  "credentials",
  "device",
  "deviceid",
  "environment",
  "environmentsecret",
  "error",
  "errortext",
  "history",
  "host",
  "hostname",
  "journal",
  "journalcontent",
  "journalcount",
  "message",
  "path",
  "productionrecord",
  "refreshtoken",
  "rolloutbucket",
  "secret",
  "token",
  "accesstoken",
  "user",
  "userid",
]);

class FeatureCapabilityReceiptError extends Error {
  constructor(code, message, issues = []) {
    super(`FEATURE CAPABILITY RECEIPT: ${message}`);
    this.name = "FeatureCapabilityReceiptError";
    this.code = code;
    this.issues = Object.freeze(
      issues.map((issue) => Object.freeze({ code: issue.code, path: issue.path }))
    );
  }
}

const FEATURE_CAPABILITY_PLATFORMS = Object.freeze(["web-pages", "android", "ios", "tauri"]);
const FEATURE_CAPABILITY_PLATFORM_SET = new Set(FEATURE_CAPABILITY_PLATFORMS);

function fail(code, message, issues) {
  throw new FeatureCapabilityReceiptError(code, message, issues);
}

function issue(issues, code, path) {
  issues.push(Object.freeze({ code, path }));
}

function normalizedFieldName(field) {
  return field.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function isSourceCommit(value) {
  return typeof value === "string" && SOURCE_COMMIT_PATTERN.test(value);
}

function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function inspectExactObject(value, expectedKeys, path, issues) {
  if (!isPlainRecord(value)) {
    issue(issues, "INVALID_OBJECT", path);
    return false;
  }

  const ownKeys = Reflect.ownKeys(value);
  for (const ownKey of ownKeys) {
    if (typeof ownKey !== "string") {
      issue(issues, "UNKNOWN_FIELD", path);
      continue;
    }
    if (!expectedKeys.includes(ownKey)) {
      const code = FORBIDDEN_FIELD_NAMES.has(normalizedFieldName(ownKey))
        ? "FORBIDDEN_FIELD"
        : "UNKNOWN_FIELD";
      issue(issues, code, path);
    }
  }

  for (const expectedKey of expectedKeys) {
    if (!Object.hasOwn(value, expectedKey)) {
      issue(issues, "MISSING_FIELD", `${path}.${expectedKey}`);
      continue;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, expectedKey);
    if (!descriptor || !Object.hasOwn(descriptor, "value") || descriptor.enumerable !== true) {
      issue(issues, "INVALID_FIELD", `${path}.${expectedKey}`);
    }
  }
  return true;
}

function dataValue(record, key) {
  if (!isPlainRecord(record)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  if (!descriptor || !Object.hasOwn(descriptor, "value")) return undefined;
  return descriptor.value;
}

function inspectBooleanContainer(value, path, issues) {
  const isObject = inspectExactObject(value, CAPABILITY_KEYS, path, issues);
  const journalSaveCeremony = dataValue(value, "journalSaveCeremony");
  if (isObject && typeof journalSaveCeremony !== "boolean") {
    issue(issues, "INVALID_BOOLEAN", `${path}.journalSaveCeremony`);
  }
  return journalSaveCeremony;
}

function inspectAdmission(value, path, issues) {
  const isObject = inspectExactObject(value, ADMISSION_KEYS, path, issues);
  const normalized = {};
  for (const key of ADMISSION_KEYS) {
    const status = dataValue(value, key);
    if (isObject && !ADMISSION_STATUSES.has(status)) {
      issue(issues, "INVALID_ADMISSION", `${path}.${key}`);
    }
    normalized[key] = status;
  }
  return normalized;
}

function canonicalAdmission(admission) {
  return Object.freeze({
    technical: admission.technical,
    accessibility: admission.accessibility,
    performance: admission.performance,
    visualRuntime: admission.visualRuntime,
    artisticCraft: admission.artisticCraft,
    userApproval: admission.userApproval,
  });
}

function inspectReleaseInput(input) {
  const issues = [];
  const isObject = inspectExactObject(input, RELEASE_INPUT_KEYS, "$", issues);
  const schemaVersion = dataValue(input, "schemaVersion");
  const sourceCommit = dataValue(input, "sourceCommit");
  const requestedCapabilities = dataValue(input, "requestedCapabilities");
  const killSwitches = dataValue(input, "killSwitches");
  const admissionInput = dataValue(input, "admission");

  if (isObject && schemaVersion !== 1) {
    issue(issues, "INVALID_SCHEMA_VERSION", "$.schemaVersion");
  }
  if (isObject && !isSourceCommit(sourceCommit)) {
    issue(issues, "INVALID_SOURCE_COMMIT", "$.sourceCommit");
  }

  const requested = inspectBooleanContainer(
    requestedCapabilities,
    "$.requestedCapabilities",
    issues
  );
  const killSwitch = inspectBooleanContainer(killSwitches, "$.killSwitches", issues);
  const admission = inspectAdmission(admissionInput, "$.admission", issues);
  const ok = issues.length === 0;
  const allAdmissionPass = ok && ADMISSION_KEYS.every((key) => admission[key] === "pass");
  const journalSaveCeremony =
    SCHEMA_V1_ENABLEMENT_SUPPORTED &&
    ok &&
    requested === true &&
    killSwitch === false &&
    allAdmissionPass;

  return {
    ok,
    journalSaveCeremony,
    issues: Object.freeze(issues),
    normalized: ok
      ? Object.freeze({
          schemaVersion: 1,
          sourceCommit,
          requestedCapabilities: Object.freeze({ journalSaveCeremony: requested }),
          killSwitches: Object.freeze({ journalSaveCeremony: killSwitch }),
          admission: canonicalAdmission(admission),
        })
      : null,
  };
}

function evaluateFeatureCapabilityReleaseInput(input) {
  try {
    const report = inspectReleaseInput(input);
    return Object.freeze({
      ok: report.ok,
      journalSaveCeremony: report.journalSaveCeremony,
      issues: report.issues,
    });
  } catch {
    return Object.freeze({
      ok: false,
      journalSaveCeremony: false,
      issues: Object.freeze([Object.freeze({ code: "INVALID_INPUT", path: "$" })]),
    });
  }
}

function assertPlatform(platform) {
  if (typeof platform !== "string" || !FEATURE_CAPABILITY_PLATFORM_SET.has(platform)) {
    fail("INVALID_PLATFORM", "an explicit supported release target is required");
  }
  return platform;
}

function canonicalReceipt({ sourceCommit, platform, capability, killSwitch, admission }) {
  return Object.freeze({
    schemaVersion: 1,
    sourceCommit,
    platform,
    capabilities: Object.freeze({ journalSaveCeremony: capability }),
    killSwitches: Object.freeze({ journalSaveCeremony: killSwitch }),
    admission: canonicalAdmission(admission),
  });
}

function createFeatureCapabilityReceipt(input, platform) {
  const explicitPlatform = assertPlatform(platform);
  let report;
  try {
    report = inspectReleaseInput(input);
  } catch {
    fail("INVALID_RELEASE_INPUT", "release input is malformed");
  }
  if (!report.ok || !report.normalized) {
    fail(
      "INVALID_RELEASE_INPUT",
      "release input is incomplete, malformed, or conflicting",
      report.issues
    );
  }

  return canonicalReceipt({
    sourceCommit: report.normalized.sourceCommit,
    platform: explicitPlatform,
    capability: report.journalSaveCeremony,
    killSwitch: report.normalized.killSwitches.journalSaveCeremony,
    admission: report.normalized.admission,
  });
}

function assertExplicitPlatformSet(platforms) {
  if (!Array.isArray(platforms) || platforms.length !== FEATURE_CAPABILITY_PLATFORMS.length) {
    fail("TARGET_PARITY", "all four explicit release targets are required");
  }
  for (let index = 0; index < FEATURE_CAPABILITY_PLATFORMS.length; index += 1) {
    if (platforms[index] !== FEATURE_CAPABILITY_PLATFORMS[index]) {
      fail("TARGET_PARITY", "release targets must use the canonical target set and order");
    }
  }
}

function createFeatureCapabilityReceiptSet(input, platforms) {
  assertExplicitPlatformSet(platforms);
  return Object.freeze(
    FEATURE_CAPABILITY_PLATFORMS.map((platform) => createFeatureCapabilityReceipt(input, platform))
  );
}

function inspectReceipt(receipt) {
  const issues = [];
  const isObject = inspectExactObject(receipt, RECEIPT_KEYS, "$", issues);
  const schemaVersion = dataValue(receipt, "schemaVersion");
  const sourceCommit = dataValue(receipt, "sourceCommit");
  const platform = dataValue(receipt, "platform");
  const capabilitiesInput = dataValue(receipt, "capabilities");
  const killSwitchesInput = dataValue(receipt, "killSwitches");
  const admissionInput = dataValue(receipt, "admission");

  if (isObject && schemaVersion !== 1) {
    issue(issues, "INVALID_SCHEMA_VERSION", "$.schemaVersion");
  }
  if (isObject && !isSourceCommit(sourceCommit)) {
    issue(issues, "INVALID_SOURCE_COMMIT", "$.sourceCommit");
  }
  if (isObject && !FEATURE_CAPABILITY_PLATFORM_SET.has(platform)) {
    issue(issues, "INVALID_PLATFORM", "$.platform");
  }

  const capability = inspectBooleanContainer(capabilitiesInput, "$.capabilities", issues);
  const killSwitch = inspectBooleanContainer(killSwitchesInput, "$.killSwitches", issues);
  const admission = inspectAdmission(admissionInput, "$.admission", issues);
  const structurallyValid = issues.length === 0;
  if (structurallyValid && capability === true && !SCHEMA_V1_ENABLEMENT_SUPPORTED) {
    issue(issues, "UNSUPPORTED_ENABLEMENT", "$.capabilities.journalSaveCeremony");
  } else if (
    structurallyValid &&
    capability === true &&
    (killSwitch === true || ADMISSION_KEYS.some((key) => admission[key] !== "pass"))
  ) {
    issue(issues, "UNSAFE_CAPABILITY", "$.capabilities.journalSaveCeremony");
  }

  return {
    issues: Object.freeze(issues),
    normalized:
      issues.length === 0
        ? canonicalReceipt({
            sourceCommit,
            platform,
            capability,
            killSwitch,
            admission,
          })
        : null,
  };
}

function receiptIssueCode(issues) {
  if (issues.some((entry) => entry.code === "FORBIDDEN_FIELD")) {
    return "FORBIDDEN_FIELD";
  }
  if (issues.some((entry) => entry.code === "UNSUPPORTED_ENABLEMENT")) {
    return "UNSUPPORTED_ENABLEMENT";
  }
  if (issues.some((entry) => entry.code === "UNSAFE_CAPABILITY")) {
    return "UNSAFE_CAPABILITY";
  }
  return "INVALID_RECEIPT";
}

function assertExpectedReceiptBinding(expected) {
  if (!isPlainRecord(expected)) {
    fail("INVALID_EXPECTATION", "expected receipt binding is required");
  }
  const sourceCommit = dataValue(expected, "sourceCommit");
  const platform = dataValue(expected, "platform");
  if (!isSourceCommit(sourceCommit) || !FEATURE_CAPABILITY_PLATFORM_SET.has(platform)) {
    fail("INVALID_EXPECTATION", "expected receipt binding is malformed");
  }
  return { sourceCommit, platform };
}

function validateFeatureCapabilityReceipt(receipt, expected) {
  let inspection;
  try {
    inspection = inspectReceipt(receipt);
  } catch {
    fail("INVALID_RECEIPT", "receipt is malformed");
  }
  if (!inspection.normalized) {
    const code = receiptIssueCode(inspection.issues);
    const message =
      code === "FORBIDDEN_FIELD"
        ? "receipt contains a forbidden field"
        : code === "UNSUPPORTED_ENABLEMENT"
          ? "schema v1 cannot authenticate production enablement"
        : code === "UNSAFE_CAPABILITY"
          ? "enabled capability violates admission or kill-switch policy"
          : "receipt does not match the strict schema";
    fail(code, message, inspection.issues);
  }

  const binding = assertExpectedReceiptBinding(expected);
  if (inspection.normalized.sourceCommit !== binding.sourceCommit) {
    fail("SOURCE_COMMIT_MISMATCH", "receipt belongs to a different source commit");
  }
  if (inspection.normalized.platform !== binding.platform) {
    fail("PLATFORM_MISMATCH", "receipt belongs to a different release target");
  }
  return inspection.normalized;
}

function assertExpectedSetBinding(expected) {
  if (!isPlainRecord(expected)) {
    fail("INVALID_EXPECTATION", "expected receipt-set binding is required");
  }
  const sourceCommit = dataValue(expected, "sourceCommit");
  if (!isSourceCommit(sourceCommit)) {
    fail("INVALID_EXPECTATION", "expected receipt-set source commit is malformed");
  }
  return sourceCommit;
}

function validateFeatureCapabilityReceiptSet(receipts, expected) {
  const sourceCommit = assertExpectedSetBinding(expected);
  if (!Array.isArray(receipts) || receipts.length !== FEATURE_CAPABILITY_PLATFORMS.length) {
    fail("TARGET_PARITY", "receipt set must contain all four release targets");
  }

  for (let index = 0; index < FEATURE_CAPABILITY_PLATFORMS.length; index += 1) {
    let platform;
    try {
      platform = dataValue(receipts[index], "platform");
    } catch {
      fail("TARGET_PARITY", "receipt set contains an unreadable target receipt");
    }
    if (platform !== FEATURE_CAPABILITY_PLATFORMS[index]) {
      fail("TARGET_PARITY", "receipt set has a missing, duplicate, unknown, or reordered target");
    }
  }

  const normalized = receipts.map((receipt, index) =>
    validateFeatureCapabilityReceipt(receipt, {
      sourceCommit,
      platform: FEATURE_CAPABILITY_PLATFORMS[index],
    })
  );
  const paritySignature = (receipt) =>
    JSON.stringify({
      sourceCommit: receipt.sourceCommit,
      capabilities: receipt.capabilities,
      killSwitches: receipt.killSwitches,
      admission: receipt.admission,
    });
  const firstSignature = paritySignature(normalized[0]);
  if (normalized.some((receipt) => paritySignature(receipt) !== firstSignature)) {
    fail("RECEIPT_CONFLICT", "release targets carry conflicting capability decisions");
  }
  return Object.freeze(normalized);
}

function serializeFeatureCapabilityReceipt(receipt, expected) {
  const normalized = validateFeatureCapabilityReceipt(receipt, expected);
  return `${JSON.stringify(normalized, null, 2)}\n`;
}

module.exports = {
  ADMISSION_KEYS,
  FEATURE_CAPABILITY_PLATFORMS,
  SCHEMA_V1_ENABLEMENT_SUPPORTED,
  FeatureCapabilityReceiptError,
  evaluateFeatureCapabilityReleaseInput,
  createFeatureCapabilityReceipt,
  createFeatureCapabilityReceiptSet,
  validateFeatureCapabilityReceipt,
  validateFeatureCapabilityReceiptSet,
  serializeFeatureCapabilityReceipt,
};

if (require.main === module) {
  process.stderr.write(
    "FEATURE CAPABILITY RECEIPT: explicit release input and target are required by the build integration\n"
  );
  process.exitCode = 2;
}
