import { expect, test, type Locator, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";

import { v2RoutePath } from "./helpers/zenflowV2State";

const IOS_DIARY_ORIGIN = "https://127.0.0.1:4188";
const JOURNAL_PHOTO_FIXTURE = fileURLToPath(new URL("../public/og-image.png", import.meta.url));

test.use({
  browserName: "webkit",
  deviceScaleFactor: 3,
  hasTouch: true,
  ignoreHTTPSErrors: true,
  isMobile: true,
  timezoneId: "UTC",
  storageState: {
    cookies: [],
    origins: [
      {
        origin: IOS_DIARY_ORIGIN,
        localStorage: [
          { name: "zenflow-language", value: JSON.stringify("en") },
          { name: "zenflow-language-selected", value: JSON.stringify(true) },
          { name: "zenflow-google-auth-checked", value: JSON.stringify(true) },
          { name: "zenflow-onboarding-complete", value: JSON.stringify(true) },
          { name: "zenflow-notification-permission-checked", value: JSON.stringify(true) },
          { name: "zenflow_last_seen_version", value: "2.0.0" },
          { name: "zenflow_last_active", value: "2026-06-17" },
          { name: "zenflow-last-weekly-report", value: "2026-06-17T12:00:00.000Z" },
          { name: "zenflow-orb-first-run-dismissed", value: "1" },
          { name: "zenflow-privacy-acknowledged", value: JSON.stringify(true) },
          {
            name: "zenflow-privacy",
            value: JSON.stringify({ analytics: false, consentShown: true, noTracking: false }),
          },
          {
            name: "zenflow_onboarding_state",
            value: JSON.stringify({
              daysActive: 5,
              firstLoginDate: Date.parse("2026-06-12T12:00:00.000Z"),
              hasSeenWelcome: true,
              isNewUser: false,
              lastActiveDate: "2026-06-17",
              unlockedFeatures: [],
            }),
          },
          { name: "zenflow-theme", value: "light" },
          { name: "zenflow_oled_mode", value: "false" },
          { name: "zenflow:theme-v0c", value: JSON.stringify({ state: { theme: "paper" }, version: 0 }) },
        ],
      },
    ],
  },
});

const IOS_TOUCH_TARGET_PX = 44;
const TOUCH_EPSILON_PX = 0.01;

async function freezePageTime(page: Page, isoTimestamp: string) {
  await page.addInitScript(
    `(() => {
      const OriginalDate = Date;
      const fixedNow = new OriginalDate(${JSON.stringify(isoTimestamp)}).getTime();
      class FixedDate extends OriginalDate {
        constructor(...args) {
          if (args.length === 0) {
            super(fixedNow);
            return;
          }
          super(...args);
        }

        static now() {
          return fixedNow;
        }
      }
      FixedDate.parse = OriginalDate.parse;
      FixedDate.UTC = OriginalDate.UTC;
      window.Date = FixedDate;
    })();`,
  );
}

async function expectFocusInsideMobileDiarySidebar(page: Page) {
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const drawer = document.querySelector('[data-testid="journal-mobile-diary-sidebar"]');
          return Boolean(drawer && document.activeElement && drawer.contains(document.activeElement));
        }),
      { message: "keyboard focus remains inside the mobile diary sidebar", timeout: 3_000 },
    )
    .toBe(true);
}

async function expectFocusInsideMobileDiarySettings(page: Page) {
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const sheet = document.querySelector('[data-testid="journal-mobile-settings-panel"]');
          return Boolean(sheet && document.activeElement && sheet.contains(document.activeElement));
        }),
      { message: "keyboard focus remains inside the mobile diary settings sheet", timeout: 3_000 },
    )
    .toBe(true);
}

