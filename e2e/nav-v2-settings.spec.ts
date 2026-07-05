import { expect, test, type Page } from "@playwright/test";

import { primeZenflowV2 } from "./helpers/zenflowV2State";

const APP_BASE = "/people-first-app";

async function primeApp(page: Page, options: { language?: "en" | "ar" | "he" } = {}) {
  const language = options.language ?? "en";

  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await primeZenflowV2(page, { language, theme: "paper" });
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

async function expectControlsFirstHierarchy(page: Page, selectedSectionId = "appearance") {
  if (selectedSectionId === "appearance") {
    await expect(page.getByTestId("settings-page-control-card")).toHaveCount(1);
    await expect(page.getByTestId("settings-v2-appearance-studio-title")).toBeVisible();
  } else {
    await expect(page.getByTestId("settings-page-control-card")).toBeVisible();
  }
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
    const workspace = document.querySelector('[data-testid="settings-page-workspace"]');
    const moduleList = document.querySelector('[data-testid="settings-module-list"]');
    const selectedPanel = document.querySelector('[data-testid="settings-selected-panel"]');
    const panel = document.querySelector(`[data-testid="settings-module-panel-${selectedSectionId}"]`);
    const deck = document.querySelector('[data-testid="settings-page-control-deck"]');
    const status = document.querySelector('[data-testid="settings-status-overview"]');
    const sync = document.querySelector('[data-testid="sync-health-card"]');
    const selectedButton = document.querySelector(
      `[data-testid="settings-module-card-${selectedSectionId}"]`
    );

    if (!workspace || !moduleList || !selectedPanel || !panel || !deck || !selectedButton) {
      throw new Error("Missing settings workspace nodes");
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
      panelInsideSelectedPanel: selectedPanel.contains(panel),
      workspaceHasList: workspace.contains(moduleList),
      workspaceHasSelectedPanel: workspace.contains(selectedPanel),
      workspaceDomOrder: Array.from(workspace.children).map((node) =>
        (node as HTMLElement).dataset.testid || (node as HTMLElement).id || node.tagName,
      ),
      workspaceLayout: (workspace as HTMLElement).dataset.layout,
      panelOverflowX: getComputedStyle(panel).overflowX,
      panelScrollWidth: panel.scrollWidth,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      hero: readRect("settings-page-control-card"),
      moduleList: readRect("settings-module-list"),
      deck: readRect("settings-page-control-deck"),
      sync: readOptionalRect("sync-health-card"),
    };
  }, selectedSectionId);

  expect(metrics.moduleList.top).toBeGreaterThanOrEqual(metrics.hero.bottom - 1);
  expect(metrics.workspaceLayout).toBe("control-surface");
  expect(metrics.workspaceHasList).toBe(true);
  expect(metrics.workspaceHasSelectedPanel).toBe(true);
  expect(metrics.panelInsideList).toBe(false);
  expect(metrics.panelInsideSelectedPanel).toBe(true);
  expect(metrics.deckInsidePanel).toBe(true);
  if (metrics.viewportWidth < 1024) {
    expect(metrics.deck.top).toBeLessThanOrEqual(metrics.moduleList.top + 1);
    expect(metrics.workspaceDomOrder.slice(0, 2)).toEqual([
      "settings-module-list",
      "settings-selected-panel",
    ]);
  } else {
    expect(metrics.deck.top).toBeGreaterThanOrEqual(metrics.moduleList.top);
    expect(metrics.workspaceDomOrder.slice(0, 2)).toEqual([
      "settings-module-list",
      "settings-selected-panel",
    ]);
  }
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

