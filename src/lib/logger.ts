/**
 * Fixed-code diagnostic logger.
 *
 * Caller-provided strings are private by default. Every console boundary uses
 * a stable subsystem code plus bounded, allowlisted metadata.
 */

import { IS_DEV } from "@/lib/env";
import {
  sanitizeDiagnosticLogArgs,
  sanitizeDiagnosticMetadata,
} from "@/lib/diagnosticPrivacy";

const isDev = IS_DEV;

function devLog(method: "log" | "warn", args: unknown[]): void {
  if (!isDev) return;
  console[method](...sanitizeDiagnosticLogArgs(args));
}

export const logger = {
  log: (...args: unknown[]) => {
    devLog("log", args);
  },

  info: (...args: unknown[]) => {
    devLog("log", args);
  },

  warn: (...args: unknown[]) => {
    devLog("warn", args);
  },

  error: (...args: unknown[]) => {
    console.error(...sanitizeDiagnosticLogArgs(args, "ZF_RUNTIME_ERROR"));
  },

  sync: (_message: string, data?: Record<string, unknown>) => {
    if (!isDev) return;
    console.log(
      "ZF_SYNC_DIAGNOSTIC",
      data ? sanitizeDiagnosticMetadata(data) : undefined,
    );
  },

  auth: (_message: string) => {
    if (isDev) console.log("ZF_AUTH_DIAGNOSTIC");
  },
};

export default logger;
