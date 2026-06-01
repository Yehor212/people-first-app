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

async function expectControlsFirstHierarchy(page: import("@playwright/test").Page) {
  await expect(page.getByTestId("settings-page-control-card")).toBeVisible();
  await expect(page.getByTestId("settings-section-switcher")).toBeVisible();
  await expect(page.getByTestId("settings-page-control-deck")).toBeVisible();
  await expect(page.getByTestId("sync-health-card")).toBeVisible();
  await expect(page.getByTestId("settings-module-list")).toHaveCount(0);

  await expect(page.getByTestId("settings-section-switcher-profile")).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(page.getByTestId("settings-section-switcher-profile")).toHaveAttribute(
    "aria-controls",
    "settings-v2-control-deck"
  );
  await expect(page.getByTestId("settings-page-control-deck")).toHaveAttribute(
    "data-selected-section",
    "profile"
  );

  const metrics = await page.evaluate(() => {
    const readRect = (testId: string) => {
      const node = document.querySelector(`[data-testid="${testId}"]`);
      if (!node) throw new Error(`Missing ${testId}`);
      const rect = node.getBoundingClientRect();
      return {
        bottom: rect.bottom,
        height: rect.height,
        top: rect.top,
      };
    };

    return {
      viewportHeight: window.innerHeight,
      hero: readRect("settings-page-control-card"),
      switcher: readRect("settings-section-switcher"),
      deck: readRect("settings-page-control-deck"),
      sync: readRect("sync-health-card"),
    };
  });

  expect(metrics.switcher.top).toBeGreaterThanOrEqual(metrics.hero.bottom - 1);
  expect(metrics.deck.top).toBeGreaterThanOrEqual(metrics.switcher.bottom - 1);
  expect(metrics.deck.bottom).toBeLessThanOrEqual(metrics.sync.top + 1);
  expect(metrics.deck.top).toBeLessThan(metrics.viewportHeight - 120);
}

test.describe("V2 Settings controls-first hierarchy", () => {
  test("phone layout puts selected controls before passive sync and status content", async ({
    page,
  }) => {
    await primeApp(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${APP_BASE}/settings?nav=v2&navLayout=phone&dev=true`);
    await page.evaluate(() => document.fonts.ready);

    await expectControlsFirstHierarchy(page);
  });

  test("desktop layout keeps the selected controls before status content", async ({ page }) => {
    await primeApp(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${APP_BASE}/settings?nav=v2&navLayout=desktop&dev=true`);
    await page.evaluate(() => document.fonts.ready);

    await expectControlsFirstHierarchy(page);
  });

  test("switcher changes the inline control deck without route changes or page scroll", async ({
    page,
  }) => {
    await primeApp(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${APP_BASE}/settings?nav=v2&navLayout=phone&dev=true`);
    await page.evaluate(() => document.fonts.ready);

    const beforeUrl = page.url();
    const beforeScrollY = await page.evaluate(() => window.scrollY);

    await page.getByTestId("settings-section-switcher-account").click();

    await expect(page.getByTestId("settings-section-switcher-account")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(page.getByTestId("settings-section-switcher-profile")).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    await expect(page.getByTestId("settings-page-control-deck")).toHaveAttribute(
      "data-selected-section",
      "account"
    );
    await expect(page.getByTestId("settings-v2-panel-account")).toBeVisible();
    await expect(page.getByTestId("sync-health-card")).toHaveAttribute(
      "data-allow-manual-retry",
      "false"
    );

    const syncInsideAccountPanel = await page.evaluate(() => {
      const sync = document.querySelector('[data-testid="sync-health-card"]');
      return Boolean(sync?.closest('[data-testid="settings-v2-panel-account"]'));
    });

    expect(syncInsideAccountPanel).toBe(false);
    expect(page.url()).toBe(beforeUrl);
    expect(await page.evaluate(() => window.scrollY)).toBe(beforeScrollY);
  });
});
