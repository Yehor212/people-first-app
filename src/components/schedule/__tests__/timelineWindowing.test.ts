import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  getTimelineRenderWindow,
  getTimelineWindowPhysicalCenter,
  getTimelineWindowPosition,
} from "../timelineWindowing";

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

  it("rebases one continuous physical position without changing its global day and hour", () => {
    const dayWidth = 2_304;
    const before = getTimelineRenderWindow(dates, dates[30]);
    const position = getTimelineWindowPosition(before, 3 * dayWidth + 640, dayWidth);

    expect(position).toEqual({
      globalIndex: 31,
      localIndex: 3,
      withinDayOffset: 640,
    });
    if (!position) throw new Error("Expected a bounded timeline position");

    const after = getTimelineRenderWindow(dates, dates[31]);
    expect(
      getTimelineWindowPhysicalCenter(
        after,
        position.globalIndex,
        position.withinDayOffset,
        dayWidth,
      ),
    ).toBe(2 * dayWidth + 640);
  });

  it("bounds the real Android scroll surface to the rendered date window", () => {
    const source = readFileSync("src/components/schedule/ScheduleTimeline.tsx", "utf8");

    expect(source).toContain("timelineRenderWindow.length * DAY_WIDTH_PX");
    expect(source).toContain(
      "dayOffset={(dayIndex - timelineWindowStartIndex) * DAY_WIDTH_PX}",
    );
    expect(source).not.toContain("allDates.length * DAY_WIDTH_PX");
    expect(source).toContain("getTimelineWindowPosition");
    expect(source).toContain("getTimelineWindowPhysicalCenter");
  });

});
