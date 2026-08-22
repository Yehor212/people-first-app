/**
 * Sentry Error Monitoring Integration
 *
 * Sends crash reports and performance data to Sentry for monitoring.
 * Respects user privacy by stripping PII before sending.
 *
 * Free tier: 5,000 errors/month, 10,000 transactions/month
 */

import * as Sentry from "@sentry/browser";
import type { Breadcrumb, BreadcrumbHint, Integration, SeverityLevel } from "@sentry/core";
import {
  SENTRY_ALLOW_URLS,
  SENTRY_IGNORE_ERRORS,
  shouldDropSentryEvent,
} from "@/lib/sentryEventFilters";

// Declare global app version
declare const __APP_VERSION__: string;

const IS_DEV = import.meta.env.DEV;
const MODE = import.meta.env.MODE;
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

function isUsableSentryDsn(dsn: string | undefined): dsn is string {
  const value = dsn?.trim();
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === "https:" && /(^|\.)sentry\.io$/i.test(url.hostname);
  } catch {
    return false;
  }
}

const SENSITIVE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9\-_.]+/gi,
  /access_token[=:]\s*["']?[A-Za-z0-9\-_.]+["']?/gi,
  /refresh_token[=:]\s*["']?[A-Za-z0-9\-_.]+["']?/gi,
  /id_token[=:]\s*["']?[A-Za-z0-9\-_.]+["']?/gi,
  /token[=:]\s*["']?[A-Za-z0-9\-_.]{20,}["']?/gi,
  /[#&](access_token|refresh_token|id_token|token)=[^&\s"'}]+/gi,
] as const;

const SENSITIVE_FIELD_NAME_PATTERN =
  /(^|[_-])(authorization|access[_-]?token|refresh[_-]?token|id[_-]?token|session[_-]?token|token|jwt|secret|password|cookie)s?($|[_-])/i;

// Structured telemetry must never carry ZenFlow's private writing or wellbeing
// payloads. Exact generic names cover producer-neutral objects, while semantic
// prefixes cover the camelCase/snake_case names used by journal, mood, coach,
// reflection, and audio features. The stricter FR-031 boundary below also
// redacts string values under otherwise operational field names.
const SENSITIVE_CONTENT_FIELD_NAME_PATTERN =
  /(^|[_-])((?:journal|diary)[_-]?(?:entry|text|content|note|notes)?|mood[_-]?(?:note|notes|text|content)|(?:reflection|gratitude)[_-]?(?:text|content|note|notes)?|coach[_-]?(?:prompt|response|message|content)|audio[_-]?(?:transcript|note|notes|content)|entry[_-]?(?:title|text|content|note|notes)|content|body|text|title|note|notes|prompt|response|transcript)s?($|[_-])/i;
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
const SAFE_BREADCRUMB_CATEGORIES = new Set([
  "app",
  "audio",
  "cache",
  "friends",
  "general",
  "network",
  "storage",
  "sync",
  "version-mismatch",
]);

function scrubString(str: string): string {
  return SENSITIVE_PATTERNS.reduce((result, pattern) => result.replace(pattern, "[REDACTED]"), str);
}

function shouldRedactField(fieldName: string): boolean {
  return (
    SENSITIVE_FIELD_NAME_PATTERN.test(fieldName) ||
    SENSITIVE_CONTENT_FIELD_NAME_PATTERN.test(fieldName)
  );
}

function scrubSentryPayload(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return scrubString(value);
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value;
  if (seen.has(value)) return "[Circular]";

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => scrubSentryPayload(item, seen));
  }

  const scrubbed: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    scrubbed[key] = shouldRedactField(key) ? "[REDACTED]" : scrubSentryPayload(nestedValue, seen);
  }
  return scrubbed;
}

/**
 * FR-031 telemetry boundary. Caller-provided strings are free-form even when
 * their property name looks operational (`error`, `detail`, `url`, etc.).
 * Preserve only scalar measurements; redact every string recursively before
 * the value reaches Sentry or a retained event receipt.
 */
function redactFreeformTelemetryStrings(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return REDACTED;
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (seen.has(value)) return "[Circular]";

  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => redactFreeformTelemetryStrings(item, seen));
  }

  const scrubbed: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    scrubbed[key] = shouldRedactField(key)
      ? REDACTED
      : redactFreeformTelemetryStrings(nestedValue, seen);
  }
  return scrubbed;
}

