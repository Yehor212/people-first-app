/**
 * HabitsHeroZone — daily-progress + CTA + empty-state coverage.
 */
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/hooks/useShouldAnimate", () => ({ useShouldAnimate: () => true }));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      navV2HabitsHero: "Today's habits",
      navV2HabitsEmpty: "Plant your first seed",
      navV2HabitsStartSmall: "Start with 3 habits",
      navV2HabitsAddCue: "When • Where • Cue",
      navV2HabitsCreate: "Create habit",
      navV2HabitsScrollToGarden: "View garden",
      navV2HabitsRecovery: "One missed day",
    },
    language: "en",
  }),
}));

vi.mock("@/components/compact-habit-card/CompactHabitCard", () => ({
  CompactHabitCard: ({ habit }: { habit: { id: string; name: string } }) => (
    <li data-testid={`hero-card-${habit.id}`}>{habit.name}</li>
  ),
}));

vi.mock("@/lib/haptics", () => ({ hapticTap: vi.fn() }));

import { HabitsHeroZone } from "../HabitsHeroZone";
import type { Habit } from "@/types";

const baseHabit: Habit = {
  id: "h1",
  name: "Hydrate",
  icon: "💧",
  color: 0,
  position: 0,
  createdAt: 0,
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

describe("HabitsHeroZone", () => {
  afterEach(() => cleanup());

  it("renders the empty state when no habits are due today", () => {
    const onCreate = vi.fn();
    render(
      <HabitsHeroZone
        todaysHabits={[]}
        dailyProgress={{ completed: 0, total: 0, ratio: 0 }}
        onToggleHabit={vi.fn()}
        onDeleteHabit={vi.fn()}
        onCreateHabit={onCreate}
        onScrollToGarden={vi.fn()}
      />,
    );
    expect(screen.getByTestId("habits-hero-empty")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("habits-hero-create-empty"));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("renders the daily-progress ring with aria-live and label", () => {
    render(
      <HabitsHeroZone
        todaysHabits={[baseHabit]}
        dailyProgress={{ completed: 1, total: 3, ratio: 1 / 3 }}
        onToggleHabit={vi.fn()}
        onDeleteHabit={vi.fn()}
        onCreateHabit={vi.fn()}
        onScrollToGarden={vi.fn()}
      />,
    );
    const ring = screen.getByTestId("habits-hero-progress-ring");
    expect(ring).toHaveAttribute("aria-live", "polite");
    expect(ring.getAttribute("aria-label")).toContain("1 / 3");
  });

  it("renders one CompactHabitCard per habit", () => {
    render(
      <HabitsHeroZone
        todaysHabits={[
          baseHabit,
          { ...baseHabit, id: "h2", name: "Read" },
        ]}
        dailyProgress={{ completed: 0, total: 2, ratio: 0 }}
        onToggleHabit={vi.fn()}
        onDeleteHabit={vi.fn()}
        onCreateHabit={vi.fn()}
        onScrollToGarden={vi.fn()}
      />,
    );
    expect(screen.getByTestId("hero-card-h1")).toBeInTheDocument();
    expect(screen.getByTestId("hero-card-h2")).toBeInTheDocument();
  });

  it("invokes onScrollToGarden when the cue link is tapped", () => {
    const onScroll = vi.fn();
    render(
      <HabitsHeroZone
        todaysHabits={[baseHabit]}
        dailyProgress={{ completed: 0, total: 1, ratio: 0 }}
        onToggleHabit={vi.fn()}
        onDeleteHabit={vi.fn()}
        onCreateHabit={vi.fn()}
        onScrollToGarden={onScroll}
      />,
    );
    fireEvent.click(screen.getByTestId("habits-hero-scroll-to-garden"));
    expect(onScroll).toHaveBeenCalledTimes(1);
  });

  it("uses i18n keys for empty-state copy (no hardcoded strings)", () => {
    render(
      <HabitsHeroZone
        todaysHabits={[]}
        dailyProgress={{ completed: 0, total: 0, ratio: 0 }}
        onToggleHabit={vi.fn()}
        onDeleteHabit={vi.fn()}
        onCreateHabit={vi.fn()}
        onScrollToGarden={vi.fn()}
      />,
    );
    expect(screen.getByText("Plant your first seed")).toBeInTheDocument();
    expect(screen.getByText("Start with 3 habits")).toBeInTheDocument();
    expect(screen.getByText("When • Where • Cue")).toBeInTheDocument();
  });

  it("invokes onCreate when the primary CTA is tapped", () => {
    const onCreate = vi.fn();
    render(
      <HabitsHeroZone
        todaysHabits={[baseHabit]}
        dailyProgress={{ completed: 0, total: 1, ratio: 0 }}
        onToggleHabit={vi.fn()}
        onDeleteHabit={vi.fn()}
        onCreateHabit={onCreate}
        onScrollToGarden={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("habits-hero-create"));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });
});
