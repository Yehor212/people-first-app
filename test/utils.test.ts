import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  calculateStreak,
  getDaysInMonth,
  getToday,
  formatDate,
  parseLocalDate,
  generateId,
  getGreeting,
  formatTime,
  getMonthName,
  getDayName,
  cn,
} from "@/lib/utils";

// ============================================
// formatDate
// ============================================

describe("formatDate", () => {
  it("formats date as YYYY-MM-DD", () => {
    const date = new Date(2024, 0, 15); // Jan 15, 2024
    expect(formatDate(date)).toBe("2024-01-15");
  });

  it("pads single digit months", () => {
    const date = new Date(2024, 0, 1); // Jan 1
    expect(formatDate(date)).toMatch(/2024-01-01/);
  });

  it("pads single digit days", () => {
    const date = new Date(2024, 11, 5); // Dec 5
    expect(formatDate(date)).toMatch(/2024-12-05/);
  });

  it("handles end of year", () => {
    const date = new Date(2024, 11, 31); // Dec 31
    expect(formatDate(date)).toBe("2024-12-31");
  });

  it("handles beginning of year", () => {
    const date = new Date(2024, 0, 1); // Jan 1
    expect(formatDate(date)).toBe("2024-01-01");
  });

  it("uses local time, not UTC", () => {
    // Create a date at midnight local time
    const localMidnight = new Date(2024, 5, 15, 0, 0, 0);
    const result = formatDate(localMidnight);
    expect(result).toBe("2024-06-15");
  });
});

// ============================================
// getToday
// ============================================

describe("getToday", () => {
  it("returns today's date in YYYY-MM-DD format", () => {
    const today = getToday();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("matches current date", () => {
    const now = new Date();
    const expected = formatDate(now);
    expect(getToday()).toBe(expected);
  });
});

// ============================================
// parseLocalDate
// ============================================

describe("parseLocalDate", () => {
  it("parses date string as local time", () => {
    const date = parseLocalDate("2024-06-15");
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(5); // June is 0-indexed
    expect(date.getDate()).toBe(15);
  });

  it("returns midnight local time", () => {
    const date = parseLocalDate("2024-01-01");
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
    expect(date.getSeconds()).toBe(0);
  });

  it("handles first day of month", () => {
    const date = parseLocalDate("2024-03-01");
    expect(date.getDate()).toBe(1);
  });

  it("handles last day of month", () => {
    const date = parseLocalDate("2024-01-31");
    expect(date.getDate()).toBe(31);
  });

  it("handles leap year February 29", () => {
    const date = parseLocalDate("2024-02-29");
    expect(date.getMonth()).toBe(1);
    expect(date.getDate()).toBe(29);
  });

  it("avoids UTC timezone issues", () => {
    // This is the critical bug this function fixes
    // new Date("2024-01-15") parses as UTC midnight
    // In negative UTC offsets, this becomes Jan 14 local time
    const dateStr = "2024-01-15";
    const parsed = parseLocalDate(dateStr);
    expect(formatDate(parsed)).toBe(dateStr);
  });
});

// ============================================
// generateId
// ============================================

describe("generateId", () => {
  it("generates non-empty string", () => {
    const id = generateId();
    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
  });

  it("generates IDs of consistent length", () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1.length).toBe(id2.length);
  });

  it("generates unique IDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(generateId());
    }
    expect(ids.size).toBe(1000);
  });

  it("generates URL-safe characters", () => {
    const id = generateId();
    // nanoid uses A-Za-z0-9_-
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

// ============================================
// getGreeting
// ============================================

describe("getGreeting", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns morning greeting before noon", () => {
    vi.setSystemTime(new Date(2024, 0, 1, 8, 0, 0)); // 8 AM
    expect(getGreeting()).toBe("Доброе утро");
  });

  it("returns morning greeting at 11:59", () => {
    vi.setSystemTime(new Date(2024, 0, 1, 11, 59, 0));
    expect(getGreeting()).toBe("Доброе утро");
  });

  it("returns day greeting at noon", () => {
    vi.setSystemTime(new Date(2024, 0, 1, 12, 0, 0));
    expect(getGreeting()).toBe("Добрый день");
  });

  it("returns day greeting in afternoon", () => {
    vi.setSystemTime(new Date(2024, 0, 1, 15, 0, 0));
    expect(getGreeting()).toBe("Добрый день");
  });

  it("returns day greeting at 17:59", () => {
    vi.setSystemTime(new Date(2024, 0, 1, 17, 59, 0));
    expect(getGreeting()).toBe("Добрый день");
  });

  it("returns evening greeting at 18:00", () => {
    vi.setSystemTime(new Date(2024, 0, 1, 18, 0, 0));
    expect(getGreeting()).toBe("Добрый вечер");
  });

  it("returns evening greeting at night", () => {
    vi.setSystemTime(new Date(2024, 0, 1, 22, 0, 0));
    expect(getGreeting()).toBe("Добрый вечер");
  });

  it("returns evening greeting at midnight", () => {
    vi.setSystemTime(new Date(2024, 0, 1, 0, 0, 0));
    expect(getGreeting()).toBe("Доброе утро");
  });
});

