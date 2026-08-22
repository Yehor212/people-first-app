import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const LOCALES = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"] as const;
const RTL_LOCALES = new Set(["ar", "he"]);
const OUTPUT_DIR = path.resolve("output/android21/t153-calendar-reflow");

const VIEWPORTS = [
  { id: "narrow-200", width: 320, height: 568, fontSize: "200%" },
  { id: "short-portrait", width: 320, height: 420, fontSize: "100%" },
  { id: "landscape", width: 568, height: 320, fontSize: "100%" },
  { id: "split-window", width: 360, height: 640, fontSize: "100%" },
] as const;

test.describe("calendar data-grid reflow", () => {
  test.setTimeout(180_000);

  test.beforeAll(() => {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  });

  test("keeps two production calendar grids in one named internal scroll axis", async ({
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
        await page.addInitScript(({ fontSize }) => {
          document.documentElement.style.fontSize = fontSize;
        }, { fontSize: viewport.fontSize });
        await page.goto(
          `e2e/helpers/calendar-reflow/index.html?lang=${locale}&theme=${theme}&scale=${viewport.fontSize === "200%" ? "200" : "100"}`,
          { waitUntil: "domcontentloaded" },
        );

        const fixture = page.getByTestId("calendar-reflow-fixture");
        await expect(fixture).toBeVisible();
        await expect(fixture).toHaveAttribute("data-language", locale);
        await expect(page.locator("html")).toHaveAttribute(
          "dir",
          RTL_LOCALES.has(locale) ? "rtl" : "ltr",
        );

        const facts = await page.evaluate(() => {
          const regions = Array.from(
            document.querySelectorAll<HTMLElement>('[role="region"][tabindex="0"]'),
          );
          const habitSurface = document.querySelector<HTMLElement>(
            '[data-testid="habit-calendar-surface"]',
          );
          const habitHeading = habitSurface?.querySelector<HTMLElement>("h3") ?? null;
          const habitMonth =
            habitSurface?.querySelector<HTMLButtonElement>("button")?.parentElement?.querySelector<HTMLElement>(
              "span",
            ) ?? null;
          const habitNavTargets = Array.from(
            habitSurface?.querySelectorAll<HTMLButtonElement>("button") ?? [],
          ).slice(0, 2);
          const dayTargets = Array.from(
            document.querySelectorAll<HTMLElement>(
              '[data-testid="calendar-grid-surface"] [role="region"] button',
            ),
          );

          const fragmentedWords = (element: HTMLElement | null) => {
            const textNode = element?.firstChild;
            const text = textNode?.textContent ?? "";
            if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return [];

            return Array.from(text.matchAll(/\S+/gu))
              .filter((match) =>
                /[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Arabic}\p{Script=Hebrew}\p{Number}]/u.test(
                  match[0],
                ),
              )
              .filter((match) => {
                const start = match.index ?? 0;
                const range = document.createRange();
                range.setStart(textNode, start);
                range.setEnd(textNode, start + match[0].length);
                return Array.from(range.getClientRects()).filter(
                  (rect) => rect.width > 0 && rect.height > 0,
                ).length > 1;
              })
              .map((match) => match[0]);
          };

          return {
            documentOverflow: Math.max(
              0,
              document.documentElement.scrollWidth - document.documentElement.clientWidth,
              document.body.scrollWidth - document.documentElement.clientWidth,
            ),
            regions: regions.map((region) => ({
              label: region.getAttribute("aria-label"),
              clientWidth: region.clientWidth,
              scrollWidth: region.scrollWidth,
              overflowX: getComputedStyle(region).overflowX,
            })),
            minimumDayTarget: Math.min(
              ...dayTargets.map((target) => {
                const rect = target.getBoundingClientRect();
                return Math.min(rect.width, rect.height);
              }),
            ),
            minimumNavTarget: Math.min(
              ...habitNavTargets.map((target) => {
                const rect = target.getBoundingClientRect();
                return Math.min(rect.width, rect.height);
              }),
            ),
            fragmentedWords: {
              heading: fragmentedWords(habitHeading),
              month: fragmentedWords(habitMonth),
            },
          };
        });

        expect(facts.documentOverflow, `${locale}/${viewport.id} page overflow`).toBe(0);
        expect(facts.regions, `${locale}/${viewport.id} named regions`).toHaveLength(2);
        for (const region of facts.regions) {
          expect(region.label, `${locale}/${viewport.id} region label`).toBeTruthy();
          expect(region.overflowX, `${locale}/${viewport.id} region overflow`).toBe("auto");
          if (viewport.width <= 360) {
            expect(region.scrollWidth, `${locale}/${viewport.id} scrollable width`).toBeGreaterThan(
              region.clientWidth,
            );
          }
        }
        expect(facts.minimumDayTarget, `${locale}/${viewport.id} day target`).toBeGreaterThanOrEqual(
          44,
        );
        expect(
          Math.round(facts.minimumNavTarget),
          `${locale}/${viewport.id} month navigation target`,
        ).toBeGreaterThanOrEqual(48);
        expect(facts.fragmentedWords, `${locale}/${viewport.id} word fragmentation`).toEqual({
          heading: [],
          month: [],
        });
        expect(consoleErrors, `${locale}/${viewport.id} console errors`).toEqual([]);

        receipt.push({ locale, theme, viewport, ...facts });

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
  });

  test("exposes a visible keyboard focus boundary and scrolls without moving the page", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.addInitScript(() => {
      document.documentElement.style.fontSize = "200%";
    });
    await page.goto("e2e/helpers/calendar-reflow/index.html?lang=en&theme=light&scale=200");
    const region = page
      .getByTestId("calendar-grid-surface")
      .getByRole("region", { name: "Calendar — August 2026", exact: true });
    await region.focus();
    await expect(region).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(() => region.evaluate((element) => element.scrollLeft))
      .toBeGreaterThan(0);
    const focusStyle = await region.evaluate((element) => getComputedStyle(element).boxShadow);
    expect(focusStyle).not.toBe("none");
    expect(await page.evaluate(() => document.documentElement.scrollLeft)).toBe(0);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, "en-narrow-200-keyboard-focus.png"),
      fullPage: true,
      animations: "disabled",
    });
  });

  test("keeps Hebrew RTL calendar scrolling inside the focused region", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.addInitScript(() => {
      document.documentElement.style.fontSize = "200%";
    });
    await page.goto("e2e/helpers/calendar-reflow/index.html?lang=he&theme=light&scale=200");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const region = page
      .getByTestId("calendar-grid-surface")
      .locator('[role="region"][tabindex="0"]');
    await region.focus();
    await expect(region).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect
      .poll(() => region.evaluate((element) => Math.abs(element.scrollLeft)))
      .toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollLeft)).toBe(0);
  });
});
