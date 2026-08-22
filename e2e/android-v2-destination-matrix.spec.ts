import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  primeZenflowV2,
  v2RoutePath,
  type ZenflowV2Language,
  type ZenflowV2Route,
} from "./helpers/zenflowV2State";

const LOCALES: ZenflowV2Language[] = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"];
const RTL = new Set<ZenflowV2Language>(["ar", "he"]);
const DESTINATIONS: Array<{ id: ZenflowV2Route; root: string }> = [
  { id: "orb", root: "orb-page" },
  { id: "habits", root: "habits-page" },
  { id: "diary", root: "diary-page" },
  { id: "planning", root: "planning-page" },
  { id: "settings", root: "settings-page" },
];
const OUTPUT_DIR = path.resolve("output/android21/t156-five-destination-matrix");
const DEFAULT_ANDROID_VIEWPORT = { width: 360, height: 800 } as const;
const SPLIT_WINDOW_ANDROID_VIEWPORT = { width: 360, height: 640 } as const;
const LANDSCAPE_ANDROID_VIEWPORT = { width: 800, height: 360 } as const;

async function visibleDrawerTrigger(page: Page, activePage: ZenflowV2Route): Promise<Locator> {
  if (activePage !== "diary") {
    return page.getByTestId("nav-v2-open-drawer");
  }

  const journalTrigger = page
    .locator(
      '[data-testid="journal-mobile-app-nav-menu"]:visible, [data-testid="journal-lock-nav-menu"]:visible, [data-testid="journal-settings-nav-menu"]:visible',
    )
    .first();
  await expect(journalTrigger).toBeVisible({ timeout: 20_000 });
  return journalTrigger;
}

async function assertViewportContract(page: Page, rootTestId: string) {
  const facts = await page.getByTestId(rootTestId).evaluate((root) => {
    const rect = root.getBoundingClientRect();
    return {
      documentOverflow: Math.max(
        0,
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
        document.body.scrollWidth - document.documentElement.clientWidth,
      ),
      rootLeft: rect.left,
      rootRight: rect.right,
      viewportWidth: window.innerWidth,
    };
  });

  expect(facts.documentOverflow).toBe(0);
  expect(facts.rootLeft).toBeGreaterThanOrEqual(-0.75);
  expect(facts.rootRight).toBeLessThanOrEqual(facts.viewportWidth + 0.75);
}

async function assertPhoneDestinationFillsInlineViewport(
  page: Page,
  rootTestId: string,
  viewportWidth: number,
) {
  const root = page.getByTestId(rootTestId);
  await expect
    .poll(async () => (await root.boundingBox())?.x ?? Number.POSITIVE_INFINITY, {
      message: `${rootTestId} settles on the logical start edge`,
      timeout: 3_000,
    })
    .toBeLessThanOrEqual(1.25);
  await expect
    .poll(
      async () => {
        const box = await root.boundingBox();
        return box ? box.x + box.width : Number.NEGATIVE_INFINITY;
      },
      {
        message: `${rootTestId} settles on the logical end edge`,
        timeout: 3_000,
      },
    )
    .toBeGreaterThanOrEqual(viewportWidth - 0.75);

  const box = await root.boundingBox();
  expect(box, `${rootTestId} bounds`).not.toBeNull();
}

async function assertDrawerTriggerDoesNotOverlapPrimaryHeading(
  page: Page,
  rootTestId: string,
  trigger: Locator,
) {
  const heading = page
    .getByTestId(rootTestId)
    .locator('[data-phone-drawer-clearance="true"]')
    .first();
  if ((await heading.count()) === 0) return;
  await expect(heading, `${rootTestId} protected top chrome`).toBeVisible();

  const triggerBox = await trigger.boundingBox();
  const headingBox = await heading.boundingBox();
  expect(triggerBox, "drawer trigger bounds").not.toBeNull();
  expect(headingBox, `${rootTestId} primary heading bounds`).not.toBeNull();
  const clearance = 12;
  const horizontalOverlap =
    Math.min(
      triggerBox!.x + triggerBox!.width + clearance,
      headingBox!.x + headingBox!.width,
    ) - Math.max(triggerBox!.x - clearance, headingBox!.x);
  const verticalOverlap =
    Math.min(
      triggerBox!.y + triggerBox!.height + clearance,
      headingBox!.y + headingBox!.height,
    ) - Math.max(triggerBox!.y - clearance, headingBox!.y);
  expect(
    horizontalOverlap > 0 && verticalOverlap > 0,
    `${rootTestId} top chrome enters the phone drawer trigger clearance zone`,
  ).toBe(false);
}

