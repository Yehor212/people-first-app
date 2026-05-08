import { expect, test } from "@playwright/test";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };

async function primeApp(page: import("@playwright/test").Page) {
  await page.addInitScript(({ appVersion }: { appVersion: string }) => {
    localStorage.setItem("zenflow-language-selected", JSON.stringify(true));
    localStorage.setItem("zenflow-google-auth-checked", JSON.stringify(true));
    localStorage.setItem("zenflow-tutorial-complete", JSON.stringify(true));
    localStorage.setItem("zenflow-onboarding-complete", JSON.stringify(true));
    localStorage.setItem("zenflow-notification-permission-checked", JSON.stringify(true));
    localStorage.setItem(
      "zenflow_onboarding_state",
      JSON.stringify({
        isNewUser: false,
        hasSeenWelcome: true,
        firstLoginDate: Date.now(),
        daysActive: 5,
        lastActiveDate: new Date().toISOString().split("T")[0],
        unlockedFeatures: [],
      })
    );
    localStorage.setItem("zenflow_last_seen_version", appVersion);
    localStorage.setItem(
      "zenflow:theme-v0c",
      JSON.stringify({ state: { theme: "ink" }, version: 0 })
    );
    localStorage.setItem(
      "zenflow-privacy",
      JSON.stringify({ noTracking: false, analytics: false, consentShown: true })
    );
    localStorage.setItem("zenflow-privacy-acknowledged", JSON.stringify(true));
    localStorage.setItem("zenflow-orb-first-run-dismissed", "1");
  }, { appVersion: packageJson.version });
}

