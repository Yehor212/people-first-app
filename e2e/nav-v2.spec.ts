/**
 * Phase 3-A.1 Navigation V2 visual regression spec (sidebar-only).
 *
 * Purpose: capture V2 navigation shell baselines for both desktop (permanent
 * SidebarV2 + Orb page with ValenceOrb) and mobile (drawer trigger only —
 * NO bottom tabs after Phase 3-A.1 Option A correction).
 *
 * V1 remains the default render path — we enable V2 via the ?nav=v2 query
 * override (no flag mutation required, so the cloud flag stays at
 * rollout_percent=0 with killswitch ON).
 *
 * Local baselines land under e2e/nav-v2.spec.ts-snapshots/ and are committed
 * (learning from Phase 2-B.2: never defer baselines — CI regenerates silently
 * otherwise). Mobile baseline regenerated in Phase 3-A.1 to drop MobileNavV2.
 */

import { test, expect } from "@playwright/test";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };

async function primeApp(
  page: import("@playwright/test").Page,
  opts: { paperTheme?: "paper" | "ink" } = {},
) {
  const paperTheme = opts.paperTheme ?? "paper";
  await page.addInitScript(
    ({ appVersion, paperTheme }: { appVersion: string; paperTheme: string }) => {
      // Dismiss first-run chrome so Nav V2 shell takes centre stage.
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
      // Phase 3-A.4a-day: seed paper/ink theme store so OrbPage variant-switches
      // CosmicBgAdapter between DayCosmicBackground and night cosmic.
      localStorage.setItem(
        "zenflow:theme-v0c",
        JSON.stringify({ state: { theme: paperTheme }, version: 0 }),
      );
      localStorage.setItem(
        "zenflow-privacy",
        JSON.stringify({ noTracking: false, analytics: false, consentShown: true }),
      );
      localStorage.setItem("zenflow-privacy-acknowledged", JSON.stringify(true));
    },
    { appVersion: packageJson.version, paperTheme },
  );
}

// Phase 3-A.3: freeze time-of-day to 'day' (12:00) so palette/stars are
// deterministic. Motion is disabled via `animations: "disabled"` in screenshot.
async function freezeTimeToDay(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    const fixedMs = new Date(2026, 3, 16, 12, 0, 0).getTime();
    const OriginalDate = Date;
    // @ts-expect-error — replace global Date with a fixed-offset subclass
    globalThis.Date = class FixedDate extends OriginalDate {
      constructor(...args: unknown[]) {
        if (args.length === 0) {
          super(fixedMs);
        } else {
          // @ts-expect-error pass through rest args
          super(...args);
        }
      }
      static now() {
        return fixedMs;
      }
    };
  });
}

test.describe("Nav V2 Infrastructure Baselines", () => {
  test("desktop: SidebarV2 + Orb page shell (day variant — paper theme)", async ({ page }, testInfo) => {
    testInfo.setTimeout(60_000);
    await primeApp(page, { paperTheme: "paper" });
    await freezeTimeToDay(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/?nav=v2");
    await page.evaluate(() => document.fonts.ready);

    // SidebarV2 must be present + orb page shell rendered
    await expect(page.getByTestId("sidebar-v2")).toBeVisible();
    await expect(page.getByTestId("orb-page")).toBeVisible();

    // Day variant must render (paper theme → warm 7-layer scene)
    await expect(page.getByTestId("day-cosmic-background")).toBeVisible();

    const orbBtn = page
      .getByTestId("sidebar-v2")
      .getByRole("button", { name: /^Orb$/ });
    await expect(orbBtn).toHaveAttribute("aria-current", "page");

    // Visual baseline — day variant (paper): warm OKLCH mesh, dust motes,
    // god-rays, paper grain, cinematic greeting, orb hero, mood slider.
    await expect(page).toHaveScreenshot("nav-v2-desktop-orb-day.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.03,
      animations: "disabled",
      timeout: 30_000,
    });
  });

  test("desktop: SidebarV2 + Orb page shell (night variant — ink theme, cosmic)", async ({ page }, testInfo) => {
    testInfo.setTimeout(60_000);
    await primeApp(page, { paperTheme: "ink" });
    await freezeTimeToDay(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/?nav=v2");
    await page.evaluate(() => document.fonts.ready);

    await expect(page.getByTestId("orb-page")).toBeVisible();
    // Night variant must render (ink theme → stars + violet nebula, UNCHANGED)
    await expect(page.getByTestId("cosmic-orb-background")).toBeVisible();
    await expect(page.getByTestId("cosmic-orb-nebula")).toBeVisible();

    // Visual baseline — night variant (ink): legacy cosmic dark, stars, nebula.
    await expect(page).toHaveScreenshot("nav-v2-desktop-orb-night.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.03,
      animations: "disabled",
      timeout: 30_000,
    });
  });

  test("mobile: drawer trigger only, NO bottom tabs (day variant — paper theme)", async ({ page }, testInfo) => {
    testInfo.setTimeout(60_000);
    await primeApp(page, { paperTheme: "paper" });
    await freezeTimeToDay(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/?nav=v2");
    await page.evaluate(() => document.fonts.ready);

    await expect(page.getByTestId("orb-page")).toBeVisible();
    await expect(page.getByTestId("nav-v2-open-drawer")).toBeVisible();
    await expect(page.getByTestId("day-cosmic-background")).toBeVisible();

    expect(await page.getByTestId("mobile-nav-v2").count()).toBe(0);
    for (const id of ["orb", "habits", "diary", "settings"]) {
      expect(await page.getByTestId(`mobile-nav-v2-tab-${id}`).count()).toBe(0);
    }

    const primaryNav = await page
      .locator('[role="navigation"][aria-label*="Primary" i]')
      .count();
    expect(primaryNav).toBeGreaterThan(0);

    await expect(page).toHaveScreenshot("nav-v2-mobile-orb-day.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.03,
      animations: "disabled",
      timeout: 30_000,
    });
  });

  test("mobile: night variant (ink theme, cosmic dark)", async ({ page }, testInfo) => {
    testInfo.setTimeout(60_000);
    await primeApp(page, { paperTheme: "ink" });
    await freezeTimeToDay(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/?nav=v2");
    await page.evaluate(() => document.fonts.ready);

    await expect(page.getByTestId("orb-page")).toBeVisible();
    await expect(page.getByTestId("cosmic-orb-background")).toBeVisible();

    await expect(page).toHaveScreenshot("nav-v2-mobile-orb-night.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.03,
      animations: "disabled",
      timeout: 30_000,
    });
  });

  test("V1 remains default when ?nav=v2 is absent", async ({ page }) => {
    await primeApp(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    // V2 shell must NOT render when the flag is off and no override is set
    await expect(page.getByTestId("sidebar-v2")).toHaveCount(0);
    await expect(page.getByTestId("mobile-nav-v2")).toHaveCount(0);
    await expect(page.getByTestId("nav-v2-orchestrator")).toHaveCount(0);
  });
});
