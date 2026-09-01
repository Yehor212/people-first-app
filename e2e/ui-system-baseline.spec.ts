import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { arch, platform, release } from "node:os";
import path from "node:path";

import { expect, test as base, type Page } from "@playwright/test";

import {
  primeZenflowV2,
  type ZenflowV2Language,
  type ZenflowV2Theme,
} from "./helpers/zenflowV2State";

const SUBJECT_HEAD = "e5016f156497a9d3e55578b773294bf56adce58e";
const PROMPT_SHA256 = "48d71d583237e787e983b85689ad892be67bfd6a191f60912e0127c392182fa1";
const FIXED_CLOCK = "2026-07-28T12:00:00.000Z";
const BUILD_RECEIPT_PATH = "dist/.zenflow-ratchet-production-web-manifest.json";
const OUTPUT_ROOT = path.join("output", "ui-system-audit", SUBJECT_HEAD, "baseline");
const RUNTIME_CAPTURE_PATH = path.join(OUTPUT_ROOT, "runtime-capture.json");
const HOST_OS = `${platform()} ${release()}`;
const HOST_ARCHITECTURE = arch();
const PLAYWRIGHT_VERSION = (
  JSON.parse(readFileSync("node_modules/@playwright/test/package.json", "utf8")) as {
    version: string;
  }
).version;

const test = base.extend<{ auditPage: Page }>({
  auditPage: async ({ playwright }, provide, testInfo) => {
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext({
      baseURL: testInfo.project.use.baseURL as string,
    });
    const page = await context.newPage();
    try {
      await provide(page);
    } finally {
      await context.close();
      await browser.close();
    }
  },
});

interface ScreenshotRuntimeRow {
  id: string;
  path: string;
  route: string;
  state: string;
  viewport: { width: number; height: number };
  dpr: number;
  browser: string;
  runtime: string;
  hostOs: string;
  hostArchitecture: string;
  playwrightVersion: string;
  browserVersion: string;
  fontProvenance: string;
  platformProof: "WEB_BROWSER_ONLY";
  theme: string;
  locale: string;
  timezone: string;
  clock: string;
  fontScale: number;
  reducedMotion: boolean;
  input: string;
  network: string;
  fixtureProvenance: {
    kind: "ISOLATED_TEST_FIXTURE" | "NONE";
    id: string | null;
    source: string | null;
    productionReachable: false;
  };
  sha256: string;
  sizeBytes: number;
  observations: Record<string, string | number | boolean | null>;
}

interface CaptureOptions {
  id: string;
  route: string;
  state: string;
  viewport: { width: number; height: number };
  theme: string;
  locale: string;
  fontScale?: number;
  input?: string;
  network?: string;
  fullPage?: boolean;
  fixture?: {
    id: string;
    source: string;
  };
  observations?: Record<string, string | number | boolean | null>;
}

const runtimeRows: ScreenshotRuntimeRow[] = [];

