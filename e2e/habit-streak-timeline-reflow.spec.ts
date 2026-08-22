import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const LOCALES = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"] as const;
const RTL_LOCALES = new Set(["ar", "he"]);
const OUTPUT_DIR = path.resolve("output/android21/t153-habit-streak-timeline-reflow");
const PHASE = process.env.REFLOW_PHASE === "red" ? "red" : "green";

const VIEWPORTS = [
  { id: "narrow-200", width: 320, height: 568, scale: "200" },
  { id: "short-portrait", width: 320, height: 420, scale: "100" },
  { id: "landscape", width: 568, height: 320, scale: "100" },
  { id: "split-window", width: 360, height: 640, scale: "100" },
] as const;

test.describe("habit streak history reflow", () => {
  test.setTimeout(180_000);

  test.beforeAll(() => {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  });

  test("keeps localized summary and history values inside the data card", async ({ browser }) => {
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
          `e2e/helpers/habit-streak-timeline-reflow/index.html?lang=${locale}&theme=${theme}&scale=${viewport.scale}`,
          { waitUntil: "domcontentloaded" },
        );

        const fixture = page.getByTestId("habit-streak-timeline-reflow-fixture");
        await expect(fixture).toBeVisible();
        await expect(fixture).toHaveAttribute("data-language", locale);
        await expect(page.locator("html")).toHaveAttribute(
          "dir",
          RTL_LOCALES.has(locale) ? "rtl" : "ltr",
        );

        const facts = await fixture.evaluate((fixtureElement) => {
          const card = fixtureElement.querySelector<HTMLElement>(":scope > section");
          const timeline = card?.firstElementChild as HTMLElement | null;
          const summary = timeline?.children.item(1) as HTMLElement | null;
          const history = timeline?.children.item(2) as HTMLElement | null;
          if (!card || !timeline || !summary || !history) {
            throw new Error("habit streak timeline structure not found");
          }

          const cardRect = card.getBoundingClientRect();
          const tolerance = 0.75;
          const isOutside = (rect: DOMRect) =>
            rect.left < cardRect.left - tolerance ||
            rect.right > cardRect.right + tolerance ||
            rect.top < cardRect.top - tolerance ||
            rect.bottom > cardRect.bottom + tolerance;
          const intersects = (left: DOMRect, right: DOMRect) =>
            Math.min(left.right, right.right) - Math.max(left.left, right.left) > tolerance &&
            Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > tolerance;

          const visibleTextRects: Array<{ text: string; rect: DOMRect }> = [];
          const walker = document.createTreeWalker(timeline, NodeFilter.SHOW_TEXT);
          let current = walker.nextNode();
          while (current) {
            const text = current.textContent ?? "";
            if (text.trim()) {
              const range = document.createRange();
              range.selectNodeContents(current);
              const rect = range.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) visibleTextRects.push({ text: text.trim(), rect });
            }
            current = walker.nextNode();
          }

          const summaryItems = Array.from(summary.children) as HTMLElement[];
          const summaryRects = summaryItems.map((element) => element.getBoundingClientRect());
          const summaryCollisions = summaryRects.flatMap((left, leftIndex) =>
            summaryRects
              .slice(leftIndex + 1)
              .map((right, offset) => ({ leftIndex, rightIndex: leftIndex + offset + 1, hit: intersects(left, right) }))
              .filter((pair) => pair.hit),
          );

          const historyRows = Array.from(history.children) as HTMLElement[];
          const rowCollisions = historyRows.flatMap((row, rowIndex) => {
            const rects = Array.from(row.children).map((child) => child.getBoundingClientRect());
            return rects.flatMap((left, leftIndex) =>
              rects
                .slice(leftIndex + 1)
                .map((right, offset) => ({
                  rowIndex,
                  leftIndex,
                  rightIndex: leftIndex + offset + 1,
                  hit: intersects(left, right),
                }))
                .filter((pair) => pair.hit),
            );
          });

          const fragmentedWords: string[] = [];
          const wordWalker = document.createTreeWalker(timeline, NodeFilter.SHOW_TEXT);
          let wordNode = wordWalker.nextNode();
          while (wordNode) {
            const text = wordNode.textContent ?? "";
            for (const match of text.matchAll(
              /[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Arabic}\p{Script=Hebrew}\p{Number}]+/gu,
            )) {
              if (match[0].length < 2) continue;
              const start = match.index ?? 0;
              const range = document.createRange();
              range.setStart(wordNode, start);
              range.setEnd(wordNode, start + match[0].length);
              if (Array.from(range.getClientRects()).filter((rect) => rect.width > 0).length > 1) {
                fragmentedWords.push(match[0]);
              }
            }
            wordNode = wordWalker.nextNode();
          }

          return {
            documentOverflow: Math.max(
              0,
              document.documentElement.scrollWidth - document.documentElement.clientWidth,
              document.body.scrollWidth - document.documentElement.clientWidth,
            ),
            componentOverflow: Math.max(0, timeline.scrollWidth - timeline.clientWidth),
            outOfBoundsText: visibleTextRects.filter(({ rect }) => isOutside(rect)).map(({ text }) => text),
            summaryCollisions,
            rowCollisions,
            fragmentedWords,
            dateTimeCount: timeline.querySelectorAll("time[datetime]").length,
            isolatedDateCount: timeline.querySelectorAll('time[datetime][dir="auto"]').length,
            summaryItemCount: summaryItems.length,
            historyRowCount: historyRows.length,
          };
        });

        receipt.push({ locale, theme, viewport, ...facts, consoleErrors });

        if (viewport.id === "narrow-200" && ["en", "ar", "he"].includes(locale)) {
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
      expect(row.componentOverflow, `${label} component overflow`).toBe(0);
      expect(row.outOfBoundsText, `${label} text bounds`).toEqual([]);
      expect(row.summaryCollisions, `${label} summary collisions`).toEqual([]);
      expect(row.rowCollisions, `${label} row collisions`).toEqual([]);
      expect(row.fragmentedWords, `${label} word fragmentation`).toEqual([]);
      expect(row.dateTimeCount, `${label} semantic date endpoints`).toBe(10);
      expect(row.isolatedDateCount, `${label} bidi-isolated date endpoints`).toBe(10);
      expect(row.summaryItemCount, `${label} summary items`).toBe(2);
      expect(row.historyRowCount, `${label} history rows`).toBe(5);
      expect(row.consoleErrors, `${label} console errors`).toEqual([]);
    }
  });
});