test.describe("Journal V2 memory portal", () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ page }) => {
    await primeApp(page);
    await page.setViewportSize({ width: 399, height: 869 });
    await page.goto("diary?nav=v2&dev=true&navLayout=phone");
    await page.waitForLoadState("domcontentloaded");
  });

  test("keeps the diary first screen clean and moves the portal behind the stats button", async ({ page }) => {
    await expect(page.getByTestId("journal-mobile-stats")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("memory-portal-canvas")).toHaveCount(0);
    await expect(page.getByTestId("journal-hub-shell")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Tools$/i })).toHaveCount(0);
    await expect(page.getByTestId("nav-v2-open-drawer")).toBeHidden();

    const headerMenu = page.getByTestId("journal-mobile-nav-menu");
    await expect(headerMenu).toBeVisible();
    const headerMenuBox = await headerMenu.boundingBox();
    expect(headerMenuBox).not.toBeNull();
    if (headerMenuBox) {
      expect(headerMenuBox.width).toBeGreaterThanOrEqual(44);
      expect(headerMenuBox.height).toBeGreaterThanOrEqual(44);
    }

    for (const id of ["journal-mobile-nav-menu", "journal-mobile-stats", "journal-mobile-settings"]) {
      const target = page.getByTestId(id);
      const before = await target.boundingBox();
      expect(before).not.toBeNull();
      if (!before) continue;

      await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
      await page.mouse.down();
      const pressed = await target.boundingBox();
      await page.mouse.move(1, 1);
      await page.mouse.up();

      expect(pressed).not.toBeNull();
      if (!pressed) continue;
      expect(Math.abs(pressed.x - before.x)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(pressed.y - before.y)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(pressed.width - before.width)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(pressed.height - before.height)).toBeLessThanOrEqual(0.5);
    }

    await headerMenu.click();
    await expect(page.getByTestId("drawer-v2")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("drawer-v2")).toHaveCount(0);

    await page.getByTestId("journal-mobile-stats").click();
    await expect(page.getByTestId("memory-portal-canvas")).toBeVisible();
    await expect(page.getByTestId("memory-portal-day-capsule-button")).toHaveCount(0);
    await expect(page.getByTestId("memory-portal-action-toggle")).toHaveCount(0);

    const core = page.getByTestId("memory-portal-core");
    await expect(core).toBeVisible();

    const coreBox = await core.boundingBox();
    expect(coreBox).not.toBeNull();
    if (coreBox) {
      expect(coreBox.width).toBeGreaterThanOrEqual(44);
      expect(coreBox.height).toBeGreaterThanOrEqual(44);
    }

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("keeps portal controls clear of compact Android navigation reserve", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.addStyleTag({ content: ":root { --zenflow-test-nav-inset-bottom: 48px; }" });
    await page.getByTestId("journal-mobile-stats").click();
    await expect(page.getByTestId("memory-portal-canvas")).toBeVisible({ timeout: 30_000 });

    const safePadding = await page
      .getByTestId("memory-portal-canvas")
      .evaluate((element) => Number.parseFloat(window.getComputedStyle(element).paddingBottom));
    expect(safePadding).toBeGreaterThanOrEqual(48);

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
        const box = await page.getByTestId(id).boundingBox();
        expect(box).not.toBeNull();
        if (!box) continue;

        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
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
    await expect(page.getByTestId("memory-portal-scene-burn")).toHaveCount(0);

    await page.getByTestId("memory-portal-core").click();
    await expect(page.locator("[contenteditable='true']")).toBeVisible({ timeout: 20_000 });
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
    await page.getByRole("button", { name: /start your story|почни|новий запис/i }).click();
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
      expect(spaceSwitcherBox.height).toBeGreaterThanOrEqual(44);
      expect(spaceSwitcherBox.x).toBeLessThan(96);
    }

    await spaceSwitcher.click();
    await expect(page.getByTestId("journal-spaces-sheet")).toBeVisible();
    await expect(page.getByTestId("journal-space-option-space-all")).toBeVisible();
    await page.getByTestId("journal-space-option-space-projects").click();
    await expect(page.getByTestId("journal-spaces-sheet")).toHaveCount(0);
    await expect(page.getByTestId("journal-space-mode")).toBeVisible();
    await expect(page.getByTestId("journal-space-mode-title")).toContainText(/projects|проєкти/i);
    const modeBox = await page.getByTestId("journal-space-mode").boundingBox();
    expect(modeBox).not.toBeNull();
    if (modeBox) expect(modeBox.y).toBeLessThan(260);
    await expect(page.getByTestId("journal-capture-studio")).toBeVisible();
    await expect(page.getByTestId("journal-capture-field-0")).toBeVisible();
    await expect(page.getByTestId("journal-capture-field-1")).toHaveCount(0);
    await page.getByTestId("journal-capture-field-0").fill("Project context stays in the space first.");
    await page.getByTestId("journal-capture-next").click();
    await expect(page.getByTestId("journal-capture-field-1")).toBeVisible();
    await page.getByTestId("journal-capture-field-1").fill("Decision stays inside the project room.");
    await page.getByTestId("journal-capture-save").click();
    await expect(page.getByTestId("journal-capture-board-card")).toBeVisible();
    await expect(page.locator("[contenteditable='true']")).toHaveCount(0);
    await expect(page.getByTestId("journal-capture-open-editor")).toBeVisible();
    await page.getByTestId("journal-space-mode-exit").click();
    await expect(page.getByTestId("journal-space-mode")).toHaveCount(0);
    await spaceSwitcher.click();
    await expect(page.getByTestId("journal-spaces-sheet")).toBeVisible();
    await page.getByTestId("journal-space-create-toggle").click();
    await page.getByTestId("journal-space-name-input").fill("Roadmap");
    await page.getByTestId("journal-space-create-submit").click();
    await expect(page.getByTestId("journal-spaces-sheet")).toHaveCount(0);
    await expect(page.getByTestId("journal-space-mode")).toBeVisible();
    await expect(page.getByTestId("journal-space-mode-title")).toContainText("Roadmap");
    await page.getByTestId("journal-space-mode-exit").click();
    await expect(page.getByTestId("journal-space-mode")).toHaveCount(0);

    await expect(page.getByTestId("journal-entry-main-fab")).toBeVisible({ timeout: 30_000 });

    await page.getByTestId("journal-entry-main-fab").click();
    await expect(page.getByTestId("journal-fab-action-gratitude")).toBeVisible();
    await page.getByTestId("journal-fab-action-gratitude").click();
    await expect(page.getByTestId("journal-quick-gratitude-scene")).toBeVisible();
    await expect(page.getByTestId("journal-quick-gratitude-scene").locator("textarea")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("journal-quick-gratitude-scene")).toHaveCount(0);

    await page.getByTestId("journal-entry-main-fab").click();
    await page.getByTestId("journal-fab-action-primary").click();
    await expect(page.locator("[contenteditable='true']")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("[role='slider'][aria-label='Mood']")).toHaveCount(0);
  });

  test("private space keeps captures masked until the user reveals them", async ({ page }) => {
    await page.getByRole("button", { name: /start your story|почни|новий запис/i }).click();
    const editor = page.locator("[contenteditable='true']");
    await expect(editor).toBeVisible({ timeout: 20_000 });
    await editor.fill("Seed entry for private space.");
    await page.getByRole("button", { name: /^(save|зберегти|guardar|speichern|保存|حفظ|שמור)$/i }).click();

    await page.getByTestId("journal-space-switcher").click();
    await page.getByTestId("journal-space-option-space-private").click();
    await expect(page.getByTestId("journal-spaces-sheet")).toHaveCount(0);
    await expect(page.getByTestId("journal-space-mode")).toBeVisible();
    await expect(page.getByTestId("journal-space-mode-title")).toContainText(/private|приват/i);

    await page.getByTestId("journal-capture-field-0").fill("A private thought should not preview in the open.");
    await page.getByTestId("journal-capture-save").click();
    await expect(page.getByTestId("journal-capture-board-card")).toBeVisible();
    await expect(page.getByTestId("journal-private-space-mask")).toBeVisible();
    await expect(page.locator("[contenteditable='true']")).toHaveCount(0);

    await page.getByTestId("journal-private-space-reveal").click();
    await expect(page.getByText("A private thought should not preview in the open.")).toBeVisible();
  });
});
