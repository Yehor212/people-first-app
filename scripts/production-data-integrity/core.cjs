"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { TextDecoder } = require("node:util");
const ts = require("typescript");
const { hasDuplicateArtifactOrdinal } = require("../duplicate-artifact-policy.cjs");

const SCHEMA_VERSION = "1.0.0";
const RULE_IDS = Array.from(
  { length: 12 },
  (_, index) => `PDI${String(index + 1).padStart(3, "0")}`
);
const EXPECTED_RULES = {
  PDI001: ["TEST_ARTIFACT_REACHABLE_FROM_PRODUCTION", "error", "high"],
  PDI002: ["SYNTHETIC_USER_HISTORY_IN_PRODUCTION", "error", "high"],
  PDI003: ["DECEPTIVE_ERROR_FALLBACK", "error", "high"],
  PDI004: ["SYNTHETIC_DATA_TO_PERSISTENCE_OR_SYNC", "error", "high"],
  PDI005: ["STUBBED_PRODUCTION_SUCCESS", "error", "high"],
  PDI006: ["UNSAFE_PRODUCTION_DEMO_MODE", "error", "high"],
  PDI007: ["SYNTHETIC_DATA_TO_ANALYTICS_EXPORT_OR_SHARE", "error", "high"],
  PDI008: ["PRODUCTION_MIGRATION_SEEDS_USER_DATA", "error", "high"],
  PDI009: ["PRODUCTION_BUNDLE_CONTAINS_TEST_FIXTURE", "error", "high"],
  PDI010: ["ENFORCEMENT_TAMPERING", "error", "high"],
  PDI011: ["FAKE_RELEASE_OR_VERIFICATION_EVIDENCE", "error", "high"],
  PDI012: ["UNCLASSIFIED_SYNTHETIC_SOURCE", "warning", "medium"],
};
const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".sql",
  ".html",
  ".css",
  ".frag",
  ".vert",
  ".svg",
  ".rs",
  ".java",
  ".kt",
  ".swift",
  ".md",
  ".yml",
  ".yaml",
  ".toml",
  ".xml",
  ".map",
  ".txt",
]);
const AST_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const TEST_APPROVER_PATTERN = /\b(agent|codex|claude|chatgpt|openai|ai|bot)\b/i;
const CONTROL_FILE_MAX_BYTES = 1024 * 1024;
const REQUIRED_BUNDLE_SENTINEL = "ZENFLOW_TEST_FIXTURE_SENTINEL_7F4C9A2E";
const MAX_BUNDLE_ROOTS = 4;
const MAX_BUNDLE_DIRECTORIES = 2_048;
const MAX_BUNDLE_AGGREGATE_BYTES = 64n * 1024n * 1024n;
const PDI_TEST_HOOKS = Symbol("PDI_TEST_HOOKS");
const REQUIRED_CONFIG_VALUES = {
  entrypoints: [
    "src/main.tsx",
    "src/sw.ts",
    "src/runtime-perf-bootstrap.js",
    "vite.config.ts",
    "capacitor.config.ts",
    "src-tauri/src/main.rs",
    "src-tauri/build.rs",
    "public/404.html",
    "public/offline.html",
    "supabase/functions/*/index.ts",
    "scripts/smoke-sync-account.cjs",
  ],
  scanRoots: [
    "src",
    "supabase/functions",
    "supabase/migrations",
    "supabase/sql",
    "src-tauri/src",
    "src-tauri/build.rs",
    "android/app/src/main/java",
    "ios/App/App",
    "ios/App/CapApp-SPM/Sources",
    "public",
    "docs/release",
    "dist",
  ],
  productionPathGlobs: [
    "supabase/functions/**",
    "supabase/migrations/**",
    "supabase/sql/**",
    "src-tauri/src/**",
    "src-tauri/build.rs",
    "android/app/src/main/java/**",
    "ios/App/App/*.swift",
    "ios/App/App/**/*.swift",
    "ios/App/CapApp-SPM/Sources/**/*.swift",
    "vite.config.ts",
    "public/**",
    "scripts/smoke-sync-account.cjs",
  ],
  bundleDirectories: ["dist"],
  releaseEvidenceRoots: ["docs/release", "output", "artifacts"],
};
const REQUIRED_REPOSITORY_CONTRACT_PATHS = [
  "config/production-data-integrity.json",
  "config/production-data-integrity-baseline.json",
  "config/production-data-integrity-waivers.json",
  "package.json",
  "scripts/check-production-data-integrity.cjs",
  "scripts/production-data-integrity/core.cjs",
  "scripts/duplicate-artifact-policy.cjs",
  ".github/workflows/production-data-integrity.yml",
  ".codex/hooks.json",
  ".codex/hooks/production-data-integrity-gate.cjs",
  "scripts/__tests__/production-data-integrity.test.ts",
  "scripts/__tests__/production-data-integrity-hook.test.ts",
  "scripts/__tests__/production-data-integrity-workflow.test.ts",
  "docs/ai/PRODUCTION_DATA_INTEGRITY_POLICY.md",
  "docs/adr/0010-production-data-integrity-enforcement.md",
  "AGENTS.md",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/CODEOWNERS",
];
const PINNED_CONFIG_DIGESTS = {
  testPathGlobs: "058ac32b01187d33d04530669a5e269d0f91995b970dda1c0d3593ddc7f5f349",
  devPathGlobs: "13a43a550ea040b8f8d6df25e67950c9d7371eb16b70f20085fc771a81b535ee",
  generatedPathGlobs: "7cfdeeabf3d8cbb10e7634bb17b20cc33ee9dc15e0b601bf5f34d0d83b4210d8",
  documentationPathGlobs: "5e1498879887b392a82397311690b33312728e3398931d8175ee4d269107cf1f",
  enforcementPathGlobs: "d5ea8e0d49ed3ef1d1bf0a9e5477ccb4e2ab5b54dff6a60c3030a68b7ddad168",
  scanExcludeGlobs: "76a6a7da43b51b2db95a9e01d3cc2fafc51d3828b12b00d00cb6adda6a4506c3",
  sourceExtensions: "f4e5019ac6771774e3ee5abda0862dafc42d1cddee49f3ebc263ba6af98cb7da",
  auditedNonLiteralDynamicImports:
    "3f013bbd96eff911133a71b17e248bda35ed521dd8a0d3fdb6ac2cbb140c9dd7",
  domainFields: "e71f6271e611eac03aac505163d451b69ea83276f95fdbee5881930b2ab41c9f",
  historySignalFields: "2dec44d4a7aa71d5fef9ac5381cde326edbbe15b9cfbaf7201637ff7e065a0b5",
  timeSignalFields: "454355dd92f527c3c24374dc3ec5c42e018c98705a75bbe3de77af12f4786307",
  syntheticMarkers: "e490ca914ba83699a5781ad55ce0cb653e656bcfb204d77c0448575aae67b407",
  persistenceSinkNames: "048cdaeb4ac77fa1ee299c1f1c56ec781285f8a5811f5e8f15d9c8bdc2ebfd9f",
  externalSinkMarkers: "2696879200eb30309562d7635ebbdba287a3956a578dd2d656b9210337469618",
  userDataTables: "599088629ffa24713cc95a625fc572cc2d8acde3730603befb0044747c9d71b1",
  operationalSeedTables: "58ba64ea619b982ad50076e6458547155dbe4baf0d34ac770d90f276ae48fbdd",
  releaseEvidenceRoots: "883c85c12cd85ab526021374ae64eb6ba1035f2460a381bfbbce6cb15af9b9b1",
  releaseEvidenceGlobs: "4cfce1149f3de7dfbbbdf3df887ffb99f4bf54bfac9dfa94eca1dd85e192b787",
  releaseEvidenceExcludeGlobs: "d14c30be57025b3307f2e4e9cf30d75ea5ab0fc21ae8bbeaad0e317718a1afae",
  releaseEvidenceStatusFields: "0dc036c712b3ea6c80c0c0a19901a710e88176cb3dc891eccb64302c5eba1d71",
  bundleSentinels: "e578c824b2a33566cdb3c313bbfdce68a479ed05b4a63be64aef0675368571a2",
  repositoryContracts: "ff93801ba5770b6e45acfb1bfe8f26c73b7189c8e4f3073ec6fed444e4b1469b",
  aliases: "78a7011e1b860f83cc7ab98c5985af4da42caf41e4f19e35cfe8e81b270e531a",
  limits: "e348f4ebb9dea0d6614c7647254e8be72fd8e1eb68d3679efa1fe66d2df0da29",
};
const CANONICAL_PACKAGE_SCRIPTS = {
  "check:production-data-integrity": "node scripts/check-production-data-integrity.cjs --all",
  "check:production-data-integrity:diff": "node scripts/check-production-data-integrity.cjs --diff",
  "check:production-data-integrity:staged":
    "node scripts/check-production-data-integrity.cjs --staged",
  "check:production-data-integrity:bundle":
    "node scripts/check-production-data-integrity.cjs --all --bundle dist",
};
const UNCONDITIONALLY_SHIPPED_PREFIXES = [
  "public/",
  "android/app/src/main/java/",
  "ios/App/App/",
  "ios/App/CapApp-SPM/Sources/",
  "src-tauri/src/",
];

class ConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigurationError";
  }
}

function normalizeNewlines(value) {
  return String(value)
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n");
}

function normalizeRepoPath(value) {
  return String(value || "")
    .normalize("NFC")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/{2,}/g, "/");
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function sha256Bytes(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

const PDI_TEST_API = Object.freeze({ sha256Bytes });

function canonicalizeForDigest(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeForDigest).sort().join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalizeForDigest(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function canonicalDigest(value) {
  return sha256(canonicalizeForDigest(value));
}

function globToRegExp(glob) {
  const normalized = normalizeRepoPath(glob);
  let source = "^";
  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    const next = normalized[index + 1];
    if (character === "*" && next === "*") {
      const after = normalized[index + 2];
      if (after === "/") {
        source += "(?:.*/)?";
        index += 2;
      } else {
        source += ".*";
        index += 1;
      }
    } else if (character === "*") {
      source += "[^/]*";
    } else if (character === "?") {
      source += "[^/]";
    } else {
      source += character.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
    }
  }
  return new RegExp(`${source}$`);
}

function matchesGlob(filePath, glob) {
  return globToRegExp(glob).test(normalizeRepoPath(filePath));
}

function matchesAny(filePath, globs) {
  return Array.isArray(globs) && globs.some((glob) => matchesGlob(filePath, glob));
}

function isInsideRoot(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function resolveInsideRoot(root, relativePath) {
  const target = path.resolve(root, relativePath);
  if (!isInsideRoot(root, target)) {
    throw new ConfigurationError(`path escapes repository root: ${relativePath}`);
  }
  return target;
}

function assertExistingRealpathInsideRoot(root, target, label) {
  let real;
  try {
    real = fs.realpathSync(target);
  } catch (error) {
    throw new ConfigurationError(`${label} cannot resolve realpath: ${error.message}`);
  }
  if (!isInsideRoot(root, real)) {
    throw new ConfigurationError(`${label} realpath escapes repository root: ${real}`);
  }
  return real;
}

function decodeUtf8(buffer, label) {
  try {
    return normalizeNewlines(new TextDecoder("utf-8", { fatal: true }).decode(buffer));
  } catch (error) {
    throw new ConfigurationError(`${label} is not valid UTF-8: ${error.message}`);
  }
}

function readJsonFile(root, relativePath, label, maxBytes = CONTROL_FILE_MAX_BYTES) {
  const target = resolveInsideRoot(root, relativePath);
  let content;
  try {
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink())
      throw new ConfigurationError(`${label} cannot be a symlink: ${relativePath}`);
    if (!stat.isFile()) throw new ConfigurationError(`${label} must be a file: ${relativePath}`);
    assertExistingRealpathInsideRoot(root, target, `${label} ${relativePath}`);
    if (stat.size > maxBytes)
      throw new ConfigurationError(`${label} exceeds ${maxBytes} bytes: ${relativePath}`);
    content = decodeUtf8(fs.readFileSync(target), `${label} ${relativePath}`);
  } catch (error) {
    if (error instanceof ConfigurationError) throw error;
    throw new ConfigurationError(`${label} cannot be read: ${relativePath}: ${error.message}`);
  }
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new ConfigurationError(`${label} is not valid JSON: ${relativePath}: ${error.message}`);
  }
}

function requireArray(config, field) {
  if (!Array.isArray(config[field]))
    throw new ConfigurationError(`config.${field} must be an array`);
}

function requireNonEmptyStringArray(config, field) {
  requireArray(config, field);
  if (
    config[field].length === 0 ||
    config[field].some((value) => typeof value !== "string" || value.trim() === "")
  ) {
    throw new ConfigurationError(`config.${field} must contain non-empty strings`);
  }
}

function requireCanonicalValues(config, field, values) {
  const actual = new Set(config[field].map(normalizeRepoPath));
  for (const required of values) {
    if (!actual.has(normalizeRepoPath(required)))
      throw new ConfigurationError(`config.${field} is missing canonical coverage: ${required}`);
  }
}

