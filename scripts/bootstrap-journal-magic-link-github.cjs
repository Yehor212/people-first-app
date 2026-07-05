#!/usr/bin/env node
"use strict";

/**
 * Safely installs GitHub names required for the journal Magic Link live proof.
 *
 * Secret values are never printed and are passed to gh through stdin, not argv.
 * This script refuses placeholders, stale app callbacks, and captured URLs that
 * are not the Supabase /auth/v1/verify URL from a delivered email.
 */

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const TRUSTED_SUPABASE_AUTH_HOSTS = new Set(["bwgfslmxmueyglpumkbf.supabase.co", "api.zenflowapp.online"]);
const CANONICAL_GITHUB_REPO = "Yehor212/people-first-app";
const GITHUB_PAGES_AUTH_BASE = "https://yehor212.github.io/people-first-app";
const JOURNAL_RESET_PARAM = "journalReset";
const SMOKE_NONCE = "00000000000000000000000000000000";
const CAPTURED_URL_SECRET_NAME = "ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL";
const ENV_FILE_NAMES = [".env.local", ".env", ".env.production"];
const V2_AUTH_ROUTES = ["orb", "habits", "diary", "planning", "settings"];
const SAFE_ENV_FILE_KEYS = new Set([
  "SUPABASE_PROJECT_REF",
  "PROJECT_REF",
  "SUPABASE_PROJECT_ID",
  "VITE_SUPABASE_URL",
  "SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_ANON_KEY",
]);

function line(status, message) {
  console.log("[journal-magic-link-bootstrap] " + status + " - " + message);
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
    normalized.includes("placeholder") ||
    normalized.includes("your-project-ref") ||
    normalized === "https://your-project-ref.supabase.co" ||
    normalized === "sb_publishable_your_public_key" ||
    normalized === "your_supabase_anon_key" ||
    normalized === "your-access-token" ||
    normalized === "dedicated-smoke-inbox@example.com" ||
    normalized === "set-in-shell-only"
  );
}

function parseSafeEnvFiles(rootDir = process.cwd()) {
  const env = new Map();
  for (const fileName of ENV_FILE_NAMES) {
    const filePath = path.join(rootDir, fileName);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const trimmed = rawLine.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match || !SAFE_ENV_FILE_KEYS.has(match[1])) continue;

      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (value && !isPlaceholderValue(value) && !env.has(match[1])) env.set(match[1], value);
    }
  }
  return env;
}

function getSafeEnvValue(env, safeFileEnv, key) {
  const direct = String(env[key] || "").trim();
  if (direct && !isPlaceholderValue(direct)) return direct;
  return safeFileEnv.get(key) || "";
}

function getSupabaseUrl(env, safeFileEnv) {
  return getSafeEnvValue(env, safeFileEnv, "VITE_SUPABASE_URL") || getSafeEnvValue(env, safeFileEnv, "SUPABASE_URL");
}

function getSupabasePublicKeyPair(env, safeFileEnv) {
  const publishable = getSafeEnvValue(env, safeFileEnv, "VITE_SUPABASE_PUBLISHABLE_KEY");
  if (publishable) return ["VITE_SUPABASE_PUBLISHABLE_KEY", publishable];
  const anon = getSafeEnvValue(env, safeFileEnv, "VITE_SUPABASE_ANON_KEY");
  if (anon) return ["VITE_SUPABASE_ANON_KEY", anon];
  return ["", ""];
}

function getProjectRef(env, safeFileEnv) {
  const explicit =
    getSafeEnvValue(env, safeFileEnv, "SUPABASE_PROJECT_REF") ||
    getSafeEnvValue(env, safeFileEnv, "PROJECT_REF") ||
    getSafeEnvValue(env, safeFileEnv, "SUPABASE_PROJECT_ID");
  if (explicit) return explicit;

  const supabaseUrl = getSupabaseUrl(env, safeFileEnv);
  try {
    const hostname = new URL(supabaseUrl).hostname;
    const match = hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    return (match && match[1]) || "";
  } catch {
    return "";
  }
}

