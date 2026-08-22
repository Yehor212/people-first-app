import { describe, expect, it } from "vitest";
import type { Language } from "@/i18n/translations";
import { getLocale } from "@/lib/timeUtils";
import { parseLocalDate } from "@/lib/utils";
import { formatJournalMonthRange } from "../journalDateUtils";

const LANGUAGES: Language[] = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"];

describe("formatJournalMonthRange", () => {
  it.each(LANGUAGES)("uses the locale-native month range for %s", (language) => {
    const first = parseLocalDate("2026-07-15");
    const last = parseLocalDate("2026-08-11");
    const formatter = new Intl.DateTimeFormat(getLocale(language), {
      month: "short",
      year: "numeric",
    }) as Intl.DateTimeFormat & {
      formatRange?: (start: Date | number, end: Date | number) => string;
    };
    expect(formatter.formatRange).toBeTypeOf("function");
    if (!formatter.formatRange) throw new Error("This runtime must support formatRange");
    const expected = formatter.formatRange(first, last);

    expect(formatJournalMonthRange("2026-07-15", "2026-08-11", language)).toBe(
      expected,
    );
  });

  it("does not append the Japanese year to only the second month", () => {
    const label = formatJournalMonthRange("2026-07-15", "2026-08-11", "ja");

    expect(label).not.toBe("7月 — 2026年8月");
  });
});
