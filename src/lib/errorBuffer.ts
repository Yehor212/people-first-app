/**
 * Pre-Sentry error buffer.
 *
 * Sentry is lazy-loaded via requestIdleCallback (~2s after first paint) to keep
 * @sentry/* off the critical rendering path. Errors thrown before idle-init
 * completes have no destination — the global handlers would silently drop them.
 *
 * This module holds a small FIFO buffer. `captureOrBuffer` routes to the
 * registered sink if Sentry is ready, otherwise enqueues. `setCaptureSink` is
 * called exactly once by the Sentry bootstrap and automatically flushes the
 * buffer.
 *
 * Pattern mirrors Sentry JS Loader's `onLoad` queue.
 * Source: docs.sentry.io/platforms/javascript/install/lazy-load-sentry/ (2025).
 */

export type CaptureSink = (error: Error, context?: Record<string, unknown>) => void;

export const BUFFER_CAP = 50;

interface BufferedError {
  error: Error;
  context: Record<string, unknown>;
}

let sink: CaptureSink | null = null;
const buffer: BufferedError[] = [];

/**
 * Capture an error. If the Sentry sink is registered, forward immediately.
 * Otherwise, buffer up to BUFFER_CAP entries (bounded to prevent OOM on crash
 * loops). Overflow is silently dropped — bootstrap errors are the priority.
 */
export function captureOrBuffer(error: Error, context: Record<string, unknown> = {}): void {
  if (sink) {
    sink(error, context);
    return;
  }
  if (buffer.length < BUFFER_CAP) {
    buffer.push({ error, context });
  }
}

/**
 * Register the Sentry sink. Flushes all buffered errors synchronously, tagging
 * each with `buffered: true` for telemetry differentiation. Idempotent: calling
 * twice replaces the sink but does not re-flush.
 */
export function setCaptureSink(nextSink: CaptureSink): void {
  sink = nextSink;
  if (buffer.length === 0) return;
  const snapshot = buffer.splice(0, buffer.length);
  for (const { error, context } of snapshot) {
    try {
      nextSink(error, { ...context, buffered: true });
    } catch {
      // Swallow per-error sink failures — a broken sink must not take out
      // the whole flush loop.
    }
  }
}

/** Reset for testing. Not exported from main module boundary. */
export function __resetForTests(): void {
  sink = null;
  buffer.length = 0;
}

/** Read-only snapshot for testing/observability. */
export function __bufferSize(): number {
  return buffer.length;
}
