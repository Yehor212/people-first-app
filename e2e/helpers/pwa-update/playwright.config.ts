import { defineConfig } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const configDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(configDir, "../../..");
const enabled = process.env.ZENFLOW_RUN_INSTALLED_PWA_UPDATE === "true";
const baseURL = "http://127.0.0.1:4183/people-first-app/";

export default defineConfig({
  testDir: repoRoot,
  testMatch: ["e2e/automation-pwa-update.spec.ts"],
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 180_000,
  expect: { timeout: 90_000 },
  outputDir: resolve(repoRoot, "output/playwright/pwa-update/test-results"),
  webServer: enabled
    ? {
        command: `cd ${repoRoot} && node ${resolve(configDir, "prepare-artifacts.mjs")} && node ${resolve(configDir, "serve-pwa-update.mjs")}`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 300_000,
      }
    : undefined,
});
