/**
 * Sentry Error Monitoring Integration
 *
 * Sends crash reports and performance data to Sentry for monitoring.
 * Respects user privacy by stripping PII before sending.
 *
 * Free tier: 5,000 errors/month, 10,000 transactions/month
 */

import * as Sentry from "@sentry/browser";
import type {
  Breadcrumb,
  BreadcrumbHint,
  Event,
  EventHint,
  Integration,
  SeverityLevel,
  SpanAttributeValue,
  SpanJSON,
  TransactionEvent,
} from "@sentry/core";
import {
  SENTRY_ALLOW_URLS,
  SENTRY_IGNORE_ERRORS,
  shouldDropSentryEvent,
} from "@/lib/sentryEventFilters";
import {
  DIAGNOSTIC_REDACTED,
  diagnosticCodeFrom,
  diagnosticErrorName,
  diagnosticStackFingerprint,
  sanitizeDiagnosticMetadata,
  sanitizeDiagnosticMetadataKey,
  sanitizeDiagnosticUrl,
  toDiagnosticError,
} from "@/lib/diagnosticPrivacy";

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

function sanitizeSentryException(
  exception: NonNullable<Event["exception"]>,
): NonNullable<Event["exception"]> {
  return {
    values: exception.values?.map((value) => ({
      type: "Error",
      value: "ZF_SENTRY_EXCEPTION",
      stacktrace: value.stacktrace
        ? {
            frames: value.stacktrace.frames?.slice(-20).map((frame) => ({
              function: frame.function ? "ZF_FRAME" : undefined,
              filename: frame.filename ? sanitizeDiagnosticUrl(frame.filename) : undefined,
              lineno: frame.lineno,
              colno: frame.colno,
              in_app: frame.in_app,
            })),
          }
        : undefined,
    })),
  };
}

const SAFE_HTTP_METHODS = new Set(["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]);
const SAFE_CONTENT_TYPES = new Set([
  "application/json",
  "application/octet-stream",
  "application/x-www-form-urlencoded",
  "multipart/form-data",
  "text/plain",
]);
const SAFE_BREADCRUMB_TYPES = new Set(["default", "error", "http", "info", "navigation", "query", "user"]);
const SAFE_EVENT_ENVIRONMENTS = new Set(["development", "production", "staging", "test"]);
const SAFE_EVENT_LEVELS = new Set([
  "debug",
  "error",
  "fatal",
  "info",
  "log",
  "warning",
]);
const SAFE_EVENT_KEYS = new Set([
  "breadcrumbs",
  "contexts",
  "environment",
  "event_id",
  "exception",
  "extra",
  "fingerprint",
  "level",
  "logentry",
  "logger",
  "measurements",
  "message",
  "platform",
  "release",
  "request",
  "sdk",
  "spans",
  "start_timestamp",
  "tags",
  "timestamp",
  "transaction",
  "transaction_info",
  "type",
  "user",
]);
const SAFE_MEASUREMENTS = new Set(["cls", "fcp", "fid", "inp", "lcp", "ttfb"]);
const SAFE_SPAN_STATUSES = new Set([
  "already_exists",
  "cancelled",
  "data_loss",
  "deadline_exceeded",
  "failed_precondition",
  "internal_error",
  "invalid_argument",
  "not_found",
  "ok",
  "out_of_range",
  "permission_denied",
  "resource_exhausted",
  "unauthenticated",
  "unavailable",
  "unimplemented",
  "unknown_error",
]);

function safeHexIdentifier(value: string | undefined, length: number): string | undefined {
  return value && new RegExp(`^[a-f0-9]{${length}}$`).test(value) ? value : undefined;
}

function sanitizeSentrySpanData(data: SpanJSON["data"]): SpanJSON["data"] {
  const safe: Record<string, SpanAttributeValue | undefined> = {};
  for (const [key, value] of Object.entries(sanitizeDiagnosticMetadata(data))) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      safe[key] = value;
    }
  }
  return safe;
}

function sanitizeSentryBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  return {
    category: breadcrumb.category ? "zenflow.diagnostic" : undefined,
    level: breadcrumb.level,
    timestamp: breadcrumb.timestamp,
    type: breadcrumb.type && SAFE_BREADCRUMB_TYPES.has(breadcrumb.type)
      ? breadcrumb.type
      : undefined,
    message: breadcrumb.message ? "ZF_SENTRY_BREADCRUMB" : undefined,
    data: breadcrumb.data ? sanitizeDiagnosticMetadata(breadcrumb.data) : undefined,
  };
}

function trySanitizeSentryBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  try {
    return sanitizeSentryBreadcrumb(breadcrumb);
  } catch {
    return null;
  }
}

