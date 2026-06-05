import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { createElement } from "react";

import {
  ORB_TRANSITION_SETTINGS,
  ValenceOrb,
  WEBGL_FORCED_FIRST_FRAME_TIMEOUT_MS,
  WEBGL_VISIBILITY_RETRY_INTERVAL_MS,
  WEBGL_WORKER_READY_BUDGET_MS,
  allowsFirstPaintFallback,
  resolveCanonicalWebGLUpgradeScheduling,
  resolveFrameTransitionProfile,
  resolveOrbFrameDeltaSeconds,
  resolveOrbFrameInterval,
  resolveOrbTransitionSettings,
  resetOrbRuntimeSnapshotsForTests,
  shouldApplyWorkerWebGLUpgrade,
  shouldDropLateVisibleWebGLUpgrade,
  shouldStartIdleWakeSoftening,
  shouldUseWorkerWebGL,
} from "../ValenceOrb";

import { drawOrbScene } from "../orbRenderer";
import { createOrbGL, createOrbGL2, createOrbGL2Async, createOrbGLAsync } from "../orbShader";

vi.mock("../orbRenderer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../orbRenderer")>();
  return {
    ...actual,
    drawOrbScene: vi.fn(),
  };
});

vi.mock("../orbShader", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../orbShader")>();
  return {
    ...actual,
    createOrbGL: vi.fn(() => null),
    createOrbGL2: vi.fn(() => null),
    createOrbGL2Async: vi.fn(() => Promise.resolve(null)),
    createOrbGLAsync: vi.fn(() => Promise.resolve(null)),
  };
});

function createMockGLRenderer() {
  return {
    render: vi.fn(),
    dispose: vi.fn(),
    isContextLost: vi.fn(() => false),
  };
}

beforeEach(() => {
  vi.mocked(drawOrbScene).mockClear();
  stubCanvasContexts();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.mocked(createOrbGL).mockReset();
  vi.mocked(createOrbGL).mockReturnValue(null);
  vi.mocked(createOrbGL2).mockReset();
  vi.mocked(createOrbGL2).mockReturnValue(null);
  vi.mocked(createOrbGL2Async).mockReset();
  vi.mocked(createOrbGL2Async).mockResolvedValue(null);
  vi.mocked(createOrbGLAsync).mockReset();
  vi.mocked(createOrbGLAsync).mockResolvedValue(null);
  resetOrbRuntimeSnapshotsForTests();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.runtimePerf;
});

function stubVisibleOrbRect() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: 240,
    height: 240,
    top: 0,
    left: 0,
    right: 240,
    bottom: 240,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

function stubCanvasContexts(supportsParallelShaderCompile = true) {
  const spy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(((contextId: string) => {
    if (contextId === "2d") {
      return {} as CanvasRenderingContext2D;
    }
    if (contextId === "webgl" || contextId === "webgl2") {
      return {
        getExtension: vi.fn((name: string) => {
          if (name === "KHR_parallel_shader_compile" && supportsParallelShaderCompile) {
            return { COMPLETION_STATUS_KHR: 0x91b1 };
          }
          if (name === "WEBGL_lose_context") {
            return { loseContext: vi.fn() };
          }
          return null;
        }),
      } as unknown as WebGLRenderingContext;
    }
    return null;
  }) as HTMLCanvasElement["getContext"]);
  resetOrbRuntimeSnapshotsForTests();
  return spy;
}

function installQueuedRaf() {
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextFrameId = 1;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    const frameId = nextFrameId++;
    callbacks.set(frameId, callback);
    return frameId;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((frameId) => {
    callbacks.delete(frameId);
  });

  return {
    pendingCount() {
      return callbacks.size;
    },
    flushNextFrame() {
      const nextEntry = callbacks.entries().next().value;
      if (!nextEntry) return;
      const [frameId, callback] = nextEntry;
      callbacks.delete(frameId);
      callback?.(performance.now());
    },
    flushFrameAt(timestamp: number) {
      const nextEntry = callbacks.entries().next().value;
      if (!nextEntry) return;
      const [frameId, callback] = nextEntry;
      callbacks.delete(frameId);
      callback?.(timestamp);
    },
  };
}

