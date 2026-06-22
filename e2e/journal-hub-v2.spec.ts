import { expect, test } from "@playwright/test";

import { primeZenflowV2, v2RoutePath } from "./helpers/zenflowV2State";

const MIN_TOUCH_TARGET_PX = 44;
const TOUCH_TARGET_EPSILON_PX = 0.01;

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
        { message: "styled diary shell has applied touch-target CSS", timeout: 8_000 },
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
          return Boolean(drawer && document.activeElement && drawer.contains(document.activeElement));
        }),
      { message: "keyboard focus remains inside the mobile diary sidebar", timeout: 3_000 },
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
      { message: "keyboard focus remains inside the mobile diary settings sheet", timeout: 3_000 },
    )
    .toBe(true);
}

async function expectEntryWriteActionVisible(page: import("@playwright/test").Page) {
  await expect(
    page
      .getByTestId("journal-entry-main-fab")
      .or(page.getByRole("button", { name: /^New Entry$/i }))
      .or(page.getByTestId("journal-capture-launcher"))
      .first(),
  ).toBeVisible({ timeout: 30_000 });
}

async function openNewJournalEntry(page: import("@playwright/test").Page) {
  const mainFab = page.getByTestId("journal-entry-main-fab");
  await expect(mainFab).toBeVisible({ timeout: 30_000 });
  await mainFab.click();

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

async function seedFavoriteJournalEntry(page: import("@playwright/test").Page) {
  await page.evaluate(async () => {
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
      tags: ["favorite"],
      createdAt: now,
      updatedAt: now,
    });

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error(tx.error?.message || "IndexedDB write failed"));
      tx.onabort = () => reject(new Error(tx.error?.message || "IndexedDB write aborted"));
    });
    db.close();
  });

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

  test("keeps the diary first screen clean and moves the portal behind the stats button", async ({ page }) => {
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
    await expect(page.getByTestId("journal-mobile-diary-sidebar").getByTestId("journal-mobile-diary-sidebar-calendar")).toBeVisible();
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

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
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
            .evaluate((element) => Number.parseFloat(window.getComputedStyle(element).paddingBottom)),
        { message: "memory portal applies Android navigation reserve", timeout: 4_000 },
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
            { message: `${id} touch target reaches ${MIN_TOUCH_TARGET_PX}px`, timeout: 4_000 },
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

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
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
    await expect(page.getByTestId("journal-mobile-section-toolbar")).toHaveAttribute("role", "toolbar");
    await expect(page.getByTestId("journal-mobile-entry")).toBeVisible();
    await expect(page.getByTestId("journal-mobile-stats")).toBeVisible();
    await expect(page.getByTestId("journal-mobile-favorites")).toBeVisible();
    await expect(page.getByTestId("journal-mobile-settings")).toBeVisible();
    await expect(page.getByTestId("journal-mobile-entry")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("journal-mobile-favorites")).toHaveAttribute("aria-pressed", "false");

    await page.getByTestId("journal-mobile-favorites").click();
    await expect(page.getByTestId("journal-favorites-panel")).toBeVisible();
    await expect(page.getByTestId("journal-favorites-panel")).toContainText("Favorites");
    await expect(page.getByTestId("journal-mobile-entry")).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("journal-mobile-favorites")).toHaveAttribute("aria-pressed", "true");

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

  test("returns focus to the stable diary panel trigger after settings opens from the diary sidebar", async ({ page }) => {
    const diaryPanelTrigger = page.getByTestId("journal-mobile-diary-sidebar-trigger");
    await expect(diaryPanelTrigger).toBeVisible();
    await diaryPanelTrigger.click();

    const drawer = page.getByTestId("journal-mobile-diary-sidebar");
    await expect(drawer).toBeVisible();
    await drawer.getByRole("button", { name: "Settings" }).click();

    const settingsDialog = page.getByRole("dialog", { name: /diary settings/i });
    await expect(settingsDialog).toBeVisible({ timeout: 20_000 });
    await expect(drawer).toHaveCount(0);

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
    await expect(page.getByTestId("journal-mobile-favorites")).toHaveAttribute("aria-pressed", "true");

    await page.getByTestId("journal-mobile-settings").click();
    const settingsSheet = page.getByTestId("journal-mobile-settings-panel");
    await expect(settingsSheet).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("journal-mobile-settings")).toHaveAttribute("aria-pressed", "true");

    await page.getByTestId("journal-mobile-settings-close").click();

    await expect(settingsSheet).toHaveCount(0);
    await expect(page.getByTestId("journal-favorites-panel")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("journal-mobile-favorites")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("journal-mobile-entry")).toHaveAttribute("aria-pressed", "false");
  });

  test("favorites tab opens a saved favorite entry", async ({ page }) => {
    await seedFavoriteJournalEntry(page);

    await page.getByTestId("journal-mobile-favorites").click();
    const favoritesPanel = page.getByTestId("journal-favorites-panel");
    await expect(favoritesPanel).toBeVisible();
    await expect(favoritesPanel.getByRole("button", { name: /Favorite mountain note/i })).toBeVisible();
    await expect(favoritesPanel).toContainText("A saved reflection that should return from Favorites.");
    await expect(favoritesPanel).not.toContainText("<p>");
    await expect(favoritesPanel).not.toContainText("<strong>");

    await favoritesPanel.getByRole("button", { name: /Favorite mountain note/i }).click();
    await expect(page.getByText("Favorite mountain note")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("A saved reflection that should return from Favorites.")).toBeVisible();

    await page.getByRole("button", { name: /back/i }).click();
    await expect(page.getByTestId("journal-favorites-panel")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("journal-mobile-favorites")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("journal-mobile-entry")).toHaveAttribute("aria-pressed", "false");
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

  test("plus menu opens the real gratitude scene and editor has no mood slider", async ({ page }) => {
    await openNewJournalEntry(page);
    const editor = page.locator("[contenteditable='true']");
    await expect(editor).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("[role='slider'][aria-label='Mood']")).toHaveCount(0);
    await editor.fill("Seed entry for the gratitude speed dial.");
    await page.getByRole("button", { name: /^(save|зберегти|guardar|speichern|保存|حفظ|שמור)$/i }).click();

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
        { message: "space mode settles near the top of the phone viewport", timeout: 5_000 },
      )
      .toBeLessThan(260);
    await page.getByTestId("journal-space-add-entry").click();
    const folderEditor = page.locator("[contenteditable='true']");
    await expect(folderEditor).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("#Roadmap")).toBeVisible();
    await expect(page.locator("[role='slider'][aria-label='Mood']")).toHaveCount(0);
    await folderEditor.fill("Roadmap context stays in its folder.");
    await page.getByRole("button", { name: /^(save|зберегти|guardar|speichern|保存|حفظ|שמור)$/i }).click();
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
    await page.getByRole("button", { name: /^(save|зберегти|guardar|speichern|保存|حفظ|שמור)$/i }).click();

    await expect(page.getByText("A sensitive private preview should disappear.")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("journal-mobile-settings").click();
    await expect(page.getByRole("dialog", { name: /diary settings/i })).toBeVisible();
    await page.getByRole("switch", { name: /hide previews/i }).click();
    await page.getByRole("button", { name: /^close$/i }).click();

    await expect(page.locator("[contenteditable='true']")).toHaveCount(0);
    await expect(page.getByText("A sensitive private preview should disappear.")).toHaveCount(0);

    await page.getByTestId("journal-mobile-favorites").click();
    const favoritesPanel = page.getByTestId("journal-favorites-panel");
    await expect(favoritesPanel).toBeVisible();
    await expect(favoritesPanel).toContainText(/Private entry|Unlock private mode/i);
    await expect(favoritesPanel).not.toContainText("Favorite mountain note");
    await expect(favoritesPanel).not.toContainText("A saved reflection that should return from Favorites.");
  });
});
