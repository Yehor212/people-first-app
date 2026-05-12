import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import { MiniValenceOrb } from "../MiniValenceOrb";

describe("MiniValenceOrb", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the legacy bare md preset as the default compact orb", () => {
    const { container } = render(<MiniValenceOrb valence={0.2} hasEntry />);
    expect(container.firstChild).toHaveClass("h-12", "w-12");
    const canonicalOrb = container.querySelector("[data-orb-transition-profile]");
    expect(canonicalOrb).toHaveAttribute(
      "data-orb-transition-profile",
      "v1-soft",
    );
    expect(canonicalOrb).toHaveAttribute("data-orb-animation-speed", "0.72");
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
