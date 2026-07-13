import { beforeEach, describe, expect, it, vi } from "vitest";

const motionPreference = vi.hoisted(() => ({ reduceMotion: false }));
const runtime = vi.hoisted(() => ({ limited: false }));

vi.mock("@/lib/motionPreference", () => ({
  getMotionPreference: () => ({ ...motionPreference }),
}));

vi.mock("@/observability/runtimePerformanceMode", () => ({
  isRuntimePerformanceLimited: () => runtime.limited,
}));

import {
  _getLowBatteryMirror,
  applyReduceMotionClass,
  motionPresets,
  setLowBatteryMirror,
  shouldAnimate,
  zenMotion,
  zenTap,
} from "../animationUtils";

describe("animationUtils", () => {
  beforeEach(() => {
    motionPreference.reduceMotion = false;
    runtime.limited = false;
    setLowBatteryMirror(false);
    document.body.classList.remove("reduce-motion");
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
  });

  it("keeps shared motion tokens stable", () => {
    expect(motionPresets.fadeIn.transition.duration).toBe(0.2);
    expect(zenMotion.instant).toEqual({ duration: 0 });
    expect(zenTap.button).toEqual({ scale: 0.96 });
  });

  it("allows motion when every effective-motion input allows it", () => {
    expect(shouldAnimate()).toBe(true);
  });

  it("stops motion for the direct in-app preference", () => {
    motionPreference.reduceMotion = true;
    expect(shouldAnimate()).toBe(false);
  });

  it("stops motion for the system preference", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    expect(shouldAnimate()).toBe(false);
  });

  it("stops decorative motion while runtime performance is limited", () => {
    runtime.limited = true;
    expect(shouldAnimate()).toBe(false);
    expect(shouldAnimate({ respectRuntimePerformance: false })).toBe(true);
  });

  it("stops motion for the low-battery mirror", () => {
    setLowBatteryMirror(true);
    expect(_getLowBatteryMirror()).toBe(true);
    expect(shouldAnimate()).toBe(false);
  });

  it("applies the document fallback class from the same effective gate", () => {
    motionPreference.reduceMotion = true;
    applyReduceMotionClass();
    expect(document.body).toHaveClass("reduce-motion");

    motionPreference.reduceMotion = false;
    applyReduceMotionClass();
    expect(document.body).not.toHaveClass("reduce-motion");
  });
});
