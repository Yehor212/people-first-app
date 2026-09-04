#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_MANAGEMENT_API_BASE_URL = "https://api.supabase.com/v1";
const DEFAULT_PUBLIC_APP_URL = "https://yehor212.github.io/people-first-app/diary?nav=v2&navLayout=phone";
const JOURNAL_RESET_PARAM = "journalReset";
const SMOKE_NONCE = "00000000000000000000000000000000";
const ENV_FILE_NAMES = [".env.local", ".env", ".env.production", ".env.example"];
const SAFE_ENV_FILE_KEYS = new Set([
  "PROJECT_REF",
  "SUPABASE_PROJECT_ID",
  "SUPABASE_PROJECT_REF",
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_ANON_KEY",
  "ZENFLOW_JOURNAL_MAGIC_LINK_REDIRECT_TO",
  "ZENFLOW_PUBLIC_AUTH_URL",
]);
const GITHUB_PAGES_AUTH_BASE = "https://yehor212.github.io/people-first-app";
const ZENFLOW_APP_AUTH_BASE = "https://zenflow.app";
const REQUIRED_WEB_AUTH_BASES = [GITHUB_PAGES_AUTH_BASE, ZENFLOW_APP_AUTH_BASE];
const TRUSTED_SUPABASE_AUTH_HOSTS = new Set(["bwgfslmxmueyglpumkbf.supabase.co", "api.zenflowapp.online"]);
const TRUSTED_WEB_CALLBACK_BASES = [
  { hostname: "yehor212.github.io", pathPrefix: ["people-first-app"] },
];
const V2_AUTH_ROUTES = ["orb", "habits", "diary", "planning", "settings"];
const REQUIRED_JOURNAL_REDIRECT_URLS = [
  ...REQUIRED_WEB_AUTH_BASES.flatMap((base) => [
    `${base}/?journalReset=*`,
    ...V2_AUTH_ROUTES.flatMap((route) => [
      `${base}/${route}?nav=v2&journalReset=*`,
      `${base}/${route}?nav=v2&navLayout=phone&journalReset=*`,
      `${base}/${route}?nav=v2&navLayout=web&journalReset=*`,
    ]),
  ]),
  "com.zenflow.app://login-callback?journalReset=*",
];
const HOSTED_JOURNAL_REDIRECT_ALLOW_LIST_URLS = [
  ...REQUIRED_WEB_AUTH_BASES.flatMap((base) => [
    `${base}/?journalReset=*`,
    `${base}/*\\?*journalReset=*`,
  ]),
  "com.zenflow.app://login-callback?journalReset=*",
];
const REQUIRED_NATIVE_OAUTH_REDIRECT_URLS = [
  "com.zenflow.app://login-callback?zenflowAuthAttempt=00000000-0000-4000-8000-000000000000",
];
const HOSTED_NATIVE_OAUTH_REDIRECT_ALLOW_LIST_URLS = [
  "com.zenflow.app://login-callback?zenflowAuthAttempt=*",
];
const MIN_EMAIL_SEND_RATE_LIMIT_PER_HOUR = 30;

function line(status, message) {
  console.log("[journal-magic-link-live] " + status + " " + message);
}

function buildResult(status, message, exitCode, extra = {}) {
  return { status, message, exitCode, ...extra };
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
    normalized === "your_supabase_anon_key"
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

function getSafeEnvValue(env, safeFileEnv, key) {
  const direct = String(env[key] || "").trim();
  if (direct && !isPlaceholderValue(direct)) return direct;
  return safeFileEnv.get(key) || "";
}

function getSupabaseUrl(env, safeFileEnv) {
  return (
    getSafeEnvValue(env, safeFileEnv, "VITE_SUPABASE_URL") ||
    getSafeEnvValue(env, safeFileEnv, "SUPABASE_URL")
  );
}

function getSupabasePublicKey(env, safeFileEnv) {
  return (
    getSafeEnvValue(env, safeFileEnv, "VITE_SUPABASE_PUBLISHABLE_KEY") ||
    getSafeEnvValue(env, safeFileEnv, "VITE_SUPABASE_ANON_KEY")
  );
}

function getProjectRef(env = process.env, safeFileEnv = parseSafeEnvFiles()) {
  const explicit =
    getSafeEnvValue(env, safeFileEnv, "SUPABASE_PROJECT_REF") ||
    getSafeEnvValue(env, safeFileEnv, "PROJECT_REF") ||
    getSafeEnvValue(env, safeFileEnv, "SUPABASE_PROJECT_ID") ||
    "";
  if (explicit.trim()) return explicit.trim();

  const supabaseUrl = getSupabaseUrl(env, safeFileEnv);
  try {
    const hostname = new URL(supabaseUrl).hostname;
    const match = hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    return (match && match[1]) || "";
  } catch {
    return "";
  }
}

function normalizeCsvList(value) {
  if (Array.isArray(value)) return value.map(String).map((entry) => entry.trim()).filter(Boolean);
  if (typeof value !== "string") return [];
  return value
    .replaceAll("\r", ",")
    .replaceAll("\n", ",")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
}

function getField(config, names) {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(config, name)) return config[name];
  }
  return undefined;
}