function normalizeBoolean(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

function normalizeGithubRepo(repo) {
  const raw = String(repo || "").trim();
  if (!raw) return "";
  return raw
    .replace(/^https:\/\/github\.com\//i, "")
    .replace(/^git@github\.com:/i, "")
    .replace(/\.git$/i, "")
    .replace(/^\/+|\/+$/g, "");
}

function validateCanonicalGithubRepo(repo) {
  const normalized = normalizeGithubRepo(repo);
  if (!normalized) return "GitHub repository could not be resolved";
  if (normalized.toLowerCase() !== CANONICAL_GITHUB_REPO.toLowerCase()) {
    return "GitHub repository must be " + CANONICAL_GITHUB_REPO;
  }
  return "";
}

function isValidEmail(email) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email || ""));
}

function isReservedTestEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  return /@(example\.(com|org|net)|example\.test|invalid|localhost)$/.test(normalized) || normalized.endsWith(".test");
}

function getJournalResetNonceFromUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const searchNonce = String(url.searchParams.get(JOURNAL_RESET_PARAM) || "").trim();
    if (searchNonce) return searchNonce;
    return String(new URLSearchParams(url.hash.replace(/^#/, "")).get(JOURNAL_RESET_PARAM) || "").trim();
  } catch {
    return "";
  }
}

function isTrustedJournalCallbackUrl(rawUrl, expectedNonce) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  if (getJournalResetNonceFromUrl(parsed.toString()) !== expectedNonce) return false;

  if (parsed.protocol === "com.zenflow.app:") {
    return parsed.hostname === "login-callback" && (parsed.pathname === "" || parsed.pathname === "/");
  }

  if (parsed.protocol !== "https:") return false;
  if (parsed.hostname !== "yehor212.github.io") return false;

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments[0] !== "people-first-app") return false;
  if (segments.length === 1) return true;
  if (segments.length !== 2) return false;
  if (!V2_AUTH_ROUTES.includes(segments[1])) return false;
  if (parsed.searchParams.get("nav") !== "v2") return false;

  const navLayout = parsed.searchParams.get("navLayout") || "";
  return !navLayout || navLayout === "phone" || navLayout === "web";
}

function isTrustedSupabaseMagicLinkUrl(parsed, expectedNonce) {
  if (parsed.protocol !== "https:") return false;
  if (!TRUSTED_SUPABASE_AUTH_HOSTS.has(parsed.hostname)) return false;
  if (parsed.pathname !== "/auth/v1/verify") return false;

  const type = parsed.searchParams.get("type");
  if (type && type !== "magiclink") return false;
  if (!parsed.searchParams.get("token") && !parsed.searchParams.get("token_hash")) return false;

  const redirectTo = parsed.searchParams.get("redirect_to") || parsed.searchParams.get("redirectTo") || "";
  return Boolean(redirectTo && isTrustedJournalCallbackUrl(redirectTo, expectedNonce));
}

function validateCapturedUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || "").trim());
  } catch {
    return "ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL is not parseable";
  }

  if (isTrustedJournalCallbackUrl(parsed.toString(), SMOKE_NONCE)) {
    return "ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL must be the Supabase verify URL, not the redirected app callback";
  }
  if (!isTrustedSupabaseMagicLinkUrl(parsed, SMOKE_NONCE)) {
    return "ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL is not a trusted Supabase verify URL for the journal smoke nonce";
  }
  return "";
}

function resolveRepo(env) {
  if (env.ZENFLOW_GITHUB_REPO) return normalizeGithubRepo(env.ZENFLOW_GITHUB_REPO);

  const repoView = spawnSync("gh", ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"], {
    encoding: "utf8",
  });
  if (repoView.status === 0 && repoView.stdout.trim()) return normalizeGithubRepo(repoView.stdout.trim());

  const origin = spawnSync("git", ["remote", "get-url", "origin"], { encoding: "utf8" });
  if (origin.status !== 0) return "";
  const match = origin.stdout.trim().match(/github\.com[:/](.+?)(?:\.git)?$/i);
  return match ? normalizeGithubRepo(match[1]) : "";
}

