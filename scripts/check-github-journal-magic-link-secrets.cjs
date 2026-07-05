#!/usr/bin/env node
"use strict";

/**
 * GitHub readiness check for journal Magic Link live proof.
 *
 * This script never prints GitHub secret or variable values. It only checks
 * that the release repository exposes the names needed for the live proof.
 */

const { spawnSync } = require("node:child_process");

const REQUIRED = process.env.ZENFLOW_GITHUB_JOURNAL_MAGIC_LINK_SECRETS_REQUIRED === "true" || process.argv.includes("--require-pass");
const REQUIRED_SECRETS = [
  "VITE_SUPABASE_URL",
  "SUPABASE_ACCESS_TOKEN",
  "ZENFLOW_JOURNAL_MAGIC_LINK_SMOKE_EMAIL",
  "ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL",
  "ZENFLOW_AUTH_SMTP_ADMIN_EMAIL",
  "ZENFLOW_AUTH_SMTP_HOST",
  "ZENFLOW_AUTH_SMTP_PORT",
  "ZENFLOW_AUTH_SMTP_USER",
  "ZENFLOW_AUTH_SMTP_PASS",
  "ZENFLOW_AUTH_SMTP_SENDER_NAME",
];
const REQUIRED_SECRET_ALTERNATIVES = [
  ["VITE_SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_ANON_KEY"],
];
const REQUIRED_VARIABLES = [
  "SUPABASE_PROJECT_REF",
  "VITE_JOURNAL_MAGIC_LINK_LIVE_READY",
  "ZENFLOW_JOURNAL_MAGIC_LINK_CONSUME_CAPTURED_URL",
];
const FROM_ENV = process.env.ZENFLOW_GITHUB_JOURNAL_MAGIC_LINK_FROM_ENV === "true";

function run(command, args) {
  return spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
}

function stop(status, message, exitCode = 0) {
  console.log("[journal-magic-link-github] " + status + " - " + message);
  process.exit(exitCode);
}

function resolveRepo() {
  if (process.env.ZENFLOW_GITHUB_REPO) return process.env.ZENFLOW_GITHUB_REPO;

  const repoView = run("gh", ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]);
  if (repoView.status === 0 && repoView.stdout.trim()) return repoView.stdout.trim();

  const origin = run("git", ["remote", "get-url", "origin"]);
  if (origin.status !== 0) return "";

  const raw = origin.stdout.trim();
  const httpsMatch = raw.match(/github\.com[:/](.+?)(?:\.git)?$/i);
  return httpsMatch ? httpsMatch[1] : "";
}

function parseNameList(output) {
  const trimmed = output.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => (typeof item === "string" ? item : item && item.name))
        .filter((name) => typeof name === "string" && name.length > 0);
    }
  } catch {
    // Fall through to line-based parsing for older gh output.
  }

  return trimmed
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function listGhNames(repo, kind) {
  const result = run("gh", [kind, "list", "--repo", repo, "--json", "name"]);
  if (result.status !== 0) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join(" ").trim();
    stop(
      "UNVERIFIED",
      "could not list GitHub " + kind + "s for " + repo + (detail ? ": " + detail : ""),
      REQUIRED ? 2 : 0,
    );
  }
  return new Set(parseNameList(result.stdout));
}

function envPresenceName(kind, name) {
  return "ZENFLOW_GITHUB_" + kind.toUpperCase() + "_" + name + "_PRESENT";
}

function hasTruthyEnv(name) {
  return String(process.env[name] || "").trim().toLowerCase() === "true";
}

function namesFromPresenceEnv(kind, requiredNames, alternativeGroups = []) {
  const available = new Set();
  const names = [...requiredNames, ...alternativeGroups.flat()];
  for (const name of names) {
    if (hasTruthyEnv(envPresenceName(kind, name))) {
      available.add(name);
    }
  }
  return available;
}

function missingSecretAlternatives(available) {
  return REQUIRED_SECRET_ALTERNATIVES
    .filter((group) => group.every((name) => !available.has(name)))
    .map((group) => group.join(" or "));
}

function main() {
  const repo = resolveRepo();
  if (!repo) {
    stop("UNVERIFIED", "could not resolve GitHub repository", REQUIRED ? 2 : 0);
  }

  const secrets = FROM_ENV
    ? namesFromPresenceEnv("secret", REQUIRED_SECRETS, REQUIRED_SECRET_ALTERNATIVES)
    : listGhNames(repo, "secret");
  const variables = FROM_ENV
    ? namesFromPresenceEnv("variable", REQUIRED_VARIABLES)
    : listGhNames(repo, "variable");
  const missingSecrets = REQUIRED_SECRETS.filter((name) => !secrets.has(name));
  const missingAlternatives = missingSecretAlternatives(secrets);
  const missingVariables = REQUIRED_VARIABLES.filter((name) => !variables.has(name));
  const missing = [...missingSecrets, ...missingAlternatives, ...missingVariables];

  if (missing.length > 0) {
    stop(
      REQUIRED ? "FAIL" : "PARTIAL",
      repo + " is missing journal Magic Link GitHub name(s): " + missing.join(", ") + "; see docs/JOURNAL_MAGIC_LINK_LIVE_PROOF.md",
      REQUIRED ? 1 : 0,
    );
  }

  stop(
    "PASS",
    repo + " has all journal Magic Link GitHub secret/variable names needed for live proof",
  );
}

main();