function getRedirectUrls(config) {
  return normalizeCsvList(
    getField(config, [
      "uri_allow_list",
      "URI_ALLOW_LIST",
      "additional_redirect_urls",
      "ADDITIONAL_REDIRECT_URLS",
      "redirect_urls",
    ]),
  );
}

function escapeRegExpChar(char) {
  return char.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function supabaseGlobToRegExp(pattern) {
  let source = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const next = pattern[index + 1];
    if (char === "\\" && next) {
      source += escapeRegExpChar(next);
      index += 1;
    } else if (char === "*" && next === "*") {
      source += ".*";
      index += 1;
    } else if (char === "*") {
      source += "[^./]*";
    } else if (char === "?") {
      source += "[^./]";
    } else {
      source += escapeRegExpChar(char);
    }
  }
  source += "$";
  return new RegExp(source);
}

function redirectUrlMatchesAllowListEntry(requiredUrl, allowListEntry) {
  if (requiredUrl === allowListEntry) return true;
  if (!/[\\*?]/.test(allowListEntry)) return false;
  try {
    return supabaseGlobToRegExp(allowListEntry).test(requiredUrl);
  } catch {
    return false;
  }
}

function isRedirectUrlAllowed(requiredUrl, allowListEntries) {
  return allowListEntries.some((entry) => redirectUrlMatchesAllowListEntry(requiredUrl, entry));
}

function hasNestedSmtp(config) {
  const auth = config && typeof config.auth === "object" ? config.auth : null;
  const email = auth && typeof auth.email === "object" ? auth.email : null;
  const smtp = email && typeof email.smtp === "object" ? email.smtp : null;
  const host = smtp && (smtp.host || smtp.hostname);
  const identity = smtp && (smtp.user || smtp.admin_email || smtp.sender_name);
  return Boolean(host && identity);
}

function hasCustomSmtp(config) {
  if (hasNestedSmtp(config)) return true;
  const host = getField(config, ["mailer_smtp_host", "MAILER_SMTP_HOST", "smtp_host", "SMTP_HOST"]);
  const identity = getField(config, [
    "mailer_smtp_user",
    "MAILER_SMTP_USER",
    "smtp_user",
    "SMTP_USER",
    "mailer_smtp_admin_email",
    "MAILER_SMTP_ADMIN_EMAIL",
    "smtp_admin_email",
    "SMTP_ADMIN_EMAIL",
    "smtp_sender_name",
    "SMTP_SENDER_NAME",
  ]);
  return Boolean(host && identity);
}

function inspectHostedAuthConfig(config, { requireCustomSmtp = false } = {}) {
  const failures = [];
  const emailEnabled = getField(config, [
    "external_email_enabled",
    "EXTERNAL_EMAIL_ENABLED",
    "email_enabled",
    "EMAIL_ENABLED",
  ]);
  if (emailEnabled !== undefined && !normalizeBoolean(emailEnabled)) {
    failures.push("Hosted Supabase email Auth provider is disabled");
  }

  const redirectUrls = getRedirectUrls(config);
  for (const redirectUrl of REQUIRED_JOURNAL_REDIRECT_URLS) {
    if (!isRedirectUrlAllowed(redirectUrl, redirectUrls)) {
      failures.push("Missing hosted journal Magic Link redirect URL: " + redirectUrl);
    }
  }

  if (requireCustomSmtp && !hasCustomSmtp(config)) {
    failures.push("Hosted Supabase custom SMTP is not configured for production Magic Link delivery");
  }

  if (requireCustomSmtp) {
    const emailSendRateLimit = Number(getField(config, ["rate_limit_email_sent", "RATE_LIMIT_EMAIL_SENT"]) || 0);
    if (!Number.isFinite(emailSendRateLimit) || emailSendRateLimit < MIN_EMAIL_SEND_RATE_LIMIT_PER_HOUR) {
      failures.push("Hosted Supabase email send rate limit is below " + MIN_EMAIL_SEND_RATE_LIMIT_PER_HOUR + " per hour");
    }
  }

  return failures;
}

