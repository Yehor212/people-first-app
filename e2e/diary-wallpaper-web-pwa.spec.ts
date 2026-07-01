import { expect, test, type Page } from "@playwright/test";

import { primeZenflowV2, v2RoutePath, type ZenflowV2Theme } from "./helpers/zenflowV2State";

test.use({ timezoneId: "UTC" });

type WebkitCSSStyleDeclaration = CSSStyleDeclaration & {
  webkitBackdropFilter?: string;
};

type DiaryWallpaperWebScenario = {
  expectedTone: "day" | "night";
  layout: "desktop" | "phone";
  name: string;
  standalone: boolean;
  theme: ZenflowV2Theme;
  viewport: { height: number; width: number };
  wallClockIso: string;
};

async function emulateCssMediaFeature(page: Page, name: string, value: string) {
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setEmulatedMedia", {
    features: [{ name, value }],
  });
}

const scenarios: DiaryWallpaperWebScenario[] = [
  {
    name: "web-desktop-day",
    expectedTone: "day",
    layout: "desktop",
    standalone: false,
    theme: "paper",
    viewport: { width: 1280, height: 900 },
    wallClockIso: "2026-06-17T12:00:00.000Z",
  },
  {
    name: "pwa-phone-night",
    expectedTone: "night",
    layout: "phone",
    standalone: true,
    theme: "oled",
    viewport: { width: 390, height: 844 },
    wallClockIso: "2026-06-17T23:00:00.000Z",
  },
  {
    name: "pwa-phone-day",
    expectedTone: "day",
    layout: "phone",
    standalone: true,
    theme: "paper",
    viewport: { width: 390, height: 844 },
    wallClockIso: "2026-06-17T12:00:00.000Z",
  },
  {
    name: "web-phone-paper-natural-night",
    expectedTone: "night",
    layout: "phone",
    standalone: false,
    theme: "paper",
    viewport: { width: 390, height: 844 },
    wallClockIso: "2026-06-18T02:00:00.000Z",
  },
];

async function openDiary(page: Page, scenario: DiaryWallpaperWebScenario) {
  await page.setViewportSize(scenario.viewport);
  await page.clock.setFixedTime(new Date(scenario.wallClockIso));

  if (scenario.standalone) {
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, "standalone", {
        configurable: true,
        value: true,
      });
    });
  }

  await primeZenflowV2(page, {
    clearStorage: true,
    language: "en",
    privacyNoTracking: true,
    theme: scenario.theme,
    user: {
      id: "web-pwa-wallpaper-" + scenario.name,
      name: "Web PWA Wallpaper Auditor",
    },
  });

  await page.goto(v2RoutePath("diary", { layout: scenario.layout }), {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByTestId("journal-page-shell")).toBeVisible({ timeout: 30_000 });
}

