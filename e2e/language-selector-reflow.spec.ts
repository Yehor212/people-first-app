import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const LOCALES = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"] as const;
const RTL_LOCALES = new Set(["ar", "he"]);
const OUTPUT_DIR = path.resolve("output/android21/t153-language-selector-reflow");
const PHASE =
  process.env.REFLOW_PHASE === "red" || process.env.REFLOW_PHASE === "craft-red"
    ? process.env.REFLOW_PHASE
    : "green";

const VIEWPORTS = [
  { id: "narrow-200", width: 320, height: 568, scale: "200" },
  { id: "short-portrait", width: 320, height: 420, scale: "100" },
  { id: "landscape", width: 568, height: 320, scale: "100" },
  { id: "split-window", width: 360, height: 640, scale: "100" },
] as const;

test.describe("public-entry language choice grid reflow", () => {
  test.setTimeout(180_000);

  test.beforeAll(() => {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  });

  test("keeps every locale choice and primary action readable across the Android matrix", async ({
    browser,
  }) => {
    const receipt: Array<Record<string, unknown>> = [];

    for (const viewport of VIEWPORTS) {
      for (const locale of LOCALES) {
        const theme = locale === "ar" || viewport.id === "landscape" ? "dark" : "light";
        const context = await browser.newContext({
          colorScheme: theme,
          hasTouch: true,
          isMobile: true,
          viewport: { width: viewport.width, height: viewport.height },
        });
        const page = await context.newPage();
        const consoleErrors: string[] = [];
        page.on("console", (message) => {
          if (message.type() === "error") consoleErrors.push(message.text());
        });
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto(
          `e2e/helpers/language-selector-reflow/index.html?lang=${locale}&theme=${theme}&scale=${viewport.scale}`,
          { waitUntil: "domcontentloaded" },
        );
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(
          () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
        );

        const screen = page.getByTestId("language-selector-screen");
        const firstOption = page.getByTestId("language-option-en");
        const grid = firstOption.locator("..");
        const continueButton = page.getByTestId("language-continue");
        await expect(screen).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.locator("html")).toHaveAttribute(
          "dir",
          RTL_LOCALES.has(locale) ? "rtl" : "ltr",
        );
        await expect(grid.locator('[role="radio"]')).toHaveCount(8);

        const facts = await screen.evaluate((screenElement) => {
          const options = Array.from(
            screenElement.querySelectorAll<HTMLElement>('[data-testid^="language-option-"]'),
          );
          const gridElement = options[0]?.parentElement;
          const continueElement = screenElement.querySelector<HTMLElement>(
            '[data-testid="language-continue"]',
          );
          const heading = screenElement.querySelector<HTMLElement>("h1");
          if (!gridElement || !continueElement || !heading) {
            throw new Error("language selector structure not found");
          }

          const tolerance = 0.75;
          const screenRect = screenElement.getBoundingClientRect();
          const gridRect = gridElement.getBoundingClientRect();
          const continueRect = continueElement.getBoundingClientRect();
          const optionRects = options.map((option) => option.getBoundingClientRect());
          const intersects = (left: DOMRect, right: DOMRect) =>
            Math.min(left.right, right.right) - Math.max(left.left, right.left) > tolerance &&
            Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > tolerance;
          const isOutsideInline = (rect: DOMRect, container: DOMRect) =>
            rect.left < container.left - tolerance || rect.right > container.right + tolerance;

          const optionCollisions = optionRects.flatMap((left, leftIndex) =>
            optionRects
              .slice(leftIndex + 1)
              .map((right, offset) => ({
                leftIndex,
                rightIndex: leftIndex + offset + 1,
                hit: intersects(left, right),
              }))
              .filter((pair) => pair.hit),
          );

          const fragmentedNames: string[] = [];
          const outOfBoundsNames: string[] = [];
          const nameMeasurements: Array<{
            name: string;
            clientWidth: number;
            scrollWidth: number;
            left: number;
            right: number;
            optionLeft: number;
            optionRight: number;
          }> = [];
          const directionAssignments: Array<{ id: string; direction: string | null }> = [];
          for (const option of options) {
            const name = option.querySelector<HTMLElement>("span[dir]");
            if (!name) throw new Error(`language name missing for ${option.dataset.testid}`);
            const nameText = name.textContent?.trim() ?? "";
            const range = document.createRange();
            range.selectNodeContents(name);
            const nameRects = Array.from(range.getClientRects()).filter(
              (rect) => rect.width > 0 && rect.height > 0,
            );
            if (nameRects.length > 1) fragmentedNames.push(nameText);
            if (nameRects.some((rect) => isOutsideInline(rect, option.getBoundingClientRect()))) {
              outOfBoundsNames.push(nameText);
            }
            const nameRect = range.getBoundingClientRect();
            const optionRect = option.getBoundingClientRect();
            nameMeasurements.push({
              name: nameText,
              clientWidth: name.clientWidth,
              scrollWidth: name.scrollWidth,
              left: nameRect.left,
              right: nameRect.right,
              optionLeft: optionRect.left,
              optionRight: optionRect.right,
            });
            directionAssignments.push({ id: option.dataset.testid ?? "", direction: option.dir });
          }

          const outOfBoundsScreenText: string[] = [];
          const textWalker = document.createTreeWalker(screenElement, NodeFilter.SHOW_TEXT);
          let textNode = textWalker.nextNode();
          while (textNode) {
            const text = textNode.textContent?.trim() ?? "";
            if (text) {
              const range = document.createRange();
              range.selectNodeContents(textNode);
              const rects = Array.from(range.getClientRects()).filter(
                (rect) => rect.width > 0 && rect.height > 0,
              );
              if (rects.some((rect) => isOutsideInline(rect, screenRect))) {
                outOfBoundsScreenText.push(text);
              }
            }
            textNode = textWalker.nextNode();
          }

          const fragmentedTitleWords: string[] = [];
          const titleWalker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
          let titleNode = titleWalker.nextNode();
          while (titleNode) {
            const text = titleNode.textContent ?? "";
            for (const match of text.matchAll(
              /[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Arabic}\p{Script=Hebrew}\p{Number}]+/gu,
            )) {
              if (match[0].length < 2) continue;
              const start = match.index ?? 0;
              const lineTops = new Set<number>();
              for (let index = 0; index < match[0].length; index += 1) {
                const range = document.createRange();
                range.setStart(titleNode, start + index);
                range.setEnd(titleNode, start + index + 1);
                for (const rect of Array.from(range.getClientRects())) {
                  if (rect.width > 0) lineTops.add(Math.round(rect.top));
                }
              }
              if (lineTops.size > 1) {
                fragmentedTitleWords.push(match[0]);
              }
            }
            titleNode = titleWalker.nextNode();
          }

          return {
            documentOverflow: Math.max(
              0,
              document.documentElement.scrollWidth - document.documentElement.clientWidth,
              document.body.scrollWidth - document.documentElement.clientWidth,
            ),
            screenOverflow: Math.max(0, screenElement.scrollWidth - screenElement.clientWidth),
            gridOutsideScreen: isOutsideInline(gridRect, screenRect),
            headingOutsideScreen: isOutsideInline(heading.getBoundingClientRect(), screenRect),
            continueOutsideScreen: isOutsideInline(continueRect, screenRect),
            continueAfterGrid: continueRect.top >= gridRect.bottom,
            minimumOptionHeight: Math.min(...optionRects.map((rect) => rect.height)),
            continueHeight: continueRect.height,
            optionCount: options.length,
            selectedCount: options.filter((option) => option.getAttribute("aria-checked") === "true")
              .length,
            optionCollisions,
            fragmentedNames,
            outOfBoundsNames,
            nameMeasurements,
            outOfBoundsScreenText,
            fragmentedTitleWords,
            directionAssignments,
          };
        });

        await continueButton.scrollIntoViewIfNeeded();
        await expect(continueButton).toBeVisible();
        const continueViewportBounds = await continueButton.evaluate((button) => {
          const rect = button.getBoundingClientRect();
          return {
            top: rect.top,
            bottom: rect.bottom,
            viewportHeight: window.innerHeight,
          };
        });
        const focusedOption = page.getByTestId(`language-option-${locale}`);
        await focusedOption.focus();
        await expect(focusedOption).toBeFocused();

        receipt.push({
          locale,
          theme,
          viewport,
          ...facts,
          continueViewportBounds,
          consoleErrors,
        });

        if (
          viewport.id === "narrow-200" &&
          ["en", "es", "de", "ar", "he"].includes(locale)
        ) {
          await continueButton.scrollIntoViewIfNeeded();
          await page.screenshot({
            path: path.join(
              OUTPUT_DIR,
              `${locale}-${viewport.id}-${theme}-action-${PHASE}.png`,
            ),
            animations: "disabled",
          });
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({
            path: path.join(OUTPUT_DIR, `${locale}-${viewport.id}-${theme}-${PHASE}.png`),
            fullPage: true,
            animations: "disabled",
          });
        }
        await context.close();
      }
    }

    writeFileSync(
      path.join(OUTPUT_DIR, `browser-matrix-${PHASE}.json`),
      `${JSON.stringify({ generatedAt: new Date().toISOString(), rows: receipt }, null, 2)}\n`,
    );

    for (const row of receipt) {
      const label = `${row.locale}/${(row.viewport as { id: string }).id}`;
      expect(row.documentOverflow, `${label} page overflow`).toBe(0);
      expect(row.screenOverflow, `${label} screen overflow`).toBe(0);
      expect(row.gridOutsideScreen, `${label} grid bounds`).toBe(false);
      expect(row.headingOutsideScreen, `${label} heading bounds`).toBe(false);
      expect(row.continueOutsideScreen, `${label} Continue bounds`).toBe(false);
      expect(row.continueAfterGrid, `${label} content order`).toBe(true);
      expect(
        (row.continueViewportBounds as { top: number }).top,
        `${label} Continue viewport start`,
      ).toBeGreaterThanOrEqual(0);
      expect(
        (row.continueViewportBounds as { bottom: number; viewportHeight: number }).bottom,
        `${label} Continue viewport end`,
      ).toBeLessThanOrEqual(
        (row.continueViewportBounds as { viewportHeight: number }).viewportHeight,
      );
      expect(row.minimumOptionHeight, `${label} option target`).toBeGreaterThanOrEqual(44);
      expect(row.continueHeight, `${label} Continue target`).toBeGreaterThanOrEqual(48);
      expect(row.optionCount, `${label} language choices`).toBe(8);
      expect(row.selectedCount, `${label} selected choices`).toBe(1);
      expect(row.optionCollisions, `${label} option collisions`).toEqual([]);
      expect(row.fragmentedNames, `${label} fragmented language names`).toEqual([]);
      expect(row.outOfBoundsNames, `${label} language-name bounds`).toEqual([]);
      expect(row.outOfBoundsScreenText, `${label} screen text bounds`).toEqual([]);
      expect(row.fragmentedTitleWords, `${label} title word fragmentation`).toEqual(
        (row.viewport as { id: string }).id === "narrow-200" && row.locale === "es"
          ? ["Bienvenido"]
          : (row.viewport as { id: string }).id === "narrow-200" && row.locale === "de"
            ? ["Willkommen"]
            : [],
      );
      expect(row.directionAssignments, `${label} option bidi`).toEqual([
        { id: "language-option-en", direction: "ltr" },
        { id: "language-option-uk", direction: "ltr" },
        { id: "language-option-es", direction: "ltr" },
        { id: "language-option-de", direction: "ltr" },
        { id: "language-option-fr", direction: "ltr" },
        { id: "language-option-ja", direction: "ltr" },
        { id: "language-option-ar", direction: "rtl" },
        { id: "language-option-he", direction: "rtl" },
      ]);
      expect(row.consoleErrors, `${label} console errors`).toEqual([]);
    }
  });
});
