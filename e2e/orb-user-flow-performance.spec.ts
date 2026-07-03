import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { primeZenflowV2, v2RoutePath } from "./helpers/zenflowV2State";

const OUTPUT_DIR = path.resolve(
  process.cwd(),
  "output/playwright/orb-user-flow-performance-2026-07-01",
);
const MAX_LONG_TASK_MS = readBudget("ZENFLOW_USER_FLOW_MAX_LONG_TASK_MS", 250);
const MAX_LOAF_BLOCKING_MS = readBudget("ZENFLOW_USER_FLOW_MAX_LOAF_BLOCKING_MS", 120);
const MAX_ACTION_MEASURE_MS = readBudget("ZENFLOW_USER_FLOW_MAX_ACTION_MS", 1800);
const MAX_INTERACTION_EVENT_TIMING_MS = readBudget(
  "ZENFLOW_USER_FLOW_MAX_INTERACTION_EVENT_MS",
  readBudget("ZENFLOW_USER_FLOW_MAX_EVENT_TIMING_MS", 500),
);
const MAX_ORB_VISUAL_READY_MS = readBudget("ZENFLOW_USER_FLOW_MAX_ORB_VISUAL_READY_MS", 2500);

type UserFlowPerfWindow = typeof window & {
  __zenflowUserFlowPerf?: {
    actionMeasures: Array<{
      duration: number;
      name: string;
    }>;
    actionWindows: Array<{
      endTime: number;
      name: string;
      startTime: number;
    }>;
    longAnimationFrames: Array<{
      blockingDuration: number;
      duration: number;
      firstUIEventTimestamp?: number;
      scripts: Array<{
        duration: number;
        forcedStyleAndLayoutDuration?: number;
        invoker?: string;
        invokerType?: string;
        pauseDuration?: number;
        sourceFunctionName?: string;
        sourceURL?: string;
      }>;
      startTime: number;
    }>;
    longTasks: Array<{
      duration: number;
      name: string;
      startTime: number;
    }>;
    eventTimings: Array<{
      duration: number;
      interactionId: number;
      name: string;
      startTime: number;
    }>;
    eventTimingObserverUnavailable?: boolean;
    longAnimationFrameObserverUnavailable?: boolean;
    longTaskObserverUnavailable?: boolean;
  };
};

