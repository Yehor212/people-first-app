import { expect, test, type Page } from "@playwright/test";

import { primeZenflowV2 } from "./helpers/zenflowV2State";

async function rewindAndSuspendEssentialAnimations(page: Page, testIds: string[]) {
  await page.evaluate((ids) => {
    const animations = new Set<Animation>();
    for (const testId of ids) {
      let current = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
      while (current) {
        for (const animation of current.getAnimations({ subtree: false })) {
          animations.add(animation);
        }
        current = current.parentElement;
      }
    }

    for (const animation of animations) {
      animation.pause();
      try {
        animation.currentTime = 0;
      } catch {
        // Some browser-owned animations expose a read-only timeline. They are
        // irrelevant to the app-owned opacity contract checked below.
      }
    }
  }, testIds);
}

async function expectVisibleAtAnimationTimeZero(page: Page, testIds: string[]) {
  const results = await page.evaluate((ids) => {
    return ids.map((testId) => {
      const element = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
      if (!element) return { testId, exists: false, hiddenAncestor: "missing" };

      let current: HTMLElement | null = element;
      while (current) {
        const style = getComputedStyle(current);
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          Number.parseFloat(style.opacity || "1") === 0
        ) {
          return {
            testId,
            exists: true,
            hiddenAncestor: current.dataset.testid || current.tagName.toLowerCase(),
          };
        }
        current = current.parentElement;
      }

      return { testId, exists: true, hiddenAncestor: null };
    });
  }, testIds);

  expect(results).toEqual(
    testIds.map((testId) => ({ testId, exists: true, hiddenAncestor: null })),
  );
}

test.describe("V2 primary content fails open when animation clocks stop", () => {
  test.beforeEach(async ({ page }) => {
    await primeZenflowV2(page, {
      clearStorage: true,
      language: "en",
      privacyNoTracking: true,
      theme: "paper",
    });
  });

  for (const scenario of [
    {
      route: "orb?nav=v2&navLayout=phone&dev=true&runtimePerfGuard=off",
      ready: "orb-page",
      essential: [
        "orb-page",
        "orb-page-select",
        "orb-page-scope",
        "orb-page-picker",
        "orb-page-footer",
      ],
    },
    {
      route: "habits?nav=v2&navLayout=desktop&dev=true",
      ready: "habits-page",
      essential: ["habits-page"],
    },
    {
      route: "diary?nav=v2&navLayout=desktop&dev=true",
      ready: "diary-page",
      essential: ["diary-page", "diary-empty-canvas", "diary-reflection-quote", "diary-empty-actions"],
    },
    {
      route: "settings?nav=v2&navLayout=desktop&dev=true",
      ready: "settings-page",
      essential: ["settings-page", "settings-page-workspace"],
    },
  ]) {
    test(`${scenario.ready} remains visible at animation time zero`, async ({ page }) => {
      await page.goto(scenario.route, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId(scenario.ready)).toBeVisible({ timeout: 30_000 });
      for (const testId of scenario.essential) {
        await expect(page.getByTestId(testId)).toBeVisible({ timeout: 30_000 });
      }
      if (scenario.ready === "orb-page") {
        await page.waitForTimeout(2_000);
        await expect(page.getByTestId("orb-page-runtime-content")).toBeVisible({
          timeout: 30_000,
        });
      }

      await rewindAndSuspendEssentialAnimations(page, scenario.essential);
      await expectVisibleAtAnimationTimeZero(page, scenario.essential);
    });
  }
});
