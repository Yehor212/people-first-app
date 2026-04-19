/**
 * §15 success-metrics Playwright smoke — real browser, real gtag.
 *
 * Covers ALL four instrumented emitters:
 *  - habit_created          (quick-pick from empty journey)
 *  - habit_completed        (toggle a habit row)
 *  - habit_detail_opened    (focus a row + Enter)
 *  - insight_strip_rendered (mount HeroInsightStrip with a non-null insight)
 *
 * Two environmental gotchas that cost us an hour of debugging are codified
 * in helpers below so the next engineer does not retrace them:
 *
 * 1. Vite HMR appends `?t=TIMESTAMP` to every served source module. A plain
 *    `import('/path/to/module.ts')` creates a BRAND NEW module instance
 *    different from the one the app imported at boot. Patching that new
 *    instance is invisible to the app. Solution: look up the app's actual
 *    loaded URL via `performance.getEntriesByType('resource')` and dynamic-
 *    import THAT exact URL so we hit the same cached module.
 *
 * 2. `useIndexedDB`'s localStorage→IndexedDB migration races with the
 *    Index.tsx privacy-effect. Seeded `zenflow-privacy={analytics:true}`
 *    alone isn't enough — the store can stay at its defaults at click-time.
 *    Bypassed by forcing both `setPrivacy` on the Zustand store AND
 *    `analytics.init` on the singleton.
 *
 * Capacitor iOS/Android are chromium-based webviews, so a green chromium
 * run is the closest proxy available short of a device farm.
 */

import { test, expect } from "@playwright/test";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };

type GtagArgs = unknown[];