function validateConfig(config) {
  if (!config || typeof config !== "object")
    throw new ConfigurationError("config must be an object");
  if (config.schemaVersion !== SCHEMA_VERSION)
    throw new ConfigurationError(`config.schemaVersion must be ${SCHEMA_VERSION}`);
  for (const field of [
    "entrypoints",
    "scanRoots",
    "productionPathGlobs",
    "testPathGlobs",
    "devPathGlobs",
    "generatedPathGlobs",
    "documentationPathGlobs",
    "enforcementPathGlobs",
    "sourceExtensions",
    "domainFields",
    "historySignalFields",
    "timeSignalFields",
    "syntheticMarkers",
    "persistenceSinkNames",
    "externalSinkMarkers",
    "userDataTables",
    "bundleDirectories",
    "bundleSentinels",
    "repositoryContracts",
    "auditedNonLiteralDynamicImports",
    "operationalSeedTables",
    "scanExcludeGlobs",
    "releaseEvidenceRoots",
    "releaseEvidenceGlobs",
    "releaseEvidenceExcludeGlobs",
    "releaseEvidenceStatusFields",
  ])
    requireArray(config, field);
  for (const field of [
    "entrypoints",
    "scanRoots",
    "productionPathGlobs",
    "testPathGlobs",
    "devPathGlobs",
    "generatedPathGlobs",
    "documentationPathGlobs",
    "enforcementPathGlobs",
    "scanExcludeGlobs",
    "sourceExtensions",
    "domainFields",
    "historySignalFields",
    "timeSignalFields",
    "syntheticMarkers",
    "persistenceSinkNames",
    "externalSinkMarkers",
    "userDataTables",
    "bundleDirectories",
    "bundleSentinels",
    "operationalSeedTables",
    "releaseEvidenceRoots",
    "releaseEvidenceGlobs",
    "releaseEvidenceExcludeGlobs",
    "releaseEvidenceStatusFields",
  ])
    requireNonEmptyStringArray(config, field);
  if (config.repositoryContracts.length === 0)
    throw new ConfigurationError("config.repositoryContracts cannot be empty");
  for (const [field, values] of Object.entries(REQUIRED_CONFIG_VALUES))
    requireCanonicalValues(config, field, values);
  if (!config.bundleSentinels.includes(REQUIRED_BUNDLE_SENTINEL)) {
    throw new ConfigurationError(`config.bundleSentinels must include ${REQUIRED_BUNDLE_SENTINEL}`);
  }
  const contractPaths = new Set(
    config.repositoryContracts.map((contract) => normalizeRepoPath(contract && contract.path))
  );
  if (contractPaths.size !== config.repositoryContracts.length)
    throw new ConfigurationError("config.repositoryContracts contains duplicate paths");
  for (const contract of config.repositoryContracts) {
    if (
      !contract ||
      typeof contract.path !== "string" ||
      contract.path.trim() === "" ||
      /[?*\[\]]/.test(contract.path) ||
      contract.path.includes("..")
    ) {
      throw new ConfigurationError("repository contract paths must be exact non-empty paths");
    }
    if (
      !Array.isArray(contract.requiredStrings) ||
      contract.requiredStrings.length === 0 ||
      contract.requiredStrings.some((value) => typeof value !== "string" || value === "")
    ) {
      throw new ConfigurationError(
        `repository contract needs non-empty requiredStrings: ${contract.path}`
      );
    }
    if (
      !Array.isArray(contract.forbiddenStrings) ||
      contract.forbiddenStrings.some((value) => typeof value !== "string" || value === "")
    ) {
      throw new ConfigurationError(
        `repository contract has invalid forbiddenStrings: ${contract.path}`
      );
    }
  }
  for (const required of REQUIRED_REPOSITORY_CONTRACT_PATHS) {
    if (!contractPaths.has(required))
      throw new ConfigurationError(
        `config.repositoryContracts is missing canonical surface: ${required}`
      );
  }
  for (const [field, expectedDigest] of Object.entries(PINNED_CONFIG_DIGESTS)) {
    if (canonicalDigest(config[field]) !== expectedDigest) {
      throw new ConfigurationError(`config.${field} differs from the code-owned semantic contract`);
    }
  }
  if (!config.aliases || typeof config.aliases !== "object" || Array.isArray(config.aliases)) {
    throw new ConfigurationError("config.aliases must be an object");
  }
  for (const field of [
    "domainFields",
    "historySignalFields",
    "timeSignalFields",
    "userDataTables",
    "operationalSeedTables",
  ]) {
    if (config[field].some((value) => !/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(value))) {
      throw new ConfigurationError(`config.${field} accepts identifier-like values only`);
    }
  }
  if (
    !config.limits ||
    !Number.isInteger(config.limits.maxSourceFileBytes) ||
    config.limits.maxSourceFileBytes < 1024
  ) {
    throw new ConfigurationError("config.limits.maxSourceFileBytes must be an integer >= 1024");
  }
  if (
    !Number.isInteger(config.limits.maxBundleFileBytes) ||
    config.limits.maxBundleFileBytes < 1024
  ) {
    throw new ConfigurationError("config.limits.maxBundleFileBytes must be an integer >= 1024");
  }
  if (!Number.isInteger(config.limits.maxFiles) || config.limits.maxFiles < 1) {
    throw new ConfigurationError("config.limits.maxFiles must be a positive integer");
  }
  if (!Number.isInteger(config.limits.maxImportDepth) || config.limits.maxImportDepth < 1) {
    throw new ConfigurationError("config.limits.maxImportDepth must be a positive integer");
  }
  if (
    !Number.isInteger(config.limits.maxEvidenceAgeHours) ||
    config.limits.maxEvidenceAgeHours < 1 ||
    config.limits.maxEvidenceAgeHours > 720
  ) {
    throw new ConfigurationError(
      "config.limits.maxEvidenceAgeHours must be an integer between 1 and 720"
    );
  }
  if (
    !Number.isInteger(config.limits.maxEvidenceFileBytes) ||
    config.limits.maxEvidenceFileBytes < 1024 ||
    config.limits.maxEvidenceFileBytes > 64 * 1024 * 1024
  ) {
    throw new ConfigurationError(
      "config.limits.maxEvidenceFileBytes must be an integer between 1024 and 67108864"
    );
  }
  if (!config.rules || typeof config.rules !== "object")
    throw new ConfigurationError("config.rules must be an object");
  for (const ruleId of RULE_IDS) {
    const actual = config.rules[ruleId];
    const expected = EXPECTED_RULES[ruleId];
    if (
      !actual ||
      actual.name !== expected[0] ||
      actual.severity !== expected[1] ||
      actual.confidence !== expected[2]
    ) {
      throw new ConfigurationError(`${ruleId} contract must remain ${expected.join(" / ")}`);
    }
  }
  const extraRules = Object.keys(config.rules).filter((ruleId) => !RULE_IDS.includes(ruleId));
  if (extraRules.length > 0)
    throw new ConfigurationError(`unknown rule IDs: ${extraRules.join(", ")}`);
  if (
    config.baselineFile !== "config/production-data-integrity-baseline.json" ||
    config.waiversFile !== "config/production-data-integrity-waivers.json"
  ) {
    throw new ConfigurationError(
      "config baselineFile and waiversFile must remain canonical exact paths"
    );
  }
}

function validateBaseline(baseline) {
  if (!baseline || baseline.schemaVersion !== SCHEMA_VERSION || !Array.isArray(baseline.entries)) {
    throw new ConfigurationError("baseline must contain schemaVersion 1.0.0 and entries[]");
  }
  for (const forbidden of ["allowedViolations", "count", "max", "limit"]) {
    if (Object.prototype.hasOwnProperty.call(baseline, forbidden)) {
      throw new ConfigurationError(`broad baseline field is forbidden: ${forbidden}`);
    }
  }
  const keys = new Set();
  for (const entry of baseline.entries) {
    if (
      !entry ||
      !RULE_IDS.includes(entry.ruleId) ||
      entry.ruleId === "PDI010" ||
      typeof entry.path !== "string" ||
      typeof entry.fingerprint !== "string"
    ) {
      throw new ConfigurationError(
        "every baseline entry needs exact ruleId, path, and fingerprint"
      );
    }
    if (/[?*\[\]]/.test(entry.path) || entry.path.includes("..")) {
      throw new ConfigurationError(`baseline path must be exact: ${entry.path}`);
    }
    if (!/^[a-f0-9]{64}$/.test(entry.fingerprint)) {
      throw new ConfigurationError(`baseline fingerprint must be SHA-256: ${entry.path}`);
    }
    if (typeof entry.reason !== "string" || entry.reason.trim().length < 12) {
      throw new ConfigurationError(`baseline reason is missing: ${entry.path}`);
    }
    const key = `${entry.ruleId}|${normalizeRepoPath(entry.path)}|${entry.fingerprint}`;
    if (keys.has(key)) throw new ConfigurationError(`duplicate baseline entry: ${entry.path}`);
    keys.add(key);
  }
}

function parseIsoCalendarDate(value, endOfDay = false) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0
  );
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  )
    return null;
  return parsed;
}

function validateWaivers(waivers, now = new Date()) {
  if (!waivers || waivers.schemaVersion !== SCHEMA_VERSION || !Array.isArray(waivers.waivers)) {
    throw new ConfigurationError("waiver ledger must contain schemaVersion 1.0.0 and waivers[]");
  }
  const ids = new Set();
  for (const waiver of waivers.waivers) {
    const required = [
      "id",
      "ruleId",
      "path",
      "fingerprint",
      "reason",
      "risk",
      "owner",
      "approvedBy",
      "createdAt",
      "expiresAt",
      "trackingIssue",
      "removalCondition",
    ];
    if (
      !waiver ||
      required.some((field) => typeof waiver[field] !== "string" || waiver[field].trim() === "")
    ) {
      throw new ConfigurationError("every waiver must contain all required non-empty fields");
    }
    if (ids.has(waiver.id)) throw new ConfigurationError(`duplicate waiver id: ${waiver.id}`);
    ids.add(waiver.id);
    if (!/^PDI-WAIVER-[A-Z0-9-]+$/.test(waiver.id))
      throw new ConfigurationError(`invalid waiver id: ${waiver.id}`);
    if (!RULE_IDS.includes(waiver.ruleId) || waiver.ruleId === "PDI010")
      throw new ConfigurationError(`invalid waiver rule: ${waiver.ruleId}`);
    if (/[?*\[\]]/.test(waiver.path) || waiver.path.includes(".."))
      throw new ConfigurationError(`waiver path must be exact: ${waiver.path}`);
    if (!/^[a-f0-9]{64}$/.test(waiver.fingerprint))
      throw new ConfigurationError(`waiver fingerprint must be SHA-256: ${waiver.id}`);
    if (
      waiver.reason.trim().length < 20 ||
      waiver.risk.trim().length < 12 ||
      waiver.owner.trim().length < 3 ||
      waiver.approvedBy.trim().length < 3 ||
      waiver.removalCondition.trim().length < 12
    ) {
      throw new ConfigurationError(`waiver rationale/ownership fields are too weak: ${waiver.id}`);
    }
    if (TEST_APPROVER_PATTERN.test(waiver.approvedBy))
      throw new ConfigurationError(`waiver must have a human approver: ${waiver.id}`);
    if (
      /^(none|n\/a|na|unknown)$/i.test(waiver.trackingIssue.trim()) ||
      !/(?:https?:\/\/|#[0-9]+\b|[A-Z][A-Z0-9]+-[0-9]+\b)/.test(waiver.trackingIssue)
    ) {
      throw new ConfigurationError(`waiver needs a concrete tracking issue: ${waiver.id}`);
    }
    const created = parseIsoCalendarDate(waiver.createdAt);
    const expires = parseIsoCalendarDate(waiver.expiresAt, true);
    if (!created || !expires || expires <= created) {
      throw new ConfigurationError(`waiver dates are invalid: ${waiver.id}`);
    }
    if (created.getTime() > now.getTime() + 24 * 60 * 60 * 1000)
      throw new ConfigurationError(`waiver creation is in the future: ${waiver.id}`);
    if (expires.getTime() - created.getTime() > 90 * 24 * 60 * 60 * 1000)
      throw new ConfigurationError(`waiver exceeds the 90-day maximum: ${waiver.id}`);
    if (expires < now) throw new ConfigurationError(`waiver is expired: ${waiver.id}`);
  }
}

function classifyPath(relativePath, config) {
  const normalized = normalizeRepoPath(relativePath);
  if (
    UNCONDITIONALLY_SHIPPED_PREFIXES.some((prefix) => normalized.startsWith(prefix)) ||
    ["vite.config.ts", "capacitor.config.ts", "src/runtime-perf-bootstrap.js"].includes(normalized)
  )
    return "production";
  if (matchesAny(normalized, config.testPathGlobs)) return "test";
  if (matchesAny(normalized, config.devPathGlobs)) return "dev";
  if (matchesAny(normalized, config.generatedPathGlobs)) return "generated";
  if (matchesAny(normalized, config.documentationPathGlobs)) return "documentation";
  if (matchesAny(normalized, config.enforcementPathGlobs)) return "enforcement";
  if (matchesAny(normalized, config.productionPathGlobs)) return "production";
  return "unclassified";
}

function excludedByGlobs(relativePath, globs) {
  const normalized = normalizeRepoPath(relativePath);
  return globs.some((glob) => {
    const normalizedGlob = normalizeRepoPath(glob);
    const prefix = /^([^*?\[\]]+)\/\*\*$/.exec(normalizedGlob)?.[1];
    return (
      matchesGlob(normalized, normalizedGlob) ||
      (prefix && (normalized === prefix || normalized.startsWith(`${prefix}/`)))
    );
  });
}

function isConfiguredBundlePath(relativePath, config) {
  const normalized = normalizeRepoPath(relativePath);
  return config.bundleDirectories.some((directory) => {
    const bundleRoot = normalizeRepoPath(directory);
    return normalized === bundleRoot || normalized.startsWith(`${bundleRoot}/`);
  });
}

function assertNoDuplicateArtifactOrdinal(relativePath) {
  const normalized = normalizeRepoPath(relativePath);
  const duplicateComponent = normalized.split("/").find(hasDuplicateArtifactOrdinal);
  if (duplicateComponent) {
    throw new ConfigurationError(
      `duplicate generated artifact path is not allowed in a production bundle: ${normalized}`
    );
  }
}

function assertBundleRootUsesNfc(directory) {
  if (
    typeof directory !== "string" ||
    directory.split(/[\\/]/).some((component) => component !== component.normalize("NFC"))
  ) {
    throw new ConfigurationError("bundle root must use NFC normalization");
  }
}

function walkFiles(root, relativeRoot, config, result, visitedDirectories) {
  if (isConfiguredBundlePath(relativeRoot, config)) assertNoDuplicateArtifactOrdinal(relativeRoot);
  if (excludedByGlobs(relativeRoot, config.scanExcludeGlobs)) return;
  const target = resolveInsideRoot(root, relativeRoot);
  if (!fs.existsSync(target)) return;
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink())
    throw new ConfigurationError(`symlink is not allowed in scan scope: ${relativeRoot}`);
  if (stat.isFile()) {
    result.add(normalizeRepoPath(relativeRoot));
    if (result.size > config.limits.maxFiles)
      throw new ConfigurationError(`scan exceeds maxFiles=${config.limits.maxFiles}`);
    return;
  }
  if (!stat.isDirectory()) return;
  const real = fs.realpathSync(target);
  if (!isInsideRoot(root, real))
    throw new ConfigurationError(`scan directory escapes repository root: ${relativeRoot}`);
  if (visitedDirectories.has(real)) return;
  visitedDirectories.add(real);
  const ignored = new Set([".git", "node_modules", "build", ".turbo", ".vite"]);
  const entries = fs
    .readdirSync(target, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    walkFiles(
      root,
      normalizeRepoPath(path.posix.join(normalizeRepoPath(relativeRoot), entry.name)),
      config,
      result,
      visitedDirectories
    );
  }
}

