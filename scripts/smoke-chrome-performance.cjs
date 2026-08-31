const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const packageJson = require("../package.json");
const perfBudgetManifest = require("../config/chrome-performance-budgets.json");
const {
  evidenceFailureCode,
  sanitizeEvidenceFailureClass,
  sanitizeEvidenceMethod,
  sanitizeEvidenceResourceType,
  sanitizeEvidenceRoute,
  sanitizeEvidenceUrl,
} = require("./lib/diagnostic-evidence-privacy.cjs");
const appVersionSource = fs.readFileSync(
  path.join(__dirname, "..", "src", "lib", "appVersion.ts"),
  "utf8",
);
const DATA_SCHEMA_VERSION = Number(
  appVersionSource.match(/export const DATA_SCHEMA_VERSION = (\d+)/)?.[1] || 1,
);

const BASE_URL = process.env.ZENFLOW_PERF_URL || "https://yehor212.github.io/people-first-app/";
const MAX_LONG_TASK_MS = readNumber(
  "ZENFLOW_PERF_MAX_LONG_TASK_MS",
  perfBudgetManifest.defaultBudgets?.maxLongTaskMs || 500,
);
const LONG_ANIMATION_FRAME_WARN_MS = readNumber(
  "ZENFLOW_PERF_LOAF_WARN_MS",
  perfBudgetManifest.defaultBudgets?.longAnimationFrameWarnMs || 250,
);
const LONG_ANIMATION_FRAME_BLOCKING_WARN_MS = readNumber(
  "ZENFLOW_PERF_LOAF_BLOCKING_WARN_MS",
  perfBudgetManifest.defaultBudgets?.longAnimationFrameBlockingWarnMs || 120,
);
const SETTLE_MS = readNumber("ZENFLOW_PERF_SETTLE_MS", perfBudgetManifest.settleMs || 4500);
const FAIL_ON_CONSOLE_ERROR = process.env.ZENFLOW_PERF_FAIL_ON_CONSOLE_ERROR === "true";
const FAIL_ON_REQUEST_FAILURE = process.env.ZENFLOW_PERF_FAIL_ON_REQUEST_FAILURE === "true";
const OUTPUT_PATH = process.env.ZENFLOW_PERF_OUTPUT || "";
const REUSE_BROWSER = process.env.ZENFLOW_PERF_REUSE_BROWSER === "true";

const routeGroups = perfBudgetManifest.routeGroups || [];

if (routeGroups.length === 0) {
  console.error("[chrome-performance] No route groups configured");
  process.exit(2);
}

function readNumber(name, fallback) {
  const rawValue = process.env[name];
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(`[chrome-performance] Ignoring invalid ${name}`);
    return fallback;
  }

  return parsed;
}

function resolveUrl(path) {
  return new URL(path, BASE_URL).toString();
}

function compactUrl(url) {
  return sanitizeEvidenceUrl(url);
}

