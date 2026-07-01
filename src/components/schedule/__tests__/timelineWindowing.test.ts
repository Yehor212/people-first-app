import { describe, expect, it } from "vitest";

import { getTimelineRenderWindow } from "../timelineWindowing";

const dates = Array.from({ length: 61 }, (_, index) => `2026-07-${String(index + 1).padStart(2, "0")}`);

describe("timeline windowing", () => {
  it("keeps the initial timeline DOM bounded around the selected date", () => {
    const windowedDates = getTimelineRenderWindow(dates, dates[30]);

    expect(windowedDates).toHaveLength(5);
    expect(windowedDates.map((item) => item.date)).toEqual(dates.slice(28, 33));
  });

  it("preserves original indices so absolute timeline offsets do not shift", () => {
    const windowedDates = getTimelineRenderWindow(dates, dates[30]);

    expect(windowedDates.map((item) => item.index)).toEqual([28, 29, 30, 31, 32]);
  });

  it("clamps the render window at the timeline edges", () => {
    expect(getTimelineRenderWindow(dates, dates[0]).map((item) => item.index)).toEqual([0, 1, 2]);
    expect(getTimelineRenderWindow(dates, dates[60]).map((item) => item.index)).toEqual([58, 59, 60]);
  });
});