async function assertOrbCoreControlsInViewport(page: Page) {
  const essentialControls = [
    "orb-page-whisper",
    "orb-page-scope",
    "orb-page-slider",
  ] as const;

  for (const testId of essentialControls) {
    const control = page.getByTestId(testId);
    await expect(control, `${testId} is rendered`).toBeVisible();
    await expect(control, `${testId} is available without hidden scrolling`).toBeInViewport({
      ratio: 0.9,
    });
  }

  const footerBox = await page.getByTestId("orb-page-footer").boundingBox();
  expect(footerBox, "orb-page-footer bounds").not.toBeNull();
  for (const testId of essentialControls) {
    const controlBox = await page.getByTestId(testId).boundingBox();
    expect(controlBox, `${testId} bounds`).not.toBeNull();
    expect(
      controlBox!.y + controlBox!.height,
      `${testId} stays above the action footer`,
    ).toBeLessThanOrEqual(footerBox!.y + 0.75);
  }
}

async function assertOrbLandscapeActionAlignment(page: Page) {
  const sliderBox = await page.getByTestId("orb-page-slider").boundingBox();
  const nextBox = await page.getByTestId("orb-page-next").boundingBox();
  expect(sliderBox, "orb-page-slider bounds").not.toBeNull();
  expect(nextBox, "orb-page-next bounds").not.toBeNull();
  const sliderCenter = sliderBox!.x + sliderBox!.width / 2;
  const nextCenter = nextBox!.x + nextBox!.width / 2;
  expect(
    Math.abs(sliderCenter - nextCenter),
    "landscape action stays aligned with the input column",
  ).toBeLessThanOrEqual(2);
}

async function waitForDestinationVisualState(
  page: Page,
  destination: ZenflowV2Route,
) {
  if (destination === "diary") {
    await expect(page.getByTestId("journal-page-shell")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("splash-theme-shell")).toHaveCount(0, {
      timeout: 30_000,
    });
    return;
  }

  if (destination !== "orb") return;

  const orbPage = page.getByTestId("orb-page");
  await expect(orbPage).toHaveAttribute("data-orb-visual-status", "ready", {
    timeout: 30_000,
  });
  await expect(orbPage).not.toHaveAttribute("aria-hidden", "true");
  await expect(page.getByTestId("splash-theme-shell")).toHaveCount(0);
  await expect(page.getByTestId("orb-page-render-error")).toHaveCount(0);
}

async function assertVisibleSplashCopyInsideViewport(page: Page) {
  const title = page.locator(".splash-title:visible");
  if ((await title.count()) === 0) return;

  const facts = await title.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      viewportWidth: window.innerWidth,
    };
  });

  expect(facts.left).toBeGreaterThanOrEqual(-0.75);
  expect(facts.right).toBeLessThanOrEqual(facts.viewportWidth + 0.75);
}

async function assertVisibleSplashCompositionInsideViewport(page: Page) {
  const shell = page.locator('[data-testid="splash-theme-shell"]:visible');
  if ((await shell.count()) === 0) return;

  const facts = await shell.evaluate(() => {
    const selectors = [
      ".splash-brand-logo",
      ".splash-title",
      ".splash-subtitle",
      ".splash-loader",
    ];
    return selectors.map((selector) => {
      const element = document.querySelector<HTMLElement>(selector);
      const rect = element?.getBoundingClientRect();
      return {
        bottom: rect?.bottom ?? Number.NaN,
        selector,
        top: rect?.top ?? Number.NaN,
        viewportHeight: window.innerHeight,
      };
    });
  });

  for (const fact of facts) {
    expect(fact.top, `${fact.selector} top`).toBeGreaterThanOrEqual(-0.75);
    expect(fact.bottom, `${fact.selector} bottom`).toBeLessThanOrEqual(
      fact.viewportHeight + 0.75,
    );
  }
}

