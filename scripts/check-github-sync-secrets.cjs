#!/usr/bin/env node
"use strict";

/**
 * GitHub secret readiness check for Telegram-grade sync closure.
 *
 * This script never prints secret values. It only checks whether the release
 * repository has the secret names required for the live same-account sync proof.
 */

const { spawnSync } = require("node:child_process");

const REQUIRED = process.env.ZENFLOW_GITHUB_SYNC_SECRETS_REQUIRED === "true";
const REQUIRED_SECRETS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "ZENFLOW_SYNC_TEST_EMAIL",
  "ZENFLOW_SYNC_TEST_PASSWORD",
];

function run(command, args) {
  return spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
}

function stop(status, message, exitCode = 0) {
  console.log(`[sync-secrets] ${status} - ${message}`);
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

function main() {
  const repo = resolveRepo();
  if (!repo) {
    stop("UNVERIFIED", "could not resolve GitHub repository", REQUIRED ? 2 : 0);
  }

  const secrets = run("gh", ["secret", "list", "--repo", repo, "--json", "name", "-q", ".[].name"]);
  if (secrets.status !== 0) {
    const detail = [secrets.stderr, secrets.stdout].filter(Boolean).join(" ").trim();
    stop("UNVERIFIED", `could not list GitHub secrets for ${repo}${detail ? `: ${detail}` : ""}`, REQUIRED ? 2 : 0);
  }

  const available = new Set(
    secrets.stdout
      .split(/\r?\n/)
      .map((name) => name.trim())
      .filter(Boolean),
  );
  const missing = REQUIRED_SECRETS.filter((name) => !available.has(name));

  if (missing.length > 0) {
    stop(
      REQUIRED ? "FAIL" : "PARTIAL",
      `${repo} is missing secret name(s): ${missing.join(", ")}`,
      REQUIRED ? 1 : 0,
    );
  }

  stop("PASS", `${repo} has all ${REQUIRED_SECRETS.length} Telegram sync drill secret names`);
}

main();
