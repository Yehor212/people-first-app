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

  /* OS-agnostic snapshot paths so baselines generated locally (Windows)
     are reused in CI (Ubuntu). Without this Playwright suffixes -win32 /
     -linux / -darwin per OS, making CI regenerate its own baselines
     silently on first run (Percy/Sauce 2026 anti-pattern). */
  snapshotPathTemplate: '{testFileDir}/{testFileName}-snapshots/{arg}-{projectName}{ext}',

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

  /* In CI: serve built dist/ via vite preview (env vars already baked in by Build step).
     Locally: use vite dev server (reads .env.local). */
  webServer: {
    command: process.env.CI ? 'npm run preview' : 'npm run dev',
    url: 'http://localhost:8080/people-first-app/',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
