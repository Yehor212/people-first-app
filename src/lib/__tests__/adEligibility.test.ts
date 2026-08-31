import { describe, expect, it } from "vitest";

import {
  deriveCurrentProductAdEntitlement,
  isEmotionallyProtectedOnLocalDate,
  isHabitsBannerSurfaceEligible,
} from "@/lib/adEligibility";
import type { MoodEntry } from "@/types";

const mood = (
  id: string,
  date: string,
  value: MoodEntry["mood"],
  timestamp: number,
): MoodEntry => ({ id, date, mood: value, timestamp });

describe("Android banner eligibility", () => {
  it("protects the whole current local day when any entry is bad or terrible", () => {
    const entries = [
      mood("yesterday", "2026-08-29", "terrible", 1),
      mood("morning", "2026-08-30", "bad", 2),
      mood("evening", "2026-08-30", "great", 3),
    ];

    expect(isEmotionallyProtectedOnLocalDate(entries, "2026-08-30")).toBe(true);
  });

  it("ignores prior-day and future entries when evaluating today", () => {
    const entries = [
      mood("yesterday", "2026-08-29", "terrible", 1),
      mood("tomorrow", "2026-08-31", "bad", 2),
      mood("today", "2026-08-30", "okay", 3),
    ];

    expect(isEmotionallyProtectedOnLocalDate(entries, "2026-08-30")).toBe(false);
  });

  it("requires at least one habit row that is actually visible today", () => {
    expect(isHabitsBannerSurfaceEligible({ visibleHabitCount: 0, protectedSurfaceOpen: false })).toBe(false);
    expect(isHabitsBannerSurfaceEligible({ visibleHabitCount: 1, protectedSurfaceOpen: false })).toBe(true);
    expect(isHabitsBannerSurfaceEligible({ visibleHabitCount: 1, protectedSurfaceOpen: true })).toBe(false);
  });

  it("fails closed without an authoritative entitlement and limits free to isolated QA", () => {
    expect(deriveCurrentProductAdEntitlement({ accountBoundaryInProgress: false })).toBe("unknown");
    expect(
      deriveCurrentProductAdEntitlement({
        accountBoundaryInProgress: false,
        qaTestEligibility: true,
      }),
    ).toBe("free");
    expect(
      deriveCurrentProductAdEntitlement({
        accountBoundaryInProgress: true,
        qaTestEligibility: true,
      }),
    ).toBe("unknown");
  });
});
