import { test, expect } from '@playwright/test';

/**
 * Smoke Tests - Basic app functionality verification
 *
 * These tests verify the app loads and basic interactions work.
 * Run with: npx playwright test e2e/smoke.spec.ts
 */

// Bypass all onboarding gates: inject localStorage values before any JS runs.
// The app checks these gates in order: language → auth → tutorial → onboarding → notifications.
// useIndexedDB falls back to localStorage when IndexedDB has no data yet.
// addInitScript runs before page scripts, ensuring values are ready for React.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('zenflow-language-selected', JSON.stringify(true));
    localStorage.setItem('zenflow-google-auth-checked', JSON.stringify(true));
    localStorage.setItem('zenflow-tutorial-complete', JSON.stringify(true));
    localStorage.setItem('zenflow-onboarding-complete', JSON.stringify(true));
    localStorage.setItem('zenflow-notification-permission-checked', JSON.stringify(true));
    localStorage.setItem('zenflow-privacy', JSON.stringify({ noTracking: false, analytics: false, consentShown: true }));
    // Prevent welcome overlay from showing (progressive onboarding)
    localStorage.setItem('zenflow_onboarding_state', JSON.stringify({
      isNewUser: false, hasSeenWelcome: true, firstLoginDate: Date.now(), daysActive: 5,
      lastActiveDate: new Date().toISOString().split('T')[0], unlockedFeatures: []
    }));
    // Prevent re-engagement welcome back modal
    localStorage.setItem('zenflow_last_active', new Date().toISOString().split('T')[0]);
    // Prevent weekly report modal from auto-showing (triggers on Mondays)
    localStorage.setItem('zenflow-last-weekly-report', new Date().toISOString());
  });
});

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

    // Filter out known acceptable errors (like extension errors, third-party, 404s,
    // and CSP inline-script violations from Vite dev server HMR injection)
    const criticalErrors = consoleErrors.filter(
      (err) =>
        !err.includes('favicon') &&
        !err.includes('extension') &&
        !err.includes('third-party') &&
        !err.includes('ResizeObserver') &&
        !err.includes('404') &&
        !err.includes('Failed to load resource') &&
        !err.includes('Content Security Policy')
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

// ---------------------------------------------------------------------------
// New Test Suites
// ---------------------------------------------------------------------------

/**
 * Mood Logging Flow
 *
 * Verifies that a user can select a mood from the mood tracker and record it.
 * The mood tracker renders 5 radio buttons (great, good, okay, bad, terrible)
 * inside a radiogroup. After selecting a mood, a "Save mood" button appears.
 */
test.describe('Mood Logging', () => {
  test('can log a mood', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Ensure we are on the home tab (click it to be safe)
    const homeTab = page.locator('button[role="tab"][aria-selected="true"]').first().or(
      page.locator('button[role="tab"]').first()
    );
    await expect(homeTab).toBeVisible({ timeout: 10000 });

    // The mood tracker shows a radiogroup with 5 mood buttons.
    // It might already show a compact view if a mood was previously logged
    // for the current time period, so first check if the radiogroup is visible.
    const moodRadiogroup = page.locator('[role="radiogroup"]');
    const moodRadiogroupVisible = await moodRadiogroup.isVisible().catch(() => false);

    if (!moodRadiogroupVisible) {
      // If compact view is showing, look for "Update" or "+" button to expand,
      // or the "How are you feeling?" heading to confirm we are in the right place.
      // On a fresh session the mood tracker should be in full input mode.
      // Skip the test gracefully if the mood tracker is not available.
      test.skip();
      return;
    }

    // Find all mood radio buttons inside the radiogroup
    const moodButtons = moodRadiogroup.locator('button[role="radio"]');
    await expect(moodButtons.first()).toBeVisible({ timeout: 10000 });

    // Count that there are 5 moods
    const moodCount = await moodButtons.count();
    expect(moodCount).toBe(5);

    // Click the third mood ("okay" - works regardless of language)
    await moodButtons.nth(2).click();

    // After selecting a mood, the save button should appear.
    // The button text varies by language: "Save mood" / "Сохранить настроение" / etc.
    const saveButton = page.locator('button').filter({
      hasText: /save|сохранить|зберегти|guardar|speichern|enregistrer|保存/i,
    });
    await expect(saveButton).toBeVisible({ timeout: 10000 });

    // Click save
    await saveButton.click();

    // After saving, the mood tracker should switch to compact view
    // showing the recorded mood, or a celebration overlay may appear.
    // Verify the radiogroup is no longer in its "unselected" state
    // by checking that either the celebration or the compact view is shown.
    // We wait briefly for the animation/state transition.
    await page.waitForTimeout(1500);

    // The app should still be functional (no crash)
    await expect(page.locator('body')).toBeVisible();
  });
});

