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

import { render, cleanup, act, waitFor } from "@testing-library/react";
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
        _publishDurableHabits: setHabitsSpy,
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

vi.mock("@/features/automation/automationSourcePersistence", () => ({
  persistHabitSourceRecord: vi.fn(async () => ({
    accountBoundaryGeneration: "test-boundary",
    intentId: null,
  })),
}));

// ─── Prop-capturing stubs for the Hero zone + sheets ─────────────
type HeroZoneProps = {
  onOpenDetail: (h: Habit) => void;
  onPickTemplate: (t: { id: string; names: Record<string, string>; icon: string; color: number; habitType: string }) => void;
  onCreateHabit: () => void;
  onToggleHabit: (habitId: string, date: string) => void;
  onAdjustHabit?: (habitId: string, date: string, delta: number) => void;
  onEditHabit?: (h: Habit) => void;
  onSkipHabit?: (habitId: string, date: string) => void;
  onUnskipHabit?: (habitId: string, date: string) => void;
  onArchiveHabit?: (habitId: string) => void;
  onUnarchiveHabit?: (habitId: string) => void;
  onDeleteHabit: (habitId: string) => void;
};
type CreateSheetProps = {
  onAddHabit: (h: Habit) => void;
  editHabit?: Habit | null;
  template?: { id: string } | null;
};
type DetailSheetProps = {
  habit: Habit | null;
  onEdit: (h: Habit) => void;
};

let capturedHeroProps: HeroZoneProps | null = null;
let capturedCreateProps: CreateSheetProps | null = null;
let capturedDetailProps: DetailSheetProps | null = null;

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
  HabitDetailSheet: (props: DetailSheetProps) => {
    capturedDetailProps = props;
    return <div data-testid="habit-detail-sheet-stub" />;
  },
}));

import { HabitsPage } from "../HabitsPage";

// ─── HeroInsightStrip mocks — isolated render path ──────────────
let mockTopInsight: Insight | null = null;
vi.mock("@/lib/insightsEngine", () => ({
  generateInsights: () => (mockTopInsight ? [mockTopInsight] : []),
}));

