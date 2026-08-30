import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  centeredDomScrollLeft,
  domToPhysicalScrollLeft,
  physicalToDomScrollLeft,
} from "../timelineScrollCoordinates";

const scheduleDataSource = readFileSync(
  "src/components/schedule/useScheduleData.ts",
  "utf8",
);
const scheduleVisualsSource = readFileSync(
  "src/components/schedule/ScheduleVisuals.tsx",
  "utf8",
);

describe("schedule RTL scroll coordinates", () => {
  it("round-trips a physical timeline position through the RTL DOM coordinate", () => {
    const maxScroll = 87_584;
    const physicalPosition = 43_072;

    const domPosition = physicalToDomScrollLeft(
      physicalPosition,
      maxScroll,
      true,
    );

    expect(domPosition).toBe(-44_512);
    expect(domToPhysicalScrollLeft(domPosition, maxScroll, true)).toBe(
      physicalPosition,
    );
  });

  it("keeps LTR coordinates unchanged and clamps browser overscroll", () => {
    expect(physicalToDomScrollLeft(1_240, 8_000, false)).toBe(1_240);
    expect(domToPhysicalScrollLeft(1_240, 8_000, false)).toBe(1_240);
    expect(domToPhysicalScrollLeft(-9_000, 8_000, true)).toBe(0);
    expect(domToPhysicalScrollLeft(400, 8_000, true)).toBe(8_000);
  });

  it("centers the real localized day pill instead of assuming a fixed width", () => {
    expect(scheduleDataSource).not.toContain("buttonWidth = 68");
    expect(scheduleDataSource).toContain("children.item(index)");
    expect(scheduleDataSource).toContain("if (isAndroid)");
    expect(scheduleDataSource).toContain("centeredDomScrollLeft");
    expect(scheduleDataSource).toContain("daySelector.scrollTo");
    expect(scheduleDataSource).toContain("scrollIntoView");
    expect(scheduleDataSource).toContain('block: "nearest"');
    expect(scheduleDataSource).toContain('inline: "center"');
    expect(scheduleDataSource).toContain(
      'behavior: shouldAnimate() ? "smooth" : "auto"',
    );
  });

  it("centers an Android day pill inside its horizontal scroller without moving the document", () => {
    expect(
      centeredDomScrollLeft({
        itemOffsetLeft: 640,
        itemWidth: 60,
        containerWidth: 400,
        scrollWidth: 1_200,
        isRTL: false,
      }),
    ).toBe(470);

    expect(
      centeredDomScrollLeft({
        itemOffsetLeft: 640,
        itemWidth: 60,
        containerWidth: 400,
        scrollWidth: 1_200,
        isRTL: true,
      }),
    ).toBe(-330);
  });

  it("exposes the selected day to assistive technology", () => {
    expect(scheduleVisualsSource).toContain("aria-pressed={isSelected}");
  });
});
