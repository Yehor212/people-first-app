#!/usr/bin/env node
"use strict";

/**
 * GitHub Sentry readiness check.
 *
 * This script never prints secret or variable values. It only checks whether
 * the release repository has the GitHub secret/variable names required for
 * live Sentry API/source-map proof.
 */

const { spawnSync } = require("node:child_process");

const REQUIRED = process.env.ZENFLOW_GITHUB_SENTRY_SECRETS_REQUIRED === "true";
const REQUIRED_SECRETS = ["VITE_SENTRY_DSN", "SENTRY_AUTH_TOKEN"];
const REQUIRED_VARIABLES = ["SENTRY_ORG", "SENTRY_PROJECT"];

function run(command, args) {
  return spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
}

function stop(status, message, exitCode = 0) {
  console.log("[sentry-github] " + status + " - " + message);
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
    // Fall through to line-based parsing for older gh -q style output.
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

function main() {
  const repo = resolveRepo();
  if (!repo) {
    stop("UNVERIFIED", "could not resolve GitHub repository", REQUIRED ? 2 : 0);
  }

  const secrets = listGhNames(repo, "secret");
  const variables = listGhNames(repo, "variable");
  const missingSecrets = REQUIRED_SECRETS.filter((name) => !secrets.has(name));
  const missingVariables = REQUIRED_VARIABLES.filter((name) => !variables.has(name));
  const missing = [...missingSecrets, ...missingVariables];

  if (missing.length > 0) {
    stop(
      REQUIRED ? "FAIL" : "PARTIAL",
      repo + " is missing Sentry GitHub name(s): " + missing.join(", ") + "; see docs/SENTRY_LIVE_PROOF.md",
      REQUIRED ? 1 : 0,
    );
  }

  stop(
    "PASS",
    repo + " has all " + REQUIRED_SECRETS.length + " Sentry secret name(s) and " + REQUIRED_VARIABLES.length + " variable name(s)",
  );
}

main();
