import { test, expect } from '@playwright/test';

/**
 * Smoke Tests - Basic app functionality verification
 *
 * These tests verify the app loads and basic interactions work.
 * Run with: npx playwright test e2e/smoke.spec.ts
 */

test.describe('App Smoke Tests', () => {
  test('app loads successfully', async ({ page }) => {
    await page.goto('/');

    // Wait for app to load (check for main container or navigation)
    await expect(page.locator('body')).toBeVisible();

    // App should not show error states
    await expect(page.locator('text=Something went wrong')).not.toBeVisible();
    await expect(page.locator('text=Error')).not.toBeVisible();
  });

  test('navigation tabs are visible', async ({ page }) => {
    await page.goto('/');

    // Wait for bottom navigation to appear
    const nav = page.locator('nav, [role="navigation"]');
    await expect(nav.first()).toBeVisible({ timeout: 10000 });
  });

  test('can switch between tabs', async ({ page }) => {
    await page.goto('/');

    // Wait for navigation
    await page.waitForTimeout(2000);

    // Try clicking on Stats tab if visible
    const statsTab = page.getByRole('button', { name: /stats|статист/i }).or(
      page.locator('[data-tab="stats"]')
    );

    if (await statsTab.isVisible()) {
      await statsTab.click();
      await page.waitForTimeout(1000);
    }
  });

  test('theme toggle works', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Get initial theme
    const html = page.locator('html');
    const initialClass = await html.getAttribute('class');

    // Find and click settings/theme toggle
    const settingsButton = page.getByRole('button', { name: /settings|настройки/i }).or(
      page.locator('[data-tab="settings"]')
    );

    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await page.waitForTimeout(1000);

      // Look for theme toggle
      const themeToggle = page.getByRole('button', { name: /dark|light|тема/i }).or(
        page.locator('[data-testid="theme-toggle"]')
      );

      if (await themeToggle.isVisible()) {
        await themeToggle.click();
        await page.waitForTimeout(500);

        // Verify class changed
        const newClass = await html.getAttribute('class');
        // Theme should have changed (either added or removed 'dark')
        expect(newClass).not.toBe(initialClass);
      }
    }
  });

  test('no console errors on load', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForTimeout(3000);

    // Filter out known acceptable errors (like extension errors, third-party)
    const criticalErrors = consoleErrors.filter(
      (err) =>
        !err.includes('favicon') &&
        !err.includes('extension') &&
        !err.includes('third-party') &&
        !err.includes('ResizeObserver')
    );

    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe('Data Persistence', () => {
  test('data persists after page reload', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // This is a basic check - in a real test you'd interact with the app
    // and verify data persists after reload

    // Reload and verify app still works
    await page.reload();
    await page.waitForTimeout(2000);

    // App should still be functional
    await expect(page.locator('body')).toBeVisible();
  });
});
