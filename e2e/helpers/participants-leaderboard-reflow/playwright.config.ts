import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const port = 8114;
const origin = `http://127.0.0.1:${port}`;
const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(configDirectory, "../../..");

export default defineConfig({
  testDir: "../..",
  testMatch: "participants-leaderboard-reflow.spec.ts",
  workers: 1,
  reporter: "line",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `${origin}/`,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  webServer: {
    command: `npx --no-install vite --config e2e/helpers/participants-leaderboard-reflow/vite.config.ts --host 127.0.0.1 --port ${port} --strictPort`,
    cwd: repositoryRoot,
    url: `${origin}/e2e/helpers/participants-leaderboard-reflow/index.html`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
