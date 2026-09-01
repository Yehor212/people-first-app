import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(`src/components/${path}.tsx`, "utf8");

const sources = {
  hyperfocus: read("hyperfocus/HyperfocusSoundSelector"),
  ritual: read("reflection/DailyRitualCard"),
  addEvent: read("schedule/AddEventModal"),
  calendar: read("stats/CalendarTab"),
  zenScore: read("stats/ZenScoreHub"),
  weeklyInsights: read("weekly-insights-card/WeeklyInsightsCard"),
};

describe("localized choice-grid text reflow contract", () => {
  it("reflows ambient sound and intensity labels before three columns become readable", () => {
    expect(sources.hyperfocus).toContain(
      "grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-7"
    );
    expect(sources.hyperfocus).toContain("mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-3");
    expect(sources.hyperfocus).toContain(
      '<span className="break-words text-center">{localizedName}</span>'
    );
  });

  it("reflows the five localized ritual moods and keeps the energy scale operable", () => {
    expect(sources.ritual).toContain("mt-2 grid grid-cols-1 gap-2 min-[520px]:grid-cols-5");
    expect(sources.ritual).toContain("mt-2 grid grid-cols-3 gap-2 min-[420px]:grid-cols-5");
    expect(sources.ritual).toContain("h-auto min-h-[44px] min-w-0 whitespace-normal break-words");
  });

  it("reflows schedule preset labels without changing preset selection behavior", () => {
    expect(sources.addEvent).toContain(
      'className="mb-4 grid grid-cols-2 gap-2 min-[420px]:grid-cols-3"'
    );
    expect(sources.addEvent).toContain(
      'className="break-words text-center text-xs text-muted-foreground"'
    );
    expect(sources.addEvent).not.toContain('className="grid grid-cols-3 gap-2 mb-4"');
  });

  it("reflows month presets and year statistics while preserving the seven-day calendar", () => {
    expect(sources.calendar).toContain(
      "grid grid-cols-1 gap-2 mb-5 motion-safe:animate-fade-in min-[420px]:grid-cols-2 min-[640px]:grid-cols-4"
    );
    expect(sources.calendar).toContain(
      "grid grid-cols-1 gap-2 sm:gap-3 mb-5 min-[420px]:grid-cols-2 sm:grid-cols-4"
    );
    expect(sources.calendar).toContain("h-auto min-h-11 min-w-0 whitespace-normal break-words");
    expect(sources.calendar).toContain("<CalendarGrid");
  });

  it("reflows Zen Score breakdown labels into one, two, then four columns", () => {
    expect(sources.zenScore).toContain(
      "grid grid-cols-1 gap-2 pt-4 border-t border-border/50 min-[420px]:grid-cols-2 min-[640px]:grid-cols-4"
    );
    expect(sources.zenScore).toContain(
      '<p className="break-words text-xs text-muted-foreground">{item.label}</p>'
    );
  });

  it("reflows weekly comparison and quick-stat labels at narrow widths", () => {
    expect(sources.weeklyInsights).toContain("grid grid-cols-1 gap-4 min-[520px]:grid-cols-3");
    expect(sources.weeklyInsights).toContain(
      "grid grid-cols-1 gap-2 p-3 bg-muted/30 backdrop-blur-sm rounded-xl border border-border/30 min-[420px]:grid-cols-2 min-[640px]:grid-cols-4"
    );
    expect(sources.weeklyInsights).toContain(
      'className="break-words text-xs text-muted-foreground"'
    );
  });
});
