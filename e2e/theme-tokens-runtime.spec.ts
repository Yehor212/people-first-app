/**
 * Phase 3-A.4c-ii-d-c Task #39 TAKE 2 — Runtime computed-style verification
 *
 * Purpose: Prove that ink/oled theme tokens in themes.css actually reach
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
  test('ink theme exposes warm brown --card (34 4% 18%), not paper white', async ({
    page,
  }) => {
    await page.goto('/');

    const inkCard = await page.evaluate(() => {
      document.documentElement.dataset.theme = 'ink';
      return getComputedStyle(document.documentElement)
        .getPropertyValue('--card')
        .trim();
    });

    expect(inkCard).toBe('34 4% 18%');
  });

  test('ink theme --background is warm dark (30 3% 11%)', async ({ page }) => {
    await page.goto('/');

    const inkBg = await page.evaluate(() => {
      document.documentElement.dataset.theme = 'ink';
      return getComputedStyle(document.documentElement)
        .getPropertyValue('--background')
        .trim();
    });

    expect(inkBg).toBe('30 3% 11%');
  });

  test('oled theme exposes pure black --background (0 0% 0%)', async ({
    page,
  }) => {
    await page.goto('/');

    const oledBg = await page.evaluate(() => {
      document.documentElement.dataset.theme = 'oled';
      return getComputedStyle(document.documentElement)
        .getPropertyValue('--background')
        .trim();
    });

    expect(oledBg).toBe('0 0% 0%');
  });

  test('oled theme --card is ink-like raised surface (30 3% 11%)', async ({
    page,
  }) => {
    await page.goto('/');

    const oledCard = await page.evaluate(() => {
      document.documentElement.dataset.theme = 'oled';
      return getComputedStyle(document.documentElement)
        .getPropertyValue('--card')
        .trim();
    });

    expect(oledCard).toBe('30 3% 11%');
  });

  test('paper theme falls back to Tailwind base default --card (0 0% 100%)', async ({
    page,
  }) => {
    await page.goto('/');

    const paperCard = await page.evaluate(() => {
      document.documentElement.dataset.theme = 'paper';
      return getComputedStyle(document.documentElement)
        .getPropertyValue('--card')
        .trim();
    });

    // Paper theme does NOT override shadcn --card (intentional — Option A
    // non-disruptive). It only sets --zen-* tokens. Tailwind base default
    // (0 0% 100%) stays visible. This verifies paper regression absence.
    expect(paperCard).toBe('0 0% 100%');
  });
});
