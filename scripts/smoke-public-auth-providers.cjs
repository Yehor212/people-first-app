#!/usr/bin/env node

const DEFAULT_PUBLIC_AUTH_URL = "https://yehor212.github.io/people-first-app/";
const DEFAULT_EXPECTED_PROVIDERS = ["google", "telegram"];
const DEFAULT_FORBIDDEN_PROVIDERS = ["facebook", "apple"];
const SUPABASE_AUTH_REDIRECT_HOSTS = ["api.zenflowapp.online", "bwgfslmxmueyglpumkbf.supabase.co"];
const DEFAULT_REDIRECT_HOSTS = {
  google: ["accounts.google.com", "google.com", ...SUPABASE_AUTH_REDIRECT_HOSTS],
  telegram: ["oauth.telegram.org", ...SUPABASE_AUTH_REDIRECT_HOSTS],
  apple: ["appleid.apple.com", ...SUPABASE_AUTH_REDIRECT_HOSTS],
  facebook: ["facebook.com", "www.facebook.com", ...SUPABASE_AUTH_REDIRECT_HOSTS],
};
const OAUTH_CALLBACK_PARAM_NAMES = [
  "access_token",
  "refresh_token",
  "provider_token",
  "provider_refresh_token",
  "code",
  "state",
  "error",
  "error_description",
  "token_type",
  "expires_at",
  "expires_in",
];

