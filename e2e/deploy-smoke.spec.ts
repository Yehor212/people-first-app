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
    await primeReleasePreview(page);
  });

  test("V1 portal exposes readable Ukrainian V2 entry points", async ({ page }) => {
    await page.goto("?navLayout=desktop&dev=true", { waitUntil: "domcontentloaded" });

    const portal = page.getByTestId("v1-v2-portal");
    await expect(portal).toBeVisible({ timeout: 30_000 });
    await expect(portal).toContainText("Попередній перегляд V2");
    await expect(portal).toContainText("Перейди в новий простір ритуалів");
    await expect(portal).not.toContainText(/\?{4,}/);

    await expect(page.getByTestId("v1-v2-portal-primary")).toHaveAttribute(
      "href",
      /\/people-first-app\/orb\?nav=v2&navLayout=phone/,
    );
    await expect(page.getByTestId("v1-v2-portal-habits")).toHaveAttribute(
      "href",
      /\/people-first-app\/habits\?nav=v2&navLayout=phone/,
    );
    await expect(page.getByTestId("v1-v2-portal-diary")).toHaveAttribute(
      "href",
      /\/people-first-app\/diary\?nav=v2&navLayout=phone/,
    );
  });

  for (const target of [
    { path: "orb?nav=v2&navLayout=phone&dev=true", testId: "orb-page" },
    { path: "habits?nav=v2&navLayout=phone&dev=true", testId: "habits-page" },
    { path: "diary?nav=v2&navLayout=phone&dev=true", testId: "diary-page" },
  ]) {
    test(`V2 route boots: ${target.path}`, async ({ page }) => {
      await page.goto(target.path, { waitUntil: "domcontentloaded" });

      await expect(page.getByTestId(target.testId)).toBeVisible({ timeout: 30_000 });
      await expect(page.locator("body")).not.toContainText(/\?{4,}/);
    });
  }
});