function sha256File(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function currentSubjectHead(): string {
  return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

function readBuildReceipt() {
  return JSON.parse(readFileSync(BUILD_RECEIPT_PATH, "utf8")) as {
    completed: boolean;
    target: string;
    mode: string;
    artifactsSha256: string;
  };
}

async function settleVisuals(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
}

async function capture(page: Page, options: CaptureOptions) {
  await settleVisuals(page);
  const { fontProvenance, ...layoutObservation } = await page.evaluate(() => {
    const settingsPage = document.querySelector<HTMLElement>('[data-testid="settings-page"]');
    const workspace = document.querySelector<HTMLElement>(
      '[data-testid="settings-page-workspace"]'
    );
    const settingsRect = settingsPage?.getBoundingClientRect();
    const workspaceRect = workspace?.getBoundingClientRect();
    return {
      fontProvenance: `document.fonts.status=${document.fonts.status}; bodyFontFamily=${getComputedStyle(document.body).fontFamily}`,
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      settingsPageLeft: settingsRect ? Math.round(settingsRect.left) : null,
      settingsPageWidth: settingsRect ? Math.round(settingsRect.width) : null,
      settingsWorkspaceLeft: workspaceRect ? Math.round(workspaceRect.left) : null,
      settingsWorkspaceWidth: workspaceRect ? Math.round(workspaceRect.width) : null,
    };
  });
  const relativePath = path.join(OUTPUT_ROOT, `${options.id}.png`);
  await page.screenshot({
    path: relativePath,
    fullPage: options.fullPage ?? false,
    animations: "disabled",
  });
  const screenshotPath = path.resolve(relativePath);
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  const browserVersion = page.context().browser()?.version() ?? "unknown";
  runtimeRows.push({
    id: options.id,
    path: relativePath.split(path.sep).join("/"),
    route: options.route,
    state: options.state,
    viewport: options.viewport,
    dpr,
    browser: `Chromium ${browserVersion}`,
    runtime: "Vite production preview from dist",
    hostOs: HOST_OS,
    hostArchitecture: HOST_ARCHITECTURE,
    playwrightVersion: PLAYWRIGHT_VERSION,
    browserVersion,
    fontProvenance,
    platformProof: "WEB_BROWSER_ONLY",
    theme: options.theme,
    locale: options.locale,
    timezone: "UTC",
    clock: FIXED_CLOCK,
    fontScale: options.fontScale ?? 1,
    reducedMotion: true,
    input: options.input ?? "keyboard+pointer",
    network: options.network ?? "local production preview; online",
    fixtureProvenance: options.fixture
      ? {
          kind: "ISOLATED_TEST_FIXTURE",
          id: options.fixture.id,
          source: options.fixture.source,
          productionReachable: false,
        }
      : {
          kind: "NONE",
          id: null,
          source: null,
          productionReachable: false,
        },
    sha256: sha256File(screenshotPath),
    sizeBytes: statSync(screenshotPath).size,
    observations: {
      ...layoutObservation,
      ...(options.observations ?? {}),
    },
  });
}

async function primePage(
  page: Page,
  options: {
    locale: ZenflowV2Language;
    theme: ZenflowV2Theme;
    viewport: { width: number; height: number };
    fontScale?: number;
    highContrast?: boolean;
  }
) {
  await page.clock.setFixedTime(new Date(FIXED_CLOCK));
  await page.emulateMedia({
    colorScheme: options.theme === "paper" ? "light" : "dark",
    reducedMotion: "reduce",
  });
  await page.setViewportSize(options.viewport);
  await primeZenflowV2(page, {
    clearStorage: true,
    language: options.locale,
    theme: options.theme,
  });
  await page.addInitScript(
    ({ fontScale, highContrast, theme }) => {
      localStorage.setItem("zenflow_font_scale", JSON.stringify(fontScale));
      localStorage.setItem(
        "zenflow:theme-v0c",
        JSON.stringify({
          state: {
            theme,
            themeCustomization: {
              schemaVersion: 1,
              accentFamily: "green",
              highContrast,
            },
          },
          version: 1,
        })
      );
    },
    {
      fontScale: options.fontScale ?? 1,
      highContrast: options.highContrast ?? false,
      theme: options.theme,
    }
  );
}

async function openV2Route(
  page: Page,
  route: "settings" | "orb" | "habits" | "diary" | "planning",
  options: {
    layout: "phone" | "desktop";
    section?: string;
  }
) {
  const params = new URLSearchParams({
    dev: "true",
    nav: "v2",
    navLayout: options.layout,
  });
  if (options.section) params.set("settingsSection", options.section);
  await page.goto(`${route}?${params.toString()}`, {
    waitUntil: "domcontentloaded",
  });
}

test.describe.serial("ZenFlow immutable UI-system baseline", () => {
  test.setTimeout(90_000);

  test.beforeAll(() => {
    expect(currentSubjectHead()).toBe(SUBJECT_HEAD);
    const receipt = readBuildReceipt();
    expect(receipt).toMatchObject({
      completed: true,
      target: "web",
      mode: "production",
    });
    expect(receipt.artifactsSha256).toMatch(/^[a-f0-9]{64}$/);
    mkdirSync(OUTPUT_ROOT, { recursive: true });
  });

  test.afterAll(() => {
    const receipt = readBuildReceipt();
    const payload = {
      schemaVersion: 1,
      promptSha256: PROMPT_SHA256,
      subjectHead: SUBJECT_HEAD,
      productionBuildHash: receipt.artifactsSha256,
      fixedClock: FIXED_CLOCK,
      generatedBy: "e2e/ui-system-baseline.spec.ts",
      screenshots: runtimeRows,
      platformBoundaries: {
        localProductionWeb: "VERIFIED",
        installedPwa: "UNVERIFIED",
        androidCapacitor: "UNVERIFIED",
        iosWkWebView: "UNVERIFIED",
        desktopTauri: "UNVERIFIED",
        publicDeployment: "UNVERIFIED",
      },
    };
    writeFileSync(RUNTIME_CAPTURE_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  });

  test("BL-01 compact Ukrainian Ink Settings overview", async ({ auditPage: page }) => {
    const viewport = { width: 390, height: 844 };
    await primePage(page, { locale: "uk", theme: "ink", viewport });
    await openV2Route(page, "settings", { layout: "phone" });
    await expect(page.getByTestId("settings-page")).toBeVisible();
    await expect(page.getByTestId("settings-module-list")).toBeVisible();
    await capture(page, {
      id: "BL-01-settings-overview-uk-ink-compact",
      route: "/settings?nav=v2&navLayout=phone&dev=true",
      state: "overview; signed-out local state",
      viewport,
      theme: "ink",
      locale: "uk",
    });
  });

  test("BL-02 compact Ukrainian Account detail", async ({ auditPage: page }) => {
    const viewport = { width: 390, height: 844 };
    await primePage(page, { locale: "uk", theme: "ink", viewport });
    await openV2Route(page, "settings", {
      layout: "phone",
      section: "account",
    });
    await expect(page.getByTestId("settings-v2-panel-account")).toBeVisible();
    await capture(page, {
      id: "BL-02-settings-account-uk-ink-compact",
      route: "/settings?nav=v2&navLayout=phone&dev=true&settingsSection=account",
      state: "account detail; unauthenticated local state",
      viewport,
      theme: "ink",
      locale: "uk",
    });
  });

  test("BL-03 Arabic Paper appearance at medium width", async ({ auditPage: page }) => {
    const viewport = { width: 820, height: 1180 };
    await primePage(page, { locale: "ar", theme: "paper", viewport });
    await openV2Route(page, "settings", {
      layout: "desktop",
      section: "appearance",
    });
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByTestId("settings-v2-panel-appearance")).toBeVisible();
    await capture(page, {
      id: "BL-03-settings-appearance-ar-paper-medium",
      route: "/settings?nav=v2&navLayout=desktop&dev=true&settingsSection=appearance",
      state: "list-detail; RTL",
      viewport,
      theme: "paper",
      locale: "ar",
    });
  });

  test("BL-04 English OLED expanded list-detail", async ({ auditPage: page }) => {
    const viewport = { width: 1440, height: 1000 };
    await primePage(page, { locale: "en", theme: "oled", viewport });
    await openV2Route(page, "settings", {
      layout: "desktop",
      section: "appearance",
    });
    await expect(page.getByTestId("settings-v2-panel-appearance")).toBeVisible();
    await capture(page, {
      id: "BL-04-settings-appearance-en-oled-expanded",
      route: "/settings?nav=v2&navLayout=desktop&dev=true&settingsSection=appearance",
      state: "expanded list-detail",
      viewport,
      theme: "oled",
      locale: "en",
    });
  });

  test("BL-05 largest app text and high contrast", async ({ auditPage: page }) => {
    const viewport = { width: 320, height: 568 };
    await primePage(page, {
      locale: "en",
      theme: "ink",
      viewport,
      fontScale: 1.5,
      highContrast: true,
    });
    await openV2Route(page, "settings", {
      layout: "phone",
      section: "appearance",
    });
    await expect(page.locator("html")).toHaveAttribute("data-theme-contrast", "high");
    await capture(page, {
      id: "BL-05-settings-high-contrast-font-150",
      route: "/settings?nav=v2&navLayout=phone&dev=true&settingsSection=appearance",
      state: "high contrast; 150% app text",
      viewport,
      theme: "ink-high-contrast",
      locale: "en",
      fontScale: 1.5,
    });
  });

  test("BL-06 privacy detail", async ({ auditPage: page }) => {
    const viewport = { width: 390, height: 844 };
    await primePage(page, { locale: "en", theme: "paper", viewport });
    await openV2Route(page, "settings", {
      layout: "phone",
      section: "privacy",
    });
    await expect(page.getByTestId("settings-module-panel-privacy")).toBeVisible();
    await capture(page, {
      id: "BL-06-settings-privacy-en-paper",
      route: "/settings?nav=v2&navLayout=phone&dev=true&settingsSection=privacy",
      state: "privacy detail",
      viewport,
      theme: "paper",
      locale: "en",
    });
  });

  test("BL-08 isolated storage-error presentation", async ({ auditPage: page }) => {
    const viewport = { width: 390, height: 844 };
    await primePage(page, { locale: "en", theme: "paper", viewport });
    await openV2Route(page, "settings", { layout: "phone" });
    await expect(page.getByTestId("settings-page")).toBeVisible();
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("zenflow:storage-error", {
          detail: { message: "Audit fixture: local save unavailable." },
        })
      );
    });
    await expect(page.getByTestId("storage-error-banner")).toBeVisible();
    await capture(page, {
      id: "BL-08-storage-error-isolated-fixture",
      route: "/settings?nav=v2&navLayout=phone&dev=true",
      state: "storage error banner",
      viewport,
      theme: "paper",
      locale: "en",
      fixture: {
        id: "storage-error-local-save-unavailable-v1",
        source: "e2e/ui-system-baseline.spec.ts",
      },
    });
  });

  test("BL-09 Arabic Paper orb first-use surface", async ({ auditPage: page }) => {
    const viewport = { width: 390, height: 844 };
    await primePage(page, { locale: "ar", theme: "paper", viewport });
    await openV2Route(page, "orb", { layout: "phone" });
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByTestId("orb-page")).toBeVisible();
    await capture(page, {
      id: "BL-09-orb-ar-paper-compact",
      route: "/orb?nav=v2&navLayout=phone&dev=true",
      state: "ready; empty local mood history",
      viewport,
      theme: "paper",
      locale: "ar",
      fullPage: false,
    });
  });

  test("BL-10 Ukrainian Paper habits empty state", async ({ auditPage: page }) => {
    const viewport = { width: 820, height: 1180 };
    await primePage(page, { locale: "uk", theme: "paper", viewport });
    await openV2Route(page, "habits", { layout: "desktop" });
    await expect(page.getByTestId("habits-page")).toBeVisible();
    await capture(page, {
      id: "BL-10-habits-uk-paper-empty",
      route: "/habits?nav=v2&navLayout=desktop&dev=true",
      state: "empty local habit collection",
      viewport,
      theme: "paper",
      locale: "uk",
    });
  });

  test("BL-11 English Ink diary empty state", async ({ auditPage: page }) => {
    const viewport = { width: 1440, height: 1000 };
    await primePage(page, { locale: "en", theme: "ink", viewport });
    await openV2Route(page, "diary", { layout: "desktop" });
    await expect(page.getByTestId("diary-page")).toBeVisible();
    await capture(page, {
      id: "BL-11-diary-en-ink-empty",
      route: "/diary?nav=v2&navLayout=desktop&dev=true",
      state: "empty local diary",
      viewport,
      theme: "ink",
      locale: "en",
    });
  });

  test("BL-12 Arabic OLED planning empty state", async ({ auditPage: page }) => {
    const viewport = { width: 820, height: 1180 };
    await primePage(page, { locale: "ar", theme: "oled", viewport });
    await openV2Route(page, "planning", { layout: "desktop" });
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByTestId("planning-page")).toBeVisible();
    await capture(page, {
      id: "BL-12-planning-ar-oled-empty",
      route: "/planning?nav=v2&navLayout=desktop&dev=true",
      state: "empty local schedule; RTL",
      viewport,
      theme: "oled",
      locale: "ar",
      fullPage: false,
    });
  });

  test("BL-13 static offline locale contract observation", async ({ auditPage: page }) => {
    const viewport = { width: 390, height: 844 };
    await page.clock.setFixedTime(new Date(FIXED_CLOCK));
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("zenflow-language", JSON.stringify("ar"));
    });
    await page.goto("offline.html", { waitUntil: "domcontentloaded" });
    const observations = await page.evaluate(() => ({
      documentLang: document.documentElement.lang,
      documentDir: document.documentElement.dir || "ltr-default",
      title: document.getElementById("offline-title")?.textContent ?? "",
    }));
    await expect(page.locator("#offline-title")).not.toBeEmpty();
    await capture(page, {
      id: "BL-13-offline-json-language-ar",
      route: "/offline.html",
      state: "static offline fallback with app-format JSON language storage",
      viewport,
      theme: "static-dark",
      locale: "ar-requested",
      observations,
    });
  });

  test("BL-14 Arabic delete-account static page at expanded text", async ({ auditPage: page }) => {
    const viewport = { width: 320, height: 800 };
    await page.clock.setFixedTime(new Date(FIXED_CLOCK));
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.setViewportSize(viewport);
    await page.goto("delete-account.html?lang=ar", {
      waitUntil: "domcontentloaded",
    });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await capture(page, {
      id: "BL-14-delete-account-ar-expanded-text",
      route: "/delete-account.html?lang=ar",
      state: "static account-deletion guidance; 200% root text fixture",
      viewport,
      theme: "static-dark",
      locale: "ar",
      fontScale: 2,
      fixture: {
        id: "static-page-root-font-200-v1",
        source: "e2e/ui-system-baseline.spec.ts",
      },
    });
  });

  test("BL-15 privacy static page and BL-16 terms expanded page", async ({ auditPage: page }) => {
    const mobileViewport = { width: 390, height: 844 };
    await page.clock.setFixedTime(new Date(FIXED_CLOCK));
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await page.setViewportSize(mobileViewport);
    await page.goto("privacy.html", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Privacy/i);
    await capture(page, {
      id: "BL-15-privacy-static-mobile",
      route: "/privacy.html",
      state: "static legal information",
      viewport: mobileViewport,
      theme: "static-light",
      locale: "en",
    });

    const desktopViewport = { width: 1440, height: 1000 };
    await page.setViewportSize(desktopViewport);
    await page.goto("terms.html", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Terms/i);
    await capture(page, {
      id: "BL-16-terms-static-expanded",
      route: "/terms.html",
      state: "static legal information",
      viewport: desktopViewport,
      theme: "static-light",
      locale: "en",
    });
  });
});
