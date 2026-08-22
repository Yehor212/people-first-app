import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const LOCALES = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"] as const;
const RTL_LOCALES = new Set(["ar", "he"]);
const OUTPUT_DIR = path.resolve("output/android21/t153-participants-leaderboard-reflow");
const requestedPhase = process.env.REFLOW_PHASE;
const PHASE =
  requestedPhase === "red" || requestedPhase === "red-vertical" ? requestedPhase : "green";

const VIEWPORTS = [
  { id: "narrow-200", width: 320, height: 568, scale: "200" },
  { id: "short-portrait", width: 320, height: 420, scale: "100" },
  { id: "landscape", width: 568, height: 320, scale: "100" },
  { id: "split-window", width: 360, height: 640, scale: "100" },
] as const;

test.describe("participants leaderboard reflow", () => {
  test.setTimeout(180_000);

  test.beforeAll(() => {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  });

  test("keeps every participant's identity, progress and status associated inside its row", async ({
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
          `e2e/helpers/participants-leaderboard-reflow/index.html?lang=${locale}&theme=${theme}&scale=${viewport.scale}`,
          { waitUntil: "domcontentloaded" },
        );
        await page.evaluate(() => document.fonts.ready);

        const fixture = page.getByTestId("participants-leaderboard-reflow-fixture");
        const cardOwner = page.getByTestId("participants-leaderboard-card");
        await expect(fixture).toBeVisible();
        await expect(fixture).toHaveAttribute("data-language", locale);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.locator("html")).toHaveAttribute(
          "dir",
          RTL_LOCALES.has(locale) ? "rtl" : "ltr",
        );

        const card = cardOwner.locator(":scope > div");
        const rows = card.locator(":scope > div:nth-child(2) > div > div");
        await expect(rows).toHaveCount(5);
        await expect
          .poll(
            () =>
              rows.evaluateAll((rowElements) =>
                rowElements.every((row) => {
                  const transform = getComputedStyle(row).transform;
                  if (transform === "none") return true;
                  const matrix = new DOMMatrixReadOnly(transform);
                  return Math.abs(matrix.m41) < 0.1 && Math.abs(matrix.m42) < 0.1;
                }),
              ),
            { message: `${locale}/${viewport.id} row entrance animation`, timeout: 5_000 },
          )
          .toBe(true);

        const facts = await card.evaluate((cardElement) => {
          const scrollContainer = cardElement.children[1] as HTMLElement | undefined;
          const rowsContainer = scrollContainer?.children[0] as HTMLElement | undefined;
          if (!scrollContainer || !rowsContainer) {
            throw new Error("participants rows container not found");
          }
          const rows = Array.from(rowsContainer.children) as HTMLElement[];
          if (rows.length === 0) throw new Error("participants rows not found");
          const tolerance = 0.75;
          const cardRect = cardElement.getBoundingClientRect();
          const scrollContainerRect = scrollContainer.getBoundingClientRect();
          const firstRowRect = rows[0].getBoundingClientRect();
          const outsideInline = (rect: DOMRect, owner: DOMRect) =>
            rect.left < owner.left - tolerance || rect.right > owner.right + tolerance;
          const intersects = (left: DOMRect, right: DOMRect) =>
            Math.min(left.right, right.right) - Math.max(left.left, right.left) > tolerance &&
            Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > tolerance;

          const rowOverflow = rows.map((row, rowIndex) => ({
            rowIndex,
            pixels: Math.max(0, row.scrollWidth - row.clientWidth),
          }));
          const outOfBoundsText: Array<{ rowIndex: number; text: string }> = [];
          const directChildCollisions: Array<{
            rowIndex: number;
            leftIndex: number;
            rightIndex: number;
          }> = [];
          const rankNameOrder: Array<{ rowIndex: number; rankCenter: number; nameCenter: number }> = [];
          const fragmentedLocalizedWords: Array<{ rowIndex: number; word: string }> = [];

          rows.forEach((row, rowIndex) => {
            const rowRect = row.getBoundingClientRect();
            const children = Array.from(row.children) as HTMLElement[];
            if (children.length < 3) throw new Error(`unexpected row structure at ${rowIndex}`);
            const childRects = children.map((child) => child.getBoundingClientRect());
            rankNameOrder.push({
              rowIndex,
              rankCenter: (childRects[0].left + childRects[0].right) / 2,
              nameCenter: (childRects[1].left + childRects[1].right) / 2,
            });
            childRects.forEach((left, leftIndex) => {
              childRects.slice(leftIndex + 1).forEach((right, offset) => {
                if (intersects(left, right)) {
                  directChildCollisions.push({
                    rowIndex,
                    leftIndex,
                    rightIndex: leftIndex + offset + 1,
                  });
                }
              });
            });

            const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
            let textNode = walker.nextNode();
            while (textNode) {
              const text = textNode.textContent ?? "";
              if (text.trim()) {
                const range = document.createRange();
                range.selectNodeContents(textNode);
                const rects = Array.from(range.getClientRects()).filter(
                  (rect) => rect.width > 0 && rect.height > 0,
                );
                if (
                  rects.some(
                    (rect) => outsideInline(rect, rowRect) || outsideInline(rect, cardRect),
                  )
                ) {
                  outOfBoundsText.push({ rowIndex, text: text.trim() });
                }

                const parent = textNode.parentElement;
                if (!parent?.closest('[class*="overflow-wrap:anywhere"]')) {
                  for (const match of text.matchAll(
                    /[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Arabic}\p{Script=Hebrew}]+/gu,
                  )) {
                    if (match[0].length < 2) continue;
                    const wordRange = document.createRange();
                    const start = match.index ?? 0;
                    wordRange.setStart(textNode, start);
                    wordRange.setEnd(textNode, start + match[0].length);
                    if (
                      Array.from(wordRange.getClientRects()).filter((rect) => rect.width > 0).length >
                      1
                    ) {
                      fragmentedLocalizedWords.push({ rowIndex, word: match[0] });
                    }
                  }
                }
              }
              textNode = walker.nextNode();
            }
          });

          const headerRect = (cardElement.children[0] as HTMLElement).getBoundingClientRect();
          const headerText = cardElement.children[0]?.querySelector("span");
          const headerTextRect = headerText?.getBoundingClientRect();
          const headerFragmentedLocalizedWords: string[] = [];
          if (headerText) {
            const walker = document.createTreeWalker(headerText, NodeFilter.SHOW_TEXT);
            let textNode = walker.nextNode();
            while (textNode) {
              const text = textNode.textContent ?? "";
              for (const match of text.matchAll(
                /[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Arabic}\p{Script=Hebrew}]+/gu,
              )) {
                if (match[0].length < 2) continue;
                const wordRange = document.createRange();
                const start = match.index ?? 0;
                wordRange.setStart(textNode, start);
                wordRange.setEnd(textNode, start + match[0].length);
                if (
                  Array.from(wordRange.getClientRects()).filter((rect) => rect.width > 0).length > 1
                ) {
                  headerFragmentedLocalizedWords.push(match[0]);
                }
              }
              textNode = walker.nextNode();
            }
          }

          return {
            documentOverflow: Math.max(
              0,
              document.documentElement.scrollWidth - document.documentElement.clientWidth,
              document.body.scrollWidth - document.documentElement.clientWidth,
            ),
            cardOverflow: Math.max(0, cardElement.scrollWidth - cardElement.clientWidth),
            cardOutsideViewport:
              cardRect.left < -tolerance ||
              cardRect.right > document.documentElement.clientWidth + tolerance,
            headerTextOutside:
              !headerTextRect ||
              outsideInline(headerTextRect, headerRect) ||
              outsideInline(headerTextRect, cardRect),
            headerFragmentedLocalizedWords,
            rowCount: rows.length,
            rowOverflow,
            outOfBoundsText,
            directChildCollisions,
            rankNameOrder,
            fragmentedLocalizedWords,
            currentUserMarkerCount: Array.from(rowsContainer.querySelectorAll("span")).filter(
              (element) => /^\(.+\)$/u.test(element.textContent?.trim() ?? ""),
            ).length,
            completedStatusCount: rowsContainer.querySelectorAll(
              'svg.text-emerald-500[aria-label]',
            ).length,
            scrollContainerKeyboardReachable:
              scrollContainer.scrollHeight <= scrollContainer.clientHeight ||
              scrollContainer.tabIndex >= 0,
            scrollRegionRole: scrollContainer.getAttribute("role"),
            listRole: rowsContainer.getAttribute("role"),
            listItemCount: rows.filter((row) => row.getAttribute("role") === "listitem").length,
            firstRowFullyVisibleAtTop:
              firstRowRect.top >= scrollContainerRect.top - tolerance &&
              firstRowRect.bottom <= scrollContainerRect.bottom + tolerance,
            firstRowHeight: firstRowRect.height,
            scrollViewportHeight: scrollContainerRect.height,
          };
        });

        receipt.push({ locale, theme, viewport, ...facts, consoleErrors });

        await page.screenshot({
          path: path.join(OUTPUT_DIR, `${locale}-${viewport.id}-${theme}-${PHASE}.png`),
          fullPage: true,
          animations: "disabled",
        });
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
      expect(row.cardOverflow, `${label} card overflow`).toBe(0);
      expect(row.cardOutsideViewport, `${label} card bounds`).toBe(false);
      expect(row.headerTextOutside, `${label} header text bounds`).toBe(false);
      expect(
        row.headerFragmentedLocalizedWords,
        `${label} header word fragmentation`,
      ).toEqual([]);
      expect(row.rowCount, `${label} row count`).toBe(5);
      expect(row.rowOverflow, `${label} row overflow`).toEqual([
        { rowIndex: 0, pixels: 0 },
        { rowIndex: 1, pixels: 0 },
        { rowIndex: 2, pixels: 0 },
        { rowIndex: 3, pixels: 0 },
        { rowIndex: 4, pixels: 0 },
      ]);
      expect(row.outOfBoundsText, `${label} text bounds`).toEqual([]);
      expect(row.directChildCollisions, `${label} child collisions`).toEqual([]);
      expect(row.fragmentedLocalizedWords, `${label} localized word fragmentation`).toEqual([]);
      expect(row.currentUserMarkerCount, `${label} current-user marker`).toBe(1);
      expect(row.completedStatusCount, `${label} completion status`).toBe(2);
      expect(row.scrollContainerKeyboardReachable, `${label} keyboard scroll access`).toBe(true);
      expect(row.scrollRegionRole, `${label} scroll region semantics`).toBe("region");
      expect(row.listRole, `${label} list semantics`).toBe("list");
      expect(row.listItemCount, `${label} list item semantics`).toBe(5);
      expect(row.firstRowFullyVisibleAtTop, `${label} first row vertical bounds`).toBe(true);
      for (const order of row.rankNameOrder as Array<{
        rowIndex: number;
        rankCenter: number;
        nameCenter: number;
      }>) {
        if (RTL_LOCALES.has(row.locale as string)) {
          expect(order.rankCenter, `${label} RTL order row ${order.rowIndex}`).toBeGreaterThan(
            order.nameCenter,
          );
        } else {
          expect(order.rankCenter, `${label} LTR order row ${order.rowIndex}`).toBeLessThan(
            order.nameCenter,
          );
        }
      }
      expect(row.consoleErrors, `${label} console errors`).toEqual([]);
    }
  });
});
