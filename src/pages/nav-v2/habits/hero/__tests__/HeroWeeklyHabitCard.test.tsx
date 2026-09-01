import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import { HeroWeeklyHabitCard } from "../HeroWeeklyHabitCard";
import { toStoredValue } from "@/lib/habits";
import { scheduleIdle } from "@/lib/scheduleIdle";
import { getToday } from "@/lib/utils";
import type { Habit } from "@/types";

const miniWeekRowSpy = vi.hoisted(() => vi.fn());
const getCurrentStreakSpy = vi.hoisted(() =>
  vi.fn((h: { entries?: Record<string, unknown> }) =>
    Object.keys(h.entries ?? {}).length > 0 ? 1 : 0
  )
);
const scheduleIdleCallbacks = vi.hoisted(() => [] as Array<() => void>);

vi.mock("@/lib/habitScore", () => ({
  getCurrentStreak: getCurrentStreakSpy,
}));

vi.mock("@/lib/platform", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/platform")>()),
  isAndroid: true,
}));

vi.mock("@/components/habit-pictogram/habitTgsRuntime", () => ({
  preloadHabitCelebrationAnimation: vi.fn(async () => undefined),
  startHabitCelebrationAnimation: vi.fn(async ({ onReady }) => {
    onReady();
    return { destroy: vi.fn(), ready: Promise.resolve() };
  }),
}));

vi.mock("@/lib/scheduleIdle", () => ({
  scheduleIdle: vi.fn((callback: () => void) => {
    scheduleIdleCallbacks.push(callback);
    return {
      cancel: vi.fn(() => {
        const index = scheduleIdleCallbacks.indexOf(callback);
        if (index >= 0) scheduleIdleCallbacks.splice(index, 1);
      }),
    };
  }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      dStreak: "d streak",
      statistics: "Statistics",
      thisWeek: "This week",
      habitDurationDaysLabel: "day",
      habitPlanLabel: "plan",
      daysLeft: "days left",
      completed: "Completed",
      identityVoteFor: "Step toward {identity}",
      identityVoteCast: "step logged",
      identityVotePending: "ready to mark",
      expand: "Expand",
      collapse: "Collapse",
    },
    language: "en",
  }),
}));

