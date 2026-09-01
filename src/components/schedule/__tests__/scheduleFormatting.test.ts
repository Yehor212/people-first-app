import { describe, expect, it } from "vitest";

import {
  formatScheduleDayNumber,
  formatScheduleNumericPart,
  formatScheduleTime,
} from "../scheduleFormatting";

describe("schedule locale formatting", () => {
  it("uses the active locale for day numbers, time, and numeric input options", () => {
    const language = "ar";

    expect(formatScheduleDayNumber("2026-07-15", language)).toBe(
      new Intl.NumberFormat(language, { useGrouping: false }).format(15)
    );
    expect(formatScheduleTime(language, 13, 5)).toBe(
      new Intl.DateTimeFormat(language, {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(2000, 0, 1, 13, 5))
    );
    expect(formatScheduleNumericPart(language, 5)).toBe(
      new Intl.NumberFormat(language, {
        minimumIntegerDigits: 2,
        useGrouping: false,
      }).format(5)
    );
  });
});
