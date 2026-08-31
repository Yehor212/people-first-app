import type { MoodEntry } from "@/types";

export type AdEntitlement = "free" | "premium" | "unknown";

interface HabitsBannerSurfaceInput {
  visibleHabitCount: number;
  protectedSurfaceOpen: boolean;
}

/**
 * Production stays ad-free until an authoritative account-scoped entitlement
 * source exists. The explicit admob-qa build may exercise the banner with
 * Google's test inventory, but an account transition still denies it.
 */
export function deriveCurrentProductAdEntitlement(input: {
  accountBoundaryInProgress: boolean;
  qaTestEligibility?: boolean;
}): AdEntitlement {
  if (input.accountBoundaryInProgress) return "unknown";
  return input.qaTestEligibility === true ? "free" : "unknown";
}

export function isEmotionallyProtectedOnLocalDate(
  moods: readonly MoodEntry[],
  localDate: string,
): boolean {
  if (!localDate) return true;
  return moods.some(
    (entry) =>
      entry.date === localDate &&
      (entry.mood === "bad" || entry.mood === "terrible"),
  );
}

export function isHabitsBannerSurfaceEligible({
  visibleHabitCount,
  protectedSurfaceOpen,
}: HabitsBannerSurfaceInput): boolean {
  return Number.isFinite(visibleHabitCount) && visibleHabitCount > 0 && !protectedSurfaceOpen;
}
