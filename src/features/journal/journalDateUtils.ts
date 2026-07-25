import type { Language } from "@/i18n/translations";
import { formatDate, parseLocalDate } from "@/lib/utils";
import { getLocale } from "@/lib/timeUtils";

const FALLBACK_WEEK_START: Record<Language, number> = {
  en: 0,
  uk: 1,
  es: 1,
  de: 1,
  fr: 1,
  ja: 0,
  ar: 0,
  he: 0,
};

type LocaleWithWeekInfo = Intl.Locale & {
  weekInfo?: { firstDay: number };
  getWeekInfo?: () => { firstDay: number };
};

const MILLISECONDS_PER_CIVIL_DAY = 86_400_000;

export function isCanonicalJournalDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(0);
  parsed.setUTCHours(0, 0, 0, 0);
  parsed.setUTCFullYear(year, month - 1, day);
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function getJournalDayOrdinal(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / MILLISECONDS_PER_CIVIL_DAY);
}

export function shiftJournalDate(date: string, days: number): string {
  const shifted = parseLocalDate(date);
  shifted.setDate(shifted.getDate() + days);
  return formatDate(shifted);
}

export function isNextJournalDate(previous: string, current: string): boolean {
  return shiftJournalDate(previous, 1) === current;
}

export function getJournalCivilDayDifference(from: string, to: string): number {
  return getJournalDayOrdinal(to) - getJournalDayOrdinal(from);
}

export function getJournalDayOfYear(date = new Date()): number {
  const current = formatDate(date);
  const firstDay = `${date.getFullYear()}-01-01`;
  return getJournalCivilDayDifference(firstDay, current);
}

export function getJournalDayIndex(date: Date, itemCount: number): number {
  if (itemCount <= 0) return 0;
  const ordinal = getJournalDayOrdinal(formatDate(date));
  return ((ordinal % itemCount) + itemCount) % itemCount;
}

export function getJournalWeekStart(language: Language): number {
  try {
    const locale = new Intl.Locale(getLocale(language)) as LocaleWithWeekInfo;
    const weekInfo = locale.weekInfo ?? locale.getWeekInfo?.();
    if (weekInfo && weekInfo.firstDay >= 1 && weekInfo.firstDay <= 7) {
      return weekInfo.firstDay % 7;
    }
  } catch {
    // Older WebViews use the supported-locale fallback below.
  }
  return FALLBACK_WEEK_START[language];
}

export function formatJournalCivilDate(
  date: string,
  language: Language,
  style: "short" | "long" = "short",
): string {
  const parsed = parseLocalDate(date);
  if (Number.isNaN(parsed.getTime())) return date;

  try {
    return parsed.toLocaleDateString(
      getLocale(language),
      style === "long"
        ? { weekday: "long", year: "numeric", month: "long", day: "numeric" }
        : { year: "numeric", month: "short", day: "numeric" },
    );
  } catch {
    return date;
  }
}

export function formatJournalDuration(
  template: string,
  seconds: number,
  language: Language,
): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  let duration: string;
  try {
    duration = new Intl.NumberFormat(getLocale(language), {
      style: "unit",
      unit: "second",
      unitDisplay: "long",
    }).format(safeSeconds);
  } catch {
    duration = `${safeSeconds} seconds`;
  }
  const isolatedDuration = `\u2068${duration}\u2069`;
  return template
    .replace(/\{duration\}/g, isolatedDuration)
    .replace(/\{seconds\}/g, isolatedDuration);
}
