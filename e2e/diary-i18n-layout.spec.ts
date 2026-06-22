import { expect, test, type Page } from "@playwright/test";

import { primeZenflowV2, type ZenflowV2Language, v2RoutePath } from "./helpers/zenflowV2State";

const SUPPORTED_LANGUAGES: ZenflowV2Language[] = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"];
const RTL_LANGUAGES = new Set<ZenflowV2Language>(["ar", "he"]);
const MIN_TOUCH_TARGET_PX = 44;

interface ControlViewportFact {
  height: number;
  width: number;
}

interface ControlFact {
  bottom: number;
  height: number;
  id: string;
  left: number;
  missing: boolean;
  right: number;
  top: number;
  viewport: ControlViewportFact;
  width: number;
}

async function primeDiary(page: Page, language: ZenflowV2Language) {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await primeZenflowV2(page, {
    clearStorage: true,
    language,
    theme: "ink",
  });
}

async function waitForDiaryChrome(page: Page) {
  await expect(page.getByTestId("diary-page")).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(
      async () => {
        const box = await page.getByTestId("journal-mobile-diary-sidebar-trigger").boundingBox();
        return box ? Math.min(box.width, box.height) : 0;
      },
      { message: "diary mobile chrome has styled touch targets", timeout: 10_000 },
    )
    .toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() =>
    Math.max(
      0,
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
      document.body.scrollWidth - document.documentElement.clientWidth,
    ),
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectControlsInsideViewport(page: Page, testIds: string[]) {
  const facts = await page.evaluate<ControlFact[], string[]>((ids) => {
    const viewport = {
      height: window.innerHeight,
      width: window.innerWidth,
    };

    return ids.map((id) => {
      const node = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
      if (!node) {
        return {
          bottom: 0,
          height: 0,
          id,
          left: 0,
          missing: true,
          right: 0,
          top: 0,
          viewport,
          width: 0,
        };
      }
      const rect = node.getBoundingClientRect();
      return {
        bottom: rect.bottom,
        height: rect.height,
        id,
        left: rect.left,
        missing: false,
        right: rect.right,
        top: rect.top,
        viewport,
        width: rect.width,
      };
    });
  }, testIds);

  for (const fact of facts) {
    expect(fact.missing, `${fact.id} exists`).toBe(false);
    if (fact.missing) continue;

    expect(Math.min(fact.width, fact.height), `${fact.id} touch target`).toBeGreaterThanOrEqual(
      MIN_TOUCH_TARGET_PX,
    );
    expect(fact.left, `${fact.id} left edge`).toBeGreaterThanOrEqual(0);
    expect(fact.right, `${fact.id} right edge`).toBeLessThanOrEqual(fact.viewport.width + 1);
    expect(fact.top, `${fact.id} top edge`).toBeGreaterThanOrEqual(0);
    expect(fact.bottom, `${fact.id} bottom edge`).toBeLessThanOrEqual(fact.viewport.height + 1);
  }
}

test.describe("V2 Diary i18n layout", () => {
  test.describe.configure({ timeout: 90_000 });

  for (const language of SUPPORTED_LANGUAGES) {
    test(`phone diary chrome stays usable in ${language}`, async ({ page }) => {
      await primeDiary(page, language);
      await page.setViewportSize({ width: 360, height: 740 });
      await page.goto(v2RoutePath("diary", { layout: "phone" }), { waitUntil: "load" });
      await waitForDiaryChrome(page);
      await page.evaluate(() => document.fonts.ready);

      await expect(page.locator("html")).toHaveAttribute("lang", language);
      await expect(page.locator("html")).toHaveAttribute(
        "dir",
        RTL_LANGUAGES.has(language) ? "rtl" : "ltr",
      );
      await expect(page.getByTestId("diary-page-ambience-control")).toHaveCount(0);
      await expect(page.getByTestId("diary-page-ambience-toggle")).toHaveCount(0);
      await expectControlsInsideViewport(page, [
        "journal-mobile-app-nav-menu",
        "journal-mobile-diary-sidebar-trigger",
        "journal-mobile-entry",
        "journal-mobile-stats",
        "journal-mobile-favorites",
        "journal-mobile-settings",
      ]);
      await expectNoHorizontalOverflow(page);

      await page.getByTestId("journal-mobile-diary-sidebar-trigger").click();
      await expect(page.getByTestId("journal-mobile-diary-sidebar")).toBeVisible();
      await expectControlsInsideViewport(page, ["journal-mobile-diary-sidebar-close"]);
      await expectNoHorizontalOverflow(page);
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("journal-mobile-diary-sidebar")).toBeHidden();

      await page.getByTestId("journal-mobile-favorites").click();
      await expect(page.getByTestId("journal-favorites-panel")).toBeVisible();
      await expectNoHorizontalOverflow(page);

      await page.getByTestId("journal-mobile-settings").click();
      await expect(page.getByTestId("journal-mobile-settings-panel")).toBeVisible({ timeout: 30_000 });
      await expectControlsInsideViewport(page, ["journal-mobile-settings-close"]);
      await expectNoHorizontalOverflow(page);
    });
  }
});
