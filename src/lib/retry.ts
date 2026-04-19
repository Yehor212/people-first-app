/**
 * retry.ts — Capped exponential backoff with jitter + circuit breaker.
 *
 * Addresses tech-debt audit 2026-04-18 §10.6 — 112 ad-hoc retry/backoff
 * call-sites across 15+ files with no shared util.
 *
 * Design rationale:
 *  - "Capped exponential backoff with jitter" per AWS Builders' Library
 *    (https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/).
 *  - Jitter is REQUIRED, not optional — synchronized clients without jitter
 *    create thundering herds on recovery.
 *  - Error classification: retryable by default, explicit "non-retryable"
 *    classification via classifyError callback. Network/5xx retryable,
 *    4xx not retryable, AbortError never retryable.
 *  - AbortSignal integration so callers can cancel mid-backoff.
 *  - Zero side effects at import — tree-shakeable; unused exports are DCE'd.
 *
 * CircuitBreaker is the companion primitive: prevents cascading retries
 * against a persistently failing dependency. Three states (closed/open/half-open)
 * per the canonical pattern (Fowler, "CircuitBreaker", 2014; Nygard, "Release It!").
 *
 * Usage is OPT-IN. Existing ad-hoc retry sites are NOT migrated in this PR;
 * migration is tracked in memory/project_tech_debt_roadmap_2026-04-18.md
 * and each call-site gets its own PR with tests.
 */

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type ErrorClassification = "retryable" | "non-retryable";

export interface RetryOptions {
  /** Max retry attempts after the first call. Default 3. */
  maxRetries?: number;
  /** Initial delay in ms before the second attempt. Default 200. */
  baseMs?: number;
  /** Max per-attempt delay ceiling. Default 10_000. */
  capMs?: number;
  /** Full jitter (default, AWS-recommended) or equal jitter or none. */
  jitter?: "full" | "equal" | "none";
  /**
   * Explicit delay schedule in ms per attempt (attempt 1 uses delaysMs[0],
   * attempt 2 uses delaysMs[1], etc. Overrun reuses the last value).
   * Overrides baseMs/capMs/jitter when provided. Useful for call-sites with
   * a tuned fixed schedule (e.g. `[1000, 3000, 5000]`) that predate this util
   * and cannot change behavior for backwards compatibility.
   */
  delaysMs?: number[];
  /** Total time budget in ms. Retry loop aborts if exceeded. Default 30_000. */
  maxElapsedMs?: number;
  /** External cancellation. Throws AbortError if aborted mid-wait. */
  signal?: AbortSignal;
  /**
   * Decide if an error is retryable. Default: AbortError → non-retryable;
   * anything else → retryable. Implement for HTTP status-code classification.
   */
  classifyError?: (error: unknown) => ErrorClassification;
  /** Called before each retry attempt. Use for logging/telemetry. */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

const DEFAULTS: Required<Omit<RetryOptions, "signal" | "classifyError" | "onRetry">> = {
  maxRetries: 3,
  baseMs: 200,
  capMs: 10_000,
  jitter: "full",
  maxElapsedMs: 30_000,
};

// ────────────────────────────────────────────────────────────────────────────
// Default classification
// ────────────────────────────────────────────────────────────────────────────

/**
 * Default classifier: AbortError → non-retryable, TypeError network errors → retryable,
 * everything else → retryable. Intended as a safe default; callers with HTTP
 * semantics should provide their own (e.g. 4xx → non-retryable).
 */
export function defaultClassifyError(error: unknown): ErrorClassification {
  if (typeof error === "object" && error !== null && "name" in error) {
    const name = (error as { name: string }).name;
    if (name === "AbortError") return "non-retryable";
  }
  return "retryable";
}

// ────────────────────────────────────────────────────────────────────────────
// Backoff math
// ────────────────────────────────────────────────────────────────────────────

/**
 * Compute the next delay (ms) for retry attempt `attempt` (1-indexed).
 * Exponential base: baseMs * 2^(attempt-1), clamped at capMs, then jittered.
 *
 * Jitter modes:
 *  - full:  random in [0, capped]            — AWS default, maximum smoothing
 *  - equal: capped/2 + random(0, capped/2)   — half-jitter, partial smoothing
 *  - none:  capped                            — deterministic, no smoothing
 */
export function computeBackoff(
  attempt: number,
  baseMs: number,
  capMs: number,
  jitter: "full" | "equal" | "none",
  random: () => number = Math.random,
): number {
  if (attempt < 1) return 0;
  const capped = Math.min(capMs, baseMs * Math.pow(2, attempt - 1));
  switch (jitter) {
    case "none":
      return capped;
    case "equal":
      return capped / 2 + random() * (capped / 2);
    case "full":
    default:
      return random() * capped;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// retryWithBackoff
// ────────────────────────────────────────────────────────────────────────────

/**
 * Run `fn` with capped exponential backoff + jitter on failure.
 *
 * Throws the last observed error if:
 *  - maxRetries exceeded, OR
 *  - error classified as non-retryable, OR
 *  - maxElapsedMs budget exceeded, OR
 *  - signal aborted.
 *
 * Note: retryWithBackoff does NOT own timeouts on `fn` itself — pass a signal
 * and let `fn` honor it (e.g. fetch(url, { signal })).
 */
export async function retryWithBackoff<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const cfg = { ...DEFAULTS, ...options };
  const classify = options.classifyError ?? defaultClassifyError;
  const started = Date.now();
  let lastError: unknown;

  const useExplicitDelays = Array.isArray(options.delaysMs) && options.delaysMs.length > 0;

  for (let attempt = 1; attempt <= cfg.maxRetries + 1; attempt++) {
    if (options.signal?.aborted) {
      throw new DOMException("Retry cancelled", "AbortError");
    }
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (classify(err) === "non-retryable") throw err;
      if (attempt > cfg.maxRetries) throw err;
      if (Date.now() - started >= cfg.maxElapsedMs) throw err;

      const delay = useExplicitDelays
        ? options.delaysMs![Math.min(attempt - 1, options.delaysMs!.length - 1)]
        : computeBackoff(attempt, cfg.baseMs, cfg.capMs, cfg.jitter);
      options.onRetry?.(attempt, err, delay);
      await waitWithAbort(delay, options.signal);
    }
  }

  // Unreachable: loop either returns or throws. Narrow for TS.
  throw lastError;
}

function waitWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Retry cancelled", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Retry cancelled", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

// ────────────────────────────────────────────────────────────────────────────
// CircuitBreaker
// ────────────────────────────────────────────────────────────────────────────

export type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerOptions {
  /** Failures in the current rolling window before opening. Default 5. */
  failureThreshold?: number;
  /** Time the circuit stays open before probing (half-open). Default 30_000 ms. */
  resetTimeoutMs?: number;
  /** Minimum call volume before threshold applies. Default 3. */
  volumeThreshold?: number;
  /** Now-function for testing. Default Date.now. */
  now?: () => number;
}

/**
 * State machine:
 *
 *   closed ──(failures >= threshold)──▶ open
 *   open ──(after resetTimeoutMs)──▶ half-open
 *   half-open ──(success)──▶ closed
 *   half-open ──(failure)──▶ open (reset timer)
 *
 * Short-circuits calls in `open` state with CircuitOpenError — callers should
 * fallback / degrade gracefully rather than retry.
 */
export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures = 0;
  private calls = 0;
  private openedAt = 0;
  private readonly cfg: Required<CircuitBreakerOptions>;

