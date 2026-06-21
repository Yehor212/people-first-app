#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const ENV_FILE_NAMES = [".env.local", ".env", ".env.production", ".env.example"];
const DEFAULT_PUBLIC_AUTH_APP_URL = "https://yehor212.github.io/people-first-app/";
const SAFE_ENV_FILE_KEYS = new Set([
  "SUPABASE_ANON_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_URL",
]);

function line(status, message) {
  console.log("[facebook-auth-public] " + status + " " + message);
}

function buildResult(status, message, exitCode) {
  return { status, message, exitCode };
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

function getDirectPublicEnv(env, key) {
  const value = env[key] || "";
  return isExamplePlaceholder(key, value) ? "" : value;
}

function getPublicEnv(env, safeFileEnv, key) {
  const value = getDirectPublicEnv(env, key) || safeFileEnv.get(key) || "";
  return isExamplePlaceholder(key, value) ? "" : value;
}

function getSupabaseUrl(env, safeFileEnv) {
  return (
    getPublicEnv(env, safeFileEnv, "VITE_SUPABASE_URL") ||
    getPublicEnv(env, safeFileEnv, "SUPABASE_URL")
  );
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

function isPublicAppDiscoveryEnabled(env) {
  return String(env.ZENFLOW_FACEBOOK_AUTH_PUBLIC_DISCOVERY || "").toLowerCase() !== "false";
}

function getPublicAppUrl(env) {
  if (!isPublicAppDiscoveryEnabled(env)) return "";

  return (
    getDirectPublicEnv(env, "ZENFLOW_FACEBOOK_AUTH_PUBLIC_APP_URL") ||
    getDirectPublicEnv(env, "ZENFLOW_PUBLIC_AUTH_URL") ||
    DEFAULT_PUBLIC_AUTH_APP_URL
  );
}

function extractScriptUrlsFromHtml(html, appUrl) {
  const scriptUrls = [];
  const baseUrl = new URL(appUrl);
  const assetUrlPattern = /\b(?:src|href)=["']([^"']+\.js(?:\?[^"']*)?)["']/gi;
  let match;

  while ((match = assetUrlPattern.exec(html))) {
    try {
      const scriptUrl = new URL(match[1], baseUrl);
      if (scriptUrl.origin === baseUrl.origin && scriptUrl.pathname.endsWith(".js")) {
        scriptUrls.push(scriptUrl.toString());
      }
    } catch {
      // Ignore malformed asset references from public HTML.
    }
  }

  return [...new Set(scriptUrls)];
}

function extractPublicSupabaseConfigFromText(text) {
  const supabaseProjectUrl = text.match(/https:\/\/[a-z0-9]{20}\.supabase\.co/i)?.[0] || "";
  const zenflowApiUrl = text.match(/https:\/\/api\.zenflowapp\.online\b/i)?.[0] || "";
  const supabaseUrl = supabaseProjectUrl || zenflowApiUrl;
  const publishableKey = text.match(/sb_publishable_[A-Za-z0-9._-]+/)?.[0] || "";
  const anonJwt =
    text.match(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/)?.[0] || "";

  return {
    supabaseUrl,
    publicApiKey: publishableKey || anonJwt,
  };
}

async function fetchText(url, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: "text/html,application/javascript,text/javascript,*/*" },
      signal: controller.signal,
    });
    if (!response.ok) return "";
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function discoverPublicSupabaseConfigFromApp(appUrl, fetchImpl = fetch) {
  const normalizedAppUrl = new URL(appUrl).toString();
  const html = await fetchText(normalizedAppUrl, fetchImpl);
  let discovered = extractPublicSupabaseConfigFromText(html);
  if (discovered.supabaseUrl && discovered.publicApiKey) return discovered;

  const scriptUrls = extractScriptUrlsFromHtml(html, normalizedAppUrl).slice(0, 20);
  for (const scriptUrl of scriptUrls) {
    const scriptText = await fetchText(scriptUrl, fetchImpl);
    const candidate = extractPublicSupabaseConfigFromText(scriptText);
    discovered = {
      supabaseUrl: discovered.supabaseUrl || candidate.supabaseUrl,
      publicApiKey: discovered.publicApiKey || candidate.publicApiKey,
    };
    if (discovered.supabaseUrl && discovered.publicApiKey) return discovered;
  }

  return discovered;
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
}

