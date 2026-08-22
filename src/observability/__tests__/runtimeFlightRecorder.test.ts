import { afterEach, describe, expect, it, vi } from "vitest";
import {
  installRuntimeFlightRecorder,
  installRuntimePerformanceGuard,
  shouldEnableRuntimeFlightRecorder,
  shouldEnableRuntimePerformanceGuard,
} from "../runtimeFlightRecorder";
import { SK, SSK } from "@/lib/storageKeys";
import { resetAccountBoundaryRuntimeState } from "@/storage/accountBoundaryRuntime";

type ObserverCb = (list: { getEntries: () => PerformanceEntry[] }) => void;

let instances: Array<{
  cb: ObserverCb;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}> = [];

function performanceEntry({
  startTime,
  duration,
  blockingDuration,
}: {
  startTime: number;
  duration: number;
  blockingDuration?: number;
}): PerformanceEntry & { blockingDuration?: number } {
  return {
    name: "test-entry",
    entryType: "long-animation-frame",
    startTime,
    duration,
    blockingDuration,
    toJSON: () => ({ startTime, duration, blockingDuration }),
  };
}

function installPerformanceObserverMock(supported: string[]): void {
  const ctor = function (cb: ObserverCb) {
    const inst = { cb, observe: vi.fn(), disconnect: vi.fn() };
    instances.push(inst);
    return inst;
  } as unknown as {
    new (cb: ObserverCb): { cb: ObserverCb; observe: ReturnType<typeof vi.fn> };
    supportedEntryTypes: string[];
  };
  ctor.supportedEntryTypes = supported;
  vi.stubGlobal("PerformanceObserver", ctor);
}

