import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HabitCalendar } from "@/components/stats/HabitCalendar";
import { CalendarGrid } from "@/components/stats/CalendarGrid";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      april: "April",
      august: "August",
      avgCompletion: "Average completion",
      calendarNextMonth: "Next month",
      calendarPrevMonth: "Previous month",
      completions: "Completions",
      december: "December",
      february: "February",
      friday: "Friday",
      fri: "Fri",
      habitCalendar: "Habit Calendar",
      january: "January",
      july: "July",
      june: "June",
      less: "Less",
      march: "March",
      may: "May",
      monday: "Monday",
      mon: "Mon",
      more: "More",
      november: "November",
      october: "October",
      perfectDays: "Perfect days",
      saturday: "Saturday",
      sat: "Sat",
      september: "September",
      sunday: "Sunday",
      sun: "Sun",
      thursday: "Thursday",
      thu: "Thu",
      tuesday: "Tuesday",
      tue: "Tue",
      wednesday: "Wednesday",
      wed: "Wed",
    },
  }),
}));

describe("calendar reflow scroll regions", () => {
  it("names and keyboard-enables the compact seven-column calendar viewport", () => {
    render(
      <CalendarGrid
        calendarDays={[{ dateKey: "2026-08-01", day: 1 }]}
        moodByDate={new Map()}
        focusMinutesByDate={new Map()}
        habitCompletionMap={new Map()}
        gratitudeByDate={new Map()}
        todayKey="2026-08-09"
        selectedDate={null}
        onSelectDate={() => undefined}
        monthNames={["January", "February", "March", "April", "May", "June", "July", "August"]}
        selectedMonth={7}
        selectedYear={2026}
        t={{
          calendarTitle: "Calendar",
          fri: "Fri",
          mon: "Mon",
          mood: "Mood",
          sat: "Sat",
          sun: "Sun",
          thu: "Thu",
          tue: "Tue",
          wed: "Wed",
        }}
      />,
    );

    const scroller = screen.getByRole("region", {
      name: "Calendar — August 2026",
    });
    expect(scroller).toHaveAttribute("tabindex", "0");
    expect(scroller).toHaveClass("overflow-x-auto", "overscroll-x-contain");
    expect(scroller).toHaveClass("focus-visible:ring-2");
  });

  it("names and keyboard-enables the habit calendar viewport", () => {
    render(<HabitCalendar habits={[]} />);

    const scroller = screen.getByRole("region", {
      name: /Habit Calendar — .+ \d{4}/,
    });
    expect(scroller).toHaveAttribute("tabindex", "0");
    expect(scroller).toHaveClass("overflow-x-auto", "overscroll-x-contain");
    expect(scroller).toHaveClass("focus-visible:ring-2");
  });
});
