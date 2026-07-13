import { describe, it, expect, vi, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useShouldAnimate } from "../useShouldAnimate";
import { SSK } from "@/lib/storageKeys";

// We mock the composition pieces so we can drive the 8 combinations directly.
vi.mock("@/hooks/useMotionPreference", () => ({
  useMotionPreference: vi.fn(),
}));
vi.mock("@/hooks/useMediaQuery", () => ({
  useMediaQuery: vi.fn(),
}));
vi.mock("@/hooks/useBatteryState", () => ({
  useBatteryState: vi.fn(),
}));

import { useMotionPreference } from "@/hooks/useMotionPreference";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useBatteryState } from "@/hooks/useBatteryState";

const useMotionPreferenceMock = vi.mocked(useMotionPreference);
const useMediaQueryMock = vi.mocked(useMediaQuery);
const useBatteryStateMock = vi.mocked(useBatteryState);

function setInputs(opts: {
  appMotionEnabled: boolean;
  osReduce: boolean;
  battery: { level: number; charging: boolean } | null;
}) {
  useMotionPreferenceMock.mockReturnValue({ reduceMotion: !opts.appMotionEnabled });
  useMediaQueryMock.mockReturnValue(opts.osReduce);
  useBatteryStateMock.mockReturnValue(opts.battery);
}

describe("useShouldAnimate — 8-combination truth table", () => {
  afterEach(() => {
    vi.clearAllMocks();
    delete document.documentElement.dataset.runtimePerf;
    sessionStorage.removeItem(SSK.RUNTIME_PERF_GUARD);
  });

  it("T1: app motion=on, OS=no, battery=normal → animate", () => {
    setInputs({ appMotionEnabled: true, osReduce: false, battery: { level: 0.9, charging: false } });
    const { result } = renderHook(() => useShouldAnimate());
    expect(result.current).toBe(true);
  });

  it("T2: app motion=on, OS=no, battery=null (unsupported) → animate", () => {
    setInputs({ appMotionEnabled: true, osReduce: false, battery: null });
    const { result } = renderHook(() => useShouldAnimate());
    expect(result.current).toBe(true);
  });

  it("T3: app motion=on, OS=no, battery=low+not-charging → NO animate", () => {
    setInputs({ appMotionEnabled: true, osReduce: false, battery: { level: 0.1, charging: false } });
    const { result } = renderHook(() => useShouldAnimate());
    expect(result.current).toBe(false);
  });

  it("T4: app motion=on, OS=no, battery=low+charging → animate (charging overrides)", () => {
    setInputs({ appMotionEnabled: true, osReduce: false, battery: { level: 0.05, charging: true } });
    const { result } = renderHook(() => useShouldAnimate());
    expect(result.current).toBe(true);
  });

  it("T5: app motion=on, OS=reduce, battery=normal → NO animate (WCAG)", () => {
    setInputs({ appMotionEnabled: true, osReduce: true, battery: { level: 0.9, charging: false } });
    const { result } = renderHook(() => useShouldAnimate());
    expect(result.current).toBe(false);
  });

  it("T6: app motion=off, OS=no, battery=normal → NO animate", () => {
    setInputs({ appMotionEnabled: false, osReduce: false, battery: { level: 0.9, charging: false } });
    const { result } = renderHook(() => useShouldAnimate());
    expect(result.current).toBe(false);
  });

  it("T7: app motion=off, OS=reduce, battery=low → NO animate (all-off)", () => {
    setInputs({ appMotionEnabled: false, osReduce: true, battery: { level: 0.05, charging: false } });
    const { result } = renderHook(() => useShouldAnimate());
    expect(result.current).toBe(false);
  });

  it("T8: app motion=on, OS=reduce, battery=low → NO animate (two signals)", () => {
    setInputs({ appMotionEnabled: true, osReduce: true, battery: { level: 0.05, charging: false } });
    const { result } = renderHook(() => useShouldAnimate());
    expect(result.current).toBe(false);
  });

  it("T9: runtime performance strained → NO animate even when user/system allow motion", () => {
    document.documentElement.dataset.runtimePerf = "strained";
    setInputs({ appMotionEnabled: true, osReduce: false, battery: { level: 0.9, charging: false } });

    const { result } = renderHook(() => useShouldAnimate());

    expect(result.current).toBe(false);
  });

  it("T10: runtime performance event disables already-mounted animation hooks", () => {
    setInputs({ appMotionEnabled: true, osReduce: false, battery: { level: 0.9, charging: false } });
    const { result } = renderHook(() => useShouldAnimate());
    expect(result.current).toBe(true);

    act(() => {
      document.documentElement.dataset.runtimePerf = "strained";
      window.dispatchEvent(new CustomEvent("zenflow:runtime-perf-mode"));
    });

    expect(result.current).toBe(false);
  });

  it("T11: runtime performance startup warmup -> NO animate before a proven slow device repeats lag", () => {
    document.documentElement.dataset.runtimePerf = "startup";
    setInputs({ appMotionEnabled: true, osReduce: false, battery: { level: 0.9, charging: false } });

    const { result } = renderHook(() => useShouldAnimate());

    expect(result.current).toBe(false);
  });

  it("T12: canonical visual flourishes can opt out of runtime perf guard", () => {
    document.documentElement.dataset.runtimePerf = "startup";
    setInputs({ appMotionEnabled: true, osReduce: false, battery: { level: 0.9, charging: false } });

    const { result } = renderHook(() =>
      useShouldAnimate({ respectRuntimePerformance: false }),
    );

    expect(result.current).toBe(true);
  });
});