test.describe("Web/PWA V2 Diary wallpaper", () => {
  test.describe.configure({ timeout: 90_000 });

  for (const scenario of scenarios) {
    test(scenario.name + ": keeps the premium day/night wallpaper self-contained", async ({
      page,
    }) => {
      await openDiary(page, scenario);

      const wallpaper = page.locator(
        '[data-testid="journal-page-shell"] > [data-testid="journal-wallpaper"]',
      );
      await expect(wallpaper).toHaveCount(1);
      await expect(wallpaper).toHaveAttribute("data-wallpaper-tone", scenario.expectedTone);
      await expect(wallpaper).toHaveAttribute("data-wallpaper-platform", "universal");
      await expect(wallpaper).toHaveAttribute("data-wallpaper-motion", "static");

      const facts = await page.evaluate(() => {
        const wallpaper = document.querySelector<HTMLElement>(
          "[data-testid='journal-page-shell'] > [data-testid='journal-wallpaper']",
        );
        const shell = document.querySelector<HTMLElement>("[data-testid='journal-page-shell']");
        const memoryBloom = document.querySelector<HTMLElement>(".journal-wallpaper__memory-bloom");
        const luminanceWash = document.querySelector<HTMLElement>(".journal-wallpaper__luminance-wash");
        const desktopVista = document.querySelector<HTMLElement>(".journal-wallpaper__desktop-vista");
        const scenicVista = document.querySelector<HTMLElement>(".journal-wallpaper__scenic-vista");
        if (!wallpaper || !shell || !memoryBloom || !luminanceWash || !desktopVista || !scenicVista) return null;

        const wallpaperRect = wallpaper.getBoundingClientRect();
        const shellRect = shell.getBoundingClientRect();
        const wallpaperStyle = window.getComputedStyle(wallpaper);

        return {
          backgroundImage: wallpaperStyle.backgroundImage,
          desktopVistaOpacity: Number.parseFloat(window.getComputedStyle(desktopVista).opacity),
          horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          isNavigatorStandalone: Boolean("standalone" in window.navigator && window.navigator.standalone),
          luminanceWashOpacity: Number.parseFloat(window.getComputedStyle(luminanceWash).opacity),
          memoryBloomOpacity: Number.parseFloat(window.getComputedStyle(memoryBloom).opacity),
          pointerEvents: wallpaperStyle.pointerEvents,
          scenicBackgroundImage: window.getComputedStyle(scenicVista).backgroundImage,
          scenicMixBlendMode: window.getComputedStyle(scenicVista).mixBlendMode,
          scenicOpacity: Number.parseFloat(window.getComputedStyle(scenicVista).opacity),
          shellHeight: shellRect.height,
          shellWidth: shellRect.width,
          wallpaperHeight: wallpaperRect.height,
          wallpaperWidth: wallpaperRect.width,
        };
      });

      expect(facts).not.toBeNull();
      expect(facts?.horizontalOverflow).toBeLessThanOrEqual(1);
      expect(facts?.pointerEvents).toBe("none");
      expect(facts?.wallpaperWidth).toBeGreaterThanOrEqual((facts?.shellWidth ?? 0) - 1);
      expect(facts?.wallpaperHeight).toBeGreaterThanOrEqual((facts?.shellHeight ?? 0) - 1);
      expect(facts?.backgroundImage).toContain("radial-gradient");
      expect(facts?.backgroundImage).not.toContain("url(");
      if (scenario.expectedTone === "day") {
        expect(facts?.scenicBackgroundImage).toContain("daylight-journal-wallpaper");
        expect(facts?.scenicBackgroundImage).not.toContain("aurora-mountains");
      } else {
        expect(facts?.scenicBackgroundImage).toContain("aurora-mountains");
      }
      expect(facts?.scenicOpacity).toBeGreaterThan(0);
      if (scenario.expectedTone === "day") {
        expect(facts?.scenicOpacity).toBeGreaterThanOrEqual(0.68);
        expect(facts?.scenicMixBlendMode).toBe("normal");
      }
      expect(facts?.memoryBloomOpacity).toBeGreaterThan(0);
      expect(facts?.luminanceWashOpacity).toBeGreaterThan(0);

      if (scenario.standalone) {
        expect(facts?.isNavigatorStandalone).toBe(true);
      }

      if (scenario.layout === "desktop") {
        expect(facts?.desktopVistaOpacity).toBeGreaterThan(0);
      }
    });
  }


  test("paper day honors reduced-transparency without keeping the full scenic layer", async ({
    browserName,
    page,
  }) => {
    test.skip(browserName !== "chromium", "CDP media feature emulation is Chromium-only.");

    await emulateCssMediaFeature(page, "prefers-reduced-transparency", "reduce");
    await openDiary(page, scenarios[0]);

    const facts = await page.evaluate(() => {
      const scenicVista = document.querySelector<HTMLElement>(".journal-wallpaper__scenic-vista");
      const sidebar = document.querySelector<HTMLElement>("[data-testid='journal-sidebar-wide']");
      const primaryAction = document.querySelector<HTMLElement>(
        "[data-testid='diary-empty-canvas'] button, [data-testid='journal-entry-editor'] button",
      );
      if (!scenicVista) return null;

      const scenicStyle = window.getComputedStyle(scenicVista);
      const sidebarStyle = sidebar ? window.getComputedStyle(sidebar) as WebkitCSSStyleDeclaration : null;
      const primaryRect = primaryAction?.getBoundingClientRect();
      const topElement = primaryRect
        ? document.elementFromPoint(
            primaryRect.left + primaryRect.width / 2,
            primaryRect.top + primaryRect.height / 2,
          )
        : null;

      return {
        backdropFilter: sidebarStyle ? sidebarStyle.backdropFilter || sidebarStyle.webkitBackdropFilter : "none",
        horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        matchMedia: window.matchMedia("(prefers-reduced-transparency: reduce)").matches,
        primaryActionUnobstructed: primaryAction ? Boolean(topElement?.closest("button")) : true,
        scenicFilter: scenicStyle.filter,
        scenicMixBlendMode: scenicStyle.mixBlendMode,
        scenicOpacity: Number.parseFloat(scenicStyle.opacity),
      };
    });

    expect(facts).not.toBeNull();
    expect(facts?.matchMedia).toBe(true);
    expect(facts?.horizontalOverflow).toBeLessThanOrEqual(1);
    expect(facts?.primaryActionUnobstructed).toBe(true);
    expect(facts?.scenicOpacity).toBeLessThanOrEqual(0.18);
    expect(facts?.scenicFilter).toBe("none");
    expect(facts?.scenicMixBlendMode).toBe("normal");
    expect(facts?.backdropFilter).toBe("none");
  });

  test("paper day hides decorative wallpaper in forced colors", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await openDiary(page, scenarios[0]);

    const facts = await page.evaluate(() => {
      const wallpaper = document.querySelector<HTMLElement>(
        "[data-testid='journal-page-shell'] > [data-testid='journal-wallpaper']",
      );
      const sidebar = document.querySelector<HTMLElement>("[data-testid='journal-sidebar-wide']");
      if (!wallpaper || !sidebar) return null;

      const sidebarStyle = window.getComputedStyle(sidebar) as WebkitCSSStyleDeclaration;
      return {
        horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        sidebarBackdropFilter: sidebarStyle.backdropFilter || sidebarStyle.webkitBackdropFilter,
        sidebarBackgroundColor: sidebarStyle.backgroundColor,
        wallpaperDisplay: window.getComputedStyle(wallpaper).display,
      };
    });

    expect(facts).not.toBeNull();
    expect(facts?.horizontalOverflow).toBeLessThanOrEqual(1);
    expect(facts?.wallpaperDisplay).toBe("none");
    expect(facts?.sidebarBackdropFilter).toBe("none");
    expect(facts?.sidebarBackgroundColor).not.toContain("rgba");
  });
});
