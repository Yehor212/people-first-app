#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_MANAGEMENT_API_BASE_URL = "https://api.supabase.com/v1";
const ENV_FILE_NAMES = [".env.local", ".env", ".env.production", ".env.example"];
const SAFE_ENV_FILE_KEYS = new Set([
  "PROJECT_REF",
  "SUPABASE_PROJECT_ID",
  "SUPABASE_PROJECT_REF",
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
]);
const REQUIRED_REDIRECT_URLS = [
  "https://yehor212.github.io/people-first-app/",
  "https://yehor212.github.io/people-first-app/orb?nav=v2",
  "https://yehor212.github.io/people-first-app/orb?nav=v2&navLayout=phone",
  "https://yehor212.github.io/people-first-app/habits?nav=v2",
  "https://yehor212.github.io/people-first-app/diary?nav=v2",
  "https://yehor212.github.io/people-first-app/settings?nav=v2",
  "capacitor://localhost/",
  "com.zenflow.app://login-callback",
];

function line(status, message) {
  console.log("[apple-auth-live] " + status + " " + message);
}

function buildResult(status, message, exitCode, failures = []) {
  return { status, message, exitCode, ...(failures.length > 0 ? { failures } : {}) };
}

function parseSafeEnvFiles(rootDir = process.cwd()) {
  const env = new Map();
  for (const fileName of ENV_FILE_NAMES) {
    const filePath = path.join(rootDir, fileName);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match || !SAFE_ENV_FILE_KEYS.has(match[1])) continue;

      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (value && !env.has(match[1])) env.set(match[1], value);
    }
  }
  return env;
}

function getPublicEnv(env, safeFileEnv, key) {
  return env[key] || safeFileEnv.get(key) || "";
}

function getProjectRef(env = process.env, safeFileEnv = parseSafeEnvFiles()) {
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

function getField(config, names) {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(config, name)) return config[name];
  }
  return undefined;
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
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

function getRedirectUrls(config) {
  const raw = getField(config, [
    "uri_allow_list",
    "URI_ALLOW_LIST",
    "additional_redirect_urls",
    "ADDITIONAL_REDIRECT_URLS",
    "redirect_urls",
  ]);
  return normalizeCsvList(raw);
}

function getAdditionalClientIds(config) {
  const raw = getField(config, [
    "external_apple_additional_client_ids",
    "EXTERNAL_APPLE_ADDITIONAL_CLIENT_IDS",
  ]);
  return normalizeCsvList(raw);
}

function inspectAuthConfig(
  config,
  {
    expectedClientId = process.env.SUPABASE_EXPECTED_APPLE_CLIENT_ID || "",
    expectedAdditionalClientIds = process.env.SUPABASE_EXPECTED_APPLE_ADDITIONAL_CLIENT_IDS || "",
  } = {},
) {
  const enabled = normalizeBoolean(
    getField(config, ["external_apple_enabled", "EXTERNAL_APPLE_ENABLED"]),
  );
  const clientId = String(
    getField(config, ["external_apple_client_id", "EXTERNAL_APPLE_CLIENT_ID"]) || "",
  ).trim();
  const expected = expectedClientId.trim();
  const expectedAdditional = normalizeCsvList(expectedAdditionalClientIds);
  const redirectUrls = getRedirectUrls(config);
  const hostedAppleClientIds = new Set([clientId, ...getAdditionalClientIds(config)].filter(Boolean));

  const failures = [];
  if (!enabled) failures.push("Apple provider is disabled in hosted Supabase Auth");
  if (!clientId) failures.push("Apple Services ID/client ID is missing in hosted Supabase Auth");
  if (expected && clientId !== expected) {
    failures.push("Hosted Apple Services ID does not match SUPABASE_EXPECTED_APPLE_CLIENT_ID");
  }
  for (const id of expectedAdditional) {
    if (!hostedAppleClientIds.has(id)) failures.push("Missing hosted Apple additional client ID: " + id);
  }
  for (const url of REQUIRED_REDIRECT_URLS) {
    if (!redirectUrls.includes(url)) failures.push("Missing hosted redirect URL: " + url);
  }

  return failures;
}

