import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import { JOURNAL_FAVORITE_TAG } from "../src/features/journal/journalFavorite";
import { primeZenflowV2, v2RoutePath } from "./helpers/zenflowV2State";

const MIN_TOUCH_TARGET_PX = 44;
const TOUCH_TARGET_EPSILON_PX = 0.01;
const JOURNAL_PHOTO_FIXTURE = fileURLToPath(new URL("../public/og-image.png", import.meta.url));

function expectTouchSize(value: number) {
  expect(value + TOUCH_TARGET_EPSILON_PX).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
}

async function primeApp(page: import("@playwright/test").Page) {
  await primeZenflowV2(page, { language: "en", theme: "ink" });
}

async function waitForStyledDiaryShell(page: import("@playwright/test").Page) {
  const waitForStyledTarget = () =>
    expect
      .poll(
        async () => {
          const box = await page.getByTestId("journal-mobile-stats").boundingBox();
          return box ? Math.min(box.width, box.height) : 0;
        },
        { message: "styled diary shell has applied touch-target CSS", timeout: 8_000 }
      )
      .toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);

  try {
    await waitForStyledTarget();
  } catch {
    await page.reload({ waitUntil: "load" });
    await waitForStyledTarget();
  }
}

async function expectFocusInsideMobileDiarySidebar(page: import("@playwright/test").Page) {
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const drawer = document.querySelector('[data-testid="journal-mobile-diary-sidebar"]');
          return Boolean(
            drawer && document.activeElement && drawer.contains(document.activeElement)
          );
        }),
      { message: "keyboard focus remains inside the mobile diary sidebar", timeout: 3_000 }
    )
    .toBe(true);
}

async function expectFocusInsideMobileDiarySettings(page: import("@playwright/test").Page) {
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const sheet = document.querySelector('[data-testid="journal-mobile-settings-panel"]');
          return Boolean(sheet && document.activeElement && sheet.contains(document.activeElement));
        }),
      { message: "keyboard focus remains inside the mobile diary settings sheet", timeout: 3_000 }
    )
    .toBe(true);
}

async function expectEntryWriteActionVisible(page: import("@playwright/test").Page) {
  await expect(
    page
      .getByTestId("journal-entry-main-fab")
      .or(page.getByRole("button", { name: /^New Entry$/i }))
      .or(page.getByTestId("journal-capture-launcher"))
      .first()
  ).toBeVisible({ timeout: 30_000 });
}

async function expectSeparatedPhotoActionTargets(page: import("@playwright/test").Page) {
  const actions = page.locator("[data-journal-photo-action]");
  await expect(actions).toHaveCount(2);

  const [removeBox, floatBox, itemBox] = await Promise.all([
    page.locator('[data-journal-photo-action="remove"]').boundingBox(),
    page.locator('[data-journal-photo-action="float"]').boundingBox(),
    actions.first().locator("..").boundingBox(),
  ]);
  expect(removeBox).not.toBeNull();
  expect(floatBox).not.toBeNull();
  expect(itemBox).not.toBeNull();
  if (!removeBox || !floatBox || !itemBox) return;

  for (const box of [removeBox, floatBox]) {
    expectTouchSize(box.width);
    expectTouchSize(box.height);
    expect(box.x + TOUCH_TARGET_EPSILON_PX).toBeGreaterThanOrEqual(itemBox.x);
    expect(box.y + TOUCH_TARGET_EPSILON_PX).toBeGreaterThanOrEqual(itemBox.y);
    expect(box.x + box.width).toBeLessThanOrEqual(
      itemBox.x + itemBox.width + TOUCH_TARGET_EPSILON_PX
    );
    expect(box.y + box.height).toBeLessThanOrEqual(
      itemBox.y + itemBox.height + TOUCH_TARGET_EPSILON_PX
    );
  }

  const overlaps = !(
    removeBox.x + removeBox.width <= floatBox.x ||
    floatBox.x + floatBox.width <= removeBox.x ||
    removeBox.y + removeBox.height <= floatBox.y ||
    floatBox.y + floatBox.height <= removeBox.y
  );
  expect(overlaps).toBe(false);
}

async function openNewJournalEntry(page: import("@playwright/test").Page) {
  await expectEntryWriteActionVisible(page);

  const launcher = page.getByTestId("journal-entry-main-fab");
  if (!(await launcher.isVisible())) {
    await page.getByRole("button", { name: /^New Entry$/i }).click();
    return;
  }

  await launcher.click();

  await page.waitForFunction(() =>
    Boolean(
      document.querySelector('[data-testid="journal-fab-action-new-entry"]') ||
      document.querySelector('[data-testid="journal-fab-action-primary"]')
    )
  );
  const newEntryAction = page.getByTestId("journal-fab-action-new-entry");
  if (await newEntryAction.count()) {
    await newEntryAction.click();
    return;
  }

  await page.getByTestId("journal-fab-action-primary").click();
}

async function openMobileEditorTools(page: import("@playwright/test").Page) {
  const photoButton = page.getByRole("button", { name: /^Photo$/i });
  if (await photoButton.isVisible()) return;

  const toolsButton = page.getByRole("button", { name: /^Tools$/i });
  await expect(toolsButton).toBeVisible({ timeout: 20_000 });
  await expect(photoButton).toHaveCount(0);
  await toolsButton.click();
  await expect(photoButton).toBeVisible();
}

async function seedFavoriteJournalEntry(page: import("@playwright/test").Page) {
  await page.evaluate(async (favoriteTag) => {
    const request = indexedDB.open("ZenFlowDB");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onerror = () => reject(new Error(request.error?.message || "IndexedDB open failed"));
      request.onsuccess = () => resolve(request.result);
    });

    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    const tx = db.transaction("journalEntries", "readwrite");
    tx.objectStore("journalEntries").put({
      id: "e2e-favorite-entry",
      date: today,
      title: "Favorite mountain note",
      content: "<p>A <strong>saved</strong> reflection that should return from Favorites.</p>",
      stickers: [],
      photoIds: [],
      audioIds: [],
      tags: [favoriteTag],
      createdAt: now,
      updatedAt: now,
    });

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error(tx.error?.message || "IndexedDB write failed"));
      tx.onabort = () => reject(new Error(tx.error?.message || "IndexedDB write aborted"));
    });
    db.close();
  }, JOURNAL_FAVORITE_TAG);

  await page.reload({ waitUntil: "load" });
  await waitForStyledDiaryShell(page);
}

