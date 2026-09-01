import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { arch, platform, release } from "node:os";
import path from "node:path";

import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";

import { validateProductionWebBundleManifest } from "../scripts/ratchet-bundle-manifest";
import {
  TASK11_BUILD_MANIFEST_EVIDENCE_PATH,
  TASK11_CANONICAL_RUNNER_ID,
  TASK11_FIXED_CLOCK,
  TASK11_OUTPUT_ROOT,
  TASK11_SCENARIOS,
  TASK11_SUBJECT_HEAD,
  validateTask11ProductionContext,
  validateTask11RuntimeReceipt,
} from "../scripts/ui-audit/task11-settings-visual-evidence.mjs";
import type { ZenflowV2Language, ZenflowV2Layout, ZenflowV2Theme } from "./helpers/zenflowV2State";

type SettingsSection = "account" | "appearance" | "sound" | "privacy";

interface Task11Scenario {
  id: string;
  viewport: { width: number; height: number };
  locale: ZenflowV2Language;
  direction: "ltr" | "rtl";
  theme: ZenflowV2Theme;
  layout: ZenflowV2Layout;
  view: "overview" | "detail" | "list-detail";
  selectedSection: SettingsSection;
  rootFontScale: number;
  highContrast: boolean;
  forcedColors: boolean;
  offline: boolean;
  focusEvidence: boolean;
  hoverEvidence: boolean;
}

interface BuildReceipt {
  schemaVersion: number;
  producer: string;
  completed: boolean;
  target: string;
  mode: string;
  distRoot: string;
  buildId: string;
  startedAt: string;
  completedAt: string;
  artifactsSha256: string;
  buildInputsSha256: string;
  bundleSizeBytes: number;
  files: Array<{ path: string; sizeBytes: number; sha256: string }>;
}

interface CaptureRow extends Task11Scenario {
  path: string;
  route: string;
  state: "local-no-account-data" | "loaded-page-offline";
  subjectHead: string;
  buildId: string;
  buildArtifactsSha256: string;
  buildReceiptSha256: string;
  runnerId: string;
  runnerScope: "LOCAL_DIAGNOSTIC_ONLY";
  platformProof: "WEB_BROWSER_ONLY";
  nativeProof: "UNVERIFIED";
  host: {
    os: string;
    osRelease: string;
    architecture: string;
    nodeVersion: string;
  };
  browser: {
    name: "chromium";
    version: string;
    playwrightVersion: string;
  };
  dpr: number;
  fontProvenance: string;
  timezone: "UTC";
  capturedAt: string;
  fixedClock: string;
  reducedMotion: true;
  network:
    | "isolated local production preview; external requests blocked"
    | "offline after local production page load";
  fixtureProvenance: {
    kind: "ISOLATED_TEST_FIXTURE";
    source: "e2e/ui-system-settings-visual.spec.ts#primeTask11Settings";
    productionReachable: false;
    containsUserData: false;
  };
  visualReferenceDisposition: "missing-state";
  sameRunRepeatSha256Match: true;
  observations: Record<string, string | number | boolean | null>;
  sha256: string;
  sizeBytes: number;
}

const SCENARIOS = TASK11_SCENARIOS as unknown as readonly Task11Scenario[];
const BUILD_RECEIPT_PATH = "dist/.zenflow-ratchet-production-web-manifest.json";
const RECEIPT_PATH = path.join(TASK11_OUTPUT_ROOT, "runtime-capture.json");
const PLAYWRIGHT_VERSION = (
  JSON.parse(readFileSync("node_modules/@playwright/test/package.json", "utf8")) as {
    version: string;
  }
).version;
const APP_VERSION = (JSON.parse(readFileSync("package.json", "utf8")) as { version: string })
  .version;
const VISUAL_SETTLE_FRAME_WINDOW_MS = 500;
const EVIDENCE_SOURCE_PATHS = [
  "e2e/ui-system-settings-visual.spec.ts",
  "scripts/ui-audit/task11-settings-visual-evidence.mjs",
  "playwright.config.ts",
  "package.json",
] as const;
const APPLICATION_LOCALES: Record<ZenflowV2Language, string> = {
  en: "en-US",
  uk: "uk-UA",
  es: "es-ES",
  de: "de-DE",
  fr: "fr-FR",
  ja: "ja-JP",
  ar: "ar",
  he: "he",
};
const captures: CaptureRow[] = [];

function sha256File(filePath: string) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function inventorySha256(files: Array<{ path: string; sha256: string; sizeBytes: number }>) {
  return createHash("sha256")
    .update(files.map((file) => `${file.path}\0${file.sizeBytes}\0${file.sha256}\n`).join(""))
    .digest("hex");
}

