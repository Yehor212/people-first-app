#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ENV_FILE_NAMES = [".env.local", ".env", ".env.production", ".env.example"];
const SAFE_ENV_FILE_KEYS = new Set([
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "ZENFLOW_FACEBOOK_AUTH_LIVE_REDIRECT_TO",
  "ZENFLOW_FACEBOOK_AUTH_LIVE_APP_URL",
  "ZENFLOW_FACEBOOK_AUTH_PUBLIC_APP_URL",
  "ZENFLOW_PUBLIC_AUTH_URL",
]);
const DEFAULT_REDIRECT_TO = "https://yehor212.github.io/people-first-app/";
const DEFAULT_FACEBOOK_SCOPES = ["email", "public_profile"];

function line(status, message) {
  console.log("[facebook-auth-live] " + status + " " + message);
}

function buildResult(status, message, exitCode, extra = {}) {
  return { status, message, exitCode, ...extra };
}

function isPlaceholderValue(key, value) {
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
      if (value && !isPlaceholderValue(match[1], value) && !env.has(match[1])) {
        env.set(match[1], value);
      }
    }
  }
  return env;
}

function getSafeEnvValue(env, safeFileEnv, key) {
  const direct = String(env[key] || "").trim();
  if (direct && !isPlaceholderValue(key, direct)) return direct;
  return safeFileEnv.get(key) || "";
}

function getSupabaseUrl(env, safeFileEnv) {
  return (
    getSafeEnvValue(env, safeFileEnv, "VITE_SUPABASE_URL") ||
    getSafeEnvValue(env, safeFileEnv, "SUPABASE_URL")
  );
}

function getRedirectTo(env, safeFileEnv) {
  return (
    getSafeEnvValue(env, safeFileEnv, "ZENFLOW_FACEBOOK_AUTH_LIVE_REDIRECT_TO") ||
    DEFAULT_REDIRECT_TO
  );
}

function normalizeHttpsUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function getPublicAppUrl(env, safeFileEnv) {
  return (
    getSafeEnvValue(env, safeFileEnv, "ZENFLOW_FACEBOOK_AUTH_LIVE_APP_URL") ||
    getSafeEnvValue(env, safeFileEnv, "ZENFLOW_FACEBOOK_AUTH_PUBLIC_APP_URL") ||
    getSafeEnvValue(env, safeFileEnv, "ZENFLOW_PUBLIC_AUTH_URL") ||
    getRedirectTo(env, safeFileEnv) ||
    DEFAULT_REDIRECT_TO
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

function extractPublicSupabaseUrlFromText(text) {
  return (
    text.match(/https:\/\/[a-z0-9]{20}\.supabase\.co/i)?.[0] ||
    text.match(/https:\/\/api\.zenflowapp\.online\b/i)?.[0] ||
    ""
  );
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

async function discoverPublicSupabaseUrlFromApp(appUrl, fetchImpl = fetch) {
  const normalizedAppUrl = normalizeHttpsUrl(appUrl);
  if (!normalizedAppUrl || typeof fetchImpl !== "function") return "";

  const html = await fetchText(normalizedAppUrl, fetchImpl);
  const fromHtml = extractPublicSupabaseUrlFromText(html);
  if (fromHtml) return fromHtml;

  const scriptUrls = extractScriptUrlsFromHtml(html, normalizedAppUrl).slice(0, 20);
  for (const scriptUrl of scriptUrls) {
    const scriptText = await fetchText(scriptUrl, fetchImpl);
    const fromScript = extractPublicSupabaseUrlFromText(scriptText);
    if (fromScript) return fromScript;
  }

  return "";
}

function buildFacebookAuthorizeUrl({
  supabaseUrl,
  redirectTo = DEFAULT_REDIRECT_TO,
  scopes = DEFAULT_FACEBOOK_SCOPES,
} = {}) {
  const base = normalizeHttpsUrl(supabaseUrl);
  if (!base) return "";

  const url = new URL("/auth/v1/authorize", base);
  url.searchParams.set("provider", "facebook");
  url.searchParams.set("redirect_to", redirectTo);
  url.searchParams.set("scopes", scopes.join(","));
  return url.toString();
}

function hostnameMatchesFacebook(hostname) {
  const host = String(hostname || "").toLowerCase();
  return host === "facebook.com" || host === "www.facebook.com" || host.endsWith(".facebook.com");
}

function detectFacebookOAuthProblem({ currentHost, externalText } = {}) {
  const text = String(externalText || "");
  const normalizedText = text.toLowerCase();
  const host = String(currentHost || "").toLowerCase();

  if (
    hostnameMatchesFacebook(host) &&
    normalizedText.includes("invalid scopes") &&
    /\bemail\b/i.test(text)
  ) {
    return {
      reason: "facebook_invalid_scope_email",
      providerError:
        "Facebook rejected the email permission. Configure email in Meta Use Cases > Authentication and Account Creation before enabling public Facebook login.",
    };
  }

  if (hostnameMatchesFacebook(host) && normalizedText.includes("invalid scopes")) {
    return {
      reason: "facebook_invalid_scope",
      providerError: "Facebook rejected one or more OAuth scopes.",
    };
  }

  return null;
}

function inspectFacebookOAuthPage({ finalUrl, externalText } = {}) {
  let url;
  try {
    url = new URL(finalUrl);
  } catch {
    return buildResult("FAIL", "Facebook OAuth did not produce a parseable redirect URL.", 1, {
      ok: false,
      reason: "unparseable_redirect_url",
    });
  }

  if (!hostnameMatchesFacebook(url.hostname)) {
    return buildResult("FAIL", "Facebook OAuth did not reach a trusted facebook.com host.", 1, {
      ok: false,
      reason: "unexpected_redirect_host",
      finalHost: url.host,
    });
  }

  const problem = detectFacebookOAuthProblem({ currentHost: url.host, externalText });
  if (problem) {
    return buildResult("FAIL", problem.providerError, 1, {
      ok: false,
      reason: problem.reason,
      finalHost: url.host,
    });
  }

  return buildResult(
    "PASS",
    "Facebook OAuth reaches Meta without an immediate invalid-scope error.",
    0,
    {
      ok: true,
      finalHost: url.host,
    }
  );
}

async function probeFacebookOAuthPage({ authorizeUrl, timeoutMs = 45_000 } = {}) {
  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch {
    return buildResult(
      "UNVERIFIED",
      "Playwright is unavailable; Facebook live OAuth page was not checked.",
      0,
      {
        ok: false,
        reason: "playwright_unavailable",
      }
    );
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto(authorizeUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForTimeout(1000);
    const externalText = await page.evaluate(() => document.body?.innerText?.slice(0, 3000) || "");
    return inspectFacebookOAuthPage({ finalUrl: page.url(), externalText });
  } finally {
    await browser.close();
  }
}

async function probeFacebookOAuthRedirect({ authorizeUrl, fetchImpl = fetch } = {}) {
  if (typeof fetchImpl !== "function") {
    return buildResult(
      "UNVERIFIED",
      "No fetch implementation is available for Facebook redirect fallback.",
      0,
      {
        ok: false,
        reason: "fetch_unavailable",
      }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetchImpl(authorizeUrl, {
      redirect: "manual",
      headers: { Accept: "text/html,*/*" },
      signal: controller.signal,
    });
    const location = response.headers?.get?.("location") || "";
    if (!location) {
      return buildResult(
        "UNVERIFIED",
        "Facebook OAuth redirect fallback did not receive a Location header.",
        0,
        {
          ok: false,
          reason: "missing_redirect_location",
        }
      );
    }

    let redirectUrl;
    try {
      redirectUrl = new URL(location);
    } catch {
      return buildResult(
        "UNVERIFIED",
        "Facebook OAuth redirect fallback received an unparseable Location header.",
        0,
        {
          ok: false,
          reason: "unparseable_redirect_location",
        }
      );
    }

    if (!hostnameMatchesFacebook(redirectUrl.hostname)) {
      return buildResult(
        "FAIL",
        "Facebook OAuth redirect fallback did not reach a trusted facebook.com host.",
        1,
        {
          ok: false,
          reason: "unexpected_redirect_host",
          finalHost: redirectUrl.host,
        }
      );
    }

    return buildResult(
      "PASS",
      "Facebook OAuth redirects to Meta; browser page inspection was unavailable.",
      0,
      {
        ok: true,
        reason: "facebook_redirect_reachable",
        finalHost: redirectUrl.host,
      }
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function checkFacebookAuthLive({
  env = process.env,
  rootDir = process.cwd(),
  probeImpl = probeFacebookOAuthPage,
  fetchImpl = fetch,
} = {}) {
  const required = env.ZENFLOW_FACEBOOK_AUTH_LIVE_REQUIRED === "true";

  if (env.ZENFLOW_FACEBOOK_AUTH_LIVE_OFFLINE === "true") {
    return buildResult(
      "UNVERIFIED",
      "Offline mode requested; live Facebook OAuth page was not checked.",
      required ? 2 : 0
    );
  }

  const safeFileEnv = parseSafeEnvFiles(rootDir);
  let supabaseUrl = getSupabaseUrl(env, safeFileEnv);
  const redirectTo = getRedirectTo(env, safeFileEnv);

  if (!supabaseUrl) {
    try {
      supabaseUrl = await discoverPublicSupabaseUrlFromApp(
        getPublicAppUrl(env, safeFileEnv),
        fetchImpl
      );
    } catch {
      supabaseUrl = "";
    }
  }

  const authorizeUrl = buildFacebookAuthorizeUrl({ supabaseUrl, redirectTo });

  if (!authorizeUrl) {
    return buildResult(
      "UNVERIFIED",
      "Live Facebook OAuth page was not checked; missing VITE_SUPABASE_URL.",
      required ? 2 : 0
    );
  }

  let result;
  try {
    result = await probeImpl({
      authorizeUrl,
      timeoutMs: Number(env.ZENFLOW_FACEBOOK_AUTH_LIVE_TIMEOUT_MS || 45_000),
    });
  } catch (error) {
    const fallbackResult = await probeFacebookOAuthRedirect({ authorizeUrl, fetchImpl });
    if (fallbackResult.status === "PASS") return fallbackResult;

    const reason = error instanceof Error && error.name === "TimeoutError" ? "timed out" : "failed";
    if (fallbackResult.status === "FAIL") {
      return { ...fallbackResult, exitCode: required ? 1 : 0 };
    }
    return buildResult(
      "UNVERIFIED",
      "Live Facebook OAuth page check " + reason + "; redirect fallback was also inconclusive.",
      required ? 2 : 0,
      { reason: fallbackResult.reason }
    );
  }

  if (result.status === "PASS") return result;
  if (result.status === "FAIL") return { ...result, exitCode: required ? 1 : 0 };
  return { ...result, exitCode: required ? 2 : 0 };
}

function printResult(result) {
  line(result.status, result.message);
  if (result.reason) line("DETAIL", "reason=" + result.reason);
  if (result.finalHost) line("DETAIL", "finalHost=" + result.finalHost);
  process.exitCode = result.exitCode;
}

async function main() {
  const result = await checkFacebookAuthLive();
  printResult(result);
}

if (require.main === module) {
  void main();
}

module.exports = {
  DEFAULT_FACEBOOK_SCOPES,
  buildFacebookAuthorizeUrl,
  checkFacebookAuthLive,
  discoverPublicSupabaseUrlFromApp,
  detectFacebookOAuthProblem,
  hostnameMatchesFacebook,
  inspectFacebookOAuthPage,
  parseSafeEnvFiles,
  probeFacebookOAuthPage,
  probeFacebookOAuthRedirect,
};
