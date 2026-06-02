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
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((contextId) => {
    if (contextId === "2d") {
      return {} as CanvasRenderingContext2D;
    }
    return null;
  });
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
    vi.advanceTimersByTime(0);
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("ValenceOrb motion profile", () => {
  it("keeps the shared default profile slower than the legacy standard profile", () => {
    expect(ORB_TRANSITION_SETTINGS["v1-soft"].targetBaseLerp).toBeLessThan(
      ORB_TRANSITION_SETTINGS.standard.targetBaseLerp,
    );
    expect(ORB_TRANSITION_SETTINGS["v1-soft"].visualBaseLerp).toBeLessThan(
      ORB_TRANSITION_SETTINGS.standard.visualBaseLerp,
    );
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
        visibleCanvasAgeMs: 1001,
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

  it("starts full canonical WebGL immediately while staggering mini WebGL upgrades", () => {
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
      delayMs: 0,
      preferIdle: false,
      nextMiniUpgradeStartAt: 1000,
    });
    expect(firstMini).toMatchObject({
      delayMs: 12000,
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
      vi.advanceTimersByTime(11_999);
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
    expect(onFirstPaintReady).not.toHaveBeenCalled();
    expect(onVisualReady).not.toHaveBeenCalled();

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

    await flushScheduledWebGLUpgrade(flushNextFrame);

    expect(createOrbGLAsync).toHaveBeenCalledTimes(1);
    expect(createOrbGL2Async).toHaveBeenCalledTimes(1);
    expect(createOrbGL).not.toHaveBeenCalled();
    expect(createOrbGL2).not.toHaveBeenCalled();
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

  it("uses worker WebGL for forced hero rendering when worker WebGL is available", async () => {
    vi.useFakeTimers();
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
      expect(renderer.dispose).not.toHaveBeenCalled();
      expect(container.querySelector("[data-orb-visual-ready='true']")).not.toBeNull();
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
          size: 240,
          animationSpeed: 1,
        }),
      );

      await flushScheduledWebGLUpgrade(flushNextFrame);
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

  it("does not recover forced WebGL startup failure to Canvas2D in product mode", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const { flushNextFrame } = installQueuedRaf();
    const onFirstPaintReady = vi.fn();
    const onVisualReady = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((contextId) => {
      if (contextId === "2d") {
        return {} as CanvasRenderingContext2D;
      }
      return null;
    });

    const { container, queryByTestId } = render(
      createElement(ValenceOrb, {
        valence: 0.25,
        renderer: "webgl",
        onFirstPaintReady,
        onVisualReady,
      }),
    );

    const wrapper = container.querySelector("[data-orb-renderer-policy='webgl']");
    expect(container.querySelector("canvas")).toBeNull();

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

    await flushScheduledWebGLUpgrade(flushNextFrame);

    expect(container.querySelector("[data-orb-visual-ready='true']")).not.toBeNull();
    expect(container.querySelector("[data-orb-webgl-upgrade='held-on-canvas']")).toBeNull();
    expect(container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();
    expect(container.querySelector("[data-orb-renderer-tier='webgl-main']")).not.toBeNull();
    expect(drawOrbScene).not.toHaveBeenCalled();
  });

  it("does not time out forced WebGL before an offscreen orb becomes visible", async () => {
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

    await flushScheduledWebGLUpgrade(flushNextFrame);

    expect(createOrbGLAsync).not.toHaveBeenCalled();
    expect(container.querySelector("[data-orb-visual-ready='true']")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(WEBGL_FORCED_FIRST_FRAME_TIMEOUT_MS + 1);
    });

    expect(createOrbGLAsync).not.toHaveBeenCalled();
    expect(container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();

    const wrapper = container.querySelector("[data-orb-renderer-policy='webgl']");
    if (!wrapper) throw new Error("Expected forced WebGL wrapper");
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

    vi.stubGlobal(
      "IntersectionObserver",
      class {
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

  it("leaves forced WebGL product surfaces without a Canvas2D orb after first-frame timeout", async () => {
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
      expect(container.querySelector("canvas")).toBeNull();
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
