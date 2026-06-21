#!/usr/bin/env node

const DEFAULT_PUBLIC_AUTH_URL = "https://yehor212.github.io/people-first-app/";
const DEFAULT_EXPECTED_PROVIDERS = ["google", "telegram"];
const DEFAULT_FORBIDDEN_PROVIDERS = ["facebook", "apple"];
const DEFAULT_REDIRECT_HOSTS = {
  google: ["accounts.google.com", "google.com", "bwgfslmxmueyglpumkbf.supabase.co"],
  telegram: ["oauth.telegram.org", "bwgfslmxmueyglpumkbf.supabase.co"],
  apple: ["appleid.apple.com", "bwgfslmxmueyglpumkbf.supabase.co"],
  facebook: ["facebook.com", "www.facebook.com", "bwgfslmxmueyglpumkbf.supabase.co"],
};

function parseCsv(value, fallback) {
  if (value === undefined || value === null || value.trim() === "") return [...fallback];
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

function initEntryState() {
  const json = (value) => JSON.stringify(value);
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem("zenflow-language", json("en"));
  localStorage.setItem("zenflow-language-selected", json(true));
  localStorage.setItem("zenflow-google-auth-checked", json(false));
  localStorage.setItem("zenflow-tutorial-complete", json(false));
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
    await page.getByTestId("auth-provider-content-" + provider).click({ timeout: timeoutMs });
    await page.waitForURL((currentUrl) => currentUrl.host !== appHost, { timeout: timeoutMs });
    await page.waitForTimeout(1000);

    const finalUrl = new URL(page.url());
    const allowedHosts = providerRedirectHosts(provider);
    const ok = allowedHosts.some((host) => hostnameMatches(finalUrl.hostname, host));

    return {
      provider,
      ok,
      reason: ok ? null : "unexpected_redirect_host",
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

async function verifyPublicAuthUrl({
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

  const publicProviders = await collectProviders(
    listPage,
    createScenarioUrl(baseUrl, "list"),
    timeoutMs
  );
  await listContext.close();

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

  const ok =
    expectedMatches &&
    forbiddenVisible.length === 0 &&
    missingExpected.length === 0 &&
    listConsoleMessages.length === 0 &&
    listFailedRequests.length === 0 &&
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
    redirectResults,
  };
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
    DEFAULT_FORBIDDEN_PROVIDERS
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
  hostnameMatches,
  isAppDiagnosticUrl,
  parseCsv,
  parsePublicAuthUrls,
  resolvePublicAuthUrls,
  launchBrowser,
  providerRedirectHosts,
};
