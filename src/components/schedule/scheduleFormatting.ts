import { parseLocalDate } from "@/lib/utils";
import { isAndroid } from "@/lib/platform";

const MAX_TASK_FORMATTERS = 32;
const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();
const numberFormatters = new Map<string, Intl.NumberFormat>();
let clearScheduled = false;

function getTaskFormatter<T>(
  cache: Map<string, T>,
  kind: string,
  language: string,
  create: () => T,
): T {
  if (!isAndroid || typeof queueMicrotask !== "function") return create();

  const key = `${kind}:${language}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const formatter = create();
  if (cache.size >= MAX_TASK_FORMATTERS) return formatter;
  cache.set(key, formatter);
  if (!clearScheduled) {
    clearScheduled = true;
    // Calendar rows share preparation within a render, not across frames or
    // lifecycle changes. Recreating after this checkpoint respects the current
    // system timezone without retaining native Intl objects for a long session.
    queueMicrotask(() => {
      dateTimeFormatters.clear();
      numberFormatters.clear();
      clearScheduled = false;
    });
  }
  return formatter;
}

function getNumberFormatter(language: string): Intl.NumberFormat {
  return getTaskFormatter(numberFormatters, "number", language, () =>
    new Intl.NumberFormat(language, { useGrouping: false }),
  );
}

export function formatScheduleDayNumber(date: string, language: string): string {
  return getNumberFormatter(language).format(
    parseLocalDate(date).getDate()
  );
}

export function formatScheduleWeekday(date: string, language: string): string {
  return getTaskFormatter(dateTimeFormatters, "weekday", language, () =>
    new Intl.DateTimeFormat(language, { weekday: "short" }),
  ).format(parseLocalDate(date));
}

export function formatScheduleDateLabel(date: string, language: string): string {
  return getTaskFormatter(dateTimeFormatters, "full-date", language, () =>
    new Intl.DateTimeFormat(language, { dateStyle: "full" }),
  ).format(parseLocalDate(date));
}

export function formatScheduleTime(
  language: string,
  hour: number,
  minute: number
): string {
  return getTaskFormatter(dateTimeFormatters, "time", language, () =>
    new Intl.DateTimeFormat(language, {
      hour: "2-digit",
      minute: "2-digit",
    }),
  ).format(new Date(2000, 0, 1, hour, minute));
}

export function formatScheduleNumericPart(language: string, value: number): string {
  return getTaskFormatter(numberFormatters, "numeric-part", language, () =>
    new Intl.NumberFormat(language, {
      minimumIntegerDigits: 2,
      useGrouping: false,
    }),
  ).format(value);
}

export function formatScheduleNumber(language: string, value: number): string {
  return getNumberFormatter(language).format(value);
}
