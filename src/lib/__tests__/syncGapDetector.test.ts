import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SyncGapDetector } from "../syncGapDetector";

vi.mock("@/lib/logger", () => ({
  logger: { sync: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("SyncGapDetector", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const makeDetector = (
    lastSeq = 5,
    overrides: Partial<{
      onFallbackToSnapshot: () => void;
      onPullRange: (fromSeq: number) => Promise<void>;
    }> = {}
  ) => {
    const onFallback = overrides.onFallbackToSnapshot ?? vi.fn();
    const onPullRange = overrides.onPullRange ?? vi.fn().mockResolvedValue(undefined);

    const detector = new SyncGapDetector(lastSeq, {
      gapWaitMs: 500,
      maxGapSize: 100,
      onFallbackToSnapshot: onFallback,
      onPullRange,
    });

    return { detector, onFallback, onPullRange };
  };

  it("returns true for in-order events", () => {
    const { detector } = makeDetector(5);
    expect(detector.onEventSignal(6)).toBe(true);
    expect(detector.onEventSignal(7)).toBe(true);
    expect(detector.onEventSignal(8)).toBe(true);
    detector.destroy();
  });

  it("returns false for duplicate events", () => {
    const { detector } = makeDetector(5);
    expect(detector.onEventSignal(5)).toBe(false); // already seen
    expect(detector.onEventSignal(3)).toBe(false); // old
    detector.destroy();
  });

  it("detects gap and triggers pull after timeout", async () => {
    const onPullRange = vi.fn().mockResolvedValue(undefined);
    const { detector } = makeDetector(5, { onPullRange });

    // Receive seq=8 (gap: 6, 7 missing)
    expect(detector.onEventSignal(8)).toBe(false);

    // Advance past gap wait
    await vi.advanceTimersByTimeAsync(600);

    expect(onPullRange).toHaveBeenCalledWith(5); // pull from last known
    detector.destroy();
  });

  it("fills gap naturally without triggering pull", () => {
    const onPullRange = vi.fn();
    const { detector } = makeDetector(5, { onPullRange });

    // Receive seq=7 (gap: 6 missing)
    detector.onEventSignal(7);

    // seq=6 arrives before timer
    expect(detector.onEventSignal(6)).toBe(true);

    // Timer should be cleared, no pull
    expect(onPullRange).not.toHaveBeenCalled();
    detector.destroy();
  });

  it("falls back to snapshot for large gaps", () => {
    const onFallback = vi.fn();
    const { detector } = makeDetector(5, { onFallbackToSnapshot: onFallback });

    // Gap of 200 exceeds maxGapSize=100
    detector.onEventSignal(206);

    expect(onFallback).toHaveBeenCalledTimes(1);
    detector.destroy();
  });

  it("resetTo updates expected seq", () => {
    const { detector } = makeDetector(5);
    detector.resetTo(100);

    // After reset, seq=101 should be in order
    expect(detector.onEventSignal(101)).toBe(true);
    detector.destroy();
  });
});
