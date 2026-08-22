import { expect, test, type Page } from "@playwright/test";

const ANDROID_ENTRY_LOCALES = [
  { language: "en", direction: "ltr", theme: "light" },
  { language: "uk", direction: "ltr", theme: "light" },
  { language: "es", direction: "ltr", theme: "light" },
  { language: "de", direction: "ltr", theme: "light" },
  { language: "fr", direction: "ltr", theme: "light" },
  { language: "ja", direction: "ltr", theme: "light" },
  { language: "ar", direction: "rtl", theme: "dark" },
  { language: "he", direction: "rtl", theme: "light" },
] as const;

const TYPICAL_ANDROID_VIEWPORTS = [
  { name: "portrait", width: 360, height: 800 },
  { name: "split", width: 360, height: 640 },
] as const;

async function waitForEntryIncident(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
}

async function readEntryGeometry(page: Page) {
  return page.evaluate(() => {
    const screen = document.querySelector<HTMLElement>('[data-testid="auth-screen"]')!;
    const panel = document.querySelector<HTMLElement>('[data-testid="auth-screen-panel"]')!;
    const host = document.querySelector<HTMLElement>(
      '[data-testid="entry-storage-incident-host"]',
    )!;
    const banner = document.querySelector<HTMLElement>(
      '[data-testid="storage-error-banner"]',
    )!;
    const privacy = document.querySelector<HTMLElement>('[data-testid="auth-privacy-copy"]')!;
    const legal = document.querySelector<HTMLElement>('[data-testid="auth-legal-copy"]')!;
    const title = screen.querySelector<HTMLElement>("h1")!;
    const close = banner.querySelector<HTMLElement>("button[aria-label]")!;
    const providerButtons = Array.from(
      panel.querySelectorAll<HTMLElement>("button"),
    ).filter((button) => button.getClientRects().length > 0);
    const screenRect = screen.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const bannerRect = banner.getBoundingClientRect();
    const privacyRect = privacy.getBoundingClientRect();
    const closeRect = close.getBoundingClientRect();
    const titleRange = document.createRange();
    titleRange.selectNodeContents(title);
    const titleTextWithinScreen = Array.from(titleRange.getClientRects())
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .every((rect) => rect.left >= screenRect.left - 0.75 && rect.right <= screenRect.right + 0.75);
    return {
      bannerPosition: getComputedStyle(banner).position,
      bannerParentIsHost: banner.parentElement === host,
      bannerText: banner.textContent ?? "",
      closeHeight: closeRect.height,
      closeWidth: closeRect.width,
      documentOverflow: Math.max(
        0,
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
        document.body.scrollWidth - document.documentElement.clientWidth,
      ),
      hostAfterPanel: bannerRect.top >= panelRect.bottom,
      privacyAfterBanner: privacyRect.top >= bannerRect.bottom,
      titleTextWithinScreen,
      contentCanScroll:
        screen.scrollHeight > screen.clientHeight ||
        document.documentElement.scrollHeight > document.documentElement.clientHeight,
      legalTextLength: legal.textContent?.trim().length ?? 0,
      providerCount: providerButtons.length,
      providersKeepTouchTargets: providerButtons.every((button) => {
        const rect = button.getBoundingClientRect();
        return rect.width >= 44 && rect.height >= 44;
      }),
      providersStayInline: providerButtons.every((button) => {
        const rect = button.getBoundingClientRect();
        return rect.left >= screenRect.left - 0.75 && rect.right <= screenRect.right + 0.75;
      }),
    };
  });
}

test.describe("public entry storage incident reflow", () => {
  test.setTimeout(120_000);

  for (const viewport of TYPICAL_ANDROID_VIEWPORTS) {
    for (const locale of ANDROID_ENTRY_LOCALES) {
      test(`${locale.language} keeps the normal ${viewport.name} sign-in flow reachable at 100% text`, async ({
        page,
      }) => {
        await page.emulateMedia({
          colorScheme: locale.theme,
          reducedMotion: "no-preference",
        });
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(
          `e2e/helpers/storage-incident-reflow/index.html?lang=${locale.language}&theme=${locale.theme}`,
          { waitUntil: "domcontentloaded" },
        );
        await waitForEntryIncident(page);

        const authScreen = page.getByTestId("auth-screen");
        const host = page.getByTestId("entry-storage-incident-host");
        const banner = page.getByTestId("storage-error-banner");
        await expect(authScreen).toBeVisible();
        await expect(banner).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("dir", locale.direction);
        await expect(host.getByRole("status")).toBeVisible();

        const metrics = await readEntryGeometry(page);

        expect(metrics).toMatchObject({
          bannerPosition: "relative",
          bannerParentIsHost: true,
          documentOverflow: 0,
          hostAfterPanel: true,
          privacyAfterBanner: true,
          titleTextWithinScreen: true,
          contentCanScroll: true,
          providersKeepTouchTargets: true,
          providersStayInline: true,
        });
        expect(metrics.bannerText).not.toContain(
          "IndexedDB operation timed out, using cached data",
        );
        expect(metrics.closeHeight).toBeGreaterThanOrEqual(48);
        expect(metrics.closeWidth).toBeGreaterThanOrEqual(48);
        expect(metrics.legalTextLength).toBeGreaterThan(0);
        expect(metrics.providerCount).toBeGreaterThan(0);

        await page.getByTestId("auth-screen-panel").scrollIntoViewIfNeeded();
        await expect(page.getByTestId("auth-screen-panel")).toBeVisible();
        await page.getByTestId("auth-legal-copy").scrollIntoViewIfNeeded();
        await expect(page.getByTestId("auth-legal-copy")).toBeVisible();

        await page.screenshot({
          path: `output/android21/t151-entry-storage/browser-${locale.language}-${viewport.width}x${viewport.height}-100.png`,
          fullPage: true,
        });
      });
    }
  }

  for (const locale of ANDROID_ENTRY_LOCALES) {
    test(`${locale.language} keeps entry content recoverable in the final 200% accessibility stress`, async ({
      page,
    }) => {
      await page.emulateMedia({
        colorScheme: locale.theme,
        reducedMotion: "reduce",
      });
      await page.setViewportSize({ width: 320, height: 568 });
      await page.addInitScript(() => {
        document.documentElement.style.fontSize = "200%";
      });
      await page.goto(
        `e2e/helpers/storage-incident-reflow/index.html?lang=${locale.language}&theme=${locale.theme}`,
        { waitUntil: "domcontentloaded" },
      );
      await waitForEntryIncident(page);

      await expect(page.getByTestId("storage-error-banner")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("dir", locale.direction);
      const metrics = await readEntryGeometry(page);
      expect(metrics.documentOverflow).toBe(0);
      expect(metrics.bannerPosition).toBe("relative");
      expect(metrics.bannerParentIsHost).toBe(true);
      expect(metrics.hostAfterPanel).toBe(true);
      expect(metrics.privacyAfterBanner).toBe(true);
      expect(metrics.titleTextWithinScreen).toBe(true);
      expect(metrics.contentCanScroll).toBe(true);
      expect(metrics.closeHeight).toBeGreaterThanOrEqual(48);
      expect(metrics.closeWidth).toBeGreaterThanOrEqual(48);

      await page.getByTestId("auth-legal-copy").scrollIntoViewIfNeeded();
      await expect(page.getByTestId("auth-legal-copy")).toBeVisible();

      await page.screenshot({
        path: `output/android21/t151-entry-storage/browser-${locale.language}-320x568-200.png`,
        fullPage: true,
      });
    });
  }
});
