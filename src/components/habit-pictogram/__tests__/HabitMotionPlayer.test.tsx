import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HabitMotionPlayer } from "../HabitMotionPlayer";

describe("HabitMotionPlayer", () => {
  it("renders CSS fallback when renderer is css", () => {
    render(<HabitMotionPlayer pictogramId="drink-water" renderer="css" motionAllowed />);

    expect(screen.getByTestId("habit-motion-player")).toHaveAttribute("data-renderer", "css");
    expect(screen.getByTestId("habit-motion-player")).toHaveAttribute("data-loop-duration-ms", "2800");
  });

  it("renders still fallback when motion is not allowed", () => {
    render(<HabitMotionPlayer pictogramId="drink-water" renderer="auto" motionAllowed={false} />);

    expect(screen.getByTestId("habit-motion-player")).toHaveAttribute("data-renderer", "still");
    expect(screen.getByTestId("habit-motion-player")).toHaveAttribute("data-reduced-asset", "drink-water/reduced.svg");
  });

  it("exposes the bundled reduced SVG as a visible production asset", () => {
    render(<HabitMotionPlayer pictogramId="drink-water" renderer="css" motionAllowed />);

    const image = screen.getByRole("img", { hidden: true });
    expect(image).toHaveAttribute("src", expect.stringContaining("drink-water"));
    expect(image).toHaveAttribute("data-habit-motion-still", "drink-water");
  });
});