async function fetchAuthConfig(projectRef, token, { fetchImpl = fetch, apiBaseUrl = DEFAULT_MANAGEMENT_API_BASE_URL } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetchImpl(
      apiBaseUrl.replace(/\/$/, "") + "/projects/" + encodeURIComponent(projectRef) + "/config/auth",
      {
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/json",
        },
        signal: controller.signal,
      },
    );

    const text = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        body: null,
        message: "Management API returned HTTP " + response.status,
      };
    }

    try {
      return { ok: true, status: response.status, body: JSON.parse(text), message: "" };
    } catch {
      return {
        ok: false,
        status: response.status,
        body: null,
        message: "Management API returned non-JSON auth config",
      };
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function checkAppleAuthLive({ env = process.env, rootDir = process.cwd(), fetchImpl = fetch } = {}) {
  const required = env.ZENFLOW_APPLE_AUTH_LIVE_REQUIRED === "true";
  const safeFileEnv = parseSafeEnvFiles(rootDir);
  const token = env.SUPABASE_ACCESS_TOKEN || "";
  const projectRef = getProjectRef(env, safeFileEnv);

  const missing = [];
  if (!token) missing.push("SUPABASE_ACCESS_TOKEN");
  if (!projectRef) missing.push("SUPABASE_PROJECT_REF");

  if (missing.length > 0) {
    return buildResult(
      "UNVERIFIED",
      "Hosted Supabase Apple Auth not checked; missing " + missing.join(", ") + ".",
      required ? 2 : 0,
    );
  }

  if (env.ZENFLOW_APPLE_AUTH_LIVE_OFFLINE === "true") {
    return buildResult(
      "UNVERIFIED",
      "Offline mode requested; hosted Supabase Apple Auth not checked.",
      required ? 2 : 0,
    );
  }

  let result;
  try {
    result = await fetchAuthConfig(projectRef, token, {
      fetchImpl,
      apiBaseUrl: env.SUPABASE_MANAGEMENT_API_BASE_URL || DEFAULT_MANAGEMENT_API_BASE_URL,
    });
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "AbortError" ? "request timed out" : "request failed";
    return buildResult("UNVERIFIED", "Hosted Supabase Apple Auth " + reason + ".", required ? 2 : 0);
  }

  if (!result.ok) {
    return buildResult("UNVERIFIED", result.message + "; hosted Auth config could not be verified.", required ? 2 : 0);
  }

  const failures = inspectAuthConfig(result.body || {}, {
    expectedClientId: env.SUPABASE_EXPECTED_APPLE_CLIENT_ID || "",
    expectedAdditionalClientIds: env.SUPABASE_EXPECTED_APPLE_ADDITIONAL_CLIENT_IDS || "",
  });
  if (failures.length > 0) {
    return buildResult("FAIL", "Hosted Supabase Apple Auth is incomplete: " + failures.join("; "), 1, failures);
  }

  return buildResult("PASS", "Hosted Supabase Apple Auth is enabled with required redirects.", 0);
}

function printResult(result) {
  if (result.status === "FAIL" && Array.isArray(result.failures) && result.failures.length > 0) {
    console.log("[apple-auth-live] FAIL Hosted Supabase Apple Auth is incomplete:");
    for (const failure of result.failures) console.log("[apple-auth-live] FAIL - " + failure);
  } else {
    line(result.status, result.message);
  }
  process.exitCode = result.exitCode;
}

async function main() {
  const result = await checkAppleAuthLive();
  printResult(result);
}

if (require.main === module) {
  void main();
}

module.exports = {
  checkAppleAuthLive,
  fetchAuthConfig,
  getAdditionalClientIds,
  getProjectRef,
  inspectAuthConfig,
  normalizeCsvList,
  parseSafeEnvFiles,
};
