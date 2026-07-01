import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

import { primeZenflowV2, v2RoutePath, type ZenflowV2Language, type ZenflowV2Theme } from "./helpers/zenflowV2State";

test.use({ timezoneId: "UTC" });

type WebkitCSSStyleDeclaration = CSSStyleDeclaration & {
  webkitBackdropFilter?: string;
};

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
    viewport: { width: 1280, height: 820 },
    wallClockIso: "2026-06-17T12:00:00.000Z",
  },
  {
    name: "desktop-default-night",
    colorScheme: "dark",
    expectedTone: "night",
    language: "en",
    theme: "ink",
    viewport: { width: 1280, height: 820 },
    wallClockIso: "2026-06-17T23:00:00.000Z",
  },
  {
    name: "desktop-paper-natural-night",
    colorScheme: "dark",
    expectedTone: "night",
    language: "en",
    theme: "paper",
    viewport: { width: 1280, height: 820 },
    wallClockIso: "2026-06-18T02:00:00.000Z",
  },
  {
    name: "desktop-minimum-rtl-ar-day",
    colorScheme: "light",
    expectedTone: "day",
    language: "ar",
    theme: "paper",
    viewport: { width: 1280, height: 720 },
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

async function meanAbsolutePixelDelta(before: Buffer, after: Buffer): Promise<number> {
  const beforeImage = await sharp(before).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const afterImage = await sharp(after)
    .removeAlpha()
    .resize(beforeImage.info.width, beforeImage.info.height, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const length = Math.min(beforeImage.data.length, afterImage.data.length);
  let totalDelta = 0;
  for (let index = 0; index < length; index += 1) {
    totalDelta += Math.abs(beforeImage.data[index] - afterImage.data[index]);
  }

  return totalDelta / length;
}

async function clippedPaneScreenshot(page: Page, testId: string): Promise<Buffer> {
  const locator = page.getByTestId(testId);
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error(testId + " bounding box is missing");

  return page.screenshot({
    animations: "disabled",
    clip: {
      x: Math.max(0, Math.floor(box.x + 24)),
      y: Math.max(0, Math.floor(box.y + 24)),
      width: Math.max(1, Math.floor(box.width - 48)),
      height: Math.max(1, Math.floor(box.height - 48)),
    },
  });
}


async function seedDesktopSidebarEntries(page: Page) {
  await page.evaluate(async () => {
    const request = indexedDB.open("ZenFlowDB");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onerror = () => reject(new Error(request.error?.message || "IndexedDB open failed"));
      request.onsuccess = () => resolve(request.result);
    });

    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    const tx = db.transaction("journalEntries", "readwrite");
    const store = tx.objectStore("journalEntries");
    await new Promise<void>((resolve, reject) => {
      const clear = store.clear();
      clear.onsuccess = () => resolve();
      clear.onerror = () => reject(new Error(clear.error?.message || "IndexedDB clear failed"));
    });

    [
      {
        id: "desktop-sidebar-entry-1",
        title: "Quiet sidebar readability note",
        content: "<p>The sidebar should feel like a private notebook cover while this preview stays readable.</p>",
        tags: ["reflection", "calm"],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "desktop-sidebar-entry-2",
        title: "Small gratitude note",
        content: "<p>Soft contrast, stable spacing, and no busy image backdrop behind the text.</p>",
        tags: ["gratitude"],
        createdAt: now - 60_000,
        updatedAt: now - 60_000,
      },
      {
        id: "desktop-sidebar-entry-3",
        title: "Readable memory card",
        content: "<p>A populated list card confirms preview text and metadata remain calm and legible.</p>",
        tags: ["readability"],
        createdAt: now - 120_000,
        updatedAt: now - 120_000,
      },
    ].forEach((entry) => {
      store.put({
        ...entry,
        date: today,
        stickers: [],
        photoIds: [],
        audioIds: [],
      });
    });

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error(tx.error?.message || "IndexedDB write failed"));
      tx.onabort = () => reject(new Error(tx.error?.message || "IndexedDB write aborted"));
    });
    db.close();
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("journal-sidebar-wide")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Quiet sidebar readability note")).toBeVisible({ timeout: 30_000 });
}

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
  await expect(page.getByTestId("journal-sidebar-rail")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("journal-sidebar-wide")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("journal-detail-pane")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("diary-empty-canvas")).toBeVisible({ timeout: 30_000 });
}