function telemetrySafeError(error: Error): Error {
  const safe = new Error("Application error");
  safe.name = SAFE_ERROR_NAMES.has(error.name) ? error.name : "Error";
  return safe;
}

function getSentryPlatform(): "android" | "ios" | "web" {
  const capacitor = (globalThis as {
    Capacitor?: {
      getPlatform?: () => string;
      isNativePlatform?: () => boolean;
    };
  }).Capacitor;

  if (!capacitor?.isNativePlatform?.()) {
    return "web";
  }

  const value = capacitor.getPlatform?.();
  return value === "android" || value === "ios" ? value : "web";
}

/**
 * Initialize Sentry error monitoring
 * Call this as early as possible in the app lifecycle
 */
export function initSentry(): void {
  const dsn = SENTRY_DSN?.trim();
  const detectedPlatform = getSentryPlatform();
  const isNativeRuntime = detectedPlatform !== "web";

  // Skip if no valid DSN is configured (development without Sentry or copied placeholders)
  if (!isUsableSentryDsn(dsn)) {
    return;
  }

  // Build integrations list — replay only on web (rrweb crashes Android WebView)
  const integrations: Integration[] = [
    Sentry.browserTracingIntegration({
      shouldCreateSpanForRequest: (url) => {
        if (url.includes("/health")) return false;
        if (url.includes("sentry.io")) return false;
        if (url.includes("google-analytics")) return false;
        if (url.includes("googletagmanager")) return false;
        // Firebase telemetry (Analytics, Crashlytics, Remote Config) — not our
        // request path, and tracing them wastes transaction quota. Added per
        // 2026-04-19 deep audit §6 (research-confirmed canonical skip list).
        if (url.includes("firebase.googleapis.com")) return false;
        if (url.includes("firebaseinstallations.googleapis.com")) return false;
        if (url.includes("firebase-crashlytics.googleapis.com")) return false;
        if (url.includes("firebaseremoteconfig.googleapis.com")) return false;
        if (url.includes("firebaseio.com")) return false;
        if (url.includes("firebaseapp.com")) return false;
        return true;
      },
    }),
  ];

  // Session Replay stays disabled by default: ZenFlow contains diary, mood,
  // auth and coach surfaces, so error telemetry is enough without recording UI.
  // Keeping Replay out also prevents pulling rrweb into the production bundle.

  Sentry.init({
    dsn,
    environment: MODE,
    release: `zenflow@${__APP_VERSION__}`,

    // Performance monitoring - sample 10% of transactions
    tracesSampleRate: isNativeRuntime ? 0.05 : 0.1,

    // Distributed tracing targets - MUST be at root level for SDK v8+
    tracePropagationTargets: ["localhost", /^https:\/\/.*\.supabase\.co/],

    // Explicit opt-out of server-side PII inference (GDPR). v10.4.0 made this
    // the default, but setting it explicitly future-proofs against SDK default
    // flips. Source: docs.sentry.io v10 migration notes.
    sendDefaultPii: false,

    // Quota-saving denylist — browser-extension errors (Grammarly, password
    // managers, ad-blockers) and Capacitor's own webkit-masked URLs inject
    // noise that burns the 5k errors/month free-tier quota. Canonical list
    // per docs.sentry.io/.../filtering/ (2025).
    denyUrls: [
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
      /^safari-web-extension:\/\//,
      /^webkit-masked-url:\/\//,
      /\/extensions\//i,
    ],

    // Early-exit noise filter. `ignoreErrors` stops processing BEFORE beforeSend,
    // so it's cheaper than a beforeSend return null. ResizeObserver loops are
    // Chrome/WebKit quirks with no user impact. Non-Error promise rejection
    // means a caller threw a non-Error value — cannot get meaningful stack.
    ignoreErrors: [...SENTRY_IGNORE_ERRORS],
    allowUrls: [...SENTRY_ALLOW_URLS],

    integrations,

    // Privacy: Strip PII and tokens before sending
    // Also filter out expected/handled errors
    beforeSend(event, hint) {
      // Drop expected browser cancellations, stale-deploy chunk failures, and
      // known Supabase auth lock contention before scrubbing/sending.
      if (shouldDropSentryEvent(event, hint)) {
        return null;
      }

      // Only locally pseudonymized identifiers are admissible. Other user
      // fields may contain auth IDs or PII and are removed as a unit.
      if (event.user) {
        event.user = {};
      }

      // Scrub top-level strings too. Auth callback failures and manually
      // captured messages can carry token-bearing URLs outside request fields.
      if (event.message) {
        event.message = REDACTED;
      }
      if (event.transaction) {
        event.transaction = REDACTED;
      }
      if (event.exception) {
        event.exception = scrubSentryPayload(event.exception) as typeof event.exception;
        for (const exception of event.exception.values ?? []) {
          if (exception.value) exception.value = REDACTED;
          if (exception.type && !SAFE_ERROR_NAMES.has(exception.type)) exception.type = "Error";
          if (exception.mechanism?.data) {
            exception.mechanism.data = redactFreeformTelemetryStrings(
              exception.mechanism.data,
            ) as typeof exception.mechanism.data;
          }
          for (const frame of exception.stacktrace?.frames ?? []) {
            if (frame.vars) {
              frame.vars = redactFreeformTelemetryStrings(frame.vars) as typeof frame.vars;
            }
            if (frame.context_line) frame.context_line = REDACTED;
            if (frame.pre_context) frame.pre_context = frame.pre_context.map(() => REDACTED);
            if (frame.post_context) frame.post_context = frame.post_context.map(() => REDACTED);
          }
        }
      }
      if (event.fingerprint) {
        event.fingerprint = redactFreeformTelemetryStrings(event.fingerprint) as typeof event.fingerprint;
      }
      if (event.tags) {
        event.tags = redactFreeformTelemetryStrings(event.tags) as typeof event.tags;
      }

      // Scrub breadcrumb messages, request metadata, and caller-provided context.
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((bc) => ({
          ...bc,
          category: bc.category && SAFE_BREADCRUMB_CATEGORIES.has(bc.category)
            ? bc.category
            : bc.category ? REDACTED : bc.category,
          message: bc.message ? REDACTED : bc.message,
          data: bc.data
            ? (redactFreeformTelemetryStrings(bc.data) as Breadcrumb["data"])
            : bc.data,
        }));
      }

      // Scrub request URLs and payload-like fields.
      if (event.request?.url) {
        event.request.url = REDACTED;
      }
      if (event.request?.query_string) {
        const scrubbedQueryString = redactFreeformTelemetryStrings(event.request.query_string);
        event.request.query_string =
          typeof scrubbedQueryString === "string"
            ? scrubbedQueryString
            : JSON.stringify(scrubbedQueryString);
      }
      if (event.request?.cookies) {
        event.request.cookies = redactFreeformTelemetryStrings(
          event.request.cookies,
        ) as typeof event.request.cookies;
      }
      if (event.request?.data) {
        event.request.data = redactFreeformTelemetryStrings(event.request.data);
      }
      if (event.request?.headers) {
        const headers: Record<string, string> = {};
        for (const key of Object.keys(event.request.headers)) {
          headers[key] = REDACTED;
        }
        event.request.headers = headers;
      }

      if (event.extra) {
        event.extra = redactFreeformTelemetryStrings(event.extra) as typeof event.extra;
      }
      if (event.contexts) {
        event.contexts = redactFreeformTelemetryStrings(event.contexts) as typeof event.contexts;
      }
      if (event.logentry) {
        event.logentry = redactFreeformTelemetryStrings(event.logentry) as typeof event.logentry;
      }
      if (event.spans) {
        event.spans = event.spans.map((span) => ({
          ...span,
          description: span.description ? REDACTED : span.description,
          data: span.data
            ? (redactFreeformTelemetryStrings(span.data) as typeof span.data)
            : span.data,
        }));
      }

      // Don't send events in development
      if (IS_DEV) {
        return null;
      }

      return event;
    },

    // Add platform context
    initialScope: {
      tags: {
        platform: detectedPlatform,
        isNative: isNativeRuntime ? "yes" : "no",
      },
    },
  });
}

