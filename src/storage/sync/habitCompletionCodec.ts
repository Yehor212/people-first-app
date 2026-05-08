import { ENTRY, type LoopHabitType, type TargetType } from "@/types";

interface EncodeHabitCompletionForCloudParams {
  habitType: LoopHabitType;
  /** Local entry value: boolean uses ENTRY constants, numerical uses real value × 1000. */
  entryValue: number;
}

interface HabitEntrySyncableParams {
  habitType: LoopHabitType;
  targetType?: TargetType;
  entryValue: number | null | undefined;
}

interface CloudHabitTypeParams {
  habitType: LoopHabitType;
  targetType?: TargetType;
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
  /**
   * V2 schema column for the exact local entry value. When present, this is
   * authoritative over legacy count/duration fields.
   */
  entryValue?: number | null | undefined;
}

interface CloudHabitCompletionSemanticsParams {
  habitType: LoopHabitType;
  targetType?: TargetType;
  entryValue: number | null | undefined;
  isComplete: boolean;
}

export interface CloudHabitCompletionFields {
  count: number;
  duration: number | null;
}

export type CloudHabitEntryStatus = "completed" | "partial" | "over_limit";

export interface CloudHabitCompletionSemanticFields {
  entry_value: number | null;
  entry_status: CloudHabitEntryStatus;
  is_complete: boolean;
  habit_type: LoopHabitType;
  target_type: TargetType | null;
}

export function getCloudHabitTypeForSync({
  habitType,
  targetType,
}: CloudHabitTypeParams): "daily" | "multiple" | "reduce" {
  if (habitType !== "numerical") return "daily";
  return targetType === "atMost" ? "reduce" : "multiple";
}

export function isHabitEntrySyncableToCloud({
  habitType,
  targetType,
  entryValue,
}: HabitEntrySyncableParams): boolean {
  if (typeof entryValue !== "number" || !Number.isFinite(entryValue)) return false;

  if (habitType !== "numerical") {
    return entryValue === ENTRY.YES_MANUAL;
  }

  if (entryValue === ENTRY.UNKNOWN || entryValue === ENTRY.SKIP) return false;
  if (entryValue > 0) return true;
  return targetType === "atMost" && entryValue === ENTRY.NO;
}

export function encodeHabitCompletionForCloud({
  habitType,
  entryValue,
}: EncodeHabitCompletionForCloudParams): CloudHabitCompletionFields {
  if (habitType !== "numerical") {
    return { count: 1, duration: null };
  }

  const exactValue = Math.max(0, Math.round(entryValue));
  return {
    count: exactValue === 0 ? 0 : Math.max(1, Math.round(exactValue / 1000)),
    duration: exactValue,
  };
}

export function getCloudHabitCompletionSemanticFieldsForSync({
  habitType,
  targetType,
  entryValue,
  isComplete,
}: CloudHabitCompletionSemanticsParams): CloudHabitCompletionSemanticFields {
  const normalizedEntryValue =
    typeof entryValue === "number" && Number.isFinite(entryValue)
      ? Math.max(0, Math.round(entryValue))
      : null;

  return {
    entry_value: normalizedEntryValue,
    entry_status: isComplete
      ? "completed"
      : habitType === "numerical" && targetType === "atMost"
        ? "over_limit"
        : "partial",
    is_complete: isComplete,
    habit_type: habitType,
    target_type: habitType === "numerical" ? (targetType ?? "atLeast") : null,
  };
}

export function decodeHabitCompletionFromCloud({
  habitType,
  count,
  duration,
  entryValue,
}: DecodeHabitCompletionFromCloudParams): number {
  if (habitType !== "numerical") {
    return ENTRY.YES_MANUAL;
  }

  if (typeof entryValue === "number" && entryValue >= 0) {
    return entryValue;
  }

  if (typeof duration === "number" && duration >= 0) {
    return duration;
  }

  const legacyCount = typeof count === "number" && count > 0 ? count : 1;
  return legacyCount * 1000;
}
