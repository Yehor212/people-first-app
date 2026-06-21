#!/usr/bin/env node

const DEFAULT_TELEGRAM_OIDC_BASE_URL = "https://api.zenflowapp.online/functions/v1/telegram-oidc";
const TELEGRAM_ISSUER = "https://oauth.telegram.org";
const TELEGRAM_AUTHORIZATION_ENDPOINT = "https://oauth.telegram.org/auth";
const TELEGRAM_TOKEN_ENDPOINT = "https://oauth.telegram.org/token";

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
  if (failures.length > 0) {
    return buildResult("FAIL", "Public Telegram OIDC endpoint is incomplete: " + failures.join("; "), 1, failures);
  }

  return buildResult("PASS", "Public Telegram OIDC discovery and JWKS are compatible with hosted Supabase Auth.", 0);
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
  inspectDiscovery,
  inspectJwks,
  isUnsupportedTelegramJwk,
  normalizeBaseUrl,
};
