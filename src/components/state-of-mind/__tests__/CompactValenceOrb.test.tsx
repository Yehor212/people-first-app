import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { CompactValenceOrb } from "../CompactValenceOrb";

vi.mock("../MiniValenceOrb", () => ({
  MiniValenceOrb: ({
    valence,
    hasEntry,
    size,
    chrome,
    containerClassName,
  }: {
    valence: number;
    hasEntry: boolean;
    size?: string;
    chrome?: string;
    containerClassName?: string;
  }) => (
    <div
      data-testid="mini-valence-orb"
      data-valence={valence}
      data-has-entry={String(hasEntry)}
      data-size={size}
      data-chrome={chrome}
      data-container-class={containerClassName}
    />
  ),
}));

describe("CompactValenceOrb", () => {
  it("maps mood values to the canonical mini-orb valence presets", () => {
    render(<CompactValenceOrb mood="good" size="md" />);

    expect(screen.getByTestId("mini-valence-orb")).toHaveAttribute(
      "data-valence",
      "0.55",
    );
    expect(screen.getByTestId("mini-valence-orb")).toHaveAttribute(
      "data-has-entry",
      "true",
    );
    expect(screen.getByTestId("mini-valence-orb")).toHaveAttribute(
      "data-size",
      "md",
    );
    expect(screen.getByTestId("mini-valence-orb")).toHaveAttribute(
      "data-chrome",
      "badge",
    );
  });

  it("normalizes legacy compact sizes onto the canonical mini-orb family", () => {
    const { rerender } = render(<CompactValenceOrb valence={0} size="xs" />);
    expect(screen.getByTestId("mini-valence-orb")).toHaveAttribute("data-size", "sm");

    rerender(<CompactValenceOrb valence={0} size="sm" />);
    expect(screen.getByTestId("mini-valence-orb")).toHaveAttribute("data-size", "sm");

    rerender(<CompactValenceOrb valence={0} size="md" />);
    expect(screen.getByTestId("mini-valence-orb")).toHaveAttribute("data-size", "md");

    rerender(<CompactValenceOrb valence={0} size="lg" />);
    expect(screen.getByTestId("mini-valence-orb")).toHaveAttribute("data-size", "lg");
  });

  it("passes empty-entry state through the canonical mini-orb wrapper", () => {
    render(<CompactValenceOrb valence={0} hasEntry={false} size="md" />);

    expect(screen.getByTestId("mini-valence-orb")).toHaveAttribute(
      "data-has-entry",
      "false",
    );
  });
});