function currentSubjectHead() {
  return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

function readBuildReceipt(): BuildReceipt {
  return JSON.parse(readFileSync(BUILD_RECEIPT_PATH, "utf8")) as BuildReceipt;
}

function currentRunnerId(browserVersion: string) {
  return [
    platform(),
    release(),
    arch(),
    `node-${process.version}`,
    `playwright-${PLAYWRIGHT_VERSION}`,
    `chromium-${browserVersion}`,
  ].join("-");
}

function evidenceSource(relativePath: string) {
  return {
    path: relativePath,
    sha256: sha256File(path.resolve(relativePath)),
    sizeBytes: statSync(path.resolve(relativePath)).size,
  };
}

function collectServedDistInventory() {
  const files: Array<{ path: string; sha256: string; sizeBytes: number }> = [];
  const visit = (absoluteDirectory: string) => {
    for (const entry of readdirSync(absoluteDirectory, { withFileTypes: true })) {
      const absolutePath = path.join(absoluteDirectory, entry.name);
      const relativePath = path.relative(process.cwd(), absolutePath).split(path.sep).join("/");
      const stat = lstatSync(absolutePath);
      if (stat.isSymbolicLink()) {
        throw new Error(`served dist must not contain a symlink: ${relativePath}`);
      }
      if (entry.isDirectory()) {
        visit(absolutePath);
      } else if (entry.isFile()) {
        files.push({
          path: relativePath,
          sha256: sha256File(absolutePath),
          sizeBytes: stat.size,
        });
      }
    }
  };

  visit(path.resolve("dist"));
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

async function primeTask11Settings(page: Page, scenario: Task11Scenario) {
  await page.addInitScript(
    ({ appVersion, fixedClock, highContrast, language, theme }) => {
      localStorage.clear();
      sessionStorage.clear();

      localStorage.setItem("zenflow-language", JSON.stringify(language));
      localStorage.setItem("zenflow-language-selected", JSON.stringify(true));
      localStorage.setItem("zenflow-google-auth-checked", JSON.stringify(true));
      localStorage.setItem("zenflow-onboarding-complete", JSON.stringify(true));
      localStorage.setItem("zenflow-notification-permission-checked", JSON.stringify(true));
      localStorage.setItem("zenflow_last_seen_version", appVersion);
      localStorage.setItem("zenflow-orb-first-run-dismissed", "1");
      localStorage.setItem("zenflow-privacy-acknowledged", JSON.stringify(true));
      localStorage.setItem(
        "zenflow-privacy",
        JSON.stringify({
          analytics: false,
          consentShown: true,
          noTracking: true,
        })
      );
      localStorage.setItem("zenflow-theme", theme === "paper" ? "light" : "dark");
      localStorage.setItem("zenflow_oled_mode", theme === "oled" ? "true" : "false");
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
      localStorage.setItem("zenflow-task11-fixed-clock", fixedClock);
      sessionStorage.removeItem("zenflow-orb-webgl-slow-ms");
      sessionStorage.removeItem("zenflow-mood-entry-draft");
    },
    {
      appVersion: APP_VERSION,
      fixedClock: TASK11_FIXED_CLOCK,
      highContrast: scenario.highContrast,
      language: scenario.locale,
      theme: scenario.theme,
    }
  );
}

async function installLocalNetworkBoundary(page: Page, baseURL: string): Promise<string[]> {
  const appUrl = new URL(baseURL);
  expect(appUrl.protocol).toBe("http:");
  expect(["127.0.0.1", "localhost"]).toContain(appUrl.hostname);

  const blockedExternalRequests: string[] = [];
  await page.route("**/*", async (route) => {
    const requestUrl = new URL(route.request().url());
    const isNetworkRequest = requestUrl.protocol === "http:" || requestUrl.protocol === "https:";
    if (isNetworkRequest && requestUrl.origin !== appUrl.origin) {
      blockedExternalRequests.push(`${requestUrl.origin}${requestUrl.pathname}`);
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
  return blockedExternalRequests;
}

async function createScenarioContext(
  browser: Browser,
  baseURL: string,
  scenario: Task11Scenario
): Promise<{ context: BrowserContext; page: Page; blockedExternalRequests: string[] }> {
  const context = await browser.newContext({
    baseURL,
    viewport: scenario.viewport,
    colorScheme: scenario.theme === "paper" ? "light" : "dark",
    reducedMotion: "reduce",
    forcedColors: scenario.forcedColors ? "active" : "none",
    timezoneId: "UTC",
    locale: APPLICATION_LOCALES[scenario.locale],
    deviceScaleFactor: 1,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const blockedExternalRequests = await installLocalNetworkBoundary(page, baseURL);
  await page.clock.setFixedTime(new Date(TASK11_FIXED_CLOCK));
  await primeTask11Settings(page, scenario);

  return { context, page, blockedExternalRequests };
}

async function settleVisuals(page: Page, minimumFrameWindowMs = 0) {
  await page.evaluate(async (frameWindowMs) => {
    await document.fonts.ready;
    const frame = () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    const startedAt = performance.now();
    while (performance.now() - startedAt < frameWindowMs) {
      await frame();
    }
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  }, minimumFrameWindowMs);
}

async function openSettingsOverview(page: Page, scenario: Task11Scenario) {
  const query = new URLSearchParams({
    dev: "true",
    nav: "v2",
    navLayout: scenario.layout,
  });
  await page.goto(`settings?${query.toString()}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("settings-page")).toBeVisible();
  await settleVisuals(page);

  const baselineRootFontSize = await page.evaluate((rootFontScale) => {
    const root = document.documentElement;
    const baseline = Number.parseFloat(getComputedStyle(root).fontSize);
    root.dataset.task11BaselineRootFontPx = String(baseline);
    if (rootFontScale !== 1) {
      root.style.setProperty("font-size", `${baseline * rootFontScale}px`, "important");
    }
    return baseline;
  }, scenario.rootFontScale);
  await expect
    .poll(() =>
      page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).fontSize))
    )
    .toBe(baselineRootFontSize * scenario.rootFontScale);
  if (scenario.rootFontScale !== 1) {
    await settleVisuals(page);
  }

  await expect(page.locator("html")).toHaveAttribute("lang", scenario.locale);
  await expect(page.locator("html")).toHaveAttribute("dir", scenario.direction);
  await expect(page.locator("html")).toHaveAttribute("data-theme", scenario.theme);
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme-contrast",
    scenario.highContrast ? "high" : "standard"
  );
  await expect(page.getByTestId("settings-page-workspace")).toHaveAttribute(
    "data-mobile-view",
    "overview"
  );
  await expect(page.locator('[data-testid^="settings-v2-delete-"]')).toHaveCount(0);
  await expect(page.locator('[data-testid*="reset-confirmation"]')).toHaveCount(0);

  const accountKeys = await page.evaluate(() =>
    Object.keys(localStorage).filter(
      (key) => key === "zenflow-user" || /^sb-.*-auth-token$/u.test(key)
    )
  );
  expect(accountKeys).toEqual([]);
}

async function focusViaKeyboard(page: Page, target: Locator) {
  await page.getByTestId("settings-page").focus();
  for (let attempt = 0; attempt < 80; attempt += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === document.activeElement)) {
      return;
    }
  }
  throw new Error(`Keyboard traversal did not reach ${await target.getAttribute("data-testid")}`);
}

async function visibleFocusObservation(locator: Locator) {
  await expect(locator).toBeFocused();
  const observation = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const outlineWidth = Number.parseFloat(style.outlineWidth);
    const hasOutline =
      style.outlineStyle !== "none" &&
      style.outlineStyle !== "hidden" &&
      Number.isFinite(outlineWidth) &&
      outlineWidth > 0;
    const hasRing = style.boxShadow !== "none";
    return {
      focusVisible: element.matches(":focus-visible"),
      focusIndicatorVisible: hasOutline || hasRing,
      focusOutlineStyle: style.outlineStyle,
      focusOutlineWidth: style.outlineWidth,
      focusBoxShadow: style.boxShadow,
    };
  });
  expect(observation).toMatchObject({
    focusVisible: true,
    focusIndicatorVisible: true,
  });
  return observation;
}

async function openCompactDetail(
  page: Page,
  scenario: Task11Scenario
): Promise<Record<string, string | number | boolean | null>> {
  const card = page.getByTestId(`settings-module-card-${scenario.selectedSection}`);
  await expect(card).toBeVisible();
  let focusRestored: boolean | null = null;
  let controlFocusObservation: Record<string, string | number | boolean | null> = {};

  if (scenario.focusEvidence) {
    await focusViaKeyboard(page, card);
    await visibleFocusObservation(card);
    await page.keyboard.press("Enter");
  } else {
    await card.click();
  }

  const panel = page.getByTestId(`settings-module-panel-${scenario.selectedSection}`);
  await expect(page.getByTestId("settings-page-workspace")).toHaveAttribute(
    "data-mobile-view",
    "detail"
  );
  await expect(panel).toBeVisible();
  await expect(panel).toBeFocused();

  if (scenario.id === "T11-02-360-en-ink-keyboard-detail") {
    await page.keyboard.press("Shift+Tab");
    const back = page.getByTestId("settings-mobile-back");
    await visibleFocusObservation(back);
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("settings-page-workspace")).toHaveAttribute(
      "data-mobile-view",
      "overview"
    );
    await expect(card).toBeFocused();
    const restoredObservation = await visibleFocusObservation(card);
    focusRestored = restoredObservation.focusVisible && restoredObservation.focusIndicatorVisible;

    await page.keyboard.press("Enter");
    await expect(panel).toBeFocused();
  }

  if (scenario.focusEvidence) {
    const control = panel
      .locator(
        "button:not([disabled]):visible, input:not([disabled]):visible, select:not([disabled]):visible, textarea:not([disabled]):visible, a[href]:visible"
      )
      .first();
    await expect(control).toBeVisible();
    await focusViaKeyboard(page, control);
    controlFocusObservation = await visibleFocusObservation(control);
  }

  return { focusRestored, ...controlFocusObservation };
}

async function selectDesktopSection(page: Page, scenario: Task11Scenario) {
  const card = page.getByTestId(`settings-module-card-${scenario.selectedSection}`);
  if (scenario.selectedSection !== "appearance") {
    await card.click();
  }
  await expect(page.getByTestId("settings-module-list")).toBeVisible();
  await expect(page.getByTestId(`settings-module-panel-${scenario.selectedSection}`)).toBeVisible();
  await expect(page.getByTestId("settings-page-workspace")).toHaveAttribute(
    "data-selected-section",
    scenario.selectedSection
  );

  if (scenario.focusEvidence) {
    const panel = page.getByTestId(`settings-module-panel-${scenario.selectedSection}`);
    const control = panel
      .locator(
        "button:not([disabled]):visible, input:not([disabled]):visible, select:not([disabled]):visible, textarea:not([disabled]):visible, a[href]:visible"
      )
      .first();
    await expect(control).toBeVisible();
    await focusViaKeyboard(page, control);
    return visibleFocusObservation(control);
  }
  return null;
}

async function applyHoverEvidence(page: Page, scenario: Task11Scenario) {
  if (!scenario.hoverEvidence) {
    return {
      hoveredTarget: null,
      hoverVisualChange: null,
    };
  }
  const hoverSection =
    scenario.view === "list-detail" && scenario.selectedSection === "account"
      ? "appearance"
      : scenario.view === "list-detail"
        ? "account"
        : scenario.selectedSection;
  const testId = `settings-module-card-${hoverSection}`;
  const target = page.getByTestId(testId);
  await expect(target).toBeVisible();
  const readVisualStyle = () =>
    target.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        boxShadow: style.boxShadow,
        transform: style.transform,
      };
    });

  // Record a deliberate non-hover baseline. Chromium can preserve a pointer
  // position across navigation long enough for an immediate style sample to
  // observe :hover before this helper moves the pointer.
  await page.mouse.move(1, 1);
  await expect.poll(() => target.evaluate((element) => element.matches(":hover"))).toBe(false);
  await settleVisuals(page);
  const before = await readVisualStyle();
  await target.hover();
  await expect.poll(() => target.evaluate((element) => element.matches(":hover"))).toBe(true);
  await expect
    .poll(async () => JSON.stringify(await readVisualStyle()) !== JSON.stringify(before))
    .toBe(true);
  const after = await readVisualStyle();
  const hoverVisualChange = JSON.stringify(before) !== JSON.stringify(after);
  expect(hoverVisualChange).toBe(true);
  return {
    hoveredTarget: testId,
    hoverVisualChange,
  };
}

async function collectLayoutObservations(
  page: Page,
  scenario: Task11Scenario
): Promise<Record<string, string | number | boolean | null>> {
  return page.evaluate(
    ({ scenarioId, selectedSection, view, rootFontScale }) => {
      const pageElement = document.querySelector<HTMLElement>('[data-testid="settings-page"]');
      const settingsHeading = document.querySelector<HTMLElement>(
        '[data-testid="settings-page-heading"]'
      );
      const workspace = document.querySelector<HTMLElement>(
        '[data-testid="settings-page-workspace"]'
      );
      const moduleList = document.querySelector<HTMLElement>(
        '[data-testid="settings-module-list"]'
      );
      const selectedPanel = document.querySelector<HTMLElement>(
        '[data-testid="settings-selected-panel"]'
      );
      const visible = (element: Element | null): element is HTMLElement => {
        if (!(element instanceof HTMLElement)) return false;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0
        );
      };

      const textSelectors = [
        "h1",
        "h2",
        "h3",
        "p",
        "label",
        "[role='status']",
        "[data-slot='settings-panel-copy']",
        "[data-testid^='settings-module-card-'] span",
      ].join(",");
      const clippedText = pageElement
        ? Array.from(pageElement.querySelectorAll<HTMLElement>(textSelectors)).filter((element) => {
            if (!visible(element) || element.classList.contains("sr-only")) return false;
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            const outsideViewport =
              rect.left < -1 || rect.right > document.documentElement.clientWidth + 1;
            const clipsOwnText =
              (style.overflowX === "hidden" || style.overflowX === "clip") &&
              element.scrollWidth > element.clientWidth + 1;
            return outsideViewport || clipsOwnText;
          })
        : [];

      const interactiveTargets = pageElement
        ? Array.from(
            pageElement.querySelectorAll<HTMLElement>(
              "button:not([disabled]), a[href], [data-interaction-surface]"
            )
          ).filter(visible)
        : [];
      const targetRects = interactiveTargets.map((element) => element.getBoundingClientRect());
      const minMeasuredTargetWidth =
        targetRects.length > 0
          ? Math.min(...targetRects.map((rect) => Math.round(rect.width * 100) / 100))
          : 0;
      const minMeasuredTargetHeight =
        targetRects.length > 0
          ? Math.min(...targetRects.map((rect) => Math.round(rect.height * 100) / 100))
          : 0;

      const visiblePanels = pageElement
        ? Array.from(
            pageElement.querySelectorAll<HTMLElement>('[data-testid^="settings-v2-panel-"]')
          ).filter(visible)
        : [];
      const expectedVisiblePanelCount =
        view === "overview" ? 0 : ["sound", "privacy"].includes(selectedSection) ? 1 : 2;
      const visibleGroupCount = visiblePanels.reduce(
        (count, panel) =>
          count + panel.querySelectorAll(':scope > [data-slot="settings-group"]').length,
        0
      );
      const groupedSurfaceContract =
        visiblePanels.length === expectedVisiblePanelCount &&
        (expectedVisiblePanelCount === 0 ||
          (visibleGroupCount === expectedVisiblePanelCount &&
            visiblePanels.every(
              (panel) =>
                panel.querySelectorAll(':scope > [data-slot="settings-group"]').length === 1
            )));

      const listRect = moduleList?.getBoundingClientRect();
      const detailRect = selectedPanel?.getBoundingClientRect();
      const desktopColumnsNonOverlapping =
        view !== "list-detail" ||
        (listRect !== undefined &&
          detailRect !== undefined &&
          (listRect.right <= detailRect.left + 1 || detailRect.right <= listRect.left + 1));

      const activeElement =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const activeGroup = activeElement?.closest<HTMLElement>('[data-slot="settings-group"]');
      const activeRect = activeElement?.getBoundingClientRect();
      let focusClipRisk = false;
      if (activeElement && activeRect) {
        let ancestor = activeElement.parentElement;
        while (ancestor && ancestor !== pageElement?.parentElement) {
          const style = getComputedStyle(ancestor);
          const clipsX = ["hidden", "clip"].includes(style.overflowX);
          const clipsY = ["hidden", "clip"].includes(style.overflowY);
          if (clipsX || clipsY) {
            const ancestorRect = ancestor.getBoundingClientRect();
            const focusRingMargin = 2;
            if (
              (clipsX &&
                (activeRect.left - focusRingMargin < ancestorRect.left ||
                  activeRect.right + focusRingMargin > ancestorRect.right)) ||
              (clipsY &&
                (activeRect.top - focusRingMargin < ancestorRect.top ||
                  activeRect.bottom + focusRingMargin > ancestorRect.bottom))
            ) {
              focusClipRisk = true;
              break;
            }
          }
          ancestor = ancestor.parentElement;
        }
      }
      const baselineRootFontSize = Number.parseFloat(
        document.documentElement.dataset.task11BaselineRootFontPx ?? "NaN"
      );
      const observedRootFontSize = Number.parseFloat(
        getComputedStyle(document.documentElement).fontSize
      );
      const profileNameInput = document.querySelector<HTMLInputElement>("#settings-v2-name");
      const profileNameSaveAction = document.querySelector<HTMLElement>(
        '[data-testid="settings-v2-profile-save"]'
      );
      const profileNameRow = profileNameInput?.parentElement ?? null;
      const profileNameGeometryApplicable =
        view === "list-detail" &&
        selectedSection === "account" &&
        visible(profileNameRow) &&
        visible(profileNameInput) &&
        visible(profileNameSaveAction);
      const roundGeometry = (value: number) => Math.round(value * 1000) / 1000;
      const profileNameRowWidth = profileNameGeometryApplicable
        ? roundGeometry(profileNameRow.getBoundingClientRect().width)
        : null;
      const profileNameInputWidth = profileNameGeometryApplicable
        ? roundGeometry(profileNameInput.getBoundingClientRect().width)
        : null;
      const profileNameSaveActionWidth = profileNameGeometryApplicable
        ? roundGeometry(profileNameSaveAction.getBoundingClientRect().width)
        : null;
      const profileNameInputWidthShare =
        typeof profileNameInputWidth === "number" &&
        typeof profileNameRowWidth === "number" &&
        profileNameRowWidth > 0
          ? roundGeometry(profileNameInputWidth / profileNameRowWidth)
          : null;
      const germanHeadingApplicable = scenarioId === "T11-01-320-de-paper-text-200-overview";
      let germanHeadingNormalizedText: string | null = null;
      let germanHeadingHyphens: string | null = null;
      let germanHeadingSoftHyphenOffset: number | null = null;
      let germanHeadingSoftHyphenGlyphWidth: number | null = null;
      let germanHeadingRenderedBreakOffset: number | null = null;
      let germanHeadingRenderedLineCount: number | null = null;
      let germanHeadingFirstLineCharacterCount: number | null = null;
      let germanHeadingLastLineCharacterCount: number | null = null;
      let germanHeadingUsesAuthoredBreak: boolean | null = null;
      let germanHeadingEmergencyTailAbsent: boolean | null = null;
      let germanHeadingOverflowPx: number | null = null;

      if (germanHeadingApplicable && settingsHeading) {
        const softHyphen = "\u00ad";
        const rawText = (settingsHeading.textContent ?? "").trim();
        germanHeadingNormalizedText = rawText.replaceAll(softHyphen, "");
        germanHeadingHyphens = getComputedStyle(settingsHeading).hyphens;
        const renderedCharacters: Array<{
          character: string;
          normalizedOffset: number;
          top: number;
        }> = [];
        let normalizedOffset = 0;
        let softHyphenGlyphWidth = 0;
        const textWalker = document.createTreeWalker(settingsHeading, NodeFilter.SHOW_TEXT);
        let textNode = textWalker.nextNode();
        while (textNode) {
          const text = textNode.textContent ?? "";
          for (let index = 0; index < text.length; index += 1) {
            const character = text[index] ?? "";
            const range = document.createRange();
            range.setStart(textNode, index);
            range.setEnd(textNode, index + 1);
            const rects = Array.from(range.getClientRects());
            range.detach();
            if (character === softHyphen) {
              germanHeadingSoftHyphenOffset = normalizedOffset;
              softHyphenGlyphWidth = Math.max(
                softHyphenGlyphWidth,
                ...rects.map((rect) => rect.width)
              );
              continue;
            }
            const characterRect = rects[rects.length - 1];
            if (characterRect) {
              renderedCharacters.push({
                character,
                normalizedOffset,
                top: roundGeometry(characterRect.top),
              });
            }
            normalizedOffset += character.length;
          }
          textNode = textWalker.nextNode();
        }

        const renderedLines: string[] = [];
        const renderedBreakOffsets: number[] = [];
        let previousTop: number | null = null;
        for (const character of renderedCharacters) {
          if (previousTop === null || Math.abs(character.top - previousTop) > 1) {
            if (previousTop !== null) renderedBreakOffsets.push(character.normalizedOffset);
            renderedLines.push("");
            previousTop = character.top;
          }
          renderedLines[renderedLines.length - 1] += character.character;
        }

        germanHeadingSoftHyphenGlyphWidth = roundGeometry(softHyphenGlyphWidth);
        germanHeadingRenderedBreakOffset =
          renderedBreakOffsets.length === 1 ? (renderedBreakOffsets[0] ?? null) : null;
        germanHeadingRenderedLineCount = renderedLines.length;
        germanHeadingFirstLineCharacterCount = renderedLines[0]?.length ?? null;
        germanHeadingLastLineCharacterCount =
          renderedLines[renderedLines.length - 1]?.length ?? null;
        germanHeadingUsesAuthoredBreak =
          germanHeadingHyphens === "manual" &&
          germanHeadingSoftHyphenGlyphWidth > 0 &&
          germanHeadingRenderedBreakOffset === germanHeadingSoftHyphenOffset;
        germanHeadingEmergencyTailAbsent =
          renderedLines.length === 2 && (renderedLines[renderedLines.length - 1]?.length ?? 0) > 2;
        germanHeadingOverflowPx = Math.max(
          0,
          settingsHeading.scrollWidth - settingsHeading.clientWidth
        );
      }

      return {
        documentOverflowPx: Math.max(
          0,
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
          document.body.scrollWidth - document.documentElement.clientWidth
        ),
        clippedTextCount: clippedText.length,
        motionReductionActive: matchMedia("(prefers-reduced-motion: reduce)").matches,
        minMeasuredTargetWidth,
        minMeasuredTargetHeight,
        measuredInteractiveTargetCount: targetRects.length,
        compactOverviewVisible:
          view === "overview" && visible(moduleList) && !visible(selectedPanel),
        compactDetailVisible: view === "detail" && !visible(moduleList) && visible(selectedPanel),
        desktopListVisible: view === "list-detail" && visible(moduleList),
        desktopDetailVisible: view === "list-detail" && visible(selectedPanel),
        desktopColumnsNonOverlapping,
        groupedSurfaceContract,
        visiblePanelCount: visiblePanels.length,
        visibleGroupCount,
        focusClipRisk,
        focusedControlInsideSettingsGroup: activeGroup !== null && activeGroup !== undefined,
        selectedSection: workspace?.getAttribute("data-selected-section") ?? selectedSection,
        forcedColorsActive: matchMedia("(forced-colors: active)").matches,
        themeContrast: document.documentElement.getAttribute("data-theme-contrast") ?? "missing",
        navigatorOnLine: navigator.onLine,
        offlineBannerVisible: visible(
          document.querySelector<HTMLElement>('[data-testid="offline-banner"]')
        ),
        browserZoomControlVerified: false,
        baselineRootFontSize,
        observedRootFontSize,
        requestedRootFontScale: rootFontScale,
        rootFontScaleVerified:
          Number.isFinite(baselineRootFontSize) &&
          Math.abs(observedRootFontSize - baselineRootFontSize * rootFontScale) < 0.01,
        captureCoverage: "INITIAL_VIEWPORT_ONLY",
        documentScrollHeight: document.documentElement.scrollHeight,
        pageWidth: pageElement ? Math.round(pageElement.getBoundingClientRect().width) : null,
        workspaceWidth: workspace ? Math.round(workspace.getBoundingClientRect().width) : null,
        profileNameRowWidth,
        profileNameInputWidth,
        profileNameSaveActionWidth,
        profileNameInputWidthShare,
        germanHeadingNormalizedText,
        germanHeadingHyphens,
        germanHeadingSoftHyphenOffset,
        germanHeadingSoftHyphenGlyphWidth,
        germanHeadingRenderedBreakOffset,
        germanHeadingRenderedLineCount,
        germanHeadingFirstLineCharacterCount,
        germanHeadingLastLineCharacterCount,
        germanHeadingUsesAuthoredBreak,
        germanHeadingEmergencyTailAbsent,
        germanHeadingOverflowPx,
      };
    },
    {
      scenarioId: scenario.id,
      selectedSection: scenario.selectedSection,
      view: scenario.view,
      rootFontScale: scenario.rootFontScale,
    }
  );
}

async function captureScenario(
  page: Page,
  scenario: Task11Scenario,
  buildReceipt: BuildReceipt,
  browserVersion: string,
  extraObservations: Record<string, string | number | boolean | null>
): Promise<boolean> {
  await settleVisuals(page);
  const layoutObservations = await collectLayoutObservations(page, scenario);
  expect(layoutObservations.documentOverflowPx).toBe(0);
  expect(layoutObservations.clippedTextCount).toBe(0);
  expect(layoutObservations.motionReductionActive).toBe(true);
  expect(layoutObservations.minMeasuredTargetWidth).toBeGreaterThanOrEqual(44);
  expect(layoutObservations.minMeasuredTargetHeight).toBeGreaterThanOrEqual(44);
  expect(layoutObservations.measuredInteractiveTargetCount).toBeGreaterThan(0);
  expect(
    layoutObservations.groupedSurfaceContract,
    `grouped surface observation failed: ${JSON.stringify(layoutObservations)}`
  ).toBe(true);
  expect(layoutObservations.focusClipRisk).toBe(false);
  expect(layoutObservations.rootFontScaleVerified).toBe(true);
  const expectedVisiblePanelCount =
    scenario.view === "overview"
      ? 0
      : ["sound", "privacy"].includes(scenario.selectedSection)
        ? 1
        : 2;
  expect(layoutObservations.visiblePanelCount).toBe(expectedVisiblePanelCount);
  expect(layoutObservations.visibleGroupCount).toBe(expectedVisiblePanelCount);
  if (scenario.view === "overview") {
    expect(layoutObservations.compactOverviewVisible).toBe(true);
    expect(layoutObservations.compactDetailVisible).toBe(false);
  } else if (scenario.view === "detail") {
    expect(layoutObservations.compactOverviewVisible).toBe(false);
    expect(layoutObservations.compactDetailVisible).toBe(true);
  }
  if (scenario.view === "list-detail") {
    expect(layoutObservations.desktopListVisible).toBe(true);
    expect(layoutObservations.desktopDetailVisible).toBe(true);
    expect(layoutObservations.desktopColumnsNonOverlapping).toBe(true);
  }
  if (scenario.id === "T11-11-1536-de-ink-forced-colors-list-detail") {
    const profileNameRowWidth = layoutObservations.profileNameRowWidth;
    const profileNameInputWidth = layoutObservations.profileNameInputWidth;
    const profileNameSaveActionWidth = layoutObservations.profileNameSaveActionWidth;
    const profileNameInputWidthShare = layoutObservations.profileNameInputWidthShare;
    if (
      typeof profileNameRowWidth !== "number" ||
      typeof profileNameInputWidth !== "number" ||
      typeof profileNameSaveActionWidth !== "number" ||
      typeof profileNameInputWidthShare !== "number"
    ) {
      throw new Error(
        `profile name row geometry is incomplete: ${JSON.stringify(layoutObservations)}`
      );
    }
    expect(profileNameInputWidth).toBeGreaterThan(profileNameSaveActionWidth);
    expect(profileNameInputWidth / profileNameRowWidth).toBeGreaterThanOrEqual(0.5);
    expect(profileNameInputWidthShare).toBeCloseTo(profileNameInputWidth / profileNameRowWidth, 2);
  }
  if (scenario.id === "T11-01-320-de-paper-text-200-overview") {
    expect(layoutObservations.germanHeadingNormalizedText).toBe("Einstellungen");
    expect(layoutObservations.germanHeadingHyphens).toBe("manual");
    expect(layoutObservations.germanHeadingSoftHyphenOffset).toBe(3);
    expect(layoutObservations.germanHeadingSoftHyphenGlyphWidth).toBeGreaterThan(0);
    expect(layoutObservations.germanHeadingRenderedBreakOffset).toBe(3);
    expect(layoutObservations.germanHeadingRenderedLineCount).toBe(2);
    expect(layoutObservations.germanHeadingFirstLineCharacterCount).toBe(3);
    expect(layoutObservations.germanHeadingLastLineCharacterCount).toBe(10);
    expect(layoutObservations.germanHeadingUsesAuthoredBreak).toBe(true);
    expect(layoutObservations.germanHeadingEmergencyTailAbsent).toBe(true);
    expect(layoutObservations.germanHeadingOverflowPx).toBe(0);
  }
  if (scenario.focusEvidence) {
    expect(layoutObservations.focusedControlInsideSettingsGroup).toBe(true);
  }

  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
  // Keyboard focus can leave Chromium's fractional rounded-corner raster in a
  // short-lived compositor state even after CSS animations have stopped. Keep
  // the exact pixel-equality gate and wait through a bounded frame window so
  // the evidence records the settled runtime rather than that transient frame.
  await settleVisuals(page, VISUAL_SETTLE_FRAME_WINDOW_MS);
  const relativePath = path.join(TASK11_OUTPUT_ROOT, `${scenario.id}.png`);
  const warmupPath = path.join(TASK11_OUTPUT_ROOT, `${scenario.id}.warmup.png`);
  const repeatPath = path.join(TASK11_OUTPUT_ROOT, `${scenario.id}.repeat.png`);
  const screenshotOptions = {
    animations: "disabled" as const,
    caret: "hide" as const,
    fullPage: false,
  };
  await page.screenshot({ path: warmupPath, ...screenshotOptions });
  rmSync(path.resolve(warmupPath), { force: true });
  await settleVisuals(page);
  await page.screenshot({ path: relativePath, ...screenshotOptions });
  await settleVisuals(page);
  await page.screenshot({ path: repeatPath, ...screenshotOptions });
  const absolutePath = path.resolve(relativePath);
  const repeatAbsolutePath = path.resolve(repeatPath);
  const sameRunRepeatSha256Match = sha256File(absolutePath) === sha256File(repeatAbsolutePath);
  expect(sameRunRepeatSha256Match).toBe(true);
  rmSync(repeatAbsolutePath, { force: true });

  let visibleMutationRejected = false;
  if (scenario.id === SCENARIOS[0]?.id) {
    const negativeControlPath = path.join(
      TASK11_OUTPUT_ROOT,
      `${scenario.id}.visible-mutation-negative.png`
    );
    const priorFilter = await page.getByTestId("settings-page").evaluate((element) => {
      const previous = element.style.filter;
      element.style.filter = "invert(1)";
      return previous;
    });
    await settleVisuals(page);
    await page.screenshot({ path: negativeControlPath, ...screenshotOptions });
    visibleMutationRejected =
      sha256File(absolutePath) !== sha256File(path.resolve(negativeControlPath));
    expect(visibleMutationRejected).toBe(true);
    await page.getByTestId("settings-page").evaluate((element, previous) => {
      element.style.filter = previous;
    }, priorFilter);
    rmSync(path.resolve(negativeControlPath), { force: true });
    await settleVisuals(page);
  }

  const routeUrl = new URL(page.url());
  const fontProvenance = await page.evaluate(
    () =>
      `document.fonts.status=${document.fonts.status}; bodyFontFamily=${getComputedStyle(document.body).fontFamily}`
  );

  captures.push({
    ...scenario,
    path: relativePath.split(path.sep).join("/"),
    route: `${routeUrl.pathname}${routeUrl.search}`,
    state: scenario.offline ? "loaded-page-offline" : "local-no-account-data",
    subjectHead: TASK11_SUBJECT_HEAD,
    buildId: buildReceipt.buildId,
    buildArtifactsSha256: buildReceipt.artifactsSha256,
    buildReceiptSha256: sha256File(BUILD_RECEIPT_PATH),
    runnerId: currentRunnerId(browserVersion),
    runnerScope: "LOCAL_DIAGNOSTIC_ONLY",
    platformProof: "WEB_BROWSER_ONLY",
    nativeProof: "UNVERIFIED",
    host: {
      os: platform(),
      osRelease: release(),
      architecture: arch(),
      nodeVersion: process.version,
    },
    browser: {
      name: "chromium",
      version: browserVersion,
      playwrightVersion: PLAYWRIGHT_VERSION,
    },
    dpr: await page.evaluate(() => window.devicePixelRatio),
    fontProvenance,
    timezone: "UTC",
    capturedAt: new Date().toISOString(),
    fixedClock: TASK11_FIXED_CLOCK,
    reducedMotion: true,
    network: scenario.offline
      ? "offline after local production page load"
      : "isolated local production preview; external requests blocked",
    fixtureProvenance: {
      kind: "ISOLATED_TEST_FIXTURE",
      source: "e2e/ui-system-settings-visual.spec.ts#primeTask11Settings",
      productionReachable: false,
      containsUserData: false,
    },
    visualReferenceDisposition: "missing-state",
    sameRunRepeatSha256Match: true,
    observations: {
      ...layoutObservations,
      ...extraObservations,
    },
    sha256: sha256File(absolutePath),
    sizeBytes: statSync(absolutePath).size,
  });
  return visibleMutationRejected;
}

test.describe.serial("Task 11 Settings visual evidence matrix", () => {
  test.setTimeout(240_000);

  test.beforeAll(() => {
    mkdirSync(TASK11_OUTPUT_ROOT, { recursive: true });
    rmSync(RECEIPT_PATH, { force: true });
    for (const scenario of SCENARIOS) {
      rmSync(path.join(TASK11_OUTPUT_ROOT, `${scenario.id}.png`), { force: true });
      rmSync(path.join(TASK11_OUTPUT_ROOT, `${scenario.id}.repeat.png`), {
        force: true,
      });
      rmSync(path.join(TASK11_OUTPUT_ROOT, `${scenario.id}.warmup.png`), {
        force: true,
      });
      rmSync(path.join(TASK11_OUTPUT_ROOT, `${scenario.id}.visible-mutation-negative.png`), {
        force: true,
      });
    }
    captures.splice(0);

    expect(currentSubjectHead()).toBe(TASK11_SUBJECT_HEAD);
    expect(process.env.CI).toMatch(/^(?:1|true)$/u);
    expect(process.env.ZENFLOW_PLAYWRIGHT_USE_LOCAL_SERVER).toBe("true");
    expect(process.env.ZENFLOW_PLAYWRIGHT_PREVIEW_DIR).toBe("dist");
    validateProductionWebBundleManifest({ rootDir: process.cwd(), env: process.env });
    expect(readBuildReceipt()).toMatchObject({
      completed: true,
      target: "web",
      mode: "production",
    });
  });

  test("captures and validates the exact no-user-data bounded factor matrix", async ({
    browser,
    baseURL,
  }, testInfo) => {
    expect(baseURL).toBeTruthy();
    const browserVersion = browser.version();
    const runnerId = currentRunnerId(browserVersion);
    expect(runnerId).toBe(TASK11_CANONICAL_RUNNER_ID);
    const configuredBaseURL =
      typeof testInfo.project.use.baseURL === "string" ? testInfo.project.use.baseURL : "";
    const contextErrors = validateTask11ProductionContext({
      env: process.env,
      baseURL,
      configuredBaseURL,
      subjectHead: currentSubjectHead(),
      runnerId,
    });
    expect(contextErrors).toEqual([]);

    const runStartedAtUtc = new Date().toISOString();
    const buildReceiptBefore = readBuildReceipt();
    const buildReceiptShaBefore = sha256File(BUILD_RECEIPT_PATH);
    const servedDistBefore = collectServedDistInventory();
    const evidenceSourcesBefore = EVIDENCE_SOURCE_PATHS.map(evidenceSource);
    let visibleMutationRejected = false;

    for (const scenario of SCENARIOS) {
      const scenarioBrowser = await browser.browserType().launch({ headless: true });
      try {
        expect(scenarioBrowser.version()).toBe(browserVersion);
        const { context, page, blockedExternalRequests } = await createScenarioContext(
          scenarioBrowser,
          baseURL!,
          scenario
        );
        try {
          await openSettingsOverview(page, scenario);

          let focusObservation: Record<string, string | number | boolean | null> | null = null;
          let focusRestored: boolean | null = null;

          if (scenario.view === "detail") {
            const detailObservation = await openCompactDetail(page, scenario);
            focusRestored =
              typeof detailObservation.focusRestored === "boolean"
                ? detailObservation.focusRestored
                : null;
            if (scenario.focusEvidence) {
              focusObservation = detailObservation;
            }
          } else if (scenario.view === "list-detail") {
            focusObservation = await selectDesktopSection(page, scenario);
          }

          const hoverObservation = await applyHoverEvidence(page, scenario);

          if (scenario.offline) {
            await context.setOffline(true);
            await expect(page.getByTestId("offline-banner")).toBeVisible();
            await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
            await settleVisuals(page);
          }

          expect(blockedExternalRequests).toEqual([]);
          const scenarioMutationRejected = await captureScenario(
            page,
            scenario,
            buildReceiptBefore,
            browserVersion,
            {
              focusVisible: focusObservation?.focusVisible ?? null,
              focusIndicatorVisible: focusObservation?.focusIndicatorVisible ?? null,
              focusRestored,
              hoveredTarget: hoverObservation.hoveredTarget,
              hoverVisualChange: hoverObservation.hoverVisualChange,
            }
          );
          visibleMutationRejected = visibleMutationRejected || scenarioMutationRejected;
        } finally {
          await context.close();
        }
      } finally {
        await scenarioBrowser.close();
      }
    }

    const buildReceiptAfter = readBuildReceipt();
    validateProductionWebBundleManifest({ rootDir: process.cwd(), env: process.env });
    expect(buildReceiptAfter).toEqual(buildReceiptBefore);
    expect(sha256File(BUILD_RECEIPT_PATH)).toBe(buildReceiptShaBefore);
    const servedDistAfter = collectServedDistInventory();
    expect(servedDistAfter).toEqual(servedDistBefore);
    const evidenceSourcesAfter = EVIDENCE_SOURCE_PATHS.map(evidenceSource);
    expect(evidenceSourcesAfter).toEqual(evidenceSourcesBefore);
    expect(visibleMutationRejected).toBe(true);
    writeFileSync(
      path.resolve(TASK11_BUILD_MANIFEST_EVIDENCE_PATH),
      readFileSync(BUILD_RECEIPT_PATH)
    );
    expect(sha256File(TASK11_BUILD_MANIFEST_EVIDENCE_PATH)).toBe(buildReceiptShaBefore);
    const runCompletedAtUtc = new Date().toISOString();

    const receipt = {
      schemaVersion: 2,
      task: "Task 11 Settings bounded factor matrix",
      subjectHead: TASK11_SUBJECT_HEAD,
      capturedAt: runCompletedAtUtc,
      runStartedAtUtc,
      runCompletedAtUtc,
      fixedClock: TASK11_FIXED_CLOCK,
      outputRoot: TASK11_OUTPUT_ROOT,
      runner: {
        id: runnerId,
        os: platform(),
        osRelease: release(),
        architecture: arch(),
        nodeVersion: process.version,
        playwrightVersion: PLAYWRIGHT_VERSION,
        browser: "chromium",
        browserVersion,
        scope: "LOCAL_DIAGNOSTIC_ONLY",
        approvalBaseline: false,
      },
      productionBuild: {
        sourcePath: BUILD_RECEIPT_PATH,
        evidencePath: TASK11_BUILD_MANIFEST_EVIDENCE_PATH,
        receiptSha256: buildReceiptShaBefore,
        buildId: buildReceiptBefore.buildId,
        artifactsSha256: buildReceiptBefore.artifactsSha256,
        buildInputsSha256: buildReceiptBefore.buildInputsSha256,
      },
      evidenceSources: evidenceSourcesBefore,
      servedDist: {
        root: "dist",
        stableAcrossRun: true,
        inventorySha256: inventorySha256(servedDistBefore),
        files: servedDistBefore,
      },
      captures,
      candidateBaselinePolicy: {
        approvedReferenceAvailable: false,
        automaticBaselineUpdate: false,
        sameRunExactRepeatRequired: true,
        sameRunAllowedByteMismatch: 0,
        requiredDisposition: "missing-state",
      },
      negativeControls: {
        visibleMutationRejected,
      },
      unverified: [
        {
          id: "approved-visual-reference-baseline",
          blocker:
            "No independently approved prior reference image set exists for this new bounded matrix.",
          evidenceNeeded:
            "Human-reviewed runner-keyed reference images captured before a later change.",
        },
        {
          id: "canonical-linux-approval-baseline",
          blocker:
            "This run is a pinned local macOS diagnostic capture, not the canonical Linux approval runner.",
          evidenceNeeded:
            "Fresh ubuntu-24.04 Playwright artifacts keyed to the exact browser and font environment.",
        },
        {
          id: "browser-chrome-zoom-200",
          blocker:
            "Browser chrome zoom was not instrumented; the capture proves 200% root text expansion only.",
          evidenceNeeded: "Canonical-runner browser zoom control capture at 200%.",
        },
        {
          id: "loading",
          blocker: "No safe production-dist control exposes the Settings loading visual state.",
          evidenceNeeded: "Reachable production state or isolated component-preview evidence.",
        },
        {
          id: "error",
          blocker:
            "No safe production-dist control exposes a deterministic Settings error visual state.",
          evidenceNeeded: "Reachable production state or isolated component-preview evidence.",
        },
        {
          id: "disabled",
          blocker:
            "No stable disabled Settings state was reached without mutating application internals.",
          evidenceNeeded: "Reachable production state or isolated component-preview evidence.",
        },
        {
          id: "destructive-confirmation",
          blocker:
            "Opening live destructive UI was intentionally excluded from this no-data capture.",
          evidenceNeeded:
            "Isolated non-destructive preview plus behavior tests; never a real deletion.",
        },
        {
          id: "offline-first-load-installed-pwa",
          blocker:
            "The offline capture starts after a local production page load and is not an installed PWA.",
          evidenceNeeded: "Installed PWA offline-first runtime on an authorized device.",
        },
        {
          id: "full-surface-scroll-state-visuals",
          blocker:
            "Screenshots cover the initial viewport; geometry is measured across rendered controls, but every scroll position is not visually captured.",
          evidenceNeeded: "Stable scroll-position capture set with human visual classification.",
        },
        {
          id: "native-ads-consent-settings",
          blocker:
            "The local Web runtime reports ads as unsupported, so the native ad-consent Settings panel is not rendered.",
          evidenceNeeded:
            "Authorized Android and iOS runtime captures for each applicable consent state.",
        },
        {
          id: "native-and-assistive-runtime",
          blocker:
            "Chromium screenshots do not prove Android, iOS, Tauri, or assistive-technology behavior.",
          evidenceNeeded: "Fresh platform runtime and AT evidence.",
        },
      ],
    };
    const receiptErrors = validateTask11RuntimeReceipt({
      receipt,
      repositoryRoot: process.cwd(),
    });
    expect(receiptErrors).toEqual([]);
    writeFileSync(RECEIPT_PATH, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  });
});
