#!/usr/bin/env node
"use strict";

/**
 * Secret-safe Sentry status aggregator.
 *
 * Runs the local Sentry readiness, API, GitHub name, and public artifact checks
 * and prints a single summary. Child checks are responsible for redacting values;
 * this script never reads or prints secret values directly.
 */

const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { evidenceFailureCode } = require("./lib/diagnostic-evidence-privacy.cjs");

const ROOT = path.join(__dirname, "..");

const CHECKS = [
  { key: "readiness", script: "scripts/check-sentry-readiness.cjs" },
  { key: "api", script: "scripts/smoke-sentry-api.cjs" },
  { key: "github", script: "scripts/check-github-sentry-secrets.cjs" },
  { key: "artifacts", script: "scripts/check-sentry-artifacts.cjs" },
];

function run(command, args, options) {
  return spawnSync(command, args, {
    cwd: ROOT,
    env: options.env,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 8,
  });
}

function extractStatus(output) {
  const match = output.match(/\[sentry-[^\]]+\]\s+(PASS|FAIL|UNVERIFIED|PARTIAL)\b/);
  return match ? match[1] : "UNVERIFIED";
}

function buildChildEnv(env) {
  const merged = { ...process.env, ...env };
  if (merged.ZENFLOW_SENTRY_STATUS_REQUIRED === "true") {
    merged.ZENFLOW_SENTRY_READINESS_REQUIRED = "true";
    merged.ZENFLOW_SENTRY_API_REQUIRED = "true";
    merged.ZENFLOW_GITHUB_SENTRY_SECRETS_REQUIRED = "true";
  }
  return merged;
}

function appendBlock(parts, text) {
  const value = String(text || "");
  if (value.trim()) parts.push(value.trimEnd());
}

function runSentryStatus({ env = process.env, runner = run } = {}) {
  const required = env.ZENFLOW_SENTRY_STATUS_REQUIRED === "true";
  const childEnv = buildChildEnv(env);
  const stdoutParts = [];
  const stderrParts = [];
  const statuses = {};
  let hardFailure = false;

  for (const check of CHECKS) {
    let result;
    try {
      result = runner(process.execPath, [check.script], { cwd: ROOT, env: childEnv });
    } catch (error) {
      result = { status: 1, stdout: "", stderr: "", error };
    }
    const stdout = result.stdout || "";
    const stderr = result.stderr || "";
    if (result.error) {
      appendBlock(stderrParts, "[sentry-status] " + check.key + " launch-error=" + evidenceFailureCode(result.error));
      hardFailure = true;
    }

    const status = extractStatus(stdout + "\n" + stderr);
    statuses[check.key] = status;
    if (status === "FAIL" || result.status === 1) hardFailure = true;
  }

  const orderedSummary = CHECKS.map((check) => check.key + "=" + statuses[check.key]).join(" ");
  const allPass = CHECKS.every((check) => statuses[check.key] === "PASS");
  const finalStatus = hardFailure ? "FAIL" : required && !allPass ? "UNVERIFIED" : "SUMMARY";
  const exitCode = hardFailure ? 1 : required && !allPass ? 2 : 0;
  stdoutParts.push("[sentry-status] " + finalStatus + " - " + orderedSummary);

  return {
    exitCode,
    stdout: stdoutParts.join("\n") + "\n",
    stderr: stderrParts.length > 0 ? stderrParts.join("\n") + "\n" : "",
  };
}

function main() {
  const result = runSentryStatus();
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exit(result.exitCode);
}

if (require.main === module) {
  main();
}

module.exports = {
  runSentryStatus,
};
