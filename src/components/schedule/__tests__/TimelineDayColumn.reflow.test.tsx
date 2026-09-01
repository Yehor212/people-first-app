import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Translations } from "@/i18n/translations";
import type { ScheduleEvent } from "@/types";
import { TimelineDayColumn } from "../TimelineDayColumn";
import { HOUR_WIDTH_PX } from "../constants";

const translations = {
  night: "Night",
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
} as Translations;

describe("TimelineDayColumn text reflow", () => {
  it("reserves enough inline space for every complete hour label at enlarged text spacing", () => {
    const { container } = render(
      <TimelineDayColumn
        date="2026-07-15"
        dayOffset={0}
        dayEvents={[]}
        isDayToday={false}
        isDaySelected={false}
        currentHour={12}
        currentTimePositionPercent={50}
        language="de"
        t={translations}
        onEventClick={() => undefined}
        isEventCurrent={() => false}
      />,
    );

    const labels = [...container.querySelectorAll<HTMLElement>("[data-schedule-hour-label]")];

    // Chrome measured the longest Arabic hour label at 130.77 CSS px with
    // 200% root text plus the WCAG text-spacing overrides. Keep a bounded
    // margin so adjacent physical-hour labels cannot collide.
    expect(HOUR_WIDTH_PX).toBeGreaterThanOrEqual(144);
    expect(labels).toHaveLength(24);
    expect(labels.every((label) => label.classList.contains("whitespace-nowrap"))).toBe(true);
    expect(
      labels.every((label) => label.parentElement?.style.width === `${HOUR_WIDTH_PX}px`),
    ).toBe(true);
  });

  it("keeps physical chronology LTR while isolating RTL labels and mixed-direction event titles", () => {
    const event: ScheduleEvent = {
      id: "mixed-direction-event",
      title: "مراجعة Q3",
      startHour: 9,
      startMinute: 5,
      endHour: 10,
      endMinute: 45,
      color: "#000000",
      date: "2026-07-15",
      source: "manual",
    };
    const rtlTranslations = {
      ...translations,
      night: "الليل",
      morning: "الصباح",
      afternoon: "بعد الظهر",
      evening: "المساء",
    };

    const { container } = render(
      <TimelineDayColumn
        date="2026-07-15"
        dayOffset={0}
        dayEvents={[event]}
        isDayToday={false}
        isDaySelected={false}
        currentHour={12}
        currentTimePositionPercent={50}
        language="ar"
        t={rtlTranslations}
        onEventClick={() => undefined}
        isEventCurrent={() => false}
      />,
    );

    expect(container.firstElementChild).toHaveAttribute("dir", "ltr");
    expect(screen.getByText("الليل")).toHaveAttribute("dir", "auto");
    expect(screen.getByText("الصباح")).toHaveAttribute("dir", "auto");
    expect(screen.getByText("بعد الظهر")).toHaveAttribute("dir", "auto");
    expect(screen.getByText("المساء")).toHaveAttribute("dir", "auto");
    expect(screen.getByText("مراجعة Q3")).toHaveAttribute("dir", "auto");
    expect(
      screen.getByRole("button", {
        name: "مراجعة Q3, 09:05 ص–10:45 ص",
      }),
    ).toBeInTheDocument();
  });

  it("localizes the event time range for an English schedule", () => {
    const event: ScheduleEvent = {
      id: "english-event",
      title: "Review Q3",
      startHour: 9,
      startMinute: 5,
      endHour: 10,
      endMinute: 45,
      color: "#000000",
      date: "2026-07-15",
      source: "manual",
    };

    render(
      <TimelineDayColumn
        date="2026-07-15"
        dayOffset={0}
        dayEvents={[event]}
        isDayToday={false}
        isDaySelected={false}
        currentHour={12}
        currentTimePositionPercent={50}
        language="en"
        t={translations}
        onEventClick={() => undefined}
        isEventCurrent={() => false}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Review Q3, 09:05 AM–10:45 AM",
      }),
    ).toBeInTheDocument();
  });
});