function parseCsv(value, fallback, options = {}) {
  if (value === undefined || value === null) return [...fallback];
  if (value.trim() === "") return options.emptyMeansEmpty ? [] : [...fallback];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeBaseUrl(rawUrl) {
  const url = new URL(rawUrl || DEFAULT_PUBLIC_AUTH_URL);
  url.hash = "";
  return url;
}

function parsePublicAuthUrls(value, fallback = [DEFAULT_PUBLIC_AUTH_URL]) {
  return parseCsv(value, fallback).map((url) => normalizeBaseUrl(url));
}

function appendPublicAuthPath(baseUrl, path) {
  const trimmedPath = String(path || "")
    .trim()
    .replace(/^\/+/, "");
  if (!trimmedPath) return normalizeBaseUrl(baseUrl.toString());

  const url = new URL(trimmedPath, baseUrl);
  url.hash = "";
  return url;
}

function resolvePublicAuthUrls({ baseUrl, urls, additionalPaths } = {}) {
  const baseUrls = parsePublicAuthUrls(urls || baseUrl || DEFAULT_PUBLIC_AUTH_URL);
  const extraPaths = parseCsv(additionalPaths, []);
  const resolvedUrls = [];

  for (const url of baseUrls) {
    resolvedUrls.push(url);
    for (const path of extraPaths) {
      resolvedUrls.push(appendPublicAuthPath(url, path));
    }
  }

  return resolvedUrls;
}

function providerRedirectHosts(provider) {
  const normalizedProvider = provider.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const envKey = "ZENFLOW_PUBLIC_AUTH_REDIRECT_HOSTS_" + normalizedProvider;
  return parseCsv(process.env[envKey], DEFAULT_REDIRECT_HOSTS[provider] || []);
}

function hostnameMatches(hostname, allowedHost) {
  const normalizedHost = hostname.toLowerCase();
  const normalizedAllowedHost = allowedHost.toLowerCase();
  return (
    normalizedHost === normalizedAllowedHost || normalizedHost.endsWith("." + normalizedAllowedHost)
  );
}

function detectProviderRedirectError(state) {
  const externalText = String(state?.externalText || "");
  const normalizedText = externalText.toLowerCase();
  const currentHost = String(state?.currentHost || "").toLowerCase();

  if (
    state?.provider === "facebook" &&
    currentHost.endsWith("facebook.com") &&
    normalizedText.includes("invalid scopes") &&
    /\bemail\b/i.test(externalText)
  ) {
    return {
      reason: "facebook_invalid_scope_email",
      providerError:
        "Facebook rejected the email permission. Configure email in Meta Use Cases > Authentication and Account Creation.",
    };
  }

  if (normalizedText.includes("invalid scopes")) {
    return {
      reason: "provider_invalid_scope",
      providerError: "OAuth provider rejected one or more requested scopes.",
    };
  }

  return null;
}

function isAppDiagnosticUrl(diagnosticUrl, currentPageUrl, appHost, requireDiagnosticUrl = false) {
  if (requireDiagnosticUrl && !diagnosticUrl) return false;

  const candidates = [diagnosticUrl, ...(requireDiagnosticUrl ? [] : [currentPageUrl])].filter(
    Boolean
  );
  for (const rawUrl of candidates) {
    try {
      return new URL(rawUrl).host === appHost;
    } catch {
      // Try the fallback URL before deciding below.
    }
  }
  return true;
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function diagnosticEntries(result) {
  return [
    result?.error,
    ...(Array.isArray(result?.consoleMessages) ? result.consoleMessages : []),
    ...(Array.isArray(result?.failedRequests) ? result.failedRequests : []),
    ...(Array.isArray(result?.listConsoleMessages) ? result.listConsoleMessages : []),
    ...(Array.isArray(result?.listFailedRequests) ? result.listFailedRequests : []),
  ].filter(Boolean);
}

function resultHostMatchesApp(result, appHost) {
  const rawUrl = result?.currentUrl || result?.url || "";
  if (!rawUrl) return true;

  try {
    return new URL(rawUrl).host === appHost;
  } catch {
    return false;
  }
}

function isRetryableAppLoadFailure(result, appHost) {
  if (!result || result.ok || result.providerError) return false;
  if (!resultHostMatchesApp(result, appHost)) return false;

  const diagnostics = diagnosticEntries(result).join("\n");
  const hasAppAssetSignal = /\/assets\/|failed to load resource|net::err_aborted/i.test(
    diagnostics
  );
  const hasTransientSignal = /status of 503|\b503\b|net::err_aborted/i.test(diagnostics);

  return hasAppAssetSignal && hasTransientSignal;
}

function isRetryablePublicAuthResult(result, appHost) {
  if (!result || result.ok) return false;
  if (isRetryableAppLoadFailure(result, appHost)) return true;
  if (isRetryableAppLoadFailure(result.errorCallbackResult, appHost)) return true;
  return Array.isArray(result.redirectResults)
    ? result.redirectResults.some((redirectResult) =>
        isRetryableAppLoadFailure(redirectResult, appHost)
      )
    : false;
}

async function waitForPublicAuthRetry(attempt) {
  await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * attempt, 5000)));
}

function initEntryState() {
  const json = (value) => JSON.stringify(value);
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem("zenflow-language", json("en"));
  localStorage.setItem("zenflow-language-selected", json(true));
  localStorage.setItem("zenflow-google-auth-checked", json(false));
  localStorage.setItem("zenflow-onboarding-complete", json(false));
  localStorage.setItem("zenflow-notification-permission-checked", json(false));
  localStorage.setItem("zenflow-theme", "light");
  localStorage.setItem("zenflow_oled_mode", json(false));
  localStorage.setItem("zenflow:theme-v0c", json({ state: { theme: "paper" }, version: 0 }));
}

function createScenarioUrl(baseUrl, label) {
  const url = new URL(baseUrl.toString());
  url.searchParams.set("publicAuthSmoke", label + "-" + Date.now());
  return url.toString();
}

function hasOAuthCallbackParams(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
  return OAUTH_CALLBACK_PARAM_NAMES.some(
    (param) => url.searchParams.has(param) || hashParams.has(param)
  );
}

