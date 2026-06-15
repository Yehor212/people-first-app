/**
 * Phase 3-A.4c-ii-d-c Task #39 TAKE 2 — Runtime computed-style verification
 *
 * Purpose: Prove that paper/ink/oled theme tokens in themes.css actually reach
 * SidebarV2/DrawerV2/MobileNavV2 consumers at RUNTIME, not just file-level.
 *
 * Task #41 test-engineer empirically proved TAKE 1 failed because
 * Tailwind's `@layer base` declared AFTER `@layer theme` (via @import order)
 * won per CSS Cascade Level 5 — paper-white --card leaked into ink/oled.
 *
 * TAKE 2 fix: ink/oled blocks lifted OUT of @layer theme → un-layered rules
 * win over any @layer. This spec proves it works via getComputedStyle().
 */
import { test, expect } from '@playwright/test';

test.describe('theme tokens runtime cascade', () => {
  test('ink theme exposes aurora raised --card, not paper white', async ({
    page,
  }) => {
    await page.goto('./');

    const inkCard = await page.evaluate(() => {
      document.documentElement.dataset.theme = 'ink';
      return getComputedStyle(document.documentElement)
        .getPropertyValue('--card')
        .trim();
    });

    expect(inkCard).toBe('178 18% 13%');
  });

  test('ink theme --background is aurora dark', async ({ page }) => {
    await page.goto('./');

    const inkBg = await page.evaluate(() => {
      document.documentElement.dataset.theme = 'ink';
      return getComputedStyle(document.documentElement)
        .getPropertyValue('--background')
        .trim();
    });

    expect(inkBg).toBe('176 38% 5%');
  });

  test('oled theme exposes pure black --background (0 0% 0%)', async ({
    page,
  }) => {
    await page.goto('./');

    const oledBg = await page.evaluate(() => {
      document.documentElement.dataset.theme = 'oled';
      return getComputedStyle(document.documentElement)
        .getPropertyValue('--background')
        .trim();
    });

    expect(oledBg).toBe('0 0% 0%');
  });

  test('oled theme --card uses the shared raised dark surface', async ({
    page,
  }) => {
    await page.goto('./');

    const oledCard = await page.evaluate(() => {
      document.documentElement.dataset.theme = 'oled';
      return getComputedStyle(document.documentElement)
        .getPropertyValue('--card')
        .trim();
    });

    expect(oledCard).toBe('178 18% 13%');
  });

  test('paper theme exposes the solar prism --card surface', async ({
    page,
  }) => {
    await page.goto('./');

    const paperCard = await page.evaluate(() => {
      document.documentElement.dataset.theme = 'paper';
      return getComputedStyle(document.documentElement)
        .getPropertyValue('--card')
        .trim();
    });

    expect(paperCard).toBe('158 42% 90%');
  });
});
