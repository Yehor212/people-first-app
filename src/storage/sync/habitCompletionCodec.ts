import { ENTRY, type LoopHabitType } from "@/types";

interface EncodeHabitCompletionForCloudParams {
  habitType: LoopHabitType;
  /** Local entry value: boolean uses ENTRY constants, numerical uses real value × 1000. */
  entryValue: number;
}

interface DecodeHabitCompletionFromCloudParams {
  habitType: LoopHabitType;
  count: number | null | undefined;
  /**
   * Legacy column name is `duration`, but for numerical habit completions we
   * repurpose it as the exact local value payload (real value × 1000) so the
   * sync contract can round-trip decimals without a schema migration.
   */
  duration: number | null | undefined;
}

export interface CloudHabitCompletionFields {
  count: number;
  duration: number | null;
}

export function encodeHabitCompletionForCloud({
  habitType,
  entryValue,
}: EncodeHabitCompletionForCloudParams): CloudHabitCompletionFields {
  if (habitType !== "numerical") {
    return { count: 1, duration: null };
  }

  const exactValue = Math.max(1, Math.round(entryValue));
  return {
    count: Math.max(1, Math.round(exactValue / 1000)),
    duration: exactValue,
  };
}

export function decodeHabitCompletionFromCloud({
  habitType,
  count,
  duration,
}: DecodeHabitCompletionFromCloudParams): number {
  if (habitType !== "numerical") {
    return ENTRY.YES_MANUAL;
  }

  if (typeof duration === "number" && duration > 0) {
    return duration;
  }

  const legacyCount = typeof count === "number" && count > 0 ? count : 1;
  return legacyCount * 1000;
}