vi.mock("@/lib/scheduleIdle", () => ({
  scheduleIdle: (callback: () => void) => {
    queueMicrotask(callback);
    return { cancel: () => undefined };
  },
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
  capturedDetailProps = null;
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

  it("onPickTemplate opens the create sheet in template setup mode without emitting analytics yet", () => {
    mockHabits = [makeHabit("a")]; // one existing habit — post-add count is 2
    render(<HabitsPage />);
    act(() => {
      capturedHeroProps!.onPickTemplate(makeTemplate("meditate"));
    });
    expect(analyticsSpy.habitCreated).not.toHaveBeenCalled();
    expect(capturedCreateProps!.template).toEqual(
      expect.objectContaining({ id: "meditate" }),
    );
  });

  it("onPickTemplate is a no-op for already-seeded templateId (no phantom sheet open)", () => {
    mockHabits = [makeHabit("meditate")]; // templateId = "tpl-meditate"
    render(<HabitsPage />);
    capturedHeroProps!.onPickTemplate(makeTemplate("tpl-meditate")); // same id
    expect(capturedCreateProps!.template ?? null).toBeNull();
    expect(analyticsSpy.habitCreated).not.toHaveBeenCalled();
  });

  it("onAddHabit prop (from HabitCreateSheet) calls analytics.habitCreated('custom', total+1)", () => {
    mockHabits = [makeHabit("a"), makeHabit("b")];
    render(<HabitsPage />);
    expect(capturedCreateProps).not.toBeNull();
    const customHabit = makeHabit("c");
    delete customHabit.templateId;
    capturedCreateProps!.onAddHabit(customHabit);
    expect(analyticsSpy.habitCreated).toHaveBeenCalledTimes(1);
    expect(analyticsSpy.habitCreated).toHaveBeenCalledWith("custom", 3);
  });

  it("onAddHabit emits template analytics only after the template habit is saved", () => {
    mockHabits = [makeHabit("a")];
    render(<HabitsPage />);
    expect(capturedCreateProps).not.toBeNull();
    capturedCreateProps!.onAddHabit({
      ...makeHabit("water"),
      templateId: "water",
    });
    expect(analyticsSpy.habitCreated).toHaveBeenCalledTimes(1);
    expect(analyticsSpy.habitCreated).toHaveBeenCalledWith("template", 2);
  });

  it("onToggleHabit transition to completed emits analytics.habitCompleted with total_habits", async () => {
    mockHabits = [makeHabit("a"), makeHabit("b"), makeHabit("c")];
    render(<HabitsPage />);
    // Simulate a completion transition (habit a has no entry for this date).
    capturedHeroProps!.onToggleHabit("a", "2026-04-19");
    await waitFor(() => expect(analyticsSpy.habitCompleted).toHaveBeenCalledTimes(1));
    // habitCompleted(habitName, totalHabits) — total_habits filters archived.
    expect(analyticsSpy.habitCompleted).toHaveBeenCalledWith("Habit a", 3);
  });

  it("onToggleHabit un-complete does not emit habit_completed (avoids over-counting)", async () => {
    const habit = makeHabit("a");
    habit.entries = { "2026-04-19": { value: 1 } };
    mockHabits = [habit];
    render(<HabitsPage />);
    capturedHeroProps!.onToggleHabit("a", "2026-04-19");
    await act(async () => {
      await Promise.resolve();
    });
    expect(analyticsSpy.habitCompleted).not.toHaveBeenCalled();
  });

  it("onAdjustHabit crossing atLeast target emits habit_completed (numerical)", async () => {
    const habit = makeHabit("water");
    habit.habitType = "numerical";
    habit.targetValue = 2; // 2 units (e.g., litres)
    habit.targetType = "atLeast";
    // 1.5 stored as ×1000
    habit.entries = { "2026-04-19": { value: 1500 } };
    mockHabits = [habit];
    render(<HabitsPage />);
    // +1 unit crosses 1.5 → 2.5 (≥ 2)
    capturedHeroProps!.onAdjustHabit!("water", "2026-04-19", 1);
    await waitFor(() => expect(analyticsSpy.habitCompleted).toHaveBeenCalledTimes(1));
    expect(analyticsSpy.habitCompleted).toHaveBeenCalledWith("Habit water", 1);
  });

  it("onAdjustHabit not crossing target does not emit habit_completed", async () => {
    const habit = makeHabit("water");
    habit.habitType = "numerical";
    habit.targetValue = 2;
    habit.targetType = "atLeast";
    habit.entries = { "2026-04-19": { value: 500 } }; // 0.5 stored ×1000
    mockHabits = [habit];
    render(<HabitsPage />);
    // +0.25 → 0.75 (< 2)
    capturedHeroProps!.onAdjustHabit!("water", "2026-04-19", 0.25);
    await act(async () => {
      await Promise.resolve();
    });
    expect(analyticsSpy.habitCompleted).not.toHaveBeenCalled();
  });

  it("onAdjustHabit on already-met target does not re-emit (no double-counting)", async () => {
    const habit = makeHabit("water");
    habit.habitType = "numerical";
    habit.targetValue = 2;
    habit.targetType = "atLeast";
    habit.entries = { "2026-04-19": { value: 2500 } }; // 2.5 already ≥ 2
    mockHabits = [habit];
    render(<HabitsPage />);
    capturedHeroProps!.onAdjustHabit!("water", "2026-04-19", 0.5);
    await act(async () => {
      await Promise.resolve();
    });
    expect(analyticsSpy.habitCompleted).not.toHaveBeenCalled();
  });

  it("onEditHabit routes to HabitCreateSheet with editHabit prefilled (not detail sheet)", () => {
    const habit = makeHabit("read");
    mockHabits = [habit];
    render(<HabitsPage />);
    // Precondition: edit mode not active on first render.
    expect(capturedCreateProps!.editHabit ?? null).toBeNull();
    // Trigger: pencil button path (onEditHabit) — distinct from onOpenDetail.
    // Wrap in act() so React commits the setEditingHabit state update before
    // we re-read the captured props on the next render.
    act(() => {
      capturedHeroProps!.onEditHabit!(habit);
    });
    // The sheet now carries editHabit === the clicked habit → HabitCreationForm
    // will call onUpdateHabit, not onAddHabit.
    expect(capturedCreateProps!.editHabit).toEqual(habit);
  });

  it("detail-sheet edit reopens HabitCreateSheet in edit mode", async () => {
    const habit = makeHabit("detail-edit");
    mockHabits = [habit];
    render(<HabitsPage />);

    act(() => {
      capturedHeroProps!.onOpenDetail(habit);
    });
    await waitFor(() => expect(capturedDetailProps?.habit).toEqual(habit));

    act(() => {
      capturedDetailProps!.onEdit(habit);
    });
    await waitFor(() => expect(capturedCreateProps!.editHabit).toEqual(habit));
  });

  it("onSkipHabit mutates habit entry to SKIP sentinel without emitting habit_completed", () => {
    const habit = makeHabit("a");
    mockHabits = [habit];
    render(<HabitsPage />);
    expect(capturedHeroProps!.onSkipHabit).toBeDefined();
    capturedHeroProps!.onSkipHabit!("a", "2026-04-19");
    expect(setHabitsSpy).toHaveBeenCalled();
    // Skip is a "rest day" action — it is NOT a completion and must not
    // inflate the §15 retention metric.
    expect(analyticsSpy.habitCompleted).not.toHaveBeenCalled();
  });

  it("onArchiveHabit marks habit isArchived=true without emitting habit_completed", () => {
    const habit = makeHabit("a");
    mockHabits = [habit];
    render(<HabitsPage />);
    expect(capturedHeroProps!.onArchiveHabit).toBeDefined();
    capturedHeroProps!.onArchiveHabit!("a");
    expect(setHabitsSpy).toHaveBeenCalled();
    expect(analyticsSpy.habitCompleted).not.toHaveBeenCalled();
  });

  it("exposes onUnskipHabit + onUnarchiveHabit so the ⋯ menu can toggle both directions", () => {
    const habit = makeHabit("a");
    mockHabits = [habit];
    render(<HabitsPage />);
    expect(typeof capturedHeroProps!.onUnskipHabit).toBe("function");
    expect(typeof capturedHeroProps!.onUnarchiveHabit).toBe("function");
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
    await waitFor(() => {
      expect(analyticsSpy.insightStripRendered).toHaveBeenCalledTimes(1);
      expect(analyticsSpy.insightStripRendered).toHaveBeenCalledWith("mood-habit", "positive");
    });
  });

  it("does not emit when there is no top insight (insufficient data)", async () => {
    mockTopInsight = null;
    const { HeroInsightStrip } = await import("../hero/HeroInsightStrip");
    render(<HeroInsightStrip />);
    expect(analyticsSpy.insightStripRendered).not.toHaveBeenCalled();
  });
});
