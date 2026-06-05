import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";

import { MiniValenceOrb } from "../MiniValenceOrb";
import { resetOrbRuntimeSnapshotsForTests } from "../ValenceOrb";
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

describe("MiniValenceOrb", () => {
  let allow2dContext = false;

  beforeEach(() => {
    allow2dContext = false;
    resetOrbRuntimeSnapshotsForTests();
    vi.mocked(drawOrbScene).mockClear();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((contextId) => {
      if (allow2dContext && contextId === "2d") {
        return {} as CanvasRenderingContext2D;
      }
      return null;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    resetOrbRuntimeSnapshotsForTests();
    window.history.replaceState(null, "", "/");
    vi.mocked(createOrbGL2Async).mockReset();
    vi.mocked(createOrbGL2Async).mockResolvedValue(null);
    vi.mocked(createOrbGLAsync).mockReset();
    vi.mocked(createOrbGLAsync).mockResolvedValue(null);
  });

  function stubVisibleOrbRect() {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 120,
      height: 120,
      top: 0,
      left: 0,
      right: 120,
      bottom: 120,
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
      for (let elapsed = 0; elapsed < 1_500; elapsed += 100) {
        flushNextFrame();
        vi.advanceTimersByTime(100);
        await Promise.resolve();
        await Promise.resolve();
        if (vi.mocked(createOrbGL2Async).mock.calls.length > 0) break;
      }
    });
  }

  it("keeps the legacy bare md preset as the default compact orb", () => {
    const { container } = render(<MiniValenceOrb valence={0.2} hasEntry />);
    expect(container.firstChild).toHaveClass("h-12", "w-12");
    const canonicalOrb = container.querySelector("[data-orb-transition-profile]");
    expect(canonicalOrb).toHaveAttribute(
      "data-orb-transition-profile",
      "v1-soft",
    );
    expect(canonicalOrb).toHaveAttribute("data-orb-animation-speed", "0.72");
    expect(canonicalOrb).toHaveAttribute("data-orb-renderer-policy", "webgl");
  });

  it("renders the canonical badge chrome for Diary-style mini-orbs", () => {
    const { container } = render(
      <MiniValenceOrb valence={0} hasEntry={false} size="md" chrome="badge" />,
    );

    expect(container.firstChild).toHaveClass("h-16", "w-16", "rounded-full");
    expect(container.firstChild).toHaveClass("bg-card/80");
  });

  it("uses the canonical ambient valence without reintroducing local timers", () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");

    const { container } = render(
      <MiniValenceOrb valence={0} hasEntry={false} size="sm" chrome="badge" />,
    );

    expect(container.querySelector("[data-orb-renderer-policy]")).toHaveAttribute(
      "data-orb-renderer-policy",
      "webgl",
    );
    expect(setIntervalSpy).not.toHaveBeenCalledWith(expect.any(Function), 320);
  });

  it("keeps mini chrome hidden when no canonical first-paint frame is available", () => {
    const { container } = render(
      <MiniValenceOrb valence={0} hasEntry={false} size="sm" chrome="badge" />,
    );

    expect(container.firstChild).toHaveClass("opacity-0");
  });

  it("reveals mini chrome from the canonical Canvas2D first paint while WebGL is delayed", async () => {
    vi.useFakeTimers();
    allow2dContext = true;
    vi.stubGlobal("OffscreenCanvas", undefined);
    stubVisibleOrbRect();
    const { flushNextFrame } = installQueuedRaf();

    const { container } = render(
      <MiniValenceOrb valence={0} hasEntry={false} size="sm" chrome="badge" />,
    );

    expect(container.firstChild).toHaveClass("opacity-100");
    expect(container.querySelector("[data-orb-first-paint-ready='true']")).not.toBeNull();
    expect(container.querySelector("[data-orb-visual-ready='true']")).not.toBeNull();
    expect(container.querySelector("[data-orb-renderer-tier='canvas2d']")).not.toBeNull();
    expect(createOrbGLAsync).not.toHaveBeenCalled();

    await act(async () => {
      flushNextFrame();
      flushNextFrame();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.firstChild).toHaveClass("opacity-100");
    expect(createOrbGLAsync).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(899);
      await Promise.resolve();
    });

    expect(createOrbGLAsync).not.toHaveBeenCalled();
  });

  it("reveals mini chrome only after the canonical WebGL frame is ready", async () => {
    vi.useFakeTimers();
    window.history.replaceState(null, "", "/?orbRenderer=webgl");
    vi.stubGlobal("OffscreenCanvas", undefined);
    vi.stubGlobal("IntersectionObserver", undefined);
    vi.stubGlobal("requestIdleCallback", undefined);
    vi.stubGlobal("cancelIdleCallback", undefined);
    stubVisibleOrbRect();
    const { flushNextFrame } = installQueuedRaf();
    const renderer = createMockGLRenderer();
    vi.mocked(createOrbGLAsync).mockResolvedValue({
      renderer,
      durationMs: 1,
      tier: "webgl",
    });

    const { container } = render(
      <MiniValenceOrb valence={0} hasEntry={false} size="sm" chrome="badge" />,
    );

    expect(container.firstChild).toHaveClass("opacity-0");

    await flushScheduledWebGLUpgrade(flushNextFrame);

    expect(createOrbGLAsync).toHaveBeenCalledTimes(1);
    expect(createOrbGL2Async).not.toHaveBeenCalled();
    expect(container.firstChild).toHaveClass("opacity-100");
    expect(container.querySelector("[data-orb-first-paint-ready='true']")).not.toBeNull();
    expect(container.querySelector("[data-orb-visual-ready='true']")).not.toBeNull();
    expect(container.querySelector("[data-orb-renderer-tier='webgl-main']")).not.toBeNull();
    expect(container.querySelector("canvas[data-orb-first-paint-canvas='true']")).toBeNull();
    expect(drawOrbScene).not.toHaveBeenCalled();
  });

  it("renders the refine chrome with its larger lg preset", () => {
    const { container } = render(
      <MiniValenceOrb valence={0.5} hasEntry size="lg" chrome="refine" />,
    );

    expect(container.firstChild).toHaveClass("h-20", "w-20", "rounded-full");
    expect(container.firstChild).toHaveClass("bg-background/45");
  });
});
