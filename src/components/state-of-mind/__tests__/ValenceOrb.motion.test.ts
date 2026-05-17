import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { createElement } from "react";

import {
  ORB_TRANSITION_SETTINGS,
  ValenceOrb,
  WEBGL_WORKER_READY_BUDGET_MS,
  resolveFrameTransitionProfile,
  resolveOrbFrameInterval,
  resolveOrbTransitionSettings,
  shouldApplyWorkerWebGLUpgrade,
  shouldStartIdleWakeSoftening,
} from "../ValenceOrb";

import { createOrbGL2 } from "../orbShader";

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

  it("keeps canonical WebGL smooth even when runtime performance mode is active", () => {
    document.documentElement.dataset.runtimePerf = "strained";

    expect(resolveOrbFrameInterval(true)).toBeCloseTo(1000 / 60);
    expect(resolveOrbFrameInterval(false)).toBeCloseTo(1000 / 30);
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

    const { getByTestId } = render(createElement(ValenceOrb, { valence: 0, renderer: "webgl" }));

    expect(createOrbGL2).not.toHaveBeenCalled();
    expect(getByTestId("valence-orb-first-paint-fallback").style.opacity).toBe("1");
  });
});