async function assertDiaryHeaderZonesDoNotOverlap(page: Page) {
  const selectors = [
    '[data-testid="journal-mobile-app-nav-menu"]',
    '[data-testid="journal-mobile-title"]',
    '[data-testid="journal-mobile-diary-sidebar-trigger"]',
  ];
  const boxes = await Promise.all(
    selectors.map(async (selector) => {
      const locator = page.locator(`${selector}:visible`);
      await expect(locator).toHaveCount(1);
      const box = await locator.boundingBox();
      expect(box, `${selector} bounds`).not.toBeNull();
      return { box: box!, selector };
    }),
  );

  for (let leftIndex = 0; leftIndex < boxes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < boxes.length; rightIndex += 1) {
      const left = boxes[leftIndex];
      const right = boxes[rightIndex];
      const horizontalOverlap = Math.min(left.box.x + left.box.width, right.box.x + right.box.width)
        - Math.max(left.box.x, right.box.x);
      const verticalOverlap = Math.min(left.box.y + left.box.height, right.box.y + right.box.height)
        - Math.max(left.box.y, right.box.y);
      expect(
        horizontalOverlap > 0 && verticalOverlap > 0,
        `${left.selector} overlaps ${right.selector}`,
      ).toBe(false);
    }
  }

  const titleMetrics = await page.getByTestId("journal-mobile-title").evaluate((title) => {
    const range = document.createRange();
    range.selectNodeContents(title);
    const textRect = range.getBoundingClientRect();
    return {
      clientWidth: title.clientWidth,
      lineCount: range.getClientRects().length,
      scrollWidth: title.scrollWidth,
      text: title.textContent?.trim() ?? "",
      textLeft: textRect.left,
      textRight: textRect.right,
    };
  });
  expect(titleMetrics.scrollWidth).toBeLessThanOrEqual(titleMetrics.clientWidth + 1);
  if (!/\s/u.test(titleMetrics.text)) {
    expect(titleMetrics.lineCount, `single-token diary title ${titleMetrics.text}`).toBe(1);
  }
  for (const control of [boxes[0], boxes[2]]) {
    const horizontalOverlap = Math.min(
      titleMetrics.textRight,
      control.box.x + control.box.width,
    ) - Math.max(titleMetrics.textLeft, control.box.x);
    expect(horizontalOverlap, `diary title ink overlaps ${control.selector}`).toBeLessThanOrEqual(0);
  }
}