async function primeForMetrics(page: import("@playwright/test").Page) {
  await page.addInitScript(
    ({ appVersion }: { appVersion: string }) => {
      // onboarding dismissed so we land on the app shell
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
        JSON.stringify({ noTracking: false, analytics: true, consentShown: true }),
      );
      localStorage.setItem("zenflow-privacy-acknowledged", JSON.stringify(true));

      // Expand the resource-timing buffer — Chromium's default (250) drops
      // late-loaded modules like insightsEngine.ts, which breaks our URL
      // resolution that relies on performance.getEntriesByType('resource').
      try {
        performance.setResourceTimingBufferSize(5000);
      } catch {
        /* some browsers have this read-only; safe to ignore */
      }

      // gtag capture — installed before any app module loads
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

async function resolveAppModuleUrl(
  page: import("@playwright/test").Page,
  pathSubstring: string,
): Promise<string> {
  const url = await page.evaluate((needle) => {
    const entry = performance
      .getEntriesByType("resource")
      .find((e) => e.name.includes(needle));
    return entry?.name ?? null;
  }, pathSubstring);
  if (!url) throw new Error(`module not loaded yet: ${pathSubstring}`);
  return url;
}

async function forceAnalyticsOnAppInstance(
  page: import("@playwright/test").Page,
): Promise<void> {
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

async function readGtagCalls(page: import("@playwright/test").Page): Promise<GtagArgs[]> {
  return page.evaluate(
    () =>
      (window as unknown as { __gtagCalls: GtagArgs[] }).__gtagCalls.slice(),
  );
}

async function gotoHabitsTab(page: import("@playwright/test").Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?nav=v2");
  await expect(page.getByTestId("nav-v2-orchestrator")).toBeVisible({ timeout: 15_000 });
  await forceAnalyticsOnAppInstance(page);
  await page.keyboard.press("Control+2");
  await expect(page.getByTestId("habits-hero-empty")).toBeVisible({ timeout: 10_000 });
  // Let the privacy-effect settle after the forced init.
  await page.waitForTimeout(400);
}

test.describe("§15 metrics — real-browser smoke (all 4 events)", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test("habit_created — quick-pick from empty journey reaches window.gtag", async ({
    page,
  }) => {
    await primeForMetrics(page);
    await gotoHabitsTab(page);

    const quickPick = page.locator('[data-testid^="hero-quickpick-"]').first();
    await expect(quickPick).toBeVisible();
    await quickPick.click();
    await page.waitForTimeout(400);

    const calls = await readGtagCalls(page);
    const evt = calls.find(
      (c) => Array.isArray(c) && c[0] === "event" && c[1] === "habit_created",
    );
    expect(evt, `expected habit_created; got ${JSON.stringify(calls)}`).toBeDefined();
    const payload = (evt as unknown[])[2] as Record<string, unknown>;
    expect(payload.source).toBe("template");
    expect(payload.total_habits).toBe(1);
    expect(payload.ever_first).toBe(true);
    expect(payload.session_first).toBe(true);
  });

  test("habit_completed — toggling a habit row reaches window.gtag", async ({
    page,
  }) => {
    await primeForMetrics(page);
    await gotoHabitsTab(page);

    // Seed one habit so the toggle target exists.
    await page.locator('[data-testid^="hero-quickpick-"]').first().click();
    await page.waitForTimeout(300);

    // The V1 CompactHabitCard's toggle button carries an aria-label of the
    // form "<name>: Mark complete". Use that instead of any specific testid —
    // it survives copy changes because the shape is stable.
    const toggle = page
      .getByRole("button", { name: /mark complete/i })
      .first();
    await expect(toggle).toBeVisible();
    await toggle.click();
    await page.waitForTimeout(400);

    const calls = await readGtagCalls(page);
    const evt = calls.find(
      (c) => Array.isArray(c) && c[0] === "event" && c[1] === "habit_completed",
    );
    expect(evt, `expected habit_completed; got ${JSON.stringify(calls)}`).toBeDefined();
    const payload = (evt as unknown[])[2] as Record<string, unknown>;
    // PII-safe: integer length + integer total_habits; no name in plain text.
    expect(typeof payload.habit_length).toBe("number");
    expect((payload.habit_length as number) > 0).toBe(true);
    expect(payload.total_habits).toBe(1);
  });

  test("habit_detail_opened — row activation via keyboard reaches window.gtag", async ({
    page,
  }) => {
    await primeForMetrics(page);
    await gotoHabitsTab(page);

    // Seed a habit so the row exists.
    await page.locator('[data-testid^="hero-quickpick-"]').first().click();
    await page.waitForTimeout(300);

    // The hero row is `role="group" tabIndex=0` and opens detail on Enter/Space.
    const row = page.locator('[data-testid^="hero-habit-row-"]').first();
    await expect(row).toBeVisible();
    await row.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);

    const calls = await readGtagCalls(page);
    const evt = calls.find(
      (c) => Array.isArray(c) && c[0] === "event" && c[1] === "habit_detail_opened",
    );
    expect(evt, `expected habit_detail_opened; got ${JSON.stringify(calls)}`).toBeDefined();
    const payload = (evt as unknown[])[2] as Record<string, unknown>;
    expect(payload.total_habits).toBe(1);
  });

  test("insight_strip_rendered — mounting HeroInsightStrip with a non-null insight reaches window.gtag", async ({
    page,
  }) => {
    // Route-intercept insightsEngine.ts at Vite's dev-server boundary so the
    // module HeroInsightStrip imports is a deterministic version that returns
    // a fake insight on every call. This is the only reliable way to force a
    // non-null `topInsight` — ES module live bindings prevent post-import
    // mutation, and seeding enough real mood+habit data to trip the real
    // engine's 7-day threshold is fragile to engine internals.
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

    // Seed a habit so HabitsHeroZone takes the non-empty branch and
    // HeroInsightStrip mounts with our intercepted generateInsights.
    await page.locator('[data-testid^="hero-quickpick-"]').first().click();
    await expect(
      page.locator('[data-testid^="hero-habit-row-"]').first(),
    ).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(800);

    const calls = await readGtagCalls(page);
    const evt = calls.find(
      (c) => Array.isArray(c) && c[0] === "event" && c[1] === "insight_strip_rendered",
    );
    expect(
      evt,
      `expected insight_strip_rendered; got ${JSON.stringify(calls)}`,
    ).toBeDefined();
    const payload = (evt as unknown[])[2] as Record<string, unknown>;
    expect(payload.insight_type).toBe("mood-habit-correlation");
    expect(payload.insight_severity).toBe("positive");
  });
});
