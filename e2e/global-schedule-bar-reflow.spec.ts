import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const LOCALES = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"] as const;
const RTL_LOCALES = new Set(["ar", "he"]);
const OUTPUT_DIR = path.resolve("output/android21/t153-global-schedule-bar-reflow");

const VIEWPORTS = [
  { id: "narrow-200", width: 320, height: 568, scale: "200" },
  { id: "short-portrait", width: 320, height: 420, scale: "100" },
  { id: "landscape", width: 568, height: 320, scale: "100" },
  { id: "split-window", width: 360, height: 640, scale: "100" },
] as const;

test.describe("global schedule summary reflow", () => {
  test.setTimeout(180_000);

  test.beforeAll(() => {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  });

  test("keeps the current block readable without ellipsis across the adaptive matrix", async ({
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
          `e2e/helpers/global-schedule-bar-reflow/index.html?lang=${locale}&theme=${theme}&scale=${viewport.scale}`,
          { waitUntil: "domcontentloaded" },
        );

        const fixture = page.getByTestId("global-schedule-bar-reflow-fixture");
        await expect(fixture).toBeVisible();
        await expect(fixture).toHaveAttribute("data-language", locale);
        await expect(page.locator("html")).toHaveAttribute(
          "dir",
          RTL_LOCALES.has(locale) ? "rtl" : "ltr",
        );

        const button = page.getByRole("button");
        const eventTitle = await fixture.getAttribute("data-event-title");
        expect(eventTitle).toBeTruthy();
        const facts = await button.evaluate((element, title) => {
          const titleElement = Array.from(element.querySelectorAll<HTMLElement>("span")).find(
            (candidate) => candidate.textContent?.includes(title),
          );
          if (!titleElement) throw new Error("schedule event title element not found");

          const buttonRect = element.getBoundingClientRect();
          const titleRect = titleElement.getBoundingClientRect();
          const titleStyle = getComputedStyle(titleElement);
          const arrow = element.querySelector<SVGElement>("svg.lucide-chevron-right");
          const titleTextNode = Array.from(titleElement.childNodes).find(
            (node) => node.nodeType === Node.TEXT_NODE,
          );
          const fragmentedWords = titleTextNode
            ? Array.from((titleTextNode.textContent ?? "").matchAll(/\S+/gu))
                .filter((match) =>
                  /[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Arabic}\p{Script=Hebrew}\p{Number}]/u.test(
                    match[0],
                  ),
                )
                .filter((match) => {
                  const start = match.index ?? 0;
                  const range = document.createRange();
                  range.setStart(titleTextNode, start);
                  range.setEnd(titleTextNode, start + match[0].length);
                  return Array.from(range.getClientRects()).filter(
                    (rect) => rect.width > 0 && rect.height > 0,
                  ).length > 1;
                })
                .map((match) => match[0])
            : [];

          return {
            documentOverflow: Math.max(
              0,
              document.documentElement.scrollWidth - document.documentElement.clientWidth,
              document.body.scrollWidth - document.documentElement.clientWidth,
            ),
            minimumButtonTarget: Math.min(buttonRect.width, buttonRect.height),
            titleHorizontalOverflow: Math.max(
              0,
              titleElement.scrollWidth - titleElement.clientWidth,
            ),
            titleInsideButton:
              titleRect.left >= buttonRect.left - 0.5 &&
              titleRect.right <= buttonRect.right + 0.5 &&
              titleRect.top >= buttonRect.top - 0.5 &&
              titleRect.bottom <= buttonRect.bottom + 0.5,
            titleWhiteSpace: titleStyle.whiteSpace,
            titleTextOverflow: titleStyle.textOverflow,
            titleOverflowX: titleStyle.overflowX,
            fragmentedWords,
            arrowTransform: arrow ? getComputedStyle(arrow).transform : null,
          };
        }, eventTitle!);

        receipt.push({ locale, theme, viewport, ...facts, consoleErrors });

        if (viewport.id === "narrow-200" && ["en", "ar", "he"].includes(locale)) {
          await page.screenshot({
            path: path.join(OUTPUT_DIR, `${locale}-${viewport.id}-${theme}.png`),
            fullPage: true,
            animations: "disabled",
          });
        }
        await context.close();
      }
    }

    writeFileSync(
      path.join(OUTPUT_DIR, "browser-matrix.json"),
      `${JSON.stringify({ generatedAt: new Date().toISOString(), rows: receipt }, null, 2)}\n`,
    );

    for (const row of receipt) {
      const label = `${row.locale}/${(row.viewport as { id: string }).id}`;
      expect(row.documentOverflow, `${label} page overflow`).toBe(0);
      expect(row.minimumButtonTarget, `${label} button target`).toBeGreaterThanOrEqual(48);
      expect(row.titleHorizontalOverflow, `${label} event title overflow`).toBe(0);
      expect(row.titleInsideButton, `${label} event title bounds`).toBe(true);
      expect(row.titleWhiteSpace, `${label} event title wrapping`).not.toBe("nowrap");
      expect(row.titleTextOverflow, `${label} event title ellipsis`).not.toBe("ellipsis");
      expect(row.titleOverflowX, `${label} event title clipping`).not.toBe("hidden");
      expect(row.fragmentedWords, `${label} event title word fragmentation`).toEqual([]);
      expect(row.consoleErrors, `${label} console errors`).toEqual([]);
      if (RTL_LOCALES.has(row.locale as string)) {
        expect(row.arrowTransform, `${label} RTL arrow`).not.toBe("none");
      }
    }
  });

  test("keeps the reflowed schedule action visibly keyboard focusable in Hebrew RTL", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(
      "e2e/helpers/global-schedule-bar-reflow/index.html?lang=he&theme=dark&scale=200",
    );
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const button = page.getByRole("button");
    await page.keyboard.press("Tab");
    await expect(button).toBeFocused();

    const focusStyle = await button.evaluate((element) => ({
      boxShadow: getComputedStyle(element).boxShadow,
      documentOverflow: Math.max(
        0,
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
        document.body.scrollWidth - document.documentElement.clientWidth,
      ),
    }));
    expect(focusStyle.boxShadow).not.toBe("none");
    expect(focusStyle.documentOverflow).toBe(0);

    await page.screenshot({
      path: path.join(OUTPUT_DIR, "he-narrow-200-keyboard-focus.png"),
      fullPage: true,
      animations: "disabled",
    });
  });
});