function readBudget(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readGitSha() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

async function primeMeasuredApp(page: Page) {
  await page.addInitScript(() => {
    const win = window as UserFlowPerfWindow;
    win.__zenflowUserFlowPerf = {
      actionWindows: [],
      actionMeasures: [],
      eventTimings: [],
      longAnimationFrames: [],
      longTasks: [],
    };

    try {
      new PerformanceObserver((list) => {
        const perf = win.__zenflowUserFlowPerf;
        if (!perf) return;
        perf.longTasks.push(
          ...list.getEntries().map((entry) => ({
            duration: entry.duration,
            name: entry.name,
            startTime: entry.startTime,
          })),
        );
      }).observe({ type: "longtask", buffered: true });
    } catch {
      win.__zenflowUserFlowPerf.longTaskObserverUnavailable = true;
    }

    try {
      new PerformanceObserver((list) => {
        const perf = win.__zenflowUserFlowPerf;
        if (!perf) return;
        perf.longAnimationFrames.push(
          ...list.getEntries().map((entry) => {
            const frame = entry as PerformanceEntry & {
              blockingDuration?: number;
              firstUIEventTimestamp?: number;
              scripts?: Array<{
                duration?: number;
                forcedStyleAndLayoutDuration?: number;
                invoker?: string;
                invokerType?: string;
                pauseDuration?: number;
                sourceFunctionName?: string;
                sourceURL?: string;
              }>;
            };
            return {
              blockingDuration: frame.blockingDuration ?? 0,
              duration: frame.duration,
              firstUIEventTimestamp: frame.firstUIEventTimestamp,
              scripts: (frame.scripts ?? []).slice(0, 8).map((script) => ({
                duration: script.duration ?? 0,
                forcedStyleAndLayoutDuration: script.forcedStyleAndLayoutDuration,
                invoker: script.invoker,
                invokerType: script.invokerType,
                pauseDuration: script.pauseDuration,
                sourceFunctionName: script.sourceFunctionName,
                sourceURL: script.sourceURL,
              })),
              startTime: frame.startTime,
            };
          }),
        );
      }).observe({ type: "long-animation-frame", buffered: true });
    } catch {
      win.__zenflowUserFlowPerf.longAnimationFrameObserverUnavailable = true;
    }

    try {
      const eventTimingObserverOptions = {
        type: "event",
        buffered: true,
        durationThreshold: 16,
      } as PerformanceObserverInit & { durationThreshold: number };
      new PerformanceObserver((list) => {
        const perf = win.__zenflowUserFlowPerf;
        if (!perf) return;
        perf.eventTimings.push(
          ...list.getEntries().map((entry) => ({
            duration: entry.duration,
            interactionId: (entry as PerformanceEventTiming & { interactionId?: number })
              .interactionId ?? 0,
            name: entry.name,
            startTime: entry.startTime,
          })),
        );
      }).observe(eventTimingObserverOptions);
    } catch {
      win.__zenflowUserFlowPerf.eventTimingObserverUnavailable = true;
    }
  });

  await primeZenflowV2(page, {
    language: "en",
    theme: "paper",
    user: {
      id: "orb-user-flow-performance",
      name: "Performance Probe",
    },
  });
}

async function resetPerf(page: Page) {
  await page.evaluate(() => {
    const win = window as UserFlowPerfWindow;
    const perf = win.__zenflowUserFlowPerf;
    if (!perf) throw new Error("User-flow performance probe was not installed");
    perf.actionWindows = [];
    perf.actionMeasures = [];
    perf.eventTimings = [];
    perf.longAnimationFrames = [];
    perf.longTasks = [];
    performance.clearMarks();
    performance.clearMeasures();
  });
}

async function waitForTwoFrames(page: Page) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

async function timedAction(
  page: Page,
  label: string,
  action: () => Promise<void>,
) {
  const actionStartedAt = await page.evaluate(() => {
    return performance.now();
  });
  await action();
  await waitForTwoFrames(page);
  await page.evaluate(({ label, actionStartedAt }) => {
    const actionEndedAt = performance.now();
    const win = window as UserFlowPerfWindow;
    win.__zenflowUserFlowPerf?.actionWindows.push({
      endTime: actionEndedAt,
      name: label,
      startTime: actionStartedAt,
    });
    win.__zenflowUserFlowPerf?.actionMeasures.push({
      duration: actionEndedAt - actionStartedAt,
      name: label,
    });
  }, { label, actionStartedAt });
}

async function collectPerfReport(page: Page) {
  return page.evaluate(() => {
    const inpEventNames = new Set([
      "beforeinput",
      "click",
      "input",
      "keydown",
      "mousedown",
      "mouseup",
      "pointerdown",
      "pointerup",
      "touchend",
      "touchstart",
    ]);
    const win = window as UserFlowPerfWindow;
    const perf = win.__zenflowUserFlowPerf;
    if (!perf) throw new Error("User-flow performance probe was not installed");
    const actionWindows = perf.actionWindows.slice();
    const actionForEntry = (entry: {
      duration: number;
      firstUIEventTimestamp?: number;
      startTime: number;
    }) => {
      if (entry.firstUIEventTimestamp && entry.firstUIEventTimestamp > 0) {
        const interactionMatch = actionWindows.find(
          (actionWindow) =>
            entry.firstUIEventTimestamp !== undefined &&
            entry.firstUIEventTimestamp >= actionWindow.startTime &&
            entry.firstUIEventTimestamp <= actionWindow.endTime,
        );
        return interactionMatch?.name ?? "unattributed";
      }
      const entryEnd = entry.startTime + (entry.duration || 0);
      const match = actionWindows.find(
        (actionWindow) =>
          entry.startTime <= actionWindow.endTime && entryEnd >= actionWindow.startTime,
      );
      return match?.name ?? "unattributed";
    };
    const longTasks = perf.longTasks.map((entry) => ({
      ...entry,
      action: actionForEntry(entry),
    }));
    const longAnimationFrames = perf.longAnimationFrames.map((entry) => ({
      ...entry,
      action: actionForEntry(entry),
    }));
    const eventTimings = perf.eventTimings.map((entry) => ({
      ...entry,
      action: actionForEntry(entry),
    }));
    const interactionEventTimings = eventTimings.filter(
      (entry) => entry.interactionId > 0 || inpEventNames.has(entry.name),
    );
    const routeMountActionNames = new Set(["drawer-route-settings", "drawer-route-orb-return"]);
    const directInteractionEventTimings = interactionEventTimings.filter(
      (entry) => !routeMountActionNames.has(entry.action),
    );
    const directLongTasks = longTasks.filter((entry) => !routeMountActionNames.has(entry.action));
    const directLongAnimationFrames = longAnimationFrames.filter(
      (entry) => !routeMountActionNames.has(entry.action),
    );
    const measures = perf.actionMeasures.slice();
    const directActionMeasures = measures.filter(
      (entry) => !routeMountActionNames.has(entry.name),
    );
    const routeMountActionMeasures = measures.filter((entry) =>
      routeMountActionNames.has(entry.name),
    );
    const memory = (
      performance as Performance & {
        memory?: {
          jsHeapSizeLimit: number;
          totalJSHeapSize: number;
          usedJSHeapSize: number;
        };
      }
    ).memory;

    return {
      eventTimingObserverUnavailable: perf.eventTimingObserverUnavailable === true,
      longAnimationFrameObserverUnavailable:
        perf.longAnimationFrameObserverUnavailable === true,
      longTaskObserverUnavailable: perf.longTaskObserverUnavailable === true,
      actionWindows,
      longTaskCount: longTasks.length,
      maxLongTaskMs: Math.max(0, ...longTasks.map((entry) => entry.duration || 0)),
      directLongTaskCount: directLongTasks.length,
      maxDirectLongTaskMs: Math.max(0, ...directLongTasks.map((entry) => entry.duration || 0)),
      longAnimationFrameCount: longAnimationFrames.length,
      maxLongAnimationFrameMs: Math.max(
        0,
        ...longAnimationFrames.map((entry) => entry.duration || 0),
      ),
      maxLongAnimationFrameBlockingMs: Math.max(
        0,
        ...longAnimationFrames.map((entry) => entry.blockingDuration || 0),
      ),
      directLongAnimationFrameCount: directLongAnimationFrames.length,
      maxDirectLongAnimationFrameBlockingMs: Math.max(
        0,
        ...directLongAnimationFrames.map((entry) => entry.blockingDuration || 0),
      ),
      eventTimingCount: eventTimings.length,
      interactionEventTimingCount: interactionEventTimings.length,
      directInteractionEventTimingCount: directInteractionEventTimings.length,
      maxEventTimingMs: Math.max(0, ...eventTimings.map((entry) => entry.duration || 0)),
      maxInteractionEventTimingMs: Math.max(
        0,
        ...interactionEventTimings.map((entry) => entry.duration || 0),
      ),
      maxDirectInteractionEventTimingMs: Math.max(
        0,
        ...directInteractionEventTimings.map((entry) => entry.duration || 0),
      ),
      measures,
      directActionMeasures,
      routeMountActionMeasures,
      maxActionMeasureMs: Math.max(0, ...measures.map((entry) => entry.duration || 0)),
      maxDirectActionMeasureMs: Math.max(
        0,
        ...directActionMeasures.map((entry) => entry.duration || 0),
      ),
      maxRouteMountActionMeasureMs: Math.max(
        0,
        ...routeMountActionMeasures.map((entry) => entry.duration || 0),
      ),
      nodeCount: document.querySelectorAll("*").length,
      memory: memory
        ? {
            jsHeapSizeLimit: memory.jsHeapSizeLimit,
            totalJSHeapSize: memory.totalJSHeapSize,
            usedJSHeapSize: memory.usedJSHeapSize,
          }
        : null,
      topLongTasks: longTasks
        .slice()
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5),
      topLongAnimationFrames: longAnimationFrames
        .slice()
        .sort((a, b) => b.blockingDuration - a.blockingDuration || b.duration - a.duration)
        .slice(0, 5),
      topEventTimings: eventTimings
        .slice()
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5),
      topInteractionEventTimings: interactionEventTimings
        .slice()
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5),
      topDirectInteractionEventTimings: directInteractionEventTimings
        .slice()
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5),
    };
  });
}

