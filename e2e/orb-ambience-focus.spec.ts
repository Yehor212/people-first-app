import { expect, test, type Page } from "@playwright/test";

import { primeZenflowV2 } from "./helpers/zenflowV2State";

const APP_BASE = "/people-first-app";

async function primeApp(page: Page, language: "en" | "he" = "en") {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await primeZenflowV2(page, { language, theme: "paper" });
}

async function readAmbienceFocusMetrics(page: Page) {
  return page.evaluate(() => {
    const control = document.querySelector<HTMLElement>(".orb-ambience-focus-control");
    const toggle = document.querySelector<HTMLElement>('[data-testid="orb-page-ambience-toggle"]');
    const menu = document.querySelector<HTMLElement>('[data-testid="nav-v2-open-drawer"]');
    if (!control || !toggle || !menu) throw new Error("Missing orb focus control nodes");

    const controlStyle = getComputedStyle(control);
    const toggleRect = toggle.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const overlapsMenu = !(
      toggleRect.right <= menuRect.left ||
      toggleRect.left >= menuRect.right ||
      toggleRect.bottom <= menuRect.top ||
      toggleRect.top >= menuRect.bottom
    );

    return {
      activeIsToggle: document.activeElement === toggle,
      clipPath: controlStyle.clipPath,
      controlHeight: control.getBoundingClientRect().height,
      controlOverflow: controlStyle.overflow,
      controlWidth: control.getBoundingClientRect().width,
      dir: document.documentElement.dir || "ltr",
      menuHeight: menuRect.height,
      menuWidth: menuRect.width,
      overlapsMenu,
      pageOverflowX: Math.max(
        0,
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
        document.body.scrollWidth - document.documentElement.clientWidth,
      ),
      toggleBottom: toggleRect.bottom,
      toggleHeight: toggleRect.height,
      toggleLeft: toggleRect.left,
      toggleRight: toggleRect.right,
      toggleTop: toggleRect.top,
      toggleWidth: toggleRect.width,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    };
  });
}

test.describe("V2 Orb ambience focus control", () => {
  test.setTimeout(60_000);

  for (const language of ["en", "he"] as const) {
    test("phone focus reveal stays accessible without changing the default orb surface (" + language + ")", async ({ page }) => {
      await primeApp(page, language);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(APP_BASE + "/orb?nav=v2&navLayout=phone&dev=true");
      await page.evaluate(() => document.fonts.ready);

      await expect(page.getByTestId("orb-page")).toBeVisible({ timeout: 30_000 });
      const before = await readAmbienceFocusMetrics(page);
      expect(before.controlWidth).toBeLessThanOrEqual(1);
      expect(before.controlHeight).toBeLessThanOrEqual(1);
      expect(before.clipPath).not.toBe("none");
      expect(before.pageOverflowX).toBe(0);

      await page.getByTestId("orb-page-ambience-toggle").focus();
      await expect(page.getByTestId("orb-page-ambience-toggle")).toBeFocused();
      const focused = await readAmbienceFocusMetrics(page);

      expect(focused.activeIsToggle).toBe(true);
      expect(focused.controlOverflow).toBe("visible");
      expect(focused.clipPath).toBe("none");
      expect(Math.min(focused.toggleWidth, focused.toggleHeight)).toBeGreaterThanOrEqual(44);
      expect(focused.toggleTop).toBeGreaterThanOrEqual(0);
      expect(focused.toggleBottom).toBeLessThanOrEqual(focused.viewportHeight);
      expect(focused.toggleLeft).toBeGreaterThanOrEqual(0);
      expect(focused.toggleRight).toBeLessThanOrEqual(focused.viewportWidth);
      expect(focused.overlapsMenu).toBe(false);
      expect(focused.pageOverflowX).toBe(0);
      expect(focused.dir).toBe(language === "he" ? "rtl" : "ltr");
    });
  }
});
