#!/usr/bin/env node

const DEFAULT_INTERACTIVE_AUTH_URL = "https://yehor212.github.io/people-first-app/";
const SUPPORTED_PROVIDERS = new Set(["google", "facebook", "telegram", "apple"]);
const OAUTH_REPORT_PARAM_NAMES = [
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

function getArgValue(argv, name) {
  const prefix = "--" + name + "=";
  const direct = argv.find((arg) => arg.startsWith(prefix));
  if (direct) return direct.slice(prefix.length);

  const index = argv.indexOf("--" + name);
  if (index !== -1 && argv[index + 1] && !argv[index + 1].startsWith("--")) {
    return argv[index + 1];
  }

  return "";
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value).toLowerCase() === "true";
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function parseInteractiveAuthConfig({ argv = process.argv.slice(2), env = process.env } = {}) {
  const provider = (getArgValue(argv, "provider") || env.ZENFLOW_INTERACTIVE_AUTH_PROVIDER || "")
    .trim()
    .toLowerCase();

  if (!SUPPORTED_PROVIDERS.has(provider)) {
    throw new Error(
      "Set --provider to one of google, facebook, telegram, apple. Example: npm run smoke:interactive-auth -- --provider=telegram"
    );
  }

  const appUrl =
    getArgValue(argv, "url") ||
    env.ZENFLOW_INTERACTIVE_AUTH_URL ||
    env.ZENFLOW_PUBLIC_AUTH_URL ||
    DEFAULT_INTERACTIVE_AUTH_URL;
  const timeoutMs = parsePositiveInteger(
    getArgValue(argv, "timeout-ms") || env.ZENFLOW_INTERACTIVE_AUTH_TIMEOUT_MS,
    300000
  );
  const headless = parseBoolean(
    getArgValue(argv, "headless") || env.ZENFLOW_INTERACTIVE_AUTH_HEADLESS,
    false
  );
  const browserChannel =
    getArgValue(argv, "browser-channel") ||
    env.ZENFLOW_INTERACTIVE_AUTH_BROWSER_CHANNEL ||
    "chrome";
  const keepStorage = parseBoolean(
    getArgValue(argv, "keep-storage") || env.ZENFLOW_INTERACTIVE_AUTH_KEEP_STORAGE,
    false
  );

  return {
    provider,
    appUrl: new URL(appUrl).toString(),
    timeoutMs,
    headless,
    browserChannel,
    keepStorage,
  };
}

function hasOAuthCallbackParams(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
  return ["code", "error", "error_description", "state", "access_token", "refresh_token"].some(
    (param) => url.searchParams.has(param) || hashParams.has(param)
  );
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isLikelyStoredToken(value) {
  return typeof value === "string" && value.length > 20;
}

function isValidSupabaseSessionShape(session) {
  return Boolean(
    isPlainObject(session) &&
    isLikelyStoredToken(session.access_token) &&
    isLikelyStoredToken(session.refresh_token) &&
    isPlainObject(session.user) &&
    typeof session.user.id === "string" &&
    session.user.id.trim().length > 0
  );
}

function hasValidSupabaseAuthSessionValue(value) {
  if (typeof value !== "string" || value.length === 0) return false;

  try {
    const parsed = JSON.parse(value);
    if (!isPlainObject(parsed)) return false;

    return [parsed, parsed.currentSession, parsed.session].some(isValidSupabaseSessionShape);
  } catch {
    return false;
  }
}

function isAuthGateCheckedState(state) {
  return Boolean(state?.authGateChecked ?? state?.googleAuthChecked);
}

function isCompletedInteractiveAuthState(state) {
  return Boolean(
    state &&
    state.currentHost === state.appHost &&
    state.hasSupabaseSession &&
    isAuthGateCheckedState(state) &&
    state.appShellVisible &&
    !state.authScreenVisible &&
    !state.hasOAuthParams
  );
}

function detectProviderOAuthError(state) {
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

function removeOAuthReportParams(params) {
  for (const name of OAUTH_REPORT_PARAM_NAMES) {
    params.delete(name);
  }

  for (const name of Array.from(params.keys())) {
    if (name.toLowerCase().includes("token")) {
      params.delete(name);
    }
  }
}

function sanitizeUrlParamValuesForReport(params, depth) {
  if (depth >= 2) return;

  for (const [name, value] of Array.from(params.entries())) {
    if (!/^https?:\/\//i.test(value)) continue;

    const safeValue = sanitizeUrlForReport(value, depth + 1);
    params.set(name, safeValue);
  }
}

function sanitizeUrlForReport(rawUrl, depth = 0) {
  if (typeof rawUrl !== "string" || rawUrl.length === 0) return rawUrl;

  try {
    const url = new URL(rawUrl);
    sanitizeUrlParamValuesForReport(url.searchParams, depth);
    removeOAuthReportParams(url.searchParams);

    if (url.hash) {
      const rawHash = url.hash.replace(/^#/, "");
      const hashParams = new URLSearchParams(rawHash);
      const hashKeys = Array.from(hashParams.keys());
      const hasSensitiveHashParam = hashKeys.some(
        (name) => OAUTH_REPORT_PARAM_NAMES.includes(name) || name.toLowerCase().includes("token")
      );

      if (rawHash.includes("=") && hasSensitiveHashParam) {
        sanitizeUrlParamValuesForReport(hashParams, depth);
        removeOAuthReportParams(hashParams);
        const safeHash = hashParams.toString();
        url.hash = safeHash ? "#" + safeHash : "";
      }
    }

    return url.toString();
  } catch {
    return "[unparseable-url]";
  }
}

function sanitizeInteractiveAuthState(state) {
  const hasAuthGateCheckedState =
    Object.prototype.hasOwnProperty.call(state, "authGateChecked") ||
    Object.prototype.hasOwnProperty.call(state, "googleAuthChecked");
  const supabaseSessionKeyCount = Array.isArray(state.supabaseSessionKeys)
    ? state.supabaseSessionKeys.length
    : Number(state.supabaseSessionKeyCount || 0);
  const result = {
    provider: state.provider,
    reason: state.reason,
    providerError: state.providerError,
    finalUrl: sanitizeUrlForReport(state.finalUrl),
    finalHost: state.finalHost,
    finalPath: state.finalPath,
    appHost: state.appHost,
    currentHost: state.currentHost,
    authScreenVisible: state.authScreenVisible,
    appShellVisible: state.appShellVisible,
    ...(hasAuthGateCheckedState ? { authGateChecked: isAuthGateCheckedState(state) } : {}),
    hasSupabaseSession: state.hasSupabaseSession,
    hasOAuthParams: state.hasOAuthParams,
    supabaseSessionKeyCount,
    completed: state.completed,
  };

  return Object.fromEntries(Object.entries(result).filter(([, value]) => value !== undefined));
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

function createScenarioUrl(appUrl, provider) {
  const url = new URL(appUrl);
  url.searchParams.set("interactiveAuthSmoke", provider + "-" + Date.now());
  return url.toString();
}

async function launchBrowser(chromium, { browserChannel, headless }) {
  const options = { headless };
  if (!browserChannel) return chromium.launch(options);

  try {
    return await chromium.launch({ ...options, channel: browserChannel });
  } catch (error) {
    console.warn(
      "[interactive-auth-smoke] Browser channel unavailable, falling back to bundled Chromium:",
      browserChannel
    );
    return chromium.launch(options);
  }
}

async function readInteractiveAuthState(page, appHost, provider) {
  const finalUrl = page.url();
  let parsed;
  try {
    parsed = new URL(finalUrl);
  } catch {
    parsed = null;
  }

  const currentHost = parsed?.host || "";
  const state = {
    provider,
    finalUrl,
    finalHost: parsed?.host,
    finalPath: parsed?.pathname,
    appHost,
    currentHost,
    authScreenVisible: false,
    appShellVisible: false,
    authGateChecked: false,
    hasSupabaseSession: false,
    hasOAuthParams: hasOAuthCallbackParams(finalUrl),
    supabaseSessionKeys: [],
  };

  if (currentHost !== appHost) {
    try {
      const externalText = await page.evaluate(
        () => document.body?.innerText?.slice(0, 2000) || ""
      );
      const providerError = detectProviderOAuthError({ ...state, externalText });
      return providerError ? { ...state, ...providerError } : state;
    } catch {
      return state;
    }
  }

  try {
    const pageState = await page.evaluate(() => {
      const authScreenVisible = Boolean(document.querySelector('[data-testid="auth-screen"]'));
      const appShellVisible = Boolean(
        document.querySelector('[data-testid="nav-v2-orchestrator"]')
      );
      const authGateChecked = localStorage.getItem("zenflow-google-auth-checked") === "true";
      const supabaseSessionKeys = Object.keys(localStorage).filter(
        (key) => key.startsWith("sb-") && key.includes("auth-token")
      );
      const isPlainObject = (value) =>
        value !== null && typeof value === "object" && !Array.isArray(value);
      const isLikelyStoredToken = (value) => typeof value === "string" && value.length > 20;
      const isValidSupabaseSessionShape = (session) =>
        Boolean(
          isPlainObject(session) &&
          isLikelyStoredToken(session.access_token) &&
          isLikelyStoredToken(session.refresh_token) &&
          isPlainObject(session.user) &&
          typeof session.user.id === "string" &&
          session.user.id.trim().length > 0
        );
      const hasValidSupabaseAuthSessionValue = (value) => {
        if (typeof value !== "string" || value.length === 0) return false;

        try {
          const parsed = JSON.parse(value);
          if (!isPlainObject(parsed)) return false;

          return [parsed, parsed.currentSession, parsed.session].some(isValidSupabaseSessionShape);
        } catch {
          return false;
        }
      };
      const hasSupabaseSession = supabaseSessionKeys.some((key) =>
        hasValidSupabaseAuthSessionValue(localStorage.getItem(key))
      );

      return {
        authScreenVisible,
        appShellVisible,
        authGateChecked,
        hasSupabaseSession,
        supabaseSessionKeys,
      };
    });

    return { ...state, ...pageState };
  } catch {
    return state;
  }
}

async function collectProviders(page, timeoutMs) {
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

async function runInteractiveAuthCompletion(config = parseInteractiveAuthConfig()) {
  const { chromium } = require("playwright");
  const browser = await launchBrowser(chromium, config);
  const appUrl = new URL(config.appUrl);
  const appHost = appUrl.host;
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });

  if (!config.keepStorage) {
    await context.addInitScript(initEntryState);
  }

  const page = await context.newPage();
  const deadline = Date.now() + config.timeoutMs;

  try {
    await page.goto(createScenarioUrl(config.appUrl, config.provider), {
      waitUntil: "domcontentloaded",
      timeout: Math.min(config.timeoutMs, 60000),
    });

    const providersBefore = await collectProviders(page, Math.min(config.timeoutMs, 60000));
    if (!providersBefore.includes(config.provider)) {
      return {
        ok: false,
        reason: "provider_not_visible",
        providersBefore,
        provider: config.provider,
      };
    }

    await clickProvider(page, config.provider, 30000);
    console.log(
      "[interactive-auth-smoke] " +
        config.provider +
        " opened. Complete login in the browser window; no credentials or tokens are read or printed."
    );

    let lastState = await readInteractiveAuthState(page, appHost, config.provider);
    while (Date.now() < deadline) {
      lastState = await readInteractiveAuthState(page, appHost, config.provider);
      if (isCompletedInteractiveAuthState(lastState)) {
        const safeState = sanitizeInteractiveAuthState({ ...lastState, completed: true });
        return { ok: true, ...safeState };
      }
      if (lastState.providerError) {
        return {
          ok: false,
          ...sanitizeInteractiveAuthState({ ...lastState, completed: false }),
        };
      }
      await page.waitForTimeout(1000);
    }

    return {
      ok: false,
      reason: "interactive_auth_timeout",
      ...sanitizeInteractiveAuthState({ ...lastState, completed: false }),
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

async function main() {
  const config = parseInteractiveAuthConfig();
  const result = await runInteractiveAuthCompletion(config);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_INTERACTIVE_AUTH_URL,
  SUPPORTED_PROVIDERS,
  clickProvider,
  detectProviderOAuthError,
  hasOAuthCallbackParams,
  hasValidSupabaseAuthSessionValue,
  isAuthGateCheckedState,
  isCompletedInteractiveAuthState,
  parseInteractiveAuthConfig,
  runInteractiveAuthCompletion,
  sanitizeInteractiveAuthState,
};
