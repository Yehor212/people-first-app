import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { createElement } from "react";

import {
  ORB_TRANSITION_SETTINGS,
  ValenceOrb,
  WEBGL_FORCED_FIRST_FRAME_TIMEOUT_MS,
  WEBGL_WORKER_READY_BUDGET_MS,
  allowsFirstPaintFallback,
  resolveCanonicalWebGLUpgradeScheduling,
  resolveFrameTransitionProfile,
  resolveOrbFrameInterval,
  resolveOrbTransitionSettings,
  shouldApplyWorkerWebGLUpgrade,
  shouldStartIdleWakeSoftening,
} from "../ValenceOrb";

import { drawOrbScene } from "../orbRenderer";
import { createOrbGL2Async, createOrbGLAsync } from "../orbShader";

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

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
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
  const callbacks: FrameRequestCallback[] = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callbacks.push(callback);
    return callbacks.length;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

  return {
    flushNextFrame() {
      const callback = callbacks.shift();
      callback?.(performance.now());
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
      delayMs: 0,
      preferIdle: false,
    });
    expect(secondMini.delayMs - firstMini.delayMs).toBeGreaterThanOrEqual(80);
    expect(autoOrb).toMatchObject({
      delayMs: 180,
      preferIdle: true,
      nextMiniUpgradeStartAt: 1000,
    });
  });

  it("keeps canonical WebGL smooth even when runtime performance mode is active", () => {
    document.documentElement.dataset.runtimePerf = "strained";

    expect(resolveOrbFrameInterval(true)).toBeCloseTo(1000 / 60);
    expect(resolveOrbFrameInterval(false)).toBeCloseTo(1000 / 30);
  });

  it("blocks non-canonical first-paint fallbacks for forced WebGL orb surfaces", () => {
    expect(allowsFirstPaintFallback("webgl", null)).toBe(false);
    expect(allowsFirstPaintFallback("auto", "webgl")).toBe(false);
    expect(allowsFirstPaintFallback("canvas", "webgl")).toBe(false);
    expect(allowsFirstPaintFallback("auto", null)).toBe(false);
    expect(allowsFirstPaintFallback("canvas", null)).toBe(false);
  });

  it("paints forced WebGL surfaces through a WebGL canvas after async readiness", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const { flushNextFrame } = installQueuedRaf();
    const renderer = createMockGLRenderer();
    vi.mocked(createOrbGL2Async).mockResolvedValue({
      renderer,
      durationMs: 1,
      tier: "webgl2",
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

    await flushScheduledWebGLUpgrade(flushNextFrame);

    const canvas = container.querySelector("canvas");

    expect(createOrbGL2Async).toHaveBeenCalledTimes(1);
    expect(createOrbGLAsync).not.toHaveBeenCalled();
    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(wrapper).toHaveAttribute("data-orb-first-paint-ready", "true");
    expect(wrapper).toHaveAttribute("data-orb-visual-ready", "true");
    expect(canvas).toHaveAttribute("data-orb-renderer-tier", "webgl-main");
    expect(canvas).not.toHaveAttribute("data-orb-first-paint-canvas");
    expect(drawOrbScene).not.toHaveBeenCalled();
    expect(onFirstPaintReady).toHaveBeenCalledTimes(1);
    expect(onVisualReady).toHaveBeenCalledTimes(1);
    expect(queryByTestId("valence-orb-first-paint-fallback")).toBeNull();
  });

  it("does not draw Canvas2D first-paint frames when forced WebGL is unavailable", async () => {
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

    await flushScheduledWebGLUpgrade(flushNextFrame);

    expect(createOrbGL2Async).toHaveBeenCalledTimes(1);
    expect(createOrbGLAsync).toHaveBeenCalledTimes(1);
    expect(wrapper).not.toHaveAttribute("data-orb-first-paint-ready");
    expect(wrapper).not.toHaveAttribute("data-orb-visual-ready");
    expect(container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();
    expect(container.querySelector("canvas[data-orb-first-paint-canvas='true']")).toBeNull();
    expect(drawOrbScene).not.toHaveBeenCalled();
    expect(onFirstPaintReady).not.toHaveBeenCalled();
    expect(onVisualReady).not.toHaveBeenCalled();
    expect(queryByTestId("valence-orb-first-paint-fallback")).toBeNull();
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
    vi.mocked(createOrbGL2Async).mockResolvedValue({
      renderer,
      durationMs: 1,
      tier: "webgl2",
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
    vi.mocked(createOrbGL2Async).mockResolvedValue({
      renderer,
      durationMs: 1,
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

    expect(container.querySelector("[data-orb-visual-ready='true']")).not.toBeNull();
    expect(container.querySelector("[data-orb-webgl-upgrade='held-on-canvas']")).toBeNull();
    expect(container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();
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
    vi.mocked(createOrbGL2Async).mockResolvedValue({
      renderer,
      durationMs: 1,
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

    expect(createOrbGL2Async).not.toHaveBeenCalled();
    expect(container.querySelector("[data-orb-visual-ready='true']")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(WEBGL_FORCED_FIRST_FRAME_TIMEOUT_MS + 1);
    });

    expect(createOrbGL2Async).not.toHaveBeenCalled();
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

    expect(createOrbGL2Async).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[data-orb-visual-ready='true']")).not.toBeNull();
    expect(container.querySelector("[data-orb-renderer-tier='webgl-main']")).not.toBeNull();
    expect(drawOrbScene).not.toHaveBeenCalled();
  });

  it("fails forced WebGL closed instead of recovering to Canvas2D when no first frame arrives", () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();

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

      act(() => {
        vi.advanceTimersByTime(WEBGL_FORCED_FIRST_FRAME_TIMEOUT_MS + 1);
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
