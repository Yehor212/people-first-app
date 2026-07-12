import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { createElement } from "react";
import * as ValenceOrbModule from "../ValenceOrb";

import {
  ORB_TRANSITION_SETTINGS,
  ORB_GPU_NOISE_PHASE_WRAP,
  ORB_GPU_RECOVERY_WINDOW_MS,
  ORB_GPU_ORGANIC_TIME_WRAP_SECONDS,
  ORB_GPU_PALETTE_TIME_WRAP_SECONDS,
  ORB_SHADER_TIME_WRAP_SECONDS,
  ValenceOrb,
  WEBGL_FORCED_FIRST_FRAME_TIMEOUT_MS,
  WEBGL_WORKER_READY_BUDGET_MS,
  ORB_WORKER_RENDER_ACK_TIMEOUT_MS,
  ORB_WORKER_FIRST_PRESENTATION_ACK_TIMEOUT_MS,
  ORB_WORKER_STARTUP_TIMEOUT_MS,
  allowsFirstPaintFallback,
  isOrbClockProbeAllowed,
  isOrbFrameDue,
  resolveCanonicalWebGLUpgradeScheduling,
  resolveFrameTransitionProfile,
  resolveOrbBreathPhase,
  resolveOrbFrameDeltaSeconds,
  resolveOrbFrameInterval,
  resolveOrbGpuNoisePhase,
  resolveOrbGpuOrganicTime,
  resolveOrbGpuPaletteTime,
  resolveOrbGpuShaderTime,
  resolveOrbPulsePhase,
  resolveOrbShaderTime,
  resolveOrbTransitionDeltaSeconds,
  resolveOrbTransitionSettings,
  resolveOrbWorkerFrameDeltaSeconds,
  resolveOrbWorkerTransitionDeltaSeconds,
  resolveOrbWrappedTimeDelta,
  resetOrbRuntimeSnapshotsForTests,
  shouldApplyWorkerWebGLUpgrade,
  shouldDropLateVisibleWebGLUpgrade,
  shouldPreferWorkerWebGLBeforeMainThreadWebGPU,
  shouldStartIdleWakeSoftening,
  shouldUseWorkerWebGL,
} from "../ValenceOrb";

import { drawOrbScene } from "../orbRenderer";
import {
  createOrbGL,
  createOrbGL2,
  createOrbGL2Async,
  createOrbGLAsync,
  type OrbGLBuildResult,
} from "../orbShader";
import { createOrbWebGPUAsync } from "../orbWebGpu";

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

