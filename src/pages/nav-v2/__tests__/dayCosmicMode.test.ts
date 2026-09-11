import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleDayPalette } from "../dayCosmicMode";

describe("per-visit daylight palette sampling", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it.each([
    [0, "dawn"], [1, "dawn"], [2, "dawn"], [3, "dawn"], [4, "dawn"],
    [5, "dawn"], [6, "dawn"], [7, "dawn"], [8, "dawn"],
    [9, "morning"], [10, "morning"], [11, "morning"],
    [12, "afternoon"], [13, "afternoon"], [14, "afternoon"],
    [15, "afternoon"], [16, "afternoon"],
    [17, "golden"], [18, "golden"],
    [19, "dusk"], [20, "dusk"], [21, "dusk"], [22, "dusk"], [23, "dusk"],
  ] as const)("keeps hour %i in the original %s palette", (hour, mode) => {
    vi.setSystemTime(new Date(2026, 8, 10, hour, 0, 0));
    expect(sampleDayPalette(41)).toEqual({ activationKey: 41, mode });
    expect(sampleDayPalette(42)).toEqual({ activationKey: 42, mode });
  });
});
