/**
 * Wiring tests for spec §15 success metrics.
 *
 * Unit tests live in `src/lib/__tests__/analytics.test.ts` and prove the
 * analytics class emits correct payloads in isolation. These integration
 * tests prove that the FOUR choke points in the habits tab actually call
 * the emitter on real React prop flow — a green unit test is meaningless
 * if the wiring rotted away silently.
 *
 * Strategy: mock `@/lib/analytics` with jest spies, mock the leaf views
 * with prop-capturing stubs, then invoke the captured callbacks the same
 * way a user gesture would and assert the spy was called.
 */

import { render, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import type { Insight, Habit } from "@/types";

// ─── Analytics spy ──────────────────────────────────────────────
// vi.mock() is hoisted above this file's top-level, so the factory runs
// before normal consts are initialized. vi.hoisted() creates the spies in
// the hoisted phase, making them safe to close over from the factory.
const analyticsSpy = vi.hoisted(() => ({
  habitCreated: vi.fn(),
  habitCompleted: vi.fn(),
  habitDetailOpened: vi.fn(),
  insightStripRendered: vi.fn(),
}));
vi.mock("@/lib/analytics", () => ({ analytics: analyticsSpy }));

// ─── Language / stores / common mocks ───────────────────────────
vi.mock("@/hooks/useShouldAnimate", () => ({ useShouldAnimate: () => true }));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      navV2Habits: "Habits",
      navV2HabitsHero: "Today's habits",
      navV2HabitsEmpty: "Plant your first seed",
      navV2HabitsAllDone: "Day complete",
      navV2HabitsMorning: "Morning",
      navV2HabitsAfternoon: "Afternoon",
      navV2HabitsEvening: "Evening",
      navV2HabitsAnytime: "Anytime",
    },
    language: "en",
  }),
}));

let mockHabits: Habit[] = [];
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

vi.mock("@/lib/haptics", () => ({ hapticTap: vi.fn() }));

// ─── Prop-capturing stubs for the Hero zone + sheets ─────────────
type HeroZoneProps = {
  onOpenDetail: (h: Habit) => void;
  onPickTemplate: (t: { id: string; names: Record<string, string>; icon: string; color: number; habitType: string }) => void;
  onCreateHabit: () => void;
  onToggleHabit: (habitId: string, date: string) => void;
};
type CreateSheetProps = {
  onAddHabit: (h: Habit) => void;
};

let capturedHeroProps: HeroZoneProps | null = null;
let capturedCreateProps: CreateSheetProps | null = null;

vi.mock("../HabitsHeroZone", () => ({
  HabitsHeroZone: (props: HeroZoneProps) => {
    capturedHeroProps = props;
    return <div data-testid="habits-hero-zone" />;
  },
}));
vi.mock("../HabitCreateSheet", () => ({
  HabitCreateSheet: (props: CreateSheetProps) => {
    capturedCreateProps = props;
    return <div data-testid="habit-create-sheet" />;
  },
}));
vi.mock("../hero/HeroTemplateLibrarySheet", () => ({
  HeroTemplateLibrarySheet: () => <div data-testid="hero-template-library" />,
}));
vi.mock("@/components/habit-hub/HabitDetailSheet", () => ({
  HabitDetailSheet: () => <div data-testid="habit-detail-sheet-stub" />,
}));

import { HabitsPage } from "../HabitsPage";

// ─── HeroInsightStrip mocks — isolated render path ──────────────
let mockTopInsight: Insight | null = null;
vi.mock("@/lib/insightsEngine", () => ({
  generateInsights: () => (mockTopInsight ? [mockTopInsight] : []),
}));

function makeHabit(id: string): Habit {
  return {
    id,
    name: `Habit ${id}`,
    templateId: `tpl-${id}`,
    icon: "•",
    color: 0,
    habitType: "boolean",
    entries: {},
    reminders: [],
    frequency: { numerator: 1, denominator: 1 },
    isArchived: false,
  } as unknown as Habit;
}

function makeTemplate(id: string) {
  return {
    id,
    names: { en: `T ${id}`, uk: "", es: "", de: "", fr: "", ja: "", ar: "", he: "" },
    icon: "🌱",
    color: 0,
    habitType: "boolean" as const,
  };
}

