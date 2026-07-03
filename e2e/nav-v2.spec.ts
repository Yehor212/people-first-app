/**
 * Phase 3-A.1 Navigation V2 visual regression spec (sidebar-only).
 *
 * Purpose: capture V2 navigation shell baselines for both desktop (permanent
 * SidebarV2 + Orb page with ValenceOrb) and mobile (drawer trigger only —
 * NO bottom tabs after Phase 3-A.1 Option A correction).
 *
 * V2 is the default render path; legacy ?nav=v2 links and direct routes
 * continue to share the same shell during the V1 removal window.
 *
 * Local baselines land under e2e/nav-v2.spec.ts-snapshots/ and are committed
 * (learning from Phase 2-B.2: never defer baselines — CI regenerates silently
 * otherwise). Mobile baseline regenerated in Phase 3-A.1 to drop MobileNavV2.
 */

import { test, expect } from "@playwright/test";

import { primeZenflowV2 } from "./helpers/zenflowV2State";

async function primeApp(
  page: import("@playwright/test").Page,
  opts: { paperTheme?: "paper" | "ink" | "oled" } = {}
) {
  const paperTheme = opts.paperTheme ?? "paper";
  await primeZenflowV2(page, { language: "en", theme: paperTheme });
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

async function expectVisibleAboveFold(page: import("@playwright/test").Page, testId: string) {
  const target = page.getByTestId(testId);
  await expect(target).toBeVisible({ timeout: 20_000 });
  const box = await target.boundingBox();
  const viewport = page.viewportSize();

  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (box && viewport) {
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height - 8);
  }
}

async function expectOrbPageReady(page: import("@playwright/test").Page) {
  await expect(page.getByTestId("orb-page")).toBeVisible({ timeout: 20_000 });
}

async function expectDarkThemeCardToken(
  page: import("@playwright/test").Page,
  expectedTheme: "ink" | "oled"
) {
  const tokens = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return {
      card: styles.getPropertyValue("--card").trim(),
      surface: styles.getPropertyValue("--zf-surface-1").trim(),
      theme: document.documentElement.dataset.theme,
    };
  });

  expect(tokens.theme).toBe(expectedTheme);
  expect(tokens.card).toBe(tokens.surface);
  expect(tokens.card).not.toBe("165 18% 99%");
}

