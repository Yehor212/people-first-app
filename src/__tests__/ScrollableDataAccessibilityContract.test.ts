import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

const habitBar = read("src/components/habit-hub/HabitBarCard.tsx");
const habitDetail = read("src/components/habit-hub/HabitDetailSheet.tsx");
const habitScore = read("src/components/habit-hub/HabitScoreChart.tsx");
const weekCrystal = read("src/components/stats/WeekCrystal.tsx");
const ringDetail = read("src/components/stats/ring-detail-sheet/RingDetailSheet.tsx");
const journalStats = read("src/features/journal/JournalStats.tsx");
const stickerPacks = read("src/features/journal/JournalStickerPackManager.tsx");
const yearInPixels = read("src/features/journal/YearInPixels.tsx");
const scheduleTimeline = read("src/components/schedule/ScheduleTimeline.tsx");

describe("scrollable data accessibility contract", () => {
  it("makes the completions chart a named, focus-visible region with equivalent data", () => {
    expect(habitBar).toContain("id={completionsHeadingId}");
    expect(habitBar).toContain('role="region"');
    expect(habitBar).toContain("aria-labelledby={completionsHeadingId}");
    expect(habitBar).toContain("aria-describedby={completionsSummaryId}");
    expect(habitBar).toContain("tabIndex={0}");
    expect(habitBar).toContain("focus-visible:ring-2");
    expect(habitBar).toContain("id={completionsSummaryId}");
    expect(habitBar).toContain('className="sr-only"');
    expect(habitBar).toContain('aria-hidden="true"');
  });

  it("reflows recent habit check-ins instead of hiding them in an unfocusable scroller", () => {
    const recentCheckIns =
      /habitStatsRecentProof[\s\S]*?<HabitHeatmapGrid/.exec(habitDetail)?.[0] ?? "";

    expect(recentCheckIns).toContain("grid-cols-[repeat(auto-fit,minmax(3rem,1fr))]");
    expect(recentCheckIns).not.toContain("overflow-x-auto");
  });

  it("makes the habit score chart a named, focus-visible region with equivalent data", () => {
    expect(habitScore).toContain("id={scoreHistoryHeadingId}");
    expect(habitScore).toContain('role="region"');
    expect(habitScore).toContain("aria-labelledby={scoreHistoryHeadingId}");
    expect(habitScore).toContain("aria-describedby={scoreHistorySummaryId}");
    expect(habitScore).toContain("tabIndex={0}");
    expect(habitScore).toContain("focus-visible:ring-2");
    expect(habitScore).toContain("id={scoreHistorySummaryId}");
    expect(habitScore).toContain('aria-hidden="true"');
  });

  it("reflows Week Crystal daily values without an extra scroll focus target", () => {
    const dailyCrystals =
      /\{\/\* Daily crystals \*\/[\s\S]*?<\/motion\.div>/.exec(weekCrystal)?.[0] ?? "";

    expect(dailyCrystals).toContain("grid-cols-[repeat(auto-fit,minmax(2.75rem,1fr))]");
    expect(dailyCrystals).not.toContain("overflow-x-auto");
  });

  it("makes the weekly trend chart a named, focus-visible region with equivalent data", () => {
    expect(ringDetail).toContain("id={weeklyTrendHeadingId}");
    expect(ringDetail).toContain("aria-labelledby={weeklyTrendHeadingId}");
    expect(ringDetail).toContain("aria-describedby={weeklyTrendSummaryId}");
    expect(ringDetail).toContain("id={weeklyTrendSummaryId}");
    expect(ringDetail).toContain("focus-visible:ring-2");
  });

  it("reflows the ring daily breakdown instead of creating a second scroller", () => {
    const dailyBreakdown =
      /dailyBreakdown[\s\S]*?\{\/\* Recommendation Card \*\//.exec(ringDetail)?.[0] ?? "";

    expect(dailyBreakdown).toContain("grid-cols-[repeat(auto-fit,minmax(2.75rem,1fr))]");
    expect(dailyBreakdown).not.toContain("overflow-x-auto");
  });

  it("exposes JournalStats year pixels through one named focus owner and non-hover data", () => {
    const inlinePixels =
      /\{\/\* Pixel grid[\s\S]*?\{\/\* Legend \*\//.exec(journalStats)?.[0] ?? "";

    expect(inlinePixels).toContain("aria-labelledby={pixelGridHeadingId}");
    expect(inlinePixels).toContain("aria-describedby={pixelGridSummaryId}");
    expect(inlinePixels).toContain("tabIndex={0}");
    expect(inlinePixels).toContain('role="region"');
    expect(inlinePixels).toContain("id={pixelGridSummaryId}");
    expect(inlinePixels).toContain('aria-hidden="true"');
    expect(inlinePixels).not.toContain("title=");
  });

  it("wraps the finite sticker preview without horizontal scrolling", () => {
    const preview = /\{\/\* Preview row \*\/[\s\S]*?<\/motion\.div>/.exec(stickerPacks)?.[0] ?? "";

    expect(preview).toContain("flex flex-wrap");
    expect(preview).not.toContain("overflow-x-auto");
  });

  it("makes standalone Year in Pixels a localized, focus-visible region without hover-only titles", () => {
    expect(yearInPixels).toContain("aria-labelledby={labelledById ?? internalHeadingId}");
    expect(yearInPixels).toContain("aria-describedby={summaryId}");
    expect(yearInPixels).toContain("tabIndex={0}");
    expect(yearInPixels).toContain('role="region"');
    expect(yearInPixels).toContain("focus-visible:ring-2");
    expect(yearInPixels).toContain("id={summaryId}");
    expect(yearInPixels).not.toContain("title=");
  });

  it("keeps the empty schedule timeline reachable and named for keyboard scrolling", () => {
    const timelineScroller =
      /ref=\{timelineRef\}[\s\S]*?<div\n\s+className="relative h-28"/.exec(scheduleTimeline)?.[0] ?? "";

    expect(timelineScroller).toContain('role="region"');
    expect(timelineScroller).toContain('aria-label={t.scheduleTitle || "Your Schedule"}');
    expect(timelineScroller).toContain("tabIndex={0}");
    expect(timelineScroller).toContain("focus-visible:ring-2");
  });
});
