import { expect, test, type Page } from "@playwright/test";

import { primeZenflowV2 } from "./helpers/zenflowV2State";

async function primeReleasePreview(page: Page) {
  await primeZenflowV2(page, {
    language: "uk",
    privacyNoTracking: true,
    theme: "paper",
  });
}

test.describe("Deploy smoke", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (error) => console.log("PAGEERROR:", error.message));
    page.on("console", (message) => {
      if (message.type() === "error") console.log("CONSOLEERROR:", message.text());
    });
    await primeReleasePreview(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === "passed") return;
    const errorLog = await page
      .evaluate(() => localStorage.getItem("zenflow-error-log"))
      .catch(() => null);
    console.log("ZENFLOW-ERROR-LOG:", errorLog);
  });

  test("root boots the V2 shell without the legacy portal", async ({ page }) => {
    await page.goto("?navLayout=desktop&dev=true", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("nav-v2-orchestrator")).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(
        async () => {
          for (const affordance of [
            page.getByTestId("sidebar-v2"),
            page.getByTestId("mobile-nav-v2"),
            page.getByTestId("nav-v2-open-drawer"),
          ]) {
            if ((await affordance.count()) > 0 && (await affordance.first().isVisible())) return true;
          }
          return false;
        },
        { timeout: 30_000, message: "V2 shell exposes a platform navigation affordance" }
      )
      .toBe(true);
    await expect(page.getByTestId("v1-v2-portal")).toHaveCount(0);
    await expect(page.getByTestId("app-shell-v1")).toHaveCount(0);
    await expect(page.locator('[data-testid*="classic-portal"]')).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(/\?{4,}/);
  });

  for (const target of [
    { path: "orb?nav=v2&navLayout=phone&dev=true", testId: "orb-page" },
    { path: "habits?nav=v2&navLayout=phone&dev=true", testId: "habits-page" },
    { path: "diary?nav=v2&navLayout=phone&dev=true", testId: "diary-page" },
    { path: "planning?nav=v2&navLayout=phone&dev=true", testId: "planning-page" },
    { path: "settings?nav=v2&navLayout=phone&dev=true", testId: "settings-page" },
  ]) {
    test(`V2 route boots: ${target.path}`, async ({ page }) => {
      await page.goto(target.path, { waitUntil: "domcontentloaded" });

      await expect(page.getByTestId(target.testId)).toBeVisible({ timeout: 30_000 });
      await expect(page.locator("body")).not.toContainText(/\?{4,}/);
    });
  }
});
