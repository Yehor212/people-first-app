import { expect, test, type Page } from "@playwright/test";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };
const APP_BASE = "/people-first-app";

async function primeApp(page: Page, options: { language?: "en" | "ar" | "he" } = {}) {
  const language = options.language ?? "en";

  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
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

async function readThemeEvidence(page: Page) {
  return page.evaluate(() => {
    const persistedRaw = localStorage.getItem("zenflow:theme-v0c");
    const persisted = persistedRaw ? JSON.parse(persistedRaw) : null;

    return {
      htmlTheme: document.documentElement.dataset.theme,
      legacyTheme: localStorage.getItem("zenflow-theme"),
      oledMode: localStorage.getItem("zenflow_oled_mode"),
      hasDarkClass: document.documentElement.classList.contains("dark"),
      hasOledClass: document.documentElement.classList.contains("oled"),
      persistedTheme: persisted?.state?.theme ?? null,
    };
  });
}

async function expectControlsFirstHierarchy(page: Page, selectedSectionId = "profile") {
  await expect(page.getByTestId("settings-page-control-card")).toBeVisible();
  await expect(page.getByTestId("settings-module-list")).toBeVisible();
  await expect(page.getByTestId("settings-page-control-deck")).toBeVisible();
  if (selectedSectionId === "account") {
    await expect(page.getByTestId("settings-status-overview")).toBeVisible();
    await expect(page.getByTestId("sync-health-card")).toBeVisible();
  } else {
    await expect(page.getByTestId("settings-status-overview")).toHaveCount(0);
    await expect(page.getByTestId("sync-health-card")).toHaveCount(0);
  }
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
    const readOptionalRect = (testId: string) => {
      const node = document.querySelector(`[data-testid="${testId}"]`);
      if (!node) return null;
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
    const status = document.querySelector('[data-testid="settings-status-overview"]');
    const sync = document.querySelector('[data-testid="sync-health-card"]');
    const selectedButton = document.querySelector(
      `[data-testid="settings-module-card-${selectedSectionId}"]`
    );

    if (!moduleList || !panel || !deck || !selectedButton) {
      throw new Error("Missing settings accordion nodes");
    }

    return {
      deckInsidePanel: panel.contains(deck),
      statusExists: Boolean(status),
      statusInsidePanel: Boolean(status && panel.contains(status)),
      syncExists: Boolean(sync),
      syncInsidePanel: Boolean(sync && panel.contains(sync)),
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
      sync: readOptionalRect("sync-health-card"),
    };
  }, selectedSectionId);

  expect(metrics.moduleList.top).toBeGreaterThanOrEqual(metrics.hero.bottom - 1);
  expect(metrics.panelInsideList).toBe(true);
  expect(metrics.deckInsidePanel).toBe(true);
  expect(metrics.deck.top).toBeGreaterThanOrEqual(metrics.moduleList.top);
  if (selectedSectionId === "account") {
    expect(metrics.statusExists).toBe(true);
    expect(metrics.statusInsidePanel).toBe(true);
    expect(metrics.syncExists).toBe(true);
    expect(metrics.syncInsidePanel).toBe(true);
    expect(metrics.sync?.top ?? 0).toBeGreaterThanOrEqual(metrics.deck.top);
  } else {
    expect(metrics.statusExists).toBe(false);
    expect(metrics.syncExists).toBe(false);
  }
  expect(metrics.deck.top).toBeLessThan(metrics.viewportHeight - 120);
  expect(metrics.pageOverflowX).toBe(0);
  expect(metrics.moduleListScrollWidth).toBeLessThanOrEqual(metrics.moduleListClientWidth + 1);
  expect(metrics.panelScrollWidth).toBeLessThanOrEqual(metrics.panelClientWidth + 1);
  expect(metrics.moduleListOverflowX).not.toBe("auto");
  expect(metrics.panelOverflowX).not.toBe("auto");
}

