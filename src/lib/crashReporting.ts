/**
 * Crash Reporting Wrapper
 * Provides a unified interface for crash reporting.
 * External collection remains disabled until a durable user choice is wired.
 * Local records contain only fixed codes and bounded allowlisted metadata.
 */

import { isNative } from "@/lib/platform";
import { logger } from "./logger";
import {
  clearLocalDiagnosticRecords,
  DIAGNOSTIC_CODES,
  getExternalDiagnosticSinkState,
  LOCAL_CRASH_RECORD_LIMIT,
  persistLocalDiagnosticRecord,
  type ExternalDiagnosticSinkState,
} from "@/lib/diagnosticPrivacy";
import { SK } from "@/lib/storageKeys";

export interface CrashReportingState {
  externalSink: ExternalDiagnosticSinkState;
  localRecordLimit: number;
}

interface CrashReportingInterface {
  log: (message: string) => void;
  recordError: (error: Error, context?: Record<string, unknown>) => void;
  setUserId: (userId: string | null) => void;
  setEnabled: (enabled: boolean) => void;
  setCustomKey: (key: string, value: string | number | boolean) => void;
  clearLocalRecords: () => void;
  getState: () => CrashReportingState;
}

// isNative imported from @/lib/platform

// For native platforms, Firebase Crashlytics is automatically initialized
// and captures crashes. These methods provide additional logging.

const webFallback: CrashReportingInterface = {
  log: (_message: string) => {
    logger.log(DIAGNOSTIC_CODES.crash);
  },

  recordError: (_error: Error, context?: Record<string, unknown>) => {
    logger.error(DIAGNOSTIC_CODES.crash);
    persistLocalDiagnosticRecord(
      SK.CRASH_LOG,
      DIAGNOSTIC_CODES.crash,
      context,
      LOCAL_CRASH_RECORD_LIMIT
    );
  },

  setUserId: (_userId: string | null) => {
    // Raw or pseudonymous owner identifiers are outside the diagnostic contract.
  },

  setEnabled: (_enabled: boolean) => {
    // This compatibility method cannot enable a sink. A future durable consent
    // flow must use the explicit Sentry/Crashlytics integration boundary.
  },

  setCustomKey: (_key: string, _value: string | number | boolean) => {
    // Arbitrary keys and values are intentionally ignored.
  },

  clearLocalRecords: clearLocalDiagnosticRecords,
  getState: () => ({
    externalSink: getExternalDiagnosticSinkState(),
    localRecordLimit: LOCAL_CRASH_RECORD_LIMIT,
  }),
};

// For native platforms, we use the native Crashlytics through the WebView bridge
// Firebase Crashlytics captures crashes automatically, but we can add context
const nativeCrashlytics: CrashReportingInterface = {
  log: (_message: string) => {
    console.log(DIAGNOSTIC_CODES.crash);
  },

  recordError: (_error: Error, context?: Record<string, unknown>) => {
    console.error(DIAGNOSTIC_CODES.crash);
    persistLocalDiagnosticRecord(
      SK.CRASH_LOG,
      DIAGNOSTIC_CODES.crash,
      { ...context, native: true },
      LOCAL_CRASH_RECORD_LIMIT
    );
  },

  setUserId: (_userId: string | null) => {
    // User ID is set via Firebase Crashlytics SDK internally.
    // Do not log any part of userId to console (PII leak in production).
  },

  setEnabled: (_enabled: boolean) => {
    // AndroidManifest keeps automatic collection false. This compatibility
    // method cannot cross that boundary.
  },

  setCustomKey: (_key: string, _value: string | number | boolean) => {
    // Arbitrary Crashlytics keys are outside the allowlist.
  },

  clearLocalRecords: clearLocalDiagnosticRecords,
  getState: () => ({
    externalSink: getExternalDiagnosticSinkState(),
    localRecordLimit: LOCAL_CRASH_RECORD_LIMIT,
  }),
};

export const crashReporting: CrashReportingInterface = isNative ? nativeCrashlytics : webFallback;

// Helper to record errors from anywhere in the app
export const recordError = (error: unknown, context?: Record<string, unknown>) => {
  if (error instanceof Error) {
    crashReporting.recordError(error, context);
  } else {
    crashReporting.recordError(new Error(DIAGNOSTIC_CODES.crash), context);
  }
};

// Helper to wrap async functions with error recording
export const withCrashReporting = <T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  context?: Record<string, unknown>
): T => {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      recordError(error, context);
      throw error;
    }
  }) as T;
};
