#!/usr/bin/env node
"use strict";

/**
 * Configure the GitHub Actions names needed for live Sentry proof.
 *
 * Safety model:
 * - dry-run by default;
 * - real GitHub writes require ZENFLOW_SENTRY_GITHUB_APPLY=true;
 * - secrets and variables are sent to gh via stdin, never as command args;
 * - output lists names/status only and never prints values.
 */

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = process.env.ZENFLOW_SENTRY_ENV_ROOT || process.cwd();

const APPLY = process.env.ZENFLOW_SENTRY_GITHUB_APPLY === "true";
const REQUIRED_SECRETS = ["VITE_SENTRY_DSN", "SENTRY_AUTH_TOKEN"];
const REQUIRED_VARIABLES = ["SENTRY_ORG", "SENTRY_PROJECT"];
const OPTIONAL_VARIABLES = ["SENTRY_BASE_URL"];

function loadEnvFile(file, env = process.env, rootDir = ROOT) {
  const target = path.join(rootDir, file);
  if (!fs.existsSync(target)) return;

  for (const rawLine of fs.readFileSync(target, "utf8").split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const key = match[1];
    if (env[key]) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
}

function loadLocalEnv(env = process.env, rootDir = ROOT) {
  loadEnvFile(".env.local", env, rootDir);
  loadEnvFile(".env.production", env, rootDir);
  loadEnvFile(".env", env, rootDir);
  return env;
}

loadLocalEnv();

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    ...options,
  });
}

function result(status, message, exitCode) {
  return { status, message, exitCode };
}

function print(resultValue) {
  console.log("[sentry-github-apply] " + resultValue.status + " - " + resultValue.message);
  process.exitCode = resultValue.exitCode;
}

function isPlaceholderValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return true;
  const normalized = raw.toLowerCase();
  return (
    /^<[^>]+>$/.test(raw) ||
    normalized === "todo" ||
    normalized === "changeme" ||
    normalized.startsWith("your-") ||
    normalized.startsWith("your_") ||
    normalized.startsWith("set-") ||
    normalized.startsWith("set_") ||
    normalized.includes("placeholder")
  );
}

function isUsableSentryDsn(value) {
  const dsn = String(value || "").trim();
  if (!dsn || isPlaceholderValue(dsn)) return false;

  try {
    const url = new URL(dsn);
    return url.protocol === "https:" && /(^|\.)sentry\.io$/i.test(url.hostname);
  } catch {
    return false;
  }
}

function isUsableSecretOrSlug(value) {
  return !isPlaceholderValue(value);
}

function collectConfig(env = process.env) {
  const missing = [];
  if (!isUsableSentryDsn(env.VITE_SENTRY_DSN)) missing.push("VITE_SENTRY_DSN");
  for (const name of ["SENTRY_AUTH_TOKEN", "SENTRY_ORG", "SENTRY_PROJECT"]) {
    if (!isUsableSecretOrSlug(env[name])) missing.push(name);
  }
  for (const name of OPTIONAL_VARIABLES) {
    if (env[name] && !isUsableSecretOrSlug(env[name])) missing.push(name);
  }

  return {
    missing,
    secrets: REQUIRED_SECRETS.map((name) => ({ name, value: String(env[name] || "") })),
    variables: [
      ...REQUIRED_VARIABLES.map((name) => ({ name, value: String(env[name] || "") })),
      ...OPTIONAL_VARIABLES.filter((name) => env[name] && isUsableSecretOrSlug(env[name])).map((name) => ({
        name,
        value: String(env[name]),
      })),
    ],
  };
}

function repoFromGitRemote(cwd) {
  const origin = run("git", ["remote", "get-url", "origin"], { cwd });
  if (origin.status !== 0) return "";

  const raw = origin.stdout.trim();
  const match = raw.match(/github\.com[:/](.+?)(?:\.git)?$/i);
  return match ? match[1] : "";
}

function resolveRepo(env = process.env, { allowGh = APPLY, cwd = process.cwd() } = {}) {
  if (env.ZENFLOW_GITHUB_REPO && env.ZENFLOW_GITHUB_REPO.trim()) return env.ZENFLOW_GITHUB_REPO.trim();

  if (allowGh) {
    const repoView = run("gh", ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]);
    if (repoView.status === 0 && repoView.stdout.trim()) return repoView.stdout.trim();
  }

  return repoFromGitRemote(cwd);
}

function writeGitHubValue(kind, repo, name, value) {
  const write = run("gh", [kind, "set", name, "--repo", repo], { input: value });
  if (write.status === 0) return null;

  const detail = [write.stderr, write.stdout]
    .filter(Boolean)
    .join(" ")
    .trim()
    .replaceAll(String(value || ""), "[redacted]");
  return "could not set GitHub " + kind + " " + name + (detail ? ": " + detail : "");
}

function applySentryGithub({ env = process.env, cwd = process.cwd(), rootDir = ROOT } = {}) {
  loadLocalEnv(env, rootDir);
  const config = collectConfig(env);
  if (config.missing.length > 0) {
    return result(
      "UNVERIFIED",
      "Sentry GitHub setup skipped; missing or placeholder input name(s): " + config.missing.join(", ") + "; see docs/SENTRY_LIVE_PROOF.md",
      2,
    );
  }

  const repo = resolveRepo(env, { allowGh: APPLY, cwd });
  if (!repo) return result("UNVERIFIED", "could not resolve GitHub repository", 2);

  const plannedNames = [
    ...config.secrets.map((item) => item.name),
    ...config.variables.map((item) => item.name),
  ];

  if (!APPLY) {
    return result(
      "DRY-RUN",
      "ready to update " + plannedNames.join(", ") + " for " + repo + "; set ZENFLOW_SENTRY_GITHUB_APPLY=true to write",
      0,
    );
  }

  for (const item of config.secrets) {
    const failure = writeGitHubValue("secret", repo, item.name, item.value);
    if (failure) return result("FAIL", failure, 1);
  }
  for (const item of config.variables) {
    const failure = writeGitHubValue("variable", repo, item.name, item.value);
    if (failure) return result("FAIL", failure, 1);
  }

  return result(
    "PASS",
    "updated GitHub Sentry secret/variable name(s): " + plannedNames.join(", ") + " for " + repo,
    0,
  );
}

function main() {
  print(applySentryGithub());
}

if (require.main === module) {
  main();
}

module.exports = {
  applySentryGithub,
  collectConfig,
  loadEnvFile,
  loadLocalEnv,
  isPlaceholderValue,
  isUsableSentryDsn,
  resolveRepo,
};
