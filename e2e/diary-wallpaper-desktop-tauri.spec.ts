import { expect, test, type Page } from "@playwright/test";

import { primeZenflowV2, v2RoutePath, type ZenflowV2Language, type ZenflowV2Theme } from "./helpers/zenflowV2State";

test.use({ timezoneId: "UTC" });

type DesktopDiaryWallpaperScenario = {
  colorScheme: "dark" | "light";
  expectedTone: "day" | "night";
  language: ZenflowV2Language;
  name: string;
  theme: ZenflowV2Theme;
  viewport: { height: number; width: number };
  wallClockIso: string;
};

const scenarios: DesktopDiaryWallpaperScenario[] = [
  {
    name: "desktop-default-day",
    colorScheme: "light",
    expectedTone: "day",
    language: "en",
    theme: "paper",
    viewport: { width: 1200, height: 820 },
    wallClockIso: "2026-06-17T12:00:00.000Z",
  },
  {
    name: "desktop-default-night",
    colorScheme: "dark",
    expectedTone: "night",
    language: "en",
    theme: "ink",
    viewport: { width: 1200, height: 820 },
    wallClockIso: "2026-06-17T23:00:00.000Z",
  },
  {
    name: "desktop-paper-natural-night",
    colorScheme: "dark",
    expectedTone: "night",
    language: "en",
    theme: "paper",
    viewport: { width: 1200, height: 820 },
    wallClockIso: "2026-06-18T02:00:00.000Z",
  },
  {
    name: "desktop-minimum-rtl-ar-day",
    colorScheme: "light",
    expectedTone: "day",
    language: "ar",
    theme: "paper",
    viewport: { width: 390, height: 640 },
    wallClockIso: "2026-06-17T12:00:00.000Z",
  },
  {
    name: "desktop-wide-rtl-he-night",
    colorScheme: "dark",
    expectedTone: "night",
    language: "he",
    theme: "oled",
    viewport: { width: 1440, height: 900 },
    wallClockIso: "2026-06-17T23:00:00.000Z",
  },
];

async function openDesktopDiary(page: Page, scenario: DesktopDiaryWallpaperScenario) {
  await page.setViewportSize(scenario.viewport);
  await page.clock.setFixedTime(new Date(scenario.wallClockIso));
  await primeZenflowV2(page, {
    clearStorage: true,
    language: scenario.language,
    privacyNoTracking: true,
    theme: scenario.theme,
    user: {
      id: "desktop-wallpaper-" + scenario.name,
      name: "Desktop Wallpaper Auditor",
    },
  });

  await page.goto(v2RoutePath("diary", { layout: "desktop" }), {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByTestId("journal-page-shell")).toBeVisible({ timeout: 30_000 });
}

test.describe("Desktop/Tauri V2 Diary wallpaper", () => {
  test.describe.configure({ timeout: 90_000 });

  for (const scenario of scenarios) {
    test(scenario.name + ": renders the shared premium wallpaper without layout leaks", async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scenario.colorScheme, reducedMotion: "reduce" });
      await openDesktopDiary(page, scenario);

      const wallpaper = page.getByTestId("journal-wallpaper");
      await expect(wallpaper).toHaveCount(1);
      await expect(wallpaper).toHaveAttribute("data-wallpaper-surface", "page");
      await expect(wallpaper).toHaveAttribute("data-wallpaper-tone", scenario.expectedTone);
      await expect(wallpaper).toHaveAttribute("data-wallpaper-motion", "static");
      await expect(wallpaper).toHaveAttribute("data-wallpaper-platform", "universal");

      const facts = await page.evaluate(() => {
        const wallpaper = document.querySelector<HTMLElement>("[data-testid='journal-wallpaper']");
        const shell = document.querySelector<HTMLElement>("[data-testid='journal-page-shell']");
        const desktopVista = document.querySelector<HTMLElement>(".journal-wallpaper__desktop-vista");
        const luminanceWash = document.querySelector<HTMLElement>(".journal-wallpaper__luminance-wash");
        const memoryBloom = document.querySelector<HTMLElement>(".journal-wallpaper__memory-bloom");
        if (!wallpaper || !shell || !desktopVista || !luminanceWash || !memoryBloom) return null;

        const wallpaperRect = wallpaper.getBoundingClientRect();
        const shellRect = shell.getBoundingClientRect();
        const wallpaperStyle = window.getComputedStyle(wallpaper);
        const dir = shell.getAttribute("dir");

        return {
          backgroundImage: wallpaperStyle.backgroundImage,
          desktopVistaOpacity: Number.parseFloat(window.getComputedStyle(desktopVista).opacity),
          dir,
          horizontalOverflow:
            document.documentElement.scrollWidth - document.documentElement.clientWidth,
          luminanceWashOpacity: Number.parseFloat(window.getComputedStyle(luminanceWash).opacity),
          memoryBloomOpacity: Number.parseFloat(window.getComputedStyle(memoryBloom).opacity),
          pointerEvents: wallpaperStyle.pointerEvents,
          position: wallpaperStyle.position,
          shellHeight: shellRect.height,
          shellWidth: shellRect.width,
          wallpaperHeight: wallpaperRect.height,
          wallpaperWidth: wallpaperRect.width,
          zIndex: wallpaperStyle.zIndex,
        };
      });

      expect(facts).not.toBeNull();
      expect(facts?.horizontalOverflow).toBeLessThanOrEqual(1);
      expect(facts?.pointerEvents).toBe("none");
      expect(facts?.position).toBe("absolute");
      expect(facts?.backgroundImage).toContain("radial-gradient");
      expect(facts?.backgroundImage).not.toContain("url(");
      expect(facts?.memoryBloomOpacity).toBeGreaterThan(0);
      expect(facts?.luminanceWashOpacity).toBeGreaterThan(0);
      expect(facts?.shellWidth).toBeGreaterThan(0);
      expect(facts?.shellHeight).toBeGreaterThan(0);
      expect(facts?.wallpaperWidth).toBeGreaterThanOrEqual((facts?.shellWidth ?? 0) - 1);
      expect(facts?.wallpaperHeight).toBeGreaterThanOrEqual((facts?.shellHeight ?? 0) - 1);
      expect(facts?.zIndex).toBe("0");

      if (scenario.viewport.width >= 1024) {
        expect(facts?.desktopVistaOpacity).toBeGreaterThan(0);
      }

      if (scenario.language === "ar" || scenario.language === "he") {
        expect(facts?.dir).toBe("rtl");
      } else {
        expect(facts?.dir).toBe("ltr");
      }
    });
  }
});
