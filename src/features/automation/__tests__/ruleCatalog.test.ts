import { describe, expect, it } from "vitest";
import { AUTOMATION_RULE_IDS } from "../types";
import {
  AUTOMATION_NO_OP_CODES,
  AUTOMATION_RULE_CATALOG,
  AutomationRuleCatalogError,
  getAutomationRule,
  requireAutomationRule,
} from "../ruleCatalog";

describe("automation rule catalog", () => {
  it("registers exactly the four versioned rules and freezes their metadata", () => {
    expect(Object.keys(AUTOMATION_RULE_CATALOG)).toEqual(AUTOMATION_RULE_IDS);
    for (const rule of Object.values(AUTOMATION_RULE_CATALOG)) {
      expect(rule.version).toBe(1);
      expect(rule.generatesPersonalText).toBe(false);
      expect(rule.maxMutations).toBeGreaterThan(0);
      expect(Object.isFrozen(rule)).toBe(true);
      expect(Object.isFrozen(rule.targetEntityTypes)).toBe(true);
    }
  });

  it("permits personal-text copying only for the mood-note rule", () => {
    expect(AUTOMATION_RULE_CATALOG["mood.note-to-journal.v1"]).toMatchObject({
      sourceType: "mood",
      targetEntityTypes: ["journal"],
      copiesUserAuthoredText: true,
      requiredMapping: "none",
      targetOwnership: "automation-created-or-owned",
    });
    expect(AUTOMATION_RULE_CATALOG["journal.mood-to-checkin.v1"]).toMatchObject({
      sourceType: "journal",
      targetEntityTypes: ["mood"],
      copiesUserAuthoredText: false,
    });
    expect(AUTOMATION_RULE_CATALOG["focus.to-mapped-habit.v1"]).toMatchObject({
      sourceType: "focus",
      targetEntityTypes: ["habit_completion"],
      requiredMapping: "focusHabitId",
      targetOwnership: "user-record-entry-only",
    });
    expect(AUTOMATION_RULE_CATALOG["habit.to-planning.v1"]).toMatchObject({
      sourceType: "habit",
      sourceFieldAllowlist: [
        "id",
        "entries",
        "habitType",
        "targetType",
        "targetValue",
        "isArchived",
        "updatedAt",
      ],
      targetEntityTypes: ["setting"],
      requiredMapping: "planningHabitMappings",
      targetOwnership: "automation-created-or-owned",
    });
  });

  it("returns null for discovery but throws one fixed code at strict boundaries", () => {
    expect(getAutomationRule("unknown.rule.v1")).toBeNull();
    expect(() => requireAutomationRule("unknown.rule.v1")).toThrowError(
      new AutomationRuleCatalogError("UNKNOWN_RULE"),
    );
  });

  it("publishes a closed, prose-free no-op code set", () => {
    expect(AUTOMATION_NO_OP_CODES).toEqual([
      "PREFERENCE_DISABLED",
      "RULE_DISABLED",
      "SOURCE_INVALID",
      "SOURCE_EMPTY",
      "SOURCE_PURGED",
      "MAPPING_MISSING",
      "TARGET_MISSING",
      "TARGET_INACTIVE",
      "THRESHOLD_NOT_MET",
      "TARGET_NOT_AUTOMATION_OWNED",
      "ALREADY_CURRENT",
      "CAPACITY_REACHED",
      "VAULT_LOCKED",
      "GATE_OFF",
    ]);
    expect(AUTOMATION_NO_OP_CODES.every((code) => /^[A-Z_]+$/.test(code))).toBe(true);
    expect(Object.isFrozen(AUTOMATION_NO_OP_CODES)).toBe(true);
  });
});