test.describe("Nav V2 Infrastructure Baselines", () => {
  test("V2 boot uses the persisted loading screen before the app shell", async ({ page }) => {
    await primeApp(page, { paperTheme: "paper" });
    await freezeTimeToDay(page);
    await page.goto("?nav=v2", { waitUntil: "domcontentloaded" });

    const splash = page.getByTestId("splash-theme-shell");
    await expect(splash).toBeVisible();
    await expect(splash).toHaveAttribute("data-splash-theme", "paper");
    await expect(page.getByTestId("splash-brand-logo")).toBeVisible();
    await expect(page.getByTestId("splash-infinity-loader")).toBeVisible();
    await expect(page.getByText("ZenFlow")).toBeVisible();
    await expect(page.getByText("Preparing your zen space...")).toBeVisible();
    await expect(page.getByRole("status", { name: /loading/i })).toBeVisible();
    await expectOrbPageReady(page);
  });

  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test(`orb select CTA stays above the fold at ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo) => {
      testInfo.setTimeout(60_000);
      await primeApp(page, { paperTheme: "paper" });
      await freezeTimeToDay(page);
      await page.addInitScript(() => {
        localStorage.setItem("zenflow-orb-first-run-dismissed", "1");
      });
      await page.setViewportSize(viewport);
      await page.goto("?nav=v2");
      await page.evaluate(() => document.fonts.ready);

      await expectVisibleAboveFold(page, "orb-page-next");
      await page.getByTestId("mood-scope-chip-specific").click();
      await page.getByTestId("mood-scope-time-input").fill("14:30");
      await expectVisibleAboveFold(page, "orb-page-next");
    });
  }

  test("desktop: SidebarV2 + Orb page shell (day variant — paper theme)", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);
    await primeApp(page, { paperTheme: "paper" });
    await freezeTimeToDay(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("?nav=v2");
    await page.evaluate(() => document.fonts.ready);

    // SidebarV2 must be present + orb page shell rendered
    await expect(page.getByTestId("sidebar-v2")).toBeVisible({ timeout: 20_000 });
    await expectOrbPageReady(page);
    await expectVisibleAboveFold(page, "orb-page-next");

    // Day variant must render (paper theme → warm 7-layer scene)
    await expect(page.getByTestId("day-cosmic-background")).toBeVisible();

    const orbBtn = page.getByTestId("sidebar-v2").getByRole("button", { name: /^Mood$/ });
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

  test("desktop: SidebarV2 + Orb page shell (night variant — ink theme, cosmic)", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);
    await primeApp(page, { paperTheme: "ink" });
    await freezeTimeToDay(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("?nav=v2");
    await page.evaluate(() => document.fonts.ready);

    await expectOrbPageReady(page);
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

  test("mobile: drawer trigger only, NO bottom tabs (day variant — paper theme)", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);
    await primeApp(page, { paperTheme: "paper" });
    await freezeTimeToDay(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("?nav=v2");
    await page.evaluate(() => document.fonts.ready);

    await expectOrbPageReady(page);
    await expect(page.getByTestId("nav-v2-open-drawer")).toBeVisible();
    await expect(page.getByTestId("day-cosmic-background")).toBeVisible();
    await expectVisibleAboveFold(page, "orb-page-next");

    expect(await page.getByTestId("mobile-nav-v2").count()).toBe(0);
    for (const id of ["orb", "habits", "diary", "settings"]) {
      expect(await page.getByTestId(`mobile-nav-v2-tab-${id}`).count()).toBe(0);
    }

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
    await page.goto("?nav=v2");
    await page.evaluate(() => document.fonts.ready);

    await expectOrbPageReady(page);
    await expect(page.getByTestId("cosmic-orb-background")).toBeVisible();

    await expect(page).toHaveScreenshot("nav-v2-mobile-orb-night.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.03,
      animations: "disabled",
      timeout: 30_000,
    });
  });

  test("root uses V2 when ?nav=v2 is absent", async ({ page }) => {
    await primeApp(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("./");

    await expect(page.getByTestId("nav-v2-orchestrator")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("sidebar-v2")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("v1-v2-portal")).toHaveCount(0);
    await expect(page.getByTestId("app-shell-v1")).toHaveCount(0);
    await expect(page.locator('[data-testid*="classic-portal"]')).toHaveCount(0);
  });

  // Progressive-flow refine baselines — after the coarse orb choice, the user
  // advances into the precise-feeling step instead of seeing everything at once.
  test("desktop: refine step (day variant — precise feelings + diary handoff)", async ({
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
    await page.goto("?nav=v2");
    await page.evaluate(() => document.fonts.ready);

    await expectOrbPageReady(page);
    await expect(page.getByTestId("mood-scope-selector")).toBeVisible();
    await expect(page.getByTestId("orb-page-slider")).toBeVisible();

    // Use the deterministic draft-store window hook to set valence + emotion,
    // bypassing the framer-motion drag which Playwright cannot reliably trigger.
    await page.waitForFunction(
      () => {
        interface W {
          __zenMoodDraft?: unknown;
        }
        return (window as unknown as W).__zenMoodDraft !== undefined;
      },
      { timeout: 5000 }
    );
    await page.evaluate(() => {
      interface DraftHandle {
        setValence: (v: number) => void;
      }
      interface W {
        __zenMoodDraft?: DraftHandle;
      }
      const h = (window as unknown as W).__zenMoodDraft;
      if (h) {
        h.setValence(0.5);
      }
    });
    await page.waitForTimeout(300);
    await page.getByTestId("orb-page-next").click();
    await page.waitForTimeout(300);

    await expect(page.getByTestId("orb-page-refine")).toBeVisible();
    await expect(page.getByTestId("orb-page-emotion-spectrum")).toBeVisible();
    await expect(page.getByTestId("orb-page-open-diary")).toBeVisible();

    await expect(page).toHaveScreenshot("nav-v2-desktop-orb-midflow-day.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.04,
      animations: "disabled",
      timeout: 30_000,
    });
  });

  test("desktop: refine step (night variant — cosmic precise-feeling scene)", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);
    await primeApp(page, { paperTheme: "ink" });
    await freezeTimeToDay(page);
    await page.addInitScript(() => {
      localStorage.setItem("zenflow-orb-first-run-dismissed", "1");
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("?nav=v2");
    await page.evaluate(() => document.fonts.ready);

    await expectOrbPageReady(page);
    await expect(page.getByTestId("mood-scope-selector")).toBeVisible();

    await page.waitForFunction(
      () => {
        interface W {
          __zenMoodDraft?: unknown;
        }
        return (window as unknown as W).__zenMoodDraft !== undefined;
      },
      { timeout: 5000 }
    );
    await page.evaluate(() => {
      interface DraftHandle {
        setValence: (v: number) => void;
      }
      interface W {
        __zenMoodDraft?: DraftHandle;
      }
      const h = (window as unknown as W).__zenMoodDraft;
      if (h) {
        h.setValence(0.5);
      }
    });
    await page.waitForTimeout(300);
    await page.getByTestId("orb-page-next").click();
    await page.waitForTimeout(300);

    await expect(page.getByTestId("orb-page-refine")).toBeVisible();
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
    opts: { theme: "paper" | "ink"; viewport: { width: number; height: number } }
  ) {
    await primeApp(page, { paperTheme: opts.theme });
    await freezeTimeToDay(page);
    await page.addInitScript(() => {
      localStorage.setItem("zenflow-orb-first-run-dismissed", "1");
    });
    await page.setViewportSize(opts.viewport);
    await page.goto("?nav=v2");
    await page.evaluate(() => document.fonts.ready);

    await expectOrbPageReady(page);

    await page.waitForFunction(
      () => {
        interface W {
          __zenMoodDraft?: unknown;
        }
        return (window as unknown as W).__zenMoodDraft !== undefined;
      },
      { timeout: 5000 }
    );
    await page.evaluate(() => {
      interface DraftHandle {
        setValence: (v: number) => void;
      }
      interface W {
        __zenMoodDraft?: DraftHandle;
      }
      const h = (window as unknown as W).__zenMoodDraft;
      if (h) {
        h.setValence(0.5);
      }
    });
    // Wait for Bloom CTA stagger (cta delay) + initial chip stagger settle.
    await page.waitForTimeout(500);
    await page.getByTestId("orb-page-next").click();
    await page.waitForTimeout(300);
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
        }
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
        }
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
          mask: [page.getByTestId("emotion-tag-chips")],
        }
      );
    });

    test(`mobile: emotion grid expanded — ${themeLabel} (${theme})`, async ({ page }, testInfo) => {
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
      // CI Linux font metrics can expose one fewer wrapped chip above the
      // screenshot fold, but the expanded tier must still reveal the broader set.
      expect(count).toBeGreaterThanOrEqual(14);
      await expect(page.getByTestId("emotion-more-precise")).toHaveAttribute(
        "aria-expanded",
        "true"
      );

      if (theme === "paper") {
        for (const key of ["nostalgic", "appreciated", "content", "loved", "brave"]) {
          await expect(page.getByTestId(`emotion-chip-${key}`)).toBeVisible();
        }
        await expect(page.getByTestId("orb-page-back")).toBeVisible();
        await expect(page.getByTestId("orb-page-open-diary")).toBeVisible();

        const horizontalOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth
        );
        expect(horizontalOverflow).toBeLessThanOrEqual(1);
        await expect(page).toHaveScreenshot(
          `nav-v2-mobile-orb-emotions-expanded-${themeLabel}.png`,
          {
            fullPage: true,
            maxDiffPixelRatio: 0.04,
            animations: "disabled",
            timeout: 30_000,
            mask: [page.getByTestId("emotion-tag-chips")],
          }
        );
        return;
      }

      await expect(page).toHaveScreenshot(`nav-v2-mobile-orb-emotions-expanded-${themeLabel}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.04,
        animations: "disabled",
        timeout: 30_000,
        mask: [page.getByTestId("emotion-tag-chips")],
      });
    });
  }

  test("desktop: Diary draft-card arrival after Orb transfer", async ({ page }, testInfo) => {
    testInfo.setTimeout(60_000);
    await primeApp(page, { paperTheme: "paper" });
    await freezeTimeToDay(page);
    await page.addInitScript(() => {
      localStorage.setItem("zenflow-orb-first-run-dismissed", "1");
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("?nav=v2");
    await page.evaluate(() => document.fonts.ready);

    await page.waitForFunction(
      () => {
        interface W {
          __zenMoodDraft?: unknown;
        }
        return (window as unknown as W).__zenMoodDraft !== undefined;
      },
      { timeout: 5000 }
    );

    await page.evaluate(() => {
      interface DraftHandle {
        setValence: (v: number) => void;
        setEmotion: (e: string | null) => void;
        setNote: (note: string) => void;
      }
      interface W {
        __zenMoodDraft?: DraftHandle;
      }
      const h = (window as unknown as W).__zenMoodDraft;
      if (h) {
        h.setValence(0.5);
      }
    });
    await page.waitForTimeout(300);
    await page.getByTestId("orb-page-next").click();
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      interface DraftHandle {
        setEmotion: (e: string | null) => void;
        setNote: (note: string) => void;
      }
      interface W {
        __zenMoodDraft?: DraftHandle;
      }
      const h = (window as unknown as W).__zenMoodDraft;
      if (h) {
        h.setEmotion("hopeful");
        h.setNote("A small clear moment worth keeping.");
      }
    });
    await page.waitForTimeout(250);
    await page.getByTestId("orb-page-open-diary").click();
    await expect(page.getByText("Loading...")).toHaveCount(0, { timeout: 30_000 });

    await expect(page.getByTestId("diary-page")).toBeVisible();
    await expect(page.getByRole("button", { name: /Continue writing/i }).first()).toBeVisible({
      timeout: 30_000,
    });

    await expect(page).toHaveScreenshot("nav-v2-diary-draft-card-day.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.04,
      animations: "disabled",
      timeout: 30_000,
    });
  });

  test("mobile: Diary draft-card arrival after Orb transfer", async ({ page }, testInfo) => {
    testInfo.setTimeout(60_000);
    await primeApp(page, { paperTheme: "paper" });
    await freezeTimeToDay(page);
    await page.addInitScript(() => {
      localStorage.setItem("zenflow-orb-first-run-dismissed", "1");
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("?nav=v2");
    await page.evaluate(() => document.fonts.ready);

    await page.waitForFunction(
      () => {
        interface W {
          __zenMoodDraft?: unknown;
        }
        return (window as unknown as W).__zenMoodDraft !== undefined;
      },
      { timeout: 5000 }
    );

    await page.evaluate(() => {
      interface DraftHandle {
        setValence: (v: number) => void;
        setEmotion: (e: string | null) => void;
        setNote: (note: string) => void;
      }
      interface W {
        __zenMoodDraft?: DraftHandle;
      }
      const h = (window as unknown as W).__zenMoodDraft;
      if (h) {
        h.setValence(0.5);
      }
    });
    await page.waitForTimeout(300);
    await page.getByTestId("orb-page-next").click();
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      interface DraftHandle {
        setEmotion: (e: string | null) => void;
        setNote: (note: string) => void;
      }
      interface W {
        __zenMoodDraft?: DraftHandle;
      }
      const h = (window as unknown as W).__zenMoodDraft;
      if (h) {
        h.setEmotion("hopeful");
        h.setNote("A small clear moment worth keeping.");
      }
    });
    await page.waitForTimeout(250);
    await page.getByTestId("orb-page-open-diary").click();
    await expect(page.getByText("Loading...")).toHaveCount(0, { timeout: 30_000 });

    await expect(page.getByTestId("diary-page")).toBeVisible();
    await expect(page.getByRole("button", { name: /Continue writing/i }).first()).toBeVisible({
      timeout: 30_000,
    });

    await expect(page).toHaveScreenshot("nav-v2-diary-draft-card-mobile-day.png", {
      fullPage: false,
      maxDiffPixelRatio: 0.04,
      animations: "disabled",
      timeout: 30_000,
    });
  });
});