/**
 * Error categories for filtering and analysis in Sentry dashboard
 */
export type ErrorCategory =
  | "audio"
  | "cache"
  | "version-mismatch"
  | "storage"
  | "network"
  | "sync"
  | "general";

/**
 * Capture a custom error with context
 */
export function captureError(error: Error, context?: Record<string, unknown>): void {
  Sentry.captureException(telemetrySafeError(error), {
    extra: context
      ? (redactFreeformTelemetryStrings(context) as Record<string, unknown>)
      : undefined,
  });
}

/**
 * Capture error with category tag for filtering
 * Use this for categorized errors (audio, cache, version issues)
 */
export function captureErrorWithCategory(
  error: Error,
  category: ErrorCategory,
  context?: Record<string, unknown>
): void {
  Sentry.withScope((scope) => {
    scope.setTag("category", category);

    // Add extra context based on error type
    if (error.name === "AbortError") {
      scope.setTag("error_type", "abort");
      scope.setExtra("abort_reason", REDACTED);
    } else if (error.message.includes("Database deleted")) {
      scope.setTag("error_type", "database_deleted");
      scope.setExtra("likely_cause", "User cleared site data or Safari ITP");
    } else if (error.message.includes("chunk") || error.message.includes("module")) {
      scope.setTag("error_type", "chunk_load");
      scope.setExtra("likely_cause", "Version mismatch after deployment");
    }

    if (context) {
      scope.setExtras(redactFreeformTelemetryStrings(context) as Record<string, unknown>);
    }

    Sentry.captureException(telemetrySafeError(error));
  });
}

