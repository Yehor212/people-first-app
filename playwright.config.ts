import { defineConfig, devices } from '@playwright/test';

const PUBLIC_APP_URL = process.env.ZENFLOW_PLAYWRIGHT_BASE_URL || 'https://yehor212.github.io/people-first-app/';
const LOCAL_APP_URL = 'http://localhost:8080/people-first-app/';
const USE_LOCAL_WEBSERVER = process.env.ZENFLOW_PLAYWRIGHT_USE_LOCAL_SERVER === 'true';

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
     silently on first run (Percy/Sauce 2026 anti-pattern).
     Phase 2-B.2: switched {testFileDir} → {testDir}/{testFilePath.dir} to
     force snapshots into e2e/ on Windows (Playwright 1.46 resolves
     {testFileDir} as cwd on POSIX-normalised paths). */
  snapshotPathTemplate: '{testDir}/{testFileName}-snapshots/{arg}-{projectName}{ext}',

  use: {
    baseURL: USE_LOCAL_WEBSERVER ? LOCAL_APP_URL : PUBLIC_APP_URL,
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

  /* Default proof target is the deployed public app. Local dev/preview is opt-in only. */
  ...(USE_LOCAL_WEBSERVER
    ? {
        webServer: {
          command: process.env.CI ? 'npm run preview' : 'npm run dev',
          url: LOCAL_APP_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 120 * 1000,
        },
      }
    : {}),
});
