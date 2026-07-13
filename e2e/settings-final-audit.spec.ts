import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

import { primeZenflowV2, type ZenflowV2Language } from "./helpers/zenflowV2State";

const OUTPUT_DIR = join(process.cwd(), "output/playwright/settings-visual-final");
const SETTINGS_PATH = "settings?nav=v2&navLayout=phone&dev=true";

type RuntimeIssue = {
  kind: "console" | "pageerror" | "requestfailed";
  message: string;
};

type Rgb = [number, number, number];

function parseRenderedRgb(value: string): Rgb {
  const channels = value.match(/[\d.]+/g)?.map(Number) ?? [];
  if (channels.length < 3) throw new Error(`Unsupported rendered color: ${value}`);
  return [channels[0], channels[1], channels[2]];
}

function relativeLuminance(rgb: Rgb): number {
  const [red, green, blue] = rgb.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrastRatio(first: Rgb, second: Rgb): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

async function screenshotPixels(page: Page) {
  const screenshot = await page.screenshot({ fullPage: true, animations: "disabled" });
  const { data, info } = await sharp(screenshot).removeAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  return {
    pixelAt(x: number, y: number): Rgb {
      const safeX = Math.max(0, Math.min(info.width - 1, Math.floor(x)));
      const safeY = Math.max(0, Math.min(info.height - 1, Math.floor(y)));
      const offset = (safeY * info.width + safeX) * info.channels;
      return [data[offset], data[offset + 1], data[offset + 2]];
    },
  };
}

async function measureTextContrast(page: Page) {
  const samples = await page.evaluate(() => {
    const definitions = [
      ["module heading", "#settings-module-panel-heading-appearance"],
      ["panel heading", '[data-testid="settings-v2-panel-appearance"] h3'],
      ["panel description", '[data-testid="settings-v2-panel-appearance"] h3 + span'],
      [
        "selected theme",
        '[data-testid="settings-v2-theme-choice-ink"] > span:last-child',
      ],
    ] as const;
    return definitions.map(([name, selector]) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing contrast target: ${name}`);
      const rect = element.getBoundingClientRect();
      const sample = {
        color: getComputedStyle(element).color,
        name,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2 + window.scrollY,
      };
      element.dataset.contrastVisibility = element.style.visibility;
      element.style.visibility = "hidden";
      return sample;
    });
  });

  const pixels = await screenshotPixels(page);
  await page.evaluate(() => {
    for (const element of document.querySelectorAll<HTMLElement>("[data-contrast-visibility]")) {
      element.style.visibility = element.dataset.contrastVisibility ?? "";
      delete element.dataset.contrastVisibility;
    }
  });
  return samples.map((sample) => {
    const foreground = parseRenderedRgb(sample.color);
    const background = pixels.pixelAt(sample.x, sample.y);
    return { ...sample, background, foreground, ratio: contrastRatio(foreground, background) };
  });
}

async function measureFocusContrast(page: Page) {
  const target = page.getByTestId("settings-v2-appearance-more");
  const rect = await target.boundingBox();
  if (!rect) throw new Error("Missing focus target geometry");
  const backgroundPixels = await screenshotPixels(page);
  await target.focus();
  const style = await target.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { color: computed.outlineColor, width: Number.parseFloat(computed.outlineWidth) };
  });
  const background = backgroundPixels.pixelAt(rect.x - 5, rect.y + rect.height / 2 + (await page.evaluate(() => window.scrollY)));
  return {
    background,
    foreground: parseRenderedRgb(style.color),
    ratio: contrastRatio(parseRenderedRgb(style.color), background),
    width: style.width,
  };
}

async function openSettings(
  page: Page,
  options: {
    language?: ZenflowV2Language;
    reducedMotion?: "no-preference" | "reduce";
    section?: "account" | "appearance" | "sound" | "privacy";
  } = {},
) {
  await page.emulateMedia({
    colorScheme: "light",
    reducedMotion: options.reducedMotion ?? "no-preference",
  });
  await primeZenflowV2(page, {
    clearStorage: true,
    language: options.language ?? "en",
    theme: "paper",
  });
  const section = options.section ? `&settingsSection=${options.section}` : "";
  await page.goto(`${SETTINGS_PATH}${section}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("settings-page")).toBeVisible();
}

function collectRuntimeIssues(page: Page): RuntimeIssue[] {
  const issues: RuntimeIssue[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      issues.push({ kind: "console", message: message.text() });
    }
  });
  page.on("pageerror", (error) => {
    issues.push({ kind: "pageerror", message: error.message });
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown failure";
    issues.push({ kind: "requestfailed", message: `${request.url()} — ${failure}` });
  });
  return issues;
}

async function expectNoHorizontalOverflow(page: Page) {
  const geometry = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(geometry.body).toBeLessThanOrEqual(geometry.viewport + 1);
  expect(geometry.document).toBeLessThanOrEqual(geometry.viewport + 1);
  return geometry;
}

async function expectVisibleTargetsAtLeast44(page: Page) {
  const undersized = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="settings-page"]');
    if (!root) throw new Error("Missing Settings target-size root");
    const selectors = ["button", "input", "select", "a[href]", '[role="switch"]'];
    return Array.from(root.querySelectorAll<HTMLElement>(selectors.join(",")))
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          height: Math.round(rect.height * 10) / 10,
          label:
            element.getAttribute("aria-label") ||
            element.textContent?.trim().replace(/\s+/g, " ").slice(0, 80) ||
            element.tagName,
          width: Math.round(rect.width * 10) / 10,
        };
      })
      .filter(({ height, width }) => height < 44 || width < 44);
  });
  expect(undersized).toEqual([]);
}

