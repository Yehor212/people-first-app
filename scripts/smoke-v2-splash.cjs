#!/usr/bin/env node

const { chromium } = require("playwright");

const THEME_STORAGE_KEY = "zenflow:theme-v0c";
const DEFAULT_URL = "https://yehor212.github.io/people-first-app/orb?nav=v2&navLayout=phone";
const targetUrl = process.env.ZENFLOW_V2_SPLASH_URL || DEFAULT_URL;

if (targetUrl.includes("dev=true") || targetUrl.includes("splashPreview")) {
  console.error(
    "V2 splash smoke must use the real app boot route, not dev=true or splashPreview.",
  );
  process.exit(1);
}

const checks = [
  {
    name: "paper",
    preference: "paper",
    colorScheme: "light",
    expectedScene: "day",
  },
  {
    name: "ink",
    preference: "ink",
    colorScheme: "dark",
    expectedScene: "night",
  },
];

function persistedTheme(preference) {
  return JSON.stringify({ state: { theme: preference }, version: 0 });
}

async function captureSplash(browser, check) {
  const context = await browser.newContext({
    bypassCSP: true,
    colorScheme: check.colorScheme,
    viewport: { width: 523, height: 909 },
    deviceScaleFactor: 1,
  });

  await context.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [THEME_STORAGE_KEY, persistedTheme(check.preference)],
  );

  const page = await context.newPage();
  const consoleErrors = [];
  const failedResponses = [];
  const ignoredDevResponses = [];

  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      consoleErrors.push(message.text());
    }
  });

  page.on("response", (response) => {
    if (response.status() < 400) return;

    const failure = {
      status: response.status(),
      url: response.url(),
    };

    if (response.url().endsWith("/registerSW.js")) {
      ignoredDevResponses.push(failure);
      return;
    }

    failedResponses.push(failure);
  });

  await page.goto(targetUrl, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });

  const shell = page.locator('[data-testid="splash-theme-shell"]');
  await shell.waitFor({ state: "attached", timeout: 8_000 });

  const evidence = await page.evaluate(() => {
    const splashShell = document.querySelector('[data-testid="splash-theme-shell"]');
    if (!splashShell) return null;

    return {
      url: window.location.href,
      theme: splashShell.getAttribute("data-splash-theme"),
      scene: splashShell.getAttribute("data-splash-scene"),
      instant: splashShell.getAttribute("data-splash-instant"),
      logoRing: document.querySelectorAll('[data-testid="splash-day-logo-ring"]').length,
      dayBubbles: document.querySelectorAll('[data-testid="splash-day-bubble"]').length,
      nightBackgrounds: document.querySelectorAll('[data-testid="splash-night-background"]').length,
      nightOrbs: document.querySelectorAll('[data-testid="splash-night-bokeh-orb"]').length,
      loaderSvg: Boolean(document.querySelector('[data-testid="splash-infinity-loader"] svg')),
      brandLogo: Boolean(document.querySelector('[data-testid="splash-brand-logo"]')),
    };
  });

  await context.close();
  return { evidence, consoleErrors, failedResponses, ignoredDevResponses };
}

function assertEvidence(check, evidence) {
  const failures = [];

  if (!evidence) {
    return [`${check.name}: splash shell was not captured`];
  }

  if (evidence.url.includes("dev=true") || evidence.url.includes("splashPreview")) {
    failures.push(`${check.name}: smoke used a preview/dev URL`);
  }

  if (evidence.theme !== check.preference) {
    failures.push(`${check.name}: expected theme ${check.preference}, got ${evidence.theme}`);
  }

  if (evidence.scene !== check.expectedScene) {
    failures.push(`${check.name}: expected scene ${check.expectedScene}, got ${evidence.scene}`);
  }

  if (!evidence.brandLogo) {
    failures.push(`${check.name}: brand logo was not rendered`);
  }

  if (!evidence.loaderSvg) {
    failures.push(`${check.name}: infinity SVG loader was not rendered`);
  }

  if (check.expectedScene === "day") {
    if (evidence.logoRing !== 1) {
      failures.push(`${check.name}: expected one day logo ring, got ${evidence.logoRing}`);
    }
    if (evidence.dayBubbles < 6) {
      failures.push(`${check.name}: expected at least six day bubbles, got ${evidence.dayBubbles}`);
    }
    if (evidence.nightBackgrounds !== 0) {
      failures.push(`${check.name}: night background leaked into day scene`);
    }
  } else {
    if (evidence.nightBackgrounds !== 1) {
      failures.push(`${check.name}: expected one night background, got ${evidence.nightBackgrounds}`);
    }
    if (evidence.nightOrbs < 6) {
      failures.push(`${check.name}: expected at least six night orbs, got ${evidence.nightOrbs}`);
    }
    if (evidence.dayBubbles !== 0) {
      failures.push(`${check.name}: day bubbles leaked into night scene`);
    }
  }

  return failures;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  const failures = [];

  try {
    for (const check of checks) {
      const { evidence, consoleErrors, failedResponses, ignoredDevResponses } =
        await captureSplash(browser, check);
      results.push({
        check: check.name,
        evidence,
        consoleErrors,
        failedResponses,
        ignoredDevResponses,
      });
      failures.push(...assertEvidence(check, evidence));
      failures.push(...consoleErrors.map((error) => `${check.name}: console error: ${error}`));
      failures.push(
        ...failedResponses.map(
          (response) => `${check.name}: ${response.status} response for ${response.url}`,
        ),
      );
    }
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify({ targetUrl, results }, null, 2));

  if (failures.length > 0) {
    console.error(`V2 splash smoke failed:\n- ${failures.join("\n- ")}`);
    process.exit(1);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