function inspectHostedNativeOAuthRedirectConfig(config) {
  const redirectUrls = getRedirectUrls(config);
  return REQUIRED_NATIVE_OAUTH_REDIRECT_URLS
    .filter((redirectUrl) => !isRedirectUrlAllowed(redirectUrl, redirectUrls))
    .map(() => "Missing hosted attempt-bound native OAuth redirect URL");
}

function buildJournalMagicLinkRedirectTo({ baseUrl = DEFAULT_PUBLIC_APP_URL, nonce = SMOKE_NONCE } = {}) {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set(JOURNAL_RESET_PARAM, nonce);
    return url.toString();
  } catch {
    const separator = String(baseUrl).includes("?") ? "&" : "?";
    return `${baseUrl}${separator}${JOURNAL_RESET_PARAM}=${encodeURIComponent(nonce)}`;
  }
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
  const segments = parsed.pathname.split("/").filter(Boolean);
  const trustedBase = TRUSTED_WEB_CALLBACK_BASES.find((base) => {
    if (parsed.hostname !== base.hostname) return false;
    return base.pathPrefix.every((segment, index) => segments[index] === segment);
  });
  if (!trustedBase) return false;

  const routeSegments = segments.slice(trustedBase.pathPrefix.length);

  if (routeSegments.length === 0) return true;
  if (routeSegments.length !== 1) return false;
  if (!V2_AUTH_ROUTES.includes(routeSegments[0])) return false;
  if (parsed.searchParams.get("nav") !== "v2") return false;

  const navLayout = parsed.searchParams.get("navLayout") || "";
  if (navLayout && navLayout !== "phone" && navLayout !== "web") return false;

  return true;
}

function hasAuthCallbackProof(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
    return Boolean(
      parsed.searchParams.get("code") ||
        hash.get("code") ||
        (hash.get("access_token") && hash.get("refresh_token")),
    );
  } catch {
    return false;
  }
}

function isTrustedJournalCallbackUrlWithAuthProof(rawUrl, expectedNonce) {
  return isTrustedJournalCallbackUrl(rawUrl, expectedNonce) && hasAuthCallbackProof(rawUrl);
}

function isTrustedSupabaseMagicLinkUrl(parsed, expectedNonce) {
  if (parsed.protocol !== "https:") return false;
  if (!TRUSTED_SUPABASE_AUTH_HOSTS.has(parsed.hostname)) return false;
  if (parsed.pathname !== "/auth/v1/verify") return false;

  const type = parsed.searchParams.get("type");
  if (type && type !== "magiclink") return false;

  const hasEmailToken = Boolean(parsed.searchParams.get("token") || parsed.searchParams.get("token_hash"));
  if (!hasEmailToken) return false;

  const redirectTo = parsed.searchParams.get("redirect_to") || parsed.searchParams.get("redirectTo") || "";
  return Boolean(redirectTo && isTrustedJournalCallbackUrl(redirectTo, expectedNonce));
}

function inspectCapturedMagicLinkUrl(rawUrl, expectedNonce) {
  const failures = [];
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return ["Captured Magic Link proof URL is not parseable"];
  }

  const candidates = [parsed.toString()];
  const redirectTo = parsed.searchParams.get("redirect_to") || parsed.searchParams.get("redirectTo") || "";
  if (redirectTo) candidates.push(redirectTo);

  const hasExpectedNonce = candidates.some((candidate) => getJournalResetNonceFromUrl(candidate) === expectedNonce);
  if (!hasExpectedNonce) {
    failures.push("Captured Magic Link proof does not contain the expected journalReset nonce");
  }

  if (isTrustedJournalCallbackUrl(parsed.toString(), expectedNonce)) {
    failures.push("Captured Magic Link proof must be the Supabase verify URL from the delivered email");
  } else if (!isTrustedSupabaseMagicLinkUrl(parsed, expectedNonce)) {
    failures.push("Captured Magic Link proof URL is not a trusted ZenFlow or Supabase callback");
  }

  return failures;
}

