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

const DAY_MS = 86_400_000;
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
  "quoteJournal15",
  "quoteJournal16",
  "quoteJournal21",
  "quoteJournal22",
  "quoteJournal23",
  "quoteJournal24",
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
    expect(getJournalEmptyQuoteIndex(new Date(0))).toBe(0);
    expect(getJournalEmptyQuoteIndex(new Date(DAY_MS * 29))).toBe(29);
    expect(getJournalEmptyQuoteIndex(new Date(DAY_MS * 30))).toBe(0);

    expect(getJournalQuote({ quoteJournal1: "Localized first" }, new Date(0), { scope: "all" })).toBe(
      "Localized first",
    );
    expect(getJournalQuote({}, new Date(0), { scope: "all" })).toBe(JOURNAL_EMPTY_QUOTES[0].fallback);
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
      expect(excludedFallbacks).not.toContain(getJournalQuote({}, new Date(DAY_MS * day)));
    }
  });
});
