const { chromium } = require("@playwright/test");
const packageJson = require("../package.json");

const BASE_URL = process.env.ZENFLOW_PERF_URL || "http://localhost:8080/people-first-app/";
const MAX_LONG_TASK_MS = readNumber("ZENFLOW_PERF_MAX_LONG_TASK_MS", 500);
const LONG_ANIMATION_FRAME_WARN_MS = readNumber("ZENFLOW_PERF_LOAF_WARN_MS", 250);
const SETTLE_MS = readNumber("ZENFLOW_PERF_SETTLE_MS", 4500);
const FAIL_ON_CONSOLE_ERROR = process.env.ZENFLOW_PERF_FAIL_ON_CONSOLE_ERROR === "true";
const FAIL_ON_REQUEST_FAILURE = process.env.ZENFLOW_PERF_FAIL_ON_REQUEST_FAILURE === "true";

const routeGroups = [
  {
    profile: "phone",
    viewport: { width: 449, height: 698 },
    contextOptions: {
      viewport: { width: 449, height: 698 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    },
    routes: [
      { name: "home-v1-phone", path: "?navLayout=phone" },
      { name: "orb-v2-phone", path: "orb/?nav=v2&navLayout=phone&dev=true" },
      { name: "habits-v2-phone", path: "habits/?nav=v2&navLayout=phone&dev=true" },
      { name: "diary-v2-phone", path: "diary/?nav=v2&navLayout=phone&dev=true" },
      { name: "settings-v2-phone", path: "settings/?nav=v2&navLayout=phone&dev=true" },
    ],
  },
  {
    profile: "desktop",
    viewport: { width: 1440, height: 900 },
    contextOptions: {
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
    },
    routes: [
      { name: "home-v1-desktop", path: "" },
      { name: "orb-v2-desktop", path: "orb/?nav=v2&dev=true" },
      { name: "habits-v2-desktop", path: "habits/?nav=v2&dev=true" },
      { name: "diary-v2-desktop", path: "diary/?nav=v2&dev=true" },
      { name: "settings-v2-desktop", path: "settings/?nav=v2&dev=true" },
    ],
  },
];

function readNumber(name, fallback) {
  const rawValue = process.env[name];
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(`[chrome-performance] Ignoring invalid ${name}=${rawValue}`);
    return fallback;
  }

  return parsed;
}

function resolveUrl(path) {
  return new URL(path, BASE_URL).toString();
}

function compactUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

async function seedApp(page) {
  await page.addInitScript((appVersion) => {
    localStorage.setItem("zenflow-language-selected", JSON.stringify(true));
    localStorage.setItem("zenflow-google-auth-checked", JSON.stringify(true));
    localStorage.setItem("zenflow-tutorial-complete", JSON.stringify(true));
    localStorage.setItem("zenflow-onboarding-complete", JSON.stringify(true));
    localStorage.setItem("zenflow-notification-permission-checked", JSON.stringify(true));
    localStorage.setItem("zenflow_last_seen_version", appVersion);
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
              name: entry.name,
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
                invoker: script.invoker,
                invokerType: script.invokerType,
                pauseDuration: script.pauseDuration,
                sourceFunctionName: script.sourceFunctionName,
                sourceURL: script.sourceURL,
                windowAttribution: script.windowAttribution,
              })),
            })),
        );
      }).observe({ type: "long-animation-frame", buffered: true });
    } catch {
      window.__zenflowPerf.longAnimationFrameObserverUnavailable = true;
    }
  }, packageJson.version);
}

