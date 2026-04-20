/**
 * HeroEmptyJourney — 3-step onboarding empty state.
 */
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/hooks/useShouldAnimate", () => ({ useShouldAnimate: () => true }));
vi.mock("@/lib/haptics", () => ({ hapticTap: vi.fn() }));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      navV2HabitsEmpty: "Plant your first seed",
      navV2HabitsStartSmall: "Start with 3 habits",
      navV2HabitsAddCue: "When • Where • Cue",
      navV2HabitsTwoMinuteRule: "2-minute rule",
      navV2HabitsCreate: "Create habit",
      navV2HabitsOnboardingStep1: "Pick your identity",
      navV2HabitsOnboardingStep2: "Set your cue",
      navV2HabitsOnboardingStep3: "Plant your first habit",
    },
    language: "en",
  }),
}));

import { HeroEmptyJourney } from "../HeroEmptyJourney";

describe("HeroEmptyJourney", () => {
  afterEach(() => cleanup());

  it("renders all 3 onboarding steps", () => {
    render(<HeroEmptyJourney onCreateHabit={vi.fn()} />);
    const steps = screen.getByTestId("hero-empty-journey-steps");
    expect(steps).toBeInTheDocument();
    expect(steps.querySelectorAll("li")).toHaveLength(3);
    expect(screen.getByText(/Pick your identity/)).toBeInTheDocument();
    expect(screen.getByText(/Set your cue/)).toBeInTheDocument();
    expect(screen.getByText(/Plant your first habit/)).toBeInTheDocument();
  });

  it("invokes onCreateHabit when CTA is tapped", () => {
    const spy = vi.fn();
    render(<HeroEmptyJourney onCreateHabit={spy} />);
    fireEvent.click(screen.getByTestId("habits-hero-create-empty"));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("renders the 2-minute rule + cue copy", () => {
    render(<HeroEmptyJourney onCreateHabit={vi.fn()} />);
    expect(screen.getByText("2-minute rule")).toBeInTheDocument();
    expect(screen.getByText("When • Where • Cue")).toBeInTheDocument();
  }, 15000);
});
