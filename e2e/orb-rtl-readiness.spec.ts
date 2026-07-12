import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

import { primeZenflowV2, v2RoutePath } from "./helpers/zenflowV2State";

const OUTPUT_DIR = path.resolve(process.cwd(), "output/playwright/orb-rtl-readiness");

for (const language of ["ar", "he"] as const) {
  for (const width of [320, 390] as const) {
    test(`${language} keeps orb direction and valence meaning at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 780 });
      await primeZenflowV2(page, {
        language,
        theme: "paper",
        user: { id: `orb-rtl-${language}-${width}`, name: "Orb RTL Proof" },
      });

      await page.goto(v2RoutePath("orb", { layout: "phone" }), {
        waitUntil: "domcontentloaded",
      });

      const root = page.locator("html");
      const orbPage = page.getByTestId("orb-page");
      const slider = page.getByRole("slider").first();
      const next = page.getByTestId("orb-page-next");
      await expect(root).toHaveAttribute("dir", "rtl");
      await expect(orbPage).toHaveAttribute("data-orb-visual-status", "ready", {
        timeout: 30_000,
      });
      await expect(slider).toBeVisible();
      await expect(next).toBeVisible();
      await expect(next).not.toHaveText("");

      const labels = page.locator(
        "[data-testid='orb-page-slider'] .text-xs.text-muted-foreground",
      );
      await expect(labels).toHaveCount(2);
      const unpleasantBox = await labels.nth(0).boundingBox();
      const pleasantBox = await labels.nth(1).boundingBox();
      expect(unpleasantBox).not.toBeNull();
      expect(pleasantBox).not.toBeNull();
      expect(unpleasantBox!.x).toBeLessThan(pleasantBox!.x);

      const sliderBox = await slider.boundingBox();
      expect(sliderBox).not.toBeNull();
      await page.mouse.click(sliderBox!.x + 2, sliderBox!.y + sliderBox!.height / 2);
      await expect(slider).toHaveAttribute("aria-valuenow", "0");
      await page.mouse.click(
        sliderBox!.x + sliderBox!.width - 2,
        sliderBox!.y + sliderBox!.height / 2,
      );
      await expect(slider).toHaveAttribute("aria-valuenow", "6");

      await slider.focus();
      await page.keyboard.press("Home");
      await expect(slider).toHaveAttribute("aria-valuenow", "0");
      await page.keyboard.press("End");
      await expect(slider).toHaveAttribute("aria-valuenow", "6");
      await page.keyboard.press("Tab");
      await expect(next).toBeFocused();

      const arrowTransform = await next.locator("svg").evaluate(
        (node) => getComputedStyle(node).transform,
      );
      expect(arrowTransform).toMatch(/^matrix\(-1,/);

      mkdirSync(OUTPUT_DIR, { recursive: true });
      await page.screenshot({
        animations: "disabled",
        fullPage: true,
        path: path.join(OUTPUT_DIR, `${language}-${width}.png`),
      });
    });
  }
}
