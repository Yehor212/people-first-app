#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { generateAppleClientSecret } = require("./generate-apple-client-secret.cjs");

const DEFAULT_MANAGEMENT_API_BASE_URL = "https://api.supabase.com/v1";
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

function line(status, message) {
  console.log(`[apple-auth-apply] ${status} ${message}`);
}

function buildResult(status, message, exitCode) {
  return { status, message, exitCode };
}

function printResult(result) {
  line(result.status, result.message);
  process.exitCode = result.exitCode;
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
    normalized === "https://your-project-ref.supabase.co"
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
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (value && !isPlaceholderValue(value) && !env.has(match[1])) env.set(match[1], value);
    }
  }
  return env;
}

function getPublicEnv(env, safeFileEnv, key) {
  const direct = String(env[key] || "").trim();
  if (direct && !isPlaceholderValue(direct)) return direct;
  return safeFileEnv.get(key) || "";
}

function getSecretEnv(env, ...keys) {
  for (const key of keys) {
    const value = env[key];
    if (value && value.trim()) return value.trim();
  }
  return "";
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
    return match?.[1] || "";
  } catch {
    return "";
  }
}

function normalizeCsvList(value) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string") return [];
  return value
    .replaceAll("\r", ",")
    .replaceAll("\n", ",")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function mergeRedirectUrls(existingConfig) {
  const existing = normalizeCsvList(existingConfig?.uri_allow_list);
  return Array.from(new Set([...existing, ...REQUIRED_REDIRECT_URLS])).join(",");
}

function mergeAdditionalClientIds(existingConfig, additionalClientIds) {
  const existing = normalizeCsvList(existingConfig?.external_apple_additional_client_ids);
  const requested = normalizeCsvList(additionalClientIds);
  return Array.from(new Set([...existing, ...requested])).join(",");
}

function buildPatchBody(existingConfig, appleClientId, appleSecret, additionalClientIds) {
  const mergedAdditionalClientIds = mergeAdditionalClientIds(existingConfig, additionalClientIds);
  const body = {
    site_url: SITE_URL,
    uri_allow_list: mergeRedirectUrls(existingConfig),
    external_apple_enabled: true,
    external_apple_client_id: appleClientId,
    external_apple_secret: appleSecret,
  };

  if (mergedAdditionalClientIds) {
    body.external_apple_additional_client_ids = mergedAdditionalClientIds;
  }
  return body;
}

async function requestJson(url, { method = "GET", token, body, fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetchImpl(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });

    const text = await response.text();
    if (!response.ok) {
      return { ok: false, status: response.status, body: null };
    }

    try {
      return { ok: true, status: response.status, body: text ? JSON.parse(text) : {} };
    } catch {
      return { ok: false, status: response.status, body: null };
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function applyAppleAuthLive({ env = process.env, rootDir = process.cwd(), fetchImpl = fetch } = {}) {
  const safeFileEnv = parseSafeEnvFiles(rootDir);
  const projectRef = getProjectRef(env, safeFileEnv);
  const token = getSecretEnv(env, "SUPABASE_ACCESS_TOKEN");
  const appleClientId = getSecretEnv(
    env,
    "SUPABASE_APPLE_CLIENT_ID",
    "SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID",
  );
  let appleSecret = getSecretEnv(
    env,
    "SUPABASE_APPLE_CLIENT_SECRET",
    "SUPABASE_AUTH_EXTERNAL_APPLE_SECRET",
  );
  const additionalClientIds = getSecretEnv(
    env,
    "SUPABASE_APPLE_ADDITIONAL_CLIENT_IDS",
    "SUPABASE_AUTH_EXTERNAL_APPLE_ADDITIONAL_CLIENT_IDS",
  );

  if (!appleSecret) {
    const generated = await generateAppleClientSecret({ env, rootDir, printSecret: true });
    if (generated.status === "PASS" && generated.jwt) appleSecret = generated.jwt;
  }

  const missing = [];
  if (!projectRef) missing.push("SUPABASE_PROJECT_REF");
  if (!token) missing.push("SUPABASE_ACCESS_TOKEN");
  if (!appleClientId) missing.push("SUPABASE_APPLE_CLIENT_ID");
  if (!appleSecret) {
    missing.push("SUPABASE_APPLE_CLIENT_SECRET or Apple signing key inputs");
  }

  if (missing.length > 0) {
    return buildResult("UNVERIFIED", `Hosted Supabase Apple Auth not applied; missing ${missing.join(", ")}.`, 2);
  }

  if (env.ZENFLOW_APPLE_AUTH_APPLY_CONFIRM !== "true") {
    return buildResult(
      "DRY-RUN",
      "Apple Auth inputs are present; set ZENFLOW_APPLE_AUTH_APPLY_CONFIRM=true to patch hosted Supabase Auth.",
      0,
    );
  }

  const authConfigUrl = `${DEFAULT_MANAGEMENT_API_BASE_URL}/projects/${encodeURIComponent(projectRef)}/config/auth`;

  let existingResult;
  try {
    existingResult = await requestJson(authConfigUrl, { token, fetchImpl });
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "AbortError" ? "request timed out" : "request failed";
    return buildResult("UNVERIFIED", `Hosted Supabase Auth config read ${reason}; Apple Auth not applied.`, 2);
  }

  if (!existingResult.ok) {
    return buildResult(
      "UNVERIFIED",
      `Hosted Supabase Auth config read returned HTTP ${existingResult.status}; Apple Auth not applied.`,
      2,
    );
  }

  const patchBody = buildPatchBody(
    existingResult.body || {},
    appleClientId,
    appleSecret,
    additionalClientIds,
  );

  let patchResult;
  try {
    patchResult = await requestJson(authConfigUrl, { method: "PATCH", token, body: patchBody, fetchImpl });
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "AbortError" ? "request timed out" : "request failed";
    return buildResult("UNVERIFIED", `Hosted Supabase Auth config patch ${reason}; Apple Auth not applied.`, 2);
  }

  if (!patchResult.ok) {
    return buildResult(
      "UNVERIFIED",
      `Hosted Supabase Auth config patch returned HTTP ${patchResult.status}; Apple Auth not applied.`,
      2,
    );
  }

  return buildResult(
    "PASS",
    `Hosted Supabase Apple Auth applied with ${REQUIRED_REDIRECT_URLS.length} required redirect URL(s).`,
    0,
  );
}

async function main() {
  const result = await applyAppleAuthLive();
  printResult(result);
}

if (require.main === module) {
  void main();
}

module.exports = {
  applyAppleAuthLive,
  buildPatchBody,
  getProjectRef,
  mergeAdditionalClientIds,
  mergeRedirectUrls,
  parseSafeEnvFiles,
  requestJson,
};
