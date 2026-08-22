import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ScheduleEvent } from "@/types";
import { GlobalScheduleBar } from "../GlobalScheduleBar";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      hoursShort: "h",
      minutesShort: "m",
      scheduleEmpty: "No upcoming events",
      timeIn: "in",
      timeNow: "now",
      viewSchedule: "View schedule",
    },
  }),
}));

const event = (overrides: Partial<ScheduleEvent>): ScheduleEvent => ({
  id: "event",
  title: "Event",
  startHour: 10,
  startMinute: 0,
  endHour: 10,
  endMinute: 30,
  color: "#334455",
  date: "2026-08-09",
  ...overrides,
});

describe("GlobalScheduleBar completed-state selection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 9, 10, 0));
  });

  afterEach(() => vi.useRealTimers());

  it("skips a completed overlapping block and presents the next unfinished block", () => {
    render(
      <GlobalScheduleBar
        events={[
          event({ id: "done", title: "Finished reading", completed: true }),
          event({ id: "next", title: "Walk", startHour: 11, endHour: 11, endMinute: 30 }),
        ]}
      />,
    );

    expect(screen.getByText(/Walk/)).toBeVisible();
    expect(screen.queryByText(/Finished reading/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View schedule" })).toHaveClass("min-h-[48px]");
  });

  it("shows the calm empty state when every remaining block is completed", () => {
    render(
      <GlobalScheduleBar
        events={[event({ title: "Finished walk", startHour: 11, endHour: 11, endMinute: 30, completed: true })]}
      />,
    );

    expect(screen.getByText("No upcoming events")).toBeVisible();
    expect(screen.queryByText(/Finished walk/)).not.toBeInTheDocument();
  });
});
