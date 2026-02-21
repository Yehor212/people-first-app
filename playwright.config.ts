import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 *
 * Run with: npx playwright test
 * Run UI mode: npx playwright test --ui
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: 'http://localhost:8080/people-first-app/',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Mobile Chrome — local only (skipped in CI to save time)
    ...(!process.env.CI ? [{
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    }] : []),
  ],

  /* Run local dev server before starting tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8080/people-first-app/',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
