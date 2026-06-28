import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { startViewTransition, transition, withTransitionName } from "../viewTransitions";

vi.mock("@/lib/animationUtils", () => ({
  shouldAnimate: vi.fn(() => true),
}));

import { shouldAnimate } from "@/lib/animationUtils";
const shouldAnimateMock = vi.mocked(shouldAnimate);

function installMockStartViewTransition() {
  const mock = vi.fn((callback: () => void | Promise<void>) => {
    // Mirror the real API: `finished` resolves when the callback
    // resolves, rejects when it throws or rejects.
    let finished: Promise<void>;
    try {
      const result = callback();
      finished = result instanceof Promise ? result : Promise.resolve();
    } catch (err) {
      finished = Promise.reject(err instanceof Error ? err : new Error(String(err)));
    }
    return {
      finished,
      ready: finished,
      updateCallbackDone: finished,
      skipTransition: vi.fn(),
    };
  });
  (document as unknown as Record<string, unknown>).startViewTransition = mock;
  return mock;
}

describe("startViewTransition (legacy)", () => {
  beforeEach(() => {
    delete (document as unknown as Record<string, unknown>).startViewTransition;
  });

  it("calls document.startViewTransition when API is available", () => {
    const apiMock = vi.fn((cb: () => void) => {
      cb();
      return {
        finished: Promise.resolve(),
        ready: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
        skipTransition: vi.fn(),
      };
    });
    (document as unknown as Record<string, unknown>).startViewTransition = apiMock;

    const cb = vi.fn();
    startViewTransition(cb);
    expect(apiMock).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledOnce();
  });

  it("calls callback directly when API is not available", () => {
    expect((document as unknown as Record<string, unknown>).startViewTransition).toBeUndefined();
    const cb = vi.fn();
    startViewTransition(cb);
    expect(cb).toHaveBeenCalledOnce();
  });
});

describe("transition (Phase 0-D)", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    delete (document as unknown as Record<string, unknown>).startViewTransition;
    document.documentElement.style.removeProperty("view-transition-name");
    shouldAnimateMock.mockReturnValue(true);
    window.matchMedia = originalMatchMedia;
  });
  afterEach(() => {
    vi.clearAllMocks();
    window.matchMedia = originalMatchMedia;
  });

  it("runs fn directly when the View Transitions API is missing", async () => {
    const fn = vi.fn();
    await transition(fn);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("runs fn directly when shouldAnimate() is false (reduced-motion path)", async () => {
    installMockStartViewTransition();
    shouldAnimateMock.mockReturnValue(false);
    const fn = vi.fn();
    await transition(fn, { name: "should-skip" });
    expect(fn).toHaveBeenCalledOnce();
    // No view-transition-name should be left on the root.
    expect(document.documentElement.style.getPropertyValue("view-transition-name")).toBe("");
  });

  it("runs fn directly when skip=true even if API is available", async () => {
    const apiMock = installMockStartViewTransition();
    const fn = vi.fn();
    await transition(fn, { skip: true });
    expect(fn).toHaveBeenCalledOnce();
    expect(apiMock).not.toHaveBeenCalled();
  });

  it("runs fn directly in standalone PWA display mode", async () => {
    const apiMock = installMockStartViewTransition();
    window.matchMedia = vi.fn((query: string) => ({
      matches: query === "(display-mode: standalone)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const fn = vi.fn();
    await transition(fn, { name: "pwa-route" });

    expect(fn).toHaveBeenCalledOnce();
    expect(apiMock).not.toHaveBeenCalled();
    expect(document.documentElement.style.getPropertyValue("view-transition-name")).toBe("");
  });

  it("wraps fn in startViewTransition when all conditions allow", async () => {
    const apiMock = installMockStartViewTransition();
    const fn = vi.fn();
    await transition(fn);
    expect(apiMock).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledOnce();
  });

  it("applies and cleans up view-transition-name on documentElement", async () => {
    installMockStartViewTransition();
    const fn = vi.fn();
    await transition(fn, { name: "mood-orb" });
    expect(document.documentElement.style.getPropertyValue("view-transition-name")).toBe("");
  });

  it("cleans up view-transition-name even when fn throws", async () => {
    installMockStartViewTransition();
    const fn = vi.fn(() => {
      throw new Error("boom");
    });
    await expect(transition(fn, { name: "mood-orb" })).rejects.toThrow("boom");
    expect(document.documentElement.style.getPropertyValue("view-transition-name")).toBe("");
  });
});

describe("withTransitionName", () => {
  it("returns a CSSProperties object containing viewTransitionName", () => {
    const style = withTransitionName("hero");
    expect(style).toEqual({ viewTransitionName: "hero" });
  });
});
