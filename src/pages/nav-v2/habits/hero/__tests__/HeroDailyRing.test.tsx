/**
 * HeroDailyRing — daily-progress ring + remaining copy.
 */
import { render, cleanup, screen } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/hooks/useShouldAnimate", () => ({ useShouldAnimate: () => true }));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      navV2HabitsHero: "Today's habits",
      navV2HabitsAllDone: "Day complete",
      navV2HabitsKeepGoing: "Momentum is yours",
      navV2HabitsOneHabitLeft: "One habit left",
      navV2HabitsHabitsLeft: "{count} habits left",
    },
    language: "en",
  }),
}));

import { HeroDailyRing } from "../HeroDailyRing";

describe("HeroDailyRing", () => {
  afterEach(() => cleanup());

  it("shows {count} habits left when remaining > 1", () => {
    render(<HeroDailyRing completed={1} total={3} ratio={1 / 3} />);
    expect(screen.getByTestId("hero-daily-ring-status")).toHaveTextContent("2 habits left");
  });

  it("shows One habit left when remaining === 1", () => {
    render(<HeroDailyRing completed={2} total={3} ratio={2 / 3} />);
    expect(screen.getByTestId("hero-daily-ring-status")).toHaveTextContent("One habit left");
  });

  it("shows Day complete when ratio === 1", () => {
    render(<HeroDailyRing completed={3} total={3} ratio={1} />);
    expect(screen.getByTestId("hero-daily-ring-status")).toHaveTextContent("Day complete");
  });

  it("shows momentum copy when no habits exist", () => {
    render(<HeroDailyRing completed={0} total={0} ratio={0} />);
    expect(screen.getByTestId("hero-daily-ring-status")).toHaveTextContent("Momentum is yours");
  });

  it("ring carries aria-live and aria-label", () => {
    render(<HeroDailyRing completed={1} total={4} ratio={0.25} />);
    const ring = screen.getByTestId("habits-hero-progress-ring");
    expect(ring).toHaveAttribute("aria-live", "polite");
    expect(ring.getAttribute("aria-label")).toContain("1 / 4");
  });

  it("applies Fraunces SOFT wobble class when day complete (design §4.1 #4)", () => {
    render(<HeroDailyRing completed={3} total={3} ratio={1} />);
    const status = screen.getByTestId("hero-daily-ring-status");
    expect(status.className).toContain("motion-safe:animate-fraunces-soft-wobble");
  });

  it("omits SOFT wobble class while progress incomplete", () => {
    render(<HeroDailyRing completed={2} total={3} ratio={2 / 3} />);
    const status = screen.getByTestId("hero-daily-ring-status");
    expect(status.className).not.toContain("animate-fraunces-soft-wobble");
  });
});
