#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const ENV_FILE_NAMES = [".env.local", ".env", ".env.production", ".env.example"];
const SAFE_ENV_FILE_KEYS = new Set([
  "SUPABASE_ANON_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_URL",
]);

function line(status, message) {
  console.log(`[apple-auth-public] ${status} ${message}`);
}

function buildResult(status, message, exitCode) {
  return { status, message, exitCode };
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

function isExamplePlaceholder(key, value) {
  if (!value) return true;
  if (value === "your_supabase_anon_key") return true;
  if (value === "sb_publishable_your_public_key") return true;
  if (value.includes("your-project-ref.supabase.co")) return true;
  if (key.startsWith("VITE_") && /^your_[a-z0-9_]+$/i.test(value)) return true;
  return false;
}

function getDirectPublicEnv(env, key) {
  const value = env[key] || "";
  return isExamplePlaceholder(key, value) ? "" : value;
}

function getPublicEnv(env, safeFileEnv, key) {
  const value = getDirectPublicEnv(env, key) || safeFileEnv.get(key) || "";
  return isExamplePlaceholder(key, value) ? "" : value;
}

function getSupabaseUrl(env, safeFileEnv) {
  return getPublicEnv(env, safeFileEnv, "VITE_SUPABASE_URL") || getPublicEnv(env, safeFileEnv, "SUPABASE_URL");
}

function getPublicApiKey(env, safeFileEnv) {
  return (
    getDirectPublicEnv(env, "VITE_SUPABASE_PUBLISHABLE_KEY") ||
    getDirectPublicEnv(env, "SUPABASE_PUBLISHABLE_KEY") ||
    getDirectPublicEnv(env, "VITE_SUPABASE_ANON_KEY") ||
    getDirectPublicEnv(env, "SUPABASE_ANON_KEY") ||
    getPublicEnv(env, safeFileEnv, "VITE_SUPABASE_PUBLISHABLE_KEY") ||
    getPublicEnv(env, safeFileEnv, "SUPABASE_PUBLISHABLE_KEY") ||
    getPublicEnv(env, safeFileEnv, "VITE_SUPABASE_ANON_KEY") ||
    getPublicEnv(env, safeFileEnv, "SUPABASE_ANON_KEY")
  );
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
}

function inspectPublicAuthSettings(settings) {
  const external = settings && typeof settings === "object" ? settings.external : undefined;
  const apple = external && typeof external === "object" ? external.apple : undefined;
  return normalizeBoolean(apple) ? [] : ["Apple provider is disabled in public Supabase Auth settings"];
}

async function fetchPublicAuthSettings(supabaseUrl, anonKey, fetchImpl = fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const settingsUrl = new URL("/auth/v1/settings", supabaseUrl);
    const response = await fetchImpl(settingsUrl, {
      headers: {
        apikey: anonKey,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    const text = await response.text();
    if (!response.ok) {
      return { ok: false, status: response.status, body: null, message: `Auth settings returned HTTP ${response.status}` };
    }

    try {
      return { ok: true, status: response.status, body: text ? JSON.parse(text) : {}, message: "" };
    } catch {
      return { ok: false, status: response.status, body: null, message: "Auth settings returned non-JSON" };
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function checkAppleAuthPublic({ env = process.env, rootDir = process.cwd(), fetchImpl = fetch } = {}) {
  const safeFileEnv = parseSafeEnvFiles(rootDir);
  const supabaseUrl = getSupabaseUrl(env, safeFileEnv);
  const publicApiKey = getPublicApiKey(env, safeFileEnv);
  const required = env.ZENFLOW_APPLE_AUTH_PUBLIC_REQUIRED === "true";

  const missing = [];
  if (!supabaseUrl) missing.push("VITE_SUPABASE_URL");
  if (!publicApiKey) missing.push("VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY");
  if (missing.length > 0) {
    return buildResult(
      "UNVERIFIED",
      `Public Supabase Apple Auth not checked; missing ${missing.join(", ")}.`,
      required ? 2 : 0,
    );
  }

  let result;
  try {
    result = await fetchPublicAuthSettings(supabaseUrl, publicApiKey, fetchImpl);
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError" ? "request timed out" : "request failed";
    return buildResult("UNVERIFIED", `Public Supabase Auth settings ${reason}.`, required ? 2 : 0);
  }

  if (!result.ok) {
    return buildResult("UNVERIFIED", `${result.message}; public Auth settings could not be verified.`, required ? 2 : 0);
  }

  const failures = inspectPublicAuthSettings(result.body || {});
  if (failures.length > 0) {
    return buildResult("FAIL", failures.join("; "), 1);
  }

  return buildResult("PASS", "Public Supabase Auth settings expose Apple provider.", 0);
}

async function main() {
  const result = await checkAppleAuthPublic();
  line(result.status, result.message);
  process.exitCode = result.exitCode;
}

if (require.main === module) {
  void main();
}

module.exports = {
  checkAppleAuthPublic,
  fetchPublicAuthSettings,
  inspectPublicAuthSettings,
  parseSafeEnvFiles,
};
