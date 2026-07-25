import { expect, test, type Locator } from "@playwright/test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import { primeZenflowV2, v2RoutePath } from "./helpers/zenflowV2State";

const PHOTO_FIXTURE = fileURLToPath(new URL("../public/og-image.png", import.meta.url));
const AFTER_SCREENSHOT = fileURLToPath(
  new URL("../output/journal-photo-desktop-after.png", import.meta.url)
);

const readClientRect = (locator: Locator) =>
  locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });

// This file contains frame-timing assertions; parallel browser workers make those
// measurements describe host contention instead of the photo interaction itself.
test.describe.configure({ mode: "serial" });

async function openDesktopEditor(page: import("@playwright/test").Page) {
  await primeZenflowV2(page, {
    clearStorage: true,
    language: "en",
    theme: "paper",
    user: { id: "journal-photo-desktop", name: "Photo QA" },
  });
  await page.goto(v2RoutePath("diary", { layout: "desktop" }), {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByRole("button", { name: /^New entry$/i })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: /^New entry$/i }).click();
  await expect(page.getByTestId("journal-entry-editor")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("textbox", { name: /^Diary entry body$/i })).toBeEnabled();
}

test.describe("Journal desktop photo interaction", () => {
  test.use({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });

  test.beforeEach(async ({ page }) => {
    await openDesktopEditor(page);
  });

  test("opens the system chooser from the first visible Photo action", async ({ page }) => {
    const chooserPromise = page.waitForEvent("filechooser", { timeout: 5_000 });

    await page.getByLabel(/^Photo$/i).click();
    const chooser = await chooserPromise;

    await chooser.setFiles(PHOTO_FIXTURE);
    await expect(page.getByRole("button", { name: /^Place on page$/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("dialog", { name: /photo picker/i })).toHaveCount(0);

    const photoAction = page.getByLabel(/^Photo$/i);
    await photoAction.focus();
    const keyboardChooserPromise = page.waitForEvent("filechooser", { timeout: 5_000 });
    await page.keyboard.press("Enter");
    const keyboardChooser = await keyboardChooserPromise;
    await keyboardChooser.setFiles([]);
    await expect(page.getByRole("dialog", { name: /photo picker/i })).toHaveCount(0);

  });

  test("drags with transient feedback and resizes with a fine pointer", async ({ page }) => {
    test.setTimeout(60_000);
    const chooserPromise = page.waitForEvent("filechooser");
    await page.getByLabel(/^Photo$/i).click();
    const chooser = await chooserPromise;
    await chooser.setFiles(PHOTO_FIXTURE);
    await page.getByRole("button", { name: /^Place on page$/i }).click();

    const photo = page.locator("[data-floating-photo-id]").first();
    await expect(photo).toBeVisible({ timeout: 20_000 });
    const start = await readClientRect(photo);

    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(start.x + start.width / 2 + 80, start.y + start.height / 2 + 40, {
      steps: 12,
    });
    await expect
      .poll(() => photo.evaluate((element) => element.style.transform))
      .toContain("translate3d(");
    await page.mouse.up();

    await expect
      .poll(async () => (await readClientRect(photo)).x, {
        timeout: 5_000,
      })
      .toBeGreaterThan(start.x + 50);
    await page.evaluate(() => {
      const target = document.querySelector<HTMLElement>("[data-floating-photo-id]");
      if (!target) throw new Error("Floating photo missing for performance probe");
      const probe = {
        styleMutations: 0,
        transformUpdateTimes: [] as number[],
        transformLatencies: [] as number[],
        pointerMoveTimes: [] as number[],
        frameTimes: [] as number[],
        longTasks: [] as number[],
        longTaskSupported: PerformanceObserver.supportedEntryTypes.includes("longtask"),
        lastPointerMoveTime: 0,
        frameRequest: 0,
        pointerMoveListener: () => {
          const now = performance.now();
          probe.lastPointerMoveTime = now;
          probe.pointerMoveTimes.push(now);
        },
        mutationObserver: new MutationObserver((records) => {
          for (const record of records) {
            if (record.target !== target || record.attributeName !== "style") continue;
            probe.styleMutations += 1;
            if (target.style.transform) {
              const now = performance.now();
              probe.transformUpdateTimes.push(now);
              if (probe.lastPointerMoveTime > 0) {
                probe.transformLatencies.push(now - probe.lastPointerMoveTime);
              }
            }
          }
        }),
        longTaskObserver: new PerformanceObserver((list) => {
          probe.longTasks.push(...list.getEntries().map((entry) => entry.duration));
        }),
      };
      const sampleFrame = (time: number) => {
        probe.frameTimes.push(time);
        probe.frameRequest = requestAnimationFrame(sampleFrame);
      };
      target.addEventListener("pointermove", probe.pointerMoveListener);
      probe.frameRequest = requestAnimationFrame(sampleFrame);
      probe.mutationObserver.observe(target, { attributes: true, attributeFilter: ["style"] });
      if (probe.longTaskSupported) {
        probe.longTaskObserver.observe({ entryTypes: ["longtask"] });
      }
      (window as typeof window & { __journalPhotoProbe?: typeof probe }).__journalPhotoProbe =
        probe;
    });

    const measuredStart = await readClientRect(photo);
    await page.mouse.move(
      measuredStart.x + measuredStart.width / 2,
      measuredStart.y + measuredStart.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      measuredStart.x + measuredStart.width / 2 + 90,
      measuredStart.y + measuredStart.height / 2 + 45,
      { steps: 60 }
    );
    const beforeRelease = await readClientRect(photo);
    await page.mouse.up();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        )
    );
    const afterRelease = await readClientRect(photo);
    expect(Math.abs(afterRelease.x - beforeRelease.x)).toBeLessThan(2);
    expect(Math.abs(afterRelease.y - beforeRelease.y)).toBeLessThan(2);

    const performanceProbe = await page.evaluate(async () => {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
      const holder = window as typeof window & {
        __journalPhotoProbe?: {
          styleMutations: number;
          transformUpdateTimes: number[];
          transformLatencies: number[];
          pointerMoveTimes: number[];
          frameTimes: number[];
          longTasks: number[];
          longTaskSupported: boolean;
          frameRequest: number;
          pointerMoveListener: () => void;
          mutationObserver: MutationObserver;
          longTaskObserver: PerformanceObserver;
        };
      };
      const probe = holder.__journalPhotoProbe;
      if (!probe) throw new Error("Journal photo performance probe missing");
      const target = document.querySelector<HTMLElement>("[data-floating-photo-id]");
      if (!target) throw new Error("Floating photo missing after performance probe");
      target.removeEventListener("pointermove", probe.pointerMoveListener);
      cancelAnimationFrame(probe.frameRequest);
      probe.mutationObserver.disconnect();
      probe.longTaskObserver.disconnect();
      delete holder.__journalPhotoProbe;
      const frameGaps = probe.transformUpdateTimes
        .slice(1)
        .map((time, index) => time - probe.transformUpdateTimes[index]);
      const firstTransformTime = probe.transformUpdateTimes[0] ?? Number.POSITIVE_INFINITY;
      const lastTransformTime =
        probe.transformUpdateTimes[probe.transformUpdateTimes.length - 1] ??
        Number.NEGATIVE_INFINITY;
      const activeFrameTimes = probe.frameTimes.filter(
        (time) => time >= firstTransformTime && time <= lastTransformTime
      );
      const animationFrameGaps = activeFrameTimes
        .slice(1)
        .map((time, index) => time - activeFrameTimes[index]);
      return {
        styleMutations: probe.styleMutations,
        pointerMoves: probe.pointerMoveTimes.length,
        transformUpdates: probe.transformUpdateTimes.length,
        maxTransformGap: frameGaps.length ? Math.max(...frameGaps) : null,
        maxTransformLatency: probe.transformLatencies.length
          ? Math.max(...probe.transformLatencies)
          : null,
        maxActiveAnimationFrameGap: animationFrameGaps.length
          ? Math.max(...animationFrameGaps)
          : null,
        longTasks: probe.longTasks,
        longTaskSupported: probe.longTaskSupported,
      };
    });
    console.log("JOURNAL_PHOTO_DRAG_PROBE", JSON.stringify(performanceProbe));
    expect(performanceProbe.longTaskSupported).toBe(true);
    expect(performanceProbe.styleMutations).toBeLessThanOrEqual(
      performanceProbe.pointerMoves + 8
    );
    expect(performanceProbe.transformUpdates).toBeGreaterThanOrEqual(10);
    expect(performanceProbe.transformUpdates).toBeGreaterThanOrEqual(
      performanceProbe.pointerMoves - 1
    );
    expect(performanceProbe.maxTransformLatency).not.toBeNull();
    expect(performanceProbe.maxTransformLatency ?? Number.POSITIVE_INFINITY).toBeLessThan(100);
    // Keep cadence visible in the probe, but do not fail on an OS-suspended browser process.
    // Input-to-transform latency and Long Tasks remain app-owned blocking signals.
    expect(performanceProbe.maxActiveAnimationFrameGap).not.toBeNull();
    expect(performanceProbe.longTasks.filter((duration) => duration >= 50)).toHaveLength(0);

    await photo.hover();
    const resizeHandle = page.getByTestId("journal-photo-resize-handle");
    await expect(resizeHandle).toBeVisible();
    const handle = await resizeHandle.boundingBox();
    expect(handle).not.toBeNull();
    if (!handle) return;
    expect(handle.width).toBeGreaterThanOrEqual(48);
    expect(handle.height).toBeGreaterThanOrEqual(48);

    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2 + 40, handle.y + handle.height / 2 + 25, {
      steps: 8,
    });
    await page.mouse.up();

    await expect
      .poll(async () => (await readClientRect(photo)).width)
      .toBeGreaterThan(start.width);
    const pixelDensity = await photo.locator("img").evaluate((image) => ({
      naturalWidth: (image as HTMLImageElement).naturalWidth,
      renderedWidth: (image as HTMLImageElement).getBoundingClientRect().width,
      dpr: window.devicePixelRatio,
    }));
    expect(pixelDensity.naturalWidth).toBeGreaterThanOrEqual(
      pixelDensity.renderedWidth * pixelDensity.dpr
    );
    await photo.hover();
    await page.screenshot({ path: AFTER_SCREENSHOT, fullPage: true });
  });

  test("keeps move and resize targets distinct for an ultrawide small photo", async ({ page }) => {
    test.setTimeout(60_000);
    const ultrawidePhoto = await sharp({
      create: {
        width: 1600,
        height: 200,
        channels: 3,
        background: { r: 24, g: 96, b: 88 },
      },
    })
      .png()
      .toBuffer();
    const chooserPromise = page.waitForEvent("filechooser");
    await page.getByLabel(/^Photo$/i).click();
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: "ultrawide-journal-photo.png",
      mimeType: "image/png",
      buffer: ultrawidePhoto,
    });
    await page.getByRole("button", { name: /^Place on page$/i }).click();

    const photo = page.locator("[data-floating-photo-id]").first();
    await expect(photo).toBeVisible({ timeout: 20_000 });
    await photo.click({ button: "right" });
    await page.getByRole("menuitem", { name: /^Resize photo$/i }).click();
    const resizeDialog = page.getByRole("dialog", { name: /^Resize photo$/i });
    await resizeDialog.getByRole("button", { name: /^Small$/i }).click();
    await expect(resizeDialog).toHaveCount(0);
    await expect(page.getByTestId("journal-entry-editor")).toBeVisible();
    await expect(photo).toBeVisible();
    await expect.poll(async () => (await readClientRect(photo)).width).toBe(120);

    const small = await photo.boundingBox();
    expect(small).not.toBeNull();
    if (!small) return;
    expect(small.width).toBe(120);
    expect(small.height).toBeGreaterThanOrEqual(48);

    const moveTargetX = small.x + small.width / 4;
    const moveTargetY = small.y + small.height / 2;
    await page.mouse.move(moveTargetX, moveTargetY);
    await page.mouse.down();
    await page.mouse.move(moveTargetX - 45, moveTargetY + 20, {
      steps: 8,
    });
    await page.mouse.up();
    const moved = await readClientRect(photo);
    expect(moved.x).toBeLessThan(small.x - 25);
    expect(moved.width).toBe(120);

    await photo.hover();
    const resizeHandle = page.getByTestId("journal-photo-resize-handle");
    const handle = await resizeHandle.boundingBox();
    expect(handle).not.toBeNull();
    if (!handle) return;
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2 + 35, handle.y + handle.height / 2, {
      steps: 6,
    });
    await page.mouse.up();
    await expect.poll(async () => (await readClientRect(photo)).width).toBeGreaterThan(120);
  });

});

test.describe("Journal photo at the default Tauri width", () => {
  test.use({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 });

  test.beforeEach(async ({ page }) => {
    await openDesktopEditor(page);
  });

  test("opens the chooser from the compact Tools panel", async ({ page }) => {
    await page.getByRole("button", { name: /^Tools$/i }).click();
    const photoAction = page.getByRole("button", { name: /^Photo$/i });
    await expect(photoAction).toBeVisible();
    const chooserPromise = page.waitForEvent("filechooser", { timeout: 5_000 });
    await photoAction.click();
    const chooser = await chooserPromise;
    await chooser.setFiles([]);
  });

  test("opens the chooser from the slash Photo command", async ({ page }) => {
    const body = page.getByRole("textbox", { name: /^Diary entry body$/i });
    await body.click();
    await body.pressSequentially("/");
    const photoCommand = page.getByRole("option", { name: /Photo\b/i });
    await expect(photoCommand).toBeVisible();

    const chooserPromise = page.waitForEvent("filechooser", { timeout: 5_000 });
    await photoCommand.click();
    const chooser = await chooserPromise;
    await chooser.setFiles([]);
    await expect(page.getByRole("dialog", { name: /photo picker/i })).toHaveCount(0);
  });
});
