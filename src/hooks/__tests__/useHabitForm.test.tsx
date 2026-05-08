import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useHabitForm } from "../useHabitForm";

vi.mock("@/lib/haptics", () => ({ hapticTap: vi.fn() }));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "en",
    t: {
      confirmTypeChangeDeletesHistory:
        "Changing the habit type will delete all tracking history. Continue?",
    },
  }),
}));

describe("useHabitForm", () => {
  const onAddHabit = vi.fn();
  const onUpdateHabit = vi.fn();

  beforeEach(() => {
    onAddHabit.mockReset();
    onUpdateHabit.mockReset();
  });

  it("starts template setup instead of instantly adding the template", () => {
    const { result } = renderHook(() =>
      useHabitForm({ onAddHabit, onUpdateHabit }),
    );

    act(() => {
      result.current.setIsAdding(true);
      result.current.handleQuickAdd("water");
    });

    expect(onAddHabit).not.toHaveBeenCalled();
    expect(result.current.showCustomForm).toBe(true);
    expect(result.current.selectedTemplateId).toBe("water");
    expect(result.current.settingsMode).toBe("simple");
    expect(result.current.newHabitName).toBe("Drink 2 L water");
    expect(result.current.habitType).toBe("numerical");
    expect(result.current.unit).toBe("L");
    expect(result.current.targetValue).toBe(2);
    expect(result.current.targetStep).toBe(0.25);
    expect(result.current.quickEntryMode).toBe("incrementStep");
  });

  it("saves a template habit with templateId and edited goal", () => {
    const { result } = renderHook(() =>
      useHabitForm({ onAddHabit, onUpdateHabit }),
    );

    act(() => {
      result.current.setIsAdding(true);
      result.current.handleQuickAdd("water");
    });

    act(() => {
      result.current.setTargetValue(2.5);
    });

    act(() => {
      result.current.handleAddHabit();
    });

    expect(onAddHabit).toHaveBeenCalledTimes(1);
    expect(onAddHabit).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: "water",
        habitType: "numerical",
        targetValue: 2.5,
        targetStep: 0.25,
        unit: "L",
        name: "Drink 2 L water",
        quickEntryMode: "incrementStep",
      }),
    );
  });

  it("hydrates reading as a one-page accumulator rather than a one-tap completion", () => {
    const { result } = renderHook(() =>
      useHabitForm({ onAddHabit, onUpdateHabit }),
    );

    act(() => {
      result.current.setIsAdding(true);
      result.current.handleQuickAdd("read");
    });

    expect(result.current.habitType).toBe("numerical");
    expect(result.current.unit).toBe("pages");
    expect(result.current.targetValue).toBe(10);
    expect(result.current.targetStep).toBe(1);
    expect(result.current.quickEntryMode).toBe("incrementStep");
  });

  it("normalizes old saved read habits when opening edit settings", () => {
    const { result } = renderHook(() =>
      useHabitForm({ onAddHabit, onUpdateHabit }),
    );

    act(() => {
      result.current.handleEditHabit({
        id: "legacy-read",
        name: "Read 10 pages",
        icon: "read",
        color: 11,
        position: 0,
        createdAt: 0,
        habitType: "numerical",
        frequency: { numerator: 1, denominator: 1 },
        question: "",
        description: "",
        isArchived: false,
        targetValue: 10,
        targetType: "atLeast",
        unit: "pages",
        quickEntryMode: "completeTarget",
        templateId: "read",
        entries: {},
        reminders: [],
      });
    });

    expect(result.current.targetStep).toBe(1);
    expect(result.current.quickEntryMode).toBe("incrementStep");
  });

  it("saves the emoji selected in the basic setup", () => {
    const { result } = renderHook(() =>
      useHabitForm({ onAddHabit, onUpdateHabit }),
    );

    act(() => {
      result.current.setIsAdding(true);
      result.current.setShowCustomForm(true);
      result.current.setNewHabitName("Strength practice");
      result.current.setSelectedIcon("💪");
    });

    act(() => {
      result.current.handleAddHabit();
    });

    expect(onAddHabit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Strength practice",
        icon: "💪",
      }),
    );
  });

  it("switches template unit presets and reapplies the matching defaults", () => {
    const { result } = renderHook(() =>
      useHabitForm({ onAddHabit, onUpdateHabit }),
    );

    act(() => {
      result.current.setIsAdding(true);
      result.current.handleQuickAdd("water");
    });

    act(() => {
      result.current.handleTemplateUnitChange("ml");
    });

    expect(result.current.unit).toBe("ml");
    expect(result.current.targetValue).toBe(2000);
    expect(result.current.targetStep).toBe(250);
  });

  it("hydrates minute-based templates as measurable habits", () => {
    const { result } = renderHook(() =>
      useHabitForm({ onAddHabit, onUpdateHabit }),
    );

    act(() => {
      result.current.setIsAdding(true);
      result.current.handleQuickAdd("deep-work");
    });

    expect(result.current.habitType).toBe("numerical");
    expect(result.current.unit).toBe("min");
    expect(result.current.targetValue).toBe(25);
    expect(result.current.targetStep).toBe(5);
    expect(result.current.quickEntryMode).toBe("completeTarget");
  });

  it("hydrates bad-habit limit templates with atMost semantics", () => {
    const { result } = renderHook(() =>
      useHabitForm({ onAddHabit, onUpdateHabit }),
    );

    act(() => {
      result.current.setIsAdding(true);
      result.current.handleQuickAdd("smoking-limit");
    });

    expect(result.current.habitType).toBe("numerical");
    expect(result.current.targetType).toBe("atMost");
    expect(result.current.unit).toBe("cigarettes");
    expect(result.current.targetValue).toBe(2);
    expect(result.current.targetStep).toBe(1);
    expect(result.current.quickEntryMode).toBe("limitCheck");
  });

  it("saves an optional finite habit plan with derived start/end dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T12:00:00Z"));

    const { result } = renderHook(() =>
      useHabitForm({ onAddHabit, onUpdateHabit }),
    );

    act(() => {
      result.current.setIsAdding(true);
      result.current.setShowCustomForm(true);
    });

    act(() => {
      result.current.setNewHabitName("Spring reset");
      result.current.setHasDurationLimit(true);
      result.current.setDurationDays(14);
    });

    act(() => {
      result.current.handleAddHabit();
    });

    expect(onAddHabit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Spring reset",
        durationDays: 14,
        startDate: "2026-04-20",
        endDate: "2026-05-03",
      }),
    );

    vi.useRealTimers();
  });

  it("saves 3x weekly as flexible weekly schedule by default", () => {
    const { result } = renderHook(() =>
      useHabitForm({ onAddHabit, onUpdateHabit }),
    );

    act(() => {
      result.current.setIsAdding(true);
      result.current.setShowCustomForm(true);
      result.current.setNewHabitName("Strength");
      result.current.setFrequency({ numerator: 3, denominator: 7 });
    });

    act(() => {
      result.current.handleAddHabit();
    });

    expect(onAddHabit).toHaveBeenCalledWith(
      expect.objectContaining({
        frequency: { numerator: 3, denominator: 7 },
        schedule: {
          mode: "flexiblePerPeriod",
          period: "week",
          targetCount: 3,
        },
      }),
    );
  });

  it("saves selected weekly days and aligns reminder days with them", () => {
    const { result } = renderHook(() =>
      useHabitForm({ onAddHabit, onUpdateHabit }),
    );

    act(() => {
      result.current.setIsAdding(true);
      result.current.setShowCustomForm(true);
      result.current.setNewHabitName("Mobility");
      result.current.setFrequency({ numerator: 2, denominator: 7 });
    });

    act(() => {
      result.current.setScheduleMode("specificDays");
    });

    act(() => {
      result.current.setScheduleDueDays([1, 4]);
    });

    act(() => {
      result.current.handleAddReminder();
    });

    act(() => {
      result.current.handleAddHabit();
    });

    expect(onAddHabit).toHaveBeenCalledWith(
      expect.objectContaining({
        frequency: { numerator: 2, denominator: 7 },
        schedule: {
          mode: "specificDays",
          period: "week",
          targetCount: 2,
          dueDays: [1, 4],
        },
        reminders: [expect.objectContaining({ days: [1, 4] })],
      }),
    );
  });
});
