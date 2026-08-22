/**
 * Crash reporting boundary shared by web and native shells.
 * Raw Error messages, causes, stacks, identity values, and arbitrary context
 * never cross the console/native/local-retention boundary.
 */

import { isNative } from "@/lib/platform";
import {
  diagnosticErrorName,
  diagnosticStackFingerprint,
  sanitizeDiagnosticErrorName,
  sanitizeDiagnosticMetadata,
  sanitizeDiagnosticStackFingerprint,
  toDiagnosticError,
} from "./diagnosticPrivacy";
import { logger } from "./logger";
import { safeLocalStorageGet, safeLocalStorageSet } from "./safeJson";
import { SK } from "@/lib/storageKeys";

const CRASH_REPORT_CODE = "ZF_CRASH_RECORDED";
const CRASH_LOG_CODE = "ZF_CRASH_LOG";
const CRASH_REPORT_LIMIT = 20;
export const CRASH_REPORT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

interface RetainedCrashReport {
  code: typeof CRASH_REPORT_CODE;
  errorName: string;
  stackFingerprint: string;
  context?: Record<string, unknown>;
  time: string;
}

interface CrashReportingInterface {
  log: (message: string) => void;
  recordError: (error: Error, context?: Record<string, string>) => void;
  setUserId: (userId: string | null) => void;
  setEnabled: (enabled: boolean) => void;
  setCustomKey: (key: string, value: string | number | boolean) => void;
  clearRetainedReports: () => boolean;
}

function normalizeRetainedReport(
  value: unknown,
  cutoff: number,
): RetainedCrashReport | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const report = value as Partial<RetainedCrashReport>;
  const timestamp = typeof report.time === "string" ? Date.parse(report.time) : NaN;
  if (
    report.code !== CRASH_REPORT_CODE ||
    !Number.isFinite(timestamp) ||
    timestamp < cutoff ||
    timestamp > Date.now()
  ) {
    return null;
  }

  const context = report.context && typeof report.context === "object" && !Array.isArray(report.context)
    ? sanitizeDiagnosticMetadata(report.context)
    : undefined;
  return {
    code: CRASH_REPORT_CODE,
    errorName: sanitizeDiagnosticErrorName(report.errorName),
    stackFingerprint: sanitizeDiagnosticStackFingerprint(report.stackFingerprint),
    ...(context ? { context } : {}),
    time: new Date(timestamp).toISOString(),
  };
}

function clearWebCrashReports(): boolean {
  return safeLocalStorageSet(SK.CRASH_LOG, []);
}

function readCurrentCrashReports(): RetainedCrashReport[] {
  const cutoff = Date.now() - CRASH_REPORT_RETENTION_MS;
  const stored = safeLocalStorageGet<unknown>(SK.CRASH_LOG, []);
  if (!Array.isArray(stored)) return [];
  return stored
    .map((candidate) => normalizeRetainedReport(candidate, cutoff))
    .filter((candidate): candidate is RetainedCrashReport => candidate !== null)
    .slice(-CRASH_REPORT_LIMIT);
}

/** Remove legacy, malformed, and expired reports during application startup. */
export function pruneRetainedCrashReports(): boolean {
  try {
    const success = safeLocalStorageSet(SK.CRASH_LOG, readCurrentCrashReports());
    if (!success) logger.error("[CrashRetention]");
    return success;
  } catch {
    logger.error("[CrashRetention]");
    return false;
  }
}

const webFallback: CrashReportingInterface = {
  log: (_message: string) => {
    logger.log("[Crash]");
  },

  recordError: (error: Error, context?: Record<string, string>) => {
    const safeContext = context ? sanitizeDiagnosticMetadata(context) : undefined;
    const entry: RetainedCrashReport = {
      code: CRASH_REPORT_CODE,
      errorName: diagnosticErrorName(error),
      stackFingerprint: diagnosticStackFingerprint(error),
      ...(safeContext ? { context: safeContext } : {}),
      time: new Date().toISOString(),
    };

    logger.error("[Crash]", {
      code: entry.code,
      errorName: entry.errorName,
      stackFingerprint: entry.stackFingerprint,
      ...(safeContext ? { diagnostic: safeContext } : {}),
    });

    try {
      const existing = readCurrentCrashReports();
      const next = [...existing, entry].slice(-CRASH_REPORT_LIMIT);
      if (!safeLocalStorageSet(SK.CRASH_LOG, next)) {
        logger.error("[CrashRetention]");
      }
    } catch {
      logger.error("[CrashRetention]");
    }
  },

  setUserId: (userId: string | null) => {
    logger.log("[CrashIdentity]", { state: userId ? "set" : "cleared" });
  },

  setEnabled: (enabled: boolean) => {
    logger.log("[CrashReporting]", { enabled });
  },

  setCustomKey: (_key: string, _value: string | number | boolean) => {
    logger.log("[CrashCustomKey]");
  },

  clearRetainedReports: clearWebCrashReports,
};

const nativeConsoleFallback: CrashReportingInterface = {
  log: (_message: string) => {
    console.log("[ZenFlow]", CRASH_LOG_CODE);
  },

  recordError: (error: Error, context?: Record<string, string>) => {
    console.error("[Crash]", CRASH_REPORT_CODE, {
      error_name: diagnosticErrorName(error),
      stack_fingerprint: diagnosticStackFingerprint(error),
    });
    if (context) {
      console.error(
        "[Crash]",
        JSON.stringify(sanitizeDiagnosticMetadata(context)),
      );
    }
  },

  setUserId: (_userId: string | null) => {
    // Native identity association is SDK-owned; raw identifiers are never logged here.
  },

  setEnabled: (_enabled: boolean) => {
    console.log("[ZenFlow Crash]", "ZF_CRASH_REPORTING_UNSUPPORTED");
  },

  setCustomKey: (_key: string, _value: string | number | boolean) => {
    console.log("[ZenFlow Crash]", "ZF_CRASH_CUSTOM_KEY");
  },

  // No native SDK bridge exists for clearing provider/OS queues. Returning
  // false is an honest unsupported receipt; JS/account storage is cleared by
  // the account-boundary path independently.
  clearRetainedReports: () => false,
};

export const crashReporting: CrashReportingInterface = isNative
  ? nativeConsoleFallback
  : webFallback;

export const recordError = (error: unknown, context?: Record<string, string>) => {
  crashReporting.recordError(
    error instanceof Error ? error : toDiagnosticError(error, CRASH_REPORT_CODE),
    context,
  );
};

export const withCrashReporting = <T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  context?: Record<string, string>,
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
