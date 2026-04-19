/**
 * HabitsHeroZone — orchestrator-level coverage.
 *
 * Sub-component internals are tested in `hero/__tests__/`.
 * This file verifies the public contract: zone renders, ring is wired,
 * empty vs grouped branching works, and CTAs delegate.
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
      navV2HabitsRecovery: "One missed day",
      navV2HabitsMorning: "Morning",
      navV2HabitsAfternoon: "Afternoon",
      navV2HabitsEvening: "Evening",
      navV2HabitsAnytime: "Anytime",
      navV2HabitsIdentityToday: "Today you are building:",
      navV2HabitsIdentityIntention: "Someone who keeps their word",
      navV2HabitsTwoMinuteRule: "Start with the 2-minute version",
      navV2HabitsAllDone: "Day complete",
      navV2HabitsKeepGoing: "Momentum is yours",
      navV2HabitsOneHabitLeft: "One habit left",
      navV2HabitsHabitsLeft: "{count} habits left",
      navV2HabitsOnboardingStep1: "Pick your identity",
      navV2HabitsOnboardingStep2: "Set your cue",
      navV2HabitsOnboardingStep3: "Plant your first habit",
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

// Celebration overlay pulls in a canvas-based confetti helper; JSDOM has no
// canvas. Stub to a no-op for unit coverage.
vi.mock("@/components/animations/AllHabitsDoneAnimation", () => ({
  AllHabitsDoneAnimation: () => <div data-testid="all-habits-done-stub" />,
}));

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

  it("renders the empty journey when no habits are due today", () => {
    const onCreate = vi.fn();
    render(
      <HabitsHeroZone
        todaysHabits={[]}
        dailyProgress={{ completed: 0, total: 0, ratio: 0 }}
        onToggleHabit={vi.fn()}
        onDeleteHabit={vi.fn()}
        onCreateHabit={onCreate}
      />,
    );
    expect(screen.getByTestId("habits-hero-empty")).toBeInTheDocument();
    expect(screen.getByTestId("hero-empty-journey-steps")).toBeInTheDocument();
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
      />,
    );
    const ring = screen.getByTestId("habits-hero-progress-ring");
    expect(ring).toHaveAttribute("aria-live", "polite");
    expect(ring.getAttribute("aria-label")).toContain("1 / 3");
  });

  it("renders one CompactHabitCard per habit and groups by time-of-day", () => {
    const morning: Habit = {
      ...baseHabit,
      id: "morn",
      name: "Stretch",
      reminders: [{ enabled: true, time: "07:00", days: [1, 2, 3, 4, 5] }],
    };
    const evening: Habit = {
      ...baseHabit,
      id: "eve",
      name: "Read",
      reminders: [{ enabled: true, time: "21:30", days: [1, 2, 3, 4, 5, 6, 0] }],
    };
    render(
      <HabitsHeroZone
        todaysHabits={[morning, evening]}
        dailyProgress={{ completed: 0, total: 2, ratio: 0 }}
        onToggleHabit={vi.fn()}
        onDeleteHabit={vi.fn()}
        onCreateHabit={vi.fn()}
      />,
    );
    expect(screen.getByTestId("hero-card-morn")).toBeInTheDocument();
    expect(screen.getByTestId("hero-card-eve")).toBeInTheDocument();
    expect(screen.getByTestId("hero-group-morning")).toBeInTheDocument();
    expect(screen.getByTestId("hero-group-evening")).toBeInTheDocument();
  });

  it("uses i18n keys for empty-state copy (no hardcoded strings)", () => {
    render(
      <HabitsHeroZone
        todaysHabits={[]}
        dailyProgress={{ completed: 0, total: 0, ratio: 0 }}
        onToggleHabit={vi.fn()}
        onDeleteHabit={vi.fn()}
        onCreateHabit={vi.fn()}
      />,
    );
    expect(screen.getByText("Plant your first seed")).toBeInTheDocument();
    expect(screen.getByText("Start with 3 habits")).toBeInTheDocument();
    expect(screen.getByText("Start with the 2-minute version")).toBeInTheDocument();
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
      />,
    );
    fireEvent.click(screen.getByTestId("habits-hero-create"));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("renders identity prompt when habits are present", () => {
    render(
      <HabitsHeroZone
        todaysHabits={[baseHabit]}
        dailyProgress={{ completed: 0, total: 1, ratio: 0 }}
        onToggleHabit={vi.fn()}
        onDeleteHabit={vi.fn()}
        onCreateHabit={vi.fn()}
      />,
    );
    expect(screen.getByTestId("hero-identity-prompt")).toBeInTheDocument();
  });

  it("renders recovery copy when habits exist", () => {
    render(
      <HabitsHeroZone
        todaysHabits={[baseHabit]}
        dailyProgress={{ completed: 0, total: 1, ratio: 0 }}
        onToggleHabit={vi.fn()}
        onDeleteHabit={vi.fn()}
        onCreateHabit={vi.fn()}
      />,
    );
    expect(screen.getByTestId("habits-hero-recovery")).toBeInTheDocument();
  });
});
