/**
 * Bounded runtime error buffer.
 *
 * Global failures are retained in memory so the current runtime can recover
 * without starting optional external diagnostics. `setCaptureSink` remains an
 * explicit integration boundary: a future caller must first establish the
 * product's durable diagnostics-consent contract.
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
 * Register an authorized diagnostics sink. Flushes buffered errors
 * synchronously, tagging each with `buffered: true`. Idempotent: calling twice
 * replaces the sink but does not re-flush.
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
