import type { MoodType } from "@/types";
import { isNextJournalDate } from "./journalDateUtils";

/** Detect consecutive diary day streaks from a set of date strings */
export function computeStreaks(
  entryDates: Map<string, MoodType | undefined>
): Map<string, { isStart: boolean; isEnd: boolean; length: number }> {
  const result = new Map<string, { isStart: boolean; isEnd: boolean; length: number }>();
  const dates = Array.from(entryDates.keys()).sort();
  if (dates.length === 0) return result;

  let streakStart = 0;
  for (let i = 1; i <= dates.length; i++) {
    const isConsecutive = i < dates.length && isNextJournalDate(dates[i - 1], dates[i]);

    if (!isConsecutive) {
      const streakLen = i - streakStart;
      if (streakLen >= 2) {
        for (let j = streakStart; j < i; j++) {
          result.set(dates[j], {
            isStart: j === streakStart,
            isEnd: j === i - 1,
            length: streakLen,
          });
        }
      }
      streakStart = i;
    }
  }
  return result;
}
