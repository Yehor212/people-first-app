import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

import {
  primeZenflowV2,
  type ZenflowV2Language,
  type ZenflowV2Theme,
} from "./helpers/zenflowV2State";
import { validateProductionWebBundleManifest } from "../scripts/ratchet-bundle-manifest";

const OUTPUT_DIR =
  process.env.ZENFLOW_SETTINGS_AUDIT_OUTPUT_DIR ??
  join(process.cwd(), "output/playwright/settings-visual-final");
const SETTINGS_PATH = "settings?nav=v2&navLayout=phone&dev=true&runtimePerfGuard=off";
const SETTINGS_PATH_WITH_RUNTIME_GUARD = "settings?nav=v2&navLayout=phone&dev=true";
const SETTINGS_REFLOW_LOCALES: ZenflowV2Language[] = [
  "en",
  "uk",
  "es",
  "de",
  "fr",
  "ja",
  "ar",
  "he",
];
const SETTINGS_REFLOW_SECTIONS = ["account", "sound", "privacy"] as const;

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function validateStrictProductionPreview(): void {
  if (
    process.env.CI &&
    process.env.ZENFLOW_PLAYWRIGHT_USE_LOCAL_SERVER === "true" &&
    process.env.ZENFLOW_PLAYWRIGHT_PREVIEW_DIR === "dist"
  ) {
    validateProductionWebBundleManifest({ rootDir: process.cwd(), env: process.env });
  }
}

async function buildFileManifest(root: string, prefix = "") {
  const entries = await readdir(join(root, prefix), { withFileTypes: true });
  const files: Array<{ path: string; sha256: string; sizeBytes: number }> = [];
  for (const entry of entries) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await buildFileManifest(root, path)));
      continue;
    }
    if (!entry.isFile()) throw new Error(`Unexpected non-file build artifact: ${path}`);
    const bytes = await readFile(join(root, path));
    files.push({ path, sha256: sha256(bytes), sizeBytes: bytes.byteLength });
  }
  return files.sort((first, second) => first.path.localeCompare(second.path));
}

type RuntimeIssue = {
  kind: "console" | "pageerror" | "requestfailed";
  message: string;
};

type Rgb = [number, number, number];
type Rgba = [number, number, number, number];

function renderedTransformDelta(before: string | null, after: string | null): number {
  if (!before || !after || before === "none" || after === "none") return 0;
  const beforeChannels = before.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const afterChannels = after.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (beforeChannels.length !== afterChannels.length || beforeChannels.length === 0) return 0;
  return Math.max(
    ...beforeChannels.map((channel, index) => Math.abs(channel - afterChannels[index]))
  );
}

function parseRenderedRgba(value: string): Rgba {
  const channels = value.match(/[\d.]+/g)?.map(Number) ?? [];
  if (channels.length < 3) throw new Error(`Unsupported rendered color: ${value}`);
  return [channels[0], channels[1], channels[2], channels[3] ?? 1];
}

function compositeRenderedColor(foreground: Rgba, background: Rgb): Rgb {
  const alpha = Math.max(0, Math.min(1, foreground[3]));
  return [
    foreground[0] * alpha + background[0] * (1 - alpha),
    foreground[1] * alpha + background[1] * (1 - alpha),
    foreground[2] * alpha + background[2] * (1 - alpha),
  ];
}

