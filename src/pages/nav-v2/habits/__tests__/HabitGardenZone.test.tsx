/**
 * HabitGardenZone — wrapper smoke + GardenCanvas mock + skeleton fallback.
 */
import { render, cleanup, screen } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: { navV2HabitsGarden: "Your garden" },
    language: "en",
  }),
}));

let mockLoading = false;
vi.mock("@/hooks/useInnerWorld", () => ({
  useInnerWorld: () => ({
    world: { plants: [], creatures: [], season: "spring" },
    isLoading: mockLoading,
  }),
}));

vi.mock("@/components/GardenCanvas", () => ({
  GardenCanvas: ({ atmosphere }: { atmosphere: string }) => (
    <div data-testid="mock-garden-canvas" data-atmosphere={atmosphere} />
  ),
}));

import { HabitGardenZone } from "../HabitGardenZone";

describe("HabitGardenZone", () => {
  afterEach(() => {
    cleanup();
    mockLoading = false;
  });

  it("renders the section landmark with the heading id", () => {
    render(<HabitGardenZone />);
    const section = screen.getByTestId("habits-garden-zone");
    expect(section.tagName).toBe("SECTION");
    expect(section.getAttribute("aria-labelledby")).toBe("habits-garden-heading");
  });

  it("renders GardenCanvas with the default atmosphere prop", () => {
    render(<HabitGardenZone />);
    const canvas = screen.getByTestId("mock-garden-canvas");
    expect(canvas).toHaveAttribute("data-atmosphere", "default");
  });

  it("forwards a custom atmosphere prop to the canvas", () => {
    render(<HabitGardenZone atmosphere="restful" />);
    expect(screen.getByTestId("mock-garden-canvas")).toHaveAttribute(
      "data-atmosphere",
      "restful",
    );
  });

  it("renders the skeleton when the inner world is loading", () => {
    mockLoading = true;
    render(<HabitGardenZone />);
    expect(screen.getByTestId("habits-garden-skeleton")).toBeInTheDocument();
  });

  it("uses the i18n heading copy", () => {
    render(<HabitGardenZone />);
    expect(screen.getByRole("heading", { level: 2, name: "Your garden" })).toBeInTheDocument();
  });
});