async function verifyCapturedMagicLinkRedirect(rawUrl, expectedNonce, { fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetchImpl(rawUrl, {
      method: "GET",
      redirect: "manual",
      headers: {
        Accept: "text/html,application/xhtml+xml,*/*",
      },
      signal: controller.signal,
    });

    if (response.status < 300 || response.status >= 400) {
      return {
        ok: false,
        message: "Consumed Supabase verify URL did not return a redirect",
      };
    }

    const location = response.headers.get("location") || "";
    if (!location) {
      return {
        ok: false,
        message: "Consumed Supabase verify URL did not return a redirect location",
      };
    }

    const redirectUrl = new URL(location, rawUrl).toString();
    if (!isTrustedJournalCallbackUrlWithAuthProof(redirectUrl, expectedNonce)) {
      return {
        ok: false,
        message: "Consumed Supabase verify URL did not redirect to the trusted journal callback with auth proof",
      };
    }

    return { ok: true, message: "Consumed Supabase verify URL redirected to the trusted journal callback" };
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError" ? "timed out" : "failed";
    return {
      ok: false,
      message: "Consumed Supabase verify URL check " + reason,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function inspectLocalRedirectConfig(rootDir) {
  const configPath = path.join(rootDir, "supabase", "config.toml");
  if (!fs.existsSync(configPath)) {
    return {
      failures: [],
      unverified: ["Local Supabase config was not found; journal Magic Link redirect allow-list was not checked"],
    };
  }

  const content = fs.readFileSync(configPath, "utf8");
  const failures = REQUIRED_JOURNAL_REDIRECT_URLS
    .filter((redirectUrl) => !content.includes(`"${redirectUrl}"`))
    .map((redirectUrl) => "Local Supabase config is missing journal Magic Link redirect URL: " + redirectUrl);
  return { failures, unverified: [] };
}

async function fetchHostedAuthConfig(projectRef, token, { fetchImpl = fetch, apiBaseUrl = DEFAULT_MANAGEMENT_API_BASE_URL } = {}) {
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
      return { ok: false, status: response.status, body: null, message: "Management API returned HTTP " + response.status };
    }
    try {
      return { ok: true, status: response.status, body: JSON.parse(text), message: "" };
    } catch {
      return { ok: false, status: response.status, body: null, message: "Management API returned non-JSON auth config" };
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchHostedPublicSettings(supabaseUrl, publicKey, { fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetchImpl(new URL("/auth/v1/settings", supabaseUrl).toString(), {
      headers: {
        apikey: publicKey,
        Authorization: "Bearer " + publicKey,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      return { ok: false, status: response.status, body: null, message: "Auth settings returned HTTP " + response.status };
    }
    try {
      return { ok: true, status: response.status, body: JSON.parse(text), message: "" };
    } catch {
      return { ok: false, status: response.status, body: null, message: "Auth settings returned non-JSON" };
    }
  } finally {
    clearTimeout(timeout);
  }
}

function inspectHostedPublicSettings(settings) {
  const externalEmail = getField(settings, ["external_email", "email", "mail", "email_enabled"]);
  if (externalEmail === undefined) return [];
  return normalizeBoolean(externalEmail) ? [] : ["Hosted Supabase public Auth settings report email auth as disabled"];
}

function getAuthErrorDebugInfo(error) {
  if (!error || typeof error !== "object") return {};
  const record = error;
  return {
    code: typeof record.code === "string" ? record.code : undefined,
    name: typeof record.name === "string" ? record.name : undefined,
    status: typeof record.status === "number" ? record.status : undefined,
  };
}

async function sendMagicLinkSmoke({ supabaseUrl, publicKey, email, redirectTo, clientFactory }) {
  let supabase;
  if (clientFactory) {
    supabase = clientFactory(supabaseUrl, publicKey);
  } else {
    const { createClient } = require("@supabase/supabase-js");
    supabase = createClient(supabaseUrl, publicKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: redirectTo,
    },
  });

  if (error) {
    return {
      ok: false,
      message: "Supabase rejected journal Magic Link smoke send: " + JSON.stringify(getAuthErrorDebugInfo(error)),
    };
  }
  return { ok: true, message: "Supabase accepted the journal Magic Link smoke send" };
}

function isValidEmail(email) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email || ""));
}

async function checkJournalMagicLinkLive({ env = process.env, rootDir = process.cwd(), fetchImpl = fetch, clientFactory } = {}) {
  const required = env.ZENFLOW_JOURNAL_MAGIC_LINK_LIVE_REQUIRED === "true";
  const requireCustomSmtp = required || env.ZENFLOW_JOURNAL_MAGIC_LINK_SMTP_REQUIRED === "true";
  const safeFileEnv = parseSafeEnvFiles(rootDir);
  const failures = [];
  const unverified = [];

  const localRedirects = inspectLocalRedirectConfig(rootDir);
  failures.push(...localRedirects.failures);
  unverified.push(...localRedirects.unverified);

  const token = env.SUPABASE_ACCESS_TOKEN || "";
  const projectRef = getProjectRef(env, safeFileEnv);
  if (!token || !projectRef) {
    unverified.push(
      "Hosted Supabase Auth config was not checked; missing " +
        [!token ? "SUPABASE_ACCESS_TOKEN" : null, !projectRef ? "SUPABASE_PROJECT_REF" : null]
          .filter(Boolean)
          .join(", "),
    );
  } else if (env.ZENFLOW_JOURNAL_MAGIC_LINK_LIVE_OFFLINE === "true") {
    unverified.push("Offline mode requested; hosted Supabase Auth config was not checked");
  } else {
    try {
      const hostedConfig = await fetchHostedAuthConfig(projectRef, token, {
        fetchImpl,
        apiBaseUrl: DEFAULT_MANAGEMENT_API_BASE_URL,
      });
      if (!hostedConfig.ok) {
        unverified.push(hostedConfig.message + "; hosted journal Magic Link config could not be verified");
      } else {
        failures.push(...inspectHostedAuthConfig(hostedConfig.body || {}, { requireCustomSmtp }));
        if (!hasCustomSmtp(hostedConfig.body || {})) {
          unverified.push("Hosted Supabase custom SMTP proof is missing; all-user email delivery remains unverified");
        }
      }
    } catch (error) {
      const reason = error instanceof Error && error.name === "AbortError" ? "request timed out" : "request failed";
      unverified.push("Hosted Supabase Auth config " + reason);
    }
  }

  const supabaseUrl = getSupabaseUrl(env, safeFileEnv);
  const publicKey = getSupabasePublicKey(env, safeFileEnv);
  if (!supabaseUrl || !publicKey) {
    unverified.push("Hosted public Auth settings were not checked; missing VITE_SUPABASE_URL or public Supabase key");
  } else if (env.ZENFLOW_JOURNAL_MAGIC_LINK_PUBLIC_SETTINGS_OFFLINE === "true") {
    unverified.push("Offline mode requested; hosted public Auth settings were not checked");
  } else {
    try {
      const publicSettings = await fetchHostedPublicSettings(supabaseUrl, publicKey, { fetchImpl });
      if (!publicSettings.ok) {
        unverified.push(publicSettings.message + "; hosted public Auth settings could not be verified");
      } else {
        failures.push(...inspectHostedPublicSettings(publicSettings.body || {}));
      }
    } catch (error) {
      const reason = error instanceof Error && error.name === "AbortError" ? "request timed out" : "request failed";
      unverified.push("Hosted public Auth settings " + reason);
    }
  }

  const redirectTo = buildJournalMagicLinkRedirectTo({
    baseUrl:
      getSafeEnvValue(env, safeFileEnv, "ZENFLOW_JOURNAL_MAGIC_LINK_REDIRECT_TO") ||
      getSafeEnvValue(env, safeFileEnv, "ZENFLOW_PUBLIC_AUTH_URL") ||
      DEFAULT_PUBLIC_APP_URL,
    nonce: SMOKE_NONCE,
  });

  const capturedUrl = String(env.ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL || "").trim();
  if (capturedUrl) {
    const capturedFailures = inspectCapturedMagicLinkUrl(capturedUrl, SMOKE_NONCE);
    failures.push(...capturedFailures);

    if (capturedFailures.length === 0) {
      const shouldVerifyCapturedUrl = env.ZENFLOW_JOURNAL_MAGIC_LINK_VERIFY_CAPTURED_URL === "true";
      const allowConsumingCapturedUrl = env.ZENFLOW_JOURNAL_MAGIC_LINK_CONSUME_CAPTURED_URL === "true";
      if (!shouldVerifyCapturedUrl || !allowConsumingCapturedUrl) {
        unverified.push(
          "Captured Supabase verify URL was not consumed; set ZENFLOW_JOURNAL_MAGIC_LINK_VERIFY_CAPTURED_URL=true and ZENFLOW_JOURNAL_MAGIC_LINK_CONSUME_CAPTURED_URL=true for full live proof",
        );
      } else {
        const verifyResult = await verifyCapturedMagicLinkRedirect(capturedUrl, SMOKE_NONCE, { fetchImpl });
        if (!verifyResult.ok) failures.push(verifyResult.message);
      }
    }
  } else {
    unverified.push("Journal Magic Link click-through proof was not provided; capture the Supabase verify URL from the delivered email for full proof");
  }

  if (env.ZENFLOW_JOURNAL_MAGIC_LINK_SEND_SMOKE === "true") {
    const smokeEmail = String(env.ZENFLOW_JOURNAL_MAGIC_LINK_SMOKE_EMAIL || "").trim();
    if (!env.ZENFLOW_JOURNAL_MAGIC_LINK_ALLOW_REAL_EMAIL || env.ZENFLOW_JOURNAL_MAGIC_LINK_ALLOW_REAL_EMAIL !== "true") {
      unverified.push("Journal Magic Link smoke send was refused; set ZENFLOW_JOURNAL_MAGIC_LINK_ALLOW_REAL_EMAIL=true for the dedicated smoke inbox");
    } else if (!supabaseUrl || !publicKey || !isValidEmail(smokeEmail)) {
      unverified.push("Journal Magic Link smoke send was not run; missing VITE_SUPABASE_URL, public Supabase key, or valid ZENFLOW_JOURNAL_MAGIC_LINK_SMOKE_EMAIL");
    } else {
      try {
        const sendResult = await sendMagicLinkSmoke({
          supabaseUrl,
          publicKey,
          email: smokeEmail,
          redirectTo,
          clientFactory,
        });
        if (!sendResult.ok) failures.push(sendResult.message);
      } catch (error) {
        const name = error instanceof Error ? error.name : "UnknownError";
        failures.push("Journal Magic Link smoke send failed: " + name);
      }
    }
  } else {
    unverified.push("Journal Magic Link smoke send was not performed; set ZENFLOW_JOURNAL_MAGIC_LINK_SEND_SMOKE=true with a dedicated smoke inbox");
  }

  if (failures.length > 0) {
    return buildResult("FAIL", "Journal Magic Link live readiness failed.", 1, { failures, unverified });
  }
  if (unverified.length > 0) {
    return buildResult("UNVERIFIED", "Journal Magic Link live readiness has missing external proof.", required ? 2 : 0, { unverified });
  }
  return buildResult("PASS", "Journal Magic Link live readiness is fully verified.", 0);
}

function printResult(result) {
  if (result.status === "FAIL") {
    line("FAIL", result.message);
    for (const failure of result.failures || []) line("FAIL", "- " + failure);
    for (const item of result.unverified || []) line("UNVERIFIED", "- " + item);
  } else if (result.status === "UNVERIFIED") {
    line("UNVERIFIED", result.message);
    for (const item of result.unverified || []) line("UNVERIFIED", "- " + item);
  } else {
    line("PASS", result.message);
  }
  process.exitCode = result.exitCode;
}

async function main() {
  const result = await checkJournalMagicLinkLive();
  printResult(result);
}

if (require.main === module) {
  void main();
}

module.exports = {
  HOSTED_JOURNAL_REDIRECT_ALLOW_LIST_URLS,
  HOSTED_NATIVE_OAUTH_REDIRECT_ALLOW_LIST_URLS,
  REQUIRED_JOURNAL_REDIRECT_URLS,
  REQUIRED_NATIVE_OAUTH_REDIRECT_URLS,
  SMOKE_NONCE,
  buildJournalMagicLinkRedirectTo,
  checkJournalMagicLinkLive,
  fetchHostedAuthConfig,
  fetchHostedPublicSettings,
  getProjectRef,
  inspectCapturedMagicLinkUrl,
  inspectHostedAuthConfig,
  inspectHostedNativeOAuthRedirectConfig,
  inspectHostedPublicSettings,
  normalizeCsvList,
  verifyCapturedMagicLinkRedirect,
};