function summarizePerfSnapshot() {
  const perf = window.__zenflowPerf || { longTasks: [], longAnimationFrames: [] };
  const longTasks = perf.longTasks || [];
  const longAnimationFrames = perf.longAnimationFrames || [];
  const topLongAnimationFrames = longAnimationFrames
    .slice()
    .sort((a, b) => (b.duration || 0) - (a.duration || 0))
    .slice(0, 3);

  return {
    longTaskCount: longTasks.length,
    maxLongTaskMs: Math.max(0, ...longTasks.map((entry) => entry.duration || 0)),
    longAnimationFrameCount: longAnimationFrames.length,
    maxLongAnimationFrameMs: Math.max(
      0,
      ...longAnimationFrames.map((entry) => entry.duration || 0),
    ),
    topLongAnimationFrames,
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

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  page.on("requestfailed", (request) => {
    failedRequests.push({
      method: request.method(),
      resourceType: request.resourceType(),
      url: compactUrl(request.url()),
      errorText: request.failure()?.errorText || "unknown",
    });
  });

  page.on("response", (response) => {
    if (isReportableResponse(response)) {
      failedResponses.push({
        status: response.status(),
        resourceType: response.request().resourceType(),
        url: compactUrl(response.url()),
      });
    }
  });

  const url = resolveUrl(route.path);
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

  const bootMetrics = await page.evaluate(summarizePerfSnapshot);
  await page.evaluate(resetPerfSnapshot);
  await page.waitForTimeout(SETTLE_MS);

  const steadyPerfMetrics = await page.evaluate(summarizePerfSnapshot);
  const pageInfo = await page.evaluate(() => {
    return {
      nodeCount: document.querySelectorAll("*").length,
      title: document.title,
    };
  });
  const metrics = {
    ...steadyPerfMetrics,
    ...pageInfo,
  };

  await page.close();

  return {
    profile: routeGroup.profile,
    viewport: routeGroup.viewport,
    route: route.name,
    path: route.path || "/",
    url,
    bootLongTaskCount: bootMetrics.longTaskCount,
    bootMaxLongTaskMs: bootMetrics.maxLongTaskMs,
    bootLongAnimationFrameCount: bootMetrics.longAnimationFrameCount,
    bootMaxLongAnimationFrameMs: bootMetrics.maxLongAnimationFrameMs,
    topBootLongAnimationFrames: bootMetrics.topLongAnimationFrames,
    ...metrics,
    consoleErrorCount: consoleErrors.length,
    consoleErrors: consoleErrors.slice(0, 10),
    requestFailedCount: failedRequests.length,
    failedRequests: failedRequests.slice(0, 10),
    failedResponseCount: failedResponses.length,
    failedResponses: failedResponses.slice(0, 10),
  };
}

function collectWarnings(results) {
  const warnings = [];

  for (const result of results) {
    if (result.maxLongAnimationFrameMs > LONG_ANIMATION_FRAME_WARN_MS) {
      warnings.push(
        `${result.route} long-animation-frame ${Math.round(
          result.maxLongAnimationFrameMs,
        )}ms > ${LONG_ANIMATION_FRAME_WARN_MS}ms`,
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

function collectFailures(results) {
  const steadyFailures = results
    .filter((result) => result.maxLongTaskMs > MAX_LONG_TASK_MS)
    .map((result) => `${result.route}=${Math.round(result.maxLongTaskMs)}ms`);
  const bootFailures = results
    .filter((result) => result.bootMaxLongTaskMs > MAX_LONG_TASK_MS)
    .map((result) => `${result.route}:boot=${Math.round(result.bootMaxLongTaskMs)}ms`);
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
  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
  } catch (error) {
    console.error(
      `[chrome-performance] Installed Chrome is unavailable: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    process.exit(2);
  }

  const results = [];

  try {
    for (const routeGroup of routeGroups) {
      const context = await browser.newContext(routeGroup.contextOptions);
      for (const route of routeGroup.routes) {
        results.push(await measure(context, routeGroup, route));
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }

  const warnings = collectWarnings(results);
  const failures = collectFailures(results);

  console.log(
    JSON.stringify(
      {
        baseUrl: BASE_URL,
        maxAllowedLongTaskMs: MAX_LONG_TASK_MS,
        longAnimationFrameWarnMs: LONG_ANIMATION_FRAME_WARN_MS,
        settleMs: SETTLE_MS,
        failOnConsoleError: FAIL_ON_CONSOLE_ERROR,
        failOnRequestFailure: FAIL_ON_REQUEST_FAILURE,
        results,
        warnings,
      },
      null,
      2,
    ),
  );

  if (failures.length > 0) {
    console.error(`[chrome-performance] Budget exceeded: ${failures.join(", ")}`);
    process.exit(1);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
