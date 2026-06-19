#!/usr/bin/env node
"use strict";

/**
 * Read-only Sentry API smoke.
 *
 * Uses the same project-level list-issues endpoint as the Sentry skill, but
 * returns only status/count evidence. Never prints auth tokens, raw events,
 * issue titles, stack traces, user data, or response bodies.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const REQUIRED_KEYS = ["SENTRY_AUTH_TOKEN", "SENTRY_ORG", "SENTRY_PROJECT"];
const DEFAULT_BASE_URL = "https://sentry.io";
const DEFAULT_ENVIRONMENT = "prod";
const DEFAULT_TIME_RANGE = "24h";

function loadEnvFile(file) {
  const target = path.join(ROOT, file);
  if (!fs.existsSync(target)) return;

  for (const line of fs.readFileSync(target, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const key = match[1];
    const rawValue = match[2];
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env.production");
loadEnvFile(".env");

function buildResult(status, message, exitCode) {
  return { status, message, exitCode };
}

function printAndExit(result) {
  console.log("[sentry-api] " + result.status + " - " + result.message);
  process.exit(result.exitCode);
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

function missingRequiredKeys(env) {
  return REQUIRED_KEYS.filter((key) => isPlaceholderValue(env[key]));
}

function normalizeBaseUrl(value) {
  const raw = String(value || DEFAULT_BASE_URL).trim();
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLocalhost)) {
    return null;
  }
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  parsed.search = "";
  parsed.hash = "";
  return parsed;
}

function buildIssuesUrl(baseUrl, org, project, env = process.env) {
  const endpoint =
    "/api/0/projects/" +
    encodeURIComponent(org) +
    "/" +
    encodeURIComponent(project) +
    "/issues/";
  const url = new URL(endpoint, baseUrl);
  url.searchParams.set("environment", env.SENTRY_ENVIRONMENT || DEFAULT_ENVIRONMENT);
  url.searchParams.set("statsPeriod", env.SENTRY_TIME_RANGE || DEFAULT_TIME_RANGE);
  url.searchParams.set("query", "is:unresolved");
  url.searchParams.set("limit", "1");
  return url;
}

async function smokeSentryApi({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const required = env.ZENFLOW_SENTRY_API_REQUIRED === "true";
  if (typeof fetchImpl !== "function") {
    return buildResult(
      "UNVERIFIED",
      "fetch implementation unavailable before Sentry API proof",
      required ? 2 : 0,
    );
  }
  const missing = missingRequiredKeys(env);
  if (missing.length > 0) {
    return buildResult(
      "UNVERIFIED",
      "missing or placeholder live Sentry API env: " + missing.join(", ") + "; see docs/SENTRY_LIVE_PROOF.md",
      required ? 2 : 0,
    );
  }

  const baseUrl = normalizeBaseUrl(env.SENTRY_BASE_URL);
  if (!baseUrl) {
    return buildResult("UNVERIFIED", "SENTRY_BASE_URL is invalid or not HTTPS", required ? 2 : 0);
  }

  const url = buildIssuesUrl(baseUrl, env.SENTRY_ORG, env.SENTRY_PROJECT, env);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: "Bearer " + env.SENTRY_AUTH_TOKEN,
        "user-agent": "zenflow-sentry-api-smoke/1.0",
      },
      signal: controller.signal,
    });
  } catch (error) {
    const reason = error && error.name === "AbortError" ? "request timed out" : "request failed";
    return buildResult("UNVERIFIED", reason + " before Sentry API proof", required ? 2 : 0);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    return buildResult(
      "FAIL",
      "Sentry list-issues API rejected the request: status=" + response.status,
      1,
    );
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    return buildResult("FAIL", "Sentry list-issues API returned non-JSON response", 1);
  }

  if (!Array.isArray(payload)) {
    return buildResult("FAIL", "Sentry list-issues API returned unexpected payload shape", 1);
  }

  return buildResult("PASS", "Sentry list-issues API reachable; issuesSample=" + payload.length, 0);
}

async function main() {
  const result = await smokeSentryApi();
  printAndExit(result);
}

if (require.main === module) {
  main().catch(() => {
    printAndExit(
      buildResult(
        "UNVERIFIED",
        "unexpected Sentry API smoke error",
        process.env.ZENFLOW_SENTRY_API_REQUIRED === "true" ? 2 : 0,
      ),
    );
  });
}

module.exports = {
  buildIssuesUrl,
  normalizeBaseUrl,
  smokeSentryApi,
};
