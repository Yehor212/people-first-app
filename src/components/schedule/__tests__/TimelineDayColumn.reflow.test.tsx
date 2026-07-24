import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Translations } from "@/i18n/translations";
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

    expect(HOUR_WIDTH_PX).toBeGreaterThanOrEqual(96);
    expect(labels).toHaveLength(24);
    expect(labels.every((label) => label.classList.contains("whitespace-nowrap"))).toBe(true);
    expect(
      labels.every((label) => label.parentElement?.style.width === `${HOUR_WIDTH_PX}px`),
    ).toBe(true);
  });
});
