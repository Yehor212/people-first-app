import { defineConfig, devices } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const configDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(configDir, "../../..");
const baseURL = "https://127.0.0.1:4181/people-first-app/";

export default defineConfig({
  testDir: repoRoot,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 120_000,
  expect: {
    timeout: 30_000,
  },
  outputDir: resolve(repoRoot, "output/playwright/pwa-offline-diary/test-results"),
  use: {
    baseURL,
    ignoreHTTPSErrors: true,
    screenshot: "only-on-failure",
    serviceWorkers: "allow",
    trace: "retain-on-failure",
    video: "off",
  },
  webServer: {
    command: `cd ${repoRoot} && npm run build && node ${resolve(configDir, "serve-pwa-preview.mjs")}`,
    ignoreHTTPSErrors: true,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "pwa-offline-chromium-phone",
      use: {
        ...devices["Pixel 5"],
        browserName: "chromium",
        hasTouch: true,
        isMobile: true,
        launchOptions: {
          args: ["--ignore-certificate-errors"],
        },
      },
    },
    {
      name: "pwa-offline-webkit-iphone",
      use: {
        ...devices["iPhone 15"],
        browserName: "webkit",
        hasTouch: true,
        isMobile: true,
      },
    },
  ],
});
