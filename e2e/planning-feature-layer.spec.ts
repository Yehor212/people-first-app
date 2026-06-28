import { expect, test } from "@playwright/test";
import { primeZenflowV2, type ZenflowV2Language } from "./helpers/zenflowV2State";

test("Planning feature layer works on phone in paper root theme while preserving dark V1 surfaces", async ({ page }) => {
  await primeZenflowV2(page, { language: "uk", privacyNoTracking: true, theme: "paper" });
  await page.goto("planning?nav=v2&navLayout=phone&dev=true", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: /Сплануй наступний ритуал/i })).toBeVisible();
  await expect(page.getByTestId("planning-page")).toHaveAttribute("data-planning-theme", "v1-dark");
  await expect(page.getByTestId("planning-mode-rail")).toBeVisible();
  await expect(page.getByTestId("planning-action-panel")).toBeVisible();
  await expect(page.getByTestId("planning-review-lane")).toBeVisible();
  await expect(page.getByTestId("planning-day-pulse")).toBeVisible();
  await expect(page.getByTestId("planning-pulse-events")).toBeVisible();
  await expect(page.getByTestId("planning-pulse-focus")).toBeVisible();
  await expect(page.getByTestId("planning-pulse-habits")).toBeVisible();
  await expect(page.getByTestId("planning-pulse-mood")).toBeVisible();
  await expect(page.getByTestId("planning-bridge-actions")).toBeVisible();
  await expect(page.getByTestId("planning-bridge-action-log_mood")).toBeVisible();

  await page.getByTestId("planning-mode-focus").click();
  await expect(page.getByTestId("planning-mode-focus")).toHaveAttribute("aria-pressed", "true");

  const darkEvidence = await page.getByTestId("planning-page").evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      background: style.backgroundColor,
      token: style.getPropertyValue("--background").trim(),
    };
  });
  expect(darkEvidence.token).toBe("176 38% 5%");
});

for (const language of ["ar", "he"] satisfies ZenflowV2Language[]) {
  test(`Planning feature layer keeps RTL ${language} layout inside the viewport`, async ({ page }) => {
    await primeZenflowV2(page, { language, privacyNoTracking: true, theme: "paper" });
    await page.goto("planning?nav=v2&navLayout=phone&dev=true", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("planning-page")).toHaveAttribute("dir", "rtl");
    await expect(page.getByTestId("planning-mode-rail")).toBeVisible();
    await expect(page.getByTestId("planning-mode-today")).toBeVisible();
    await expect(page.getByTestId("planning-mode-review")).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });
}
