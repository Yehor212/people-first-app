import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const TARGET_FILES = [
  "src/components/stats/mood-weather/MoodWeather.tsx",
  "src/components/stats/HabitCalendar.tsx",
  "src/components/stats/DayDetailPanel.tsx",
  "src/components/stats/ring-detail-sheet/RingDetailSheet.tsx",
  "src/components/stats/ring-detail-sheet/PremiumChart.tsx",
  "src/components/stats/CalendarGrid.tsx",
  "src/components/stats/weekly-review/WeeklyReviewParts.tsx",
  "src/components/stats/weekly-review/WeeklyReview.tsx",
  "src/components/stats/OverviewTab.tsx",
  "src/components/stats/WeekCrystal.tsx",
  "src/components/habit-tracker/HabitTracker.tsx",
] as const;

function source(path: (typeof TARGET_FILES)[number]) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("statistics text reflow contract", () => {
  it.each(TARGET_FILES)("does not pin visible copy to 6px or 10px in %s", (path) => {
    expect(source(path)).not.toMatch(/text-\[(?:6|10)px\]/);
  });

  it("keeps weather messages and overview labels complete", () => {
    const weather = source("src/components/stats/mood-weather/MoodWeather.tsx");
    const overview = source("src/components/stats/OverviewTab.tsx");

    expect(weather).not.toContain("line-clamp-");
    expect(weather).toContain("min-h-[calc(8.75rem*var(--font-scale,1))]");
    expect(overview).not.toContain("truncate");
    expect(overview).toContain("grid-cols-1 min-[420px]:grid-cols-3");
    expect(overview).toContain("[overflow-wrap:anywhere]");
  });

  it("bounds seven-column calendars while preserving 44px day targets", () => {
    const calendar = source("src/components/stats/CalendarGrid.tsx");
    const habits = source("src/components/stats/HabitCalendar.tsx");

    for (const file of [calendar, habits]) {
      expect(file).toContain("overflow-x-auto");
      expect(file).toContain("min-w-[23rem]");
      expect(file).toContain("min-h-11 min-w-11");
    }
  });

  it("keeps the ring sheet inside the safe viewport with scrollable dense charts", () => {
    const sheet = source("src/components/stats/ring-detail-sheet/RingDetailSheet.tsx");
    const chart = source("src/components/stats/ring-detail-sheet/PremiumChart.tsx");

    expect(sheet).toContain("flex max-h-[90dvh] flex-col");
    expect(sheet).toContain("min-h-0 flex-1 overflow-y-auto");
    expect(sheet).toContain("overflow-x-auto overscroll-x-contain");
    expect(sheet).toContain("grid-cols-1 min-[420px]:grid-cols-3");
    expect(chart).toContain("min-w-[24rem]");
    expect(chart).toContain('className="text-xs font-medium fill-muted-foreground"');
  });

  it("lets weekly summaries and finite daily values reflow without hidden scrolling", () => {
    const review = source("src/components/stats/weekly-review/WeeklyReview.tsx");
    const crystal = source("src/components/stats/WeekCrystal.tsx");

    expect(review.match(/grid-cols-1 min-\[420px\]:grid-cols-3/g)).toHaveLength(2);
    expect(review).toContain("min-h-11");
    expect(crystal).toContain("grid-cols-[repeat(auto-fit,minmax(2.75rem,1fr))]");
    expect(crystal).not.toContain("overflow-x-auto");
  });

  it("keeps user-authored habit names breakable without truncation", () => {
    const day = source("src/components/stats/DayDetailPanel.tsx");
    const tracker = source("src/components/habit-tracker/HabitTracker.tsx");

    expect(day).toContain("[overflow-wrap:anywhere]");
    expect(tracker).toContain("[overflow-wrap:anywhere]");
    expect(tracker).not.toContain("text-[10px]");
  });
});