beforeEach(() => {
  mockHabits = [];
  capturedHeroProps = null;
  capturedCreateProps = null;
  mockTopInsight = null;
  setHabitsSpy.mockClear();
  analyticsSpy.habitCreated.mockClear();
  analyticsSpy.habitCompleted.mockClear();
  analyticsSpy.habitDetailOpened.mockClear();
  analyticsSpy.insightStripRendered.mockClear();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => cleanup());

// ─── HabitsPage wiring ──────────────────────────────────────────

describe("HabitsPage → analytics wiring (§15)", () => {
  it("openDetail prop calls analytics.habitDetailOpened with current count", () => {
    mockHabits = [makeHabit("a"), makeHabit("b"), makeHabit("c")];
    render(<HabitsPage />);
    expect(capturedHeroProps).not.toBeNull();
    capturedHeroProps!.onOpenDetail(mockHabits[0]);
    expect(analyticsSpy.habitDetailOpened).toHaveBeenCalledTimes(1);
    expect(analyticsSpy.habitDetailOpened).toHaveBeenCalledWith(3);
  });

  it("onPickTemplate prop calls analytics.habitCreated('template', total+1)", () => {
    mockHabits = [makeHabit("a")]; // one existing habit — post-add count is 2
    render(<HabitsPage />);
    capturedHeroProps!.onPickTemplate(makeTemplate("meditate"));
    expect(analyticsSpy.habitCreated).toHaveBeenCalledTimes(1);
    expect(analyticsSpy.habitCreated).toHaveBeenCalledWith("template", 2);
  });

  it("onPickTemplate is a no-op for already-seeded templateId (no phantom emission)", () => {
    mockHabits = [makeHabit("meditate")]; // templateId = "tpl-meditate"
    render(<HabitsPage />);
    capturedHeroProps!.onPickTemplate(makeTemplate("tpl-meditate")); // same id
    expect(analyticsSpy.habitCreated).not.toHaveBeenCalled();
  });

  it("race guard dedupes two rapid taps of the same template within 500ms", () => {
    mockHabits = [];
    render(<HabitsPage />);
    const tpl = makeTemplate("read");
    capturedHeroProps!.onPickTemplate(tpl);
    capturedHeroProps!.onPickTemplate(tpl); // 2nd tap in same tick
    expect(analyticsSpy.habitCreated).toHaveBeenCalledTimes(1);
  });

  it("onAddHabit prop (from HabitCreateSheet) calls analytics.habitCreated('custom', total+1)", () => {
    mockHabits = [makeHabit("a"), makeHabit("b")];
    render(<HabitsPage />);
    expect(capturedCreateProps).not.toBeNull();
    capturedCreateProps!.onAddHabit(makeHabit("c"));
    expect(analyticsSpy.habitCreated).toHaveBeenCalledTimes(1);
    expect(analyticsSpy.habitCreated).toHaveBeenCalledWith("custom", 3);
  });

  it("onToggleHabit transition to completed emits analytics.habitCompleted with total_habits", () => {
    mockHabits = [makeHabit("a"), makeHabit("b"), makeHabit("c")];
    render(<HabitsPage />);
    // Simulate a completion transition (habit a has no entry for this date).
    capturedHeroProps!.onToggleHabit("a", "2026-04-19");
    expect(analyticsSpy.habitCompleted).toHaveBeenCalledTimes(1);
    // habitCompleted(habitName, totalHabits) — total_habits filters archived.
    expect(analyticsSpy.habitCompleted).toHaveBeenCalledWith("Habit a", 3);
  });

  it("onToggleHabit un-complete does not emit habit_completed (avoids over-counting)", () => {
    const habit = makeHabit("a");
    habit.entries = { "2026-04-19": { value: 1 } };
    mockHabits = [habit];
    render(<HabitsPage />);
    capturedHeroProps!.onToggleHabit("a", "2026-04-19");
    expect(analyticsSpy.habitCompleted).not.toHaveBeenCalled();
  });
});

// ─── HeroInsightStrip wiring ────────────────────────────────────
// Dynamic import so the `vi.mock("@/lib/insightsEngine")` is applied first.

describe("HeroInsightStrip → analytics wiring (§15 cross-habit)", () => {
  it("emits insight_strip_rendered with insight.type + insight.severity on mount", async () => {
    mockTopInsight = {
      id: "i1",
      type: "mood-habit",
      severity: "positive",
      title: "On days you meditate, mood is +28%",
      description: "",
      confidence: 82,
    } as unknown as Insight;
    const { HeroInsightStrip } = await import("../hero/HeroInsightStrip");
    render(<HeroInsightStrip />);
    expect(analyticsSpy.insightStripRendered).toHaveBeenCalledTimes(1);
    expect(analyticsSpy.insightStripRendered).toHaveBeenCalledWith("mood-habit", "positive");
  });

  it("does not emit when there is no top insight (insufficient data)", async () => {
    mockTopInsight = null;
    const { HeroInsightStrip } = await import("../hero/HeroInsightStrip");
    render(<HeroInsightStrip />);
    expect(analyticsSpy.insightStripRendered).not.toHaveBeenCalled();
  });
});
