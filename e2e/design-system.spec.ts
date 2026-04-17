/**
 * Phase 2-B visual regression spec — design-system baselines.
 *
 * Purpose: prove the OKLCH dual-token bridge end-to-end by pre-seeding the
 * design flag store (localStorage, via Zustand persist) with the mood-slider
 * rollout at 0% (HSL) and 100% (OKLCH), then snapshotting the journal tab in
 * both states.
 *
 * First run creates baselines. Subsequent runs diff against them — reg-viz
 * publishes visual diffs as a PR comment when pixels change.
 *
 * Runs separately from the existing e2e/visual-regression.spec.ts so that
 * home/stats/settings baselines are not conflated with design-system ones.
 */

import { test, expect } from "@playwright/test";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };

async function primeApp(page: import("@playwright/test").Page, oklchEnabled: boolean) {
  await page.addInitScript(
    ({ appVersion, oklch }: { appVersion: string; oklch: boolean }) => {
      localStorage.setItem("zenflow-language-selected", JSON.stringify(true));
      localStorage.setItem("zenflow-google-auth-checked", JSON.stringify(true));
      localStorage.setItem("zenflow-tutorial-complete", JSON.stringify(true));
      localStorage.setItem("zenflow-onboarding-complete", JSON.stringify(true));
      localStorage.setItem(
        "zenflow-notification-permission-checked",
        JSON.stringify(true),
      );
      localStorage.setItem(
        "zenflow_onboarding_state",
        JSON.stringify({
          isNewUser: false,
          hasSeenWelcome: true,
          firstLoginDate: Date.now(),
          daysActive: 5,
          lastActiveDate: new Date().toISOString().split("T")[0],
          unlockedFeatures: [],
        }),
      );
      localStorage.setItem("zenflow_last_seen_version", appVersion);
      localStorage.setItem("zenflow-theme", "light");

      // Seed the Zustand design-flag store (persist middleware key).
      localStorage.setItem(
        "zen-design-flags",
        JSON.stringify({
          state: {
            flags: {
              "design.colors.oklch.mood-slider": {
                key: "design.colors.oklch.mood-slider",
                enabled: oklch,
                rollout_percent: oklch ? 100 : 0,
                killswitch: false,
              },
            },
            lastFetch: Date.now(),
          },
          version: 1,
        }),
      );
    },
    { appVersion: packageJson.version, oklch: oklchEnabled },
  );
}

async function waitForApp(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const nav = page.locator('[role="navigation"]');
  await expect(nav.first()).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1500);
}

async function disableAnimations(page: import("@playwright/test").Page) {
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation-duration: 0s !important; animation-delay: 0s !important;
      transition-duration: 0s !important; transition-delay: 0s !important;
    }`,
  });
  await page.waitForTimeout(300);
}

test.describe("Design System Phase 2-B — OKLCH flag bridge", () => {
  test("home with flag off (HSL baseline)", async ({ page }) => {
    await primeApp(page, false);
    await waitForApp(page);
    await disableAnimations(page);
    await expect(page).toHaveScreenshot("home-flag-off-hsl.png", {
      maxDiffPixelRatio: 0.02,
      fullPage: false,
    });
  });

  test("home with flag on (OKLCH baseline)", async ({ page }) => {
    await primeApp(page, true);
    await waitForApp(page);
    await disableAnimations(page);
    await expect(page).toHaveScreenshot("home-flag-on-oklch.png", {
      maxDiffPixelRatio: 0.02,
      fullPage: false,
    });
  });
});
