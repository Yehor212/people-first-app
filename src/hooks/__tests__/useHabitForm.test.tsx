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
    expect(result.current.newHabitName).toBe("Drink water");
    expect(result.current.habitType).toBe("numerical");
    expect(result.current.unit).toBe("L");
    expect(result.current.targetValue).toBe(2);
    expect(result.current.targetStep).toBe(0.25);
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
        unit: "L",
        name: "Drink water",
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
  });
});