async function expectIosTouchTarget(page: Page, locator: Locator) {
  await expect(locator).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(
      async () => {
        const currentBox = await locator.boundingBox();
        return currentBox ? Math.min(currentBox.width, currentBox.height) : 0;
      },
      { message: "iOS touch target reaches 44px", timeout: 4_000 },
    )
    .toBeGreaterThanOrEqual(IOS_TOUCH_TARGET_PX - TOUCH_EPSILON_PX);

  await expect
    .poll(
      async () => {
        const box = await locator.boundingBox();
        const viewport = page.viewportSize();
        if (!box || !viewport) return false;

        return (
          box.width + TOUCH_EPSILON_PX >= IOS_TOUCH_TARGET_PX &&
          box.height + TOUCH_EPSILON_PX >= IOS_TOUCH_TARGET_PX &&
          box.x >= 0 &&
          box.x + box.width <= viewport.width + 1 &&
          box.y >= 0 &&
          box.y + box.height <= viewport.height + 1
        );
      },
      {
        message: "iOS touch target settles fully inside the viewport",
        timeout: 4_000,
      },
    )
    .toBe(true);
}

async function ensureIosMobileToolsExpanded(page: Page) {
  const expandedTools = page.getByTestId("journal-mobile-tools");
  if (await expandedTools.isVisible()) return;

  const toolsButton = page.getByRole("button", { name: /^tools$/i });
  await expectIosTouchTarget(page, toolsButton);
  await toolsButton.click();
  await expect(expandedTools).toBeVisible();
}

function getIosDiaryWriteAction(page: Page): Locator {
  return page
    .getByTestId("journal-entry-main-fab")
    .or(page.getByRole("button", { name: /^New entry$/i }))
    .or(page.getByTestId("journal-capture-launcher"))
    .first();
}

async function expectPhoneDiaryWallpaper(page: Page, expectedTone: "day" | "night" = "day") {
  const wallpaper = page.getByTestId("journal-wallpaper");
  await expect(wallpaper).toHaveCount(1);
  await expect(wallpaper).toHaveAttribute("data-wallpaper-surface", "page");
  await expect(wallpaper).toHaveAttribute("data-wallpaper-tone", expectedTone);
  await expect(wallpaper).toHaveAttribute("data-wallpaper-motion", "static");
  await expect(wallpaper).toHaveAttribute("data-wallpaper-platform", "universal");

  const facts = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>("[data-testid='journal-page-shell']");
    const wallpaper = document.querySelector<HTMLElement>("[data-testid='journal-wallpaper']");
    const luminanceWash = document.querySelector<HTMLElement>(".journal-wallpaper__luminance-wash");
    const memoryBloom = document.querySelector<HTMLElement>(".journal-wallpaper__memory-bloom");
    if (!shell || !wallpaper || !luminanceWash || !memoryBloom) return null;

    const shellRect = shell.getBoundingClientRect();
    const wallpaperRect = wallpaper.getBoundingClientRect();
    const style = window.getComputedStyle(wallpaper);

    return {
      backgroundImage: style.backgroundImage,
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      luminanceWashOpacity: Number.parseFloat(window.getComputedStyle(luminanceWash).opacity),
      memoryBloomOpacity: Number.parseFloat(window.getComputedStyle(memoryBloom).opacity),
      pointerEvents: style.pointerEvents,
      shellHeight: shellRect.height,
      shellWidth: shellRect.width,
      wallpaperHeight: wallpaperRect.height,
      wallpaperWidth: wallpaperRect.width,
    };
  });

  expect(facts).not.toBeNull();
  expect(facts?.horizontalOverflow).toBeLessThanOrEqual(1);
  expect(facts?.backgroundImage).toContain("radial-gradient");
  expect(facts?.backgroundImage).not.toContain("url(");
  expect(facts?.memoryBloomOpacity).toBeGreaterThan(0);
  expect(facts?.luminanceWashOpacity).toBeGreaterThan(0);
  expect(facts?.pointerEvents).toBe("none");
  expect(facts?.wallpaperWidth).toBeGreaterThanOrEqual((facts?.shellWidth ?? 0) - 1);
  expect(facts?.wallpaperHeight).toBeGreaterThanOrEqual((facts?.shellHeight ?? 0) - 1);
}

