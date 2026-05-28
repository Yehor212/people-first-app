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
  shouldHoldForcedWebGLOnCanvasRenderer,
  shouldStartIdleWakeSoftening,
} from "../ValenceOrb";

import { drawOrbScene } from "../orbRenderer";
import { createOrbGL2 } from "../orbShader";

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
    createOrbGL2: vi.fn(() => null),
    createOrbGL: vi.fn(() => null),
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  delete document.documentElement.dataset.runtimePerf;
});

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

  it("defers full canonical WebGL upgrades while staggering mini WebGL upgrades", () => {
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
      delayMs: 1400,
      preferIdle: true,
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

  it("keeps forced full phone orbs on the canonical canvas renderer during startup", () => {
    expect(shouldHoldForcedWebGLOnCanvasRenderer(true, 240, 449)).toBe(true);
    expect(shouldHoldForcedWebGLOnCanvasRenderer(true, 240, 768)).toBe(false);
    expect(shouldHoldForcedWebGLOnCanvasRenderer(true, 120, 449)).toBe(false);
    expect(shouldHoldForcedWebGLOnCanvasRenderer(false, 240, 449)).toBe(false);
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
    expect(allowsFirstPaintFallback("auto", null)).toBe(true);
    expect(allowsFirstPaintFallback("canvas", null)).toBe(true);
  });

  it("does not compile canonical WebGL synchronously on mount", () => {
    const fakeGl = {
      COLOR_BUFFER_BIT: 0x4000,
      RGBA: 0x1908,
      UNSIGNED_BYTE: 0x1401,
      clearColor: vi.fn(),
      clear: vi.fn(),
      getExtension: vi.fn(() => ({ loseContext: vi.fn() })),
      readPixels: vi.fn((
        _x: number,
        _y: number,
        _width: number,
        _height: number,
        _format: number,
        _type: number,
        pixels: Uint8Array,
      ) => {
        pixels[0] = 255;
        pixels[3] = 255;
      }),
    };

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((contextId) => {
      if (contextId === "webgl2" || contextId === "webgl") {
        return fakeGl as unknown as RenderingContext;
      }
      return {} as CanvasRenderingContext2D;
    });

    const { container, queryByTestId } = render(
      createElement(ValenceOrb, { valence: 0, renderer: "webgl" }),
    );

    expect(createOrbGL2).not.toHaveBeenCalled();
    expect(container.querySelector("canvas[data-orb-first-paint-canvas='true']")).not.toBeNull();
    expect(queryByTestId("valence-orb-first-paint-fallback")).toBeNull();
  });

  it("shows a canonical canvas first-paint frame immediately for forced WebGL orbs", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((contextId) => {
      if (contextId === "2d") {
        return {} as CanvasRenderingContext2D;
      }
      return null;
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
    const firstPaintCanvas = container.querySelector("canvas[data-orb-first-paint-canvas='true']");

    expect(wrapper).toHaveAttribute("data-orb-first-paint-ready", "true");
    expect(wrapper).not.toHaveAttribute("data-orb-visual-ready");
    expect(firstPaintCanvas).toHaveAttribute("data-orb-renderer-tier", "canvas2d");
    expect(firstPaintCanvas).toHaveStyle({ opacity: "1" });
    expect(drawOrbScene).toHaveBeenCalled();
    expect(onFirstPaintReady).toHaveBeenCalledTimes(1);
    expect(onVisualReady).not.toHaveBeenCalled();
    expect(queryByTestId("valence-orb-first-paint-fallback")).toBeNull();
  });

  it("paints the phone forced-WebGL first frame into the mounted stable canvas", () => {
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 449,
    });

    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((contextId) => {
      if (contextId === "2d") {
        return {} as CanvasRenderingContext2D;
      }
      return null;
    });

    const onFirstPaintReady = vi.fn();
    const onVisualReady = vi.fn();

    try {
      const { container, queryByTestId } = render(
        createElement(ValenceOrb, {
          valence: 0.25,
          renderer: "webgl",
          size: 240,
          onFirstPaintReady,
          onVisualReady,
        }),
      );

      const wrapper = container.querySelector("[data-orb-renderer-policy='webgl']");
      const canvases = container.querySelectorAll("canvas");
      const stableCanvas = canvases[0];

      expect(wrapper).toHaveAttribute("data-orb-webgl-upgrade", "held-on-canvas");
      expect(wrapper).toHaveAttribute("data-orb-first-paint-ready", "true");
      expect(wrapper).toHaveAttribute("data-orb-visual-ready", "true");
      expect(canvases).toHaveLength(1);
      expect(getContextSpy).toHaveBeenCalledTimes(1);
      expect(stableCanvas).toHaveAttribute("data-orb-renderer-tier", "canvas2d");
      expect(stableCanvas).not.toHaveAttribute("data-orb-first-paint-canvas");
      expect(stableCanvas).toHaveStyle({ opacity: "1" });
      expect(drawOrbScene).toHaveBeenCalled();
      expect(onFirstPaintReady).toHaveBeenCalledTimes(1);
      expect(onVisualReady).toHaveBeenCalledTimes(1);
      expect(queryByTestId("valence-orb-first-paint-fallback")).toBeNull();
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalInnerWidth,
      });
    }
  });

  it("delays phone forced-WebGL canvas animation after the visible first paint", () => {
    vi.useFakeTimers();
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 449,
    });

    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((contextId) => {
      if (contextId === "2d") {
        return {} as CanvasRenderingContext2D;
      }
      return null;
    });

    try {
      const { container } = render(
        createElement(ValenceOrb, {
          valence: 0.25,
          renderer: "webgl",
          size: 240,
        }),
      );

      expect(container.querySelector("[data-orb-visual-ready='true']")).not.toBeNull();
      expect(window.requestAnimationFrame).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(15999);
      });
      expect(window.requestAnimationFrame).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalInnerWidth,
      });
    }
  });

  it("recovers forced WebGL orbs to the canonical canvas fallback when no first frame arrives", () => {
    vi.useFakeTimers();

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

      expect(onVisualReady).toHaveBeenCalledTimes(1);
      expect(container.querySelector("[data-orb-visual-ready='true']")).not.toBeNull();
      expect(container.querySelector("[data-orb-renderer-tier='canvas2d']")).not.toBeNull();
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
