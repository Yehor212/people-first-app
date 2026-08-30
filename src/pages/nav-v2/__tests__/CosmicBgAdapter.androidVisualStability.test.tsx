import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let appliedTheme: "paper" | "ink" = "paper";

vi.mock("@/lib/platform", () => ({ isAndroid: true }));

vi.mock("@/hooks/useShouldAnimate", () => ({
  useShouldAnimate: (options: { respectRuntimePerformance?: boolean } = {}) =>
    options.respectRuntimePerformance === false,
}));

vi.mock("@/stores/themeStore", () => ({
  useThemeStore: (
    selector: (state: { appliedTheme: "paper" | "ink" }) => unknown,
  ) => selector({ appliedTheme }),
}));

vi.mock("@/components/cosmic/CosmicStarField", () => ({
  CosmicStar: () => null,
  cosmicStars: [],
}));

import { CosmicBgAdapter } from "../CosmicBgAdapter";

describe("Android day Orb visual stability", () => {
  afterEach(() => {
    cleanup();
    appliedTheme = "paper";
  });

  it("keeps the consolidated daylight compositor active when only the runtime strain guard is limiting motion", () => {
    render(<CosmicBgAdapter />);

    expect(screen.getByTestId("day-cosmic-background")).toHaveAttribute(
      "data-animated",
      "true",
    );
    expect(screen.getByTestId("android-day-webgl-large-effects")).toBeInTheDocument();
  });

  it("keeps one daylight canvas across paper to ink to paper without exposing it at night", () => {
    const { rerender } = render(<CosmicBgAdapter />);
    const initialCanvas = screen.getByTestId("android-day-webgl-large-effects");

    appliedTheme = "ink";
    rerender(<CosmicBgAdapter variant="auto" />);

    expect(screen.getByTestId("cosmic-orb-background")).toBeInTheDocument();
    expect(screen.getByTestId("day-cosmic-background")).toHaveAttribute(
      "data-android-day-active",
      "false",
    );
    expect(screen.getByTestId("android-day-webgl-large-effects")).toBe(initialCanvas);
    expect(initialCanvas).toHaveAttribute("data-android-day-active", "false");

    appliedTheme = "paper";
    rerender(<CosmicBgAdapter />);

    expect(screen.queryByTestId("cosmic-orb-background")).not.toBeInTheDocument();
    expect(screen.getByTestId("android-day-webgl-large-effects")).toBe(initialCanvas);
    expect(initialCanvas).toHaveAttribute("data-android-day-active", "true");
  });

});
