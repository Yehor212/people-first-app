import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { DayCosmicBackground } from "../DayCosmicBackground";

// useShouldAnimate controls the motes animation gate — mock per-test.
const mockShouldAnimate = vi.fn();
vi.mock("@/hooks/useShouldAnimate", () => ({
  useShouldAnimate: () => mockShouldAnimate(),
}));

describe("DayCosmicBackground", () => {
  beforeEach(() => {
    mockShouldAnimate.mockReturnValue(true);
    // Reset HTML data-daymode between tests
    delete document.documentElement.dataset.daymode;
  });

  afterEach(() => {
    cleanup();
    delete document.documentElement.dataset.daymode;
    vi.useRealTimers();
  });

  it("renders all 7 layers", () => {
    render(<DayCosmicBackground />);
    expect(screen.getByTestId("day-cosmic-background")).toBeInTheDocument();
    expect(screen.getByTestId("day-cosmic-base")).toBeInTheDocument();
    expect(screen.getByTestId("day-cosmic-bokeh")).toBeInTheDocument();
    expect(screen.getByTestId("day-cosmic-atmosphere")).toBeInTheDocument();
    expect(screen.getByTestId("day-cosmic-horizon-glow")).toBeInTheDocument();
    expect(screen.getByTestId("day-cosmic-light-curtain")).toBeInTheDocument();
    expect(screen.getByTestId("day-cosmic-sun-threads")).toBeInTheDocument();
    expect(screen.getByTestId("day-cosmic-god-rays")).toBeInTheDocument();
    expect(screen.getByTestId("day-cosmic-glass-depth")).toBeInTheDocument();
    expect(screen.getByTestId("day-cosmic-motes")).toBeInTheDocument();
    expect(screen.getByTestId("day-cosmic-paper-grain")).toBeInTheDocument();
    expect(screen.getByTestId("day-cosmic-vignette")).toBeInTheDocument();
  });

  it("renders exactly 35 dust motes", () => {
    const { container } = render(<DayCosmicBackground />);
    const motes = container.querySelectorAll(".day-cosmic__mote");
    expect(motes.length).toBe(35);
  });

  it("renders exactly 18 sun threads for the daylight stage", () => {
    const { container } = render(<DayCosmicBackground />);
    const threads = container.querySelectorAll(".day-cosmic__sun-thread");
    expect(threads.length).toBe(18);
  });

  it("sets data-daymode on <html> based on current hour", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T14:30:00")); // afternoon (14h)
    render(<DayCosmicBackground />);
    expect(document.documentElement.dataset.daymode).toBe("afternoon");
  });

  it.each([
    ["2026-06-15T06:00:00", "dawn"],
    ["2026-06-15T10:00:00", "morning"],
    ["2026-06-15T14:00:00", "afternoon"],
    ["2026-06-15T18:00:00", "golden"],
    ["2026-06-15T20:00:00", "dusk"],
  ])("maps %s to daymode %s", (iso, expected) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
    render(<DayCosmicBackground />);
    expect(document.documentElement.dataset.daymode).toBe(expected);
  });

  it("mote animation gates on useShouldAnimate (true)", () => {
    mockShouldAnimate.mockReturnValue(true);
    render(<DayCosmicBackground />);
    const motes = screen.getByTestId("day-cosmic-motes");
    const threads = screen.getByTestId("day-cosmic-sun-threads");
    expect(motes.getAttribute("data-animated")).toBe("true");
    expect(threads.getAttribute("data-animated")).toBe("true");
  });

  it("mote animation gates on useShouldAnimate (false)", () => {
    mockShouldAnimate.mockReturnValue(false);
    render(<DayCosmicBackground />);
    const motes = screen.getByTestId("day-cosmic-motes");
    const threads = screen.getByTestId("day-cosmic-sun-threads");
    expect(motes.getAttribute("data-animated")).toBe("false");
    expect(threads.getAttribute("data-animated")).toBe("false");
  });

  it("root container is aria-hidden and pointer-events-none", () => {
    render(<DayCosmicBackground />);
    const root = screen.getByTestId("day-cosmic-background");
    expect(root.getAttribute("aria-hidden")).toBe("true");
    expect(root.className).toMatch(/pointer-events-none/);
  });

  it("paper grain is a static SVG with feTurbulence filter", () => {
    render(<DayCosmicBackground />);
    const grain = screen.getByTestId("day-cosmic-paper-grain");
    expect(grain.tagName.toLowerCase()).toBe("svg");
    // Static means no animation applied — filter exists, no <animate>
    expect(grain.querySelector("feTurbulence")).toBeTruthy();
    expect(grain.querySelector("animate")).toBeNull();
  });
});
