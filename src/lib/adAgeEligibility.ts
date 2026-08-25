import type { AdAgeEligibility } from "@/types";

export type AdAgeEligibilityResult =
  | { ok: true; eligibility: Exclude<AdAgeEligibility, "unknown"> }
  | { ok: false };

const MAX_PLAUSIBLE_AGE = 120;
const ADULT_AGE = 18;

/**
 * Derives the minimal ad-eligibility category without retaining the supplied
 * date. Callers must persist only the returned category.
 */
export function deriveAdAgeEligibility(
  birthDate: string,
  now: Date = new Date(),
): AdAgeEligibilityResult {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!match) return { ok: false };

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(year, month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day ||
    candidate > today ||
    year < today.getFullYear() - MAX_PLAUSIBLE_AGE
  ) {
    return { ok: false };
  }

  const adultYear = year + ADULT_AGE;
  const hasReachedAdultAge =
    today.getFullYear() > adultYear ||
    (today.getFullYear() === adultYear &&
      (today.getMonth() > month - 1 ||
        (today.getMonth() === month - 1 && today.getDate() >= day)));

  return {
    ok: true,
    eligibility: hasReachedAdultAge ? "adult" : "minor",
  };
}
