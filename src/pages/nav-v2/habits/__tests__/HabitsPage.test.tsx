/**
 * HabitsPage — orchestrator tests for the Phase 3-C single-zone layout.
 * Garden + MindMap zones removed 2026-04-19; only the Hero zone is rendered.
 */
import { render, cleanup, screen } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

vi.mock("@/hooks/useShouldAnimate", () => ({ useShouldAnimate: () => true }));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      navV2Habits: "Habits",
      navV2HabitsHero: "Today's habits",
      navV2HabitsAddCue: "When • Where • Cue",
      navV2HabitsEmpty: "Plant your first seed",
      navV2HabitsStartSmall: "Start with 3 habits — small steps win",
      navV2HabitsRecovery: "One missed day doesn't reset progress",
      noHabitsToday: "No habits today",
      habitRestDay: "Rest day",
      navV2HabitsCreate: "Create habit",
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
      cancel: "Cancel",
    },
    language: "en",
  }),
}));

let mockHabits: unknown[] = [];
const setHabitsSpy = vi.fn();

vi.mock("@/stores", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@/stores");
  return {
    ...actual,
    useUserDataStore: (selector?: (s: unknown) => unknown) => {
      const state = {
        habits: mockHabits,
        focusSessions: [],
        moods: [],
        canvasGoals: [],
        setHabits: setHabitsSpy,
      };
      return selector ? selector(state) : state;
    },
    useUIStore: (selector?: (s: unknown) => unknown) => {
      const state = { canvasMode: "idle" };
      return selector ? selector(state) : state;
    },
  };
});

vi.mock("@/components/compact-habit-card/CompactHabitCard", () => ({
  CompactHabitCard: ({ habit }: { habit: { id: string; name: string } }) => (
    <li data-testid={`mock-habit-card-${habit.id}`}>{habit.name}</li>
  ),
}));

vi.mock("vaul", () => ({
  Drawer: {
    Root: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
      open ? <div data-testid="vaul-root">{children}</div> : null,
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Overlay: () => <div data-testid="vaul-overlay" />,
    Content: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Title: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
    Description: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  },
}));

vi.mock("@/components/habit-creation-form/HabitCreationForm", () => ({
  HabitCreationForm: () => <div data-testid="mock-habit-creation-form" />,
}));

vi.mock("@/lib/haptics", () => ({ hapticTap: vi.fn() }));

vi.mock("@/components/animations/AllHabitsDoneAnimation", () => ({
  AllHabitsDoneAnimation: () => <div data-testid="all-habits-done-stub" />,
}));

// V1 HabitDetailSheet is lazy-loaded; mock its dynamic import so jsdom
// doesn't try to evaluate the canvas/d3 deep chunk at parse time.
vi.mock("@/components/habit-hub/HabitDetailSheet", () => ({
  HabitDetailSheet: () => <div data-testid="habit-detail-sheet-stub" />,
}));

vi.mock("../hero/HeroInsightStrip", () => ({
  HeroInsightStrip: () => <div data-testid="hero-insight-strip-stub" />,
}));

vi.mock("@/components/habit-completion-celebration/HabitCompletionCelebration", () => ({
  HabitCompletionCelebration: () => <div data-testid="habit-completion-celebration-stub" />,
}));

import { HabitsPage } from "../HabitsPage";

describe("HabitsPage (Phase 3-C single-zone)", () => {
  beforeEach(() => {
    mockHabits = [];
    setHabitsSpy.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders the orchestrator main landmark with the page testid", () => {
    render(<HabitsPage />);
    expect(screen.getByTestId("habits-page")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("aria-labelledby", "habits-page-heading");
  });

  it("renders only the Hero zone (Garden + MindMap removed)", () => {
    render(<HabitsPage />);
    expect(screen.getByTestId("habits-hero-zone")).toBeInTheDocument();
    expect(screen.queryByTestId("habits-garden-zone")).not.toBeInTheDocument();
    expect(screen.queryByTestId("habits-mindmap-zone")).not.toBeInTheDocument();
  });

  it("does not render a table-of-contents nav (single zone, no need)", () => {
    render(<HabitsPage />);
    expect(screen.queryByTestId("habits-page-toc")).not.toBeInTheDocument();
  });

  it("renders the empty state when no habits exist", () => {
    mockHabits = [];
    render(<HabitsPage />);
    expect(screen.getByTestId("habits-page")).toHaveAttribute("data-habit-state", "empty");
    expect(screen.getByTestId("habit-field-backdrop")).toHaveAttribute(
      "data-habit-state",
      "empty",
    );
    expect(screen.getByTestId("habits-hero-empty")).toBeInTheDocument();
  });

  it("renders the time-of-day grouped list when habits are present", () => {
    mockHabits = [
      {
        id: "h1",
        name: "Hydrate",
        isArchived: false,
        entries: {},
        habitType: "boolean",
        reminders: [],
        frequency: { numerator: 1, denominator: 1 },
      },
    ];
    render(<HabitsPage />);
    expect(screen.getByTestId("habits-page")).toHaveAttribute("data-habit-state", "active");
    expect(screen.getByTestId("habit-field-backdrop")).toHaveAttribute(
      "data-habit-state",
      "active",
    );
    expect(screen.getByTestId("hero-group-anytime")).toBeInTheDocument();
    expect(screen.getByTestId("hero-weekly-card-h1")).toBeInTheDocument();
  });

  it("keeps the page active but shows a no-habits-today state when scheduled habits are off today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 20, 12, 0, 0)); // Monday
    mockHabits = [
      {
        id: "wed",
        name: "Wednesday ritual",
        isArchived: false,
        entries: {},
        habitType: "boolean",
        reminders: [],
        frequency: { numerator: 1, denominator: 7 },
        schedule: { mode: "specificDays", period: "week", targetCount: 1, dueDays: [3] },
      },
    ];

    render(<HabitsPage />);

    expect(screen.getByTestId("habits-page")).toHaveAttribute("data-habit-state", "active");
    expect(screen.getByTestId("habit-field-backdrop")).toHaveAttribute(
      "data-habit-state",
      "active",
    );
    expect(screen.getByText("No habits today")).toBeInTheDocument();
    expect(screen.queryByTestId("hero-group-anytime")).not.toBeInTheDocument();
  });

  it("does not render the create sheet when closed", () => {
    render(<HabitsPage />);
    expect(screen.queryByTestId("vaul-root")).not.toBeInTheDocument();
  });

  it("focuses the main landmark after mount (not the heading — avoids outline on title)", () => {
    render(<HabitsPage />);
    const main = screen.getByRole("main");
    expect(main).toBe(document.activeElement);
    expect(main).toHaveAttribute("aria-labelledby", "habits-page-heading");
  });
});
