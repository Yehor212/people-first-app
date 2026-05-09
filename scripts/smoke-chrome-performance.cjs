const { chromium } = require("@playwright/test");
const packageJson = require("../package.json");

const BASE_URL = process.env.ZENFLOW_PERF_URL || "http://localhost:8080/people-first-app/";
const MAX_LONG_TASK_MS = Number(process.env.ZENFLOW_PERF_MAX_LONG_TASK_MS || 500);
const routes = [
  { name: "home-phone", path: "?navLayout=phone" },
  { name: "orb-v2-phone", path: "orb/?nav=v2&navLayout=phone&dev=true" },
];

function resolveUrl(path) {
  return new URL(path, BASE_URL).toString();
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

    window.__zenflowPerf = { longTasks: [], longAnimationFrames: [] };
    try {
      new PerformanceObserver((list) => {
        window.__zenflowPerf.longTasks.push(
          ...list.getEntries().map((entry) => ({
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
        window.__zenflowPerf.longAnimationFrames.push(
          ...list.getEntries().map((entry) => ({
            startTime: entry.startTime,
            duration: entry.duration,
            blockingDuration: entry.blockingDuration,
          })),
        );
      }).observe({ type: "long-animation-frame", buffered: true });
    } catch {
      window.__zenflowPerf.longAnimationFrameObserverUnavailable = true;
    }
  }, packageJson.version);
}

async function measure(page, route) {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto(resolveUrl(route.path), { waitUntil: "load", timeout: 45000 });
  await page.evaluate(() => document.fonts?.ready).catch(() => undefined);
  await page.waitForTimeout(4500);

  const metrics = await page.evaluate(() => {
    const perf = window.__zenflowPerf || { longTasks: [], longAnimationFrames: [] };
    const longTasks = perf.longTasks || [];
    const longAnimationFrames = perf.longAnimationFrames || [];
    return {
      longTaskCount: longTasks.length,
      maxLongTaskMs: Math.max(0, ...longTasks.map((entry) => entry.duration || 0)),
      longAnimationFrameCount: longAnimationFrames.length,
      maxLongAnimationFrameMs: Math.max(
        0,
        ...longAnimationFrames.map((entry) => entry.duration || 0),
      ),
      nodeCount: document.querySelectorAll("*").length,
      title: document.title,
    };
  });

  return { route: route.name, ...metrics, consoleErrors };
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

  const context = await browser.newContext({
    viewport: { width: 449, height: 698 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await seedApp(page);

  const results = [];
  for (const route of routes) {
    results.push(await measure(page, route));
  }

  await browser.close();

  console.log(JSON.stringify({ maxAllowedLongTaskMs: MAX_LONG_TASK_MS, results }, null, 2));

  const failures = results.filter((result) => result.maxLongTaskMs > MAX_LONG_TASK_MS);
  if (failures.length > 0) {
    console.error(
      `[chrome-performance] Long task budget exceeded: ${failures
        .map((result) => `${result.route}=${Math.round(result.maxLongTaskMs)}ms`)
        .join(", ")}`,
    );
    process.exit(1);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
