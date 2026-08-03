import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { validateProductionWebBundleManifest } from "../scripts/ratchet-bundle-manifest";

const OUTPUT_DIR =
  process.env.ZENFLOW_DELETE_ACCOUNT_AUDIT_OUTPUT_DIR ??
  join(process.cwd(), "output/playwright/delete-account-final");

const LOCALES = [
  { direction: "ltr", locale: "en", scheme: "light" },
  { direction: "ltr", locale: "uk", scheme: "light" },
  { direction: "ltr", locale: "es", scheme: "light" },
  { direction: "ltr", locale: "de", scheme: "light" },
  { direction: "ltr", locale: "fr", scheme: "light" },
  { direction: "ltr", locale: "ja", scheme: "light" },
  { direction: "rtl", locale: "ar", scheme: "dark" },
  { direction: "rtl", locale: "he", scheme: "dark" },
] as const;

function validateStrictProductionPreview(): void {
  if (
    process.env.CI &&
    process.env.ZENFLOW_PLAYWRIGHT_USE_LOCAL_SERVER === "true" &&
    process.env.ZENFLOW_PLAYWRIGHT_PREVIEW_DIR === "dist"
  ) {
    validateProductionWebBundleManifest({ rootDir: process.cwd(), env: process.env });
  }
}

test.beforeAll(() => validateStrictProductionPreview());
test.afterAll(() => validateStrictProductionPreview());

function collectRuntimeIssues(page: Page) {
  const issues: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") issues.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => issues.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => {
    issues.push(`requestfailed: ${new URL(request.url()).pathname}`);
  });
  return issues;
}

type VisibleTextClippingIssue = {
  ancestor: string;
  axis: "horizontal" | "vertical";
  reason: "ellipsis" | "line-clamp" | "overflow";
  text: string;
};

async function measureVisibleTextClipping(
  page: Page,
  rootSelector: string
): Promise<VisibleTextClippingIssue[]> {
  return page.evaluate((selector) => {
    const root = document.querySelector<HTMLElement>(selector);
    if (!root) throw new Error(`Missing public-page clipping root: ${selector}`);

    const hiddenOverflow = new Set(["clip", "hidden"]);
    const issues: VisibleTextClippingIssue[] = [];
    const reported = new Set<string>();
    const identify = (element: HTMLElement) =>
      element.getAttribute("data-testid") ||
      element.getAttribute("data-delete-account-locale") ||
      element.id ||
      element.tagName.toLowerCase();
    const report = (
      ancestor: HTMLElement,
      axis: VisibleTextClippingIssue["axis"],
      reason: VisibleTextClippingIssue["reason"],
      text: string
    ) => {
      const ancestorName = identify(ancestor);
      const key = `${ancestorName}\u0000${axis}\u0000${reason}\u0000${text}`;
      if (reported.has(key)) return;
      reported.add(key);
      issues.push({ ancestor: ancestorName, axis, reason, text: text.slice(0, 120) });
    };

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let current = walker.nextNode(); current && issues.length < 50; current = walker.nextNode()) {
      const parent = current.parentElement;
      const text = current.textContent?.trim().replace(/\s+/g, " ") ?? "";
      if (!parent || !text || parent.closest('[aria-hidden="true"], .sr-only')) continue;
      const parentStyle = getComputedStyle(parent);
      const parentRect = parent.getBoundingClientRect();
      if (
        parentStyle.display === "none" ||
        parentStyle.visibility === "hidden" ||
        parentStyle.contentVisibility === "hidden" ||
        Number(parentStyle.opacity) === 0 ||
        parentRect.width <= 2 ||
        parentRect.height <= 2
      ) {
        continue;
      }

      const range = document.createRange();
      range.selectNodeContents(current);
      const textRects = Array.from(range.getClientRects()).filter(
        (rect) => rect.width > 1 && rect.height > 1
      );
      for (
        let ancestor: HTMLElement | null = parent;
        ancestor && root.contains(ancestor);
        ancestor = ancestor.parentElement
      ) {
        const style = getComputedStyle(ancestor);
        const rect = ancestor.getBoundingClientRect();
        const horizontalTextOverflow =
          ancestor.scrollWidth > ancestor.clientWidth + 1 ||
          textRects.some((textRect) => textRect.left < rect.left - 1 || textRect.right > rect.right + 1);
        const verticalTextOverflow =
          ancestor.scrollHeight > ancestor.clientHeight + 1 ||
          textRects.some((textRect) => textRect.top < rect.top - 1 || textRect.bottom > rect.bottom + 1);

        if (hiddenOverflow.has(style.overflowX) && horizontalTextOverflow) {
          report(ancestor, "horizontal", "overflow", text);
        }
        if (hiddenOverflow.has(style.overflowY) && verticalTextOverflow) {
          report(ancestor, "vertical", "overflow", text);
        }
        if (style.textOverflow === "ellipsis" && (horizontalTextOverflow || verticalTextOverflow)) {
          report(
            ancestor,
            horizontalTextOverflow ? "horizontal" : "vertical",
            "ellipsis",
            text
          );
        }
        const lineClamp = Number.parseInt(style.webkitLineClamp, 10);
        if (Number.isFinite(lineClamp) && lineClamp > 0 && verticalTextOverflow) {
          report(ancestor, "vertical", "line-clamp", text);
        }
      }
    }

    return issues;
  }, rootSelector);
}

