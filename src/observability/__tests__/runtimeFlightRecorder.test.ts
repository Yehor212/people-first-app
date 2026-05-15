import { describe, expect, it } from "vitest";
import { shouldEnableRuntimeFlightRecorder } from "../runtimeFlightRecorder";

describe("runtime flight recorder enablement", () => {
  it("enables from explicit perf query flag", () => {
    expect(shouldEnableRuntimeFlightRecorder("?perf=1", "", false)).toBe(true);
    expect(shouldEnableRuntimeFlightRecorder("?runtimePerf=true", "", false)).toBe(true);
  });

  it("keeps explicit off stronger than dev mode", () => {
    expect(shouldEnableRuntimeFlightRecorder("?perf=0", "true", true)).toBe(false);
  });

  it("enables from stored diagnostic flag or local dev mode", () => {
    expect(shouldEnableRuntimeFlightRecorder("", "on", false)).toBe(true);
    expect(shouldEnableRuntimeFlightRecorder("", "", true)).toBe(true);
  });

  it("treats public dev route as an explicit diagnostic route", () => {
    expect(shouldEnableRuntimeFlightRecorder("?nav=v2&dev=true", "", false)).toBe(true);
  });
});
