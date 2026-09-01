import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ScheduleEvent } from "@/types";
import { ScheduleClock, ScheduleDayButton, ScheduleEventCard } from "../ScheduleVisuals";

describe("ScheduleVisuals accessibility", () => {
  it("names an event-bearing day with its localized date and event presence", () => {
    render(
      <ScheduleDayButton
        date="2026-07-15"
        isSelected
        isToday={false}
        hasEvents
        onClick={() => undefined}
        language="ar"
        accessibleDateLabel="الأربعاء، 15 يوليو 2026"
        eventPresenceLabel="توجد أحداث مجدولة"
        tabIndex={0}
        onKeyDown={() => undefined}
      />
    );

    expect(
      screen.getByRole("button", {
        name: "الأربعاء، 15 يوليو 2026, توجد أحداث مجدولة",
      })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("formats the visible schedule clock through the active locale", () => {
    render(<ScheduleClock currentHour={13} currentMinute={5} language="ar" />);

    expect(screen.getByTestId("schedule-clock-time")).toHaveTextContent(
      new Intl.DateTimeFormat("ar", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(2000, 0, 1, 13, 5))
    );
    expect(screen.getByTestId("schedule-clock-time")).toHaveAttribute("dateTime", "13:05");
  });

  it("names the current event with its visible title and localized time range only", () => {
    const event: ScheduleEvent = {
      id: "current-event",
      title: "مراجعة Q3",
      startHour: 9,
      startMinute: 5,
      endHour: 10,
      endMinute: 45,
      color: "#000000",
      date: "2026-07-15",
      note: "Private note that is not visible on the timeline card",
      source: "manual",
    };

    render(
      <ScheduleEventCard
        event={event}
        isCurrent
        onClick={() => undefined}
        timeRangeLabel="09:05 AM–10:45 AM"
      />
    );

    const eventButton = screen.getByRole("button", {
      name: "مراجعة Q3, 09:05 AM–10:45 AM",
    });

    expect(eventButton).toHaveAttribute("aria-current", "time");
    expect(eventButton).not.toHaveAccessibleName(/Private note/);
    expect(screen.getByText("مراجعة Q3")).toHaveAttribute("dir", "auto");
  });
});
