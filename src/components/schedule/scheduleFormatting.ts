import { parseLocalDate } from "@/lib/utils";

export function formatScheduleDayNumber(date: string, language: string): string {
  return new Intl.NumberFormat(language, { useGrouping: false }).format(
    parseLocalDate(date).getDate()
  );
}

export function formatScheduleTime(
  language: string,
  hour: number,
  minute: number
): string {
  return new Intl.DateTimeFormat(language, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(2000, 0, 1, hour, minute));
}

export function formatScheduleNumericPart(language: string, value: number): string {
  return new Intl.NumberFormat(language, {
    minimumIntegerDigits: 2,
    useGrouping: false,
  }).format(value);
}

export function formatScheduleNumber(language: string, value: number): string {
  return new Intl.NumberFormat(language, { useGrouping: false }).format(value);
}
