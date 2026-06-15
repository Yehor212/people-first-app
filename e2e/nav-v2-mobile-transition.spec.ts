import { expect, test } from "@playwright/test";
import { primeZenflowV2 } from "./helpers/zenflowV2State";

async function primeWithFirstRunHint(page: import("@playwright/test").Page) {
  await primeZenflowV2(page, {
    clearStorage: true,
    language: "en",
    theme: "paper",
  });
  await page.addInitScript(() => {
    localStorage.removeItem("zenflow-orb-first-run-dismissed");
  });
}

test.describe("V2 mobile web route transitions", () => {
  test("dev compact web rail keeps Habits reachable while the first-run mood hint is visible", async ({
    page,
  }, testInfo) => {
    const baseURL = String(testInfo.project.use.baseURL ?? "");
    const isLocalDevTarget = baseURL.includes(":4194/");
    test.skip(
      !isLocalDevTarget,
      "compact web rail is a dev-only V2 preview layout; production phone uses the drawer",
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await primeWithFirstRunHint(page);

    await page.goto("orb?nav=v2&navLayout=web&dev=true", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByTestId("mood-first-run-hint")).toBeVisible({
      timeout: 20_000,
    });

    await page
      .getByTestId("sidebar-v2")
      .getByRole("button", { name: "Habits" })
      .click({ timeout: 5_000 });

    await expect(page.getByTestId("nav-v2-orchestrator")).toHaveAttribute(
      "data-active-page",
      "habits",
    );
    await expect(page.getByTestId("habits-page")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("phone drawer remains reachable while the first-run mood hint is visible", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await primeWithFirstRunHint(page);

    await page.goto("orb?nav=v2&navLayout=phone&dev=true", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByTestId("mood-first-run-hint")).toBeVisible({
      timeout: 20_000,
    });

    await page.getByTestId("nav-v2-open-drawer").click({ timeout: 5_000 });
    await page.getByTestId("drawer-v2-destination-habits").click({
      timeout: 5_000,
    });

    await expect(page.getByTestId("nav-v2-orchestrator")).toHaveAttribute(
      "data-active-page",
      "habits",
    );
    await expect(page.getByTestId("habits-page")).toBeVisible({
      timeout: 10_000,
    });
  });
});