async function validateSupabaseAccessToken(projectRef, token, env) {
  if (normalizeBoolean(env.ZENFLOW_JOURNAL_MAGIC_LINK_BOOTSTRAP_OFFLINE)) return "";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch("https://api.supabase.com/v1/projects/" + encodeURIComponent(projectRef) + "/config/auth", {
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      return "SUPABASE_ACCESS_TOKEN failed Supabase Management API validation";
    }
    return "";
  } catch {
    return "SUPABASE_ACCESS_TOKEN could not be validated against Supabase Management API";
  } finally {
    clearTimeout(timeout);
  }
}

function buildPacket(env = process.env, rootDir = process.cwd()) {
  const safeFileEnv = parseSafeEnvFiles(rootDir);
  const errors = [];
  const secrets = new Map();
  const variables = new Map();

  const repo = resolveRepo(env);
  const repoError = validateCanonicalGithubRepo(repo);
  if (repoError) errors.push(repoError);

  const projectRef = getProjectRef(env, safeFileEnv);
  const supabaseUrl = getSupabaseUrl(env, safeFileEnv);
  const [publicKeyName, publicKey] = getSupabasePublicKeyPair(env, safeFileEnv);
  const token = String(env.SUPABASE_ACCESS_TOKEN || "").trim();
  const smokeEmail = String(env.ZENFLOW_JOURNAL_MAGIC_LINK_SMOKE_EMAIL || "").trim();
  const capturedUrl = String(env.ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL || "").trim();

  if (!projectRef) errors.push("SUPABASE_PROJECT_REF is missing");
  if (!supabaseUrl) errors.push("VITE_SUPABASE_URL is missing");
  if (!publicKeyName || !publicKey) errors.push("VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY is missing");

  if (!token || isPlaceholderValue(token) || !/^sbp_[A-Za-z0-9_.-]{20,}$/.test(token)) {
    errors.push("SUPABASE_ACCESS_TOKEN is missing, placeholder, or not a Supabase personal access token shape");
  }

  if (!smokeEmail || isPlaceholderValue(smokeEmail) || !isValidEmail(smokeEmail)) {
    errors.push("ZENFLOW_JOURNAL_MAGIC_LINK_SMOKE_EMAIL is missing, placeholder, or not an email address");
  } else if (isReservedTestEmail(smokeEmail) && !normalizeBoolean(env.ZENFLOW_JOURNAL_MAGIC_LINK_BOOTSTRAP_OFFLINE)) {
    errors.push("ZENFLOW_JOURNAL_MAGIC_LINK_SMOKE_EMAIL must be a real controlled inbox, not a reserved test domain");
  } else if (!normalizeBoolean(env.ZENFLOW_JOURNAL_MAGIC_LINK_CONFIRM_SMOKE_INBOX)) {
    errors.push("ZENFLOW_JOURNAL_MAGIC_LINK_CONFIRM_SMOKE_INBOX must be true before storing the smoke inbox secret");
  }

  if (!capturedUrl || isPlaceholderValue(capturedUrl)) {
    errors.push("ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL is missing or placeholder");
  } else if (!normalizeBoolean(env.ZENFLOW_JOURNAL_MAGIC_LINK_CONFIRM_FRESH_CAPTURED_URL)) {
    errors.push("ZENFLOW_JOURNAL_MAGIC_LINK_CONFIRM_FRESH_CAPTURED_URL must be true before storing a one-time captured URL");
  } else {
    const capturedError = validateCapturedUrl(capturedUrl);
    if (capturedError) errors.push(capturedError);
  }

  if (supabaseUrl) secrets.set("VITE_SUPABASE_URL", supabaseUrl);
  if (publicKeyName && publicKey) secrets.set(publicKeyName, publicKey);
  if (token) secrets.set("SUPABASE_ACCESS_TOKEN", token);
  if (smokeEmail) secrets.set("ZENFLOW_JOURNAL_MAGIC_LINK_SMOKE_EMAIL", smokeEmail);
  if (capturedUrl) secrets.set(CAPTURED_URL_SECRET_NAME, capturedUrl);

  if (projectRef) variables.set("SUPABASE_PROJECT_REF", projectRef);
  variables.set("VITE_JOURNAL_MAGIC_LINK_LIVE_READY", normalizeBoolean(env.VITE_JOURNAL_MAGIC_LINK_LIVE_READY) ? "true" : "false");
  variables.set(
    "ZENFLOW_JOURNAL_MAGIC_LINK_CONSUME_CAPTURED_URL",
    normalizeBoolean(env.ZENFLOW_JOURNAL_MAGIC_LINK_CONSUME_CAPTURED_URL) ? "true" : "false",
  );

  return { repo, projectRef, errors, secrets, variables };
}

