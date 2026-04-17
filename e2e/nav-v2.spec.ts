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

  // Phase 3-A.4b mid-flow baselines — scope selector + emotion spectrum + confirm CTA visible
  test("desktop: mid-flow state (day variant — scope + emotion + confirm visible)", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);
    await primeApp(page, { paperTheme: "paper" });
    await freezeTimeToDay(page);
    // Mark first-run hint as dismissed so it doesn't block the screenshot
    await page.addInitScript(() => {
      localStorage.setItem("zenflow-orb-first-run-dismissed", "1");
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/?nav=v2");
    await page.evaluate(() => document.fonts.ready);

    await expect(page.getByTestId("orb-page")).toBeVisible();
    await expect(page.getByTestId("mood-scope-selector")).toBeVisible();
    await expect(page.getByTestId("orb-page-slider")).toBeVisible();

    // Use the deterministic draft-store window hook to set valence + emotion,
    // bypassing the framer-motion drag which Playwright cannot reliably trigger.
    await page.waitForFunction(() => {
      interface W { __zenMoodDraft?: unknown }
      return (window as unknown as W).__zenMoodDraft !== undefined;
    }, { timeout: 5000 });
    await page.evaluate(() => {
      interface DraftHandle {
        setValence: (v: number) => void;
        setEmotion: (e: string | null) => void;
      }
      interface W { __zenMoodDraft?: DraftHandle }
      const h = (window as unknown as W).__zenMoodDraft;
      if (h) {
        h.setValence(0.5);
        h.setEmotion("hopeful");
      }
    });
    await page.waitForTimeout(300);

    await expect(page.getByTestId("orb-page-emotion-spectrum")).toBeVisible();
    await expect(page.getByTestId("mood-confirm-button")).toBeVisible();

    await expect(page).toHaveScreenshot("nav-v2-desktop-orb-midflow-day.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.04,
      animations: "disabled",
      timeout: 30_000,
    });
  });

  test("desktop: mid-flow state (night variant — cosmic glass chips)", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);
    await primeApp(page, { paperTheme: "ink" });
    await freezeTimeToDay(page);
    await page.addInitScript(() => {
      localStorage.setItem("zenflow-orb-first-run-dismissed", "1");
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/?nav=v2");
    await page.evaluate(() => document.fonts.ready);

    await expect(page.getByTestId("orb-page")).toBeVisible();
    await expect(page.getByTestId("mood-scope-selector")).toBeVisible();

    await page.waitForFunction(() => {
      interface W { __zenMoodDraft?: unknown }
      return (window as unknown as W).__zenMoodDraft !== undefined;
    }, { timeout: 5000 });
    await page.evaluate(() => {
      interface DraftHandle {
        setValence: (v: number) => void;
        setEmotion: (e: string | null) => void;
      }
      interface W { __zenMoodDraft?: DraftHandle }
      const h = (window as unknown as W).__zenMoodDraft;
      if (h) {
        h.setValence(0.5);
        h.setEmotion("hopeful");
      }
    });
    await page.waitForTimeout(300);

    await expect(page.getByTestId("orb-page-emotion-spectrum")).toBeVisible();

    await expect(page).toHaveScreenshot("nav-v2-desktop-orb-midflow-night.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.04,
      animations: "disabled",
      timeout: 30_000,
    });
  });

  // Phase 3-A.4c-ii-c-b — Emotion grid progressive disclosure baselines.
  // Two display states (collapsed = 8 chips + "More precise", expanded = 20 chips)
  // × two themes (paper/ink) × two viewports (desktop 1280×900, mobile 375×812)
  // = 8 PNG baselines. Validates visual discipline of Bloom stagger reveal.
  async function setupEmotionGridScene(
    page: import("@playwright/test").Page,
    opts: { theme: "paper" | "ink"; viewport: { width: number; height: number } },
  ) {
    await primeApp(page, { paperTheme: opts.theme });
    await freezeTimeToDay(page);
    await page.addInitScript(() => {
      localStorage.setItem("zenflow-orb-first-run-dismissed", "1");
    });
    await page.setViewportSize(opts.viewport);
    await page.goto("/?nav=v2");
    await page.evaluate(() => document.fonts.ready);

    await expect(page.getByTestId("orb-page")).toBeVisible();

    await page.waitForFunction(() => {
      interface W { __zenMoodDraft?: unknown }
      return (window as unknown as W).__zenMoodDraft !== undefined;
    }, { timeout: 5000 });
    await page.evaluate(() => {
      interface DraftHandle {
        setValence: (v: number) => void;
        setEmotion: (e: string | null) => void;
      }
      interface W { __zenMoodDraft?: DraftHandle }
      const h = (window as unknown as W).__zenMoodDraft;
      if (h) {
        h.setValence(0.5);
        h.setEmotion(null);
      }
    });
    // Wait for Bloom CTA stagger (cta delay) + initial chip stagger settle.
    await page.waitForTimeout(500);
    await expect(page.getByTestId("orb-page-emotion-spectrum")).toBeVisible();
    await expect(page.getByTestId("emotion-more-precise")).toBeVisible();
  }

  for (const theme of ["paper", "ink"] as const) {
    const themeLabel = theme === "paper" ? "day" : "night";

    test(`desktop: emotion grid collapsed — ${themeLabel} (${theme})`, async ({
      page,
    }, testInfo) => {
      testInfo.setTimeout(60_000);
      await setupEmotionGridScene(page, {
        theme,
        viewport: { width: 1280, height: 900 },
      });

      // Collapsed state — initial 8 chips + "More precise" button visible.
      const chips = page.locator('[data-testid^="emotion-chip-"]');
      const collapsedCount = await chips.count();
      // Tier-1 initial — 8-16 chips depending on valence tier-1 density.
      expect(collapsedCount).toBeGreaterThanOrEqual(6);
      expect(collapsedCount).toBeLessThanOrEqual(16);
      await expect(page.getByTestId("emotion-more-precise")).toBeVisible();

      await expect(page).toHaveScreenshot(
        `nav-v2-desktop-orb-emotions-collapsed-${themeLabel}.png`,
        {
          fullPage: true,
          maxDiffPixelRatio: 0.04,
          animations: "disabled",
          timeout: 30_000,
        },
      );
    });

    test(`desktop: emotion grid expanded — ${themeLabel} (${theme})`, async ({
      page,
    }, testInfo) => {
      testInfo.setTimeout(60_000);
      await setupEmotionGridScene(page, {
        theme,
        viewport: { width: 1280, height: 900 },
      });

      // Trigger progressive disclosure.
      await page.getByTestId("emotion-more-precise").click();
      // Bloom stagger: 0.05 delay + (20 * 0.02) = ~0.45s to settle, plus buffer.
      await page.waitForTimeout(600);

      const chips = page.locator('[data-testid^="emotion-chip-"]');
      await expect(chips.first()).toBeVisible();
      // 20 tags at valence=0.5 — full spectrum revealed.
      const count = await chips.count();
      expect(count).toBeGreaterThanOrEqual(15);

      await expect(page).toHaveScreenshot(
        `nav-v2-desktop-orb-emotions-expanded-${themeLabel}.png`,
        {
          fullPage: true,
          maxDiffPixelRatio: 0.04,
          animations: "disabled",
          timeout: 30_000,
        },
      );
    });

    test(`mobile: emotion grid collapsed — ${themeLabel} (${theme})`, async ({
      page,
    }, testInfo) => {
      testInfo.setTimeout(60_000);
      await setupEmotionGridScene(page, {
        theme,
        viewport: { width: 375, height: 812 },
      });

      const chips = page.locator('[data-testid^="emotion-chip-"]');
      const collapsedCount = await chips.count();
      // Tier-1 initial — 8-16 chips depending on valence tier-1 density.
      expect(collapsedCount).toBeGreaterThanOrEqual(6);
      expect(collapsedCount).toBeLessThanOrEqual(16);
      await expect(page.getByTestId("emotion-more-precise")).toBeVisible();

      await expect(page).toHaveScreenshot(
        `nav-v2-mobile-orb-emotions-collapsed-${themeLabel}.png`,
        {
          fullPage: true,
          maxDiffPixelRatio: 0.04,
          animations: "disabled",
          timeout: 30_000,
        },
      );
    });

    test(`mobile: emotion grid expanded — ${themeLabel} (${theme})`, async ({
      page,
    }, testInfo) => {
      testInfo.setTimeout(60_000);
      await setupEmotionGridScene(page, {
        theme,
        viewport: { width: 375, height: 812 },
      });

      await page.getByTestId("emotion-more-precise").click();
      await page.waitForTimeout(600);

      const chips = page.locator('[data-testid^="emotion-chip-"]');
      await expect(chips.first()).toBeVisible();
      const count = await chips.count();
      expect(count).toBeGreaterThanOrEqual(15);

      await expect(page).toHaveScreenshot(
        `nav-v2-mobile-orb-emotions-expanded-${themeLabel}.png`,
        {
          fullPage: true,
          maxDiffPixelRatio: 0.04,
          animations: "disabled",
          timeout: 30_000,
        },
      );
    });
  }
});
