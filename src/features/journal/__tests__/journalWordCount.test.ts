import { describe, expect, it } from "vitest";

import {
  formatJournalRelativeTime,
  formatJournalWordCount,
  formatLocalizedCount,
} from "../journalWordCount";
import type { Language } from "@/i18n/translations";
import { ar } from "@/i18n/languages/ar";
import { de } from "@/i18n/languages/de";
import { en } from "@/i18n/languages/en";
import { es } from "@/i18n/languages/es";
import { fr } from "@/i18n/languages/fr";
import { he } from "@/i18n/languages/he";
import { ja } from "@/i18n/languages/ja";
import { uk } from "@/i18n/languages/uk";

const tx = {
  journalWords: "words",
  journalWordCountZero: "{count} words",
  journalWordCountOne: "{count} word",
  journalWordCountTwo: "{count} words",
  journalWordCountFew: "{count} words",
  journalWordCountMany: "{count} words",
  journalWordCountOther: "{count} words",
};

const allLanguageTranslations = {
  en,
  uk,
  es,
  de,
  fr,
  ja,
  ar,
  he,
} satisfies Record<Language, object>;

const countPrefixes = [
  "journalEntryCount",
  "journalThisWeekCount",
  "journalCharacterCount",
  "journalReadingTimeCount",
  "journalStreakCount",
  "journalPhotoRemainingCount",
  "journalImportErrorCount",
  "journalStatsDayCount",
  "stickerCount",
  "diaryMoreMemoryCount",
  "habitPlanDurationCount",
  "daysLeftCount",
];

const pluralSuffixes = ["Zero", "One", "Two", "Few", "Many", "Other"];

describe("formatJournalWordCount", () => {
  it("uses Ukrainian one/few/many forms instead of a single static noun", () => {
    const uk = {
      ...tx,
      journalWordCountZero: "{count} слів",
      journalWordCountOne: "{count} слово",
      journalWordCountFew: "{count} слова",
      journalWordCountMany: "{count} слів",
      journalWordCountOther: "{count} слова",
    };

    expect(formatJournalWordCount(1, "uk", uk)).toBe("1 слово");
    expect(formatJournalWordCount(3, "uk", uk)).toBe("3 слова");
    expect(formatJournalWordCount(5, "uk", uk)).toBe("5 слів");
    expect(formatJournalWordCount(21, "uk", uk)).toBe("21 слово");
  });

  it("keeps English singular/plural readable", () => {
    expect(formatJournalWordCount(1, "en", tx)).toBe("1 word");
    expect(formatJournalWordCount(3, "en", tx)).toBe("3 words");
  });

  it("supports languages without visible plural changes", () => {
    const ja = {
      ...tx,
      journalWordCountZero: "{count}語",
      journalWordCountOne: "{count}語",
      journalWordCountTwo: "{count}語",
      journalWordCountFew: "{count}語",
      journalWordCountMany: "{count}語",
      journalWordCountOther: "{count}語",
    };

    expect(formatJournalWordCount(3, "ja", ja)).toBe("3語");
  });
});

describe("formatLocalizedCount", () => {
  it("uses Ukrainian entry forms for 1/2-4/5+ instead of a static noun", () => {
    const uk = {
      journalEntryCountZero: "{count} записів",
      journalEntryCountOne: "{count} запис",
      journalEntryCountTwo: "{count} записи",
      journalEntryCountFew: "{count} записи",
      journalEntryCountMany: "{count} записів",
      journalEntryCountOther: "{count} запису",
    };

    expect(formatLocalizedCount(1, "uk", uk, "journalEntryCount")).toBe("1 запис");
    expect(formatLocalizedCount(2, "uk", uk, "journalEntryCount")).toBe("2 записи");
    expect(formatLocalizedCount(5, "uk", uk, "journalEntryCount")).toBe("5 записів");
    expect(formatLocalizedCount(21, "uk", uk, "journalEntryCount")).toBe("21 запис");
  });

  it("formats habit days-left as a full localized phrase", () => {
    const uk = {
      daysLeftCountZero: "{count} днів залишилось",
      daysLeftCountOne: "{count} день залишився",
      daysLeftCountTwo: "{count} дні залишилось",
      daysLeftCountFew: "{count} дні залишилось",
      daysLeftCountMany: "{count} днів залишилось",
      daysLeftCountOther: "{count} дня залишилось",
    };

    expect(formatLocalizedCount(1, "uk", uk, "daysLeftCount")).toBe("1 день залишився");
    expect(formatLocalizedCount(3, "uk", uk, "daysLeftCount")).toBe("3 дні залишилось");
  });

  it("keeps Japanese count order natural when there is no visible plural change", () => {
    const ja = {
      journalEntryCountZero: "{count}件",
      journalEntryCountOne: "{count}件",
      journalEntryCountTwo: "{count}件",
      journalEntryCountFew: "{count}件",
      journalEntryCountMany: "{count}件",
      journalEntryCountOther: "{count}件",
    };

    expect(formatLocalizedCount(3, "ja", ja, "journalEntryCount")).toBe("3件");
  });

  it("has count templates with {count} for every supported language", () => {
    for (const [language, rawTranslations] of Object.entries(allLanguageTranslations)) {
      const translations = rawTranslations as unknown as Record<string, string>;
      for (const prefix of countPrefixes) {
        for (const suffix of pluralSuffixes) {
          const key = `${prefix}${suffix}`;
          expect(translations[key], `${language}.${key}`).toContain("{count}");
        }
      }
    }
  });
});

describe("formatJournalRelativeTime", () => {
  const now = new Date("2026-04-26T12:00:00Z").getTime();

  it("uses language-sensitive relative time instead of static suffixes", () => {
    expect(formatJournalRelativeTime(now - 2 * 60 * 60 * 1000, "uk", tx, now)).toBe(
      "2 год тому"
    );
    expect(formatJournalRelativeTime(now - 5 * 24 * 60 * 60 * 1000, "uk", tx, now)).toBe(
      "5 дн. тому"
    );
  });

  it("keeps just-now and yesterday labels from translations", () => {
    expect(formatJournalRelativeTime(now - 10 * 1000, "en", { justNow: "Now" }, now)).toBe(
      "Now"
    );
    expect(
      formatJournalRelativeTime(now - 24 * 60 * 60 * 1000, "en", { yesterday: "Yesterday" }, now)
    ).toBe("Yesterday");
  });
});
