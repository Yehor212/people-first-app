import { readFileSync } from "node:fs";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useJournalToday } from "../useJournalToday";

describe("Journal local-day rollover", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 31, 23, 59, 59, 500));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("updates the civil date after local midnight without remounting", () => {
    const { result } = renderHook(() => useJournalToday());

    expect(result.current).toBe("2026-07-31");

    act(() => {
      vi.advanceTimersByTime(1_500);
    });

    expect(result.current).toBe("2026-08-01");
  });

  it("refreshes immediately when a suspended app returns on a later day", () => {
    const { result } = renderHook(() => useJournalToday());

    act(() => {
      vi.setSystemTime(new Date(2026, 7, 2, 9, 0, 0));
      window.dispatchEvent(new Event("focus"));
    });

    expect(result.current).toBe("2026-08-02");
  });

  it("wires the same lifecycle-aware date through every current-day Journal consumer", () => {
    const moduleSource = readFileSync("src/features/journal/JournalModule.tsx", "utf8");
    const stripCalendarSource = readFileSync("src/features/journal/JournalCalendar.tsx", "utf8");
    const fullCalendarSource = readFileSync("src/features/journal/JournalCalendarFull.tsx", "utf8");
    const entryListSource = readFileSync("src/features/journal/JournalEntryList.tsx", "utf8");
    const statsSource = readFileSync("src/features/journal/JournalStats.tsx", "utf8");

    expect(moduleSource).toContain("const today = useJournalToday();");
    expect(moduleSource).toContain("useStreakFreeze(streak, lastEntryDate, today)");
    expect(moduleSource).toContain("getDaysSinceLastEntry(journal.entryDates, today)");
    expect(moduleSource.match(/today=\{today\}/g)).toHaveLength(10);
    expect(moduleSource).not.toContain("getToday()");
    expect(stripCalendarSource).toContain("today: string;");
    expect(stripCalendarSource).not.toContain("const today = getToday()");
    expect(fullCalendarSource).toContain("today: string;");
    expect(fullCalendarSource).not.toContain("const today = getToday()");
    expect(entryListSource).toContain("today?: string;");
    expect(entryListSource).toContain(
      'getJournalQuote(ts, parseLocalDate(currentDay), { scope: "all" })',
    );
    expect(entryListSource).toContain("[groupedEntries, currentDay]");
    expect(entryListSource).not.toContain("getToday()");
    expect(statsSource).toContain("today?: string;");
    expect(statsSource).toContain("const todayStr = currentDay;");
    expect(statsSource).not.toContain("const today = new Date()");
    expect(statsSource).not.toContain("const currentYear = new Date().getFullYear()");
  });
});
