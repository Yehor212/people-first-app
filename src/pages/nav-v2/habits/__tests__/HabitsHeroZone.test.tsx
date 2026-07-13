/**
 * HabitsHeroZone — orchestrator-level coverage.
 *
 * Sub-component internals are tested in `hero/__tests__/`.
 * This file verifies the public contract: zone renders, sticky supporting
 * chrome stays lean (no daily ring), empty vs grouped branching works, and
 * CTAs delegate.
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
      navV2HabitsQuickPick: "Smart start",
      navV2HabitsBrowseLibrary: "Library",
      navV2HabitsRecovery: "One missed day",
      noHabitsToday: "No habits today",
      habitRestDay: "Rest day",
      navV2HabitsMorning: "Morning",
      navV2HabitsAfternoon: "Afternoon",
      navV2HabitsEvening: "Evening",
      navV2HabitsAnytime: "Anytime",
      navV2HabitsIdentityToday: "Today you choose to be:",
      navV2HabitsIdentitySentence: "Today you choose to be {identity}",
      navV2HabitsIdentityIntention: "someone who keeps their word",
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

vi.mock("../hero/HeroHabitRow", () => ({
  HeroHabitRow: ({ habit }: { habit: { id: string; name: string } }) => (
    <li data-testid={`hero-row-${habit.id}`}>{habit.name}</li>
  ),
}));

vi.mock("@/lib/haptics", () => ({ hapticTap: vi.fn() }));

// Celebration overlay pulls in a canvas-based confetti helper; JSDOM has no
// canvas. Stub to a no-op for unit coverage.
vi.mock("../hero/HeroInsightStrip", () => ({
  HeroInsightStrip: () => <div data-testid="hero-insight-strip-stub" />,
}));

vi.mock("@/components/habit-completion-celebration/HabitCompletionCelebration", () => ({
  HabitCompletionCelebration: () => <div data-testid="habit-completion-celebration-stub" />,
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
      />
    );
    expect(screen.getByTestId("habits-hero-empty")).toBeInTheDocument();
    expect(screen.getByTestId("hero-ritual-board-scene")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("habits-hero-create-empty"));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("keeps the sticky header but does not render the daily-progress ring", () => {
    render(
      <HabitsHeroZone
        todaysHabits={[baseHabit]}
        dailyProgress={{ completed: 1, total: 3, ratio: 1 / 3 }}
        onToggleHabit={vi.fn()}
        onDeleteHabit={vi.fn()}
        onCreateHabit={vi.fn()}
      />
    );
    expect(screen.queryByTestId("habits-hero-progress-ring")).not.toBeInTheDocument();
    expect(screen.getByTestId("hero-insight-strip-stub")).toBeInTheDocument();
    expect(screen.getByText("Today you choose to be")).toBeInTheDocument();
  });

  it("exposes the desktop adaptive rail and grouped-grid scaffold", () => {
    render(
      <HabitsHeroZone
        todaysHabits={[baseHabit]}
        dailyProgress={{ completed: 1, total: 3, ratio: 1 / 3 }}
        onToggleHabit={vi.fn()}
        onDeleteHabit={vi.fn()}
        onCreateHabit={vi.fn()}
      />
    );

    expect(screen.getByTestId("habits-groups-grid")).toHaveClass("habits-groups-grid");
    expect(screen.getByTestId("habits-desktop-command")).toHaveClass("habits-desktop-command");
    expect(screen.getByTestId("habits-hero-create-desktop")).toHaveClass("w-full");
    expect(screen.getByRole("progressbar", { name: "Today's habits" })).toHaveAttribute(
      "aria-valuenow",
      "1"
    );
    expect(screen.getByRole("progressbar", { name: "Today's habits" })).toHaveAttribute(
      "aria-valuemax",
      "3"
    );
  });

  it("renders one weekly row per habit and groups by time-of-day", () => {
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
      />
    );
    expect(screen.getByTestId("hero-row-morn")).toBeInTheDocument();
    expect(screen.getByTestId("hero-row-eve")).toBeInTheDocument();
    expect(screen.getByTestId("hero-group-morning")).toHaveClass("habit-growth-group");
    expect(screen.getByTestId("hero-group-evening")).toBeInTheDocument();
  });

  it("renders the anytime group with the cue-network glyph treatment", () => {
    render(
      <HabitsHeroZone
        todaysHabits={[baseHabit]}
        dailyProgress={{ completed: 0, total: 1, ratio: 0 }}
        onToggleHabit={vi.fn()}
        onDeleteHabit={vi.fn()}
        onCreateHabit={vi.fn()}
      />
    );
    const glyph = screen.getByTestId("hero-group-anytime-icon");
    expect(glyph).toHaveClass("habit-bucket-glyph");
    expect(glyph).toHaveAttribute("data-bucket", "anytime");
    expect(glyph.querySelector("svg")).toBeTruthy();
  });

  it("uses i18n keys for empty-state copy (no hardcoded strings)", () => {
    render(
      <HabitsHeroZone
        todaysHabits={[]}
        dailyProgress={{ completed: 0, total: 0, ratio: 0 }}
        onToggleHabit={vi.fn()}
        onDeleteHabit={vi.fn()}
        onCreateHabit={vi.fn()}
        onPickTemplate={vi.fn()}
      />
    );
    expect(screen.getByText("Plant your first seed")).toBeInTheDocument();
    expect(screen.getByText("Start with 3 habits")).toBeInTheDocument();
    expect(screen.getByText("Smart start")).toBeInTheDocument();
    expect(screen.getByTestId("hero-empty-quickpick")).toBeInTheDocument();
  });

  it("keeps empty-state quick-pick cards on custom v2 pictograms instead of emoji glyphs", () => {
    render(
      <HabitsHeroZone
        todaysHabits={[]}
        dailyProgress={{ completed: 0, total: 0, ratio: 0 }}
        onToggleHabit={vi.fn()}
        onDeleteHabit={vi.fn()}
        onCreateHabit={vi.fn()}
        onPickTemplate={vi.fn()}
      />
    );

    const water = screen.getByTestId("hero-quickpick-drink-water");
    expect(water.querySelector('[data-slot="quickpick-symbol"]')).toBeNull();
    const pictogram = water.querySelector(
      '[data-slot="quickpick-svg"] [data-habit-pictogram="drink-water"]'
    );
    expect(pictogram).toBeTruthy();
    expect(pictogram).toHaveAttribute("data-icon-source", "static-reduced-svg-fallback");
    expect(pictogram).toHaveAttribute(
      "data-motion-system",
      "approved-lottie-static-fallback-runtime-disabled"
    );
    expect(
      pictogram?.querySelector('[data-habit-motion-still="drink-water"]')
    ).toBeInTheDocument();
    expect(water.textContent).not.toContain("💧");
  });

  it("renders a scheduled rest-day state when active habits exist but none are due", () => {
    render(
      <HabitsHeroZone
        todaysHabits={[]}
        hasActiveHabits
        dailyProgress={{ completed: 0, total: 0, ratio: 0 }}
        onToggleHabit={vi.fn()}
        onDeleteHabit={vi.fn()}
        onCreateHabit={vi.fn()}
        onPickTemplate={vi.fn()}
      />
    );
    expect(screen.getByText("No habits today")).toBeInTheDocument();
    expect(screen.queryByTestId("hero-empty-quickpick")).not.toBeInTheDocument();
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
      />
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
      />
    );
    expect(screen.getByTestId("hero-identity-prompt")).toBeInTheDocument();
    expect(screen.getByTestId("habits-identity-cue")).toHaveClass("habit-identity-cue");
    expect(screen.getByTestId("habits-identity-cue").className).not.toContain("zf-role-mind");
  });

  it("renders recovery copy when habits exist", () => {
    render(
      <HabitsHeroZone
        todaysHabits={[baseHabit]}
        dailyProgress={{ completed: 0, total: 1, ratio: 0 }}
        onToggleHabit={vi.fn()}
        onDeleteHabit={vi.fn()}
        onCreateHabit={vi.fn()}
      />
    );
    expect(screen.getByTestId("habits-hero-recovery")).toBeInTheDocument();
  });
});
