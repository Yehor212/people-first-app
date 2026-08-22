import { z } from "zod";

import {
  isCanonicalDate,
  noOp,
  type AutomationRuleMutationResult,
  type AutomationRulePlannerContext,
} from "../plannerContracts";

const journalSourceSchema = z
  .object({
    id: z.string().min(1).max(512),
    date: z.string(),
    mood: z.enum(["great", "good", "okay", "bad", "terrible"]).nullable().optional(),
    updatedAt: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  })
  .passthrough();

export function planJournalToMoodMutation({
  input,
  targetIdentity,
}: AutomationRulePlannerContext): AutomationRuleMutationResult {
  const sourceRecord = journalSourceSchema.safeParse(input.sourceRecord);
  if (
    !sourceRecord.success ||
    sourceRecord.data.id !== input.source.id ||
    !isCanonicalDate(sourceRecord.data.date)
  ) {
    return noOp("SOURCE_INVALID");
  }
  if (!sourceRecord.data.mood) return noOp("SOURCE_EMPTY");
  if (input.target.value !== null && !input.target.automationOwned) {
    return noOp("TARGET_NOT_AUTOMATION_OWNED");
  }

  return {
    kind: "mutation",
    after: {
      id: targetIdentity.entityId,
      mood: sourceRecord.data.mood,
      note: null,
      tags: null,
      date: sourceRecord.data.date,
      timestamp: input.source.committedAt,
      updated_at: input.source.committedAt,
      valence: null,
      log_type: null,
      emotion_tags: null,
      contexts: null,
      emotion: null,
    },
  };
}
