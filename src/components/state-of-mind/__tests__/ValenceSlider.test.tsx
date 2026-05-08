import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { valenceToColor } from "../colorUtils";
import { ValenceSlider } from "../ValenceSlider";

const NEUTRAL_UK = "\u041d\u0435\u0439\u0442\u0440\u0430\u043b\u044c\u043d\u043e";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      somVeryUnpleasant: "Very unpleasant",
      somUnpleasant: "Unpleasant",
      somSlightlyUnpleasant: "Slightly unpleasant",
      somNeutral: NEUTRAL_UK,
      somSlightlyPleasant: "Slightly pleasant",
      somPleasant: "Pleasant",
      somVeryPleasant: "Very pleasant",
      somSlider: "Mood slider",
    },
  }),
}));

vi.mock("@/lib/haptics", () => ({
  haptics: { light: vi.fn(), medium: vi.fn() },
}));

describe("ValenceSlider", () => {
  it("renders the live mood label as a readable orb-accent chip", () => {
    render(<ValenceSlider value={0} onChange={vi.fn()} />);

    const label = screen.getByTestId("valence-live-label");

    expect(label).toHaveTextContent(NEUTRAL_UK);
    expect(label).toHaveClass("som-valence-chip");
    expect(label.getAttribute("style")).toContain(
      `--valence-color: ${valenceToColor(0)}`,
    );
    expect(label.querySelectorAll(".som-valence-chip__orb")).toHaveLength(2);
  });
});