function buildOAuthErrorCallbackUrl(baseUrl, label = "callback-error") {
  const url = new URL(baseUrl.toString());
  url.hash = "";
  url.searchParams.set("error", "access_denied");
  url.searchParams.set("error_description", "access_denied");
  url.searchParams.set("state", "public-auth-smoke-" + label);
  url.searchParams.set("publicAuthSmoke", "oauth-error-" + label + "-" + Date.now());
  return url;
}

function validateOAuthErrorCallbackState(state, expectedProviders, forbiddenProviders = []) {
  const finalUrl = String(state?.finalUrl || "");
  const providers = Array.isArray(state?.providers) ? state.providers.filter(Boolean) : [];
  const providerSet = new Set(providers);
  const buttons = Array.isArray(state?.buttons) ? state.buttons : [];
  const alertText = String(state?.alertText || "");
  const missingExpected = expectedProviders.filter((provider) => !providerSet.has(provider));
  const forbiddenVisible = forbiddenProviders.filter((provider) => providerSet.has(provider));
  const disabledExpected = buttons
    .filter((button) => expectedProviders.includes(button.provider) && button.disabled)
    .map((button) => button.provider);
  const hasOAuthParams = hasOAuthCallbackParams(finalUrl);
  const authScreenVisible = Boolean(state?.authScreenVisible);
  const alertOk = alertText.includes("access_denied");
  const ok =
    authScreenVisible &&
    alertOk &&
    !hasOAuthParams &&
    missingExpected.length === 0 &&
    forbiddenVisible.length === 0 &&
    disabledExpected.length === 0;

  return {
    ok,
    finalUrl,
    authScreenVisible,
    alertText,
    providers,
    missingExpected,
    forbiddenVisible,
    disabledExpected,
    hasOAuthParams,
  };
}

async function collectProviders(page, url, timeoutMs) {
  await page.addInitScript(initEntryState);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.getByTestId("auth-screen").waitFor({ state: "visible", timeout: timeoutMs });
  return page
    .locator('[data-testid^="auth-provider-content-"]')
    .evaluateAll((elements) =>
      elements.map((element) =>
        element.getAttribute("data-testid")?.replace("auth-provider-content-", "")
      )
    );
}

async function clickProvider(page, provider, timeoutMs) {
  const content = page.getByTestId("auth-provider-content-" + provider);
  const clickTarget = content.locator(
    "xpath=ancestor::*[self::button or self::a or @role='button'][1]"
  );

  if ((await clickTarget.count()) > 0) {
    await clickTarget.click({ timeout: timeoutMs });
    return;
  }

  await content.click({ timeout: timeoutMs });
}

