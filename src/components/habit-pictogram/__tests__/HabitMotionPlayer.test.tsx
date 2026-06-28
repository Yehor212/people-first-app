import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HabitMotionPlayer } from "../HabitMotionPlayer";

const motionPlayerSource = readFileSync(
  "src/components/habit-pictogram/HabitMotionPlayer.tsx",
  "utf8"
);

describe("HabitMotionPlayer", () => {
  it("renders the approved Read art on the runtime-free still path", () => {
    render(<HabitMotionPlayer pictogramId="read" renderer="auto" motionAllowed />);

    const player = screen.getByTestId("habit-motion-player");
    expect(player).toHaveAttribute("data-renderer", "still");
    expect(player).toHaveAttribute("data-loop-duration-ms", "2983");
    expect(player).toHaveAttribute("data-reduced-asset", "read/reduced.svg");
    expect(player).not.toHaveAttribute("data-lottie-asset");
    expect(screen.queryByTestId("habit-lottie-player")).not.toBeInTheDocument();
    expect(document.querySelector('[data-habit-motion-still="read"]')).toBeInTheDocument();
  });

  it("renders the approved Drink Water art on the runtime-free still path", () => {
    render(<HabitMotionPlayer pictogramId="drink-water" renderer="auto" motionAllowed />);

    const player = screen.getByTestId("habit-motion-player");
    expect(player).toHaveAttribute("data-renderer", "still");
    expect(player).toHaveAttribute("data-loop-duration-ms", "2983");
    expect(player).toHaveAttribute("data-reduced-asset", "drink-water/reduced.svg");
    expect(player).not.toHaveAttribute("data-lottie-asset");
    expect(screen.queryByTestId("habit-lottie-player")).not.toBeInTheDocument();
    expect(document.querySelector('[data-habit-motion-still="drink-water"]')).toBeInTheDocument();
  });

  it("keeps Walk Distance on the still fallback after rejecting the APNG direction", () => {
    render(<HabitMotionPlayer pictogramId="walk-distance" renderer="auto" motionAllowed />);

    const player = screen.getByTestId("habit-motion-player");
    expect(player).toHaveAttribute("data-renderer", "still");
    expect(player).toHaveAttribute("data-loop-duration-ms", "0");
    expect(player).toHaveAttribute("data-reduced-asset", "walk-distance/reduced.svg");
    expect(player).not.toHaveAttribute("data-lottie-asset");
    expect(player).not.toHaveAttribute("data-animated-raster-asset");
    expect(player).not.toHaveAttribute("data-animation-format");
    expect(player).not.toHaveAttribute("data-poster-asset");
    expect(document.querySelector('[data-habit-motion-still="walk-distance"]')).toBeInTheDocument();
    expect(screen.queryByTestId("habit-lottie-player")).not.toBeInTheDocument();
    expect(screen.queryByTestId("habit-animated-raster")).not.toBeInTheDocument();
    expect(screen.queryByTestId("habit-raster-sticker")).not.toBeInTheDocument();
  });

  it("does not expose rejected Walk Distance APNG state assets for complete or streak", () => {
    const { rerender } = render(
      <HabitMotionPlayer pictogramId="walk-distance" renderer="auto" state="complete" motionAllowed />
    );

    expect(screen.getByTestId("habit-motion-player")).toHaveAttribute("data-renderer", "still");
    expect(screen.getByTestId("habit-motion-player")).not.toHaveAttribute(
      "data-animated-raster-asset"
    );

    rerender(
      <HabitMotionPlayer pictogramId="walk-distance" renderer="auto" state="streak" motionAllowed />
    );
    expect(screen.getByTestId("habit-motion-player")).toHaveAttribute("data-renderer", "still");
    expect(screen.getByTestId("habit-motion-player")).not.toHaveAttribute(
      "data-animated-raster-asset"
    );
  });

  it("keeps the Lottie runtime out of the production habit icon path", () => {
    expect(motionPlayerSource).not.toContain("const lottieAnimations");
    expect(motionPlayerSource).not.toContain("lottieAnimationLoaders");
    expect(motionPlayerSource).not.toContain("../../assets/habit-icons/v2/*/idle.lottie.json");
    expect(motionPlayerSource).not.toContain("loadHabitLottieAnimation");
    expect(motionPlayerSource).not.toContain('import("lottie-web")');
    expect(motionPlayerSource).not.toContain('"drink-water/idle.lottie.json"');
    expect(motionPlayerSource).not.toContain('"read/idle.lottie.json"');
    expect(motionPlayerSource).not.toContain('"walk-distance/idle.lottie.json"');
    expect(motionPlayerSource).not.toContain("walk-distance/animated/");
    expect(motionPlayerSource).toContain("HABIT_LOTTIE_RUNTIME_ENABLED");
    expect(motionPlayerSource).toContain("rasterStickerUrls");
  });

  it("keeps unapproved habit icons on still fallback even when motion is allowed", () => {
    render(<HabitMotionPlayer pictogramId="exercise" renderer="auto" motionAllowed />);

    const player = screen.getByTestId("habit-motion-player");
    expect(player).toHaveAttribute("data-renderer", "still");
    expect(player).toHaveAttribute("data-loop-duration-ms", "0");
    expect(player).toHaveAttribute("data-reduced-asset", "exercise/reduced.svg");
    expect(player).not.toHaveAttribute("data-lottie-asset");
    expect(screen.queryByTestId("habit-lottie-player")).not.toBeInTheDocument();
  });

  it("renders still fallback when motion is not allowed", () => {
    render(<HabitMotionPlayer pictogramId="read" renderer="auto" motionAllowed={false} />);

    expect(screen.getByTestId("habit-motion-player")).toHaveAttribute("data-renderer", "still");
    expect(screen.getByTestId("habit-motion-player")).toHaveAttribute(
      "data-reduced-asset",
      "read/reduced.svg"
    );
  });

  it("uses the Walk Distance reduced SVG when motion is not allowed", () => {
    render(<HabitMotionPlayer pictogramId="walk-distance" renderer="auto" motionAllowed={false} />);

    const player = screen.getByTestId("habit-motion-player");
    expect(player).toHaveAttribute("data-renderer", "still");
    expect(player).not.toHaveAttribute("data-poster-asset");
    expect(screen.queryByTestId("habit-lottie-player")).not.toBeInTheDocument();
    expect(screen.queryByTestId("habit-animated-raster")).not.toBeInTheDocument();
    expect(screen.queryByTestId("habit-animated-raster-poster")).not.toBeInTheDocument();
    expect(document.querySelector('[data-habit-motion-still="walk-distance"]')).toBeInTheDocument();
  });

  it("keeps the bundled reduced SVG as the reduced-motion fallback only", () => {
    render(<HabitMotionPlayer pictogramId="drink-water" renderer="auto" motionAllowed={false} />);

    const image = screen.getByRole("img", { hidden: true });
    expect(image).toHaveAttribute("src", expect.stringContaining("drink-water"));
    expect(image).toHaveAttribute("data-habit-motion-still", "drink-water");
    expect(screen.queryByTestId("habit-lottie-player")).not.toBeInTheDocument();
  });
});