vi.mock("@/components/habit-hub/MiniWeekRow", () => ({
  MiniWeekRow: (props: {
    roleAccent?: {
      color: string;
      softBg: string;
      strongBg: string;
      border: string;
      mutedBg: string;
    };
    interactionScope?: string;
    onNumericalAction?: unknown;
  }) => {
    miniWeekRowSpy(props);
    return (
      <div
        data-testid="mini-week-row-stub"
        data-role-accent={props.roleAccent?.color ?? ""}
        data-role-accent-bg={props.roleAccent?.strongBg ?? ""}
      />
    );
  },
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
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 20, 12, 0, 0));
    miniWeekRowSpy.mockClear();
    getCurrentStreakSpy.mockClear();
    vi.mocked(scheduleIdle).mockClear();
    scheduleIdleCallbacks.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a one-tap statistics button on the card", () => {
    const onOpenDetail = vi.fn();
    render(<HeroWeeklyHabitCard habit={habit()} onToggle={vi.fn()} onOpenDetail={onOpenDetail} />);

    fireEvent.click(screen.getByTestId("hero-weekly-card-water-stats"));
    expect(onOpenDetail).toHaveBeenCalledWith(expect.objectContaining({ id: "water" }));
    expect(screen.getByTestId("hero-weekly-card-water")).toHaveAttribute(
      "data-card",
      "ritual-weekly-card"
    );
    expect(screen.getByTestId("hero-weekly-card-water-stats")).toHaveAttribute(
      "data-slot",
      "weekly-stats"
    );
  });

  it("renders an explicit 44px semantic action trigger and exposes its focus target", () => {
    const onOpenActions = vi.fn();
    const actionsTriggerRef = createRef<HTMLButtonElement>();

    render(
      <HeroWeeklyHabitCard
        habit={habit()}
        onToggle={vi.fn()}
        onOpenActions={onOpenActions}
        actionsLabel="Actions for Drink water"
        actionsTriggerRef={actionsTriggerRef}
      />
    );

    const trigger = screen.getByRole("button", { name: "Actions for Drink water" });
    expect(trigger).toHaveClass("min-h-[44px]", "min-w-[44px]");
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(actionsTriggerRef.current).toBe(trigger);

    fireEvent.click(trigger);
    expect(onOpenActions).toHaveBeenCalledTimes(1);
  });

  it("starts expanded and can collapse into a centered pictogram/name shell", () => {
    render(
      <HeroWeeklyHabitCard
        habit={habit({
          id: "walk",
          name: "Morning walk",
          habitType: "boolean",
          targetValue: 0,
          unit: "",
          identityVerb: "someone who moves daily",
        })}
        onToggle={vi.fn()}
        onOpenDetail={vi.fn()}
      />
    );

    expect(screen.getByTestId("hero-weekly-card-walk")).toHaveAttribute("data-collapsed", "false");
    expect(screen.getByTestId("mini-week-row-stub")).toBeInTheDocument();
    expect(screen.getByTestId("hero-weekly-card-walk-stats")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("hero-weekly-card-walk-collapse"));

    expect(screen.getByTestId("hero-weekly-card-walk")).toHaveAttribute("data-collapsed", "true");
    expect(screen.getByText("Morning walk")).toBeInTheDocument();
    expect(screen.getByTestId("hero-weekly-card-walk-collapsed-cue")).toHaveTextContent("Expand");
    expect(screen.queryByTestId("hero-weekly-card-walk-identity")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mini-week-row-stub")).not.toBeInTheDocument();
    expect(screen.queryByTestId("hero-weekly-card-walk-stats")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("hero-weekly-card-walk-collapse"));

    expect(screen.getByTestId("hero-weekly-card-walk-identity")).toHaveTextContent(
      "Step toward someone who moves daily"
    );
  });

  it("can start collapsed for mobile progressive first paint", () => {
    render(
      <HeroWeeklyHabitCard
        habit={habit({
          id: "stretch",
          name: "Stretch",
          habitType: "boolean",
          targetValue: 0,
          unit: "",
          identityVerb: "someone who moves gently",
        })}
        onToggle={vi.fn()}
        onOpenDetail={vi.fn()}
        initiallyCollapsed
      />
    );

    expect(screen.getByTestId("hero-weekly-card-stretch")).toHaveAttribute(
      "data-collapsed",
      "true"
    );
    expect(screen.queryByTestId("mini-week-row-stub")).not.toBeInTheDocument();
    expect(screen.queryByTestId("hero-weekly-card-stretch-stats")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("hero-weekly-card-stretch-collapse"));

    expect(screen.getByTestId("hero-weekly-card-stretch")).toHaveAttribute(
      "data-collapsed",
      "false"
    );
    expect(screen.getByTestId("mini-week-row-stub")).toBeInTheDocument();
    expect(screen.getByTestId("hero-weekly-card-stretch-stats")).toBeInTheDocument();
  });

  it("uses the pictogram button as today's boolean check-in", () => {
    const onToggle = vi.fn();
    render(
      <HeroWeeklyHabitCard
        habit={habit({
          id: "walk",
          name: "Morning walk",
          habitType: "boolean",
          targetValue: 0,
          unit: "",
        })}
        onToggle={onToggle}
      />
    );

    fireEvent.click(screen.getByTestId("hero-weekly-card-walk-icon-check"));

    expect(onToggle).toHaveBeenCalledWith("walk", getToday());
  });

  it("previews the mapped celebration on a deliberate icon hold without completing the habit", async () => {
    const onToggle = vi.fn();
    render(
      <HeroWeeklyHabitCard
        habit={habit({
          id: "walk-hold",
          name: "Morning walk",
          icon: "🚶",
          habitType: "boolean",
          targetValue: 0,
          unit: "",
        })}
        onToggle={onToggle}
      />
    );

    const iconButton = screen.getByTestId("hero-weekly-card-walk-hold-icon-check");
    expect(iconButton.className).toContain("overflow-hidden");
    expect(iconButton.className).toContain("rounded-full");
    const pictogram = iconButton.querySelector("[data-habit-pictogram]");
    expect(pictogram).toHaveClass("h-full", "w-full");
    fireEvent.pointerDown(iconButton, { pointerId: 1, clientX: 20, clientY: 20 });
    await act(async () => vi.advanceTimersByTime(449));
    expect(within(iconButton).getByTestId("habit-motion-player")).not.toHaveAttribute(
      "data-celebration-token"
    );

    await act(async () => vi.advanceTimersByTime(1));
    expect(within(iconButton).getByTestId("habit-motion-player")).toHaveAttribute(
      "data-celebration-token",
      "1"
    );

    fireEvent.pointerUp(iconButton, { pointerId: 1, clientX: 20, clientY: 20 });
    fireEvent.click(iconButton);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("plays once only when today's state crosses from incomplete to complete", () => {
    const today = getToday();
    const baseHabit = habit({
      id: "water-completion",
      icon: "💧",
      habitType: "boolean",
      targetValue: 0,
      unit: "",
    });
    const { rerender } = render(
      <HeroWeeklyHabitCard habit={baseHabit} onToggle={vi.fn()} />
    );
    const player = () =>
      within(screen.getByTestId("hero-weekly-card-water-completion-icon-check")).getByTestId(
        "habit-motion-player"
      );

    expect(player()).not.toHaveAttribute("data-celebration-token");
    rerender(
      <HeroWeeklyHabitCard
        habit={{ ...baseHabit, entries: { [today]: { value: 1 } } }}
        onToggle={vi.fn()}
      />
    );
    expect(player()).toHaveAttribute("data-celebration-token", "1");

    rerender(
      <HeroWeeklyHabitCard
        habit={{ ...baseHabit, entries: { [today]: { value: 1 } } }}
        onToggle={vi.fn()}
      />
    );
    expect(player()).toHaveAttribute("data-celebration-token", "1");
  });

  it.each(["Leaf", "Water", "Focus", "Book"])(
    "renders stored habit icon %s as a safe pictogram instead of raw text",
    (icon) => {
      render(
        <HeroWeeklyHabitCard
          habit={habit({
            id: `icon-${icon.toLowerCase()}`,
            name: `${icon} habit`,
            icon,
            habitType: "boolean",
            targetValue: 0,
            unit: "",
          })}
          onToggle={vi.fn()}
        />
      );

      const iconButton = screen.getByTestId(
        `hero-weekly-card-icon-${icon.toLowerCase()}-icon-check`
      );
      expect(iconButton).not.toHaveTextContent(icon);
      expect(
        iconButton.querySelector("svg") ??
          iconButton.querySelector("[data-habit-tgs-poster]") ??
          iconButton.querySelector("[data-habit-motion-still]") ??
          iconButton.querySelector("[data-habit-lottie-player]")
      ).toBeInTheDocument();
      expect(screen.getByTestId(`hero-weekly-card-icon-${icon.toLowerCase()}`)).toHaveAttribute(
        "aria-label",
        `${icon} habit`
      );
    }
  );

  it.each([
    ["💧", "drink-water"],
    ["🚶", "walk-distance"],
    ["📚", "read"],
    ["🧘", "meditate"],
  ])("renders stored emoji %s as a custom v2 pictogram", (storedIcon, pictogramId) => {
    render(
      <HeroWeeklyHabitCard
        habit={habit({
          id: `pictogram-${pictogramId}`,
          name: `${pictogramId} habit`,
          icon: storedIcon,
          habitType: "boolean",
          targetValue: 0,
          unit: "",
        })}
        onToggle={vi.fn()}
      />
    );

    const iconButton = screen.getByTestId(`hero-weekly-card-pictogram-${pictogramId}-icon-check`);
    expect(iconButton).not.toHaveTextContent(storedIcon);
    const pictogram = iconButton.querySelector(`[data-habit-pictogram="${pictogramId}"]`);
    expect(pictogram).toBeInTheDocument();
    const isApprovedTgsPoster = ["drink-water", "walk-distance", "meditate"].includes(
      pictogramId
    );
    expect(pictogram).toHaveAttribute(
      "data-icon-source",
      isApprovedTgsPoster
        ? "approved-tgs-first-frame"
        : "static-reduced-svg-fallback"
    );
    expect(
      pictogram?.querySelector(
        isApprovedTgsPoster
          ? "[data-habit-tgs-poster]"
          : "[data-habit-motion-still]"
      )
    ).toBeInTheDocument();
  });

  it("uses the pictogram button as today's smart numerical check-in", () => {
    const onNumericalAction = vi.fn();
    render(
      <HeroWeeklyHabitCard
        habit={habit()}
        onToggle={vi.fn()}
        onNumericalAction={onNumericalAction}
      />
    );

    fireEvent.click(screen.getByTestId("hero-weekly-card-water-icon-check"));

    expect(onNumericalAction).toHaveBeenCalledWith("water", getToday(), {
      type: "set",
      value: 2,
    });
  });

  it("shows a lightweight numerical week summary without opening full stats", () => {
    const today = getToday();
    render(
      <HeroWeeklyHabitCard
        habit={habit({
          entries: {
            [today]: { value: toStoredValue(1.5) },
          },
        })}
        onToggle={vi.fn()}
      />
    );

    expect(screen.getByTestId("hero-weekly-card-water-summary")).toHaveTextContent("1.5/2 L");
    expect(screen.getByTestId("hero-weekly-card-water-meta")).toHaveTextContent("1.5 L");
  });

  it("exposes semantic visual roles for habit categories", () => {
    render(
      <>
        <HeroWeeklyHabitCard habit={habit({ id: "body", category: "health" })} onToggle={vi.fn()} />
        <HeroWeeklyHabitCard
          habit={habit({ id: "focus", category: "productivity" })}
          onToggle={vi.fn()}
        />
      </>
    );

    expect(screen.getByTestId("hero-weekly-card-body")).toHaveAttribute("data-visual-role", "body");
    expect(screen.getByTestId("hero-weekly-card-body").getAttribute("style")).toContain(
      "--habit-role: var(--zf-role-body)"
    );
    expect(screen.getByTestId("hero-weekly-card-body").getAttribute("style")).toContain(
      "--habit-card-background:"
    );
    expect(screen.getByTestId("hero-weekly-card-body").getAttribute("style")).toContain(
      "--habit-card-shadow:"
    );
    expect(screen.getByTestId("hero-weekly-card-focus")).toHaveAttribute(
      "data-visual-role",
      "focus"
    );
  });

  it("passes token-based role accent into the hero week cells", () => {
    render(
      <HeroWeeklyHabitCard
        habit={habit({ id: "focus", category: "productivity" })}
        onToggle={vi.fn()}
      />
    );

    expect(screen.getByTestId("mini-week-row-stub")).toHaveAttribute(
      "data-role-accent",
      "hsl(var(--zf-role-focus))"
    );
    expect(screen.getByTestId("mini-week-row-stub")).toHaveAttribute(
      "data-role-accent-bg",
      "hsl(var(--zf-role-focus) / 0.3)"
    );
    expect(miniWeekRowSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        roleAccent: expect.objectContaining({
          color: "hsl(var(--zf-role-focus))",
          strongBg: "hsl(var(--zf-role-focus) / 0.3)",
        }),
      })
    );
  });

  it("limits the hero week row to today's action", () => {
    const onNumericalAction = vi.fn();

    render(
      <HeroWeeklyHabitCard
        habit={habit({ id: "focus", category: "productivity" })}
        onToggle={vi.fn()}
        onNumericalAction={onNumericalAction}
      />
    );

    expect(miniWeekRowSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        interactionScope: "today",
        onNumericalAction,
      })
    );
  });

  it("defers current streak calculation until idle so hero cards do not block first paint", () => {
    const today = getToday();

    render(
      <HeroWeeklyHabitCard
        habit={habit({
          id: "walk",
          name: "Morning walk",
          habitType: "boolean",
          targetValue: 0,
          unit: "",
          entries: {
            [today]: { value: 1 },
          },
        })}
        onToggle={vi.fn()}
      />
    );

    expect(getCurrentStreakSpy).not.toHaveBeenCalled();
    expect(scheduleIdle).toHaveBeenCalledWith(expect.any(Function), 240, 80);
    expect(screen.getByTestId("hero-weekly-card-walk-streak")).not.toHaveTextContent("1d streak");

    act(() => {
      scheduleIdleCallbacks.shift()?.();
    });

    expect(getCurrentStreakSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("hero-weekly-card-walk-streak")).toHaveTextContent("1d streak");
  });

  it("serializes idle streak calculations across mounted hero cards", () => {
    const today = getToday();
    const card = (id: string) => (
      <HeroWeeklyHabitCard
        key={id}
        habit={habit({
          id,
          name: id,
          habitType: "boolean",
          targetValue: 0,
          unit: "",
          entries: {
            [today]: { value: 1 },
          },
        })}
        onToggle={vi.fn()}
      />
    );

    render(
      <>
        {card("walk")}
        {card("read")}
        {card("water")}
      </>
    );

    expect(scheduleIdleCallbacks).toHaveLength(1);
    expect(getCurrentStreakSpy).not.toHaveBeenCalled();

    act(() => {
      scheduleIdleCallbacks.shift()?.();
    });

    expect(getCurrentStreakSpy).toHaveBeenCalledTimes(1);
    expect(scheduleIdleCallbacks).toHaveLength(1);

    act(() => {
      scheduleIdleCallbacks.shift()?.();
    });

    expect(getCurrentStreakSpy).toHaveBeenCalledTimes(2);
    expect(scheduleIdleCallbacks).toHaveLength(1);
  });

  it("keeps quarter-step values readable for measurable habits", () => {
    const today = getToday();
    render(
      <HeroWeeklyHabitCard
        habit={habit({
          entries: {
            [today]: { value: toStoredValue(0.25) },
          },
        })}
        onToggle={vi.fn()}
      />
    );

    expect(screen.getByTestId("hero-weekly-card-water-summary")).toHaveTextContent("0.25/2 L");
    expect(screen.getByTestId("hero-weekly-card-water-meta")).toHaveTextContent("0.25 L");
  });

  it("shows a lightweight boolean week summary on the card footer", () => {
    const today = getToday();
    render(
      <HeroWeeklyHabitCard
        habit={habit({
          id: "gratitude",
          name: "Gratitude",
          habitType: "boolean",
          targetValue: 0,
          unit: "",
          entries: {
            [today]: { value: 1 },
          },
        })}
        onToggle={vi.fn()}
      />
    );

    expect(screen.getByTestId("hero-weekly-card-gratitude-meta")).toHaveTextContent(
      "1x · This week"
    );
  });

  it("shows finite-plan progress when duration is set", () => {
    render(
      <HeroWeeklyHabitCard
        habit={habit({
          id: "plan",
          name: "No sugar",
          habitType: "boolean",
          targetValue: 0,
          unit: "",
          durationDays: 14,
          startDate: "2026-04-20",
          endDate: "2026-05-03",
        })}
        onToggle={vi.fn()}
      />
    );

    expect(screen.getByText(/14-day plan/i)).toBeInTheDocument();
    expect(screen.getByTestId("hero-weekly-card-plan-plan")).toHaveTextContent("14 days left");
  });

  it("shows identity as a plain step and updates the state when completed today", () => {
    const today = getToday();
    const baseHabit = habit({
      id: "walk",
      name: "Morning walk",
      habitType: "boolean",
      targetValue: 0,
      unit: "",
      identityVerb: "someone who moves daily",
      identityIcon: "Dumbbell",
    });

    const { rerender } = render(<HeroWeeklyHabitCard habit={baseHabit} onToggle={vi.fn()} />);

    expect(screen.getByTestId("hero-weekly-card-walk-identity")).toHaveTextContent(
      "Step toward someone who moves daily"
    );
    expect(screen.getByTestId("hero-weekly-card-walk-identity-vote")).toHaveTextContent(
      "ready to mark"
    );

    rerender(
      <HeroWeeklyHabitCard
        habit={{
          ...baseHabit,
          entries: {
            [today]: { value: 1 },
          },
        }}
        onToggle={vi.fn()}
      />
    );
    act(() => {
      scheduleIdleCallbacks.shift()?.();
    });

    expect(screen.getByTestId("hero-weekly-card-walk-identity-vote")).toHaveTextContent(
      "step logged"
    );
    expect(screen.getByTestId("hero-weekly-card-walk-streak")).toHaveTextContent("1d streak");
  });
});
