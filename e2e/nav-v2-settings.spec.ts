import { expect, test } from "@playwright/test";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };
const APP_BASE = "/people-first-app";

async function primeApp(page: import("@playwright/test").Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(({ appVersion }: { appVersion: string }) => {
    localStorage.setItem("zenflow-language-selected", JSON.stringify(true));
    localStorage.setItem("zenflow-google-auth-checked", JSON.stringify(true));
    localStorage.setItem("zenflow-tutorial-complete", JSON.stringify(true));
    localStorage.setItem("zenflow-onboarding-complete", JSON.stringify(true));
    localStorage.setItem(
      "zenflow-notification-permission-checked",
      JSON.stringify(true),
    );
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
    localStorage.setItem("zenflow_last_seen_version", appVersion);
    localStorage.setItem("zenflow-theme", "light");
    localStorage.setItem(
      "zenflow:theme-v0c",
      JSON.stringify({ state: { theme: "paper" }, version: 0 }),
    );
    localStorage.setItem(
      "zenflow-privacy",
      JSON.stringify({ noTracking: false, analytics: false, consentShown: true }),
    );
    localStorage.setItem("zenflow-privacy-acknowledged", JSON.stringify(true));
    localStorage.setItem("zenflow-orb-first-run-dismissed", "1");
  }, { appVersion: packageJson.version });
}

async function expectControlsFirstHierarchy(page: import("@playwright/test").Page) {
  await expect(page.getByTestId("settings-page-control-card")).toBeVisible();
  await expect(page.getByTestId("settings-section-switcher")).toBeVisible();
  await expect(page.getByTestId("settings-page-control-deck")).toBeVisible();

  const metrics = await page.evaluate(() => {
    const readRect = (testId: string) => {
      const node = document.querySelector(`[data-testid="${testId}"]`);
      if (!node) throw new Error(`Missing ${testId}`);
      const rect = node.getBoundingClientRect();
      return {
        bottom: rect.bottom,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width,
      };
    };

    return {
      viewportHeight: window.innerHeight,
      hero: readRect("settings-page-control-card"),
      switcher: readRect("settings-section-switcher"),
      deck: readRect("settings-page-control-deck"),
      cockpit: readRect("settings-cockpit"),
      sections: readRect("settings-page-sections"),
      sync: readRect("sync-health-card"),
      devices: readRect("device-sessions-card"),
    };
  });

  expect(metrics.switcher.top).toBeGreaterThanOrEqual(metrics.hero.bottom - 1);
  expect(metrics.deck.top).toBeGreaterThanOrEqual(metrics.switcher.bottom - 1);
  expect(metrics.deck.top).toBeLessThan(metrics.viewportHeight - 120);
  expect(metrics.sync.top).toBeGreaterThanOrEqual(metrics.deck.bottom - 1);
  expect(metrics.devices.top).toBeGreaterThanOrEqual(metrics.deck.bottom - 1);
  expect(metrics.cockpit.top).toBeGreaterThanOrEqual(metrics.deck.bottom - 1);
  expect(metrics.sections.top).toBeGreaterThanOrEqual(metrics.deck.bottom - 1);
}

test.describe("V2 Settings controls-first hierarchy", () => {
  test("phone layout puts the selected controls before passive sync/status content", async ({
    page,
  }) => {
    await primeApp(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${APP_BASE}/settings?nav=v2&navLayout=phone&dev=true`);
    await page.evaluate(() => document.fonts.ready);

    await expectControlsFirstHierarchy(page);
  });

  test("desktop layout keeps the inline module before settings overview content", async ({
    page,
  }) => {
    await primeApp(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${APP_BASE}/settings?nav=v2&navLayout=desktop&dev=true`);
    await page.evaluate(() => document.fonts.ready);

    await expectControlsFirstHierarchy(page);
  });

  test("switcher changes the inline module without route changes or page scroll", async ({
    page,
  }) => {
    await primeApp(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${APP_BASE}/settings?nav=v2&navLayout=phone&dev=true`);
    await page.evaluate(() => document.fonts.ready);

    const beforeUrl = page.url();
    const beforeScrollY = await page.evaluate(() => window.scrollY);

    await page.getByTestId("settings-section-switcher-data").click();

    await expect(page.getByTestId("settings-v2-panel-data")).toBeVisible();
    await expect(page.getByTestId("settings-page-control-deck-header")).toContainText("Data");
    expect(page.url()).toBe(beforeUrl);

    const afterScrollY = await page.evaluate(() => window.scrollY);
    expect(Math.abs(afterScrollY - beforeScrollY)).toBeLessThanOrEqual(1);
  });
});
