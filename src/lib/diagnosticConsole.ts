/**
 * Last-line console egress guard for framework/browser code that bypasses the
 * application logger. Install before React renders so caught boundary errors
 * cannot write raw Error messages, causes, query strings, or user content.
 */

import { sanitizeDiagnosticLogArgs } from "./diagnosticPrivacy";

type GuardedConsoleMethod = "error" | "warn";

const FRAMEWORK_ERROR_CODE = "ZF_FRAMEWORK_CONSOLE_ERROR";
const FRAMEWORK_WARN_CODE = "ZF_FRAMEWORK_CONSOLE_WARNING";

let installed = false;

export function installDiagnosticConsoleBoundary(): void {
  if (installed || typeof console === "undefined") return;
  installed = true;

  const wrap = (method: GuardedConsoleMethod, fallback: string) => {
    // eslint-disable-next-line no-console -- this module is the console egress boundary
    const original = console[method].bind(console);
    // eslint-disable-next-line no-console -- replace the sink before framework code runs
    console[method] = (...args: unknown[]) => {
      original(...sanitizeDiagnosticLogArgs(args, fallback));
    };
  };

  wrap("error", FRAMEWORK_ERROR_CODE);
  wrap("warn", FRAMEWORK_WARN_CODE);
}