function inspectPublicAuthSettings(settings) {
  const external = settings && typeof settings === "object" ? settings.external : undefined;
  const facebook = external && typeof external === "object" ? external.facebook : undefined;
  return normalizeBoolean(facebook)
    ? []
    : ["Facebook provider is disabled in public Supabase Auth settings"];
}

async function fetchPublicAuthSettings(supabaseUrl, publicApiKey, fetchImpl = fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const settingsUrl = new URL("/auth/v1/settings", supabaseUrl);
    const response = await fetchImpl(settingsUrl, {
      headers: {
        apikey: publicApiKey,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    const text = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        body: null,
        message: "Auth settings returned HTTP " + response.status,
      };
    }

    try {
      return { ok: true, status: response.status, body: text ? JSON.parse(text) : {}, message: "" };
    } catch {
      return {
        ok: false,
        status: response.status,
        body: null,
        message: "Auth settings returned non-JSON",
      };
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function checkFacebookAuthPublic({
  env = process.env,
  rootDir = process.cwd(),
  fetchImpl = fetch,
} = {}) {
  const safeFileEnv = parseSafeEnvFiles(rootDir);
  let supabaseUrl = getSupabaseUrl(env, safeFileEnv);
  let publicApiKey = getPublicApiKey(env, safeFileEnv);
  const required = env.ZENFLOW_FACEBOOK_AUTH_PUBLIC_REQUIRED === "true";
  const publicAppUrl = getPublicAppUrl(env);

  if (env.ZENFLOW_FACEBOOK_AUTH_PUBLIC_OFFLINE === "true") {
    return buildResult(
      "UNVERIFIED",
      "Offline mode requested; public Supabase Facebook Auth settings were not checked.",
      required ? 2 : 0
    );
  }

  if ((!supabaseUrl || !publicApiKey) && publicAppUrl) {
    try {
      const discovered = await discoverPublicSupabaseConfigFromApp(publicAppUrl, fetchImpl);
      supabaseUrl = supabaseUrl || discovered.supabaseUrl;
      publicApiKey = publicApiKey || discovered.publicApiKey;
    } catch {
      // Fall through to the existing missing-config result below.
    }
  }

  const missing = [];
  if (!supabaseUrl) missing.push("VITE_SUPABASE_URL");
  if (!publicApiKey) missing.push("VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY");
  if (missing.length > 0) {
    return buildResult(
      "UNVERIFIED",
      "Public Supabase Facebook Auth not checked; missing " + missing.join(", ") + ".",
      required ? 2 : 0
    );
  }

  let result;
  try {
    result = await fetchPublicAuthSettings(supabaseUrl, publicApiKey, fetchImpl);
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "AbortError"
        ? "request timed out"
        : "request failed";
    return buildResult(
      "UNVERIFIED",
      "Public Supabase Auth settings " + reason + ".",
      required ? 2 : 0
    );
  }

  if (!result.ok) {
    return buildResult(
      "UNVERIFIED",
      result.message + "; public Auth settings could not be verified.",
      required ? 2 : 0
    );
  }

  const failures = inspectPublicAuthSettings(result.body || {});
  if (failures.length > 0) {
    return buildResult("FAIL", failures.join("; "), 1);
  }

  return buildResult("PASS", "Public Supabase Auth settings expose Facebook provider.", 0);
}

async function main() {
  const result = await checkFacebookAuthPublic();
  line(result.status, result.message);
  process.exitCode = result.exitCode;
}

if (require.main === module) {
  void main();
}

module.exports = {
  checkFacebookAuthPublic,
  discoverPublicSupabaseConfigFromApp,
  extractPublicSupabaseConfigFromText,
  fetchPublicAuthSettings,
  inspectPublicAuthSettings,
  parseSafeEnvFiles,
};
