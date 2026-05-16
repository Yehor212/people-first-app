import { afterEach, describe, expect, it, vi } from "vitest";
import {
  installRuntimePerformanceGuard,
  shouldEnableRuntimeFlightRecorder,
  shouldEnableRuntimePerformanceGuard,
} from "../runtimeFlightRecorder";
import { SK, SSK } from "@/lib/storageKeys";

type ObserverCb = (list: { getEntries: () => PerformanceEntry[] }) => void;

let instances: Array<{ cb: ObserverCb; observe: ReturnType<typeof vi.fn> }> = [];

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
    instances = [];
    delete window.__zenflowRuntimePerf;
    delete window.__zenflowRuntimePerfGuard;
    delete document.documentElement.dataset.runtimePerf;
    sessionStorage.removeItem(SSK.RUNTIME_PERF_GUARD);
    localStorage.removeItem(SK.RUNTIME_PERF_DEVICE_GUARD);
    vi.unstubAllGlobals();
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

  it("activates strained mode from a severe long animation frame", () => {
    installPerformanceObserverMock(["long-animation-frame"]);

    expect(installRuntimePerformanceGuard()).toBe(true);
    expect(instances[0].observe).toHaveBeenCalledWith({
      type: "long-animation-frame",
      buffered: true,
    });
    const startedAt = window.__zenflowRuntimePerfGuard?.snapshot().startedAt ?? 0;

    instances[0].cb({
      getEntries: () => [{ startTime: startedAt + 10, duration: 720 } as PerformanceEntry],
    });

    expect(document.documentElement.dataset.runtimePerf).toBe("strained");
    expect(sessionStorage.getItem(SSK.RUNTIME_PERF_GUARD)).toContain(
      "long-animation-frame",
    );
    expect(window.__zenflowRuntimePerfGuard?.snapshot().activated).toBe(true);
  });

  it("does not activate runtime guard from buffered entries before guard startup", () => {
    installPerformanceObserverMock(["long-animation-frame", "longtask"]);

    expect(installRuntimePerformanceGuard()).toBe(true);
    const startedAt = window.__zenflowRuntimePerfGuard?.snapshot().startedAt ?? 0;

    instances[0].cb({
      getEntries: () => [
        { startTime: Math.max(0, startedAt - 20), duration: 1400 } as PerformanceEntry,
      ],
    });
    instances[1].cb({
      getEntries: () => [
        { startTime: Math.max(0, startedAt - 10), duration: 1200 } as PerformanceEntry,
      ],
    });

    expect(document.documentElement.dataset.runtimePerf).toBeUndefined();
    expect(sessionStorage.getItem(SSK.RUNTIME_PERF_GUARD)).toBeNull();
    expect(window.__zenflowRuntimePerfGuard?.snapshot().maxLongAnimationFrameMs).toBe(0);
    expect(window.__zenflowRuntimePerfGuard?.snapshot().maxLongTaskMs).toBe(0);
  });

  it("waits for repeated borderline long animation frames before strained mode", () => {
    installPerformanceObserverMock(["long-animation-frame"]);

    expect(installRuntimePerformanceGuard()).toBe(true);
    const startedAt = window.__zenflowRuntimePerfGuard?.snapshot().startedAt ?? 0;

    instances[0].cb({
      getEntries: () => [{ startTime: startedAt + 20, duration: 470 } as PerformanceEntry],
    });

    expect(document.documentElement.dataset.runtimePerf).toBeUndefined();
    expect(sessionStorage.getItem(SSK.RUNTIME_PERF_GUARD)).toBeNull();
    expect(window.__zenflowRuntimePerfGuard?.snapshot().repeatedLoAFCount).toBe(1);

    instances[0].cb({
      getEntries: () => [{ startTime: startedAt + 40, duration: 490 } as PerformanceEntry],
    });

    expect(document.documentElement.dataset.runtimePerf).toBe("strained");
    expect(sessionStorage.getItem(SSK.RUNTIME_PERF_GUARD)).toContain(
      "repeated-long-animation-frame",
    );
    expect(localStorage.getItem(SK.RUNTIME_PERF_DEVICE_GUARD)).toContain(
      "repeated-long-animation-frame",
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
        version: 1,
        mode: "startup",
        reason: "long-animation-frame",
        duration: 900,
        activatedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      }),
    );

    expect(installRuntimePerformanceGuard()).toBe(true);

    expect(document.documentElement.dataset.runtimePerf).toBe("startup");
    expect(window.__zenflowRuntimePerfGuard?.snapshot().activated).toBe(false);
  });
});