async function settleFiniteVisualTransitions(page: Page) {
  await page.evaluate(async () => {
    const finiteAnimations = document.getAnimations().filter((animation) => {
      const endTime = animation.effect?.getComputedTiming().endTime;
      return typeof endTime === "number" && Number.isFinite(endTime) && endTime <= 1_000;
    });
    await Promise.allSettled(finiteAnimations.map((animation) => animation.finished));
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
}

test.beforeAll(async () => {
  await mkdir(OUTPUT_DIR, { recursive: true });
});

test.describe("Settings Variant A final visual and runtime evidence", () => {
  test.describe.configure({ mode: "serial" });

  test("applies appearance choices immediately and scales real interface text", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const issues = collectRuntimeIssues(page);
    await openSettings(page, { section: "appearance" });

    await page.screenshot({
      path: join(OUTPUT_DIR, "01-appearance-paper-mobile.png"),
      animations: "disabled",
    });

    const sample = page
      .getByTestId("settings-v2-text-size-field")
      .getByText("Text Size", { exact: true });
    const initialFontSize = Number.parseFloat(await sample.evaluate((node) => getComputedStyle(node).fontSize));
    const textSize = page.getByRole("slider", { name: "Text size" });
    await textSize.fill("6");
    await expect(textSize).toHaveAttribute("aria-valuetext", "Huge");
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--font-scale").trim())).toBe("1.5");
    const enlargedFontSize = Number.parseFloat(await sample.evaluate((node) => getComputedStyle(node).fontSize));
    expect(enlargedFontSize).toBeGreaterThan(initialFontSize * 1.45);

    await page.getByTestId("settings-v2-theme-choice-ink").click();
    await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe("ink");
    const storedTheme = await page.evaluate(() => {
      const raw = localStorage.getItem("zenflow:theme-v0c");
      return raw ? JSON.parse(raw).state.theme : null;
    });
    expect(storedTheme).toBe("ink");

    await page.getByTestId("settings-v2-accent-choice-blue").click();
    await expect.poll(() => page.locator("html").getAttribute("data-theme-accent")).toBe("blue");
    await page.getByTestId("settings-v2-high-contrast-toggle").getByRole("switch").click();
    await expect.poll(() => page.locator("html").getAttribute("data-theme-contrast")).toBe("high");
    await settleFiniteVisualTransitions(page);

    const textContrast = await measureTextContrast(page);
    for (const sample of textContrast) {
      expect(sample.ratio, `${sample.name} contrast`).toBeGreaterThanOrEqual(4.5);
    }
    const focusContrast = await measureFocusContrast(page);
    expect(focusContrast.width).toBeGreaterThanOrEqual(3);
    expect(focusContrast.ratio).toBeGreaterThanOrEqual(3);

    await page.getByTestId("settings-v2-high-contrast-toggle").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: join(OUTPUT_DIR, "02-appearance-ink-high-contrast-150-mobile.png"),
      animations: "disabled",
    });

    const overflow = await expectNoHorizontalOverflow(page);
    await expectVisibleTargetsAtLeast44(page);
    expect(issues).toEqual([]);
    await writeFile(
      join(OUTPUT_DIR, "appearance-runtime.json"),
      JSON.stringify(
        {
          enlargedFontSize,
          focusContrast,
          initialFontSize,
          issues,
          overflow,
          storedTheme,
          textContrast,
        },
        null,
        2,
      ),
      "utf8",
    );
  });

  test("renders Arabic RTL controls in the correct logical direction", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const issues = collectRuntimeIssues(page);
    await openSettings(page, { language: "ar", reducedMotion: "reduce", section: "appearance" });

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const highContrast = page.getByTestId("settings-v2-high-contrast-toggle").getByRole("switch");
    await highContrast.click();
    await expect(highContrast).toHaveAttribute("aria-checked", "true");
    await settleFiniteVisualTransitions(page);
    const switchGeometry = await highContrast.evaluate((node) => {
      const thumb = node.firstElementChild as HTMLElement | null;
      if (!thumb) throw new Error("Missing switch thumb");
      const trackRect = node.getBoundingClientRect();
      const thumbRect = thumb.getBoundingClientRect();
      return {
        direction: getComputedStyle(node).direction,
        thumbCenter: thumbRect.left + thumbRect.width / 2,
        trackCenter: trackRect.left + trackRect.width / 2,
        transform: getComputedStyle(thumb).transform,
      };
    });
    expect(switchGeometry.direction).toBe("rtl");
    expect(switchGeometry.thumbCenter).toBeLessThan(switchGeometry.trackCenter);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: join(OUTPUT_DIR, "03-appearance-arabic-rtl-mobile.png"),
      animations: "disabled",
    });

    await page.getByTestId("settings-mobile-back").click();
    await expect(page.getByTestId("settings-module-list")).toBeVisible();
    await page.screenshot({
      path: join(OUTPUT_DIR, "04-overview-arabic-rtl-mobile.png"),
      animations: "disabled",
    });

    const overflow = await expectNoHorizontalOverflow(page);
    await expectVisibleTargetsAtLeast44(page);
    expect(issues).toEqual([]);
    await writeFile(
      join(OUTPUT_DIR, "rtl-runtime.json"),
      JSON.stringify({ issues, overflow, switchGeometry }, null, 2),
      "utf8",
    );
  });

  test("keeps the desktop settings hierarchy readable", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const issues = collectRuntimeIssues(page);
    await openSettings(page, { reducedMotion: "reduce" });

    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Appearance & accessibility" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "Appearance" })).toBeVisible();
    await page.screenshot({
      path: join(OUTPUT_DIR, "05-appearance-paper-desktop.png"),
      animations: "disabled",
    });

    const overflow = await expectNoHorizontalOverflow(page);
    await expectVisibleTargetsAtLeast44(page);
    expect(issues).toEqual([]);
    await writeFile(
      join(OUTPUT_DIR, "desktop-runtime.json"),
      JSON.stringify({ issues, overflow }, null, 2),
      "utf8",
    );
  });

  test("shows only working sound controls and applies the master switch immediately", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const issues = collectRuntimeIssues(page);
    await openSettings(page, { reducedMotion: "reduce", section: "sound" });

    const master = page.getByTestId("settings-v2-app-sound-toggle").getByRole("switch");
    await expect(master).toHaveAttribute("aria-checked", "true");
    await master.click();
    await expect(master).toHaveAttribute("aria-checked", "false");
    await expect(page.getByTestId("settings-v2-audio-volume")).toHaveCount(0);
    await expect(page.getByTestId("settings-v2-audio-master-note")).toBeVisible();
    await master.click();
    await expect(master).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("settings-v2-audio-volume")).toBeVisible();
    await expect(page.getByTestId("settings-v2-diary-ambience-control")).toHaveCount(0);

    await page.screenshot({
      path: join(OUTPUT_DIR, "06-sound-paper-mobile.png"),
      animations: "disabled",
    });
    const overflow = await expectNoHorizontalOverflow(page);
    await expectVisibleTargetsAtLeast44(page);
    expect(issues).toEqual([]);
    await writeFile(
      join(OUTPUT_DIR, "sound-runtime.json"),
      JSON.stringify({ issues, overflow }, null, 2),
      "utf8",
    );
  });

  test("keeps backup import file-first and resets the destructive choice after cancel", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const issues = collectRuntimeIssues(page);
    await openSettings(page, { reducedMotion: "reduce", section: "privacy" });

    const fileInput = page.locator('input[type="file"][accept="application/json"]');
    await expect(page.getByTestId("settings-v2-import-mode-replace")).toHaveCount(0);
    await page.screenshot({
      path: join(OUTPUT_DIR, "07-privacy-data-mobile.png"),
      animations: "disabled",
    });
    await fileInput.setInputFiles({
      name: "zenflow-backup.json",
      mimeType: "application/json",
      buffer: Buffer.from("{}"),
    });
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const replace = dialog.getByTestId("settings-v2-import-mode-replace");
    const merge = dialog.getByTestId("settings-v2-import-mode-merge");
    await expect(merge).toHaveAttribute("aria-pressed", "true");
    await replace.click();
    await expect(replace).toHaveAttribute("aria-pressed", "true");

    await page.screenshot({
      path: join(OUTPUT_DIR, "08-privacy-import-confirm-mobile.png"),
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await fileInput.setInputFiles({
      name: "zenflow-backup.json",
      mimeType: "application/json",
      buffer: Buffer.from("{}"),
    });
    await expect(page.getByTestId("settings-v2-import-mode-merge")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.keyboard.press("Escape");

    const overflow = await expectNoHorizontalOverflow(page);
    await expectVisibleTargetsAtLeast44(page);
    expect(issues).toEqual([]);
    await writeFile(
      join(OUTPUT_DIR, "privacy-runtime.json"),
      JSON.stringify({ issues, overflow }, null, 2),
      "utf8",
    );
  });

  test("renders a truthful signed-out account and backup state", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const issues = collectRuntimeIssues(page);
    await openSettings(page, { reducedMotion: "reduce", section: "account" });

    await expect(page.getByTestId("settings-v2-account-checking")).toHaveCount(0, {
      timeout: 10_000,
    });
    await expect(page.getByTestId("settings-v2-panel-account")).toBeVisible();
    await page.screenshot({
      path: join(OUTPUT_DIR, "09-account-signed-out-mobile.png"),
      animations: "disabled",
    });

    const overflow = await expectNoHorizontalOverflow(page);
    await expectVisibleTargetsAtLeast44(page);
    expect(issues).toEqual([]);
    await writeFile(
      join(OUTPUT_DIR, "account-runtime.json"),
      JSON.stringify({ issues, overflow }, null, 2),
      "utf8",
    );
  });

  test("records sequenced motion and restores focus after both directions", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      recordVideo: { dir: OUTPUT_DIR, size: { width: 390, height: 844 } },
      reducedMotion: "no-preference",
    });
    const page = await context.newPage();
    const issues = collectRuntimeIssues(page);
    await openSettings(page);
    await expect(page.getByTestId("settings-module-list")).toBeVisible();
    await page.waitForTimeout(240);
    const video = page.video();

    const overviewLayout = await page.evaluate(() => {
      const hero = document.querySelector<HTMLElement>('[data-testid="settings-page-control-card"]');
      const workspace = document.querySelector<HTMLElement>('[data-testid="settings-page-workspace"]');
      if (!hero || !workspace) throw new Error("Missing Settings layout surfaces");
      return {
        heroHeight: hero.getBoundingClientRect().height,
        workspaceTop: workspace.getBoundingClientRect().top,
      };
    });

    await page.evaluate(() => {
      type MotionSnapshot = {
        active: string[];
        present: Array<{ hidden: string | null; name: string }>;
        timestamp: number;
      };
      const snapshots: MotionSnapshot[] = [];
      const record = () => {
        const surfaces = Array.from(
          document.querySelectorAll<HTMLElement>("[data-settings-motion-surface]"),
        );
        snapshots.push({
          active: surfaces
            .filter((surface) => surface.getAttribute("aria-hidden") !== "true")
            .map((surface) => surface.dataset.settingsMotionSurface ?? "unknown"),
          present: surfaces.map((surface) => ({
            hidden: surface.getAttribute("aria-hidden"),
            name: surface.dataset.settingsMotionSurface ?? "unknown",
          })),
          timestamp: performance.now(),
        });
      };
      const root = document.querySelector('[data-testid="settings-page-workspace"]');
      if (!root) throw new Error("Missing Settings motion workspace");
      const observer = new MutationObserver(record);
      observer.observe(root, {
        attributeFilter: ["aria-hidden", "data-settings-motion-surface", "style"],
        attributes: true,
        childList: true,
        subtree: true,
      });
      record();
      const opacitySamples: Array<{ opacity: number; timestamp: number }> = [];
      const opacityStartedAt = performance.now();
      const sampleOpacity = () => {
        const opacity = Array.from(
          document.querySelectorAll<HTMLElement>("[data-settings-motion-surface]"),
        ).reduce((sum, surface) => sum + Number.parseFloat(getComputedStyle(surface).opacity), 0);
        opacitySamples.push({ opacity, timestamp: performance.now() });
        if (performance.now() - opacityStartedAt < 500) requestAnimationFrame(sampleOpacity);
      };
      requestAnimationFrame(sampleOpacity);
      Object.assign(window, {
        __settingsMotionObserver: observer,
        __settingsMotionSnapshots: snapshots,
        __settingsOpacitySamples: opacitySamples,
      });
    });

    await page.getByTestId("settings-module-card-appearance").click();

    const detailPanel = page.getByTestId("settings-module-panel-appearance");
    await expect(detailPanel).toBeVisible();
    await page.waitForTimeout(240);
    await expect(detailPanel).toBeFocused();
    await expect(page.locator("[data-settings-motion-surface]")).toHaveCount(1);

    const detailLayout = await page.evaluate(() => {
      const hero = document.querySelector<HTMLElement>('[data-testid="settings-page-control-card"]');
      const workspace = document.querySelector<HTMLElement>('[data-testid="settings-page-workspace"]');
      if (!hero || !workspace) throw new Error("Missing Settings layout surfaces");
      return {
        heroHeight: hero.getBoundingClientRect().height,
        workspaceTop: workspace.getBoundingClientRect().top,
      };
    });
    expect(Math.abs(detailLayout.heroHeight - overviewLayout.heroHeight)).toBeLessThanOrEqual(1);
    expect(Math.abs(detailLayout.workspaceTop - overviewLayout.workspaceTop)).toBeLessThanOrEqual(1);

    await page.getByTestId("settings-mobile-back").click();
    const appearanceCard = page.getByTestId("settings-module-card-appearance");
    await expect(appearanceCard).toBeVisible();
    await expect(appearanceCard).toBeFocused();
    await expect(page.locator("[data-settings-motion-surface]")).toHaveCount(1);
    await page.waitForTimeout(240);
    expect(issues).toEqual([]);

    const motionEvidence = await page.evaluate(() => {
      const motionWindow = window as typeof window & {
        __settingsMotionObserver?: MutationObserver;
        __settingsMotionSnapshots?: Array<{
          active: string[];
          present: Array<{ hidden: string | null; name: string }>;
          timestamp: number;
        }>;
        __settingsOpacitySamples?: Array<{ opacity: number; timestamp: number }>;
      };
      motionWindow.__settingsMotionObserver?.disconnect();
      return {
        motionSnapshots: motionWindow.__settingsMotionSnapshots ?? [],
        opacitySamples: motionWindow.__settingsOpacitySamples ?? [],
      };
    });
    const { motionSnapshots, opacitySamples } = motionEvidence;
    expect(motionSnapshots.some((snapshot) => snapshot.present.some(({ name }) => name === "overview"))).toBe(true);
    expect(motionSnapshots.some((snapshot) => snapshot.present.some(({ name }) => name === "detail"))).toBe(true);
    expect(motionSnapshots.every((snapshot) => snapshot.active.length <= 1)).toBe(true);
    const lowOpacitySamples = opacitySamples.filter(({ opacity }) => opacity < 0.25);
    const lowOpacityWindowMs = lowOpacitySamples.length > 0
      ? lowOpacitySamples[lowOpacitySamples.length - 1].timestamp - lowOpacitySamples[0].timestamp
      : 0;
    expect(lowOpacityWindowMs).toBeLessThanOrEqual(60);
    await writeFile(
      join(OUTPUT_DIR, "motion-runtime.json"),
      JSON.stringify({ issues, motionSnapshots, overviewLayout, detailLayout, lowOpacityWindowMs }, null, 2),
      "utf8",
    );

    await context.close();
    if (video) await video.saveAs(join(OUTPUT_DIR, "settings-mobile-motion.webm"));
  });

  test("removes spatial Settings motion when reduced motion is active", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const issues = collectRuntimeIssues(page);
    await openSettings(page, { reducedMotion: "reduce" });

    await page.getByTestId("settings-module-card-appearance").click();
    await expect(page.getByTestId("settings-module-panel-appearance")).toBeVisible();
    const motionEvidence = await page.evaluate(() => {
      const surface = document.querySelector<HTMLElement>(
        '[data-settings-motion-surface="detail"]',
      );
      if (!surface) throw new Error("Missing reduced-motion Settings surface");
      const movingAnimations = surface
        .getAnimations()
        .filter((animation) => animation.playState === "running")
        .map((animation) => {
          const effect = animation.effect as KeyframeEffect | null;
          return (effect?.getKeyframes() ?? [])
            .map((frame) => ({ opacity: frame.opacity, transform: frame.transform }))
            .filter(
              (frame) =>
                (frame.transform !== undefined && frame.transform !== "none") ||
                (frame.opacity !== undefined && Number(frame.opacity) !== 1),
            );
        })
        .filter((frames) => frames.length > 0);
      const computed = getComputedStyle(surface);
      return {
        movingAnimations,
        opacity: computed.opacity,
        transform: computed.transform,
      };
    });
    expect(motionEvidence).toEqual({
      movingAnimations: [],
      opacity: "1",
      transform: "none",
    });

    const highContrastSwitch = page
      .getByTestId("settings-v2-high-contrast-toggle")
      .getByRole("switch");
    await highContrastSwitch.click();
    const switchEvidence = await highContrastSwitch.evaluate((control) => {
      const thumb = control.firstElementChild as HTMLElement | null;
      if (!thumb) throw new Error("Missing Settings switch thumb");
      const runningTransformAnimations = control
        .getAnimations({ subtree: true })
        .filter((animation) => animation.playState === "running")
        .flatMap((animation) => {
          const effect = animation.effect as KeyframeEffect | null;
          return (effect?.getKeyframes() ?? []).filter(
            (frame) => frame.transform !== undefined && frame.transform !== "none",
          );
        });
      return {
        runningTransformAnimations,
        thumbTransitionDurationMs:
          Number.parseFloat(getComputedStyle(thumb).transitionDuration) * 1_000,
      };
    });
    expect(switchEvidence.runningTransformAnimations).toEqual([]);
    expect(switchEvidence.thumbTransitionDurationMs).toBeLessThanOrEqual(0.01);
    expect(issues).toEqual([]);
    await writeFile(
      join(OUTPUT_DIR, "reduced-motion-runtime.json"),
      JSON.stringify({ issues, motionEvidence, switchEvidence }, null, 2),
      "utf8",
    );
  });
});
