import { expect, test, type Locator, type Page } from "@playwright/test";

import { primeZenflowV2, v2RoutePath } from "./helpers/zenflowV2State";

const ANDROID_TOUCH_TARGET_PX = 48;
const TOUCH_EPSILON_PX = 0.01;

async function expectAndroidTouchTarget(page: Page, locator: Locator) {
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

test.describe("Android V2 Diary", () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ page }) => {
    await primeZenflowV2(page, { language: "en", theme: "paper" });
    await page.setViewportSize({ width: 399, height: 869 });
    await openDiaryFromV2Root(page);
  });

  test("keeps the Android diary shell tap-safe and unclipped", async ({ page }) => {
    for (const id of ["journal-mobile-nav-menu", "journal-mobile-stats", "journal-mobile-settings"]) {
      await expectAndroidTouchTarget(page, page.getByTestId(id));
    }
    await expectAndroidTouchTarget(page, page.getByTestId("journal-entry-main-fab"));

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("opens and dismisses Android diary action surfaces predictably", async ({ page }) => {
    await page.getByTestId("journal-entry-main-fab").click();
    await expectAndroidTouchTarget(page, page.getByTestId("journal-fab-action-new-entry"));
    await expectAndroidTouchTarget(page, page.getByTestId("journal-fab-action-gratitude"));

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("journal-fab-action-new-entry")).toHaveCount(0);

    await page.getByTestId("journal-mobile-settings").click();
    const settingsDialog = page.getByRole("dialog", { name: /diary settings/i });
    await expect(settingsDialog).toBeVisible({ timeout: 20_000 });
    await expectAndroidTouchTarget(page, settingsDialog.getByRole("button", { name: /^close$/i }));

    await page.keyboard.press("Escape");
    await expect(settingsDialog).toHaveCount(0);
  });

  test("creates a local diary entry without hiding the save path on Android", async ({ page }) => {
    await page.getByTestId("journal-entry-main-fab").click();
    await page.getByTestId("journal-fab-action-new-entry").click();

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
});