function runGh(args, options = {}) {
  return spawnSync("gh", args, {
    encoding: "utf8",
    input: options.input || undefined,
    maxBuffer: 1024 * 1024,
  });
}

function applyPacket(packet, { dryRun = true } = {}) {
  const failures = [];
  const repoError = validateCanonicalGithubRepo(packet.repo);
  if (repoError) return [repoError];

  for (const [name, value] of packet.secrets) {
    if (dryRun) {
      line("DRY-RUN", "would set GitHub secret " + name);
      continue;
    }
    const result = runGh(["secret", "set", name, "--repo", packet.repo], { input: value });
    if (result.status !== 0) failures.push("failed to set GitHub secret " + name);
    else line("APPLY", "set GitHub secret " + name);
  }

  for (const [name, value] of packet.variables) {
    if (dryRun) {
      line("DRY-RUN", "would set GitHub variable " + name);
      continue;
    }
    const result = runGh(["variable", "set", name, "--body", value, "--repo", packet.repo]);
    if (result.status !== 0) failures.push("failed to set GitHub variable " + name);
    else line("APPLY", "set GitHub variable " + name);
  }

  return failures;
}

function clearCapturedUrlSecret(repo, { dryRun = true } = {}) {
  const repoError = validateCanonicalGithubRepo(repo);
  if (repoError) return [repoError];
  if (dryRun) {
    line("DRY-RUN", "would delete GitHub secret " + CAPTURED_URL_SECRET_NAME);
    return [];
  }

  const result = runGh(["secret", "delete", CAPTURED_URL_SECRET_NAME, "--repo", repo]);
  if (result.status !== 0) {
    const errorText = String(result.stderr || result.stdout || "");
    if (errorText.includes("HTTP 404")) {
      line("APPLY", "GitHub secret " + CAPTURED_URL_SECRET_NAME + " was already absent");
      return [];
    }
    return ["failed to delete GitHub secret " + CAPTURED_URL_SECRET_NAME];
  }
  line("APPLY", "deleted GitHub secret " + CAPTURED_URL_SECRET_NAME);
  return [];
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const clearCapturedUrl = args.includes("--clear-captured-url");
  const dryRun = args.includes("--dry-run") || !apply;

  if (clearCapturedUrl) {
    const repo = resolveRepo(process.env);
    const failures = clearCapturedUrlSecret(repo, { dryRun });
    if (failures.length > 0) {
      for (const failure of failures) line("FAIL", failure);
      process.exit(1);
    }
    line("PASS", dryRun ? "validated captured URL secret cleanup" : "cleared captured URL secret");
    return;
  }

  const packet = buildPacket(process.env, process.cwd());

  if (packet.errors.length > 0) {
    for (const error of packet.errors) line("UNVERIFIED", error);
    process.exit(2);
  }

  const tokenError = await validateSupabaseAccessToken(
    packet.projectRef,
    packet.secrets.get("SUPABASE_ACCESS_TOKEN") || "",
    process.env,
  );
  if (tokenError) {
    line("UNVERIFIED", tokenError);
    process.exit(2);
  }

  const failures = applyPacket(packet, { dryRun });
  if (failures.length > 0) {
    for (const failure of failures) line("FAIL", failure);
    process.exit(1);
  }

  line("PASS", dryRun ? "validated GitHub journal Magic Link bootstrap packet" : "applied GitHub journal Magic Link bootstrap packet");
}

if (require.main === module) {
  main().catch(() => {
    line("FAIL", "unexpected bootstrap failure");
    process.exit(1);
  });
}

module.exports = {
  buildPacket,
  validateCapturedUrl,
  isTrustedSupabaseMagicLinkUrl,
  isTrustedJournalCallbackUrl,
  clearCapturedUrlSecret,
  validateCanonicalGithubRepo,
};
