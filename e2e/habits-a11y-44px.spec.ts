/**
 * §11 #1 — 44×44 px touch-target Playwright smoke.
 *
 * Converts habits-tab-spec §11 item #1 from 🟡 (static class assertion only)
 * to ✅ (real rendered pixel dimensions in chromium) by measuring the
 * bounding box of every critical interactive element on /habits.
 *
 * Law 9 (A11y) — all touch targets ≥ 44×44 px. Apple HIG + WCAG AA 2.5.5.
 *
 * The onboarding-prime block mirrors `habits-metrics.spec.ts` so the page
 * lands on the Habits hero zone rather than the welcome flow. We do NOT
 * seed analytics — this test is presentational and does not care about
 * gtag traffic.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };

const MIN_TARGET_PX = 44;

async function primeOnboarding(page: Page) {
  await page.addInitScript(
    ({ appVersion }: { appVersion: string }) => {
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
  await page.goto("/?nav=v2");
  await expect(page.getByTestId("nav-v2-orchestrator")).toBeVisible({
    timeout: 15_000,
  });
  await page.keyboard.press("Control+2");
  await expect(page.getByTestId("habits-hero-empty")).toBeVisible({
    timeout: 10_000,
  });
  await page.waitForTimeout(200);
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

    const quickPicks = page.locator('[data-testid^="hero-quickpick-"]');
    const count = await quickPicks.count();
    expect(count, "at least one quick-pick rendered").toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      await expectTouchTarget(quickPicks.nth(i), `quick-pick #${i}`);
    }
  });

  test("complete toggle + ⋯ menu trigger meet the threshold after seeding", async ({
    page,
  }) => {
    await primeOnboarding(page);
    await gotoHabitsTab(page);

    // Seed one habit from quick-pick so the hero row + its affordances render.
    await page.locator('[data-testid^="hero-quickpick-"]').first().click();

    const row = page.locator('[data-testid^="hero-habit-row-"]').first();
    await expect(row).toBeVisible({ timeout: 10_000 });

    // V1 CompactHabitCard exposes the toggle via aria-label "<name>: Mark complete".
    const toggle = page
      .getByRole("button", { name: /mark complete/i })
      .first();
    await expectTouchTarget(toggle, "complete toggle button");

    // HabitActionsMenu trigger: data-testid ends with "-menu" (content/items
    // have further suffixes like "-menu-content" / "-menu-skip").
    const menuTrigger = page
      .locator(
        '[data-testid^="hero-habit-row-"][data-testid$="-menu"]:not([data-testid$="-menu-content"])',
      )
      .first();
    await expectTouchTarget(menuTrigger, "⋯ menu trigger");
  });
});