async function verifyOAuthErrorCallback({
  browser,
  baseUrl,
  expectedProviders,
  forbiddenProviders,
  timeoutMs,
}) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.addInitScript(initEntryState);

  const consoleMessages = [];
  const failedRequests = [];
  const callbackUrl = buildOAuthErrorCallbackUrl(baseUrl);

  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      consoleMessages.push(message.type() + ": " + message.text());
    }
  });
  page.on("requestfailed", (request) => {
    failedRequests.push(
      request.method() + " " + request.url() + " " + request.failure()?.errorText
    );
  });

  try {
    await page.goto(callbackUrl.toString(), { waitUntil: "networkidle", timeout: timeoutMs });
    await page.waitForSelector('[data-testid="auth-screen"]', {
      state: "visible",
      timeout: timeoutMs,
    });
    await page.waitForSelector('[role="alert"]', { state: "visible", timeout: timeoutMs });
    await page.waitForFunction(
      (params) => {
        const url = new URL(location.href);
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
        return !params.some((param) => url.searchParams.has(param) || hashParams.has(param));
      },
      OAUTH_CALLBACK_PARAM_NAMES,
      { timeout: timeoutMs }
    );

    const pageState = await page.evaluate(() => {
      const providers = Array.from(
        document.querySelectorAll('[data-testid^="auth-provider-content-"]')
      ).map((element) =>
        element.getAttribute("data-testid")?.replace("auth-provider-content-", "")
      );
      const buttons = providers.map((provider) => {
        const content = document.querySelector(
          '[data-testid="auth-provider-content-' + provider + '"]'
        );
        const button = content?.closest('button, a, [role="button"]');
        return {
          provider,
          disabled:
            button?.hasAttribute("disabled") || button?.getAttribute("aria-disabled") === "true",
        };
      });

      return {
        finalUrl: location.href,
        authScreenVisible: Boolean(document.querySelector('[data-testid="auth-screen"]')),
        alertText: document.querySelector('[role="alert"]')?.textContent?.trim() || "",
        providers,
        buttons,
      };
    });
    const validation = validateOAuthErrorCallbackState(
      pageState,
      expectedProviders,
      forbiddenProviders
    );
    const ok = validation.ok && consoleMessages.length === 0 && failedRequests.length === 0;

    return {
      ok,
      reason: ok ? null : "oauth_error_callback_not_recoverable",
      ...validation,
      consoleCount: consoleMessages.length,
      failedCount: failedRequests.length,
      consoleMessages: consoleMessages.slice(0, 5),
      failedRequests: failedRequests.slice(0, 5),
    };
  } catch (error) {
    return {
      ok: false,
      reason: "oauth_error_callback_check_failed",
      error: error instanceof Error ? error.message : String(error),
      currentUrl: page.url(),
      consoleCount: consoleMessages.length,
      failedCount: failedRequests.length,
      consoleMessages: consoleMessages.slice(0, 5),
      failedRequests: failedRequests.slice(0, 5),
    };
  } finally {
    await context.close();
  }
}

async function verifyProviderRedirect({ browser, baseUrl, provider, timeoutMs }) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const appHost = baseUrl.host;
  const page = await context.newPage();
  const consoleMessages = [];
  const failedRequests = [];
  const externalConsoleMessages = [];
  const externalFailedRequests = [];
  let providerRedirectStarted = false;

  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      const diagnostic = message.type() + ": " + message.text();
      const target = isAppDiagnosticUrl(
        message.location().url,
        page.url(),
        appHost,
        providerRedirectStarted
      )
        ? consoleMessages
        : externalConsoleMessages;
      target.push(diagnostic);
    }
  });
  page.on("requestfailed", (request) => {
    const diagnostic = request.method() + " " + request.url() + " " + request.failure()?.errorText;
    const target = isAppDiagnosticUrl(request.url(), page.url(), appHost)
      ? failedRequests
      : externalFailedRequests;
    target.push(diagnostic);
  });

  try {
    const providersBefore = await collectProviders(
      page,
      createScenarioUrl(baseUrl, "provider-" + provider),
      timeoutMs
    );

    if (!providersBefore.includes(provider)) {
      return {
        provider,
        ok: false,
        reason: "provider_not_visible",
        providersBefore,
        consoleCount: consoleMessages.length,
        failedCount: failedRequests.length,
        externalConsoleCount: externalConsoleMessages.length,
        externalFailedCount: externalFailedRequests.length,
      };
    }

    providerRedirectStarted = true;
    await clickProvider(page, provider, timeoutMs);
    await page.waitForURL((currentUrl) => currentUrl.host !== appHost, { timeout: timeoutMs });
    await page.waitForTimeout(1000);

    const finalUrl = new URL(page.url());
    const allowedHosts = providerRedirectHosts(provider);
    const hostOk = allowedHosts.some((host) => hostnameMatches(finalUrl.hostname, host));
    let providerError = null;

    if (hostOk) {
      try {
        const externalText = await page.evaluate(
          () => document.body?.innerText?.slice(0, 2000) || ""
        );
        providerError = detectProviderRedirectError({
          provider,
          currentHost: finalUrl.host,
          externalText,
        });
      } catch {
        providerError = null;
      }
    }

    const ok = hostOk && !providerError;

    return {
      provider,
      ok,
      reason: providerError?.reason || (hostOk ? null : "unexpected_redirect_host"),
      providerError: providerError?.providerError,
      providersBefore,
      finalHost: finalUrl.host,
      finalPath: finalUrl.pathname,
      allowedHosts,
      consoleCount: consoleMessages.length,
      failedCount: failedRequests.length,
      externalConsoleCount: externalConsoleMessages.length,
      externalFailedCount: externalFailedRequests.length,
      consoleMessages: consoleMessages.slice(0, 5),
      failedRequests: failedRequests.slice(0, 5),
    };
  } catch (error) {
    return {
      provider,
      ok: false,
      reason: "redirect_check_failed",
      error: error instanceof Error ? error.message : String(error),
      currentUrl: page.url(),
      consoleCount: consoleMessages.length,
      failedCount: failedRequests.length,
      externalConsoleCount: externalConsoleMessages.length,
      externalFailedCount: externalFailedRequests.length,
      consoleMessages: consoleMessages.slice(0, 5),
      failedRequests: failedRequests.slice(0, 5),
    };
  } finally {
    await context.close();
  }
}