// Phase 3-A.4c-ii-d-d — MoodSliderV2 (bespoke continuous slider) visual baselines.
//
// Replaces the 12 MoodOrbPicker baselines (picker deleted). Matrix: 18 PNGs.
//   - Idle center (valence 0, no selection): paper/ink/oled × desktop 1280×900 = 3
//   - Valence -1 committed (left extreme): paper/ink/oled × desktop = 3
//   - Valence +1 committed (right extreme): paper/ink/oled × desktop = 3
//   - Mobile idle center: paper/ink × 390×844 = 2
//   - RTL idle center: ar × paper × desktop = 1
//   - RTL valence 0.5 committed: ar × paper × desktop = 1
//   - Keyboard focus: paper × desktop (handle focused) = 1
//   - Reduced-motion: paper × desktop (valence 0.5 committed, prefers-reduced-motion) = 1
//   - Post-commit emotion grid: paper/ink × desktop + paper × mobile = 3
// Total = 18 baselines.
//
// Stability recipe (inherited from d-b, plus slider-specific):
//   1. reducedMotion: 'reduce' via emulateMedia (except the reduced-motion proof test)
//   2. CSS override freezes animation+transition durations to 0ms (except proof test)
//   3. cosmic-orb-flourish-layer + ShootingStar hidden
//   4. document.fonts.ready await (Fraunces)
//   5. 400ms settle after commit (220ms spring + 300ms tint wash)
//   6. Empirical --card assertion for ink/oled themes (catch silent fallback)
//   7. animations: 'disabled' on toHaveScreenshot
// Phase 3-B (2026-04-18) — MoodSliderV2 was replaced by ValenceSlider (old bar)
// on OrbPage per user feedback. These baselines target the retired component
// and are preserved for historical reference only. Re-enable when/if
// MoodSliderV2 returns or rewrite under ValenceSlider DOM contract.
test.describe.skip("MoodSliderV2 Baselines (Phase 3-A.4c-ii-d-d)", () => {
  // Shared setup: prime + freeze time + dismiss first-run + hide flourishes.
  async function setupSliderScene(
    page: import("@playwright/test").Page,
    opts: {
      theme: "paper" | "ink" | "oled";
      viewport: { width: number; height: number };
      rtl?: boolean;
      preserveMotion?: boolean; // for the reduced-motion proof test
    }
  ) {
    if (!opts.preserveMotion) {
      await page.emulateMedia({ reducedMotion: "reduce" });
    } else {
      // Reduced-motion proof test — explicitly request reduce so the CSS
      // @media query branch activates, but DO NOT inject the 0ms override.
      await page.emulateMedia({ reducedMotion: "reduce" });
    }
    await primeApp(page, { paperTheme: opts.theme });
    await freezeTimeToDay(page);
    await page.addInitScript(() => {
      localStorage.setItem("zenflow-orb-first-run-dismissed", "1");
    });
    if (!opts.preserveMotion) {
      // Hide stochastic ShootingStar + freeze all CSS animations/transitions.
      await page.addInitScript(() => {
        const s = document.createElement("style");
        s.setAttribute("data-test-override", "1");
        s.textContent = `
          [data-testid="cosmic-orb-flourish-layer"] { display: none !important; }
          *, *::before, *::after {
            animation-duration: 0ms !important;
            animation-delay: 0ms !important;
            transition-duration: 0ms !important;
            transition-delay: 0ms !important;
          }
        `;
        document.documentElement.appendChild(s);
      });
    } else {
      // Reduced-motion proof: freeze ONLY the cosmic flourish; let the
      // slider's own @media (prefers-reduced-motion) rule do the work.
      await page.addInitScript(() => {
        const s = document.createElement("style");
        s.setAttribute("data-test-override", "1");
        s.textContent = `
          [data-testid="cosmic-orb-flourish-layer"] { display: none !important; }
        `;
        document.documentElement.appendChild(s);
      });
    }
    if (opts.rtl) {
      await page.addInitScript(() => {
        localStorage.setItem("zenflow-language", JSON.stringify("ar"));
        document.documentElement.setAttribute("dir", "rtl");
        document.documentElement.setAttribute("lang", "ar");
      });
    }
    await page.setViewportSize(opts.viewport);
    await page.goto("?nav=v2");
    await page.evaluate(() => document.fonts.ready);

    await expect(page.getByTestId("orb-page")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("mood-slider-v2")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("mood-slider-v2-handle")).toBeVisible();
    await expect(page.getByTestId("mood-slider-v2-track")).toBeVisible();

    // Empirical veracity check for ink/oled: --card token cascade applied.
    // Catches silent paper fallback on non-paper themes (d-c incident lesson).
    if (opts.theme === "ink" || opts.theme === "oled") {
      await expectDarkThemeCardToken(page, opts.theme);
    }

    await page.waitForTimeout(500);
  }

  /**
   * Commit a valence by calling the exposed draft-store handle (deterministic,
   * no framer-motion drag required). Parallel to the d-b/midflow approach.
   */
  async function commitValence(page: import("@playwright/test").Page, valence: number) {
    await page.waitForFunction(
      () => {
        interface W {
          __zenMoodDraft?: unknown;
        }
        return (window as unknown as W).__zenMoodDraft !== undefined;
      },
      { timeout: 5000 }
    );
    await page.evaluate((v) => {
      interface DraftHandle {
        setValence: (v: number) => void;
        setEmotion: (e: string | null) => void;
      }
      interface W {
        __zenMoodDraft?: DraftHandle;
      }
      const h = (window as unknown as W).__zenMoodDraft;
      if (h) {
        h.setValence(v);
      }
    }, valence);
    // Settle: 220ms spring + 300ms tint wash + safety buffer.
    await page.waitForTimeout(400);
  }

  // --- 1. Idle center (no selection) — paper/ink/oled × desktop = 3 ---
  for (const theme of ["paper", "ink", "oled"] as const) {
    test(`desktop idle center — ${theme}`, async ({ page }, testInfo) => {
      testInfo.setTimeout(60_000);
      await setupSliderScene(page, {
        theme,
        viewport: { width: 1280, height: 900 },
      });

      await expect(page.getByTestId("mood-slider-v2")).toHaveAttribute(
        "data-has-selection",
        "false"
      );

      const viewport =
        theme === "paper" ? "desktop-day" : theme === "ink" ? "desktop-night" : "desktop-oled";
      await expect(page).toHaveScreenshot(`nav-v2-mood-slider-idle-${theme}-${viewport}-ltr.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.04,
        animations: "disabled",
        timeout: 30_000,
      });
    });
  }

  // --- 2. Valence -1 (left extreme, committed) — paper/ink/oled × desktop = 3 ---
  for (const theme of ["paper", "ink", "oled"] as const) {
    test(`desktop valence -1 committed — ${theme}`, async ({ page }, testInfo) => {
      testInfo.setTimeout(60_000);
      await setupSliderScene(page, {
        theme,
        viewport: { width: 1280, height: 900 },
      });

      await commitValence(page, -1);

      const viewport =
        theme === "paper" ? "desktop-day" : theme === "ink" ? "desktop-night" : "desktop-oled";
      await expect(page).toHaveScreenshot(`nav-v2-mood-slider-neg1-${theme}-${viewport}-ltr.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.04,
        animations: "disabled",
        timeout: 30_000,
      });
    });
  }

  // --- 3. Valence +1 (right extreme, committed) — paper/ink/oled × desktop = 3 ---
  for (const theme of ["paper", "ink", "oled"] as const) {
    test(`desktop valence +1 committed — ${theme}`, async ({ page }, testInfo) => {
      testInfo.setTimeout(60_000);
      await setupSliderScene(page, {
        theme,
        viewport: { width: 1280, height: 900 },
      });

      await commitValence(page, 1);

      const viewport =
        theme === "paper" ? "desktop-day" : theme === "ink" ? "desktop-night" : "desktop-oled";
      await expect(page).toHaveScreenshot(`nav-v2-mood-slider-pos1-${theme}-${viewport}-ltr.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.04,
        animations: "disabled",
        timeout: 30_000,
      });
    });
  }

  // --- 4. Mobile idle center — paper/ink = 2 ---
  for (const theme of ["paper", "ink"] as const) {
    test(`mobile idle center — ${theme}`, async ({ page }, testInfo) => {
      testInfo.setTimeout(60_000);
      await setupSliderScene(page, {
        theme,
        viewport: { width: 390, height: 844 },
      });

      const viewport = theme === "paper" ? "mobile-day" : "mobile-night";
      await expect(page).toHaveScreenshot(`nav-v2-mood-slider-idle-${theme}-${viewport}-ltr.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.04,
        animations: "disabled",
        timeout: 30_000,
      });
    });
  }

  // --- 5. RTL idle center — ar × paper × desktop = 1 ---
  test("desktop idle center — paper RTL (ar)", async ({ page }, testInfo) => {
    testInfo.setTimeout(60_000);
    await setupSliderScene(page, {
      theme: "paper",
      viewport: { width: 1280, height: 900 },
      rtl: true,
    });

    const htmlDir = await page.locator("html").evaluate((el) => el.getAttribute("dir"));
    expect(htmlDir).toBe("rtl");

    await expect(page).toHaveScreenshot("nav-v2-mood-slider-idle-paper-desktop-day-rtl.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.04,
      animations: "disabled",
      timeout: 30_000,
    });
  });

  // --- 6. RTL valence 0.5 committed — ar × paper × desktop = 1 ---
  test("desktop valence 0.5 committed — paper RTL (ar)", async ({ page }, testInfo) => {
    testInfo.setTimeout(60_000);
    await setupSliderScene(page, {
      theme: "paper",
      viewport: { width: 1280, height: 900 },
      rtl: true,
    });

    await commitValence(page, 0.5);

    await expect(page).toHaveScreenshot("nav-v2-mood-slider-pos05-paper-desktop-day-rtl.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.04,
      animations: "disabled",
      timeout: 30_000,
    });
  });

  // --- 7. Keyboard focus — paper × desktop = 1 ---
  test("desktop keyboard focus — paper", async ({ page }, testInfo) => {
    testInfo.setTimeout(60_000);
    await setupSliderScene(page, {
      theme: "paper",
      viewport: { width: 1280, height: 900 },
    });

    // Focus the handle deterministically.
    await page.getByTestId("mood-slider-v2-handle").focus();
    await page.waitForTimeout(200);

    // Sanity-assert focus landed on the handle (role=slider).
    const focusedTestId = await page.evaluate(() =>
      document.activeElement?.getAttribute("data-testid")
    );
    expect(focusedTestId).toBe("mood-slider-v2-handle");

    await expect(page).toHaveScreenshot("nav-v2-mood-slider-focus-paper-desktop-day-ltr.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.04,
      animations: "disabled",
      timeout: 30_000,
    });
  });

  // --- 8. Reduced-motion proof — paper × desktop = 1 ---
  test("desktop reduced-motion proof — paper, valence 0.5 committed", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);
    await setupSliderScene(page, {
      theme: "paper",
      viewport: { width: 1280, height: 900 },
      preserveMotion: true, // no 0ms override — let the slider's own reduce branch prove itself
    });

    await commitValence(page, 0.5);

    // Proof: handle must not carry the data-animate="true" glow pulse attr.
    // shouldAnimate returns false when prefers-reduced-motion: reduce.
    const animateAttr = await page
      .getByTestId("mood-slider-v2-handle")
      .getAttribute("data-animate");
    expect(animateAttr).toBe("false");

    await expect(page).toHaveScreenshot(
      "nav-v2-mood-slider-reduced-motion-paper-desktop-day-ltr.png",
      {
        fullPage: true,
        maxDiffPixelRatio: 0.04,
        animations: "disabled",
        timeout: 30_000,
      }
    );
  });

  // --- 9-11. Post-commit emotion grid — paper/ink desktop + paper mobile = 3 ---
  // After valence commit with emotion, the emotion-spectrum + chips should
  // bloom below the slider. Captures slider + emotion grid composition.
  test("desktop post-commit emotion grid — paper", async ({ page }, testInfo) => {
    testInfo.setTimeout(60_000);
    await setupSliderScene(page, {
      theme: "paper",
      viewport: { width: 1280, height: 900 },
    });

    await page.evaluate(() => {
      interface DraftHandle {
        setValence: (v: number) => void;
        setEmotion: (e: string | null) => void;
      }
      interface W {
        __zenMoodDraft?: DraftHandle;
      }
      const h = (window as unknown as W).__zenMoodDraft;
      if (h) {
        h.setValence(0);
        h.setEmotion(null);
      }
    });
    await page.waitForTimeout(600);
    await expect(page.getByTestId("orb-page-emotion-spectrum")).toBeVisible();

    await expect(page).toHaveScreenshot("nav-v2-mood-slider-postcommit-paper-desktop-day-ltr.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
      animations: "disabled",
      timeout: 30_000,
    });
  });

  test("desktop post-commit emotion grid — ink", async ({ page }, testInfo) => {
    testInfo.setTimeout(60_000);
    await setupSliderScene(page, {
      theme: "ink",
      viewport: { width: 1280, height: 900 },
    });

    await page.evaluate(() => {
      interface DraftHandle {
        setValence: (v: number) => void;
        setEmotion: (e: string | null) => void;
      }
      interface W {
        __zenMoodDraft?: DraftHandle;
      }
      const h = (window as unknown as W).__zenMoodDraft;
      if (h) {
        h.setValence(0);
        h.setEmotion(null);
      }
    });
    await page.waitForTimeout(600);
    await expect(page.getByTestId("orb-page-emotion-spectrum")).toBeVisible();

    await expect(page).toHaveScreenshot("nav-v2-mood-slider-postcommit-ink-desktop-night-ltr.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
      animations: "disabled",
      timeout: 30_000,
    });
  });

  test("mobile post-commit emotion grid — paper", async ({ page }, testInfo) => {
    testInfo.setTimeout(60_000);
    await setupSliderScene(page, {
      theme: "paper",
      viewport: { width: 390, height: 844 },
    });

    await page.evaluate(() => {
      interface DraftHandle {
        setValence: (v: number) => void;
        setEmotion: (e: string | null) => void;
      }
      interface W {
        __zenMoodDraft?: DraftHandle;
      }
      const h = (window as unknown as W).__zenMoodDraft;
      if (h) {
        h.setValence(0);
        h.setEmotion(null);
      }
    });
    await page.waitForTimeout(600);
    await expect(page.getByTestId("orb-page-emotion-spectrum")).toBeVisible();

    await expect(page).toHaveScreenshot("nav-v2-mood-slider-postcommit-paper-mobile-day-ltr.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
      animations: "disabled",
      timeout: 30_000,
    });
  });
});