test.describe("V2 Settings controls-first hierarchy", () => {
  test.setTimeout(60_000);

  test("phone layout keeps selected controls inline without standalone sync status", async ({
    page,
  }) => {
    await primeApp(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${APP_BASE}/settings?nav=v2&navLayout=phone&dev=true`);
    await page.evaluate(() => document.fonts.ready);

    await expectControlsFirstHierarchy(page);
  });

  test("desktop layout keeps selected controls inline without standalone sync status", async ({ page }) => {
    await primeApp(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${APP_BASE}/settings?nav=v2&navLayout=desktop&dev=true`);
    await page.evaluate(() => document.fonts.ready);

    await expectControlsFirstHierarchy(page);
    await expect(page.getByTestId("settings-module-card-profile")).toContainText("Profile");
    await expect(page.getByTestId("settings-module-card-profile")).not.toContainText(
      "Profile & Appearance"
    );
  });

  test("appearance controls update the canonical V2 theme and legacy compatibility state", async ({
    page,
  }) => {
    await primeApp(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${APP_BASE}/settings?nav=v2&navLayout=desktop&dev=true`);
    await page.evaluate(() => document.fonts.ready);

    const beforeUrl = page.url();
    await page.getByTestId("settings-module-card-appearance").click();

    await expect(page.getByTestId("settings-v2-panel-appearance")).toBeVisible();
    await expect(page.getByTestId("settings-v2-theme-choice-paper")).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await page.getByTestId("settings-v2-theme-choice-ink").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "ink");
    await expect(page.getByTestId("settings-v2-theme-choice-ink")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(await readThemeEvidence(page)).toMatchObject({
      htmlTheme: "ink",
      legacyTheme: "dark",
      oledMode: "false",
      hasDarkClass: true,
      hasOledClass: false,
      persistedTheme: "ink",
    });

    await page.getByTestId("settings-v2-theme-choice-auto").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "paper");
    await expect(page.getByTestId("settings-v2-theme-choice-auto")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(await readThemeEvidence(page)).toMatchObject({
      htmlTheme: "paper",
      legacyTheme: "system",
      oledMode: "false",
      hasDarkClass: false,
      hasOledClass: false,
      persistedTheme: "auto",
    });

    await page
      .getByTestId("settings-v2-oled-toggle")
      .getByRole("switch", { name: "OLED Dark Mode" })
      .click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "oled");
    expect(await readThemeEvidence(page)).toMatchObject({
      htmlTheme: "oled",
      legacyTheme: "dark",
      oledMode: "true",
      hasDarkClass: true,
      hasOledClass: true,
      persistedTheme: "oled",
    });

    await expectControlsFirstHierarchy(page, "appearance");
    expect(page.url()).toBe(beforeUrl);
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

  test("privacy no-tracking switch can be turned on and back off", async ({ page }) => {
    await primeApp(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${APP_BASE}/settings?nav=v2&navLayout=desktop&dev=true`);
    await page.evaluate(() => document.fonts.ready);

    await page.getByTestId("settings-module-card-privacy").click();
    const noTrackingSwitch = page
      .getByTestId("settings-v2-no-tracking")
      .getByRole("switch", { name: "No tracking" });

    await expect(noTrackingSwitch).toHaveAttribute("aria-checked", "false");
    await noTrackingSwitch.click();
    await expect(noTrackingSwitch).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("settings-module-card-privacy")).toContainText("No tracking");

    await noTrackingSwitch.click();
    await expect(noTrackingSwitch).toHaveAttribute("aria-checked", "false");
    await expect(page.getByTestId("settings-module-card-privacy")).not.toContainText(
      "No tracking"
    );
    await expectControlsFirstHierarchy(page, "privacy");
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

    const syncInsideAccountModule = await page.evaluate(() => {
      const sync = document.querySelector('[data-testid="sync-health-card"]');
      return Boolean(sync?.closest('[data-testid="settings-module-panel-account"]'));
    });

    expect(syncInsideAccountModule).toBe(true);
    await expect(page.getByTestId("settings-status-overview")).toBeVisible();
    await expectControlsFirstHierarchy(page, "account");
    expect(page.url()).toBe(beforeUrl);
  });
});
