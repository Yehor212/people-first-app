import { z } from "zod";

import { canonicalizeAutomationValue, hashAutomationValue } from "./canonicalJson";
import { deriveAutomationUuid } from "./deterministicId";
import {
  AutomationPlannerBoundaryError,
  MAX_AUTOMATION_PLANNER_SNAPSHOT_BYTES,
  isCanonicalDate,
  type AutomationPlanResult,
  type AutomationPlannerInput,
  type AutomationTargetIdentity,
  type AutomationTargetSnapshot,
} from "./plannerContracts";
import { planFocusToHabitMutation } from "./planners/focusToHabit";
import { planHabitToPlanningMutation } from "./planners/habitToPlanning";
import { planJournalToMoodMutation } from "./planners/journalToMood";
import { planMoodToJournalMutation } from "./planners/moodToJournal";
import { getAutomationRule } from "./ruleCatalog";
import { computeAutomationSourceKey } from "./sourceKey";
import {
  automationJsonValueSchema,
  automationMutationEntityTypeSchema,
  automationPreferenceSchema,
  automationRevisionEnvelopeSchema,
  automationSourceEventSchema,
  type AutomationRuleId,
} from "./types";

export type {
  AutomationPlanResult,
  AutomationPlannerInput,
  AutomationTargetIdentity,
  AutomationTargetSnapshot,
} from "./plannerContracts";

const ownerIdSchema = z.string().uuid();
const targetSnapshotSchema = z
  .object({
    entityType: automationMutationEntityTypeSchema,
    entityId: z.string().min(1).max(512),
    value: automationJsonValueSchema.nullable(),
    revisionToken: z.string().uuid().nullable(),
    automationOwned: z.boolean(),
  })
  .strict()
  .superRefine((snapshot, ctx) => {
    if ((snapshot.value === null) !== (snapshot.revisionToken === null)) {
      ctx.addIssue({
        code: "custom",
        path: ["revisionToken"],
        message: "Target presence and revision token must agree",
      });
    }
    if (snapshot.value === null && snapshot.automationOwned) {
      ctx.addIssue({
        code: "custom",
        path: ["automationOwned"],
        message: "An absent target cannot be automation-owned",
      });
    }
  });

function sourceTypeForRule(ruleId: AutomationRuleId) {
  return getAutomationRule(ruleId)?.sourceType ?? null;
}

function targetSnapshotIsBounded(snapshot: AutomationTargetSnapshot): boolean {
  try {
    return (
      new TextEncoder().encode(canonicalizeAutomationValue(snapshot.value)).byteLength <=
      MAX_AUTOMATION_PLANNER_SNAPSHOT_BYTES
    );
  } catch {
    return false;
  }
}

export async function deriveAutomationTargetIdentity(input: {
  ruleId: AutomationRuleId;
  ownerUserId: string;
  source: unknown;
  preference: unknown;
  sourceRecord: unknown;
}): Promise<AutomationTargetIdentity> {
  const owner = ownerIdSchema.safeParse(input.ownerUserId);
  const source = automationSourceEventSchema.safeParse(input.source);
  const preference = automationPreferenceSchema.safeParse(input.preference);
  const expectedSourceType = sourceTypeForRule(input.ruleId);
  if (
    !owner.success ||
    !source.success ||
    !preference.success ||
    expectedSourceType === null ||
    source.data.type !== expectedSourceType
  ) {
    throw new AutomationPlannerBoundaryError("SOURCE_INVALID");
  }

  if (input.ruleId === "mood.note-to-journal.v1") {
    return {
      entityType: "journal",
      entityId: await deriveAutomationUuid("target", [input.ruleId, owner.data, source.data.id]),
    };
  }
  if (input.ruleId === "journal.mood-to-checkin.v1") {
    return {
      entityType: "mood",
      entityId: await deriveAutomationUuid("target", [input.ruleId, owner.data, source.data.id]),
    };
  }
  if (input.ruleId === "focus.to-mapped-habit.v1") {
    if (!preference.data.focusHabitId) {
      throw new AutomationPlannerBoundaryError("MAPPING_MISSING");
    }
    const habitId = z.string().uuid().safeParse(preference.data.focusHabitId);
    const sourceRecord = z
      .object({ id: z.string(), date: z.string() })
      .passthrough()
      .safeParse(input.sourceRecord);
    if (
      !habitId.success ||
      !sourceRecord.success ||
      sourceRecord.data.id !== source.data.id ||
      !isCanonicalDate(sourceRecord.data.date)
    ) {
      throw new AutomationPlannerBoundaryError("SOURCE_INVALID");
    }
    return {
      entityType: "habit_completion",
      entityId: `${habitId.data}:${sourceRecord.data.date}`,
    };
  }
  if (input.ruleId === "habit.to-planning.v1") {
    const sourceRecord = z
      .object({ id: z.string().min(1).max(512) })
      .passthrough()
      .safeParse(input.sourceRecord);
    if (!sourceRecord.success || sourceRecord.data.id !== source.data.id) {
      throw new AutomationPlannerBoundaryError("SOURCE_INVALID");
    }
    if (!preference.data.planningHabitMappings[source.data.id]) {
      throw new AutomationPlannerBoundaryError("MAPPING_MISSING");
    }
    return {
      entityType: "setting",
      entityId: "zenflow-schedule-events",
    };
  }

  throw new AutomationPlannerBoundaryError("SOURCE_INVALID");
}

