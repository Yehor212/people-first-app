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

// Phase 3-A.4c-ii-d-b — MoodOrbPicker (5 discrete orbs) visual baselines.
//
// Matrix: 12 PNGs.
//   - Idle (no selection): day + night × desktop + mobile = 4
//   - Selected hue echo (day desktop, all 5 tints 250/220/40/80/120) = 5
//   - Neutral selected: night × desktop + mobile = 2
//   - RTL idle: day desktop [dir="rtl"] row-reverse smoke = 1
// Total = 12 baselines.
//
// Stability recipe (lessons from emotion-grid baselines in 18690354):
//   1. reducedMotion: 'reduce' via page.emulateMedia — halts ValenceOrb breathe
//      loop + --page-tint transition.
//   2. await document.fonts.ready — Fraunces italic small-caps FOUC guard.
//   3. ShootingStar stochastic layer: CSS override hides it in test builds.
//   4. animations: 'disabled' on toHaveScreenshot — Playwright pauses
//      in-flight CSS/SVG/Web Animations for the screenshot frame.
//   5. After click, waitForTimeout(400) to settle 220ms opacity + scale
//      transition + the --page-tint CSS var wash (the .mood-orb-option
//      transition is 220ms, double it for safety).
test.describe("MoodOrbPicker Baselines (Phase 3-A.4c-ii-d-b)", () => {
  // Shared setup: prime + freeze time + dismiss first-run hint + hide
  // stochastic background flourishes, then navigate and wait fonts ready.
  async function setupMoodOrbPickerScene(
    page: import("@playwright/test").Page,
    opts: {
      theme: "paper" | "ink";
      viewport: { width: number; height: number };
      rtl?: boolean;
    },
  ) {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await primeApp(page, { paperTheme: opts.theme });
    await freezeTimeToDay(page);
    await page.addInitScript(() => {
      localStorage.setItem("zenflow-orb-first-run-dismissed", "1");
    });
    // Hide stochastic ShootingStar (cosmic flourish layer) via style tag —
    // positions are random per render and defeat pixel determinism.
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
    if (opts.rtl) {
      // Switch language to Arabic via localStorage — the app's LanguageContext
      // then sets <html dir="rtl"> natively (Law 17). This is more robust
      // than overriding dir manually which i18n provider overwrites on mount.
      await page.addInitScript(() => {
        localStorage.setItem("zenflow-language", JSON.stringify("ar"));
        // Kick dir on init too in case our init script runs before i18n boot.
        document.documentElement.setAttribute("dir", "rtl");
        document.documentElement.setAttribute("lang", "ar");
      });
    }
    await page.setViewportSize(opts.viewport);
    await page.goto("/?nav=v2");
    await page.evaluate(() => document.fonts.ready);

    // Night/ink + mobile combos take longer to paint — give generous
    // mount timeout. First test in cold-start may incur HMR/dev-server penalty.
    await expect(page.getByTestId("orb-page")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("mood-orb-picker")).toBeVisible({
      timeout: 10_000,
    });
    // 5 orbs rendered.
    await expect(
      page.locator('[data-testid^="mood-orb-option-"]'),
    ).toHaveCount(5);
    // Fonts + initial Bloom stagger settle.
    await page.waitForTimeout(500);
  }

  // --- 1. Idle (no selection) baselines — day+night × desktop+mobile ---
  for (const theme of ["paper", "ink"] as const) {
    const themeLabel = theme === "paper" ? "day" : "night";

    test(`desktop idle — ${themeLabel} (${theme})`, async ({
      page,
    }, testInfo) => {
      testInfo.setTimeout(60_000);
      await setupMoodOrbPickerScene(page, {
        theme,
        viewport: { width: 1440, height: 900 },
      });

      // No orb selected.
      await expect(
        page.getByTestId("mood-orb-picker"),
      ).toHaveAttribute("data-has-selection", "false");

      await expect(page).toHaveScreenshot(
        `nav-v2-mood-orb-picker-idle-desktop-${themeLabel}.png`,
        {
          fullPage: true,
          maxDiffPixelRatio: 0.04,
          animations: "disabled",
          timeout: 30_000,
        },
      );
    });

    test(`mobile idle — ${themeLabel} (${theme})`, async ({
      page,
    }, testInfo) => {
      testInfo.setTimeout(60_000);
      await setupMoodOrbPickerScene(page, {
        theme,
        viewport: { width: 390, height: 844 },
      });

      await expect(page).toHaveScreenshot(
        `nav-v2-mood-orb-picker-idle-mobile-${themeLabel}.png`,
        {
          fullPage: true,
          maxDiffPixelRatio: 0.04,
          animations: "disabled",
          timeout: 30_000,
        },
      );
    });
  }

  // --- 2. Selected baselines (5 tints on day desktop) ---
  // Captures each hue echo for --page-tint: 250, 220, 40, 80, 120.
  const MOODS = [
    { mood: "terrible", hue: 250, slug: "very-unpleasant" },
    { mood: "bad", hue: 220, slug: "unpleasant" },
    { mood: "okay", hue: 40, slug: "neutral" },
    { mood: "good", hue: 80, slug: "pleasant" },
    { mood: "great", hue: 120, slug: "very-pleasant" },
  ] as const;

  for (const { mood, hue, slug } of MOODS) {
    test(`desktop selected — ${slug} (hue ${hue}) — day`, async ({
      page,
    }, testInfo) => {
      testInfo.setTimeout(60_000);
      await setupMoodOrbPickerScene(page, {
        theme: "paper",
        viewport: { width: 1440, height: 900 },
      });

      await page.getByTestId(`mood-orb-option-${mood}`).click();
      // Settle transitions: opacity 220ms + transform 220ms + tint CSS var.
      await page.waitForTimeout(400);

      await expect(
        page.getByTestId("mood-orb-picker"),
      ).toHaveAttribute("data-has-selection", "true");

      // Sanity-assert the aria-checked state flipped on the clicked orb.
      await expect(
        page.getByTestId(`mood-orb-option-${mood}`),
      ).toHaveAttribute("aria-checked", "true");

      // Neutral (hue 40) is also our color-echo assertion target.
      if (mood === "okay") {
        const tint = await page
          .getByTestId("mood-orb-picker")
          .evaluate((el) => (el as HTMLElement).style.getPropertyValue(
            "--page-tint",
          ));
        expect(tint).toMatch(/hsla?\(\s*40/);
      }

      await expect(page).toHaveScreenshot(
        `nav-v2-mood-orb-picker-${slug}-day-desktop.png`,
        {
          fullPage: true,
          maxDiffPixelRatio: 0.04,
          animations: "disabled",
          timeout: 30_000,
        },
      );
    });
  }

  // --- 3. Night theme + neutral selected (desktop + mobile) ---
  for (const vp of [
    { label: "desktop", width: 1440, height: 900 },
    { label: "mobile", width: 390, height: 844 },
  ] as const) {
    test(`${vp.label} selected — neutral — night`, async ({
      page,
    }, testInfo) => {
      testInfo.setTimeout(60_000);
      await setupMoodOrbPickerScene(page, {
        theme: "ink",
        viewport: { width: vp.width, height: vp.height },
      });

      await page.getByTestId("mood-orb-option-okay").click();
      await page.waitForTimeout(400);

      await expect(
        page.getByTestId("mood-orb-option-okay"),
      ).toHaveAttribute("aria-checked", "true");

      await expect(page).toHaveScreenshot(
        `nav-v2-mood-orb-picker-neutral-night-${vp.label}.png`,
        {
          fullPage: true,
          maxDiffPixelRatio: 0.04,
          animations: "disabled",
          timeout: 30_000,
        },
      );
    });
  }

  // --- 4. RTL smoke (day desktop, no selection) ---
  test("rtl idle — day desktop (row-reverse)", async ({ page }, testInfo) => {
    testInfo.setTimeout(60_000);
    await setupMoodOrbPickerScene(page, {
      theme: "paper",
      viewport: { width: 1440, height: 900 },
      rtl: true,
    });

    // Verify dir="rtl" applied to <html> at screenshot time. CSS row-reverse
    // rule is validated visually via the baseline PNG (pixel diff catches
    // regression if LTR creeps back in).
    const htmlDir = await page
      .locator("html")
      .evaluate((el) => el.getAttribute("dir"));
    expect(htmlDir).toBe("rtl");

    await expect(page).toHaveScreenshot(
      "nav-v2-mood-orb-picker-idle-rtl-day-desktop.png",
      {
        fullPage: true,
        maxDiffPixelRatio: 0.04,
        animations: "disabled",
        timeout: 30_000,
      },
    );
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
    opts: { theme: "ink" | "oled"; collapsed: boolean },
  ) {
    await page.emulateMedia({ reducedMotion: "reduce" });
    // primeApp only supports paper|ink — for oled, prime with paper then
    // overwrite the theme-v0c key with oled via second init script.
    await primeApp(page, {
      paperTheme: opts.theme === "oled" ? "paper" : opts.theme,
    });
    if (opts.theme === "oled") {
      await page.addInitScript(() => {
        localStorage.setItem(
          "zenflow:theme-v0c",
          JSON.stringify({ state: { theme: "oled" }, version: 0 }),
        );
      });
    }
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
    await page.goto("/?nav=v2");
    await page.evaluate(() => document.fonts.ready);

    await expect(page.getByTestId("orb-page")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("sidebar-v2")).toBeVisible({
      timeout: 10_000,
    });

    // Empirical veracity check: --card must be ink/oled, not paper.
    const cardHsl = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--card")
        .trim(),
    );
    const expected =
      opts.theme === "ink" ? "34 4% 18%" : "30 3% 11%";
    expect(cardHsl).toBe(expected);

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
      test(`sidebar ${state} — ${theme} — desktop`, async ({
        page,
      }, testInfo) => {
        testInfo.setTimeout(60_000);
        await setupSidebarThemeScene(page, {
          theme,
          collapsed: state === "collapsed",
        });

        await expect(page).toHaveScreenshot(
          `nav-v2-sidebar-${theme}-${state}-desktop.png`,
          {
            fullPage: true,
            maxDiffPixelRatio: 0.04,
            animations: "disabled",
            timeout: 30_000,
          },
        );
      });
    }
  }
});
