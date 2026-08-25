#!/usr/bin/env node

const DEFAULT_TELEGRAM_OIDC_BASE_URL =
  "https://bwgfslmxmueyglpumkbf.supabase.co/functions/v1/telegram-oidc";
const TELEGRAM_ISSUER = "https://oauth.telegram.org";
const TELEGRAM_AUTHORIZATION_ENDPOINT = "https://oauth.telegram.org/auth";
const TELEGRAM_TOKEN_ENDPOINT = "https://oauth.telegram.org/token";
const DEFAULT_SUPABASE_URL = "https://bwgfslmxmueyglpumkbf.supabase.co";
const DEFAULT_AUTH_REDIRECT_URL = "https://yehor212.github.io/people-first-app/";

function line(status, message) {
  console.log("[telegram-oidc-live] " + status + " " + message);
}

function buildResult(status, message, exitCode, failures = []) {
  return { status, message, exitCode, ...(failures.length > 0 ? { failures } : {}) };
}

function normalizeBaseUrl(rawUrl) {
  const value = String(rawUrl || DEFAULT_TELEGRAM_OIDC_BASE_URL).trim();
  return value.replace(/\/+$/g, "");
}

function toArray(value) {
  return Array.isArray(value) ? value.map(String) : [];
}

function inspectDiscovery(discovery, expectedBaseUrl = DEFAULT_TELEGRAM_OIDC_BASE_URL) {
  const baseUrl = normalizeBaseUrl(expectedBaseUrl);
  const failures = [];

  if (!discovery || typeof discovery !== "object") {
    return ["Discovery response is not an object"];
  }

  if (discovery.issuer !== TELEGRAM_ISSUER) {
    failures.push("Discovery issuer is not https://oauth.telegram.org");
  }
  if (discovery.authorization_endpoint !== TELEGRAM_AUTHORIZATION_ENDPOINT) {
    failures.push("Discovery authorization endpoint is not https://oauth.telegram.org/auth");
  }
  if (discovery.token_endpoint !== TELEGRAM_TOKEN_ENDPOINT) {
    failures.push("Discovery token endpoint is not https://oauth.telegram.org/token");
  }
  if (discovery.jwks_uri !== baseUrl + "/jwks") {
    failures.push("Discovery JWKS URI is not " + baseUrl + "/jwks");
  }
  if (!toArray(discovery.response_types_supported).includes("code")) {
    failures.push("Discovery does not advertise authorization code flow");
  }
  if (!toArray(discovery.code_challenge_methods_supported).includes("S256")) {
    failures.push("Discovery does not advertise PKCE S256");
  }
  if (!toArray(discovery.token_endpoint_auth_methods_supported).includes("client_secret_basic")) {
    failures.push("Discovery does not advertise client_secret_basic");
  }

  return failures;
}

function isUnsupportedTelegramJwk(jwk) {
  const alg = typeof jwk?.alg === "string" ? jwk.alg.toUpperCase() : "";
  const crv = typeof jwk?.crv === "string" ? jwk.crv.toLowerCase() : "";
  return alg === "ES256K" || crv === "secp256k1";
}

function inspectJwks(jwks) {
  if (!jwks || typeof jwks !== "object" || !Array.isArray(jwks.keys)) {
    return ["JWKS response does not contain a keys array"];
  }

  const failures = [];
  if (jwks.keys.length === 0) {
    failures.push("JWKS response has no keys");
  }

  for (const key of jwks.keys) {
    if (isUnsupportedTelegramJwk(key)) {
      const kid = typeof key.kid === "string" && key.kid ? key.kid : "unknown kid";
      failures.push("JWKS contains unsupported Telegram key: " + kid);
    }
  }

  return failures;
}

