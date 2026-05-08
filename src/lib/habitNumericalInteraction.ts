import { habitTemplates, resolveHabitTemplateSetup } from "@/lib/habitTemplates";
import type { Habit, HabitNumericalEntryMode } from "@/types";

export type NumericalEntryAction =
  | { type: "set"; value: number }
  | { type: "adjust"; delta: number }
  | { type: "clear" }
  | { type: "openExactInput" };

const FALLBACK_UNIT_STEPS: Record<string, number> = {
  l: 0.25,
  ml: 250,
  km: 0.5,
  mi: 0.5,
  min: 5,
  mins: 5,
  minute: 5,
  minutes: 5,
  hr: 0.25,
  hrs: 0.25,
  hour: 0.25,
  hours: 0.25,
};

const TEMPLATE_ENTRY_MODE_OVERRIDES: Partial<Record<string, HabitNumericalEntryMode>> = {
  protein: "completeTarget",
  read: "incrementStep",
};

function normalizeDelta(delta: number): number {
  return Number(delta.toFixed(3));
}

function resolveTemplateStep(habit: Habit): number | null {
  if (!habit.templateId) return null;
  const template = habitTemplates.find((item) => item.id === habit.templateId);
  if (template?.habitType !== "numerical") return null;
  return resolveHabitTemplateSetup(template, habit.unit || undefined).targetStep;
}

function resolveTemplateEntryMode(habit: Habit): HabitNumericalEntryMode | null {
  if (!habit.templateId) return null;
  const template = habitTemplates.find((item) => item.id === habit.templateId);
  if (template?.habitType !== "numerical") return null;
  return resolveHabitTemplateSetup(template, habit.unit || undefined).quickEntryMode;
}

function resolveTemplateEntryModeOverride(habit: Habit): HabitNumericalEntryMode | null {
  if (!habit.templateId) return null;
  return TEMPLATE_ENTRY_MODE_OVERRIDES[habit.templateId] ?? null;
}

export function resolveNumericalEntryMode(habit: Habit): HabitNumericalEntryMode {
  if (habit.targetType === "atMost") return "limitCheck";

  const templateModeOverride = resolveTemplateEntryModeOverride(habit);
  if (templateModeOverride && templateModeOverride !== "limitCheck") {
    return templateModeOverride;
  }

  if (habit.quickEntryMode && habit.quickEntryMode !== "limitCheck") {
    return habit.quickEntryMode;
  }

  const templateMode = resolveTemplateEntryMode(habit);
  if (templateMode && templateMode !== "limitCheck") return templateMode;

  return "completeTarget";
}

export function getNumericalAdjustmentStep(habit: Habit): number {
  const templateStep = resolveTemplateStep(habit);
  if (templateStep && templateStep > 0) return templateStep;

  if (habit.targetStep && habit.targetStep > 0) return habit.targetStep;

  const unit = habit.unit.trim().toLowerCase();
  return FALLBACK_UNIT_STEPS[unit] ?? 1;
}

export function getNumericalQuickEntryAction(
  habit: Habit,
  currentValue: number,
  hasEntry: boolean
): NumericalEntryAction {
  const target = habit.targetValue ?? 0;
  const mode = resolveNumericalEntryMode(habit);

  if (mode === "incrementStep") {
    return { type: "adjust", delta: getNumericalAdjustmentStep(habit) };
  }

  if (mode === "limitCheck") {
    if (!hasEntry) return { type: "set", value: 0 };
    if (currentValue === 0) return { type: "clear" };
    return { type: "openExactInput" };
  }

  if (target <= 0) {
    return { type: "adjust", delta: getNumericalAdjustmentStep(habit) };
  }

  if (hasEntry && currentValue === target) return { type: "clear" };
  if (hasEntry && currentValue > target) return { type: "openExactInput" };
  return { type: "set", value: target };
}

export function getNumericalActionDelta(
  action: NumericalEntryAction,
  currentValue: number
): number | null {
  switch (action.type) {
    case "adjust":
      return action.delta;
    case "set":
      return normalizeDelta(action.value - Math.max(0, currentValue));
    case "clear":
      return normalizeDelta(-Math.max(0, currentValue));
    case "openExactInput":
      return null;
  }
}

export function getNumericalQuickToggleDelta(habit: Habit, currentValue: number): number {
  return (
    getNumericalActionDelta(
      getNumericalQuickEntryAction(habit, currentValue, currentValue > 0),
      currentValue
    ) ?? 0
  );
}

export function getNumericalWeekCellDelta(
  habit: Habit,
  currentValue: number,
  mode: "increment" | "quickToggle"
): number {
  if (mode === "quickToggle") {
    return (
      getNumericalActionDelta(
        getNumericalQuickEntryAction(habit, currentValue, currentValue > 0),
        currentValue
      ) ?? 0
    );
  }
  return getNumericalAdjustmentStep(habit);
}
