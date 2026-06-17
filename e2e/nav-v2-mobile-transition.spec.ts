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

async function seedHeavyHabitsDataset(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    const dateKey = (offsetDays: number) => {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() + offsetDays);
      return date.toISOString().slice(0, 10);
    };
    const entriesFor = (habitIndex: number) => {
      const entries: Record<string, { value: number; loggedAt: string; source: string }> = {};
      for (let offset = -180; offset <= 0; offset += 1) {
        if ((Math.abs(offset) + habitIndex) % 4 === 0) continue;
        entries[dateKey(offset)] = {
          value: 2,
          loggedAt: new Date(Date.now() + offset * 86_400_000).toISOString(),
          source: "quickTap",
        };
      }
      return entries;
    };
    const reminders = ["08:00", "13:00", "19:00"];
    const identity = ["body", "focus", "energy", "gratitude"];
    const habits = Array.from({ length: 32 }, (_, index) => ({
      id: `perf-habit-${index}`,
      name: `Performance habit ${index + 1}`,
      icon: ["Leaf", "Water", "Focus", "Book"][index % 4],
      color: index % 8,
      position: index,
      createdAt: Date.now() - 190 * 86_400_000,
      habitType: "boolean",
      frequency: { numerator: 1, denominator: 1 },
      schedule: {
        mode: "daily",
        period: "week",
        targetCount: 7,
        dueDays: [1, 2, 3, 4, 5, 6, 0],
      },
      question: "",
      description: "",
      isArchived: false,
      targetValue: 1,
      targetType: "atLeast",
      unit: "",
      entries: entriesFor(index),
      reminders: index % 4 === 3
        ? []
        : [
            {
              id: `rem-${index}`,
              time: reminders[index % reminders.length],
              enabled: true,
              days: [1, 2, 3, 4, 5, 6, 0],
            },
          ],
      identityCluster: identity[index % identity.length],
      identityVerb: ["steadier", "clearer", "stronger", "kinder"][index % 4],
      identityIcon: ["Sprout", "Route", "Orbit", "Heart"][index % 4],
    }));
    const moods = Array.from({ length: 120 }, (_, index) => ({
      id: `perf-mood-${index}`,
      date: dateKey(-index),
      timestamp: Date.now() - index * 86_400_000,
      mood: (["great", "good", "okay", "bad"] as const)[index % 4],
      note: "",
      tags: index % 3 === 0 ? ["habit"] : [],
    }));
    localStorage.setItem("zenflow-habits", JSON.stringify(habits));
    localStorage.setItem("zenflow-moods", JSON.stringify(moods));
    localStorage.setItem("zenflow-focus", JSON.stringify([]));
  });
}

async function installRoutePerfProbe(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    const state = window as Window & {
      __navV2RoutePerf?: {
        longTasks: Array<{ duration: number; name: string; startTime: number }>;
        longAnimationFrames: Array<{
          blockingDuration: number;
          duration: number;
          startTime: number;
        }>;
        resetAt: number;
      };
    };
    state.__navV2RoutePerf = { longTasks: [], longAnimationFrames: [], resetAt: 0 };
    try {
      const observer = new PerformanceObserver((list) => {
        const perf = state.__navV2RoutePerf;
        if (!perf) return;
        for (const entry of list.getEntries()) {
          if (entry.startTime >= perf.resetAt) {
            perf.longTasks.push({
              duration: entry.duration,
              name: entry.name,
              startTime: entry.startTime,
            });
          }
        }
      });
      observer.observe({ type: "longtask", buffered: true });
    } catch {
      // Long Task API is Chromium-only; the test treats absence as no samples.
    }
    try {
      const observer = new PerformanceObserver((list) => {
        const perf = state.__navV2RoutePerf;
        if (!perf) return;
        for (const entry of list.getEntries()) {
          const frame = entry as PerformanceEntry & { blockingDuration?: number };
          if (frame.startTime >= perf.resetAt) {
            perf.longAnimationFrames.push({
              blockingDuration: frame.blockingDuration ?? 0,
              duration: frame.duration,
              startTime: frame.startTime,
            });
          }
        }
      });
      observer.observe({ type: "long-animation-frame", buffered: true });
    } catch {
      // Long Animation Frame is newer; absence should not fail older engines.
    }
  });
}

async function resetRoutePerfProbe(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    const state = window as Window & {
      __navV2RoutePerf?: {
        longAnimationFrames: unknown[];
        longTasks: unknown[];
        resetAt: number;
      };
    };
    if (state.__navV2RoutePerf) {
      state.__navV2RoutePerf.longAnimationFrames = [];
      state.__navV2RoutePerf.longTasks = [];
      state.__navV2RoutePerf.resetAt = performance.now();
    }
  });
}

