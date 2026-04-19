import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock web-vitals/attribution BEFORE the module under test imports it.
// The factory is called once; we reference mutable spies inside so each test
// resets call counts via `.mockClear()` without re-wiring the mock.
const mockOnCLS = vi.fn();
const mockOnFCP = vi.fn();
const mockOnINP = vi.fn();
const mockOnLCP = vi.fn();
const mockOnTTFB = vi.fn();

vi.mock("web-vitals/attribution", () => ({
  onCLS: mockOnCLS,
  onFCP: mockOnFCP,
  onINP: mockOnINP,
  onLCP: mockOnLCP,
  onTTFB: mockOnTTFB,
}));

describe("reportWebVitals", () => {
  beforeEach(() => {
    mockOnCLS.mockClear();
    mockOnFCP.mockClear();
    mockOnINP.mockClear();
    mockOnLCP.mockClear();
    mockOnTTFB.mockClear();
    delete (window as { __zenflowVitals?: unknown }).__zenflowVitals;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("registers all 5 Core Web Vitals metrics in DEV", async () => {
    vi.stubEnv("DEV", true);
    const { initWebVitalsDev } = await import("../reportWebVitals");

    await initWebVitalsDev();

    expect(mockOnCLS).toHaveBeenCalledTimes(1);
    expect(mockOnFCP).toHaveBeenCalledTimes(1);
    expect(mockOnINP).toHaveBeenCalledTimes(1);
    expect(mockOnLCP).toHaveBeenCalledTimes(1);
    expect(mockOnTTFB).toHaveBeenCalledTimes(1);
  });

  it("does NOT register listeners in production", async () => {
    vi.stubEnv("DEV", false);
    vi.resetModules();
    const { initWebVitalsDev } = await import("../reportWebVitals");

    await initWebVitalsDev();

    expect(mockOnCLS).not.toHaveBeenCalled();
    expect(mockOnINP).not.toHaveBeenCalled();
    expect(mockOnLCP).not.toHaveBeenCalled();
  });

  it("stores reported metrics on window.__zenflowVitals for inspection", async () => {
    vi.stubEnv("DEV", true);
    vi.resetModules();
    const { initWebVitalsDev } = await import("../reportWebVitals");

    await initWebVitalsDev();

    // Simulate web-vitals firing a metric by invoking the registered callback.
    const clsCallback = mockOnCLS.mock.calls[0][0];
    clsCallback({
      name: "CLS",
      value: 0.12,
      rating: "needs-improvement",
      delta: 0.05,
      id: "v4-1",
      navigationType: "navigate",
      attribution: { largestShiftTarget: "body > div.hero" },
    });

    expect(window.__zenflowVitals?.CLS).toBeDefined();
    expect(window.__zenflowVitals?.CLS.value).toBe(0.12);
    expect(window.__zenflowVitals?.CLS.rating).toBe("needs-improvement");
  });

  it("never throws when web-vitals load fails", async () => {
    vi.stubEnv("DEV", true);
    vi.resetModules();
    // Override the mock for this test only to make the import reject.
    vi.doMock("web-vitals/attribution", () => {
      throw new Error("module not found");
    });
    const { initWebVitalsDev } = await import("../reportWebVitals");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(initWebVitalsDev()).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
    vi.doUnmock("web-vitals/attribution");
  });
});