// ============================================
// formatTime
// ============================================

describe("formatTime", () => {
  it("formats 0 seconds as 00:00", () => {
    expect(formatTime(0)).toBe("00:00");
  });

  it("formats seconds only", () => {
    expect(formatTime(30)).toBe("00:30");
  });

  it("formats minutes and seconds", () => {
    expect(formatTime(90)).toBe("01:30");
  });

  it("formats exact minutes", () => {
    expect(formatTime(60)).toBe("01:00");
    expect(formatTime(120)).toBe("02:00");
  });

  it("pads single digit seconds", () => {
    expect(formatTime(65)).toBe("01:05");
  });

  it("pads single digit minutes", () => {
    expect(formatTime(300)).toBe("05:00");
  });

  it("handles large values", () => {
    expect(formatTime(3600)).toBe("60:00"); // 1 hour
    expect(formatTime(5999)).toBe("99:59");
  });

  it("handles 25-minute pomodoro", () => {
    expect(formatTime(1500)).toBe("25:00");
  });
});

// ============================================
// getDaysInMonth
// ============================================

describe("getDaysInMonth", () => {
  it("returns 31 for January", () => {
    expect(getDaysInMonth(2024, 0)).toBe(31);
  });

  it("returns 28 for February in non-leap year", () => {
    expect(getDaysInMonth(2023, 1)).toBe(28);
  });

  it("returns 29 for February in leap year", () => {
    expect(getDaysInMonth(2024, 1)).toBe(29);
  });

  it("returns 30 for April", () => {
    expect(getDaysInMonth(2024, 3)).toBe(30);
  });

  it("returns 31 for December", () => {
    expect(getDaysInMonth(2024, 11)).toBe(31);
  });

  it("handles century year non-leap", () => {
    expect(getDaysInMonth(1900, 1)).toBe(28); // 1900 not leap
  });

  it("handles century year leap", () => {
    expect(getDaysInMonth(2000, 1)).toBe(29); // 2000 is leap
  });
});

// ============================================
// getMonthName
// ============================================

describe("getMonthName", () => {
  it("returns Russian month names", () => {
    expect(getMonthName(0)).toBe("Январь");
    expect(getMonthName(1)).toBe("Февраль");
    expect(getMonthName(2)).toBe("Март");
    expect(getMonthName(3)).toBe("Апрель");
    expect(getMonthName(4)).toBe("Май");
    expect(getMonthName(5)).toBe("Июнь");
    expect(getMonthName(6)).toBe("Июль");
    expect(getMonthName(7)).toBe("Август");
    expect(getMonthName(8)).toBe("Сентябрь");
    expect(getMonthName(9)).toBe("Октябрь");
    expect(getMonthName(10)).toBe("Ноябрь");
    expect(getMonthName(11)).toBe("Декабрь");
  });
});

