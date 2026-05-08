import { describe, expect, it } from "vitest";
import {
  getNumericalQuickEntryAction,
  getNumericalAdjustmentStep,
  getNumericalQuickToggleDelta,
  getNumericalWeekCellDelta,
  resolveNumericalEntryMode,
} from "../habitNumericalInteraction";
import { makeTestHabit } from "@/test/habitFixtures";

describe("habitNumericalInteraction", () => {
  it("uses the walk template half-kilometer step for explicit numerical adjustment", () => {
    const walk = makeTestHabit({
      habitType: "numerical",
      templateId: "walk-distance",
      targetValue: 3,
      unit: "km",
    });

    expect(getNumericalAdjustmentStep(walk)).toBe(0.5);
  });

  it("fills the whole walk target from a quick weekly-cell tap", () => {
    const walk = makeTestHabit({
      habitType: "numerical",
      templateId: "walk-distance",
      targetValue: 3,
      unit: "km",
    });

    expect(getNumericalQuickToggleDelta(walk, 0)).toBe(3);
    expect(getNumericalQuickToggleDelta(walk, 2.5)).toBe(0.5);
    expect(getNumericalQuickToggleDelta(walk, 3.5)).toBe(0);
  });

  it("resolves complete-target templates to one-tap set or clear without downgrading precise over-target data", () => {
    const walk = makeTestHabit({
      habitType: "numerical",
      templateId: "walk-distance",
      targetValue: 3,
      unit: "km",
    });

    expect(resolveNumericalEntryMode(walk)).toBe("completeTarget");
    expect(getNumericalQuickEntryAction(walk, 0, false)).toEqual({ type: "set", value: 3 });
    expect(getNumericalQuickEntryAction(walk, 3, true)).toEqual({ type: "clear" });
    expect(getNumericalQuickEntryAction(walk, 3.5, true)).toEqual({ type: "openExactInput" });
  });

  it("adds one page for read templates even when an old habit stored complete-target mode", () => {
    const read = makeTestHabit({
      habitType: "numerical",
      templateId: "read",
      targetValue: 10,
      unit: "pages",
      quickEntryMode: "completeTarget",
    });

    expect(getNumericalAdjustmentStep(read)).toBe(1);
    expect(resolveNumericalEntryMode(read)).toBe("incrementStep");
    expect(getNumericalQuickEntryAction(read, 0, false)).toEqual({ type: "adjust", delta: 1 });
    expect(getNumericalQuickEntryAction(read, 1, true)).toEqual({ type: "adjust", delta: 1 });
    expect(getNumericalQuickToggleDelta(read, 0)).toBe(1);
    expect(getNumericalQuickToggleDelta(read, 9)).toBe(1);
  });

  it("keeps add-protein templates as a single logged portion instead of a silent five-gram counter", () => {
    const protein = makeTestHabit({
      habitType: "numerical",
      templateId: "protein",
      targetValue: 30,
      unit: "g",
      quickEntryMode: "incrementStep",
    });

    expect(getNumericalAdjustmentStep(protein)).toBe(5);
    expect(resolveNumericalEntryMode(protein)).toBe("completeTarget");
    expect(getNumericalQuickEntryAction(protein, 0, false)).toEqual({ type: "set", value: 30 });
    expect(getNumericalQuickEntryAction(protein, 30, true)).toEqual({ type: "clear" });
  });

  it("keeps accumulator templates as step-based quick entry", () => {
    const water = makeTestHabit({
      habitType: "numerical",
      templateId: "water",
      targetValue: 2,
      unit: "L",
    });

    expect(resolveNumericalEntryMode(water)).toBe("incrementStep");
    expect(getNumericalQuickEntryAction(water, 0, false)).toEqual({ type: "adjust", delta: 0.25 });
    expect(getNumericalQuickEntryAction(water, 1.75, true)).toEqual({
      type: "adjust",
      delta: 0.25,
    });
  });

  it("uses stored custom steps when a numerical habit is not template-derived", () => {
    const customPages = makeTestHabit({
      habitType: "numerical",
      templateId: undefined,
      targetValue: 12,
      targetStep: 2,
      unit: "pages",
      quickEntryMode: "incrementStep",
    });

    expect(getNumericalAdjustmentStep(customPages)).toBe(2);
    expect(getNumericalQuickEntryAction(customPages, 4, true)).toEqual({
      type: "adjust",
      delta: 2,
    });
  });

  it("records limit-style habits as zero without converting over-limit data into success", () => {
    const smokingLimit = makeTestHabit({
      habitType: "numerical",
      templateId: "smoking-limit",
      targetType: "atMost",
      targetValue: 2,
      unit: "cigarettes",
    });

    expect(resolveNumericalEntryMode(smokingLimit)).toBe("limitCheck");
    expect(getNumericalQuickEntryAction(smokingLimit, 0, false)).toEqual({ type: "set", value: 0 });
    expect(getNumericalQuickEntryAction(smokingLimit, 0, true)).toEqual({ type: "clear" });
    expect(getNumericalQuickEntryAction(smokingLimit, 3, true)).toEqual({ type: "openExactInput" });
  });

  it("normalizes stale quick-entry modes against the target type", () => {
    const staleAtLeastLimit = makeTestHabit({
      habitType: "numerical",
      templateId: "water",
      targetType: "atLeast",
      targetValue: 2,
      unit: "L",
      quickEntryMode: "limitCheck",
    });
    const staleAtMostGoal = makeTestHabit({
      habitType: "numerical",
      templateId: "smoking-limit",
      targetType: "atMost",
      targetValue: 2,
      unit: "cigarettes",
      quickEntryMode: "completeTarget",
    });

    expect(resolveNumericalEntryMode(staleAtLeastLimit)).toBe("incrementStep");
    expect(getNumericalQuickEntryAction(staleAtLeastLimit, 0, false)).toEqual({
      type: "adjust",
      delta: 0.25,
    });
    expect(resolveNumericalEntryMode(staleAtMostGoal)).toBe("limitCheck");
    expect(getNumericalQuickEntryAction(staleAtMostGoal, 0, false)).toEqual({
      type: "set",
      value: 0,
    });
  });

  it("keeps increment mode separate from quick-toggle mode", () => {
    const walk = makeTestHabit({
      habitType: "numerical",
      templateId: "walk-distance",
      targetValue: 3,
      unit: "km",
    });

    expect(getNumericalWeekCellDelta(walk, 0, "increment")).toBe(0.5);
    expect(getNumericalWeekCellDelta(walk, 0, "quickToggle")).toBe(3);
  });

  it("keeps the legacy delta adapter from converting limit entries into hidden success", () => {
    const smokingLimit = makeTestHabit({
      habitType: "numerical",
      templateId: "smoking-limit",
      targetType: "atMost",
      targetValue: 2,
      unit: "cigarettes",
    });

    expect(getNumericalQuickToggleDelta(smokingLimit, 0)).toBe(0);
    expect(getNumericalQuickToggleDelta(smokingLimit, 1)).toBe(0);
    expect(getNumericalQuickToggleDelta(smokingLimit, 3)).toBe(0);
  });
});