async function seedApp(page) {
  await page.addInitScript(({ appVersion, dataSchemaVersion }) => {
    const now = new Date().toISOString();
    localStorage.setItem("zenflow-language-selected", JSON.stringify(true));
    localStorage.setItem("zenflow-google-auth-checked", JSON.stringify(true));
    localStorage.setItem("zenflow-onboarding-complete", JSON.stringify(true));
    localStorage.setItem("zenflow-notification-permission-checked", JSON.stringify(true));
    localStorage.setItem("zenflow_last_seen_version", appVersion);
    localStorage.setItem(
      "zenflow-app-metadata",
      JSON.stringify({
        appVersion,
        dataSchemaVersion,
        installDate: now,
        lastUpdateDate: now,
        updateCount: 0,
      }),
    );
    localStorage.setItem("zenflow-theme", "dark");
    localStorage.setItem("zenflow-orb-first-run-dismissed", "1");
    localStorage.setItem(
      "zenflow-privacy",
      JSON.stringify({ noTracking: false, analytics: false, consentShown: true }),
    );
    localStorage.setItem("zenflow-privacy-acknowledged", JSON.stringify(true));
    localStorage.setItem(
      "zenflow_onboarding_state",
      JSON.stringify({
        isNewUser: false,
        hasSeenWelcome: true,
        firstLoginDate: Date.now(),
        daysActive: 5,
        lastActiveDate: new Date().toISOString().split("T")[0],
        unlockedFeatures: [],
      }),
    );

    window.__zenflowPerf = { longTasks: [], longAnimationFrames: [], phaseStartedAt: 0 };
    try {
      new PerformanceObserver((list) => {
        const phaseStartedAt = window.__zenflowPerf.phaseStartedAt || 0;
        window.__zenflowPerf.longTasks.push(
          ...list
            .getEntries()
            .filter((entry) => entry.startTime >= phaseStartedAt)
            .map((entry) => ({
              name: "longtask",
              startTime: entry.startTime,
              duration: entry.duration,
            })),
        );
      }).observe({ type: "longtask", buffered: true });
    } catch {
      window.__zenflowPerf.longTaskObserverUnavailable = true;
    }

    try {
      new PerformanceObserver((list) => {
        const phaseStartedAt = window.__zenflowPerf.phaseStartedAt || 0;
        window.__zenflowPerf.longAnimationFrames.push(
          ...list
            .getEntries()
            .filter((entry) => entry.startTime >= phaseStartedAt)
            .map((entry) => ({
              startTime: entry.startTime,
              duration: entry.duration,
              blockingDuration: entry.blockingDuration,
              renderStart: entry.renderStart,
              styleAndLayoutStart: entry.styleAndLayoutStart,
              firstUIEventTimestamp: entry.firstUIEventTimestamp,
              scripts: (entry.scripts || []).slice(0, 8).map((script) => ({
                duration: script.duration,
                executionStart: script.executionStart,
                forcedStyleAndLayoutDuration: script.forcedStyleAndLayoutDuration,
                invoker: "observed",
                invokerType: "observed",
                pauseDuration: script.pauseDuration,
                sourceFunctionName: "redacted",
                sourceURL: "redacted",
                windowAttribution: "observed",
              })),
            })),
        );
      }).observe({ type: "long-animation-frame", buffered: true });
    } catch {
      window.__zenflowPerf.longAnimationFrameObserverUnavailable = true;
    }
  }, { appVersion: packageJson.version, dataSchemaVersion: DATA_SCHEMA_VERSION });
}

function summarizePerfSnapshot() {
  const perf = window.__zenflowPerf || { longTasks: [], longAnimationFrames: [] };
  const longTasks = perf.longTasks || [];
  const longAnimationFrames = perf.longAnimationFrames || [];
  const frameVisibleLongTasks = longTasks.filter((task) =>
    longAnimationFrames.some((frame) => {
      const taskStart = task.startTime || 0;
      const taskEnd = taskStart + (task.duration || 0);
      const frameStart = frame.startTime || 0;
      const frameEnd = frameStart + (frame.duration || 0);
      return taskStart < frameEnd && taskEnd > frameStart;
    }),
  );
  const topLongAnimationFrames = longAnimationFrames
    .slice()
    .sort((a, b) => (b.duration || 0) - (a.duration || 0))
    .slice(0, 3);
  const hasBlockingAttribution = (entry) => {
    if ((entry.blockingDuration || 0) > 0) return true;

    return (entry.scripts || []).some(
      (script) =>
        (script.duration || 0) >= 50 ||
        (script.forcedStyleAndLayoutDuration || 0) >= 50 ||
        (script.pauseDuration || 0) >= 50,
    );
  };
  const blockingLongAnimationFrames = longAnimationFrames.filter(hasBlockingAttribution);
  const topBlockingLongAnimationFrames = blockingLongAnimationFrames
    .slice()
    .sort(
      (a, b) =>
        (b.blockingDuration || 0) - (a.blockingDuration || 0) ||
        (b.duration || 0) - (a.duration || 0),
    )
    .slice(0, 3);
  const nonBlockingLongAnimationFrames = longAnimationFrames.filter(
    (entry) => !hasBlockingAttribution(entry),
  );
  const topNonBlockingLongAnimationFrames = nonBlockingLongAnimationFrames
    .slice()
    .sort((a, b) => (b.duration || 0) - (a.duration || 0))
    .slice(0, 3);

  return {
    rawLongTaskCount: longTasks.length,
    rawMaxLongTaskMs: Math.max(0, ...longTasks.map((entry) => entry.duration || 0)),
    longTaskCount: frameVisibleLongTasks.length,
    maxLongTaskMs: Math.max(0, ...frameVisibleLongTasks.map((entry) => entry.duration || 0)),
    longAnimationFrameCount: longAnimationFrames.length,
    maxLongAnimationFrameMs: Math.max(
      0,
      ...longAnimationFrames.map((entry) => entry.duration || 0),
    ),
    maxLongAnimationFrameBlockingMs: Math.max(
      0,
      ...longAnimationFrames.map((entry) => entry.blockingDuration || 0),
    ),
    topLongAnimationFrames,
    blockingLongAnimationFrameCount: blockingLongAnimationFrames.length,
    maxBlockingLongAnimationFrameMs: Math.max(
      0,
      ...blockingLongAnimationFrames.map((entry) => entry.duration || 0),
    ),
    topBlockingLongAnimationFrames,
    nonBlockingLongAnimationFrameCount: nonBlockingLongAnimationFrames.length,
    maxNonBlockingLongAnimationFrameMs: Math.max(
      0,
      ...nonBlockingLongAnimationFrames.map((entry) => entry.duration || 0),
    ),
    topNonBlockingLongAnimationFrames,
    longTaskObserverUnavailable: Boolean(perf.longTaskObserverUnavailable),
    longAnimationFrameObserverUnavailable: Boolean(perf.longAnimationFrameObserverUnavailable),
  };
}

