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

function scrubString(str: string): string {
  return SENSITIVE_PATTERNS.reduce((result, pattern) => result.replace(pattern, "[REDACTED]"), str);
}

function shouldRedactField(fieldName: string): boolean {
  return SENSITIVE_FIELD_NAME_PATTERN.test(fieldName);
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

  // Session replay only on web — rrweb uses Shadow DOM / MutationObserver
  // features that can crash in Android WebView
  if (!isNativeRuntime) {
    integrations.push(
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
      })
    );
  }

  Sentry.init({
    dsn,
    environment: MODE,
    release: `zenflow@${__APP_VERSION__}`,

    // Performance monitoring - sample 10% of transactions
    tracesSampleRate: isNativeRuntime ? 0.05 : 0.1,

    // Distributed tracing targets - MUST be at root level for SDK v8+
    tracePropagationTargets: ["localhost", /^https:\/\/.*\.supabase\.co/],

    // Session replay rates — only effective on web (integration not added on native)
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

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

      // Remove user email and IP
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
        delete event.user.username;
      }

      // Scrub top-level strings too. Auth callback failures and manually
      // captured messages can carry token-bearing URLs outside request fields.
      if (event.message) {
        event.message = scrubString(event.message);
      }
      if (event.transaction) {
        event.transaction = scrubString(event.transaction);
      }
      if (event.exception) {
        event.exception = scrubSentryPayload(event.exception) as typeof event.exception;
      }
      if (event.fingerprint) {
        event.fingerprint = scrubSentryPayload(event.fingerprint) as typeof event.fingerprint;
      }
      if (event.tags) {
        event.tags = scrubSentryPayload(event.tags) as typeof event.tags;
      }

      // Scrub breadcrumb messages, request metadata, and caller-provided context.
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((bc) => ({
          ...bc,
          message: bc.message ? scrubString(bc.message) : bc.message,
          data: bc.data ? (scrubSentryPayload(bc.data) as Breadcrumb["data"]) : bc.data,
        }));
      }

      // Scrub request URLs and payload-like fields.
      if (event.request?.url) {
        event.request.url = scrubString(event.request.url);
      }
      if (event.request?.query_string) {
        const scrubbedQueryString = scrubSentryPayload(event.request.query_string);
        event.request.query_string =
          typeof scrubbedQueryString === "string"
            ? scrubbedQueryString
            : JSON.stringify(scrubbedQueryString);
      }
      if (event.request?.cookies) {
        event.request.cookies = scrubSentryPayload(event.request.cookies) as typeof event.request.cookies;
      }
      if (event.request?.data) {
        event.request.data = scrubSentryPayload(event.request.data);
      }
      if (event.request?.headers) {
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(event.request.headers)) {
          headers[key] = shouldRedactField(key) ? "[REDACTED]" : scrubString(String(value));
        }
        event.request.headers = headers;
      }

      if (event.extra) {
        event.extra = scrubSentryPayload(event.extra) as typeof event.extra;
      }
      if (event.contexts) {
        event.contexts = scrubSentryPayload(event.contexts) as typeof event.contexts;
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
  Sentry.captureException(error, {
    extra: context,
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
      scope.setExtra("abort_reason", error.message);
    } else if (error.message.includes("Database deleted")) {
      scope.setTag("error_type", "database_deleted");
      scope.setExtra("likely_cause", "User cleared site data or Safari ITP");
    } else if (error.message.includes("chunk") || error.message.includes("module")) {
      scope.setTag("error_type", "chunk_load");
      scope.setExtra("likely_cause", "Version mismatch after deployment");
    }

    if (context) {
      scope.setExtras(context);
    }

    Sentry.captureException(error);
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
    message,
    level,
    data,
  });
}

/**
 * Capture a custom message
 */
export function captureMessage(message: string, level: SeverityLevel = "info"): void {
  Sentry.captureMessage(message, level);
}

/**
 * Set user context (anonymized)
 */
export function setUserContext(userId: string): void {
  // Hash userId to avoid sending raw PII to Sentry (GDPR pseudonymization)
  let hash = 5381;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) + hash + userId.charCodeAt(i)) >>> 0;
  }
  Sentry.setUser({
    id: `u-${hash.toString(36)}`,
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
  Sentry.addBreadcrumb(breadcrumb, hint);
}
