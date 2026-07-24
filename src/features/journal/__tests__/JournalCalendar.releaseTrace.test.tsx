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
      moodGood: "Good",
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
        today={today}
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
        today={today}
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
    expect(journalCalendarSource).toContain("scrollRef.current.scrollLeft = -maxScroll");
    expect(journalCalendarSource).not.toContain("compactSidebarInset");
    expect(journalCalendarSource).toContain("gap-0.5 overflow-x-auto");
    expect(journalCalendarSource).toContain("-mx-1 px-1 snap-x snap-mandatory");
    expect(journalCalendarSource).not.toContain("pr-8 snap-x");
    expect(journalCalendarSource).toContain("flex h-12 w-12 touch-manipulation items-center justify-center");
    expect(journalCalendarSource).toContain(
      "snap-start flex h-[calc(3rem*var(--font-scale,1))] min-w-[calc(3rem*var(--font-scale,1))] touch-manipulation flex-none",
    );
    expect(journalCalendarSource).toContain("min-h-12");
    expect(journalCalendarSource).not.toContain("h-[46px] w-[46px]");
    expect(journalCalendarSource).not.toContain("h-[44px] w-[44px]");
    expect(journalCalendarSource).not.toContain("min-h-[44px]");
    expect(journalCalendarSource).not.toContain("initial={animate ? { opacity: 0, scale: 0.8 } : false}");
  });

  it("uses logical insets for streak endpoints so RTL mirrors correctly", () => {
    expect(journalCalendarSource).toContain(
      'insetInlineStart: streak.isStart ? "15%" : "0"',
    );
    expect(journalCalendarSource).toContain(
      'insetInlineEnd: streak.isEnd ? "15%" : "0"',
    );
    expect(journalCalendarSource).not.toContain('left: streak.isStart');
    expect(journalCalendarSource).not.toContain('right: streak.isEnd');
  });

  it("uses a full screen-reader date without overriding the compact visible label", () => {
    render(
      <JournalCalendar
        today={today}
        entryDates={new Map()}
        selectedDate={today}
        onSelectDate={vi.fn()}
      />,
    );

    const todayButton = screen.getByRole("button", { current: "date" });
    expect(todayButton).toHaveAttribute("aria-pressed", "true");
    expect(todayButton).not.toHaveAttribute("aria-label");
    expect(todayButton.querySelector(".sr-only")?.textContent?.length).toBeGreaterThan(5);
  });

  it("includes the visible mood in the screen-reader description for an entry day", () => {
    render(
      <JournalCalendar
        today={today}
        entryDates={new Map([[today, "good"]])}
        selectedDate={null}
        onSelectDate={vi.fn()}
      />,
    );

    const todayButton = screen.getByRole("button", { current: "date" });
    expect(todayButton).toHaveAccessibleName(/Good/);
  });
});
