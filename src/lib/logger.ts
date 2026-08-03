/**
 * Development-only logger utility
 * Only logs messages in development environment to prevent
 * sensitive data leakage in production.
 */

import { IS_DEV } from "@/lib/env";

const isDev = IS_DEV;

export const logger = {
  log: (...args: unknown[]) => {
    if (isDev) {
      console.log(...sanitizeArgs(args));
    }
  },

  info: (...args: unknown[]) => {
    if (isDev) {
      console.log(...sanitizeArgs(args));
    }
  },

  warn: (...args: unknown[]) => {
    if (isDev) {
      console.warn(...sanitizeArgs(args));
    }
  },

  error: (...args: unknown[]) => {
    // Always log errors, but sanitize in production
    if (isDev) {
      console.error(...sanitizeArgs(args));
    } else {
      // In production, only log generic error message
      console.error("[Error]", args[0] instanceof Error ? args[0].message : "An error occurred");
    }
  },

  // For sync operations - never logs user IDs or tokens
  sync: (message: string, data?: Record<string, unknown>) => {
    if (isDev) {
      // Remove sensitive fields from logged data
      const safeData = data ? sanitizeLogData(data) : undefined;
      console.log(`[Sync] ${message}`, safeData);
    }
  },

  // For auth operations
  auth: (message: string) => {
    if (isDev) {
      console.log(`[Auth] ${message}`);
    }
  },
};

// Sanitize each argument: plain objects go through sanitizeLogData,
// primitives, Errors, arrays, and other non-plain values pass through unchanged.
const sanitizeArgs = (args: unknown[]): unknown[] =>
  args.map((arg) => {
    if (
      typeof arg === "object" &&
      arg !== null &&
      !(arg instanceof Error) &&
      !Array.isArray(arg) &&
      Object.getPrototypeOf(arg) === Object.prototype
    ) {
      return sanitizeLogData(arg as Record<string, unknown>);
    }
    return arg;
  });

// Remove sensitive fields from log data
const sanitizeLogData = (data: Record<string, unknown>): Record<string, unknown> => {
  const sensitiveKeys = [
    "user_id",
    "userId",
    "token",
    "access_token",
    "refresh_token",
    "password",
    "email",
    "secret",
  ];
  const safe: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk.toLowerCase()))) {
      safe[key] = "[REDACTED]";
    } else if (Array.isArray(value)) {
      safe[key] = value.map((item) =>
        typeof item === "object" && item !== null && !Array.isArray(item)
          ? sanitizeLogData(item as Record<string, unknown>)
          : item
      );
    } else if (typeof value === "object" && value !== null) {
      safe[key] = sanitizeLogData(value as Record<string, unknown>);
    } else {
      safe[key] = value;
    }
  }

  return safe;
};

export default logger;
