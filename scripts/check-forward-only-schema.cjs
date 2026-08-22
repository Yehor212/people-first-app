#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const FILES = Object.freeze({
  database: "src/storage/db.ts",
  releasePolicy: "docs/CROSS_PLATFORM_RELEASE.md",
});
const V11_ACCOUNT_STORES = Object.freeze([
  "automationTransactions",
  "automationHistoryMarkers",
  "automationRemoteEvents",
]);

function issue(code, file, detail) {
  return { code, file, detail };
}

function readRequired(rootDir, relativePath, issues) {
  const target = path.join(rootDir, relativePath);
  if (!fs.existsSync(target)) {
    issues.push(issue("MISSING_FILE", relativePath, "required forward-only contract file is absent"));
    return "";
  }
  const stat = fs.lstatSync(target);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    issues.push(issue("UNSAFE_FILE", relativePath, "contract input must be a regular file"));
    return "";
  }
  return fs.readFileSync(target, "utf8");
}

function extractV11StoreBlock(databaseSource) {
  const match = /this\.version\(\s*(?:ZENFLOW_SCHEMA_VERSION|11)\s*\)\.stores\(\{([\s\S]*?)\n\s*\}\);/u.exec(
    databaseSource,
  );
  return match?.[1] ?? "";
}

function findForwardOnlySchemaIssues({ rootDir = path.resolve(__dirname, "..") } = {}) {
  const resolvedRoot = path.resolve(rootDir);
  const issues = [];
  const databaseSource = readRequired(resolvedRoot, FILES.database, issues);
  const releaseSource = readRequired(resolvedRoot, FILES.releasePolicy, issues);

  if (!/export const ZENFLOW_SCHEMA_VERSION\s*=\s*11\s*;/u.test(databaseSource)) {
    issues.push(
      issue(
        "SCHEMA_VERSION_CONSTANT_INVALID",
        FILES.database,
        "the current shared Dexie schema must declare version 11",
      ),
    );
  }

  const v11StoreBlock = extractV11StoreBlock(databaseSource);
  if (!v11StoreBlock) {
    issues.push(
      issue(
        "V11_SCHEMA_REGISTRATION_MISSING",
        FILES.database,
        "the shared database must register its v11 store block",
      ),
    );
  }
  for (const store of V11_ACCOUNT_STORES) {
    if (!new RegExp(`\\b${store}\\s*:`, "u").test(v11StoreBlock)) {
      issues.push(
        issue(
          "V11_ACCOUNT_STORE_MISSING",
          FILES.database,
          `v11 schema is missing ${store}`,
        ),
      );
    }
    if (!new RegExp(`await\\s+db\\.${store}\\.clear\\(\\)`, "u").test(databaseSource)) {
      issues.push(
        issue(
          "V11_ACCOUNT_CLEAR_MISSING",
          FILES.database,
          `account cleanup is missing ${store}`,
        ),
      );
    }
  }

  if (!/^forward_schema_floor:\s*11\s*$/mu.test(releaseSource)) {
    issues.push(
      issue(
        "FORWARD_SCHEMA_FLOOR_INVALID",
        FILES.releasePolicy,
        "the release floor must remain schema v11 or newer",
      ),
    );
  }
  if (!/^legacy_v10_rollback:\s*forbidden\s*$/mu.test(releaseSource)) {
    issues.push(
      issue(
        "LEGACY_V10_ROLLBACK_ALLOWED",
        FILES.releasePolicy,
        "a v10-aware artifact cannot follow v11 distribution",
      ),
    );
  }
  if (!/^rollback_artifact:\s*v11-aware-or-newer\s*$/mu.test(releaseSource)) {
    issues.push(
      issue(
        "ROLLBACK_ARTIFACT_SCHEMA_UNSAFE",
        FILES.releasePolicy,
        "replacement artifacts must retain v11-aware cleanup",
      ),
    );
  }

  return issues;
}

if (require.main === module) {
  try {
    const issues = findForwardOnlySchemaIssues();
    process.stdout.write(`${JSON.stringify({ ok: issues.length === 0, issues }, null, 2)}\n`);
    process.exitCode = issues.length === 0 ? 0 : 1;
  } catch {
    process.stderr.write("[forward-only-schema] internal checker error\n");
    process.exitCode = 2;
  }
}

module.exports = { findForwardOnlySchemaIssues };
