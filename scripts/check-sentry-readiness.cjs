#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const REQUIRED = process.env.ZENFLOW_SENTRY_READINESS_REQUIRED === "true";
const REQUIRED_KEYS = ["SENTRY_AUTH_TOKEN", "SENTRY_ORG", "SENTRY_PROJECT"];
const OPTIONAL_KEYS = ["SENTRY_BASE_URL"];
const PUBLIC_KEYS = ["VITE_SENTRY_DSN"];

function loadEnvFile(file) {
  const target = path.join(ROOT, file);
  if (!fs.existsSync(target)) return;

  for (const line of fs.readFileSync(target, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env.production");
loadEnvFile(".env");

function isUsableSentryDsn(value) {
  const dsn = String(value || "").trim();
  if (!dsn) return false;

  try {
    const url = new URL(dsn);
    return url.protocol === "https:" && /(^|\.)sentry\.io$/i.test(url.hostname);
  } catch {
    return false;
  }
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

function isUsableSecretOrSlug(value) {
  return !isPlaceholderValue(value);
}

function presence(key) {
  if (!process.env[key]) return "missing";
  return isUsableSecretOrSlug(process.env[key]) ? "present" : "placeholder";
}

function summarize(keys) {
  return keys.map((key) => key + "=" + presence(key)).join(", ");
}

function finish(status, reason, missing = []) {
  console.log("[sentry-readiness] " + status + " - " + reason);
  console.log("[sentry-readiness] runtime: " + summarize(PUBLIC_KEYS));
  console.log("[sentry-readiness] upload/api: " + summarize(REQUIRED_KEYS));
  console.log("[sentry-readiness] optional: " + (summarize(OPTIONAL_KEYS) || "none"));
  if (missing.length > 0) {
    console.log("[sentry-readiness] missing_or_invalid: " + missing.join(", "));
  }
  if (status === "UNVERIFIED") {
    console.log(
      "[sentry-readiness] Set SENTRY_AUTH_TOKEN, SENTRY_ORG, and SENTRY_PROJECT locally or as CI secret/vars before claiming live Sentry issue/source-map proof. See docs/SENTRY_LIVE_PROOF.md."
    );
  }
  process.exit(status === "PASS" || !REQUIRED ? 0 : 2);
}

const missing = [];
if (!isUsableSentryDsn(process.env.VITE_SENTRY_DSN)) {
  missing.push("VITE_SENTRY_DSN");
}
for (const key of REQUIRED_KEYS) {
  if (!isUsableSecretOrSlug(process.env[key])) missing.push(key);
}

if (missing.length > 0) {
  finish("UNVERIFIED", "Sentry runtime or live API/upload env is incomplete", missing);
}

finish("PASS", "Sentry runtime DSN and live API/upload env are present");
