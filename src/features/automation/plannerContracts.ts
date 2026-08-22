import type {
  AutomationJsonValue,
  AutomationMutation,
  AutomationPreference,
  AutomationRevisionEnvelope,
  AutomationRuleId,
  AutomationSourceEvent,
} from "./types";
import type { AutomationNoOpCode } from "./ruleCatalog";

export const MAX_AUTOMATION_PLANNER_SNAPSHOT_BYTES = 64 * 1024;

export interface AutomationTargetIdentity {
  entityType: AutomationMutation["entityType"];
  entityId: string;
}

export interface AutomationTargetSnapshot extends AutomationTargetIdentity {
  value: AutomationJsonValue | null;
  revisionToken: string | null;
  automationOwned: boolean;
}

export interface AutomationJournalProtection {
  localizedTitle: string;
  protectedContent: string;
  sanitizedNoteHash: string;
}

export interface AutomationMappedHabitSnapshot {
  id: string;
  isArchived: boolean;
  habitType: "boolean" | "numerical";
  targetType: "atLeast" | "atMost";
  targetValue: number;
}

export interface AutomationPlannerInput {
  ruleId: AutomationRuleId;
  ownerUserId: string;
  consentEpoch: string;
  preference: AutomationPreference;
  sourceKey: string;
  source: AutomationSourceEvent;
  sourceRecord: unknown;
  target: AutomationTargetSnapshot;
  journalProtection?: AutomationJournalProtection;
  mappedHabit?: AutomationMappedHabitSnapshot;
}

export type AutomationPlanResult =
  | { kind: "planned"; revision: AutomationRevisionEnvelope }
  | { kind: "noop"; code: AutomationNoOpCode };

export type AutomationRuleMutationResult =
  | {
      kind: "mutation";
      after: AutomationJsonValue;
    }
  | { kind: "noop"; code: AutomationNoOpCode };

export interface AutomationRulePlannerContext {
  input: AutomationPlannerInput;
  targetIdentity: AutomationTargetIdentity;
}

export class AutomationPlannerBoundaryError extends Error {
  readonly code: AutomationNoOpCode;

  constructor(code: AutomationNoOpCode) {
    super(code);
    this.name = "AutomationPlannerBoundaryError";
    this.code = code;
  }
}

export function isCanonicalDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function noOp(code: AutomationNoOpCode): AutomationRuleMutationResult {
  return { kind: "noop", code };
}