test.describe("Orb user-flow performance", () => {
  test("keeps repeated V2 mood and settings interactions responsive", async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const location = message.location();
      const source = location.url
        ? ` (${location.url}:${location.lineNumber}:${location.columnNumber})`
        : "";
      consoleErrors.push(`${message.text()}${source}`);
    });
    page.on("requestfailed", (request) => {
      failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText}`);
    });
    page.on("response", (response) => {
      if (response.status() < 400) return;
      failedRequests.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    });

    await page.emulateMedia({ colorScheme: "light" });
    await page.setViewportSize({ width: 390, height: 844 });
    await primeMeasuredApp(page);
    await page.goto(v2RoutePath("orb", { layout: "phone" }), {
      waitUntil: "domcontentloaded",
    });
    const orbRouteReadyStartedAt = await page.evaluate(() => performance.now());
    await expect(page.getByTestId("orb-page-next")).toBeVisible({ timeout: 30_000 });
    await page
      .getByTestId("orb-page-hero")
      .locator("[data-orb-visual-ready='true']")
      .first()
      .waitFor({
        state: "attached",
        timeout: MAX_ORB_VISUAL_READY_MS,
      });
    const orbVisualReadyMs = await page.evaluate(
      (startedAt) => performance.now() - startedAt,
      orbRouteReadyStartedAt,
    );
    await page.evaluate(() => document.fonts.ready);
    await waitForTwoFrames(page);
    if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
    await page.getByTestId("orb-page").screenshot({
      animations: "disabled",
      path: path.join(OUTPUT_DIR, "orb-phone-initial.png"),
    });
    await resetPerf(page);

    await timedAction(page, "orb-slider-pointer", async () => {
      const slider = page.getByRole("slider").first();
      const box = await slider.boundingBox();
      if (!box) throw new Error("Mood slider box was not available");
      const y = box.y + box.height / 2;
      await page.mouse.move(box.x + box.width * 0.5, y);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.72, y, { steps: 3 });
      await page.mouse.move(box.x + box.width * 0.88, y, { steps: 3 });
      await page.mouse.up();
    });

    for (let attempt = 1; attempt <= 3; attempt++) {
      await timedAction(page, `orb-slider-keyboard-${attempt}`, async () => {
        const slider = page.getByRole("slider").first();
        await slider.focus();
        for (const key of [
          "Home",
          "ArrowRight",
          "ArrowRight",
          "ArrowRight",
          "ArrowLeft",
          "End",
        ]) {
          await page.keyboard.press(key);
        }
        await expect(slider).toHaveAttribute("aria-valuenow", "6");
        await page.waitForTimeout(140);
      });
    }

    await timedAction(page, "orb-select-to-refine", async () => {
      await page.getByTestId("orb-page-next").click();
      await expect(page.getByTestId("orb-page-refine")).toBeVisible();
    });

    await timedAction(page, "orb-note-input", async () => {
      await page.getByTestId("orb-page-note-input").fill("Quick performance proof");
    });

    await timedAction(page, "orb-refine-back", async () => {
      await page.getByTestId("orb-page-back").click();
      await expect(page.getByTestId("orb-page-next")).toBeVisible();
    });

    await timedAction(page, "drawer-route-settings", async () => {
      await page.getByTestId("nav-v2-open-drawer").click();
      await expect(page.getByTestId("drawer-v2")).toBeVisible();
      await page.getByTestId("drawer-v2-destination-settings").click();
      await expect(page.getByTestId("settings-page")).toBeVisible();
    });

    await timedAction(page, "settings-sound-toggle", async () => {
      await page.getByTestId("settings-module-card-sound").click();
      await expect(page.getByTestId("settings-v2-panel-sound")).toBeVisible();
      await page.getByTestId("settings-v2-app-sound-toggle").locator("button").click();
    });

    await timedAction(page, "drawer-route-orb-return", async () => {
      await page.getByTestId("nav-v2-open-drawer").click();
      await expect(page.getByTestId("drawer-v2")).toBeVisible();
      await page.getByTestId("drawer-v2-destination-orb").click();
      await expect(page.getByTestId("orb-page")).toBeVisible();
    });

    const report = await collectPerfReport(page);
    const output = {
      generatedAt: new Date().toISOString(),
      baseURL: String(testInfo.project.use.baseURL ?? ""),
      budgets: {
        maxActionMeasureMs: MAX_ACTION_MEASURE_MS,
        maxDirectInteractionEventTimingMs: MAX_INTERACTION_EVENT_TIMING_MS,
        maxLongAnimationFrameBlockingMs: MAX_LOAF_BLOCKING_MS,
        maxLongTaskMs: MAX_LONG_TASK_MS,
        maxOrbVisualReadyMs: MAX_ORB_VISUAL_READY_MS,
      },
      consoleErrors,
      failedRequests,
      startup: {
        orbVisualReadyMs,
      },
      evidence: {
        browserName: testInfo.project.name,
        gitSha: readGitSha(),
        projectName: testInfo.project.name,
        retry: testInfo.retry,
        testTitle: testInfo.title,
      },
      report,
    };
    writeFileSync(
      path.join(OUTPUT_DIR, "orb-settings-user-flow-performance.json"),
      `${JSON.stringify(output, null, 2)}\n`,
    );

    expect(consoleErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
    expect(report.eventTimingObserverUnavailable).toBe(false);
    expect(report.longAnimationFrameObserverUnavailable).toBe(false);
    expect(report.longTaskObserverUnavailable).toBe(false);
    expect(report.measures.map((entry) => entry.name)).toEqual(
      expect.arrayContaining([
        "orb-slider-keyboard-1",
        "orb-slider-keyboard-2",
        "orb-slider-keyboard-3",
      ]),
    );
    expect(orbVisualReadyMs).toBeLessThanOrEqual(MAX_ORB_VISUAL_READY_MS);
    expect(report.interactionEventTimingCount).toBeGreaterThan(0);
    expect(report.directInteractionEventTimingCount).toBeGreaterThan(0);
    expect(report.maxDirectInteractionEventTimingMs).toBeLessThanOrEqual(
      MAX_INTERACTION_EVENT_TIMING_MS,
    );
    expect(report.maxDirectLongTaskMs).toBeLessThanOrEqual(MAX_LONG_TASK_MS);
    expect(report.maxDirectLongAnimationFrameBlockingMs).toBeLessThanOrEqual(MAX_LOAF_BLOCKING_MS);
    expect(report.maxDirectActionMeasureMs).toBeLessThanOrEqual(MAX_ACTION_MEASURE_MS);
  });
});
