import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (name: string) =>
  readFileSync(`src/pages/nav-v2/habits/hero/${name}.tsx`, "utf8");

const dailyRingSource = read("HeroDailyRing");
const habitRowSource = read("HeroHabitRow");
const insightStripSource = read("HeroInsightStrip");
const weeklyCardSource = read("HeroWeeklyHabitCard");

describe("habits hero text reflow contract", () => {
  it("keeps all meaningful labels on the scalable typography tokens", () => {
    for (const source of [dailyRingSource, habitRowSource, insightStripSource, weeklyCardSource]) {
      expect(source).not.toMatch(/text-\[[0-9.]+(?:px|rem)\]/);
    }
  });

  it("does not hide habit names, plans, identity cues, or weekly summaries", () => {
    expect(weeklyCardSource).not.toContain("truncate");
    expect(weeklyCardSource).toContain("whitespace-normal break-words");
    expect(weeklyCardSource).toContain(
      "grid-cols-[44px_minmax(0,1fr)] min-[420px]:grid-cols-[44px_minmax(0,1fr)_auto]",
    );
    expect(weeklyCardSource).toContain("flex-col items-start min-[420px]:flex-row");
  });

  it("lets insight and cue actions grow vertically with translated text", () => {
    expect(insightStripSource).toContain("whitespace-normal break-words");
    expect(habitRowSource).toContain("whitespace-normal break-words");
  });
});
