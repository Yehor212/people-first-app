import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface ThemeTransitionModule {
  runThemeTransition: (commit: () => void) => {
    animated: boolean;
    cancelled: boolean;
    committed: boolean;
    cancel: () => void;
  };
  cancelActiveThemeTransition: () => void;
}

async function loadModule(): Promise<ThemeTransitionModule | null> {
  const modulePath = "../themeTransition";
  return import(/* @vite-ignore */ modulePath).catch(
    () => null,
  ) as Promise<ThemeTransitionModule | null>;
}

function fireOpacityTransitionEnd(target: HTMLElement): void {
  const event = new Event("transitionend", { bubbles: true });
  Object.defineProperty(event, "propertyName", { value: "opacity" });
  target.dispatchEvent(event);
}

describe("theme transition coordinator", () => {
  const originalMatchMedia = window.matchMedia;
  let frames: Array<{ id: number; callback: FrameRequestCallback }>;
  let cancelledFrames: Set<number>;
  let nextFrameId: number;

  const flushFrame = () => {
    const frame = frames.shift();
    if (!frame || cancelledFrames.delete(frame.id)) return;
    frame.callback(performance.now());
  };

  beforeEach(() => {
    vi.useFakeTimers();
    frames = [];
    cancelledFrames = new Set();
    nextFrameId = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      const id = ++nextFrameId;
      frames.push({ id, callback });
      return id;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
      cancelledFrames.add(id);
    });
    window.matchMedia = vi.fn(() => ({
      matches: false,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    document.documentElement.style.setProperty("--background", "165 22% 96%");
    document.documentElement.classList.remove("theme-transition-palette-atomic");
    document.documentElement.dataset.platform = "android";
    document.querySelectorAll("[data-theme-transition-veil]").forEach((node) => node.remove());
  });

  afterEach(async () => {
    const module = await loadModule();
    module?.cancelActiveThemeTransition();
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.matchMedia = originalMatchMedia;
    delete document.documentElement.dataset.platform;
    document.documentElement.classList.remove("theme-transition-palette-atomic");
    document.querySelectorAll("[data-theme-transition-veil]").forEach((node) => node.remove());
    document.querySelectorAll(".theme-transition-blur-released").forEach((node) => {
      node.classList.remove("theme-transition-blur-released");
    });
  });

  it("fades out the old palette, commits at midpoint, then reveals the new palette", async () => {
    const module = await loadModule();
    expect(module).not.toBeNull();
    if (!module) return;

    const commit = vi.fn();
    const backdrop = document.createElement("div");
    backdrop.className = "drawer-v2-backdrop-partitioned";
    const panel = document.createElement("aside");
    panel.className = "drawer-v2-panel-partitioned";
    document.body.append(backdrop, panel);

    const transition = module.runThemeTransition(commit);
    const veil = document.querySelector<HTMLElement>("[data-theme-transition-veil]");
    expect(transition.animated).toBe(true);
    expect(transition.committed).toBe(false);
    expect(commit).not.toHaveBeenCalled();
    expect(veil).toHaveAttribute("data-theme-transition-phase", "enter");
    expect(document.documentElement).toHaveClass("theme-transition-palette-atomic");
    expect(veil?.style.getPropertyValue("--theme-transition-background")).toContain(
      "165 22% 96%",
    );
    expect(backdrop).toHaveClass("theme-transition-blur-released");
    expect(panel).toHaveClass("theme-transition-blur-released");

    flushFrame();
    expect(veil).toHaveClass("theme-transition-veil--enter");
    expect(commit).not.toHaveBeenCalled();

    fireOpacityTransitionEnd(veil!);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(transition.committed).toBe(true);
    expect(veil).toHaveAttribute("data-theme-transition-phase", "midpoint");

    flushFrame();
    expect(veil).toHaveClass("theme-transition-veil--release");
    expect(veil).toHaveAttribute("data-theme-transition-phase", "release");
    fireOpacityTransitionEnd(veil!);

    expect(document.querySelector("[data-theme-transition-veil]")).toBeNull();
    expect(document.documentElement).not.toHaveClass("theme-transition-palette-atomic");
    expect(backdrop).not.toHaveClass("theme-transition-blur-released");
    expect(panel).not.toHaveClass("theme-transition-blur-released");
    backdrop.remove();
    panel.remove();
  });

  it("uses bounded fallbacks when transitionend is not delivered", async () => {
    const module = await loadModule();
    expect(module).not.toBeNull();
    if (!module) return;

    const commit = vi.fn();
    module.runThemeTransition(commit);
    flushFrame();
    vi.advanceTimersByTime(140);

    expect(commit).toHaveBeenCalledTimes(1);
    flushFrame();
    expect(document.querySelector("[data-theme-transition-veil]")).toHaveAttribute(
      "data-theme-transition-phase",
      "release",
    );

    vi.advanceTimersByTime(240);
    expect(document.querySelector("[data-theme-transition-veil]")).toBeNull();
    expect(document.documentElement).not.toHaveClass("theme-transition-palette-atomic");
  });

  it("cancels a stale uncommitted request when a newer transition begins", async () => {
    const module = await loadModule();
    expect(module).not.toBeNull();
    if (!module) return;

    const firstCommit = vi.fn();
    const secondCommit = vi.fn();
    const first = module.runThemeTransition(firstCommit);
    const second = module.runThemeTransition(secondCommit);
    expect(first.cancelled).toBe(true);
    expect(first.committed).toBe(false);
    expect(second.cancelled).toBe(false);
    expect(document.querySelectorAll("[data-theme-transition-veil]")).toHaveLength(1);

    flushFrame();
    const veil = document.querySelector<HTMLElement>("[data-theme-transition-veil]");
    fireOpacityTransitionEnd(veil!);
    expect(firstCommit).not.toHaveBeenCalled();
    expect(secondCommit).toHaveBeenCalledTimes(1);
  });

  it("skips animation and commits synchronously when reduced motion is requested", async () => {
    window.matchMedia = vi.fn(() => ({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const module = await loadModule();
    expect(module).not.toBeNull();
    if (!module) return;

    const commit = vi.fn();
    const transition = module.runThemeTransition(commit);
    expect(transition.animated).toBe(false);
    expect(transition.committed).toBe(true);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-theme-transition-veil]")).toBeNull();
    expect(frames).toHaveLength(0);
    expect(document.documentElement).not.toHaveClass("theme-transition-palette-atomic");
  });
});
