import { expect, test, type Page } from "@playwright/test";

import { primeZenflowV2, v2RoutePath, type ZenflowV2Theme } from "./helpers/zenflowV2State";

test.use({ timezoneId: "UTC" });

type DiaryWallpaperWebScenario = {
  expectedTone: "day" | "night";
  layout: "desktop" | "phone";
  name: string;
  standalone: boolean;
  theme: ZenflowV2Theme;
  viewport: { height: number; width: number };
  wallClockIso: string;
};

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

      const wallpaper = page.getByTestId("journal-wallpaper");
      await expect(wallpaper).toHaveCount(1);
      await expect(wallpaper).toHaveAttribute("data-wallpaper-tone", scenario.expectedTone);
      await expect(wallpaper).toHaveAttribute("data-wallpaper-platform", "universal");
      await expect(wallpaper).toHaveAttribute("data-wallpaper-motion", "static");

      const facts = await page.evaluate(() => {
        const wallpaper = document.querySelector<HTMLElement>("[data-testid='journal-wallpaper']");
        const shell = document.querySelector<HTMLElement>("[data-testid='journal-page-shell']");
        const memoryBloom = document.querySelector<HTMLElement>(".journal-wallpaper__memory-bloom");
        const luminanceWash = document.querySelector<HTMLElement>(".journal-wallpaper__luminance-wash");
        const desktopVista = document.querySelector<HTMLElement>(".journal-wallpaper__desktop-vista");
        if (!wallpaper || !shell || !memoryBloom || !luminanceWash || !desktopVista) return null;

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
});