/**
 * Add breadcrumb with category
 */
export function addCategorizedBreadcrumb(
  category: ErrorCategory,
  message: string,
  data?: Record<string, unknown>,
  level: SeverityLevel = "info"
): void {
  Sentry.addBreadcrumb({
    category,
    message: message ? REDACTED : message,
    level,
    data: data
      ? (redactFreeformTelemetryStrings(data) as Record<string, unknown>)
      : undefined,
  });
}

/**
 * Capture a custom message
 */
export function captureMessage(message: string, level: SeverityLevel = "info"): void {
  Sentry.captureMessage(message ? "Application diagnostic event" : "Application event", level);
}

/**
 * Set user context (anonymized)
 */
export function setUserContext(userId: string): void {
  // FR-031: do not create a stable cross-event identifier from an auth ID.
  // Reading the argument only preserves the public API; no input bytes cross
  // the telemetry boundary.
  void userId;
  Sentry.setUser({
    id: "anonymous",
  });
}

/**
 * Clear user context on logout
 */
export function clearUserContext(): void {
  Sentry.setUser(null);
}

/**
 * Re-export addBreadcrumb so all consumers import from @/lib/sentry
 * instead of Sentry packages directly.
 */
export function addBreadcrumb(breadcrumb: Breadcrumb, hint?: BreadcrumbHint): void {
  Sentry.addBreadcrumb(
    {
      ...breadcrumb,
      category:
        breadcrumb.category && SAFE_BREADCRUMB_CATEGORIES.has(breadcrumb.category)
          ? breadcrumb.category
          : breadcrumb.category ? REDACTED : breadcrumb.category,
      message: breadcrumb.message ? REDACTED : breadcrumb.message,
      data: breadcrumb.data
        ? (redactFreeformTelemetryStrings(breadcrumb.data) as Breadcrumb["data"])
        : breadcrumb.data,
    },
    hint,
  );
}
