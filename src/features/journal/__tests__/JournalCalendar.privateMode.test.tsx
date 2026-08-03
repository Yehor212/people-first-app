import { readFileSync } from "node:fs";
import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { formatDate } from "@/lib/utils";
import { JournalCalendar } from "../JournalCalendar";
import { JournalCalendarFull } from "../JournalCalendarFull";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "en",
    isRTL: false,
    t: {
      previous: "Previous",
      next: "Next",
      journalCalendarToday: "Today",
      journalCalendarMonthView: "Month",
      ariaSwitchToStripView: "Strip",
      journalEntry: "Entry",
      journalEntryCountOne: "{count} entry",
      journalEntryCountOther: "{count} entries",
      moodBad: "Bad",
    },
  }),
}));

vi.mock("@/lib/animationUtils", () => ({
  shouldAnimate: () => false,
}));

vi.mock("@/lib/haptics", () => ({
  hapticTap: vi.fn(),
}));

vi.mock("../DiaryMiniOrb", () => ({
  DiaryMiniOrb: ({ mood }: { mood?: string | null }) => (
    <span data-testid="calendar-mini-orb" data-mood={mood ?? "entry"} />
  ),
}));

type MotionMockProps<T extends HTMLElement> = React.HTMLAttributes<T> & {
  children?: React.ReactNode;
  initial?: unknown;
  animate?: unknown;
  exit?: unknown;
  transition?: unknown;
};

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    button: ({ children, initial, animate, exit, transition, ...rest }: MotionMockProps<HTMLButtonElement>) => {
      void initial;
      void animate;
      void exit;
      void transition;
      return <button {...rest}>{children}</button>;
    },
    div: ({ children, initial, animate, exit, transition, ...rest }: MotionMockProps<HTMLDivElement>) => {
      void initial;
      void animate;
      void exit;
      void transition;
      return <div {...rest}>{children}</div>;
    },
  },
  useReducedMotion: () => true,
}));

describe("Journal calendars private mode", () => {
  const today = formatDate(new Date());
  const entryDates = new Map([[today, "bad" as const]]);

  it("hides strip calendar entry-day markers while private mode is active", () => {
    render(
      <JournalCalendar
        today={today}
        entryDates={entryDates}
        selectedDate={null}
        onSelectDate={vi.fn()}
        privateMode
      />,
    );

    expect(screen.queryByRole("button", { name: /bad/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /entry/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("journal-calendar-mood-orb")).not.toBeInTheDocument();
    expect(screen.queryByTestId("calendar-mini-orb")).not.toBeInTheDocument();
  });

  it("hides month calendar entry-day markers while private mode is active", () => {
    render(
      <JournalCalendarFull
        today={today}
        entryDates={entryDates}
        selectedDate={null}
        onSelectDate={vi.fn()}
        onToggleMode={vi.fn()}
        privateMode
      />,
    );

    expect(screen.queryByTestId("journal-calendar-full-mood-orb")).not.toBeInTheDocument();
    expect(screen.queryByTestId("calendar-mini-orb")).not.toBeInTheDocument();
  });

  it("keeps month calendar count badges behind the private-mode guard", () => {
    const source = readFileSync("src/features/journal/JournalCalendarFull.tsx", "utf8");

    expect(source).toMatch(/\{!privateMode\s*&&\s*count\s*>\s*1\s*&&\s*\(/);
    expect(source).not.toMatch(/\{count\s*>\s*1\s*&&\s*\(/);
  });

  it("follows a new current month without remounting when the user stayed on today", () => {
    const { rerender } = render(
      <JournalCalendarFull
        today="2026-07-31"
        entryDates={new Map()}
        selectedDate={null}
        onSelectDate={vi.fn()}
        onToggleMode={vi.fn()}
      />,
    );

    expect(screen.getByText(/July 2026/i)).toBeInTheDocument();

    rerender(
      <JournalCalendarFull
        today="2026-08-01"
        entryDates={new Map()}
        selectedDate={null}
        onSelectDate={vi.fn()}
        onToggleMode={vi.fn()}
      />,
    );

    expect(screen.getByText(/August 2026/i)).toBeInTheDocument();
  });

  it("preserves a historical month across midnight when the user browsed away from today", () => {
    const { rerender } = render(
      <JournalCalendarFull
        today="2026-07-31"
        entryDates={new Map()}
        selectedDate={null}
        onSelectDate={vi.fn()}
        onToggleMode={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText(/June 2026/i)).toBeInTheDocument();

    rerender(
      <JournalCalendarFull
        today="2026-08-01"
        entryDates={new Map()}
        selectedDate={null}
        onSelectDate={vi.fn()}
        onToggleMode={vi.fn()}
      />,
    );

    expect(screen.getByText(/June 2026/i)).toBeInTheDocument();
  });

  it("preserves the exact historical strip range across midnight", () => {
    const { rerender } = render(
      <JournalCalendar
        today="2026-07-31"
        entryDates={new Map()}
        selectedDate={null}
        onSelectDate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByRole("button", { name: /Saturday, June 27, 2026/i })).toBeInTheDocument();

    rerender(
      <JournalCalendar
        today="2026-08-01"
        entryDates={new Map()}
        selectedDate={null}
        onSelectDate={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Saturday, June 27, 2026/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Saturday, July 25, 2026/i })).not.toBeInTheDocument();
  });

  it("gives month cells full date, entry, mood, current-date, and selection semantics", () => {
    render(
      <JournalCalendarFull
        today="2026-07-05"
        entryDates={new Map([["2026-07-05", "bad"]])}
        selectedDate="2026-07-05"
        onSelectDate={vi.fn()}
        onToggleMode={vi.fn()}
      />,
    );

    const day = screen.getByRole("button", {
      name: /Sunday, July 5, 2026.*1 entry.*Bad/i,
    });
    expect(day).toHaveAttribute("aria-current", "date");
    expect(day).toHaveAttribute("aria-pressed", "true");
  });
});