async function expectAppearanceCanvasOrder(page: Page) {
  const metrics = await page.evaluate(() => {
    const readTop = (testId: string) => {
      const node = document.querySelector(`[data-testid="${testId}"]`);
      if (!node) throw new Error(`Missing ${testId}`);
      return node.getBoundingClientRect().top;
    };

    return {
      accentTop: readTop("settings-v2-accent-field"),
      modeTop: readTop("settings-v2-theme-mode-field"),
      moodTop: readTop("settings-v2-mood-palette-field"),
    };
  });

  expect(metrics.moodTop).toBeLessThan(metrics.modeTop);
  expect(metrics.modeTop).toBeLessThan(metrics.accentTop);
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

  for (const soundLayout of [
    { name: "phone", viewport: { width: 390, height: 844 } },
    { name: "desktop", viewport: { width: 1280, height: 900 } },
  ] as const) {
    test(`sound settings own diary ambience without a diary route overlay (${soundLayout.name})`, async ({
      page,
    }) => {
      await primeApp(page);
      await page.setViewportSize(soundLayout.viewport);

      await page.goto(`${APP_BASE}/diary?nav=v2&navLayout=${soundLayout.name}&dev=true`);
      await expect(page.getByTestId("diary-page")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("diary-page-ambience-control")).toHaveCount(0);
      await expect(page.getByTestId("diary-page-ambience-toggle")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Play soft rain" })).toHaveCount(0);

      await page.goto(`${APP_BASE}/settings?nav=v2&navLayout=${soundLayout.name}&dev=true`);
      await page.evaluate(() => document.fonts.ready);
      await page.getByTestId("settings-module-card-sound").click();

      await expect(page.getByTestId("settings-v2-panel-sound")).toBeVisible();
      await expect(page.getByTestId("settings-v2-diary-ambience-control")).toBeVisible();
      const diaryAmbienceToggle = page.getByTestId("settings-v2-diary-ambience-toggle");
      await expect(diaryAmbienceToggle).toBeVisible();
      await expect(diaryAmbienceToggle).toHaveAccessibleName("Play soft rain");
      await expect(diaryAmbienceToggle).not.toHaveAttribute("aria-pressed");

      const facts = await page.evaluate(() => {
        const toggle = document.querySelector<HTMLElement>(
          '[data-testid="settings-v2-diary-ambience-toggle"]',
        );
        const audio = document.querySelector<HTMLAudioElement>(
          '[data-testid="settings-v2-diary-ambience-audio"]',
        );
        const rect = toggle?.getBoundingClientRect();
        return {
          audioAutoplay: audio?.hasAttribute("autoplay") ?? null,
          audioPreload: audio?.getAttribute("preload") ?? null,
          pageOverflowX: Math.max(
            0,
            document.documentElement.scrollWidth - document.documentElement.clientWidth,
            document.body.scrollWidth - document.documentElement.clientWidth,
          ),
          touchHeight: rect?.height ?? 0,
          touchWidth: rect?.width ?? 0,
        };
      });

      expect(facts).toMatchObject({
        audioAutoplay: false,
        audioPreload: "none",
        pageOverflowX: 0,
      });
      expect(Math.min(facts.touchWidth, facts.touchHeight)).toBeGreaterThanOrEqual(44);
      await expectControlsFirstHierarchy(page, "sound");
    });
  }

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
      .getByRole("switch", { name: "Pure black mode" })
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
    await expectAppearanceCanvasOrder(page);
    expect(page.url()).toBe(beforeUrl);
  });

  test("wide desktop phone-layout mode keeps settings workspace without horizontal scrolling", async ({
    page,
  }) => {
    await primeApp(page);
    await page.setViewportSize({ width: 1920, height: 983 });
    await page.goto(`${APP_BASE}/settings?nav=v2&navLayout=phone&dev=true`);
    await page.evaluate(() => document.fonts.ready);

    await expectControlsFirstHierarchy(page);
  });

  for (const language of ["ar", "he"] as const) {
    test(`RTL layout keeps the ${language} settings workspace inside the page width`, async ({
      page,
    }) => {
      await primeApp(page, { language });
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto(`${APP_BASE}/settings?nav=v2&navLayout=desktop&dev=true`);
      await page.evaluate(() => document.fonts.ready);

      await expect(page.locator("html")).toHaveAttribute("lang", language);
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expectControlsFirstHierarchy(page);
    });
  }

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
