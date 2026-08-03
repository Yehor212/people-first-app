import { defineConfig, devices } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const configDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(configDir, "../../..");
const rawPort = process.env.ZENFLOW_SAVE_CEREMONY_PORT?.trim() || "4191";
if (!/^\d+$/.test(rawPort) || Number(rawPort) < 1 || Number(rawPort) > 65535) {
  throw new Error(
    "ZENFLOW_SAVE_CEREMONY_PORT must be a TCP port between 1 and 65535.",
  );
}
const scheme =
  process.env.ZENFLOW_SAVE_CEREMONY_SCHEME?.trim().toLowerCase() || "https";
if (scheme !== "http" && scheme !== "https") {
  throw new Error(
    "ZENFLOW_SAVE_CEREMONY_SCHEME must be either http or https.",
  );
}
// Chromium's Service Worker proof uses loopback HTTP, which is a potentially
// trustworthy origin. Cross-engine visual/runtime proofs use self-signed HTTPS
// because the production CSP upgrades insecure subresources.
const baseURL = `${scheme}://127.0.0.1:${rawPort}/people-first-app/`;

export default defineConfig({
  testDir: repoRoot,
  testIgnore: ["**/.codex-artifacts/**", "**/output/**"],
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 90_000,
  expect: {
    timeout: 30_000,
  },
  outputDir: resolve(repoRoot, "output/playwright/journal-save-ceremony"),
  use: {
    baseURL,
    ignoreHTTPSErrors: scheme === "https",
    screenshot: "only-on-failure",
    trace:
      process.env.ZENFLOW_SAVE_CEREMONY_TRACE === "on"
        ? "retain-on-failure"
        : "off",
    video: "off",
  },
  webServer: {
    command: `node ${resolve(configDir, "serve-spa.mjs")}`,
    url: baseURL,
    ignoreHTTPSErrors: scheme === "https",
    reuseExistingServer: false,
    timeout: 20_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], browserName: "chromium" },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"], browserName: "firefox" },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"], browserName: "webkit" },
    },
  ],
});
