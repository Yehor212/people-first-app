import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  retryWithBackoff,
  computeBackoff,
  defaultClassifyError,
  CircuitBreaker,
  CircuitOpenError,
} from "../retry";

describe("computeBackoff", () => {
  it("returns 0 for attempt < 1", () => {
    expect(computeBackoff(0, 100, 10_000, "none")).toBe(0);
  });

  it("jitter=none returns deterministic capped value", () => {
    expect(computeBackoff(1, 100, 10_000, "none")).toBe(100);
    expect(computeBackoff(2, 100, 10_000, "none")).toBe(200);
    expect(computeBackoff(3, 100, 10_000, "none")).toBe(400);
    expect(computeBackoff(10, 100, 10_000, "none")).toBe(10_000); // capped
  });

  it("jitter=full bounds delay in [0, capped]", () => {
    // random() returns 0 → delay is 0; random() returns 1 → delay is capped
    expect(computeBackoff(3, 100, 10_000, "full", () => 0)).toBe(0);
    expect(computeBackoff(3, 100, 10_000, "full", () => 0.999999)).toBeCloseTo(
      400 * 0.999999,
      3,
    );
  });

  it("jitter=equal bounds delay in [capped/2, capped]", () => {
    // equal jitter: capped/2 + random * capped/2
    expect(computeBackoff(3, 100, 10_000, "equal", () => 0)).toBe(200);
    expect(computeBackoff(3, 100, 10_000, "equal", () => 1)).toBe(400);
  });

  it("respects capMs across all jitter modes", () => {
    const attempt = 20; // 2^19 * 100 = huge
    expect(computeBackoff(attempt, 100, 500, "none")).toBe(500);
    expect(computeBackoff(attempt, 100, 500, "full", () => 1)).toBeLessThanOrEqual(500);
    expect(computeBackoff(attempt, 100, 500, "equal", () => 1)).toBe(500);
  });
});

describe("defaultClassifyError", () => {
  it("treats AbortError as non-retryable", () => {
    const err = new DOMException("aborted", "AbortError");
    expect(defaultClassifyError(err)).toBe("non-retryable");
  });

  it("treats generic Error as retryable", () => {
    expect(defaultClassifyError(new Error("boom"))).toBe("retryable");
  });

  it("treats unknown primitives as retryable", () => {
    expect(defaultClassifyError("string error")).toBe("retryable");
    expect(defaultClassifyError(null)).toBe("retryable");
    expect(defaultClassifyError(undefined)).toBe("retryable");
  });
});

describe("retryWithBackoff", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves on first attempt when fn succeeds", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await retryWithBackoff(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries up to maxRetries on failure then throws last error", async () => {
    const err = new Error("flaky");
    const fn = vi.fn().mockRejectedValue(err);
    const promise = retryWithBackoff(fn, { maxRetries: 2, baseMs: 1, jitter: "none", capMs: 1 }).catch((e) => e);
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe(err);
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it("returns as soon as fn succeeds on a retry", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("x"))
      .mockRejectedValueOnce(new Error("x"))
      .mockResolvedValue("ok");
    const promise = retryWithBackoff(fn, { maxRetries: 5, baseMs: 1, jitter: "none", capMs: 1 });
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does NOT retry non-retryable errors", async () => {
    const err = new DOMException("aborted", "AbortError");
    const fn = vi.fn().mockRejectedValue(err);
    await expect(retryWithBackoff(fn, { baseMs: 1, jitter: "none" })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("respects custom classifyError", async () => {
    const err = { status: 404 };
    const fn = vi.fn().mockRejectedValue(err);
    const classify = (e: unknown) => {
      if (typeof e === "object" && e !== null && "status" in e) {
        const s = (e as { status: number }).status;
        return s >= 400 && s < 500 ? ("non-retryable" as const) : ("retryable" as const);
      }
      return "retryable" as const;
    };
    await expect(retryWithBackoff(fn, { classifyError: classify })).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("calls onRetry for each retry", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("x"))
      .mockResolvedValue("ok");
    const onRetry = vi.fn();
    const promise = retryWithBackoff(fn, {
      maxRetries: 2,
      baseMs: 1,
      jitter: "none",
      capMs: 1,
      onRetry,
    });
    await vi.runAllTimersAsync();
    await promise;
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), 1);
  });

  it("aborts when signal is aborted before first call", async () => {
    const controller = new AbortController();
    controller.abort();
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(retryWithBackoff(fn, { signal: controller.signal })).rejects.toThrow(/cancelled/i);
    expect(fn).not.toHaveBeenCalled();
  });

  it("aborts mid-wait when signal is aborted during backoff", async () => {
    const controller = new AbortController();
    const fn = vi.fn().mockRejectedValue(new Error("x"));
    const promise = retryWithBackoff(fn, {
      signal: controller.signal,
      maxRetries: 5,
      baseMs: 1000,
      jitter: "none",
      capMs: 1000,
    });
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await expect(promise).rejects.toThrow(/cancelled/i);
  });

  it("uses delaysMs schedule when provided (overrides exponential backoff)", async () => {
    const delays: number[] = [];
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("x"))
      .mockRejectedValueOnce(new Error("x"))
      .mockResolvedValue("ok");
    const promise = retryWithBackoff(fn, {
      maxRetries: 5,
      delaysMs: [1000, 3000, 5000],
      onRetry: (_attempt, _err, ms) => delays.push(ms),
    }).catch((e) => e);
    await vi.runAllTimersAsync();
    await promise;
    expect(delays).toEqual([1000, 3000]); // 2 retries used [0] and [1]
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("delaysMs reuses last entry when attempts exceed array length", async () => {
    const delays: number[] = [];
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("x"))
      .mockRejectedValueOnce(new Error("x"))
      .mockRejectedValueOnce(new Error("x"))
      .mockRejectedValueOnce(new Error("x"))
      .mockResolvedValue("ok");
    const promise = retryWithBackoff(fn, {
      maxRetries: 5,
      delaysMs: [100, 200], // only 2 entries; attempts 3+ should reuse 200
      onRetry: (_attempt, _err, ms) => delays.push(ms),
    }).catch((e) => e);
    await vi.runAllTimersAsync();
    await promise;
    expect(delays).toEqual([100, 200, 200, 200]); // 4 retries, last 2 reuse
  });

  it("gives up when maxElapsedMs is exceeded", async () => {
    // Attach catch before awaiting runAllTimers to avoid phantom unhandled-rejection
    // during fake-timer orchestration.
    const fn = vi.fn().mockRejectedValue(new Error("x"));
    const promise = retryWithBackoff(fn, {
      maxRetries: 100,
      baseMs: 1,
      jitter: "none",
      capMs: 1,
      maxElapsedMs: 0, // exceeded immediately → gives up after first attempt
    }).catch((e) => e);
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe("x");
  });
});