vi.mock("../orbWebGpu", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../orbWebGpu")>();
  return {
    ...actual,
    createOrbWebGPUAsync: vi.fn(() => Promise.resolve(null)),
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
  vi.mocked(createOrbWebGPUAsync).mockReset();
  vi.mocked(createOrbWebGPUAsync).mockResolvedValue(null);
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
  const timerStartedAt = Date.now();
  const wallStartedAt = performance.now();
  let wallNow = wallStartedAt;
  vi.spyOn(performance, "now").mockImplementation(() => wallNow);
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
      wallNow = Math.max(wallNow, wallStartedAt + (Date.now() - timerStartedAt));
      callback?.(wallNow);
    },
    flushFrameAt(timestamp: number, wallTimestamp = timestamp) {
      const nextEntry = callbacks.entries().next().value;
      if (!nextEntry) return;
      const [frameId, callback] = nextEntry;
      callbacks.delete(frameId);
      wallNow = wallTimestamp;
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
  it("accepts only an exact active Worker render acknowledgement", () => {
    const isActiveOrbWorkerRenderAck = (
      ValenceOrbModule as typeof ValenceOrbModule & {
        isActiveOrbWorkerRenderAck?: (
          requestId: number | undefined,
          activeRequestId: number,
          renderInFlight: boolean,
        ) => boolean;
      }
    ).isActiveOrbWorkerRenderAck;

    expect(isActiveOrbWorkerRenderAck).toBeTypeOf("function");
    if (!isActiveOrbWorkerRenderAck) return;
    expect(isActiveOrbWorkerRenderAck(undefined, 7, true)).toBe(false);
    expect(isActiveOrbWorkerRenderAck(7, 0, true)).toBe(false);
    expect(isActiveOrbWorkerRenderAck(6, 7, true)).toBe(false);
    expect(isActiveOrbWorkerRenderAck(7, 7, false)).toBe(false);
    expect(isActiveOrbWorkerRenderAck(7, 7, true)).toBe(true);
  });

  it("adapts the Worker acknowledgement deadline to observed GPU latency", () => {
    const resolveOrbWorkerAckTimeoutMs = (
      ValenceOrbModule as typeof ValenceOrbModule & {
        resolveOrbWorkerAckTimeoutMs?: (lastAckLatencyMs?: number | null) => number;
      }
    ).resolveOrbWorkerAckTimeoutMs;

    expect(resolveOrbWorkerAckTimeoutMs).toBeTypeOf("function");
    if (!resolveOrbWorkerAckTimeoutMs) return;
    expect(resolveOrbWorkerAckTimeoutMs()).toBe(ORB_WORKER_RENDER_ACK_TIMEOUT_MS);
    expect(resolveOrbWorkerAckTimeoutMs(undefined, true)).toBe(
      ORB_WORKER_FIRST_PRESENTATION_ACK_TIMEOUT_MS,
    );
    expect(resolveOrbWorkerAckTimeoutMs(Number.NaN)).toBe(ORB_WORKER_RENDER_ACK_TIMEOUT_MS);
    expect(resolveOrbWorkerAckTimeoutMs(250)).toBe(ORB_WORKER_RENDER_ACK_TIMEOUT_MS);
    expect(resolveOrbWorkerAckTimeoutMs(847)).toBe(3388);
    expect(resolveOrbWorkerAckTimeoutMs(2_000)).toBe(4_000);
  });

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

  it("keeps long-session slider changes phase-continuous instead of fast-spinning", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const { flushFrameAt } = installQueuedRaf();

    const rotationSpeedForValence = (v: number) =>
      0.055 + (0.015 - 0.055) * ((v + 1) * 0.5);
    const wrappedPhaseDelta = (from: number, to: number) => {
      const tau = Math.PI * 2;
      const delta = Math.abs(((to - from) % tau + tau) % tau);
      return Math.min(delta, tau - delta);
    };
    const renderPhaseForLastCall = () => {
      const params = vi.mocked(drawOrbScene).mock.calls.at(-1)?.[1] as
        | { valence: number; time: number; motionPhase?: number }
        | undefined;
      if (!params) return 0;
      return params.motionPhase ?? params.time * rotationSpeedForValence(params.valence);
    };

    const view = render(
      createElement(ValenceOrb, {
        valence: -0.143,
        renderer: "canvas",
        animationSpeed: 1,
        transitionProfile: "input-soft",
      }),
    );

    const frameMs = 50;
    const simulatedSeconds = 12 * 60;
    const frameCount = Math.ceil(simulatedSeconds / (frameMs / 1000));

    await act(async () => {
      flushFrameAt(1000);
      for (let i = 1; i <= frameCount; i += 1) {
        flushFrameAt(1000 + i * frameMs);
      }
      await Promise.resolve();
    });

    const beforeChangePhase = renderPhaseForLastCall();

    await act(async () => {
      view.rerender(
        createElement(ValenceOrb, {
          valence: 1,
          renderer: "canvas",
          animationSpeed: 1,
          transitionProfile: "input-soft",
        }),
      );
      await Promise.resolve();
    });

    await act(async () => {
      for (let i = 1; i <= 8; i += 1) {
        flushFrameAt(1000 + (frameCount + i) * frameMs);
      }
      await Promise.resolve();
    });

    const afterChangePhase = renderPhaseForLastCall();

    expect(wrappedPhaseDelta(beforeChangePhase, afterChangePhase)).toBeLessThanOrEqual(0.08);
  });

  it("keeps input transitions on the same responsive profile after idle", () => {
    expect(shouldStartIdleWakeSoftening("input-soft", 9000, -0.667)).toBe(false);
    expect(shouldStartIdleWakeSoftening("input-soft", 1000, -0.667)).toBe(false);
    expect(shouldStartIdleWakeSoftening("v1-soft", 9000, -0.667)).toBe(false);

    expect(resolveFrameTransitionProfile("input-soft", true)).toBe("input-soft");
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

  it("starts full canonical WebGL immediately while staggering mini upgrades", () => {
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

  it("accepts normal 60 Hz rAF jitter without admitting a high-refresh half-frame", () => {
    const frameInterval = 1000 / 60;

    expect(isOrbFrameDue(0, 1_000, frameInterval)).toBe(true);
    expect(isOrbFrameDue(1_000, 1_016.6, frameInterval)).toBe(true);
    expect(isOrbFrameDue(1_000, 1_015.5, frameInterval)).toBe(false);
    expect(isOrbFrameDue(1_000, 1_008.4, frameInterval)).toBe(false);
  });

  it("renders reduced-motion forced WebGL on a mature still frame instead of the startup bead", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const { flushNextFrame } = installQueuedRaf();
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );

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
        size: 240,
      }),
    );

    await flushScheduledWebGLUpgrade(flushNextFrame);

    const firstPayload = renderer.render.mock.calls.at(0)?.[0];
    expect(firstPayload?.time).toBeGreaterThan(0.5);
    expect(firstPayload?.motionPhase).toBeTypeOf("number");
    expect(firstPayload?.noisePhase).toBeTypeOf("number");
    expect(firstPayload?.pulsePhase).toBeCloseTo(1.2 * 0.15, 8);
    expect(firstPayload?.breathPhase).toBeCloseTo(1.2 / (12 + 0.25 * 4), 8);
    expect(firstPayload?.genesis).toBe(1);
  });

  it("freezes the integrated breath phase when reduced motion starts after a long session", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const { flushFrameAt } = installQueuedRaf();
    let reduceMotion = false;
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: reduceMotion && query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );

    const view = render(
      createElement(ValenceOrb, {
        valence: -1,
        renderer: "canvas",
        size: 240,
        animationSpeed: 1,
      }),
    );

    act(() => {
      for (let frame = 0; frame <= 1_300; frame += 1) {
        const timestamp = 1_000 + frame * 50;
        flushFrameAt(timestamp, timestamp);
      }
    });

    const before = vi.mocked(drawOrbScene).mock.calls.at(-1)?.[1];
    expect(before?.time).toBeGreaterThan(60);

    reduceMotion = true;
    view.rerender(
      createElement(ValenceOrb, {
        valence: -0.99,
        renderer: "canvas",
        size: 240,
        animationSpeed: 1,
      }),
    );
    await act(async () => {
      await Promise.resolve();
    });

    const after = vi.mocked(drawOrbScene).mock.calls.at(-1)?.[1];
    const beforePhase = before?.breathPhase ?? 0;
    const afterPhase = after?.breathPhase ?? 0;
    const wrappedDistance = Math.abs((((afterPhase - beforePhase + 0.5) % 1) + 1) % 1 - 0.5);

    expect(wrappedDistance).toBeLessThan(0.001);
  });

  it("restarts from frozen phases when reduced motion is turned back off", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const { flushFrameAt, pendingCount } = installQueuedRaf();
    let reduceMotion = false;
    const changeListeners = new Set<(event: MediaQueryListEvent) => void>();
    const reducedMotionQuery = {
      get matches() {
        return reduceMotion;
      },
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((type: string, listener: (event: MediaQueryListEvent) => void) => {
        if (type === "change") changeListeners.add(listener);
      }),
      removeEventListener: vi.fn((type: string, listener: (event: MediaQueryListEvent) => void) => {
        if (type === "change") changeListeners.delete(listener);
      }),
      dispatchEvent: vi.fn(),
    };
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => query === reducedMotionQuery.media
        ? reducedMotionQuery
        : {
            ...reducedMotionQuery,
            matches: false,
            media: query,
          }),
    );

    render(
      createElement(ValenceOrb, {
        valence: 0.25,
        renderer: "canvas",
        size: 240,
        animationSpeed: 1,
      }),
    );

    act(() => {
      flushFrameAt(1_000, 1_000);
      flushFrameAt(1_050, 1_050);
    });
    reduceMotion = true;
    act(() => {
      changeListeners.forEach((listener) => listener({ matches: true } as MediaQueryListEvent));
      if (pendingCount() > 0) flushFrameAt(1_100, 1_100);
    });
    expect(pendingCount()).toBe(0);
    const frozen = vi.mocked(drawOrbScene).mock.calls.at(-1)?.[1];

    reduceMotion = false;
    act(() => {
      changeListeners.forEach((listener) => listener({ matches: false } as MediaQueryListEvent));
    });

    expect(pendingCount()).toBe(1);
    act(() => {
      flushFrameAt(10_000, 10_000);
    });
    const firstResumed = vi.mocked(drawOrbScene).mock.calls.at(-1)?.[1];

    expect(firstResumed?.time).toBeCloseTo(frozen?.time ?? 0, 8);
    expect(firstResumed?.motionPhase).toBeCloseTo(frozen?.motionPhase ?? 0, 8);
    expect(firstResumed?.noisePhase).toBeCloseTo(frozen?.noisePhase ?? 0, 8);
    expect(firstResumed?.breathPhase).toBeCloseTo(frozen?.breathPhase ?? 0, 8);

    act(() => {
      flushFrameAt(10_050, 10_050);
    });
    const secondResumed = vi.mocked(drawOrbScene).mock.calls.at(-1)?.[1];
    expect(secondResumed?.time).toBeGreaterThan(firstResumed?.time ?? 0);
  });

  it("passes phase-stable motion clocks through WebGL renderer frames", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const { flushNextFrame, flushFrameAt } = installQueuedRaf();

    const renderer = createMockGLRenderer();
    vi.mocked(createOrbGLAsync).mockResolvedValue({
      renderer,
      durationMs: 1,
      tier: "webgl",
    });

    render(
      createElement(ValenceOrb, {
        valence: -0.143,
        renderer: "webgl",
        animationSpeed: 1,
      }),
    );

    await flushScheduledWebGLUpgrade(flushNextFrame);
    await act(async () => {
      flushFrameAt(1000);
      flushFrameAt(1050);
      await Promise.resolve();
    });

    const latestPayload = renderer.render.mock.calls.at(-1)?.[0];

    expect(latestPayload?.time).toBeGreaterThan(0);
    expect(latestPayload?.motionPhase).toBeTypeOf("number");
    expect(latestPayload?.noisePhase).toBeTypeOf("number");
    expect(latestPayload?.motionPhase).toBeGreaterThanOrEqual(0);
    expect(latestPayload?.motionPhase).toBeLessThan(Math.PI * 2);
    expect(latestPayload?.noisePhase).toBeGreaterThanOrEqual(0);
    expect(latestPayload?.noisePhase).toBeLessThan(ORB_SHADER_TIME_WRAP_SECONDS);
  });

  it("reanchors large frame gaps instead of catching up missed orb motion", () => {
    expect(resolveOrbFrameDeltaSeconds(0, 1000)).toBe(0);
    expect(resolveOrbFrameDeltaSeconds(1000, 1034)).toBeCloseTo(0.034);
    expect(resolveOrbFrameDeltaSeconds(1000, 1100)).toBe(0.05);
    expect(resolveOrbFrameDeltaSeconds(1000, 20_000)).toBe(0);
  });

  it("keeps normal RAF cadence when callback latency decreases within one frame", () => {
    expect(resolveOrbFrameDeltaSeconds(1_000, 1_016, 2_014, 2_016)).toBeCloseTo(0.016);
    expect(resolveOrbTransitionDeltaSeconds(1_000, 1_016, 2_014, 2_016)).toBeCloseTo(0.016);

    expect(resolveOrbFrameDeltaSeconds(1_000, 1_050, 2_000, 2_001)).toBeCloseTo(0.001);
  });

  it("lets user-triggered valence transitions catch up after moderate mobile frame gaps", () => {
    expect(resolveOrbTransitionDeltaSeconds(0, 1000)).toBe(0);
    expect(resolveOrbTransitionDeltaSeconds(1000, 1034)).toBeCloseTo(0.034);
    expect(resolveOrbTransitionDeltaSeconds(1000, 1100)).toBeCloseTo(0.1);
    expect(resolveOrbTransitionDeltaSeconds(1000, 1200)).toBeCloseTo(0.12);
    expect(resolveOrbTransitionDeltaSeconds(1000, 20_000)).toBe(0);
  });

  it("keeps worker shader motion wall-time stable at 20, 30, and 60 rendered FPS", () => {
    expect(resolveOrbWorkerFrameDeltaSeconds(0, 1000)).toBe(0);
    expect(resolveOrbWorkerFrameDeltaSeconds(1000, 1016)).toBeCloseTo(0.016);
    expect(resolveOrbWorkerFrameDeltaSeconds(1000, 1100)).toBeCloseTo(0.05);
    expect(resolveOrbWorkerFrameDeltaSeconds(1000, 20_000)).toBe(0);

    for (const framesPerSecond of [20, 30, 60]) {
      const intervalMs = 1000 / framesPerSecond;
      const integratedSeconds = Array.from({ length: framesPerSecond }, (_, index) => {
        const previous = 1000 + index * intervalMs;
        return resolveOrbWorkerFrameDeltaSeconds(previous, previous + intervalMs);
      }).reduce((sum, delta) => sum + delta, 0);

      expect(integratedSeconds).toBeCloseTo(1, 8);
    }

    expect(resolveOrbWorkerTransitionDeltaSeconds(1000, 1100)).toBeCloseTo(0.1);
    expect(resolveOrbWorkerTransitionDeltaSeconds(1000, 1200)).toBeCloseTo(0.12);
    expect(resolveOrbWorkerTransitionDeltaSeconds(1000, 20_000)).toBe(0);
  });

  it("keeps the runtime clock continuous while GPU clocks wrap periodically", () => {
    const frameSeconds = 1 / 60;
    const beforeWrap = ORB_SHADER_TIME_WRAP_SECONDS - frameSeconds / 2;
    const afterWrap = resolveOrbShaderTime(beforeWrap, frameSeconds, 1);

    expect(afterWrap).toBeGreaterThan(ORB_SHADER_TIME_WRAP_SECONDS);
    expect(afterWrap - beforeWrap).toBeCloseTo(frameSeconds, 8);
    expect(
      resolveOrbWrappedTimeDelta(
        resolveOrbGpuShaderTime(beforeWrap),
        resolveOrbGpuShaderTime(afterWrap),
      ),
    ).toBeCloseTo(frameSeconds, 8);

    const longSessionTime = resolveOrbShaderTime(
      ORB_SHADER_TIME_WRAP_SECONDS * 48,
      frameSeconds,
      1,
    );

    expect(longSessionTime).toBeGreaterThan(ORB_SHADER_TIME_WRAP_SECONDS * 48);
    expect(resolveOrbGpuShaderTime(longSessionTime)).toBeGreaterThanOrEqual(0);
    expect(resolveOrbGpuShaderTime(longSessionTime)).toBeLessThan(ORB_SHADER_TIME_WRAP_SECONDS);
  });

  it("keeps canonical rotation phase continuous when shader time wraps", () => {
    const tau = Math.PI * 2;
    const frameSeconds = 1 / 60;
    const beforeWrap = ORB_SHADER_TIME_WRAP_SECONDS - frameSeconds / 2;
    const afterWrap = resolveOrbShaderTime(beforeWrap, frameSeconds, 1);
    const beforeGpuWrap = resolveOrbGpuShaderTime(beforeWrap);
    const afterGpuWrap = resolveOrbGpuShaderTime(afterWrap);
    const canonicalValences = [-1, -0.5, 0, 0.25, 0.5, 1];
    const positiveAngleDelta = (from: number, to: number) => {
      const delta = (to - from) % tau;
      return delta < 0 ? delta + tau : delta;
    };

    for (const valence of canonicalValences) {
      const rotationSpeed = 0.055 + (0.015 - 0.055) * ((valence + 1) * 0.5);
      const actualStep = positiveAngleDelta(
        beforeGpuWrap * rotationSpeed,
        afterGpuWrap * rotationSpeed,
      );

      expect(actualStep).toBeCloseTo(frameSeconds * rotationSpeed, 6);
    }
  });

  it("uses exact simplex-lattice periods for bounded GPU organic clocks", () => {
    const simplexLatticeIndices = (
      period: number,
      [x, y, z]: readonly [number, number, number],
    ) => [
      (period * (4 * x + y + z)) / 867,
      (period * (x + 4 * y + z)) / 867,
      (period * (x + y + 4 * z)) / 867,
    ];
    const organicVectors = [
      [0.03, 0, 0],
      [0, 0, 0.05],
      [0, 0, 0.08],
      [0, 0, 0.15],
      [0.06, 0.06, 0.04],
      [-0.05, -0.05, 0.03],
      [0.08, 0.08, 0.05],
      [-0.06, -0.06, 0.04],
      [0, 0, 0.8],
      [0.15, 0, 0],
      [0, 0.1, 0],
      [0, 0.2, 0],
      [0.06, 0.2, 0],
    ] as const;
    const valenceNoiseVectors = [
      [1, 0.7, 0],
      [1.3, 0.9, 0],
      [1.7, 1.1, 0],
      [0.4, 0.3, 0],
      [0.7, 0.5, 0],
    ] as const;

    for (const vector of organicVectors) {
      for (const index of simplexLatticeIndices(ORB_GPU_ORGANIC_TIME_WRAP_SECONDS, vector)) {
        expect(index).toBeCloseTo(Math.round(index), 8);
      }
    }
    for (const vector of valenceNoiseVectors) {
      for (const index of simplexLatticeIndices(ORB_GPU_NOISE_PHASE_WRAP, vector)) {
        expect(index).toBeCloseTo(Math.round(index), 8);
      }
    }

    const organicBefore = ORB_GPU_ORGANIC_TIME_WRAP_SECONDS - 0.01;
    const organicAfter = organicBefore + 0.02;
    expect(
      resolveOrbWrappedTimeDelta(
        resolveOrbGpuOrganicTime(organicBefore),
        resolveOrbGpuOrganicTime(organicAfter),
        ORB_GPU_ORGANIC_TIME_WRAP_SECONDS,
      ),
    ).toBeCloseTo(0.02, 8);

    const noiseBefore = ORB_GPU_NOISE_PHASE_WRAP - 0.01;
    const noiseAfter = noiseBefore + 0.02;
    expect(
      resolveOrbWrappedTimeDelta(
        resolveOrbGpuNoisePhase(noiseBefore),
        resolveOrbGpuNoisePhase(noiseAfter),
        ORB_GPU_NOISE_PHASE_WRAP,
      ),
    ).toBeCloseTo(0.02, 8);

    const paletteBefore = ORB_GPU_PALETTE_TIME_WRAP_SECONDS - 0.01;
    const paletteAfter = paletteBefore + 0.02;
    expect(
      resolveOrbWrappedTimeDelta(
        resolveOrbGpuPaletteTime(paletteBefore),
        resolveOrbGpuPaletteTime(paletteAfter),
        ORB_GPU_PALETTE_TIME_WRAP_SECONDS,
      ),
    ).toBeCloseTo(0.02, 8);
  });

  it("keeps canonical pulse phase continuous independently of shader time wrapping", () => {
    const frameSeconds = 1 / 60;
    const pulseStep = frameSeconds * 0.15;
    const beforeWrap = 1 - pulseStep / 2;
    const afterWrap = resolveOrbPulsePhase(beforeWrap, frameSeconds, 1);

    expect(resolveOrbWrappedTimeDelta(beforeWrap, afterWrap, 1)).toBeCloseTo(pulseStep, 8);
  });

  it("keeps valence-driven breathing speed independent of accumulated session age", () => {
    const frameSeconds = 1 / 60;

    for (const valence of [-1, 0, 1]) {
      const periodSeconds = 12 + valence * 4;
      const expectedStep = frameSeconds / periodSeconds;

      for (const previousPhase of [0, 0.5, 0.999_5]) {
        const nextPhase = resolveOrbBreathPhase(previousPhase, frameSeconds, valence, 1);
        expect(resolveOrbWrappedTimeDelta(previousPhase, nextPhase, 1)).toBeCloseTo(
          expectedStep,
          8,
        );
      }
    }
  });

  it("reproduces the legacy age-amplified breath jump during a late valence transition", () => {
    const frameSeconds = 1 / 60;
    const phaseAt = (ageSeconds: number, valence: number) => {
      const raw = ageSeconds / (12 + valence * 4);
      return ((raw % 1) + 1) % 1;
    };
    const signedCircularDelta = (previous: number, current: number) => {
      let delta = current - previous;
      if (delta > 0.5) delta -= 1;
      if (delta < -0.5) delta += 1;
      return delta;
    };

    const earlyLegacyStep = signedCircularDelta(
      phaseAt(0, -1),
      phaseAt(frameSeconds, -0.99),
    );
    const lateLegacyStep = signedCircularDelta(
      phaseAt(65, -1),
      phaseAt(65 + frameSeconds, -0.99),
    );
    const integratedStep = resolveOrbWrappedTimeDelta(
      phaseAt(65, -1),
      resolveOrbBreathPhase(phaseAt(65, -1), frameSeconds, -0.99, 1),
      1,
    );

    expect(Math.abs(lateLegacyStep)).toBeGreaterThan(Math.abs(earlyLegacyStep) * 10);
    expect(lateLegacyStep).toBeLessThan(0);
    expect(integratedStep).toBeCloseTo(frameSeconds / (12 - 0.99 * 4), 8);
  });

  it("passes stable shader time through the Canvas renderer during an extended session", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const { flushFrameAt } = installQueuedRaf();

    render(
      createElement(ValenceOrb, {
        valence: 0.25,
        renderer: "canvas",
        animationSpeed: 1,
      }),
    );

    const frameMs = 50;
    const simulatedSeconds = 12 * 60 + 2;
    const frameCount = Math.ceil(simulatedSeconds / (frameMs / 1000));

    await act(async () => {
      flushFrameAt(1000);
      for (let i = 1; i <= frameCount; i += 1) {
        flushFrameAt(1000 + i * frameMs);
      }
      await Promise.resolve();
    });

    const latestOrbTime = vi.mocked(drawOrbScene).mock.calls.at(-1)?.[1].time ?? 0;

    expect(latestOrbTime).toBeGreaterThan(12 * 60);
    expect(latestOrbTime).toBeLessThan(ORB_SHADER_TIME_WRAP_SECONDS);
  });

  it("keeps canonical shader time cadence stable before idle, during idle, and after interaction", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const { flushFrameAt } = installQueuedRaf();

    const { container } = render(
      createElement(ValenceOrb, {
        valence: 0.25,
        renderer: "canvas",
        animationSpeed: 1,
      }),
    );

    const latestOrbTime = () => vi.mocked(drawOrbScene).mock.calls.at(-1)?.[1].time ?? 0;

    await act(async () => {
      flushFrameAt(1000);
      flushFrameAt(1050);
      await Promise.resolve();
    });
    const earlyFrame = latestOrbTime();

    let beforeIdleFrame = earlyFrame;
    let idleFrame = earlyFrame;
    for (let timestamp = 1100; timestamp <= 9000; timestamp += 50) {
      await act(async () => {
        flushFrameAt(timestamp);
        await Promise.resolve();
      });
      beforeIdleFrame = idleFrame;
      idleFrame = latestOrbTime();
    }

    const hero = container.querySelector("[data-orb-renderer-policy='canvas']");
    act(() => {
      hero?.dispatchEvent(new MouseEvent("pointerdown", { clientX: 120, clientY: 120, bubbles: true }));
    });

    await act(async () => {
      flushFrameAt(9050);
      await Promise.resolve();
    });
    const afterInteraction = latestOrbTime();

    expect(idleFrame - beforeIdleFrame).toBeCloseTo(0.05, 4);
    expect(afterInteraction - idleFrame).toBeCloseTo(0.05, 4);
  });

  it("bounds visible orb time by real wall cadence when RAF timestamps arrive in a burst", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    let wallNow = 1_000;
    const { flushFrameAt } = installQueuedRaf();

    render(
      createElement(ValenceOrb, {
        valence: 0.25,
        renderer: "canvas",
        animationSpeed: 1,
      }),
    );

    const latestOrbTime = () => vi.mocked(drawOrbScene).mock.calls.at(-1)?.[1].time ?? 0;

    await act(async () => {
      flushFrameAt(1_000, wallNow);
      wallNow += 34;
      flushFrameAt(1_034, wallNow);
      await Promise.resolve();
    });

    const beforeBurstTime = latestOrbTime();
    const burstStartedAt = wallNow;

    await act(async () => {
      for (let frame = 1; frame <= 10; frame += 1) {
        wallNow += 1;
        flushFrameAt(1_034 + frame * 50, wallNow);
      }
      await Promise.resolve();
    });

    const visibleClockAdvance = latestOrbTime() - beforeBurstTime;
    const realWallAdvance = (wallNow - burstStartedAt) / 1_000;

    expect(visibleClockAdvance).toBeLessThanOrEqual(realWallAdvance + 0.000_001);
  });

  it("keeps a slider transition at its initial pace after a long-session RAF burst", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    let wallNow = 1_000;
    const { flushFrameAt } = installQueuedRaf();

    const { rerender } = render(
      createElement(ValenceOrb, {
        valence: 0,
        renderer: "canvas",
        animationSpeed: 1,
        transitionProfile: "input-soft",
      }),
    );

    await act(async () => {
      flushFrameAt(1_000, wallNow);
      wallNow += 34;
      flushFrameAt(1_034, wallNow);
      await Promise.resolve();
    });

    wallNow += 60_000;
    rerender(
      createElement(ValenceOrb, {
        valence: 1,
        renderer: "canvas",
        animationSpeed: 1,
        transitionProfile: "input-soft",
      }),
    );

    await act(async () => {
      for (let frame = 1; frame <= 10; frame += 1) {
        wallNow += 1;
        flushFrameAt(1_034 + frame * 50, wallNow);
      }
      await Promise.resolve();
    });

    const renderedValence = vi.mocked(drawOrbScene).mock.calls.at(-1)?.[1].valence ?? 0;

    expect(renderedValence).toBeGreaterThan(0);
    expect(renderedValence).toBeLessThan(0.02);
  });

  it("publishes privacy-safe visible-frame cadence samples only when the orb probe is enabled", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const { flushFrameAt } = installQueuedRaf();
    const probeSink = vi.fn();
    const originalUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const probeWindow = window as Window & {
      __zenOrbClockProbeSink?: (sample: Record<string, unknown>) => void;
    };

    window.history.replaceState(null, "", `${window.location.pathname}?orbClockProbe=true`);
    probeWindow.__zenOrbClockProbeSink = probeSink;

    try {
      render(
        createElement(ValenceOrb, {
          valence: 0.25,
          renderer: "canvas",
          animationSpeed: 1,
          size: 280,
        }),
      );

      await act(async () => {
        flushFrameAt(1_000);
        vi.advanceTimersByTime(34);
        flushFrameAt(1_034);
        await Promise.resolve();
      });

      expect(probeSink).toHaveBeenCalled();
      expect(probeSink.mock.calls.at(-1)?.[0]).toMatchObject({
        source: "canvas2d",
        rendererPolicy: "canvas",
        size: 280,
      });
      expect(probeSink.mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({
          renderedValence: expect.any(Number),
          time: expect.any(Number),
          motionPhase: expect.any(Number),
          noisePhase: expect.any(Number),
          pulsePhase: expect.any(Number),
          breathPhase: expect.any(Number),
          renderedAt: expect.any(Number),
        }),
      );
    } finally {
      window.history.replaceState(null, "", originalUrl);
      delete probeWindow.__zenOrbClockProbeSink;
    }
  });

  it("rejects the mood cadence probe on public and native production origins", () => {
    expect(isOrbClockProbeAllowed(new URL("https://yehor212.github.io/people-first-app/"), "production")).toBe(false);
    expect(isOrbClockProbeAllowed(new URL("capacitor://localhost/orb"), "production")).toBe(false);
    expect(isOrbClockProbeAllowed(new URL("tauri://localhost/orb"), "production")).toBe(false);
    expect(isOrbClockProbeAllowed(new URL("http://127.0.0.1:4175/orb"), "production")).toBe(true);
    expect(isOrbClockProbeAllowed(new URL("http://localhost:5173/orb"), "development")).toBe(true);
    expect(isOrbClockProbeAllowed(new URL("http://localhost/orb"), "test")).toBe(true);
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

  it("recovers forced main-thread WebGL context loss through a fresh canonical renderer", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const { flushNextFrame, pendingCount } = installQueuedRaf();
    const originalInnerWidth = window.innerWidth;
    const firstRenderer = createMockGLRenderer();
    const recoveredRenderer = createMockGLRenderer();

    vi.stubGlobal("Worker", undefined);
    vi.stubGlobal("OffscreenCanvas", undefined);
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1024,
    });
    vi.mocked(createOrbGLAsync)
      .mockResolvedValueOnce({ renderer: firstRenderer, durationMs: 1, tier: "webgl" })
      .mockResolvedValueOnce({ renderer: recoveredRenderer, durationMs: 1, tier: "webgl" });

    try {
      const { container } = render(
        createElement(ValenceOrb, {
          valence: 0.25,
          renderer: "webgl",
          size: 240,
        }),
      );

      await flushScheduledWebGLUpgrade(flushNextFrame);
      const firstCanvas = container.querySelector<HTMLCanvasElement>(
        "canvas[data-orb-renderer-tier='webgl-main']",
      );
      expect(firstCanvas).not.toBeNull();

      act(() => {
        firstCanvas?.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(firstRenderer.dispose).toHaveBeenCalledTimes(1);
      expect(vi.mocked(createOrbGLAsync)).toHaveBeenCalledTimes(2);
      expect(recoveredRenderer.render).toHaveBeenCalled();
      expect(container.querySelector("canvas[data-orb-renderer-tier='webgl-main']")).not.toBeNull();
      expect(container.querySelector("canvas[data-orb-renderer-tier='canvas2d']")).toBeNull();
      expect(pendingCount()).toBeGreaterThan(0);
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalInnerWidth,
      });
    }
  });

  it("retries a claimed canonical recovery after every GPU rebuild tier fails", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const { flushNextFrame } = installQueuedRaf();
    const originalInnerWidth = window.innerWidth;
    const initialRenderer = createMockGLRenderer();
    const recoveredRenderer = createMockGLRenderer();

    vi.stubGlobal("Worker", undefined);
    vi.stubGlobal("OffscreenCanvas", undefined);
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1024,
    });
    vi.mocked(createOrbGLAsync)
      .mockResolvedValueOnce({ renderer: initialRenderer, durationMs: 1, tier: "webgl" })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ renderer: recoveredRenderer, durationMs: 1, tier: "webgl" });

    try {
      const view = render(
        createElement(ValenceOrb, {
          valence: -0.5,
          renderer: "webgl",
          size: 240,
        }),
      );

      await flushScheduledWebGLUpgrade(flushNextFrame);
      const initialCanvas = view.container.querySelector<HTMLCanvasElement>(
        "canvas[data-orb-renderer-tier='webgl-main']",
      );
      expect(initialCanvas).not.toBeNull();

      act(() => {
        initialCanvas?.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(vi.mocked(createOrbGLAsync)).toHaveBeenCalledTimes(2);
      expect(view.container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();

      await act(async () => {
        vi.advanceTimersByTime(ORB_GPU_RECOVERY_WINDOW_MS - 1);
        await Promise.resolve();
      });
      expect(vi.mocked(createOrbGLAsync)).toHaveBeenCalledTimes(2);

      vi.mocked(performance.now).mockReturnValue(120_000);
      await act(async () => {
        vi.advanceTimersByTime(1);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(vi.mocked(createOrbGLAsync)).toHaveBeenCalledTimes(3);
      expect(recoveredRenderer.render).toHaveBeenCalled();
      expect(
        view.container.querySelector("canvas[data-orb-renderer-tier='webgl-main']"),
      ).not.toBe(initialCanvas);
      expect(view.container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalInnerWidth,
      });
    }
  });

  it("preserves a restored-context retry that arrives during an active failed rebuild", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const { flushNextFrame } = installQueuedRaf();
    const originalInnerWidth = window.innerWidth;
    const initialRenderer = createMockGLRenderer();
    const restoredRenderer = createMockGLRenderer();
    let resolveActiveRecovery!: (result: OrbGLBuildResult | null) => void;
    const activeRecovery = new Promise<OrbGLBuildResult | null>((resolve) => {
      resolveActiveRecovery = resolve;
    });

    vi.stubGlobal("Worker", undefined);
    vi.stubGlobal("OffscreenCanvas", undefined);
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1024,
    });
    vi.mocked(createOrbGLAsync)
      .mockResolvedValueOnce({ renderer: initialRenderer, durationMs: 1, tier: "webgl" })
      .mockImplementationOnce(() => activeRecovery)
      .mockResolvedValueOnce({ renderer: restoredRenderer, durationMs: 1, tier: "webgl" });

    try {
      const view = render(
        createElement(ValenceOrb, {
          valence: 0.25,
          renderer: "webgl",
          size: 240,
        }),
      );

      await flushScheduledWebGLUpgrade(flushNextFrame);
      const initialCanvas = view.container.querySelector<HTMLCanvasElement>(
        "canvas[data-orb-renderer-tier='webgl-main']",
      );
      expect(initialCanvas).not.toBeNull();

      act(() => {
        initialCanvas?.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(createOrbGLAsync).toHaveBeenCalledTimes(2);

      act(() => {
        initialCanvas?.dispatchEvent(new Event("webglcontextrestored"));
      });
      expect(createOrbGLAsync).toHaveBeenCalledTimes(2);

      await act(async () => {
        resolveActiveRecovery(null);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(createOrbGLAsync).toHaveBeenCalledTimes(3);
      expect(restoredRenderer.render).toHaveBeenCalled();
      expect(
        view.container.querySelector("canvas[data-orb-renderer-tier='webgl-main']"),
      ).not.toBe(initialCanvas);
      expect(view.container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalInnerWidth,
      });
    }
  });

  it("allows one restored-context bypass, then enforces the per-mount lifetime budget", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const { flushNextFrame } = installQueuedRaf();
    const originalInnerWidth = window.innerWidth;
    const renderers = Array.from({ length: 4 }, () => createMockGLRenderer());
    const onVisualError = vi.fn();

    vi.stubGlobal("Worker", undefined);
    vi.stubGlobal("OffscreenCanvas", undefined);
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1024,
    });
    vi.mocked(createOrbGLAsync).mockImplementation(async () => ({
      renderer: renderers[vi.mocked(createOrbGLAsync).mock.calls.length - 1],
      durationMs: 1,
      tier: "webgl",
    }));

    try {
      const { container, rerender } = render(
        createElement(ValenceOrb, {
          valence: 0.25,
          renderer: "webgl",
          size: 240,
          onVisualError,
        }),
      );

      await flushScheduledWebGLUpgrade(flushNextFrame);
      let currentCanvas = container.querySelector<HTMLCanvasElement>(
        "canvas[data-orb-renderer-tier='webgl-main']",
      );
      expect(currentCanvas).not.toBeNull();

      for (let loss = 0; loss < 3; loss += 1) {
        const previousCanvas = currentCanvas;
        act(() => {
          previousCanvas?.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
        });
        await act(async () => {
          await Promise.resolve();
          await Promise.resolve();
          await Promise.resolve();
          await Promise.resolve();
        });
        currentCanvas = container.querySelector<HTMLCanvasElement>(
          "canvas[data-orb-renderer-tier='webgl-main']",
        );
        if (loss < 2) {
          expect(currentCanvas).not.toBe(previousCanvas);
        } else {
          expect(currentCanvas).toBe(previousCanvas);
        }
      }

      expect(vi.mocked(createOrbGLAsync)).toHaveBeenCalledTimes(3);
      expect(container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();

      const budgetExhaustedCanvas = currentCanvas;
      act(() => {
        budgetExhaustedCanvas?.dispatchEvent(new Event("webglcontextrestored"));
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(vi.mocked(createOrbGLAsync)).toHaveBeenCalledTimes(4);
      currentCanvas = container.querySelector<HTMLCanvasElement>(
        "canvas[data-orb-renderer-tier='webgl-main']",
      );
      expect(currentCanvas).not.toBe(budgetExhaustedCanvas);
      expect(container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();

      const restoredRenderer = renderers[3];
      const renderCountBeforeSlider = restoredRenderer.render.mock.calls.length;
      const valenceBeforeSlider = restoredRenderer.render.mock.calls.at(-1)?.[0].valence ?? 0.25;
      rerender(
        createElement(ValenceOrb, {
          valence: 0.75,
          renderer: "webgl",
          size: 240,
          onVisualError,
        }),
      );
      act(() => {
        flushNextFrame();
      });
      act(() => {
        vi.advanceTimersByTime(34);
        flushNextFrame();
      });
      expect(restoredRenderer.render.mock.calls.length).toBeGreaterThan(renderCountBeforeSlider);
      expect(restoredRenderer.render.mock.calls.at(-1)?.[0].valence).toBeGreaterThan(
        valenceBeforeSlider,
      );

      const canvasAfterBudgetStop = currentCanvas;
      act(() => {
        canvasAfterBudgetStop?.dispatchEvent(
          new Event("webglcontextlost", { cancelable: true }),
        );
        canvasAfterBudgetStop?.dispatchEvent(new Event("webglcontextrestored"));
        canvasAfterBudgetStop?.dispatchEvent(new Event("webglcontextrestored"));
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(vi.mocked(createOrbGLAsync)).toHaveBeenCalledTimes(4);
      expect(onVisualError).toHaveBeenCalledTimes(1);
      vi.mocked(performance.now).mockReturnValue(120_000);
      await act(async () => {
        vi.advanceTimersByTime(ORB_GPU_RECOVERY_WINDOW_MS);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(vi.mocked(createOrbGLAsync)).toHaveBeenCalledTimes(4);
      expect(onVisualError).toHaveBeenCalledTimes(1);
      expect(container.querySelector("canvas")).toBeNull();
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalInnerWidth,
      });
    }
  });

  it("recovers silent main-thread WebGL loss while reduced motion is static", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const { flushNextFrame } = installQueuedRaf();
    const originalInnerWidth = window.innerWidth;
    const firstRenderer = createMockGLRenderer();
    const recoveredRenderer = createMockGLRenderer();

    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    vi.stubGlobal("Worker", undefined);
    vi.stubGlobal("OffscreenCanvas", undefined);
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1024,
    });
    vi.mocked(createOrbGLAsync)
      .mockResolvedValueOnce({ renderer: firstRenderer, durationMs: 1, tier: "webgl" })
      .mockResolvedValueOnce({ renderer: recoveredRenderer, durationMs: 1, tier: "webgl" });

    try {
      const { container } = render(
        createElement(ValenceOrb, {
          valence: 0.25,
          renderer: "webgl",
          size: 240,
        }),
      );

      await flushScheduledWebGLUpgrade(flushNextFrame);
      const firstPayload = firstRenderer.render.mock.calls.at(-1)?.[0];
      vi.mocked(firstRenderer.isContextLost).mockReturnValue(true);

      await act(async () => {
        vi.advanceTimersByTime(5_001);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      const recoveredPayload = recoveredRenderer.render.mock.calls.at(-1)?.[0];
      expect(firstRenderer.dispose).toHaveBeenCalledTimes(1);
      expect(createOrbGLAsync).toHaveBeenCalledTimes(2);
      expect(recoveredRenderer.render).toHaveBeenCalled();
      expect(recoveredPayload?.valence).toBe(firstPayload?.valence);
      expect(recoveredPayload?.motionPhase).toBe(firstPayload?.motionPhase);
      expect(recoveredPayload?.noisePhase).toBe(firstPayload?.noisePhase);
      expect(recoveredPayload?.pulsePhase).toBe(firstPayload?.pulsePhase);
      expect(recoveredPayload?.breathPhase).toBe(firstPayload?.breathPhase);
      expect(container.querySelector("[data-orb-renderer-tier='webgl-main']")).not.toBeNull();
      expect(container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalInnerWidth,
      });
    }
  });

  it("disposes an async WebGL renderer that finishes after the orb unmounts", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const { flushNextFrame } = installQueuedRaf();
    const originalInnerWidth = window.innerWidth;
    const lateRenderer = createMockGLRenderer();
    let resolveBuild: (result: OrbGLBuildResult | null) => void = () => {};
    const pendingBuild = new Promise<OrbGLBuildResult | null>((resolve) => {
      resolveBuild = resolve;
    });

    vi.stubGlobal("Worker", undefined);
    vi.stubGlobal("OffscreenCanvas", undefined);
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1024,
    });
    vi.mocked(createOrbGLAsync).mockReturnValue(pendingBuild);

    try {
      const view = render(
        createElement(ValenceOrb, {
          valence: 0.25,
          renderer: "webgl",
          size: 240,
        }),
      );

      await act(async () => {
        flushNextFrame();
        vi.advanceTimersByTime(1_000);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(vi.mocked(createOrbGLAsync)).toHaveBeenCalledTimes(1);

      view.unmount();
      resolveBuild({ renderer: lateRenderer, durationMs: 1, tier: "webgl" });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(lateRenderer.dispose).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalInnerWidth,
      });
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

  it("prefers worker WebGL before main-thread WebGPU on phone-like forced orbs", () => {
    const originalInnerWidth = window.innerWidth;
    const hadTransferControl =
      "transferControlToOffscreen" in HTMLCanvasElement.prototype;
    const originalTransferControl =
      HTMLCanvasElement.prototype.transferControlToOffscreen;

    Object.defineProperty(HTMLCanvasElement.prototype, "transferControlToOffscreen", {
      configurable: true,
      value: vi.fn(() => ({ width: 0, height: 0 })),
    });
    vi.stubGlobal("OffscreenCanvas", class OffscreenCanvasStub {});
    vi.stubGlobal("Worker", vi.fn());

    try {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: 449,
      });
      expect(shouldPreferWorkerWebGLBeforeMainThreadWebGPU(true, 240)).toBe(true);

      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: 1024,
      });
      expect(shouldPreferWorkerWebGLBeforeMainThreadWebGPU(true, 240)).toBe(false);
      expect(shouldPreferWorkerWebGLBeforeMainThreadWebGPU(false, 240)).toBe(false);
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

  it("recovers a visible worker WebGL runtime failure through canonical main-thread WebGL", async () => {
    vi.useFakeTimers();
    stubCanvasContexts();
    stubVisibleOrbRect();
    const { flushNextFrame, pendingCount } = installQueuedRaf();
    const originalInnerWidth = window.innerWidth;
    const hadTransferControl =
      "transferControlToOffscreen" in HTMLCanvasElement.prototype;
    const originalTransferControl =
      HTMLCanvasElement.prototype.transferControlToOffscreen;

    class WorkerStub {
      onmessage: ((event: MessageEvent<{
        type: "ready" | "rendered" | "failed";
        reason?: string;
        requestId?: number;
      }>) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage = vi.fn((message: {
        type: "init" | "render" | "dispose";
        requestId?: number;
      }) => {
        if (message.type === "init") {
          queueMicrotask(() => {
            this.onmessage?.({
              data: { type: "ready" },
            } as MessageEvent<{ type: "ready" }>);
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
      failRuntime() {
        this.onmessage?.({
          data: {
            type: "failed",
            reason: "WebGL worker context lost during render",
          },
        } as MessageEvent<{ type: "failed"; reason: string }>);
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

    const webGlRenderer = createMockGLRenderer();
    vi.mocked(createOrbGLAsync).mockResolvedValue({
      renderer: webGlRenderer,
      durationMs: 5,
      tier: "webgl",
    });

    try {
      const { container } = render(
        createElement(ValenceOrb, {
          valence: -0.143,
          renderer: "webgpu",
          size: 240,
          animationSpeed: 1,
        }),
      );

      await flushScheduledWebGLUpgrade(flushNextFrame);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(container.querySelector("[data-orb-renderer-tier='webgl-worker']")).not.toBeNull();
      expect(container.querySelector("[data-orb-visual-ready='true']")).not.toBeNull();

      act(() => {
        workerInstances[0]?.failRuntime();
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(workerInstances[0]?.terminate).toHaveBeenCalledTimes(1);
      expect(vi.mocked(createOrbWebGPUAsync)).not.toHaveBeenCalled();
      expect(vi.mocked(createOrbGLAsync)).toHaveBeenCalledTimes(1);
      expect(webGlRenderer.render).toHaveBeenCalled();
      expect(container.querySelector("[data-orb-renderer-tier='webgl-main']")).not.toBeNull();
      expect(container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();
      expect(pendingCount()).toBeGreaterThan(0);
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

  it("retries after the circuit window, then stops at the per-mount recovery budget", async () => {
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
      onmessage: ((event: MessageEvent<{
        type: "ready" | "rendered" | "failed";
        reason?: string;
        requestId?: number;
      }>) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage = vi.fn((message: {
        type: "init" | "render" | "dispose";
        requestId?: number;
      }) => {
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
      failRuntime() {
        this.onmessage?.({
          data: {
            type: "failed",
            reason: "WebGL worker context lost during render",
          },
        } as MessageEvent<{ type: "failed"; reason: string }>);
      }
    }

    const workerInstances: WorkerStub[] = [];
    const WorkerSpy = vi.fn(function WorkerMock() {
      const worker = new WorkerStub();
      workerInstances.push(worker);
      return worker;
    });
    const mainRenderers = [createMockGLRenderer(), createMockGLRenderer()];
    vi.mocked(createOrbGLAsync).mockImplementation(async () => ({
      renderer: mainRenderers[vi.mocked(createOrbGLAsync).mock.calls.length - 1],
      durationMs: 1,
      tier: "webgl",
    }));

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 449 });
    Object.defineProperty(HTMLCanvasElement.prototype, "transferControlToOffscreen", {
      configurable: true,
      value: vi.fn(() => ({ width: 0, height: 0 })),
    });
    vi.stubGlobal("OffscreenCanvas", class OffscreenCanvasStub {});
    vi.stubGlobal("Worker", WorkerSpy);

    const onVisualError = vi.fn();
    const view = render(
      createElement(ValenceOrb, {
        valence: -1,
        renderer: "webgl",
        size: 240,
        animationSpeed: 1,
        onVisualError,
      }),
    );
    let unmounted = false;

    const flushRecovery = async () => {
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
    };

    try {
      await flushScheduledWebGLUpgrade(flushNextFrame);
      await flushRecovery();
      expect(WorkerSpy).toHaveBeenCalledTimes(1);
      expect(
        view.container.querySelector("canvas")?.getAttribute("data-orb-renderer-tier"),
      ).toBe("webgl-worker");

      act(() => {
        workerInstances[0]?.failRuntime();
      });
      await flushRecovery();
      const firstMainCanvas = view.container.querySelector<HTMLCanvasElement>(
        "canvas[data-orb-renderer-tier='webgl-main']",
      );
      expect(firstMainCanvas).not.toBeNull();
      expect(vi.mocked(createOrbGLAsync)).toHaveBeenCalledTimes(1);

      act(() => {
        firstMainCanvas?.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
      });
      await flushRecovery();
      expect(WorkerSpy).toHaveBeenCalledTimes(2);
      expect(
        view.container.querySelector("canvas")?.getAttribute("data-orb-renderer-tier"),
      ).toBe("webgl-worker");

      act(() => {
        workerInstances[1]?.failRuntime();
      });
      await flushRecovery();
      const exhaustedCanvas = view.container.querySelector<HTMLCanvasElement>(
        "canvas[data-orb-renderer-tier='webgl-worker']",
      );
      expect(exhaustedCanvas).not.toBeNull();
      expect(exhaustedCanvas?.isConnected).toBe(true);
      expect(view.container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();
      expect(vi.mocked(createOrbGLAsync)).toHaveBeenCalledTimes(1);

      await act(async () => {
        vi.advanceTimersByTime(ORB_GPU_RECOVERY_WINDOW_MS - 1);
        await Promise.resolve();
      });
      expect(vi.mocked(createOrbGLAsync)).toHaveBeenCalledTimes(1);

      vi.mocked(performance.now).mockReturnValue(120_000);
      await act(async () => {
        vi.advanceTimersByTime(1);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(vi.mocked(createOrbGLAsync)).toHaveBeenCalledTimes(2);
      expect(
        view.container.querySelector("canvas")?.getAttribute("data-orb-renderer-tier"),
      ).toBe("webgl-main");
      expect(view.container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();

      const recoveredRenderer = mainRenderers[1];
      const renderCountBeforeSlider = recoveredRenderer.render.mock.calls.length;
      const valenceBeforeSlider = recoveredRenderer.render.mock.calls.at(-1)?.[0].valence ?? -1;
      view.rerender(
        createElement(ValenceOrb, {
          valence: 1,
          renderer: "webgl",
          size: 240,
          animationSpeed: 1,
          onVisualError,
        }),
      );
      act(() => {
        flushNextFrame();
      });
      vi.mocked(performance.now).mockReturnValue(120_034);
      act(() => {
        vi.advanceTimersByTime(34);
        flushNextFrame();
      });
      expect(recoveredRenderer.render.mock.calls.length).toBeGreaterThan(renderCountBeforeSlider);
      expect(recoveredRenderer.render.mock.calls.at(-1)?.[0].valence).toBeGreaterThan(
        valenceBeforeSlider,
      );

      const recoveredMainCanvas = view.container.querySelector<HTMLCanvasElement>(
        "canvas[data-orb-renderer-tier='webgl-main']",
      );
      act(() => {
        recoveredMainCanvas?.dispatchEvent(
          new Event("webglcontextlost", { cancelable: true }),
        );
      });
      await flushRecovery();
      expect(WorkerSpy).toHaveBeenCalledTimes(2);
      expect(onVisualError).toHaveBeenCalledTimes(1);

      vi.mocked(performance.now).mockReturnValue(240_000);
      await act(async () => {
        vi.advanceTimersByTime(60_000);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(vi.mocked(createOrbGLAsync)).toHaveBeenCalledTimes(2);
      expect(WorkerSpy).toHaveBeenCalledTimes(2);

      view.unmount();
      unmounted = true;
      for (const worker of workerInstances) {
        expect(worker.terminate).toHaveBeenCalledTimes(1);
      }
    } finally {
      if (!unmounted) view.unmount();
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

  it("ignores overlapping main loss signals without arming a stale recovery retry", async () => {
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
      onmessage: ((event: MessageEvent<{
        type: "ready" | "rendered" | "failed";
        reason?: string;
        requestId?: number;
      }>) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage = vi.fn((message: {
        type: "init" | "render" | "dispose";
        requestId?: number;
      }) => {
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
      failRuntime() {
        this.onmessage?.({
          data: {
            type: "failed",
            reason: "WebGL worker context lost during render",
          },
        } as MessageEvent<{ type: "failed"; reason: string }>);
      }
    }

    const workerInstances: WorkerStub[] = [];
    const WorkerSpy = vi.fn(function WorkerMock() {
      const worker = new WorkerStub();
      workerInstances.push(worker);
      return worker;
    });
    const mainRenderer = createMockGLRenderer();
    vi.mocked(createOrbGLAsync).mockResolvedValue({
      renderer: mainRenderer,
      durationMs: 1,
      tier: "webgl",
    });

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 449 });
    Object.defineProperty(HTMLCanvasElement.prototype, "transferControlToOffscreen", {
      configurable: true,
      value: vi.fn(() => ({ width: 0, height: 0 })),
    });
    vi.stubGlobal("OffscreenCanvas", class OffscreenCanvasStub {});
    vi.stubGlobal("Worker", WorkerSpy);

    const view = render(
      createElement(ValenceOrb, {
        valence: -0.143,
        renderer: "webgl",
        size: 240,
        animationSpeed: 1,
      }),
    );

    const flushRecovery = async () => {
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
    };

    try {
      await flushScheduledWebGLUpgrade(flushNextFrame);
      await flushRecovery();
      expect(WorkerSpy).toHaveBeenCalledTimes(1);

      act(() => {
        workerInstances[0]?.failRuntime();
      });
      await flushRecovery();
      const mainCanvas = view.container.querySelector<HTMLCanvasElement>(
        "canvas[data-orb-renderer-tier='webgl-main']",
      );
      expect(mainCanvas).not.toBeNull();

      act(() => {
        mainCanvas?.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
        mainCanvas?.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
      });
      await flushRecovery();

      const healthyWorkerCanvas = view.container.querySelector<HTMLCanvasElement>(
        "canvas[data-orb-renderer-tier='webgl-worker']",
      );
      expect(healthyWorkerCanvas).not.toBeNull();
      expect(WorkerSpy).toHaveBeenCalledTimes(2);
      expect(workerInstances[0]?.terminate).toHaveBeenCalledTimes(1);
      expect(workerInstances[1]?.terminate).not.toHaveBeenCalled();

      vi.mocked(performance.now).mockReturnValue(120_000);
      await act(async () => {
        vi.advanceTimersByTime(60_000);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(WorkerSpy).toHaveBeenCalledTimes(2);
      expect(
        view.container.querySelector("canvas[data-orb-renderer-tier='webgl-worker']"),
      ).toBe(healthyWorkerCanvas);
      expect(healthyWorkerCanvas?.isConnected).toBe(true);
      expect(workerInstances[1]?.terminate).not.toHaveBeenCalled();
      expect(mainRenderer.dispose).toHaveBeenCalledTimes(1);
      expect(view.container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();
    } finally {
      view.unmount();
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

  it("restarts canonical worker WebGL after a visible failure when parallel shader compile is unavailable", async () => {
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
      onmessage: ((event: MessageEvent<{
        type: "ready" | "rendered" | "failed";
        reason?: string;
        requestId?: number;
      }>) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage = vi.fn((message: {
        type: "init" | "render" | "dispose";
        requestId?: number;
      }) => {
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
      failRuntime() {
        this.onmessage?.({
          data: {
            type: "failed",
            reason: "WebGL worker context lost during render",
          },
        } as MessageEvent<{ type: "failed"; reason: string }>);
      }
    }

    const workerInstances: WorkerStub[] = [];
    const WorkerSpy = vi.fn(function WorkerMock() {
      const worker = new WorkerStub();
      workerInstances.push(worker);
      return worker;
    });

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 449 });
    Object.defineProperty(HTMLCanvasElement.prototype, "transferControlToOffscreen", {
      configurable: true,
      value: vi.fn(() => ({ width: 0, height: 0 })),
    });
    vi.stubGlobal("OffscreenCanvas", class OffscreenCanvasStub {});
    vi.stubGlobal("Worker", WorkerSpy);

    try {
      const { container } = render(
        createElement(ValenceOrb, {
          valence: -0.143,
          renderer: "webgl",
          size: 240,
          animationSpeed: 1,
        }),
      );

      await flushScheduledWebGLUpgrade(flushNextFrame);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      const firstCanvas = container.querySelector("[data-orb-renderer-tier='webgl-worker']");
      expect(firstCanvas).not.toBeNull();
      expect(WorkerSpy).toHaveBeenCalledTimes(1);

      act(() => {
        workerInstances[0]?.failRuntime();
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      const recoveredCanvas = container.querySelector("[data-orb-renderer-tier='webgl-worker']");
      expect(workerInstances[0]?.terminate).toHaveBeenCalledTimes(1);
      expect(WorkerSpy).toHaveBeenCalledTimes(2);
      expect(createOrbGLAsync).toHaveBeenCalledTimes(1);
      expect(createOrbGL2Async).toHaveBeenCalledTimes(1);
      expect(createOrbGL).not.toHaveBeenCalled();
      expect(createOrbGL2).not.toHaveBeenCalled();
      expect(recoveredCanvas).not.toBeNull();
      expect(recoveredCanvas).not.toBe(firstCanvas);
      expect(container.querySelector("[data-orb-visual-ready='true']")).not.toBeNull();
      expect(container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();
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

  it("keeps the last valid frame then reports a silent retry worker without blocking", async () => {
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
      onmessage: ((event: MessageEvent<{
        type: "ready" | "rendered" | "failed";
        reason?: string;
        requestId?: number;
      }>) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      constructor(private readonly starts: boolean) {}
      postMessage = vi.fn((message: {
        type: "init" | "render" | "dispose";
        requestId?: number;
      }) => {
        if (message.type === "init" && this.starts) {
          queueMicrotask(() => {
            this.onmessage?.({ data: { type: "ready" } } as MessageEvent<{ type: "ready" }>);
          });
          return;
        }
        if (message.type === "render" && this.starts) {
          queueMicrotask(() => {
            this.onmessage?.({
              data: { type: "rendered", requestId: message.requestId },
            } as MessageEvent<{ type: "rendered"; requestId?: number }>);
          });
        }
      });
      terminate = vi.fn();
      failRuntime() {
        this.onmessage?.({
          data: {
            type: "failed",
            reason: "WebGL worker context lost during render",
          },
        } as MessageEvent<{ type: "failed"; reason: string }>);
      }
    }

    const workerInstances: WorkerStub[] = [];
    const WorkerSpy = vi.fn(function WorkerMock() {
      const worker = new WorkerStub(workerInstances.length === 0);
      workerInstances.push(worker);
      return worker;
    });

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 449 });
    Object.defineProperty(HTMLCanvasElement.prototype, "transferControlToOffscreen", {
      configurable: true,
      value: vi.fn(() => ({ width: 0, height: 0 })),
    });
    vi.stubGlobal("OffscreenCanvas", class OffscreenCanvasStub {});
    vi.stubGlobal("Worker", WorkerSpy);

    const mainThreadRenderer = createMockGLRenderer();
    vi.mocked(createOrbGL).mockReturnValue(mainThreadRenderer);
    const onVisualError = vi.fn();

    try {
      const { container } = render(
        createElement(ValenceOrb, {
          valence: -0.143,
          renderer: "webgl",
          size: 240,
          animationSpeed: 1,
          onVisualError,
        }),
      );

      await flushScheduledWebGLUpgrade(flushNextFrame);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(container.querySelector("[data-orb-renderer-tier='webgl-worker']")).not.toBeNull();

      act(() => {
        workerInstances[0]?.failRuntime();
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(workerInstances[0]?.terminate).toHaveBeenCalledTimes(1);
      expect(WorkerSpy).toHaveBeenCalledTimes(2);
      expect(createOrbGLAsync).toHaveBeenCalledTimes(1);
      expect(createOrbGL2Async).toHaveBeenCalledTimes(1);
      expect(createOrbGL).not.toHaveBeenCalled();
      expect(createOrbGL2).not.toHaveBeenCalled();
      expect(mainThreadRenderer.render).not.toHaveBeenCalled();
      expect(container.querySelector("[data-orb-renderer-tier='webgl-worker']")).not.toBeNull();
      expect(container.querySelector("[data-orb-visual-ready='true']")).not.toBeNull();
      expect(container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();
      expect(onVisualError).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(ORB_WORKER_STARTUP_TIMEOUT_MS + 1);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(createOrbGL).not.toHaveBeenCalled();
      expect(createOrbGL2).not.toHaveBeenCalled();
      expect(onVisualError).toHaveBeenCalledTimes(1);
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

  it.each([
    { label: "animated rendering", reducedMotion: false },
    { label: "a reduced-motion static healthcheck", reducedMotion: true },
  ])("recovers a worker render that never acknowledges $label", async ({ reducedMotion }) => {
    vi.useFakeTimers();
    stubCanvasContexts(false);
    stubVisibleOrbRect();
    const { flushNextFrame } = installQueuedRaf();
    const originalInnerWidth = window.innerWidth;
    const hadTransferControl =
      "transferControlToOffscreen" in HTMLCanvasElement.prototype;
    const originalTransferControl =
      HTMLCanvasElement.prototype.transferControlToOffscreen;

    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: reducedMotion && query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );

    class WorkerStub {
      onmessage: ((event: MessageEvent<{ type: "ready" | "rendered"; requestId?: number }>) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      renderCount = 0;
      constructor(private readonly recovers: boolean) {}
      postMessage = vi.fn((message: {
        type: "init" | "render" | "dispose";
        requestId?: number;
      }) => {
        if (message.type === "init") {
          queueMicrotask(() => {
            this.onmessage?.({ data: { type: "ready" } } as MessageEvent<{ type: "ready" }>);
          });
          return;
        }
        if (message.type === "render") {
          this.renderCount += 1;
          if (this.recovers || this.renderCount === 1) {
            queueMicrotask(() => {
              this.onmessage?.({
                data: { type: "rendered", requestId: message.requestId },
              } as MessageEvent<{ type: "rendered"; requestId?: number }>);
            });
          }
        }
      });
      terminate = vi.fn();
    }

    const workerInstances: WorkerStub[] = [];
    const WorkerSpy = vi.fn(function WorkerMock() {
      const worker = new WorkerStub(workerInstances.length > 0);
      workerInstances.push(worker);
      return worker;
    });

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 449 });
    Object.defineProperty(HTMLCanvasElement.prototype, "transferControlToOffscreen", {
      configurable: true,
      value: vi.fn(() => ({ width: 0, height: 0 })),
    });
    vi.stubGlobal("OffscreenCanvas", class OffscreenCanvasStub {});
    vi.stubGlobal("Worker", WorkerSpy);

    try {
      const { container } = render(
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
        await Promise.resolve();
      });

      expect(WorkerSpy).toHaveBeenCalledTimes(1);
      expect(workerInstances[0]?.renderCount).toBe(1);
      expect(container.querySelector("[data-orb-renderer-tier='webgl-worker']")).not.toBeNull();

      if (!reducedMotion) {
        act(() => {
          flushNextFrame();
        });
        await act(async () => {
          await Promise.resolve();
          await Promise.resolve();
        });
        expect(workerInstances[0]?.renderCount).toBe(2);
      }

      await act(async () => {
        vi.advanceTimersByTime(7_000);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(workerInstances[0]?.renderCount).toBeGreaterThanOrEqual(2);
      expect(workerInstances[0]?.terminate).toHaveBeenCalledTimes(1);
      expect(WorkerSpy).toHaveBeenCalledTimes(2);
      expect(workerInstances[1]?.renderCount).toBeGreaterThanOrEqual(1);
      expect(container.querySelector("[data-orb-renderer-tier='webgl-worker']")).not.toBeNull();
      expect(container.querySelector("[data-orb-visual-ready='true']")).not.toBeNull();
      expect(container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();
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

  it("suspends the forced first-frame timeout when the page freezes before worker paint", async () => {
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
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage = vi.fn((message: {
        type: "init" | "render" | "dispose";
        requestId?: number;
      }) => {
        if (message.type === "render" && message.requestId) {
          queueMicrotask(() => {
            this.onmessage?.({
              data: { type: "rendered", requestId: message.requestId },
            } as MessageEvent<{ type: "rendered"; requestId: number }>);
          });
        }
      });
      ready() {
        queueMicrotask(() => {
          this.onmessage?.({ data: { type: "ready" } } as MessageEvent<{ type: "ready" }>);
        });
      }
      terminate = vi.fn();
    }

    const worker = new WorkerStub();
    const WorkerSpy = vi.fn(function WorkerMock() {
      return worker;
    });
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 449 });
    Object.defineProperty(HTMLCanvasElement.prototype, "transferControlToOffscreen", {
      configurable: true,
      value: vi.fn(() => ({ width: 0, height: 0 })),
    });
    vi.stubGlobal("OffscreenCanvas", class OffscreenCanvasStub {});
    vi.stubGlobal("Worker", WorkerSpy);

    try {
      const view = render(
        createElement(ValenceOrb, {
          valence: 0.25,
          renderer: "webgl",
          size: 240,
          animationSpeed: 1,
        }),
      );

      await flushScheduledWebGLUpgrade(flushNextFrame);
      expect(WorkerSpy).toHaveBeenCalledTimes(1);
      expect(view.container.querySelector("[data-orb-visual-ready='true']")).toBeNull();

      act(() => {
        document.dispatchEvent(new Event("freeze"));
      });
      await act(async () => {
        vi.advanceTimersByTime(WEBGL_FORCED_FIRST_FRAME_TIMEOUT_MS + 100);
        await Promise.resolve();
      });

      expect(worker.terminate).not.toHaveBeenCalled();
      expect(WorkerSpy).toHaveBeenCalledTimes(1);
      expect(view.container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();

      act(() => {
        document.dispatchEvent(new Event("resume"));
        worker.ready();
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(worker.terminate).not.toHaveBeenCalled();
      expect(WorkerSpy).toHaveBeenCalledTimes(1);
      expect(view.container.querySelector("[data-orb-renderer-tier='webgl-worker']")).not.toBeNull();
      expect(view.container.querySelector("[data-orb-visual-ready='true']")).not.toBeNull();
      expect(view.container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();

      await act(async () => {
        vi.advanceTimersByTime(WEBGL_FORCED_FIRST_FRAME_TIMEOUT_MS + 100);
        await Promise.resolve();
      });
      expect(worker.terminate).not.toHaveBeenCalled();
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

  it("rebases an in-flight worker ACK watchdog across page freeze and resume", async () => {
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
      onerror: ((event: ErrorEvent) => void) | null = null;
      renderCount = 0;
      lastRequestId = 0;
      postMessage = vi.fn((message: {
        type: "init" | "render" | "dispose";
        requestId?: number;
      }) => {
        if (message.type === "init") {
          queueMicrotask(() => {
            this.onmessage?.({ data: { type: "ready" } } as MessageEvent<{ type: "ready" }>);
          });
          return;
        }
        if (message.type === "render" && message.requestId) {
          this.renderCount += 1;
          this.lastRequestId = message.requestId;
          if (this.renderCount === 1) this.acknowledge();
        }
      });
      acknowledge() {
        const requestId = this.lastRequestId;
        queueMicrotask(() => {
          this.onmessage?.({
            data: { type: "rendered", requestId },
          } as MessageEvent<{ type: "rendered"; requestId: number }>);
        });
      }
      terminate = vi.fn();
    }

    const worker = new WorkerStub();
    const WorkerSpy = vi.fn(function WorkerMock() {
      return worker;
    });
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 449 });
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
        await Promise.resolve();
      });
      expect(worker.renderCount).toBe(1);

      act(() => {
        flushNextFrame();
      });
      await act(async () => {
        await Promise.resolve();
      });
      expect(worker.renderCount).toBe(2);

      act(() => {
        document.dispatchEvent(new Event("freeze"));
      });
      await act(async () => {
        vi.advanceTimersByTime(ORB_WORKER_RENDER_ACK_TIMEOUT_MS + 100);
        await Promise.resolve();
      });
      expect(worker.terminate).not.toHaveBeenCalled();
      expect(WorkerSpy).toHaveBeenCalledTimes(1);

      act(() => {
        document.dispatchEvent(new Event("resume"));
        worker.acknowledge();
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        vi.advanceTimersByTime(ORB_WORKER_RENDER_ACK_TIMEOUT_MS + 100);
      });

      expect(worker.terminate).not.toHaveBeenCalled();
      expect(WorkerSpy).toHaveBeenCalledTimes(1);
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

  it("requires a fresh visible Worker frame after readiness arrives while hidden", async () => {
    vi.useFakeTimers();
    stubCanvasContexts(false);
    stubVisibleOrbRect();
    const { flushNextFrame } = installQueuedRaf();
    const originalInnerWidth = window.innerWidth;
    const hadTransferControl =
      "transferControlToOffscreen" in HTMLCanvasElement.prototype;
    const originalTransferControl = HTMLCanvasElement.prototype.transferControlToOffscreen;
    let hidden = false;
    vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);

    class WorkerStub {
      onmessage: ((event: MessageEvent<{
        type: "ready" | "rendered";
        requestId?: number;
      }>) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      requestIds: number[] = [];
      postMessage = vi.fn((message: {
        type: "init" | "render" | "dispose";
        requestId?: number;
      }) => {
        if (message.type === "init") {
          queueMicrotask(() => {
            this.onmessage?.({ data: { type: "ready" } } as MessageEvent<{ type: "ready" }>);
          });
          return;
        }
        if (message.type === "render" && message.requestId) {
          this.requestIds.push(message.requestId);
        }
      });
      acknowledgeLatest() {
        const requestId = this.requestIds.at(-1);
        this.onmessage?.({
          data: { type: "rendered", requestId },
        } as MessageEvent<{ type: "rendered"; requestId?: number }>);
      }
      terminate = vi.fn();
    }

    const worker = new WorkerStub();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 449 });
    Object.defineProperty(HTMLCanvasElement.prototype, "transferControlToOffscreen", {
      configurable: true,
      value: vi.fn(() => ({ width: 0, height: 0 })),
    });
    vi.stubGlobal("OffscreenCanvas", class OffscreenCanvasStub {});
    vi.stubGlobal("Worker", vi.fn(function WorkerMock() {
      return worker;
    }));
    const onVisualReady = vi.fn();

    try {
      const { container } = render(
        createElement(ValenceOrb, {
          valence: 0,
          renderer: "webgl",
          size: 240,
          onVisualReady,
        }),
      );

      await flushScheduledWebGLUpgrade(flushNextFrame);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(worker.requestIds).toHaveLength(1);

      hidden = true;
      act(() => worker.acknowledgeLatest());
      expect(onVisualReady).not.toHaveBeenCalled();
      expect(container.querySelector("[data-orb-visual-ready='true']")).toBeNull();

      hidden = false;
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(worker.requestIds).toHaveLength(2);
      expect(onVisualReady).not.toHaveBeenCalled();

      act(() => worker.acknowledgeLatest());
      expect(onVisualReady).toHaveBeenCalledTimes(1);
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

  it("stops reduced-motion worker health timers while hidden or offscreen and resumes one", async () => {
    vi.useFakeTimers();
    stubCanvasContexts(false);
    stubVisibleOrbRect();
    const hiddenSpy = vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    const { flushNextFrame } = installQueuedRaf();
    const originalInnerWidth = window.innerWidth;
    const hadTransferControl =
      "transferControlToOffscreen" in HTMLCanvasElement.prototype;
    const originalTransferControl =
      HTMLCanvasElement.prototype.transferControlToOffscreen;
    const observerCallbacks: IntersectionObserverCallback[] = [];

    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
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

    class WorkerStub {
      onmessage: ((event: MessageEvent<{ type: "ready" | "rendered"; requestId?: number }>) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      renderCount = 0;
      postMessage = vi.fn((message: {
        type: "init" | "render" | "dispose";
        requestId?: number;
      }) => {
        if (message.type === "init") {
          queueMicrotask(() => {
            this.onmessage?.({ data: { type: "ready" } } as MessageEvent<{ type: "ready" }>);
          });
          return;
        }
        if (message.type === "render" && message.requestId) {
          this.renderCount += 1;
          queueMicrotask(() => {
            this.onmessage?.({
              data: { type: "rendered", requestId: message.requestId },
            } as MessageEvent<{ type: "rendered"; requestId: number }>);
          });
        }
      });
      terminate = vi.fn();
    }

    const worker = new WorkerStub();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 449 });
    Object.defineProperty(HTMLCanvasElement.prototype, "transferControlToOffscreen", {
      configurable: true,
      value: vi.fn(() => ({ width: 0, height: 0 })),
    });
    vi.stubGlobal("OffscreenCanvas", class OffscreenCanvasStub {});
    vi.stubGlobal("Worker", vi.fn(function WorkerMock() {
      return worker;
    }));

    try {
      const view = render(
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
        await Promise.resolve();
      });
      const initialRenderCount = worker.renderCount;
      expect(initialRenderCount).toBe(1);

      hiddenSpy.mockReturnValue(true);
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      expect(vi.getTimerCount()).toBe(0);
      await act(async () => {
        vi.advanceTimersByTime(60_000);
        await Promise.resolve();
      });
      expect(worker.renderCount).toBe(initialRenderCount);

      hiddenSpy.mockReturnValue(false);
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await act(async () => {
        vi.advanceTimersByTime(5_001);
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(worker.renderCount).toBe(initialRenderCount + 1);
      expect(vi.getTimerCount()).toBe(1);

      const wrapper = view.container.querySelector("[data-orb-renderer-policy='webgl']");
      if (!wrapper) throw new Error("Expected forced WebGL wrapper");
      const makeEntry = (isIntersecting: boolean) => ({
        boundingClientRect: wrapper.getBoundingClientRect(),
        intersectionRatio: isIntersecting ? 1 : 0,
        intersectionRect: wrapper.getBoundingClientRect(),
        isIntersecting,
        rootBounds: null,
        target: wrapper,
        time: performance.now(),
      }) satisfies IntersectionObserverEntry;

      act(() => {
        for (const callback of observerCallbacks) {
          callback([makeEntry(false)], {} as IntersectionObserver);
        }
      });
      expect(vi.getTimerCount()).toBe(0);
      await act(async () => {
        vi.advanceTimersByTime(60_000);
        await Promise.resolve();
      });
      expect(worker.renderCount).toBe(initialRenderCount + 1);

      act(() => {
        for (const callback of observerCallbacks) {
          callback([makeEntry(true)], {} as IntersectionObserver);
        }
      });
      await act(async () => {
        vi.advanceTimersByTime(5_001);
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(worker.renderCount).toBe(initialRenderCount + 2);
      expect(vi.getTimerCount()).toBe(1);
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

  it("keeps the selected reduced-motion valence across worker healthchecks", async () => {
    vi.useFakeTimers();
    stubCanvasContexts(false);
    stubVisibleOrbRect();
    const { flushNextFrame } = installQueuedRaf();
    const originalInnerWidth = window.innerWidth;
    const hadTransferControl =
      "transferControlToOffscreen" in HTMLCanvasElement.prototype;
    const originalTransferControl =
      HTMLCanvasElement.prototype.transferControlToOffscreen;

    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );

    type RenderMessage = {
      type: "render";
      requestId: number;
      payload: {
        valence: number;
        time: number;
        motionPhase: number;
        noisePhase: number;
        pulsePhase: number;
        breathPhase: number;
        shimmer: number;
        [key: string]: unknown;
      };
    };

    class WorkerStub {
      onmessage: ((event: MessageEvent<{ type: "ready" | "rendered"; requestId?: number }>) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      renderMessages: RenderMessage[] = [];
      postMessage = vi.fn((message: {
        type: "init" | "render" | "dispose";
        requestId?: number;
        payload?: RenderMessage["payload"];
      }) => {
        if (message.type === "init") {
          queueMicrotask(() => {
            this.onmessage?.({ data: { type: "ready" } } as MessageEvent<{ type: "ready" }>);
          });
          return;
        }
        if (message.type === "render" && message.requestId && message.payload) {
          this.renderMessages.push(message as RenderMessage);
          queueMicrotask(() => {
            this.onmessage?.({
              data: { type: "rendered", requestId: message.requestId },
            } as MessageEvent<{ type: "rendered"; requestId: number }>);
          });
        }
      });
      terminate = vi.fn();
    }

    const worker = new WorkerStub();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 449 });
    Object.defineProperty(HTMLCanvasElement.prototype, "transferControlToOffscreen", {
      configurable: true,
      value: vi.fn(() => ({ width: 0, height: 0 })),
    });
    vi.stubGlobal("OffscreenCanvas", class OffscreenCanvasStub {});
    vi.stubGlobal("Worker", vi.fn(function WorkerMock() {
      return worker;
    }));

    try {
      const view = render(
        createElement(ValenceOrb, {
          valence: -0.143,
          renderer: "webgl",
          size: 240,
          animationSpeed: 1,
        }),
      );

      await flushScheduledWebGLUpgrade(flushNextFrame);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      view.rerender(
        createElement(ValenceOrb, {
          valence: 1,
          renderer: "webgl",
          size: 240,
          animationSpeed: 1,
        }),
      );
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      const selectedPayload = worker.renderMessages.at(-1)?.payload;
      expect(selectedPayload?.valence).toBe(1);
      expect(selectedPayload?.shimmer).toBe(0);
      const renderCountBeforeHealthcheck = worker.renderMessages.length;

      await act(async () => {
        vi.advanceTimersByTime(5_001);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      const healthcheckPayload = worker.renderMessages.at(-1)?.payload;
      expect(worker.renderMessages.length).toBeGreaterThan(renderCountBeforeHealthcheck);
      expect(healthcheckPayload).toEqual(selectedPayload);
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
      payload: {
        time: number;
        motionPhase: number;
        noisePhase: number;
        pulsePhase: number;
        breathPhase: number;
      };
    }> = [];

    class WorkerStub {
      onmessage: ((event: MessageEvent<{ type: "ready" | "rendered"; requestId?: number }>) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage = vi.fn((message: {
        type: "init" | "render" | "dispose";
        requestId?: number;
        payload?: {
          time: number;
          motionPhase: number;
          noisePhase: number;
          pulsePhase: number;
          breathPhase: number;
        };
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
        flushFrameAt(2600);
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(renderMessages.length).toBeGreaterThanOrEqual(2);
      expect(renderMessages[0].payload.motionPhase).toBeTypeOf("number");
      expect(renderMessages[0].payload.noisePhase).toBeTypeOf("number");
      expect(renderMessages[1].payload.motionPhase).toBeTypeOf("number");
      expect(renderMessages[1].payload.noisePhase).toBeTypeOf("number");
      expect(renderMessages[1].payload.time - firstRenderTime).toBeLessThanOrEqual(0.02);
      expect(renderMessages[1].payload.motionPhase - renderMessages[0].payload.motionPhase).toBeLessThanOrEqual(0.002);
      expect(renderMessages[1].payload.noisePhase - renderMessages[0].payload.noisePhase).toBeLessThanOrEqual(0.02);
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
      payload: {
        time: number;
        motionPhase: number;
        noisePhase: number;
        pulsePhase: number;
        breathPhase: number;
      };
    }> = [];

    class WorkerStub {
      onmessage: ((event: MessageEvent<{ type: "ready" | "rendered"; requestId?: number }>) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage = vi.fn((message: {
        type: "init" | "render" | "dispose";
        requestId?: number;
        payload?: {
          time: number;
          motionPhase: number;
          noisePhase: number;
          pulsePhase: number;
          breathPhase: number;
        };
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
      expect(workerInstances[0]?.terminate).toHaveBeenCalledTimes(1);
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
      const firstPayloadBeforeRemount = renderMessages.at(messageCountBeforeRemount - 1)?.payload;
      const firstPayloadAfterRemount = renderMessages[messageCountBeforeRemount]?.payload;
      const firstTimeAfterRemount = firstPayloadAfterRemount?.time ?? 0;
      expect(firstPayloadBeforeRemount?.motionPhase).toBeTypeOf("number");
      expect(firstPayloadBeforeRemount?.noisePhase).toBeTypeOf("number");
      expect(firstPayloadBeforeRemount?.pulsePhase).toBeTypeOf("number");
      expect(firstPayloadBeforeRemount?.breathPhase).toBeTypeOf("number");
      expect(firstPayloadAfterRemount?.motionPhase).toBeTypeOf("number");
      expect(firstPayloadAfterRemount?.noisePhase).toBeTypeOf("number");
      expect(firstPayloadAfterRemount?.pulsePhase).toBeTypeOf("number");
      expect(firstPayloadAfterRemount?.breathPhase).toBeTypeOf("number");
      expect(firstTimeAfterRemount).toBeGreaterThanOrEqual(timeBeforeRemount);
      expect(firstPayloadAfterRemount?.motionPhase).toBeGreaterThanOrEqual(firstPayloadBeforeRemount?.motionPhase ?? 0);
      expect(firstPayloadAfterRemount?.pulsePhase).toBeCloseTo(
        firstPayloadBeforeRemount?.pulsePhase ?? 0,
        6,
      );
      expect(firstPayloadAfterRemount?.breathPhase).toBeCloseTo(
        firstPayloadBeforeRemount?.breathPhase ?? 0,
        6,
      );
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

  it("ignores a Worker rendered message that omits the active request id", async () => {
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
      onmessage: ((event: MessageEvent<{
        type: "ready" | "rendered";
        requestId?: number;
      }>) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      lastRequestId = 0;
      postMessage = vi.fn((message: {
        type: "init" | "render" | "dispose";
        requestId?: number;
      }) => {
        if (message.type === "init") {
          queueMicrotask(() => {
            this.onmessage?.({ data: { type: "ready" } } as MessageEvent<{ type: "ready" }>);
          });
          return;
        }
        if (message.type === "render" && message.requestId) {
          this.lastRequestId = message.requestId;
          queueMicrotask(() => {
            this.onmessage?.({ data: { type: "rendered" } } as MessageEvent<{
              type: "rendered";
            }>);
          });
        }
      });
      acknowledgeActiveRequest() {
        const requestId = this.lastRequestId;
        queueMicrotask(() => {
          this.onmessage?.({
            data: { type: "rendered", requestId },
          } as MessageEvent<{ type: "rendered"; requestId: number }>);
        });
      }
      terminate = vi.fn();
    }

    const worker = new WorkerStub();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 449 });
    Object.defineProperty(HTMLCanvasElement.prototype, "transferControlToOffscreen", {
      configurable: true,
      value: vi.fn(() => ({ width: 0, height: 0 })),
    });
    vi.stubGlobal("OffscreenCanvas", class OffscreenCanvasStub {});
    vi.stubGlobal("Worker", vi.fn(function WorkerMock() {
      return worker;
    }));

    try {
      const view = render(
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
      expect(worker.lastRequestId).toBeGreaterThan(0);
      expect(view.container.querySelector("[data-orb-visual-ready='true']")).toBeNull();
      const pendingCanvas = view.container.querySelector<HTMLCanvasElement>(
        "[data-orb-renderer-tier='webgl-worker']",
      );
      expect(pendingCanvas).not.toBeNull();
      expect(pendingCanvas?.style.opacity).toBe("0");

      act(() => {
        worker.acknowledgeActiveRequest();
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(view.container.querySelector("[data-orb-visual-ready='true']")).not.toBeNull();
      expect(view.container.querySelector("[data-orb-renderer-tier='webgl-worker']")).not.toBeNull();
      expect(pendingCanvas?.style.opacity).toBe("1");
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

  it("publishes a WebGPU canvas only after its first submitted frame is validated", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const { flushNextFrame } = installQueuedRaf();
    let resolveFirstPresentation!: (value: boolean) => void;
    const firstPresentation = new Promise<boolean>((resolve) => {
      resolveFirstPresentation = resolve;
    });
    const webGpuRenderer = {
      ...createMockGLRenderer(),
      waitForFirstPresentation: vi.fn(() => firstPresentation),
    };

    vi.mocked(createOrbWebGPUAsync).mockResolvedValue({
      renderer: webGpuRenderer,
      durationMs: 5,
      tier: "webgpu",
    });

    const view = render(
      createElement(ValenceOrb, {
        valence: -0.143,
        renderer: "webgpu",
        size: 240,
        animationSpeed: 1,
      }),
    );

    await flushScheduledWebGLUpgrade(flushNextFrame);
    expect(webGpuRenderer.render).toHaveBeenCalledTimes(1);
    expect(webGpuRenderer.waitForFirstPresentation).toHaveBeenCalledTimes(1);
    expect(view.container.querySelector("[data-orb-renderer-tier='webgpu-main']")).toBeNull();
    expect(view.container.querySelector("[data-orb-visual-ready='true']")).toBeNull();

    await act(async () => {
      resolveFirstPresentation(true);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(view.container.querySelector("[data-orb-renderer-tier='webgpu-main']")).not.toBeNull();
    expect(view.container.querySelector("[data-orb-visual-ready='true']")).not.toBeNull();
  });

  it("never publishes a WebGPU renderer lost between validation and publication", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const { flushNextFrame } = installQueuedRaf();
    let contextLost = false;
    let notifyContextLost: (() => void) | undefined;
    const webGpuRenderer = {
      ...createMockGLRenderer(),
      isContextLost: vi.fn(() => contextLost),
      waitForFirstPresentation: vi.fn(async () => {
        contextLost = true;
        notifyContextLost?.();
        return true;
      }),
    };
    const webGlRenderer = createMockGLRenderer();

    vi.mocked(createOrbWebGPUAsync).mockImplementation(async (_canvas, options) => {
      notifyContextLost = options?.onContextLost;
      return {
        renderer: webGpuRenderer,
        durationMs: 5,
        tier: "webgpu",
      };
    });
    vi.mocked(createOrbGLAsync).mockResolvedValue({
      renderer: webGlRenderer,
      durationMs: 5,
      tier: "webgl",
    });

    const view = render(
      createElement(ValenceOrb, {
        valence: -0.143,
        renderer: "webgpu",
        size: 240,
      }),
    );

    await flushScheduledWebGLUpgrade(flushNextFrame);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(webGpuRenderer.dispose).toHaveBeenCalledTimes(1);
    expect(createOrbGLAsync).toHaveBeenCalledTimes(1);
    expect(webGlRenderer.render).toHaveBeenCalled();
    expect(view.container.querySelector("[data-orb-renderer-tier='webgpu-main']")).toBeNull();
    expect(view.container.querySelector("[data-orb-renderer-tier='webgl-main']")).not.toBeNull();
    expect(view.container.querySelector("[data-orb-visual-ready='true']")).not.toBeNull();
  });

  it("falls back before publication when WebGPU first-submit validation fails", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const { flushNextFrame } = installQueuedRaf();
    const webGpuRenderer = {
      ...createMockGLRenderer(),
      waitForFirstPresentation: vi.fn(async () => false),
    };
    const webGlRenderer = createMockGLRenderer();

    vi.mocked(createOrbWebGPUAsync).mockResolvedValue({
      renderer: webGpuRenderer,
      durationMs: 5,
      tier: "webgpu",
    });
    vi.mocked(createOrbGLAsync).mockResolvedValue({
      renderer: webGlRenderer,
      durationMs: 5,
      tier: "webgl",
    });

    const view = render(
      createElement(ValenceOrb, {
        valence: 0.25,
        renderer: "webgpu",
        size: 240,
      }),
    );

    await flushScheduledWebGLUpgrade(flushNextFrame);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      flushNextFrame();
      flushNextFrame();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(webGpuRenderer.dispose).toHaveBeenCalledTimes(1);
    expect(webGlRenderer.render).toHaveBeenCalled();
    expect(view.container.querySelector("[data-orb-renderer-tier='webgpu-main']")).toBeNull();
    expect(view.container.querySelector("[data-orb-renderer-tier='webgl-main']")).not.toBeNull();
    expect(view.container.querySelector("[data-orb-visual-ready='true']")).not.toBeNull();
  });

  it("recovers a lost WebGPU device through canonical main-thread WebGL", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const { flushNextFrame, pendingCount } = installQueuedRaf();
    const webGpuRenderer = createMockGLRenderer();
    const webGlRenderer = createMockGLRenderer();

    vi.mocked(createOrbWebGPUAsync).mockResolvedValue({
      renderer: webGpuRenderer,
      durationMs: 5,
      tier: "webgpu",
    });
    vi.mocked(createOrbGLAsync).mockResolvedValue({
      renderer: webGlRenderer,
      durationMs: 5,
      tier: "webgl",
    });

    const view = render(
      createElement(ValenceOrb, {
        valence: -0.143,
        renderer: "webgpu",
        size: 240,
        animationSpeed: 1,
      }),
    );

    await flushScheduledWebGLUpgrade(flushNextFrame);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(vi.mocked(createOrbWebGPUAsync)).toHaveBeenCalledTimes(1);
    expect(view.container.querySelector("canvas")?.dataset.orbRendererTier).toBe(
      "webgpu-main",
    );

    const onContextLost = vi.mocked(createOrbWebGPUAsync).mock.calls[0]?.[1]?.onContextLost;
    expect(onContextLost).toBeTypeOf("function");

    act(() => {
      onContextLost?.();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(webGpuRenderer.dispose).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createOrbWebGPUAsync)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createOrbGLAsync)).toHaveBeenCalledTimes(1);
    expect(webGlRenderer.render).toHaveBeenCalled();
    expect(view.container.querySelector("canvas")?.dataset.orbRendererTier).toBe(
      "webgl-main",
    );
    expect(view.container.querySelector('canvas[data-orb-renderer-tier="canvas2d"]')).toBeNull();
    expect(pendingCount()).toBeGreaterThan(0);
  });

  it("reports WebGPU loss when only blocking recovery remains", async () => {
    vi.useFakeTimers();
    stubCanvasContexts(false);
    stubVisibleOrbRect();
    const { flushNextFrame } = installQueuedRaf();
    const originalInnerWidth = window.innerWidth;
    const webGpuRenderer = createMockGLRenderer();
    const webGlRenderer = createMockGLRenderer();

    vi.stubGlobal("Worker", undefined);
    vi.stubGlobal("OffscreenCanvas", undefined);
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
    vi.mocked(createOrbWebGPUAsync).mockResolvedValue({
      renderer: webGpuRenderer,
      durationMs: 5,
      tier: "webgpu",
    });
    vi.mocked(createOrbGLAsync).mockResolvedValue(null);
    vi.mocked(createOrbGL2Async).mockResolvedValue(null);
    vi.mocked(createOrbGL).mockReturnValue(webGlRenderer);
    const onVisualError = vi.fn();

    try {
      const view = render(
        createElement(ValenceOrb, {
          valence: -0.143,
          renderer: "webgpu",
          size: 240,
          animationSpeed: 1,
          onVisualError,
        }),
      );

      await flushScheduledWebGLUpgrade(flushNextFrame);
      const onContextLost = vi.mocked(createOrbWebGPUAsync).mock.calls[0]?.[1]?.onContextLost;
      expect(view.container.querySelector("canvas")?.dataset.orbRendererTier).toBe("webgpu-main");

      act(() => {
        onContextLost?.();
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(webGpuRenderer.dispose).toHaveBeenCalledTimes(1);
      expect(createOrbGLAsync).toHaveBeenCalledTimes(1);
      expect(createOrbGL2Async).toHaveBeenCalledTimes(1);
      expect(createOrbGL).not.toHaveBeenCalled();
      expect(createOrbGL2).not.toHaveBeenCalled();
      expect(webGlRenderer.render).not.toHaveBeenCalled();
      expect(view.container.querySelector("canvas")?.dataset.orbRendererTier).not.toBe("webgl-main");
      expect(view.container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();
      expect(onVisualError).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalInnerWidth,
      });
    }
  });

  it("recovers a post-publication WebGPU render exception through canonical WebGL", async () => {
    vi.useFakeTimers();
    stubCanvasContexts(false);
    stubVisibleOrbRect();
    const { flushNextFrame } = installQueuedRaf();
    const originalInnerWidth = window.innerWidth;
    const webGpuRenderer = createMockGLRenderer();
    const webGlRenderer = createMockGLRenderer();

    webGpuRenderer.render
      .mockImplementationOnce(() => {})
      .mockImplementationOnce(() => {
        throw new Error("getCurrentTexture failed after publication");
      });
    vi.stubGlobal("Worker", undefined);
    vi.stubGlobal("OffscreenCanvas", undefined);
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
    vi.mocked(createOrbWebGPUAsync).mockResolvedValue({
      renderer: webGpuRenderer,
      durationMs: 5,
      tier: "webgpu",
    });
    vi.mocked(createOrbGLAsync).mockResolvedValue({
      renderer: webGlRenderer,
      durationMs: 5,
      tier: "webgl",
    });

    try {
      const view = render(
        createElement(ValenceOrb, {
          valence: -0.143,
          renderer: "webgpu",
          size: 240,
          animationSpeed: 1,
        }),
      );

      await flushScheduledWebGLUpgrade(flushNextFrame);
      expect(view.container.querySelector("canvas")?.dataset.orbRendererTier).toBe(
        "webgpu-main",
      );

      act(() => {
        flushNextFrame();
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(webGpuRenderer.dispose).toHaveBeenCalledTimes(1);
      expect(createOrbWebGPUAsync).toHaveBeenCalledTimes(1);
      expect(createOrbGLAsync).toHaveBeenCalledTimes(1);
      expect(webGlRenderer.render).toHaveBeenCalled();
      expect(view.container.querySelector("canvas")?.dataset.orbRendererTier).toBe(
        "webgl-main",
      );
      expect(view.container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalInnerWidth,
      });
    }
  });

  it.each([
    { label: "motion-preference switch", trigger: "preference" as const },
    { label: "valence update", trigger: "valence" as const },
  ])("recovers a reduced-motion WebGPU $label render failure", async ({ trigger }) => {
    vi.useFakeTimers();
    stubCanvasContexts(false);
    stubVisibleOrbRect();
    const { flushNextFrame } = installQueuedRaf();
    const originalInnerWidth = window.innerWidth;
    const webGpuRenderer = createMockGLRenderer();
    const webGlRenderer = createMockGLRenderer();
    let reduceMotion = trigger === "valence";

    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: reduceMotion && query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    webGpuRenderer.render
      .mockImplementationOnce(() => {})
      .mockImplementationOnce(() => {
        throw new Error("reduced-motion WebGPU presentation failed");
      });
    vi.stubGlobal("Worker", undefined);
    vi.stubGlobal("OffscreenCanvas", undefined);
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
    vi.mocked(createOrbWebGPUAsync).mockResolvedValue({
      renderer: webGpuRenderer,
      durationMs: 5,
      tier: "webgpu",
    });
    vi.mocked(createOrbGLAsync).mockResolvedValue({
      renderer: webGlRenderer,
      durationMs: 5,
      tier: "webgl",
    });

    try {
      const view = render(
        createElement(ValenceOrb, {
          valence: -0.143,
          renderer: "webgpu",
          size: 240,
          animationSpeed: 1,
        }),
      );

      await flushScheduledWebGLUpgrade(flushNextFrame);
      expect(view.container.querySelector("canvas")?.dataset.orbRendererTier).toBe(
        "webgpu-main",
      );

      if (trigger === "preference") {
        act(() => {
          reduceMotion = true;
          window.dispatchEvent(new Event("dopamine-settings-change"));
        });
      } else {
        view.rerender(
          createElement(ValenceOrb, {
            valence: 0.75,
            renderer: "webgpu",
            size: 240,
            animationSpeed: 1,
          }),
        );
      }
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(webGpuRenderer.dispose).toHaveBeenCalledTimes(1);
      expect(createOrbWebGPUAsync).toHaveBeenCalledTimes(1);
      expect(createOrbGLAsync).toHaveBeenCalledTimes(1);
      expect(webGlRenderer.render).toHaveBeenCalled();
      expect(view.container.querySelector("canvas")?.dataset.orbRendererTier).toBe(
        "webgl-main",
      );
      expect(view.container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalInnerWidth,
      });
    }
  });

  it("does not recover forced WebGL startup failure to a non-canonical Canvas2D renderer", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const { flushNextFrame } = installQueuedRaf();
    const onFirstPaintReady = vi.fn();
    const onVisualReady = vi.fn();
    const onVisualError = vi.fn();

    const { container, queryByTestId } = render(
      createElement(ValenceOrb, {
        valence: 0.25,
        renderer: "webgl",
        onFirstPaintReady,
        onVisualReady,
        onVisualError,
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
    expect(onVisualError).toHaveBeenCalledTimes(1);
    expect(queryByTestId("valence-orb-first-paint-fallback")).toBeNull();
  });

  it("never compiles canonical shaders synchronously on the main thread", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const { flushNextFrame } = installQueuedRaf();
    vi.mocked(createOrbGLAsync).mockResolvedValue(null);
    vi.mocked(createOrbGL2Async).mockResolvedValue(null);
    vi.mocked(createOrbGL).mockReturnValue(null);
    const renderer = createMockGLRenderer();
    vi.mocked(createOrbGL2).mockReturnValue(renderer);
    const onVisualError = vi.fn();

    const { container } = render(
      createElement(ValenceOrb, {
        valence: 0.25,
        renderer: "webgl",
        size: 240,
        onVisualError,
      }),
    );

    await flushScheduledWebGLUpgrade(flushNextFrame);

    const wrapper = container.querySelector("[data-orb-renderer-policy='webgl']");
    expect(createOrbGLAsync).toHaveBeenCalledTimes(1);
    expect(createOrbGL2Async).toHaveBeenCalledTimes(1);
    expect(createOrbGL).not.toHaveBeenCalled();
    expect(createOrbGL2).not.toHaveBeenCalled();
    expect(renderer.render).not.toHaveBeenCalled();
    expect(wrapper).not.toHaveAttribute("data-orb-visual-ready");
    expect(container.querySelector("[data-orb-renderer-tier='webgl-main']")).toBeNull();
    expect(container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();
    expect(onVisualError).toHaveBeenCalledTimes(1);
  });

  it.each(["transfer", "construct", "init"] as const)(
    "recovers a synchronous worker $stage failure through asynchronous canonical WebGL",
    async (stage) => {
      vi.useFakeTimers();
      stubCanvasContexts(false);
      stubVisibleOrbRect();
      const { flushNextFrame } = installQueuedRaf();
      const originalInnerWidth = window.innerWidth;
      const hadTransferControl =
        "transferControlToOffscreen" in HTMLCanvasElement.prototype;
      const originalTransferControl =
        HTMLCanvasElement.prototype.transferControlToOffscreen;
      const renderer = createMockGLRenderer();

      class WorkerStub {
        onmessage: ((event: MessageEvent) => void) | null = null;
        onerror: ((event: ErrorEvent) => void) | null = null;
        postMessage = vi.fn(() => {
          if (stage === "init") throw new Error("worker init send failed");
        });
        terminate = vi.fn();
      }

      const worker = new WorkerStub();
      const WorkerSpy = vi.fn(function WorkerMock() {
        if (stage === "construct") throw new Error("worker construction failed");
        return worker;
      });

      Object.defineProperty(window, "innerWidth", { configurable: true, value: 449 });
      Object.defineProperty(HTMLCanvasElement.prototype, "transferControlToOffscreen", {
        configurable: true,
        value: vi.fn(() => {
          if (stage === "transfer") throw new Error("offscreen transfer failed");
          return { width: 0, height: 0 };
        }),
      });
      vi.stubGlobal("OffscreenCanvas", class OffscreenCanvasStub {});
      vi.stubGlobal("Worker", WorkerSpy);
      vi.mocked(createOrbGLAsync).mockResolvedValue({
        renderer,
        durationMs: 5,
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
          await Promise.resolve();
        });

        expect(createOrbGLAsync).toHaveBeenCalledTimes(1);
        expect(createOrbGL).not.toHaveBeenCalled();
        expect(createOrbGL2).not.toHaveBeenCalled();
        expect(renderer.render).toHaveBeenCalled();
        expect(container.querySelector("[data-orb-renderer-tier='webgl-main']")).not.toBeNull();
        expect(container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();
        if (stage === "init") expect(worker.terminate).toHaveBeenCalledTimes(1);
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
    },
  );

  it("recovers when a visible worker render send throws synchronously", async () => {
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
      onerror: ((event: ErrorEvent) => void) | null = null;
      renderCount = 0;
      postMessage = vi.fn((message: { type: "init" | "render" | "dispose"; requestId?: number }) => {
        if (message.type === "init") {
          queueMicrotask(() => {
            this.onmessage?.({ data: { type: "ready" } } as MessageEvent<{ type: "ready" }>);
          });
          return;
        }
        if (message.type === "render") {
          this.renderCount += 1;
          if (this.renderCount > 1) throw new Error("worker render send failed");
          queueMicrotask(() => {
            this.onmessage?.({
              data: { type: "rendered", requestId: message.requestId },
            } as MessageEvent<{ type: "rendered"; requestId?: number }>);
          });
        }
      });
      terminate = vi.fn();
    }

    const worker = new WorkerStub();
    const WorkerSpy = vi.fn(function WorkerMock() {
      return worker;
    });
    const mainThreadRenderer = createMockGLRenderer();
    vi.mocked(createOrbGLAsync).mockResolvedValue({
      renderer: mainThreadRenderer,
      durationMs: 1,
      tier: "webgl",
    });

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 449 });
    Object.defineProperty(HTMLCanvasElement.prototype, "transferControlToOffscreen", {
      configurable: true,
      value: vi.fn(() => ({ width: 0, height: 0 })),
    });
    vi.stubGlobal("OffscreenCanvas", class OffscreenCanvasStub {});
    vi.stubGlobal("Worker", WorkerSpy);

    try {
      const { container } = render(
        createElement(ValenceOrb, {
          valence: -0.143,
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
      expect(container.querySelector("[data-orb-renderer-tier='webgl-worker']")).not.toBeNull();

      await act(async () => {
        flushNextFrame();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(worker.terminate).toHaveBeenCalledTimes(1);
      expect(createOrbGLAsync).toHaveBeenCalledTimes(1);
      expect(mainThreadRenderer.render).toHaveBeenCalled();
      expect(container.querySelector("[data-orb-renderer-tier='webgl-main']")).not.toBeNull();
      expect(container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();
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

  it("does not poll indefinitely while the forced WebGL upgrade waits offscreen", async () => {
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
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(vi.getTimerCount()).toBe(0);
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

  it("takes over a silent initial worker with bounded canonical main-thread WebGL", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const { flushNextFrame } = installQueuedRaf();
    const renderer = createMockGLRenderer();
    const hadTransferControl =
      "transferControlToOffscreen" in HTMLCanvasElement.prototype;
    const originalTransferControl = HTMLCanvasElement.prototype.transferControlToOffscreen;
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
    const worker = new SilentWorker();
    vi.stubGlobal("Worker", vi.fn(function WorkerMock() {
      return worker;
    }));
    vi.mocked(createOrbGLAsync).mockResolvedValue({
      renderer,
      durationMs: 5,
      tier: "webgl",
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
      expect(worker.terminate).not.toHaveBeenCalled();
      expect(container.querySelector("[data-orb-visual-ready='true']")).toBeNull();

      await act(async () => {
        vi.advanceTimersByTime(ORB_WORKER_STARTUP_TIMEOUT_MS + 1);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(worker.terminate).toHaveBeenCalledTimes(1);
      expect(createOrbGLAsync).toHaveBeenCalledTimes(1);
      expect(renderer.render).toHaveBeenCalled();
      expect(onVisualReady).toHaveBeenCalledTimes(1);
      expect(container.querySelector("[data-orb-renderer-tier='webgl-main']")).not.toBeNull();
      expect(container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();
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

  it("terminates a pending canonical worker exactly once when unmounted before readiness", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const { flushNextFrame } = installQueuedRaf();
    const originalInnerWidth = window.innerWidth;
    const hadTransferControl =
      "transferControlToOffscreen" in HTMLCanvasElement.prototype;
    const originalTransferControl = HTMLCanvasElement.prototype.transferControlToOffscreen;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 449,
    });
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

    const worker = new SilentWorker();
    const WorkerSpy = vi.fn(function WorkerMock() {
      return worker;
    });
    vi.stubGlobal("OffscreenCanvas", class OffscreenCanvasStub {});
    vi.stubGlobal("Worker", WorkerSpy);
    const view = render(
      createElement(ValenceOrb, {
        valence: 0,
        renderer: "webgl",
        size: 240,
      }),
    );
    let unmounted = false;

    try {
      await flushScheduledWebGLUpgrade(flushNextFrame);
      expect(WorkerSpy).toHaveBeenCalledTimes(1);
      expect(worker.terminate).not.toHaveBeenCalled();

      view.unmount();
      unmounted = true;
      expect(worker.terminate).toHaveBeenCalledTimes(1);

      await act(async () => {
        vi.advanceTimersByTime(10_000);
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(worker.terminate).toHaveBeenCalledTimes(1);
    } finally {
      if (!unmounted) view.unmount();
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

  it.each(["ack-timeout", "failed-message", "error-event", "render-send"] as const)(
    "reports a prepaint worker %s without synchronous main-thread shader compilation",
    async (failureMode) => {
      vi.useFakeTimers();
      stubCanvasContexts(false);
      stubVisibleOrbRect();
      const { flushNextFrame } = installQueuedRaf();
      const renderer = createMockGLRenderer();
      const hadTransferControl =
        "transferControlToOffscreen" in HTMLCanvasElement.prototype;
      const originalTransferControl = HTMLCanvasElement.prototype.transferControlToOffscreen;
      Object.defineProperty(HTMLCanvasElement.prototype, "transferControlToOffscreen", {
        configurable: true,
        value: vi.fn(() => ({ width: 0, height: 0 })),
      });

      class PrepaintFailingWorker {
        onmessage: ((event: MessageEvent<{ type: "ready" | "failed" }>) => void) | null = null;
        onerror: ((event: ErrorEvent) => void) | null = null;
        postMessage = vi.fn((message: { type: "init" | "render" | "dispose" }) => {
          if (message.type === "init") {
            queueMicrotask(() => {
              if (failureMode === "failed-message") {
                this.onmessage?.({ data: { type: "failed" } } as MessageEvent<{ type: "failed" }>);
              } else if (failureMode === "error-event") {
                this.onerror?.(new ErrorEvent("error"));
              } else {
                this.onmessage?.({ data: { type: "ready" } } as MessageEvent<{ type: "ready" }>);
              }
            });
            return;
          }
          if (message.type === "render" && failureMode === "render-send") {
            throw new Error("worker render send failed");
          }
        });
        terminate = vi.fn();
      }

      vi.stubGlobal("OffscreenCanvas", class OffscreenCanvasStub {});
      const worker = new PrepaintFailingWorker();
      vi.stubGlobal("Worker", vi.fn(function WorkerMock() {
        return worker;
      }));
      vi.mocked(createOrbGL).mockReturnValue(renderer);
      vi.mocked(createOrbGLAsync).mockResolvedValue(null);
      vi.mocked(createOrbGL2Async).mockResolvedValue(null);
      vi.mocked(createOrbWebGPUAsync).mockResolvedValue(null);
      const onVisualReady = vi.fn();
      const onVisualError = vi.fn();

      try {
        const { container } = render(
          createElement(ValenceOrb, {
            valence: 0,
            renderer: "webgl",
            onVisualReady,
            onVisualError,
          }),
        );

        await flushScheduledWebGLUpgrade(flushNextFrame);
        await act(async () => {
          vi.advanceTimersByTime(
            (failureMode === "ack-timeout"
              ? ORB_WORKER_FIRST_PRESENTATION_ACK_TIMEOUT_MS
              : 0) + 1,
          );
          await Promise.resolve();
          await Promise.resolve();
          await Promise.resolve();
          await Promise.resolve();
        });

        expect(worker.terminate).toHaveBeenCalledTimes(1);
        expect(createOrbGLAsync).toHaveBeenCalledTimes(1);
        expect(createOrbGL2Async).toHaveBeenCalledTimes(1);
        expect(createOrbGL).not.toHaveBeenCalled();
        expect(createOrbGL2).not.toHaveBeenCalled();
        expect(renderer.render).not.toHaveBeenCalled();
        expect(onVisualReady).not.toHaveBeenCalled();
        expect(onVisualError).toHaveBeenCalledTimes(1);
        expect(container.querySelector("[data-orb-renderer-tier='webgl-main']")).toBeNull();
        expect(container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();

        await act(async () => {
          vi.advanceTimersByTime(5_000);
          await Promise.resolve();
          await Promise.resolve();
        });
        expect(worker.terminate).toHaveBeenCalledTimes(1);
        expect(createOrbGL).not.toHaveBeenCalled();
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
    },
  );

  it("falls back to main-thread WebGL when worker construction and the first WebGPU frame both fail", async () => {
    vi.useFakeTimers();
    stubVisibleOrbRect();
    const { flushNextFrame } = installQueuedRaf();
    const failingWebGpuRenderer = createMockGLRenderer();
    failingWebGpuRenderer.render.mockImplementation(() => {
      throw new Error("WebGPU first frame failed");
    });
    const webGlRenderer = createMockGLRenderer();
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390,
    });
    const hadTransferControl =
      "transferControlToOffscreen" in HTMLCanvasElement.prototype;
    const originalTransferControl = HTMLCanvasElement.prototype.transferControlToOffscreen;
    Object.defineProperty(HTMLCanvasElement.prototype, "transferControlToOffscreen", {
      configurable: true,
      value: vi.fn(() => ({ width: 0, height: 0 })),
    });

    vi.stubGlobal("OffscreenCanvas", class OffscreenCanvasStub {});
    vi.stubGlobal("Worker", vi.fn(function WorkerMock() {
      throw new Error("worker construction failed");
    }));
    vi.mocked(createOrbWebGPUAsync).mockResolvedValue({
      renderer: failingWebGpuRenderer,
      durationMs: 5,
      tier: "webgpu",
    });
    vi.mocked(createOrbGLAsync).mockResolvedValue({
      renderer: webGlRenderer,
      durationMs: 5,
      tier: "webgl",
    });
    const onVisualReady = vi.fn();

    try {
      const { container, rerender } = render(
        createElement(ValenceOrb, {
          valence: 0,
          renderer: "webgl",
          onVisualReady,
        }),
      );

      await flushScheduledWebGLUpgrade(flushNextFrame);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(failingWebGpuRenderer.render).toHaveBeenCalled();
      expect(failingWebGpuRenderer.dispose).toHaveBeenCalledTimes(1);
      expect(createOrbGLAsync).toHaveBeenCalledTimes(1);
      expect(webGlRenderer.render).toHaveBeenCalled();
      expect(onVisualReady).toHaveBeenCalledTimes(1);
      expect(container.querySelector("[data-orb-renderer-tier='webgl-main']")).not.toBeNull();
      expect(container.querySelector("[data-orb-renderer-tier='canvas2d']")).toBeNull();

      const renderCountBeforeValenceChange = webGlRenderer.render.mock.calls.length;
      rerender(
        createElement(ValenceOrb, {
          valence: 1,
          renderer: "webgl",
          onVisualReady,
        }),
      );
      await act(async () => {
        flushNextFrame();
        await Promise.resolve();
      });
      expect(webGlRenderer.render.mock.calls.length).toBeGreaterThan(renderCountBeforeValenceChange);
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
});
