import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const PUBLIC_APP_URL = process.env.ZENFLOW_PLAYWRIGHT_BASE_URL || 'https://yehor212.github.io/people-first-app/';
export function resolvePlaywrightLocalPort(port = process.env.ZENFLOW_PLAYWRIGHT_LOCAL_PORT): string {
  const rawPort = port?.trim() || '8080';

  if (!/^\d+$/.test(rawPort)) {
    throw new Error('ZENFLOW_PLAYWRIGHT_LOCAL_PORT must be a numeric TCP port.');
  }

  const numericPort = Number(rawPort);
  if (!Number.isInteger(numericPort) || numericPort < 1 || numericPort > 65535) {
    throw new Error('ZENFLOW_PLAYWRIGHT_LOCAL_PORT must be between 1 and 65535.');
  }

  return String(numericPort);
}

export function resolvePlaywrightPreviewOutDir(
  outDir = process.env.ZENFLOW_PLAYWRIGHT_PREVIEW_DIR,
): string {
  const rawOutDir = outDir?.trim() || 'dist';

  if (!/^[A-Za-z0-9._/-]+$/.test(rawOutDir)) {
    throw new Error('ZENFLOW_PLAYWRIGHT_PREVIEW_DIR must contain only safe relative path characters.');
  }
  if (path.isAbsolute(rawOutDir) || rawOutDir.split('/').includes('..')) {
    throw new Error('ZENFLOW_PLAYWRIGHT_PREVIEW_DIR must stay inside the repository.');
  }

  return rawOutDir;
}

export function resolvePlaywrightLocalBaseUrl(port = process.env.ZENFLOW_PLAYWRIGHT_LOCAL_PORT): string {
  return `http://127.0.0.1:${resolvePlaywrightLocalPort(port)}/people-first-app/`;
}

const LOCAL_APP_PORT = resolvePlaywrightLocalPort();
const LOCAL_PREVIEW_OUT_DIR = resolvePlaywrightPreviewOutDir();
const LOCAL_APP_URL = resolvePlaywrightLocalBaseUrl(LOCAL_APP_PORT);
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
  snapshotPathTemplate: '{testDir}/{testFileName}-snapshots/{arg}-{projectName}-{platform}{ext}',

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
          command: process.env.CI
            ? `npm run preview -- --host 127.0.0.1 --port ${LOCAL_APP_PORT} --strictPort --outDir ${LOCAL_PREVIEW_OUT_DIR}`
            : `npm run dev -- --host 127.0.0.1 --port ${LOCAL_APP_PORT} --strictPort`,
          url: LOCAL_APP_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 120 * 1000,
        },
      }
    : {}),
});
