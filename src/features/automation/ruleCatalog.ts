import type { AutomationRuleId, AutomationSourceType } from "./types";

export const AUTOMATION_NO_OP_CODES = Object.freeze([
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
] as const);

export type AutomationNoOpCode = (typeof AUTOMATION_NO_OP_CODES)[number];

export type AutomationRuleTargetEntityType =
  | "mood"
  | "habit"
  | "habit_completion"
  | "journal"
  | "setting";
export type AutomationRuleMapping = "none" | "focusHabitId" | "planningHabitMappings";
export type AutomationTargetOwnership =
  | "automation-created-or-owned"
  | "user-record-entry-only";

export interface AutomationRuleDefinition {
  readonly id: AutomationRuleId;
  readonly version: 1;
  readonly sourceType: AutomationSourceType;
  readonly sourceFieldAllowlist: readonly string[];
  readonly targetEntityTypes: readonly AutomationRuleTargetEntityType[];
  readonly requiredMapping: AutomationRuleMapping;
  readonly targetOwnership: AutomationTargetOwnership;
  readonly copiesUserAuthoredText: boolean;
  readonly generatesPersonalText: false;
  readonly maxMutations: number;
  readonly rollbackPolicy: "all-target-revision-cas";
}

function defineRule(
  rule: Omit<AutomationRuleDefinition, "generatesPersonalText" | "rollbackPolicy">,
): Readonly<AutomationRuleDefinition> {
  return Object.freeze({
    ...rule,
    sourceFieldAllowlist: Object.freeze([...rule.sourceFieldAllowlist]),
    targetEntityTypes: Object.freeze([...rule.targetEntityTypes]),
    generatesPersonalText: false,
    rollbackPolicy: "all-target-revision-cas" as const,
  });
}

export const AUTOMATION_RULE_CATALOG: Readonly<
  Record<AutomationRuleId, Readonly<AutomationRuleDefinition>>
> = Object.freeze({
  "mood.note-to-journal.v1": defineRule({
    id: "mood.note-to-journal.v1",
    version: 1,
    sourceType: "mood",
    sourceFieldAllowlist: ["id", "date", "note", "timestamp", "updatedAt"],
    targetEntityTypes: ["journal"],
    requiredMapping: "none",
    targetOwnership: "automation-created-or-owned",
    copiesUserAuthoredText: true,
    maxMutations: 1,
  }),
  "journal.mood-to-checkin.v1": defineRule({
    id: "journal.mood-to-checkin.v1",
    version: 1,
    sourceType: "journal",
    sourceFieldAllowlist: ["id", "date", "mood", "updatedAt"],
    targetEntityTypes: ["mood"],
    requiredMapping: "none",
    targetOwnership: "automation-created-or-owned",
    copiesUserAuthoredText: false,
    maxMutations: 1,
  }),
  "focus.to-mapped-habit.v1": defineRule({
    id: "focus.to-mapped-habit.v1",
    version: 1,
    sourceType: "focus",
    sourceFieldAllowlist: ["id", "date", "duration", "completedAt", "status", "updatedAt"],
    targetEntityTypes: ["habit_completion"],
    requiredMapping: "focusHabitId",
    targetOwnership: "user-record-entry-only",
    copiesUserAuthoredText: false,
    maxMutations: 1,
  }),
  "habit.to-planning.v1": defineRule({
    id: "habit.to-planning.v1",
    version: 1,
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
    copiesUserAuthoredText: false,
    maxMutations: 1,
  }),
});

export class AutomationRuleCatalogError extends Error {
  readonly code: "UNKNOWN_RULE";

  constructor(code: "UNKNOWN_RULE") {
    super(code);
    this.name = "AutomationRuleCatalogError";
    this.code = code;
  }
}

export function getAutomationRule(ruleId: string): Readonly<AutomationRuleDefinition> | null {
  if (!Object.prototype.hasOwnProperty.call(AUTOMATION_RULE_CATALOG, ruleId)) return null;
  return AUTOMATION_RULE_CATALOG[ruleId as AutomationRuleId];
}

export function requireAutomationRule(ruleId: string): Readonly<AutomationRuleDefinition> {
  const rule = getAutomationRule(ruleId);
  if (!rule) throw new AutomationRuleCatalogError("UNKNOWN_RULE");
  return rule;
}
