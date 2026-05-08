import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import { MiniValenceOrb } from "../MiniValenceOrb";

vi.mock("../ValenceOrb", () => ({
  ValenceOrb: ({ valence, size }: { valence: number; size?: number }) => (
    <div data-testid="valence-orb" data-valence={valence} data-size={size} />
  ),
}));

describe("MiniValenceOrb", () => {
  it("keeps the legacy bare md preset as the default compact orb", () => {
    const { container } = render(<MiniValenceOrb valence={0.2} hasEntry />);
    expect(container.firstChild).toHaveClass("h-12", "w-12");
    expect(container.querySelector('[data-testid="valence-orb"]')).toHaveAttribute(
      "data-size",
      "120",
    );
  });

  it("renders the canonical badge chrome for Diary-style mini-orbs", () => {
    const { container } = render(
      <MiniValenceOrb valence={0} hasEntry={false} size="md" chrome="badge" />,
    );

    expect(container.firstChild).toHaveClass("h-16", "w-16", "rounded-full");
    expect(container.firstChild).toHaveClass("bg-card/80");
  });

  it("renders the refine chrome with its larger lg preset", () => {
    const { container } = render(
      <MiniValenceOrb valence={0.5} hasEntry size="lg" chrome="refine" />,
    );

    expect(container.firstChild).toHaveClass("h-20", "w-20", "rounded-full");
    expect(container.firstChild).toHaveClass("bg-background/45");
  });
});
