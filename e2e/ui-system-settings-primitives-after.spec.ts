import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { validateProductionWebBundleManifest } from "../scripts/ratchet-bundle-manifest";
import {
  TASK9_EXPECTED_CAPTURE_IDS,
  validateTask9CaptureSet,
  validateTask9ProductionContext,
} from "../scripts/ui-audit/task9-runtime-evidence.mjs";
import {
  primeZenflowV2,
  type ZenflowV2Language,
  type ZenflowV2Theme,
} from "./helpers/zenflowV2State";

const SUBJECT_HEAD = "e5016f156497a9d3e55578b773294bf56adce58e";
const FIXED_CLOCK = "2026-07-29T12:00:00.000Z";
const OUTPUT_ROOT = path.join(
  "output",
  "ui-system-audit",
  SUBJECT_HEAD,
  "after",
  "task9-settings-primitives"
);
const RECEIPT_PATH = path.join(OUTPUT_ROOT, "runtime-capture.json");
const BUILD_RECEIPT_PATH = "dist/.zenflow-ratchet-production-web-manifest.json";
const PRODUCTION_SOURCES = [
  "src/styles/themes.css",
  "src/pages/nav-v2/settings/components/V2SettingsPrimitiveTypes.ts",
  "src/pages/nav-v2/settings/components/V2SettingsControlPrimitives.tsx",
  "src/pages/nav-v2/settings/V2SettingsAccountPanel.tsx",
  "src/pages/nav-v2/settings/V2SettingsSoundPanel.tsx",
  "src/pages/nav-v2/settings/V2SettingsNotificationFeedback.tsx",
] as const;
const EVIDENCE_SOURCES = [
  "e2e/ui-system-settings-primitives-after.spec.ts",
  "scripts/ui-audit/task9-runtime-evidence.mjs",
] as const;

interface CaptureRow {
  id: string;
  path: string;
  route: string;
  state: string;
  viewport: { width: number; height: number };
  theme: string;
  locale: string;
  fontScale: number;
  reducedMotion: true;
  fixtureProvenance: {
    kind: "ISOLATED_TEST_FIXTURE";
    source: "e2e/helpers/zenflowV2State.ts";
    productionReachable: false;
  };
  observations: Record<string, string | number | boolean | null>;
  sha256: string;
  sizeBytes: number;
}

const captures: CaptureRow[] = [];
let productionContext:
  | {
      serverMode: "production-dist-preview";
      baseURL: string;
      configuredBaseURL: string;
      previewDirectory: "dist";
    }
  | undefined;

