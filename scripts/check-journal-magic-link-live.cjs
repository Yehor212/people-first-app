#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const REQUIRED = process.env.ZENFLOW_JOURNAL_MAGIC_LINK_LIVE_REQUIRED === "true";
const SEND_SMOKE = process.env.ZENFLOW_JOURNAL_MAGIC_LINK_SEND_SMOKE === "true";
const ALLOW_REAL_EMAIL = process.env.ZENFLOW_JOURNAL_MAGIC_LINK_ALLOW_REAL_EMAIL === "true";
const VERIFY_CAPTURED_URL = process.env.ZENFLOW_JOURNAL_MAGIC_LINK_VERIFY_CAPTURED_URL === "true";
const CONSUME_CAPTURED_URL = process.env.ZENFLOW_JOURNAL_MAGIC_LINK_CONSUME_CAPTURED_URL === "true";
const DEFAULT_REDIRECT_TO = "https://yehor212.github.io/people-first-app/";

const SAFE_ENV_FILES = [".env.local", ".env.production", ".env"];
const SAFE_ENV_KEYS = new Set([
  "VITE_SUPABASE_URL",
  "SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_ANON_KEY",
  "ZENFLOW_JOURNAL_MAGIC_LINK_REDIRECT_TO",
]);

function loadSafeEnvFiles() {
  for (const fileName of SAFE_ENV_FILES) {
    const filePath = path.join(ROOT, fileName);
    if (!fs.existsSync(filePath)) continue;
    for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match || !SAFE_ENV_KEYS.has(match[1]) || process.env[match[1]]) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[match[1]] = value;
    }
  }
}

function isPlaceholderValue(value) {
  const raw = String(value || "").trim();
  const normalized = raw.toLowerCase();
  return (
    !raw ||
    /^<[^>]+>$/.test(raw) ||
    normalized === "todo" ||
    normalized === "changeme" ||
    normalized.startsWith("your-") ||
    normalized.startsWith("your_") ||
    normalized.startsWith("set-") ||
    normalized.startsWith("set_") ||
    normalized.includes("placeholder") ||
    normalized.includes("your-project-ref") ||
    normalized === "sb_publishable_your_public_key" ||
    normalized === "your_supabase_anon_key"
  );
}

function publicEnvPresence(key) {
  if (!process.env[key]) return "missing";
  return isPlaceholderValue(process.env[key]) ? "placeholder" : "present";
}

function getSupabaseUrl() {
  return String(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
}

function getPublicKey() {
  return String(process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "").trim();
}

function isValidSupabaseUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (
      /^[a-z0-9]{20}\.supabase\.co$/i.test(url.hostname) ||
      url.hostname === "api.zenflowapp.online"
    );
  } catch {
    return false;
  }
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function isExpectedCapturedMagicLink(value) {
  if (!value || isPlaceholderValue(value)) return false;
  try {
    const url = new URL(value);
    const redirectTo = url.searchParams.get("redirect_to") || url.searchParams.get("redirectTo") || "";
    const type = url.searchParams.get("type") || "";
    return (
      url.protocol === "https:" &&
      /\/auth\/v1\/verify\b/.test(url.pathname) &&
      type.toLowerCase() === "magiclink" &&
      (!redirectTo || redirectTo.startsWith(DEFAULT_REDIRECT_TO))
    );
  } catch {
    return false;
  }
}

function output(status, reason, details = []) {
  console.log("[journal-magic-link-live] " + status + " - " + reason);
  console.log("[journal-magic-link-live] required=" + (REQUIRED ? "true" : "false"));
  console.log("[journal-magic-link-live] send_smoke=" + (SEND_SMOKE ? "true" : "false"));
  console.log("[journal-magic-link-live] verify_captured_url=" + (VERIFY_CAPTURED_URL ? "true" : "false"));
  console.log(
    "[journal-magic-link-live] public_env: VITE_SUPABASE_URL=" + publicEnvPresence("VITE_SUPABASE_URL") +
      ", VITE_SUPABASE_PUBLISHABLE_KEY=" + publicEnvPresence("VITE_SUPABASE_PUBLISHABLE_KEY") +
      ", VITE_SUPABASE_ANON_KEY=" + publicEnvPresence("VITE_SUPABASE_ANON_KEY")
  );
  for (const detail of details) {
    console.log("[journal-magic-link-live] " + detail);
  }
  process.exit(status === "PASS" || !REQUIRED ? 0 : 2);
}

async function sendOtpSmoke({ supabaseUrl, publicKey, email }) {
  const response = await fetch(new URL("/auth/v1/otp", supabaseUrl), {
    method: "POST",
    headers: {
      apikey: publicKey,
      authorization: "Bearer " + publicKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email,
      create_user: false,
      data: { source: "zenflow-ci-readiness" },
      gotrue_meta_security: {},
    }),
  });
  if (!response.ok) {
    throw new Error("Supabase OTP endpoint returned HTTP " + response.status);
  }
}

async function main() {
  loadSafeEnvFiles();

  const supabaseUrl = getSupabaseUrl();
  const publicKey = getPublicKey();
  const issues = [];

  if (!isValidSupabaseUrl(supabaseUrl)) {
    issues.push("missing_or_invalid_supabase_url");
  }
  if (isPlaceholderValue(publicKey)) {
    issues.push("missing_public_supabase_browser_key");
  }
  if (VERIFY_CAPTURED_URL && !isExpectedCapturedMagicLink(process.env.ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL)) {
    issues.push("missing_or_invalid_captured_magic_link_url");
  }
  if (CONSUME_CAPTURED_URL) {
    issues.push("consume_captured_url_not_supported_in_ci");
  }
  if (SEND_SMOKE) {
    if (!ALLOW_REAL_EMAIL) issues.push("real_email_smoke_not_allowed");
    if (!isValidEmail(process.env.ZENFLOW_JOURNAL_MAGIC_LINK_SMOKE_EMAIL)) {
      issues.push("missing_or_invalid_smoke_email");
    }
  }

  if (issues.length > 0) {
    output("UNVERIFIED", "Journal Magic Link live readiness is incomplete", issues.map((issue) => "issue=" + issue));
    return;
  }

  if (SEND_SMOKE) {
    await sendOtpSmoke({
      supabaseUrl,
      publicKey,
      email: String(process.env.ZENFLOW_JOURNAL_MAGIC_LINK_SMOKE_EMAIL || "").trim(),
    });
    output("PASS", "Supabase Magic Link OTP endpoint accepted the owner-approved smoke request without printing secrets");
    return;
  }

  output(
    "PASS",
    REQUIRED
      ? "Journal Magic Link live prerequisites are configured; proof-status gate must still hold live evidence"
      : "Journal Magic Link live gate is advisory because the live-ready flag is not enabled"
  );
}

main().catch((error) => {
  output("UNVERIFIED", error.message || String(error));
});
