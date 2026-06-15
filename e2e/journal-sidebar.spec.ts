import { expect, test } from "@playwright/test";

import { primeZenflowV2 } from "./helpers/zenflowV2State";

async function primeApp(page: import("@playwright/test").Page) {
  await primeZenflowV2(page, { language: "en", theme: "paper" });
  await page.addInitScript(() => {
    localStorage.setItem("journal_sidebar_state", "expanded");
  });
}

test.describe("Diary desktop shell recovery", () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ page }) => {
    await primeApp(page);
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto("?nav=v2");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByTestId("nav-v2-orchestrator")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("sidebar-v2")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("sidebar-v2").getByRole("button", { name: /^Diary$/ }).click();
    await expect(page.getByTestId("diary-page")).toBeVisible();
    await expect(page.getByText("Loading...")).toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByTestId("journal-sidebar-rail")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("journal-sidebar-wide")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("journal-detail-pane")).toBeVisible({ timeout: 30_000 });
  });

  test("collapsed rail keeps recovery affordance and detail expands", async ({ page }) => {
    const sidebarWide = page.getByTestId("journal-sidebar-wide");
    const detailPane = page.getByTestId("journal-detail-pane");
    const disclosure = page.getByTestId("journal-sidebar-disclosure");

    const expandedDetailWidth = await detailPane.evaluate((node) =>
      Math.round(node.getBoundingClientRect().width),
    );

    await disclosure.click();

    await expect.poll(async () => (
      await sidebarWide.evaluate((node) => Math.round(node.getBoundingClientRect().width))
    )).toBe(0);

    await expect(disclosure).toHaveAttribute("aria-expanded", "false");

    const collapsedDetailWidth = await detailPane.evaluate((node) =>
      Math.round(node.getBoundingClientRect().width),
    );
    expect(collapsedDetailWidth).toBeGreaterThan(expandedDetailWidth);

    await disclosure.click();

    await expect.poll(async () => (
      await sidebarWide.evaluate((node) => Math.round(node.getBoundingClientRect().width))
    )).toBeGreaterThan(320);
    await expect(disclosure).toHaveAttribute("aria-expanded", "true");
  });

  test("settings render in one desktop detail surface and preserve dirty draft", async ({ page }) => {
    const rail = page.getByTestId("journal-sidebar-rail");

    await page.getByRole("button", { name: /Start your story|Write first entry/i }).first().click();
    const editor = page.locator("[contenteditable='true']").first();
    await editor.click();
    await editor.pressSequentially("Recovered draft text");

    await rail.getByRole("button", { name: /^Settings$/ }).click();
    await expect(editor).toContainText("Recovered draft text");

    const saveDraftAndOpenSettings = page.getByRole("button", {
      name: "Save Draft & Open Settings",
    });
    if (
      await saveDraftAndOpenSettings
        .isVisible({ timeout: 2_000 })
        .catch(() => false)
    ) {
      await saveDraftAndOpenSettings.click();
    } else {
      await page.getByRole("button", { name: /^Save$/ }).click();
      await expect(page.locator("[contenteditable='true']")).toHaveCount(0, {
        timeout: 10_000,
      });
      await rail.getByRole("button", { name: /^Settings$/ }).click();
    }

    await expect(page.getByTestId("journal-settings-panel")).toBeVisible();
    await expect(page.getByRole("dialog", { name: /Diary Settings/i })).toHaveCount(0);

    await page
      .getByTestId("journal-settings-panel")
      .getByRole("button", { name: /^Close$/ })
      .click();

    await expect(page.getByText(/Unsaved draft found/i)).toBeVisible();
  });
});
