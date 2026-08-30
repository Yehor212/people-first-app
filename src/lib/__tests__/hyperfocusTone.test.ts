import { describe, expect, it } from "vitest";

import {
  HYPERFOCUS_TONE_DEFAULT_KHZ,
  HYPERFOCUS_TONE_MAX_KHZ,
  HYPERFOCUS_TONE_MIN_KHZ,
  HYPERFOCUS_TONE_STEP_KHZ,
  formatHyperfocusToneKhz,
  normalizeHyperfocusToneKhz,
  toHyperfocusToneHz,
} from "../hyperfocusTone";

describe("hyperfocus tone preference", () => {
  it("clamps and rounds cutoff values to the 3-16 kHz half-step contract", () => {
    expect(HYPERFOCUS_TONE_MIN_KHZ).toBe(3);
    expect(HYPERFOCUS_TONE_MAX_KHZ).toBe(16);
    expect(HYPERFOCUS_TONE_STEP_KHZ).toBe(0.5);
    expect(HYPERFOCUS_TONE_DEFAULT_KHZ).toBe(16);

    expect(normalizeHyperfocusToneKhz(2.9)).toBe(3);
    expect(normalizeHyperfocusToneKhz(3.24)).toBe(3);
    expect(normalizeHyperfocusToneKhz(3.26)).toBe(3.5);
    expect(normalizeHyperfocusToneKhz(15.9)).toBe(16);
    expect(normalizeHyperfocusToneKhz(99)).toBe(16);
    expect(normalizeHyperfocusToneKhz("4.2")).toBe(4);
    expect(normalizeHyperfocusToneKhz("not-a-number")).toBe(16);
    expect(normalizeHyperfocusToneKhz(Number.NaN)).toBe(16);
  });

  it("formats user-facing kHz values and converts only normalized values to Hz", () => {
    expect(formatHyperfocusToneKhz(3)).toBe("3 kHz");
    expect(formatHyperfocusToneKhz(3.5)).toBe("3.5 kHz");
    expect(formatHyperfocusToneKhz(16)).toBe("16 kHz");
    expect(toHyperfocusToneHz(4.26)).toBe(4500);
    expect(toHyperfocusToneHz(-1)).toBe(3000);
  });
});