async function readRoutePerfMetrics(
  page: import("@playwright/test").Page,
  startedAt: number,
  routeVisibleAt: number,
) {
  return page.evaluate(({ start, visibleAt }) => {
    const state = window as Window & {
      __navV2RoutePerf?: {
        longAnimationFrames: Array<{ blockingDuration: number; duration: number }>;
        longTasks: Array<{ duration: number; name: string; startTime: number }>;
      };
    };
    const longTasks = state.__navV2RoutePerf?.longTasks ?? [];
    const longAnimationFrames = state.__navV2RoutePerf?.longAnimationFrames ?? [];
    return {
      sampleWindowMs: performance.now() - start,
      tapToVisibleMs: visibleAt - start,
      drawerMounted: Boolean(document.querySelector('[data-testid="drawer-v2"]')),
      longAnimationFrameCount: longAnimationFrames.length,
      longTaskCount: longTasks.length,
      maxLongAnimationFrameBlockingMs: Math.max(
        0,
        ...longAnimationFrames.map((entry) => entry.blockingDuration),
      ),
      maxLongAnimationFrameMs: Math.max(
        0,
        ...longAnimationFrames.map((entry) => entry.duration),
      ),
      maxLongTaskMs: Math.max(0, ...longTasks.map((entry) => entry.duration)),
    };
  }, { start: startedAt, visibleAt: routeVisibleAt });
}

function isLocalDevTarget(testInfo: import("@playwright/test").TestInfo) {
  const baseURL = String(testInfo.project.use.baseURL ?? "");
  return /^https?:\/\/(?:127\.0\.0\.1|localhost):\d+\//.test(baseURL);
}

function isLocalSourceDevServerTarget(testInfo: import("@playwright/test").TestInfo) {
  return isLocalDevTarget(testInfo) && process.env.ZENFLOW_PLAYWRIGHT_USE_LOCAL_SERVER === "true";
}

async function installViewTransitionProbe(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    const state = window as Window & { __navV2ViewTransitionCalls?: number };
    state.__navV2ViewTransitionCalls = 0;
    const originalStartViewTransition = document.startViewTransition;
    if (typeof originalStartViewTransition !== "function") return;

    document.startViewTransition = ((callback: () => void | Promise<void>) => {
      state.__navV2ViewTransitionCalls = (state.__navV2ViewTransitionCalls ?? 0) + 1;
      return originalStartViewTransition.call(document, callback);
    }) as typeof document.startViewTransition;
  });
}

async function resetViewTransitionProbe(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    (window as Window & { __navV2ViewTransitionCalls?: number }).__navV2ViewTransitionCalls = 0;
  });
}

async function expectNoViewTransitionCalls(page: import("@playwright/test").Page) {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (window as Window & { __navV2ViewTransitionCalls?: number })
              .__navV2ViewTransitionCalls ?? 0
        ),
      { message: "phone route changes must not run View Transitions" }
    )
    .toBe(0);
}

async function expectHabitsRouteVisible(
  page: import("@playwright/test").Page,
  options: { activeTimeout?: number; visibleTimeout?: number } = {},
) {
  const activeTimeout = options.activeTimeout ?? 2_500;
  const visibleTimeout = options.visibleTimeout ?? activeTimeout;

  await expect(page.getByTestId("nav-v2-orchestrator")).toHaveAttribute(
    "data-active-page",
    "habits",
    { timeout: activeTimeout },
  );
  await expect(page.getByRole("main", { name: /habits/i })).toBeVisible({
    timeout: visibleTimeout,
  });
}