for (const { direction, locale, scheme } of LOCALES) {
  test(`serves the ${locale} deletion disclosure without narrow-screen clipping`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    const issues = collectRuntimeIssues(page);

    await page.goto(`delete-account.html?lang=${locale}`, { waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("html")).toHaveAttribute("dir", direction);

    const selectedArticle = page.locator(`[data-delete-account-locale="${locale}"]`);
    await expect(selectedArticle).toBeVisible();
    await expect(page.locator("[data-delete-account-locale]:visible")).toHaveCount(1);
    await expect(selectedArticle.getByRole("heading", { level: 1 })).not.toBeEmpty();
    await expect(page.locator(`[data-delete-account-language-link="${locale}"]`)).toHaveAttribute(
      "aria-current",
      "page"
    );

    const baselineRootFontSize = await page.evaluate(() =>
      Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
    );
    await page.locator("html").evaluate((element) => {
      element.style.setProperty("font-size", "200%", "important");
    });
    await page.addStyleTag({
      content: `
        h1, h2, p, li, a {
          line-height: 1.5 !important;
          letter-spacing: 0.12em !important;
          word-spacing: 0.16em !important;
        }
        p {
          margin-block-end: 2em !important;
        }
      `,
    });
    await expect
      .poll(() =>
        page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).fontSize))
      )
      .toBe(baselineRootFontSize * 2);

    const visibleTextClipping = await measureVisibleTextClipping(
      page,
      `[data-delete-account-locale="${locale}"]`
    );

    const layout = await page.evaluate(() => {
      const viewportWidth = document.documentElement.clientWidth;
      const visible = (element: Element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.height > 0;
      };
      const offenders = Array.from(document.querySelectorAll("h1, h2, p, li, a"))
        .filter(visible)
        .map((element) => ({
          name: element.tagName.toLowerCase(),
          rect: element.getBoundingClientRect(),
          text: element.textContent?.trim().slice(0, 80) ?? "",
        }))
        .filter(({ rect }) => rect.left < -1 || rect.right > viewportWidth + 1)
        .map(({ name, rect, text }) => ({ left: rect.left, name, right: rect.right, text }));
      const textNodes = new Set<Text>();
      for (const element of document.querySelectorAll("h1, h2, p, li, a")) {
        if (!visible(element)) continue;
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (node.textContent?.trim()) textNodes.add(node as Text);
        }
      }
      const clippedText = Array.from(textNodes).flatMap((node) => {
        const range = document.createRange();
        range.selectNodeContents(node);
        const clippingAncestors: Element[] = [];
        for (let element = node.parentElement; element; element = element.parentElement) {
          const style = getComputedStyle(element);
          if (style.overflowX === "hidden" || style.overflowX === "clip") {
            clippingAncestors.push(element);
          }
        }
        const text = node.textContent?.trim().slice(0, 80) ?? "";
        return Array.from(range.getClientRects()).flatMap((rect) => {
          const clippingAncestor = clippingAncestors.find((element) => {
            const clip = element.getBoundingClientRect();
            return rect.left < clip.left - 1 || rect.right > clip.right + 1;
          });
          if (!clippingAncestor) return [];
          const clip = clippingAncestor.getBoundingClientRect();
          return [
            {
              clipLeft: clip.left,
              clipRight: clip.right,
              left: rect.left,
              right: rect.right,
              text,
            },
          ];
        });
      });
      const undersizedTargets = Array.from(
        document.querySelectorAll<HTMLAnchorElement>(
          "[data-delete-account-language-link], a.action-link"
        )
      )
        .filter(visible)
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            height: rect.height,
            text: element.textContent?.trim() ?? "",
            width: rect.width,
          };
        })
        .filter(({ height, width }) => height < 44 || width < 44);
      const proseWrapOffenders = Array.from(document.querySelectorAll("h1, h2, p, li"))
        .filter(visible)
        .flatMap((element) => {
          const style = getComputedStyle(element);
          const lineBreak = (style as CSSStyleDeclaration & { lineBreak?: string }).lineBreak;
          return style.overflowWrap === "anywhere" ||
            style.wordBreak === "break-all" ||
            lineBreak === "anywhere"
            ? [
                {
                  lineBreak,
                  overflowWrap: style.overflowWrap,
                  text: element.textContent?.trim().slice(0, 80) ?? "",
                  wordBreak: style.wordBreak,
                },
              ]
            : [];
        });
      const narrowReadingMeasure = Array.from(
        document.querySelectorAll<HTMLElement>("p:not(.eyebrow), li"),
      )
        .filter(visible)
        .map((element) => {
          const fontSize = Number.parseFloat(getComputedStyle(element).fontSize);
          const inlineSize = element.getBoundingClientRect().width;
          return {
            measureEm: inlineSize / fontSize,
            text: element.textContent?.trim().slice(0, 80) ?? "",
          };
        })
        .filter(({ measureEm }) => measureEm < 7);
      const fragmentedBrandTokens: Array<{
        lines: number;
        rects: Array<{ height: number; top: number; width: number }>;
        text: string;
      }> = [];
      for (const element of document.querySelectorAll("h1, h2, p, li")) {
        if (!visible(element)) continue;
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        for (let current = walker.nextNode(); current; current = walker.nextNode()) {
          const node = current as Text;
          const text = node.textContent ?? "";
          let start = text.indexOf("ZenFlow");
          while (start >= 0) {
            const range = document.createRange();
            range.setStart(node, start);
            range.setEnd(node, start + "ZenFlow".length);
            const lineTops: number[] = [];
            const rects = Array.from(range.getClientRects())
              .filter((rect) => rect.width > 1 && rect.height > 1)
              .map((rect) => ({ height: rect.height, top: rect.top, width: rect.width }));
            for (const rect of rects) {
              if (!lineTops.some((top) => Math.abs(top - rect.top) <= 1)) lineTops.push(rect.top);
            }
            if (lineTops.length > 1) {
              fragmentedBrandTokens.push({ lines: lineTops.length, rects, text: "ZenFlow" });
            }
            start = text.indexOf("ZenFlow", start + "ZenFlow".length);
          }
        }
      }
      return {
        bodyOverflow: document.body.scrollWidth - viewportWidth,
        clippedText,
        documentOverflow: document.documentElement.scrollWidth - viewportWidth,
        fragmentedBrandTokens,
        narrowReadingMeasure,
        offenders,
        proseWrapOffenders,
        rootFontSize: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
        undersizedTargets,
      };
    });

    expect(layout.rootFontSize).toBe(baselineRootFontSize * 2);
    expect(layout.bodyOverflow).toBeLessThanOrEqual(1);
    expect(layout.clippedText).toEqual([]);
    expect(layout.documentOverflow).toBeLessThanOrEqual(1);
    expect(layout.fragmentedBrandTokens).toEqual([]);
    expect(layout.narrowReadingMeasure).toEqual([]);
    expect(layout.offenders).toEqual([]);
    expect(layout.proseWrapOffenders).toEqual([]);
    expect(layout.undersizedTargets).toEqual([]);
    expect(visibleTextClipping).toEqual([]);
    expect(issues).toEqual([]);

    if (locale === "en" || locale === "de" || locale === "ar" || locale === "he") {
      await mkdir(OUTPUT_DIR, { recursive: true });
      await page.screenshot({
        animations: "disabled",
        fullPage: true,
        path: join(OUTPUT_DIR, `delete-account-${locale}-320px-200pct.png`),
      });
    }
  });
}