test.describe("Android V2 five-destination matrix", () => {
  test.setTimeout(600_000);

  test.beforeAll(() => {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  });

  test("enters and exits every destination in all eight locales at default Android text", async ({
    browser,
  }) => {
    const receipt: Array<Record<string, unknown>> = [];

    for (const locale of LOCALES) {
      const direction = RTL.has(locale) ? "rtl" : "ltr";
      const context = await browser.newContext({
        colorScheme: direction === "rtl" ? "dark" : "light",
        hasTouch: true,
        isMobile: true,
        reducedMotion: "no-preference",
        viewport: DEFAULT_ANDROID_VIEWPORT,
      });
      const page = await context.newPage();
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));

      try {
        await primeZenflowV2(page, {
          clearStorage: true,
          language: locale,
          privacyNoTracking: true,
          theme: direction === "rtl" ? "ink" : "paper",
        });
        await page.goto(v2RoutePath("orb", { layout: "phone" }));
        await expect(page.getByTestId("orb-page")).toBeVisible({ timeout: 30_000 });

        const baseFontSize = await page.evaluate(() =>
          Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
        );
        await page.evaluate((fontSize) => {
          document.documentElement.style.setProperty("font-size", `${fontSize}px`, "important");
        }, baseFontSize);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.locator("html")).toHaveAttribute("dir", direction);

        for (let index = 0; index < DESTINATIONS.length; index += 1) {
          const destination = DESTINATIONS[index];
          const orchestrator = page.getByTestId("nav-v2-orchestrator");
          await expect(orchestrator).toHaveAttribute("data-active-page", destination.id);
          await expect(page.getByTestId(destination.root)).toBeVisible({ timeout: 30_000 });
          await expect(page.getByTestId("nav-v2-route-pending")).toHaveCount(0, {
            timeout: 5_000,
          });
          await waitForDestinationVisualState(page, destination.id);
          expect(
            await page.evaluate(() => document.scrollingElement?.scrollTop ?? window.scrollY),
            `${destination.id} route entry scroll position`,
          ).toBeLessThanOrEqual(1);
          await assertViewportContract(page, destination.root);
          await assertVisibleSplashCopyInsideViewport(page);
          await assertVisibleSplashCompositionInsideViewport(page);
          if (destination.id === "diary") {
            await assertDiaryHeaderZonesDoNotOverlap(page);
          }

          await page.screenshot({
            animations: "disabled",
            path: path.join(OUTPUT_DIR, `${locale}-${destination.id}-360x800-100.png`),
          });

          const trigger = await visibleDrawerTrigger(page, destination.id);
          await expect(trigger).toBeVisible();
          await assertDrawerTriggerDoesNotOverlapPrimaryHeading(
            page,
            destination.root,
            trigger,
          );
          const triggerBox = await trigger.boundingBox();
          expect(triggerBox?.width ?? 0).toBeGreaterThanOrEqual(44);
          expect(triggerBox?.height ?? 0).toBeGreaterThanOrEqual(44);

          await trigger.click();
          const drawer = page.getByTestId("drawer-v2");
          await expect(drawer).toBeVisible();
          const drawerBox = await drawer.boundingBox();
          expect(drawerBox?.x ?? -1).toBeGreaterThanOrEqual(-0.75);
          expect((drawerBox?.x ?? 0) + (drawerBox?.width ?? 999)).toBeLessThanOrEqual(
            DEFAULT_ANDROID_VIEWPORT.width + 0.75,
          );

          await page.keyboard.press("Escape");
          await expect(drawer).toBeHidden();
          await expect(trigger).toBeFocused();
          await expect(orchestrator).toHaveAttribute("data-active-page", destination.id);

          if (index === DESTINATIONS.length - 1) break;

          await trigger.click();
          const next = DESTINATIONS[index + 1];
          const nextAction = page.getByTestId(`drawer-v2-destination-${next.id}`);
          const nextBox = await nextAction.boundingBox();
          expect(nextBox?.width ?? 0).toBeGreaterThanOrEqual(44);
          expect(nextBox?.height ?? 0).toBeGreaterThanOrEqual(44);
          await nextAction.click();
          await expect(orchestrator).toHaveAttribute("data-active-page", next.id, {
            timeout: 30_000,
          });
        }

        await page.reload();
        await expect(page.getByTestId("nav-v2-orchestrator")).toHaveAttribute(
          "data-active-page",
          "settings",
          { timeout: 30_000 },
        );
        expect(pageErrors).toEqual([]);
        receipt.push({
          destinations: DESTINATIONS.map(({ id }) => id),
          direction,
          locale,
          pageErrors,
          retainedAfterReload: "settings",
          textScalePercent: 100,
          viewport: DEFAULT_ANDROID_VIEWPORT,
        });
      } finally {
        await context.close();
      }
    }

    writeFileSync(
      path.join(OUTPUT_DIR, "browser-portrait-default-receipt.json"),
      `${JSON.stringify(receipt, null, 2)}\n`,
      "utf8",
    );
    expect(receipt).toHaveLength(8);
  });

  test("keeps all destinations usable in an Android split window", async ({ browser }) => {
    const receipt: Array<Record<string, unknown>> = [];

    for (const locale of LOCALES) {
      const direction = RTL.has(locale) ? "rtl" : "ltr";
      const context = await browser.newContext({
        colorScheme: direction === "rtl" ? "dark" : "light",
        hasTouch: true,
        isMobile: true,
        reducedMotion: "no-preference",
        viewport: SPLIT_WINDOW_ANDROID_VIEWPORT,
      });
      const page = await context.newPage();
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));

      try {
        await primeZenflowV2(page, {
          clearStorage: true,
          language: locale,
          privacyNoTracking: true,
          theme: direction === "rtl" ? "ink" : "paper",
        });
        await page.goto(v2RoutePath("orb", { layout: "phone" }));

        const orchestrator = page.getByTestId("nav-v2-orchestrator");
        await expect(orchestrator).toHaveAttribute("data-nav-layout", "phone", {
          timeout: 30_000,
        });
        await expect(page.getByTestId("sidebar-v2")).toHaveCount(0);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.locator("html")).toHaveAttribute("dir", direction);

        for (let index = 0; index < DESTINATIONS.length; index += 1) {
          const destination = DESTINATIONS[index];
          await expect(orchestrator).toHaveAttribute("data-active-page", destination.id);
          await expect(page.getByTestId(destination.root)).toBeVisible({ timeout: 30_000 });
          await expect(page.getByTestId("nav-v2-route-pending")).toHaveCount(0, {
            timeout: 5_000,
          });
          await waitForDestinationVisualState(page, destination.id);
          expect(
            await page.evaluate(() => document.scrollingElement?.scrollTop ?? window.scrollY),
            `${destination.id} split-window route entry scroll position`,
          ).toBeLessThanOrEqual(1);
          await assertViewportContract(page, destination.root);
          await assertPhoneDestinationFillsInlineViewport(
            page,
            destination.root,
            SPLIT_WINDOW_ANDROID_VIEWPORT.width,
          );
          await assertVisibleSplashCopyInsideViewport(page);
          await assertVisibleSplashCompositionInsideViewport(page);
          if (destination.id === "orb") {
            await assertOrbCoreControlsInViewport(page);
          }
          if (destination.id === "diary") {
            await assertDiaryHeaderZonesDoNotOverlap(page);
          }

          await page.screenshot({
            animations: "disabled",
            path: path.join(OUTPUT_DIR, `${locale}-${destination.id}-360x640-100.png`),
          });

          const trigger = await visibleDrawerTrigger(page, destination.id);
          await expect(trigger).toBeVisible();
          await assertDrawerTriggerDoesNotOverlapPrimaryHeading(
            page,
            destination.root,
            trigger,
          );
          const triggerBox = await trigger.boundingBox();
          expect(triggerBox?.width ?? 0).toBeGreaterThanOrEqual(44);
          expect(triggerBox?.height ?? 0).toBeGreaterThanOrEqual(44);

          await trigger.click();
          const drawer = page.getByTestId("drawer-v2");
          await expect(drawer).toBeVisible();
          const drawerBox = await drawer.boundingBox();
          expect(drawerBox?.x ?? -1).toBeGreaterThanOrEqual(-0.75);
          expect((drawerBox?.x ?? 0) + (drawerBox?.width ?? 999)).toBeLessThanOrEqual(
            SPLIT_WINDOW_ANDROID_VIEWPORT.width + 0.75,
          );

          await page.keyboard.press("Escape");
          await expect(drawer).toBeHidden();
          await expect(trigger).toBeFocused();
          await expect(orchestrator).toHaveAttribute("data-active-page", destination.id);

          if (index === DESTINATIONS.length - 1) break;
          await trigger.click();
          const next = DESTINATIONS[index + 1];
          const nextAction = page.getByTestId(`drawer-v2-destination-${next.id}`);
          await nextAction.scrollIntoViewIfNeeded();
          const nextBox = await nextAction.boundingBox();
          expect(nextBox?.width ?? 0).toBeGreaterThanOrEqual(44);
          expect(nextBox?.height ?? 0).toBeGreaterThanOrEqual(44);
          await nextAction.click();
          await expect(orchestrator).toHaveAttribute("data-active-page", next.id, {
            timeout: 30_000,
          });
        }

        await page.reload();
        await expect(page.getByTestId("nav-v2-orchestrator")).toHaveAttribute(
          "data-active-page",
          "settings",
          { timeout: 30_000 },
        );
        expect(pageErrors).toEqual([]);
        receipt.push({
          destinations: DESTINATIONS.map(({ id }) => id),
          direction,
          locale,
          navigation: "split-window-drawer",
          pageErrors,
          retainedAfterReload: "settings",
          textScalePercent: 100,
          viewport: SPLIT_WINDOW_ANDROID_VIEWPORT,
        });
      } finally {
        await context.close();
      }
    }

    writeFileSync(
      path.join(OUTPUT_DIR, "browser-split-window-default-receipt.json"),
      `${JSON.stringify(receipt, null, 2)}\n`,
      "utf8",
    );
    expect(receipt).toHaveLength(8);
  });

  test("keeps all destinations usable in Android landscape compact height", async ({
    browser,
  }) => {
    const receipt: Array<Record<string, unknown>> = [];

    for (const locale of LOCALES) {
      const direction = RTL.has(locale) ? "rtl" : "ltr";
      const context = await browser.newContext({
        colorScheme: direction === "rtl" ? "dark" : "light",
        hasTouch: true,
        isMobile: true,
        reducedMotion: "no-preference",
        viewport: LANDSCAPE_ANDROID_VIEWPORT,
      });
      const page = await context.newPage();
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));

      try {
        await primeZenflowV2(page, {
          clearStorage: true,
          language: locale,
          privacyNoTracking: true,
          theme: direction === "rtl" ? "ink" : "paper",
        });
        await page.goto(v2RoutePath("orb", { layout: "phone" }));

        const orchestrator = page.getByTestId("nav-v2-orchestrator");
        await expect(orchestrator).toHaveAttribute("data-nav-layout", "phone", {
          timeout: 30_000,
        });
        await expect(page.getByTestId("sidebar-v2")).toHaveCount(0);

        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.locator("html")).toHaveAttribute("dir", direction);

        for (let index = 0; index < DESTINATIONS.length; index += 1) {
          const destination = DESTINATIONS[index];
          await expect(orchestrator).toHaveAttribute("data-active-page", destination.id);
          await expect(page.getByTestId(destination.root)).toBeVisible({ timeout: 30_000 });
          await expect(page.getByTestId("nav-v2-route-pending")).toHaveCount(0, {
            timeout: 5_000,
          });
          await waitForDestinationVisualState(page, destination.id);
          expect(
            await page.evaluate(() => document.scrollingElement?.scrollTop ?? window.scrollY),
            `${destination.id} landscape route entry scroll position`,
          ).toBeLessThanOrEqual(1);
          await assertViewportContract(page, destination.root);
          await assertPhoneDestinationFillsInlineViewport(
            page,
            destination.root,
            LANDSCAPE_ANDROID_VIEWPORT.width,
          );
          if (destination.id === "orb") {
            await assertOrbCoreControlsInViewport(page);
            await assertOrbLandscapeActionAlignment(page);
          }

          await page.screenshot({
            animations: "disabled",
            path: path.join(OUTPUT_DIR, `${locale}-${destination.id}-800x360-100.png`),
          });

          const trigger = await visibleDrawerTrigger(page, destination.id);
          await expect(trigger).toBeVisible();
          await assertDrawerTriggerDoesNotOverlapPrimaryHeading(
            page,
            destination.root,
            trigger,
          );
          const triggerBox = await trigger.boundingBox();
          expect(triggerBox?.width ?? 0).toBeGreaterThanOrEqual(44);
          expect(triggerBox?.height ?? 0).toBeGreaterThanOrEqual(44);

          await trigger.click();
          const drawer = page.getByTestId("drawer-v2");
          await expect(drawer).toBeVisible();
          const drawerBox = await drawer.boundingBox();
          expect(drawerBox?.x ?? -1).toBeGreaterThanOrEqual(-0.75);
          expect((drawerBox?.x ?? 0) + (drawerBox?.width ?? 999)).toBeLessThanOrEqual(
            LANDSCAPE_ANDROID_VIEWPORT.width + 0.75,
          );

          await page.keyboard.press("Escape");
          await expect(drawer).toBeHidden();
          await expect(trigger).toBeFocused();
          await expect(orchestrator).toHaveAttribute("data-active-page", destination.id);

          if (index === DESTINATIONS.length - 1) break;
          await trigger.click();
          const next = DESTINATIONS[index + 1];
          const nextAction = page.getByTestId(`drawer-v2-destination-${next.id}`);
          await nextAction.scrollIntoViewIfNeeded();
          const nextBox = await nextAction.boundingBox();
          expect(nextBox?.width ?? 0).toBeGreaterThanOrEqual(44);
          expect(nextBox?.height ?? 0).toBeGreaterThanOrEqual(44);
          await nextAction.click();
          await expect(orchestrator).toHaveAttribute("data-active-page", next.id, {
            timeout: 30_000,
          });
        }

        await page.reload();
        await expect(page.getByTestId("nav-v2-orchestrator")).toHaveAttribute(
          "data-active-page",
          "settings",
          { timeout: 30_000 },
        );
        expect(pageErrors).toEqual([]);
        receipt.push({
          destinations: DESTINATIONS.map(({ id }) => id),
          direction,
          locale,
          navigation: "landscape-drawer",
          pageErrors,
          retainedAfterReload: "settings",
          textScalePercent: 100,
          viewport: LANDSCAPE_ANDROID_VIEWPORT,
        });
      } finally {
        await context.close();
      }
    }

    writeFileSync(
      path.join(OUTPUT_DIR, "browser-landscape-default-receipt.json"),
      `${JSON.stringify(receipt, null, 2)}\n`,
      "utf8",
    );
    expect(receipt).toHaveLength(8);
  });
});
