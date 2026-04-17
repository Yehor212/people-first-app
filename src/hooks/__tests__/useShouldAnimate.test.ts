import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useShouldAnimate } from "../useShouldAnimate";

// We mock the composition pieces so we can drive the 8 combinations directly.
vi.mock("@/components/DopamineSettings", () => ({
  useDopamineSettings: vi.fn(),
}));
vi.mock("@/hooks/useMediaQuery", () => ({
  useMediaQuery: vi.fn(),
}));
vi.mock("@/hooks/useBatteryState", () => ({
  useBatteryState: vi.fn(),
}));

import { useDopamineSettings } from "@/components/DopamineSettings";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useBatteryState } from "@/hooks/useBatteryState";

const useDopamineSettingsMock = vi.mocked(useDopamineSettings);
const useMediaQueryMock = vi.mocked(useMediaQuery);
const useBatteryStateMock = vi.mocked(useBatteryState);

function setInputs(opts: {
  dopamineAnimations: boolean;
  osReduce: boolean;
  battery: { level: number; charging: boolean } | null;
}) {
  useDopamineSettingsMock.mockReturnValue({
    intensity: "normal",
    animations: opts.dopamineAnimations,
    sounds: true,
    haptics: true,
    confetti: true,
    streakFire: true,
    moodDrivenUI: true,
  });
  useMediaQueryMock.mockReturnValue(opts.osReduce);
  useBatteryStateMock.mockReturnValue(opts.battery);
}

describe("useShouldAnimate — 8-combination truth table", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("T1: Dopamine=on, OS=no, battery=normal → animate", () => {
    setInputs({ dopamineAnimations: true, osReduce: false, battery: { level: 0.9, charging: false } });
    const { result } = renderHook(() => useShouldAnimate());
    expect(result.current).toBe(true);
  });

  it("T2: Dopamine=on, OS=no, battery=null (unsupported) → animate", () => {
    setInputs({ dopamineAnimations: true, osReduce: false, battery: null });
    const { result } = renderHook(() => useShouldAnimate());
    expect(result.current).toBe(true);
  });

  it("T3: Dopamine=on, OS=no, battery=low+not-charging → NO animate", () => {
    setInputs({ dopamineAnimations: true, osReduce: false, battery: { level: 0.1, charging: false } });
    const { result } = renderHook(() => useShouldAnimate());
    expect(result.current).toBe(false);
  });

  it("T4: Dopamine=on, OS=no, battery=low+charging → animate (charging overrides)", () => {
    setInputs({ dopamineAnimations: true, osReduce: false, battery: { level: 0.05, charging: true } });
    const { result } = renderHook(() => useShouldAnimate());
    expect(result.current).toBe(true);
  });

  it("T5: Dopamine=on, OS=reduce, battery=normal → NO animate (WCAG)", () => {
    setInputs({ dopamineAnimations: true, osReduce: true, battery: { level: 0.9, charging: false } });
    const { result } = renderHook(() => useShouldAnimate());
    expect(result.current).toBe(false);
  });

  it("T6: Dopamine=off, OS=no, battery=normal → NO animate", () => {
    setInputs({ dopamineAnimations: false, osReduce: false, battery: { level: 0.9, charging: false } });
    const { result } = renderHook(() => useShouldAnimate());
    expect(result.current).toBe(false);
  });

  it("T7: Dopamine=off, OS=reduce, battery=low → NO animate (all-off)", () => {
    setInputs({ dopamineAnimations: false, osReduce: true, battery: { level: 0.05, charging: false } });
    const { result } = renderHook(() => useShouldAnimate());
    expect(result.current).toBe(false);
  });

  it("T8: Dopamine=on, OS=reduce, battery=low → NO animate (two signals)", () => {
    setInputs({ dopamineAnimations: true, osReduce: true, battery: { level: 0.05, charging: false } });
    const { result } = renderHook(() => useShouldAnimate());
    expect(result.current).toBe(false);
  });
});