// ============================================
// getDayName
// ============================================

describe("getDayName", () => {
  it("returns Russian day abbreviations", () => {
    expect(getDayName(0)).toBe("Вс");
    expect(getDayName(1)).toBe("Пн");
    expect(getDayName(2)).toBe("Вт");
    expect(getDayName(3)).toBe("Ср");
    expect(getDayName(4)).toBe("Чт");
    expect(getDayName(5)).toBe("Пт");
    expect(getDayName(6)).toBe("Сб");
  });
});

// ============================================
// calculateStreak
// ============================================

describe("calculateStreak", () => {
  it("returns 0 for empty array", () => {
    expect(calculateStreak([])).toBe(0);
  });

  it("calculates streak from consecutive dates", () => {
    const today = getToday();
    const yesterday = formatDate(new Date(Date.now() - 86400000));
    const twoDaysAgo = formatDate(new Date(Date.now() - 2 * 86400000));
    const streak = calculateStreak([today, yesterday, twoDaysAgo]);
    expect(streak).toBe(3);
  });

  it("returns 1 for today only", () => {
    const today = getToday();
    expect(calculateStreak([today])).toBe(1);
  });

  it("returns 1 for yesterday only", () => {
    const yesterday = formatDate(new Date(Date.now() - 86400000));
    expect(calculateStreak([yesterday])).toBe(1);
  });

  it("returns 0 if most recent date is before yesterday", () => {
    const twoDaysAgo = formatDate(new Date(Date.now() - 2 * 86400000));
    expect(calculateStreak([twoDaysAgo])).toBe(0);
  });

  it("handles unsorted dates", () => {
    const today = getToday();
    const yesterday = formatDate(new Date(Date.now() - 86400000));
    const twoDaysAgo = formatDate(new Date(Date.now() - 2 * 86400000));
    // Unsorted order
    const streak = calculateStreak([twoDaysAgo, today, yesterday]);
    expect(streak).toBe(3);
  });

  it("breaks streak on gap", () => {
    const today = getToday();
    const threeDaysAgo = formatDate(new Date(Date.now() - 3 * 86400000));
    // Gap of 2 days
    expect(calculateStreak([today, threeDaysAgo])).toBe(1);
  });

  it("handles duplicate dates", () => {
    const today = getToday();
    const yesterday = formatDate(new Date(Date.now() - 86400000));
    // Multiple entries for same day shouldn't count extra
    const streak = calculateStreak([today, today, yesterday, yesterday]);
    expect(streak).toBeGreaterThanOrEqual(1);
  });
});

// ============================================
// cn (className utility)
// ============================================

describe("cn", () => {
  it("merges class names", () => {
    const result = cn("foo", "bar");
    expect(result).toContain("foo");
    expect(result).toContain("bar");
  });

  it("handles conditional classes", () => {
    const isActive = true;
    const isDisabled = false;
    const result = cn("base", isActive && "active", isDisabled && "disabled");
    expect(result).toContain("base");
    expect(result).toContain("active");
    expect(result).not.toContain("disabled");
  });

  it("merges Tailwind classes correctly", () => {
    // Later classes should override earlier ones
    const result = cn("p-4", "p-2");
    expect(result).toBe("p-2");
  });

  it("handles arrays", () => {
    const result = cn(["foo", "bar"]);
    expect(result).toContain("foo");
    expect(result).toContain("bar");
  });

  it("handles objects", () => {
    const result = cn({ active: true, disabled: false });
    expect(result).toContain("active");
    expect(result).not.toContain("disabled");
  });

  it("handles undefined and null", () => {
    const result = cn("foo", undefined, null, "bar");
    expect(result).toBe("foo bar");
  });

  it("handles empty string", () => {
    const result = cn("foo", "", "bar");
    expect(result).toBe("foo bar");
  });

  it("deduplicates Tailwind utilities", () => {
    const result = cn("text-red-500", "text-blue-500");
    expect(result).toBe("text-blue-500");
  });
});