async function launchBrowser(chromium) {
  const channel = process.env.ZENFLOW_PUBLIC_AUTH_BROWSER_CHANNEL;
  if (!channel) return chromium.launch();

  try {
    return await chromium.launch({ channel });
  } catch (error) {
    console.warn(
      "[public-auth-smoke] Browser channel unavailable, falling back to bundled Chromium:",
      channel
    );
    return chromium.launch();
  }
}

async function verifyPublicAuthUrlOnce({
  browser,
  baseUrl,
  expectedProviders,
  forbiddenProviders,
  clickProviders,
  timeoutMs,
}) {
  const listContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const listPage = await listContext.newPage();
  const listConsoleMessages = [];
  const listFailedRequests = [];

  listPage.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      listConsoleMessages.push(message.type() + ": " + message.text());
    }
  });
  listPage.on("requestfailed", (request) => {
    listFailedRequests.push(
      request.method() + " " + request.url() + " " + request.failure()?.errorText
    );
  });

  let publicProviders = [];
  let listFailure = null;

  try {
    publicProviders = await collectProviders(
      listPage,
      createScenarioUrl(baseUrl, "list"),
      timeoutMs
    );
  } catch (error) {
    listFailure = error instanceof Error ? error.message : String(error);
  } finally {
    await listContext.close();
  }

  if (listFailure) {
    return {
      ok: false,
      reason: "provider_list_failed",
      error: listFailure,
      currentUrl: listPage.url(),
      url: baseUrl.toString(),
      expectedProviders,
      publicProviders,
      forbiddenProviders,
      forbiddenVisible: [],
      missingExpected: expectedProviders,
      listConsoleCount: listConsoleMessages.length,
      listFailedCount: listFailedRequests.length,
      listConsoleMessages: listConsoleMessages.slice(0, 5),
      listFailedRequests: listFailedRequests.slice(0, 5),
      redirectResults: [],
    };
  }

  const providerSet = new Set(publicProviders);
  const expectedMatches = publicProviders.join(",") === expectedProviders.join(",");
  const forbiddenVisible = forbiddenProviders.filter((provider) => providerSet.has(provider));
  const missingExpected = expectedProviders.filter((provider) => !providerSet.has(provider));

  const redirectResults = [];
  if (process.env.ZENFLOW_PUBLIC_AUTH_SKIP_CLICKS !== "true") {
    for (const provider of clickProviders) {
      redirectResults.push(await verifyProviderRedirect({ browser, baseUrl, provider, timeoutMs }));
    }
  }
  const errorCallbackResult = await verifyOAuthErrorCallback({
    browser,
    baseUrl,
    expectedProviders,
    forbiddenProviders,
    timeoutMs,
  });

  const ok =
    expectedMatches &&
    forbiddenVisible.length === 0 &&
    missingExpected.length === 0 &&
    listConsoleMessages.length === 0 &&
    listFailedRequests.length === 0 &&
    errorCallbackResult.ok &&
    redirectResults.every(
      (result) => result.ok && result.consoleCount === 0 && result.failedCount === 0
    );

  return {
    ok,
    url: baseUrl.toString(),
    expectedProviders,
    publicProviders,
    forbiddenProviders,
    forbiddenVisible,
    missingExpected,
    listConsoleCount: listConsoleMessages.length,
    listFailedCount: listFailedRequests.length,
    listConsoleMessages: listConsoleMessages.slice(0, 5),
    listFailedRequests: listFailedRequests.slice(0, 5),
    errorCallbackResult,
    redirectResults,
  };
}

