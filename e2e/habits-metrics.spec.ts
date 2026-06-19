/**
 * §15 success-metrics Playwright smoke — real browser, real gtag.
 *
 * Covers instrumented emitters through the CURRENT V2 user flow:
 *  - habit_created          (quick-pick -> setup sheet -> save template habit)
 *  - habit_completed        (weekly cell interaction on the saved card)
 *  - habit_detail_opened    (tap Statistics on the weekly card)
 *  - insight_strip_rendered (dev-server only: source-module interception)
 */

import { test, expect, type Page } from "@playwright/test";

import { primeZenflowV2, v2RoutePath } from "./helpers/zenflowV2State";

type GtagArgs = unknown[];

const WEEKLY_CARD_SELECTOR = '[data-card="ritual-weekly-card"][data-testid^="hero-weekly-card-"]';

const CAN_INTERCEPT_VITE_SOURCE_MODULES =
  process.env.ZENFLOW_PLAYWRIGHT_USE_LOCAL_SERVER === "true" && process.env.CI !== "true";

async function primeForMetrics(page: Page) {
  await primeZenflowV2(page, {
    analytics: true,
    clearStorage: true,
    language: "en",
    theme: "paper",
  });
  await page.addInitScript(() => {
    try {
      performance.setResourceTimingBufferSize(5000);
    } catch {
      /* safe no-op */
    }

    (window as unknown as { __gtagCalls: GtagArgs[] }).__gtagCalls = [];
    (window as unknown as { gtag: (...args: GtagArgs) => void }).gtag = (
      ...args: GtagArgs
    ) => {
      (window as unknown as { __gtagCalls: GtagArgs[] }).__gtagCalls.push(args);
    };
  });
}

async function installGtagSpy(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { __gtagCalls: GtagArgs[] }).__gtagCalls = [];
    (window as unknown as { gtag: (...args: GtagArgs) => void }).gtag = (
      ...args: GtagArgs
    ) => {
      (window as unknown as { __gtagCalls: GtagArgs[] }).__gtagCalls.push(args);
    };
  });
}

async function readGtagCalls(page: Page): Promise<GtagArgs[]> {
  return page.evaluate(
    () =>
      (window as unknown as { __gtagCalls: GtagArgs[] }).__gtagCalls.slice(),
  );
}

async function waitForGtagEvent(page: Page, eventName: string): Promise<GtagArgs> {
  await expect
    .poll(async () => {
      const calls = await readGtagCalls(page);
      return calls.some(
        (call) =>
          Array.isArray(call) && call[0] === "event" && call[1] === eventName,
      );
    }, {
      timeout: 10_000,
    })
    .toBe(true);

  const calls = await readGtagCalls(page);
  return (
    calls.find(
      (call) =>
        Array.isArray(call) && call[0] === "event" && call[1] === eventName,
    ) ?? []
  );
}

function getEventPayload(evt: GtagArgs): Record<string, unknown> {
  const payload = evt[2];
  return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
}

async function gotoHabitsTab(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(v2RoutePath("habits"));
  await expect(page.getByTestId("habits-page")).toBeVisible({ timeout: 15_000 });
  await installGtagSpy(page);
  await expect(page.getByTestId("habits-hero-empty")).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(400);
}

async function completeTemplateSetup(
  page: import("@playwright/test").Page,
  quickPickId: string,
) {
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

async function expandWeeklyCard(card: import("@playwright/test").Locator) {
  await expect(card).toBeVisible({ timeout: 15_000 });
  if ((await card.getAttribute("data-collapsed")) === "true") {
    await card.locator('[data-slot="weekly-collapse"]').click();
  }
  await expect(card).toHaveAttribute("data-collapsed", "false");
}

test.describe("§15 metrics — real-browser smoke (all 4 events)", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test("habit_created — quick-pick setup flow reaches window.gtag", async ({ page }) => {
    await primeForMetrics(page);
    await gotoHabitsTab(page);

    await completeTemplateSetup(page, "drink-water");

    const evt = await waitForGtagEvent(page, "habit_created");
    const payload = getEventPayload(evt);
    expect(payload.source).toBe("template");
    expect(payload.total_habits).toBe(1);
    expect(payload.ever_first).toBe(true);
    expect(payload.session_first).toBe(true);
  });

  test("habit_completed — weekly-cell interaction reaches window.gtag", async ({ page }) => {
    await primeForMetrics(page);
    await gotoHabitsTab(page);

    await completeTemplateSetup(page, "exercise");

    const card = page.locator(WEEKLY_CARD_SELECTOR).first();
    await expandWeeklyCard(card);
    const weekCell = card.locator('[role="checkbox"]:not([aria-disabled="true"])').first();
    await expect(weekCell).toBeVisible();
    if ((await weekCell.getAttribute("aria-checked")) === "true") {
      await weekCell.click();
      await expect(weekCell).toHaveAttribute("aria-checked", "false");
    }
    await weekCell.click();

    const evt = await waitForGtagEvent(page, "habit_completed");
    const payload = getEventPayload(evt);
    expect(typeof payload.habit_length).toBe("number");
    expect(Number(payload.habit_length)).toBeGreaterThan(0);
    expect(payload.total_habits).toBe(1);
  });

  test("habit_detail_opened — tapping weekly-card statistics reaches window.gtag", async ({
    page,
  }) => {
    await primeForMetrics(page);
    await gotoHabitsTab(page);

    await completeTemplateSetup(page, "exercise");

    const card = page.locator(WEEKLY_CARD_SELECTOR).first();
    await expandWeeklyCard(card);
    const statsButton = card.locator('[data-slot="weekly-stats"]').first();
    await expect(statsButton).toBeVisible();
    await statsButton.click();

    const evt = await waitForGtagEvent(page, "habit_detail_opened");
    const payload = getEventPayload(evt);
    expect(payload.total_habits).toBe(1);
  });

  test("insight_strip_rendered — mounting HeroInsightStrip with a non-null insight reaches window.gtag", async ({
    page,
  }) => {
    test.skip(
      !CAN_INTERCEPT_VITE_SOURCE_MODULES,
      "Requires Vite dev-server source-module interception; production builds expose hashed bundles.",
    );

    await page.route(/\/src\/lib\/insightsEngine\.ts/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: `
          export function generateInsights() {
            return [{
              id: "e2e-fake-insight",
              type: "mood-habit-correlation",
              severity: "positive",
              title: "On days you read, your mood is +28% higher",
              description: "",
              confidence: 82
            }];
          }
          export {};
        `,
      });
    });

    await primeForMetrics(page);
    await gotoHabitsTab(page);

    await completeTemplateSetup(page, "drink-water");
    await expect(page.getByTestId("habits-hero-insight-strip")).toBeVisible({
      timeout: 10_000,
    });

    const evt = await waitForGtagEvent(page, "insight_strip_rendered");
    const payload = getEventPayload(evt);
    expect(payload.insight_type).toBe("mood-habit-correlation");
    expect(payload.insight_severity).toBe("positive");
  });
});