function resetPerfSnapshot() {
  const perf = window.__zenflowPerf;
  if (!perf) return;
  perf.longTasks = [];
  perf.longAnimationFrames = [];
  perf.phaseStartedAt = performance.now();
}

async function evaluateAfterStableContext(page, callback, routeName, phase) {
  try {
    return await page.evaluate(callback);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("Execution context was destroyed")) {
      throw error;
    }

    console.warn(
      `[chrome-performance] ${routeName} ${phase} context changed during load; retrying once`,
    );
    await page.waitForLoadState("load", { timeout: 5000 }).catch(() => undefined);
    return page.evaluate(callback);
  }
}

async function waitForRouteNetworkIdle(page) {
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);
}

async function waitForAppReady(page, routeName) {
  try {
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="splash-theme-shell"]'),
      { timeout: 8000 },
    );
    return true;
  } catch {
    console.warn(
      `[chrome-performance] ${routeName} splash/loading shell still visible; steady phase may include boot handoff`,
    );
    return false;
  }
}

async function waitForRouteReady(page, route) {
  if (!route.readySelector) {
    return false;
  }

  await page.waitForSelector(route.readySelector, { timeout: route.readyTimeoutMs || 8000 });
  await page
    .evaluate(
      () =>
        new Promise((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        }),
    )
    .catch(() => undefined);
  return true;
}

function isReportableResponse(response) {
  const request = response.request();
  if (request.resourceType() === "xhr" || request.resourceType() === "fetch") {
    return response.status() >= 500;
  }

  return response.status() >= 400;
}