describe("CircuitBreaker", () => {
  it("starts closed", () => {
    const cb = new CircuitBreaker();
    expect(cb.getState()).toBe("closed");
  });

  it("executes fn in closed state", async () => {
    const cb = new CircuitBreaker();
    const result = await cb.execute(async () => "ok");
    expect(result).toBe("ok");
    expect(cb.getState()).toBe("closed");
  });

  it("opens after failureThreshold consecutive failures (respecting volumeThreshold)", async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, volumeThreshold: 3 });
    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(async () => { throw new Error("boom"); })).rejects.toThrow();
    }
    expect(cb.getState()).toBe("open");
  });

  it("short-circuits with CircuitOpenError when open", async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, volumeThreshold: 2 });
    for (let i = 0; i < 2; i++) {
      await expect(cb.execute(async () => { throw new Error("x"); })).rejects.toThrow();
    }
    await expect(cb.execute(async () => "should-not-run")).rejects.toBeInstanceOf(CircuitOpenError);
  });

  it("transitions open → half-open after resetTimeout", async () => {
    let now = 0;
    const cb = new CircuitBreaker({
      failureThreshold: 2,
      volumeThreshold: 2,
      resetTimeoutMs: 100,
      now: () => now,
    });
    for (let i = 0; i < 2; i++) {
      await expect(cb.execute(async () => { throw new Error("x"); })).rejects.toThrow();
    }
    expect(cb.getState()).toBe("open");
    now = 150; // past resetTimeout
    expect(cb.getState()).toBe("half-open");
  });

  it("half-open → closed on success", async () => {
    let now = 0;
    const cb = new CircuitBreaker({
      failureThreshold: 2,
      volumeThreshold: 2,
      resetTimeoutMs: 100,
      now: () => now,
    });
    for (let i = 0; i < 2; i++) {
      await expect(cb.execute(async () => { throw new Error("x"); })).rejects.toThrow();
    }
    now = 150;
    const result = await cb.execute(async () => "recovered");
    expect(result).toBe("recovered");
    expect(cb.getState()).toBe("closed");
  });

  it("half-open → open on failure (re-opens circuit)", async () => {
    let now = 0;
    const cb = new CircuitBreaker({
      failureThreshold: 2,
      volumeThreshold: 2,
      resetTimeoutMs: 100,
      now: () => now,
    });
    for (let i = 0; i < 2; i++) {
      await expect(cb.execute(async () => { throw new Error("x"); })).rejects.toThrow();
    }
    now = 150;
    await expect(cb.execute(async () => { throw new Error("still failing"); })).rejects.toThrow();
    expect(cb.getState()).toBe("open");
  });

  it("reset() forces closed state", async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, volumeThreshold: 1 });
    await expect(cb.execute(async () => { throw new Error("x"); })).rejects.toThrow();
    expect(cb.getState()).toBe("open");
    cb.reset();
    expect(cb.getState()).toBe("closed");
  });

  it("success in closed state resets failure count", async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, volumeThreshold: 3 });
    // 2 failures
    await expect(cb.execute(async () => { throw new Error("x"); })).rejects.toThrow();
    await expect(cb.execute(async () => { throw new Error("x"); })).rejects.toThrow();
    // 1 success
    await cb.execute(async () => "ok");
    // 2 more failures — should NOT open (count was reset)
    await expect(cb.execute(async () => { throw new Error("x"); })).rejects.toThrow();
    await expect(cb.execute(async () => { throw new Error("x"); })).rejects.toThrow();
    expect(cb.getState()).toBe("closed");
  });
});
