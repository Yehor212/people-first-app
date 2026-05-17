/**
 * ShootingStar — tests for WOW-3 cinematic flourish scheduler.
 */
import { render, act, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ShootingStar } from "../ShootingStar";

let mockAnimate = true;
vi.mock("@/hooks/useShouldAnimate", () => ({
  useShouldAnimate: () => mockAnimate,
}));

describe("ShootingStar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockAnimate = true;
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    cleanup();
  });

  it("renders nothing initially (star is not yet scheduled)", () => {
    const { queryByTestId } = render(<ShootingStar />);
    expect(queryByTestId("shooting-star")).toBeNull();
  });

  it("fires within the 8-15s window and cleans up after animation", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { queryByTestId } = render(<ShootingStar />);
    act(() => {
      vi.advanceTimersByTime(8_001);
    });
    expect(queryByTestId("shooting-star")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1_700);
    });
    expect(queryByTestId("shooting-star")).toBeNull();
  });

  it("renders a layered quiet meteor with flight CSS variables while active", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { getByTestId, getAllByTestId } = render(<ShootingStar />);

    act(() => {
      vi.advanceTimersByTime(8_001);
    });

    const meteor = getByTestId("shooting-star");
    expect(meteor).toHaveClass("shooting-star");
    expect(getByTestId("shooting-star-tail")).toBeInTheDocument();
    expect(getByTestId("shooting-star-core")).toBeInTheDocument();
    expect(getByTestId("shooting-star-halo")).toBeInTheDocument();
    expect(getAllByTestId("shooting-star-dust")).toHaveLength(3);
    expect(meteor.style.getPropertyValue("--meteor-top")).toBe("12%");
    expect(meteor.style.getPropertyValue("--meteor-angle")).toBe("7deg");
    expect(meteor.style.getPropertyValue("--meteor-duration")).toBe("1220ms");
    expect(meteor.style.getPropertyValue("--meteor-tail")).toBe("96px");
    expect(meteor.style.getPropertyValue("--meteor-arc-a-x")).toBe("26vw");
    expect(meteor.style.getPropertyValue("--meteor-arc-a-y")).toBe("-1vh");
    expect(meteor.style.getPropertyValue("--meteor-arc-b-x")).toBe("58vw");
    expect(meteor.style.getPropertyValue("--meteor-arc-b-y")).toBe("2vh");
    expect(meteor.style.getPropertyValue("--meteor-arc-c-x")).toBe("92vw");
    expect(meteor.style.getPropertyValue("--meteor-arc-c-y")).toBe("5vh");
    expect(meteor.style.getPropertyValue("--meteor-travel-y")).toBe("8vh");
  });

  it("uses a no-hang motion curve that fades before the final travel point", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/pages/nav-v2/ShootingStar.css"),
      "utf8",
    );

    expect(css).toContain(
      "animation: shooting-star-fly var(--meteor-duration) linear both;",
    );
    expect(css).toContain("70% {\n    opacity: 0;");
    expect(css).not.toContain("cubic-bezier(0.16, 1, 0.3, 1)");
  });

  it("keeps the night meteor visible when runtime performance mode is active", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/pages/nav-v2/ShootingStar.css"),
      "utf8",
    );

    expect(css).not.toContain(":root[data-runtime-perf] .shooting-star");
    expect(css).not.toContain(":root[data-runtime-perf] .shooting-star__dust");
  });

  it("cleans up from animation end without waiting for the fallback timeout", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { getByTestId, queryByTestId } = render(<ShootingStar />);

    act(() => {
      vi.advanceTimersByTime(8_001);
    });

    act(() => {
      const event = new Event("animationend", { bubbles: true });
      Object.defineProperty(event, "animationName", {
        value: "shooting-star-fly",
      });
      getByTestId("shooting-star").dispatchEvent(event);
    });

    expect(queryByTestId("shooting-star")).toBeNull();
  });

  it("renders nothing when animations are disabled", () => {
    mockAnimate = false;
    const { queryByTestId } = render(<ShootingStar />);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(queryByTestId("shooting-star")).toBeNull();
  });

  it("cleans up timers on unmount without error", () => {
    const { unmount } = render(<ShootingStar />);
    expect(() => unmount()).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });
});