async function fetchJson(url, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetchImpl(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const text = await response.text();

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        body: null,
        message: "HTTP " + response.status + " from " + url,
      };
    }

    try {
      return { ok: true, status: response.status, body: text ? JSON.parse(text) : {}, message: "" };
    } catch {
      return { ok: false, status: response.status, body: null, message: "Non-JSON response from " + url };
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function checkHostedAuthorize({ fetchImpl, supabaseUrl, redirectUrl }) {
  const authorizeUrl = new URL("/auth/v1/authorize", supabaseUrl);
  authorizeUrl.searchParams.set("provider", "custom:telegram");
  authorizeUrl.searchParams.set("redirect_to", redirectUrl);

  let response;
  try {
    response = await fetchImpl(authorizeUrl, {
      headers: { Accept: "application/json" },
      redirect: "manual",
    });
  } catch {
    return ["Hosted Supabase Telegram authorize request failed"];
  }

  const location = response.headers.get("location");
  if (response.status >= 300 && response.status < 400 && location) {
    let target;
    try {
      target = new URL(location);
    } catch {
      return ["Hosted Supabase Telegram authorize redirect is not a valid URL"];
    }

    const failures = [];
    if (target.origin !== "https://oauth.telegram.org" || target.pathname !== "/auth") {
      failures.push("Hosted Supabase Telegram authorize does not redirect to https://oauth.telegram.org/auth");
    }
    if (!target.searchParams.get("client_id")) {
      failures.push("Telegram authorize redirect is missing client_id");
    }
    if (!target.searchParams.get("state")) {
      failures.push("Telegram authorize redirect is missing state");
    }
    if (!target.searchParams.get("code_challenge")) {
      failures.push("Telegram authorize redirect is missing PKCE code_challenge");
    }
    if (target.searchParams.get("code_challenge_method") !== "S256") {
      failures.push("Telegram authorize redirect does not require PKCE S256");
    }
    return failures;
  }

  let message = "HTTP " + response.status;
  try {
    const body = await response.json();
    const safeMessage = typeof body?.msg === "string" ? body.msg : "";
    const safeCode = typeof body?.error_code === "string" ? body.error_code : "";
    message = [safeCode, safeMessage].filter(Boolean).join(": ") || message;
  } catch {
    // The HTTP status remains sufficient evidence when the body is not JSON.
  }
  return ["Hosted Supabase Telegram authorize failed: " + message];
}

async function checkTelegramOidcLive({ env = process.env, fetchImpl = fetch } = {}) {
  const required = env.ZENFLOW_TELEGRAM_OIDC_LIVE_REQUIRED === "true";
  const baseUrl = normalizeBaseUrl(env.ZENFLOW_TELEGRAM_OIDC_LIVE_URL);

  if (env.ZENFLOW_TELEGRAM_OIDC_LIVE_OFFLINE === "true") {
    return buildResult(
      "UNVERIFIED",
      "Offline mode requested; public Telegram OIDC endpoint was not checked.",
      required ? 2 : 0,
    );
  }

  if (typeof fetchImpl !== "function") {
    return buildResult(
      "UNVERIFIED",
      "No fetch implementation is available; public Telegram OIDC endpoint was not checked.",
      required ? 2 : 0,
    );
  }

  let discoveryResult;
  try {
    discoveryResult = await fetchJson(baseUrl + "/.well-known/openid-configuration", fetchImpl);
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError" ? "request timed out" : "request failed";
    return buildResult("UNVERIFIED", "Discovery " + reason + ".", required ? 2 : 0);
  }

  if (!discoveryResult.ok) {
    return buildResult("UNVERIFIED", discoveryResult.message + ".", required ? 2 : 0);
  }

  const discoveryFailures = inspectDiscovery(discoveryResult.body || {}, baseUrl);
  const discoveryJwksUri =
    discoveryResult.body &&
    typeof discoveryResult.body === "object" &&
    typeof discoveryResult.body.jwks_uri === "string"
      ? discoveryResult.body.jwks_uri
      : baseUrl + "/jwks";

  let jwksResult;
  try {
    jwksResult = await fetchJson(discoveryJwksUri, fetchImpl);
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError" ? "request timed out" : "request failed";
    return buildResult("UNVERIFIED", "JWKS " + reason + ".", required ? 2 : 0);
  }

  if (!jwksResult.ok) {
    return buildResult("UNVERIFIED", jwksResult.message + ".", required ? 2 : 0);
  }

  const failures = [...discoveryFailures, ...inspectJwks(jwksResult.body || {})];
  failures.push(
    ...(await checkHostedAuthorize({
      fetchImpl,
      supabaseUrl: normalizeBaseUrl(env.ZENFLOW_SUPABASE_URL || DEFAULT_SUPABASE_URL),
      redirectUrl: String(env.ZENFLOW_TELEGRAM_AUTH_REDIRECT_URL || DEFAULT_AUTH_REDIRECT_URL),
    })),
  );
  if (failures.length > 0) {
    return buildResult("FAIL", "Telegram hosted auth readiness failed: " + failures.join("; "), 1, failures);
  }

  return buildResult("PASS", "Telegram discovery, JWKS, and hosted Supabase authorize redirect are compatible.", 0);
}

function printResult(result) {
  if (result.status === "FAIL" && Array.isArray(result.failures) && result.failures.length > 0) {
    console.log("[telegram-oidc-live] FAIL Public Telegram OIDC endpoint is incomplete:");
    for (const failure of result.failures) console.log("[telegram-oidc-live] FAIL - " + failure);
  } else {
    line(result.status, result.message);
  }
  process.exitCode = result.exitCode;
}

async function main() {
  const result = await checkTelegramOidcLive();
  printResult(result);
}

if (require.main === module) {
  void main();
}

module.exports = {
  DEFAULT_TELEGRAM_OIDC_BASE_URL,
  checkTelegramOidcLive,
  checkHostedAuthorize,
  inspectDiscovery,
  inspectJwks,
  isUnsupportedTelegramJwk,
  normalizeBaseUrl,
};
