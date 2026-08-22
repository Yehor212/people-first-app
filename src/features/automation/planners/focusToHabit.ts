import { ENTRY } from "@/types";
import { z } from "zod";

import {
  encodeHabitCompletionForCloud,
  getCloudHabitCompletionSemanticFieldsForSync,
} from "@/storage/sync/habitCompletionCodec";
import {
  isCanonicalDate,
  noOp,
  type AutomationRuleMutationResult,
  type AutomationRulePlannerContext,
} from "../plannerContracts";

const focusSourceSchema = z
  .object({
    id: z.string().min(1).max(512),
    duration: z.number().finite().min(0).max(1440),
    completedAt: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    date: z.string(),
    status: z.enum(["completed", "aborted"]).optional(),
    updatedAt: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  })
  .passthrough();

const mappedHabitSchema = z
  .object({
    id: z.string().uuid(),
    isArchived: z.boolean(),
    habitType: z.enum(["boolean", "numerical"]),
    targetType: z.enum(["atLeast", "atMost"]),
    targetValue: z.number().finite().min(0).max(Number.MAX_SAFE_INTEGER / 1000),
  })
  .strict();

export function planFocusToHabitMutation({
  input,
}: AutomationRulePlannerContext): AutomationRuleMutationResult {
  const sourceRecord = focusSourceSchema.safeParse(input.sourceRecord);
  if (
    !sourceRecord.success ||
    sourceRecord.data.id !== input.source.id ||
    !isCanonicalDate(sourceRecord.data.date) ||
    sourceRecord.data.status !== "completed"
  ) {
    return noOp("SOURCE_INVALID");
  }
  if (!input.preference.focusHabitId) return noOp("MAPPING_MISSING");

  const mappedHabit = mappedHabitSchema.safeParse(input.mappedHabit);
  if (!mappedHabit.success || mappedHabit.data.id !== input.preference.focusHabitId) {
    return noOp("TARGET_MISSING");
  }
  if (mappedHabit.data.isArchived) return noOp("TARGET_INACTIVE");
  if (sourceRecord.data.duration < input.preference.focusMinimumMinutes) {
    return noOp("THRESHOLD_NOT_MET");
  }

  let entryValue: number;
  if (mappedHabit.data.habitType === "boolean") {
    entryValue = ENTRY.YES_MANUAL;
  } else {
    if (mappedHabit.data.targetType === "atLeast" && mappedHabit.data.targetValue <= 0) {
      return noOp("SOURCE_INVALID");
    }
    entryValue = Math.round(mappedHabit.data.targetValue * 1000);
    if (!Number.isSafeInteger(entryValue)) return noOp("SOURCE_INVALID");
  }
  const cloudValue = encodeHabitCompletionForCloud({
    habitType: mappedHabit.data.habitType,
    entryValue,
  });

  return {
    kind: "mutation",
    after: {
      habit_id: mappedHabit.data.id,
      date: sourceRecord.data.date,
      ...cloudValue,
      ...getCloudHabitCompletionSemanticFieldsForSync({
        habitType: mappedHabit.data.habitType,
        targetType: mappedHabit.data.targetType,
        entryValue,
        isComplete: true,
      }),
    },
  };
}
