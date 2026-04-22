/**
 * §11 #1 — 44×44 px touch-target Playwright smoke.
 *
 * Measures the rendered touch targets that matter in the CURRENT V2 flow:
 *   - empty-state quick-picks
 *   - first weekly cell after template setup
 *   - weekly-card statistics button
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };

const MIN_TARGET_PX = 44;

function getAppBasePath(page: Page) {
  const { pathname } = new URL(page.url());
  return pathname === "/" ? "" : pathname.replace(/\/$/, "");
}

async function primeOnboarding(page: Page) {
  await page.goto("/?nav=v2");
  await page.evaluate(
    async ({ appVersion }: { appVersion: string }) => {
      const deleteDatabase = (name: string) =>
        new Promise<void>((resolve) => {
          const request = indexedDB.deleteDatabase(name);
          request.onsuccess = () => resolve();
          request.onerror = () => resolve();
          request.onblocked = () => resolve();
        });

      localStorage.clear();
      sessionStorage.clear();
      try {
        const databases =
          typeof indexedDB.databases === "function" ? await indexedDB.databases() : [];
        await Promise.all(
          (databases ?? [])
            .map((db) => db.name)
            .filter((name): name is string => Boolean(name))
            .map(deleteDatabase),
        );
      } catch {
        /* some browsers may not expose indexedDB.databases */
      }
      localStorage.setItem("zenflow-language", JSON.stringify("en"));
      localStorage.setItem("zenflow-language-selected", JSON.stringify(true));
      localStorage.setItem("zenflow-google-auth-checked", JSON.stringify(true));
      localStorage.setItem("zenflow-tutorial-complete", JSON.stringify(true));
      localStorage.setItem("zenflow-onboarding-complete", JSON.stringify(true));
      localStorage.setItem(
        "zenflow-notification-permission-checked",
        JSON.stringify(true),
      );
      localStorage.setItem(
        "zenflow_onboarding_state",
        JSON.stringify({
          isNewUser: false,
          hasSeenWelcome: true,
          firstLoginDate: Date.now(),
          daysActive: 5,
          lastActiveDate: new Date().toISOString().split("T")[0],
          unlockedFeatures: [],
        }),
      );
      localStorage.setItem("zenflow_last_seen_version", appVersion);
      localStorage.setItem("zenflow-orb-first-run-dismissed", "1");
      localStorage.setItem("zenflow-theme", "light");
      localStorage.setItem(
        "zenflow-privacy",
        JSON.stringify({
          noTracking: true,
          analytics: false,
          consentShown: true,
        }),
      );
      localStorage.setItem("zenflow-privacy-acknowledged", JSON.stringify(true));
    },
    { appVersion: packageJson.version },
  );
}

async function gotoHabitsTab(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  const appBase = getAppBasePath(page);
  await page.goto(`${appBase}/habits?nav=v2`);
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
  await page.getByRole("button", { name: /add habit/i }).click();
  await expect(page.getByTestId("habits-create-sheet")).not.toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-testid^="hero-weekly-card-"]').first()).toBeVisible({
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

    await expect(page.getByTestId("hero-quickpick-water")).toBeVisible({ timeout: 10_000 });
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

    await completeTemplateSetup(page, "breathwork");

    const card = page.locator('[data-testid^="hero-weekly-card-"]').first();
    const weekCell = card.getByRole("checkbox").first();
    await expectTouchTarget(weekCell, "weekly cell toggle");

    const statsButton = card.getByRole("button", { name: /statistics/i }).first();
    await expectTouchTarget(statsButton, "weekly card statistics button");
  });
});
