/**
 * §11 #1 — 44×44 px touch-target Playwright smoke.
 *
 * Measures the rendered touch targets that matter in the CURRENT V2 flow:
 *   - empty-state quick-picks
 *   - first weekly cell after template setup
 *   - weekly-card statistics button
 *   - explicit weekly-card actions button and focus restoration
 */

import { test, expect, type Locator, type Page } from "@playwright/test";

import { primeZenflowV2, v2RoutePath } from "./helpers/zenflowV2State";

const MIN_TARGET_PX = 44;
const WEEKLY_CARD_SELECTOR = '[data-card="ritual-weekly-card"][data-testid^="hero-weekly-card-"]';

async function primeOnboarding(page: Page) {
  await primeZenflowV2(page, {
    clearStorage: true,
    language: "en",
    privacyNoTracking: true,
    theme: "paper",
  });
}

async function gotoHabitsTab(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(v2RoutePath("habits"));
  await expect(page.getByTestId("habits-page")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId("habits-hero-empty")).toBeVisible({
    timeout: 10_000,
  });
  await page.waitForTimeout(200);
}

async function completeTemplateSetup(page: Page, quickPickId: string) {
  await page.getByTestId(`hero-quickpick-${quickPickId}`).click();
  await expect(page.getByTestId("habits-create-sheet")).toBeVisible({ timeout: 10_000 });
  await page
    .getByTestId("habits-create-sheet")
    .locator(".overflow-y-auto")
    .first()
    .evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
  await page.getByRole("button", { name: /add habit/i }).evaluate((el) => {
    (el as HTMLButtonElement).click();
  });
  await expect(page.locator(WEEKLY_CARD_SELECTOR).first()).toBeVisible({
    timeout: 15_000,
  });
}

async function expandWeeklyCard(card: Locator) {
  await expect(card).toBeVisible({ timeout: 15_000 });
  if ((await card.getAttribute("data-collapsed")) === "true") {
    await card.locator('[data-slot="weekly-collapse"]').click();
  }
  await expect(card).toHaveAttribute("data-collapsed", "false");
}

async function openCustomHabitForm(page: Page) {
  await page.getByTestId("habits-hero-create-empty").click();
  const sheet = page.getByTestId("habits-create-sheet");
  await expect(sheet).toBeVisible({ timeout: 10_000 });

  const customButton = sheet.getByRole("button", { name: /create custom habit/i });
  await expect(customButton).toBeVisible({ timeout: 10_000 });
  await customButton.evaluate((el) => {
    (el as HTMLButtonElement).click();
  });

  await expect(sheet.getByRole("tab", { name: /advanced/i })).toBeVisible({ timeout: 10_000 });
  await expect(sheet.getByLabel(/habit name/i)).toBeVisible({ timeout: 10_000 });
}

async function openAdvancedMode(page: Page) {
  await openCustomHabitForm(page);
  const sheet = page.getByTestId("habits-create-sheet");
  const advancedTab = sheet.getByRole("tab", { name: /advanced/i });
  await expect(advancedTab).toBeVisible({ timeout: 10_000 });
  await advancedTab.evaluate((el) => {
    (el as HTMLButtonElement).click();
  });
  await expect(sheet.getByRole("tab", { name: /advanced/i })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator('[data-settings-panel="tracking"]')).toBeVisible({
    timeout: 10_000,
  });
}

async function openAdvancedMeasuredForm(page: Page) {
  await openAdvancedMode(page);
  await page.getByRole("button", { name: /measurable/i }).click();
  await expect(page.locator('[data-settings-panel="tracking"]')).toBeVisible({
    timeout: 10_000,
  });
}

