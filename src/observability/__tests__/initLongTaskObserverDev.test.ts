import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ObserverCb = (list: { getEntries: () => unknown[] }) => void;

/** Captures instances so tests can drive entries into the observer callback. */
let instances: Array<{ cb: ObserverCb; observe: ReturnType<typeof vi.fn> }> = [];

function installPerformanceObserverMock(supported: string[]): void {
  const ctor = function (cb: ObserverCb) {
    const inst = { cb, observe: vi.fn(), disconnect: vi.fn() };
    instances.push(inst);
    return inst;
    // biome-ignore lint: legacy constructor shape
  } as unknown as {
    new (cb: ObserverCb): { cb: ObserverCb; observe: ReturnType<typeof vi.fn> };
    supportedEntryTypes: string[];
  };
  ctor.supportedEntryTypes = supported;
  vi.stubGlobal("PerformanceObserver", ctor);
}

describe("initLongTaskObserverDev", () => {
  beforeEach(() => {
    instances = [];
    delete (window as { __zenflowLoAF?: unknown }).__zenflowLoAF;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
    vi.resetModules();
  });

  it("no-ops in production even when LoAF is supported", async () => {
    vi.stubEnv("DEV", false);
    installPerformanceObserverMock(["long-animation-frame"]);
    const { initLongTaskObserverDev } = await import("../initLongTaskObserverDev");

    initLongTaskObserverDev();

    expect(instances).toHaveLength(0);
    expect((window as { __zenflowLoAF?: unknown }).__zenflowLoAF).toBeUndefined();
  });

  it("registers a long-animation-frame observer when supported in DEV", async () => {
    vi.stubEnv("DEV", true);
    installPerformanceObserverMock(["long-animation-frame", "longtask"]);
    const { initLongTaskObserverDev } = await import("../initLongTaskObserverDev");

    initLongTaskObserverDev();

    expect(instances).toHaveLength(1);
    expect(instances[0].observe).toHaveBeenCalledWith({
      type: "long-animation-frame",
      buffered: true,
    });
    expect(window.__zenflowLoAF?.supported.loaf).toBe(true);
    expect(window.__zenflowLoAF?.supported.longtask).toBe(true);
  });

  it("falls back to longtask observer when LoAF is unsupported (Safari/Firefox)", async () => {
    vi.stubEnv("DEV", true);
    installPerformanceObserverMock(["longtask"]);
    const { initLongTaskObserverDev } = await import("../initLongTaskObserverDev");

    initLongTaskObserverDev();

    expect(instances).toHaveLength(1);
    expect(instances[0].observe).toHaveBeenCalledWith({ type: "longtask", buffered: true });
    expect(window.__zenflowLoAF?.supported.loaf).toBe(false);
    expect(window.__zenflowLoAF?.supported.longtask).toBe(true);
  });

  it("bails silently when neither API is supported", async () => {
    vi.stubEnv("DEV", true);
    installPerformanceObserverMock([]);
    const { initLongTaskObserverDev } = await import("../initLongTaskObserverDev");

    initLongTaskObserverDev();

    expect(instances).toHaveLength(0);
    expect((window as { __zenflowLoAF?: unknown }).__zenflowLoAF).toBeUndefined();
  });

  it("records LoAF entries into the rolling top-offenders map", async () => {
    vi.stubEnv("DEV", true);
    installPerformanceObserverMock(["long-animation-frame"]);
    const { initLongTaskObserverDev } = await import("../initLongTaskObserverDev");

    initLongTaskObserverDev();

    // Simulate a slow frame with two attributed scripts.
    instances[0].cb({
      getEntries: () => [
        {
          startTime: 100,
          scripts: [
            {
              sourceURL: "https://app/chunk-a.js",
              sourceFunctionName: "onClick",
              duration: 120,
            },
            {
              sourceURL: "https://app/chunk-a.js",
              sourceFunctionName: "render",
              duration: 40,
            },
          ],
        },
      ],
    });

    const top = window.__zenflowLoAF?.topOffenders.get("https://app/chunk-a.js");
    expect(top?.count).toBe(2);
    expect(top?.totalDuration).toBe(160);
    expect(top?.worstDuration).toBe(120);
  });

  it("counts longtask entries when fallback path is active", async () => {
    vi.stubEnv("DEV", true);
    installPerformanceObserverMock(["longtask"]);
    const { initLongTaskObserverDev } = await import("../initLongTaskObserverDev");

    initLongTaskObserverDev();

    instances[0].cb({
      getEntries: () => [{}, {}, {}],
    });

    expect(window.__zenflowLoAF?.longTasks).toBe(3);
  });

  it("never throws when PerformanceObserver is missing entirely", async () => {
    vi.stubEnv("DEV", true);
    vi.stubGlobal("PerformanceObserver", undefined);
    const { initLongTaskObserverDev } = await import("../initLongTaskObserverDev");

    expect(() => initLongTaskObserverDev()).not.toThrow();
  });
});