function sha256File(filePath: string) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function currentSubjectHead() {
  return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

function readBuildReceipt() {
  return JSON.parse(readFileSync(BUILD_RECEIPT_PATH, "utf8")) as {
    completed: boolean;
    target: string;
    mode: string;
    buildId: string;
    artifactsSha256: string;
  };
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

async function openSettings(page: Page, layout: "phone" | "desktop", section: string) {
  const query = new URLSearchParams({
    dev: "true",
    nav: "v2",
    navLayout: layout,
    settingsSection: section,
  });
  await page.goto(`settings?${query.toString()}`, { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
}

async function inspectPanel(page: Page, panelTestId: string) {
  const panel = page.getByTestId(panelTestId);
  await expect(panel).toBeVisible();
  const group = panel.locator('[data-slot="settings-group"]');
  await expect(group).toHaveCount(1);

  const observation = await panel.evaluate((panelElement) => {
    const groupElement = panelElement.querySelector<HTMLElement>('[data-slot="settings-group"]');
    if (!groupElement) return null;
    const panelStyle = getComputedStyle(panelElement);
    const groupStyle = getComputedStyle(groupElement);
    const headerElement = panelElement.querySelector<HTMLElement>(
      '[data-slot="settings-panel-header"]'
    );
    const headerIcon = panelElement.querySelector<HTMLElement>('[data-slot="settings-panel-icon"]');
    const headerCopy = panelElement.querySelector<HTMLElement>('[data-slot="settings-panel-copy"]');
    const headerIconRect = headerIcon?.getBoundingClientRect();
    const headerCopyRect = headerCopy?.getBoundingClientRect();
    const ordinaryRows = Array.from(
      groupElement.querySelectorAll<HTMLElement>('[data-containment="row"]')
    );
    const callouts = Array.from(
      groupElement.querySelectorAll<HTMLElement>('[data-containment="callout"]')
    );
    return {
      panelBorderWidth: panelStyle.borderWidth,
      panelBackgroundColor: panelStyle.backgroundColor,
      panelBoxShadow: panelStyle.boxShadow,
      panelOverflow: panelStyle.overflow,
      groupBorderWidth: groupStyle.borderWidth,
      groupBackgroundColor: groupStyle.backgroundColor,
      groupBackgroundImage: groupStyle.backgroundImage,
      groupHasBackground:
        groupStyle.backgroundColor !== "rgba(0, 0, 0, 0)" ||
        groupStyle.backgroundImage !== "none",
      groupBoxShadow: groupStyle.boxShadow,
      groupOverflow: groupStyle.overflow,
      headerDisplay: headerElement ? getComputedStyle(headerElement).display : null,
      headerIconInlineWithCopy:
        headerElement !== null &&
        headerIconRect !== undefined &&
        headerCopyRect !== undefined &&
        Math.min(headerIconRect.bottom, headerCopyRect.bottom) >
          Math.max(headerIconRect.top, headerCopyRect.top),
      ordinaryRowCount: ordinaryRows.length,
      calloutCount: callouts.length,
      ordinaryRowsFlat: ordinaryRows.every((row) => {
        const style = getComputedStyle(row);
        return (
          style.borderWidth === "0px" &&
          style.backgroundColor === "rgba(0, 0, 0, 0)" &&
          style.boxShadow === "none"
        );
      }),
      documentOverflowPx: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  expect(observation).not.toBeNull();
  expect(observation).toMatchObject({
    panelBorderWidth: "0px",
    panelBoxShadow: "none",
    panelOverflow: "visible",
    groupBoxShadow: "none",
    groupOverflow: "visible",
    groupHasBackground: true,
    ordinaryRowsFlat: true,
  });
  expect(observation?.documentOverflowPx).toBeLessThanOrEqual(0);
  expect(observation?.groupBorderWidth).not.toBe("0px");
  return observation as NonNullable<typeof observation>;
}

async function tabToPanelControl(page: Page, panelTestId: string) {
  const panel = page.getByTestId(panelTestId);
  let focusedControlInsidePanel = false;

  for (let attempt = 0; attempt < 60; attempt += 1) {
    await page.keyboard.press("Tab");
    focusedControlInsidePanel = await panel.evaluate((panelElement) =>
      panelElement.contains(document.activeElement)
    );
    if (focusedControlInsidePanel) break;
  }

  expect(focusedControlInsidePanel).toBe(true);
  await panel.evaluate((panelElement) => {
    panelElement.scrollIntoView({ block: "start", inline: "nearest" });
  });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      })
  );
  const observation = await panel.evaluate((panelElement) => {
    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLElement) || !panelElement.contains(activeElement)) {
      return null;
    }
    const style = getComputedStyle(activeElement);
    const outlineWidth = Number.parseFloat(style.outlineWidth);
    const focusVisible = activeElement.matches(":focus-visible");
    const focusIndicatorVisible =
      (style.outlineStyle !== "none" && Number.isFinite(outlineWidth) && outlineWidth > 0) ||
      style.boxShadow !== "none";

    return {
      focusedControlInsidePanel: true,
      focusedControlTag: activeElement.tagName.toLowerCase(),
      focusedControlRole: activeElement.getAttribute("role"),
      focusVisible,
      focusIndicatorVisible,
      focusOutlineStyle: style.outlineStyle,
      focusOutlineWidth: style.outlineWidth,
      focusBoxShadow: style.boxShadow,
    };
  });

  expect(observation).toMatchObject({
    focusedControlInsidePanel: true,
    focusVisible: true,
    focusIndicatorVisible: true,
  });
  return observation as NonNullable<typeof observation>;
}

async function capture(
  page: Page,
  options: {
    id: string;
    route: string;
    state: string;
    viewport: { width: number; height: number };
    theme: string;
    locale: string;
    fontScale?: number;
    observations: Record<string, string | number | boolean | null>;
  }
) {
  const relativePath = path.join(OUTPUT_ROOT, `${options.id}.png`);
  await page.screenshot({
    path: relativePath,
    animations: "disabled",
    caret: "hide",
    clip: {
      x: 0,
      y: 0,
      width: options.viewport.width,
      height: options.viewport.height,
    },
  });
  const absolutePath = path.resolve(relativePath);
  captures.push({
    ...options,
    path: relativePath.split(path.sep).join("/"),
    fontScale: options.fontScale ?? 1,
    reducedMotion: true,
    fixtureProvenance: {
      kind: "ISOLATED_TEST_FIXTURE",
      source: "e2e/helpers/zenflowV2State.ts",
      productionReachable: false,
    },
    sha256: sha256File(absolutePath),
    sizeBytes: statSync(absolutePath).size,
  });
}

test.describe.serial("Task 9 Settings primitive after evidence", () => {
  test.setTimeout(90_000);

  test.beforeAll(() => {
    mkdirSync(OUTPUT_ROOT, { recursive: true });
    rmSync(RECEIPT_PATH, { force: true });
    for (const id of TASK9_EXPECTED_CAPTURE_IDS) {
      rmSync(path.join(OUTPUT_ROOT, `${id}.png`), { force: true });
    }
    captures.splice(0);
    productionContext = undefined;

    expect(currentSubjectHead()).toBe(SUBJECT_HEAD);
    expect(process.env.CI).toMatch(/^(?:1|true)$/);
    expect(process.env.ZENFLOW_PLAYWRIGHT_USE_LOCAL_SERVER).toBe("true");
    expect(process.env.ZENFLOW_PLAYWRIGHT_PREVIEW_DIR).toBe("dist");
    validateProductionWebBundleManifest({ rootDir: process.cwd(), env: process.env });
    expect(readBuildReceipt()).toMatchObject({
      completed: true,
      target: "web",
      mode: "production",
    });
  });

  test.beforeEach(({ baseURL }, testInfo) => {
    const configuredBaseURL =
      typeof testInfo.project.use.baseURL === "string" ? testInfo.project.use.baseURL : "";
    const errors = validateTask9ProductionContext({
      env: process.env,
      baseURL,
      configuredBaseURL,
    });
    expect(errors).toEqual([]);

    const nextContext = {
      serverMode: "production-dist-preview" as const,
      baseURL: baseURL ?? "",
      configuredBaseURL,
      previewDirectory: "dist" as const,
    };
    if (productionContext) {
      expect(nextContext).toEqual(productionContext);
    } else {
      productionContext = nextContext;
    }
  });

  test.afterAll(() => {
    rmSync(RECEIPT_PATH, { force: true });
    const captureErrors = validateTask9CaptureSet({
      captures,
      outputRoot: OUTPUT_ROOT,
      repositoryRoot: process.cwd(),
    });
    if (captureErrors.length > 0) {
      throw new Error(`Task 9 runtime evidence is incomplete:\n${captureErrors.join("\n")}`);
    }
    if (!productionContext) {
      throw new Error("Task 9 runtime evidence has no validated production preview context");
    }

    const build = readBuildReceipt();
    writeFileSync(
      RECEIPT_PATH,
      `${JSON.stringify(
        {
          schemaVersion: 1,
          task: "TASK-9",
          subjectHead: SUBJECT_HEAD,
          fixedClock: FIXED_CLOCK,
          build,
          sourceSha256: Object.fromEntries(
            PRODUCTION_SOURCES.map((source) => [source, sha256File(source)])
          ),
          evidenceSourceSha256: Object.fromEntries(
            EVIDENCE_SOURCES.map((source) => [source, sha256File(source)])
          ),
          expectedCaptureCount: TASK9_EXPECTED_CAPTURE_IDS.length,
          expectedCaptureIds: TASK9_EXPECTED_CAPTURE_IDS,
          productionContext,
          platformBoundary: {
            localProductionWebChromium: "VERIFIED",
            installedPwa: "UNVERIFIED",
            androidCapacitor: "UNVERIFIED",
            iosWkWebView: "UNVERIFIED",
            desktopTauri: "UNVERIFIED",
            assistiveTechnology: "UNVERIFIED",
            humanAcceptance: "UNVERIFIED",
          },
          captures,
        },
        null,
        2
      )}\n`
    );
  });

  test("captures 150% text with high contrast", async ({ page }) => {
    const viewport = { width: 320, height: 568 };
    await primePage(page, {
      locale: "en",
      theme: "ink",
      viewport,
      fontScale: 1.5,
      highContrast: true,
    });
    await openSettings(page, "phone", "appearance");
    await expect(page.locator("html")).toHaveAttribute("data-theme-contrast", "high");
    const focusObservations = await tabToPanelControl(page, "settings-v2-panel-appearance");
    const observations = {
      ...(await inspectPanel(page, "settings-v2-panel-appearance")),
      ...focusObservations,
    };
    await capture(page, {
      id: "AFTER-09-05-settings-high-contrast-font-150",
      route: "/settings?nav=v2&navLayout=phone&dev=true&settingsSection=appearance",
      state: "high contrast; 150% app text; keyboard focus-visible",
      viewport,
      theme: "ink-high-contrast",
      locale: "en",
      fontScale: 1.5,
      observations,
    });
  });

  test("captures compact Ukrainian Account in Ink", async ({ page }) => {
    const viewport = { width: 390, height: 844 };
    await primePage(page, { locale: "uk", theme: "ink", viewport });
    await openSettings(page, "phone", "account");
    const observations = await inspectPanel(page, "settings-v2-panel-account");
    await capture(page, {
      id: "AFTER-09-02-settings-account-uk-ink-compact",
      route: "/settings?nav=v2&navLayout=phone&dev=true&settingsSection=account",
      state: "account detail; unauthenticated isolated local state",
      viewport,
      theme: "ink",
      locale: "uk",
      observations,
    });
  });

  test("captures compact Privacy in Paper", async ({ page }) => {
    const viewport = { width: 390, height: 844 };
    await primePage(page, { locale: "en", theme: "paper", viewport });
    await openSettings(page, "phone", "privacy");
    const observations = await inspectPanel(page, "settings-v2-panel-data");
    await capture(page, {
      id: "AFTER-09-06-settings-privacy-en-paper",
      route: "/settings?nav=v2&navLayout=phone&dev=true&settingsSection=privacy",
      state: "privacy detail",
      viewport,
      theme: "paper",
      locale: "en",
      observations,
    });
  });

  test("captures Arabic Appearance list-detail in Paper", async ({ page }) => {
    const viewport = { width: 820, height: 1180 };
    await primePage(page, { locale: "ar", theme: "paper", viewport });
    await openSettings(page, "desktop", "appearance");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const focusObservations = await tabToPanelControl(page, "settings-v2-panel-appearance");
    const observations = {
      ...(await inspectPanel(page, "settings-v2-panel-appearance")),
      ...focusObservations,
    };
    await capture(page, {
      id: "AFTER-09-03-settings-appearance-ar-paper-medium",
      route: "/settings?nav=v2&navLayout=desktop&dev=true&settingsSection=appearance",
      state: "list-detail; RTL; keyboard focus-visible",
      viewport,
      theme: "paper",
      locale: "ar",
      observations,
    });
  });

});