describe("runtime flight recorder enablement", () => {
  afterEach(() => {
    resetAccountBoundaryRuntimeState();
    instances = [];
    delete window.__zenflowRuntimePerf;
    delete window.__zenflowRuntimePerfGuard;
    delete document.documentElement.dataset.runtimePerf;
    sessionStorage.removeItem(SSK.RUNTIME_PERF_GUARD);
    localStorage.removeItem(SK.RUNTIME_PERF_DEVICE_GUARD);
    window.history.replaceState({}, "", "/");
    vi.unstubAllGlobals();
  });

  it("removes query/deep-link canaries from the retained runtime guard snapshot", () => {
    const canary = "ZF_T172_PERF_AUTH_4Q8M2V7K5R9N";
    window.history.replaceState({}, "", `/orb/?code=${canary}&state=${canary}#${canary}`);
    installPerformanceObserverMock(["long-animation-frame"]);

    expect(installRuntimePerformanceGuard()).toBe(true);
    const startedAt = window.__zenflowRuntimePerfGuard?.snapshot().startedAt ?? 0;
    instances[0].cb({
      getEntries: () => [
        performanceEntry({ startTime: startedAt + 10, duration: 720, blockingDuration: 280 }),
      ],
    });

    const serialized = JSON.stringify({
      guard: window.__zenflowRuntimePerfGuard?.snapshot(),
      retained: sessionStorage.getItem(SSK.RUNTIME_PERF_GUARD),
    });
    expect(serialized).not.toContain(canary);
    expect(window.__zenflowRuntimePerfGuard?.snapshot().route).toBe("orb");
  });

  it("sanitizes explicit routes and LoAF script attribution in the flight recorder", () => {
    const canary = "ZF_T172_FLIGHT_DEEPLINK_9R3K7M2V5Q8N";
    window.history.replaceState({}, "", `/?perf=1&data=${canary}`);
    installPerformanceObserverMock(["long-animation-frame"]);

    expect(installRuntimeFlightRecorder()).toBe(true);
    window.__zenflowRuntimePerf?.markRoute(`/diary/${canary}?token=${canary}`);
    instances[0].cb({
      getEntries: () => [{
        ...performanceEntry({ startTime: 10, duration: 800, blockingDuration: 300 }),
        scripts: [{
          sourceURL: `https://example.test/chunk.js?token=${canary}`,
          sourceFunctionName: canary,
          invoker: canary,
          duration: 200,
        }],
      }],
    });

    const serialized = JSON.stringify(window.__zenflowRuntimePerf?.snapshot());
    expect(serialized).not.toContain(canary);
  });

  it("enables from explicit perf query flag", () => {
    expect(shouldEnableRuntimeFlightRecorder("?perf=1", "", false)).toBe(true);
    expect(shouldEnableRuntimeFlightRecorder("?runtimePerf=true", "", false)).toBe(true);
  });

  it("keeps explicit off stronger than dev mode", () => {
    expect(shouldEnableRuntimeFlightRecorder("?perf=0", "true", true)).toBe(false);
  });

  it("enables from stored diagnostic flag or local dev mode", () => {
    expect(shouldEnableRuntimeFlightRecorder("", "on", false)).toBe(true);
    expect(shouldEnableRuntimeFlightRecorder("", "", true)).toBe(true);
  });

  it("treats public dev route as an explicit diagnostic route", () => {
    expect(shouldEnableRuntimeFlightRecorder("?nav=v2&dev=true", "", false)).toBe(true);
  });

  it("keeps runtime performance guard enabled by default with explicit off escape hatch", () => {
    expect(shouldEnableRuntimePerformanceGuard("")).toBe(true);
    expect(shouldEnableRuntimePerformanceGuard("?runtimePerfGuard=off")).toBe(false);
    expect(shouldEnableRuntimePerformanceGuard("?perfGuard=1")).toBe(true);
  });

  it("activates strained mode from a severe blocking long animation frame", () => {
    installPerformanceObserverMock(["long-animation-frame"]);

    expect(installRuntimePerformanceGuard()).toBe(true);
    expect(instances[0].observe).toHaveBeenCalledWith({
      type: "long-animation-frame",
      buffered: true,
    });
    const startedAt = window.__zenflowRuntimePerfGuard?.snapshot().startedAt ?? 0;

    instances[0].cb({
      getEntries: () => [
        performanceEntry({ startTime: startedAt + 10, duration: 720, blockingDuration: 280 }),
      ],
    });

    expect(document.documentElement.dataset.runtimePerf).toBe("strained");
    expect(sessionStorage.getItem(SSK.RUNTIME_PERF_GUARD)).toContain(
      "blocking-long-animation-frame",
    );
    expect(window.__zenflowRuntimePerfGuard?.snapshot().activated).toBe(true);
  });

  it("does not activate strained mode from non-blocking render-only long animation frames", () => {
    installPerformanceObserverMock(["long-animation-frame"]);

    expect(installRuntimePerformanceGuard()).toBe(true);
    const startedAt = window.__zenflowRuntimePerfGuard?.snapshot().startedAt ?? 0;

    instances[0].cb({
      getEntries: () => [
        performanceEntry({ startTime: startedAt + 10, duration: 1400, blockingDuration: 0 }),
        performanceEntry({ startTime: startedAt + 20, duration: 900, blockingDuration: 0 }),
      ],
    });

    expect(document.documentElement.dataset.runtimePerf).toBeUndefined();
    expect(sessionStorage.getItem(SSK.RUNTIME_PERF_GUARD)).toBeNull();
    expect(window.__zenflowRuntimePerfGuard?.snapshot().repeatedLoAFCount).toBe(0);
    expect(window.__zenflowRuntimePerfGuard?.snapshot().maxLongAnimationFrameMs).toBe(1400);
    expect(window.__zenflowRuntimePerfGuard?.snapshot().maxLongAnimationFrameBlockingMs).toBe(0);
  });

  it("does not activate runtime guard from buffered entries before guard startup", () => {
    installPerformanceObserverMock(["long-animation-frame", "longtask"]);

    expect(installRuntimePerformanceGuard()).toBe(true);
    const startedAt = window.__zenflowRuntimePerfGuard?.snapshot().startedAt ?? 0;

    instances[0].cb({
      getEntries: () => [
        performanceEntry({
          startTime: Math.max(0, startedAt - 20),
          duration: 1400,
          blockingDuration: 400,
        }),
      ],
    });
    instances[1].cb({
      getEntries: () => [
        performanceEntry({ startTime: Math.max(0, startedAt - 10), duration: 1200 }),
      ],
    });

    expect(document.documentElement.dataset.runtimePerf).toBeUndefined();
    expect(sessionStorage.getItem(SSK.RUNTIME_PERF_GUARD)).toBeNull();
    expect(window.__zenflowRuntimePerfGuard?.snapshot().maxLongAnimationFrameMs).toBe(0);
    expect(window.__zenflowRuntimePerfGuard?.snapshot().maxLongAnimationFrameBlockingMs).toBe(0);
    expect(window.__zenflowRuntimePerfGuard?.snapshot().maxLongTaskMs).toBe(0);
  });

  it("waits for repeated borderline long animation frames before strained mode", () => {
    installPerformanceObserverMock(["long-animation-frame"]);

    expect(installRuntimePerformanceGuard()).toBe(true);
    const startedAt = window.__zenflowRuntimePerfGuard?.snapshot().startedAt ?? 0;

    instances[0].cb({
      getEntries: () => [
        performanceEntry({ startTime: startedAt + 20, duration: 470, blockingDuration: 140 }),
      ],
    });

    expect(document.documentElement.dataset.runtimePerf).toBeUndefined();
    expect(sessionStorage.getItem(SSK.RUNTIME_PERF_GUARD)).toBeNull();
    expect(window.__zenflowRuntimePerfGuard?.snapshot().repeatedLoAFCount).toBe(1);

    instances[0].cb({
      getEntries: () => [
        performanceEntry({ startTime: startedAt + 40, duration: 490, blockingDuration: 150 }),
      ],
    });

    expect(document.documentElement.dataset.runtimePerf).toBe("strained");
    expect(sessionStorage.getItem(SSK.RUNTIME_PERF_GUARD)).toContain(
      "repeated-blocking-long-animation-frame",
    );
    expect(localStorage.getItem(SK.RUNTIME_PERF_DEVICE_GUARD)).toContain(
      "repeated-blocking-long-animation-frame",
    );
    expect(localStorage.getItem(SK.RUNTIME_PERF_DEVICE_GUARD)).not.toContain(
      window.location.pathname,
    );
    expect(window.__zenflowRuntimePerfGuard?.snapshot().repeatedLoAFCount).toBe(2);
  });

  it("starts in warmup mode when this browser previously proved runtime strain", () => {
    localStorage.setItem(
      SK.RUNTIME_PERF_DEVICE_GUARD,
      JSON.stringify({
        version: 2,
        mode: "startup",
        reason: "blocking-long-animation-frame",
        duration: 900,
        activatedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      }),
    );

    expect(installRuntimePerformanceGuard()).toBe(true);

    expect(document.documentElement.dataset.runtimePerf).toBe("startup");
    expect(window.__zenflowRuntimePerfGuard?.snapshot().activated).toBe(false);
  });

  it("disconnects guard observers so post-reset entries cannot repopulate retained mode", () => {
    installPerformanceObserverMock(["long-animation-frame", "longtask"]);
    expect(installRuntimePerformanceGuard()).toBe(true);
    const startedAt = window.__zenflowRuntimePerfGuard?.snapshot().startedAt ?? 0;
    const staleCallbacks = instances.map((instance) => instance.cb);

    resetAccountBoundaryRuntimeState();
    for (const callback of staleCallbacks) {
      callback({ getEntries: () => [performanceEntry({ startTime: startedAt + 10, duration: 900, blockingDuration: 300 })] });
    }

    expect(window.__zenflowRuntimePerfGuard).toBeUndefined();
    expect(sessionStorage.getItem(SSK.RUNTIME_PERF_GUARD)).toBeNull();
    expect(localStorage.getItem(SK.RUNTIME_PERF_DEVICE_GUARD)).toBeNull();
    expect(instances.every((instance) => instance.disconnect.mock.calls.length === 1)).toBe(true);
  });
});
