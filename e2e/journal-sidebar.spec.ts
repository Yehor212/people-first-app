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
    await page.goto("diary?nav=v2&dev=true");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByTestId("nav-v2-orchestrator")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("sidebar-v2")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("diary-page")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("diary-page-ambience-control")).toHaveCount(0);
    await expect(page.getByTestId("diary-page-ambience-toggle")).toHaveCount(0);
    await expect(page.getByText("Loading...")).toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByTestId("journal-sidebar-rail")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("journal-sidebar-wide")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("journal-detail-pane")).toBeVisible({ timeout: 30_000 });
  });

  test("permanent app sidebar does not cover or crowd diary at tablet desktop widths", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });

    const appSidebar = page.getByTestId("sidebar-v2");
    const diaryPage = page.getByTestId("diary-page");
    await expect(appSidebar).toBeVisible();
    await expect(diaryPage).toBeVisible();

    await expect.poll(async () => await page.getByTestId("journal-sidebar-wide").count(), {
      message: "wide diary sidebar is disabled when the permanent app sidebar leaves tablet-width content",
      timeout: 8_000,
    }).toBe(0);
    await expect(page.getByTestId("journal-mobile-diary-sidebar-trigger")).toBeVisible();
    await expect(page.getByTestId("journal-mobile-app-nav-menu")).toHaveCount(0);
    await expect(page.getByTestId("drawer-v2")).toHaveCount(0);

    const geometry = await page.evaluate(() => {
      const sidebar = document.querySelector<HTMLElement>("[data-testid='sidebar-v2']")?.getBoundingClientRect();
      const diary = document.querySelector<HTMLElement>("[data-testid='diary-page']")?.getBoundingClientRect();
      return sidebar && diary
        ? {
            sidebarRight: sidebar.right,
            diaryLeft: diary.left,
            diaryWidth: diary.width,
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          }
        : null;
    });

    expect(geometry).not.toBeNull();
    if (!geometry) return;
    expect(geometry.diaryLeft).toBeGreaterThanOrEqual(geometry.sidebarRight - 1);
    expect(geometry.diaryWidth).toBeGreaterThanOrEqual(680);
    expect(geometry.overflow).toBeLessThanOrEqual(1);
  });

  test("tablet diary drawer uses shared wallpaper without nesting the list backdrop", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });

    await expect.poll(async () => await page.getByTestId("journal-sidebar-wide").count(), {
      message: "tablet diary layout should switch to the drawer presentation",
      timeout: 8_000,
    }).toBe(0);

    await page.getByTestId("journal-mobile-diary-sidebar-trigger").click();

    const drawer = page.getByTestId("journal-mobile-diary-sidebar");
    await expect(drawer).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("journal-mobile-diary-sidebar-backdrop")).toBeVisible();
    await expect(drawer.locator(".journal-memory-field")).toHaveCount(0);
    await expect.poll(async () => page.evaluate(() => (
      document.elementFromPoint(40, 96)?.closest<HTMLElement>(
        "[data-testid='journal-mobile-diary-sidebar'], [data-testid='sidebar-v2']"
      )?.dataset.testid
    )), {
      message: "mobile diary drawer should be above the app sidebar after the entrance frame settles",
      timeout: 5_000,
    }).toBe("journal-mobile-diary-sidebar");

    const overlayGeometry = await page.evaluate(() => {
      const drawer = document.querySelector<HTMLElement>("[data-testid='journal-mobile-diary-sidebar']")?.getBoundingClientRect();
      const sidebar = document.querySelector<HTMLElement>("[data-testid='sidebar-v2']")?.getBoundingClientRect();
      const topAtRail = document.elementFromPoint(40, 96)?.closest<HTMLElement>(
        "[data-testid='journal-mobile-diary-sidebar'], [data-testid='sidebar-v2']"
      )?.dataset.testid;
      return drawer && sidebar
        ? { drawerLeft: drawer.left, drawerRight: drawer.right, sidebarRight: sidebar.right, topAtRail }
        : null;
    });

    expect(overlayGeometry).not.toBeNull();
    if (!overlayGeometry) return;
    expect(overlayGeometry.drawerLeft).toBeLessThanOrEqual(1);
    expect(overlayGeometry.drawerRight).toBeGreaterThan(overlayGeometry.sidebarRight);
    expect(overlayGeometry.topAtRail).toBe("journal-mobile-diary-sidebar");
  });

  test("diary sidebar keeps compact rail and wide diary panel", async ({ page }) => {
    const rail = page.getByTestId("journal-sidebar-rail");
    const sidebarWide = page.getByTestId("journal-sidebar-wide");
    const detailPane = page.getByTestId("journal-detail-pane");
    const disclosure = page.getByTestId("journal-sidebar-disclosure");

    await expect(rail.getByRole("button", { name: /^Entry$|^Diary$/ })).toBeVisible();
    await expect(rail.getByRole("button", { name: /^Statistics$/ })).toBeVisible();
    await expect(rail.getByRole("button", { name: /^Favorites$/ })).toBeVisible();
    await expect(rail.getByRole("button", { name: /^Settings$/ })).toBeVisible();

    const expandedDetailWidth = await detailPane.evaluate((node) =>
      Math.round(node.getBoundingClientRect().width),
    );

    await expect.poll(async () => (
      await sidebarWide.evaluate((node) => Math.round(node.getBoundingClientRect().width))
    )).toBeGreaterThan(320);

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

  test("empty desktop detail uses the ambient canvas instead of duplicating the list card", async ({ page }) => {
    const detailPane = page.getByTestId("journal-detail-pane");

    await expect(page.getByTestId("journal-compact-empty-list")).toBeVisible();
    await expect(detailPane.getByTestId("diary-empty-canvas")).toBeVisible({
      timeout: 30_000,
    });
    await expect(detailPane.getByTestId("journal-empty-list")).toHaveCount(0);

    const canvasHeight = await detailPane
      .getByTestId("diary-empty-canvas")
      .evaluate((node) => Math.round(node.getBoundingClientRect().height));
    const detailHeight = await detailPane.evaluate((node) =>
      Math.round(node.getBoundingClientRect().height),
    );
    expect(canvasHeight).toBeGreaterThan(detailHeight * 0.5);
  });

  test("empty canvas prompt opens a new entry with the prompt text", async ({ page }) => {
    const detailPane = page.getByTestId("journal-detail-pane");

    await expect(detailPane.getByTestId("diary-empty-canvas")).toBeVisible({ timeout: 30_000 });
    await detailPane.getByRole("button", { name: /^Prompt$/ }).click();

    const editor = page.locator("[contenteditable='true']").first();
    await expect(editor).toBeVisible({ timeout: 20_000 });
    await expect(editor).toContainText("Write one true sentence about today.");
  });

  test("settings render in one desktop detail surface and preserve dirty draft", async ({ page }) => {
    const rail = page.getByTestId("journal-sidebar-rail");

    await page.getByRole("button", { name: /New entry|Write entry|Write first entry|Start your story/i }).first().click();
    const editor = page.locator("[contenteditable='true']").first();
    await editor.click();
    await editor.pressSequentially("Recovered draft text");

    await rail.getByRole("button", { name: /^Settings$/ }).click();
    await expect(editor).toContainText("Recovered draft text");

    const saveDraftAndOpenSettings = page.getByRole("button", {
      name: /^Save Draft (?:&|and) Open Settings$/,
    });
    if (
      await saveDraftAndOpenSettings
        .isVisible({ timeout: 2_000 })
        .catch(() => false)
    ) {
      await saveDraftAndOpenSettings.evaluate((element: HTMLElement) => element.focus());
      await page.keyboard.press("Enter");
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

  test("favorites opens as a focused diary detail surface", async ({ page }) => {
    const rail = page.getByTestId("journal-sidebar-rail");

    await rail.getByRole("button", { name: /^Favorites$/ }).click();

    await expect(page.getByTestId("journal-favorites-panel")).toBeVisible();
    await expect(page.getByTestId("journal-detail-pane")).toContainText("Favorites");
    await expect(page.getByTestId("journal-sidebar-rail")).toBeVisible();
    await expect(page.getByTestId("journal-sidebar-wide")).toBeVisible();
  });
});
