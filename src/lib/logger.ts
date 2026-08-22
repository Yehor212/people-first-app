/**
 * Development-only logger utility
 * Only logs messages in development environment to prevent
 * sensitive data leakage in production.
 */

import { IS_DEV } from "@/lib/env";

const isDev = IS_DEV;

const REDACTED = "[REDACTED]";
const SAFE_ERROR_NAMES = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "URIError",
  "EvalError",
  "AggregateError",
  "AbortError",
  "QuotaExceededError",
  "NotAllowedError",
  "NotFoundError",
  "InvalidStateError",
  "NetworkError",
  "TimeoutError",
]);
const SENSITIVE_FIELD_NAME_PATTERN =
  /(?:^|[_-])(?:user[_-]?id|user[_-]?name|display[_-]?name|friend[_-]?name|authorization|access[_-]?token|refresh[_-]?token|id[_-]?token|session[_-]?token|token|jwt|(?:recovery)?secret|password|cookie|email|(?:journal|diary)(?:[_-]?(?:entry|text|content|note|notes))?|mood[_-]?(?:note|notes|text|content)?|habit[_-]?(?:name|content|note|notes|text)|(?:reflection|gratitude)[_-]?(?:text|content|note|notes)?|coach[_-]?(?:prompt|response|message|content)|audio[_-]?(?:transcript|note|notes|content)|entry[_-]?(?:title|text|content|note|notes)|content|body|text|title|note|notes|prompt|response|transcript|message|detail|error)(?:s|name)?(?:$|[_-])/i;
function sanitizeError(error: Error): { name: string } {
  return { name: SAFE_ERROR_NAMES.has(error.name) ? error.name : "Error" };
}

function sanitizeValue(value: unknown, seen = new WeakSet<object>()): unknown {
  // FR-031: strings are free-form. A generic key or positional argument can
  // still contain diary prose, a habit name, a mood note, a token, or PII.
  if (typeof value === "string") return REDACTED;
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Error) return sanitizeError(value);
  if (value instanceof Date) return value.toISOString();
  if (seen.has(value)) return "[Circular]";

  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, seen));
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    return "[Unsupported object]";
  }
  return sanitizeLogData(value as Record<string, unknown>, seen);
}

function sanitizeArgs(args: unknown[]): unknown[] {
  return args.map((arg) => sanitizeValue(arg));
}

function sanitizeLogData(
  data: Record<string, unknown>,
  seen = new WeakSet<object>(),
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    safe[key] = SENSITIVE_FIELD_NAME_PATTERN.test(key)
      ? REDACTED
      : sanitizeValue(value, seen);
  }
  return safe;
}

export const logger = {
  log: (...args: unknown[]) => {
    if (isDev) {
      console.log("[Log]", ...sanitizeArgs(args));
    }
  },

  info: (...args: unknown[]) => {
    if (isDev) {
      console.log("[Info]", ...sanitizeArgs(args));
    }
  },

  warn: (...args: unknown[]) => {
    if (isDev) {
      console.warn("[Warn]", ...sanitizeArgs(args));
    }
  },

  error: (...args: unknown[]) => {
    // Always log errors, but sanitize in production
    if (isDev) {
      console.error("[Error]", ...sanitizeArgs(args));
    } else {
      // FR-031: error messages can contain diary prose, habit content, mood
      // notes, auth tokens, or PII. Production gets only a fixed marker.
      console.error("[Error]");
    }
  },

  // For sync operations - never logs user IDs or tokens
  sync: (message: string, data?: Record<string, unknown>) => {
    if (isDev) {
      // Remove sensitive fields from logged data
      const safeData = data ? sanitizeLogData(data) : undefined;
      void message;
      console.log("[Sync]", safeData);
    }
  },

  // For auth operations
  auth: (message: string) => {
    if (isDev) {
      void message;
      console.log("[Auth]");
    }
  },
};

export default logger;
