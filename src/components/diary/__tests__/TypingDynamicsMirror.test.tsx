import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { TypingDynamics } from "@/hooks/useTypingDynamics";

import { TypingDynamicsMirror } from "../TypingDynamicsMirror";

vi.mock("@/components/state-of-mind/MiniValenceOrb", () => ({
  MiniValenceOrb: ({
    valence,
    transitionProfile,
  }: {
    valence: number;
    transitionProfile: string;
  }) => (
    <div
      data-testid="canonical-mini-valence-orb"
      data-transition-profile={transitionProfile}
      data-valence={valence.toFixed(3)}
    />
  ),
}));

const pausedDynamics: TypingDynamics = {
  wpm: 0,
  rhythmRegularity: 0,
  backspaceRate: 0,
  isPaused: true,
  isTyping: false,
};

describe("TypingDynamicsMirror", () => {
  it("renders through the canonical MiniValenceOrb pipeline", () => {
    render(<TypingDynamicsMirror dynamics={pausedDynamics} />);

    expect(screen.getByTestId("typing-dynamics-mirror")).toBeInTheDocument();
    expect(screen.getByTestId("canonical-mini-valence-orb")).toHaveAttribute(
      "data-transition-profile",
      "v1-soft",
    );
  });

  it("maps typing pressure to canonical valence without a separate shader family", () => {
    render(
      <TypingDynamicsMirror
        dynamics={{
          wpm: 20,
          rhythmRegularity: 0.1,
          backspaceRate: 0.45,
          isPaused: false,
          isTyping: true,
        }}
      />,
    );

    expect(Number(screen.getByTestId("canonical-mini-valence-orb").dataset.valence)).toBeLessThan(0);
  });
});
