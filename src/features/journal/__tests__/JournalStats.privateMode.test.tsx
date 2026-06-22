import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { JournalStats } from "../JournalStats";
import type { JournalEntry } from "../types";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "en",
    t: {
      back: "Back",
      journalPrivateEntryHint: "Unlock private mode to view this memory.",
      journalStatsTitle: "Diary Statistics",
      journalStatsTotal: "Total Entries",
      journalStatsTotalWords: "Total Words",
      journalStatsMoodDist: "Mood Distribution",
      journalStatsYearInPixels: "Year in Pixels",
      moodBad: "Bad",
      moodGood: "Good",
      privateMode: "Private",
    },
  }),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, initial, animate, transition, ...rest }: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => {
      void initial;
      void animate;
      void transition;
      return <div {...rest}>{children}</div>;
    },
    span: ({ children, initial, animate, transition, ...rest }: React.HTMLAttributes<HTMLSpanElement> & Record<string, unknown>) => {
      void initial;
      void animate;
      void transition;
      return <span {...rest}>{children}</span>;
    },
  },
}));

vi.mock("@/components/ui/AnimatedCounter", () => ({
  AnimatedCounter: ({ target, suffix = "" }: { target: number; suffix?: string }) => (
    <span>{target}{suffix}</span>
  ),
}));

vi.mock("../YearInPixels", () => ({
  YearInPixels: () => <div>Year pixels detail</div>,
}));

vi.mock("../MoodCorrelations", () => ({
  MoodCorrelations: () => <div>Mood insights detail</div>,
}));

vi.mock("../StickerRenderer", () => ({
  StickerRenderer: ({ emoji }: { emoji: string }) => <span>{emoji}</span>,
}));

class IntersectionObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);

const privateEntries: JournalEntry[] = Array.from({ length: 6 }, (_, index) => ({
  id: `private-entry-${index}`,
  date: `2026-06-${String(index + 1).padStart(2, "0")}`,
  title: `Therapy note ${index}`,
  content: "Sensitive private words ".repeat(index + 2),
  stickers: ["sensitive-sticker"],
  photoIds: index % 2 === 0 ? [`photo-${index}`] : [],
  audioIds: index % 2 === 1 ? [`audio-${index}`] : [],
  mood: index % 2 === 0 ? "bad" : "good",
  tags: ["secret"],
  createdAt: Date.UTC(2026, 5, index + 1, 12),
  updatedAt: Date.UTC(2026, 5, index + 1, 12),
}));

describe("JournalStats private mode", () => {
  it("replaces aggregate diary statistics with a neutral private panel", () => {
    const onBack = vi.fn();

    render(<JournalStats entries={privateEntries} onBack={onBack} privateMode />);

    expect(screen.getByRole("heading", { name: "Diary Statistics" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Private" })).toBeInTheDocument();
    expect(screen.getByText("Unlock private mode to view this memory.")).toBeInTheDocument();

    expect(screen.queryByText("Total Entries")).not.toBeInTheDocument();
    expect(screen.queryByText("Total Words")).not.toBeInTheDocument();
    expect(screen.queryByText("Mood Distribution")).not.toBeInTheDocument();
    expect(screen.queryByText("Year pixels detail")).not.toBeInTheDocument();
    expect(screen.queryByText(/secret/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sensitive-sticker/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
