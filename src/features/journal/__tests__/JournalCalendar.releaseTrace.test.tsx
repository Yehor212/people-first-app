import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { formatDate } from "@/lib/utils";
import { JournalCalendar } from "../JournalCalendar";
import { JournalCalendarFull } from "../JournalCalendarFull";

const journalCalendarSource = readFileSync("src/features/journal/JournalCalendar.tsx", "utf8");

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "uk",
    isRTL: false,
    t: {
      previous: "Previous",
      next: "Next",
      journalCalendarToday: "Today",
      journalCalendarMonthView: "Month",
      ariaSwitchToStripView: "Strip",
    },
  }),
}));

vi.mock("@/lib/animationUtils", () => ({
  shouldAnimate: () => false,
}));

vi.mock("@/lib/haptics", () => ({
  hapticTap: vi.fn(),
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
    button: ({
      children,
      initial,
      animate,
      exit,
      transition,
      ...rest
    }: MotionMockProps<HTMLButtonElement>) => {
      void initial;
      void animate;
      void exit;
      void transition;
      return <button {...rest}>{children}</button>;
    },
    div: ({
      children,
      initial,
      animate,
      exit,
      transition,
      ...rest
    }: MotionMockProps<HTMLDivElement>) => {
      void initial;
      void animate;
      void exit;
      void transition;
      return <div {...rest}>{children}</div>;
    },
  },
  useReducedMotion: () => true,
}));

describe("journal release trace calendar markers", () => {
  const today = formatDate(new Date());

  it("shows a quiet release dot in the strip without creating a mood orb", () => {
    render(
      <JournalCalendar
        entryDates={new Map()}
        releaseTraceDates={new Map([[today, 1]])}
        selectedDate={null}
        onSelectDate={vi.fn()}
      />,
    );

    expect(screen.getByTestId("journal-release-trace-dot")).toBeInTheDocument();
    expect(screen.queryByTestId("journal-calendar-mood-orb")).not.toBeInTheDocument();
  });

  it("shows a quiet release dot in month view without creating an entry count", () => {
    render(
      <JournalCalendarFull
        entryDates={new Map()}
        releaseTraceDates={new Map([[today, 1]])}
        selectedDate={null}
        onSelectDate={vi.fn()}
        onToggleMode={vi.fn()}
      />,
    );

    expect(screen.getByTestId("journal-release-trace-dot")).toBeInTheDocument();
    expect(screen.queryByTestId("journal-calendar-full-mood-orb")).not.toBeInTheDocument();
  });

  it("keeps strip calendar hit targets Android-grade during entrance animation", () => {
    expect(journalCalendarSource).toContain("initial={animate ? { opacity: 0 } : false}");
    expect(journalCalendarSource).toContain("scrollRef.current.scrollLeft = -(");
    expect(journalCalendarSource).toContain("compactSidebarInset");
    expect(journalCalendarSource).toContain("px-1 pr-8 snap-x snap-mandatory rtl:pl-8 rtl:pr-1");
    expect(journalCalendarSource).toContain("flex h-12 w-12 touch-manipulation items-center justify-center");
    expect(journalCalendarSource).toContain("snap-start flex h-12 w-12 touch-manipulation flex-none");
    expect(journalCalendarSource).toContain("min-h-12");
    expect(journalCalendarSource).not.toContain("h-[46px] w-[46px]");
    expect(journalCalendarSource).not.toContain("h-[44px] w-[44px]");
    expect(journalCalendarSource).not.toContain("min-h-[44px]");
    expect(journalCalendarSource).not.toContain("initial={animate ? { opacity: 0, scale: 0.8 } : false}");
  });
});
