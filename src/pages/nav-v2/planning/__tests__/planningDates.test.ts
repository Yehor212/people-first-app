import { describe, expect, it } from "vitest";
import { alignPlanningNow, resolveInitialPlanningDate } from "../planningDates";

describe("Planning date helpers", () => {
  it("resolves exact and relative Planning dates without reading browser state", () => {
    const yearEnd = new Date(2026, 11, 31, 18, 30);

    expect(resolveInitialPlanningDate("?planningDate=2026-08-04", yearEnd)).toBe("2026-08-04");
    expect(resolveInitialPlanningDate("?planningDate=tomorrow", yearEnd)).toBe("2027-01-01");
    expect(resolveInitialPlanningDate("?planningDate=next-week", yearEnd)).toBeUndefined();
    expect(resolveInitialPlanningDate(undefined, yearEnd)).toBeUndefined();
  });

  it("aligns the model clock to the tracked civil date without changing its time", () => {
    const current = new Date(2026, 6, 28, 14, 25, 30);
    expect(alignPlanningNow("2026-07-28", current)).toBe(current);

    const aligned = alignPlanningNow("2026-07-29", current);
    expect(aligned).not.toBe(current);
    expect(aligned.getFullYear()).toBe(2026);
    expect(aligned.getMonth()).toBe(6);
    expect(aligned.getDate()).toBe(29);
    expect(aligned.getHours()).toBe(14);
    expect(aligned.getMinutes()).toBe(25);
    expect(current.getDate()).toBe(28);
  });
});
