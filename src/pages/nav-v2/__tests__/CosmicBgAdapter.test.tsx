import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { CosmicBgAdapter } from "../CosmicBgAdapter";

// useShouldAnimate + themeStore control branch selection.
vi.mock("@/hooks/useShouldAnimate", () => ({
  useShouldAnimate: () => true,
}));

// FocusReflectionModal stars — render as simple divs for test determinism.
vi.mock("@/components/FocusReflectionModal", () => ({
  CosmicStar: ({ id }: { id: string }) => (
    <div data-testid={`cosmic-star-${id}`} className="zen-particle" />
  ),
  cosmicStars: [
    { id: "s1", x: 10, y: 10 },
    { id: "s2", x: 50, y: 50 },
  ],
}));

// framer-motion — render plain div so RTL can assert on structure.
vi.mock("framer-motion", () => ({
  motion: {
    div: (props: Record<string, unknown>) => <div {...(props as object)} />,
  },
}));

// useThemeStore — simple selector-calling mock with swappable state.
const themeState = { appliedTheme: "paper" as "paper" | "ink" | "oled" };
vi.mock("@/stores/themeStore", () => ({
  useThemeStore: (sel: (s: { appliedTheme: string }) => unknown) => sel(themeState),
}));

describe("CosmicBgAdapter theme variant switching", () => {
  beforeEach(() => {
    themeState.appliedTheme = "paper";
    delete document.documentElement.dataset.daymode;
  });

  afterEach(() => {
    cleanup();
    delete document.documentElement.dataset.daymode;
  });

  it("renders DayCosmicBackground when appliedTheme === 'paper'", () => {
    themeState.appliedTheme = "paper";
    render(<CosmicBgAdapter />);
    expect(screen.getByTestId("day-cosmic-background")).toBeInTheDocument();
    // Night cosmic nebula should NOT render under paper variant
    expect(screen.queryByTestId("cosmic-orb-nebula")).toBeNull();
  });

  it("renders night cosmic when appliedTheme === 'ink'", () => {
    themeState.appliedTheme = "ink";
    render(<CosmicBgAdapter />);
    expect(screen.queryByTestId("day-cosmic-background")).toBeNull();
    expect(screen.getByTestId("cosmic-orb-background")).toBeInTheDocument();
    expect(screen.getByTestId("cosmic-orb-nebula")).toBeInTheDocument();
  });

  it("renders night cosmic when appliedTheme === 'oled'", () => {
    themeState.appliedTheme = "oled";
    render(<CosmicBgAdapter />);
    expect(screen.queryByTestId("day-cosmic-background")).toBeNull();
    expect(screen.getByTestId("cosmic-orb-background")).toBeInTheDocument();
  });
});