test.describe("V2 mobile web route transitions", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(({ page: _page }, testInfo) => {
    test.skip(
      !isLocalDevTarget(testInfo),
      "current-branch V2 transition regressions require the local dev/preview target"
    );
  });

  test("phone compact web rail skips View Transition for Mood to Habits", async ({
    page,
  }, testInfo) => {
    test.skip(
      !isLocalSourceDevServerTarget(testInfo),
      "compact web rail is a dev-only V2 preview layout; production phone uses the drawer"
    );

    await installViewTransitionProbe(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await primeWithFirstRunHint(page);

    await page.goto("orb?nav=v2&navLayout=web&dev=true", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByTestId("mood-first-run-hint")).toBeVisible({
      timeout: 20_000,
    });
    await resetViewTransitionProbe(page);

    const startedAt = await page.evaluate(() => performance.now());
    await page
      .getByTestId("sidebar-v2")
      .getByRole("button", { name: "Habits" })
      .click({ timeout: 5_000 });

    await expectHabitsRouteVisible(page, { activeTimeout: 2_500 });

    const durationMs = await page.evaluate((start) => performance.now() - start, startedAt);
    expect(durationMs).toBeLessThan(2_500);
    await expectNoViewTransitionCalls(page);
  });

  test("phone drawer preloads Habits before the user taps the destination", async ({
    page,
  }, testInfo) => {
    test.skip(
      !isLocalSourceDevServerTarget(testInfo),
      "source-module preload request evidence is only stable against Vite dev server"
    );

    let habitsRouteRequests = 0;
    await page.route(/\/src\/pages\/nav-v2\/HabitsPage\.tsx/, async (route) => {
      habitsRouteRequests += 1;
      await route.continue();
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await primeWithFirstRunHint(page);

    await page.goto("orb?nav=v2&navLayout=phone&dev=true", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByTestId("mood-first-run-hint")).toBeVisible({
      timeout: 20_000,
    });

    await expect
      .poll(() => habitsRouteRequests, {
        message: "Habits route should preload before drawer navigation",
        timeout: 1_500,
      })
      .toBeGreaterThan(0);

    await page.getByRole("button", { name: "Got it" }).click({ timeout: 5_000 });
    await expect(page.getByTestId("mood-first-run-hint")).toBeHidden({
      timeout: 5_000,
    });

    await page.getByTestId("nav-v2-open-drawer").click({ timeout: 5_000 });
    await page.getByTestId("drawer-v2-destination-habits").click({
      timeout: 5_000,
    });

    await expectHabitsRouteVisible(page, {
      activeTimeout: 2_500,
      visibleTimeout: 5_000,
    });
  });

  test("phone drawer skips View Transition for Mood to Habits", async ({ page }) => {
    await installViewTransitionProbe(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await primeZenflowV2(page, {
      clearStorage: true,
      language: "en",
      theme: "paper",
    });

    await page.goto("orb?nav=v2&navLayout=phone&dev=true", {
      waitUntil: "domcontentloaded",
    });

    await page.getByTestId("nav-v2-open-drawer").click({ timeout: 5_000 });
    await expect(page.getByTestId("drawer-v2")).toBeVisible({ timeout: 5_000 });
    await resetViewTransitionProbe(page);
    await page.getByTestId("drawer-v2-destination-habits").click({
      timeout: 5_000,
    });
    await expect(page.getByTestId("nav-v2-route-pending")).toContainText("Habits", {
      timeout: 750,
    });

    await expectHabitsRouteVisible(page, {
      activeTimeout: 750,
      visibleTimeout: 2_500,
    });
    await expectNoViewTransitionCalls(page);
  });

  test("phone drawer shows route pending above the closing drawer", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await primeZenflowV2(page, {
      clearStorage: true,
      language: "en",
      theme: "paper",
    });

    await page.goto("orb?nav=v2&navLayout=phone&dev=true", {
      waitUntil: "domcontentloaded",
    });

    await page.getByTestId("nav-v2-open-drawer").click({ timeout: 5_000 });
    await expect(page.getByTestId("drawer-v2")).toBeVisible({ timeout: 5_000 });

    await page.getByTestId("drawer-v2-destination-habits").click({ timeout: 5_000 });
    await expect(page.getByTestId("nav-v2-route-pending")).toContainText("Habits", {
      timeout: 750,
    });

    const layers = await page.evaluate(() => {
      const zIndexOf = (testId: string) => {
        const element = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
        const parsed = Number.parseInt(window.getComputedStyle(element!).zIndex, 10);
        return Number.isFinite(parsed) ? parsed : 0;
      };

      return {
        backdrop: zIndexOf("drawer-v2-backdrop"),
        drawer: zIndexOf("drawer-v2"),
        pending: zIndexOf("nav-v2-route-pending"),
      };
    });

    expect(layers.pending).toBeGreaterThan(Math.max(layers.backdrop, layers.drawer));
  });

  test("phone drawer still preloads Habits on WebViews without requestIdleCallback", async ({
    page,
  }, testInfo) => {
    test.skip(
      !isLocalSourceDevServerTarget(testInfo),
      "source-module preload request evidence is only stable against Vite dev server"
    );

    let habitsRouteRequests = 0;
    await page.route(/\/src\/pages\/nav-v2\/HabitsPage\.tsx/, async (route) => {
      habitsRouteRequests += 1;
      await route.continue();
    });
    await page.addInitScript(() => {
      Object.defineProperty(window, "requestIdleCallback", {
        configurable: true,
        value: undefined,
      });
      Object.defineProperty(window, "cancelIdleCallback", {
        configurable: true,
        value: undefined,
      });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await primeWithFirstRunHint(page);

    await page.goto("orb?nav=v2&navLayout=phone&dev=true", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByTestId("mood-first-run-hint")).toBeVisible({
      timeout: 20_000,
    });
    await expect
      .poll(() => habitsRouteRequests, {
        message: "Habits route should preload through the setTimeout fallback",
        timeout: 1_500,
      })
      .toBeGreaterThan(0);
  });

  test("phone drawer keeps Mood to Habits responsive with populated habit history", async ({
    page,
  }) => {
    await installRoutePerfProbe(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await primeZenflowV2(page, {
      clearStorage: true,
      language: "en",
      theme: "paper",
    });
    await seedHeavyHabitsDataset(page);

    await page.goto("orb?nav=v2&navLayout=phone&dev=true", {
      waitUntil: "domcontentloaded",
    });

    await page.getByTestId("nav-v2-open-drawer").click({ timeout: 5_000 });
    await expect(page.getByTestId("drawer-v2")).toBeVisible({ timeout: 5_000 });
    await resetRoutePerfProbe(page);

    const startedAt = await page.evaluate(() => performance.now());
    await page.getByTestId("drawer-v2-destination-habits").click({
      timeout: 5_000,
    });

    await expectHabitsRouteVisible(page, {
      activeTimeout: 750,
      visibleTimeout: 2_500,
    });
    const routeVisibleAt = await page.evaluate(() => performance.now());
    await expect(page.getByTestId("drawer-v2")).toBeHidden({ timeout: 1_000 });
    await page.waitForTimeout(1_500);

    const metrics = await readRoutePerfMetrics(page, startedAt, routeVisibleAt);

    expect(metrics.tapToVisibleMs).toBeLessThan(1_500);
    expect(metrics.sampleWindowMs).toBeLessThan(4_000);
    expect(metrics.drawerMounted).toBe(false);
    expect(metrics.maxLongTaskMs).toBeLessThan(500);
    if (metrics.longAnimationFrameCount > 0) {
      expect(metrics.maxLongAnimationFrameBlockingMs).toBeLessThan(250);
    }
  });

  test("phone drawer keeps sibling V2 destinations responsive after Mood", async ({ page }) => {
    await installRoutePerfProbe(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await primeZenflowV2(page, {
      clearStorage: true,
      language: "en",
      theme: "paper",
    });

    const destinations: Array<{
      activePage: "diary" | "settings";
      destinationTestId: string;
      pageTestId: string;
    }> = [
      {
        activePage: "diary",
        destinationTestId: "drawer-v2-destination-diary",
        pageTestId: "diary-page",
      },
      {
        activePage: "settings",
        destinationTestId: "drawer-v2-destination-settings",
        pageTestId: "settings-page",
      },
    ];

    for (const destination of destinations) {
      await page.goto("orb?nav=v2&navLayout=phone&dev=true", {
        waitUntil: "domcontentloaded",
      });
      await page.getByTestId("nav-v2-open-drawer").click({ timeout: 5_000 });
      await expect(page.getByTestId("drawer-v2")).toBeVisible({ timeout: 5_000 });
      await resetRoutePerfProbe(page);

      const startedAt = await page.evaluate(() => performance.now());
      await page.getByTestId(destination.destinationTestId).click({ timeout: 5_000 });
      await expect(page.getByTestId("nav-v2-route-pending")).toContainText(
        destination.activePage === "diary" ? "Diary" : "Settings",
        { timeout: 750 },
      );

      await expect(page.getByTestId("nav-v2-orchestrator")).toHaveAttribute(
        "data-active-page",
        destination.activePage,
        { timeout: 1_000 },
      );
      await expect(page.getByTestId(destination.pageTestId)).toBeVisible({
        timeout: 2_500,
      });
      const routeVisibleAt = await page.evaluate(() => performance.now());
      await expect(page.getByTestId("drawer-v2")).toBeHidden({ timeout: 1_000 });
      await page.waitForTimeout(500);

      const metrics = await readRoutePerfMetrics(page, startedAt, routeVisibleAt);
      expect(metrics.tapToVisibleMs).toBeLessThan(1_500);
      expect(metrics.sampleWindowMs).toBeLessThan(3_000);
      expect(metrics.drawerMounted).toBe(false);
      expect(metrics.maxLongTaskMs).toBeLessThan(500);
      if (metrics.longAnimationFrameCount > 0) {
        expect(metrics.maxLongAnimationFrameBlockingMs).toBeLessThan(250);
      }
    }
  });

  test("dev compact web rail keeps Habits reachable while the first-run mood hint is visible", async ({
    page,
  }, testInfo) => {
    test.skip(
      !isLocalSourceDevServerTarget(testInfo),
      "compact web rail is a dev-only V2 preview layout; production phone uses the drawer"
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

    await expectHabitsRouteVisible(page, { visibleTimeout: 10_000 });
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

    await expectHabitsRouteVisible(page, { visibleTimeout: 10_000 });
  });
});
