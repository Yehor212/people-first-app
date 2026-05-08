import { describe, expect, it } from "vitest";

import { getToday } from "@/lib/utils";
import { getJournalListDateFilter } from "../journalListFilters";

describe("journalListFilters", () => {
  it("does not filter by date on the full diary surface", () => {
    expect(getJournalListDateFilter(false, "2026-04-24")).toBeNull();
  });

  it("uses the explicitly selected date for day-only surfaces", () => {
    expect(getJournalListDateFilter(true, "2026-04-24")).toBe("2026-04-24");
  });

  it("defaults day-only mobile surfaces to today instead of showing all entries", () => {
    expect(getJournalListDateFilter(true, null)).toBe(getToday());
  });
});