export async function planAutomation(input: AutomationPlannerInput): Promise<AutomationPlanResult> {
  const preference = automationPreferenceSchema.safeParse(input.preference);
  const source = automationSourceEventSchema.safeParse(input.source);
  const owner = ownerIdSchema.safeParse(input.ownerUserId);
  const consentEpoch = z.string().uuid().safeParse(input.consentEpoch);
  const rule = getAutomationRule(input.ruleId);
  if (!preference.success || !source.success || !owner.success || !consentEpoch.success || !rule) {
    return { kind: "noop", code: "SOURCE_INVALID" };
  }
  if (!preference.data.enabled || preference.data.consentEpoch !== consentEpoch.data) {
    return { kind: "noop", code: "PREFERENCE_DISABLED" };
  }
  if (!preference.data.enabledRuleIds.includes(input.ruleId)) {
    return { kind: "noop", code: "RULE_DISABLED" };
  }
  if (source.data.type !== rule.sourceType) {
    return { kind: "noop", code: "SOURCE_INVALID" };
  }

  const expectedSourceKey = await computeAutomationSourceKey({
    ownerUserId: owner.data,
    consentEpoch: consentEpoch.data,
    ruleId: input.ruleId,
    ruleVersion: 1,
    sourceType: source.data.type,
    sourceId: source.data.id,
    sourceRevision: source.data.revision,
  });
  if (input.sourceKey !== expectedSourceKey) {
    return { kind: "noop", code: "SOURCE_INVALID" };
  }

  let targetIdentity: AutomationTargetIdentity;
  try {
    targetIdentity = await deriveAutomationTargetIdentity({
      ruleId: input.ruleId,
      ownerUserId: owner.data,
      source: source.data,
      preference: preference.data,
      sourceRecord: input.sourceRecord,
    });
  } catch (error) {
    if (error instanceof AutomationPlannerBoundaryError) {
      return { kind: "noop", code: error.code };
    }
    throw error;
  }

  const target = targetSnapshotSchema.safeParse(input.target);
  if (
    !target.success ||
    !targetSnapshotIsBounded(target.data) ||
    target.data.entityType !== targetIdentity.entityType ||
    target.data.entityId !== targetIdentity.entityId
  ) {
    return { kind: "noop", code: "SOURCE_INVALID" };
  }

  const normalizedInput: AutomationPlannerInput = {
    ...input,
    ownerUserId: owner.data,
    consentEpoch: consentEpoch.data,
    preference: preference.data,
    sourceKey: expectedSourceKey,
    source: source.data,
    target: target.data,
  };
  const context = { input: normalizedInput, targetIdentity };
  const mutationPlan =
    input.ruleId === "mood.note-to-journal.v1"
      ? await planMoodToJournalMutation(context)
      : input.ruleId === "journal.mood-to-checkin.v1"
        ? planJournalToMoodMutation(context)
        : input.ruleId === "focus.to-mapped-habit.v1"
          ? planFocusToHabitMutation(context)
          : input.ruleId === "habit.to-planning.v1"
            ? planHabitToPlanningMutation(context)
            : { kind: "noop" as const, code: "SOURCE_INVALID" as const };
  if (mutationPlan.kind === "noop") return mutationPlan;

  const [beforeHash, afterHash, transactionId, afterRevisionToken] = await Promise.all([
    hashAutomationValue(target.data.value),
    hashAutomationValue(mutationPlan.after),
    deriveAutomationUuid("transaction", [expectedSourceKey]),
    deriveAutomationUuid("revision", [
      expectedSourceKey,
      targetIdentity.entityType,
      targetIdentity.entityId,
    ]),
  ]);
  if (beforeHash === afterHash) return { kind: "noop", code: "ALREADY_CURRENT" };

  return {
    kind: "planned",
    revision: automationRevisionEnvelopeSchema.parse({
      schemaVersion: 1,
      transactionId,
      ownerUserId: owner.data,
      consentEpoch: consentEpoch.data,
      sourceKey: expectedSourceKey,
      ruleId: input.ruleId,
      ruleVersion: 1,
      source: source.data,
      mutations: [
        {
          entityType: targetIdentity.entityType,
          entityId: targetIdentity.entityId,
          operation: "upsert",
          before: target.data.value,
          after: mutationPlan.after,
          beforeHash,
          afterHash,
          beforeRevisionToken: target.data.revisionToken,
          afterRevisionToken,
        },
      ],
      plannedAt: source.data.committedAt,
    }),
  };
}