async function flushScheduledWebGLUpgrade(flushNextFrame: () => void) {
  await act(async () => {
    flushNextFrame();
    vi.advanceTimersByTime(1000);
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function flushScheduledMiniWebGLUpgrade(flushNextFrame: () => void) {
  await act(async () => {
    flushNextFrame();
    vi.advanceTimersByTime(1_000);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("ValenceOrb motion profile", () => {
  function simulateVisualTransitionProgress({
    profile,
    from,
    to,
    durationMs,
  }: {
    profile: "standard" | "v1-soft" | "input-soft";
    from: number;
    to: number;
    durationMs: number;
  }) {
    let currentValence = from;
    let smoothValence = from;
    const frameMs = 1000 / 60;
    const frames = Math.round(durationMs / frameMs);

    for (let frame = 0; frame < frames; frame += 1) {
      const targetDelta = to - currentValence;
      const { targetBaseLerp } = resolveOrbTransitionSettings(
        profile,
        Math.abs(targetDelta),
      );
      const currentLerp = 1 - Math.pow(1 - targetBaseLerp, (frameMs / 1000) * 30);
      currentValence += targetDelta * currentLerp;

      const visualDelta = currentValence - smoothValence;
      const { visualBaseLerp } = resolveOrbTransitionSettings(
        profile,
        Math.abs(visualDelta),
      );
      const visualLerp = 1 - Math.pow(1 - visualBaseLerp, (frameMs / 1000) * 60);
      smoothValence += (currentValence - smoothValence) * visualLerp;
    }

    return (smoothValence - from) / (to - from);
  }

  it("keeps the shared default profile slower than the legacy standard profile", () => {
    expect(ORB_TRANSITION_SETTINGS["v1-soft"].targetBaseLerp).toBeLessThan(
      ORB_TRANSITION_SETTINGS.standard.targetBaseLerp,
    );
    expect(ORB_TRANSITION_SETTINGS["v1-soft"].visualBaseLerp).toBeLessThan(
      ORB_TRANSITION_SETTINGS.standard.visualBaseLerp,
    );
  });

  it("keeps large V1-soft mood jumps slow enough to feel gentle", () => {
    expect(
      simulateVisualTransitionProgress({
        profile: "v1-soft",
        from: -0.143,
        to: 1,
        durationMs: 500,
      }),
    ).toBeLessThanOrEqual(0.08);
    expect(
      simulateVisualTransitionProgress({
        profile: "v1-soft",
        from: -0.143,
        to: 1,
        durationMs: 2000,
      }),
    ).toBeLessThanOrEqual(0.5);
  });

  it("slows the final settle tail instead of snapping into the target", () => {
    const broadMove = resolveOrbTransitionSettings("v1-soft", 0.7);
    const finalTail = resolveOrbTransitionSettings("v1-soft", 0.08);

    expect(finalTail.targetBaseLerp).toBeLessThan(broadMove.targetBaseLerp);
    expect(finalTail.visualBaseLerp).toBeLessThan(broadMove.visualBaseLerp);
  });

  it("preserves the old standard profile when explicitly requested", () => {
    const broadMove = resolveOrbTransitionSettings("standard", 0.7);
    const finalTail = resolveOrbTransitionSettings("standard", 0.08);

    expect(finalTail).toEqual(broadMove);
  });

  it("keeps direct slider input responsive without turning the orb into a fast spin", () => {
    const broadMove = resolveOrbTransitionSettings("input-soft", 0.7);
    const finalTail = resolveOrbTransitionSettings("input-soft", 0.04);
    const slowTail = resolveOrbTransitionSettings("v1-soft", 0.04);
    const shimmerMove = resolveOrbTransitionSettings("input-soft", 0.7, true);

    expect(broadMove.targetBaseLerp).toBeGreaterThan(
      ORB_TRANSITION_SETTINGS["v1-soft"].targetBaseLerp,
    );
    expect(broadMove.visualBaseLerp).toBeGreaterThan(
      ORB_TRANSITION_SETTINGS["v1-soft"].visualBaseLerp,
    );
    expect(broadMove.targetBaseLerp).toBeLessThanOrEqual(
      ORB_TRANSITION_SETTINGS.standard.targetBaseLerp * 1.25,
    );
    expect(broadMove.visualBaseLerp).toBeLessThan(
      ORB_TRANSITION_SETTINGS.standard.visualBaseLerp,
    );
    expect(shimmerMove.targetBaseLerp).toBeLessThan(broadMove.targetBaseLerp);
    expect(finalTail.targetBaseLerp).toBeLessThan(broadMove.targetBaseLerp);
    expect(finalTail.targetBaseLerp).toBeGreaterThan(slowTail.targetBaseLerp);
    expect(finalTail.visualBaseLerp).toBeLessThan(broadMove.visualBaseLerp);
  });

  it("softens the first input transition after the orb has been idle", () => {
    expect(shouldStartIdleWakeSoftening("input-soft", 9000, -0.667)).toBe(true);
    expect(shouldStartIdleWakeSoftening("input-soft", 1000, -0.667)).toBe(false);
    expect(shouldStartIdleWakeSoftening("v1-soft", 9000, -0.667)).toBe(false);

    expect(resolveFrameTransitionProfile("input-soft", true)).toBe("v1-soft");
    expect(resolveFrameTransitionProfile("input-soft", false)).toBe("input-soft");
    expect(resolveFrameTransitionProfile("standard", true)).toBe("standard");
  });

  it("rejects late WebGL upgrades unless an explicit debug override is active", () => {
    expect(WEBGL_WORKER_READY_BUDGET_MS).toBeLessThanOrEqual(700);
    expect(shouldApplyWorkerWebGLUpgrade(WEBGL_WORKER_READY_BUDGET_MS - 1)).toBe(true);
    expect(shouldApplyWorkerWebGLUpgrade(WEBGL_WORKER_READY_BUDGET_MS + 1)).toBe(false);
    expect(shouldApplyWorkerWebGLUpgrade(WEBGL_WORKER_READY_BUDGET_MS + 5000, true)).toBe(true);
  });

  it("keeps a stable visible forced-WebGL canvas instead of swapping it late", () => {
    expect(
      shouldDropLateVisibleWebGLUpgrade({
        forceCanonicalWebGL: true,
        explicitWebGLOverride: false,
        visualReady: true,
        visibleCanvasAgeMs: 1201,
      }),
    ).toBe(true);
    expect(
      shouldDropLateVisibleWebGLUpgrade({
        forceCanonicalWebGL: true,
        explicitWebGLOverride: false,
        visualReady: false,
        visibleCanvasAgeMs: 20_000,
      }),
    ).toBe(false);
    expect(
      shouldDropLateVisibleWebGLUpgrade({
        forceCanonicalWebGL: true,
        explicitWebGLOverride: true,
        visualReady: true,
        visibleCanvasAgeMs: 20_000,
      }),
    ).toBe(false);
    expect(
      shouldDropLateVisibleWebGLUpgrade({
        forceCanonicalWebGL: false,
        explicitWebGLOverride: false,
        visualReady: true,
        visibleCanvasAgeMs: 20_000,
      }),
    ).toBe(false);
  });

  it("defers full canonical WebGL startup past first paint while staggering mini upgrades", () => {
    const fullOrb = resolveCanonicalWebGLUpgradeScheduling(true, 240, 1000, 1000);
    const firstMini = resolveCanonicalWebGLUpgradeScheduling(true, 120, 1000, 1000);
    const secondMini = resolveCanonicalWebGLUpgradeScheduling(
      true,
      120,
      1000,
      firstMini.nextMiniUpgradeStartAt,
    );
    const autoOrb = resolveCanonicalWebGLUpgradeScheduling(false, 120, 1000, 1000);

    expect(fullOrb).toMatchObject({
      delayMs: 240,
      preferIdle: true,
      nextMiniUpgradeStartAt: 1000,
    });
    expect(firstMini).toMatchObject({
      delayMs: 900,
      preferIdle: true,
    });
    expect(secondMini.delayMs - firstMini.delayMs).toBeGreaterThanOrEqual(6000);
    expect(secondMini.preferIdle).toBe(true);
    expect(autoOrb).toMatchObject({
      delayMs: 180,
      preferIdle: true,
      nextMiniUpgradeStartAt: 1000,
    });
  });

  it("respects the mini WebGL delay before queueing idle startup work", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    installQueuedRaf();

    const idleCallbacks: IdleRequestCallback[] = [];
    const requestIdleCallback = vi.fn((callback: IdleRequestCallback) => {
      idleCallbacks.push(callback);
      return idleCallbacks.length;
    });
    vi.stubGlobal("requestIdleCallback", requestIdleCallback);
    vi.stubGlobal("cancelIdleCallback", vi.fn());

    const renderer = createMockGLRenderer();
    vi.mocked(createOrbGLAsync).mockResolvedValue({
      renderer,
      durationMs: 1,
      tier: "webgl",
    });

    render(
      createElement(ValenceOrb, {
        valence: 0.25,
        renderer: "webgl",
        size: 120,
      }),
    );

    expect(requestIdleCallback).not.toHaveBeenCalled();
    expect(createOrbGLAsync).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(899);
      await Promise.resolve();
    });

    expect(requestIdleCallback).not.toHaveBeenCalled();
    expect(createOrbGLAsync).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });

    expect(requestIdleCallback).toHaveBeenCalledTimes(1);
    expect(createOrbGLAsync).not.toHaveBeenCalled();

    const idleDeadline: IdleDeadline = {
      didTimeout: false,
      timeRemaining: () => 50,
    };

    await act(async () => {
      idleCallbacks[0]?.(idleDeadline);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(createOrbGLAsync).toHaveBeenCalledTimes(1);
  });

  it("keeps canonical WebGL smooth even when runtime performance mode is active", () => {
    document.documentElement.dataset.runtimePerf = "strained";

    expect(resolveOrbFrameInterval(true)).toBeCloseTo(1000 / 60);
    expect(resolveOrbFrameInterval(false)).toBeCloseTo(1000 / 30);
  });

  it("reanchors large frame gaps instead of catching up missed orb motion", () => {
    expect(resolveOrbFrameDeltaSeconds(0, 1000)).toBe(0);
    expect(resolveOrbFrameDeltaSeconds(1000, 1034)).toBeCloseTo(0.034);
    expect(resolveOrbFrameDeltaSeconds(1000, 1100)).toBe(0.05);
    expect(resolveOrbFrameDeltaSeconds(1000, 20_000)).toBe(0);
  });

  it("resumes after browser lifecycle pauses without a fast-spin catch-up frame", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const hiddenSpy = vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    const { flushFrameAt, pendingCount } = installQueuedRaf();

    render(
      createElement(ValenceOrb, {
        valence: 0.25,
        renderer: "canvas",
        animationSpeed: 1,
      }),
    );

    const latestOrbTime = () => vi.mocked(drawOrbScene).mock.calls.at(-1)?.[1].time ?? 0;

    await act(async () => {
      flushFrameAt(900);
      await Promise.resolve();
    });

    await act(async () => {
      flushFrameAt(1000);
      await Promise.resolve();
    });
    const firstFrameTime = latestOrbTime();

    await act(async () => {
      flushFrameAt(1060);
      await Promise.resolve();
    });
    const beforePauseTime = latestOrbTime();

    expect(beforePauseTime).toBeGreaterThan(firstFrameTime);

    hiddenSpy.mockReturnValue(true);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(pendingCount()).toBe(0);

    hiddenSpy.mockReturnValue(false);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(pendingCount()).toBe(1);

    await act(async () => {
      flushFrameAt(20_000);
      await Promise.resolve();
    });
    const afterResumeTime = latestOrbTime();

    expect(afterResumeTime).toBeCloseTo(beforePauseTime, 3);

    await act(async () => {
      flushFrameAt(20_060);
      await Promise.resolve();
    });

    expect(latestOrbTime()).toBeGreaterThan(afterResumeTime);
  });

  it("does not keep scheduling background RAF frames after the document becomes hidden mid-frame", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const hiddenSpy = vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    const { flushFrameAt, pendingCount } = installQueuedRaf();

    render(
      createElement(ValenceOrb, {
        valence: 0.25,
        renderer: "canvas",
        animationSpeed: 1,
      }),
    );

    expect(pendingCount()).toBeGreaterThanOrEqual(1);

    await act(async () => {
      flushFrameAt(900);
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });

    expect(pendingCount()).toBe(1);
    vi.mocked(drawOrbScene).mockClear();

    hiddenSpy.mockReturnValue(true);
    await act(async () => {
      flushFrameAt(1000);
      await Promise.resolve();
    });

    expect(pendingCount()).toBe(0);
    expect(drawOrbScene).not.toHaveBeenCalled();
  });

  it("does not inject a late high-shimmer burst after a long-running valence transition", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const { flushFrameAt } = installQueuedRaf();

    const view = render(
      createElement(ValenceOrb, {
        valence: -0.143,
        renderer: "canvas",
        animationSpeed: 1,
      }),
    );

    await act(async () => {
      flushFrameAt(1000);
      flushFrameAt(1050);
      await Promise.resolve();
    });

    vi.mocked(drawOrbScene).mockClear();

    view.rerender(
      createElement(ValenceOrb, {
        valence: -0.667,
        renderer: "canvas",
        animationSpeed: 1,
      }),
    );

    for (let i = 0; i < 360; i += 1) {
      await act(async () => {
        flushFrameAt(1100 + i * 50);
        await Promise.resolve();
      });
    }

    const shimmerValues = vi.mocked(drawOrbScene).mock.calls.map(([, params]) => params.shimmer ?? 0);
    const lateShimmerValues = shimmerValues.slice(60);

    expect(Math.max(0, ...lateShimmerValues)).toBeLessThanOrEqual(0.25);
  });

  it("blocks non-canonical first-paint fallbacks for forced WebGL orb surfaces", () => {
    expect(allowsFirstPaintFallback("webgl", null)).toBe(false);
    expect(allowsFirstPaintFallback("auto", "webgl")).toBe(false);
    expect(allowsFirstPaintFallback("canvas", "webgl")).toBe(false);
    expect(allowsFirstPaintFallback("auto", null)).toBe(false);
    expect(allowsFirstPaintFallback("canvas", null)).toBe(false);
  });

  it("renders forced WebGL surfaces from a WebGL canvas without Canvas2D prepaint", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const { flushNextFrame } = installQueuedRaf();
    const renderer = createMockGLRenderer();
    vi.mocked(createOrbGLAsync).mockResolvedValue({
      renderer,
      durationMs: 1,
      tier: "webgl",
    });

    const onFirstPaintReady = vi.fn();
    const onVisualReady = vi.fn();

    const { container, queryByTestId } = render(
      createElement(ValenceOrb, {
        valence: 0.25,
        renderer: "webgl",
        onFirstPaintReady,
        onVisualReady,
      }),
    );

    const wrapper = container.querySelector("[data-orb-renderer-policy='webgl']");

    expect(wrapper).not.toHaveAttribute("data-orb-first-paint-ready");
    expect(wrapper).not.toHaveAttribute("data-orb-visual-ready");
    expect(container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();
    expect(drawOrbScene).not.toHaveBeenCalled();
    vi.mocked(drawOrbScene).mockClear();

    await flushScheduledWebGLUpgrade(flushNextFrame);

    const canvas = container.querySelector("canvas");

    expect(createOrbGLAsync).toHaveBeenCalledTimes(1);
    expect(renderer.render).toHaveBeenCalled();
    expect(renderer.dispose).not.toHaveBeenCalled();
    expect(wrapper).toHaveAttribute("data-orb-first-paint-ready", "true");
    expect(wrapper).toHaveAttribute("data-orb-visual-ready", "true");
    expect(canvas).toHaveAttribute("data-orb-renderer-tier", "webgl-main");
    expect(canvas).not.toHaveAttribute("data-orb-first-paint-canvas");
    expect(drawOrbScene).not.toHaveBeenCalled();
    expect(onFirstPaintReady).toHaveBeenCalledTimes(1);
    expect(onVisualReady).toHaveBeenCalledTimes(1);
    expect(queryByTestId("valence-orb-first-paint-fallback")).toBeNull();
  });

  it("uses async WebGL2 fallback when async forced WebGL1 build is unavailable", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const { flushNextFrame } = installQueuedRaf();
    const renderer = createMockGLRenderer();
    vi.mocked(createOrbGLAsync).mockResolvedValue(null);
    vi.mocked(createOrbGL2Async).mockResolvedValue({
      renderer,
      durationMs: 42,
      tier: "webgl2",
    });

    const { container } = render(
      createElement(ValenceOrb, {
        valence: 0.25,
        renderer: "webgl",
        size: 240,
      }),
    );

    expect(container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();
    expect(drawOrbScene).not.toHaveBeenCalled();
    vi.mocked(drawOrbScene).mockClear();

    await flushScheduledWebGLUpgrade(flushNextFrame);

    expect(createOrbGLAsync).toHaveBeenCalledTimes(1);
    expect(createOrbGL2Async).toHaveBeenCalledTimes(1);
    expect(createOrbGL2).not.toHaveBeenCalled();
    expect(createOrbGL).not.toHaveBeenCalled();
    expect(container.querySelector("[data-orb-renderer-tier='webgl-main']")).not.toBeNull();
    expect(container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();
    expect(container.querySelector("[data-orb-visual-ready='true']")).not.toBeNull();
    expect(drawOrbScene).not.toHaveBeenCalled();
  });

  it("does not stack duplicate animation loops from repeated WebGL restore events", async () => {
    vi.useFakeTimers();
    const originalUrl = window.location.href;
    window.history.pushState({}, "", "?orbRenderer=webgl");
    stubVisibleOrbRect();
    const { flushNextFrame, pendingCount } = installQueuedRaf();
    const renderer = createMockGLRenderer();
    vi.mocked(createOrbGLAsync).mockResolvedValue({
      renderer,
      durationMs: 1,
      tier: "webgl",
    });

    try {
      const { container } = render(
        createElement(ValenceOrb, {
          valence: 0.25,
          renderer: "webgl",
        }),
      );

      await flushScheduledWebGLUpgrade(flushNextFrame);

      const canvas = container.querySelector("canvas");
      if (!canvas) throw new Error("Expected WebGL canvas");

      const pendingBeforeRestore = pendingCount();
      act(() => {
        canvas.dispatchEvent(new Event("webglcontextrestored"));
        canvas.dispatchEvent(new Event("webglcontextrestored"));
      });

      expect(pendingCount()).toBeLessThanOrEqual(pendingBeforeRestore + 1);
    } finally {
      window.history.pushState({}, "", originalUrl);
    }
  });

  it("routes forced canonical WebGL through the worker without probing main-thread WebGL", () => {
    const getContextSpy = stubCanvasContexts();
    getContextSpy.mockClear();
    vi.stubGlobal("OffscreenCanvas", class OffscreenCanvasStub {});
    Object.defineProperty(HTMLCanvasElement.prototype, "transferControlToOffscreen", {
      configurable: true,
      value: vi.fn(() => ({ width: 0, height: 0 })),
    });
    vi.stubGlobal("Worker", vi.fn());

    expect(shouldUseWorkerWebGL(true, 240)).toBe(true);
    expect(shouldUseWorkerWebGL(true, 120)).toBe(true);
    expect(getContextSpy).not.toHaveBeenCalled();
  });

  it("uses worker WebGL for the primary full-size forced orb when workers are available", async () => {
    vi.useFakeTimers();
    const getContextSpy = stubCanvasContexts();
    stubVisibleOrbRect();
    const { flushNextFrame } = installQueuedRaf();
    const originalInnerWidth = window.innerWidth;
    const hadTransferControl =
      "transferControlToOffscreen" in HTMLCanvasElement.prototype;
    const originalTransferControl =
      HTMLCanvasElement.prototype.transferControlToOffscreen;
    class WorkerStub {
      onmessage: ((event: MessageEvent<{ type: "ready" | "rendered"; requestId?: number }>) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage = vi.fn((message: { type: "init" | "render" | "dispose"; requestId?: number }) => {
        if (message.type === "init") {
          queueMicrotask(() => {
            this.onmessage?.({ data: { type: "ready" } } as MessageEvent<{ type: "ready" }>);
          });
          return;
        }
        if (message.type === "render") {
          queueMicrotask(() => {
            this.onmessage?.({
              data: { type: "rendered", requestId: message.requestId },
            } as MessageEvent<{ type: "rendered"; requestId?: number }>);
          });
        }
      });
      terminate = vi.fn();
    }
    const WorkerSpy = vi.fn(function WorkerMock() {
      return new WorkerStub();
    });

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 449,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "transferControlToOffscreen", {
      configurable: true,
      value: vi.fn(() => ({ width: 0, height: 0 })),
    });
    vi.stubGlobal("OffscreenCanvas", class OffscreenCanvasStub {});
    vi.stubGlobal("Worker", WorkerSpy);

    const renderer = createMockGLRenderer();
    vi.mocked(createOrbGLAsync).mockResolvedValue({
      renderer,
      durationMs: 1,
      tier: "webgl",
    });

    try {
      const { container } = render(
        createElement(ValenceOrb, {
          valence: 0.25,
          renderer: "webgl",
          size: 240,
        }),
      );

      await flushScheduledWebGLUpgrade(flushNextFrame);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(WorkerSpy).toHaveBeenCalledTimes(1);
      expect(createOrbGLAsync).not.toHaveBeenCalled();
      expect(createOrbGL2Async).not.toHaveBeenCalled();
      expect(container.querySelector("[data-orb-renderer-tier='webgl-worker']")).not.toBeNull();
      expect(container.querySelector("[data-orb-visual-ready='true']")).not.toBeNull();
      expect(getContextSpy).not.toHaveBeenCalledWith("webgl2");
      expect(getContextSpy).not.toHaveBeenCalledWith("webgl");
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalInnerWidth,
      });
      if (hadTransferControl) {
        Object.defineProperty(HTMLCanvasElement.prototype, "transferControlToOffscreen", {
          configurable: true,
          value: originalTransferControl,
        });
      } else {
        const canvasPrototype = HTMLCanvasElement.prototype as {
          transferControlToOffscreen?: HTMLCanvasElement["transferControlToOffscreen"];
        };
        delete canvasPrototype.transferControlToOffscreen;
      }
    }
  });

  it("uses worker WebGL for the primary full-size forced orb even when main-thread shader compile is unsupported", async () => {
    vi.useFakeTimers();
    stubCanvasContexts(false);
    stubVisibleOrbRect();
    const { flushNextFrame } = installQueuedRaf();
    const originalInnerWidth = window.innerWidth;
    const hadTransferControl =
      "transferControlToOffscreen" in HTMLCanvasElement.prototype;
    const originalTransferControl =
      HTMLCanvasElement.prototype.transferControlToOffscreen;
    class WorkerStub {
      onmessage: ((event: MessageEvent<{ type: "ready" | "rendered"; requestId?: number }>) => void) | null = null;
      postMessage = vi.fn((message: { type: "init" | "render" | "dispose"; requestId?: number }) => {
        if (message.type === "init") {
          queueMicrotask(() => {
            this.onmessage?.({ data: { type: "ready" } } as MessageEvent<{ type: "ready" }>);
          });
          return;
        }
        if (message.type === "render") {
          queueMicrotask(() => {
            this.onmessage?.({
              data: { type: "rendered", requestId: message.requestId },
            } as MessageEvent<{ type: "rendered"; requestId?: number }>);
          });
        }
      });
      terminate = vi.fn();
    }
    const WorkerSpy = vi.fn(function WorkerMock() {
      return new WorkerStub();
    });

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 449,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "transferControlToOffscreen", {
      configurable: true,
      value: vi.fn(() => ({ width: 0, height: 0 })),
    });
    vi.stubGlobal("OffscreenCanvas", class OffscreenCanvasStub {});
    vi.stubGlobal("Worker", WorkerSpy);

    try {
      expect(shouldUseWorkerWebGL(true, 240)).toBe(true);

      const { container } = render(
        createElement(ValenceOrb, {
          valence: 0.25,
          renderer: "webgl",
          size: 240,
        }),
      );

      await flushScheduledWebGLUpgrade(flushNextFrame);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(WorkerSpy).toHaveBeenCalledTimes(1);
      expect(createOrbGLAsync).not.toHaveBeenCalled();
      expect(createOrbGL2Async).not.toHaveBeenCalled();
      expect(container.querySelector("[data-orb-renderer-tier='webgl-worker']")).not.toBeNull();
      expect(container.querySelector("[data-orb-visual-ready='true']")).not.toBeNull();
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalInnerWidth,
      });
      if (hadTransferControl) {
        Object.defineProperty(HTMLCanvasElement.prototype, "transferControlToOffscreen", {
          configurable: true,
          value: originalTransferControl,
        });
      } else {
        const canvasPrototype = HTMLCanvasElement.prototype as {
          transferControlToOffscreen?: HTMLCanvasElement["transferControlToOffscreen"];
        };
        delete canvasPrototype.transferControlToOffscreen;
      }
    }
  });

  it("uses worker WebGL for forced mini rendering when worker WebGL is available", async () => {
    vi.useFakeTimers();
    stubCanvasContexts();
    stubVisibleOrbRect();
    const { flushNextFrame } = installQueuedRaf();
    const originalInnerWidth = window.innerWidth;
    const hadTransferControl =
      "transferControlToOffscreen" in HTMLCanvasElement.prototype;
    const originalTransferControl =
      HTMLCanvasElement.prototype.transferControlToOffscreen;
    class WorkerStub {
      onmessage: ((event: MessageEvent<{ type: "ready" | "rendered"; requestId?: number }>) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage = vi.fn((message: { type: "init" | "render" | "dispose"; requestId?: number }) => {
        if (message.type === "init") {
          queueMicrotask(() => {
            this.onmessage?.({ data: { type: "ready" } } as MessageEvent<{ type: "ready" }>);
          });
          return;
        }
        if (message.type === "render") {
          queueMicrotask(() => {
            this.onmessage?.({
              data: { type: "rendered", requestId: message.requestId },
            } as MessageEvent<{ type: "rendered"; requestId?: number }>);
          });
        }
      });
      terminate = vi.fn();
    }
    const WorkerSpy = vi.fn(function WorkerMock() {
      return new WorkerStub();
    });

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 449,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "transferControlToOffscreen", {
      configurable: true,
      value: vi.fn(() => ({ width: 0, height: 0 })),
    });
    vi.stubGlobal("OffscreenCanvas", class OffscreenCanvasStub {});
    vi.stubGlobal("Worker", WorkerSpy);

    const renderer = createMockGLRenderer();
    vi.mocked(createOrbGLAsync).mockResolvedValue({
      renderer,
      durationMs: 1,
      tier: "webgl",
    });

    try {
      expect(shouldUseWorkerWebGL(true, 240)).toBe(true);
      expect(shouldUseWorkerWebGL(true, 120)).toBe(true);

      const { container } = render(
        createElement(ValenceOrb, {
          valence: 0.25,
          renderer: "webgl",
          size: 120,
        }),
      );

      await flushScheduledMiniWebGLUpgrade(flushNextFrame);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(WorkerSpy).toHaveBeenCalledTimes(1);
      expect(createOrbGLAsync).not.toHaveBeenCalled();
      expect(createOrbGL2Async).not.toHaveBeenCalled();
      expect(container.querySelector("[data-orb-renderer-tier='webgl-worker']")).not.toBeNull();
      expect(renderer.dispose).not.toHaveBeenCalled();
      expect(container.querySelector("[data-orb-visual-ready='true']")).not.toBeNull();
      expect(drawOrbScene).not.toHaveBeenCalled();
      vi.mocked(drawOrbScene).mockClear();
      expect(drawOrbScene).not.toHaveBeenCalled();

      const querySelectorAllSpy = vi.spyOn(HTMLElement.prototype, "querySelectorAll");
      act(() => {
        flushNextFrame();
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(querySelectorAllSpy).not.toHaveBeenCalledWith("canvas");
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalInnerWidth,
      });
      if (hadTransferControl) {
        Object.defineProperty(HTMLCanvasElement.prototype, "transferControlToOffscreen", {
          configurable: true,
          value: originalTransferControl,
        });
      } else {
        const canvasPrototype = HTMLCanvasElement.prototype as {
          transferControlToOffscreen?: HTMLCanvasElement["transferControlToOffscreen"];
        };
        delete canvasPrototype.transferControlToOffscreen;
      }
    }
  });

  it("does not catch up hidden worker-render time after WebGL worker backpressure", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const { flushNextFrame, flushFrameAt } = installQueuedRaf();
    const originalInnerWidth = window.innerWidth;
    const hadTransferControl =
      "transferControlToOffscreen" in HTMLCanvasElement.prototype;
    const originalTransferControl =
      HTMLCanvasElement.prototype.transferControlToOffscreen;
    const renderMessages: Array<{
      type: "render";
      requestId?: number;
      payload: { time: number };
    }> = [];

    class WorkerStub {
      onmessage: ((event: MessageEvent<{ type: "ready" | "rendered"; requestId?: number }>) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage = vi.fn((message: {
        type: "init" | "render" | "dispose";
        requestId?: number;
        payload?: { time: number };
      }) => {
        if (message.type === "init") {
          queueMicrotask(() => {
            this.onmessage?.({ data: { type: "ready" } } as MessageEvent<{ type: "ready" }>);
          });
          return;
        }
        if (message.type === "render" && message.payload) {
          renderMessages.push({
            type: "render",
            requestId: message.requestId,
            payload: message.payload,
          });
        }
      });
      terminate = vi.fn();
      flushRendered() {
        const lastRequestId = renderMessages.at(-1)?.requestId;
        queueMicrotask(() => {
          this.onmessage?.({
            data: { type: "rendered", requestId: lastRequestId },
          } as MessageEvent<{ type: "rendered"; requestId?: number }>);
        });
      }
    }
    const workerInstances: WorkerStub[] = [];
    const WorkerSpy = vi.fn(function WorkerMock() {
      const worker = new WorkerStub();
      workerInstances.push(worker);
      return worker;
    });

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 449,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "transferControlToOffscreen", {
      configurable: true,
      value: vi.fn(() => ({ width: 0, height: 0 })),
    });
    vi.stubGlobal("OffscreenCanvas", class OffscreenCanvasStub {});
    vi.stubGlobal("Worker", WorkerSpy);

    try {
      render(
        createElement(ValenceOrb, {
          valence: 0.25,
          renderer: "webgl",
          size: 120,
          animationSpeed: 1,
        }),
      );

      await flushScheduledMiniWebGLUpgrade(flushNextFrame);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(renderMessages).toHaveLength(1);
      const firstRenderTime = renderMessages[0].payload.time;

      for (let i = 0; i < 100; i += 1) {
        act(() => {
          flushFrameAt(1000 + i * 16);
        });
      }

      expect(renderMessages).toHaveLength(1);

      workerInstances[0]?.flushRendered();
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      act(() => {
        flushFrameAt(3000);
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(renderMessages.length).toBeGreaterThanOrEqual(2);
      expect(renderMessages[1].payload.time - firstRenderTime).toBeLessThanOrEqual(0.05);
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalInnerWidth,
      });
      if (hadTransferControl) {
        Object.defineProperty(HTMLCanvasElement.prototype, "transferControlToOffscreen", {
          configurable: true,
          value: originalTransferControl,
        });
      } else {
        const canvasPrototype = HTMLCanvasElement.prototype as {
          transferControlToOffscreen?: HTMLCanvasElement["transferControlToOffscreen"];
        };
        delete canvasPrototype.transferControlToOffscreen;
      }
    }
  });

  it("keeps worker WebGL time monotonic across a short forced-WebGL remount", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const { flushNextFrame, flushFrameAt } = installQueuedRaf();
    const originalInnerWidth = window.innerWidth;
    const hadTransferControl =
      "transferControlToOffscreen" in HTMLCanvasElement.prototype;
    const originalTransferControl =
      HTMLCanvasElement.prototype.transferControlToOffscreen;
    const renderMessages: Array<{
      type: "render";
      requestId?: number;
      payload: { time: number };
    }> = [];

    class WorkerStub {
      onmessage: ((event: MessageEvent<{ type: "ready" | "rendered"; requestId?: number }>) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage = vi.fn((message: {
        type: "init" | "render" | "dispose";
        requestId?: number;
        payload?: { time: number };
      }) => {
        if (message.type === "init") {
          queueMicrotask(() => {
            this.onmessage?.({ data: { type: "ready" } } as MessageEvent<{ type: "ready" }>);
          });
          return;
        }
        if (message.type === "render" && message.payload) {
          renderMessages.push({
            type: "render",
            requestId: message.requestId,
            payload: message.payload,
          });
        }
      });
      terminate = vi.fn();
      flushRendered() {
        const lastRequestId = renderMessages.at(-1)?.requestId;
        queueMicrotask(() => {
          this.onmessage?.({
            data: { type: "rendered", requestId: lastRequestId },
          } as MessageEvent<{ type: "rendered"; requestId?: number }>);
        });
      }
    }

    const workerInstances: WorkerStub[] = [];
    const WorkerSpy = vi.fn(function WorkerMock() {
      const worker = new WorkerStub();
      workerInstances.push(worker);
      return worker;
    });

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 449,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "transferControlToOffscreen", {
      configurable: true,
      value: vi.fn(() => ({ width: 0, height: 0 })),
    });
    vi.stubGlobal("OffscreenCanvas", class OffscreenCanvasStub {});
    vi.stubGlobal("Worker", WorkerSpy);

    try {
      const firstRender = render(
        createElement(ValenceOrb, {
          valence: -0.143,
          renderer: "webgl",
          size: 120,
          animationSpeed: 1,
        }),
      );

      await flushScheduledMiniWebGLUpgrade(flushNextFrame);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(renderMessages.length).toBeGreaterThanOrEqual(1);

      for (let i = 0; i < 140; i += 1) {
        act(() => {
          flushFrameAt(1100 + i * 50);
        });
        workerInstances[0]?.flushRendered();
        await act(async () => {
          await Promise.resolve();
          await Promise.resolve();
        });
      }

      const timeBeforeRemount = renderMessages.at(-1)?.payload.time ?? 0;
      expect(timeBeforeRemount).toBeGreaterThan(1);

      firstRender.unmount();
      const messageCountBeforeRemount = renderMessages.length;

      render(
        createElement(ValenceOrb, {
          valence: -0.143,
          renderer: "webgl",
          size: 120,
          animationSpeed: 1,
        }),
      );

      await flushScheduledMiniWebGLUpgrade(flushNextFrame);
      await act(async () => {
        vi.advanceTimersByTime(7_000);
        flushNextFrame();
        await Promise.resolve();
        await Promise.resolve();
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(renderMessages.length).toBeGreaterThan(messageCountBeforeRemount);
      const firstTimeAfterRemount =
        renderMessages[messageCountBeforeRemount]?.payload.time ?? 0;
      expect(firstTimeAfterRemount).toBeGreaterThanOrEqual(timeBeforeRemount);
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalInnerWidth,
      });
      if (hadTransferControl) {
        Object.defineProperty(HTMLCanvasElement.prototype, "transferControlToOffscreen", {
          configurable: true,
          value: originalTransferControl,
        });
      } else {
        const canvasPrototype = HTMLCanvasElement.prototype as {
          transferControlToOffscreen?: HTMLCanvasElement["transferControlToOffscreen"];
        };
        delete canvasPrototype.transferControlToOffscreen;
      }
    }
  });

  it("does not recover forced WebGL startup failure to a non-canonical Canvas2D renderer", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const { flushNextFrame } = installQueuedRaf();
    const onFirstPaintReady = vi.fn();
    const onVisualReady = vi.fn();

    const { container, queryByTestId } = render(
      createElement(ValenceOrb, {
        valence: 0.25,
        renderer: "webgl",
        onFirstPaintReady,
        onVisualReady,
      }),
    );

    const wrapper = container.querySelector("[data-orb-renderer-policy='webgl']");
    expect(container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();

    await flushScheduledWebGLUpgrade(flushNextFrame);

    expect(createOrbGLAsync).toHaveBeenCalledTimes(1);
    expect(createOrbGL2Async).toHaveBeenCalledTimes(1);
    expect(createOrbGL).not.toHaveBeenCalled();
    expect(createOrbGL2).not.toHaveBeenCalled();
    expect(wrapper).not.toHaveAttribute("data-orb-first-paint-ready");
    expect(wrapper).not.toHaveAttribute("data-orb-visual-ready");
    expect(container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();
    expect(container.querySelector("canvas[data-orb-first-paint-canvas='true']")).toBeNull();
    expect(drawOrbScene).not.toHaveBeenCalled();
    expect(onFirstPaintReady).not.toHaveBeenCalled();
    expect(onVisualReady).not.toHaveBeenCalled();
    expect(queryByTestId("valence-orb-first-paint-fallback")).toBeNull();
  });

  it("does not block forced WebGL failure recovery with synchronous shader fallback", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const { flushNextFrame } = installQueuedRaf();
    vi.mocked(createOrbGLAsync).mockResolvedValue(null);
    vi.mocked(createOrbGL2Async).mockResolvedValue(null);
    vi.mocked(createOrbGL).mockReturnValue(null);
    const renderer = createMockGLRenderer();
    vi.mocked(createOrbGL2).mockReturnValue(renderer);

    const { container } = render(
      createElement(ValenceOrb, {
        valence: 0.25,
        renderer: "webgl",
        size: 240,
      }),
    );

    await flushScheduledWebGLUpgrade(flushNextFrame);

    const wrapper = container.querySelector("[data-orb-renderer-policy='webgl']");
    const stableCanvas = container.querySelector("[data-orb-renderer-tier='webgl-main']");

    expect(createOrbGLAsync).toHaveBeenCalledTimes(1);
    expect(createOrbGL2Async).toHaveBeenCalledTimes(1);
    expect(createOrbGL2).not.toHaveBeenCalled();
    expect(createOrbGL).not.toHaveBeenCalled();
    expect(wrapper).not.toHaveAttribute("data-orb-visual-ready");
    expect(stableCanvas).toBeNull();
    expect(container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();
  });

  it("allows Canvas2D fallback only through the explicit debug override", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const { flushNextFrame } = installQueuedRaf();
    const originalUrl = window.location.href;
    window.history.pushState({}, "", "?dev=true&orbRenderer=canvas");

    try {
      const { container } = render(
        createElement(ValenceOrb, {
          valence: 0.25,
          renderer: "webgl",
        }),
      );

      await act(async () => {
        flushNextFrame();
      });

      expect(createOrbGLAsync).not.toHaveBeenCalled();
      expect(createOrbGL2Async).not.toHaveBeenCalled();
      expect(container.querySelector("[data-orb-renderer-tier='canvas2d']")).not.toBeNull();
    } finally {
      window.history.pushState({}, "", originalUrl);
    }
  });

  it("keeps phone forced-WebGL first paint on the async WebGL canvas", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const { flushNextFrame } = installQueuedRaf();
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 449,
    });

    const renderer = createMockGLRenderer();
    vi.mocked(createOrbGLAsync).mockResolvedValue({
      renderer,
      durationMs: 1,
      tier: "webgl",
    });

    const onFirstPaintReady = vi.fn();
    const onVisualReady = vi.fn();

    try {
      const { container } = render(
        createElement(ValenceOrb, {
          valence: 0.25,
          renderer: "webgl",
          size: 240,
          onFirstPaintReady,
          onVisualReady,
        }),
      );

      const wrapper = container.querySelector("[data-orb-renderer-policy='webgl']");

      expect(wrapper).not.toHaveAttribute("data-orb-first-paint-ready");
      expect(wrapper).not.toHaveAttribute("data-orb-visual-ready");
      expect(container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();
      expect(drawOrbScene).not.toHaveBeenCalled();
      vi.mocked(drawOrbScene).mockClear();

      await flushScheduledWebGLUpgrade(flushNextFrame);

      const canvases = container.querySelectorAll("canvas");
      const stableCanvas = canvases[0];

      expect(wrapper).not.toHaveAttribute("data-orb-webgl-upgrade");
      expect(wrapper).toHaveAttribute("data-orb-first-paint-ready", "true");
      expect(wrapper).toHaveAttribute("data-orb-visual-ready", "true");
      expect(canvases).toHaveLength(1);
      expect(stableCanvas).toHaveAttribute("data-orb-renderer-tier", "webgl-main");
      expect(stableCanvas).not.toHaveAttribute("data-orb-first-paint-canvas");
      expect(stableCanvas).toHaveStyle({ opacity: "1" });
      expect(drawOrbScene).not.toHaveBeenCalled();
      expect(renderer.dispose).not.toHaveBeenCalled();
      expect(onFirstPaintReady).toHaveBeenCalledTimes(1);
      expect(onVisualReady).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalInnerWidth,
      });
    }
  });

  it("does not delay forced WebGL animation behind a Canvas2D hold", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const { flushNextFrame } = installQueuedRaf();
    const renderer = createMockGLRenderer();
    vi.mocked(createOrbGLAsync).mockResolvedValue({
      renderer,
      durationMs: 1,
      tier: "webgl",
    });

    const { container } = render(
      createElement(ValenceOrb, {
        valence: 0.25,
        renderer: "webgl",
        size: 240,
      }),
    );

    expect(container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();
    expect(drawOrbScene).not.toHaveBeenCalled();
    vi.mocked(drawOrbScene).mockClear();

    await flushScheduledWebGLUpgrade(flushNextFrame);

    expect(container.querySelector("[data-orb-visual-ready='true']")).not.toBeNull();
    expect(container.querySelector("[data-orb-webgl-upgrade='held-on-canvas']")).toBeNull();
    expect(container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();
    expect(container.querySelector("[data-orb-renderer-tier='webgl-main']")).not.toBeNull();
    expect(drawOrbScene).not.toHaveBeenCalled();
  });

  it("keeps an offscreen forced WebGL orb WebGL-only instead of painting Canvas2D while hidden", async () => {
    vi.useFakeTimers();
    const { flushNextFrame } = installQueuedRaf();
    vi.stubGlobal("OffscreenCanvas", undefined);

    let isVisible = false;
    const makeRect = (top: number): DOMRectReadOnly => ({
      bottom: top + 240,
      height: 240,
      left: 0,
      right: 240,
      top,
      width: 240,
      x: 0,
      y: top,
      toJSON: () => ({}),
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() =>
      makeRect(isVisible ? 0 : 10_000),
    );

    const observerCallbacks: IntersectionObserverCallback[] = [];
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          observerCallbacks.push(callback);
        }
        disconnect = vi.fn();
        observe = vi.fn();
        takeRecords = vi.fn(() => []);
        unobserve = vi.fn();
      },
    );

    const renderer = createMockGLRenderer();
    vi.mocked(createOrbGLAsync).mockResolvedValue({
      renderer,
      durationMs: 1,
      tier: "webgl",
    });

    const { container } = render(
      createElement(ValenceOrb, {
        valence: 0.25,
        renderer: "webgl",
        size: 240,
      }),
    );

    const wrapper = container.querySelector("[data-orb-renderer-policy='webgl']");
    if (!wrapper) throw new Error("Expected forced WebGL wrapper");
    const hiddenEntry = {
      boundingClientRect: makeRect(10_000),
      intersectionRatio: 0,
      intersectionRect: makeRect(10_000),
      isIntersecting: false,
      rootBounds: null,
      target: wrapper,
      time: performance.now(),
    } satisfies IntersectionObserverEntry;

    act(() => {
      for (const callback of observerCallbacks) {
        callback([hiddenEntry], {} as IntersectionObserver);
      }
    });

    await flushScheduledWebGLUpgrade(flushNextFrame);

    expect(createOrbGLAsync).not.toHaveBeenCalled();
    expect(container.querySelector("[data-orb-visual-ready='true']")).toBeNull();
    expect(container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(WEBGL_FORCED_FIRST_FRAME_TIMEOUT_MS + 1);
    });

    expect(createOrbGLAsync).not.toHaveBeenCalled();
    expect(container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();
    expect(drawOrbScene).not.toHaveBeenCalled();
    vi.mocked(drawOrbScene).mockClear();

    const visibleEntry = {
      boundingClientRect: makeRect(0),
      intersectionRatio: 1,
      intersectionRect: makeRect(0),
      isIntersecting: true,
      rootBounds: null,
      target: wrapper,
      time: performance.now(),
    } satisfies IntersectionObserverEntry;

    isVisible = true;
    await act(async () => {
      for (const callback of observerCallbacks) {
        callback([visibleEntry], {} as IntersectionObserver);
      }
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(createOrbGLAsync).toHaveBeenCalledTimes(1);
    expect(createOrbGL2Async).not.toHaveBeenCalled();
    expect(container.querySelector("[data-orb-visual-ready='true']")).not.toBeNull();
    expect(container.querySelector("[data-orb-renderer-tier='webgl-main']")).not.toBeNull();
    expect(container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();
    expect(renderer.dispose).not.toHaveBeenCalled();
    expect(drawOrbScene).not.toHaveBeenCalled();
  });

  it("does not poll layout while waiting for IntersectionObserver visibility", async () => {
    vi.useFakeTimers();
    const { flushNextFrame } = installQueuedRaf();
    const getBoundingClientRectSpy = vi.spyOn(
      HTMLElement.prototype,
      "getBoundingClientRect",
    );

    const observerCallbacks: IntersectionObserverCallback[] = [];
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          observerCallbacks.push(callback);
        }
        disconnect = vi.fn();
        observe = vi.fn();
        takeRecords = vi.fn(() => []);
        unobserve = vi.fn();
      },
    );

    const renderer = createMockGLRenderer();
    vi.mocked(createOrbGLAsync).mockResolvedValue({
      renderer,
      durationMs: 1,
      tier: "webgl",
    });

    const { container } = render(
      createElement(ValenceOrb, {
        valence: 0.25,
        renderer: "webgl",
        size: 240,
      }),
    );

    const wrapper = container.querySelector("[data-orb-renderer-policy='webgl']");
    if (!wrapper) throw new Error("Expected forced WebGL wrapper");
    const hiddenRect = {
      bottom: 10_240,
      height: 240,
      left: 0,
      right: 240,
      top: 10_000,
      width: 240,
      x: 0,
      y: 10_000,
      toJSON: () => ({}),
    } satisfies DOMRectReadOnly;
    act(() => {
      for (const callback of observerCallbacks) {
        callback(
          [
            {
              boundingClientRect: hiddenRect,
              intersectionRatio: 0,
              intersectionRect: hiddenRect,
              isIntersecting: false,
              rootBounds: null,
              target: wrapper,
              time: performance.now(),
            } satisfies IntersectionObserverEntry,
          ],
          {} as IntersectionObserver,
        );
      }
    });

    await flushScheduledWebGLUpgrade(flushNextFrame);
    expect(createOrbGLAsync).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(WEBGL_VISIBILITY_RETRY_INTERVAL_MS * 3);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getBoundingClientRectSpy).not.toHaveBeenCalled();
    expect(createOrbGLAsync).not.toHaveBeenCalled();
    expect(container.querySelector("[data-orb-renderer-tier='webgl-main']")).toBeNull();
    expect(container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();
    expect(drawOrbScene).not.toHaveBeenCalled();
  });

  it("keeps forced WebGL product surfaces WebGL-only after first-frame timeout", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const { flushNextFrame } = installQueuedRaf();

    const hadTransferControl =
      "transferControlToOffscreen" in HTMLCanvasElement.prototype;
    const originalTransferControl =
      HTMLCanvasElement.prototype.transferControlToOffscreen;
    Object.defineProperty(HTMLCanvasElement.prototype, "transferControlToOffscreen", {
      configurable: true,
      value: vi.fn(() => ({ width: 0, height: 0 })),
    });

    class SilentWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage = vi.fn();
      terminate = vi.fn();
    }

    vi.stubGlobal("OffscreenCanvas", class OffscreenCanvasStub {});
    vi.stubGlobal("Worker", SilentWorker);

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((contextId) => {
      if (contextId === "2d") {
        return {} as CanvasRenderingContext2D;
      }
      return null;
    });

    const onVisualReady = vi.fn();

    try {
      const { container } = render(
        createElement(ValenceOrb, {
          valence: 0,
          renderer: "webgl",
          onVisualReady,
        }),
      );

      await flushScheduledWebGLUpgrade(flushNextFrame);

      await act(async () => {
        vi.advanceTimersByTime(WEBGL_FORCED_FIRST_FRAME_TIMEOUT_MS + 1);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(onVisualReady).not.toHaveBeenCalled();
      expect(container.querySelector("[data-orb-visual-ready='true']")).toBeNull();
      expect(container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();
      expect(drawOrbScene).not.toHaveBeenCalled();
    } finally {
      if (hadTransferControl) {
        Object.defineProperty(HTMLCanvasElement.prototype, "transferControlToOffscreen", {
          configurable: true,
          value: originalTransferControl,
        });
      } else {
        const canvasPrototype = HTMLCanvasElement.prototype as {
          transferControlToOffscreen?: HTMLCanvasElement["transferControlToOffscreen"];
        };
        delete canvasPrototype.transferControlToOffscreen;
      }
    }
  });
});
