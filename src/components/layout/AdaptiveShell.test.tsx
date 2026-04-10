import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdaptiveShell } from "./AdaptiveShell";

vi.mock("@/hooks/useDeviceTier", () => ({
  useDeviceTier: () => ({
    tier: "laptop" as const,
    isDesktopClass: true,
    supportsMultiPanel: true,
    breakpoints: { tablet: 768, laptop: 1024, desktop: 1440 },
  }),
}));

vi.mock("@/hooks/useMediaQuery", () => ({
  useMediaQuery: () => false,
}));

describe("AdaptiveShell", () => {
  it("renders children", () => {
    render(
      <AdaptiveShell>
        <div data-testid="child">Hello</div>
      </AdaptiveShell>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("applies device tier as data attribute", () => {
    const { container } = render(
      <AdaptiveShell>
        <span>Test</span>
      </AdaptiveShell>
    );
    expect(container.firstElementChild).toHaveAttribute("data-device-tier", "laptop");
  });

  it("applies desktop-class for laptop tier", () => {
    const { container } = render(
      <AdaptiveShell>
        <span>Test</span>
      </AdaptiveShell>
    );
    expect(container.firstElementChild?.className).toContain("desktop-class");
  });
});
