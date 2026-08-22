import { expect, test, type Locator, type Page } from "@playwright/test";

import { primeZenflowV2, v2RoutePath } from "./helpers/zenflowV2State";

const ANDROID_TOUCH_TARGET_PX = 48;
const TOUCH_EPSILON_PX = 0.01;

const STARTUP_SCENARIOS: Record<string, { now: string; theme: "ink" | "paper" }> = {
  "renders the Android night diary wallpaper without losing the static platform contract": {
    now: "2026-06-17T23:00:00.000Z",
    theme: "ink",
  },
  "renders the Android paper diary wallpaper in natural night hours": {
    now: "2026-06-18T02:00:00.000Z",
    theme: "paper",
  },
};

test.use({ timezoneId: "UTC" });

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

async function expectAndroidTouchTarget(
  page: Page,
  locator: Locator,
  options: { requireInViewport?: boolean } = {},
) {
  await expect(locator).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(
      async () => {
        const currentBox = await locator.boundingBox();
        return currentBox ? Math.min(currentBox.width, currentBox.height) : 0;
      },
      { message: "Android touch target reaches 48px", timeout: 4_000 },
    )
    .toBeGreaterThanOrEqual(ANDROID_TOUCH_TARGET_PX - TOUCH_EPSILON_PX);

  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (!box || !viewport) return;

  expect(box.width + TOUCH_EPSILON_PX).toBeGreaterThanOrEqual(ANDROID_TOUCH_TARGET_PX);
  expect(box.height + TOUCH_EPSILON_PX).toBeGreaterThanOrEqual(ANDROID_TOUCH_TARGET_PX);
  if (options.requireInViewport !== false) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
  }
}

async function expectAllVisibleAndroidTouchTargets(page: Page, container: Locator) {
  const controls = container.locator(
    'button, [role="button"], a[href], input:not([type="hidden"]), select, textarea',
  );
  const count = await controls.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index);
    if (!(await control.isVisible())) continue;

    const isFullyWithinViewport = await control.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left >= 0
        && rect.top >= 0
        && rect.right <= window.innerWidth
        && rect.bottom <= window.innerHeight;
    });
    await expectAndroidTouchTarget(page, control, { requireInViewport: isFullyWithinViewport });
  }
}

function getAndroidDiaryWriteAction(page: Page): Locator {
  return page
    .getByTestId("journal-entry-main-fab")
    .or(page.getByRole("button", { name: /^New entry$/i }))
    .or(page.getByTestId("journal-capture-launcher"))
    .first();
}

