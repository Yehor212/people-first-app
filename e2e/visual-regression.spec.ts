import { test, expect } from '@playwright/test';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };
const FROZEN_HOME_TIME = new Date('2026-04-16T20:00:00-05:00');

test.use({ timezoneId: 'America/Chicago' });
test.setTimeout(120000);

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FROZEN_HOME_TIME);
  await page.addInitScript((appVersion: string) => {
    localStorage.setItem('zenflow-language-selected', JSON.stringify(true));
    localStorage.setItem('zenflow-google-auth-checked', JSON.stringify(true));
    localStorage.setItem('zenflow-tutorial-complete', JSON.stringify(true));
    localStorage.setItem('zenflow-onboarding-complete', JSON.stringify(true));
    localStorage.setItem('zenflow-notification-permission-checked', JSON.stringify(true));
    localStorage.setItem('zenflow-privacy', JSON.stringify({ noTracking: false, analytics: false, consentShown: true }));
    localStorage.setItem('zenflow_onboarding_state', JSON.stringify({
      isNewUser: false, hasSeenWelcome: true, firstLoginDate: Date.now(), daysActive: 5,
      lastActiveDate: new Date().toISOString().split('T')[0], unlockedFeatures: []
    }));
    localStorage.setItem('zenflow_last_active', new Date().toISOString().split('T')[0]);
    localStorage.setItem('zenflow-last-weekly-report', new Date().toISOString());
    localStorage.setItem('zenflow_last_seen_version', appVersion);
  }, packageJson.version);
});

async function waitForApp(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const nav = page.locator('[role="navigation"]');
  await expect(nav.first()).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(2000);
}

async function disableAnimations(page: import('@playwright/test').Page) {
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation-duration: 0s !important; animation-delay: 0s !important;
      transition-duration: 0s !important; transition-delay: 0s !important;
    }`,
  });
  await page.waitForTimeout(500);
}

test.describe('Light Theme', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { localStorage.setItem('zenflow-theme', 'light'); });
  });
  test('home tab - light', async ({ page }) => {
    await waitForApp(page); await disableAnimations(page);
    await expect(page).toHaveScreenshot('home-light.png', { maxDiffPixelRatio: 0.01, fullPage: false });
  });
  test('stats tab - light', async ({ page }) => {
    await waitForApp(page); await disableAnimations(page);
    await page.locator('button[role="tab"]').nth(3).click(); await page.waitForTimeout(1500);
    await expect(page).toHaveScreenshot('stats-light.png', { maxDiffPixelRatio: 0.01, fullPage: false });
  });
  test('settings tab - light', async ({ page }) => {
    await waitForApp(page); await disableAnimations(page);
    await page.locator('button[role="tab"]').nth(4).click(); await page.waitForTimeout(1500);
    await expect(page).toHaveScreenshot('settings-light.png', { maxDiffPixelRatio: 0.01, fullPage: false });
  });
});

test.describe('Dark Theme', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { localStorage.setItem('zenflow-theme', 'dark'); });
  });
  test('home tab - dark', async ({ page }) => {
    await waitForApp(page); await disableAnimations(page);
    await expect(page).toHaveScreenshot('home-dark.png', { maxDiffPixelRatio: 0.01, fullPage: false });
  });
  test('stats tab - dark', async ({ page }) => {
    await waitForApp(page); await disableAnimations(page);
    await page.locator('button[role="tab"]').nth(3).click(); await page.waitForTimeout(1500);
    await expect(page).toHaveScreenshot('stats-dark.png', { maxDiffPixelRatio: 0.01, fullPage: false });
  });
  test('settings tab - dark', async ({ page }) => {
    await waitForApp(page); await disableAnimations(page);
    await page.locator('button[role="tab"]').nth(4).click(); await page.waitForTimeout(1500);
    await expect(page).toHaveScreenshot('settings-dark.png', { maxDiffPixelRatio: 0.01, fullPage: false });
  });
});

test.describe('RTL Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('zenflow-theme', 'light');
      localStorage.setItem('zenflow-language', '"he"');
    });
  });
  test('home tab - RTL', async ({ page }) => {
    await waitForApp(page); await disableAnimations(page);
    await expect(page).toHaveScreenshot('home-rtl.png', { maxDiffPixelRatio: 0.02, fullPage: false });
  });
  test('settings tab - RTL', async ({ page }) => {
    await waitForApp(page); await disableAnimations(page);
    await page.locator('button[role="tab"]').nth(4).click(); await page.waitForTimeout(1500);
    await expect(page).toHaveScreenshot('settings-rtl.png', { maxDiffPixelRatio: 0.02, fullPage: false });
  });
});

test.describe('Reduced Motion', () => {
  test('respects prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => { localStorage.setItem('zenflow-theme', 'light'); });
    await waitForApp(page);
    const animatedElements = await page.evaluate(() => {
      const all = document.querySelectorAll('*');
      let animating = 0;
      for (const el of all) {
        const style = getComputedStyle(el);
        if (style.animationName !== 'none' && style.animationDuration !== '0s') animating++;
      }
      return animating;
    });
    expect(animatedElements).toBeLessThan(5);
    await expect(page).toHaveScreenshot('home-reduced-motion.png', { maxDiffPixelRatio: 0.02, fullPage: false });
  });
});
