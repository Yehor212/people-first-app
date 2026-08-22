import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (name: string) =>
  readFileSync(`src/components/habit-hub/${name}.tsx`, "utf8");

const sources = {
  bar: read("HabitBarCard"),
  detail: read("HabitDetailSheet"),
  heatmap: read("HabitHeatmapGrid"),
  notes: read("HabitNotesSection"),
  score: read("HabitScoreChart"),
  stats: read("HabitStatsSection"),
  streaks: read("HabitStreakTimeline"),
  target: read("HabitTargetCard"),
  cell: read("MiniCheckmarkCell"),
  week: read("MiniWeekRow"),
};

describe("habit detail typography and reflow contract", () => {
  it("keeps meaningful labels on ZenFlow's scalable typography tokens", () => {
    for (const source of Object.values(sources)) {
      expect(source).not.toMatch(/text-\[[0-9.]+px\]/);
    }
  });

  it("uses the shared scalable SVG chart font token", () => {
    for (const source of [sources.bar, sources.score]) {
      expect(source).toContain("useChartFontSizes");
      expect(source).toContain("chartFonts.axis");
      expect(source).not.toMatch(/fontSize=\{\d+\}/);
    }
  });

  it("stacks competing chart headers and keeps their controls readable", () => {
    for (const source of [sources.bar, sources.score]) {
      expect(source).toContain("flex-col items-stretch gap-2 min-[420px]:flex-row");
      expect(source).toContain("whitespace-normal break-words");
    }
    expect(sources.bar).toContain("grid grid-cols-2 gap-1");
    expect(sources.score).toContain("grid grid-cols-2 gap-1 min-[420px]:grid-cols-4");
  });

  it("gives localized detail tabs, metrics, titles, and notes room to reflow", () => {
    expect(sources.detail).not.toContain('SheetTitle className="truncate');
    expect(sources.detail).toContain("grid grid-cols-2 gap-1 min-[520px]:grid-cols-4");
    expect(sources.detail).toContain(
      "grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 min-[720px]:grid-cols-3",
    );
    expect(sources.notes).toContain("flex flex-col items-stretch gap-2 min-[420px]:flex-row");
    expect(sources.stats).toContain("grid grid-cols-1 gap-2 min-[420px]:grid-cols-2");
    expect(sources.stats).not.toContain("truncate");
  });

  it("keeps bounded visualizations and weekly controls on intentional one-axis scrollers", () => {
    expect(sources.heatmap).toContain("overflow-x-auto");
    expect(sources.heatmap).toContain("flex flex-wrap items-center");
    expect(sources.target).toContain("grid grid-cols-1 gap-3 min-[480px]:grid-cols-3");
    expect(sources.week).toContain("overflow-x-auto overscroll-x-contain");
    expect(sources.week).toContain(
      'gridTemplateColumns: "repeat(7, minmax(calc(44px * var(--font-scale, 1)), 1fr))"',
    );
    expect(sources.cell).toContain("min-h-8 min-w-8");
    expect(sources.streaks).toContain("cn('@container', className)");
    expect(sources.streaks).toContain("grid grid-cols-1 gap-2 @sm:grid-cols-2");
    expect(sources.streaks).toContain(
      "grid-cols-[minmax(1.5rem,auto)_1.25rem_minmax(0,1fr)]",
    );
    expect(sources.streaks).toContain("@sm:col-start-3 @sm:row-start-1");
    expect(sources.streaks).toContain("dateTime={streak.start}");
    expect(sources.streaks).toContain('dir="auto"');
    expect(sources.streaks).toContain("[unicode-bidi:isolate]");
  });
});
