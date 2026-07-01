#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const ENV_FILE_NAMES = [".env.local", ".env", ".env.production", ".env.example"];
const SAFE_ENV_FILE_KEYS = new Set([
  "PROJECT_REF",
  "SUPABASE_PROJECT_ID",
  "SUPABASE_PROJECT_REF",
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
]);
const SITE_URL = "https://yehor212.github.io/people-first-app/";
const REQUIRED_REDIRECT_URLS = [
  SITE_URL,
  "https://yehor212.github.io/people-first-app/orb?nav=v2",
  "https://yehor212.github.io/people-first-app/orb?nav=v2&navLayout=phone",
  "https://yehor212.github.io/people-first-app/habits?nav=v2",
  "https://yehor212.github.io/people-first-app/diary?nav=v2",
  "https://yehor212.github.io/people-first-app/planning?nav=v2",
  "https://yehor212.github.io/people-first-app/planning?nav=v2&navLayout=phone",
  "https://yehor212.github.io/people-first-app/settings?nav=v2",
  "capacitor://localhost/",
  "com.zenflow.app://login-callback",
];
const APPLE_CLIENT_SECRET_ROTATION_WARNING_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function line(status, message) {
  console.log("[apple-auth-activation] " + status + " " + message);
}

function isExamplePlaceholder(key, value) {
  if (!value) return true;
  if (value === "your_supabase_anon_key") return true;
  if (value === "sb_publishable_your_public_key") return true;
  if (value.includes("your-project-ref.supabase.co")) return true;
  if (key.startsWith("VITE_") && /^your_[a-z0-9_]+$/i.test(value)) return true;
  return false;
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
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (value && !isExamplePlaceholder(match[1], value) && !env.has(match[1])) {
        env.set(match[1], value);
      }
    }
  }
  return env;
}
function getPublicEnv(env, safeFileEnv, key) {
  const value = env[key] || safeFileEnv.get(key) || "";
  return isExamplePlaceholder(key, value) ? "" : value;
}

function getProjectRef(env, safeFileEnv) {
  const explicit =
    getPublicEnv(env, safeFileEnv, "SUPABASE_PROJECT_REF") ||
    getPublicEnv(env, safeFileEnv, "PROJECT_REF") ||
    getPublicEnv(env, safeFileEnv, "SUPABASE_PROJECT_ID") ||
    "";
  if (explicit.trim()) return explicit.trim();

  const supabaseUrl = getPublicEnv(env, safeFileEnv, "VITE_SUPABASE_URL") || getPublicEnv(env, safeFileEnv, "SUPABASE_URL") || "";
  try {
    const hostname = new URL(supabaseUrl).hostname;
    const match = hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    return (match && match[1]) || "";
  } catch {
    return "";
  }
}

function hasEnvValue(env, keys) {
  return keys.some((key) => typeof env[key] === "string" && env[key].trim().length > 0);
}

function hasAppleSigningInputs(env) {
  return (
    hasEnvValue(env, ["SUPABASE_APPLE_TEAM_ID"]) &&
    hasEnvValue(env, ["SUPABASE_APPLE_KEY_ID"]) &&
    hasEnvValue(env, ["SUPABASE_APPLE_PRIVATE_KEY_PATH", "SUPABASE_APPLE_PRIVATE_KEY"])
  );
}

function add(lines, status, message) {
  lines.push(status + " " + message);
}

function decodeBase64UrlJson(segment) {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function inspectAppleClientSecret(secret, nowMs = Date.now()) {
  const malformedMessage = "Apple client secret expiry is UNVERIFIED; provide a valid JWT or signing key inputs";
  if (!secret || typeof secret !== "string" || !secret.trim()) {
    return { status: "ACTION", message: malformedMessage, blocksActivation: true };
  }

  const parts = secret.trim().split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) {
    return { status: "ACTION", message: malformedMessage, blocksActivation: true };
  }

  const payload = decodeBase64UrlJson(parts[1]);
  if (!payload || typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
    return { status: "ACTION", message: malformedMessage, blocksActivation: true };
  }

  const expiresMs = payload.exp * 1000;
  const remainingMs = expiresMs - nowMs;
  if (remainingMs <= 0) {
    return {
      status: "ACTION",
      message: "Apple client secret is expired; rotate before applying hosted Apple Auth",
      blocksActivation: true,
    };
  }

  const daysRemaining = Math.floor(remainingMs / MS_PER_DAY);
  if (daysRemaining <= APPLE_CLIENT_SECRET_ROTATION_WARNING_DAYS) {
    return {
      status: "ACTION",
      message: "Apple client secret expires in " + daysRemaining + " day(s); rotate before applying hosted Apple Auth",
      blocksActivation: true,
    };
  }

  const expiresOn = new Date(expiresMs).toISOString().slice(0, 10);
  return {
    status: "INFO",
    message: "Apple client secret expires on " + expiresOn + " (" + daysRemaining + " day(s) remaining)",
    blocksActivation: false,
  };
}