function enumerateFiles(root, config) {
  const result = new Set();
  const visited = new Set();
  for (const scanRoot of config.scanRoots) walkFiles(root, scanRoot, config, result, visited);
  for (const entrypoint of config.entrypoints) {
    if (!/[?*\[]/.test(entrypoint)) walkFiles(root, entrypoint, config, result, visited);
  }
  return [...result].sort();
}

function excludedEvidencePath(relativePath, config) {
  return excludedByGlobs(relativePath, config.releaseEvidenceExcludeGlobs);
}

function walkEvidenceFiles(root, relativeRoot, config, result, visitedDirectories) {
  if (excludedEvidencePath(relativeRoot, config)) return;
  const target = resolveInsideRoot(root, relativeRoot);
  if (!fs.existsSync(target)) return;
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink())
    throw new ConfigurationError(`symlink is not allowed in evidence scope: ${relativeRoot}`);
  if (stat.isFile()) {
    if (
      path.extname(relativeRoot).toLowerCase() === ".json" &&
      matchesAny(relativeRoot, config.releaseEvidenceGlobs)
    ) {
      result.add(normalizeRepoPath(relativeRoot));
      if (result.size > config.limits.maxFiles)
        throw new ConfigurationError(`evidence scan exceeds maxFiles=${config.limits.maxFiles}`);
    }
    return;
  }
  if (!stat.isDirectory()) return;
  const real = fs.realpathSync(target);
  if (!isInsideRoot(root, real))
    throw new ConfigurationError(`evidence directory escapes repository root: ${relativeRoot}`);
  if (visitedDirectories.has(real)) return;
  visitedDirectories.add(real);
  const ignored = new Set([".git", "node_modules", "build", ".turbo", ".vite"]);
  const entries = fs
    .readdirSync(target, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    walkEvidenceFiles(
      root,
      normalizeRepoPath(path.posix.join(normalizeRepoPath(relativeRoot), entry.name)),
      config,
      result,
      visitedDirectories
    );
  }
}

function enumerateEvidenceFiles(root, config) {
  const result = new Set();
  const visited = new Set();
  for (const evidenceRoot of config.releaseEvidenceRoots) {
    if (normalizeRepoPath(evidenceRoot) !== "output") {
      walkEvidenceFiles(root, evidenceRoot, config, result, visited);
      continue;
    }
    const outputTarget = resolveInsideRoot(root, "output");
    if (!fs.existsSync(outputTarget)) continue;
    const outputStat = fs.lstatSync(outputTarget);
    if (outputStat.isSymbolicLink())
      throw new ConfigurationError("symlink is not allowed in evidence scope: output");
    if (!outputStat.isDirectory())
      throw new ConfigurationError("evidence root must be a directory: output");
    assertExistingRealpathInsideRoot(root, outputTarget, "evidence root output");
    for (const entry of fs
      .readdirSync(outputTarget, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const relativePath = normalizeRepoPath(path.posix.join("output", entry.name));
      if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".json") {
        walkEvidenceFiles(root, relativePath, config, result, visited);
      } else if (entry.isDirectory() && entry.name === "release") {
        walkEvidenceFiles(root, relativePath, config, result, visited);
      } else if (entry.isDirectory() && !excludedEvidencePath(relativePath, config)) {
        const directoryTarget = resolveInsideRoot(root, relativePath);
        assertExistingRealpathInsideRoot(
          root,
          directoryTarget,
          `evidence directory ${relativePath}`
        );
        const directEntries = fs
          .readdirSync(directoryTarget, { withFileTypes: true })
          .sort((left, right) => left.name.localeCompare(right.name));
        for (const directEntry of directEntries) {
          const candidate = normalizeRepoPath(path.posix.join(relativePath, directEntry.name));
          if (
            (directEntry.isFile() || directEntry.isSymbolicLink()) &&
            path.extname(directEntry.name).toLowerCase() === ".json" &&
            matchesAny(candidate, config.releaseEvidenceGlobs)
          )
            walkEvidenceFiles(root, candidate, config, result, visited);
        }
      }
    }
  }
  return [...result].sort();
}

function readText(root, relativePath, maxBytes) {
  const target = resolveInsideRoot(root, relativePath);
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink())
    throw new ConfigurationError(`symlink is not allowed: ${relativePath}`);
  if (!stat.isFile()) throw new ConfigurationError(`expected file: ${relativePath}`);
  assertExistingRealpathInsideRoot(root, target, `source file ${relativePath}`);
  if (stat.size > maxBytes)
    throw new ConfigurationError(
      `file exceeds byte limit (${stat.size} > ${maxBytes}): ${relativePath}`
    );
  const buffer = fs.readFileSync(target);
  if (buffer.includes(0)) return null;
  return decodeUtf8(buffer, `source file ${relativePath}`);
}

function scriptKindFor(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".tsx":
      return ts.ScriptKind.TSX;
    case ".jsx":
      return ts.ScriptKind.JSX;
    case ".js":
    case ".mjs":
    case ".cjs":
      return ts.ScriptKind.JS;
    default:
      return ts.ScriptKind.TS;
  }
}

