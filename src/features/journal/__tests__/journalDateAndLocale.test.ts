import { describe, expect, it } from "vitest";

import {
  formatJournalDuration,
  formatJournalCivilDate,
  getJournalCivilDayDifference,
  getJournalDayOfYear,
  getJournalWeekStart,
  isNextJournalDate,
  shiftJournalDate,
} from "../journalDateUtils";
import { fr } from "@/i18n/languages/fr";
import { he } from "@/i18n/languages/he";

describe("journal civil dates and locale rules", () => {
  it("moves by local calendar dates across DST boundaries", () => {
    expect(shiftJournalDate("2026-03-09", -1)).toBe("2026-03-08");
    expect(shiftJournalDate("2026-11-01", 1)).toBe("2026-11-02");
    expect(isNextJournalDate("2026-03-08", "2026-03-09")).toBe(true);
    expect(getJournalCivilDayDifference("2026-03-08", "2026-03-09")).toBe(1);
    expect(getJournalCivilDayDifference("2026-11-01", "2026-11-02")).toBe(1);
  });

  it("computes day-of-year from civil dates rather than elapsed hours", () => {
    expect(getJournalDayOfYear(new Date(2026, 0, 1, 23, 59))).toBe(0);
    expect(getJournalDayOfYear(new Date(2026, 2, 9, 0, 1))).toBe(67);
  });

  it("uses the supported locale's first weekday", () => {
    expect(getJournalWeekStart("en")).toBe(0);
    expect(getJournalWeekStart("uk")).toBe(1);
    expect(getJournalWeekStart("es")).toBe(1);
    expect(getJournalWeekStart("de")).toBe(1);
    expect(getJournalWeekStart("fr")).toBe(1);
    expect(getJournalWeekStart("ja")).toBe(0);
    expect(getJournalWeekStart("ar")).toBe(0);
    expect(getJournalWeekStart("he")).toBe(0);
  });

  it("formats a complete localized duration without Latin suffixes or placeholders", () => {
    const value = formatJournalDuration("انتظر {duration}.", 7, "ar");
    expect(value).not.toContain("{duration}");
    expect(value).not.toMatch(/7s|٧s/);
    expect(value).toContain("٧");
  });

  it("uses a date header in French and a grammatical Hebrew time template", () => {
    expect(fr.journalExportDate).toBe("Date");
    expect(he.journalMoodInsightBestTime).toBe("מצב הרוח שתועד הוא הגבוה ביותר כשכותבים {period}");
  });

  it("formats the selected civil date without borrowing the creation timestamp", () => {
    expect(formatJournalCivilDate("2026-04-26", "en", "short")).toContain("Apr");
    expect(formatJournalCivilDate("2026-04-26", "uk", "long")).toMatch(/26.*2026/);
    expect(formatJournalCivilDate("2026-04-26", "ar", "short")).not.toContain("2026-04-25");
  });
});
