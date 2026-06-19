import { defineConfig, devices } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const configDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(configDir, "../../..");
const artifactRoot = resolve(repoRoot, "output/playwright/ios-diary-e2e-20260614");

export default defineConfig({
  testDir: repoRoot,
  testIgnore: ["**/output/**"],
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 90_000,
  expect: {
    timeout: 30_000,
  },
  outputDir: resolve(artifactRoot, "test-results"),
  use: {
    baseURL: "https://127.0.0.1:4188",
    ignoreHTTPSErrors: true,
    screenshot: "only-on-failure",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    video: "off",
  },
  webServer: {
    command: `node ${resolve(configDir, "serve-ios-spa.mjs")}`,
    url: "https://127.0.0.1:4188",
    reuseExistingServer: false,
    timeout: 20_000,
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "ios-webkit-iphone-15",
      use: {
        ...devices["iPhone 15"],
        browserName: "webkit",
        hasTouch: true,
        isMobile: true,
      },
    },
  ],
});