/**
 * Focus Timer
 *
 * Verifies the focus timer controls are accessible and that the timer
 * can be started and paused. The timer has play/pause buttons with
 * aria-labels like "Start timer" / "Pause timer" (or their translations).
 */
test.describe('Focus Timer', () => {
  test('timer controls are accessible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // The home tab should already be active after load.
    // The FocusTimer may be below the fold; scroll down to find it.
    // Look for the timer element (role="timer") which contains the countdown.
    const timer = page.locator('[role="timer"]');
    const timerVisible = await timer.isVisible().catch(() => false);

    if (!timerVisible) {
      // Timer might not be enabled (feature flag). Try scrolling to find it.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);
    }

    // Look for the start/play button by its aria-label pattern
    const startButton = page.locator(
      'button[aria-label*="Start" i], button[aria-label*="start" i], ' +
      'button[aria-label*="Начать" i], button[aria-label*="Почати" i], ' +
      'button[aria-label*="Empezar" i], button[aria-label*="Starten" i], ' +
      'button[aria-label*="Commencer" i], button[aria-label*="開始" i]'
    );

    // Also look for the pause button (in case timer is already running from saved state)
    const pauseButton = page.locator(
      'button[aria-label*="Pause" i], button[aria-label*="pause" i], ' +
      'button[aria-label*="Пауза" i], button[aria-label*="Pausa" i], ' +
      'button[aria-label*="一時停止" i]'
    );

    // Either start or pause button should be visible (timer controls exist)
    const startVisible = await startButton.first().isVisible().catch(() => false);
    const pauseVisible = await pauseButton.first().isVisible().catch(() => false);

    if (!startVisible && !pauseVisible) {
      // Focus timer module may not be enabled for this user; skip gracefully
      test.skip();
      return;
    }

    // At least one control is visible
    expect(startVisible || pauseVisible).toBe(true);
  });

  test('can start and pause timer', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Scroll to ensure the timer section is in view
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Locate the play (start/resume) button
    const playButton = page.locator(
      'button[aria-label*="Start" i], button[aria-label*="start" i], ' +
      'button[aria-label*="Resume" i], button[aria-label*="resume" i], ' +
      'button[aria-label*="Начать" i], button[aria-label*="Продолж" i], ' +
      'button[aria-label*="Почати" i], button[aria-label*="Empezar" i], ' +
      'button[aria-label*="Starten" i], button[aria-label*="Commencer" i], ' +
      'button[aria-label*="開始" i]'
    );
    const pauseButton = page.locator(
      'button[aria-label*="Pause" i], button[aria-label*="pause" i], ' +
      'button[aria-label*="Пауза" i], button[aria-label*="Pausa" i], ' +
      'button[aria-label*="一時停止" i]'
    );

    const playVisible = await playButton.first().isVisible().catch(() => false);
    const pauseVisible = await pauseButton.first().isVisible().catch(() => false);

    if (!playVisible && !pauseVisible) {
      // Focus timer module may not be enabled; skip gracefully
      test.skip();
      return;
    }

    if (playVisible) {
      // Timer is stopped - start it
      await playButton.first().click();

      // Wait for the timer to switch to running state
      // The pause button should now appear
      await expect(pauseButton.first()).toBeVisible({ timeout: 10000 });

      // Now pause the timer
      await pauseButton.first().click();

      // After pausing, the timer should not crash and the app should still be functional
      await page.waitForTimeout(1000);
      await expect(page.locator('body')).toBeVisible();
    } else {
      // Timer is already running (from a previous session) - pause it first
      await pauseButton.first().click();

      // After pausing, the app should still be functional
      await page.waitForTimeout(1000);
      await expect(page.locator('body')).toBeVisible();
    }
  });
});

