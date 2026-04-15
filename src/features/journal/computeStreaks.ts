import type { MoodType } from "@/types";

/** Detect consecutive diary day streaks from a set of date strings */
export function computeStreaks(
  entryDates: Map<string, MoodType | undefined>
): Map<string, { isStart: boolean; isEnd: boolean; length: number }> {
  const result = new Map<string, { isStart: boolean; isEnd: boolean; length: number }>();
  const dates = Array.from(entryDates.keys()).sort();
  if (dates.length === 0) return result;

  let streakStart = 0;
  for (let i = 1; i <= dates.length; i++) {
    const prevDate = new Date(dates[i - 1] + "T00:00:00");
    const currDate = i < dates.length ? new Date(dates[i] + "T00:00:00") : null;
    const isConsecutive = currDate && currDate.getTime() - prevDate.getTime() === 86400000;

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
