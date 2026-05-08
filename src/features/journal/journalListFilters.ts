import { getToday } from "@/lib/utils";

export function getJournalListDateFilter(
  selectedDateOnly: boolean,
  selectedDate?: string | null,
): string | null {
  if (!selectedDateOnly) return null;
  return selectedDate || getToday();
}