/** Pure: assert rendered width AND height are ≥ 44 px each. */
async function expectTouchTarget(locator: Locator, label: string) {
  await expect(locator, `${label} is visible`).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${label} has a bounding box`).not.toBeNull();
  if (!box) return;
  expect(
    box.width,
    `${label} width=${box.width.toFixed(1)}px should be ≥ ${MIN_TARGET_PX}`,
  ).toBeGreaterThanOrEqual(MIN_TARGET_PX);
  expect(
    box.height,
    `${label} height=${box.height.toFixed(1)}px should be ≥ ${MIN_TARGET_PX}`,
  ).toBeGreaterThanOrEqual(MIN_TARGET_PX);
}

test.describe("§11 #1 — Habits touch targets ≥ 44×44 px", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test("every empty-journey quick-pick meets the threshold", async ({ page }) => {
    await primeOnboarding(page);
    await gotoHabitsTab(page);

    await expect(page.getByTestId("hero-quickpick-drink-water")).toBeVisible({
      timeout: 10_000,
    });
    const quickPicks = page.locator('[data-testid^="hero-quickpick-"]');
    const count = await quickPicks.count();
    expect(count, "at least one quick-pick rendered").toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      await expectTouchTarget(quickPicks.nth(i), `quick-pick #${i}`);
    }
  });

  test("weekly card touch targets meet the threshold after template setup", async ({
    page,
  }) => {
    await primeOnboarding(page);
    await gotoHabitsTab(page);

    await completeTemplateSetup(page, "exercise");

    const card = page.locator(WEEKLY_CARD_SELECTOR).first();
    await expandWeeklyCard(card);
    const weekCell = card.getByRole("checkbox").first();
    await expectTouchTarget(weekCell, "weekly cell toggle");

    const statsButton = card.getByRole("button", { name: /statistics/i }).first();
    await expectTouchTarget(statsButton, "weekly card statistics button");

    await page.setViewportSize({ width: 390, height: 844 });
    const actionsButton = card.locator('[data-slot="weekly-actions"]');
    await expectTouchTarget(actionsButton, "weekly card actions button");
    await expect(actionsButton).toHaveAttribute("aria-haspopup", "dialog");
    await expect(actionsButton).toHaveAccessibleName(/actions for/i);

    await actionsButton.focus();
    await page.keyboard.press("Enter");
    const actionSheet = page.getByRole("dialog", { name: /^actions$/i });
    await expect(actionSheet).toBeVisible();
    await expect
      .poll(() => actionSheet.evaluate((sheet) => sheet.contains(document.activeElement)))
      .toBe(true);

    await page.keyboard.press("Escape");
    await expect(actionSheet).toBeHidden();
    await expect(actionsButton).toBeFocused();

    await card.locator('[data-slot="weekly-collapse"]').click();
    await expect(card).toHaveAttribute("data-collapsed", "true");
    await expectTouchTarget(actionsButton, "collapsed weekly card actions button");
  });

  test("advanced setup navigation chips move focus to the matching section", async ({
    page,
  }) => {
    await primeOnboarding(page);
    await gotoHabitsTab(page);
    await page.setViewportSize({ width: 415, height: 697 });
    await openAdvancedMeasuredForm(page);

    const railButtons = page.locator("[data-advanced-rail-item]");
    await expect(railButtons).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      await expectTouchTarget(railButtons.nth(i), `advanced rail chip #${i}`);
    }
    await expect(page.locator("[data-settings-panel-content]")).toHaveCount(1);
    await expect(page.locator('[data-settings-panel-content="tracking"]')).toBeVisible();
    await expect(
      page.locator('[data-advanced-rail-item][data-advanced-jump="tracking"]'),
    ).toHaveAttribute("aria-expanded", "true");

    const scroller = page
      .getByTestId("habits-create-sheet")
      .locator(".overflow-y-auto")
      .first();
    const before = await scroller.evaluate((el) => el.scrollTop);

    await page
      .locator('[data-advanced-rail-item][data-advanced-jump="appearance"]')
      .click({ force: true });
    await expect(page.locator('[data-settings-panel="appearance"]')).toBeFocused();
    await page.waitForTimeout(600);
    await expect(page.locator("[data-settings-panel-content]")).toHaveCount(1);
    await expect(page.locator('[data-settings-panel-content="appearance"]')).toBeVisible();
    await expect(
      page.locator('[data-advanced-rail-item][data-advanced-jump="appearance"]'),
    ).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.locator('[data-advanced-rail-item][data-advanced-jump="tracking"]'),
    ).toHaveAttribute("aria-expanded", "false");
    const afterAppearance = await scroller.evaluate((el) => el.scrollTop);
    expect(afterAppearance).toBeGreaterThan(before);

    await page
      .locator('[data-advanced-rail-item][data-advanced-jump="identity"]')
      .click({ force: true });
    await expect(page.locator('[data-settings-panel-content="identity"]')).toBeVisible();

    await page
      .locator('[data-advanced-spec][data-advanced-jump="tracking"]')
      .first()
      .click({ force: true });
    await expect(page.locator('[data-settings-panel-content="tracking"]')).toBeVisible();
  });

  test("habit purpose survives creation and becomes proof on icon check-in", async ({
    page,
  }) => {
    await primeOnboarding(page);
    await gotoHabitsTab(page);
    await page.setViewportSize({ width: 415, height: 697 });
    await openAdvancedMode(page);

    await page.getByLabel(/habit name/i).fill("Morning walk");
    await page.locator('[data-advanced-rail-item][data-advanced-jump="identity"]').evaluate((el) => {
      (el as HTMLButtonElement).click();
    });
    await expect(page.locator('[data-settings-panel-content="identity"]')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("identity-vote-preview")).toBeVisible();
    await page.getByTestId("identity-cluster-input").fill("Healthy body");
    await page.getByTestId("identity-verb-input").fill("someone who moves daily");
    await expect(page.getByTestId("identity-vote-preview")).toContainText(
      "someone who moves daily",
    );

    const sheetScroller = page
      .getByTestId("habits-create-sheet")
      .locator(".overflow-y-auto")
      .first();
    await sheetScroller.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.getByRole("button", { name: /add habit/i }).evaluate((el) => {
      (el as HTMLButtonElement).click();
    });

    const card = page
      .locator(WEEKLY_CARD_SELECTOR)
      .filter({ hasText: "Morning walk" })
      .first();
    await expandWeeklyCard(card);
    await expect(card.locator('[data-testid$="-identity"]')).toContainText(
      "Step toward someone who moves daily",
    );
    await expect(card.locator('[data-testid$="-identity-vote"]')).toContainText(
      "ready to mark",
    );

    await card.locator('[data-testid$="-icon-check"]').click();
    await expect(card.locator('[data-testid$="-identity-vote"]')).toContainText(
      "step logged",
    );
  });
});