function buildActivationReport({ env = process.env, rootDir = process.cwd(), nowMs = Date.now(), publicResult = null } = {}) {
  const safeFileEnv = parseSafeEnvFiles(rootDir);
  const projectRef = getProjectRef(env, safeFileEnv);
  const lines = [];
  const missing = [];

  add(lines, "INFO", "Apple Sign-In activation packet for ZenFlow.");

  if (projectRef) {
    const domain = projectRef + ".supabase.co";
    add(lines, "INFO", "Supabase project ref: " + projectRef);
    add(lines, "INFO", "Apple Website URL domain: " + domain);
    add(lines, "INFO", "Apple return URL: https://" + domain + "/auth/v1/callback");
  } else {
    missing.push("SUPABASE_PROJECT_REF or VITE_SUPABASE_URL");
    add(lines, "ACTION", "Missing project ref source: SUPABASE_PROJECT_REF or VITE_SUPABASE_URL");
  }

  add(lines, "INFO", "Supabase Site URL: " + SITE_URL);
  for (const url of REQUIRED_REDIRECT_URLS) {
    add(lines, "INFO", "Supabase redirect URL: " + url);
  }

  if (hasEnvValue(env, ["SUPABASE_ACCESS_TOKEN"])) {
    add(lines, "INFO", "Present secret env: SUPABASE_ACCESS_TOKEN");
  } else {
    missing.push("SUPABASE_ACCESS_TOKEN");
    add(lines, "ACTION", "Missing secret env: SUPABASE_ACCESS_TOKEN");
  }

  if (hasEnvValue(env, ["SUPABASE_APPLE_CLIENT_ID", "SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID"])) {
    add(lines, "INFO", "Present Apple OAuth input: SUPABASE_APPLE_CLIENT_ID");
  } else {
    missing.push("SUPABASE_APPLE_CLIENT_ID");
    add(lines, "ACTION", "Missing Apple OAuth input: SUPABASE_APPLE_CLIENT_ID");
  }

  const appleClientSecret = env.SUPABASE_APPLE_CLIENT_SECRET || env.SUPABASE_AUTH_EXTERNAL_APPLE_SECRET || "";
  if (hasEnvValue(env, ["SUPABASE_APPLE_CLIENT_SECRET", "SUPABASE_AUTH_EXTERNAL_APPLE_SECRET"])) {
    add(lines, "INFO", "Present Apple secret source: SUPABASE_APPLE_CLIENT_SECRET");
    const secretInspection = inspectAppleClientSecret(appleClientSecret, nowMs);
    add(lines, secretInspection.status, secretInspection.message);
    if (secretInspection.blocksActivation) {
      missing.push("fresh Apple client secret");
    }
  } else if (hasAppleSigningInputs(env)) {
    add(lines, "INFO", "Present Apple secret source: signing key inputs");
  } else {
    missing.push("SUPABASE_APPLE_CLIENT_SECRET or signing key inputs");
    add(lines, "ACTION", "Missing Apple secret source: SUPABASE_APPLE_CLIENT_SECRET or signing key inputs");
  }

  if (hasEnvValue(env, ["SUPABASE_APPLE_ADDITIONAL_CLIENT_IDS", "SUPABASE_AUTH_EXTERNAL_APPLE_ADDITIONAL_CLIENT_IDS"])) {
    add(lines, "INFO", "Configured native Apple additional client IDs from SUPABASE_APPLE_ADDITIONAL_CLIENT_IDS");
  } else {
    add(lines, "INFO", "Optional native Apple additional client IDs env: SUPABASE_APPLE_ADDITIONAL_CLIENT_IDS");
  }

  if (publicResult) {
    add(lines, "INFO", "Current public provider status: " + publicResult.status + " " + publicResult.message);
  } else {
    add(lines, "INFO", "Current public provider status: UNVERIFIED public check skipped or unavailable");
  }

  add(lines, "NEXT", "Generate/rotate Apple secret with: npm run generate:apple-client-secret");
  add(lines, "NEXT", "Apply hosted Apple Auth safely with: npm run activate:apple-auth-live");
  add(lines, "NEXT", "Apply hosted Apple Auth non-interactively with: npm run apply:apple-auth-live");
  add(lines, "NEXT", "Verify final user access with: npm run check:apple-auth-complete");

  let status = "PASS";
  let exitCode = 0;
  if (publicResult && publicResult.status === "FAIL") {
    status = "FAIL";
    exitCode = 1;
  } else if (missing.length > 0 || (publicResult && publicResult.status === "UNVERIFIED") || !publicResult) {
    status = "UNVERIFIED";
    exitCode = 2;
  }

  add(lines, status, (status === "PASS" ? "Activation inputs and hosted public provider are ready" : "Activation is not complete yet") + ".");
  return { status, exitCode, lines };
}

async function getPublicResult(env, rootDir) {
  if (env.ZENFLOW_APPLE_AUTH_ACTIVATION_SKIP_PUBLIC === "true") return null;

  const publicCheckPath = path.join(__dirname, "check-apple-auth-public.cjs");
  if (!fs.existsSync(publicCheckPath)) {
    return { status: "UNVERIFIED", message: "Public Apple Auth helper is unavailable", exitCode: 0 };
  }

  const { checkAppleAuthPublic } = require(publicCheckPath);
  return checkAppleAuthPublic({ env, rootDir });
}

async function main() {
  const publicResult = await getPublicResult(process.env, process.cwd());
  const report = buildActivationReport({ env: process.env, rootDir: process.cwd(), publicResult });
  for (const entry of report.lines) {
    const parts = entry.split(" ");
    const status = parts.shift();
    line(status, parts.join(" "));
  }
  process.exitCode = report.exitCode;
}

if (require.main === module) {
  void main();
}

module.exports = {
  buildActivationReport,
  inspectAppleClientSecret,
  getProjectRef,
  hasAppleSigningInputs,
  parseSafeEnvFiles,
};
