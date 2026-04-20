import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HeroWeeklyHabitCard } from "../HeroWeeklyHabitCard";
import type { Habit } from "@/types";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      dStreak: "d streak",
      statistics: "Statistics",
    },
    language: "en",
  }),
}));

vi.mock("@/components/habit-hub/MiniWeekRow", () => ({
  MiniWeekRow: () => <div data-testid="mini-week-row-stub" />,
}));

const habit = (overrides: Partial<Habit> = {}): Habit => ({
  id: "water",
  name: "Drink water",
  icon: "💧",
  color: 10,
  position: 0,
  createdAt: 0,
  habitType: "numerical",
  frequency: { numerator: 1, denominator: 1 },
  question: "",
  description: "",
  isArchived: false,
  targetValue: 2,
  targetType: "atLeast",
  unit: "L",
  entries: {},
  reminders: [],
  ...overrides,
});

describe("HeroWeeklyHabitCard", () => {
  it("renders a one-tap statistics button on the card", () => {
    const onOpenDetail = vi.fn();
    render(
      <HeroWeeklyHabitCard
        habit={habit()}
        onToggle={vi.fn()}
        onOpenDetail={onOpenDetail}
      />,
    );

    fireEvent.click(screen.getByTestId("hero-weekly-card-water-stats"));
    expect(onOpenDetail).toHaveBeenCalledWith(
      expect.objectContaining({ id: "water" }),
    );
  });
});
