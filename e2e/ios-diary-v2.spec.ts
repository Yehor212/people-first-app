import { expect, test, type Locator, type Page } from "@playwright/test";

import { primeZenflowV2, v2RoutePath } from "./helpers/zenflowV2State";

test.use({
  browserName: "webkit",
  deviceScaleFactor: 3,
  hasTouch: true,
  ignoreHTTPSErrors: true,
  isMobile: true,
});

const IOS_TOUCH_TARGET_PX = 44;
const TOUCH_EPSILON_PX = 0.01;

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

  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (!box || !viewport) return;

  expect(box.width + TOUCH_EPSILON_PX).toBeGreaterThanOrEqual(IOS_TOUCH_TARGET_PX);
  expect(box.height + TOUCH_EPSILON_PX).toBeGreaterThanOrEqual(IOS_TOUCH_TARGET_PX);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
}

async function openDiaryFromV2Root(page: Page) {
  await page.goto(v2RoutePath("orb", { layout: "phone" }), { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("nav-v2-orchestrator")).toBeVisible({ timeout: 30_000 });

  const drawerButton = page.getByTestId("nav-v2-open-drawer");
  if (await drawerButton.isVisible()) {
    await drawerButton.click();
    await expect(page.getByTestId("drawer-v2-destination-diary")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("drawer-v2-destination-diary").click();
  } else {
    await page.getByTestId("sidebar-v2").getByRole("button", { name: /^Diary$/ }).click();
  }

  await expect(page.getByTestId("diary-page")).toBeVisible({ timeout: 30_000 });
}

async function openNewJournalEntry(page: Page) {
  await expect(page.getByTestId("journal-entry-main-fab")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("journal-entry-main-fab").click();
  await expect(page.getByTestId("journal-fab-action-new-entry")).toBeVisible();
  await page.getByTestId("journal-fab-action-new-entry").click();
  await expect(page.locator("[contenteditable='true']")).toBeVisible({ timeout: 20_000 });
}

test.describe("iOS V2 Diary", () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ browserName, page }) => {
    expect(browserName).toBe("webkit");
    await primeZenflowV2(page, { language: "en", theme: "paper" });
    await page.setViewportSize({ width: 390, height: 844 });
    await openDiaryFromV2Root(page);
  });

  test("keeps the iOS diary shell tap-safe and unclipped", async ({ page }) => {
    for (const id of ["journal-mobile-nav-menu", "journal-mobile-stats", "journal-mobile-settings"]) {
      await expectIosTouchTarget(page, page.getByTestId(id));
    }
    await expectIosTouchTarget(page, page.getByTestId("journal-entry-main-fab"));

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("creates a local diary entry without hiding the iOS save path", async ({ page }) => {
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

  test("opens iOS media and settings surfaces without overlap", async ({ page }) => {
    await openNewJournalEntry(page);

    const editor = page.locator("[contenteditable='true']");
    await editor.fill("iOS media surface should close and save cleanly.");

    const photoButton = page.getByRole("button", { name: /^photo$/i }).first();
    await expectIosTouchTarget(page, photoButton);
    await photoButton.click();
    const photoDialog = page.getByRole("dialog", { name: /photo picker/i });
    await expect(photoDialog).toBeVisible();
    await expectIosTouchTarget(page, photoDialog.getByRole("button", { name: /from gallery/i }));
    await expectIosTouchTarget(page, photoDialog.getByRole("button", { name: /^close$/i }));
    await page.keyboard.press("Escape");
    await expect(photoDialog).toHaveCount(0);

    await page.getByRole("button", {
      name: /^(save|зберегти|guardar|speichern|保存|حفظ|שמור)$/i,
    }).click();
    await expect(page.getByText("iOS media surface should close and save cleanly.")).toBeVisible({ timeout: 30_000 });
    await expect(editor).toBeHidden({ timeout: 10_000 });

    await page.getByTestId("journal-mobile-settings").click();
    const settingsDialog = page.getByRole("dialog", { name: /diary settings/i });
    await expect(settingsDialog).toBeVisible({ timeout: 20_000 });
    await expectIosTouchTarget(page, settingsDialog.getByRole("button", { name: /^close$/i }));
    await page.keyboard.press("Escape");
    await expect(settingsDialog).toHaveCount(0);
  });

  test("reserves iOS home-indicator space in the memory portal", async ({ page }) => {
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
