import { expect, test, type Page } from "@playwright/test";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };
const APP_BASE = "/people-first-app";

async function primeApp(page: Page, options: { language?: "en" | "ar" | "he" } = {}) {
  const language = options.language ?? "en";

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(
    ({ appVersion, language }: { appVersion: string; language: "en" | "ar" | "he" }) => {
      localStorage.setItem("zenflow-language", JSON.stringify(language));
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
    { appVersion: packageJson.version, language }
  );
}

async function expectControlsFirstHierarchy(page: Page, selectedSectionId = "profile") {
  await expect(page.getByTestId("settings-page-control-card")).toBeVisible();
  await expect(page.getByTestId("settings-module-list")).toBeVisible();
  await expect(page.getByTestId("settings-page-control-deck")).toBeVisible();
  await expect(page.getByTestId("sync-health-card")).toBeVisible();
  await expect(page.getByTestId("settings-section-switcher")).toHaveCount(0);

  await expect(page.getByTestId(`settings-module-card-${selectedSectionId}`)).toHaveAttribute(
    "aria-expanded",
    "true"
  );
  await expect(page.getByTestId(`settings-module-card-${selectedSectionId}`)).toHaveAttribute(
    "aria-controls",
    `settings-module-panel-${selectedSectionId}`
  );
  await expect(page.getByTestId("settings-page-control-deck")).toHaveAttribute(
    "data-selected-section",
    selectedSectionId
  );
  await expect(page.getByTestId("settings-page-control-deck")).toHaveAttribute(
    "id",
    "settings-v2-control-deck"
  );

  const metrics = await page.evaluate((selectedSectionId) => {
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

    const pageWidth = document.documentElement.clientWidth;
    const moduleList = document.querySelector('[data-testid="settings-module-list"]');
    const panel = document.querySelector(`[data-testid="settings-module-panel-${selectedSectionId}"]`);
    const deck = document.querySelector('[data-testid="settings-page-control-deck"]');
    const selectedButton = document.querySelector(
      `[data-testid="settings-module-card-${selectedSectionId}"]`
    );

    if (!moduleList || !panel || !deck || !selectedButton) {
      throw new Error("Missing settings accordion nodes");
    }

    return {
      deckInsidePanel: panel.contains(deck),
      moduleListClientWidth: moduleList.clientWidth,
      moduleListOverflowX: getComputedStyle(moduleList).overflowX,
      moduleListScrollWidth: moduleList.scrollWidth,
      pageOverflowX: Math.max(
        0,
        document.documentElement.scrollWidth - pageWidth,
        document.body.scrollWidth - pageWidth
      ),
      panelClientWidth: panel.clientWidth,
      panelInsideList: moduleList.contains(panel),
      panelOverflowX: getComputedStyle(panel).overflowX,
      panelScrollWidth: panel.scrollWidth,
      viewportHeight: window.innerHeight,
      hero: readRect("settings-page-control-card"),
      moduleList: readRect("settings-module-list"),
      deck: readRect("settings-page-control-deck"),
      sync: readRect("sync-health-card"),
    };
  }, selectedSectionId);

  expect(metrics.moduleList.top).toBeGreaterThanOrEqual(metrics.hero.bottom - 1);
  expect(metrics.panelInsideList).toBe(true);
  expect(metrics.deckInsidePanel).toBe(true);
  expect(metrics.deck.top).toBeGreaterThanOrEqual(metrics.moduleList.top);
  expect(metrics.sync.top).toBeGreaterThanOrEqual(metrics.moduleList.bottom - 1);
  expect(metrics.deck.top).toBeLessThan(metrics.viewportHeight - 120);
  expect(metrics.pageOverflowX).toBe(0);
  expect(metrics.moduleListScrollWidth).toBeLessThanOrEqual(metrics.moduleListClientWidth + 1);
  expect(metrics.panelScrollWidth).toBeLessThanOrEqual(metrics.panelClientWidth + 1);
  expect(metrics.moduleListOverflowX).not.toBe("auto");
  expect(metrics.panelOverflowX).not.toBe("auto");
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

  test("wide desktop phone-layout mode keeps settings cards without horizontal scrolling", async ({
    page,
  }) => {
    await primeApp(page);
    await page.setViewportSize({ width: 1920, height: 983 });
    await page.goto(`${APP_BASE}/settings?nav=v2&navLayout=phone&dev=true`);
    await page.evaluate(() => document.fonts.ready);

    await expectControlsFirstHierarchy(page);
  });

  test("RTL layout keeps the card accordion inside the page width", async ({ page }) => {
    await primeApp(page, { language: "he" });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${APP_BASE}/settings?nav=v2&navLayout=desktop&dev=true`);
    await page.evaluate(() => document.fonts.ready);

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expectControlsFirstHierarchy(page);
  });

  test("module card changes the inline control deck without route changes or page scroll", async ({
    page,
  }) => {
    await primeApp(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${APP_BASE}/settings?nav=v2&navLayout=phone&dev=true`);
    await page.evaluate(() => document.fonts.ready);

    const beforeUrl = page.url();

    await page.getByTestId("settings-module-card-account").click();

    await expect(page.getByTestId("settings-module-card-account")).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    await expect(page.getByTestId("settings-module-card-profile")).toHaveAttribute(
      "aria-expanded",
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
    await expectControlsFirstHierarchy(page, "account");
    expect(page.url()).toBe(beforeUrl);
  });
});