async function openAndroidJournalEntry(page: Page) {
  const launcher = getAndroidDiaryWriteAction(page);
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

async function openDiaryFromV2Root(page: Page) {
  await page.goto(v2RoutePath("orb", { layout: "phone" }), { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("nav-v2-orchestrator")).toBeVisible({ timeout: 30_000 });

  const drawerButton = page.getByTestId("nav-v2-open-drawer");
  if (await drawerButton.isVisible()) {
    await drawerButton.click();
    const drawer = page.getByTestId("drawer-v2");
    await expect(drawer).toBeVisible({ timeout: 10_000 });
    const diaryDestination = drawer.getByTestId("drawer-v2-destination-diary");
    await expect(diaryDestination).toBeVisible({ timeout: 10_000 });
    await diaryDestination.click();
  } else {
    await page.getByTestId("sidebar-v2").getByRole("button", { name: /^Diary$/ }).click();
  }

  await expect(page.getByTestId("diary-page")).toBeVisible({ timeout: 30_000 });
}

test.describe("Android V2 Diary", () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ page }, testInfo) => {
    const startup = STARTUP_SCENARIOS[testInfo.title] ?? {
      now: "2026-06-17T12:00:00.000Z",
      theme: "paper" as const,
    };

    await page.clock.setFixedTime(new Date(startup.now));
    await primeZenflowV2(page, { clearStorage: true, language: "en", theme: startup.theme });
    await page.setViewportSize({ width: 399, height: 869 });
    await openDiaryFromV2Root(page);
    await page.evaluate(() => {
      document.documentElement.dataset.platform = "android";
    });
    await expect(page.locator("html")).toHaveAttribute("data-platform", "android");
  });

  test("keeps the Android diary shell tap-safe and unclipped", async ({ page }) => {
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
      await expectAndroidTouchTarget(page, page.getByTestId(id));
    }
    await expectAndroidTouchTarget(page, getAndroidDiaryWriteAction(page));

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("opens the app drawer and diary-only sidebar drawer on Android", async ({ page }) => {
    const appMenuButton = page.getByTestId("journal-mobile-app-nav-menu");
    await expectAndroidTouchTarget(page, appMenuButton);
    await appMenuButton.click();
    await expect(page.getByTestId("drawer-v2")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("drawer-v2-destination-habits")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("drawer-v2")).toHaveCount(0);

    const menuButton = page.getByTestId("journal-mobile-diary-sidebar-trigger");
    await expectAndroidTouchTarget(page, menuButton);
    await menuButton.click();

    const drawer = page.getByTestId("journal-mobile-diary-sidebar");
    await expect(drawer).toBeVisible({ timeout: 20_000 });
    await expect(drawer.getByTestId("journal-mobile-diary-sidebar-calendar")).toBeVisible();
    await expect(page.getByTestId("drawer-v2")).toHaveCount(0);
    await expectAndroidTouchTarget(page, page.getByTestId("journal-mobile-diary-sidebar-close"));
    await expectAllVisibleAndroidTouchTargets(page, drawer);
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
    await expectAllVisibleAndroidTouchTargets(page, settingsDialog);
    await expectFocusInsideMobileDiarySettings(page);
    await page.keyboard.press("Shift+Tab");
    await expectFocusInsideMobileDiarySettings(page);
    await page.getByTestId("journal-mobile-settings-close").click();
    await expect(settingsDialog).toHaveCount(0);
    await expect(menuButton).toBeFocused();
  });

  test("keeps Android diary tab actions coherent", async ({ page }) => {
    await expectAndroidTouchTarget(page, page.getByTestId("journal-mobile-entry"));
    await expectAndroidTouchTarget(page, page.getByTestId("journal-mobile-stats"));
    await expectAndroidTouchTarget(page, page.getByTestId("journal-mobile-favorites"));
    await expectAndroidTouchTarget(page, page.getByTestId("journal-mobile-settings"));

    await page.getByTestId("journal-mobile-favorites").click();
    await expect(page.getByTestId("journal-favorites-panel")).toBeVisible();
    await page.getByTestId("journal-mobile-entry").click();
    await expect(page.getByTestId("journal-favorites-panel")).toHaveCount(0);
  });

  test("serves the Android diary ambience audio from the native bundle", async ({ page }) => {
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

  test("renders the Android night diary wallpaper without losing the static platform contract", async ({
    page,
  }) => {
    await expectPhoneDiaryWallpaper(page, "night");
  });

  test("renders the Android paper diary wallpaper in natural night hours", async ({
    page,
  }) => {
    await expectPhoneDiaryWallpaper(page, "night");
  });

  test("opens and dismisses Android diary action surfaces predictably", async ({ page }) => {
    await openAndroidJournalEntry(page);
    await page.keyboard.press("Escape");
    await expect(page.locator("[contenteditable='true']")).toBeHidden({ timeout: 10_000 });

    await page.getByTestId("journal-mobile-settings").click();
    const settingsDialog = page.getByRole("dialog", { name: /diary settings/i });
    await expect(settingsDialog).toBeVisible({ timeout: 20_000 });
    await expectAndroidTouchTarget(page, settingsDialog.getByRole("button", { name: /^close$/i }));

    await page.keyboard.press("Escape");
    await expect(settingsDialog).toHaveCount(0);
  });

  test("creates a local diary entry without hiding the save path on Android", async ({ page }) => {
    await openAndroidJournalEntry(page);

    const editor = page.locator("[contenteditable='true']");
    await expect(editor).toBeVisible({ timeout: 20_000 });
    await editor.fill("Android diary e2e entry should save cleanly.");

    const saveButton = page.getByRole("button", {
      name: /^(save|зберегти|guardar|speichern|保存|حفظ|שמור)$/i,
    });
    await expectAndroidTouchTarget(page, saveButton);
    await saveButton.click();

    await expect(page.getByText("Android diary e2e entry should save cleanly.")).toBeVisible({ timeout: 30_000 });
    await expect(editor).toBeHidden({ timeout: 10_000 });
  });

  test("keeps the screen shield reversible and the Android exit decision explicit", async ({
    page,
  }) => {
    await openAndroidJournalEntry(page);

    const editor = page.locator("[contenteditable='true']");
    await editor.fill("Android private text stays available until exit is confirmed.");

    const privacyShield = page.getByRole("button", { name: /^screen shield$/i });
    await expectAndroidTouchTarget(page, privacyShield);
    await privacyShield.evaluate((button) => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await expect(privacyShield).toHaveAttribute("aria-pressed", "false");
    await expect(editor).not.toHaveClass(/privacy-blurred/);
    await expect(editor).toContainText(
      "Android private text stays available until exit is confirmed.",
    );

    const backButton = page.getByRole("button", { name: /^back$/i });
    await expectAndroidTouchTarget(page, backButton);
    await backButton.click();

    const unsavedDialog = page.getByRole("alertdialog", { name: /unsaved changes/i });
    await expect(unsavedDialog).toBeVisible();
    await unsavedDialog.getByRole("button", { name: /^keep writing$/i }).click();
    await expect(editor).toContainText(
      "Android private text stays available until exit is confirmed.",
    );

    await backButton.click();
    await unsavedDialog.getByRole("button", { name: /^discard changes$/i }).click();
    await expect(editor).toHaveCount(0);
    await expect(page.getByTestId("journal-mobile-entry")).toBeFocused();

    const appMenuButton = page.getByTestId("journal-mobile-app-nav-menu");
    await expectAndroidTouchTarget(page, appMenuButton);
    await appMenuButton.click();
    await expect(page.getByTestId("drawer-v2-destination-habits")).toBeVisible();
  });
});
