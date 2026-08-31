import { logger } from "@/lib/logger";
import { safeLocalStorageGet, safeLocalStorageSet } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";

interface StoredAdGraceState {
  cohort: "new" | "existing";
  activeDates: string[];
}

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REQUIRED_ACTIVE_DATES = 4;

function parseStoredState(value: unknown): StoredAdGraceState | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<StoredAdGraceState>;
  if (candidate.cohort !== "new" && candidate.cohort !== "existing") return null;
  if (!Array.isArray(candidate.activeDates)) return null;
  const activeDates = [...new Set(candidate.activeDates.filter(
    (date): date is string => typeof date === "string" && LOCAL_DATE_PATTERN.test(date),
  ))].sort();
  return { cohort: candidate.cohort, activeDates };
}

export function recordAdActiveDate(input: {
  localDate: string;
  hasExistingData: boolean;
}): boolean {
  if (!LOCAL_DATE_PATTERN.test(input.localDate)) return false;

  const stored = parseStoredState(
    safeLocalStorageGet<StoredAdGraceState | null>(SK.AD_GRACE_STATE, null),
  );
  const cohort = stored?.cohort ?? (input.hasExistingData ? "existing" : "new");
  const activeDates = [...new Set([...(stored?.activeDates ?? []), input.localDate])]
    .sort()
    .slice(-REQUIRED_ACTIVE_DATES);
  const nextState: StoredAdGraceState = { cohort, activeDates };

  if (!safeLocalStorageSet(SK.AD_GRACE_STATE, nextState)) {
    logger.warn("[Ads] Failed to persist active-day grace state; ads remain disabled");
    return false;
  }

  return cohort === "existing" || activeDates.length >= REQUIRED_ACTIVE_DATES;
}