test("proves the public deletion clipping audit detects overflow, ellipsis, and line-clamp failures", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("delete-account.html?lang=en", { waitUntil: "networkidle" });
  const article = page.locator('[data-delete-account-locale="en"]');
  await expect(article).toBeVisible();
  await article.evaluate((root) => {
    const controls = document.createElement("div");
    controls.dataset.testid = "delete-account-clipping-negative-controls";
    controls.style.cssText = "position:relative;width:120px;font-size:16px;line-height:20px";
    controls.innerHTML = `
      <div data-testid="negative-overflow-y" style="height:20px;overflow-y:hidden;width:100px">
        Vertical clipping must be detected across several wrapped lines of visible text.
      </div>
      <div data-testid="negative-ellipsis" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:72px">
        Ellipsis clipping must be detected.
      </div>
      <div data-testid="negative-line-clamp" style="display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1;overflow:hidden;width:100px">
        Line clamp clipping must be detected across several wrapped lines of visible text.
      </div>
    `;
    root.append(controls);
  });

  const detected = await measureVisibleTextClipping(
    page,
    '[data-testid="delete-account-clipping-negative-controls"]'
  );
  expect(detected.some(({ axis, reason }) => axis === "vertical" && reason === "overflow")).toBe(
    true
  );
  expect(detected.some(({ reason }) => reason === "ellipsis")).toBe(true);
  expect(detected.some(({ axis, reason }) => axis === "vertical" && reason === "line-clamp")).toBe(
    true
  );
  await page
    .getByTestId("delete-account-clipping-negative-controls")
    .evaluate((element) => element.remove());
  expect(await measureVisibleTextClipping(page, '[data-delete-account-locale="en"]')).toEqual([]);
});

test("falls back to English for an unsupported explicit locale", async ({ page }) => {
  const issues = collectRuntimeIssues(page);
  await page.goto("delete-account.html?lang=not-a-locale", { waitUntil: "networkidle" });

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.locator('[data-delete-account-locale="en"]')).toBeVisible();
  await expect(page.locator('[data-delete-account-language-link="en"]')).toHaveAttribute(
    "aria-current",
    "page"
  );
  expect(issues).toEqual([]);
});
