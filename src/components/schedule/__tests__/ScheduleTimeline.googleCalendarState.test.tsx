import { fireEvent, render, screen } from "@testing-library/react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScheduleTimeline } from "../ScheduleTimeline";

const scheduleDataMock = vi.hoisted(() => ({
  value: null as Record<string, unknown> | null,
}));

vi.mock("../useScheduleData", () => ({
  useScheduleData: () => scheduleDataMock.value,
}));

vi.mock("@/components/stats", () => ({
  ParticleBackground: () => null,
}));

vi.mock("@/components/EmptyState", () => ({
  EmptyState: ({ title }: { title: string }) => (
    <div data-testid="schedule-empty-state">{title}</div>
  ),
}));

vi.mock("@/hooks/useBackHandler", () => ({
  useBackHandler: () => undefined,
}));

vi.mock("@/hooks/useScrollLock", () => ({
  useScrollLock: () => undefined,
}));

vi.mock("../ScheduleVisuals", () => ({
  AnimatedClockRing: () => null,
  ScheduleClock: () => null,
  PremiumDayPill: ({
    date,
    onClick,
    onKeyDown,
    tabIndex,
  }: {
    date: string;
    onClick: () => void;
    onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
    tabIndex: number;
  }) => (
    <button
      type="button"
      data-schedule-date={date}
      data-testid={`schedule-day-${date}`}
      onClick={onClick}
      onKeyDown={onKeyDown}
      tabIndex={tabIndex}
    >
      {date}
    </button>
  ),
  ScheduleDayButton: ({
    date,
    onClick,
    onKeyDown,
    tabIndex,
  }: {
    date: string;
    onClick: () => void;
    onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
    tabIndex: number;
  }) => (
    <button
      type="button"
      data-schedule-date={date}
      data-testid={`schedule-day-${date}`}
      onClick={onClick}
      onKeyDown={onKeyDown}
      tabIndex={tabIndex}
    >
      {date}
    </button>
  ),
}));

vi.mock("../TimelineDayColumn", () => ({
  TimelineDayColumn: () => null,
}));

vi.mock("../AddEventModal", () => ({
  AddEventModal: () => null,
}));

vi.mock("../EventDetailsModal", () => ({
  EventDetailsModal: () => null,
}));

vi.mock("../TaskFocusPanel", () => ({
  TaskFocusPanel: () => null,
}));

const retryGoogleCalendar = vi.fn();
const setSelectedDate = vi.fn();
const scrollDaySelectorToDate = vi.fn();
const scrollTimelineToDate = vi.fn();

function makeScheduleData(
  googleCalendarStatus: "disabled" | "loading" | "ready" | "error",
  overrides: Record<string, unknown> = {}
) {
  return {
    currentTime: new Date(2026, 6, 29, 9, 30),
    selectedDate: "2026-07-29",
    setSelectedDate,
    tasks: [],
    taskEvents: [],
    googleEvents: [],
    isLoadingGoogle: googleCalendarStatus === "loading",
    googleCalendarStatus,
    retryGoogleCalendar,
    safeEvents: [],
    allDates: ["2026-07-29"],
    getDateIndex: () => 0,
    filteredEvents: [],
    dateHasEvents: () => false,
    isToday: true,
    scrollDaySelectorToDate,
    scrollTimelineToDate,
    isScrollingProgrammatically: { current: false },
    t: {
      myWorld: "My world",
      googleCalendar: "Google Calendar",
      googleCalendarEventsLoading: "Loading Google Calendar events...",
      googleCalendarEventsUnavailable: "Google Calendar events are unavailable right now.",
      retry: "Retry",
      today: "Today",
      scheduleTitle: "Your schedule",
      scheduleEmpty: "No events planned",
      scheduleEmptyDay: "No events for this day",
      scheduleAddEvent: "Add an event",
      scheduleAdd: "Add event",
    },
    language: "en",
    isRTL: false,
    ...overrides,
  };
}

describe("ScheduleTimeline Google Calendar source state", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 29, 12));
    retryGoogleCalendar.mockReset();
    setSelectedDate.mockReset();
    scrollDaySelectorToDate.mockReset();
    scrollTimelineToDate.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses a level-two workspace heading and one roving date tab stop", () => {
    scheduleDataMock.value = makeScheduleData("ready", {
      allDates: ["2026-07-28", "2026-07-29", "2026-07-30"],
    });

    render(<ScheduleTimeline events={[]} />);

    expect(screen.getByRole("heading", { level: 2, name: "My world" })).toBeInTheDocument();
    expect(screen.getByTestId("schedule-day-2026-07-28")).toHaveAttribute("tabindex", "-1");
    expect(screen.getByTestId("schedule-day-2026-07-29")).toHaveAttribute("tabindex", "0");
    expect(screen.getByTestId("schedule-day-2026-07-30")).toHaveAttribute("tabindex", "-1");

    fireEvent.keyDown(screen.getByTestId("schedule-day-2026-07-29"), { key: "ArrowRight" });

    expect(setSelectedDate).toHaveBeenCalledWith("2026-07-30");
    expect(scrollTimelineToDate).toHaveBeenCalledWith("2026-07-30", false);
    expect(scrollDaySelectorToDate).toHaveBeenCalledWith("2026-07-30");
    expect(screen.getByTestId("schedule-day-2026-07-30")).toHaveFocus();
  });

  it("maps horizontal date navigation to the visible RTL direction", () => {
    scheduleDataMock.value = makeScheduleData("ready", {
      allDates: ["2026-07-28", "2026-07-29", "2026-07-30"],
      isRTL: true,
      language: "ar",
    });

    render(<ScheduleTimeline events={[]} />);
    fireEvent.keyDown(screen.getByTestId("schedule-day-2026-07-29"), { key: "ArrowRight" });

    expect(setSelectedDate).toHaveBeenCalledWith("2026-07-28");
    expect(screen.getByTestId("schedule-day-2026-07-28")).toHaveFocus();
  });

  it("shows a truthful loading status without an authoritative empty state", () => {
    scheduleDataMock.value = makeScheduleData("loading");

    render(<ScheduleTimeline events={[]} />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading Google Calendar events...");
    expect(screen.queryByTestId("schedule-empty-state")).not.toBeInTheDocument();
  });

  it("shows privacy-safe recovery for an unavailable calendar without an empty state", () => {
    scheduleDataMock.value = makeScheduleData("error");

    render(<ScheduleTimeline events={[]} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Google Calendar events are unavailable right now."
    );
    expect(screen.queryByTestId("schedule-empty-state")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retryGoogleCalendar).toHaveBeenCalledTimes(1);
  });

  it("shows the empty state only after the enabled source is ready", () => {
    scheduleDataMock.value = makeScheduleData("ready");

    render(<ScheduleTimeline events={[]} />);

    expect(screen.getByTestId("schedule-empty-state")).toHaveTextContent("No events planned");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