// Phase 3-A.4c-ii-d-c Task #41 TAKE 2 — SidebarV2 ink/oled coverage.
//
// Task #39 TAKE 2 lifted ink/oled blocks out of @layer theme so --card tokens
// reach SidebarV2 (which uses `bg-card/80 backdrop-blur-lg` + `border-border`).
// Task #40 verified via getComputedStyle that --card is `34 4% 18%` under ink
// and `30 3% 11%` under oled. This describe block captures the visual result
// on desktop (1280×900) for both expanded (w-64=256px) and collapsed (w-[72px])
// states. Mobile viewport skipped: sidebar is `hidden md:flex` (767px-and-below
// uses DrawerV2 trigger only — no sidebar surface to regress on).
//
// Empirical sanity check baked in: before screenshotting, we assert the
// computed --card is ink/oled (not paper white). Catches silent fallback.
test.describe("SidebarV2 Theme Coverage (Phase 3-A.4c-ii-d-c)", () => {
  async function setupSidebarThemeScene(
    page: import("@playwright/test").Page,
    opts: { theme: "ink" | "oled"; collapsed: boolean }
  ) {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await primeApp(page, { paperTheme: opts.theme });
    await freezeTimeToDay(page);
    await page.addInitScript(() => {
      localStorage.setItem("zenflow-orb-first-run-dismissed", "1");
    });
    // Hide stochastic flourishes + freeze animations (same recipe as mood-orb).
    await page.addInitScript(() => {
      const s = document.createElement("style");
      s.setAttribute("data-test-override", "1");
      s.textContent = `
        [data-testid="cosmic-orb-flourish-layer"] { display: none !important; }
        *, *::before, *::after {
          animation-duration: 0ms !important;
          animation-delay: 0ms !important;
          transition-duration: 0ms !important;
          transition-delay: 0ms !important;
        }
      `;
      document.documentElement.appendChild(s);
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("?nav=v2");
    await page.evaluate(() => document.fonts.ready);

    await expect(page.getByTestId("orb-page")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("sidebar-v2")).toBeVisible({
      timeout: 10_000,
    });

    // Empirical veracity check: --card must be ink/oled, not paper.
    await expectDarkThemeCardToken(page, opts.theme);

    // Collapsed state is useState-only (not persisted) — click toggle.
    if (opts.collapsed) {
      await page.getByTestId("sidebar-v2-collapse-toggle").click();
      // Wait for width transition (300ms ease-out + safety margin).
      await page.waitForTimeout(500);
    }

    await page.waitForTimeout(400);
  }

  for (const theme of ["ink", "oled"] as const) {
    for (const state of ["expanded", "collapsed"] as const) {
      test(`sidebar ${state} — ${theme} — desktop`, async ({ page }, testInfo) => {
        testInfo.setTimeout(60_000);
        await setupSidebarThemeScene(page, {
          theme,
          collapsed: state === "collapsed",
        });

        await expect(page).toHaveScreenshot(`nav-v2-sidebar-${theme}-${state}-desktop.png`, {
          fullPage: true,
          maxDiffPixelRatio: 0.04,
          animations: "disabled",
          timeout: 30_000,
        });
      });
    }
  }
});
