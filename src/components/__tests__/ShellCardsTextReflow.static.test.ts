import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(`src/components/${path}.tsx`, "utf8");

const sources = {
  sync: read("SyncStatusIndicator"),
  reflection: read("reflection/ReflectionInsightShelf"),
  errorBoundary: read("ErrorBoundary"),
  v2Focus: read("navigation-v2/V2FocusMiniPlayer"),
  mobileNav: read("navigation-v2/MobileNavV2"),
  sidebar: read("navigation-v2/SidebarV2"),
  routeStatus: read("navigation-v2/NavV2RouteStatus"),
  addHabitSheet: read("habit-hub/AddHabitSheet"),
  addHabitForm: read("habit-hub/AddHabitCustomForm"),
  habitHubList: read("habit-hub/HabitHubList"),
  habitHubCard: read("habit-hub/HabitHubCard"),
  compactHabit: read("compact-habit-card/CompactHabitCard"),
  habitProgress: read("compact-habit-card/HabitProgressIndicator"),
  milestone: read("compact-habit-card/StreakMilestoneBadge"),
  commandPalette: read("desktop/CommandPalette"),
  garden: read("GardenCanvas"),
  focus: read("FocusMiniPlayer"),
};

describe("app shell and card text reflow contract", () => {
  it("keeps meaningful labels on ZenFlow's scalable typography tokens", () => {
    for (const source of Object.values(sources)) {
      expect(source).not.toMatch(/text-\[(?:9|10|11)px\]/);
    }
  });

  it("lets mobile navigation, route status, and focus labels wrap without covering controls", () => {
    expect(sources.mobileNav).toContain("grid grid-cols-5");
    expect(sources.mobileNav).toContain("whitespace-normal break-words");
    expect(sources.mobileNav).not.toContain("truncate");
    expect(sources.sidebar).toMatch(/min-w-0[^"]*whitespace-normal break-words/);
    expect(sources.sidebar).toContain("[hyphens:auto]");
    expect(sources.sidebar).not.toContain("truncate");

    for (const source of [sources.v2Focus, sources.focus]) {
      expect(source).toContain("grid-cols-[minmax(0,1fr)_auto_auto]");
      expect(source).toContain("col-span-3");
      expect(source).toContain("[overflow-wrap:anywhere]");
      expect(source).not.toContain("truncate");
    }

    expect(sources.routeStatus).toContain("var(--safe-inline-start)");
    expect(sources.routeStatus).toContain("var(--safe-inline-end)");
    expect(sources.routeStatus).toContain("whitespace-normal break-words");
    expect(sources.routeStatus).not.toContain("truncate");
  });

  it("gives translated habit controls and user-authored habit names room to reflow", () => {
    expect(sources.addHabitSheet).toContain(
      "grid grid-cols-2 gap-2 min-[420px]:grid-cols-3",
    );
    expect(sources.addHabitSheet).not.toContain("line-clamp");
    expect(sources.addHabitForm).toContain(
      "grid grid-cols-4 gap-2 min-[420px]:grid-cols-7",
    );
    expect(sources.addHabitForm).toContain(
      "grid grid-cols-1 gap-2 min-[420px]:grid-cols-2",
    );
    expect(sources.addHabitForm.match(/min-h-\[44px\]/g)).toHaveLength(13);

    expect(sources.habitHubCard).toContain(
      "grid grid-cols-[16px_32px_minmax(0,1fr)]",
    );
    expect(sources.habitHubCard).toContain("[overflow-wrap:anywhere]");
    expect(sources.habitHubCard).not.toContain("truncate");
    expect(sources.compactHabit).toContain("flex-col items-stretch gap-3");
    expect(sources.compactHabit).toContain("sm:flex-row");
    expect(sources.compactHabit).toContain("[overflow-wrap:anywhere]");
    expect(sources.compactHabit).toContain(
      "whitespace-normal break-words text-center text-xs font-bold leading-tight",
    );
    expect(sources.compactHabit).not.toContain("truncate");
    expect(sources.habitProgress).toContain("w-full");
    expect(sources.habitProgress).toContain("sm:w-auto");
  });

  it("keeps recovery, sync, reflection, command, and garden copy readable at narrow widths", () => {
    expect(sources.sync).not.toContain("line-clamp");
    expect(sources.reflection).toContain("text-start");
    expect(sources.reflection).toContain("min-h-[44px]");
    expect(sources.reflection).not.toContain("text-left");
    expect(sources.errorBoundary).toContain("overflow-y-auto");
    expect(sources.errorBoundary).toContain(
      "flex flex-col items-stretch gap-3 min-[420px]:flex-row",
    );
    expect(sources.commandPalette).toContain("var(--safe-inline-start)");
    expect(sources.commandPalette).toContain("var(--safe-inline-end)");
    expect(sources.commandPalette).toContain("whitespace-normal break-words");
    expect(sources.garden).toContain("[overflow-wrap:anywhere]");
  });
});
