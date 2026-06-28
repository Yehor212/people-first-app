#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { checkSupabaseRlsEvidence } = require("./supabase-public-readiness.cjs");

const ROOT = path.join(__dirname, "..");
const REQUIRED = process.env.ZENFLOW_SUPABASE_PUBLISHABLE_REQUIRED === "true";
const PUBLIC_KEYS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_ANON_KEY",
];

function loadEnvFile(file) {
  const target = path.join(ROOT, file);
  if (!fs.existsSync(target)) return;

  for (const line of fs.readFileSync(target, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (Object.prototype.hasOwnProperty.call(process.env, key)) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env.production");
loadEnvFile(".env");

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
    normalized.includes("placeholder") ||
    normalized.includes("your-project-ref") ||
    normalized === "sb_publishable_your_public_key" ||
    normalized === "your_supabase_anon_key"
  );
}

function isPresent(key) {
  return !isPlaceholderValue(process.env[key]);
}

function isModernPublishableKey(value) {
  const raw = String(value || "").trim();
  return !isPlaceholderValue(raw) && raw.startsWith("sb_publishable_");
}

function presence(key) {
  if (!process.env[key]) return "missing";
  return isPresent(key) ? "present" : "placeholder";
}

function summarize(keys) {
  return keys.map((key) => key + "=" + presence(key)).join(", ");
}

function finish(status, reason, missing = []) {
  console.log("[supabase-publishable-key] " + status + " - " + reason);
  console.log("[supabase-publishable-key] public_env: " + summarize(PUBLIC_KEYS));
  const rlsStatus = rlsEvidence.ok ? "present" : "missing";
  console.log("[supabase-publishable-key] RLS evidence=" + rlsStatus + " file=" + rlsEvidence.file);
  if (!rlsEvidence.ok) {
    console.log("[supabase-publishable-key] RLS missing: " + rlsEvidence.missing.join(", "));
  }
  if (missing.length > 0) {
    console.log("[supabase-publishable-key] missing_or_legacy: " + missing.join(", "));
  }
  if (status === "UNVERIFIED") {
    console.log(
      "[supabase-publishable-key] Set VITE_SUPABASE_PUBLISHABLE_KEY to a real sb_publishable... key from Supabase Dashboard > Project Settings > API Keys. Keep VITE_SUPABASE_ANON_KEY only as a temporary legacy anon fallback."
    );
  }
  process.exit(status === "PASS" || !REQUIRED ? 0 : 2);
}

const hasUrl = isPresent("VITE_SUPABASE_URL");
const hasPublishable = isModernPublishableKey(process.env.VITE_SUPABASE_PUBLISHABLE_KEY);
const hasLegacyAnon = isPresent("VITE_SUPABASE_ANON_KEY");
const rlsEvidence = checkSupabaseRlsEvidence(ROOT);

if (!hasUrl) {
  finish("UNVERIFIED", "Supabase public URL is missing or placeholder", ["VITE_SUPABASE_URL"]);
} else if (!rlsEvidence.ok) {
  finish("UNVERIFIED", rlsEvidence.reason, ["authenticated RLS evidence"]);
} else if (hasPublishable) {
  finish("PASS", "Modern Supabase publishable key is configured with authenticated RLS evidence and without printing it");
} else if (hasLegacyAnon) {
  finish(
    "UNVERIFIED",
    "Modern Supabase publishable key is missing; deploy is using legacy anon fallback",
    ["VITE_SUPABASE_PUBLISHABLE_KEY"]
  );
} else {
  finish("UNVERIFIED", "No Supabase public browser key is configured", [
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_ANON_KEY",
  ]);
}
