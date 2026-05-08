import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MiniWeekRow } from "../MiniWeekRow";
import { toStoredValue } from "@/lib/habits";
import type { Habit } from "@/types";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      dayMon: "Mon",
      dayTue: "Tue",
      dayWed: "Wed",
      dayThu: "Thu",
      dayFri: "Fri",
      daySat: "Sat",
      daySun: "Sun",
      done: "done",
      skipped: "skipped",
      notDone: "not done",
      noData: "no data",
    },
    language: "en",
  }),
}));

vi.mock("@/lib/haptics", () => ({ hapticTap: vi.fn() }));

const habit = (overrides: Partial<Habit> = {}): Habit => ({
  id: "habit-1",
  name: "Stretch",
  icon: "x",
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
  ...overrides,
});

describe("MiniWeekRow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 18, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("locks non-today cells when the V2 hero uses today-only interaction", () => {
    const onToggle = vi.fn();

    render(
      <MiniWeekRow
        habit={habit()}
        habitColor="#00ffaa"
        onToggle={onToggle}
        interactionScope="today"
      />,
    );

    const previousDay = screen.getByLabelText("2026-04-17: no data");
    const today = screen.getByLabelText("2026-04-18: no data");
    const futureDay = screen.getByLabelText("2026-04-19: no data");

    expect(previousDay).toHaveAttribute("aria-disabled", "true");
    expect(today).toHaveAttribute("aria-disabled", "false");
    expect(futureDay).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(previousDay);
    fireEvent.click(today);
    fireEvent.click(futureDay);

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith("habit-1", "2026-04-18");
  });

  it("quick-completes a numerical walk target in one hero tap instead of stepping by 0.5", () => {
    const onAdjust = vi.fn();

    render(
      <MiniWeekRow
        habit={habit({
          id: "walk-distance",
          name: "Walk 3 km outside",
          habitType: "numerical",
          templateId: "walk-distance",
          targetValue: 3,
          unit: "km",
        })}
        habitColor="#00ffaa"
        onToggle={vi.fn()}
        onAdjust={onAdjust}
        interactionScope="today"
      />,
    );

    fireEvent.click(screen.getByLabelText("2026-04-18: 0"));

    expect(onAdjust).toHaveBeenCalledTimes(1);
    expect(onAdjust).toHaveBeenCalledWith("walk-distance", "2026-04-18", 3);
  });

  it("increments reading by one page instead of completing ten pages in one hero tap", () => {
    const onNumericalAction = vi.fn();

    render(
      <MiniWeekRow
        habit={habit({
          id: "read",
          name: "Read 10 pages",
          habitType: "numerical",
          templateId: "read",
          targetValue: 10,
          unit: "pages",
          quickEntryMode: "completeTarget",
        })}
        habitColor="#00ffaa"
        onToggle={vi.fn()}
        onAdjust={vi.fn()}
        onNumericalAction={onNumericalAction}
        interactionScope="today"
      />,
    );

    fireEvent.click(screen.getByLabelText("2026-04-18: 0"));

    expect(onNumericalAction).toHaveBeenCalledTimes(1);
    expect(onNumericalAction).toHaveBeenCalledWith("read", "2026-04-18", {
      type: "adjust",
      delta: 1,
    });
  });

  it("emits an explicit zero entry action for limit-check habits with no entry today", () => {
    const onNumericalAction = vi.fn();

    render(
      <MiniWeekRow
        habit={habit({
          id: "smoking-limit",
          name: "No more than 2 cigarettes",
          habitType: "numerical",
          templateId: "smoking-limit",
          targetType: "atMost",
          targetValue: 2,
          unit: "cigarettes",
        })}
        habitColor="#00ffaa"
        onToggle={vi.fn()}
        onAdjust={vi.fn()}
        onNumericalAction={onNumericalAction}
        interactionScope="today"
      />,
    );

    fireEvent.click(screen.getByLabelText("2026-04-18: 0"));

    expect(onNumericalAction).toHaveBeenCalledTimes(1);
    expect(onNumericalAction).toHaveBeenCalledWith("smoking-limit", "2026-04-18", {
      type: "set",
      value: 0,
    });
  });

  it("does not turn over-limit values into success from the quick hero tap", () => {
    const onNumericalAction = vi.fn();

    render(
      <MiniWeekRow
        habit={habit({
          id: "smoking-limit",
          name: "No more than 2 cigarettes",
          habitType: "numerical",
          templateId: "smoking-limit",
          targetType: "atMost",
          targetValue: 2,
          unit: "cigarettes",
          entries: {
            "2026-04-18": { value: toStoredValue(3) },
          },
        })}
        habitColor="#00ffaa"
        onToggle={vi.fn()}
        onAdjust={vi.fn()}
        onNumericalAction={onNumericalAction}
        interactionScope="today"
      />,
    );

    fireEvent.click(screen.getByLabelText("2026-04-18: 3"));

    expect(onNumericalAction).toHaveBeenCalledTimes(1);
    expect(onNumericalAction).toHaveBeenCalledWith("smoking-limit", "2026-04-18", {
      type: "openExactInput",
    });
  });

  it("opens exact input for an over-target walk value instead of lowering it on hero tap", () => {
    const onAdjust = vi.fn();
    const onNumericalAction = vi.fn();

    render(
      <MiniWeekRow
        habit={habit({
          id: "walk-distance",
          name: "Walk 3 km outside",
          habitType: "numerical",
          templateId: "walk-distance",
          targetValue: 3,
          unit: "km",
          entries: {
            "2026-04-18": { value: toStoredValue(3.5) },
          },
        })}
        habitColor="#00ffaa"
        onToggle={vi.fn()}
        onAdjust={onAdjust}
        onNumericalAction={onNumericalAction}
        interactionScope="today"
      />,
    );

    fireEvent.click(screen.getByLabelText("2026-04-18: 3.5"));

    expect(onAdjust).not.toHaveBeenCalled();
    expect(onNumericalAction).toHaveBeenCalledTimes(1);
    expect(onNumericalAction).toHaveBeenCalledWith("walk-distance", "2026-04-18", {
      type: "openExactInput",
    });
  });

  it("keeps history cells as precise numerical increments", () => {
    const onAdjust = vi.fn();

    render(
      <MiniWeekRow
        habit={habit({
          id: "walk-distance",
          name: "Walk 3 km outside",
          habitType: "numerical",
          templateId: "walk-distance",
          targetValue: 3,
          unit: "km",
        })}
        habitColor="#00ffaa"
        onToggle={vi.fn()}
        onAdjust={onAdjust}
      />,
    );

    fireEvent.click(screen.getByLabelText("2026-04-18: 0"));

    expect(onAdjust).toHaveBeenCalledTimes(1);
    expect(onAdjust).toHaveBeenCalledWith("walk-distance", "2026-04-18", 0.5);
  });
});