test.describe("Journal V2 memory portal", () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ page }) => {
    await primeApp(page);
    await page.setViewportSize({ width: 399, height: 869 });
    await page.goto(v2RoutePath("diary", { layout: "phone" }), { waitUntil: "load" });
    await waitForStyledDiaryShell(page);
  });

  test("keeps the diary first screen clean and moves the portal behind the stats button", async ({
    page,
  }) => {
    await expect(page.getByTestId("journal-mobile-stats")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("memory-portal-canvas")).toHaveCount(0);
    await expect(page.getByTestId("journal-hub-shell")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Tools$/i })).toHaveCount(0);
    await expect(page.getByTestId("nav-v2-open-drawer")).toBeHidden();
    await expect(page.getByTestId("diary-page-ambience-control")).toHaveCount(0);
    await expect(page.getByTestId("diary-page-ambience-toggle")).toHaveCount(0);

    const appMenu = page.getByTestId("journal-mobile-app-nav-menu");
    await expect(appMenu).toBeVisible();
    const appMenuBox = await appMenu.boundingBox();
    expect(appMenuBox).not.toBeNull();
    if (appMenuBox) {
      expectTouchSize(appMenuBox.width);
      expectTouchSize(appMenuBox.height);
    }

    const diaryPanelTrigger = page.getByTestId("journal-mobile-diary-sidebar-trigger");
    await expect(diaryPanelTrigger).toBeVisible();
    const diaryPanelBox = await diaryPanelTrigger.boundingBox();
    expect(diaryPanelBox).not.toBeNull();
    if (diaryPanelBox) {
      expectTouchSize(diaryPanelBox.width);
      expectTouchSize(diaryPanelBox.height);
    }

    for (const id of [
      "journal-mobile-app-nav-menu",
      "journal-mobile-diary-sidebar-trigger",
      "journal-mobile-entry",
      "journal-mobile-stats",
      "journal-mobile-favorites",
      "journal-mobile-settings",
    ]) {
      const target = page.getByTestId(id);
      const box = await target.boundingBox();
      const viewport = page.viewportSize();
      expect(box).not.toBeNull();
      expect(viewport).not.toBeNull();
      if (!box || !viewport) continue;

      expectTouchSize(box.width);
      expectTouchSize(box.height);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
    }

    await appMenu.click();
    await expect(page.getByTestId("drawer-v2")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId("drawer-v2-destination-habits")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("drawer-v2")).toHaveCount(0);

    await diaryPanelTrigger.click();
    await expect(page.getByTestId("journal-mobile-diary-sidebar")).toBeVisible();
    await expect(page.getByTestId("drawer-v2")).toHaveCount(0);
    await expect(page.getByTestId("journal-mobile-diary-sidebar")).toContainText("Diary");
    await expect(
      page
        .getByTestId("journal-mobile-diary-sidebar")
        .getByTestId("journal-mobile-diary-sidebar-calendar")
    ).toBeVisible();
    await expect(page.getByTestId("journal-mobile-diary-sidebar-close")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("journal-mobile-diary-sidebar")).toBeHidden();
    await expect(diaryPanelTrigger).toBeFocused();

    await expect(page.getByTestId("journal-mobile-stats")).toBeVisible();
    await page.getByTestId("journal-mobile-stats").click();
    await expect(page.getByTestId("memory-portal-canvas")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("memory-portal-day-capsule-button")).toHaveCount(0);
    await expect(page.getByTestId("memory-portal-action-toggle")).toHaveCount(0);

    const core = page.getByTestId("memory-portal-core");
    await expect(core).toBeVisible({ timeout: 30_000 });

    const coreBox = await core.boundingBox();
    expect(coreBox).not.toBeNull();
    if (coreBox) {
      expectTouchSize(coreBox.width);
      expectTouchSize(coreBox.height);
    }

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("traps keyboard focus inside the diary sidebar drawer", async ({ page }) => {
    const diaryPanelTrigger = page.getByTestId("journal-mobile-diary-sidebar-trigger");
    await expect(diaryPanelTrigger).toBeVisible();
    await diaryPanelTrigger.click();

    const drawer = page.getByTestId("journal-mobile-diary-sidebar");
    await expect(drawer).toBeVisible();
    await expect(page.getByTestId("journal-mobile-diary-sidebar-close")).toBeFocused();
    await expectFocusInsideMobileDiarySidebar(page);

    await page.keyboard.press("Shift+Tab");
    await expectFocusInsideMobileDiarySidebar(page);

    for (let i = 0; i < 10; i += 1) {
      await page.keyboard.press("Tab");
      await expectFocusInsideMobileDiarySidebar(page);
    }

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(diaryPanelTrigger).toBeFocused();
  });

  test("keeps portal controls clear of compact Android navigation reserve", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.addStyleTag({ content: ":root { --zenflow-test-nav-inset-bottom: 48px; }" });
    await expect(page.getByTestId("journal-mobile-stats")).toBeVisible();
    await page.getByTestId("journal-mobile-stats").click();
    await expect(page.getByTestId("memory-portal-canvas")).toBeVisible({ timeout: 30_000 });

    await expect
      .poll(
        async () =>
          page
            .getByTestId("memory-portal-canvas")
            .evaluate((element) =>
              Number.parseFloat(window.getComputedStyle(element).paddingBottom)
            ),
        { message: "memory portal applies Android navigation reserve", timeout: 4_000 }
      )
      .toBeGreaterThanOrEqual(48);

    const core = page.getByTestId("memory-portal-core");
    const coreBox = await core.boundingBox();
    expect(coreBox).not.toBeNull();
    if (coreBox) {
      await page.mouse.move(coreBox.x + coreBox.width / 2, coreBox.y + coreBox.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(520);
      await page.mouse.up();
    }
    await expect(page.getByTestId("memory-portal-action-focus")).toBeVisible();
    await page.waitForTimeout(650);

    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    if (viewport) {
      const reservedBottom = viewport.height - 48;
      const controlIds = [
        "memory-portal-core",
        "memory-portal-action-write",
        "memory-portal-action-voice",
        "memory-portal-action-photo",
        "memory-portal-action-gratitude",
        "memory-portal-action-burn",
        "memory-portal-action-focus",
      ];

      for (const id of controlIds) {
        const target = page.getByTestId(id);
        await expect
          .poll(
            async () => {
              const currentBox = await target.boundingBox();
              return currentBox ? Math.min(currentBox.width, currentBox.height) : 0;
            },
            { message: `${id} touch target reaches ${MIN_TOUCH_TARGET_PX}px`, timeout: 4_000 }
          )
          .toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);

        const box = await target.boundingBox();
        expect(box).not.toBeNull();
        if (!box) continue;

        expectTouchSize(box.width);
        expectTouchSize(box.height);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(reservedBottom + 1);
      }
    }

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("portal core and radial actions are functional", async ({ page }) => {
    await page.getByTestId("journal-mobile-stats").click();
    await expect(page.getByTestId("memory-portal-canvas")).toBeVisible({ timeout: 30_000 });

    const core = page.getByTestId("memory-portal-core");
    const coreBox = await core.boundingBox();
    expect(coreBox).not.toBeNull();
    if (coreBox) {
      await page.mouse.move(coreBox.x + coreBox.width / 2, coreBox.y + coreBox.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(520);
      await expect(page.getByTestId("memory-portal-action-write")).toBeVisible();
      await page.mouse.up();
    }
    await expect(page.getByTestId("memory-portal-action-burn")).toBeVisible();
    await expect(page.getByTestId("memory-portal-action-gratitude")).toBeVisible();
    await expect(page.getByTestId("memory-portal-action-focus")).toBeVisible();

    await page.getByTestId("memory-portal-action-burn").click();
    await expect(page.getByTestId("memory-portal-scene-burn")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("memory-portal-scene-burn")).toHaveCount(0, { timeout: 30_000 });

    await page.getByTestId("memory-portal-core").click();
    await expect(page.locator("[contenteditable='true']")).toBeVisible({ timeout: 20_000 });
  });

  test("mobile diary tabs expose entry, statistics, favorites, and settings", async ({ page }) => {
    await expect(page.getByTestId("journal-mobile-section-toolbar")).toHaveAttribute(
      "role",
      "toolbar"
    );
    await expect(page.getByTestId("journal-mobile-entry")).toBeVisible();
    await expect(page.getByTestId("journal-mobile-stats")).toBeVisible();
    await expect(page.getByTestId("journal-mobile-favorites")).toBeVisible();
    await expect(page.getByTestId("journal-mobile-settings")).toBeVisible();
    await expect(page.getByTestId("journal-mobile-entry")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("journal-mobile-favorites")).toHaveAttribute(
      "aria-pressed",
      "false"
    );

    await page.getByTestId("journal-mobile-favorites").click();
    await expect(page.getByTestId("journal-favorites-panel")).toBeVisible();
    await expect(page.getByTestId("journal-favorites-panel")).toContainText("Favorites");
    await expect(page.getByTestId("journal-mobile-entry")).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("journal-mobile-favorites")).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await page.getByTestId("journal-mobile-entry").click();
    await expect(page.getByTestId("journal-favorites-panel")).toHaveCount(0);
    await expectEntryWriteActionVisible(page);
    await expect(page.getByTestId("journal-mobile-entry")).toHaveAttribute("aria-pressed", "true");

    await page.getByTestId("journal-mobile-stats").click();
    await expect(page.getByTestId("memory-portal-canvas")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /back/i }).click();
    await expectEntryWriteActionVisible(page);
    await expect(page.getByTestId("journal-mobile-entry")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("journal-mobile-stats")).toHaveAttribute("aria-pressed", "false");
  });

  test("returns focus to the stable diary panel trigger after settings opens from the diary sidebar", async ({
    page,
  }) => {
    const diaryPanelTrigger = page.getByTestId("journal-mobile-diary-sidebar-trigger");
    await expect(diaryPanelTrigger).toBeVisible();
    await diaryPanelTrigger.click();

    const drawer = page.getByTestId("journal-mobile-diary-sidebar");
    await expect(drawer).toBeVisible();
    await drawer.getByRole("button", { name: "Settings" }).click();

    const settingsDialog = page.getByRole("dialog", { name: /diary settings/i });
    await expect(settingsDialog).toBeVisible({ timeout: 20_000 });
    await expect(drawer).toBeHidden();

    await page.getByTestId("journal-mobile-settings-close").click();
    await expect(settingsDialog).toHaveCount(0);
    await expect(diaryPanelTrigger).toBeFocused();
  });

  test("traps keyboard focus inside the mobile diary settings sheet", async ({ page }) => {
    const settingsTab = page.getByTestId("journal-mobile-settings");
    await expect(settingsTab).toBeVisible();
    await settingsTab.click();

    const settingsSheet = page.getByTestId("journal-mobile-settings-panel");
    await expect(settingsSheet).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("journal-mobile-settings-close")).toBeFocused();
    await expectFocusInsideMobileDiarySettings(page);

    await page.keyboard.press("Shift+Tab");
    await expectFocusInsideMobileDiarySettings(page);

    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press("Tab");
      await expectFocusInsideMobileDiarySettings(page);
    }

    await page.keyboard.press("Escape");
    await expect(settingsSheet).toHaveCount(0);
    await expect(settingsTab).toBeFocused();
  });

  test("restores the previous diary tab after closing mobile settings", async ({ page }) => {
    await page.getByTestId("journal-mobile-favorites").click();
    await expect(page.getByTestId("journal-favorites-panel")).toBeVisible();
    await expect(page.getByTestId("journal-mobile-favorites")).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await page.getByTestId("journal-mobile-settings").click();
    const settingsSheet = page.getByTestId("journal-mobile-settings-panel");
    await expect(settingsSheet).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("journal-mobile-settings")).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await page.getByTestId("journal-mobile-settings-close").click();

    await expect(settingsSheet).toHaveCount(0);
    await expect(page.getByTestId("journal-favorites-panel")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("journal-mobile-favorites")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(page.getByTestId("journal-mobile-entry")).toHaveAttribute("aria-pressed", "false");
  });

  test("favorites tab opens a saved favorite entry", async ({ page }) => {
    await seedFavoriteJournalEntry(page);

    await page.getByTestId("journal-mobile-favorites").click();
    const favoritesPanel = page.getByTestId("journal-favorites-panel");
    await expect(favoritesPanel).toBeVisible();
    await expect(
      favoritesPanel.getByRole("button", { name: /Favorite mountain note/i })
    ).toBeVisible();
    await expect(favoritesPanel).toContainText(
      "A saved reflection that should return from Favorites."
    );
    await expect(favoritesPanel).not.toContainText("<p>");
    await expect(favoritesPanel).not.toContainText("<strong>");

    await favoritesPanel.getByRole("button", { name: /Favorite mountain note/i }).click();
    await expect(page.getByText("Favorite mountain note")).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText("A saved reflection that should return from Favorites.")
    ).toBeVisible();

    await page.getByRole("button", { name: /back/i }).click();
    await expect(page.getByTestId("journal-favorites-panel")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("journal-mobile-favorites")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(page.getByTestId("journal-mobile-entry")).toHaveAttribute("aria-pressed", "false");
  });

  test("persists a user-created favorite across reload and removes it from favorites", async ({
    page,
  }) => {
    const entryText = "A favorite created through the diary editor.";
    await openNewJournalEntry(page);
    const editor = page.locator("[contenteditable='true']");
    await expect(editor).toBeVisible({ timeout: 20_000 });
    await editor.fill(entryText);
    await openMobileEditorTools(page);
    await page.getByRole("button", { name: /^Style$/i }).click();
    await expect(page.getByRole("group", { name: /^Style tools$/i })).toBeVisible();
    const favoriteToggle = page.getByTestId("journal-favorite-toggle");
    await expect(favoriteToggle).toHaveAttribute("aria-pressed", "false");
    await favoriteToggle.click();
    await expect(favoriteToggle).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: /^Save$/i }).click();
    await expect(page.getByTestId("journal-entry-editor")).toHaveCount(0, { timeout: 30_000 });

    await page.reload({ waitUntil: "load" });
    await waitForStyledDiaryShell(page);
    await page.getByTestId("journal-mobile-favorites").click();
    const favoritesPanel = page.getByTestId("journal-favorites-panel");
    await expect(favoritesPanel).toContainText(entryText, { timeout: 20_000 });
    await favoritesPanel.getByText(entryText).click();
    const removeFavorite = page.getByRole("button", { name: /^Remove from favorites$/i });
    await removeFavorite.click();
    await expect(page.getByRole("button", { name: /^Add to favorites$/i })).toHaveAttribute(
      "aria-pressed",
      "false"
    );

    await page.reload({ waitUntil: "load" });
    await waitForStyledDiaryShell(page);
    await page.getByTestId("journal-mobile-favorites").click();
    await expect(page.getByTestId("journal-favorites-panel")).not.toContainText(entryText);
  });

  test("confirms deletion, then commits it after the undo window and keeps it absent", async ({
    page,
  }) => {
    const entryText = "A temporary entry deleted through the viewer.";
    await openNewJournalEntry(page);
    const editor = page.locator("[contenteditable='true']");
    await expect(editor).toBeVisible({ timeout: 20_000 });
    await editor.fill(entryText);
    await page.getByRole("button", { name: /^Save$/i }).click();
    await expect(page.getByTestId("journal-entry-editor")).toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByText(entryText)).toBeVisible({ timeout: 20_000 });
    const deletedEntryId = await page.evaluate(async (expectedText) => {
      const request = indexedDB.open("ZenFlowDB");
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onerror = () =>
          reject(new Error(request.error?.message || "IndexedDB open failed"));
        request.onsuccess = () => resolve(request.result);
      });
      const rows = await new Promise<Array<{ id: string; content?: string }>>((resolve, reject) => {
        const getAll = db
          .transaction("journalEntries", "readonly")
          .objectStore("journalEntries")
          .getAll();
        getAll.onsuccess = () => resolve(getAll.result);
        getAll.onerror = () => reject(new Error(getAll.error?.message || "IndexedDB read failed"));
      });
      db.close();
      return rows.find((row) => row.content?.includes(expectedText))?.id ?? null;
    }, entryText);
    if (!deletedEntryId) throw new Error("Saved diary entry was not found in IndexedDB");
    await page.getByRole("button", { name: new RegExp(entryText, "i") }).click();
    await expect(page.getByRole("button", { name: /^Edit$/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /^Delete$/i }).click();
    let deleteDialog = page.getByRole("alertdialog");
    await expect(deleteDialog).toContainText("Are you sure you want to delete this entry?");
    await deleteDialog.getByRole("button", { name: /^Cancel$/i }).click();
    await expect(deleteDialog).toHaveCount(0);
    await expect(page.getByText(entryText)).toBeVisible();

    await page.getByRole("button", { name: /^Delete$/i }).click();
    deleteDialog = page.getByRole("alertdialog");
    await deleteDialog.getByRole("button", { name: /^Delete$/i }).click();
    await expect(page.getByText("Entry deleted", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Undo$/i })).toBeVisible();
    await expect(page.getByText(entryText)).toHaveCount(0, { timeout: 20_000 });

    await expect
      .poll(
        () =>
          page.evaluate(async (entryId) => {
            const request = indexedDB.open("ZenFlowDB");
            const db = await new Promise<IDBDatabase>((resolve, reject) => {
              request.onerror = () =>
                reject(new Error(request.error?.message || "IndexedDB open failed"));
              request.onsuccess = () => resolve(request.result);
            });
            const tx = db.transaction(["journalEntries", "settings"], "readonly");
            const read = <T>(request: IDBRequest<T>) =>
              new Promise<T>((resolve, reject) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () =>
                  reject(new Error(request.error?.message || "IndexedDB read failed"));
              });
            const [entry, pending, tracker] = await Promise.all([
              read(tx.objectStore("journalEntries").get(entryId)),
              read<{ value?: Array<{ id?: string }> } | undefined>(
                tx.objectStore("settings").get("journal_pending_entry_deletes_v1")
              ),
              read<{ value?: string[] } | undefined>(
                tx.objectStore("settings").get("zenflow-deleted-journal-entry-ids")
              ),
            ]);
            db.close();
            return {
              entryPresent: Boolean(entry),
              pendingPresent: Boolean(pending?.value?.some((item) => item.id === entryId)),
              tombstonePresent: Boolean(tracker?.value?.includes(entryId)),
            };
          }, deletedEntryId),
        { timeout: 15_000 }
      )
      .toEqual({ entryPresent: false, pendingPresent: false, tombstonePresent: true });
    await expect(page.getByRole("button", { name: /^Undo$/i })).toHaveCount(0);

    await page.reload({ waitUntil: "load" });
    await waitForStyledDiaryShell(page);
    await expect(page.getByText(entryText)).toHaveCount(0);
  });

  test("portal keeps removed buttons absent and shows optional zodiac layer", async ({ page }) => {
    await page.evaluate(() => localStorage.setItem("zenflow-user-birth-date", "1994-04-10"));
    await page.getByTestId("journal-mobile-stats").click();
    await expect(page.getByTestId("memory-portal-canvas")).toBeVisible({ timeout: 30_000 });

    await expect(page.getByTestId("memory-portal-day-capsule-button")).toHaveCount(0);
    await expect(page.getByTestId("memory-portal-action-toggle")).toHaveCount(0);
    await expect(page.getByTestId("memory-portal-zodiac")).toBeVisible();
    await expect(page.getByTestId("journal-hub-dock")).toHaveCount(0);
  });

  test("plus menu opens the real gratitude scene and editor has no mood slider", async ({
    page,
  }) => {
    await openNewJournalEntry(page);
    const editor = page.locator("[contenteditable='true']");
    await expect(editor).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("[role='slider'][aria-label='Mood']")).toHaveCount(0);
    await editor.fill("Seed entry for the gratitude speed dial.");
    await page
      .getByRole("button", { name: /^(save|зберегти|guardar|speichern|保存|حفظ|שמור)$/i })
      .click();

    const spaceSwitcher = page.getByTestId("journal-space-switcher");
    await expect(spaceSwitcher).toBeVisible({ timeout: 30_000 });
    const spaceSwitcherBox = await spaceSwitcher.boundingBox();
    expect(spaceSwitcherBox).not.toBeNull();
    if (spaceSwitcherBox) {
      expectTouchSize(spaceSwitcherBox.height);
      expect(spaceSwitcherBox.x).toBeLessThan(96);
    }

    await spaceSwitcher.click();
    await expect(page.getByTestId("journal-spaces-sheet")).toBeVisible();
    await page.getByTestId("journal-space-name-input").fill("Roadmap");
    await page.getByTestId("journal-space-create-submit").click();
    await expect(page.getByTestId("journal-spaces-sheet")).toHaveCount(0);
    await page.getByRole("button", { name: /^Roadmap/i }).click();
    await expect(page.getByTestId("journal-space-mode")).toBeVisible();
    await expect(page.getByTestId("journal-space-mode-title")).toContainText("Roadmap");
    await expect
      .poll(
        async () => {
          const modeBox = await page.getByTestId("journal-space-mode").boundingBox();
          return modeBox?.y ?? Number.POSITIVE_INFINITY;
        },
        { message: "space mode settles near the top of the phone viewport", timeout: 5_000 }
      )
      .toBeLessThan(260);
    await page.getByTestId("journal-space-add-entry").click();
    const folderEditor = page.locator("[contenteditable='true']");
    await expect(folderEditor).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Roadmap", { exact: true }).last()).toBeVisible();
    await expect(page.getByText("#Roadmap", { exact: true })).toHaveCount(0);
    await expect(page.locator("[role='slider'][aria-label='Mood']")).toHaveCount(0);
    await folderEditor.fill("Roadmap context stays in its folder.");
    await page
      .getByRole("button", { name: /^(save|зберегти|guardar|speichern|保存|حفظ|שמור)$/i })
      .click();
    await expect(page.locator("[contenteditable='true']")).toHaveCount(0);

    await expect(page.getByTestId("journal-entry-main-fab")).toBeVisible({ timeout: 30_000 });

    await page.getByTestId("journal-entry-main-fab").click();
    await expect(page.getByTestId("journal-fab-action-gratitude")).toBeVisible();
    await page.getByTestId("journal-fab-action-gratitude").click();
    await expect(page.getByText(/plant gratitude/i)).toBeVisible();
    await expect(page.getByRole("textbox", { name: /grateful/i })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByText(/plant gratitude/i)).toHaveCount(0);

    await page.getByTestId("journal-entry-main-fab").click();
    await page.getByTestId("journal-fab-action-new-entry").click();
    await expect(page.locator("[contenteditable='true']")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("[role='slider'][aria-label='Mood']")).toHaveCount(0);
  });

  test("private mode hides entry previews in the diary list", async ({ page }) => {
    await seedFavoriteJournalEntry(page);

    await openNewJournalEntry(page);
    const editor = page.locator("[contenteditable='true']");
    await expect(editor).toBeVisible({ timeout: 20_000 });
    await editor.fill("A sensitive private preview should disappear.");
    await page
      .getByRole("button", { name: /^(save|зберегти|guardar|speichern|保存|حفظ|שמור)$/i })
      .click();

    await expect(page.getByText("A sensitive private preview should disappear.")).toBeVisible({
      timeout: 30_000,
    });
    await page.getByTestId("journal-mobile-settings").click();
    await expect(page.getByRole("dialog", { name: /diary settings/i })).toBeVisible();
    await page.getByRole("switch", { name: /conceal diary list/i }).click();
    await page.getByRole("button", { name: /^close$/i }).click();

    await expect(page.locator("[contenteditable='true']")).toHaveCount(0);
    await expect(page.getByText("A sensitive private preview should disappear.")).toHaveCount(0);

    await page.getByTestId("journal-mobile-favorites").click();
    const favoritesPanel = page.getByTestId("journal-favorites-panel");
    await expect(favoritesPanel).toBeVisible();
    await expect(favoritesPanel).toContainText("Entry preview hidden");
    await expect(favoritesPanel).toContainText(
      "Change the diary screen privacy setting to see this entry."
    );
    await expect(favoritesPanel).not.toContainText("Favorite mountain note");
    await expect(favoritesPanel).not.toContainText(
      "A saved reflection that should return from Favorites."
    );
  });

  test("keeps every mobile editor tool reachable inside a bounded scroll tray", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openNewJournalEntry(page);
    await expect(page.locator("[contenteditable='true']")).toBeVisible({ timeout: 20_000 });

    await openMobileEditorTools(page);
    await page.getByRole("button", { name: /^Style$/i }).click();
    const styleTools = page.getByRole("group", { name: /^Style tools$/i });
    await expect(styleTools).toBeVisible();
    await expect
      .poll(() => styleTools.evaluate((element) => getComputedStyle(element).overflowY))
      .toBe("auto");

    await styleTools.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(styleTools.getByRole("button", { name: /^Voice$/i })).toBeInViewport();
  });

  test("uploads, places, persists, and restores a floating journal photo", async ({ page }) => {
    const entryText = "A photo memory that must keep its chosen place.";
    await openNewJournalEntry(page);
    const editor = page.locator("[contenteditable='true']");
    await expect(editor).toBeVisible({ timeout: 20_000 });
    await editor.fill(entryText);

    await openMobileEditorTools(page);
    const chooserPromise = page.waitForEvent("filechooser", { timeout: 5_000 });
    await page
      .getByRole("button", { name: /^Photo$/i })
      .first()
      .click();
    const chooser = await chooserPromise;
    await chooser.setFiles(JOURNAL_PHOTO_FIXTURE);
    await expect(page.getByRole("dialog", { name: /photo picker/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Place on page$/i })).toBeVisible({
      timeout: 20_000,
    });

    await page.setViewportSize({ width: 320, height: 844 });
    await expectSeparatedPhotoActionTargets(page);
    await page.evaluate(() => document.documentElement.setAttribute("dir", "rtl"));
    await expectSeparatedPhotoActionTargets(page);
    await page.evaluate(() => document.documentElement.setAttribute("dir", "ltr"));
    await page.setViewportSize({ width: 399, height: 869 });

    await page.getByRole("button", { name: /^Place on page$/i }).click();
    const floatingPhoto = page.locator("[data-floating-photo-id]").first();
    await expect(floatingPhoto).toBeVisible({ timeout: 20_000 });
    await expect(floatingPhoto).toHaveAttribute("aria-haspopup", "menu");
    await expect(floatingPhoto).toHaveAttribute("aria-keyshortcuts", "Enter Space Shift+F10");
    await expect(page.getByTestId("journal-photo-gesture-hint")).toHaveCount(0);
    await openMobileEditorTools(page);
    await expect(page.getByTestId("journal-photo-gesture-help")).toHaveCount(0);
    await floatingPhoto.focus();
    await floatingPhoto.press("ArrowRight");
    await floatingPhoto.press("ArrowRight");
    await floatingPhoto.press("ArrowDown");
    await floatingPhoto.press("ContextMenu");
    await page.getByRole("menuitem", { name: /^Describe photo$/i }).click();
    let descriptionDialog = page.getByRole("dialog", { name: /^Describe photo$/i });
    await expect(descriptionDialog).toBeVisible();
    await descriptionDialog
      .getByRole("textbox", { name: /^Photo description$/i })
      .fill("A green ZenFlow mark on a dark background");
    await descriptionDialog.getByRole("button", { name: /^Save$/i }).click();
    await expect(descriptionDialog).toHaveCount(0);
    await expect(floatingPhoto).toBeFocused();

    await floatingPhoto.press("Enter");
    await expect(page.getByRole("menuitem", { name: /^Move photo$/i })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menuitem", { name: /^Move photo$/i })).toHaveCount(0);
    await expect(page.getByRole("alertdialog", { name: /^Unsaved Changes$/i })).toHaveCount(0);
    await expect(floatingPhoto).toBeFocused();

    await floatingPhoto.press("Shift+F10");
    await page.getByRole("menuitem", { name: /^Describe photo$/i }).click();
    descriptionDialog = page.getByRole("dialog", { name: /^Describe photo$/i });
    await expect(
      descriptionDialog.getByRole("textbox", { name: /^Photo description$/i })
    ).toHaveValue("A green ZenFlow mark on a dark background");
    await descriptionDialog.getByRole("button", { name: /^Cancel$/i }).click();
    await expect(descriptionDialog).toHaveCount(0);
    await expect(floatingPhoto).toBeFocused();

    await page
      .getByTestId("journal-entry-editor")
      .getByRole("button", { name: /^Save$/i })
      .click();
    await expect(page.getByTestId("journal-entry-editor")).toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByText(entryText)).toBeVisible({ timeout: 30_000 });

    const persisted = await page.evaluate(async (expectedText) => {
      const request = indexedDB.open("ZenFlowDB");
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onerror = () =>
          reject(new Error(request.error?.message || "IndexedDB open failed"));
        request.onsuccess = () => resolve(request.result);
      });
      const tx = db.transaction("journalEntries", "readonly");
      const rows = await new Promise<
        Array<{
          content?: string;
          photoIds?: string[];
          photoLayout?: Record<
            string,
            { x: number; y: number; width: number; description?: string }
          >;
        }>
      >((resolve, reject) => {
        const getAll = tx.objectStore("journalEntries").getAll();
        getAll.onsuccess = () => resolve(getAll.result);
        getAll.onerror = () => reject(new Error(getAll.error?.message || "IndexedDB read failed"));
      });
      const entry = rows.find((row) => row.content?.includes(expectedText));
      const photoId = entry?.photoIds?.[0];
      if (!photoId) {
        db.close();
        return null;
      }
      const photo = await new Promise<{ data: string; thumbnail: string } | undefined>(
        (resolve, reject) => {
          const get = db
            .transaction("journalPhotos", "readonly")
            .objectStore("journalPhotos")
            .get(photoId);
          get.onsuccess = () => resolve(get.result);
          get.onerror = () =>
            reject(new Error(get.error?.message || "IndexedDB photo read failed"));
        }
      );
      const decode = (src: string) =>
        new Promise<{ width: number; height: number }>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
          image.onerror = () => reject(new Error("Stored journal photo did not decode"));
          image.src = src;
        });
      const [fullSize, thumbnailSize] = photo
        ? await Promise.all([decode(photo.data), decode(photo.thumbnail)])
        : [null, null];
      db.close();
      return {
        photoId,
        layout: entry?.photoLayout?.[photoId],
        fullSize,
        thumbnailSize,
        storesDistinctRenditions: photo?.data !== photo?.thumbnail,
      };
    }, entryText);
    expect(persisted?.layout).toEqual({
      x: 58,
      y: 54,
      width: 200,
      description: "A green ZenFlow mark on a dark background",
    });
    expect(persisted?.fullSize).toEqual({ width: 1200, height: 630 });
    expect(persisted?.thumbnailSize).toEqual({ width: 480, height: 252 });
    expect(persisted?.storesDistinctRenditions).toBe(true);

    await page.reload({ waitUntil: "load" });
    await waitForStyledDiaryShell(page);
    await page.getByText(entryText).click();
    const restoredLayer = page.getByTestId("readonly-floating-media-layer");
    await expect(restoredLayer).toBeVisible({ timeout: 20_000 });
    const restoredPhoto = restoredLayer.locator("[data-readonly-floating-photo-id]").first();
    await expect(restoredPhoto).toHaveCount(1);
    await expect(restoredPhoto).toHaveAttribute("data-photo-layout-x", "58");
    await expect(restoredPhoto).toHaveAttribute("data-photo-layout-y", "54");
    await expect(restoredPhoto).toHaveAttribute("data-photo-layout-width", "200");
    const restoredImage = restoredPhoto.locator("img");
    await expect(restoredImage).toHaveAttribute("alt", "A green ZenFlow mark on a dark background");
    await expect(restoredImage).toHaveAttribute("loading", "eager");
    await expect
      .poll(() =>
        restoredImage.evaluate((image) => {
          const photo = image as HTMLImageElement;
          return photo.complete && photo.naturalWidth > 0;
        })
      )
      .toBe(true);
    const restoredImageResolution = await restoredImage.evaluate((image) => {
      const photo = image as HTMLImageElement;
      return {
        naturalWidth: photo.naturalWidth,
        requiredDevicePixels: Math.ceil(
          photo.getBoundingClientRect().width * window.devicePixelRatio
        ),
      };
    });
    expect(restoredImageResolution.naturalWidth).toBeGreaterThanOrEqual(
      restoredImageResolution.requiredDevicePixels
    );
    const restoredImageStats = await sharp(await restoredImage.screenshot()).stats();
    expect(restoredImageStats.entropy).toBeGreaterThan(1);

    const firstViewingSurface = page.locator('[data-journal-mobile-view="viewing"]');
    await page.getByRole("button", { name: /^Edit$/i }).click();
    await expect(firstViewingSurface).toBeHidden();
    await expect(page.getByRole("button", { name: /^Edit$/i })).toHaveCount(0);
    const editablePhoto = page.locator("[data-floating-photo-id]").first();
    await expect(editablePhoto).toBeVisible({ timeout: 20_000 });
    await editablePhoto.focus();
    await editablePhoto.press("Shift+F10");
    await page.getByRole("menuitem", { name: /^Return photo to gallery$/i }).click();
    await expect(page.locator("[data-floating-photo-id]")).toHaveCount(0);
    const firstEditor = page.getByTestId("journal-entry-editor");
    await expect(
      firstEditor.getByRole("button", { name: /^Open photo\. Photo 1 of 1$/i })
    ).toBeVisible();
    await firstEditor.getByRole("button", { name: /^Save$/i }).click();
    await expect(page.getByTestId("journal-entry-editor")).toHaveCount(0, { timeout: 30_000 });

    await page.reload({ waitUntil: "load" });
    await waitForStyledDiaryShell(page);
    await page.getByText(entryText).click();
    await expect(page.getByTestId("readonly-floating-media-layer")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Open photo\. Photo 1 of 1$/i })).toBeVisible();

    const returned = await page.evaluate(async (expectedText) => {
      const request = indexedDB.open("ZenFlowDB");
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onerror = () =>
          reject(new Error(request.error?.message || "IndexedDB open failed"));
        request.onsuccess = () => resolve(request.result);
      });
      const rows = await new Promise<
        Array<{
          content?: string;
          photoIds?: string[];
          photoLayout?: Record<
            string,
            {
              x: number;
              y: number;
              width: number;
              description?: string;
              inGallery?: boolean;
            }
          >;
        }>
      >((resolve, reject) => {
        const getAll = db
          .transaction("journalEntries", "readonly")
          .objectStore("journalEntries")
          .getAll();
        getAll.onsuccess = () => resolve(getAll.result);
        getAll.onerror = () => reject(new Error(getAll.error?.message || "IndexedDB read failed"));
      });
      const entry = rows.find((row) => row.content?.includes(expectedText));
      const photoId = entry?.photoIds?.[0];
      const photo = photoId
        ? await new Promise<unknown>((resolve, reject) => {
            const get = db
              .transaction("journalPhotos", "readonly")
              .objectStore("journalPhotos")
              .get(photoId);
            get.onsuccess = () => resolve(get.result);
            get.onerror = () =>
              reject(new Error(get.error?.message || "IndexedDB photo read failed"));
          })
        : null;
      db.close();
      return {
        photoId,
        layout: photoId ? entry?.photoLayout?.[photoId] : undefined,
        mediaStillPresent: Boolean(photo),
      };
    }, entryText);
    expect(returned.photoId).toBe(persisted?.photoId);
    expect(returned.layout).toEqual({
      x: 58,
      y: 54,
      width: 200,
      description: "A green ZenFlow mark on a dark background",
      inGallery: true,
    });
    expect(returned.mediaStillPresent).toBe(true);

    await page.getByRole("button", { name: /^Edit$/i }).click();
    const secondEditor = page.getByTestId("journal-entry-editor");
    const galleryPhoto = secondEditor.getByRole("button", { name: /^Open photo\. Photo 1 of 1$/i });
    await expect(galleryPhoto).toBeVisible({ timeout: 20_000 });
    await secondEditor.getByRole("button", { name: /^Place on page$/i }).click();
    const rePlacedPhoto = secondEditor.locator("[data-floating-photo-id]").first();
    await expect
      .poll(() =>
        rePlacedPhoto.evaluate((element) => ({
          left: (element as HTMLElement).style.left,
          top: (element as HTMLElement).style.top,
          width: (element as HTMLElement).style.width,
        }))
      )
      .toEqual({ left: "58%", top: "54%", width: "200px" });
    await rePlacedPhoto.focus();
    await rePlacedPhoto.press("Shift+F10");
    await page.getByRole("menuitem", { name: /^Return photo to gallery$/i }).click();
    await expect(galleryPhoto).toBeVisible();
    await galleryPhoto
      .locator("..")
      .getByRole("button", { name: /^Delete$/i })
      .click();
    await expect(galleryPhoto).toHaveCount(0);
    await secondEditor.getByRole("button", { name: /^Save$/i }).click();
    await expect(page.getByTestId("journal-entry-editor")).toHaveCount(0, { timeout: 30_000 });

    await page.reload({ waitUntil: "load" });
    await waitForStyledDiaryShell(page);
    await page.getByText(entryText).click();
    await expect(page.getByRole("button", { name: /^Open photo\./i })).toHaveCount(0);
    await expect(page.getByTestId("readonly-floating-media-layer")).toHaveCount(0);

    const removed = await page.evaluate(
      async ({ expectedText, photoId }) => {
        const request = indexedDB.open("ZenFlowDB");
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          request.onerror = () =>
            reject(new Error(request.error?.message || "IndexedDB open failed"));
          request.onsuccess = () => resolve(request.result);
        });
        const entries = await new Promise<
          Array<{ content?: string; photoIds?: string[]; photoLayout?: Record<string, unknown> }>
        >((resolve, reject) => {
          const getAll = db
            .transaction("journalEntries", "readonly")
            .objectStore("journalEntries")
            .getAll();
          getAll.onsuccess = () => resolve(getAll.result);
          getAll.onerror = () =>
            reject(new Error(getAll.error?.message || "IndexedDB read failed"));
        });
        const entry = entries.find((row) => row.content?.includes(expectedText));
        const photo = photoId
          ? await new Promise<unknown>((resolve, reject) => {
              const get = db
                .transaction("journalPhotos", "readonly")
                .objectStore("journalPhotos")
                .get(photoId);
              get.onsuccess = () => resolve(get.result);
              get.onerror = () =>
                reject(new Error(get.error?.message || "IndexedDB photo read failed"));
            })
          : null;
        db.close();
        return {
          photoIds: entry?.photoIds ?? [],
          layoutKeys: Object.keys(entry?.photoLayout ?? {}),
          mediaStillPresent: Boolean(photo),
        };
      },
      { expectedText: entryText, photoId: persisted?.photoId ?? null }
    );
    expect(removed).toEqual({ photoIds: [], layoutKeys: [], mediaStillPresent: false });
  });

  test("reflows the diary controls with large text and WCAG text spacing", async ({ page }) => {
    await page.addStyleTag({
      content: `
        :root { --font-scale: 2 !important; }
        * { letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
        p { line-height: 1.5 !important; margin-bottom: 2em !important; }
      `,
    });

    for (const testId of [
      "journal-mobile-app-nav-menu",
      "journal-mobile-diary-sidebar-trigger",
      "journal-mobile-entry",
      "journal-mobile-stats",
      "journal-mobile-favorites",
      "journal-mobile-settings",
    ]) {
      await expect(page.getByTestId(testId)).toBeVisible();
    }

    const geometry = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(geometry.scrollWidth - geometry.clientWidth).toBeLessThanOrEqual(1);
    expect(geometry.clientWidth).toBe(geometry.viewportWidth);

    await page.getByTestId("journal-mobile-diary-sidebar-trigger").click();
    await expect(page.getByTestId("journal-mobile-diary-sidebar-close")).toBeVisible();
    await expectFocusInsideMobileDiarySidebar(page);
  });

  test("keeps today fully visible inside the calendar strip at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    const todayButton = page.locator('button[aria-current="date"]:visible').first();
    await expect(todayButton).toBeVisible({ timeout: 20_000 });

    await expect
      .poll(
        () =>
          todayButton.evaluate((button) => {
            const buttonRect = button.getBoundingClientRect();
            const stripRect = button.parentElement?.getBoundingClientRect();
            if (!stripRect) return false;
            return buttonRect.left >= stripRect.left - 1 && buttonRect.right <= stripRect.right + 1;
          }),
        { message: "today settles fully inside the responsive calendar strip", timeout: 5_000 }
      )
      .toBe(true);
  });

  test("keeps the current seven-day window fully visible at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const todayButton = page.locator('button[aria-current="date"]:visible').first();
    await expect(todayButton).toBeVisible({ timeout: 20_000 });

    await expect
      .poll(
        () =>
          todayButton.evaluate((button) => {
            const strip = button.parentElement;
            if (!strip) return false;
            const stripRect = strip.getBoundingClientRect();
            const stripStyle = getComputedStyle(strip);
            const contentLeft = stripRect.left + Number.parseFloat(stripStyle.paddingLeft || "0");
            const contentRight =
              stripRect.right - Number.parseFloat(stripStyle.paddingRight || "0");
            const currentWindow = Array.from(strip.children).slice(-7);
            const visibleDays = Array.from(strip.children).filter((day) => {
              const rect = day.getBoundingClientRect();
              return rect.right > contentLeft + 1 && rect.left < contentRight - 1;
            });
            return (
              currentWindow.length === 7 &&
              visibleDays.length === 7 &&
              currentWindow.every((day) => {
                const rect = day.getBoundingClientRect();
                return rect.left >= contentLeft - 1 && rect.right <= contentRight + 1;
              })
            );
          }),
        { message: "the current seven-day window fits without clipped dates", timeout: 5_000 }
      )
      .toBe(true);
  });
});
