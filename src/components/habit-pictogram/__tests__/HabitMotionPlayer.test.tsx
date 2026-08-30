import { readFileSync } from "node:fs";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HabitMotionPlayer } from "../HabitMotionPlayer";
import { useThemeStore } from "@/stores/themeStore";

const startHabitCelebrationAnimation = vi.hoisted(() => vi.fn());
const destroyHabitCelebrationAnimation = vi.hoisted(() => vi.fn());

vi.mock("@/lib/platform", () => ({ isAndroid: true, isNative: false }));
vi.mock("../habitTgsRuntime", () => ({
  preloadHabitCelebrationAnimation: vi.fn(async () => undefined),
  startHabitCelebrationAnimation,
}));

const motionPlayerSource = readFileSync(
  "src/components/habit-pictogram/HabitMotionPlayer.tsx",
  "utf8"
);
const motionPlayerCss = readFileSync(
  "src/components/habit-pictogram/HabitMotionPlayer.css",
  "utf8"
);

describe("HabitMotionPlayer", () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: "paper", appliedTheme: "paper" });
  });

  afterEach(() => {
    startHabitCelebrationAnimation.mockReset();
    destroyHabitCelebrationAnimation.mockReset();
  });

  it("starts one Android one-shot for a fresh token and destroys it on unmount", async () => {
    startHabitCelebrationAnimation.mockImplementation(async ({ onReady }) => {
      onReady();
      return {
        destroy: destroyHabitCelebrationAnimation,
        ready: Promise.resolve(),
      };
    });
    const { unmount } = render(
      <HabitMotionPlayer
        pictogramId="drink-water"
        playToken={1}
        celebrationVariant="day"
        motionAllowed
      />
    );

    await waitFor(() => expect(startHabitCelebrationAnimation).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("habit-tgs-player")).toHaveAttribute("data-ready", "true");
    expect(screen.getByTestId("habit-motion-player")).toHaveAttribute(
      "data-celebration-token",
      "1"
    );

    unmount();
    expect(destroyHabitCelebrationAnimation).toHaveBeenCalledTimes(1);
  });

  it("does not create a runtime player when motion is disabled", () => {
    render(
      <HabitMotionPlayer
        pictogramId="drink-water"
        playToken={1}
        celebrationVariant="day"
        motionAllowed={false}
      />
    );

    expect(startHabitCelebrationAnimation).not.toHaveBeenCalled();
    expect(screen.queryByTestId("habit-tgs-player")).not.toBeInTheDocument();
    expect(document.querySelector('[data-habit-tgs-poster="drink-water"]')).toBeInTheDocument();
    expect(document.querySelector('[data-habit-motion-still="drink-water"]')).not.toBeInTheDocument();
  });
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

  it("replaces the mapped Android Drink Water icon with the exact TGS first-frame poster", () => {
    render(<HabitMotionPlayer pictogramId="drink-water" renderer="auto" motionAllowed />);

    const player = screen.getByTestId("habit-motion-player");
    expect(player).toHaveAttribute("data-renderer", "still");
    expect(player).toHaveAttribute("data-loop-duration-ms", "2983");
    expect(player).toHaveAttribute("data-tgs-poster-variant", "day");
    expect(player).not.toHaveAttribute("data-lottie-asset");
    expect(screen.queryByTestId("habit-lottie-player")).not.toBeInTheDocument();
    expect(document.querySelector('[data-habit-tgs-poster="drink-water"]')).toHaveAttribute(
      "src",
      expect.stringContaining("completion-first-frame.svg")
    );
    expect(document.querySelector('[data-habit-motion-still="drink-water"]')).not.toBeInTheDocument();
  });

  it("uses the exact Walk Distance TGS first frame without reviving the rejected APNG path", () => {
    render(<HabitMotionPlayer pictogramId="walk-distance" renderer="auto" motionAllowed />);

    const player = screen.getByTestId("habit-motion-player");
    expect(player).toHaveAttribute("data-renderer", "still");
    expect(player).toHaveAttribute("data-loop-duration-ms", "0");
    expect(player).toHaveAttribute("data-tgs-poster-variant", "day");
    expect(player).not.toHaveAttribute("data-lottie-asset");
    expect(player).not.toHaveAttribute("data-animated-raster-asset");
    expect(player).not.toHaveAttribute("data-animation-format");
    expect(player).not.toHaveAttribute("data-poster-asset");
    expect(document.querySelector('[data-habit-tgs-poster="walk-distance"]')).toBeInTheDocument();
    expect(document.querySelector('[data-habit-motion-still="walk-distance"]')).not.toBeInTheDocument();
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

  it("keeps the static Walk Distance TGS first frame when motion is not allowed", () => {
    render(<HabitMotionPlayer pictogramId="walk-distance" renderer="auto" motionAllowed={false} />);

    const player = screen.getByTestId("habit-motion-player");
    expect(player).toHaveAttribute("data-renderer", "still");
    expect(player).not.toHaveAttribute("data-poster-asset");
    expect(screen.queryByTestId("habit-lottie-player")).not.toBeInTheDocument();
    expect(screen.queryByTestId("habit-animated-raster")).not.toBeInTheDocument();
    expect(screen.queryByTestId("habit-animated-raster-poster")).not.toBeInTheDocument();
    expect(document.querySelector('[data-habit-tgs-poster="walk-distance"]')).toBeInTheDocument();
    expect(document.querySelector('[data-habit-motion-still="walk-distance"]')).not.toBeInTheDocument();
  });

  it("keeps the exact static TGS first frame as the mapped reduced-motion fallback", () => {
    render(<HabitMotionPlayer pictogramId="drink-water" renderer="auto" motionAllowed={false} />);

    const image = screen.getByRole("img", { hidden: true });
    expect(image).toHaveAttribute("src", expect.stringContaining("completion-first-frame.svg"));
    expect(image).toHaveAttribute("data-habit-tgs-poster", "drink-water");
    expect(screen.queryByTestId("habit-lottie-player")).not.toBeInTheDocument();
  });

  it("switches the idle Journal poster between the exact day and night TGS first frames", () => {
    const { rerender } = render(<HabitMotionPlayer pictogramId="journal" motionAllowed />);

    expect(document.querySelector('[data-habit-tgs-poster="journal"]')).toHaveAttribute(
      "data-variant",
      "day"
    );

    useThemeStore.setState({ theme: "ink", appliedTheme: "ink" });
    rerender(<HabitMotionPlayer pictogramId="journal" motionAllowed />);

    expect(document.querySelector('[data-habit-tgs-poster="journal"]')).toHaveAttribute(
      "data-variant",
      "night"
    );
  });

  it("clips both the first-frame poster and animated TGS layer to the inherited round boundary", () => {
    expect(motionPlayerCss).toContain("overflow: hidden");
    expect(motionPlayerCss).toContain("border-radius: inherit");
    expect(motionPlayerCss).toMatch(/\.v2hp-motion-player__tgs[\s\S]*inline-size:\s*100%/);
    expect(motionPlayerCss).toMatch(/\.v2hp-motion-player__tgs[\s\S]*block-size:\s*100%/);
  });

  it("keeps the idle TGS poster on the same isolated visual plane as playback", () => {
    expect(motionPlayerCss).toMatch(
      /\.v2hp-motion-player\s*\{[\s\S]*?isolation:\s*isolate;/
    );
    expect(motionPlayerCss).toMatch(
      /\.v2hp-motion-player__tgs-poster\s*\{[\s\S]*?position:\s*relative;[\s\S]*?z-index:\s*2;[\s\S]*?opacity:\s*1;[\s\S]*?filter:\s*none;[\s\S]*?mix-blend-mode:\s*normal;/
    );
    expect(motionPlayerCss).toMatch(
      /\.v2hp-motion-player\[data-renderer="still"\]\[data-tgs-poster-asset\]\[data-tgs-poster-variant\]\s*\{[\s\S]*?opacity:\s*1;/
    );
  });
});
