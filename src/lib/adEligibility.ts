import type { MoodEntry } from "@/types";

export type AdEntitlement = "free" | "premium" | "unknown";

interface HabitsBannerSurfaceInput {
  visibleHabitCount: number;
  protectedSurfaceOpen: boolean;
}

/**
 * Only a current, server-verified result may enable production ads. The
 * isolated admob-qa build can exercise test inventory without a real account;
 * account transitions deny both paths.
 */
export function deriveCurrentProductAdEntitlement(input: {
  accountBoundaryInProgress: boolean;
  qaTestEligibility?: boolean;
  serverEntitlement?: AdEntitlement;
}): AdEntitlement {
  if (input.accountBoundaryInProgress) return "unknown";
  if (input.qaTestEligibility === true) return "free";
  return input.serverEntitlement ?? "unknown";
}

export function isEmotionallyProtectedOnLocalDate(
  moods: readonly MoodEntry[],
  localDate: string
): boolean {
  if (!localDate) return true;
  return moods.some(
    (entry) => entry.date === localDate && (entry.mood === "bad" || entry.mood === "terrible")
  );
}

export function isHabitsBannerSurfaceEligible({
  visibleHabitCount,
  protectedSurfaceOpen,
}: HabitsBannerSurfaceInput): boolean {
  return Number.isFinite(visibleHabitCount) && visibleHabitCount > 0 && !protectedSurfaceOpen;
}
