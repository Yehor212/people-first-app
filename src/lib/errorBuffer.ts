/**
 * Bounded runtime error buffer.
 *
 * Global failures are retained in memory so the current runtime can recover
 * without starting optional external diagnostics. `setCaptureSink` remains an
 * explicit integration boundary: a future caller must first establish the
 * product's durable diagnostics-consent contract.
 */

import {
  sanitizeDiagnosticMetadata,
  toDiagnosticError,
} from "@/lib/diagnosticPrivacy";
import { logger } from "@/lib/logger";
import { registerAccountBoundaryRuntimeReset } from "@/storage/accountBoundaryRuntime";

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
  const safeError = toDiagnosticError(error, "ZF_RUNTIME_ERROR");
  const safeContext = sanitizeDiagnosticMetadata(context);
  if (sink) {
    sink(safeError, safeContext);
    return;
  }
  if (buffer.length < BUFFER_CAP) {
    buffer.push({ error: safeError, context: safeContext });
  } else {
    logger.warn("[ErrorBuffer]");
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
      // A broken sink must not abort the flush, but the fixed-code failure is visible.
      logger.warn("[ErrorBufferSink]");
    }
  }
}

/** Clear the current-runtime buffer at a privacy/account boundary. */
export function clearBufferedDiagnostics(): void {
  buffer.length = 0;
}

registerAccountBoundaryRuntimeReset(clearBufferedDiagnostics);

/** Reset for testing. Not exported from main module boundary. */
export function __resetForTests(): void {
  sink = null;
  clearBufferedDiagnostics();
}

/** Read-only snapshot for testing/observability. */
export function __bufferSize(): number {
  return buffer.length;
}
