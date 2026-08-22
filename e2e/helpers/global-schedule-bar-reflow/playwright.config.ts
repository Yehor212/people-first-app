import { defineConfig, devices } from "@playwright/test";

const port = 8098;
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "../..",
  testMatch: "global-schedule-bar-reflow.spec.ts",
  workers: 1,
  reporter: "line",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `${origin}/`,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  webServer: {
    command: `VITE_APP_BASE=/ npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `${origin}/e2e/helpers/global-schedule-bar-reflow/index.html`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
