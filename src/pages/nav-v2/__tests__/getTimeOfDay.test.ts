/**
 * getTimeOfDay — tests for WOW-2 palette bucket mapping.
 */
import { describe, it, expect } from "vitest";
import { getTimeOfDay } from "../getTimeOfDay";

describe("getTimeOfDay", () => {
  const at = (hour: number) => new Date(2026, 3, 16, hour, 0, 0);

  it("returns 'dawn' for 05-08", () => {
    expect(getTimeOfDay(at(5))).toBe("dawn");
    expect(getTimeOfDay(at(7))).toBe("dawn");
    expect(getTimeOfDay(at(8))).toBe("dawn");
  });

  it("returns 'day' for 09-16", () => {
    expect(getTimeOfDay(at(9))).toBe("day");
    expect(getTimeOfDay(at(12))).toBe("day");
    expect(getTimeOfDay(at(16))).toBe("day");
  });

  it("returns 'dusk' for 17-20", () => {
    expect(getTimeOfDay(at(17))).toBe("dusk");
    expect(getTimeOfDay(at(19))).toBe("dusk");
    expect(getTimeOfDay(at(20))).toBe("dusk");
  });

  it("returns 'night' for 21-04", () => {
    expect(getTimeOfDay(at(21))).toBe("night");
    expect(getTimeOfDay(at(23))).toBe("night");
    expect(getTimeOfDay(at(0))).toBe("night");
    expect(getTimeOfDay(at(3))).toBe("night");
    expect(getTimeOfDay(at(4))).toBe("night");
  });
});
