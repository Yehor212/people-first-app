import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(`src/components/${path}.tsx`, "utf8");

const sources = {
  settingToggle: read("SettingToggle"),
  featureToggle: read("FeatureToggleItem"),
  sectionHeader: read("ui/section-header"),
  segmentedControl: read("ui/segmented-control"),
  trends: read("stats/TrendsTab"),
  calendar: read("animated-stats/AnimatedCalendar"),
};

describe("settings and statistics text reflow contract", () => {
  it("keeps toggle titles and descriptions readable without competing with switches", () => {
    for (const source of [sources.settingToggle, sources.featureToggle]) {
      expect(source).toContain(
        "flex min-w-0 flex-col items-stretch gap-3 min-[420px]:flex-row min-[420px]:items-start",
      );
      expect(source).toContain("whitespace-normal break-words");
      expect(source).not.toContain("truncate");
      expect(source).not.toContain("line-clamp");
    }
  });

  it("lets section titles, subtitles, and actions occupy distinct responsive grid tracks", () => {
    expect(sources.sectionHeader).toContain(
      "grid grid-cols-[auto_minmax(0,1fr)] items-start min-[420px]:grid-cols-[auto_minmax(0,1fr)_auto]",
    );
    expect(sources.sectionHeader).toContain("whitespace-normal break-words");
    expect(sources.sectionHeader).toContain(
      "col-span-2 min-w-0 min-[420px]:col-span-1",
    );
    expect(sources.sectionHeader).not.toContain("truncate");
  });

  it("preserves every segmented label and a 44 pixel target at narrow widths", () => {
    expect(sources.segmentedControl).toContain(
      "inline-grid grid-cols-1 items-stretch",
    );
    expect(sources.segmentedControl).toContain(
      "min-[420px]:grid-flow-col min-[420px]:auto-cols-fr",
    );
    expect(sources.segmentedControl.match(/min-h-\[44px\]/g)).toHaveLength(3);
    expect(sources.segmentedControl).toContain(
      "min-w-0 whitespace-normal break-words text-center",
    );
    expect(sources.segmentedControl).not.toContain("truncate");
  });

  it("stacks trends labels before translated copy can collide", () => {
    expect(sources.trends).toContain("fullWidth");
    expect(sources.trends).toContain(
      "grid grid-cols-1 gap-2 min-[420px]:grid-cols-3",
    );
    expect(sources.trends).toContain(
      "grid grid-cols-1 gap-3 min-[640px]:grid-cols-2",
    );
    expect(sources.trends).toContain("whitespace-normal break-words");
    expect(sources.trends).not.toContain("truncate");
  });

  it("keeps calendar controls, summaries, and detail labels readable", () => {
    expect(sources.calendar).toContain(
      "grid w-full grid-cols-[44px_minmax(0,1fr)_44px]",
    );
    expect(sources.calendar).toContain(
      "grid grid-cols-2 gap-2 min-[420px]:grid-cols-4",
    );
    expect(sources.calendar).toContain(
      "grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 min-[720px]:grid-cols-4",
    );
    expect(sources.calendar).toContain(
      "grid grid-cols-1 gap-3 text-sm min-[520px]:grid-cols-2",
    );
    expect(sources.calendar).toContain("whitespace-normal break-words");
    expect(sources.calendar).not.toContain("line-clamp");
  });

  it("isolates the calendar's two-dimensional grid from page-level overflow", () => {
    expect(sources.calendar).toContain(
      "overflow-x-auto overscroll-x-contain",
    );
    expect(sources.calendar).toContain("min-w-[23rem]");
  });
});
