import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scheduleIdle } from "../scheduleIdle";

describe("scheduleIdle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("uses requestIdleCallback when available", () => {
    const fn = vi.fn();
    const ric = vi.fn((cb: () => void) => {
      cb();
      return 42;
    });
    const cic = vi.fn();
    vi.stubGlobal("requestIdleCallback", ric);
    vi.stubGlobal("cancelIdleCallback", cic);

    const handle = scheduleIdle(fn);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(ric).toHaveBeenCalledTimes(1);

    handle.cancel();
    expect(cic).toHaveBeenCalledWith(42);
  });

  it("falls back to setTimeout when requestIdleCallback is absent", () => {
    const fn = vi.fn();
    // Simulate Safari <16.4 — delete the global
    const windowWithoutRic = window as unknown as Record<string, unknown>;
    const original = windowWithoutRic.requestIdleCallback;
    delete windowWithoutRic.requestIdleCallback;

    try {
      const handle = scheduleIdle(fn, 1500);
      expect(fn).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1499);
      expect(fn).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(fn).toHaveBeenCalledTimes(1);

      // cancel after fire is a no-op (just should not throw)
      expect(() => handle.cancel()).not.toThrow();
    } finally {
      if (original !== undefined) {
        windowWithoutRic.requestIdleCallback = original;
      }
    }
  });

  it("cancel() prevents setTimeout fallback from firing", () => {
    const fn = vi.fn();
    const windowWithoutRic = window as unknown as Record<string, unknown>;
    const original = windowWithoutRic.requestIdleCallback;
    delete windowWithoutRic.requestIdleCallback;

    try {
      const handle = scheduleIdle(fn, 500);
      handle.cancel();
      vi.advanceTimersByTime(1000);
      expect(fn).not.toHaveBeenCalled();
    } finally {
      if (original !== undefined) {
        windowWithoutRic.requestIdleCallback = original;
      }
    }
  });
});