function relativeLuminance(rgb: Rgb): number {
  const [red, green, blue] = rgb.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
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

async function screenshotPixels(page: Page, animations: "allow" | "disabled" = "disabled") {
  const screenshot = await page.screenshot({ fullPage: true, animations });
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

async function measureTextContrast(
  page: Page,
  animations: "allow" | "disabled" = "disabled"
) {
  const samples = await page.evaluate(() => {
    const definitions = [
      { name: "module heading", selector: "#settings-module-panel-heading-appearance" },
      { name: "panel heading", selector: '[data-testid="settings-v2-panel-appearance"] h3' },
      {
        name: "panel description",
        selector:
          '[data-testid="settings-v2-panel-appearance"] [data-slot="settings-panel-copy"] > span',
      },
      {
        name: "theme field heading",
        selector: '[data-testid="settings-v2-theme-mode-field"] [class*="font-semibold"]',
      },
      {
        name: "theme field description",
        selector:
          '[data-testid="settings-v2-theme-mode-field"] [class*="text-muted-foreground"]',
      },
      {
        name: "selected theme",
        selector:
          '[data-testid="settings-v2-theme-segmented-control"] [aria-pressed="true"] > span:last-child',
      },
      {
        name: "unselected theme",
        selector:
          '[data-testid="settings-v2-theme-segmented-control"] [aria-pressed="false"] > span:last-child',
      },
      {
        name: "accent choice",
        selector: '[data-testid="settings-v2-accent-choice-blue"] > span:last-child',
      },
      {
        name: "high contrast title",
        selector: '[data-testid="settings-v2-high-contrast-toggle"] > span:nth-of-type(2)',
      },
      {
        name: "high contrast description",
        selector: '[data-testid="settings-v2-high-contrast-toggle"] > span:last-child',
      },
      {
        name: "save feedback",
        optional: true,
        selector: '[data-slot="settings-appearance-feedback-message"]',
      },
      { name: "footer action", selector: '[data-slot="settings-footer-legal-action"]' },
    ];
    return definitions.flatMap(({ name, optional = false, selector }) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) {
        if (optional) return [];
        throw new Error(`Missing contrast target: ${name}`);
      }
      const rect = element.getBoundingClientRect();
      const sample = {
        color: getComputedStyle(element).color,
        name,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2 + window.scrollY,
      };
      element.dataset.contrastVisibility = element.style.visibility;
      element.style.visibility = "hidden";
      return [sample];
    });
  });

  const pixels = await screenshotPixels(page, animations);
  await page.evaluate(() => {
    for (const element of document.querySelectorAll<HTMLElement>("[data-contrast-visibility]")) {
      element.style.visibility = element.dataset.contrastVisibility ?? "";
      delete element.dataset.contrastVisibility;
    }
  });
  return samples.map((sample) => {
    const background = pixels.pixelAt(sample.x, sample.y);
    const foreground = compositeRenderedColor(parseRenderedRgba(sample.color), background);
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
  const background = backgroundPixels.pixelAt(
    rect.x - 5,
    rect.y + rect.height / 2 + (await page.evaluate(() => window.scrollY))
  );
  const foreground = compositeRenderedColor(parseRenderedRgba(style.color), background);
  return {
    background,
    foreground,
    ratio: contrastRatio(foreground, background),
    width: style.width,
  };
}

async function openSettings(
  page: Page,
  options: {
    audioComfort?: {
      ambientEnabled: boolean;
      avoidedTextures: Array<"air" | "water" | "rain">;
      completionCuesEnabled: boolean;
      milestoneCuesEnabled: boolean;
      profile: "quiet" | "balanced" | "rich";
      reminderCuesEnabled: boolean;
    };
    language?: ZenflowV2Language;
    reducedMotion?: "no-preference" | "reduce";
    runtimePerformanceGuard?: "default" | "off";
    section?: "account" | "appearance" | "sound" | "privacy";
    theme?: ZenflowV2Theme;
  } = {}
) {
  await page.emulateMedia({
    colorScheme: "light",
    reducedMotion: options.reducedMotion ?? "no-preference",
  });
  await primeZenflowV2(page, {
    audioComfort: options.audioComfort,
    clearStorage: true,
    language: options.language ?? "en",
    theme: options.theme ?? "paper",
  });
  const section = options.section ? `&settingsSection=${options.section}` : "";
  const settingsPath =
    options.runtimePerformanceGuard === "default"
      ? SETTINGS_PATH_WITH_RUNTIME_GUARD
      : SETTINGS_PATH;
  await page.goto(`${settingsPath}${section}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("settings-page")).toBeVisible();
}

function collectRuntimeIssues(page: Page): RuntimeIssue[] {
  const issues: RuntimeIssue[] = [];
  const redactUrl = (value: string) => {
    try {
      const url = new URL(value);
      url.search = "";
      url.hash = "";
      return url.toString();
    } catch {
      return value.split(/[?#]/, 1)[0];
    }
  };
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
    issues.push({ kind: "requestfailed", message: `${redactUrl(request.url())} — ${failure}` });
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

type VisibleTextClippingIssue = {
  ancestor: string;
  axis: "horizontal" | "vertical";
  reason: "ellipsis" | "line-clamp" | "overflow";
  text: string;
  textElement: string;
};

async function measureVisibleTextClipping(
  page: Page,
  rootSelector = '[data-testid="settings-page"]'
): Promise<VisibleTextClippingIssue[]> {
  return page.evaluate((selector) => {
    const root = document.querySelector<HTMLElement>(selector);
    if (!root) throw new Error(`Missing clipping root: ${selector}`);

    const issues: VisibleTextClippingIssue[] = [];
    const reported = new Set<string>();
    const hiddenOverflow = new Set(["clip", "hidden"]);
    const identify = (element: HTMLElement) =>
      element.getAttribute("data-testid") ||
      element.getAttribute("data-slot") ||
      element.getAttribute("aria-label") ||
      element.id ||
      element.tagName.toLowerCase();
    const report = (
      ancestor: HTMLElement,
      axis: VisibleTextClippingIssue["axis"],
      reason: VisibleTextClippingIssue["reason"],
      text: string,
      textElement: string
    ) => {
      const ancestorName = identify(ancestor);
      const key = `${ancestorName}\u0000${axis}\u0000${reason}\u0000${textElement}\u0000${text}`;
      if (reported.has(key)) return;
      reported.add(key);
      issues.push({
        ancestor: ancestorName,
        axis,
        reason,
        text: text.slice(0, 160),
        textElement,
      });
    };
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let current = walker.nextNode();

    while (current && issues.length < 50) {
      const text = current.textContent?.trim().replace(/\s+/g, " ") ?? "";
      const parent = current.parentElement;
      if (!text || !parent || parent.closest('[aria-hidden="true"], .sr-only')) {
        current = walker.nextNode();
        continue;
      }

      const parentStyle = getComputedStyle(parent);
      const parentRect = parent.getBoundingClientRect();
      const intentionallyVisuallyHidden =
        parentStyle.display === "none" ||
        parentStyle.visibility === "hidden" ||
        parentStyle.contentVisibility === "hidden" ||
        Number(parentStyle.opacity) === 0 ||
        parentRect.width <= 2 ||
        parentRect.height <= 2;
      if (intentionallyVisuallyHidden) {
        current = walker.nextNode();
        continue;
      }

      const range = document.createRange();
      range.selectNodeContents(current);
      const textRects = Array.from(range.getClientRects()).filter(
        (rect) => rect.width > 1 && rect.height > 1
      );
      const textElement = identify(parent);

      for (const textRect of textRects) {
        let ancestor: HTMLElement | null = parent;
        while (ancestor && root.contains(ancestor)) {
          const style = getComputedStyle(ancestor);
          const rect = ancestor.getBoundingClientRect();
          const clipsX = hiddenOverflow.has(style.overflowX);
          const clipsY = hiddenOverflow.has(style.overflowY);
          const horizontal =
            clipsX && (textRect.left < rect.left - 1 || textRect.right > rect.right + 1);
          const vertical =
            clipsY && (textRect.top < rect.top - 1 || textRect.bottom > rect.bottom + 1);
          if (horizontal) report(ancestor, "horizontal", "overflow", text, textElement);
          if (vertical) report(ancestor, "vertical", "overflow", text, textElement);
          ancestor = ancestor.parentElement;
        }
        if (issues.length >= 50) break;
      }

      for (
        let ancestor: HTMLElement | null = parent;
        ancestor && root.contains(ancestor);
        ancestor = ancestor.parentElement
      ) {
        const style = getComputedStyle(ancestor);
        const rect = ancestor.getBoundingClientRect();
        const horizontalTextOverflow =
          ancestor.scrollWidth > ancestor.clientWidth + 1 ||
          textRects.some((textRect) => textRect.left < rect.left - 1 || textRect.right > rect.right + 1);
        const verticalTextOverflow =
          ancestor.scrollHeight > ancestor.clientHeight + 1 ||
          textRects.some((textRect) => textRect.top < rect.top - 1 || textRect.bottom > rect.bottom + 1);
        const lineClamp = Number.parseInt(style.webkitLineClamp, 10);

        if (style.textOverflow === "ellipsis" && (horizontalTextOverflow || verticalTextOverflow)) {
          report(
            ancestor,
            horizontalTextOverflow ? "horizontal" : "vertical",
            "ellipsis",
            text,
            textElement
          );
        }
        if (Number.isFinite(lineClamp) && lineClamp > 0 && verticalTextOverflow) {
          report(ancestor, "vertical", "line-clamp", text, textElement);
        }
      }

      current = walker.nextNode();
    }

    return issues;
  }, rootSelector);
}

async function expectNoVisibleSettingsTextClipping(
  page: Page,
  rootSelector = '[data-testid="settings-page"]'
) {
  const clipping = await measureVisibleTextClipping(page, rootSelector);
  expect(clipping).toEqual([]);
  return clipping;
}

async function captureSettingsViewportEvidence(page: Page, fileStem: string) {
  const scrollRange = await page.evaluate(() => ({
    max: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
    viewportHeight: window.innerHeight,
  }));
  const positions = [
    { label: "top", y: 0 },
    { label: "middle", y: Math.round(scrollRange.max / 2) },
    { label: "bottom", y: Math.round(scrollRange.max) },
  ].filter((position, index, all) => all.findIndex(({ y }) => y === position.y) === index);
  const captures: Array<{
    drawerTriggerCollisions: Array<{
      rect: { bottom: number; left: number; right: number; top: number };
      text: string;
    }>;
    label: string;
    scrollY: number;
  }> = [];

  for (const position of positions) {
    await page.evaluate((y) => window.scrollTo(0, y), position.y);
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    );
    const scrollY = await page.evaluate(() => window.scrollY);
    const drawerTriggerCollisions = await page.evaluate(() => {
      const root = document.querySelector<HTMLElement>('[data-testid="settings-page"]');
      const trigger = document.querySelector<HTMLElement>('[data-testid="nav-v2-open-drawer"]');
      if (!root || !trigger) throw new Error("Missing Settings or phone drawer geometry");

      const triggerStyle = getComputedStyle(trigger);
      const triggerRect = trigger.getBoundingClientRect();
      if (
        triggerStyle.display === "none" ||
        triggerStyle.visibility === "hidden" ||
        triggerRect.width <= 0 ||
        triggerRect.height <= 0
      ) {
        return [];
      }

      // The two-pixel ring plus two-pixel ring offset is author-created UI too;
      // reserve its complete envelope instead of testing only the border box.
      const focusEnvelopePx = 4;
      const triggerFocusEnvelope = new DOMRect(
        triggerRect.x - focusEnvelopePx,
        triggerRect.y - focusEnvelopePx,
        triggerRect.width + focusEnvelopePx * 2,
        triggerRect.height + focusEnvelopePx * 2
      );

      const overlaps = (first: DOMRect, second: DOMRect) =>
        first.left < second.right - 1 &&
        first.right > second.left + 1 &&
        first.top < second.bottom - 1 &&
        first.bottom > second.top + 1;
      const collisions: Array<{
        rect: { bottom: number; left: number; right: number; top: number };
        text: string;
      }> = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let current = walker.nextNode();

      while (current && collisions.length < 20) {
        const text = current.textContent?.trim().replace(/\s+/g, " ") ?? "";
        const parent = current.parentElement;
        if (!text || !parent || parent.closest('[aria-hidden="true"], .sr-only')) {
          current = walker.nextNode();
          continue;
        }

        const style = getComputedStyle(parent);
        const parentRect = parent.getBoundingClientRect();
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          Number(style.opacity) === 0 ||
          parentRect.width <= 2 ||
          parentRect.height <= 2
        ) {
          current = walker.nextNode();
          continue;
        }

        const range = document.createRange();
        range.selectNodeContents(current);
        for (const rect of Array.from(range.getClientRects())) {
          const visibleInViewport =
            rect.right > 0 &&
            rect.bottom > 0 &&
            rect.left < window.innerWidth &&
            rect.top < window.innerHeight;
          if (
            visibleInViewport &&
            rect.width > 1 &&
            rect.height > 1 &&
            overlaps(rect, triggerFocusEnvelope)
          ) {
            collisions.push({
              rect: {
                bottom: Math.round(rect.bottom * 10) / 10,
                left: Math.round(rect.left * 10) / 10,
                right: Math.round(rect.right * 10) / 10,
                top: Math.round(rect.top * 10) / 10,
              },
              text: text.slice(0, 160),
            });
            break;
          }
        }

        current = walker.nextNode();
      }

      return collisions;
    });
    expect(drawerTriggerCollisions).toEqual([]);
    await page.screenshot({
      path: join(OUTPUT_DIR, `${fileStem}-${position.label}.png`),
      animations: "disabled",
      fullPage: false,
    });
    captures.push({ drawerTriggerCollisions, label: position.label, scrollY });
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  return { captures, ...scrollRange };
}

async function expectNoAutomaticSettingsHyphenation(
  page: Page,
  rootSelector = '[data-testid="settings-page"]'
) {
  const automaticHyphenation = await page.evaluate((selector) => {
    const root = document.querySelector<HTMLElement>(selector);
    if (!root) throw new Error(`Missing hyphenation root: ${selector}`);

    const offenders = new Set<HTMLElement>();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let current = walker.nextNode();
    while (current) {
      const parent = current.parentElement;
      const text = current.textContent?.trim();
      if (parent && text) {
        const style = getComputedStyle(parent) as CSSStyleDeclaration & {
          webkitHyphens?: string;
        };
        const rect = parent.getBoundingClientRect();
        if (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0 &&
          (style.hyphens === "auto" || style.webkitHyphens === "auto")
        ) {
          offenders.add(parent);
        }
      }
      current = walker.nextNode();
    }

    return Array.from(offenders).map((element) => ({
      className: element.className,
      text: element.textContent?.trim().replace(/\s+/g, " ").slice(0, 120) ?? "",
    }));
  }, rootSelector);

  expect(automaticHyphenation).toEqual([]);
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

async function measureSettingsRootTextReflow(page: Page, measureSelector: string) {
  return page.evaluate((selector) => {
    const root = document.querySelector<HTMLElement>('[data-testid="settings-page"]');
    const measure = document.querySelector<HTMLElement>(selector);
    if (!root || !measure) throw new Error(`Missing Settings reflow surface: ${selector}`);

    const visualViewportLeft = window.visualViewport?.offsetLeft ?? 0;
    const visualViewportWidth = window.visualViewport?.width ?? document.documentElement.clientWidth;
    const visualViewportRight = visualViewportLeft + visualViewportWidth;
    const hiddenOverflow = new Set(["clip", "hidden"]);
    const isVisible = (element: Element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) !== 0 &&
        rect.width > 1 &&
        rect.height > 1
      );
    };

    const outsideText: Array<{
      ancestors: Array<{ element: string; left: number; right: number; width: number }>;
      className: string;
      element: string;
      left: number;
      parentWidth: number;
      right: number;
      text: string;
    }> = [];
    const clippedText: Array<{ ancestor: string; left: number; right: number; text: string }> = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let current = walker.nextNode(); current; current = walker.nextNode()) {
      const parent = current.parentElement;
      const text = current.textContent?.trim().replace(/\s+/g, " ") ?? "";
      if (!parent || !text || parent.closest('[aria-hidden="true"], .sr-only') || !isVisible(parent)) {
        continue;
      }

      const range = document.createRange();
      range.selectNodeContents(current);
      for (const rect of Array.from(range.getClientRects())) {
        if (rect.width <= 1 || rect.height <= 1) continue;
        if (rect.left < visualViewportLeft - 1 || rect.right > visualViewportRight + 1) {
          outsideText.push({
            ancestors: (() => {
              const values = [];
              for (
                let ancestor: HTMLElement | null = parent;
                ancestor && values.length < 8;
                ancestor = ancestor.parentElement
              ) {
                const ancestorRect = ancestor.getBoundingClientRect();
                values.push({
                  element:
                    ancestor.getAttribute("data-testid") ||
                    ancestor.getAttribute("data-slot") ||
                    ancestor.tagName.toLowerCase(),
                  left: ancestorRect.left,
                  right: ancestorRect.right,
                  width: ancestorRect.width,
                });
                if (ancestor === root) break;
              }
              return values;
            })(),
            className: typeof parent.className === "string" ? parent.className : "",
            element:
              parent.getAttribute("data-testid") ||
              parent.getAttribute("data-slot") ||
              parent.tagName.toLowerCase(),
            left: rect.left,
            parentWidth: parent.getBoundingClientRect().width,
            right: rect.right,
            text: text.slice(0, 120),
          });
        }
        for (let ancestor: HTMLElement | null = parent; ancestor; ancestor = ancestor.parentElement) {
          const style = getComputedStyle(ancestor);
          if (!hiddenOverflow.has(style.overflowX)) continue;
          const clip = ancestor.getBoundingClientRect();
          if (rect.left < clip.left - 1 || rect.right > clip.right + 1) {
            clippedText.push({
              ancestor:
                ancestor.getAttribute("data-testid") || ancestor.id || ancestor.tagName.toLowerCase(),
              left: rect.left,
              right: rect.right,
              text: text.slice(0, 120),
            });
            break;
          }
        }
      }
    }

    const settingsTargets = Array.from(
      root.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [role="switch"]'),
    );
    const drawerTrigger = document.querySelector<HTMLElement>('[data-testid="nav-v2-open-drawer"]');
    if (drawerTrigger) settingsTargets.push(drawerTrigger);
    const targetIssues = settingsTargets.filter(isVisible).flatMap((target) => {
      const rect = target.getBoundingClientRect();
      const label =
        target.getAttribute("data-testid") ||
        target.getAttribute("aria-label") ||
        target.textContent?.trim().replace(/\s+/g, " ").slice(0, 80) ||
        target.tagName;
      const issues = [];
      if (rect.width < 44 || rect.height < 44) {
        issues.push({ height: rect.height, issue: "size", label, width: rect.width });
      }
      if (rect.left < visualViewportLeft - 1 || rect.right > visualViewportRight + 1) {
        issues.push({ height: rect.height, issue: "viewport", label, width: rect.width });
      }
      return issues;
    });

    const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const measureRect = measure.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    const rootStyle = getComputedStyle(root);
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:absolute;visibility:hidden;width:68px;padding-inline-start:68px";
    document.body.append(probe);
    const probeStyle = getComputedStyle(probe);
    const variableProbe = document.createElement("div");
    variableProbe.style.cssText =
      "position:absolute;visibility:hidden;padding-inline-start:calc(var(--safe-inline-start) + var(--v2-phone-drawer-rail))";
    document.body.append(variableProbe);
    const probeGeometry = {
      paddingInlineStart: probeStyle.paddingInlineStart,
      rectWidth: probe.getBoundingClientRect().width,
      variablePaddingInlineStart: getComputedStyle(variableProbe).paddingInlineStart,
      width: probeStyle.width,
      zoom: getComputedStyle(document.documentElement).zoom,
    };
    probe.remove();
    variableProbe.remove();
    const matchedPaddingRules: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      for (const rule of Array.from(rules)) {
        if (!(rule instanceof CSSStyleRule) || !rule.style.paddingInlineStart) continue;
        try {
          if (root.matches(rule.selectorText)) matchedPaddingRules.push(rule.cssText);
        } catch {
          // Ignore selectors unsupported by Element.matches in this browser.
        }
      }
    }
    return {
      clippedText,
      direction: getComputedStyle(root).direction,
      measureEm: measureRect.width / rootFontSize,
      measureWidth: measureRect.width,
      outsideText,
      rootGeometry: {
        className: root.className,
        drawerRail: rootStyle.getPropertyValue("--v2-phone-drawer-rail").trim(),
        matchedPaddingRules,
        paddingInlineEnd: rootStyle.paddingInlineEnd,
        paddingInlineStart: rootStyle.paddingInlineStart,
        probeGeometry,
        safeInlineStart: rootStyle.getPropertyValue("--safe-inline-start").trim(),
        safeLeft: rootStyle.getPropertyValue("--safe-left").trim(),
        width: rootRect.width,
      },
      rootFontSize,
      targetIssues,
      visualViewport: { left: visualViewportLeft, right: visualViewportRight, width: visualViewportWidth },
    };
  }, measureSelector);
}

async function measureKeyboardFocusSafeArea(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('[data-testid="settings-page"]');
    const trigger = document.querySelector<HTMLElement>('[data-testid="nav-v2-open-drawer"]');
    if (!root || !trigger) throw new Error("Missing keyboard focus safe-area geometry");

    const splitTopLevelShadows = (value: string) => {
      const shadows: string[] = [];
      let depth = 0;
      let start = 0;
      for (let index = 0; index < value.length; index += 1) {
        const character = value[index];
        if (character === "(") depth += 1;
        if (character === ")") depth = Math.max(0, depth - 1);
        if (character === "," && depth === 0) {
          shadows.push(value.slice(start, index).trim());
          start = index + 1;
        }
      }
      shadows.push(value.slice(start).trim());
      return shadows.filter(Boolean);
    };
    const shadowSpread = (shadow: string) => {
      const withoutColors = shadow
        .replace(/(?:rgb|rgba|hsl|hsla|color|color-mix)\([^)]*\)/gi, " ")
        .replace(/#[0-9a-f]{3,8}\b/gi, " ")
        .replace(/\binset\b/gi, " ");
      const lengths = Array.from(withoutColors.matchAll(/-?(?:\d+\.?\d*|\.\d+)px/g)).map(
        ([length]) => Number.parseFloat(length)
      );
      return lengths.length >= 4 ? lengths[3] : 0;
    };

    const rootStyle = getComputedStyle(root);
    const triggerStyle = getComputedStyle(trigger);
    const rootRect = root.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    const outlineWidth = Number.parseFloat(triggerStyle.outlineWidth) || 0;
    const outlineOffset = Number.parseFloat(triggerStyle.outlineOffset) || 0;
    const outlineExtent =
      triggerStyle.outlineStyle === "none" ? 0 : Math.max(0, outlineWidth + outlineOffset);
    const shadowExtent = Math.max(
      0,
      ...splitTopLevelShadows(triggerStyle.boxShadow).map(shadowSpread)
    );
    const focusExtent = Math.max(outlineExtent, shadowExtent);
    const paddingInlineStart = Number.parseFloat(rootStyle.paddingInlineStart);
    const direction = rootStyle.direction;
    const contentStart =
      direction === "rtl"
        ? rootRect.right - paddingInlineStart
        : rootRect.left + paddingInlineStart;
    const focusEdge =
      direction === "rtl" ? triggerRect.left - focusExtent : triggerRect.right + focusExtent;
    const visualViewportLeft = window.visualViewport?.offsetLeft ?? 0;
    const visualViewportWidth = window.visualViewport?.width ?? document.documentElement.clientWidth;
    const visualViewportRight = visualViewportLeft + visualViewportWidth;

    return {
      activeTestId:
        document.activeElement instanceof HTMLElement
          ? document.activeElement.getAttribute("data-testid")
          : null,
      boxShadow: triggerStyle.boxShadow,
      direction,
      focusExtent,
      focusGap: direction === "rtl" ? focusEdge - contentStart : contentStart - focusEdge,
      focusVisible: trigger.matches(":focus-visible"),
      outlineColor: triggerStyle.outlineColor,
      outlineOffset,
      outlineStyle: triggerStyle.outlineStyle,
      outlineWidth,
      paddingInlineStart,
      viewportGaps: {
        blockStart: triggerRect.top - focusExtent,
        inlineEnd:
          direction === "rtl"
            ? triggerRect.left - focusExtent - visualViewportLeft
            : visualViewportRight - (triggerRect.right + focusExtent),
      },
    };
  });
}

async function measureKeyboardFocusIndicatorContrast(
  page: Page,
  focus: Awaited<ReturnType<typeof measureKeyboardFocusSafeArea>>
) {
  const trigger = page.getByTestId("nav-v2-open-drawer");
  const rect = await trigger.boundingBox();
  if (!rect) throw new Error("Missing keyboard focus contrast geometry");
  const screenshot = await page.screenshot({ animations: "disabled", fullPage: false });
  const painting = await trigger.evaluate((element) => {
    const read = (pseudo?: "::before" | "::after") => {
      const style = getComputedStyle(element, pseudo);
      return {
        borderBottomColor: style.borderBottomColor,
        borderBottomWidth: style.borderBottomWidth,
        bottom: style.bottom,
        inset: style.inset,
        outlineColor: style.outlineColor,
        outlineOffset: style.outlineOffset,
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        position: style.position,
        transitionDuration: style.transitionDuration,
        transitionProperty: style.transitionProperty,
        zIndex: style.zIndex,
      };
    };
    return { after: read("::after"), before: read("::before"), element: read() };
  });
  const { data, info } = await sharp(screenshot).removeAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const pixelAt = (x: number, y: number): Rgb => {
    const safeX = Math.max(0, Math.min(info.width - 1, Math.floor(x)));
    const safeY = Math.max(0, Math.min(info.height - 1, Math.floor(y)));
    const offset = (safeY * info.width + safeX) * info.channels;
    return [data[offset], data[offset + 1], data[offset + 2]];
  };
  const pointAt = {
    blockEnd: (distance: number) =>
      pixelAt(rect.x + rect.width / 2, rect.y + rect.height + distance),
    blockStart: (distance: number) => pixelAt(rect.x + rect.width / 2, rect.y - distance),
    inlineEnd: (distance: number) =>
      focus.direction === "rtl"
        ? pixelAt(rect.x - distance, rect.y + rect.height / 2)
        : pixelAt(rect.x + rect.width + distance, rect.y + rect.height / 2),
    inlineStart: (distance: number) =>
      focus.direction === "rtl"
        ? pixelAt(rect.x + rect.width + distance, rect.y + rect.height / 2)
        : pixelAt(rect.x - distance, rect.y + rect.height / 2),
  };
  const computedOutline = parseRenderedRgba(painting.element.outlineColor);
  const settledOutlineOffset = Number.parseFloat(painting.element.outlineOffset) || 0;
  const settledOutlineWidth = Number.parseFloat(painting.element.outlineWidth) || 0;
  const outlineCenterDistance = settledOutlineOffset + settledOutlineWidth / 2;
  const adjacentBackgroundDistance = settledOutlineOffset + settledOutlineWidth + 1;
  const samples = Object.entries(pointAt).map(([position, sample]) => {
    const adjacentBackground = sample(adjacentBackgroundDistance);
    const outline = sample(outlineCenterDistance);
    const expectedComputedOutline = compositeRenderedColor(computedOutline, adjacentBackground);
    return {
      adjacentBackground,
      expectedComputedOutline,
      outline,
      outlineAdjacentRatio: contrastRatio(outline, adjacentBackground),
      outlineComputedColorMaxChannelDelta: Math.max(
        ...outline.map((channel, index) => Math.abs(channel - expectedComputedOutline[index]))
      ),
      position,
    };
  });
  return {
    adjacentBackgroundDistance,
    computedOutline,
    minOutlineAdjacentRatio: Math.min(
      ...samples.map(({ outlineAdjacentRatio }) => outlineAdjacentRatio)
    ),
    outlineCenterDistance,
    painting,
    settledOutlineOffset,
    settledOutlineWidth,
    samples,
  };
}

async function measureAppearanceFeedbackLayout(page: Page) {
  return page.evaluate(() => {
    const feedback = document.querySelector<HTMLElement>(
      '[data-testid="settings-v2-appearance-feedback"]'
    );
    const rail = document.querySelector<HTMLElement>(
      '[data-testid="settings-v2-appearance-feedback-rail"]'
    );
    const undo = document.querySelector<HTMLElement>(
      '[data-slot="settings-appearance-feedback-undo"]'
    );
    const dismiss = document.querySelector<HTMLElement>(
      '[data-slot="settings-appearance-feedback-dismiss"]'
    );
    const root = document.querySelector<HTMLElement>('[data-testid="settings-page"]');
    if (!feedback || !rail || !undo || !dismiss || !root) {
      throw new Error("Missing inline appearance feedback contract");
    }

    const feedbackRect = feedback.getBoundingClientRect();
    const intersects = (first: DOMRect, second: DOMRect) =>
      first.left < second.right &&
      first.right > second.left &&
      first.top < second.bottom &&
      first.bottom > second.top;
    const collisions = Array.from(
      root.querySelectorAll<HTMLElement>('button, input, select, a[href], [role="switch"]')
    )
      .filter((target) => !feedback.contains(target))
      .filter((target) => {
        const style = getComputedStyle(target);
        const rect = target.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.right > 0 &&
          rect.bottom > 0 &&
          rect.left < window.innerWidth &&
          rect.top < window.innerHeight
        );
      })
      .map((target) => {
        const rect = target.getBoundingClientRect();
        return {
          label:
            target.getAttribute("data-testid") ||
            target.getAttribute("aria-label") ||
            target.textContent?.trim().replace(/\s+/g, " ").slice(0, 80) ||
            target.tagName,
          rect: rect.toJSON(),
        };
      })
      .filter(({ rect }) => intersects(feedbackRect, DOMRect.fromRect(rect)));

    const controlSize = (control: HTMLElement) => {
      const rect = control.getBoundingClientRect();
      return { height: rect.height, width: rect.width };
    };
    return {
      collisions,
      dismiss: controlSize(dismiss),
      feedbackRect: feedbackRect.toJSON(),
      layout: rail.dataset.layout,
      undo: controlSize(undo),
    };
  });
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

async function measureDaylightSettingsScene(page: Page) {
  return page.evaluate(() => {
    const wrapper = document.querySelector<HTMLElement>(
      '[data-testid="settings-day-cosmic-backdrop"]'
    );
    const root = document.querySelector<HTMLElement>('[data-testid="day-cosmic-background"]');
    const active = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-testid="day-cosmic-background"] [data-motion-active="true"]'
      )
    );
    const running = active.filter((element) => getComputedStyle(element).animationName !== "none");
    const unexpectedRunning = Array.from(
      document.querySelectorAll<HTMLElement>('[data-testid="day-cosmic-background"] *')
    ).filter(
      (element) =>
        element.dataset.motionActive !== "true" &&
        getComputedStyle(element).animationName !== "none"
    );
    const primaryMotion = root?.querySelector<HTMLElement>('[data-motion-emphasis="primary"]');

    return {
      activeIds: active.map((element) => element.dataset.motionId),
      animated: root?.dataset.animated ?? null,
      durations: [
        ...new Set(running.map((element) => getComputedStyle(element).animationDuration)),
      ],
      mounted: Boolean(wrapper && root),
      primaryAnimation: primaryMotion ? getComputedStyle(primaryMotion).animationName : null,
      primaryTransform: primaryMotion ? getComputedStyle(primaryMotion).transform : null,
      running: running.length,
      sampleTransform: running[0] ? getComputedStyle(running[0]).transform : null,
      unexpectedRunning: unexpectedRunning.map((element) => element.className),
    };
  });
}

async function sampleAnimationFrames(page: Page, durationMs = 1_200) {
  return page.evaluate(
    (sampleDuration) =>
      new Promise<{
        averageMs: number;
        frames: number;
        maxMs: number;
        over32Ms: number;
        p50Ms: number;
        p95Ms: number;
      }>((resolve) => {
        const intervals: number[] = [];
        const startedAt = performance.now();
        let previous = startedAt;
        const step = (now: number) => {
          if (now > previous) intervals.push(now - previous);
          previous = now;
          if (now - startedAt < sampleDuration) {
            requestAnimationFrame(step);
            return;
          }
          const sorted = [...intervals].sort((first, second) => first - second);
          const percentile = (value: number) =>
            sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * value))] ?? 0;
          resolve({
            averageMs:
              intervals.reduce((sum, interval) => sum + interval, 0) /
              Math.max(1, intervals.length),
            frames: intervals.length,
            maxMs: sorted.at(-1) ?? 0,
            over32Ms: intervals.filter((interval) => interval > 32).length,
            p50Ms: percentile(0.5),
            p95Ms: percentile(0.95),
          });
        };
        requestAnimationFrame(step);
      }),
    durationMs
  );
}

async function setRuntimePerformanceLimit(page: Page, limited: boolean) {
  await page.evaluate((shouldLimit) => {
    if (shouldLimit) document.documentElement.dataset.runtimePerf = "strained";
    else delete document.documentElement.dataset.runtimePerf;
    window.dispatchEvent(
      new CustomEvent("zenflow:runtime-perf-mode", {
        detail: shouldLimit
          ? { mode: "strained", reason: "settings-motion-runtime-proof" }
          : { mode: "normal" },
      })
    );
  }, limited);
}

function expectFrameBudget(
  metrics: Awaited<ReturnType<typeof sampleAnimationFrames>>,
  label: string
) {
  expect(metrics.frames, `${label} sampled frames`).toBeGreaterThanOrEqual(50);
  expect(metrics.p95Ms, `${label} p95 frame interval`).toBeLessThanOrEqual(34);
  expect(metrics.maxMs, `${label} max frame interval`).toBeLessThanOrEqual(100);
}

async function measureEmeraldNightScene(page: Page) {
  return page.evaluate(() => {
    const backdrop = document.querySelector<HTMLElement>(
      '[data-testid="settings-emerald-night-backdrop"]'
    );
    const stars = Array.from(
      document.querySelectorAll<HTMLElement>('[data-testid="settings-emerald-night-star"]')
    );
    const visibleStars = stars.filter((star) => {
      const style = getComputedStyle(star);
      const rect = star.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) > 0 &&
        rect.width > 0 &&
        rect.height > 0
      );
    });
    const starCores = stars
      .map((star) => star.querySelector<HTMLElement>(".settings-emerald-night-backdrop__star-core"))
      .filter((core): core is HTMLElement => core !== null);
    const visibleRunningAnimations = starCores.filter(
      (core) =>
        visibleStars.includes(core.parentElement as HTMLElement) &&
        getComputedStyle(core).animationName !== "none"
    );
    const primaryMotion = backdrop?.querySelector<HTMLElement>('[data-motion-emphasis="primary"]');
    const protectedTargets = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-testid="settings-page"] :is(h1,h2,h3,p,button,a,input,[role="switch"])'
      )
    ).filter((target) => {
      const style = getComputedStyle(target);
      const rect = target.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 2 &&
        rect.height > 2 &&
        rect.bottom > 0 &&
        rect.top < window.innerHeight &&
        rect.right > 0 &&
        rect.left < window.innerWidth
      );
    });
    const protectedRegions = protectedTargets.flatMap((target) => {
      const textRects: DOMRect[] = [];
      const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
      let textNode = walker.nextNode();
      while (textNode) {
        if (textNode.textContent?.trim()) {
          const range = document.createRange();
          range.selectNodeContents(textNode);
          textRects.push(...Array.from(range.getClientRects()));
        }
        textNode = walker.nextNode();
      }
      const regions = textRects.length > 0 ? textRects : [target.getBoundingClientRect()];
      return regions
        .filter(
          (rect) =>
            rect.width > 0 &&
            rect.height > 0 &&
            rect.bottom > 0 &&
            rect.top < window.innerHeight &&
            rect.right > 0 &&
            rect.left < window.innerWidth
        )
        .map((rect) => ({ rect, target }));
    });
    const collisions = visibleStars.flatMap((star) => {
      const starRect = star.getBoundingClientRect();
      const x = starRect.left + starRect.width / 2;
      const y = starRect.top + starRect.height / 2;
      const collision = protectedRegions.find(({ rect }) => {
        return (
          x >= rect.left - 20 && x <= rect.right + 20 && y >= rect.top - 20 && y <= rect.bottom + 20
        );
      });
      return collision
        ? [
            {
              star: star.dataset.starId,
              starCenter: {
                x: Math.round(x * 10) / 10,
                y: Math.round(y * 10) / 10,
              },
              target:
                collision.target.getAttribute("data-testid") ||
                collision.target.textContent?.trim().replace(/\s+/g, " ").slice(0, 80) ||
                collision.target.tagName,
              targetRect: {
                bottom: Math.round(collision.rect.bottom * 10) / 10,
                left: Math.round(collision.rect.left * 10) / 10,
                right: Math.round(collision.rect.right * 10) / 10,
                top: Math.round(collision.rect.top * 10) / 10,
              },
            },
          ]
        : [];
    });
    const card = document.querySelector<HTMLElement>('[data-testid="settings-module-account"]');
    const cardStyle = card ? getComputedStyle(card) : null;

    return {
      backdrop: backdrop
        ? {
            animated: backdrop.dataset.animated,
            detail: backdrop.dataset.mobileDetail,
            display: getComputedStyle(backdrop).display,
          }
        : null,
      card: cardStyle
        ? {
            background: cardStyle.backgroundColor,
            border: cardStyle.borderColor,
            color: cardStyle.color,
          }
        : null,
      collisions,
      durations: [
        ...new Set(
          starCores
            .filter((core) => getComputedStyle(core).animationName !== "none")
            .map((core) => getComputedStyle(core).animationDuration)
        ),
      ],
      outerStarAnimations: stars.filter((star) => getComputedStyle(star).animationName !== "none")
        .length,
      primaryAnimation: primaryMotion ? getComputedStyle(primaryMotion).animationName : null,
      primaryTransform: primaryMotion ? getComputedStyle(primaryMotion).transform : null,
      runningAnimations: starCores.filter((core) => getComputedStyle(core).animationName !== "none")
        .length,
      sampleTransform: starCores.find((core) => getComputedStyle(core).animationName !== "none")
        ? getComputedStyle(
            starCores.find((core) => getComputedStyle(core).animationName !== "none")!
          ).transform
        : null,
      total: stars.length,
      visible: visibleStars.length,
      visibleRunningAnimations: visibleRunningAnimations.length,
    };
  });
}

async function setSceneAnimationPhase(page: Page, scene: "day" | "night", normalizedPhase: number) {
  return page.evaluate(
    ({ phase, targetScene }) => {
      const selector =
        targetScene === "day"
          ? '[data-testid="day-cosmic-background"] [data-motion-active="true"]'
          : '[data-testid="settings-emerald-night-backdrop"] [data-motion-emphasis="primary"], [data-testid="settings-emerald-night-backdrop"] .settings-emerald-night-backdrop__star-core';
      const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
      const records = elements.flatMap((element) =>
        element
          .getAnimations({ subtree: false })
          .filter((animation) => animation.effect)
          .map((animation) => {
            const timing = animation.effect!.getComputedTiming();
            const duration =
              typeof timing.duration === "number" ? timing.duration : Number(timing.duration);
            if (!Number.isFinite(duration) || duration <= 0) {
              throw new Error(`Invalid ${targetScene} animation duration: ${timing.duration}`);
            }
            const cycleDuration = duration * 2;
            animation.pause();
            animation.currentTime = cycleDuration * phase;
            return {
              cycleDuration,
              currentTime: animation.currentTime,
              id: element.dataset.motionId ?? element.parentElement?.dataset.starId ?? null,
              iterationDuration: duration,
              playState: animation.playState,
              transform: getComputedStyle(element).transform,
            };
          })
      );
      return { normalizedPhase: phase, records, scene: targetScene };
    },
    { phase: normalizedPhase, targetScene: scene }
  );
}

async function capturePhaseBoard(page: Page, scene: "day" | "night") {
  const phases = [0, 0.25, 0.5, 0.75, 1] as const;
  const screenshots: Buffer[] = [];
  const samples = [];
  for (const phase of phases) {
    const sample = await setSceneAnimationPhase(page, scene, phase);
    const contrast = await measureTextContrast(page, "allow");
    samples.push({ ...sample, contrast });
    const label = String(Math.round(phase * 100)).padStart(3, "0");
    const screenshot = await page.screenshot({
      animations: "allow",
      path: join(OUTPUT_DIR, `10-${scene}-phase-${label}.png`),
    });
    screenshots.push(screenshot);
  }

  const first = await sharp(screenshots[0]).metadata();
  if (!first.width || !first.height) throw new Error(`Missing ${scene} phase screenshot geometry`);
  await sharp({
    create: {
      width: first.width * screenshots.length,
      height: first.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite(
      screenshots.map((input, index) => ({
        input,
        left: index * first.width,
        top: 0,
      }))
    )
    .png()
    .toFile(join(OUTPUT_DIR, `10-${scene}-phase-board.png`));

  return samples;
}

test.beforeAll(async () => {
  validateStrictProductionPreview();
  await mkdir(OUTPUT_DIR, { recursive: true });
});

test.afterAll(() => validateStrictProductionPreview());

test.describe("Settings Variant A final visual and runtime evidence", () => {
  test.describe.configure({ mode: "serial" });

  test("keeps Android navigation motion enabled while runtime strain pauses only decorative Settings motion", async ({
    page,
  }) => {
    test.setTimeout(30_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      Object.defineProperty(window, "CapacitorCustomPlatform", {
        configurable: true,
        value: { name: "android" },
      });
    });
    await openSettings(page, {
      reducedMotion: "no-preference",
      runtimePerformanceGuard: "off",
      section: "appearance",
    });
    const updateDialog = page.getByRole("alertdialog", { name: "Update Available" });
    if (await updateDialog.isVisible()) {
      await updateDialog.getByRole("button", { name: "Cancel" }).click();
      await expect(updateDialog).toHaveCount(0);
    }

    await expect(page.locator("html")).toHaveAttribute("data-platform", "android");
    await setRuntimePerformanceLimit(page, true);
    await expect(page.locator("html")).toHaveAttribute("data-runtime-perf", "strained");
    await expect(page.locator("html")).toHaveAttribute("data-reduced-motion", "false");
    await expect(page.locator("body")).not.toHaveClass(/\breduce-motion\b/);
    await expect
      .poll(() => page.getByTestId("day-cosmic-background").getAttribute("data-animated"))
      .toBe("false");

    await page.getByTestId("settings-mobile-back").click();
    await expect(page.getByTestId("settings-module-list")).toBeVisible();
    await page.getByTestId("settings-module-card-appearance").click();
    await expect(page.getByTestId("settings-module-panel-appearance")).toBeVisible();
    await expect(page.locator("body")).not.toHaveClass(/\breduce-motion\b/);

    await setRuntimePerformanceLimit(page, false);
    await expect(page.locator("html")).not.toHaveAttribute("data-runtime-perf", /.+/);
    await expect
      .poll(() => page.getByTestId("day-cosmic-background").getAttribute("data-animated"))
      .toBe("true");
  });

  test("keeps ambient motion active on the ordinary Settings URL when the runtime guard has no strain evidence", async ({
    page,
  }) => {
    test.setTimeout(30_000);
    await page.setViewportSize({ width: 390, height: 844 });
    const issues = collectRuntimeIssues(page);
    await openSettings(page, {
      reducedMotion: "no-preference",
      runtimePerformanceGuard: "default",
      section: "appearance",
    });

    const queryGuard = await page.evaluate(
      () => new URL(window.location.href).searchParams.get("runtimePerfGuard")
    );
    expect(queryGuard).toBeNull();
    await expect
      .poll(async () => (await measureDaylightSettingsScene(page)).running, { timeout: 10_000 })
      .toBe(16);
    await page.waitForTimeout(7_000);

    const scene = await measureDaylightSettingsScene(page);
    const runtime = await page.evaluate(() => ({
      documentMode: document.documentElement.dataset.runtimePerf ?? "normal",
      guard:
        (
          window as Window & {
            __zenflowRuntimePerfGuard?: { snapshot: () => { activated: boolean } };
          }
        ).__zenflowRuntimePerfGuard?.snapshot() ?? null,
    }));
    expect(scene.running).toBe(16);
    expect(runtime.documentMode).toBe("normal");
    expect(runtime.guard).toMatchObject({ activated: false });
    expect(issues).toEqual([]);

    await writeFile(
      join(OUTPUT_DIR, "ordinary-url-motion-runtime.json"),
      JSON.stringify({ issues, queryGuard, runtime, scene }, null, 2),
      "utf8"
    );
  });

  test("animates only the approved Paper and Ink subsets while keeping both skies collision-free", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const issues = collectRuntimeIssues(page);
    await openSettings(page, { section: "appearance" });

    await expect(page.getByTestId("settings-emerald-night-backdrop")).toHaveCount(0);
    await expect(page.getByTestId("settings-day-cosmic-backdrop")).toBeVisible();
    await expect
      .poll(() => page.getByTestId("day-cosmic-background").getAttribute("data-animated"))
      .toBe("true");
    const daylightStart = await measureDaylightSettingsScene(page);
    await page.waitForTimeout(700);
    const daylightEnd = await measureDaylightSettingsScene(page);
    expect(daylightStart.mounted).toBe(true);
    expect(daylightStart.animated).toBe("true");
    expect(daylightStart.running).toBe(16);
    expect(daylightStart.durations.sort()).toEqual(["10s", "18s", "24s", "30s"]);
    expect(daylightStart.unexpectedRunning).toEqual([]);
    expect(daylightEnd.sampleTransform).not.toBe(daylightStart.sampleTransform);
    const dayAnimatedA1 = await sampleAnimationFrames(page);

    const userMotionToggle = page
      .getByTestId("settings-v2-motion-toggle")
      .getByRole("switch", { name: "Reduce motion" });
    await expect(userMotionToggle).toHaveAttribute("aria-checked", "false");
    await userMotionToggle.click();
    await expect(userMotionToggle).toHaveAttribute("aria-checked", "true");
    await expect
      .poll(() => page.getByTestId("day-cosmic-background").getAttribute("data-animated"))
      .toBe("false");
    const userStoppedDaylight = await measureDaylightSettingsScene(page);
    expect(userStoppedDaylight.running).toBe(0);
    await userMotionToggle.click();
    await expect(userMotionToggle).toHaveAttribute("aria-checked", "false");
    await expect
      .poll(() => page.getByTestId("day-cosmic-background").getAttribute("data-animated"))
      .toBe("true");
    const userRestoredDaylight = await measureDaylightSettingsScene(page);
    expect(userRestoredDaylight.running).toBe(16);

    await setRuntimePerformanceLimit(page, true);
    await expect
      .poll(() => page.getByTestId("day-cosmic-background").getAttribute("data-animated"))
      .toBe("false");
    const runtimeLimitedDaylight = await measureDaylightSettingsScene(page);
    expect(runtimeLimitedDaylight.running).toBe(0);
    const dayStaticB1 = await sampleAnimationFrames(page);
    const dayStaticB2 = await sampleAnimationFrames(page);

    await setRuntimePerformanceLimit(page, false);
    await expect
      .poll(() => page.getByTestId("day-cosmic-background").getAttribute("data-animated"))
      .toBe("true");
    const runtimeRestoredDaylight = await measureDaylightSettingsScene(page);
    expect(runtimeRestoredDaylight.running).toBe(16);
    const dayAnimatedA2 = await sampleAnimationFrames(page);
    for (const [label, metrics] of Object.entries({
      dayAnimatedA1,
      dayAnimatedA2,
      dayStaticB1,
      dayStaticB2,
    })) {
      expectFrameBudget(metrics, label);
    }

    await page.getByTestId("settings-v2-theme-choice-ink").click();
    await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe("ink");
    await expect(page.getByTestId("settings-day-cosmic-backdrop")).toHaveCount(0);
    await settleFiniteVisualTransitions(page);
    await page
      .getByRole("heading", { name: "Appearance & accessibility", exact: true })
      .scrollIntoViewIfNeeded();

    const detail = await measureEmeraldNightScene(page);
    expect(detail.backdrop).toEqual({ animated: "true", detail: "true", display: "block" });
    expect(detail.total).toBe(24);
    expect(detail.visible).toBe(21);
    expect(detail.runningAnimations).toBe(8);
    expect(detail.outerStarAnimations).toBe(0);
    expect(detail.durations.sort()).toEqual(["10s", "12s", "14s"]);
    expect(detail.collisions).toEqual([]);
    await userMotionToggle.click();
    await expect(userMotionToggle).toHaveAttribute("aria-checked", "true");
    await expect
      .poll(() => page.getByTestId("settings-emerald-night-backdrop").getAttribute("data-animated"))
      .toBe("false");
    const userStoppedNight = await measureEmeraldNightScene(page);
    expect(userStoppedNight.runningAnimations).toBe(0);
    await userMotionToggle.click();
    await expect(userMotionToggle).toHaveAttribute("aria-checked", "false");
    await expect
      .poll(() => page.getByTestId("settings-emerald-night-backdrop").getAttribute("data-animated"))
      .toBe("true");
    const userRestoredNight = await measureEmeraldNightScene(page);
    expect(userRestoredNight.runningAnimations).toBe(8);
    const nightAnimatedA1 = await sampleAnimationFrames(page);
    await setRuntimePerformanceLimit(page, true);
    await expect
      .poll(() => page.getByTestId("settings-emerald-night-backdrop").getAttribute("data-animated"))
      .toBe("false");
    const nightStaticB = await sampleAnimationFrames(page);
    await setRuntimePerformanceLimit(page, false);
    await expect
      .poll(() => page.getByTestId("settings-emerald-night-backdrop").getAttribute("data-animated"))
      .toBe("true");
    const nightAnimatedA2 = await sampleAnimationFrames(page);
    for (const [label, metrics] of Object.entries({
      nightAnimatedA1,
      nightAnimatedA2,
      nightStaticB,
    })) {
      expectFrameBudget(metrics, label);
    }
    await page.screenshot({
      path: join(OUTPUT_DIR, "00-emerald-ink-detail-mobile.png"),
      animations: "disabled",
    });

    await page.getByTestId("settings-mobile-back").click();
    await expect(page.getByTestId("settings-module-list")).toBeVisible();
    const overview = await measureEmeraldNightScene(page);
    expect(overview.backdrop).toEqual({ animated: "true", detail: "false", display: "block" });
    expect(overview.total).toBe(24);
    expect(overview.visible).toBe(24);
    expect(overview.runningAnimations).toBe(8);
    expect(overview.collisions).toEqual([]);
    expect(overview.card).toEqual({
      background: "rgba(7, 24, 18, 0.92)",
      border: "rgb(99, 171, 145)",
      color: "rgb(248, 252, 250)",
    });
    await page.screenshot({
      path: join(OUTPUT_DIR, "00-emerald-ink-overview-mobile.png"),
      animations: "disabled",
    });

    await page.setViewportSize({ width: 320, height: 568 });
    await settleFiniteVisualTransitions(page);
    const narrowOverview = await measureEmeraldNightScene(page);
    expect(narrowOverview.backdrop).toEqual({
      animated: "true",
      detail: "false",
      display: "block",
    });
    expect(narrowOverview.visible).toBe(24);
    expect(narrowOverview.runningAnimations).toBe(8);
    expect(narrowOverview.collisions).toEqual([]);
    await expectNoHorizontalOverflow(page);
    await expectVisibleTargetsAtLeast44(page);
    await page.screenshot({
      path: join(OUTPUT_DIR, "00-emerald-ink-overview-narrow.png"),
      animations: "disabled",
    });

    await page.getByTestId("settings-module-card-appearance").click();
    await expect(page.getByTestId("settings-module-panel-appearance")).toBeVisible();
    await settleFiniteVisualTransitions(page);
    const narrowDetail = await measureEmeraldNightScene(page);
    expect(narrowDetail.backdrop).toEqual({
      animated: "true",
      detail: "true",
      display: "block",
    });
    expect(narrowDetail.visible).toBe(21);
    expect(narrowDetail.runningAnimations).toBe(8);
    expect(narrowDetail.collisions).toEqual([]);
    await expectNoHorizontalOverflow(page);
    await expectVisibleTargetsAtLeast44(page);
    await page.screenshot({
      path: join(OUTPUT_DIR, "00-emerald-ink-detail-narrow.png"),
      animations: "disabled",
    });

    await page.getByTestId("settings-v2-theme-choice-oled").click();
    await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe("oled");
    await expect(page.getByTestId("settings-day-cosmic-backdrop")).toHaveCount(0);
    await expect(page.getByTestId("settings-emerald-night-backdrop")).toHaveCount(0);

    expect(issues).toEqual([]);
    await writeFile(
      join(OUTPUT_DIR, "emerald-night-runtime.json"),
      JSON.stringify(
        {
          daylightEnd,
          daylightStart,
          framePerformance: {
            dayAnimatedA1,
            dayAnimatedA2,
            dayStaticB1,
            dayStaticB2,
            nightAnimatedA1,
            nightAnimatedA2,
            nightStaticB,
          },
          detail,
          issues,
          narrowDetail,
          narrowOverview,
          overview,
          runtimeLimitedDaylight,
          runtimeRestoredDaylight,
          userRestoredDaylight,
          userRestoredNight,
          userStoppedDaylight,
          userStoppedNight,
        },
        null,
        2
      ),
      "utf8"
    );
  });

  test("keeps intentional Ink motion density at phone, tablet, and desktop boundaries", async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const records = [];
    const widths = [
      { expectedMoving: 8, expectedNavigation: "phone", width: 767 },
      { expectedMoving: 5, expectedNavigation: "web", width: 768 },
      { expectedMoving: 5, expectedNavigation: "web", width: 1023 },
      { expectedMoving: 4, expectedNavigation: "web", width: 1024 },
    ] as const;

    for (const language of ["en", "ar", "he"] as const) {
      for (const expectation of widths) {
        const context = await browser.newContext();
        const page = await context.newPage();
        const issues = collectRuntimeIssues(page);
        await page.setViewportSize({ width: expectation.width, height: 844 });
        await openSettings(page, { language, section: "appearance" });
        await page.getByTestId("settings-v2-theme-choice-ink").click();
        await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe("ink");
        await page.evaluate(() => window.scrollTo(0, 0));
        await settleFiniteVisualTransitions(page);

        const scene = await measureEmeraldNightScene(page);
        const navigation = await page.evaluate(
          () => document.querySelector("[data-nav-layout]")?.getAttribute("data-nav-layout") ?? null
        );
        expect(navigation).toBe(expectation.expectedNavigation);
        expect(scene.visibleRunningAnimations).toBe(expectation.expectedMoving);
        expect(scene.collisions).toEqual([]);
        await expectNoHorizontalOverflow(page);
        await page.screenshot({
          path: join(OUTPUT_DIR, `00-ink-responsive-${language}-${expectation.width}px.png`),
          animations: "disabled",
        });
        expect(issues).toEqual([]);
        records.push({
          geometricOverlaps: scene.collisions,
          language,
          navigation,
          visibleRunningAnimations: scene.visibleRunningAnimations,
          width: expectation.width,
        });
        await context.close();
      }
    }

    await writeFile(
      join(OUTPUT_DIR, "responsive-motion-runtime.json"),
      JSON.stringify({ records }, null, 2),
      "utf8"
    );
  });

  test("uses system-color surfaces and removes both decorative skies in forced colors", async ({
    browserName,
    page,
  }) => {
    test.skip(browserName !== "chromium", "Forced-colors emulation requires CDP");

    await page.setViewportSize({ width: 390, height: 844 });
    const issues = collectRuntimeIssues(page);
    await openSettings(page, { section: "appearance" });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setEmulatedMedia", {
      features: [{ name: "forced-colors", value: "active" }],
    });

    try {
      await expect
        .poll(() => page.evaluate(() => matchMedia("(forced-colors: active)").matches))
        .toBe(true);
      const paper = await page.getByTestId("settings-day-cosmic-backdrop").evaluate((backdrop) => ({
        display: getComputedStyle(backdrop).display,
        runningAnimations: backdrop
          .getAnimations({ subtree: true })
          .filter((animation) => animation.playState === "running").length,
      }));
      expect(paper).toEqual({ display: "none", runningAnimations: 0 });
      await settleFiniteVisualTransitions(page);

      const navigationSeparation = await page.evaluate(() => {
        const drawerTrigger = document.querySelector<HTMLElement>(
          '[data-testid="nav-v2-open-drawer"]'
        );
        const back = document.querySelector<HTMLElement>('[data-testid="settings-mobile-back"]');
        if (!drawerTrigger || !back) throw new Error("Missing phone navigation controls");
        const drawerRect = drawerTrigger.getBoundingClientRect();
        const backRect = back.getBoundingClientRect();
        return {
          backTop: backRect.top,
          drawerBottom: drawerRect.bottom,
          verticalGap: backRect.top - drawerRect.bottom,
        };
      });
      expect(navigationSeparation.verticalGap).toBeGreaterThanOrEqual(8);

      await expect(page.getByTestId("settings-v2-appearance-more")).toHaveCount(0);
      await page.getByTestId("settings-v2-accent-choice-blue").click();

      const appearanceControlSeparation = await page.evaluate(() => {
        const more = document.querySelector<HTMLElement>(
          '[data-testid="settings-v2-appearance-more"]'
        );
        const choices = document.querySelector<HTMLElement>(
          '[data-testid="settings-v2-theme-segmented-control"]'
        );
        if (!more || !choices) throw new Error("Missing Appearance control geometry");
        const moreRect = more.getBoundingClientRect();
        const choicesRect = choices.getBoundingClientRect();
        return {
          choicesTop: choicesRect.top,
          moreBottom: moreRect.bottom,
          verticalGap: choicesRect.top - moreRect.bottom,
        };
      });
      expect(appearanceControlSeparation.verticalGap).toBeGreaterThanOrEqual(8);

      const forcedColorSurfaces = await page.evaluate(() => {
        const probe = document.createElement("div");
        probe.style.background = "Canvas";
        probe.style.color = "CanvasText";
        document.body.appendChild(probe);
        const probeStyle = getComputedStyle(probe);
        const system = {
          background: probeStyle.backgroundColor,
          color: probeStyle.color,
        };
        probe.remove();

        const panel = document.querySelector<HTMLElement>(
          '[data-testid="settings-v2-panel-appearance"]'
        );
        if (!panel) throw new Error("Missing forced-colors Settings panel");
        const panelStyle = getComputedStyle(panel);
        return {
          panel: {
            background: panelStyle.backgroundColor,
            color: panelStyle.color,
          },
          system,
        };
      });
      expect(forcedColorSurfaces.panel).toEqual(forcedColorSurfaces.system);

      const selectedAccent = await page
        .getByTestId("settings-v2-accent-choice-blue")
        .locator('[data-swatch-kind="accent"]')
        .evaluate((swatch) => {
          const style = getComputedStyle(swatch);
          return {
            background: style.backgroundColor,
            outlineStyle: style.outlineStyle,
            outlineWidth: Number.parseFloat(style.outlineWidth),
          };
        });
      const unselectedAccent = await page
        .getByTestId("settings-v2-accent-choice-green")
        .locator('[data-swatch-kind="accent"]')
        .evaluate((swatch) => getComputedStyle(swatch).backgroundColor);
      expect(selectedAccent.outlineStyle).not.toBe("none");
      expect(selectedAccent.outlineWidth).toBeGreaterThanOrEqual(3);
      expect(selectedAccent.background).not.toBe(unselectedAccent);

      const feedback = page.getByTestId("settings-v2-appearance-feedback");
      await expect(feedback).toBeVisible();
      const forcedFeedbackLayout = await measureAppearanceFeedbackLayout(page);
      expect(forcedFeedbackLayout.layout).toBe("inline");
      expect(forcedFeedbackLayout.collisions).toEqual([]);
      const forcedFeedbackSurface = await feedback.evaluate((surface) => {
        const style = getComputedStyle(surface);
        return { background: style.backgroundColor, color: style.color };
      });
      expect(forcedFeedbackSurface).toEqual(forcedColorSurfaces.system);
      await expectVisibleTargetsAtLeast44(page);
      await page.screenshot({
        path: join(OUTPUT_DIR, "00-settings-forced-colors-feedback-mobile.png"),
        animations: "disabled",
      });
      await page.locator('[data-slot="settings-appearance-feedback-dismiss"]').click();
      await expect(feedback).toHaveCount(0);

      await page.getByTestId("settings-v2-theme-choice-ink").click();
      await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe("ink");
      const ink = await page
        .getByTestId("settings-emerald-night-backdrop")
        .evaluate((backdrop) => ({
          display: getComputedStyle(backdrop).display,
          runningAnimations: backdrop
            .getAnimations({ subtree: true })
            .filter((animation) => animation.playState === "running").length,
        }));
      expect(ink).toEqual({ display: "none", runningAnimations: 0 });
      expect(issues).toEqual([]);
      await page.screenshot({
        path: join(OUTPUT_DIR, "00-settings-forced-colors-mobile.png"),
        animations: "disabled",
      });
      await writeFile(
        join(OUTPUT_DIR, "forced-colors-runtime.json"),
        JSON.stringify(
          {
            appearanceControlSeparation,
            forcedFeedbackLayout,
            forcedFeedbackSurface,
            forcedColorSurfaces,
            ink,
            issues,
            navigationSeparation,
            paper,
            selectedAccent,
            unselectedAccent,
          },
          null,
          2
        ),
        "utf8"
      );
    } finally {
      await cdp.send("Emulation.setEmulatedMedia", { features: [] });
      await cdp.detach();
    }
  });

  test("removes Settings glass when the OS requests reduced transparency", async ({
    browserName,
    page,
  }) => {
    test.skip(browserName !== "chromium", "Reduced-transparency emulation requires CDP");

    await page.setViewportSize({ width: 390, height: 844 });
    const issues = collectRuntimeIssues(page);
    await openSettings(page, { section: "appearance" });
    await page.getByTestId("settings-v2-theme-choice-ink").click();
    await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe("ink");

    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-transparency", value: "reduce" }],
    });
    try {
      await expect
        .poll(() =>
          page.evaluate(() => matchMedia("(prefers-reduced-transparency: reduce)").matches)
        )
        .toBe(true);
      const reducedTransparency = await page
        .getByTestId("settings-v2-panel-appearance")
        .evaluate((panel) => {
          const style = getComputedStyle(panel);
          return {
            backdropFilter: style.backdropFilter,
            background: style.backgroundColor,
          };
        });
      expect(reducedTransparency).toEqual({
        backdropFilter: "none",
        background: "rgb(7, 24, 18)",
      });
      const reducedTransparencyScene = await measureEmeraldNightScene(page);
      expect(reducedTransparencyScene.backdrop?.animated).toBe("true");
      expect(reducedTransparencyScene.runningAnimations).toBe(0);
      await page.getByTestId("nav-v2-open-drawer").click();
      const reducedTransparencyDrawer = await page.getByTestId("drawer-v2").evaluate((drawer) => {
        const style = getComputedStyle(drawer);
        return {
          backdropFilter: style.backdropFilter,
          background: style.backgroundColor,
          webkitBackdropFilter: style.getPropertyValue("-webkit-backdrop-filter"),
        };
      });
      expect(reducedTransparencyDrawer.backdropFilter).toBe("none");
      // Chromium can expose the prefixed alias as an empty computed value even
      // when the declaration is present; the static CSS contract covers the
      // WebKit-prefixed declaration and this runtime assertion covers behavior.
      expect(["", "none"]).toContain(reducedTransparencyDrawer.webkitBackdropFilter);
      expect(reducedTransparencyDrawer.background).not.toBe("rgba(0, 0, 0, 0)");
      expect(issues).toEqual([]);
      await page.screenshot({
        path: join(OUTPUT_DIR, "00-emerald-ink-reduced-transparency-drawer-mobile.png"),
        animations: "disabled",
      });
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("drawer-v2")).toHaveCount(0, { timeout: 1_000 });
      await writeFile(
        join(OUTPUT_DIR, "reduced-transparency-runtime.json"),
        JSON.stringify(
          {
            issues,
            reducedTransparency,
            reducedTransparencyDrawer,
            reducedTransparencyScene,
          },
          null,
          2
        ),
        "utf8"
      );
    } finally {
      await cdp.send("Emulation.setEmulatedMedia", { features: [] });
      await cdp.detach();
    }
  });

  test("applies appearance choices immediately and scales real interface text", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const issues = collectRuntimeIssues(page);
    await openSettings(page, { section: "appearance" });

    await page.screenshot({
      path: join(OUTPUT_DIR, "01-appearance-paper-mobile.png"),
      animations: "disabled",
    });

    const contrastByState: Record<
      "ink" | "inkHighContrast" | "oled" | "paper",
      Awaited<ReturnType<typeof measureTextContrast>>
    > = {
      paper: await measureTextContrast(page),
      oled: [],
      ink: [],
      inkHighContrast: [],
    };
    for (const sample of contrastByState.paper) {
      expect(sample.ratio, `paper ${sample.name} contrast`).toBeGreaterThanOrEqual(4.5);
    }

    await page.getByTestId("settings-v2-theme-choice-oled").click();
    await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe("oled");
    await settleFiniteVisualTransitions(page);
    contrastByState.oled = await measureTextContrast(page);
    for (const sample of contrastByState.oled) {
      expect(sample.ratio, `oled ${sample.name} contrast`).toBeGreaterThanOrEqual(4.5);
    }

    const sample = page
      .getByTestId("settings-v2-text-size-field")
      .getByText("Text Size", { exact: true });
    const initialFontSize = Number.parseFloat(
      await sample.evaluate((node) => getComputedStyle(node).fontSize)
    );
    const textSize = page.getByRole("slider", { name: "Text size" });
    await textSize.fill("6");
    await expect(textSize).toHaveAttribute("aria-valuetext", "Huge");
    await expect
      .poll(() =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue("--font-scale").trim()
        )
      )
      .toBe("1.5");
    const enlargedFontSize = Number.parseFloat(
      await sample.evaluate((node) => getComputedStyle(node).fontSize)
    );
    expect(enlargedFontSize).toBeGreaterThan(initialFontSize * 1.45);

    await page.getByTestId("settings-v2-theme-choice-ink").click();
    await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe("ink");
    await settleFiniteVisualTransitions(page);
    contrastByState.ink = await measureTextContrast(page);
    for (const sample of contrastByState.ink) {
      expect(sample.ratio, `ink ${sample.name} contrast`).toBeGreaterThanOrEqual(4.5);
    }
    const storedTheme = await page.evaluate(() => {
      const raw = localStorage.getItem("zenflow:theme-v0c");
      return raw ? JSON.parse(raw).state.theme : null;
    });
    expect(storedTheme).toBe("ink");

    await page.getByTestId("settings-v2-accent-choice-blue").click();
    await expect.poll(() => page.locator("html").getAttribute("data-theme-accent")).toBe("blue");
    const compactFeedback = await measureAppearanceFeedbackLayout(page);
    expect(compactFeedback.layout).toBe("inline");
    expect(compactFeedback.collisions).toEqual([]);
    expect(compactFeedback.feedbackRect.height).toBeLessThanOrEqual(128);
    await page.getByTestId("settings-v2-high-contrast-toggle").getByRole("switch").click();
    await expect.poll(() => page.locator("html").getAttribute("data-theme-contrast")).toBe("high");
    await settleFiniteVisualTransitions(page);

    contrastByState.inkHighContrast = await measureTextContrast(page);
    for (const sample of contrastByState.inkHighContrast) {
      expect(sample.ratio, `ink high contrast ${sample.name} contrast`).toBeGreaterThanOrEqual(4.5);
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
    await expectNoVisibleSettingsTextClipping(page);
    await expectVisibleTargetsAtLeast44(page);
    expect(issues).toEqual([]);
    await writeFile(
      join(OUTPUT_DIR, "appearance-runtime.json"),
      JSON.stringify(
        {
          enlargedFontSize,
          compactFeedback,
          contrastByState,
          focusContrast,
          initialFontSize,
          issues,
          overflow,
          storedTheme,
        },
        null,
        2
      ),
      "utf8"
    );
  });

  test("keeps persistent appearance Undo from blocking the next control at narrow reflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    const issues = collectRuntimeIssues(page);
    await openSettings(page, {
      reducedMotion: "reduce",
      section: "appearance",
      theme: "paper",
    });

    const textSize = page.getByTestId("settings-v2-text-size-field").locator('input[type="range"]');
    await textSize.fill("6");
    await expect
      .poll(() =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue("--font-scale").trim()
        )
      )
      .toBe("1.5");
    await page.addStyleTag({
      content: `
        [data-testid="settings-page"],
        [data-testid="settings-page"] * {
          line-height: 1.5 !important;
          letter-spacing: 0.12em !important;
          word-spacing: 0.16em !important;
        }
        [data-testid="settings-page"] p {
          margin-block-end: 2em !important;
        }
      `,
    });

    await page.getByTestId("settings-v2-accent-choice-blue").click();
    const feedback = page.getByTestId("settings-v2-appearance-feedback");
    const undo = page.locator('[data-slot="settings-appearance-feedback-undo"]');
    const dismiss = page.locator('[data-slot="settings-appearance-feedback-dismiss"]');
    const highContrast = page.getByTestId("settings-v2-high-contrast-toggle").getByRole("switch");
    await expect(feedback).toBeVisible();
    await expect(undo).toBeVisible();
    await expect(undo).toBeEnabled();
    await expect(dismiss).toBeVisible();
    await expect(dismiss).toBeEnabled();

    const geometry = await page.evaluate(() => {
      const feedbackElement = document.querySelector<HTMLElement>(
        '[data-testid="settings-v2-appearance-feedback"]'
      );
      const switchElement = document.querySelector<HTMLElement>(
        '[data-testid="settings-v2-high-contrast-toggle"] [role="switch"]'
      );
      if (!feedbackElement || !switchElement) {
        throw new Error("Missing appearance feedback or high-contrast switch");
      }
      const feedbackRect = feedbackElement.getBoundingClientRect();
      const switchRect = switchElement.getBoundingClientRect();
      const intersects =
        feedbackRect.left < switchRect.right &&
        feedbackRect.right > switchRect.left &&
        feedbackRect.top < switchRect.bottom &&
        feedbackRect.bottom > switchRect.top;
      return {
        feedbackRect: feedbackRect.toJSON(),
        intersects,
        switchRect: switchRect.toJSON(),
      };
    });

    expect(geometry.intersects).toBe(false);
    for (const control of [undo, dismiss]) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    await page.waitForTimeout(4_100);
    await expect(feedback).toBeVisible();
    await expect(undo).toBeVisible();

    await highContrast.scrollIntoViewIfNeeded();
    await expect(highContrast).toBeInViewport();
    const switchIsTopmost = await highContrast.evaluate((control) => {
      const rect = control.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return hit === control || (hit instanceof Node && control.contains(hit));
    });
    expect(switchIsTopmost).toBe(true);
    await highContrast.click();
    await expect(highContrast).toHaveAttribute("aria-checked", "true");
    await expect(undo).toBeVisible();
    expect(issues).toEqual([]);
    await page.screenshot({
      path: join(OUTPUT_DIR, "02-appearance-undo-reflow-mobile.png"),
      animations: "disabled",
    });
    await dismiss.click();
    await expect(feedback).toHaveCount(0);
    await writeFile(
      join(OUTPUT_DIR, "appearance-undo-reflow-runtime.json"),
      JSON.stringify({ geometry, issues, switchIsTopmost }, null, 2),
      "utf8"
    );
  });

  test("renders animated Arabic and Hebrew RTL skies in the correct logical direction", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 390, height: 844 });
    const issues = collectRuntimeIssues(page);
    await openSettings(page, { language: "ar", section: "appearance" });

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.getByTestId("settings-v2-theme-choice-ink").click();
    await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe("ink");
    await page.evaluate(() => window.scrollTo(0, 0));
    await settleFiniteVisualTransitions(page);

    const emeraldScene = await measureEmeraldNightScene(page);
    expect(emeraldScene.backdrop).toEqual({ animated: "true", detail: "true", display: "block" });
    expect(emeraldScene.visible).toBe(21);
    expect(emeraldScene.runningAnimations).toBe(8);
    expect(emeraldScene.collisions).toEqual([]);
    const rtlStarGeometry = await page.evaluate(() => {
      const backdrop = document.querySelector<HTMLElement>(
        '[data-testid="settings-emerald-night-backdrop"]'
      );
      if (!backdrop) throw new Error("Missing emerald Settings backdrop");
      const backdropRect = backdrop.getBoundingClientRect();
      const stars = Array.from(
        document.querySelectorAll<HTMLElement>('[data-testid="settings-emerald-night-star"]')
      ).filter((star) => getComputedStyle(star).display !== "none");
      const centerDeltas = stars.map((star) => {
        const style = getComputedStyle(star);
        const inline = Number.parseFloat(
          style.getPropertyValue("--settings-star-detail-inline") ||
            style.getPropertyValue("--settings-star-inline")
        );
        const rect = star.getBoundingClientRect();
        const actual = rect.left + rect.width / 2;
        const expected = backdropRect.right - (backdropRect.width * inline) / 100;
        return Math.abs(actual - expected);
      });
      const majorRayTranslateX = stars
        .filter((star) => star.dataset.major === "true")
        .map((star) => {
          const core = star.querySelector<HTMLElement>(
            ".settings-emerald-night-backdrop__star-core"
          );
          if (!core) throw new Error("Missing emerald star core");
          return new DOMMatrixReadOnly(getComputedStyle(core, "::after").transform).m41;
        });

      return {
        maxCenterDelta: Math.max(...centerDeltas),
        majorRayTranslateX,
      };
    });
    expect(rtlStarGeometry.maxCenterDelta).toBeLessThanOrEqual(0.1);
    expect(rtlStarGeometry.majorRayTranslateX).toHaveLength(3);
    expect(rtlStarGeometry.majorRayTranslateX.every((offset) => offset < 0)).toBe(true);
    await page.screenshot({
      path: join(OUTPUT_DIR, "03-appearance-arabic-rtl-top-mobile.png"),
      animations: "disabled",
    });

    const highContrast = page.getByTestId("settings-v2-high-contrast-toggle").getByRole("switch");
    await highContrast.click();
    await expect(highContrast).toHaveAttribute("aria-checked", "true");
    await settleFiniteVisualTransitions(page);
    const highContrastScene = await measureEmeraldNightScene(page);
    expect(highContrastScene.runningAnimations).toBe(0);
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

    const hebrewPage = await page.context().newPage();
    await hebrewPage.setViewportSize({ width: 390, height: 844 });
    await openSettings(hebrewPage, { language: "he", section: "appearance" });
    await hebrewPage.waitForLoadState("networkidle");
    const hebrewIssues = collectRuntimeIssues(hebrewPage);
    await expect(hebrewPage.locator("html")).toHaveAttribute("dir", "rtl");
    await hebrewPage.getByTestId("settings-v2-theme-choice-ink").click();
    await expect.poll(() => hebrewPage.locator("html").getAttribute("data-theme")).toBe("ink");
    await hebrewPage.evaluate(() => window.scrollTo(0, 0));
    await settleFiniteVisualTransitions(hebrewPage);
    const hebrewScene = await measureEmeraldNightScene(hebrewPage);
    expect(hebrewScene.backdrop).toEqual({ animated: "true", detail: "true", display: "block" });
    expect(hebrewScene.runningAnimations).toBe(8);
    expect(hebrewScene.outerStarAnimations).toBe(0);
    expect(hebrewScene.collisions).toEqual([]);
    await expectNoHorizontalOverflow(hebrewPage);
    await expectVisibleTargetsAtLeast44(hebrewPage);
    await hebrewPage.screenshot({
      path: join(OUTPUT_DIR, "04-appearance-hebrew-rtl-mobile.png"),
      animations: "disabled",
    });
    expect(hebrewIssues).toEqual([]);
    await hebrewPage.close();

    expect(issues).toEqual([]);
    await writeFile(
      join(OUTPUT_DIR, "rtl-runtime.json"),
      JSON.stringify(
        {
          emeraldScene,
          hebrewScene,
          hebrewIssues,
          highContrastScene,
          issues,
          overflow,
          rtlStarGeometry,
          switchGeometry,
        },
        null,
        2
      ),
      "utf8"
    );
  });

  test("keeps the desktop settings hierarchy readable", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    const issues = collectRuntimeIssues(page);
    await openSettings(page);

    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Appearance & accessibility" })
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "Appearance" })).toBeVisible();
    const desktopDaylight = await measureDaylightSettingsScene(page);
    expect(desktopDaylight).toMatchObject({
      animated: "true",
      mounted: true,
      running: 16,
      unexpectedRunning: [],
    });
    await page.screenshot({
      path: join(OUTPUT_DIR, "05-appearance-paper-desktop.png"),
      animations: "disabled",
    });

    await page.getByTestId("settings-v2-theme-choice-ink").click();
    await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe("ink");
    await settleFiniteVisualTransitions(page);
    const expandedScene = await measureEmeraldNightScene(page);
    const expandedBackdrop = await page
      .getByTestId("settings-emerald-night-backdrop")
      .evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return { height: rect.height, width: rect.width, x: rect.x };
      });
    expect(expandedScene.visible).toBe(16);
    expect(expandedScene.backdrop?.animated).toBe("true");
    expect(expandedScene.runningAnimations).toBe(4);
    expect(expandedScene.outerStarAnimations).toBe(0);
    expect(expandedScene.durations.sort()).toEqual(["10s", "12s", "14s"]);
    expect(expandedScene.collisions).toEqual([]);
    expect(expandedBackdrop.x).toBeCloseTo(256, 0);
    await page.screenshot({
      path: join(OUTPUT_DIR, "05-appearance-ink-desktop-expanded.png"),
      animations: "disabled",
    });

    await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
    await expect(page.locator('[data-nav-layout="web"][data-nav-rail="compact"]')).toBeVisible();
    await settleFiniteVisualTransitions(page);
    const compactBackdrop = await page
      .getByTestId("settings-emerald-night-backdrop")
      .evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return { height: rect.height, width: rect.width, x: rect.x };
      });
    expect(compactBackdrop.x).toBeCloseTo(72, 0);
    const compactScene = await measureEmeraldNightScene(page);
    expect(compactScene.runningAnimations).toBe(4);
    expect(compactScene.outerStarAnimations).toBe(0);
    expect(compactScene.collisions).toEqual([]);
    await page.screenshot({
      path: join(OUTPUT_DIR, "05-appearance-ink-desktop-compact.png"),
      animations: "disabled",
    });

    const overflow = await expectNoHorizontalOverflow(page);
    await expectVisibleTargetsAtLeast44(page);
    expect(issues).toEqual([]);
    await writeFile(
      join(OUTPUT_DIR, "desktop-runtime.json"),
      JSON.stringify(
        {
          compactBackdrop,
          compactScene,
          desktopDaylight,
          expandedBackdrop,
          expandedScene,
          issues,
          overflow,
        },
        null,
        2
      ),
      "utf8"
    );
  });

  test("captures fresh normalized phase boards for the complete Paper and Ink loops", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 390, height: 844 });
    const issues = collectRuntimeIssues(page);
    await openSettings(page, { section: "appearance" });
    await settleFiniteVisualTransitions(page);

    const dayPhases = await capturePhaseBoard(page, "day");
    expect(dayPhases).toHaveLength(5);
    expect(dayPhases.every(({ records }) => records.length === 16)).toBe(true);
    expect(
      dayPhases.every(({ records }) => records.every(({ playState }) => playState === "paused"))
    ).toBe(true);
    expect(dayPhases[1].records.map(({ transform }) => transform)).not.toEqual(
      dayPhases[0].records.map(({ transform }) => transform)
    );
    expect(dayPhases[2].records.map(({ transform }) => transform)).not.toEqual(
      dayPhases[0].records.map(({ transform }) => transform)
    );
    expect(dayPhases[4].records.map(({ transform }) => transform)).toEqual(
      dayPhases[0].records.map(({ transform }) => transform)
    );
    expect(
      dayPhases.every(({ contrast }) => contrast.every(({ ratio }) => ratio >= 4.5))
    ).toBe(true);

    await page.getByTestId("settings-v2-theme-choice-ink").click();
    await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe("ink");
    await settleFiniteVisualTransitions(page);
    const nightPhases = await capturePhaseBoard(page, "night");
    expect(nightPhases).toHaveLength(5);
    expect(nightPhases.every(({ records }) => records.length === 9)).toBe(true);
    expect(
      nightPhases.every(({ records }) => records.every(({ playState }) => playState === "paused"))
    ).toBe(true);
    expect(nightPhases[1].records.map(({ transform }) => transform)).not.toEqual(
      nightPhases[0].records.map(({ transform }) => transform)
    );
    expect(nightPhases[2].records.map(({ transform }) => transform)).not.toEqual(
      nightPhases[0].records.map(({ transform }) => transform)
    );
    expect(nightPhases[4].records.map(({ transform }) => transform)).toEqual(
      nightPhases[0].records.map(({ transform }) => transform)
    );
    expect(
      nightPhases.every(({ contrast }) => contrast.every(({ ratio }) => ratio >= 4.5))
    ).toBe(true);

    expect(issues).toEqual([]);
    await writeFile(
      join(OUTPUT_DIR, "phase-board-runtime.json"),
      JSON.stringify({ dayPhases, issues, nightPhases }, null, 2),
      "utf8"
    );
  });

  test("shows only working sound controls and applies the master switch immediately", async ({
    page,
  }) => {
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
      "utf8"
    );
  });

  test("restores Activity sounds without changing the separate reminder preference", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const issues = collectRuntimeIssues(page);
    await openSettings(page, {
      audioComfort: {
        ambientEnabled: false,
        avoidedTextures: [],
        completionCuesEnabled: true,
        milestoneCuesEnabled: false,
        profile: "quiet",
        reminderCuesEnabled: false,
      },
      reducedMotion: "reduce",
      section: "sound",
    });

    const recovery = page.getByTestId("settings-v2-audio-activity-recovery");
    await expect(recovery).toBeVisible();
    await recovery.getByRole("button").click();
    await expect(recovery).toHaveCount(0);

    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("zenflow-audio-comfort") ?? "null")
    );
    expect(saved).toMatchObject({
      completionCuesEnabled: true,
      milestoneCuesEnabled: true,
      reminderCuesEnabled: false,
    });
    expect(issues).toEqual([]);
    await writeFile(
      join(OUTPUT_DIR, "sound-reminder-preservation-runtime.json"),
      JSON.stringify({ issues, saved }, null, 2),
      "utf8"
    );
  });

  test("keeps backup import file-first and resets the destructive choice after cancel", async ({
    page,
  }) => {
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
    await expect(
      dialog.getByRole("button", { name: "Replace current data", exact: true })
    ).toHaveCount(1);
    await expect(
      dialog.getByRole("button", { name: "Replace with backup", exact: true })
    ).toBeVisible();

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
      "true"
    );
    await page.keyboard.press("Escape");

    const overflow = await expectNoHorizontalOverflow(page);
    await expectVisibleTargetsAtLeast44(page);
    expect(issues).toEqual([]);
    await writeFile(
      join(OUTPUT_DIR, "privacy-runtime.json"),
      JSON.stringify({ issues, overflow }, null, 2),
      "utf8"
    );
  });

  test("renders a truthful signed-out account and backup state", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const issues = collectRuntimeIssues(page);
    await openSettings(page, { reducedMotion: "reduce", section: "account" });

    const accountPanel = page.getByTestId("settings-v2-panel-account");
    await expect(page.getByTestId("settings-v2-account-checking")).toHaveCount(0, {
      timeout: 10_000,
    });
    await expect(accountPanel).toBeVisible();
    await expect(accountPanel.getByText("You’re not signed in", { exact: true })).toBeVisible();
    await expect(
      accountPanel.getByText("Backup isn’t available in this version", { exact: true })
    ).toHaveCount(0);
    await expect(
      accountPanel.getByText("We couldn’t check your account", { exact: true })
    ).toHaveCount(0);
    const signInAction = accountPanel.getByRole("button", {
      name: "Continue with Google",
      exact: true,
    });
    await expect(signInAction).toBeVisible();
    await expect(signInAction).toBeEnabled();
    await page.screenshot({
      path: join(OUTPUT_DIR, "09-account-signed-out-mobile.png"),
      animations: "disabled",
    });

    const overflow = await expectNoHorizontalOverflow(page);
    await expectVisibleTargetsAtLeast44(page);
    expect(issues).toEqual([]);
    await writeFile(
      join(OUTPUT_DIR, "account-runtime.json"),
      JSON.stringify(
        {
          accountState: "signed-out",
          issues,
          overflow,
          signedOutHeading: await accountPanel
            .getByText("You’re not signed in", { exact: true })
            .textContent(),
          signInAction: await signInAction.textContent(),
        },
        null,
        2
      ),
      "utf8"
    );
  });

  for (const language of SETTINGS_REFLOW_LOCALES) {
    test(`keeps default Web ${language} Settings panels readable at 320px, 150% text, and WCAG text spacing`, async ({
      page,
    }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width: 320, height: 568 });
      const issues = collectRuntimeIssues(page);
      await openSettings(page, {
        language,
        reducedMotion: "reduce",
        section: "appearance",
        theme: "paper",
      });

      const textSize = page
        .getByTestId("settings-v2-text-size-field")
        .locator('input[type="range"]');
      await expect(textSize).toHaveCount(1);
      await textSize.fill("6");
      await expect
        .poll(() =>
          page.evaluate(() =>
            getComputedStyle(document.documentElement).getPropertyValue("--font-scale").trim()
          )
        )
        .toBe("1.5");

      await page.addStyleTag({
        content: `
          [data-testid="settings-page"],
          [data-testid="settings-page"] * {
            line-height: 1.5 !important;
            letter-spacing: 0.12em !important;
            word-spacing: 0.16em !important;
          }
          [data-testid="settings-page"] p {
            margin-block-end: 2em !important;
          }
        `,
      });

      await expect(page.locator("html")).toHaveAttribute("lang", language);
      await expect(page.locator("html")).toHaveAttribute(
        "dir",
        language === "ar" || language === "he" ? "rtl" : "ltr"
      );

      const checked: Array<{ section: string; theme: "paper" | "ink" }> = [];
      const feedbackEvidence = [];
      const viewportEvidence = [];
      const assertCurrentLayout = async (section: string, theme: "paper" | "ink") => {
        await expectNoHorizontalOverflow(page);
        await expectNoVisibleSettingsTextClipping(page);
        await expectNoAutomaticSettingsHyphenation(page);
        await expectVisibleTargetsAtLeast44(page);
        checked.push({ section, theme });
      };

      for (const theme of ["paper", "ink"] as const) {
        if (theme === "ink") {
          await page.getByTestId("settings-v2-theme-choice-ink").click();
          await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe("ink");
        }

        await assertCurrentLayout("appearance", theme);
        viewportEvidence.push({
          theme,
          ...(await captureSettingsViewportEvidence(
            page,
            `reflow-${language}-${theme}-320-150-spacing`
          )),
        });

        await page
          .getByTestId(
            theme === "paper"
              ? "settings-v2-accent-choice-blue"
              : "settings-v2-accent-choice-violet"
          )
          .click();
        const feedback = page.getByTestId("settings-v2-appearance-feedback");
        await expect(feedback).toBeVisible();
        const feedbackLayout = await measureAppearanceFeedbackLayout(page);
        expect(feedbackLayout.layout).toBe("inline");
        expect(feedbackLayout.collisions).toEqual([]);
        expect(feedbackLayout.undo.height).toBeGreaterThanOrEqual(44);
        expect(feedbackLayout.undo.width).toBeGreaterThanOrEqual(44);
        expect(feedbackLayout.dismiss.height).toBeGreaterThanOrEqual(44);
        expect(feedbackLayout.dismiss.width).toBeGreaterThanOrEqual(44);
        await expectNoHorizontalOverflow(page);
        await expectNoVisibleSettingsTextClipping(page);
        await expectVisibleTargetsAtLeast44(page);
        await page.screenshot({
          path: join(OUTPUT_DIR, `reflow-${language}-${theme}-appearance-undo.png`),
          animations: "disabled",
          fullPage: false,
        });
        feedbackEvidence.push({ theme, ...feedbackLayout });
        await page.locator('[data-slot="settings-appearance-feedback-dismiss"]').click();
        await expect(feedback).toHaveCount(0);

        await page.getByTestId("settings-mobile-back").click();
        await expect(page.getByTestId("settings-module-list")).toBeVisible();
        await assertCurrentLayout("overview", theme);

        for (const section of SETTINGS_REFLOW_SECTIONS) {
          await page.getByTestId(`settings-module-card-${section}`).click();
          await expect(page.getByTestId(`settings-module-panel-${section}`)).toBeVisible();
          if (section === "account") {
            await expect(page.getByTestId("settings-v2-account-checking")).toHaveCount(0, {
              timeout: 10_000,
            });
          }
          await assertCurrentLayout(section, theme);
          await page.getByTestId("settings-mobile-back").click();
          await expect(page.getByTestId("settings-module-list")).toBeVisible();
        }

        if (theme === "paper") {
          await page.getByTestId("settings-module-card-appearance").click();
          await expect(page.getByTestId("settings-module-panel-appearance")).toBeVisible();
        }
      }

      expect(checked).toHaveLength(10);
      expect(issues).toEqual([]);
      await writeFile(
        join(OUTPUT_DIR, `reflow-${language}-runtime.json`),
        JSON.stringify({ checked, feedbackEvidence, issues, language, viewportEvidence }, null, 2),
        "utf8"
      );
    });
  }

  test("proves the Settings clipping audit detects overflow, ellipsis, and line-clamp failures", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await openSettings(page, { reducedMotion: "reduce", theme: "paper" });

    await page.getByTestId("settings-page").evaluate((root) => {
      const controls = document.createElement("div");
      controls.dataset.testid = "settings-clipping-negative-controls";
      controls.style.cssText = "position:relative;width:120px;font-size:16px;line-height:20px";
      controls.innerHTML = `
        <div data-testid="negative-overflow-y" style="height:20px;overflow-y:hidden;width:100px">
          Vertical clipping must be detected across several wrapped lines of visible text.
        </div>
        <div data-testid="negative-ellipsis" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:72px">
          Ellipsis clipping must be detected.
        </div>
        <div data-testid="negative-line-clamp" style="display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1;overflow:hidden;width:100px">
          Line clamp clipping must be detected across several wrapped lines of visible text.
        </div>
      `;
      root.append(controls);
    });

    const detected = await measureVisibleTextClipping(
      page,
      '[data-testid="settings-clipping-negative-controls"]'
    );
    expect(detected.some(({ axis, reason }) => axis === "vertical" && reason === "overflow")).toBe(
      true
    );
    expect(detected.some(({ reason }) => reason === "ellipsis")).toBe(true);
    expect(detected.some(({ axis, reason }) => axis === "vertical" && reason === "line-clamp")).toBe(
      true
    );

    await page.getByTestId("settings-clipping-negative-controls").evaluate((element) => element.remove());
    await expectNoVisibleSettingsTextClipping(page);
  });

  test("keeps all eight Settings locales readable at browser text 200%", async ({
    browser,
  }) => {
    test.setTimeout(360_000);
    const scenarios = SETTINGS_REFLOW_LOCALES.map((language) => ({
      direction: language === "ar" || language === "he" ? "rtl" : "ltr",
      language,
    }));
    const evidence = [];

    for (const scenario of scenarios) {
      const context = await browser.newContext({
        colorScheme: "light",
        reducedMotion: "reduce",
        viewport: { width: 320, height: 568 },
      });
      const page = await context.newPage();
      const issues = collectRuntimeIssues(page);
      try {
        await openSettings(page, {
          language: scenario.language,
          reducedMotion: "reduce",
          theme: "paper",
        });
        const baselineRootFontSize = await page.evaluate(() =>
          Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
        );
        const appScale = await page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue("--font-scale").trim(),
        );
        expect(appScale || "1").toBe("1");
        await page.evaluate((fontSize) => {
          document.documentElement.style.setProperty("font-size", `${fontSize * 2}px`, "important");
        }, baselineRootFontSize);
        await page.addStyleTag({
          content: `
            [data-testid="settings-page"],
            [data-testid="settings-page"] * {
              line-height: 1.5 !important;
              letter-spacing: 0.12em !important;
              word-spacing: 0.16em !important;
            }
            [data-testid="settings-page"] p {
              margin-block-end: 2em !important;
            }
          `,
        });
        await expect(page.locator("html")).toHaveAttribute("lang", scenario.language);
        await expect(page.locator("html")).toHaveAttribute("dir", scenario.direction);
        await expect
          .poll(() =>
            page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).fontSize)),
          )
          .toBe(baselineRootFontSize * 2);

        const checked: Array<{
          layout: Awaited<ReturnType<typeof measureSettingsRootTextReflow>>;
          state: string;
          visibleTextClipping: Awaited<ReturnType<typeof measureVisibleTextClipping>>;
        }> = [];
        const assertState = async (state: string, measureSelector: string) => {
          const layout = await measureSettingsRootTextReflow(page, measureSelector);
          const visibleTextClipping = await measureVisibleTextClipping(page);
          expect(layout.direction).toBe(scenario.direction);
          expect(layout.rootFontSize).toBe(baselineRootFontSize * 2);
          expect(layout.measureEm, JSON.stringify(layout.rootGeometry)).toBeGreaterThanOrEqual(7);
          expect(layout.outsideText).toEqual([]);
          expect(layout.clippedText).toEqual([]);
          expect(visibleTextClipping).toEqual([]);
          expect(layout.targetIssues).toEqual([]);
          await expectNoAutomaticSettingsHyphenation(page);
          await expectNoHorizontalOverflow(page);
          checked.push({ layout, state, visibleTextClipping });
        };

        await assertState("overview", '[data-testid="settings-module-list"]');
        for (const section of ["appearance", "account", "sound", "privacy"] as const) {
          await page.getByTestId(`settings-module-card-${section}`).click();
          const panel = `[data-testid="settings-module-panel-${section}"]`;
          await expect(page.locator(panel)).toBeVisible();
          if (section === "account") {
            await expect(page.getByTestId("settings-v2-account-checking")).toHaveCount(0, {
              timeout: 10_000,
            });
          }
          await assertState(section, panel);
          if (section === "appearance") {
            await page.screenshot({
              animations: "disabled",
              fullPage: false,
              path: join(OUTPUT_DIR, `root-200-${scenario.language}-appearance.png`),
            });
          }
          await page.getByTestId("settings-mobile-back").click();
          await expect(page.getByTestId("settings-module-list")).toBeVisible();
        }
        expect(issues).toEqual([]);
        evidence.push({ baselineRootFontSize, checked, issues, scenario });
      } finally {
        await context.close();
      }
    }

    await writeFile(
      join(OUTPUT_DIR, "settings-root-200-reflow-runtime.json"),
      JSON.stringify({ evidence }, null, 2),
      "utf8",
    );
  });

  test("reserves the drawer focus rail with asymmetric LTR and RTL safe areas", async ({
    browser,
  }) => {
    test.setTimeout(60_000);
    const cases = [
      { direction: "ltr", language: "en", safeLeft: 24, safeRight: 5 },
      { direction: "rtl", language: "he", safeLeft: 5, safeRight: 24 },
    ] as const;
    const evidence = [];

    for (const scenario of cases) {
      for (const theme of ["paper", "ink"] as const) {
        const context = await browser.newContext({ viewport: { width: 320, height: 568 } });
        const page = await context.newPage();
        const issues = collectRuntimeIssues(page);
        try {
          await openSettings(page, {
            language: scenario.language,
            reducedMotion: "reduce",
            section: "appearance",
            theme,
          });
          await page
            .getByTestId("settings-v2-text-size-field")
            .locator('input[type="range"]')
            .fill("6");
          await page.addStyleTag({
            content: `
              [data-testid="settings-page"],
              [data-testid="settings-page"] * {
                line-height: 1.5 !important;
                letter-spacing: 0.12em !important;
                word-spacing: 0.16em !important;
              }
            `,
          });
          await page.evaluate(({ safeLeft, safeRight }) => {
            document.documentElement.style.setProperty("--safe-area-inset-left", `${safeLeft}px`);
            document.documentElement.style.setProperty("--safe-area-inset-right", `${safeRight}px`);
          }, scenario);
          await expect
            .poll(async () =>
              page.evaluate(() => {
                const root = document.querySelector<HTMLElement>('[data-testid="settings-page"]');
                if (!root) return 0;
                return Number.parseFloat(getComputedStyle(root).paddingInlineStart);
              })
            )
            .toBeGreaterThanOrEqual(88);
          await page.evaluate(
            () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
          );

          const geometry = await page.evaluate(() => {
            const root = document.querySelector<HTMLElement>('[data-testid="settings-page"]');
            const trigger = document.querySelector<HTMLElement>(
              '[data-testid="nav-v2-open-drawer"]'
            );
            if (!root || !trigger) throw new Error("Missing safe-area rail geometry");
            const rootStyle = getComputedStyle(root);
            const rootRect = root.getBoundingClientRect();
            const triggerRect = trigger.getBoundingClientRect();
            const paddingInlineStart = Number.parseFloat(rootStyle.paddingInlineStart);
            const direction = rootStyle.direction;
            const contentStart =
              direction === "rtl"
                ? rootRect.right - paddingInlineStart
                : rootRect.left + paddingInlineStart;
            const focusEdge = direction === "rtl" ? triggerRect.left - 4 : triggerRect.right + 4;
            return {
              direction,
              focusGap: direction === "rtl" ? focusEdge - contentStart : contentStart - focusEdge,
              paddingInlineStart,
              triggerInlineInset:
                direction === "rtl"
                  ? rootRect.right - triggerRect.right
                  : triggerRect.left - rootRect.left,
            };
          });

          const trigger = page.getByTestId("nav-v2-open-drawer");
          let keyboardSteps = 0;
          for (; keyboardSteps < 80; keyboardSteps += 1) {
            if (await trigger.evaluate((element) => document.activeElement === element)) break;
            await page.keyboard.press("Shift+Tab");
          }
          await expect(trigger).toBeFocused();
          const keyboardFocus = await measureKeyboardFocusSafeArea(page);
          const keyboardFocusContrast = await measureKeyboardFocusIndicatorContrast(
            page,
            keyboardFocus
          );

          expect(geometry.direction).toBe(scenario.direction);
          expect(geometry.paddingInlineStart).toBeGreaterThanOrEqual(88);
          expect(geometry.triggerInlineInset).toBeGreaterThanOrEqual(36);
          expect(
            geometry.focusGap,
            `${scenario.language}/${theme} must reserve the 4px focus outline plus separation: ${JSON.stringify(geometry)}`
          ).toBeGreaterThanOrEqual(3.5);
          expect(keyboardSteps).toBeLessThan(80);
          expect(keyboardFocus.activeTestId).toBe("nav-v2-open-drawer");
          expect(keyboardFocus.direction).toBe(scenario.direction);
          expect(keyboardFocus.focusVisible).toBe(true);
          expect(keyboardFocus.focusExtent, JSON.stringify(keyboardFocus)).toBeGreaterThanOrEqual(2);
          expect(keyboardFocus.outlineStyle).not.toBe("none");
          expect(keyboardFocus.outlineColor).not.toBe("rgba(0, 0, 0, 0)");
          expect(keyboardFocus.focusGap).toBeGreaterThanOrEqual(3.5);
          expect(keyboardFocus.viewportGaps.blockStart).toBeGreaterThanOrEqual(0);
          expect(keyboardFocus.viewportGaps.inlineEnd).toBeGreaterThanOrEqual(0);
          expect(
            keyboardFocusContrast.minOutlineAdjacentRatio,
            JSON.stringify(keyboardFocusContrast)
          ).toBeGreaterThanOrEqual(3);
          expect(
            keyboardFocusContrast.samples.every(
              ({ outlineComputedColorMaxChannelDelta }) =>
                outlineComputedColorMaxChannelDelta <= 24
            ),
            JSON.stringify(keyboardFocusContrast)
          ).toBe(true);
          expect(keyboardFocusContrast.painting.before.borderBottomWidth).toBe("0px");
          expect(keyboardFocusContrast.painting.after.borderBottomWidth).toBe("0px");

          const weakOutlineColor = keyboardFocusContrast.samples[0].adjacentBackground;
          await trigger.evaluate((element, [red, green, blue]) => {
            element.style.setProperty(
              "outline-color",
              `rgb(${red}, ${green}, ${blue})`,
              "important"
            );
          }, weakOutlineColor);
          const contrastNegativeControl = await measureKeyboardFocusIndicatorContrast(
            page,
            await measureKeyboardFocusSafeArea(page)
          );
          expect(contrastNegativeControl.samples[0].outlineAdjacentRatio).toBeLessThan(1.1);
          await trigger.evaluate((element) => element.style.removeProperty("outline-color"));
          const restoredKeyboardFocusContrast = await measureKeyboardFocusIndicatorContrast(
            page,
            await measureKeyboardFocusSafeArea(page)
          );
          expect(restoredKeyboardFocusContrast.minOutlineAdjacentRatio).toBeGreaterThanOrEqual(3);

          await page.keyboard.press("Tab");
          await page.keyboard.press("Shift+Tab");
          await expect(trigger).toBeFocused();
          await expect
            .poll(() => trigger.evaluate((element) => element.matches(":focus-visible")))
            .toBe(true);
          await page.getByTestId("settings-page").evaluate((root) => {
            root.style.setProperty("padding-inline-start", "0px", "important");
          });
          const negativeControl = await measureKeyboardFocusSafeArea(page);
          expect(negativeControl.focusVisible).toBe(true);
          expect(negativeControl.focusGap).toBeLessThan(0);
          await page.getByTestId("settings-page").evaluate((root) => {
            root.style.removeProperty("padding-inline-start");
          });
          await expect
            .poll(async () => (await measureKeyboardFocusSafeArea(page)).focusGap)
            .toBeGreaterThanOrEqual(3.5);
          const restoredKeyboardFocus = await measureKeyboardFocusSafeArea(page);
          await expectNoHorizontalOverflow(page);
          await expectNoVisibleSettingsTextClipping(page);
          await expectNoAutomaticSettingsHyphenation(page);
          const viewport = await captureSettingsViewportEvidence(
            page,
            `safe-area-${scenario.language}-${theme}`
          );
          expect(issues).toEqual([]);
          evidence.push({
            geometry,
            issues,
            keyboardFocus,
            keyboardFocusContrast,
            keyboardSteps,
            contrastNegativeControl,
            negativeControl,
            restoredKeyboardFocus,
            restoredKeyboardFocusContrast,
            scenario,
            theme,
            viewport,
          });
        } finally {
          await context.close();
        }
      }
    }

    await writeFile(
      join(OUTPUT_DIR, "safe-area-drawer-rail-runtime.json"),
      JSON.stringify({ evidence }, null, 2),
      "utf8"
    );
  });

  test("keeps the open phone drawer readable, bounded, and focus-safe across themes and directions", async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const scenarios = [
      { direction: "ltr", language: "en", theme: "paper", width: 320 },
      { direction: "rtl", language: "he", theme: "ink", width: 320 },
      { direction: "ltr", language: "de", theme: "oled", width: 390 },
    ] as const;
    const evidence = [];

    for (const scenario of scenarios) {
      const context = await browser.newContext({
        viewport: { width: scenario.width, height: 720 },
        recordVideo: { dir: OUTPUT_DIR, size: { width: scenario.width, height: 720 } },
        reducedMotion: scenario.theme === "paper" ? "reduce" : "no-preference",
      });
      const page = await context.newPage();
      const video = page.video();
      const issues = collectRuntimeIssues(page);
      try {
        await openSettings(page, {
          language: scenario.language,
          reducedMotion: scenario.theme === "paper" ? "reduce" : "no-preference",
          theme: scenario.theme,
        });

        const trigger = page.getByTestId("nav-v2-open-drawer");
        await trigger.click();
        const drawer = page.getByTestId("drawer-v2");
        const close = drawer.locator("header button").first();
        await expect(drawer).toBeVisible();
        await expect(drawer).toHaveAttribute("aria-modal", "true");
        await expect(close).toHaveAccessibleName(/\S/);
        await expect(close).toBeFocused({ timeout: 2_000 });

        const layout = await drawer.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const buttons = Array.from(element.querySelectorAll<HTMLElement>("button"))
            .filter((button) => {
              const style = getComputedStyle(button);
              const target = button.getBoundingClientRect();
              return (
                style.display !== "none" &&
                style.visibility !== "hidden" &&
                target.width > 0 &&
                target.height > 0
              );
            })
            .map((button) => {
              const target = button.getBoundingClientRect();
              return {
                height: Math.round(target.height * 10) / 10,
                label: button.getAttribute("aria-label") || button.textContent?.trim() || "button",
                width: Math.round(target.width * 10) / 10,
              };
            });
          return {
            buttons,
            direction: getComputedStyle(element).direction,
            rect: {
              bottom: rect.bottom,
              left: rect.left,
              right: rect.right,
              top: rect.top,
              width: rect.width,
            },
          };
        });

        expect(layout.direction).toBe(scenario.direction);
        expect(layout.rect.left).toBeGreaterThanOrEqual(-1);
        expect(layout.rect.right).toBeLessThanOrEqual(scenario.width + 1);
        expect(layout.rect.top).toBeGreaterThanOrEqual(-1);
        expect(layout.rect.bottom).toBeLessThanOrEqual(721);
        expect(layout.buttons.filter(({ height, width }) => height < 48 || width < 48)).toEqual([]);
        await expectNoHorizontalOverflow(page);
        await expectNoVisibleSettingsTextClipping(page, '[data-testid="drawer-v2"]');
        await expectNoAutomaticSettingsHyphenation(page, '[data-testid="drawer-v2"]');
        await expect(page.getByTestId("drawer-v2-destination-settings")).toHaveAttribute(
          "aria-current",
          "page"
        );

        const habits = page.getByTestId("drawer-v2-destination-habits");
        await habits.dispatchEvent("pointerdown", { pointerType: "touch" });
        await expect(habits).toHaveAttribute("aria-busy", "true");
        await expect(page.getByTestId("drawer-v2-destination-habits-progress")).toBeVisible();
        await page.screenshot({
          path: join(
            OUTPUT_DIR,
            `drawer-open-${scenario.language}-${scenario.theme}-${scenario.width}.png`
          ),
          animations: "disabled",
        });
        await habits.dispatchEvent("pointercancel", { pointerType: "touch" });
        await expect(habits).not.toHaveAttribute("aria-busy");

        await page.keyboard.press("Escape");
        await expect(drawer).toHaveAttribute("aria-hidden", "true");
        await expect(drawer).toHaveAttribute("inert", "");
        await expect(trigger).toBeFocused();
        await expect(drawer).toHaveCount(0, { timeout: 1_000 });
        expect(issues).toEqual([]);
        evidence.push({ issues, layout, scenario });
      } finally {
        await context.close();
        if (video) {
          await video.saveAs(
            join(
              OUTPUT_DIR,
              `drawer-motion-${scenario.language}-${scenario.theme}-${scenario.width}.webm`
            )
          );
        }
      }
    }

    await writeFile(
      join(OUTPUT_DIR, "drawer-open-runtime.json"),
      JSON.stringify({ evidence }, null, 2),
      "utf8"
    );
  });

  test("keeps 44px Settings targets at full scale throughout the page entrance motion", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      const motionWindow = window as typeof window & {
        __settingsEntranceTargetSamples?: Array<{
          minHeight: number;
          minScale: number;
          minWidth: number;
          targetCount: number;
        }>;
      };
      motionWindow.__settingsEntranceTargetSamples = [];
      let frames = 0;
      const sample = () => {
        frames += 1;
        const root = document.querySelector<HTMLElement>('[data-testid="settings-page"]');
        const wrapper = root?.parentElement;
        if (root && wrapper) {
          const targets = Array.from(
            root.querySelectorAll<HTMLElement>('button, a[href], input, [role="switch"]')
          )
            .map((target) => target.getBoundingClientRect())
            .filter((rect) => rect.width > 0 && rect.height > 0);
          const matrix = new DOMMatrixReadOnly(getComputedStyle(wrapper).transform);
          motionWindow.__settingsEntranceTargetSamples?.push({
            minHeight: Math.min(...targets.map((rect) => rect.height)),
            minScale: Math.min(Math.hypot(matrix.a, matrix.b), Math.hypot(matrix.c, matrix.d)),
            minWidth: Math.min(...targets.map((rect) => rect.width)),
            targetCount: targets.length,
          });
        }
        if (frames < 180) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });

    const issues = collectRuntimeIssues(page);
    await openSettings(page, { reducedMotion: "no-preference" });
    await page.waitForTimeout(500);
    const samples = await page.evaluate(() => {
      const motionWindow = window as typeof window & {
        __settingsEntranceTargetSamples?: Array<{
          minHeight: number;
          minScale: number;
          minWidth: number;
          targetCount: number;
        }>;
      };
      return motionWindow.__settingsEntranceTargetSamples ?? [];
    });

    expect(samples.length).toBeGreaterThanOrEqual(2);
    expect(Math.min(...samples.map((sample) => sample.targetCount))).toBeGreaterThan(0);
    expect(Math.min(...samples.map((sample) => sample.minHeight))).toBeGreaterThanOrEqual(44);
    expect(Math.min(...samples.map((sample) => sample.minWidth))).toBeGreaterThanOrEqual(44);
    expect(Math.min(...samples.map((sample) => sample.minScale))).toBeGreaterThanOrEqual(0.999);
    expect(issues).toEqual([]);
    await writeFile(
      join(OUTPUT_DIR, "settings-entrance-target-runtime.json"),
      JSON.stringify({ issues, samples }, null, 2),
      "utf8"
    );
  });

  test("records sequenced motion and restores focus after both directions", async ({ browser }) => {
    test.setTimeout(60_000);
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
    const videoDayStart = await measureDaylightSettingsScene(page);
    expect(videoDayStart.running).toBe(16);
    await page.waitForTimeout(2_000);
    const videoDayEnd = await measureDaylightSettingsScene(page);
    expect(videoDayEnd.sampleTransform).not.toBe(videoDayStart.sampleTransform);
    expect(videoDayStart.primaryAnimation).not.toBeNull();
    expect(videoDayStart.primaryAnimation).not.toBe("none");
    expect(
      renderedTransformDelta(videoDayStart.primaryTransform, videoDayEnd.primaryTransform)
    ).toBeGreaterThanOrEqual(0.02);

    const overviewLayout = await page.evaluate(() => {
      const hero = document.querySelector<HTMLElement>(
        '[data-testid="settings-page-control-card"]'
      );
      const workspace = document.querySelector<HTMLElement>(
        '[data-testid="settings-page-workspace"]'
      );
      if (!hero || !workspace) throw new Error("Missing Settings layout surfaces");
      return {
        heroHeight: hero.getBoundingClientRect().height,
        workspaceTop: workspace.getBoundingClientRect().top,
      };
    });

    await page.evaluate(() => {
      type MotionSnapshot = {
        active: string[];
        present: Array<{ hidden: string | null; name: string; visibility: string }>;
        timestamp: number;
      };
      const snapshots: MotionSnapshot[] = [];
      const record = () => {
        const surfaces = Array.from(
          document.querySelectorAll<HTMLElement>("[data-settings-motion-surface]")
        );
        snapshots.push({
          active: surfaces
            .filter((surface) => surface.getAttribute("aria-hidden") !== "true")
            .map((surface) => surface.dataset.settingsMotionSurface ?? "unknown"),
          present: surfaces.map((surface) => ({
            hidden: surface.getAttribute("aria-hidden"),
            name: surface.dataset.settingsMotionSurface ?? "unknown",
            visibility: getComputedStyle(surface).visibility,
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
          document.querySelectorAll<HTMLElement>("[data-settings-motion-surface]")
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

    await expect(page.getByTestId("settings-page-control-card")).toHaveCount(0);
    await expect(page.getByTestId("settings-page-workspace")).toBeVisible();
    const detailLayout = { heroMounted: false, workspaceVisible: true };

    await page.getByTestId("settings-v2-theme-choice-ink").click();
    await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe("ink");
    const videoInkStart = await measureEmeraldNightScene(page);
    expect(videoInkStart.runningAnimations).toBe(8);
    await page.waitForTimeout(2_000);
    const videoInkEnd = await measureEmeraldNightScene(page);
    expect(videoInkEnd.sampleTransform).not.toBe(videoInkStart.sampleTransform);
    expect(videoInkStart.primaryAnimation).not.toBeNull();
    expect(videoInkStart.primaryAnimation).not.toBe("none");
    expect(
      renderedTransformDelta(videoInkStart.primaryTransform, videoInkEnd.primaryTransform)
    ).toBeGreaterThanOrEqual(0.02);

    await page.getByTestId("settings-mobile-back").click();
    const appearanceCard = page.getByTestId("settings-module-card-appearance");
    await expect(appearanceCard).toBeVisible();
    await expect(appearanceCard).toBeFocused();
    await expect(page.locator("[data-settings-motion-surface]")).toHaveCount(1);
    await page.waitForTimeout(240);
    const restoredOverviewLayout = await page.evaluate(() => {
      const hero = document.querySelector<HTMLElement>(
        '[data-testid="settings-page-control-card"]'
      );
      const workspace = document.querySelector<HTMLElement>(
        '[data-testid="settings-page-workspace"]'
      );
      if (!hero || !workspace) throw new Error("Missing restored Settings layout surfaces");
      return {
        heroHeight: hero.getBoundingClientRect().height,
        workspaceTop: workspace.getBoundingClientRect().top,
      };
    });
    expect(
      Math.abs(restoredOverviewLayout.heroHeight - overviewLayout.heroHeight)
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(restoredOverviewLayout.workspaceTop - overviewLayout.workspaceTop)
    ).toBeLessThanOrEqual(1);
    expect(issues).toEqual([]);

    const motionEvidence = await page.evaluate(() => {
      const motionWindow = window as typeof window & {
        __settingsMotionObserver?: MutationObserver;
        __settingsMotionSnapshots?: Array<{
          active: string[];
          present: Array<{ hidden: string | null; name: string; visibility: string }>;
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
    expect(
      motionSnapshots.some((snapshot) => snapshot.present.some(({ name }) => name === "overview"))
    ).toBe(true);
    expect(
      motionSnapshots.some((snapshot) => snapshot.present.some(({ name }) => name === "detail"))
    ).toBe(true);
    expect(
      motionSnapshots.some((snapshot) => {
        const names = snapshot.present.map(({ name }) => name);
        return names.includes("overview") && names.includes("detail");
      })
    ).toBe(false);
    expect(motionSnapshots.every((snapshot) => snapshot.active.length <= 1)).toBe(true);
    expect(motionSnapshots.some((snapshot) => snapshot.active.length === 0)).toBe(true);
    const visibleOutgoingSurfaces = motionSnapshots.flatMap((snapshot) =>
      snapshot.present.filter(
        ({ hidden, visibility }) => hidden === "true" && visibility !== "hidden"
      )
    );
    expect(visibleOutgoingSurfaces.length).toBeGreaterThan(0);
    const lowOpacitySamples = opacitySamples.filter(({ opacity }) => opacity < 0.25);
    const lowOpacityWindowMs =
      lowOpacitySamples.length > 0
        ? lowOpacitySamples[lowOpacitySamples.length - 1].timestamp - lowOpacitySamples[0].timestamp
        : 0;
    expect(lowOpacitySamples).toEqual([]);
    await writeFile(
      join(OUTPUT_DIR, "motion-runtime.json"),
      JSON.stringify(
        {
          detailLayout,
          issues,
          lowOpacityWindowMs,
          motionSnapshots,
          visibleOutgoingSurfaces,
          overviewLayout,
          videoDayEnd,
          videoDayStart,
          videoInkEnd,
          videoInkStart,
        },
        null,
        2
      ),
      "utf8"
    );

    await context.close();
    if (video) await video.saveAs(join(OUTPUT_DIR, "settings-mobile-motion.webm"));
  });

  test("removes spatial Settings motion when reduced motion is active", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 390, height: 844 });
    const issues = collectRuntimeIssues(page);
    await openSettings(page, { reducedMotion: "reduce" });

    const reducedDaylight = await measureDaylightSettingsScene(page);
    expect(reducedDaylight).toMatchObject({
      activeIds: [],
      animated: "false",
      mounted: true,
      running: 0,
      unexpectedRunning: [],
    });

    const cssFallback = await page.evaluate(async () => {
      const wrapper = document.querySelector<HTMLElement>(
        '[data-testid="settings-day-cosmic-backdrop"]'
      );
      const root = document.querySelector<HTMLElement>('[data-testid="day-cosmic-background"]');
      if (!wrapper || !root) throw new Error("Missing Paper scene for reduced-motion fallback");
      wrapper.dataset.animated = "true";
      root.dataset.animated = "true";
      for (const container of root.querySelectorAll<HTMLElement>("[data-animated]")) {
        container.dataset.animated = "true";
      }

      const selectors = [".day-cosmic__photon", ".day-cosmic__mote", ".day-cosmic__sun-thread"];
      const elements = selectors.map((selector) => {
        const element = root.querySelector<HTMLElement>(selector);
        if (!element) throw new Error(`Missing Paper fallback target: ${selector}`);
        element.dataset.motionActive = "true";
        element.style.setProperty("--settings-motion-delay", "0s");
        element.style.setProperty("--settings-motion-duration", "18s");
        return { element, selector };
      });
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      return elements.map(({ element, selector }) => ({
        animationName: getComputedStyle(element).animationName,
        runningAnimations: element
          .getAnimations()
          .filter((animation) => animation.playState === "running").length,
        selector,
      }));
    });
    expect(cssFallback).toEqual([
      { animationName: "none", runningAnimations: 0, selector: ".day-cosmic__photon" },
      { animationName: "none", runningAnimations: 0, selector: ".day-cosmic__mote" },
      { animationName: "none", runningAnimations: 0, selector: ".day-cosmic__sun-thread" },
    ]);

    await page.getByTestId("settings-module-card-appearance").click();
    await expect(page.getByTestId("settings-module-panel-appearance")).toBeVisible();
    const motionEvidence = await page.evaluate(() => {
      const surface = document.querySelector<HTMLElement>(
        '[data-settings-motion-surface="detail"]'
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
                (frame.opacity !== undefined && Number(frame.opacity) !== 1)
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
            (frame) => frame.transform !== undefined && frame.transform !== "none"
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
      JSON.stringify(
        { cssFallback, issues, motionEvidence, reducedDaylight, switchEvidence },
        null,
        2
      ),
      "utf8"
    );
  });

  test("resnapshots the in-app motion preference at the subscription boundary", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const issues = collectRuntimeIssues(page);
    await page.addInitScript(() => {
      const originalAddEventListener = window.addEventListener;
      let injected = false;
      window.addEventListener = new Proxy(originalAddEventListener, {
        apply(target, thisArg, argumentsList) {
          if (!injected && argumentsList[0] === "zenflow-motion-preference-change") {
            injected = true;
            localStorage.setItem("zenflow_reduce_motion", JSON.stringify({ reduceMotion: true }));
            sessionStorage.setItem("settings-motion-mount-boundary-proof", "injected");
          }
          return Reflect.apply(target, thisArg, argumentsList);
        },
      });
    });

    await openSettings(page, { reducedMotion: "no-preference", section: "appearance" });

    const motionToggle = page
      .getByTestId("settings-v2-motion-toggle")
      .getByRole("switch", { name: "Reduce motion" });
    await expect(motionToggle).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("day-cosmic-background")).toHaveAttribute(
      "data-animated",
      "false"
    );
    const scene = await measureDaylightSettingsScene(page);
    expect(scene.running).toBe(0);
    const storageProof = await page.evaluate(() => ({
      injection: sessionStorage.getItem("settings-motion-mount-boundary-proof"),
      preference: JSON.parse(localStorage.getItem("zenflow_reduce_motion") ?? "null"),
    }));
    expect(storageProof).toEqual({
      injection: "injected",
      preference: { reduceMotion: true },
    });
    expect(issues).toEqual([]);

    await writeFile(
      join(OUTPUT_DIR, "mount-boundary-motion-runtime.json"),
      JSON.stringify({ issues, scene, storageProof }, null, 2),
      "utf8"
    );
  });

  test("propagates the saved in-app motion preference between open tabs", async ({
    context,
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const primaryIssues = collectRuntimeIssues(page);
    await openSettings(page, { reducedMotion: "no-preference", section: "appearance" });
    expect((await measureDaylightSettingsScene(page)).running).toBe(16);

    const peer = await context.newPage();
    const peerIssues = collectRuntimeIssues(peer);
    const sameOriginControlUrl = await page.evaluate(
      () => new URL("version.json", document.baseURI).href
    );
    await peer.goto(sameOriginControlUrl, { waitUntil: "load" });
    await peer.evaluate(() => {
      localStorage.setItem("zenflow_reduce_motion", JSON.stringify({ reduceMotion: true }));
    });
    await expect.poll(async () => (await measureDaylightSettingsScene(page)).running).toBe(0);
    const stopped = await measureDaylightSettingsScene(page);

    await peer.evaluate(() => {
      localStorage.setItem("zenflow_reduce_motion", JSON.stringify({ reduceMotion: false }));
    });
    await expect.poll(async () => (await measureDaylightSettingsScene(page)).running).toBe(16);
    const restored = await measureDaylightSettingsScene(page);

    expect(primaryIssues).toEqual([]);
    expect(peerIssues).toEqual([]);
    await writeFile(
      join(OUTPUT_DIR, "cross-tab-motion-runtime.json"),
      JSON.stringify({ peerIssues, primaryIssues, restored, stopped }, null, 2),
      "utf8"
    );
    await peer.close();
  });

  test("reacts immediately when the OS motion preference changes while Settings is open", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const issues = collectRuntimeIssues(page);
    await openSettings(page, { reducedMotion: "no-preference", section: "appearance" });

    const paperBefore = await measureDaylightSettingsScene(page);
    expect(paperBefore.running).toBe(16);

    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await expect.poll(async () => (await measureDaylightSettingsScene(page)).running).toBe(0);
    await expect(page.getByTestId("day-cosmic-background")).toHaveAttribute(
      "data-animated",
      "false"
    );
    const paperReduced = await measureDaylightSettingsScene(page);
    expect(paperReduced.animated).toBe("false");

    await page.getByTestId("settings-v2-theme-choice-ink").click();
    await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe("ink");
    const inkReduced = await measureEmeraldNightScene(page);
    expect(inkReduced.runningAnimations).toBe(0);

    await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
    await expect.poll(async () => (await measureEmeraldNightScene(page)).runningAnimations).toBe(8);
    const inkRestored = await measureEmeraldNightScene(page);
    expect(issues).toEqual([]);

    await writeFile(
      join(OUTPUT_DIR, "live-os-motion-runtime.json"),
      JSON.stringify({ inkReduced, inkRestored, issues, paperBefore, paperReduced }, null, 2),
      "utf8"
    );
  });

  test("binds browser-served Settings code to the current production artifact manifest", async ({
    browserName,
    page,
  }) => {
    test.setTimeout(120_000);
    expect(process.env.CI).toMatch(/^(?:1|true)$/);
    expect(process.env.ZENFLOW_PLAYWRIGHT_USE_LOCAL_SERVER).toBe("true");
    expect(process.env.ZENFLOW_PLAYWRIGHT_PREVIEW_DIR).toBe("dist");
    validateStrictProductionPreview();

    await page.setViewportSize({ width: 390, height: 844 });
    const issues = collectRuntimeIssues(page);
    await openSettings(page, { reducedMotion: "reduce", section: "appearance" });
    await expect(page.getByTestId("settings-v2-panel-appearance")).toBeVisible();

    const servedDiscovery = await page.evaluate(() => {
      const resourceUrls = Array.from(
        new Set(
          performance
            .getEntriesByType("resource")
            .map((entry) => entry.name)
            .filter((url) => new URL(url).origin === location.origin)
        )
      );
      const firstBuildAssetPath = resourceUrls
        .map((url) => new URL(url).pathname)
        .find((pathname) => pathname.includes("/assets/"));
      if (!firstBuildAssetPath) throw new Error("No browser-loaded build asset was observed");
      const basePath = firstBuildAssetPath.slice(0, firstBuildAssetPath.indexOf("/assets/") + 1);
      return { basePath, documentUrl: location.href, resourceUrls };
    });

    const assetUrls = servedDiscovery.resourceUrls.flatMap((url) => {
      const parsed = new URL(url);
      if (!parsed.pathname.startsWith(servedDiscovery.basePath)) return [];
      const path = decodeURIComponent(parsed.pathname.slice(servedDiscovery.basePath.length));
      return /^assets\/.*\.(?:css|js)$/.test(path) ? [{ path, url: parsed.href }] : [];
    });
    const assets = await Promise.all(
      assetUrls.map(async ({ path, url }) => {
        const response = await page.request.get(url, {
          headers: { "cache-control": "no-cache" },
          timeout: 10_000,
        });
        expect(response.ok(), `Unable to read served build asset: ${path}`).toBe(true);
        const bytes = await response.body();
        return { path, sha256: sha256(bytes), sizeBytes: bytes.byteLength };
      })
    );
    assets.sort((first, second) => first.path.localeCompare(second.path));

    const documentResponse = await page.request.get(servedDiscovery.documentUrl, {
      headers: { "cache-control": "no-cache" },
      timeout: 10_000,
    });
    expect(documentResponse.ok(), "Unable to read the served Settings document").toBe(true);
    const documentBytes = await documentResponse.body();
    const served = {
      assets,
      basePath: servedDiscovery.basePath,
      document: {
        sha256: sha256(documentBytes),
        sizeBytes: documentBytes.byteLength,
      },
    };

    const distRoot = join(process.cwd(), "dist");
    const manifestPath = join(distRoot, ".zenflow-ratchet-production-web-manifest.json");
    const manifestBytes = await readFile(manifestPath);
    const manifest = JSON.parse(manifestBytes.toString("utf8")) as {
      artifactsSha256: string;
      buildId: string;
      buildInputsSha256: string;
      completed: boolean;
      files: Array<{ path: string; sha256: string; sizeBytes: number }>;
    };
    expect(manifest.completed).toBe(true);

    const manifestFiles = new Map(manifest.files.map((file) => [file.path, file]));
    const distFiles = await buildFileManifest(distRoot);
    const distFileMap = new Map(distFiles.map((file) => [file.path, file]));
    const distRootSha256 = sha256(JSON.stringify(distFiles));
    expect(served.assets.length).toBeGreaterThanOrEqual(8);
    const assetMatches = served.assets.map((asset) => {
      const localFile = distFileMap.get(asset.path);
      expect(localFile, `Missing browser-served asset from dist: ${asset.path}`).toBeDefined();
      expect(asset.sha256, `Served bytes differ from dist for ${asset.path}`).toBe(
        localFile?.sha256
      );
      expect(asset.sizeBytes, `Served byte count differs for ${asset.path}`).toBe(
        localFile?.sizeBytes
      );
      const ratchetEntry = manifestFiles.get(asset.path);
      if (asset.path.endsWith(".js")) {
        expect(
          ratchetEntry,
          `Missing browser-served JavaScript from production manifest: ${asset.path}`
        ).toBeDefined();
        expect(asset.sha256, `Production manifest differs for ${asset.path}`).toBe(
          ratchetEntry?.sha256
        );
      }
      return { ...asset, distMatch: true, ratchetManifestMatch: Boolean(ratchetEntry) };
    });

    const indexBytes = await readFile(join(distRoot, "index.html"));
    expect(served.document.sha256).toBe(sha256(indexBytes));
    expect(served.document.sizeBytes).toBe(indexBytes.byteLength);
    expect(issues).toEqual([]);

    const [testSource, playwrightConfig, packageLock] = await Promise.all([
      readFile(join(process.cwd(), "e2e/settings-final-audit.spec.ts")),
      readFile(join(process.cwd(), "playwright.config.ts")),
      readFile(join(process.cwd(), "package-lock.json")),
    ]);
    await writeFile(
      join(OUTPUT_DIR, "source-build-runtime-provenance.json"),
      JSON.stringify(
        {
          browser: { name: browserName, version: page.context().browser()?.version() ?? null },
          build: {
            artifactsSha256: manifest.artifactsSha256,
            buildId: manifest.buildId,
            buildInputsSha256: manifest.buildInputsSha256,
            distFileCount: distFiles.length,
            distFiles,
            distRootSha256,
            indexHtmlSha256: sha256(indexBytes),
            manifestFileSha256: sha256(manifestBytes),
          },
          execution: {
            byteRetrieval: "Playwright APIRequestContext bound to the browser context",
            basePath: served.basePath,
            previewDir: process.env.ZENFLOW_PLAYWRIGHT_PREVIEW_DIR,
            reuseExistingServer: false,
            serverMode: "vite-preview",
          },
          issues,
          source: {
            packageLockSha256: sha256(packageLock),
            playwrightConfigSha256: sha256(playwrightConfig),
            testSourceSha256: sha256(testSource),
          },
          served: {
            assets: assetMatches,
            document: served.document,
          },
        },
        null,
        2
      ),
      "utf8"
    );
    validateStrictProductionPreview();
  });
});