async function measure(context, routeGroup, route) {
  const page = await context.newPage();
  await seedApp(page);

  const consoleErrors = [];
  const failedRequests = [];
  const failedResponses = [];
  let pageClosing = false;

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push("ZF_BROWSER_CONSOLE_ERROR");
    }
  });

  page.on("requestfailed", (request) => {
    if (pageClosing) return;

    failedRequests.push({
      method: sanitizeEvidenceMethod(request.method()),
      resourceType: sanitizeEvidenceResourceType(request.resourceType()),
      url: compactUrl(request.url()),
      errorClass: sanitizeEvidenceFailureClass(request.failure()?.errorText),
    });
  });

  page.on("response", (response) => {
    if (pageClosing) return;
    if (isReportableResponse(response)) {
      failedResponses.push({
        status: response.status(),
        resourceType: sanitizeEvidenceResourceType(response.request().resourceType()),
        url: compactUrl(response.url()),
      });
    }
  });

  const url = resolveUrl(route.path);
  const budgets = {
    maxLongTaskMs: route.maxLongTaskMs || routeGroup.maxLongTaskMs || MAX_LONG_TASK_MS,
    longAnimationFrameWarnMs:
      route.longAnimationFrameWarnMs ||
      routeGroup.longAnimationFrameWarnMs ||
      LONG_ANIMATION_FRAME_WARN_MS,
    longAnimationFrameBlockingWarnMs:
      route.longAnimationFrameBlockingWarnMs ||
      routeGroup.longAnimationFrameBlockingWarnMs ||
      LONG_ANIMATION_FRAME_BLOCKING_WARN_MS,
  };
  await page.goto(url, { waitUntil: "load", timeout: 45000 });
  await page.evaluate(() => document.fonts?.ready).catch(() => undefined);
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }),
  ).catch(async () => {
    await page.waitForLoadState("load", { timeout: 5000 }).catch(() => undefined);
  });
  await waitForRouteNetworkIdle(page);
  const appReadyBeforeSteady = await waitForAppReady(page, route.name);
  const routeReadyBeforeSteady = await waitForRouteReady(page, route).catch((error) => {
    console.warn(`[chrome-performance] ${route.name} route ready selector timed out: ${evidenceFailureCode(error)}`);
    return false;
  });

  const bootMetrics = await evaluateAfterStableContext(
    page,
    summarizePerfSnapshot,
    route.name,
    "boot",
  );
  await evaluateAfterStableContext(page, resetPerfSnapshot, route.name, "reset");
  await page.waitForTimeout(SETTLE_MS);

  const steadyPerfMetrics = await evaluateAfterStableContext(
    page,
    summarizePerfSnapshot,
    route.name,
    "steady",
  );
  const pageInfo = await evaluateAfterStableContext(
    page,
    () => ({
      nodeCount: document.querySelectorAll("*").length,
    }),
    route.name,
    "page-info",
  );
  const metrics = {
    ...steadyPerfMetrics,
    ...pageInfo,
  };

  pageClosing = true;
  await page.close();

  return {
    profile: routeGroup.profile,
    viewport: routeGroup.viewport,
    route: route.name,
    routeReadyBeforeSteady,
    appReadyBeforeSteady,
    budgets,
    path: sanitizeEvidenceRoute(url),
    url: sanitizeEvidenceUrl(url),
    bootRawLongTaskCount: bootMetrics.rawLongTaskCount,
    bootRawMaxLongTaskMs: bootMetrics.rawMaxLongTaskMs,
    bootLongTaskCount: bootMetrics.longTaskCount,
    bootMaxLongTaskMs: bootMetrics.maxLongTaskMs,
    bootLongAnimationFrameCount: bootMetrics.longAnimationFrameCount,
    bootMaxLongAnimationFrameMs: bootMetrics.maxLongAnimationFrameMs,
    bootMaxLongAnimationFrameBlockingMs: bootMetrics.maxLongAnimationFrameBlockingMs,
    topBootLongAnimationFrames: bootMetrics.topLongAnimationFrames,
    topBootBlockingLongAnimationFrames: bootMetrics.topBlockingLongAnimationFrames,
    ...metrics,
    consoleErrorCount: consoleErrors.length,
    consoleErrors: consoleErrors.slice(0, 10),
    requestFailedCount: failedRequests.length,
    failedRequests: failedRequests.slice(0, 10),
    failedResponseCount: failedResponses.length,
    failedResponses: failedResponses.slice(0, 10),
  };
}

async function launchMeasurementBrowser() {
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch (error) {
    console.warn(
      `[chrome-performance] Installed Chrome is unavailable, falling back to Playwright Chromium: ${evidenceFailureCode(error)}`,
    );
    try {
      return await chromium.launch({ headless: true });
    } catch (fallbackError) {
      console.error(
        `[chrome-performance] Playwright Chromium is unavailable: ${evidenceFailureCode(fallbackError)}`,
      );
      process.exit(2);
    }
  }
}

async function measureWithBrowser(browser, routeGroup, route) {
  const context = await browser.newContext({
    serviceWorkers: "block",
    ...routeGroup.contextOptions,
  });
  try {
    return await measure(context, routeGroup, route);
  } finally {
    await context.close();
  }
}

function collectWarnings(results) {
  const warnings = [];

  for (const result of results) {
    const loafWarnMs = result.budgets?.longAnimationFrameWarnMs || LONG_ANIMATION_FRAME_WARN_MS;
    const loafBlockingWarnMs =
      result.budgets?.longAnimationFrameBlockingWarnMs || LONG_ANIMATION_FRAME_BLOCKING_WARN_MS;
    if (result.maxLongAnimationFrameBlockingMs > loafBlockingWarnMs) {
      warnings.push(
        `${result.route} blocking long-animation-frame ${Math.round(
          result.maxLongAnimationFrameBlockingMs,
        )}ms > ${loafBlockingWarnMs}ms`,
      );
    } else if (
      result.blockingLongAnimationFrameCount > 0 &&
      result.maxBlockingLongAnimationFrameMs > loafWarnMs
    ) {
      warnings.push(
        `${result.route} attributed long-animation-frame ${Math.round(
          result.maxBlockingLongAnimationFrameMs,
        )}ms > ${loafWarnMs}ms`,
      );
    }

    if (result.consoleErrorCount > 0) {
      warnings.push(`${result.route} console errors: ${result.consoleErrorCount}`);
    }

    if (result.requestFailedCount > 0) {
      warnings.push(`${result.route} failed requests: ${result.requestFailedCount}`);
    }

    if (result.failedResponseCount > 0) {
      warnings.push(`${result.route} HTTP 4xx/5xx responses: ${result.failedResponseCount}`);
    }
  }

  return warnings;
}

