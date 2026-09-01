import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Habit } from "@/types";

vi.mock("@/hooks/useShouldAnimate", () => ({ useShouldAnimate: () => false }));
const mockDeviceTier = vi.hoisted<{ tier: "phone" | "desktop" }>(() => ({ tier: "phone" }));
vi.mock("@/hooks/useDeviceTier", () => ({
  useDeviceTier: () => ({ tier: mockDeviceTier.tier }),
}));
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
	      navV2HabitsAnytime: "Anytime",
	      navV2HabitsShowMoreCount: "Show {count} more",
	    },
	  }),
	}));

vi.mock("../HeroHabitRow", () => ({
  HeroHabitRow: ({
    habit,
    initiallyCollapsed,
  }: {
    habit: Habit;
    initiallyCollapsed?: boolean;
  }) => (
    <li
      data-testid={`mock-hero-row-${habit.id}`}
      data-initially-collapsed={initiallyCollapsed ? "true" : "false"}
    >
      {habit.name}
    </li>
  ),
}));

import { HeroTimeOfDayGroup } from "../HeroTimeOfDayGroup";

function makeHabit(index: number): Habit {
  return {
    id: `h-${index}`,
    name: `Habit ${index}`,
    icon: "🌿",
    color: index % 8,
    position: index,
    createdAt: index,
    habitType: "boolean",
    frequency: { numerator: 1, denominator: 1 },
    question: "",
    description: "",
    isArchived: false,
    targetValue: 1,
    targetType: "atLeast",
    unit: "",
    entries: {},
    reminders: [],
  };
}

describe("HeroTimeOfDayGroup", () => {
  beforeEach(() => {
    mockDeviceTier.tier = "phone";
  });

  it("keeps long phone groups progressive on first render and reveals the rest on demand", () => {
    const habits = Array.from({ length: 20 }, (_, index) => makeHabit(index + 1));

    render(
      <HeroTimeOfDayGroup
        bucket="anytime"
        habits={habits}
        onToggleHabit={vi.fn()}
      />,
    );

	    expect(screen.getAllByTestId(/^mock-hero-row-/)).toHaveLength(2);
	    const showMore = screen.getByTestId("hero-group-anytime-show-more");
	    expect(showMore).toHaveTextContent("Show 8 more");
	    expect(showMore).toHaveAccessibleName("Show 8 more");

    fireEvent.click(showMore);

    expect(screen.getAllByTestId(/^mock-hero-row-/)).toHaveLength(10);
    expect(screen.getByTestId("hero-group-anytime-show-more")).toHaveTextContent("8");

    fireEvent.click(screen.getByTestId("hero-group-anytime-show-more"));

    expect(screen.getAllByTestId(/^mock-hero-row-/)).toHaveLength(18);
    expect(screen.getByTestId("hero-group-anytime-show-more")).toHaveTextContent("2");

    fireEvent.click(screen.getByTestId("hero-group-anytime-show-more"));

    expect(screen.getAllByTestId(/^mock-hero-row-/)).toHaveLength(20);
    expect(screen.queryByTestId("hero-group-anytime-show-more")).not.toBeInTheDocument();
  });

  it("starts phone habit rows collapsed for a lighter first paint", () => {
    const habits = Array.from({ length: 3 }, (_, index) => makeHabit(index + 1));
    const { rerender } = render(
      <HeroTimeOfDayGroup
        bucket="anytime"
        habits={habits}
        onToggleHabit={vi.fn()}
      />,
    );

    expect(screen.getAllByTestId(/^mock-hero-row-/)[0]).toHaveAttribute(
      "data-initially-collapsed",
      "true",
    );

    mockDeviceTier.tier = "desktop";
    rerender(
      <HeroTimeOfDayGroup
        bucket="anytime"
        habits={habits}
        onToggleHabit={vi.fn()}
      />,
    );

    expect(screen.getAllByTestId(/^mock-hero-row-/)[0]).toHaveAttribute(
      "data-initially-collapsed",
      "false",
    );
  });

  it("resets an expanded progressive row count before paint when returning to phone", () => {
    const habits = Array.from({ length: 20 }, (_, index) => makeHabit(index + 1));
    const { rerender } = render(
      <HeroTimeOfDayGroup
        bucket="anytime"
        habits={habits}
        onToggleHabit={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("hero-group-anytime-show-more"));
    fireEvent.click(screen.getByTestId("hero-group-anytime-show-more"));
    fireEvent.click(screen.getByTestId("hero-group-anytime-show-more"));
    expect(screen.getAllByTestId(/^mock-hero-row-/)).toHaveLength(20);

    mockDeviceTier.tier = "desktop";
    rerender(
      <HeroTimeOfDayGroup
        bucket="anytime"
        habits={habits}
        onToggleHabit={vi.fn()}
      />,
    );
    expect(screen.getAllByTestId(/^mock-hero-row-/)).toHaveLength(20);

    mockDeviceTier.tier = "phone";
    rerender(
      <HeroTimeOfDayGroup
        bucket="anytime"
        habits={habits}
        onToggleHabit={vi.fn()}
      />,
    );

    expect(screen.getAllByTestId(/^mock-hero-row-/)).toHaveLength(2);
	    expect(screen.getByTestId("hero-group-anytime")).toHaveAttribute(
	      "data-visible-habit-count",
	      "2",
	    );
	  });

	  it("keeps the phone row reset on the before-paint path", () => {
	    const source = readFileSync(
	      "src/pages/nav-v2/habits/hero/HeroTimeOfDayGroup.tsx",
	      "utf8",
	    );

	    expect(source).toContain("useLayoutEffect");
	    expect(source).toContain("setVisibleHabitCount(MOBILE_INITIAL_HABIT_ROWS)");
	  });
	});
