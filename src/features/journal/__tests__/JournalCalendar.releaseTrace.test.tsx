import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { formatDate } from "@/lib/utils";
import { JournalCalendar } from "../JournalCalendar";
import { JournalCalendarFull } from "../JournalCalendarFull";

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
});
