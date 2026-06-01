import { expect, test } from "@playwright/test";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };
const APP_BASE = "/people-first-app";

async function primeApp(page: import("@playwright/test").Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(
    ({ appVersion }: { appVersion: string }) => {
      localStorage.setItem("zenflow-language-selected", JSON.stringify(true));
      localStorage.setItem("zenflow-google-auth-checked", JSON.stringify(true));
      localStorage.setItem("zenflow-tutorial-complete", JSON.stringify(true));
      localStorage.setItem("zenflow-onboarding-complete", JSON.stringify(true));
      localStorage.setItem("zenflow-notification-permission-checked", JSON.stringify(true));
      localStorage.setItem(
        "zenflow_onboarding_state",
        JSON.stringify({
          isNewUser: false,
          hasSeenWelcome: true,
          firstLoginDate: Date.now(),
          daysActive: 5,
          lastActiveDate: new Date().toISOString().split("T")[0],
          unlockedFeatures: [],
        })
      );
      localStorage.setItem("zenflow_last_seen_version", appVersion);
      localStorage.setItem("zenflow-theme", "light");
      localStorage.setItem(
        "zenflow:theme-v0c",
        JSON.stringify({ state: { theme: "paper" }, version: 0 })
      );
      localStorage.setItem(
        "zenflow-privacy",
        JSON.stringify({ noTracking: false, analytics: false, consentShown: true })
      );
      localStorage.setItem("zenflow-privacy-acknowledged", JSON.stringify(true));
      localStorage.setItem("zenflow-orb-first-run-dismissed", "1");
    },
    { appVersion: packageJson.version }
  );
}

async function expectAccordionHierarchy(page: import("@playwright/test").Page) {
  await expect(page.getByTestId("settings-page-control-card")).toBeVisible();
  await expect(page.getByTestId("settings-section-switcher")).toHaveCount(0);
  await expect(page.getByTestId("settings-page-control-deck")).toHaveCount(0);
  await expect(page.getByTestId("settings-cockpit")).toHaveCount(0);
  await expect(page.getByTestId("settings-page-sections")).toHaveCount(0);
  await expect(page.getByTestId("settings-module-list")).toBeVisible();
  await expect(page.getByTestId("settings-module-card-modules")).toHaveCount(0);
  await expect(page.getByTestId("settings-module-card-profile")).toHaveAttribute(
    "aria-expanded",
    "true"
  );
  await expect(page.getByTestId("settings-module-panel-profile")).toBeVisible();
  await expect(page.getByTestId("sync-health-card")).toHaveCount(0);
  await expect(page.getByTestId("device-sessions-card")).toHaveCount(0);

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
      modules: readRect("settings-module-list"),
    };
  });

  expect(metrics.modules.top).toBeGreaterThanOrEqual(metrics.hero.bottom - 1);
  expect(metrics.modules.top).toBeLessThan(metrics.viewportHeight - 120);
}

test.describe("V2 Settings card module accordion", () => {
  test("phone layout keeps sync status inside the module accordion", async ({ page }) => {
    await primeApp(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${APP_BASE}/settings?nav=v2&navLayout=phone&dev=true`);
    await page.evaluate(() => document.fonts.ready);

    await expectAccordionHierarchy(page);
  });

  test("desktop layout keeps the same accordion hierarchy without a duplicate deck", async ({
    page,
  }) => {
    await primeApp(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${APP_BASE}/settings?nav=v2&navLayout=desktop&dev=true`);
    await page.evaluate(() => document.fonts.ready);

    await expectAccordionHierarchy(page);
  });

  test("module cards expand and collapse in place without route changes", async ({ page }) => {
    await primeApp(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${APP_BASE}/settings?nav=v2&navLayout=phone&dev=true`);
    await page.evaluate(() => document.fonts.ready);

    const beforeUrl = page.url();

    await page.getByTestId("settings-module-card-account").scrollIntoViewIfNeeded();

    await page.getByTestId("settings-module-card-account").click();

    await expect(page.getByTestId("settings-module-card-account")).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    await expect(page.getByTestId("settings-module-card-profile")).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    await expect(page.getByTestId("settings-module-panel-account")).toBeVisible();
    await expect(page.getByTestId("settings-v2-panel-account")).toBeVisible();
    await expect(page.getByTestId("settings-module-panel-profile")).toHaveCount(0);
    await expect(page.getByTestId("sync-health-card")).toBeVisible();
    await expect(page.getByTestId("sync-health-card")).toHaveAttribute(
      "data-allow-manual-retry",
      "false"
    );
    await expect(page.getByTestId("device-sessions-card")).toHaveCount(0);
    expect(page.url()).toBe(beforeUrl);

    const cardRect = await page.getByTestId("settings-module-card-account").evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return { top: rect.top };
    });
    const panelRect = await page.getByTestId("settings-module-panel-account").evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return { top: rect.top };
    });
    const visiblePanels = await page.evaluate(
      () => document.querySelectorAll('[data-testid^="settings-module-panel-"]').length
    );
    const syncInsideAccountPanel = await page.evaluate(() => {
      const sync = document.querySelector('[data-testid="sync-health-card"]');
      return Boolean(sync?.closest('[data-testid="settings-module-panel-account"]'));
    });

    expect(visiblePanels).toBe(1);
    expect(syncInsideAccountPanel).toBe(true);
    expect(panelRect.top).toBeGreaterThanOrEqual(cardRect.top);

    await page.getByTestId("settings-module-card-account").click();

    await expect(page.getByTestId("settings-module-card-account")).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    await expect(page.getByTestId("settings-module-panel-account")).toHaveCount(0);
    await expect(page.locator('[data-testid^="settings-module-panel-"]')).toHaveCount(0);
    expect(page.url()).toBe(beforeUrl);
  });

  test("desktop module cards use the same collapsible accordion behavior", async ({ page }) => {
    await primeApp(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${APP_BASE}/settings?nav=v2&navLayout=desktop&dev=true`);
    await page.evaluate(() => document.fonts.ready);

    const beforeUrl = page.url();

    await page.getByTestId("settings-module-card-account").click();

    await expect(page.getByTestId("settings-module-card-account")).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    await expect(page.getByTestId("settings-module-panel-account")).toBeVisible();
    await expect(page.getByTestId("sync-health-card")).toBeVisible();
    await expect(page.getByTestId("device-sessions-card")).toHaveCount(0);

    await page.getByTestId("settings-module-card-account").click();

    await expect(page.getByTestId("settings-module-card-account")).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    await expect(page.locator('[data-testid^="settings-module-panel-"]')).toHaveCount(0);
    expect(page.url()).toBe(beforeUrl);
  });
});