async function openDiaryRoute(page: Page) {
  await page.goto(v2RoutePath("diary", { layout: "phone" }), { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("nav-v2-orchestrator")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("diary-page")).toBeVisible({ timeout: 30_000 });
}

async function openDayDiaryRoute(page: Page) {
  await freezePageTime(page, "2026-06-17T12:00:00.000Z");
  await openDiaryRoute(page);
}

async function openNightDiaryRoute(page: Page) {
  await freezePageTime(page, "2026-06-17T23:00:00.000Z");
  await page.addInitScript(() => {
    localStorage.setItem("zenflow-theme", "dark");
    localStorage.setItem("zenflow_oled_mode", "false");
    localStorage.setItem("zenflow:theme-v0c", JSON.stringify({ state: { theme: "ink" }, version: 0 }));
  });
  await openDiaryRoute(page);
}

async function openPaperNightDiaryRoute(page: Page) {
  await freezePageTime(page, "2026-06-18T02:00:00.000Z");
  await page.addInitScript(() => {
    localStorage.setItem("zenflow-theme", "light");
    localStorage.setItem("zenflow_oled_mode", "false");
    localStorage.setItem("zenflow:theme-v0c", JSON.stringify({ state: { theme: "paper" }, version: 0 }));
  });
  await openDiaryRoute(page);
}

async function openNewJournalEntry(page: Page) {
  const launcher = getIosDiaryWriteAction(page);
  await expect(launcher).toBeVisible({ timeout: 30_000 });
  const launcherTestId = await launcher.getAttribute("data-testid");
  await launcher.click();
  if (launcherTestId === "journal-entry-main-fab") {
    const newEntryAction = page.getByTestId("journal-fab-action-new-entry");
    await expect(newEntryAction).toBeVisible();
    await newEntryAction.click();
  }
  await expect(page.locator("[contenteditable='true']")).toBeVisible({ timeout: 20_000 });
}

test.describe("iOS V2 Diary", () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ browserName }) => {
    expect(browserName).toBe("webkit");
  });

  test("keeps the iOS diary shell tap-safe and unclipped", async ({ page }) => {
    await openDayDiaryRoute(page);

    await expectPhoneDiaryWallpaper(page);
    await expect(page.getByTestId("diary-page-ambience-control")).toHaveCount(0);
    await expect(page.getByTestId("diary-page-ambience-toggle")).toHaveCount(0);

    for (const id of [
      "journal-mobile-app-nav-menu",
      "journal-mobile-diary-sidebar-trigger",
      "journal-mobile-stats",
      "journal-mobile-favorites",
      "journal-mobile-settings",
    ]) {
      await expectIosTouchTarget(page, page.getByTestId(id));
    }
    await expectIosTouchTarget(page, getIosDiaryWriteAction(page));

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("opens the app drawer and diary-only sidebar drawer on iOS", async ({ page }) => {
    await openDayDiaryRoute(page);

    const appMenuButton = page.getByTestId("journal-mobile-app-nav-menu");
    await expectIosTouchTarget(page, appMenuButton);
    await appMenuButton.click();
    await expect(page.getByTestId("drawer-v2")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("drawer-v2-destination-habits")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("drawer-v2")).toHaveCount(0);

    const menuButton = page.getByTestId("journal-mobile-diary-sidebar-trigger");
    await expectIosTouchTarget(page, menuButton);
    await menuButton.click();

    const drawer = page.getByTestId("journal-mobile-diary-sidebar");
    await expect(drawer).toBeVisible({ timeout: 20_000 });
    await expect(drawer.getByTestId("journal-mobile-diary-sidebar-calendar")).toBeVisible();
    await expect(page.getByTestId("drawer-v2")).toHaveCount(0);
    await expectIosTouchTarget(page, page.getByTestId("journal-mobile-diary-sidebar-close"));
    await expect(page.getByTestId("journal-mobile-diary-sidebar-close")).toBeFocused();
    await expectFocusInsideMobileDiarySidebar(page);
    await page.keyboard.press("Shift+Tab");
    await expectFocusInsideMobileDiarySidebar(page);

    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
    await expect(menuButton).toBeFocused();

    await menuButton.click();
    const reopenedDrawer = page.getByTestId("journal-mobile-diary-sidebar");
    await expect(reopenedDrawer).toBeVisible({ timeout: 20_000 });
    await reopenedDrawer.getByRole("button", { name: /^Settings$/ }).click();
    const settingsDialog = page.getByRole("dialog", { name: /diary settings/i });
    await expect(settingsDialog).toBeVisible({ timeout: 20_000 });
    await expect(reopenedDrawer).toHaveCount(0);
    await expect(page.getByTestId("journal-mobile-settings-close")).toBeFocused();
    await expectFocusInsideMobileDiarySettings(page);
    await page.keyboard.press("Shift+Tab");
    await expectFocusInsideMobileDiarySettings(page);
    await page.getByTestId("journal-mobile-settings-close").click();
    await expect(settingsDialog).toHaveCount(0);
    await expect(menuButton).toBeFocused();
  });

  test("keeps iOS diary tab actions coherent", async ({ page }) => {
    await openDayDiaryRoute(page);

    await expectIosTouchTarget(page, page.getByTestId("journal-mobile-entry"));
    await expectIosTouchTarget(page, page.getByTestId("journal-mobile-stats"));
    await expectIosTouchTarget(page, page.getByTestId("journal-mobile-favorites"));
    await expectIosTouchTarget(page, page.getByTestId("journal-mobile-settings"));

    await page.getByTestId("journal-mobile-favorites").click();
    await expect(page.getByTestId("journal-favorites-panel")).toBeVisible();
    await page.getByTestId("journal-mobile-entry").click();
    await expect(page.getByTestId("journal-favorites-panel")).toHaveCount(0);
  });

  test("serves the iOS diary ambience audio from the native bundle", async ({ page }) => {
    await openDayDiaryRoute(page);
    await page.getByTestId("journal-mobile-settings").click();
    await expect(page.getByTestId("journal-mobile-settings-panel")).toBeVisible({ timeout: 20_000 });
    const ambienceControl = page.getByTestId("journal-settings-ambience-control");
    await ambienceControl.scrollIntoViewIfNeeded();
    await expect(ambienceControl).toBeVisible();

    const audioSrc = await page
      .getByTestId("journal-settings-ambience-audio")
      .evaluate((audio: HTMLAudioElement) => audio.currentSrc || audio.src);
    const result = await page.evaluate(async (src) => {
      const response = await fetch(src, { cache: "no-store" });
      return {
        bytes: (await response.arrayBuffer()).byteLength,
        contentType: response.headers.get("content-type") || "",
        status: response.status,
      };
    }, audioSrc);

    expect(result.status).toBe(200);
    expect(result.contentType).toContain("audio/");
    expect(result.bytes).toBeGreaterThan(1024);
  });

  test("renders the iOS night diary wallpaper without losing the static WebKit contract", async ({
    page,
  }) => {
    await openNightDiaryRoute(page);

    await expectPhoneDiaryWallpaper(page, "night");
  });

  test("renders the iOS paper diary wallpaper in natural night hours", async ({
    page,
  }) => {
    await openPaperNightDiaryRoute(page);

    await expectPhoneDiaryWallpaper(page, "night");
  });

  test("creates a local diary entry without hiding the iOS save path", async ({ page }) => {
    await openDayDiaryRoute(page);

    await openNewJournalEntry(page);

    const editor = page.locator("[contenteditable='true']");
    await editor.fill("iOS diary e2e entry should save cleanly.");

    const saveButton = page.getByRole("button", {
      name: /^(save|зберегти|guardar|speichern|保存|حفظ|שמור)$/i,
    });
    await expectIosTouchTarget(page, saveButton);
    await saveButton.click();

    await expect(page.getByText("iOS diary e2e entry should save cleanly.")).toBeVisible({ timeout: 30_000 });
    await expect(editor).toBeHidden({ timeout: 10_000 });
  });

  test("reveals shielded text again and lets the user leave an unsaved iOS entry", async ({ page }) => {
    await openDayDiaryRoute(page);
    await openNewJournalEntry(page);

    const editor = page.locator("[contenteditable='true']");
    await editor.fill("Private text must become readable again.");

    const privacyShield = page.getByRole("button", { name: /^screen shield$/i });
    await expectIosTouchTarget(page, privacyShield);
    await privacyShield.click();
    await expect(privacyShield).toHaveAttribute("aria-pressed", "true");
    await expect(editor).toHaveClass(/privacy-blurred/);

    await privacyShield.click();
    await expect(privacyShield).toHaveAttribute("aria-pressed", "false");
    await expect(editor).not.toHaveClass(/privacy-blurred/);
    await expect(editor).toContainText("Private text must become readable again.");

    await privacyShield.evaluate((button) => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await expect(privacyShield).toHaveAttribute("aria-pressed", "false");
    await expect(editor).not.toHaveClass(/privacy-blurred/);

    await privacyShield.evaluate((button) => {
      for (let index = 0; index < 3; index += 1) {
        button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }
    });
    await expect(privacyShield).toHaveAttribute("aria-pressed", "true");
    await expect(editor).toHaveClass(/privacy-blurred/);

    await privacyShield.click();
    await expect(privacyShield).toHaveAttribute("aria-pressed", "false");
    await expect(editor).not.toHaveClass(/privacy-blurred/);

    const backButton = page.getByRole("button", { name: /^back$/i });
    await expectIosTouchTarget(page, backButton);
    await backButton.click();

    const unsavedDialog = page.getByRole("alertdialog", { name: /unsaved changes/i });
    await expect(unsavedDialog).toBeVisible();
    await unsavedDialog.getByRole("button", { name: /^keep writing$/i }).click();
    await expect(unsavedDialog).toHaveCount(0);
    await expect(editor).toContainText("Private text must become readable again.");

    await backButton.click();
    await expect(unsavedDialog).toBeVisible();
    await unsavedDialog.getByRole("button", { name: /^discard changes$/i }).click();
    await expect(editor).toHaveCount(0);
    await expect(page.getByTestId("journal-mobile-entry")).toBeFocused();

    const appMenuButton = page.getByTestId("journal-mobile-app-nav-menu");
    await expectIosTouchTarget(page, appMenuButton);
    await appMenuButton.click();
    await expect(page.getByTestId("drawer-v2-destination-habits")).toBeVisible();
  });

  test("saves an unsaved iOS entry from the exit dialog before leaving", async ({ page }) => {
    await openDayDiaryRoute(page);
    await openNewJournalEntry(page);

    const editor = page.locator("[contenteditable='true']");
    await editor.fill("Exit dialog save must keep this iOS diary text.");

    const backButton = page.getByRole("button", { name: /^back$/i });
    await backButton.click();

    const unsavedDialog = page.getByRole("alertdialog", { name: /unsaved changes/i });
    await expect(unsavedDialog).toBeVisible();
    await unsavedDialog.getByRole("button", { name: /^save & close$/i }).click();

    await expect(editor).toHaveCount(0);
    await expect(page.getByText("Exit dialog save must keep this iOS diary text.")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("journal-mobile-entry")).toBeFocused();
  });

  test("reveals a concealed diary and keeps a safe iOS exit path when persistence fails", async ({ page }) => {
    await page.addInitScript(() => {
      const privateModeKey = "journal_private_mode";
      localStorage.setItem(privateModeKey, "true");
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function setItem(key: string, value: string) {
        if (key === privateModeKey) {
          throw new DOMException("Storage unavailable in this test", "QuotaExceededError");
        }
        return originalSetItem.call(this, key, value);
      };
    });

    await openDayDiaryRoute(page);
    await page.getByTestId("journal-mobile-settings").click();

    const settingsPanel = page.getByTestId("journal-mobile-settings-panel");
    const privateModeSwitch = settingsPanel.getByRole("switch", {
      name: /^conceal diary list$/i,
    });
    await expect(privateModeSwitch).toBeChecked();
    await privateModeSwitch.click();

    await expect(privateModeSwitch).not.toBeChecked();
    await expect(settingsPanel.getByRole("alert")).toContainText(
      /entries are visible now.*choice may reset.*check it again/i,
    );
    expect(await page.evaluate(() => localStorage.getItem("journal_private_mode"))).toBe("true");

    await page.getByTestId("journal-mobile-settings-close").click();
    const storageWarning = page.getByTestId("offline-banner");
    await expect(storageWarning).toBeVisible();
    const dismissWarning = storageWarning.getByRole("button", { name: /^dismiss$/i });
    await expectIosTouchTarget(page, dismissWarning);
    await dismissWarning.click();
    await expect(storageWarning).toHaveCount(0);

    const appMenuButton = page.getByTestId("journal-mobile-app-nav-menu");
    await expectIosTouchTarget(page, appMenuButton);
    await appMenuButton.click();
    await expect(page.getByTestId("drawer-v2-destination-habits")).toBeVisible();
  });

  test("opens iOS media and settings surfaces without overlap", async ({ page }) => {
    await openDayDiaryRoute(page);

    await openNewJournalEntry(page);

    const editor = page.locator("[contenteditable='true']");
    await editor.fill("iOS media surface should close and save cleanly.");

    await ensureIosMobileToolsExpanded(page);
    const photoButton = page.getByRole("button", { name: /^photo$/i }).first();
    await expectIosTouchTarget(page, photoButton);
    const chooserPromise = page.waitForEvent("filechooser", { timeout: 5_000 });
    await photoButton.click();
    const chooser = await chooserPromise;
    await chooser.setFiles(JOURNAL_PHOTO_FIXTURE);
    await expect(page.getByRole("dialog", { name: /photo picker/i })).toHaveCount(0);
    const placePhotoButton = page.getByRole("button", { name: /^place on page$/i });
    await expectIosTouchTarget(page, placePhotoButton);
    await placePhotoButton.click();
    await expect(page.locator("[data-floating-photo-id]").first()).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", {
      name: /^(save|зберегти|guardar|speichern|保存|حفظ|שמור)$/i,
    }).click();
    await expect(page.getByText("iOS media surface should close and save cleanly.")).toBeVisible({ timeout: 30_000 });
    await expect(editor).toBeHidden({ timeout: 10_000 });

    await page.getByTestId("journal-mobile-settings").click();
    const settingsDialog = page.getByRole("dialog", { name: /diary settings/i });
    await expect(settingsDialog).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("diary-page-ambience-control")).toHaveCount(0);
    await expectIosTouchTarget(page, settingsDialog.getByRole("button", { name: /^close$/i }));
    await page.keyboard.press("Escape");
    await expect(settingsDialog).toHaveCount(0);
  });

  test("reserves iOS home-indicator space in the memory portal", async ({ page }) => {
    await openDayDiaryRoute(page);

    await page.addStyleTag({ content: ":root { --zenflow-test-nav-inset-bottom: 34px; }" });
    await page.getByTestId("journal-mobile-stats").click();
    await expect(page.getByTestId("memory-portal-canvas")).toBeVisible({ timeout: 30_000 });

    await expect
      .poll(
        async () =>
          page
            .getByTestId("memory-portal-canvas")
            .evaluate((element) => Number.parseFloat(window.getComputedStyle(element).paddingBottom)),
        { message: "memory portal applies iOS home-indicator reserve", timeout: 4_000 },
      )
      .toBeGreaterThanOrEqual(34);

    await expectIosTouchTarget(page, page.getByTestId("memory-portal-core"));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
