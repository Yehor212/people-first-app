/**
 * §15 success-metrics Playwright smoke — real browser, real gtag.
 *
 * Covers ALL four instrumented emitters through the CURRENT V2 user flow:
 *  - habit_created          (quick-pick -> setup sheet -> save template habit)
 *  - habit_completed        (weekly cell interaction on the saved card)
 *  - habit_detail_opened    (tap Statistics on the weekly card)
 *  - insight_strip_rendered (mount HeroInsightStrip after first saved habit)
 */

import { test, expect, type Page } from "@playwright/test";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };

type GtagArgs = unknown[];

function getAppBasePath(page: Page) {
  const { pathname } = new URL(page.url());
  return pathname === "/" ? "" : pathname.replace(/\/$/, "");
}

async function primeForMetrics(page: Page) {
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
        /* safe no-op */
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
        JSON.stringify({ noTracking: false, analytics: true, consentShown: true }),
      );
      localStorage.setItem("zenflow-privacy-acknowledged", JSON.stringify(true));

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
    },
    { appVersion: packageJson.version },
  );
}

async function resolveAppModuleUrl(page: Page, pathSubstring: string): Promise<string> {
  await page.waitForFunction((needle) => {
    return performance
      .getEntriesByType("resource")
      .some((entry) => entry.name.includes(needle));
  }, pathSubstring);

  const url = await page.evaluate((needle) => {
    const entry = performance
      .getEntriesByType("resource")
      .find((resource) => resource.name.includes(needle));
    return entry?.name ?? null;
  }, pathSubstring);
  if (!url) throw new Error(`module not loaded yet: ${pathSubstring}`);
  return url;
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

async function forceAnalyticsOnAppInstance(page: Page): Promise<void> {
  const analyticsUrl = await resolveAppModuleUrl(page, "/src/lib/analytics.ts");
  const storesUrl = await resolveAppModuleUrl(page, "/src/stores/index.ts");
  await page.evaluate(
    async ({ analyticsUrl, storesUrl }) => {
      const [analyticsMod, storesMod] = await Promise.all([
        import(/* @vite-ignore */ analyticsUrl),
        import(/* @vite-ignore */ storesUrl),
      ]);
      (analyticsMod as {
        analytics: { init: (p: { analytics: boolean; noTracking: boolean }) => void };
      }).analytics.init({ analytics: true, noTracking: false });
      (storesMod as {
        useUserDataStore: {
          getState: () => {
            setPrivacy: (p: {
              analytics: boolean;
              noTracking: boolean;
              consentShown: boolean;
            }) => void;
          };
        };
      }).useUserDataStore
        .getState()
        .setPrivacy({ analytics: true, noTracking: false, consentShown: true });
    },
    { analyticsUrl, storesUrl },
  );
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
  const appBase = getAppBasePath(page);
  await page.goto(`${appBase}/habits?nav=v2&dev=true`);
  await expect(page.getByTestId("habits-page")).toBeVisible({ timeout: 15_000 });
  await installGtagSpy(page);
  await forceAnalyticsOnAppInstance(page);
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
  await expect(page.locator('[data-testid^="hero-weekly-card-"]').first()).toBeVisible({
    timeout: 15_000,
  });
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

    const card = page.locator('[data-testid^="hero-weekly-card-"]').first();
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

    const statsButton = page
      .locator('[data-testid^="hero-weekly-card-"]')
      .first()
      .getByRole("button", { name: /statistics/i });
    await expect(statsButton).toBeVisible();
    await statsButton.click();

    const evt = await waitForGtagEvent(page, "habit_detail_opened");
    const payload = getEventPayload(evt);
    expect(payload.total_habits).toBe(1);
  });

  test("insight_strip_rendered — mounting HeroInsightStrip with a non-null insight reaches window.gtag", async ({
    page,
  }) => {
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