function clearSentryHint(hint: EventHint | undefined): boolean {
  try {
    if (!hint) return true;
    let cleared = true;
    try {
      if (Array.isArray(hint.attachments) && hint.attachments.length > 0) {
        hint.attachments.length = 0;
        if (hint.attachments.length !== 0) cleared = false;
      } else if (hint.attachments !== undefined && !Array.isArray(hint.attachments)) {
        hint.attachments = undefined;
      }
    } catch {
      cleared = false;
    }
    for (const key of ["originalException", "syntheticException", "captureContext", "data"] as const) {
      try {
        if (hint[key] === undefined) continue;
        hint[key] = undefined;
        if (hint[key] !== undefined) cleared = false;
      } catch {
        cleared = false;
      }
    }
    return cleared;
  } catch {
    return false;
  }
}

function scrubSentryEventOrDrop<T extends Event>(event: T, hint?: EventHint): T | null {
  let sanitized: T | null = null;
  let hintCleared = false;
  try {
    if (!shouldDropSentryEvent(event, hint)) {
      sanitized = sanitizeSentryEvent(event);
    }
  } catch {
    sanitized = null;
  } finally {
    hintCleared = clearSentryHint(hint);
  }
  return hintCleared ? sanitized : null;
}

function sanitizeSentryEvent<T extends Event>(event: T): T {
  const eventRecord = event as T & Record<string, unknown>;
  for (const key of Object.keys(eventRecord)) {
    if (!SAFE_EVENT_KEYS.has(key)) delete eventRecord[key];
  }

  const eventId = safeHexIdentifier(event.event_id, 32);
  if (eventId) event.event_id = eventId;
  else delete event.event_id;
  if (event.timestamp !== undefined && (!Number.isFinite(event.timestamp) || event.timestamp < 0)) {
    delete event.timestamp;
  }
  if (
    event.start_timestamp !== undefined &&
    (!Number.isFinite(event.start_timestamp) || event.start_timestamp < 0)
  ) {
    delete event.start_timestamp;
  }
  if (event.level && !SAFE_EVENT_LEVELS.has(event.level)) delete event.level;
  if (event.platform) event.platform = "javascript";
  if (event.release) event.release = `zenflow@${__APP_VERSION__}`;
  if (event.environment) {
    event.environment = SAFE_EVENT_ENVIRONMENTS.has(MODE) ? MODE : "production";
  }
  if (event.transaction_info) event.transaction_info = { source: "custom" };
  if (event.type && event.type !== "transaction") delete event.type;

  if (event.user) event.user = {};
  if (event.sdk) {
    event.sdk = {
      name: "sentry.javascript.browser",
      version: Sentry.SDK_VERSION,
      settings: { infer_ip: "never" },
    };
  }
  if (event.message) event.message = diagnosticCodeFrom(event.message, "ZF_SENTRY_EVENT");
  if (event.logentry) event.logentry = { message: "ZF_SENTRY_LOGENTRY" };
  if (event.transaction) event.transaction = "ZF_SENTRY_TRANSACTION";
  if (event.exception) event.exception = sanitizeSentryException(event.exception);
  if (event.fingerprint) event.fingerprint = ["ZF_SENTRY_FINGERPRINT"];
  if (event.tags) event.tags = sanitizeDiagnosticMetadata(event.tags) as typeof event.tags;

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.slice(-50).map(sanitizeSentryBreadcrumb);
  }

  if (event.request) {
    const request = event.request;
    const method = typeof request.method === "string" ? request.method.toUpperCase() : undefined;
    const contentType = request.headers?.["content-type"] ?? request.headers?.["Content-Type"];
    const safeHeaders: Record<string, string> = typeof contentType === "string" && SAFE_CONTENT_TYPES.has(contentType)
      ? { "content-type": contentType }
      : {};
    event.request = {
      ...(request.url ? { url: sanitizeDiagnosticUrl(request.url) } : {}),
      ...(method && SAFE_HTTP_METHODS.has(method) ? { method } : {}),
      ...(request.query_string ? { query_string: DIAGNOSTIC_REDACTED } : {}),
      ...(request.cookies ? { cookies: { redacted: DIAGNOSTIC_REDACTED } } : {}),
      ...(request.data
        ? {
            data: typeof request.data === "object" && request.data !== null
              ? sanitizeDiagnosticMetadata(request.data as Record<string, unknown>)
              : DIAGNOSTIC_REDACTED,
          }
        : {}),
      ...(request.headers ? { headers: safeHeaders } : {}),
    };
  }

  if (event.extra) event.extra = sanitizeDiagnosticMetadata(event.extra);
  if (event.contexts) {
    const contexts: Record<string, ReturnType<typeof sanitizeDiagnosticMetadata>> = {};
    for (const [index, [key, value]] of Object.entries(event.contexts).slice(0, 10).entries()) {
      let safeKey = sanitizeDiagnosticMetadataKey(key, index);
      if (Object.prototype.hasOwnProperty.call(contexts, safeKey)) {
        safeKey = `redacted_context_${index}`;
      }
      contexts[safeKey] = sanitizeDiagnosticMetadata(value);
    }
    event.contexts = contexts;
  }

  if (event.spans) {
    event.spans = event.spans.slice(-100).map((span) => ({
      data: sanitizeSentrySpanData(span.data),
      description: span.description ? "ZF_SENTRY_SPAN" : undefined,
      op: span.op ? "zf.operation" : undefined,
      parent_span_id: safeHexIdentifier(span.parent_span_id, 16),
      span_id: safeHexIdentifier(span.span_id, 16) ?? "0000000000000000",
      start_timestamp: span.start_timestamp,
      status: span.status && SAFE_SPAN_STATUSES.has(span.status) ? span.status : undefined,
      timestamp: span.timestamp,
      trace_id: safeHexIdentifier(span.trace_id, 32) ?? "00000000000000000000000000000000",
      origin: span.origin ? "manual.app" : undefined,
      exclusive_time: span.exclusive_time,
      is_segment: span.is_segment,
      segment_id: safeHexIdentifier(span.segment_id, 16),
      measurements: span.measurements
        ? Object.fromEntries(
            Object.entries(span.measurements)
              .filter(([key, measurement]) =>
                SAFE_MEASUREMENTS.has(key) && Number.isFinite(measurement.value),
              )
              .map(([key, measurement]) => [key, { value: measurement.value, unit: "none" }]),
          )
        : undefined,
    }));
  }

  if (event.measurements) {
    event.measurements = Object.fromEntries(
      Object.entries(event.measurements).filter(([key, measurement]) =>
        SAFE_MEASUREMENTS.has(key) && Number.isFinite(measurement.value),
      ).map(([key, measurement]) => [key, { value: measurement.value, unit: "none" }]),
    );
  }

  if (event.logger) event.logger = "zenflow.diagnostic";
  if (event.server_name) event.server_name = DIAGNOSTIC_REDACTED;
  delete event.modules;
  delete event.debug_meta;
  delete event.sdkProcessingMetadata;
  delete event.threads;
  return event;
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

    beforeBreadcrumb(breadcrumb) {
      return trySanitizeSentryBreadcrumb(breadcrumb);
    },

    // Privacy: Strip PII and tokens before sending
    // Also filter out expected/handled errors
    beforeSend(event, hint) {
      const sanitized = scrubSentryEventOrDrop(event, hint);
      if (!sanitized) return null;

      // Don't send events in development
      if (IS_DEV) {
        return null;
      }

      return sanitized;
    },

    beforeSendTransaction(event: TransactionEvent, hint) {
      const sanitized = scrubSentryEventOrDrop(event, hint);
      return IS_DEV ? null : sanitized;
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
  Sentry.captureException(toDiagnosticError(error, "ZF_SENTRY_EXCEPTION"), {
    extra: {
      ...sanitizeDiagnosticMetadata(context),
      stack_fingerprint: diagnosticStackFingerprint(error),
    },
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
    const safeErrorName = diagnosticErrorName(error);
    let rawMessage = "";
    try {
      rawMessage = typeof error.message === "string" ? error.message : "";
    } catch {
      rawMessage = "";
    }
    if (safeErrorName === "AbortError") {
      scope.setTag("error_type", "abort");
      scope.setExtra("reason", "abort");
    } else if (rawMessage.includes("Database deleted")) {
      scope.setTag("error_type", "database_deleted");
      scope.setExtra("reason", "site_data_unavailable");
    } else if (rawMessage.includes("chunk") || rawMessage.includes("module")) {
      scope.setTag("error_type", "chunk_load");
      scope.setExtra("reason", "version_mismatch");
    }

    if (context) {
      scope.setExtras(sanitizeDiagnosticMetadata(context));
    }
    scope.setExtra("stack_fingerprint", diagnosticStackFingerprint(error));

    Sentry.captureException(toDiagnosticError(error, "ZF_SENTRY_EXCEPTION"));
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
    message: diagnosticCodeFrom(`[${category}] ${message}`, "ZF_SENTRY_BREADCRUMB"),
    level,
    data: sanitizeDiagnosticMetadata(data),
  });
}

/**
 * Capture a custom message
 */
export function captureMessage(_message: string, level: SeverityLevel = "info"): void {
  Sentry.captureMessage("ZF_SENTRY_MESSAGE", level);
}

/**
 * Set user context (anonymized)
 */
export function setUserContext(userId: string): void {
  void userId;
  Sentry.setUser(null);
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
  // SDK hints can contain DOM events, request objects, or thrown values. They
  // are not needed for ZenFlow's bounded breadcrumb schema and never cross the
  // telemetry boundary.
  void hint;
  const sanitized = trySanitizeSentryBreadcrumb(breadcrumb);
  if (sanitized) Sentry.addBreadcrumb(sanitized);
}
