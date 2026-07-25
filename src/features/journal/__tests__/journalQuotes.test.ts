import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ar } from "@/i18n/languages/ar";
import { de } from "@/i18n/languages/de";
import { en } from "@/i18n/languages/en";
import { es } from "@/i18n/languages/es";
import { fr } from "@/i18n/languages/fr";
import { he } from "@/i18n/languages/he";
import { ja } from "@/i18n/languages/ja";
import { uk } from "@/i18n/languages/uk";
import {
  getJournalEmptyQuoteIndex,
  getJournalQuote,
  JOURNAL_EMPTY_QUOTES,
  JOURNAL_FIRST_USE_QUOTES,
} from "../journalQuotes";

const supportedLocales = [
  { language: "en", translations: en },
  { language: "uk", translations: uk },
  { language: "es", translations: es },
  { language: "de", translations: de },
  { language: "fr", translations: fr },
  { language: "ja", translations: ja },
  { language: "ar", translations: ar },
  { language: "he", translations: he },
];

const firstUseExcludedQuoteIds = new Set([
  "quoteJournal6",
  "quoteJournal11",
  "quoteJournal13",
  "quoteJournal14",
  "quoteJournal15",
  "quoteJournal16",
  "quoteJournal21",
  "quoteJournal22",
  "quoteJournal23",
  "quoteJournal24",
  "quoteJournal9",
]);

describe("journal quote restoration", () => {
  it("keeps the full 30 quoteJournal contract available for every supported language", () => {
    expect(JOURNAL_EMPTY_QUOTES).toHaveLength(30);
    expect(JOURNAL_EMPTY_QUOTES.map((quote) => quote.translationId)).toEqual(
      Array.from({ length: 30 }, (_, index) => `quoteJournal${index + 1}`),
    );

    for (const locale of supportedLocales) {
      const translations = locale.translations as unknown as Record<string, string>;
      for (const quote of JOURNAL_EMPTY_QUOTES) {
        expect(translations[quote.translationId], `${quote.translationId} missing in ${locale.language}`).toEqual(
          expect.any(String),
        );
        expect(translations[quote.translationId].trim(), `${quote.translationId} empty in ${locale.language}`).not.toBe(
          "",
        );
      }
    }
  });

  it("uses deterministic day indexing and falls back safely when a translation is missing", () => {
    const morning = new Date(2026, 2, 8, 0, 1);
    const evening = new Date(2026, 2, 8, 23, 59);
    const nextDay = new Date(2026, 2, 9, 0, 1);
    const index = getJournalEmptyQuoteIndex(morning);

    expect(getJournalEmptyQuoteIndex(evening)).toBe(index);
    expect(getJournalEmptyQuoteIndex(nextDay)).toBe((index + 1) % JOURNAL_EMPTY_QUOTES.length);

    const translationId = JOURNAL_EMPTY_QUOTES[index].translationId;
    expect(getJournalQuote({ [translationId]: "Localized first" }, morning, { scope: "all" })).toBe(
      "Localized first",
    );
    expect(getJournalQuote({}, morning, { scope: "all" })).toBe(JOURNAL_EMPTY_QUOTES[index].fallback);
  });

  it("keeps first-use empty states on the gentle subset without deleting restored legacy quotes", () => {
    expect(JOURNAL_FIRST_USE_QUOTES.length).toBeGreaterThan(10);

    const firstUseQuoteIds = new Set(JOURNAL_FIRST_USE_QUOTES.map((quote) => quote.translationId));
    for (const quote of JOURNAL_FIRST_USE_QUOTES) {
      expect(JOURNAL_EMPTY_QUOTES).toContain(quote);
    }
    for (const excludedQuoteId of firstUseExcludedQuoteIds) {
      expect(firstUseQuoteIds).not.toContain(excludedQuoteId);
    }

    const excludedFallbacks = new Set(
      JOURNAL_EMPTY_QUOTES.filter((quote) => firstUseExcludedQuoteIds.has(quote.translationId)).map(
        (quote) => quote.fallback,
      ),
    );
    for (let day = 0; day < JOURNAL_FIRST_USE_QUOTES.length * 3; day += 1) {
      expect(excludedFallbacks).not.toContain(getJournalQuote({}, new Date(2026, 0, 1 + day, 12)));
    }
  });

  it("uses the full restored pool for the regular daily journal quote while first use stays gentle", () => {
    const regularList = readFileSync("src/features/journal/JournalEntryList.tsx", "utf8");
    const firstUseCanvas = readFileSync("src/features/journal/DiaryEmptyCanvas.tsx", "utf8");

    expect(regularList).toContain(
      'getJournalQuote(ts, parseLocalDate(currentDay), { scope: "all" })',
    );
    expect(firstUseCanvas).toContain("getJournalQuote(ts)");
    expect(firstUseCanvas).not.toContain('scope: "all"');
  });
});
