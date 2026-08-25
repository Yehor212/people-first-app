import { describe, expect, it } from "vitest";
import { deriveAdAgeEligibility } from "@/lib/adAgeEligibility";

describe("adAgeEligibility", () => {
  const today = new Date(2026, 7, 25);

  it("classifies the exact eighteenth birthday as adult", () => {
    expect(deriveAdAgeEligibility("2008-08-25", today)).toEqual({
      ok: true,
      eligibility: "adult",
    });
  });

  it("classifies the day before the eighteenth birthday as minor", () => {
    expect(deriveAdAgeEligibility("2008-08-26", today)).toEqual({
      ok: true,
      eligibility: "minor",
    });
  });

  it.each(["", "not-a-date", "2026-02-29", "2026-08-26", "1900-01-01"])(
    "rejects an absent, impossible, future, or implausible date without inventing an age (%s)",
    (value) => {
      expect(deriveAdAgeEligibility(value, today)).toEqual({ ok: false });
    },
  );
});
