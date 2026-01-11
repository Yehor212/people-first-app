import { describe, expect, it } from "vitest";
import { calculateStreak, getDaysInMonth, getToday, formatDate } from "@/lib/utils";

describe("utils", () => {
  it("calculates streak from consecutive dates", () => {
    const today = getToday();
    const yesterday = formatDate(new Date(Date.now() - 86400000));
    const twoDaysAgo = formatDate(new Date(Date.now() - 2 * 86400000));
    const streak = calculateStreak([today, yesterday, twoDaysAgo]);
    expect(streak).toBe(3);
  });

  it("returns correct days in month for leap year", () => {
    expect(getDaysInMonth(2024, 1)).toBe(29);
  });
});