function collectDiagnostics(results) {
  const diagnostics = [];

  for (const result of results) {
    const loafWarnMs = result.budgets?.longAnimationFrameWarnMs || LONG_ANIMATION_FRAME_WARN_MS;
    if (
      result.maxNonBlockingLongAnimationFrameMs > loafWarnMs &&
      result.maxLongAnimationFrameBlockingMs === 0
    ) {
      diagnostics.push(
        `${result.route} non-blocking long-animation-frame ${Math.round(
          result.maxNonBlockingLongAnimationFrameMs,
        )}ms > ${loafWarnMs}ms (blocking=0ms; tracked separately from input jank)`,
      );
    }
  }

  return diagnostics;
}

function collectFailures(results) {
  const steadyFailures = results
    .filter(
      (result) => result.maxLongTaskMs > (result.budgets?.maxLongTaskMs || MAX_LONG_TASK_MS),
    )
    .map(
      (result) =>
        `${result.route}=${Math.round(result.maxLongTaskMs)}ms>${result.budgets?.maxLongTaskMs || MAX_LONG_TASK_MS}ms`,
    );
  const bootFailures = results
    .filter(
      (result) => result.bootMaxLongTaskMs > (result.budgets?.maxLongTaskMs || MAX_LONG_TASK_MS),
    )
    .map(
      (result) =>
        `${result.route}:boot=${Math.round(result.bootMaxLongTaskMs)}ms>${result.budgets?.maxLongTaskMs || MAX_LONG_TASK_MS}ms`,
    );
  const failures = [...steadyFailures, ...bootFailures];

  if (FAIL_ON_CONSOLE_ERROR) {
    failures.push(
      ...results
        .filter((result) => result.consoleErrorCount > 0)
        .map((result) => `${result.route} consoleErrors=${result.consoleErrorCount}`),
    );
  }

  if (FAIL_ON_REQUEST_FAILURE) {
    failures.push(
      ...results
        .filter((result) => result.requestFailedCount > 0 || result.failedResponseCount > 0)
        .map(
          (result) =>
            `${result.route} requestFailures=${result.requestFailedCount} httpErrors=${result.failedResponseCount}`,
        ),
    );
  }

  return failures;
}

(async () => {
  const results = [];

  if (REUSE_BROWSER) {
    const browser = await launchMeasurementBrowser();
    try {
      for (const routeGroup of routeGroups) {
        for (const route of routeGroup.routes) {
          results.push(await measureWithBrowser(browser, routeGroup, route));
        }
      }
    } finally {
      await browser.close();
    }
  } else {
    for (const routeGroup of routeGroups) {
      for (const route of routeGroup.routes) {
        const browser = await launchMeasurementBrowser();
        try {
          results.push(await measureWithBrowser(browser, routeGroup, route));
        } finally {
          await browser.close();
        }
      }
    }
  }

  const warnings = collectWarnings(results);
  const diagnostics = collectDiagnostics(results);
  const failures = collectFailures(results);

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: sanitizeEvidenceUrl(BASE_URL),
    budgetManifest: "config/chrome-performance-budgets.json",
    maxAllowedLongTaskMs: MAX_LONG_TASK_MS,
    longAnimationFrameWarnMs: LONG_ANIMATION_FRAME_WARN_MS,
    longAnimationFrameBlockingWarnMs: LONG_ANIMATION_FRAME_BLOCKING_WARN_MS,
    settleMs: SETTLE_MS,
    browserIsolation: REUSE_BROWSER ? "shared-browser" : "fresh-browser-per-route",
    failOnConsoleError: FAIL_ON_CONSOLE_ERROR,
    failOnRequestFailure: FAIL_ON_REQUEST_FAILURE,
    results,
    warnings,
    diagnostics,
  };

  const output = JSON.stringify(report, null, 2);
  console.log(output);

  if (OUTPUT_PATH) {
    const resolvedOutputPath = path.resolve(process.cwd(), OUTPUT_PATH);
    fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
    fs.writeFileSync(resolvedOutputPath, `${output}\n`);
  }

  if (failures.length > 0) {
    console.error(`[chrome-performance] Budget exceeded: ${failures.join(", ")}`);
    process.exit(1);
  }
})().catch((error) => {
  console.error(`[chrome-performance] ${evidenceFailureCode(error)}`);
  process.exit(1);
});
