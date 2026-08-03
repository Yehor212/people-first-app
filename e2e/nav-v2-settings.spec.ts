import { expect, test, type Page } from "@playwright/test";

import { primeZenflowV2, type ZenflowV2Language } from "./helpers/zenflowV2State";

const WEB_SECTION_IDS = ["account", "appearance", "sound", "privacy"] as const;
type SettingsDeepLinkSection = (typeof WEB_SECTION_IDS)[number] | "notifications";

async function openSettings(
  page: Page,
  options: {
    language?: ZenflowV2Language;
    layout?: "phone" | "desktop";
    section?: SettingsDeepLinkSection;
    width?: number;
    height?: number;
    textScale?: number;
  } = {}
) {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await primeZenflowV2(page, {
    clearStorage: true,
    language: options.language ?? "en",
    theme: "paper",
  });
  if (options.textScale) {
    await page.addInitScript((scale) => {
      localStorage.setItem("zenflow_font_scale", String(scale));
    }, options.textScale);
  }
  await page.setViewportSize({
    width: options.width ?? (options.layout === "desktop" ? 1280 : 390),
    height: options.height ?? (options.layout === "desktop" ? 900 : 844),
  });
  const params = new URLSearchParams({
    dev: "true",
    nav: "v2",
    navLayout: options.layout ?? "phone",
  });
  if (options.section) params.set("settingsSection", options.section);
  await page.goto(`settings?${params.toString()}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("settings-page")).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() =>
    Math.max(
      0,
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
      document.body.scrollWidth - document.documentElement.clientWidth
    )
  );
  expect(overflow).toBe(0);
}

async function expectPhoneOverview(page: Page, focusedSection?: string) {
  await expect(page.getByTestId("settings-page-workspace")).toHaveAttribute(
    "data-mobile-view",
    "overview"
  );
  await expect(page.getByTestId("settings-selected-panel")).toHaveCount(0);
  await expect(page.locator('[data-testid^="settings-module-card-"]')).toHaveCount(4);
  for (const sectionId of WEB_SECTION_IDS) {
    const card = page.getByTestId(`settings-module-card-${sectionId}`);
    await expect(card).toBeVisible();
    await expect(card).not.toHaveAttribute("aria-controls", /.+/);
  }
  if (focusedSection) {
    await expect(page.getByTestId(`settings-module-card-${focusedSection}`)).toBeFocused();
  }
  await expectNoHorizontalOverflow(page);
}

test.describe("V2 Settings current information architecture", () => {
  test.setTimeout(60_000);

  test("phone overview exposes four actionable Web groups", async ({ page }) => {
    await openSettings(page);

    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toHaveCount(1);
    await expectPhoneOverview(page);
    await expect(page.getByTestId("settings-module-card-notifications")).toHaveCount(0);
    await expect(page.getByTestId("settings-module-card-about")).toHaveCount(0);
    await expect(page.getByTestId("settings-support-footer")).toBeVisible();
  });

  test("phone detail uses URL history and restores overview focus", async ({ page }) => {
    await openSettings(page);
    await page.getByTestId("settings-module-card-appearance").click();

    await expect(page.getByTestId("settings-module-panel-appearance")).toBeVisible();
    await expect(page).toHaveURL(/settingsSection=appearance/);
    await expect(page.getByTestId("settings-module-panel-appearance")).not.toHaveAttribute(
      "tabindex"
    );
    await expect(page.locator("#settings-module-panel-heading-appearance")).toBeFocused();
    await page.goBack();
    await expectPhoneOverview(page, "appearance");
    await expect(page).not.toHaveURL(/settingsSection=/);

    await page.goForward();
    await expect(page.getByTestId("settings-module-panel-appearance")).toBeVisible();
    await expect(page.locator("#settings-module-panel-heading-appearance")).toBeFocused();
  });

  test("direct phone detail closes in place without leaking its query", async ({ page }) => {
    await openSettings(page, { section: "privacy" });
    await expect(page.getByTestId("settings-module-panel-privacy")).toBeVisible();

    await page.getByTestId("settings-mobile-back").click();

    await expectPhoneOverview(page, "privacy");
    await expect(page).not.toHaveURL(/settingsSection=/);
  });

  test("unavailable Web reminders deep link normalizes to Appearance", async ({ page }) => {
    await openSettings(page, { section: "notifications" });

    await expect(page.getByTestId("settings-module-panel-appearance")).toBeVisible();
    await expect(page).toHaveURL(/settingsSection=appearance/);
    await expect(page).not.toHaveURL(/settingsSection=notifications/);
  });

  test("desktop keeps four groups beside one labelled detail", async ({ page }) => {
    await openSettings(page, { layout: "desktop" });

    await expect(page.locator('[data-testid^="settings-module-card-"]')).toHaveCount(4);
    await expect(page.locator('[data-testid^="settings-module-panel-"]')).toHaveCount(1);
    const panel = page.getByTestId("settings-module-panel-appearance");
    await expect(panel).toHaveAttribute(
      "aria-labelledby",
      "settings-module-panel-heading-appearance"
    );
    await expect(
      page.getByRole("heading", { level: 2, name: "Appearance & accessibility" })
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "Appearance" })).toBeVisible();
    await expect(panel).toHaveAttribute("data-visual-role", "settings-detail-region");
    await expect
      .poll(() =>
        panel.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            backdropFilter: style.backdropFilter,
            backgroundColor: style.backgroundColor,
            boxShadow: style.boxShadow,
          };
        })
      )
      .toEqual({
        backdropFilter: "none",
        backgroundColor: "rgba(0, 0, 0, 0)",
        boxShadow: "none",
      });
  });

  test("appearance choices persist immediately and the reset disclosure restores focus", async ({
    page,
  }) => {
    await openSettings(page, { layout: "desktop" });

    await page.getByTestId("settings-v2-theme-choice-ink").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "ink");
    await expect(page.getByTestId("settings-v2-theme-choice-ink")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = localStorage.getItem("zenflow:theme-v0c");
          return raw ? JSON.parse(raw).state?.theme : null;
        })
      )
      .toBe("ink");

    await expect(page.getByTestId("settings-v2-appearance-more")).toHaveCount(0);
    await page.getByTestId("settings-v2-accent-choice-blue").click();

    const more = page.getByTestId("settings-v2-appearance-more");
    await more.focus();
    await page.keyboard.press("Enter");
    const disclosure = page.getByTestId("settings-v2-appearance-more-menu");
    const reset = page.getByTestId("settings-v2-style-reset");
    await expect(more).not.toHaveAttribute("aria-haspopup");
    await expect(disclosure).not.toHaveAttribute("role", "menu");
    await expect(reset).not.toHaveAttribute("role", "menuitem");
    await expect(reset).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(disclosure).toHaveCount(0);
    await expect(more).toBeFocused();
  });

  test("Web never exposes mobile reminder controls or an active hidden-service summary", async ({
    page,
  }) => {
    await openSettings(page);

    await expect(page.getByTestId("settings-module-card-notifications")).toHaveCount(0);
    const privacyCard = page.getByTestId("settings-module-card-privacy");
    await expect(privacyCard).not.toContainText("Optional services on");
    await expect(privacyCard).not.toContainText("Optional services off");
    await page.getByTestId("settings-module-card-privacy").click();
    await expect(page.getByTestId("settings-v2-ad-consent")).toHaveCount(0);
    await expect(page.getByTestId("settings-v2-push-notifications")).toHaveCount(0);
  });

  test("Privacy separates restorable backups from reports", async ({ page }) => {
    await openSettings(page, { section: "privacy" });

    const backup = page.getByRole("region", { name: "Backup & restore", exact: true });
    const reports = page.getByRole("region", { name: "Reports", exact: true });
    await expect(backup.getByTestId("settings-v2-export-json")).toHaveAccessibleName("Save backup");
    await expect(backup.getByTestId("settings-v2-import")).toHaveAccessibleName("Import backup");
    await expect(reports.getByTestId("settings-v2-export-csv")).toBeVisible();
    await expect(reports.getByTestId("settings-v2-export-pdf")).toBeVisible();
    await expect(reports).toContainText("Reports are not backups.");
  });

  test("help and legal actions remain reachable 44px controls in the footer", async ({ page }) => {
    await openSettings(page, { width: 320, height: 568, textScale: 1.5 });
    const footer = page.getByTestId("settings-support-footer");
    await footer.scrollIntoViewIfNeeded();

    for (const label of ["Send feedback", "Privacy Policy", "Terms of Service", "Licenses"]) {
      const action = footer.getByRole("button", { name: label });
      const box = await action.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    }
    await expectNoHorizontalOverflow(page);
  });

  test("largest text keeps the import confirmation inside a compact viewport", async ({ page }) => {
    await openSettings(page, {
      section: "privacy",
      width: 320,
      height: 568,
      textScale: 1.5,
    });
    const trigger = page.getByTestId("settings-v2-import");
    await trigger.scrollIntoViewIfNeeded();
    await page.locator('input[type="file"][accept="application/json"]').setInputFiles({
      name: "zenflow-backup.json",
      mimeType: "application/json",
      buffer: Buffer.from("{}"),
    });

    const dialog = page.getByRole("dialog");
    const panel = dialog.locator('[data-dialog-panel="true"]');
    await expect(dialog).toBeVisible();
    await dialog.getByTestId("settings-v2-import-mode-replace").click();
    const box = await panel.boundingBox();
    expect(box?.y ?? -1).toBeGreaterThanOrEqual(0);
    expect((box?.y ?? 0) + (box?.height ?? Number.POSITIVE_INFINITY)).toBeLessThanOrEqual(568);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  for (const language of ["ar", "he"] as const) {
    test(`RTL ${language} keeps the overview and detail within 320px`, async ({ page }) => {
      await openSettings(page, { language, width: 320, height: 568 });
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expectPhoneOverview(page);
      await page.getByTestId("settings-module-card-appearance").click();
      await expect(page.getByTestId("settings-module-panel-appearance")).toBeVisible();
      await expectNoHorizontalOverflow(page);
      const arrowTransform = await page
        .getByTestId("settings-mobile-back")
        .locator("svg")
        .evaluate((element) => getComputedStyle(element).transform);
      expect(arrowTransform).not.toBe("none");
    });
  }

  test("Sound contains only working app-wide controls", async ({ page }) => {
    await openSettings(page, { section: "sound", width: 320, height: 568 });

    await expect(page.getByTestId("settings-v2-audio-volume")).toBeVisible();
    await expect(page.getByTestId("settings-v2-audio-ambient-toggle")).toBeVisible();
    await expect(page.getByTestId("settings-v2-audio-activity-toggle")).toBeVisible();
    await expect(page.getByTestId("settings-v2-diary-ambience-control")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });
});