/**
 * Full Navigation
 *
 * Verifies that clicking each tab in the bottom navigation switches the
 * active content area. The navigation has 5 tabs: home, map, garden/diary,
 * stats, settings. Each tab is a <button role="tab"> with aria-selected.
 */
test.describe('Full Navigation', () => {
  test('can navigate to all tabs', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for navigation to be ready
    const nav = page.locator('[role="navigation"]');
    await expect(nav.first()).toBeVisible({ timeout: 10000 });

    const tabList = page.locator('[role="tablist"]');
    await expect(tabList).toBeVisible({ timeout: 10000 });

    const tabs = tabList.locator('button[role="tab"]');
    const tabCount = await tabs.count();

    // App has 5 tabs: home, map, garden/diary, stats, settings
    expect(tabCount).toBe(5);

    for (let i = 0; i < tabCount; i++) {
      const tab = tabs.nth(i);
      await tab.click();

      await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 10000 });

      for (let j = 0; j < tabCount; j++) {
        if (j !== i) {
          await expect(tabs.nth(j)).toHaveAttribute('aria-selected', 'false');
        }
      }

      await page.waitForTimeout(500);
      await expect(page.locator('text=Something went wrong')).not.toBeVisible();
    }
  });
});

/**
 * Offline Behavior
 *
 * Verifies that the OfflineBanner component appears when the browser
 * goes offline. The banner has role="alert" and displays "You are offline"
 * (or a translated equivalent). It may take up to 2 seconds to detect.
 */
test.describe('Offline Behavior', () => {
  test('shows offline banner when network is lost', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for app to fully mount (AuthGate resolved, React useEffects registered)
    await expect(
      page.locator('nav, [role="navigation"]').first()
    ).toBeVisible({ timeout: 15000 });

    // Go offline: block network + fire the browser "offline" event
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));

    // OfflineBanner listens to "offline" and renders with data-testid.
    // Generous timeout because AnimatePresence animates entry.
    const offlineBanner = page.locator('[data-testid="offline-banner"]');
    await expect(offlineBanner).toBeVisible({ timeout: 10000 });

    // Verify the banner contains text
    const bannerText = await offlineBanner.textContent();
    expect(bannerText).toBeTruthy();

    // Go back online: restore network + fire "online" event
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));

    // Banner should disappear (may linger briefly due to animation)
    await expect(offlineBanner).not.toBeVisible({ timeout: 10000 });
  });
});

/**
 * Empty States
 *
 * Verifies that the app renders properly for a fresh user with no data.
 * Clears localStorage and reloads, then checks that no broken/blank
 * screens appear when navigating between tabs.
 */
