import type { Language } from "@/i18n/translations";
import type { TranslationStrings } from "@/i18n/types";
import { getLocale } from "@/lib/timeUtils";

type JournalWordCountTranslations = Partial<TranslationStrings>;

const PLURAL_SUFFIXES: Record<Intl.LDMLPluralRule, string> = {
  zero: "Zero",
  one: "One",
  two: "Two",
  few: "Few",
  many: "Many",
  other: "Other",
};

const PLURAL_TEMPLATE_KEYS: Record<Intl.LDMLPluralRule, string> = {
  zero: "journalWordCountZero",
  one: "journalWordCountOne",
  two: "journalWordCountTwo",
  few: "journalWordCountFew",
  many: "journalWordCountMany",
  other: "journalWordCountOther",
};

const PLURAL_NOUN_KEYS: Record<Intl.LDMLPluralRule, string> = {
  zero: "journalWordsZero",
  one: "journalWordsOne",
  two: "journalWordsTwo",
  few: "journalWordsFew",
  many: "journalWordsMany",
  other: "journalWordsOther",
};

function readTranslation(
  translations: JournalWordCountTranslations,
  key: string
): string | undefined {
  const value = (translations as Record<string, unknown>)[key];
  return typeof value === "string" && value ? value : undefined;
}

function getPluralCategory(count: number, locale: string): Intl.LDMLPluralRule {
  if (count === 0) return "zero";

  try {
    return new Intl.PluralRules(locale, { type: "cardinal" }).select(count);
  } catch {
    return count === 1 ? "one" : "other";
  }
}

function formatNumber(count: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale).format(count);
  } catch {
    return String(count);
  }
}

function applyCountTemplate(template: string, formattedCount: string): string {
  return template.replace(/\{count\}/g, formattedCount);
}

export function formatLocalizedCount(
  count: number,
  language: Language,
  translations: JournalWordCountTranslations,
  keyPrefix: string,
  fallbackUnit?: string
): string {
  const locale = getLocale(language);
  const formattedCount = formatNumber(count, locale);
  const category = getPluralCategory(count, locale);
  const template =
    readTranslation(translations, `${keyPrefix}${PLURAL_SUFFIXES[category]}`) ??
    readTranslation(translations, `${keyPrefix}Other`);

  if (template) {
    return template.includes("{count}")
      ? applyCountTemplate(template, formattedCount)
      : `${formattedCount} ${template}`;
  }

  return fallbackUnit ? `${formattedCount} ${fallbackUnit}` : formattedCount;
}

export function formatLocalizedInvariantCount(
  count: number,
  language: Language,
  translations: JournalWordCountTranslations,
  key: string,
  fallbackUnit?: string
): string {
  const formattedCount = formatNumber(count, getLocale(language));
  const template = readTranslation(translations, key);
  if (template) {
    return template.includes("{count}")
      ? applyCountTemplate(template, formattedCount)
      : `${template} ${formattedCount}`;
  }
  return fallbackUnit ? `${formattedCount} ${fallbackUnit}` : formattedCount;
}

export function formatJournalWordCount(
  count: number,
  language: Language,
  translations: JournalWordCountTranslations
): string {
  const locale = getLocale(language);
  const formattedCount = formatNumber(count, locale);
  const category = getPluralCategory(count, locale);
  const template =
    readTranslation(translations, PLURAL_TEMPLATE_KEYS[category]) ??
    translations.journalWordCountOther ??
    translations.journalWords;

  if (template?.includes("{count}")) {
    return applyCountTemplate(template, formattedCount);
  }

  const noun =
    readTranslation(translations, PLURAL_NOUN_KEYS[category]) ??
    readTranslation(translations, "journalWordsOther") ??
    translations.journalWords ??
    "words";

  return `${formattedCount} ${noun}`;
}

export function formatJournalRelativeTime(
  timestamp: number,
  language: Language,
  translations: JournalWordCountTranslations,
  now = Date.now()
): string {
  const diffMs = now - timestamp;
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) return translations.justNow || "Just now";
  if (diffMinutes < 60) return formatRelative(-diffMinutes, "minute", language);

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return formatRelative(-diffHours, "hour", language);

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return translations.yesterday || "Yesterday";
  if (diffDays < 7) return formatRelative(-diffDays, "day", language);

  return "";
}

function formatRelative(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  language: Language
): string {
  const locale = getLocale(language);

  try {
    return new Intl.RelativeTimeFormat(locale, {
      numeric: "always",
      style: "short",
    }).format(value, unit);
  } catch {
    const abs = Math.abs(value);
    return `${formatNumber(abs, locale)} ${unit}${abs === 1 ? "" : "s"} ago`;
  }
}
