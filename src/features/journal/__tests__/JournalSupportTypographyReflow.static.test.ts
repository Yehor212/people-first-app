import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (name: string) =>
  readFileSync(`src/features/journal/${name}.tsx`, "utf8");

const sources = {
  save: read("SaveIndicator"),
  shortcuts: read("KeyboardShortcutsOverlay"),
  suggestion: read("DiaryEntrySuggestionCard"),
  stickers: read("JournalStickerPicker"),
  stickerPacks: read("JournalStickerPackManager"),
  onThisDay: read("OnThisDayCard"),
  calendar: read("JournalCalendar"),
  year: read("YearInPixels"),
  breathe: read("DiaryBreatheWidget"),
  format: read("DiaryFormatToolbar"),
  stats: read("JournalStats"),
  audio: read("JournalAudioPlayer"),
  habits: read("JournalHabitSection"),
  calendarFull: read("JournalCalendarFull"),
};

describe("journal support typography and reflow contract", () => {
  it("keeps every meaningful support label on scalable typography tokens", () => {
    for (const source of Object.values(sources)) {
      expect(source).not.toMatch(/text-\[[0-9.]+px\]/);
    }
  });

  it("lets status and shortcut rows wrap without competing with fixed controls", () => {
    expect(sources.save).toContain("flex-wrap");
    expect(sources.shortcuts).toContain(
      "grid grid-cols-1 gap-2 min-[420px]:grid-cols-[minmax(0,1fr)_auto]",
    );
    expect(sources.shortcuts).toContain("whitespace-normal break-words");
  });

  it("keeps sticker and memory names readable instead of truncating actions", () => {
    expect(sources.stickers).not.toContain("truncate");
    expect(sources.stickers).toContain("whitespace-normal break-words");
    expect(sources.stickers).toContain(
      "grid-cols-[repeat(auto-fit,minmax(calc(3rem*var(--font-scale,1)),1fr))]",
    );
    expect(sources.stickerPacks).not.toContain("truncate");
    expect(sources.stickerPacks).toContain("flex flex-wrap items-center");
    expect(sources.onThisDay).not.toContain('"text-sm font-medium text-foreground truncate"');
    expect(sources.onThisDay).toContain("whitespace-normal break-words");
  });

  it("keeps calendar headers separate from fixed controls and scales bounded grids", () => {
    for (const source of [sources.calendar, sources.calendarFull]) {
      expect(source).toContain("grid-cols-[48px_minmax(0,1fr)_48px]");
      expect(source).toContain("col-span-3 row-start-2");
    }
    expect(sources.calendar).toContain("calc(3rem*var(--font-scale,1))");
    expect(sources.calendarFull).toContain("overflow-x-auto overscroll-x-contain");
    expect(sources.calendarFull).toContain(
      "grid-cols-[repeat(7,minmax(calc(44px*var(--font-scale,1)),1fr))]",
    );
  });

  it("uses intentional one-axis scrolling for year mosaics and reflows their legends", () => {
    expect(sources.year).toContain("calc(2.5rem*var(--font-scale,1))");
    expect(sources.stats).toContain("min-w-[calc(36rem*var(--font-scale,1))]");
    expect(sources.stats).toContain("flex flex-col items-stretch gap-2 min-[420px]:flex-row");
    expect(sources.breathe).toContain("calc(4.375rem*var(--font-scale,1))");
  });
});