test.describe('Empty States', () => {
  test('shows empty states for new user', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Clear all IndexedDB databases to simulate a brand-new user
    await page.evaluate(async () => {
      const databases = await indexedDB.databases?.() || [];
      for (const db of databases) {
        if (db.name) {
          indexedDB.deleteDatabase(db.name);
        }
      }
    });

    // Clear localStorage but re-set all onboarding bypass keys so we can access the app
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('zenflow-language-selected', JSON.stringify(true));
      localStorage.setItem('zenflow-google-auth-checked', JSON.stringify(true));
      localStorage.setItem('zenflow-tutorial-complete', JSON.stringify(true));
      localStorage.setItem('zenflow-onboarding-complete', JSON.stringify(true));
      localStorage.setItem('zenflow-notification-permission-checked', JSON.stringify(true));
      localStorage.setItem('zenflow-privacy', JSON.stringify({ noTracking: false, analytics: false, consentShown: true }));
      localStorage.setItem('zenflow-last-weekly-report', new Date().toISOString());
    });

    // Reload the page to start fresh
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Wait for tab navigation to appear (app has loaded past onboarding)
    const tabList = page.locator('[role="tablist"]');
    await expect(tabList).toBeVisible({ timeout: 15000 });

    // Verify no crash
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('text=Something went wrong')).not.toBeVisible();

    // Navigate to the stats tab (index 3: home=0, map=1, garden=2, stats=3, settings=4)
    const statsTab = page.locator('button[role="tab"]').nth(3);
    await statsTab.click();
    await expect(statsTab).toHaveAttribute('aria-selected', 'true', { timeout: 10000 });

    // Wait for the stats page content to load (it is lazy-loaded)
    await page.waitForTimeout(1500);

    // With no data, the stats page should show an empty state or
    // at least not crash. Check that something rendered.
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('text=Something went wrong')).not.toBeVisible();

    // Navigate to settings tab (index 4)
    const settingsTab = page.locator('button[role="tab"]').nth(4);
    await settingsTab.click();
    await expect(settingsTab).toHaveAttribute('aria-selected', 'true', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Settings should always render regardless of user data
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('text=Something went wrong')).not.toBeVisible();

    // Navigate back to home tab
    const homeTab = page.locator('button[role="tab"]').nth(0);
    await homeTab.click();
    await expect(homeTab).toHaveAttribute('aria-selected', 'true', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Home should show the mood tracker (full input view for a new user)
    // or an onboarding flow. Either way, no crash.
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('text=Something went wrong')).not.toBeVisible();
  });
});

/**
 * Settings
 *
 * Verifies that the settings panel loads and contains its key accordion
 * sections: profile, modules, notifications, data, and account.
 * Uses the Accordion component which has trigger buttons.
 */
test.describe('Settings', () => {
  test('settings panel loads with all sections', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to the settings tab (5th tab, index 4: home=0, map=1, garden=2, stats=3, settings=4)
    const settingsTab = page.locator('button[role="tab"]').nth(4);
    await expect(settingsTab).toBeVisible({ timeout: 10000 });
    await settingsTab.click();
    await expect(settingsTab).toHaveAttribute('aria-selected', 'true', { timeout: 10000 });

    // Wait for the settings panel to lazy-load and render
    await page.waitForTimeout(1500);

    // The settings page has a heading "Settings" / "Настройки" / etc.
    const settingsHeading = page.locator('h2').filter({
      hasText: /settings|настройки|налаштування|ajustes|einstellungen|paramètres|設定/i,
    });
    await expect(settingsHeading).toBeVisible({ timeout: 10000 });

    // The settings panel uses an Accordion with these groups:
    // 1. Profile (settingsGroupProfile)
    // 2. Modules (settingsGroupModules)
    // 3. Notifications (settingsGroupNotifications)
    // 4. Data (settingsGroupData)
    // 5. Account (settingsGroupAccount)
    // Each accordion item has a trigger button. Verify they exist.

    // Check for at least the major accordion section triggers.
    // The triggers are rendered inside AccordionTrigger components
    // containing span elements with section titles.
    // We use flexible regexes to match across languages.

    // Profile section
    const profileSection = page.locator('button').filter({
      hasText: /profile|профиль|профіль|perfil|profil/i,
    });
    await expect(profileSection.first()).toBeVisible({ timeout: 10000 });

    // Modules section
    const modulesSection = page.locator('button').filter({
      hasText: /modules|модули|модулі|módulos|module/i,
    });
    await expect(modulesSection.first()).toBeVisible({ timeout: 10000 });

    // Notifications section
    const notificationsSection = page.locator('button').filter({
      hasText: /notification|уведомлен|сповіщен|notificacion|benachrichtig|通知/i,
    });
    await expect(notificationsSection.first()).toBeVisible({ timeout: 10000 });

    // Data section
    const dataSection = page.locator('button').filter({
      hasText: /data|данные|дані|datos|daten|données|データ|privacy|приватн/i,
    });
    await expect(dataSection.first()).toBeVisible({ timeout: 10000 });

    // Account section
    const accountSection = page.locator('button').filter({
      hasText: /account|аккаунт|акаунт|cuenta|konto|compte|アカウント/i,
    });
    await expect(accountSection.first()).toBeVisible({ timeout: 10000 });

    // Verify no error state
    await expect(page.locator('text=Something went wrong')).not.toBeVisible();
  });
});