test.describe("Desktop/Tauri V2 Diary wallpaper", () => {
  test.describe.configure({ timeout: 90_000 });


  test("desktop populated list uses the shared side-panel material without a nested memory backdrop", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await openDesktopDiary(page, {
      name: "desktop-populated-sidebar-night",
      colorScheme: "dark",
      expectedTone: "night",
      language: "en",
      theme: "ink",
      viewport: { width: 1440, height: 900 },
      wallClockIso: "2026-06-17T23:00:00.000Z",
    });
    await seedDesktopSidebarEntries(page);

    const facts = await page.evaluate(() => {
      const sidebar = document.querySelector<HTMLElement>("[data-testid='journal-sidebar-wide']");
      const wallpaper = document.querySelector<HTMLElement>(
        "[data-testid='journal-page-shell'] > [data-testid='journal-wallpaper']",
      );
      if (!sidebar || !wallpaper) return null;

      const memorySurfaces = Array.from(
        sidebar.querySelectorAll<HTMLElement>(".journal-memory-field, [data-surface^='journal-memory']"),
      );

      return {
        entryText: sidebar.textContent?.replace(/\s+/g, " ").trim() ?? "",
        horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        memoryBackdropCount: sidebar.querySelectorAll(".journal-memory-field").length,
        memorySurfaceCount: memorySurfaces.length,
        memoryUrlBackdropCount: memorySurfaces.filter((element) =>
          window.getComputedStyle(element).backgroundImage.includes("url("),
        ).length,
        nestedWallpaperCount: sidebar.querySelectorAll("[data-testid='journal-wallpaper']").length,
        pageWallpaperCount: document.querySelectorAll(
          "[data-testid='journal-page-shell'] > [data-testid='journal-wallpaper']",
        ).length,
        sidebarClassName: sidebar.className,
        wallpaperTone: wallpaper.getAttribute("data-wallpaper-tone"),
      };
    });

    expect(facts).not.toBeNull();
    expect(facts?.pageWallpaperCount).toBe(1);
    expect(facts?.nestedWallpaperCount).toBe(0);
    expect(facts?.memoryBackdropCount).toBe(0);
    expect(facts?.memorySurfaceCount).toBe(0);
    expect(facts?.memoryUrlBackdropCount).toBe(0);
    expect(facts?.sidebarClassName).toContain("journal-light-sidebar-panel");
    expect(facts?.entryText).toContain("Quiet sidebar readability note");
    expect(facts?.entryText).toContain("readable");
    expect(facts?.horizontalOverflow).toBeLessThanOrEqual(1);
    expect(facts?.wallpaperTone).toBe("night");
  });

  for (const scenario of scenarios) {
    test(scenario.name + ": renders the shared premium wallpaper in the visible desktop pane", async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scenario.colorScheme, reducedMotion: "reduce" });
      await openDesktopDiary(page, scenario);

      const pageWallpaper = page.locator(
        '[data-testid="journal-page-shell"] > [data-testid="journal-wallpaper"]',
      );
      await expect(pageWallpaper).toHaveCount(1);
      await expect(pageWallpaper).toHaveAttribute("data-wallpaper-surface", "page");
      await expect(pageWallpaper).toHaveAttribute("data-wallpaper-tone", scenario.expectedTone);
      await expect(pageWallpaper).toHaveAttribute("data-wallpaper-motion", "static");
      await expect(pageWallpaper).toHaveAttribute("data-wallpaper-platform", "universal");

      const facts = await page.evaluate(() => {
        const wallpaper = document.querySelector<HTMLElement>(
          "[data-testid='journal-page-shell'] > [data-testid='journal-wallpaper']",
        );
        const detailPane = document.querySelector<HTMLElement>("[data-testid='journal-detail-pane']");
        const emptyCanvas = document.querySelector<HTMLElement>("[data-testid='diary-empty-canvas']");
        const sidebarWide = document.querySelector<HTMLElement>("[data-testid='journal-sidebar-wide']");
        const sidebarRail = document.querySelector<HTMLElement>("[data-testid='journal-sidebar-rail']");
        const shell = document.querySelector<HTMLElement>("[data-testid='journal-page-shell']");
        const desktopVista = document.querySelector<HTMLElement>(".journal-wallpaper__desktop-vista");
        const luminanceWash = document.querySelector<HTMLElement>(".journal-wallpaper__luminance-wash");
        const memoryBloom = document.querySelector<HTMLElement>(".journal-wallpaper__memory-bloom");
        const starfield = document.querySelector<HTMLElement>(".journal-wallpaper__starfield");
        if (!wallpaper || !detailPane || !emptyCanvas || !sidebarWide || !sidebarRail || !shell || !desktopVista || !luminanceWash || !memoryBloom || !starfield) return null;

        const wallpaperRect = wallpaper.getBoundingClientRect();
        const detailPaneRect = detailPane.getBoundingClientRect();
        const emptyCanvasRect = emptyCanvas.getBoundingClientRect();
        const sidebarWideRect = sidebarWide.getBoundingClientRect();
        const sidebarRailRect = sidebarRail.getBoundingClientRect();
        const shellRect = shell.getBoundingClientRect();
        const wallpaperStyle = window.getComputedStyle(wallpaper);
        const detailPaneStyle = window.getComputedStyle(detailPane);
        const sidebarWideStyle = window.getComputedStyle(sidebarWide) as WebkitCSSStyleDeclaration;
        const sidebarRailStyle = window.getComputedStyle(sidebarRail) as WebkitCSSStyleDeclaration;
        const dir = shell.getAttribute("dir");

        return {
          backgroundColor: detailPaneStyle.backgroundColor,
          backgroundImage: wallpaperStyle.backgroundImage,
          desktopVistaOpacity: Number.parseFloat(window.getComputedStyle(desktopVista).opacity),
          detailPaneHeight: detailPaneRect.height,
          detailPaneWidth: detailPaneRect.width,
          dir,
          emptyCanvasHeight: emptyCanvasRect.height,
          emptyCanvasWidth: emptyCanvasRect.width,
          horizontalOverflow:
            document.documentElement.scrollWidth - document.documentElement.clientWidth,
          luminanceWashOpacity: Number.parseFloat(window.getComputedStyle(luminanceWash).opacity),
          memoryBloomOpacity: Number.parseFloat(window.getComputedStyle(memoryBloom).opacity),
          pointerEvents: wallpaperStyle.pointerEvents,
          position: wallpaperStyle.position,
          shellHeight: shellRect.height,
          shellWidth: shellRect.width,
          sidebarRailBackgroundColor: sidebarRailStyle.backgroundColor,
          sidebarRailBackdropFilter: sidebarRailStyle.backdropFilter || sidebarRailStyle.webkitBackdropFilter,
          sidebarRailClassName: sidebarRail.className,
          sidebarRailHeight: sidebarRailRect.height,
          sidebarRailWidth: sidebarRailRect.width,
          sidebarWideBackgroundColor: sidebarWideStyle.backgroundColor,
          sidebarWideBackdropFilter: sidebarWideStyle.backdropFilter || sidebarWideStyle.webkitBackdropFilter,
          sidebarWideClassName: sidebarWide.className,
          sidebarWideHeight: sidebarWideRect.height,
          sidebarWideWidth: sidebarWideRect.width,
          starfieldBackgroundSize: window.getComputedStyle(starfield).backgroundSize,
          starfieldOpacity: Number.parseFloat(window.getComputedStyle(starfield).opacity),
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
      expect(facts?.backgroundColor).not.toBe("rgb(0, 0, 0)");
      expect(facts?.detailPaneWidth).toBeGreaterThan(0);
      expect(facts?.detailPaneHeight).toBeGreaterThan(0);
      expect(facts?.emptyCanvasWidth).toBeGreaterThan(0);
      expect(facts?.emptyCanvasHeight).toBeGreaterThan(0);
      expect(facts?.starfieldBackgroundSize).toContain("px");
      expect(facts?.starfieldOpacity).toBeGreaterThan(0);
      expect(facts?.memoryBloomOpacity).toBeGreaterThan(0);
      expect(facts?.luminanceWashOpacity).toBeGreaterThan(0);
      expect(facts?.shellWidth).toBeGreaterThan(0);
      expect(facts?.shellHeight).toBeGreaterThan(0);
      expect(facts?.sidebarWideClassName).toContain("journal-light-sidebar-panel");
      expect(facts?.sidebarRailClassName).toContain("journal-light-sidebar-rail");
      expect(facts?.sidebarWideBackdropFilter).not.toBe("none");
      expect(facts?.sidebarRailBackdropFilter).not.toBe("none");
      expect(facts?.sidebarWideBackgroundColor).toContain("rgba");
      expect(facts?.sidebarRailBackgroundColor).toContain("rgba");
      expect(facts?.sidebarWideWidth).toBeGreaterThanOrEqual(320);
      expect(facts?.sidebarWideHeight).toBeGreaterThan(0);
      expect(facts?.sidebarRailWidth).toBeGreaterThanOrEqual(64);
      expect(facts?.sidebarRailHeight).toBeGreaterThan(0);
      expect(facts?.wallpaperWidth).toBeGreaterThanOrEqual((facts?.shellWidth ?? 0) - 1);
      expect(facts?.wallpaperHeight).toBeGreaterThanOrEqual((facts?.shellHeight ?? 0) - 1);
      expect(facts?.zIndex).toBe("0");
      expect(facts?.desktopVistaOpacity).toBeGreaterThan(0);

      const visibleWallpaper = await clippedPaneScreenshot(page, "journal-detail-pane");
      const visibleSidebarWallpaper = await clippedPaneScreenshot(page, "journal-sidebar-wide");
      const visibleRailWallpaper = await clippedPaneScreenshot(page, "journal-sidebar-rail");
      const hiddenEmptyWallpaperStyle = await page.addStyleTag({
        content: '[data-testid="journal-wallpaper"] { opacity: 0 !important; visibility: hidden !important; }',
      });
      const hiddenWallpaper = await clippedPaneScreenshot(page, "journal-detail-pane");
      const hiddenSidebarWallpaper = await clippedPaneScreenshot(page, "journal-sidebar-wide");
      const hiddenRailWallpaper = await clippedPaneScreenshot(page, "journal-sidebar-rail");
      await expect(meanAbsolutePixelDelta(visibleWallpaper, hiddenWallpaper)).resolves.toBeGreaterThan(1.5);
      await expect(meanAbsolutePixelDelta(visibleSidebarWallpaper, hiddenSidebarWallpaper)).resolves.toBeGreaterThan(0.85);
      await expect(meanAbsolutePixelDelta(visibleRailWallpaper, hiddenRailWallpaper)).resolves.toBeGreaterThan(0.45);
      await hiddenEmptyWallpaperStyle.evaluate((element) => {
        (element as HTMLStyleElement).remove();
      });

      await page.locator('[data-testid="journal-detail-pane"] [data-testid="diary-empty-canvas"] button').first().click();
      await expect(page.getByTestId("journal-entry-editor")).toBeVisible();
      await expect(page.getByTestId("journal-editor-paper")).toBeVisible();

      const editorFacts = await page.getByTestId("journal-editor-paper").evaluate((element) => {
        const style = window.getComputedStyle(element) as WebkitCSSStyleDeclaration;
        return {
          backdropFilter: style.backdropFilter || style.webkitBackdropFilter,
          backgroundColor: style.backgroundColor,
        };
      });
      expect(editorFacts.backgroundColor).toContain("rgba");
      expect(editorFacts.backdropFilter).not.toBe("none");

      const visibleEditorWallpaper = await clippedPaneScreenshot(page, "journal-editor-paper");
      await page.addStyleTag({
        content: '[data-testid="journal-wallpaper"] { opacity: 0 !important; visibility: hidden !important; }',
      });
      const hiddenEditorWallpaper = await clippedPaneScreenshot(page, "journal-editor-paper");
      await expect(meanAbsolutePixelDelta(visibleEditorWallpaper, hiddenEditorWallpaper)).resolves.toBeGreaterThan(0.5);

      if (scenario.language === "ar" || scenario.language === "he") {
        expect(facts?.dir).toBe("rtl");
      } else {
        expect(facts?.dir).toBe("ltr");
      }
    });
  }
});
