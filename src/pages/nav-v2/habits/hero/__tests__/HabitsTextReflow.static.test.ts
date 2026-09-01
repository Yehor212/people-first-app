import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (name: string) =>
  readFileSync(`src/pages/nav-v2/habits/hero/${name}.tsx`, "utf8");

const dailyRingSource = read("HeroDailyRing");
const habitRowSource = read("HeroHabitRow");
const insightStripSource = read("HeroInsightStrip");
const weeklyCardSource = read("HeroWeeklyHabitCard");
const actionSheetSource = read("HabitActionSheet");
const heroChainSources = [
  actionSheetSource,
  habitRowSource,
  read("HeroTimeOfDayGroup"),
  readFileSync("src/pages/nav-v2/habits/HabitsHeroZone.tsx", "utf8"),
];
const habitDetailSheetSource = readFileSync(
  "src/components/habit-hub/HabitDetailSheet.tsx",
  "utf8",
);

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

  it("aligns localized action labels to the logical inline start", () => {
    expect(actionSheetSource).toContain("text-start");
    expect(actionSheetSource).not.toContain("text-left");
  });

  it("keeps hero actions non-destructive while details retain explicit delete confirmation", () => {
    for (const source of heroChainSources) {
      expect(source).not.toMatch(/\bonDelete(?:Habit)?\b/);
    }

    expect(habitDetailSheetSource).toContain(
      "const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);",
    );
    expect(habitDetailSheetSource).toContain("setShowDeleteConfirm(true);");
    expect(habitDetailSheetSource).toContain("onClick={closeDeleteConfirm}");
    expect(habitDetailSheetSource).toContain("onClick={handleDelete}");
    expect(habitDetailSheetSource).toContain("onDelete(habit.id);");
  });
});
