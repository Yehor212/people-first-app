import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
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
});