function isStringLiteralLike(node) {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

function parseSourceFile(relativePath, text) {
  const sourceFile = ts.createSourceFile(
    relativePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(relativePath)
  );
  if (sourceFile.parseDiagnostics.length > 0) {
    const diagnostic = sourceFile.parseDiagnostics[0];
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
    throw new ConfigurationError(
      `TypeScript parse error TS${diagnostic.code} in ${relativePath}: ${message}`
    );
  }
  return sourceFile;
}

function unwrapParentheses(node) {
  let current = node;
  while (current && ts.isParenthesizedExpression(current)) current = current.expression;
  return current;
}

function isImportMetaDevExpression(node, sourceFile) {
  const current = unwrapParentheses(node);
  if (!current) return false;
  return /^import\.meta\.env(?:\?\.)?\.DEV$|^import\.meta\.env\[\s*["']DEV["']\s*\]$/.test(
    current.getText(sourceFile).replace(/\s+/g, "")
  );
}

function isPositiveDevCondition(node, sourceFile) {
  const current = unwrapParentheses(node);
  if (!current) return false;
  if (isImportMetaDevExpression(current, sourceFile)) return true;
  if (ts.isBinaryExpression(current)) {
    if (current.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      return (
        isPositiveDevCondition(current.left, sourceFile) ||
        isPositiveDevCondition(current.right, sourceFile)
      );
    }
    const operator = current.operatorToken.kind;
    const leftDev = isImportMetaDevExpression(current.left, sourceFile);
    const rightDev = isImportMetaDevExpression(current.right, sourceFile);
    const other = leftDev
      ? unwrapParentheses(current.right)
      : rightDev
        ? unwrapParentheses(current.left)
        : null;
    const otherTrue = other && other.kind === ts.SyntaxKind.TrueKeyword;
    const otherFalse = other && other.kind === ts.SyntaxKind.FalseKeyword;
    if (
      otherTrue &&
      [ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken].includes(operator)
    )
      return true;
    if (
      otherFalse &&
      [ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(
        operator
      )
    )
      return true;
  }
  return false;
}

function isDevGuarded(node, sourceFile) {
  let current = node;
  while (current && current.parent) {
    const parent = current.parent;
    if (
      ts.isConditionalExpression(parent) &&
      parent.whenTrue === current &&
      isPositiveDevCondition(parent.condition, sourceFile)
    )
      return true;
    if (
      ts.isIfStatement(parent) &&
      parent.thenStatement === current &&
      isPositiveDevCondition(parent.expression, sourceFile)
    )
      return true;
    if (
      ts.isBinaryExpression(parent) &&
      parent.right === current &&
      parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
      isPositiveDevCondition(parent.left, sourceFile)
    )
      return true;
    current = parent;
  }
  return false;
}

function expandBracePatterns(pattern, limit = 32) {
  const match = /\{([^{}]+)\}/.exec(pattern);
  if (!match) return [pattern];
  const options = match[1].split(",").filter(Boolean);
  if (options.length < 2) return [pattern];
  const expanded = [];
  for (const option of options) {
    const next = `${pattern.slice(0, match.index)}${option}${pattern.slice(match.index + match[0].length)}`;
    expanded.push(...expandBracePatterns(next, limit));
    if (expanded.length > limit)
      throw new ConfigurationError(`import.meta.glob brace expansion exceeds ${limit} patterns`);
  }
  return expanded;
}

function collectModuleEdges(relativePath, sourceFile, allFiles, config) {
  const edges = [];
  const warnings = [];
  const add = (specifier, node, kind) => {
    if (!specifier) return;
    edges.push({ specifier, node, kind, devOnly: isDevGuarded(node, sourceFile) });
  };
  const visit = (node) => {
    if (
      ts.isImportDeclaration(node) &&
      node.moduleSpecifier &&
      isStringLiteralLike(node.moduleSpecifier)
    ) {
      const clause = node.importClause;
      const named =
        clause && clause.namedBindings && ts.isNamedImports(clause.namedBindings)
          ? clause.namedBindings.elements
          : [];
      const allNamedTypeOnly =
        !clause?.name && named.length > 0 && named.every((element) => element.isTypeOnly);
      if (!(clause && (clause.isTypeOnly || allNamedTypeOnly)))
        add(node.moduleSpecifier.text, node, "import");
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      isStringLiteralLike(node.moduleSpecifier)
    ) {
      const named =
        node.exportClause && ts.isNamedExports(node.exportClause) ? node.exportClause.elements : [];
      const allNamedTypeOnly = named.length > 0 && named.every((element) => element.isTypeOnly);
      if (!(node.isTypeOnly || allNamedTypeOnly)) add(node.moduleSpecifier.text, node, "re-export");
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      !node.isTypeOnly &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      isStringLiteralLike(node.moduleReference.expression)
    ) {
      add(node.moduleReference.expression.text, node, "import-equals");
    } else if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const argument = node.arguments[0];
        if (argument && isStringLiteralLike(argument)) add(argument.text, node, "dynamic-import");
        else if (!config.auditedNonLiteralDynamicImports.includes(relativePath))
          warnings.push({ node, reason: "non-literal dynamic import is not audited" });
      } else if (ts.isIdentifier(node.expression) && node.expression.text === "require") {
        const argument = node.arguments[0];
        if (argument && isStringLiteralLike(argument)) add(argument.text, node, "require");
      } else {
        const expressionText = node.expression.getText(sourceFile);
        if (/import\.meta\.glob(?:Eager)?$/.test(expressionText)) {
          const argument = node.arguments[0];
          const patterns =
            argument && ts.isArrayLiteralExpression(argument)
              ? argument.elements.filter(isStringLiteralLike).map((element) => element.text)
              : argument && isStringLiteralLike(argument)
                ? [argument.text]
                : [];
          if (patterns.length === 0)
            warnings.push({ node, reason: "non-literal import.meta.glob pattern is unresolved" });
          for (const pattern of patterns.flatMap((candidate) => expandBracePatterns(candidate))) {
            const joined = normalizeRepoPath(
              path.posix.join(path.posix.dirname(relativePath), pattern)
            );
            for (const candidate of allFiles)
              if (matchesGlob(candidate, joined))
                edges.push({
                  specifier: candidate,
                  node,
                  kind: "vite-glob-resolved",
                  resolved: candidate,
                  devOnly: isDevGuarded(node, sourceFile),
                });
          }
        }
      }
    } else if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
      if (node.expression.text === "URL") {
        const urlArg = node.arguments && node.arguments[0];
        const baseArg = node.arguments && node.arguments[1];
        if (
          urlArg &&
          isStringLiteralLike(urlArg) &&
          baseArg &&
          /^import\.meta\.url$/.test(baseArg.getText(sourceFile).replace(/\s+/g, ""))
        ) {
          add(urlArg.text, node, "static-asset-url");
        }
      } else if (["Worker", "SharedWorker"].includes(node.expression.text)) {
        const first = node.arguments && node.arguments[0];
        if (
          first &&
          ts.isNewExpression(first) &&
          ts.isIdentifier(first.expression) &&
          first.expression.text === "URL"
        ) {
          const urlArg = first.arguments && first.arguments[0];
          if (urlArg && isStringLiteralLike(urlArg)) add(urlArg.text, node, "worker-url");
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return { edges, warnings };
}

function resolveModule(root, importer, specifier, config) {
  const clean = String(specifier).replace(/[?#].*$/, "");
  if (/^(?:node:|npm:|jsr:|https?:|data:|virtual:)/.test(clean)) return { external: true };
  let base;
  const alias = Object.entries(config.aliases).find(
    ([prefix]) => clean === prefix || clean.startsWith(`${prefix}/`)
  );
  if (alias) {
    base = path.resolve(root, alias[1], clean === alias[0] ? "" : clean.slice(alias[0].length + 1));
  } else if (clean.startsWith(".")) {
    base = path.resolve(root, path.dirname(importer), clean);
  } else if (clean.startsWith("/")) {
    base = path.resolve(root, clean.replace(/^\/+/, ""));
  } else {
    return { external: true };
  }
  if (!isInsideRoot(root, base)) return { escaped: true };
  const extensions = ["", ...config.sourceExtensions];
  const candidates = [];
  for (const extension of extensions) candidates.push(`${base}${extension}`);
  for (const extension of config.sourceExtensions)
    candidates.push(path.join(base, `index${extension}`));
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const stat = fs.lstatSync(candidate);
    if (stat.isSymbolicLink()) return { symlink: true };
    if (stat.isFile()) {
      const real = assertExistingRealpathInsideRoot(root, candidate, `import target ${candidate}`);
      return { path: normalizeRepoPath(path.relative(root, real)) };
    }
  }
  return { unresolved: true };
}

function buildReachability(root, files, config) {
  const allFiles = new Set(files);
  const entrypoints = [];
  for (const pattern of config.entrypoints) {
    if (/[?*\[]/.test(pattern)) {
      for (const file of files) if (matchesGlob(file, pattern)) entrypoints.push(file);
    } else if (fs.existsSync(resolveInsideRoot(root, pattern))) {
      entrypoints.push(normalizeRepoPath(pattern));
      allFiles.add(normalizeRepoPath(pattern));
    }
  }
  const reachable = new Set();
  const parents = new Map();
  const unresolved = [];
  const queue = [...new Set(entrypoints)].sort().map((file) => ({ file, depth: 0 }));
  while (queue.length > 0) {
    const { file, depth } = queue.shift();
    if (reachable.has(file)) continue;
    if (depth > config.limits.maxImportDepth)
      throw new ConfigurationError(`import graph exceeds maxImportDepth at ${file}`);
    reachable.add(file);
    if (!AST_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
    const text = readText(root, file, config.limits.maxSourceFileBytes);
    if (text === null) throw new ConfigurationError(`source file appears binary: ${file}`);
    const sourceFile = parseSourceFile(file, text);
    const parsed = collectModuleEdges(file, sourceFile, [...allFiles], config);
    for (const warning of parsed.warnings)
      unresolved.push({ file, node: warning.node, sourceFile, reason: warning.reason });
    for (const edge of parsed.edges) {
      if (edge.devOnly) continue;
      const resolution = edge.resolved
        ? { path: edge.resolved }
        : resolveModule(root, file, edge.specifier, config);
      if (resolution.external) continue;
      if (resolution.escaped || resolution.symlink)
        throw new ConfigurationError(`unsafe import from ${file}: ${edge.specifier}`);
      if (resolution.unresolved) {
        unresolved.push({
          file,
          node: edge.node,
          sourceFile,
          reason: `unresolved local ${edge.kind}: ${edge.specifier}`,
        });
        continue;
      }
      allFiles.add(resolution.path);
      if (!parents.has(resolution.path))
        parents.set(resolution.path, { parent: file, kind: edge.kind });
      if (!reachable.has(resolution.path)) queue.push({ file: resolution.path, depth: depth + 1 });
    }
  }
  return {
    entrypoints: [...new Set(entrypoints)].sort(),
    reachable,
    parents,
    unresolved,
    allFiles: [...allFiles].sort(),
  };
}

function propertyName(node) {
  if (!node) return "";
  if (
    ts.isIdentifier(node) ||
    ts.isPrivateIdentifier(node) ||
    ts.isStringLiteral(node) ||
    ts.isNumericLiteral(node)
  )
    return String(node.text);
  return "";
}

function resolveConstInitializer(identifier, sourceFile) {
  if (!sourceFile || !ts.isIdentifier(identifier)) return identifier;
  let candidate = null;
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === identifier.text &&
      node.initializer &&
      node.pos < identifier.pos &&
      ts.isVariableDeclarationList(node.parent) &&
      (node.parent.flags & ts.NodeFlags.Const) !== 0 &&
      (!candidate || node.pos > candidate.pos)
    )
      candidate = node;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return candidate ? candidate.initializer : identifier;
}

function propertyValue(property, sourceFile) {
  if (ts.isPropertyAssignment(property)) return property.initializer;
  if (ts.isShorthandPropertyAssignment(property))
    return resolveConstInitializer(property.name, sourceFile);
  return null;
}

function stringLiteralValue(node) {
  return isStringLiteralLike(node) ? node.text : null;
}

function objectInfo(node, sourceFile, config, syntheticVariables, syntheticFunctions, depth = 0) {
  if (!ts.isObjectLiteralExpression(node) || depth > 8) return null;
  const fields = [];
  let hardcodedHistory = false;
  let generatedIdentityOrTime = false;
  let literalIdentity = false;
  let literalTime = false;
  let marker = false;
  let spreadSynthetic = false;
  const historyFields = new Set(config.historySignalFields.map((field) => field.toLowerCase()));
  const timeFields = new Set(config.timeSignalFields.map((field) => field.toLowerCase()));
  const domainFields = new Set(config.domainFields.map((field) => field.toLowerCase()));
  for (const property of node.properties) {
    if (ts.isSpreadAssignment(property)) {
      if (
        isSyntheticExpression(
          property.expression,
          sourceFile,
          config,
          syntheticVariables,
          syntheticFunctions,
          depth + 1
        )
      )
        spreadSynthetic = true;
      continue;
    }
    const name = propertyName(property.name);
    if (!name) continue;
    fields.push(name);
    const lower = name.toLowerCase();
    const value = propertyValue(property, sourceFile);
    const literal = value && stringLiteralValue(value);
    const nonEmptyContainer =
      value &&
      ((ts.isObjectLiteralExpression(value) && value.properties.length > 0) ||
        (ts.isArrayLiteralExpression(value) && value.elements.length > 0));
    if (
      historyFields.has(lower) &&
      ((literal && literal.trim().length >= 2) ||
        (value && ts.isNumericLiteral(value)) ||
        nonEmptyContainer)
    )
      hardcodedHistory = true;
    if (lower === "id" && literal && literal.trim().length >= 2) literalIdentity = true;
    if (timeFields.has(lower) && value && (literal !== null || ts.isNumericLiteral(value)))
      literalTime = true;
    if ((lower === "id" || timeFields.has(lower)) && value) {
      const text = value.getText(sourceFile);
      if (/randomUUID|Math\.random|Date\.now|new\s+Date|toISOString/.test(text))
        generatedIdentityOrTime = true;
      if (
        literal &&
        config.syntheticMarkers.some((candidate) =>
          literal.toLowerCase().includes(candidate.toLowerCase())
        )
      )
        marker = true;
    }
  }
  const domainCount = fields.filter((field) => domainFields.has(field.toLowerCase())).length;
  const hasHistory = fields.some((field) => historyFields.has(field.toLowerCase()));
  const hasTime = fields.some((field) => timeFields.has(field.toLowerCase()));
  const synthetic =
    spreadSynthetic ||
    (domainCount >= 4 &&
      hasHistory &&
      hasTime &&
      (hardcodedHistory || marker) &&
      (generatedIdentityOrTime || (literalIdentity && literalTime)));
  return {
    synthetic,
    fields: [...new Set(fields)].sort(),
    domainCount,
    hardcodedHistory,
    generatedIdentityOrTime,
    literalIdentity,
    literalTime,
    marker,
    spreadSynthetic,
  };
}

function isSyntheticExpression(
  node,
  sourceFile,
  config,
  syntheticVariables,
  syntheticFunctions,
  depth = 0
) {
  if (!node || depth > 12) return false;
  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isNonNullExpression(node) ||
    ts.isSatisfiesExpression(node)
  ) {
    return isSyntheticExpression(
      node.expression,
      sourceFile,
      config,
      syntheticVariables,
      syntheticFunctions,
      depth + 1
    );
  }
  if (ts.isObjectLiteralExpression(node))
    return Boolean(
      objectInfo(node, sourceFile, config, syntheticVariables, syntheticFunctions, depth + 1)
        ?.synthetic
    );
  if (ts.isArrayLiteralExpression(node))
    return node.elements.some((element) =>
      isSyntheticExpression(
        element,
        sourceFile,
        config,
        syntheticVariables,
        syntheticFunctions,
        depth + 1
      )
    );
  if (ts.isIdentifier(node)) return syntheticVariables.has(node.text);
  if (ts.isCallExpression(node)) {
    if (ts.isIdentifier(node.expression) && syntheticFunctions.has(node.expression.text))
      return true;
    return false;
  }
  if (ts.isConditionalExpression(node)) {
    return (
      isSyntheticExpression(
        node.whenTrue,
        sourceFile,
        config,
        syntheticVariables,
        syntheticFunctions,
        depth + 1
      ) ||
      isSyntheticExpression(
        node.whenFalse,
        sourceFile,
        config,
        syntheticVariables,
        syntheticFunctions,
        depth + 1
      )
    );
  }
  if (
    ts.isBinaryExpression(node) &&
    [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(
      node.operatorToken.kind
    )
  ) {
    return (
      isSyntheticExpression(
        node.left,
        sourceFile,
        config,
        syntheticVariables,
        syntheticFunctions,
        depth + 1
      ) ||
      isSyntheticExpression(
        node.right,
        sourceFile,
        config,
        syntheticVariables,
        syntheticFunctions,
        depth + 1
      )
    );
  }
  return false;
}

function collectReturns(node) {
  const returns = [];
  const visit = (current) => {
    if (
      current !== node &&
      (ts.isFunctionDeclaration(current) ||
        ts.isFunctionExpression(current) ||
        ts.isArrowFunction(current) ||
        ts.isMethodDeclaration(current))
    )
      return;
    if (ts.isReturnStatement(current) && current.expression) returns.push(current.expression);
    ts.forEachChild(current, visit);
  };
  if (ts.isArrowFunction(node) && !ts.isBlock(node.body)) returns.push(node.body);
  else if (node.body) visit(node.body);
  return returns;
}

function buildSyntheticIndex(sourceFile, config) {
  const variables = new Set();
  const functions = new Set();
  const variableDeclarations = [];
  const functionDeclarations = [];
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      variableDeclarations.push(node);
      if (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) {
        functionDeclarations.push({ name: node.name.text, node: node.initializer });
      }
    }
    if (ts.isFunctionDeclaration(node) && node.name)
      functionDeclarations.push({ name: node.name.text, node });
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  for (let iteration = 0; iteration < 6; iteration += 1) {
    let changed = false;
    for (const declaration of variableDeclarations) {
      if (
        !variables.has(declaration.name.text) &&
        isSyntheticExpression(declaration.initializer, sourceFile, config, variables, functions)
      ) {
        variables.add(declaration.name.text);
        changed = true;
      }
    }
    for (const declaration of functionDeclarations) {
      if (
        !functions.has(declaration.name) &&
        collectReturns(declaration.node).some((expression) =>
          isSyntheticExpression(expression, sourceFile, config, variables, functions)
        )
      ) {
        functions.add(declaration.name);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const sources = [];
  for (const declaration of variableDeclarations)
    if (variables.has(declaration.name.text)) sources.push(declaration.initializer);
  for (const declaration of functionDeclarations) {
    if (!functions.has(declaration.name)) continue;
    for (const expression of collectReturns(declaration.node))
      if (isSyntheticExpression(expression, sourceFile, config, variables, functions))
        sources.push(expression);
  }
  return { variables, functions, sources };
}

function isFailureContext(node, sourceFile) {
  let current = node;
  while (current && current.parent) {
    const parent = current.parent;
    if (ts.isCatchClause(parent)) return true;
    if (
      ts.isCallExpression(parent) &&
      ts.isPropertyAccessExpression(parent.expression) &&
      parent.expression.name.text === "catch"
    )
      return true;
    if (
      ts.isConditionalExpression(parent) &&
      /error|fail|offline|unavailable/i.test(parent.condition.getText(sourceFile))
    )
      return true;
    current = parent;
  }
  return false;
}

function functionNameFor(node) {
  let current = node;
  while (current) {
    if ((ts.isFunctionDeclaration(current) || ts.isMethodDeclaration(current)) && current.name)
      return propertyName(current.name);
    if (
      (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) &&
      ts.isVariableDeclaration(current.parent) &&
      ts.isIdentifier(current.parent.name)
    )
      return current.parent.name.text;
    current = current.parent;
  }
  return "";
}

function isDeceptiveHealthyFallback(node, sourceFile) {
  if (!ts.isObjectLiteralExpression(node) || !isFailureContext(node, sourceFile)) return false;
  const text = node.getText(sourceFile);
  const positiveAuthority =
    /(?:status|state|result)\s*:\s*["'](?:verified|healthy|consistent|ready|pass|success)["']/i.test(
      text
    ) || /(?:verified|healthy|consistent|ready|success)\s*:\s*true\b/i.test(text);
  const countEvidence =
    /(?:localCounts|remoteCounts|counts|divergence)/.test(text) && /:\s*0\b/.test(text);
  return positiveAuthority && countEvidence;
}

function normalizedFragment(text) {
  return normalizeNewlines(text)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "")
    .replace(/(['"`])(?:\\.|(?!\1)[\s\S])*?\1|\b[A-Za-z_$][\w$]*\b/g, (match, quote) =>
      quote ? match : "<identifier>"
    )
    .replace(/\s+/g, " ")
    .trim();
}

function structuralNodeSignature(node, sourceFile) {
  if (!node || !sourceFile) return "no-node";
  if (ts.isObjectLiteralExpression(node)) {
    const fields = node.properties
      .map((property) => propertyName(property.name))
      .filter(Boolean)
      .sort();
    return `object:${fields.join(",")}`;
  }
  if (ts.isArrayLiteralExpression(node))
    return `array:${node.elements.map((element) => ts.SyntaxKind[element.kind]).join(",")}`;
  if (ts.isCallExpression(node)) {
    const callee = node.expression
      .getText(sourceFile)
      .split(".")
      .pop()
      .replace(/[^A-Za-z0-9_$]/g, "");
    return `call:${callee}:${node.arguments.length}`;
  }
  return ts.SyntaxKind[node.kind] || "unknown";
}

function nodeLocation(node, sourceFile) {
  if (!node || !sourceFile) return { line: 1, column: 1 };
  const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return { line: location.line + 1, column: location.character + 1 };
}

function makeFinding(config, options) {
  const metadata = config.rules[options.ruleId];
  const location = options.location || nodeLocation(options.node, options.sourceFile);
  const fragment =
    options.fragment ||
    (options.node && options.sourceFile
      ? options.node.getText(options.sourceFile)
      : options.message);
  const structuralSignature =
    options.structuralSignature || structuralNodeSignature(options.node, options.sourceFile);
  const fragmentHash = sha256(normalizedFragment(fragment));
  const normalizedPath = normalizeRepoPath(options.path);
  const fingerprint = sha256(
    [
      options.ruleId,
      normalizedPath,
      structuralSignature,
      options.source || "unknown",
      options.sink || "none",
      fragmentHash,
    ].join("|")
  );
  return {
    ruleId: options.ruleId,
    ruleName: metadata.name,
    severity: metadata.severity,
    confidence: metadata.confidence,
    path: normalizedPath,
    line: location.line,
    column: location.column,
    message: options.message,
    evidence: options.evidence || structuralSignature,
    source: options.source || "unknown",
    sink: options.sink || "none",
    reachabilityReason: options.reachabilityReason || "production path classification",
    remediation: options.remediation,
    structuralSignature,
    fragmentHash,
    fingerprint,
    baselined: false,
    waived: false,
  };
}

function traceReachability(file, graph) {
  const trace = [file];
  let current = file;
  const seen = new Set(trace);
  while (graph.parents.has(current)) {
    current = graph.parents.get(current).parent;
    if (seen.has(current)) break;
    trace.push(current);
    seen.add(current);
  }
  return trace.reverse();
}

function analyzeAstFile(root, relativePath, config, findings, reachabilityReason, reportPath) {
  if (!reportPath(relativePath)) return;
  const text = readText(root, relativePath, config.limits.maxSourceFileBytes);
  if (text === null) throw new ConfigurationError(`source file appears binary: ${relativePath}`);
  const sourceFile = parseSourceFile(relativePath, text);
  const synthetic = buildSyntheticIndex(sourceFile, config);
  const add = (options) =>
    findings.push(
      makeFinding(config, { path: relativePath, sourceFile, reachabilityReason, ...options })
    );
  const sourceSet = new Set(synthetic.sources);

  for (const sourceNode of synthetic.sources) {
    const info = ts.isObjectLiteralExpression(sourceNode)
      ? objectInfo(sourceNode, sourceFile, config, synthetic.variables, synthetic.functions)
      : null;
    add({
      ruleId: "PDI002",
      node: sourceNode,
      message: "Production-reachable code constructs plausible synthetic user history.",
      evidence: info
        ? `domain fields: ${info.fields.join(", ")}`
        : "synthetic record factory or collection",
      source: "hardcoded-or-generated-domain-record",
      remediation:
        "Remove the synthetic record, move it to an isolated test fixture, or implement the documented demo-mode isolation contract.",
    });
    if (isFailureContext(sourceNode, sourceFile)) {
      add({
        ruleId: "PDI003",
        node: sourceNode,
        message:
          "Failure handling returns plausible synthetic data instead of preserving the error state.",
        evidence: "synthetic domain record inside catch/error fallback",
        source: "error-fallback",
        sink: "production-return-value",
        remediation:
          "Return an honest empty/error state, log safely, and surface retry or recovery without invented records.",
      });
    }
  }

  const visit = (node) => {
    if (
      ts.isReturnStatement(node) &&
      node.expression &&
      isSyntheticExpression(
        node.expression,
        sourceFile,
        config,
        synthetic.variables,
        synthetic.functions
      ) &&
      isFailureContext(node, sourceFile)
    ) {
      if (!sourceSet.has(node.expression)) {
        add({
          ruleId: "PDI003",
          node,
          message:
            "Failure handling returns plausible synthetic data instead of preserving the error state.",
          evidence: "synthetic identifier/factory returned from failure branch",
          source: "error-fallback",
          sink: "production-return-value",
          remediation:
            "Return an honest empty/error state, log safely, and surface retry or recovery without invented records.",
        });
      }
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(sourceFile);
      const lastName = callee.match(/([A-Za-z_$][\w$]*)\s*$/)?.[1] || callee;
      const carriesSynthetic = node.arguments.some((argument) =>
        isSyntheticExpression(
          argument,
          sourceFile,
          config,
          synthetic.variables,
          synthetic.functions
        )
      );
      if (lastName === "catch") {
        const callback = node.arguments[0];
        const fallbackExpressions =
          callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))
            ? collectReturns(callback)
            : [];
        for (const fallback of fallbackExpressions) {
          if (
            !isSyntheticExpression(
              fallback,
              sourceFile,
              config,
              synthetic.variables,
              synthetic.functions
            )
          )
            continue;
          add({
            ruleId: "PDI003",
            node: fallback,
            message:
              "Promise rejection handling returns plausible synthetic data instead of preserving the error state.",
            evidence: "synthetic domain record returned by Promise.catch",
            source: "promise-error-fallback",
            sink: "production-return-value",
            remediation:
              "Return an honest empty/error state, log safely, and surface retry or recovery without invented records.",
          });
        }
      }
      if (carriesSynthetic && config.persistenceSinkNames.includes(lastName)) {
        add({
          ruleId: "PDI004",
          node,
          message: "Synthetic user-like data reaches a persistence, queue, backup, or sync sink.",
          evidence: `synthetic argument to persistence method ${lastName}`,
          source: "synthetic-domain-record",
          sink: lastName,
          remediation:
            "Remove the source or enforce an isolated, non-syncing demo namespace before this sink.",
        });
      }
      const externalMarker = config.externalSinkMarkers.find((marker) =>
        callee.toLowerCase().includes(marker.toLowerCase())
      );
      if (carriesSynthetic && externalMarker) {
        add({
          ruleId: "PDI007",
          node,
          message:
            "Synthetic user-like data reaches analytics, export, backup, download, or share output.",
          evidence: `synthetic argument to external-output marker ${externalMarker}`,
          source: "synthetic-domain-record",
          sink: externalMarker,
          remediation:
            "Exclude synthetic records or add the explicit demo marker/isolation required by policy.",
        });
      }
      if (/storageSetRaw|setItem/.test(lastName)) {
        const key =
          node.arguments[0] && isStringLiteralLike(node.arguments[0]) ? node.arguments[0].text : "";
        const rawValue = node.arguments[1]
          ? unwrapParentheses(resolveConstInitializer(node.arguments[1], sourceFile))
          : null;
        const enabled = Boolean(
          rawValue &&
          (rawValue.kind === ts.SyntaxKind.TrueKeyword ||
            (ts.isNumericLiteral(rawValue) && Number(rawValue.text) === 1) ||
            (isStringLiteralLike(rawValue) &&
              /^(?:true|1|on|enabled|demo|sample)$/i.test(rawValue.text.trim())))
        );
        if (/demo|sample/i.test(key) && enabled && !isDevGuarded(node, sourceFile)) {
          add({
            ruleId: "PDI006",
            node,
            message:
              "Production code persists a demo/sample mode without an isolated production contract.",
            evidence:
              "demo marker written to persistent storage outside an import.meta.env.DEV guard",
            source: "production-demo-toggle",
            sink: lastName,
            remediation:
              "Remove the toggle or implement explicit opt-in, visible labeling, separate namespace, no sync/analytics, reset, and tests.",
          });
        }
      }
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      /demo|sample/i.test(node.name.text) &&
      node.initializer
    ) {
      const initializer = node.initializer.getText(sourceFile);
      if (
        /^(?:true|[^\n]*(?:\|\||\?\?)[^\n]*true)$/.test(initializer.replace(/\s+/g, "")) &&
        !isDevGuarded(node, sourceFile)
      ) {
        add({
          ruleId: "PDI006",
          node,
          message: "Demo/sample mode is enabled by default in production-reachable code.",
          evidence: "demo-named control has a true production default",
          source: "production-demo-default",
          sink: "runtime-mode-selection",
          remediation:
            "Default production to off and require the complete documented demo-mode contract.",
        });
      }
    }
    if (ts.isObjectLiteralExpression(node)) {
      const properties = new Map();
      for (const property of node.properties) {
        const name = propertyName(property.name);
        const value = propertyValue(property, sourceFile);
        if (name && value) properties.set(name.toLowerCase(), value);
      }
      if (isDeceptiveHealthyFallback(node, sourceFile)) {
        add({
          ruleId: "PDI003",
          node,
          message: "Failure handling fabricates a verified or healthy sync-integrity result.",
          evidence: "positive authority status plus zero-count fallback inside an error path",
          source: "deceptive-health-fallback",
          sink: "production-return-value",
          remediation:
            "Return an explicit unavailable/error state and preserve the failed read instead of reporting verified zero counts.",
        });
      }
      const success = properties.get("success");
      const factField = [...properties.keys()].find((name) =>
        /receipt|verified|verification|ready|status/.test(name)
      );
      const factValue = factField ? properties.get(factField) : null;
      const generated = /randomUUID|Date\.now|new\s+Date|toISOString/.test(
        node.getText(sourceFile)
      );
      const fixedAuthority =
        factValue &&
        (isStringLiteralLike(factValue) ||
          ts.isNumericLiteral(factValue) ||
          factValue.kind === ts.SyntaxKind.TrueKeyword);
      if (
        success &&
        success.kind === ts.SyntaxKind.TrueKeyword &&
        factField &&
        (generated || fixedAuthority) &&
        /verify|service|api|payment|receipt/i.test(functionNameFor(node))
      ) {
        add({
          ruleId: "PDI005",
          node,
          message:
            "Production service returns a generated success/verification fact without authoritative evidence.",
          evidence: `hardcoded success plus generated ${factField}`,
          source: "stubbed-service-result",
          sink: "production-api-result",
          remediation:
            "Return only authoritative service results; preserve unavailable/error state when verification cannot run.",
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

function analyzeUnclassifiedAstFile(root, relativePath, config, findings, reportPath) {
  if (!reportPath(relativePath) || classifyPath(relativePath, config) !== "unclassified") return;
  const text = readText(root, relativePath, config.limits.maxSourceFileBytes);
  if (text === null) return;
  const sourceFile = parseSourceFile(relativePath, text);
  const synthetic = buildSyntheticIndex(sourceFile, config);
  if (synthetic.sources.length === 0) return;
  findings.push(
    makeFinding(config, {
      ruleId: "PDI012",
      path: relativePath,
      node: synthetic.sources[0],
      sourceFile,
      message:
        "A synthetic-looking domain source exists outside the proven production graph and needs classification.",
      evidence: "unreachable hardcoded/generated domain record",
      source: "unclassified-synthetic-source",
      sink: "none-observed",
      remediation:
        "Move it under an explicit test/dev fixture path, remove it, or document a production-safe product-content classification.",
      reachabilityReason: "not reachable from a configured production entrypoint",
    })
  );
}

function findSyntheticJsonRecord(value, config, trail = "$") {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findSyntheticJsonRecord(value[index], config, `${trail}[${index}]`);
      if (found) return found;
    }
    return null;
  }
  const keys = Object.keys(value);
  const lowerKeys = new Set(keys.map((key) => key.toLowerCase()));
  const domainCount = config.domainFields.filter((field) =>
    lowerKeys.has(field.toLowerCase())
  ).length;
  const hasHistory = config.historySignalFields.some((field) => {
    const actualKey = keys.find((key) => key.toLowerCase() === field.toLowerCase());
    const actual = actualKey ? value[actualKey] : null;
    return typeof actual === "string" && actual.trim().length >= 2;
  });
  const hasTime = config.timeSignalFields.some((field) => {
    const actualKey = keys.find((key) => key.toLowerCase() === field.toLowerCase());
    return (
      actualKey !== undefined &&
      (typeof value[actualKey] === "string" || typeof value[actualKey] === "number")
    );
  });
  const idKey = keys.find((key) => key.toLowerCase() === "id");
  const hasIdentity = idKey !== undefined && ["string", "number"].includes(typeof value[idKey]);
  if (domainCount >= 4 && hasHistory && hasTime && hasIdentity) return { trail, keys: keys.sort() };
  for (const [key, child] of Object.entries(value)) {
    const found = findSyntheticJsonRecord(child, config, `${trail}.${key}`);
    if (found) return found;
  }
  return null;
}

function analyzeProductionJsonFile(root, relativePath, config, findings, reportPath) {
  if (!reportPath(relativePath) || classifyPath(relativePath, config) === "test") return;
  const value = readJsonFile(
    root,
    relativePath,
    "production JSON",
    config.limits.maxSourceFileBytes
  );
  const record = findSyntheticJsonRecord(value, config);
  if (!record) return;
  findings.push(
    makeFinding(config, {
      ruleId: "PDI002",
      path: relativePath,
      location: { line: 1, column: 1 },
      message: "Shipped production JSON contains a plausible hardcoded user-history record.",
      evidence: `domain object at ${record.trail} with fields ${record.keys.join(", ")}`,
      source: "hardcoded-production-json-record",
      sink: "shipped-public-or-native-json",
      fragment: JSON.stringify(record.keys),
      structuralSignature: `json-domain-record:${record.keys.join(",")}`,
      remediation:
        "Move the record to an isolated test fixture or remove it from shipped public/native JSON.",
      reachabilityReason: "configured production JSON path",
    })
  );
}

function analyzeProductionTextFile(root, relativePath, config, findings, reportPath) {
  if (!reportPath(relativePath) || classifyPath(relativePath, config) === "test") return;
  const text = readText(root, relativePath, config.limits.maxSourceFileBytes);
  if (text === null) return;
  for (const sentinel of config.bundleSentinels) {
    if (!text.includes(sentinel)) continue;
    findings.push(
      makeFinding(config, {
        ruleId: "PDI009",
        path: relativePath,
        location: { line: 1, column: 1 },
        message: "A shipped production/native/public text asset contains the test-fixture canary.",
        evidence: `known fixture sentinel hash ${sha256(sentinel).slice(0, 12)}`,
        source: "test-fixture-canary",
        sink: "shipped-production-text",
        fragment: sentinel,
        structuralSignature: "production-text-test-fixture-sentinel",
        remediation:
          "Remove the test fixture from the production/native/public source and rebuild.",
      })
    );
  }
  const quotedFields = config.domainFields.filter((field) => {
    const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`["']${escaped}["']\\s*(?::|,)`, "i").test(text);
  });
  const lowerFields = new Set(quotedFields.map((field) => field.toLowerCase()));
  const hasHistory = config.historySignalFields.some((field) =>
    lowerFields.has(field.toLowerCase())
  );
  const hasTime = config.timeSignalFields.some((field) => lowerFields.has(field.toLowerCase()));
  const hasIdentity = lowerFields.has("id");
  const hasSyntheticSignal =
    config.syntheticMarkers.some((marker) => text.toLowerCase().includes(marker.toLowerCase())) ||
    /randomUUID|Math\.random|Date\.now|new\s+Date|toISOString|\b\d{4}-\d{2}-\d{2}\b/.test(text);
  if (quotedFields.length >= 4 && hasHistory && hasTime && hasIdentity && hasSyntheticSignal) {
    findings.push(
      makeFinding(config, {
        ruleId: "PDI002",
        path: relativePath,
        location: { line: 1, column: 1 },
        message:
          "Production native/public source contains a plausible hardcoded synthetic history record.",
        evidence: `domain fields: ${[...new Set(quotedFields)].sort().join(", ")}`,
        source: "hardcoded-native-or-public-domain-record",
        sink: "production-native-or-public-runtime",
        fragment: text,
        structuralSignature: `text-domain-record:${[...new Set(quotedFields)].sort().join(",")}`,
        remediation:
          "Remove the fabricated record or isolate it under an explicit non-shipping test fixture.",
      })
    );
  }
}

function maskStoredRoutineBodies(sql) {
  const masked = sql.split("");
  const routinePattern = /\bcreate\s+(?:or\s+replace\s+)?(?:function|procedure)\b/gi;
  let routineMatch;

  while ((routineMatch = routinePattern.exec(sql)) !== null) {
    const header = sql.slice(routineMatch.index);
    const bodyStartPattern = /\bas\s+(\$[a-zA-Z_][a-zA-Z0-9_]*\$|\$\$)/i;
    const bodyStartMatch = bodyStartPattern.exec(header);
    if (!bodyStartMatch) continue;

    const bodyTagOffset = bodyStartMatch.index + bodyStartMatch[0].lastIndexOf(bodyStartMatch[1]);
    const bodyTagStart = routineMatch.index + bodyTagOffset;
    const headerTerminator = sql.indexOf(";", routineMatch.index);
    if (headerTerminator >= 0 && headerTerminator < bodyTagStart) continue;

    const tag = bodyStartMatch[1];
    const bodyContentStart = bodyTagStart + tag.length;
    const bodyContentEnd = sql.indexOf(tag, bodyContentStart);
    if (bodyContentEnd < 0) continue;

    for (let index = bodyContentStart; index < bodyContentEnd; index += 1) {
      if (masked[index] !== "\n" && masked[index] !== "\r") masked[index] = " ";
    }
    routinePattern.lastIndex = bodyContentEnd + tag.length;
  }

  return masked.join("");
}

function analyzeSqlFile(root, relativePath, config, findings, reportPath) {
  if (!reportPath(relativePath) || classifyPath(relativePath, config) === "test") return;
  const text = readText(root, relativePath, config.limits.maxSourceFileBytes);
  if (text === null) return;
  const withoutComments = text.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");
  // CREATE FUNCTION/PROCEDURE stores source for later invocation; the migration
  // does not execute that body. Keep DO blocks and top-level statements visible
  // because PostgreSQL executes them while applying the migration.
  const executableSql = maskStoredRoutineBodies(withoutComments);
  const userDataTables = new Set(
    config.userDataTables.map((table) => table.split(".").pop().toLowerCase())
  );
  const pattern =
    /\b(?:insert\s+into\s+(?:only\s+)?|merge\s+into\s+|copy\s+)((?:"?[a-zA-Z_][a-zA-Z0-9_$]*"?\s*\.\s*)?"?[a-zA-Z_][a-zA-Z0-9_$]*"?)(?=\s|\(|;|$)/gi;
  let match;
  while ((match = pattern.exec(executableSql)) !== null) {
    const normalizedTarget = match[1].replace(/["\s]/g, "").toLowerCase();
    const table = normalizedTarget.split(".").pop();
    if (!userDataTables.has(table)) continue;
    const before = executableSql.slice(0, match.index);
    const line = before.split("\n").length;
    findings.push(
      makeFinding(config, {
        ruleId: "PDI008",
        path: relativePath,
        location: { line, column: match.index - before.lastIndexOf("\n") },
        message: "Production SQL inserts or copies rows into a user-data table.",
        evidence: `data-modifying statement targets ${table}`,
        source: "production-migration-literal-or-seed",
        sink: table,
        fragment: match[0],
        structuralSignature: `sql-write:${table}`,
        remediation:
          "Remove the seed or isolate it in a confirmed local test environment; operational configuration tables need exact allowlisting.",
        reachabilityReason: "production migration/SQL path",
      })
    );
  }
}

function findEvidenceStatuses(value, fields, trail = "$", ancestors = [], statuses = []) {
  if (!value || typeof value !== "object") return statuses;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      findEvidenceStatuses(value[index], fields, `${trail}[${index}]`, ancestors, statuses);
    }
    return statuses;
  }
  const claimedFields = new Set();
  for (const field of fields) {
    if (field === "status" && trail !== "$") continue;
    if (
      typeof value[field] === "string" &&
      /^(?:PASS|READY|COMPLETE|COMPLETED)$/i.test(value[field])
    ) {
      statuses.push({ field, trail: `${trail}.${field}`, container: value, ancestors });
      claimedFields.add(field);
    } else if (value[field] === true) {
      statuses.push({ field, trail: `${trail}.${field}`, container: value, ancestors });
      claimedFields.add(field);
    }
  }
  for (const [key, child] of Object.entries(value)) {
    if (
      !claimedFields.has(key) &&
      child === true &&
      /^(?:ready|passed|complete|completed)$/i.test(key)
    ) {
      statuses.push({ field: key, trail: `${trail}.${key}`, container: value, ancestors });
    }
  }
  for (const [key, child] of Object.entries(value)) {
    if (child && typeof child === "object") {
      findEvidenceStatuses(child, fields, `${trail}.${key}`, [value, ...ancestors], statuses);
    }
  }
  return statuses;
}

const EVIDENCE_PROOF_KEYS = new Set([
  "evidence",
  "proof",
  "verification",
  "commandevidence",
  "command_evidence",
]);

function hasCommandBoundEvidence(status, context, config) {
  const candidates = [];
  const seen = new Set();
  const addCandidate = (candidate) => {
    if (!candidate || typeof candidate !== "object" || seen.has(candidate)) return;
    seen.add(candidate);
    if (Array.isArray(candidate)) {
      for (const child of candidate) addCandidate(child);
      return;
    }
    candidates.push(candidate);
  };
  addCandidate(status.container);
  for (const [key, child] of Object.entries(status.container)) {
    if (EVIDENCE_PROOF_KEYS.has(key.toLowerCase())) addCandidate(child);
  }
  for (const current of candidates) {
    const command = typeof current.command === "string" ? current.command.trim() : "";
    const timestamp = typeof current.timestamp === "string" ? Date.parse(current.timestamp) : NaN;
    const ageMs = context.now.getTime() - timestamp;
    const fresh =
      Number.isFinite(timestamp) &&
      ageMs >= -5 * 60 * 1000 &&
      ageMs <= config.limits.maxEvidenceAgeHours * 60 * 60 * 1000;
    const headSha = typeof current.headSha === "string" ? current.headSha.toLowerCase() : "";
    const headBound =
      /^[a-f0-9]{40}$/.test(headSha) && (!context.head || headSha === context.head.toLowerCase());
    const artifactSha =
      typeof current.artifactSha256 === "string"
        ? current.artifactSha256
        : typeof current.sha256 === "string"
          ? current.sha256
          : "";
    let artifactBound = false;
    if (
      /^[a-f0-9]{64}$/i.test(artifactSha) &&
      typeof current.artifactPath === "string" &&
      current.artifactPath.trim() !== "" &&
      !/[?*\[\]]/.test(current.artifactPath)
    ) {
      const artifactPath = normalizeRepoPath(current.artifactPath);
      const target = resolveInsideRoot(context.root, artifactPath);
      if (fs.existsSync(target)) {
        const stat = fs.lstatSync(target);
        if (stat.isSymbolicLink())
          throw new ConfigurationError(`evidence artifact cannot be a symlink: ${artifactPath}`);
        if (!stat.isFile())
          throw new ConfigurationError(`evidence artifact must be a file: ${artifactPath}`);
        assertExistingRealpathInsideRoot(context.root, target, `evidence artifact ${artifactPath}`);
        if (stat.size > config.limits.maxBundleFileBytes)
          throw new ConfigurationError(`evidence artifact exceeds byte limit: ${artifactPath}`);
        artifactBound =
          crypto.createHash("sha256").update(fs.readFileSync(target)).digest("hex") ===
          artifactSha.toLowerCase();
      }
    }
    if (command.length >= 4 && current.exitCode === 0 && fresh && (headBound || artifactBound))
      return true;
  }
  return false;
}

function analyzeEvidenceFile(root, relativePath, config, findings, reportPath, context) {
  if (!reportPath(relativePath) || !matchesAny(relativePath, config.releaseEvidenceGlobs)) return;
  const value = readJsonFile(
    root,
    relativePath,
    "release evidence",
    config.limits.maxEvidenceFileBytes
  );
  const statuses = findEvidenceStatuses(value, config.releaseEvidenceStatusFields || []);
  for (const status of statuses) {
    if (hasCommandBoundEvidence(status, context, config)) continue;
    findings.push(
      makeFinding(config, {
        ruleId: "PDI011",
        path: relativePath,
        location: { line: 1, column: 1 },
        message:
          "Release/readiness evidence claims PASS/ready/completed without command-bound fresh proof.",
        evidence: `status field ${status.trail}`,
        source: "release-evidence-claim",
        sink: "tracked-readiness-artifact",
        fragment: status.field,
        structuralSignature: `evidence-status:${status.field}`,
        remediation:
          "Record the exact command, exit code, ISO timestamp, and commit/artifact hash, or mark the status UNVERIFIED.",
        reachabilityReason: "configured release evidence path",
      })
    );
  }
}

function bundleStatEvidence(rawPath, kind, stat) {
  return {
    rawPath,
    path: normalizeRepoPath(rawPath),
    kind,
    dev: stat.dev.toString(),
    ino: stat.ino.toString(),
    size: stat.size.toString(),
    mtimeNs: stat.mtimeNs.toString(),
    ctimeNs: stat.ctimeNs.toString(),
  };
}

function bundleStatMatchesEntry(entry, stat) {
  const current = bundleStatEvidence(entry.rawPath, entry.kind, stat);
  return (
    current.rawPath === entry.rawPath &&
    current.path === entry.path &&
    current.kind === entry.kind &&
    current.dev === entry.dev &&
    current.ino === entry.ino &&
    current.size === entry.size &&
    current.mtimeNs === entry.mtimeNs &&
    current.ctimeNs === entry.ctimeNs
  );
}

function captureBundleInventory(root, directory, config, required = false) {
  const normalizedDirectory = normalizeRepoPath(directory);
  const target = resolveInsideRoot(root, normalizedDirectory);
  let rootStat;
  try {
    rootStat = fs.lstatSync(target, { bigint: true });
  } catch (error) {
    if (error && error.code === "ENOENT") {
      if (required)
        throw new ConfigurationError(
          `explicit bundle directory is missing: ${normalizedDirectory}`
        );
      return null;
    }
    throw new ConfigurationError(
      `bundle directory cannot be inspected: ${normalizedDirectory}: ${error.message}`
    );
  }
  if (rootStat.isSymbolicLink())
    throw new ConfigurationError(`bundle directory cannot be a symlink: ${normalizedDirectory}`);
  if (!rootStat.isDirectory())
    throw new ConfigurationError(`bundle path must be a directory: ${normalizedDirectory}`);
  assertNoDuplicateArtifactOrdinal(normalizedDirectory);
  assertExistingRealpathInsideRoot(root, target, `bundle directory ${normalizedDirectory}`);
  const entries = [bundleStatEvidence(normalizedDirectory, "directory", rootStat)];
  const visitedDirectories = new Set([fs.realpathSync(target)]);
  const logicalPaths = new Map([[normalizeRepoPath(normalizedDirectory), normalizedDirectory]]);
  let fileCount = 0;
  let directoryCount = 1;
  let aggregateBytes = 0n;

  const visit = (directoryPath, relativeDirectory) => {
    let children;
    try {
      children = fs
        .readdirSync(directoryPath, { withFileTypes: true })
        .sort((left, right) => left.name.localeCompare(right.name));
    } catch (error) {
      throw new ConfigurationError(
        `bundle directory changed while being inventoried: ${relativeDirectory}: ${error.message}`
      );
    }

    for (const child of children) {
      const rawRelativePath = path.posix.join(relativeDirectory, child.name);
      const relativePath = normalizeRepoPath(rawRelativePath);
      if (child.name !== child.name.normalize("NFC")) {
        throw new ConfigurationError(
          `bundle artifact name must use NFC normalization: ${relativePath}`
        );
      }
      const priorRawPath = logicalPaths.get(relativePath);
      if (priorRawPath && priorRawPath !== rawRelativePath) {
        throw new ConfigurationError(
          `canonically equivalent bundle artifact paths are not allowed: ${relativePath}`
        );
      }
      logicalPaths.set(relativePath, rawRelativePath);
      assertNoDuplicateArtifactOrdinal(rawRelativePath);
      const childPath = resolveInsideRoot(root, rawRelativePath);
      let stat;
      try {
        stat = fs.lstatSync(childPath, { bigint: true });
      } catch (error) {
        throw new ConfigurationError(
          `bundle artifact changed while being inventoried: ${relativePath}: ${error.message}`
        );
      }
      if (stat.isSymbolicLink())
        throw new ConfigurationError(`bundle artifact cannot be a symlink: ${relativePath}`);
      if (stat.isDirectory()) {
        const real = assertExistingRealpathInsideRoot(
          root,
          childPath,
          `bundle directory ${relativePath}`
        );
        if (visitedDirectories.has(real))
          throw new ConfigurationError(
            `bundle directory is reachable more than once: ${relativePath}`
          );
        visitedDirectories.add(real);
        directoryCount += 1;
        if (directoryCount > MAX_BUNDLE_DIRECTORIES) {
          throw new ConfigurationError(
            `bundle directory count exceeds code-owned limit ${MAX_BUNDLE_DIRECTORIES}: ${normalizedDirectory}`
          );
        }
        entries.push(bundleStatEvidence(rawRelativePath, "directory", stat));
        visit(childPath, rawRelativePath);
        continue;
      }
      if (!stat.isFile())
        throw new ConfigurationError(`unsupported bundle artifact type: ${relativePath}`);
      assertExistingRealpathInsideRoot(root, childPath, `bundle artifact ${relativePath}`);
      fileCount += 1;
      if (fileCount > config.limits.maxFiles) {
        throw new ConfigurationError(`bundle scan exceeds maxFiles=${config.limits.maxFiles}`);
      }
      if (stat.size > BigInt(config.limits.maxBundleFileBytes)) {
        throw new ConfigurationError(`bundle artifact exceeds byte limit: ${relativePath}`);
      }
      aggregateBytes += stat.size;
      if (aggregateBytes > MAX_BUNDLE_AGGREGATE_BYTES) {
        throw new ConfigurationError(
          `bundle aggregate byte limit exceeded (${MAX_BUNDLE_AGGREGATE_BYTES.toString()}): ${normalizedDirectory}`
        );
      }
      entries.push(bundleStatEvidence(rawRelativePath, "file", stat));
    }
  };

  visit(target, normalizedDirectory);
  if (required && fileCount === 0)
    throw new ConfigurationError(`explicit bundle directory is empty: ${normalizedDirectory}`);
  for (const entry of entries) {
    if (entry.kind !== "file") continue;
    entry.sha256 = sha256Bytes(
      readBundleArtifactStable(root, normalizedDirectory, entry, config.limits.maxBundleFileBytes)
    );
  }
  return {
    directory: normalizedDirectory,
    entries,
    fileCount,
    directoryCount,
    aggregateBytes: aggregateBytes.toString(),
  };
}

function assertSameBundleInventory(initial, current) {
  if (JSON.stringify(initial) !== JSON.stringify(current)) {
    const directory = initial?.directory || current?.directory || "bundle";
    throw new ConfigurationError(
      `bundle artifact inventory changed while production data integrity was being checked: ${directory}`
    );
  }
}

function readBundleArtifactStable(root, directory, entry, maxBytes, hooks = null) {
  const relativePath = entry.path;
  const target = resolveInsideRoot(root, entry.rawPath);
  hooks?.beforeBundleArtifactOpen?.({ directory, path: relativePath });
  const noFollow = fs.constants.O_NOFOLLOW || 0;
  let descriptor;
  try {
    descriptor = fs.openSync(target, fs.constants.O_RDONLY | noFollow);
  } catch (error) {
    throw new ConfigurationError(
      `bundle artifact cannot be opened without following links: ${relativePath}: ${error.code || error.message}`
    );
  }

  try {
    const before = fs.fstatSync(descriptor, { bigint: true });
    if (!before.isFile())
      throw new ConfigurationError(`bundle artifact must be a regular file: ${relativePath}`);
    if (before.size > BigInt(maxBytes))
      throw new ConfigurationError(`bundle artifact exceeds byte limit: ${relativePath}`);
    if (!bundleStatMatchesEntry(entry, before)) {
      throw new ConfigurationError(
        `bundle artifact inventory changed before content inspection: ${relativePath}`
      );
    }

    const pathBefore = fs.lstatSync(target, { bigint: true });
    if (pathBefore.isSymbolicLink())
      throw new ConfigurationError(`bundle artifact cannot be a symbolic link: ${relativePath}`);
    if (!bundleStatMatchesEntry(entry, pathBefore)) {
      throw new ConfigurationError(
        `bundle artifact path changed before content inspection: ${relativePath}`
      );
    }
    assertExistingRealpathInsideRoot(root, target, `bundle artifact ${relativePath}`);

    const buffer = Buffer.alloc(Number(before.size));
    let offset = 0;
    while (offset < buffer.byteLength) {
      const bytesRead = fs.readSync(descriptor, buffer, offset, buffer.byteLength - offset, offset);
      if (bytesRead <= 0)
        throw new ConfigurationError(
          `bundle artifact ended before its inventoried size: ${relativePath}`
        );
      offset += bytesRead;
    }

    const after = fs.fstatSync(descriptor, { bigint: true });
    const pathAfter = fs.lstatSync(target, { bigint: true });
    if (
      !bundleStatMatchesEntry(entry, after) ||
      pathAfter.isSymbolicLink() ||
      !bundleStatMatchesEntry(entry, pathAfter) ||
      BigInt(buffer.byteLength) !== after.size
    ) {
      throw new ConfigurationError(`bundle artifact changed while being read: ${relativePath}`);
    }
    assertExistingRealpathInsideRoot(root, target, `bundle artifact ${relativePath}`);
    return buffer;
  } catch (error) {
    if (error instanceof ConfigurationError) throw error;
    throw new ConfigurationError(
      `bundle artifact changed while being read: ${relativePath}: ${error.message}`
    );
  } finally {
    try {
      fs.closeSync(descriptor);
    } catch {
      // A failed close cannot make the evidence stronger; fail below if no earlier error exists.
    }
  }
}

function analyzeBundle(root, inventory, config, findings, required = false, hooks = null) {
  if (inventory === null) return;
  const normalizedDirectory = inventory.directory;
  let readableTextFiles = 0;
  for (const entry of inventory.entries) {
    if (entry.kind !== "file") continue;
    const relativePath = entry.path;
    const buffer = readBundleArtifactStable(
      root,
      normalizedDirectory,
      entry,
      config.limits.maxBundleFileBytes,
      hooks
    );
    if (sha256Bytes(buffer) !== entry.sha256) {
      throw new ConfigurationError(
        `bundle artifact content changed after inventory capture: ${relativePath}`
      );
    }
    for (const sentinel of config.bundleSentinels) {
      const index = buffer.indexOf(Buffer.from(sentinel, "utf8"));
      if (index === -1) continue;
      const before = buffer.subarray(0, index).toString("latin1");
      findings.push(
        makeFinding(config, {
          ruleId: "PDI009",
          path: relativePath,
          location: { line: before.split("\n").length, column: index - before.lastIndexOf("\n") },
          message: "Production bundle contains the test-fixture canary.",
          evidence: `known fixture sentinel hash ${sha256(sentinel).slice(0, 12)}`,
          source: "test-fixture-canary",
          sink: normalizedDirectory,
          fragment: sentinel,
          structuralSignature: "bundle-test-fixture-sentinel",
          remediation:
            "Remove the production-to-test import edge, rebuild from a clean tree, and rerun the bundle check.",
          reachabilityReason: `present in built artifact under ${normalizedDirectory}`,
        })
      );
    }
    const extension = path.extname(relativePath).toLowerCase();
    if (!TEXT_EXTENSIONS.has(extension) && extension !== "") continue;
    if (buffer.includes(0)) continue;
    decodeUtf8(buffer, `bundle artifact ${relativePath}`);
    readableTextFiles += 1;
  }
  if (required && readableTextFiles === 0)
    throw new ConfigurationError(
      `explicit bundle directory has no readable text artifacts: ${normalizedDirectory}`
    );
}

function validateRepositoryContracts(root, config, findings) {
  for (const contract of config.repositoryContracts) {
    if (
      !contract ||
      typeof contract.path !== "string" ||
      !Array.isArray(contract.requiredStrings) ||
      !Array.isArray(contract.forbiddenStrings)
    ) {
      throw new ConfigurationError(
        "repositoryContracts entries need path, requiredStrings[], and forbiddenStrings[]"
      );
    }
    const target = resolveInsideRoot(root, contract.path);
    if (!fs.existsSync(target)) {
      findings.push(
        makeFinding(config, {
          ruleId: "PDI010",
          path: contract.path,
          location: { line: 1, column: 1 },
          message: "Required production-data integrity surface is missing.",
          evidence: "repository contract file absent",
          source: "enforcement-contract",
          sink: contract.path,
          fragment: contract.path,
          structuralSignature: "missing-enforcement-file",
          remediation: "Restore the required checker, test, hook, policy, or CI surface.",
        })
      );
      continue;
    }
    const content = readText(root, contract.path, config.limits.maxSourceFileBytes);
    if (content === null)
      throw new ConfigurationError(`repository contract appears binary: ${contract.path}`);
    for (const required of contract.requiredStrings) {
      if (content.includes(required)) continue;
      findings.push(
        makeFinding(config, {
          ruleId: "PDI010",
          path: contract.path,
          location: { line: 1, column: 1 },
          message: "A required production-data integrity contract marker was removed.",
          evidence: `missing marker hash ${sha256(required).slice(0, 12)}`,
          source: "enforcement-contract",
          sink: contract.path,
          fragment: required,
          structuralSignature: "missing-enforcement-marker",
          remediation: "Restore the contract behavior and its independent regression assertion.",
        })
      );
    }
    for (const forbidden of contract.forbiddenStrings) {
      if (!content.includes(forbidden)) continue;
      findings.push(
        makeFinding(config, {
          ruleId: "PDI010",
          path: contract.path,
          location: { line: 1, column: 1 },
          message: "An enforcement-bypass marker is present on a protected surface.",
          evidence: `forbidden marker hash ${sha256(forbidden).slice(0, 12)}`,
          source: "enforcement-tampering",
          sink: contract.path,
          fragment: forbidden,
          structuralSignature: "forbidden-enforcement-marker",
          remediation:
            "Remove error masking, broad skips, or disabled enforcement and restore the behavior test.",
        })
      );
    }
  }
}

function validatePackageScriptContract(root, config, findings) {
  const packageJson = readJsonFile(
    root,
    "package.json",
    "package.json",
    config.limits.maxSourceFileBytes
  );
  if (
    !packageJson ||
    !packageJson.scripts ||
    typeof packageJson.scripts !== "object" ||
    Array.isArray(packageJson.scripts)
  ) {
    throw new ConfigurationError("package.json must contain scripts for production data integrity");
  }
  for (const [name, expected] of Object.entries(CANONICAL_PACKAGE_SCRIPTS)) {
    if (packageJson.scripts[name] === expected) continue;
    findings.push(
      makeFinding(config, {
        ruleId: "PDI010",
        path: "package.json",
        location: { line: 1, column: 1 },
        message: `Production data integrity package command is not canonical: ${name}.`,
        evidence: `exact command contract for ${name}`,
        source: "package-bootstrap-contract",
        sink: "package.json",
        fragment: expected,
        structuralSignature: `package-script:${name}`,
        remediation: `Restore ${name} to the direct canonical CLI command and keep the dedicated workflow independent of npm aliases.`,
      })
    );
  }
}

function gitOutput(root, args, allowFailure = false) {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    if (allowFailure) return "";
    throw new ConfigurationError(
      `git ${args.join(" ")} failed: ${normalizeNewlines(error.stderr || error.message).trim()}`
    );
  }
}

function splitNul(value) {
  return String(value).split("\0").map(normalizeRepoPath).filter(Boolean);
}

function selectChangedFiles(root, mode, base) {
  if (mode === "all") return { files: null, base: base || null };
  gitOutput(root, ["rev-parse", "--is-inside-work-tree"]);
  if (mode === "staged") {
    return {
      files: new Set(splitNul(gitOutput(root, ["diff", "--cached", "--name-only", "-z", "--"]))),
      base: "INDEX",
    };
  }
  let selectedBase = base;
  if (!selectedBase) {
    selectedBase = gitOutput(root, ["merge-base", "HEAD", "origin/main"], true).trim();
    if (!selectedBase) selectedBase = gitOutput(root, ["rev-parse", "HEAD^"], true).trim();
    if (!selectedBase) selectedBase = "HEAD";
  }
  gitOutput(root, ["rev-parse", "--verify", selectedBase]);
  const files = new Set(
    splitNul(gitOutput(root, ["diff", "--name-only", "-z", selectedBase, "--"]))
  );
  for (const untracked of splitNul(
    gitOutput(root, ["ls-files", "--others", "--exclude-standard", "-z"])
  ))
    files.add(untracked);
  return { files, base: selectedBase };
}

function materializeIndex(root) {
  const snapshotRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zenflow-pdi-index-"));
  try {
    gitOutput(root, ["checkout-index", "--all", "--force", `--prefix=${snapshotRoot}${path.sep}`]);
    return fs.realpathSync(snapshotRoot);
  } catch (error) {
    fs.rmSync(snapshotRoot, { recursive: true, force: true });
    throw error;
  }
}

function shouldReportFactory(mode, changedFiles, graph) {
  if (mode === "all" || !changedFiles) return () => true;
  return (relativePath) => {
    const normalized = normalizeRepoPath(relativePath);
    if (changedFiles.has(normalized)) return true;
    if (graph && graph.reachable.has(normalized)) {
      return traceReachability(normalized, graph).some((file) => changedFiles.has(file));
    }
    return false;
  };
}

function deduplicateAndSort(findings) {
  const byKey = new Map();
  for (const finding of findings) {
    const key = `${finding.ruleId}|${finding.path}|${finding.line}|${finding.column}|${finding.sink}|${finding.message}`;
    if (!byKey.has(key)) byKey.set(key, finding);
  }
  return [...byKey.values()].sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.line - right.line ||
      left.column - right.column ||
      left.ruleId.localeCompare(right.ruleId) ||
      left.fingerprint.localeCompare(right.fingerprint)
  );
}

function applyLedgers(findings, baseline, waiverLedger, config) {
  const findingKeys = new Set(
    findings.map((finding) => `${finding.ruleId}|${finding.path}|${finding.fingerprint}`)
  );
  for (const entry of baseline.entries) {
    const key = `${entry.ruleId}|${normalizeRepoPath(entry.path)}|${entry.fingerprint}`;
    if (!findingKeys.has(key)) {
      findings.push(
        makeFinding(config, {
          ruleId: "PDI010",
          path: entry.path,
          location: { line: 1, column: 1 },
          message: "Baseline contains a stale fingerprint and must ratchet downward.",
          evidence: `stale baseline ${entry.ruleId}/${entry.fingerprint.slice(0, 12)}`,
          source: "baseline-ratchet",
          sink: "config/production-data-integrity-baseline.json",
          fragment: entry.fingerprint,
          structuralSignature: "stale-baseline-entry",
          remediation:
            "Remove the resolved exact entry; never retain or replace it with a broad count.",
        })
      );
    }
  }
  const baselineKeys = new Set(
    baseline.entries.map(
      (entry) => `${entry.ruleId}|${normalizeRepoPath(entry.path)}|${entry.fingerprint}`
    )
  );
  const waiverKeys = new Set(
    waiverLedger.waivers.map(
      (waiver) => `${waiver.ruleId}|${normalizeRepoPath(waiver.path)}|${waiver.fingerprint}`
    )
  );
  for (const finding of findings) {
    const key = `${finding.ruleId}|${finding.path}|${finding.fingerprint}`;
    finding.baselined = baselineKeys.has(key);
    finding.waived = waiverKeys.has(key);
  }
}

function runIntegrityCheck(options) {
  const repositoryRoot = fs.realpathSync(path.resolve(options.root || process.cwd()));
  const testHooks = options[PDI_TEST_HOOKS] || null;
  const mode = options.mode || "all";
  if (!["all", "diff", "staged"].includes(mode))
    throw new ConfigurationError(`unsupported mode: ${mode}`);
  const selection = selectChangedFiles(repositoryRoot, mode, options.base);
  const useIndexSnapshot = mode === "staged";
  const root = useIndexSnapshot ? materializeIndex(repositoryRoot) : repositoryRoot;
  const configPath = normalizeRepoPath(
    options.configPath || "config/production-data-integrity.json"
  );
  try {
    const config = readJsonFile(root, configPath, "production data integrity config");
    validateConfig(config);
    const baseline = readJsonFile(root, config.baselineFile, "production data integrity baseline");
    const waivers = readJsonFile(root, config.waiversFile, "production data integrity waivers");
    validateBaseline(baseline);
    validateWaivers(waivers, options.now || new Date());

    const explicitBundles = options.bundleDirectories && options.bundleDirectories.length > 0;
    const requestedBundleDirectories = explicitBundles
      ? options.bundleDirectories
      : config.bundleDirectories;
    for (const directory of requestedBundleDirectories) assertBundleRootUsesNfc(directory);
    const bundleDirectories = [
      ...new Set(requestedBundleDirectories.map(normalizeRepoPath)),
    ].sort();
    if (bundleDirectories.length > MAX_BUNDLE_ROOTS) {
      throw new ConfigurationError(
        `bundle root count exceeds code-owned limit ${MAX_BUNDLE_ROOTS}`
      );
    }
    const bundleRoot = explicitBundles ? repositoryRoot : root;
    const bundleInventories = new Map();
    for (const directory of bundleDirectories) {
      const inventory = captureBundleInventory(bundleRoot, directory, config, explicitBundles);
      bundleInventories.set(directory, inventory);
      testHooks?.afterBundleInventoryCaptured?.(directory);
    }

    const files = enumerateFiles(root, config);
    const evidenceFiles = enumerateEvidenceFiles(root, config);
    const graph = buildReachability(root, files, config);
    const reportPath = shouldReportFactory(mode, selection.files, graph);
    const collectAllPaths = () => true;
    const findings = [];
    const evidenceContext = {
      now: options.now || new Date(),
      head: gitOutput(repositoryRoot, ["rev-parse", "HEAD"], true).trim() || null,
      root,
    };

    for (const unresolved of graph.unresolved) {
      findings.push(
        makeFinding(config, {
          ruleId: "PDI012",
          path: unresolved.file,
          node: unresolved.node,
          sourceFile: unresolved.sourceFile,
          message: "A production dependency edge could not be resolved deterministically.",
          evidence: unresolved.reason.replace(/:.+$/, ""),
          source: "unresolved-production-import",
          sink: "dependency-graph",
          remediation:
            "Use a literal resolvable import or add a narrowly audited path after review.",
          reachabilityReason: traceReachability(unresolved.file, graph).join(" -> "),
        })
      );
    }

    for (const file of [...graph.reachable].sort()) {
      const classification = classifyPath(file, config);
      if (classification === "test" || classification === "dev") {
        const trace = traceReachability(file, graph);
        findings.push(
          makeFinding(config, {
            ruleId: "PDI001",
            path: file,
            location: { line: 1, column: 1 },
            message: `Production dependency graph reaches a ${classification}-only module.`,
            evidence: `dependency trace length ${trace.length}`,
            source: `${classification}-artifact`,
            sink: "production-bundle",
            fragment: trace.join(" -> "),
            structuralSignature: `production-reaches-${classification}`,
            remediation:
              "Remove the production edge or move the runtime-safe code into a production module without fixture data.",
            reachabilityReason: trace.join(" -> "),
          })
        );
      }
    }

    const productionFiles = new Set([...graph.reachable]);
    for (const file of graph.allFiles)
      if (matchesAny(file, config.productionPathGlobs)) productionFiles.add(file);
    for (const file of [...productionFiles].sort()) {
      const extension = path.extname(file).toLowerCase();
      if (AST_EXTENSIONS.has(extension))
        analyzeAstFile(
          root,
          file,
          config,
          findings,
          traceReachability(file, graph).join(" -> ") || "forced production path",
          collectAllPaths
        );
      else if (extension === ".sql") analyzeSqlFile(root, file, config, findings, collectAllPaths);
      else if (extension === ".json") {
        analyzeProductionJsonFile(root, file, config, findings, collectAllPaths);
        analyzeEvidenceFile(root, file, config, findings, collectAllPaths, evidenceContext);
      } else if (TEXT_EXTENSIONS.has(extension) || extension === "") {
        analyzeProductionTextFile(root, file, config, findings, collectAllPaths);
      }
    }
    for (const file of graph.allFiles) {
      if (graph.reachable.has(file) || !AST_EXTENSIONS.has(path.extname(file).toLowerCase()))
        continue;
      analyzeUnclassifiedAstFile(root, file, config, findings, collectAllPaths);
    }
    for (const file of evidenceFiles)
      analyzeEvidenceFile(root, file, config, findings, collectAllPaths, evidenceContext);

    for (const directory of bundleDirectories) {
      analyzeBundle(
        bundleRoot,
        bundleInventories.get(directory),
        config,
        findings,
        explicitBundles,
        testHooks
      );
      testHooks?.afterBundleAnalysis?.(directory);
    }
    validateRepositoryContracts(root, config, findings);
    validatePackageScriptContract(root, config, findings);

    let sorted = deduplicateAndSort(findings);
    applyLedgers(sorted, baseline, waivers, config);
    sorted = deduplicateAndSort(sorted);
    if (mode !== "all") {
      sorted = sorted.filter(
        (finding) =>
          finding.ruleId === "PDI009" ||
          finding.source === "baseline-ratchet" ||
          reportPath(finding.path)
      );
    }
    const errors = sorted.filter(
      (finding) => finding.severity === "error" && !finding.baselined && !finding.waived
    ).length;
    const warnings = sorted.filter(
      (finding) => finding.severity === "warning" && !finding.waived
    ).length;
    const head = gitOutput(repositoryRoot, ["rev-parse", "HEAD"], true).trim() || null;
    for (const directory of bundleDirectories) {
      const currentInventory = captureBundleInventory(
        bundleRoot,
        directory,
        config,
        explicitBundles
      );
      assertSameBundleInventory(bundleInventories.get(directory), currentInventory);
    }
    return {
      schemaVersion: SCHEMA_VERSION,
      status: errors > 0 ? "FAIL" : "PASS",
      mode,
      head,
      base: selection.base,
      findings: sorted,
      summary: {
        errors,
        warnings,
        baselined: sorted.filter((finding) => finding.baselined).length,
        waived: sorted.filter((finding) => finding.waived).length,
        scannedFiles: new Set([...files, ...evidenceFiles]).size,
        reachableFiles: graph.reachable.size,
      },
    };
  } finally {
    if (useIndexSnapshot) fs.rmSync(root, { recursive: true, force: true });
  }
}

module.exports = {
  ConfigurationError,
  PDI_TEST_API,
  PDI_TEST_HOOKS,
  SCHEMA_VERSION,
  buildReachability,
  classifyPath,
  globToRegExp,
  normalizeNewlines,
  normalizeRepoPath,
  runIntegrityCheck,
  validateBaseline,
  validateConfig,
  validateWaivers,
};
