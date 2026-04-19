/**
 * §15 success-metrics Playwright smoke.
 *
 * Proves the instrumented habits tab actually calls `window.gtag` end-to-end
 * in a real browser — no vitest mocks, no Analytics-class stubs.
 *
 * Two non-obvious environmental details this spec solves:
 *
 * 1. The useIndexedDB hook's localStorage→IndexedDB migration races with the
 *    Index.tsx privacy-effect on fresh reload, so even with a seeded
 *    `zenflow-privacy={analytics:true}` blob the store can stay at its
 *    defaults and leave Analytics.enabled=false at click-time. We bypass by
 *    forcing both Zustand's `setPrivacy` and `analytics.init` directly on
 *    the exact module instance the app loaded.
 *
 * 2. Vite HMR appends `?t=TIMESTAMP` to every served source module, so
 *    `import('/people-first-app/src/lib/analytics.ts')` creates a BRAND NEW
 *    module instance — different from the `@/lib/analytics` the app imported
 *    at boot. If we patch that new instance, our patch is invisible to the
 *    app's track() calls. Solution: read the app's actual loaded URL
 *    (including `?t=…`) via `performance.getEntriesByType('resource')` and
 *    dynamic-import THAT exact URL so we hit the same cached module.
 *
 * Capacitor iOS/Android are chromium-based webviews, so a green chromium
 * Playwright run is the best proxy available short of a device farm.
 */

import { test, expect } from "@playwright/test";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };

type GtagArgs = unknown[];

async function primeForMetrics(page: import("@playwright/test").Page) {
  await page.addInitScript(
    ({ appVersion }: { appVersion: string }) => {
      // ── onboarding dismissed so we land on the app shell ──
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

      // ── privacy.analytics=true seed (used once useIndexedDB migrates) ──
      localStorage.setItem(
        "zenflow-privacy",
        JSON.stringify({ noTracking: false, analytics: true, consentShown: true }),
      );
      localStorage.setItem("zenflow-privacy-acknowledged", JSON.stringify(true));

      // ── gtag capture, installed before any module loads ──
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

/**
 * Force Analytics.enabled=true on the exact module instance the app uses.
 * Returns the URL we patched (includes Vite's `?t=` cache-buster) so the
 * test can assert we actually found one.
 */
async function forceAnalyticsOnAppInstance(
  page: import("@playwright/test").Page,
): Promise<string> {
  return page.evaluate(async () => {
    const entries = performance.getEntriesByType("resource");
    const analyticsEntry = entries.find((e) =>
      e.name.includes("/src/lib/analytics"),
    );
    if (!analyticsEntry) throw new Error("analytics.ts not loaded yet");

    // Same-URL dynamic import hits the app's already-cached module instance.
    const mod = (await import(/* @vite-ignore */ analyticsEntry.name)) as {
      analytics: { init: (p: { analytics: boolean; noTracking: boolean }) => void };
    };
    mod.analytics.init({ analytics: true, noTracking: false });

    // Also flip the Zustand privacy slice so the Index.tsx privacy-effect
    // doesn't later re-init with the default {analytics:false} and clobber us.
    const storesEntry = entries.find((e) => e.name.includes("/src/stores/index"));
    if (storesEntry) {
      const storesMod = (await import(/* @vite-ignore */ storesEntry.name)) as {
        useUserDataStore: {
          getState: () => {
            setPrivacy: (p: {
              analytics: boolean;
              noTracking: boolean;
              consentShown: boolean;
            }) => void;
          };
        };
      };
      storesMod.useUserDataStore
        .getState()
        .setPrivacy({ analytics: true, noTracking: false, consentShown: true });
    }
    return analyticsEntry.name;
  });
}

test.describe("§15 metrics — real-browser smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test("quick-pick from empty journey emits habit_created to window.gtag", async ({
    page,
  }) => {
    await primeForMetrics(page);
    // Desktop viewport — Phase 3-A.1 removed MobileNavV2 bottom tabs, so the
    // keyboard shortcut (ctrl+2 → habits) is the stable cross-viewport route.
    // On phone-tier the shortcut is suppressed, hence ≥1024px.
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.goto("/?nav=v2");
    await expect(page.getByTestId("nav-v2-orchestrator")).toBeVisible({
      timeout: 15_000,
    });

    // Deterministically flip Analytics.enabled=true on the app's module
    // instance. Without this the privacy hydrate race leaves it at false.
    const patchedUrl = await forceAnalyticsOnAppInstance(page);
    expect(patchedUrl).toMatch(/\/src\/lib\/analytics\.ts/);

    await page.keyboard.press("Control+2");
    await expect(page.getByTestId("habits-hero-empty")).toBeVisible({
      timeout: 10_000,
    });

    // Settle so the privacy-effect re-run doesn't land between our forced
    // init and the emission. The effect reads Zustand privacy (already set
    // to analytics:true above) and re-calls init(true) — a no-op here.
    await page.waitForTimeout(500);

    const quickPick = page.locator('[data-testid^="hero-quickpick-"]').first();
    await expect(quickPick).toBeVisible();
    await quickPick.click();

    // gtag is sync; 500 ms covers React commit + any microtask ticks.
    await page.waitForTimeout(500);

    const calls = await page.evaluate(
      () =>
        (window as unknown as { __gtagCalls: GtagArgs[] }).__gtagCalls.slice(),
    );

    const habitCreated = calls.find(
      (c) => Array.isArray(c) && c[0] === "event" && c[1] === "habit_created",
    );
    expect(
      habitCreated,
      `expected a habit_created event; got ${JSON.stringify(calls)}`,
    ).toBeDefined();

    const payload = (habitCreated as unknown[])[2] as Record<string, unknown>;
    // PII contract — only finite-enum + integer + boolean fields.
    expect(payload.source).toBe("template");
    expect(payload.total_habits).toBe(1);
    expect(payload.ever_first).toBe(true);
    expect(payload.session_first).toBe(true);
  });
});