  constructor(options: CircuitBreakerOptions = {}) {
    this.cfg = {
      failureThreshold: options.failureThreshold ?? 5,
      resetTimeoutMs: options.resetTimeoutMs ?? 30_000,
      volumeThreshold: options.volumeThreshold ?? 3,
      now: options.now ?? Date.now,
    };
  }

  getState(): CircuitState {
    this.maybeHalfOpen();
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.maybeHalfOpen();
    if (this.state === "open") {
      throw new CircuitOpenError(
        `Circuit is open; retry after ${this.msUntilHalfOpen()}ms`,
      );
    }
    this.calls++;
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  reset(): void {
    this.state = "closed";
    this.failures = 0;
    this.calls = 0;
    this.openedAt = 0;
  }

  private onSuccess(): void {
    if (this.state === "half-open") {
      this.reset();
    } else {
      // Reset failure count on any success in closed state.
      this.failures = 0;
    }
  }

  private onFailure(): void {
    this.failures++;
    if (this.state === "half-open") {
      this.open();
      return;
    }
    if (
      this.calls >= this.cfg.volumeThreshold &&
      this.failures >= this.cfg.failureThreshold
    ) {
      this.open();
    }
  }

  private open(): void {
    this.state = "open";
    this.openedAt = this.cfg.now();
  }

  private maybeHalfOpen(): void {
    if (this.state === "open" && this.msUntilHalfOpen() <= 0) {
      this.state = "half-open";
      this.failures = 0;
    }
  }

  private msUntilHalfOpen(): number {
    return this.cfg.resetTimeoutMs - (this.cfg.now() - this.openedAt);
  }
}

export class CircuitOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CircuitOpenError";
  }
}