async function verifyPublicAuthUrl(args) {
  const maxAttempts = parsePositiveInteger(process.env.ZENFLOW_PUBLIC_AUTH_RETRY_ATTEMPTS, 3);
  let lastResult = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await verifyPublicAuthUrlOnce(args);
    const retryable = isRetryablePublicAuthResult(result, args.baseUrl.host);
    lastResult = { ...result, attempt, retryable };

    if (!retryable || attempt === maxAttempts) return lastResult;
    await waitForPublicAuthRetry(attempt);
  }

  return lastResult;
}

async function run() {
  const { chromium } = require("playwright");
  const publicAuthUrls = resolvePublicAuthUrls({
    baseUrl: process.env.ZENFLOW_PUBLIC_AUTH_URL,
    urls: process.env.ZENFLOW_PUBLIC_AUTH_URLS,
    additionalPaths: process.env.ZENFLOW_PUBLIC_AUTH_ADDITIONAL_PATHS,
  });
  const expectedProviders = parseCsv(
    process.env.ZENFLOW_PUBLIC_AUTH_EXPECTED_PROVIDERS,
    DEFAULT_EXPECTED_PROVIDERS
  );
  const forbiddenProviders = parseCsv(
    process.env.ZENFLOW_PUBLIC_AUTH_FORBIDDEN_PROVIDERS,
    DEFAULT_FORBIDDEN_PROVIDERS,
    { emptyMeansEmpty: true }
  );
  const clickProviders = parseCsv(
    process.env.ZENFLOW_PUBLIC_AUTH_CLICK_PROVIDERS,
    expectedProviders
  );
  const timeoutMs = Number(process.env.ZENFLOW_PUBLIC_AUTH_TIMEOUT_MS || 45_000);

  const browser = await launchBrowser(chromium);
  const routeResults = [];

  try {
    for (const baseUrl of publicAuthUrls) {
      routeResults.push(
        await verifyPublicAuthUrl({
          browser,
          baseUrl,
          expectedProviders,
          forbiddenProviders,
          clickProviders,
          timeoutMs,
        })
      );
    }
  } finally {
    await browser.close();
  }

  const ok = routeResults.every((result) => result.ok);
  const summary = {
    ok,
    urls: publicAuthUrls.map((url) => url.toString()),
    expectedProviders,
    forbiddenProviders,
    routeResults,
    ...(routeResults.length === 1 ? routeResults[0] : {}),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!ok) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_PUBLIC_AUTH_URL,
  DEFAULT_EXPECTED_PROVIDERS,
  DEFAULT_FORBIDDEN_PROVIDERS,
  DEFAULT_REDIRECT_HOSTS,
  buildOAuthErrorCallbackUrl,
  clickProvider,
  detectProviderRedirectError,
  hasOAuthCallbackParams,
  hostnameMatches,
  isAppDiagnosticUrl,
  isRetryableAppLoadFailure,
  isRetryablePublicAuthResult,
  parseCsv,
  parsePublicAuthUrls,
  resolvePublicAuthUrls,
  validateOAuthErrorCallbackState,
  verifyOAuthErrorCallback,
  launchBrowser,
  providerRedirectHosts,
};
